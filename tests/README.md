# Test harness

Headless verification of the experiment, run before the code was frozen.

    npm install jsdom jspsych@7.3.4 \
      @jspsych/plugin-html-keyboard-response@1.1.3 \
      @jspsych/plugin-html-button-response@1.1.3 \
      @jspsych/plugin-survey-text@1.1.3 \
      @jspsych/plugin-survey-likert@1.1.3 \
      @jspsych/plugin-survey-multi-choice@1.1.3 \
      @jspsych/plugin-preload@1.1.3 \
      @jspsych/plugin-call-function@1.1.3 \
      @jspsych/plugin-fullscreen@1.2.1
    node t4.mjs   # the six ways a session can end
    node t5.mjs   # missed judgements are coded as missing, never as "closer to Start"
    node t6.mjs   # panels, badges, face rotation, narrative integrity
    node t7.mjs   # on_load handlers, scoring, distractor timing, block structure

`sim.mjs` loads jsPsych and the five experiment sources into a jsdom window in
the same order as index.html, captures the timeline, and replays it in jsPsych's
simulation mode with the gate answers forced so that each exit path can be
reached deliberately. Downloads are intercepted rather than written.

## Analysis-side tests

`analysis/pc_fast.R`  power for the primary DV across effect and sample sizes
`analysis/pc_dv.R`    sensitivity of the drift index against PSE and JND
