/* =========================================================================
 *  phases.js  —  Timeline builders for each phase of the experiment
 *
 *  Every function returns either a jsPsych trial object or a sub-timeline
 *  (array of trials). The master assembly is in experiment.js.
 *
 *  All section references below are to Protocol v5.
 *
 *  --- PATCH NOTES (this revision) ----------------------------------------
 *   #1  bisection on_finish: timeouts (response === null) are now coded as
 *       response_num = null instead of 0, so missed trials are no longer
 *       silently counted as "start" responses. NOTE: the analysis pipeline
 *       must drop null response_num rows before aggregating "end" counts.
 *   #3  distractor Raven timer: the no-op `/ 5 * 5` arithmetic was removed;
 *       duration is now simply ravenSecsPerItem * 5 items * 1000 ms.
 *   #6  recall test: the seven numeric inputs are validated client-side to
 *       a strict permutation of 1–7 (each used exactly once) before the
 *       Continue button / Enter key will submit. Data shape is unchanged.
 * ========================================================================= */

ROCONN.phases = {};

/* =========================================================================
 *  CONSENT, INSTRUCTIONS, PRE-SCREENING                                §3
 * ========================================================================= */
ROCONN.phases.buildIntro = function (cond) {

    const enterFullscreen = {
        type: jsPsychFullscreen,
        fullscreen_mode: true,
        message: `<h2>Memory and Social Context Study</h2>
                  <p>This study runs in full-screen mode.</p>
                  <p>Press the button below to continue.</p>`,
        button_label: 'Enter full-screen',
    };

    const consent = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class="text-screen">
                <h2>Informed Consent</h2>
                <p>Welcome to the Memory and Social Context Study.</p>
                <p>You will read a short document about an international dispute and
                   complete some memory tasks. The session will take approximately
                   75 minutes. Your data will be stored anonymously under participant
                   ID <strong>${cond.pid}</strong>.</p>
                <p>You may withdraw at any time without consequence. The study has
                   been approved by the Institutional Ethics Committee.</p>
                <p>By clicking <em>I consent</em>, you confirm that you are aged
                   18 years or older and agree to participate.</p>
            </div>`,
        choices: ['I do not consent — exit', 'I consent — begin'],
        data: { phase: 'consent' },
        on_finish: function (data) {
            if (data.response === 0) jsPsych.endExperiment('Thank you. The session has been ended.');
        },
    };

    const instructions = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class="text-screen">
                <h2>What you will do today</h2>
                <p><em>Read aloud by the experimenter:</em></p>
                <blockquote>
                    "Welcome to the Memory and Social Context Study. You will read
                    a short document about an international dispute and complete some
                    memory tasks. Because we are studying group memory, other
                    participants in this room today have been assigned to read the
                    same document. After a short break, you will see how they have
                    ordered the events — and then make a series of quick sequence
                    judgements.
                    <br><br>
                    Everything runs on your computer. Please keep your eyes on your
                    own screen and do not discuss the document with anyone until
                    after the debrief at the end."
                </blockquote>
                <p>Please raise your hand quietly if you have any questions.</p>
            </div>`,
        choices: ['I understand — continue'],
        data: { phase: 'instructions' },
    };

    /* Pre-quiz: 10 yes/no items; score = # yes (= # "exposed" answers).
       Score >3 -> exclude (too well-informed about the topic).  §2.3 */
    const prequiz = {
        timeline: ROCONN.prequiz.map((item, i) => ({
            type: jsPsychHtmlButtonResponse,
            stimulus: `<div class="text-screen">
                        <p class="prequiz-counter">Question ${i + 1} of ${ROCONN.prequiz.length}</p>
                        <h3>${item.q}</h3>
                       </div>`,
            choices: ['Yes', 'No'],
            data: { phase: 'prequiz', q_index: i, correct_a: item.a },
            on_finish: function (data) {
                data.yes_response = (data.response === 0) ? 1 : 0;
            },
        })),
    };

    const prequizCheck = {
        type: jsPsychCallFunction,
        async: false,
        func: function () {
            const yes = jsPsych.data.get()
                                 .filter({ phase: 'prequiz' })
                                 .select('yes_response').sum();
            jsPsych.data.addProperties({ prequiz_yes_count: yes });
            if (yes > ROCONN.params.prequizMaxScore) {
                jsPsych.endExperiment(
                    `Thank you — based on your responses, this study is not the
                     right fit for you today. You will still receive full payment.
                     Please call the experimenter.`);
            }
        },
    };

    return [enterFullscreen, consent, instructions, prequiz, prequizCheck];
};

/* =========================================================================
 *  ENCODING — TWO READ-THROUGHS                                       §3.3
 * ========================================================================= */
ROCONN.phases.buildEncoding = function (cond) {
    const ordering = ROCONN.getEncodedOrdering(cond);   // event ids in display order
    const narrative = ROCONN.getNarrativeForSeq(cond.encodedSeq);

    // Each event becomes one self-paced slide.
    const buildSlide = (eventId, position, pass) => ({
        type: jsPsychHtmlButtonResponse,
        stimulus: `
            <div class="text-screen narrative-slide">
                <div class="slide-meta">
                    Read-through ${pass} of 2 &nbsp;·&nbsp; Event ${position} of 7
                </div>
                <h3>${ROCONN.events[eventId].label}</h3>
                <p>${narrative[eventId]}</p>
            </div>`,
        choices: ['Continue'],
        data: { phase: 'encoding', pass, event_id: eventId, position },
    });

    const introPass2 = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen">
                    <h2>Please read again</h2>
                    <p>Please read the document a second time, paying close attention
                       to the <strong>order</strong> in which events occurred. You
                       will be tested on this shortly.</p>
                   </div>`,
        choices: ['Begin second read-through'],
        data: { phase: 'encoding_pass2_intro' },
    };

    const narrativeIntro = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen">
                    <h2>${ROCONN.narrative.title}</h2>
                    <p>${ROCONN.narrative.intro}</p>
                    <p><em>The seven major events of the dispute follow.</em></p>
                   </div>`,
        choices: ['Begin reading'],
        data: { phase: 'encoding_intro' },
    };

    const pass1 = ordering.map((eid, i) => buildSlide(eid, i + 1, 1));
    const pass2 = ordering.map((eid, i) => buildSlide(eid, i + 1, 2));

    return [narrativeIntro, ...pass1, introPass2, ...pass2];
};

/* =========================================================================
 *  RECALL TEST — immediate and post-distractor                       §3.4
 *  Implemented as a survey-text trial with seven numeric inputs.
 * ========================================================================= */
ROCONN.phases.buildRecallTest = function (cond, phaseLabel) {
    const ordering = ROCONN.getEncodedOrdering(cond);
    // Present the 7 events in *random* display order; participant types position 1-7.
    const displayOrder = jsPsych.randomization.shuffle([...ordering]);

    const questions = displayOrder.map((eid, i) => ({
        prompt:   `<span class="recall-prompt">${ROCONN.events[eid].label}</span>`,
        name:     `pos_${eid}`,
        required: true,
        columns:  3,
    }));

    const isGateImmediate = phaseLabel === 'immediate_recall';

    const intro = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen">
                    <h2>${isGateImmediate ? 'Memory test' : 'Brief memory check'}</h2>
                    <p>Below you will see the seven events of the dispute in a
                       <strong>random order</strong>. For each event, type the
                       number (<strong>1 to 7</strong>) corresponding to its
                       position in the document you read.</p>
                    <p>Each number 1–7 should be used exactly once.</p>
                   </div>`,
        choices: ['Begin'],
        data: { phase: phaseLabel + '_intro' },
    };

    const recall = {
        type: jsPsychSurveyText,
        preamble: `<h3>${isGateImmediate
            ? 'Type the position (1–7) for each event'
            : 'Same task: type the position (1–7) for each event'}</h3>`,
        questions: questions,
        data: { phase: phaseLabel, display_order: displayOrder.join(',') },

        /* ---- FIX #6: enforce a strict 1–7 permutation before submit ----
           Validation is purely client-side and does not alter the saved
           data shape: each field still stores the typed position string
           under pos_<eid>, so scoring in on_finish is unchanged. The
           Continue button stays disabled (and Enter-to-submit is blocked)
           until all seven inputs form exactly {1,…,7} with no repeats. */
        on_load: function () {
            const form = document.getElementById('jspsych-survey-text-form');
            if (!form) return;

            const inputs = Array.prototype.slice.call(
                form.querySelectorAll('input[type=text]'));
            const submit = document.getElementById('jspsych-survey-text-next')
                         || form.querySelector('button');

            const isValidPermutation = function () {
                const seen = {};
                let count = 0;
                for (let k = 0; k < inputs.length; k++) {
                    const v = inputs[k].value.trim();
                    if (!/^[1-7]$/.test(v)) return false;   // single digit 1–7 only
                    if (seen[v]) return false;              // no repeats
                    seen[v] = true;
                    count++;
                }
                return count === inputs.length;             // every field filled
            };

            // Inline validation message, inserted just above the submit button.
            let warn = document.getElementById('recall-validation-msg');
            if (!warn) {
                warn = document.createElement('p');
                warn.id = 'recall-validation-msg';
                warn.style.cssText =
                    'font-family:Inter,sans-serif;font-size:0.85em;'
                  + 'color:#b03434;text-align:center;min-height:1.2em;margin:0.4em 0;';
                if (submit && submit.parentNode) {
                    submit.parentNode.insertBefore(warn, submit);
                } else {
                    form.appendChild(warn);
                }
            }

            const refresh = function () {
                const ok = isValidPermutation();
                if (submit) submit.disabled = !ok;
                warn.textContent = ok
                    ? ''
                    : 'Enter each number 1–7 exactly once before continuing.';
            };

            inputs.forEach(function (el) {
                el.setAttribute('inputmode', 'numeric');
                el.setAttribute('maxlength', '1');
                el.addEventListener('input', refresh);
            });

            // Block Enter-to-submit on an invalid form. Capture phase runs
            // before the plugin's own (bubble-phase) submit handler.
            form.addEventListener('submit', function (e) {
                if (!isValidPermutation()) {
                    e.preventDefault();
                    e.stopPropagation();
                    refresh();
                }
            }, true);

            refresh();   // start disabled until a valid permutation is entered
        },

        on_finish: function (data) {
            // Score each response against true ordering.
            let nCorrect = 0;
            ordering.forEach((eid, idx) => {
                const truePos = idx + 1;
                const r = parseInt(data.response[`pos_${eid}`], 10);
                if (r === truePos) nCorrect++;
                data['true_' + eid]    = truePos;
                data['given_' + eid]   = isNaN(r) ? null : r;
            });
            data.recall_correct = nCorrect;
            // Persist as a top-level property too, so later trials can read it.
            const key = isGateImmediate ? 'immediate_recall_correct'
                                        : 'post_distractor_accuracy';
            jsPsych.data.addProperties({ [key]: nCorrect });
        },
    };

    // The immediate-recall gate: route failures to debrief.
    const gate = {
        type: jsPsychCallFunction,
        async: false,
        func: function () {
            const n = jsPsych.data.get().last(1).values()[0].recall_correct;
            if (isGateImmediate && n < ROCONN.params.immediateRecallGate) {
                jsPsych.endExperiment(
                    `Thank you for your participation today. Your result on this
                     task means we are unable to continue with the main study today.
                     You will now complete a short additional activity before we
                     finish. Please call the experimenter.`);
            }
        },
    };

    return [intro, recall, gate];
};

/* =========================================================================
 *  DISTRACTOR — 20 minutes                                            §6
 *  Implemented as three timer-locked screens. Paper materials assumed
 *  per protocol; on-screen timer enforces minimum duration.
 * ========================================================================= */
ROCONN.phases.buildDistractor = function () {

    const introDistractor = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen">
                    <h2>Short break with brief tasks</h2>
                    <p>You will now complete three brief activities. The screen
                       will tell you when each is finished.</p>
                    <p>Total duration: about <strong>20 minutes</strong>.</p>
                   </div>`,
        choices: ['Begin'],
        data: { phase: 'distractor_intro' },
    };

    const ravenTimer = makeTimedScreen({
        // FIX #3: 5 items × ravenSecsPerItem (96 s) × 1000 ms = 480000 ms (8 min).
        durationMs: ROCONN.params.ravenSecsPerItem * 5 * 1000,
        title: 'Task 1 — Pattern matrices',
        body:  `<p>Your experimenter will provide a sheet of <strong>5 pattern
                   matrices</strong>. Please attempt them now.</p>
                <p>Mark your answers on the paper sheet provided. The next screen
                   will appear automatically when this task is complete.</p>`,
        dataPhase: 'distractor_raven',
    });

    const wordTimer = makeTimedScreen({
        durationMs: ROCONN.params.wordsearchMs,
        title: 'Task 2 — Word puzzle',
        body:  `<p>Please complete the <strong>word-search sheet</strong> provided
                   by your experimenter.</p>
                <p>Work at a comfortable pace. You do not need to finish every
                   word. The next screen will appear automatically.</p>`,
        dataPhase: 'distractor_wordsearch',
    });

    const restTimer = makeTimedScreen({
        durationMs: ROCONN.params.restMs,
        title: 'Rest',
        body:  `<p>Please rest quietly for the next four minutes. The next part
                   of the session will begin automatically.</p>
                <p>Please keep your eyes on the screen.</p>`,
        dataPhase: 'distractor_rest',
        showCountdown: true,
    });

    return [introDistractor, ravenTimer, wordTimer, restTimer];
};

/* Helper — a screen that auto-advances after `durationMs` and optionally
   shows a countdown. */
function makeTimedScreen ({ durationMs, title, body, dataPhase, showCountdown = false }) {
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `<div class="text-screen timed-screen">
                    <h2>${title}</h2>
                    ${body}
                    ${showCountdown
                        ? '<div class="countdown" id="cdown">--:--</div>'
                        : '<div class="timer-bar"><div class="timer-fill" id="tfill"></div></div>'}
                   </div>`,
        choices: 'NO_KEYS',
        trial_duration: durationMs,
        data: { phase: dataPhase, duration_ms: durationMs },
        on_load: function () {
            const start = performance.now();
            const tick = () => {
                const elapsed = performance.now() - start;
                const remaining = Math.max(0, durationMs - elapsed);
                if (showCountdown) {
                    const m = Math.floor(remaining / 60000);
                    const s = Math.floor((remaining % 60000) / 1000);
                    const el = document.getElementById('cdown');
                    if (el) el.textContent =
                        `${m}:${s.toString().padStart(2, '0')}`;
                } else {
                    const el = document.getElementById('tfill');
                    if (el) el.style.width = (elapsed / durationMs * 100) + '%';
                }
                if (remaining > 0) requestAnimationFrame(tick);
            };
            tick();
        },
    };
}

/* =========================================================================
 *  PANEL TRAINING                                                    §5.6
 * ========================================================================= */
ROCONN.phases.buildTraining = function () {

    const slide1 = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen training-screen">
                    <h3>Independent reviewers</h3>
                    ${ROCONN.buildTrainingPanel({ connected: false })}
                    <p>These participants read the document <em>independently</em>.
                       They did not discuss it with each other before this session.</p>
                   </div>`,
        choices: ['Continue'],
        data: { phase: 'training_slide1' },
    };

    const slide2 = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen training-screen">
                    <h3>Connected reviewers</h3>
                    ${ROCONN.buildTrainingPanel({ connected: true })}
                    <p>These participants are <em>connected</em>: they know each
                       other and discussed the document together before this
                       session. A <strong>line</strong> between two icons means
                       they have spoken about the material.</p>
                   </div>`,
        choices: ['Continue'],
        data: { phase: 'training_slide2' },
    };

    const check = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen">
                    <h3>Quick check</h3>
                    <p>In the panels you will see next, a <strong>line</strong>
                       between two participant icons means:</p>
                   </div>`,
        choices: [
            '1 — They agree with each other',
            '2 — They know each other and discussed the document together',
        ],
        data: { phase: 'training_check' },
        on_finish: function (data) {
            data.correct = (data.response === 1);
        },
    };

    // Loop over the entire training set until the check is answered correctly.
    return {
        timeline: [slide1, slide2, check],
        loop_function: function (data) {
            const last = data.filter({ phase: 'training_check' }).last(1).values()[0];
            return !last.correct;       // loop if incorrect
        },
    };
};

/* =========================================================================
 *  BISECTION TRIAL & BLOCK                                            §7
 *  Each trial = (1) anchors+panel only for 2 s,
 *               (2) probe appears, response (F/J),
 *               (3) jittered ITI.
 * ========================================================================= */

/* One bisection block at a given pressure level. */
ROCONN.phases.buildBisectionBlock = function (cond, pressure, blockIndex, blockOrder) {

    const panelHTML = ROCONN.buildPanel({
        topology:    cond.topology,
        pressure:    pressure,
        encodedSeq:  cond.encodedSeq,
        blockIndex:  blockIndex,
    });

    const E1 = ROCONN.events.E1.label;
    const E7 = ROCONN.events.E7.label;

    /* Build the 65-trial probe list: 13 reps of each of the 5 probe positions.
       Probes are referenced by their *position* in the encoded sequence.   */
    const encOrdering = ROCONN.getEncodedOrdering(cond);
    const probes = [];
    ROCONN.params.probePositions.forEach(pos => {
        for (let r = 0; r < 13; r++) {
            probes.push({
                probe_pos: pos,
                probe_eid: encOrdering[pos - 1],
                probe_label: ROCONN.events[encOrdering[pos - 1]].label,
            });
        }
    });
    const shuffled = jsPsych.randomization.shuffle(probes);

    /* ------ Loading pause ------------------------------------------------ */
    const loadingPause = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `<div class="bisect-stage">
                    <div class="panel-slot">${panelHTML}</div>
                    <div class="task-slot loading-pause">
                        <p class="loading-text">Other reviewers' responses loaded.</p>
                        <p class="loading-sub">The sequence task will begin in a moment.</p>
                    </div>
                   </div>`,
        choices: 'NO_KEYS',
        trial_duration: ROCONN.params.panelLoadPauseMs,
        data: { phase: 'panel_load', pressure, block_index: blockIndex, block_order: blockOrder },
    };

    /* ------ Stage A: anchors + panel, no probe yet (2 s) ----------------- */
    const stageA = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: jsPsych.timelineVariable('stageA_html'),
        choices: 'NO_KEYS',
        trial_duration: ROCONN.params.anchorPreviewMs,
        data: {
            phase: 'bisect_anchor_preview',
            pressure, block_index: blockIndex, block_order: blockOrder,
            probe_pos: jsPsych.timelineVariable('probe_pos'),
        },
    };

    /* ------ Stage B: probe appears, response collected ------------------- */
    const stageB = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: jsPsych.timelineVariable('stageB_html'),
        choices: [ROCONN.params.keyLeft, ROCONN.params.keyRight],
        trial_duration: ROCONN.params.maxResponseMs,
        response_ends_trial: true,
        data: {
            phase: 'bisection',
            pressure, block_index: blockIndex, block_order: blockOrder,
            probe_pos: jsPsych.timelineVariable('probe_pos'),
            probe_eid: jsPsych.timelineVariable('probe_eid'),
        },
        on_finish: function (data) {
            data.response_side = (data.response === ROCONN.params.keyLeft)
                ? 'start'
                : (data.response === ROCONN.params.keyRight ? 'end' : null);
            // FIX #1: timeouts (response === null) must NOT be coded as 0 ("start").
            //   J = end = 1, F = start = 0, no response = null (drop in analysis).
            data.response_num = (data.response === ROCONN.params.keyRight) ? 1
                              : (data.response === ROCONN.params.keyLeft)  ? 0
                              : null;
        },
    };

    /* ------ ITI: jittered blank ----------------------------------------- */
    const iti = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `<div class="bisect-stage iti-stage">
                    <div class="panel-slot">${panelHTML}</div>
                    <div class="task-slot"></div>
                   </div>`,
        choices: 'NO_KEYS',
        trial_duration: () =>
            Math.floor(ROCONN.params.itiMinMs +
                       Math.random() * (ROCONN.params.itiMaxMs - ROCONN.params.itiMinMs)),
        data: { phase: 'iti', pressure, block_index: blockIndex },
    };

    /* Build per-trial HTML payloads inside the timeline_variables.
       Pre-rendering these once per block keeps render fast.              */
    const variables = shuffled.map(p => ({
        probe_pos:   p.probe_pos,
        probe_eid:   p.probe_eid,
        stageA_html: `<div class="bisect-stage">
                        <div class="panel-slot">${panelHTML}</div>
                        <div class="task-slot">
                            <div class="anchor-row">
                                <span class="anchor-left">Start: ${E1}</span>
                                <span class="anchor-right">End: ${E7}</span>
                            </div>
                            <div class="probe-slot">&nbsp;</div>
                            <div class="key-hint">&nbsp;</div>
                        </div>
                      </div>`,
        stageB_html: `<div class="bisect-stage">
                        <div class="panel-slot">${panelHTML}</div>
                        <div class="task-slot">
                            <div class="anchor-row">
                                <span class="anchor-left">Start: ${E1}</span>
                                <span class="anchor-right">End: ${E7}</span>
                            </div>
                            <div class="probe-slot"><span class="probe-text">${p.probe_label}</span></div>
                            <div class="key-hint">
                                <span class="key">[F]</span> closer to Start &nbsp;&nbsp;
                                <span class="key">[J]</span> closer to End
                            </div>
                        </div>
                      </div>`,
    }));

    const trialProcedure = {
        timeline: [stageA, stageB, iti],
        timeline_variables: variables,
        randomize_order: false,           // already shuffled
    };

    /* Block-intro screen */
    const blockIntro = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen">
                    <h2>Block ${blockOrder} of 3</h2>
                    <p>You will now see how other reviewers ordered the events.
                       After a short pause, you will make a series of quick
                       sequence judgements.</p>
                    <p>Press <strong>F</strong> for "closer to Start" and
                       <strong>J</strong> for "closer to End".</p>
                    <p>Try to respond quickly and accurately.</p>
                   </div>`,
        choices: ['Begin block'],
        data: { phase: 'block_intro', block_order: blockOrder, pressure },
    };

    return [blockIntro, loadingPause, trialProcedure];
};

/* Inter-block rest, 3 min */
ROCONN.phases.buildInterBlockRest = function (blockOrder) {
    return makeTimedScreen({
        durationMs: ROCONN.params.interBlockRestMs,
        title: `Short break (3 minutes)`,
        body:  `<p>You have completed block ${blockOrder} of 3.</p>
                <p>Please take a brief rest. The next block will begin automatically.</p>`,
        dataPhase: 'inter_block_rest',
        showCountdown: true,
    });
};

/* =========================================================================
 *  POST-TASK MANIPULATION CHECKS                                      §8.3
 * ========================================================================= */
ROCONN.phases.buildPostMeasures = function () {

    const connectedness = {
        type: jsPsychSurveyLikert,
        preamble: '<h2>A few questions about the reviewers</h2>',
        questions: [
            { prompt: 'How <strong>connected</strong> to each other did the other reviewers seem?',
              labels: ['1<br>Not at all connected', '2', '3', '4', '5', '6', '7<br>Very connected'],
              required: true, name: 'mc_connected' },
            { prompt: 'To what extent did the reviewers appear to <strong>know each other</strong> or to have discussed the document together?',
              labels: ['1<br>Not at all', '2', '3', '4', '5', '6', '7<br>Very much'],
              required: true, name: 'mc_known' },
        ],
        data: { phase: 'mc_connectedness' },
    };

    const endorsement = {
        type: jsPsychSurveyText,
        preamble: '<h2>One more question</h2>',
        questions: [{
            prompt: 'Approximately how many of the six reviewers endorsed the <em>alternative</em> event ordering in the <strong>most recent</strong> block? (Enter a number from 0 to 6.)',
            name: 'mc_endorse_count',
            required: true,
            columns: 4,
        }],
        data: { phase: 'mc_endorsement' },
    };

    const confidence = {
        type: jsPsychSurveyLikert,
        preamble: '<h2>And finally, about your memory</h2>',
        questions: [{
            prompt: 'How confident are you that your memory of the event order is correct?',
            labels: ['1<br>Not at all confident', '2', '3', '4', '5', '6', '7<br>Completely confident'],
            required: true, name: 'mc_confidence',
        }],
        data: { phase: 'mc_confidence' },
    };

    return [connectedness, endorsement, confidence];
};

/* =========================================================================
 *  FUNNELLED DEBRIEF + FULL DISCLOSURE                              §11
 * ========================================================================= */
ROCONN.phases.buildDebrief = function () {

    const q1 = {
        type: jsPsychSurveyText,
        preamble: '<h2>A few last questions</h2>',
        questions: [{
            prompt: 'What do you think this study was about?',
            name: 'fd_q1', rows: 4, required: false,
        }],
        data: { phase: 'fd_q1' },
    };

    const q2 = {
        type: jsPsychSurveyText,
        questions: [{
            prompt: "Did you notice anything unusual about the other reviewers' responses?",
            name: 'fd_q2', rows: 4, required: false,
        }],
        data: { phase: 'fd_q2' },
    };

    const q3 = {
        type: jsPsychSurveyMultiChoice,
        questions: [{
            prompt: 'Did you believe the other reviewers were real participants in today\'s session?',
            options: ['Yes', 'Unsure', 'No'],
            required: true, name: 'fd_q3',
        }],
        data: { phase: 'fd_q3' },
    };

    const q4 = {
        type: jsPsychSurveyLikert,
        questions: [{
            prompt: "Did the other reviewers' orderings affect how you answered?",
            labels: ['1<br>Not at all', '2', '3', '4', '5', '6', '7<br>Completely'],
            required: true, name: 'fd_q4',
        }],
        data: { phase: 'fd_q4' },
    };

    const fullDisclosure = {
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class="text-screen disclosure">
                    <h2>Full disclosure</h2>
                    <p>Thank you for your participation. We now need to tell you
                       the true purpose of this study.</p>
                    <p>The "other participants" whose orderings you saw were
                       <strong>not real</strong> — they were pre-programmed
                       responses generated by the experiment software. We used
                       this approach because we are studying how the
                       <em>structure</em> of social networks affects how people
                       remember sequences of events.</p>
                    <p>We could not tell you this in advance because it would
                       have changed how you responded. We apologise for the
                       deception. Your actual memory performance was not being
                       judged at any point.</p>
                    <p>You have the full right to withdraw your data now without
                       any consequence. If you are happy for your anonymous data
                       to be used, no further action is needed.</p>
                    <p>Please raise your hand and the experimenter will join you.</p>
                   </div>`,
        choices: ['I consent to my data being used',
                  'I withdraw my data'],
        data: { phase: 'full_disclosure' },
        on_finish: function (data) {
            data.withdraw = (data.response === 1);
            jsPsych.data.addProperties({ withdraw: data.withdraw });
        },
    };

    return [q1, q2, q3, q4, fullDisclosure];
};
