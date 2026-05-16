/* =========================================================================
 *  experiment.js  —  Master timeline assembly and jsPsych initialisation
 *
 *  Loads after config.js, panels.js, and phases.js. Reads condition from
 *  URL (?cell=C1&sg=SG2&pid=P0001) or randomly assigns. Builds the full
 *  timeline and runs it.
 * ========================================================================= */

(function main () {
    /* ---- 1. Condition assignment ------------------------------------- */
    const condition = ROCONN.assignCondition();
    console.log('ROCONN condition:', condition);

    /* ---- 2. jsPsych initialisation ----------------------------------- */
    const jsPsych = initJsPsych({
        display_element: 'jspsych-target',
        show_progress_bar: false,
        default_iti: 0,

        on_finish: function () {
            // Save complete dataset on completion.
            const filename = `roconn_${condition.pid}_${condition.cell}_${condition.subgroup}.csv`;
            jsPsych.data.get().localSave('csv', filename);
            document.body.innerHTML = `
                <div style="max-width:600px;margin:8em auto;
                            font-family:Georgia,serif;line-height:1.6;text-align:center;">
                    <h2>Session complete</h2>
                    <p>Thank you. Your responses have been saved to a file
                       named <code>${filename}</code>.</p>
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

    // ---- Funnelled debrief + full disclosure
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

    jsPsych.run(timeline);
})();
