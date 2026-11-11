# Tests

Headless tests of the experiment, run in Node with jsdom. They load the same jsPsych
files the experiment ships with (`../vendor/`), so only jsdom is installed from npm.

```bash
cd tests
npm install          # jsdom only
npm test             # t6, t7, t5, t4, t9 in turn; stops at the first failure
```

| File | What it checks |
|---|---|
| `t6.mjs` | Panels: six cards, 7 or 0 lines, correct dissenting badges at 0/50/100 %, no verbal label on either panel, panels identical apart from the lines; face rotation; badge text in all four cells; demo detection; live mode refuses to start without `cell`/`sg`/`pid`; narrative is 1,181 words and identical across sequences; 2-min rests |
| `t7.mjs` | Unit checks: order-test validator and scoring (including `pushed_order`), confidence items on tests 3 and 4, word search, matrix items, filler, elastic 20-min interval, 65-trial blocks, panel-free block (40 trials, no cards, timeouts coded missing), training text, checks, disclosure and data decision |
| `t5.mjs` | Missed judgements are coded as missing, never as "closer to the start" |
| `t4.mjs` | All seven ways a session can end (completion, withdrawal, no consent, topic screen, ineligible, reading gate, missing URL parameter) and the files each writes |
| `t9.mjs` | A complete session: every stage present and in the registered order, 195 + 40 judgements, block order, written-test scoring, protocol stamp, manifest columns |

## End-to-end test of the analysis pipeline

```bash
cd tests && node make_templates.mjs && cd ..         # 24 real session files, one per cell x block order
Rscript tests/synthetic_sessions.R 8 0.30 0.20       # 192 participants with known effects + 7 malformed files
Rscript analysis/roconn_pipeline.R tests/pipeline_test/data tests/pipeline_test/output
```

`synthetic_sessions.R` keeps the exact file structure written by the experiment and
replaces the judgements and ratings with draws from the model used in the power
simulation. With effects of 0.30 (H1) and 0.20 (H2) the pipeline reports both as
significant and positive, E1 as equivalent, all checks passing, and excludes each
malformed file at its own step. With `0 0` it reports H1 as equivalent within ±0.15 and H2
as not significant. A fifth argument plants a general response bias with dissent
(for example `8 0.30 0.20 tests/pipeline_test/data_bias 1.0`), which triggers check C6 and the
re-estimation of H1 relative to the control events.
