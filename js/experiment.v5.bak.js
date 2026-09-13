/* =========================================================================
 *  experiment.js  —  Master timeline assembly and jsPsych initialisation
 *
 *  Loads after config.js, panels.js, and phases.js. Assigns condition
 *  RANDOMLY on every run (or from URL override), builds the full timeline,
 *  runs it, and on completion downloads TWO CSV files:
 *     1. roconn_<pid>_<cell>_<sg>.csv            — full trial-level data
 *     2. roconn_condition_<pid>_<cell>_<sg>.csv  — one-row condition manifest
 * ========================================================================= */

/* -------------------------------------------------------------------------
 *  CSV download helpers (used by on_finish)
 * ----------------------------------------------------------------------- */
function roconnCsvCell (v) {
    v = (v === null || v === undefined) ? '' : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function roconnDownloadCSV (filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* Build the one-row condition manifest. Outcome fields are best-effort:
   they are read from accumulated data if the session reached that far. */
function roconnBuildConditionCSV (condition, jsPsych) {
    let last = {};
    try {
        const vals = jsPsych.data.get().values();
        last = vals.length ? vals[vals.length - 1] : {};
    } catch (e) { /* no data yet */ }

    const po = condition.pressureOrder || [];
    const header = [
        'pid', 'cell', 'subgroup', 'topology', 'direction',
        'encoded_seq', 'pushed_seq',
        'pressure_block1', 'pressure_block2', 'pressure_block3',
        'assignment', 'session_start', 'completed_at',
        'prequiz_yes_count', 'immediate_recall_correct',
        'post_distractor_accuracy', 'withdrew',
    ];
    const row = [
        condition.pid, condition.cell, condition.subgroup,
        condition.topology, condition.direction,
        condition.encodedSeq, condition.pushedSeq,
        po[0], po[1], po[2],
        condition.assignment, condition.sessionStart, new Date().toISOString(),
        last.prequiz_yes_count, last.immediate_recall_correct,
        last.post_distractor_accuracy,
        (last.withdraw === true ? 1 : (last.withdraw === false ? 0 : '')),
    ];
    return header.join(',') + '\n' + row.map(roconnCsvCell).join(',') + '\n';
}

(function main () {
    /* ---- 1. Condition assignment (RANDOM by default) ----------------- */
    const condition = ROCONN.assignCondition();
    console.log('ROCONN condition (' + condition.assignment + '):', condition);
    try { document.title = ROCONN.studyName; } catch (e) {}

    /* ---- 2. jsPsych initialisation ----------------------------------- */
    const jsPsych = initJsPsych({
        display_element: 'jspsych-target',
        show_progress_bar: false,
        default_iti: 0,

        on_finish: function () {
            const dataFilename = `roconn_${condition.pid}_${condition.cell}_${condition.subgroup}.csv`;
            const condFilename = `roconn_condition_${condition.pid}_${condition.cell}_${condition.subgroup}.csv`;

            const dataCSV = jsPsych.data.get().csv();
            const condCSV = roconnBuildConditionCSV(condition, jsPsych);

            // Auto-download both files. The condition file is staggered to
            // avoid the browser's "multiple downloads" suppression.
            roconnDownloadCSV(dataFilename, dataCSV);
            setTimeout(() => roconnDownloadCSV(condFilename, condCSV), 600);

            // OPTIONAL server save: GitHub Pages is static (no backend), so
            // for unattended online runs point the experiment at any collector
            // that accepts a POST, via the URL, e.g.
            //     ?data=https://your-endpoint.example/submit
            // Both CSVs are POSTed as JSON. The local download still happens,
            // so this is additive and safe to leave unset for in-lab use.
            const collector = new URLSearchParams(window.location.search).get('data');
            if (collector) {
                try {
                    fetch(collector, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pid: condition.pid, cell: condition.cell,
                            subgroup: condition.subgroup,
                            data_filename: dataFilename, data_csv: dataCSV,
                            condition_filename: condFilename, condition_csv: condCSV,
                        }),
                    }).catch(e => console.warn('ROCONN data POST failed:', e));
                } catch (e) { console.warn('ROCONN data POST error:', e); }
            }

            // Guaranteed manual fallback (a real click always downloads,
            // even if the browser blocked the programmatic attempts).
            window.__roconnDownload = {
                data:      () => roconnDownloadCSV(dataFilename, dataCSV),
                condition: () => roconnDownloadCSV(condFilename, condCSV),
            };

            document.body.innerHTML = `
                <div style="max-width:640px;margin:7em auto;
                            font-family:Georgia,serif;line-height:1.6;text-align:center;
                            color:#1a2238;">
                    <h2>Session complete</h2>
                    <p>Thank you. Your responses have been saved.</p>
                    <p style="font-size:0.92em;color:#555;">
                       Two files should have downloaded automatically:<br>
                       <code>${dataFilename}</code> (full data) and<br>
                       <code>${condFilename}</code> (condition).</p>
                    <p style="font-size:0.92em;color:#555;">
                       If a download did not appear, use the buttons below.</p>
                    <div style="margin:1.6em 0;">
                        <button onclick="window.__roconnDownload.condition()"
                            style="font-family:Inter,system-ui,sans-serif;font-size:0.95rem;
                                   color:#fff;background:#1a2238;border:1px solid #1a2238;
                                   padding:0.7em 1.4em;margin:0.4em;cursor:pointer;border-radius:2px;">
                            Download condition file (CSV)
                        </button>
                        <button onclick="window.__roconnDownload.data()"
                            style="font-family:Inter,system-ui,sans-serif;font-size:0.95rem;
                                   color:#1a2238;background:#fff;border:1px solid #1a2238;
                                   padding:0.7em 1.4em;margin:0.4em;cursor:pointer;border-radius:2px;">
                            Download data file (CSV)
                        </button>
                    </div>
                    <p>Please call the experimenter for the final debriefing.</p>
                </div>`;
        },

        on_trial_finish: function (data) {
            // Attach session-level metadata to every trial.
            data.pid          = condition.pid;
            data.cell         = condition.cell;
            data.subgroup     = condition.subgroup;
            data.topology     = condition.topology;
            data.direction    = condition.direction;
            data.encoded_seq  = condition.encodedSeq;
            data.pushed_seq   = condition.pushedSeq;
            data.assignment   = condition.assignment;
        },
    });

    // Make the jsPsych instance globally available for phase modules
    // (phases.js references `jsPsych.data` and `jsPsych.randomization`).
    window.jsPsych = jsPsych;

    /* ---- 3. Pre-load (no remote assets, just a placeholder) ---------- */
    const preload = {
        type: jsPsychPreload,
        auto_preload: false,
        message: '',
    };

    /* ---- 4. Build the full timeline ---------------------------------- */
    const timeline = [];

    timeline.push(preload);

    // ---- Intro, consent, instructions, pre-quiz
    timeline.push(...ROCONN.phases.buildIntro(condition));

    // ---- Encoding (two read-throughs)
    timeline.push(...ROCONN.phases.buildEncoding(condition));

    // ---- Immediate recall (gate: ≥6/7 required)
    timeline.push(...ROCONN.phases.buildRecallTest(condition, 'immediate_recall'));

    // ---- Distractor window (20 min)
    timeline.push(...ROCONN.phases.buildDistractor());

    // ---- Post-distractor recall (covariate, no gate)
    timeline.push(...ROCONN.phases.buildRecallTest(condition, 'post_distractor_recall'));

    // ---- Panel training
    timeline.push(ROCONN.phases.buildTraining());

    // ---- Three bisection blocks, ordered by subgroup
    condition.pressureOrder.forEach((pressure, idx) => {
        const blockOrder = idx + 1;            // 1-indexed
        const blockIndex = idx;                // 0/1/2 — drives avatar rotation
        const blockTrials = ROCONN.phases.buildBisectionBlock(
            condition, pressure, blockIndex, blockOrder);
        timeline.push(...blockTrials);

        // Inter-block rest after blocks 1 and 2 only.
        if (idx < 2) {
            timeline.push(ROCONN.phases.buildInterBlockRest(blockOrder));
        }
    });

    // ---- Post-task manipulation checks
    timeline.push(...ROCONN.phases.buildPostMeasures());

    // ---- Funnelled debrief + full disclosure (reveals the confederate deception)
    timeline.push(...ROCONN.phases.buildDebrief());

    // ---- Exit fullscreen
    timeline.push({
        type: jsPsychFullscreen,
        fullscreen_mode: false,
    });

    /* ---- 5. Mount target div and run --------------------------------- */
    const target = document.createElement('div');
    target.id = 'jspsych-target';
    document.body.appendChild(target);

    if (ROCONN.demo) {
        const banner = document.createElement('div');
        banner.textContent =
            'DEMO MODE — gates off, timing shortened, 10 trials/block. Not for data collection.';
        banner.style.cssText =
            'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b03434;color:#fff;'
          + 'font:600 12px/1.7 Inter,system-ui,sans-serif;text-align:center;letter-spacing:0.03em;';
        document.body.appendChild(banner);
    }

    jsPsych.run(timeline);
})();
