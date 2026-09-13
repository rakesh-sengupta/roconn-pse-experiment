/* =========================================================================
 *  tasks.js  —  Self-contained, in-browser distractor tasks
 *
 *  Replaces the paper-based, experimenter-administered distractors of
 *  Protocol v5 §6 with two interactive jsPsych tasks that need NO
 *  experimenter interference:
 *      ROCONN.buildMatrixTask()  -> non-verbal pattern-completion items
 *      ROCONN.buildWordSearch()  -> interactive click-to-select word search
 *
 *  Both are ORIGINAL/algorithmic (no copyrighted Raven's items). Purpose,
 *  per protocol: moderate cognitive interference for ~16-20 min to induce
 *  partial forgetting — not exhaustion.
 * ========================================================================= */

/* =========================================================================
 *  1.  MATRIX REASONING  (figure rotation pattern completion)
 *  A 3x3 grid of an asymmetric glyph rotated by a per-row/col rule; the
 *  bottom-right cell is missing. Six options; pick the one that continues
 *  the pattern. Fully deterministic given a seed-free random draw.
 * ========================================================================= */

/* Asymmetric arrow glyph in a 50x50 box (unambiguous under rotation). */
function _glyph (angle, size = 56, stroke = '#1a2238') {
    return `
    <svg viewBox="0 0 50 50" width="${size}" height="${size}" style="display:block;margin:auto;">
        <g transform="rotate(${angle} 25 25)">
            <polygon points="25,7 39,28 30,28 30,43 20,43 20,28 11,28"
                     fill="${stroke}"/>
            <circle cx="25" cy="7" r="2.6" fill="#b03434"/>
        </g>
    </svg>`;
}

function _shuffle (a) {
    const x = a.slice();
    for (let i = x.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
}

/* Build one matrix item -> { gridHTML, options:[html...], correctIndex } */
function _makeMatrixItem () {
    const steps = [45, 90, 135, 270, 315];
    const rStep = steps[Math.floor(Math.random() * steps.length)];
    const cStep = steps[Math.floor(Math.random() * steps.length)];
    const ang = (r, c) => (((r * rStep + c * cStep) % 360) + 360) % 360;

    // 3x3 grid; cell (2,2) hidden.
    let cells = '';
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            cells += (r === 2 && c === 2)
                ? `<div class="mtx-cell mtx-missing">?</div>`
                : `<div class="mtx-cell">${_glyph(ang(r, c), 52)}</div>`;
        }
    }
    const gridHTML = `<div class="mtx-grid">${cells}</div>`;

    const correctAngle = ang(2, 2);
    // Distractor angles: other multiples of 45, distinct from correct.
    const pool = [];
    for (let a = 0; a < 360; a += 45) if (a !== correctAngle) pool.push(a);
    const distract = _shuffle(pool).slice(0, 5);
    const optionAngles = _shuffle([correctAngle, ...distract]);
    const options = optionAngles.map(a => _glyph(a, 56));
    const correctIndex = optionAngles.indexOf(correctAngle);
    return { gridHTML, options, correctIndex };
}

ROCONN.buildMatrixTask = function () {
    const nItems = ROCONN.params.matrixItems || 10;
    const cap    = ROCONN.params.matrixItemMaxMs || 45000;

    const intro = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen">
            <h2>Task 1 — Pattern puzzles</h2>
            <p>Each puzzle shows a grid of shapes that follow a pattern, with the
               bottom-right shape missing. Choose the option that best completes
               the pattern.</p>
            <p>Work at a comfortable pace. There are ${nItems} puzzles.</p>
           </div>`,
        choices: ['Begin'],
        data: { phase: 'distractor_matrix_intro' },
    };

    const items = [];
    for (let i = 0; i < nItems; i++) {
        const item = _makeMatrixItem();
        items.push({
            type: jsPsychHtmlButtonResponse,
            stimulus: `<div class="mtx-wrap">
                        <div class="mtx-counter">Puzzle ${i + 1} of ${nItems}</div>
                        ${item.gridHTML}
                        <div class="mtx-prompt">Which option completes the pattern?</div>
                       </div>`,
            choices: item.options,
            button_html: '<button class="jspsych-btn mtx-opt">%choice%</button>',
            trial_duration: cap,
            data: { phase: 'distractor_matrix', item_index: i, correct_index: item.correctIndex },
            on_finish: function (data) {
                data.matrix_correct = (data.response === data.correct_index) ? 1 : 0;
            },
        });
    }
    return [intro, ...items];
};

/* =========================================================================
 *  2.  INTERACTIVE WORD SEARCH
 *  A letter grid with hidden words; click the first then the last letter of
 *  a word to select it. Found words are highlighted and struck off the list.
 *  Auto-advances at trial_duration (enforces the minimum distractor time).
 * ========================================================================= */

const WORDSEARCH_WORDS =
    ['GARDEN', 'PLANET', 'SILVER', 'MARKET', 'WINDOW',
     'ORANGE', 'FOREST', 'CANDLE', 'BRIDGE', 'PEPPER'];

ROCONN.buildWordSearch = function () {
    const durationMs = ROCONN.params.wordsearchMs || 480000;
    const size = ROCONN.params.wordsearchGrid || 12;
    const wordCount = ROCONN.params.wordsearchCount || 8;

    return {
        type: jsPsychHtmlKeyboardResponse,
        choices: 'NO_KEYS',
        trial_duration: durationMs,
        stimulus: `<div class="text-screen ws-wrap">
            <h2>Task 2 — Word search</h2>
            <p class="ws-help">Find the hidden words. Click the <b>first</b> letter
               of a word, then its <b>last</b> letter. Words run horizontally,
               vertically, or diagonally (forwards or backwards).</p>
            <div class="ws-timer" id="ws-timer">--:--</div>
            <div class="ws-board">
                <div id="ws-grid" class="ws-grid"></div>
                <ul id="ws-list" class="ws-list"></ul>
            </div>
            <p class="ws-help">The next part begins automatically when the time is up.</p>
           </div>`,
        data: { phase: 'distractor_wordsearch', duration_ms: durationMs },
        on_load: function () {
            const N = size;
            const words = _shuffle(WORDSEARCH_WORDS)
                            .filter(w => w.length <= N)
                            .slice(0, wordCount);
            const grid = Array.from({ length: N }, () => Array(N).fill(null));
            const dirs = [[0,1],[1,0],[1,1],[-1,1],[0,-1],[-1,0],[-1,-1],[1,-1]];
            const placed = [];

            function tryPlace (word) {
                for (let attempt = 0; attempt < 200; attempt++) {
                    const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
                    const r0 = Math.floor(Math.random() * N);
                    const c0 = Math.floor(Math.random() * N);
                    const rEnd = r0 + dr * (word.length - 1);
                    const cEnd = c0 + dc * (word.length - 1);
                    if (rEnd < 0 || rEnd >= N || cEnd < 0 || cEnd >= N) continue;
                    let ok = true;
                    for (let k = 0; k < word.length; k++) {
                        const ch = grid[r0 + dr * k][c0 + dc * k];
                        if (ch !== null && ch !== word[k]) { ok = false; break; }
                    }
                    if (!ok) continue;
                    for (let k = 0; k < word.length; k++) grid[r0 + dr * k][c0 + dc * k] = word[k];
                    placed.push(word);
                    return true;
                }
                return false;
            }
            const targets = words.filter(tryPlace);
            const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            for (let r = 0; r < N; r++)
                for (let c = 0; c < N; c++)
                    if (grid[r][c] === null) grid[r][c] = A[Math.floor(Math.random() * 26)];

            // render grid
            const gridEl = document.getElementById('ws-grid');
            if (!gridEl) return;
            gridEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
            for (let r = 0; r < N; r++) {
                for (let c = 0; c < N; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'ws-cell';
                    cell.textContent = grid[r][c];
                    cell.dataset.r = r; cell.dataset.c = c;
                    gridEl.appendChild(cell);
                }
            }
            const listEl = document.getElementById('ws-list');
            const liByWord = {};
            targets.forEach(w => {
                const li = document.createElement('li');
                li.textContent = w; liByWord[w] = li; listEl.appendChild(li);
            });

            const cellAt = (r, c) => gridEl.querySelector(`.ws-cell[data-r="${r}"][data-c="${c}"]`);
            let first = null;
            const found = new Set();
            ROCONN._wsFound = 0; ROCONN._wsTotal = targets.length;

            function clearSel () {
                gridEl.querySelectorAll('.ws-sel').forEach(e => e.classList.remove('ws-sel'));
            }
            function lineCells (r1, c1, r2, c2) {
                const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
                const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
                const straight = (r1 === r2 || c1 === c2 || Math.abs(r2 - r1) === Math.abs(c2 - c1));
                if (!straight) return null;
                const out = [];
                for (let k = 0; k < len; k++) out.push([r1 + dr * k, c1 + dc * k]);
                return out;
            }
            gridEl.addEventListener('click', function (ev) {
                const cell = ev.target.closest('.ws-cell');
                if (!cell) return;
                const r = +cell.dataset.r, c = +cell.dataset.c;
                if (!first) { first = [r, c]; cell.classList.add('ws-sel'); return; }
                const cells = lineCells(first[0], first[1], r, c);
                clearSel(); const start = first; first = null;
                if (!cells) return;
                const str = cells.map(([rr, cc]) => grid[rr][cc]).join('');
                const rev = str.split('').reverse().join('');
                const hit = targets.find(w => (w === str || w === rev) && !found.has(w));
                if (hit) {
                    found.add(hit); ROCONN._wsFound = found.size;
                    cells.forEach(([rr, cc]) => cellAt(rr, cc).classList.add('ws-hit'));
                    if (liByWord[hit]) liByWord[hit].classList.add('ws-done');
                }
            });

            // countdown
            const start = performance.now();
            (function tick () {
                const rem = Math.max(0, durationMs - (performance.now() - start));
                const m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
                const t = document.getElementById('ws-timer');
                if (t) t.textContent = `${m}:${s.toString().padStart(2, '0')}`;
                if (rem > 0) requestAnimationFrame(tick);
            })();
        },
        on_finish: function (data) {
            data.wordsearch_found = ROCONN._wsFound || 0;
            data.wordsearch_total = ROCONN._wsTotal || 0;
        },
    };
};
