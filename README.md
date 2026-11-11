# Perceived interdependence of sources and memory for event order

Experiment code, analysis pipeline, power simulations and model re-implementation
for the Stage 1 Registered Report

> Lazarus, J. G., & Sengupta, R. *Does the perceived interdependence of dissenting
> sources change memory for the order of events? A Stage 1 Registered Report.*
> Computational Cognition Laboratory, SIAS, Krea University.

This repository is protocol **v7.0**, which implements that manuscript. Every data row
carries `protocol_version = v7.0-RR-stage1`. The version used for data collection
will be tagged, and the tag will be deposited on the Open Science Framework; any change
after the tag is a deviation.

---

## The study in brief

Participants read a fictional report of seven events in a climate policy dispute
(Vorland). Events 3 and 5, an emission penalty and a restoration levy, can be exchanged;
half of the participants read Sequence 1 and half Sequence 2. After a fixed 20-minute
interval they judge, one event at a time, whether each middle event happened closer to
the start or to the end, while a panel of six "other reviewers" states where it placed
the two proposals.

| Factor | Levels | Varies |
|---|---|---|
| Panel structure | connected (lines between reviewers) / independent (no lines) | between |
| Order read | Sequence 1 / Sequence 2 (the panel pushes the other) | between |
| Dissent | 0 %, 50 %, 100 % of the panel endorse the other order | within, 6 block orders |

The two panel types differ **only** in the lines. There is no verbal label on either
panel; the meaning of a line is taught on two training screens that every participant
sees. Primary test (H1): does drift toward the pushed order grow with dissent at a
different rate for connected and independent panels? Second confirmatory test (H2):
does any difference persist in a block of judgements made without the panel?

Target: **216 analysable participants (54 per cell), recruitment ceiling 260.**

---

## Running a session (laboratory)

The experiment is a static website. jsPsych 7.3.4 and its plugins are bundled in
`vendor/`, so no network connection is needed.

```bash
# 1. Make the randomisation list once (record the seed in the registration)
Rscript tools/make_randomisation_list.R 260 20261110 http://localhost:8000/index.html

# 2. Serve the folder on each laboratory machine (any static server)
python -m http.server 8000

# 3. Open each station at the URL in the next unused row of randomisation_list.csv, e.g.
#    http://localhost:8000/index.html?cell=C1&sg=SG5&pid=P0001
```

A live session **will not start** without all three of `cell`, `sg` and `pid`; the
station then shows "This station is not ready. Please call the experimenter."
Use the list strictly in order; a participant who is excluded is replaced by the next row.

**Demo mode** (`?demo=1`, or opening `index.html` as a local file) bypasses the gates,
shortens all timers, cuts blocks to 10 trials, assigns a random condition if none is
given, and shows a red banner. Demo rows are flagged and excluded by the pipeline.

At the end of a session the browser downloads two files, `roconn_<pid>_<cell>_<sg>.csv`
(all trials) and `roconn_condition_<pid>_<cell>_<sg>.csv` (one-row manifest). Copy both
into `data/` before analysis. If a download is blocked, the final screen has buttons that
download on click.

### Session (about 85 minutes)

| # | Stage | Builder | Approx. |
|---|---|---|---|
| 1 | Consent, eligibility, topic-familiarity screen | `phases.buildIntro` | 9 min |
| 2 | Reading, two passes, one event per screen | `phases.buildEncoding` | 12 min |
| 3 | Order test 1 (gate: 6 of 7 correct; else 15-min filler) | `phases.buildRecallTest('immediate_recall')` | 5 min |
| 4 | Puzzles, word search, elastic rest: exactly 20 min | `phases.buildDistractor` | 20 min |
| 5 | Order test 2 (covariate) | `phases.buildRecallTest('post_distractor_recall')` | 2 min |
| 6 | Panel training (repeats until the check is right) | `phases.buildTraining` | 3 min |
| 7 | Three panel blocks, 65 judgements each, 2-min rests | `phases.buildBisectionBlock` | 18 min |
| 8 | Panel-free block, 40 judgements | `phases.buildFreeBlock` | 3 min |
| 9 | Order test 3 + confidence | `phases.buildRecallTest('order_test3')` | 2 min |
| 10 | Perceived connectedness, perceived dissent | `phases.buildPostMeasures` | 2 min |
| 11 | Funnelled debrief, disclosure | `phases.buildDebrief` | 4 min |
| 12 | Order test 4 + confidence, climate item, data decision | `buildRecallTest('order_test4')`, `buildDataDecision` | 3 min |

The experimenter reads the welcome script, leaves the room before the first panel block,
and returns when participants raise their hands at the data-decision screen. Every
participant receives the one-page handout on how false accounts spread online.

---

## Data

Every row carries `pid, cell, subgroup, topology, direction, encoded_seq, pushed_seq,
assignment, demo, protocol_version` and, once set, the session-level scores
`immediate_recall_correct, post_distractor_accuracy, order_test3_correct,
order_test3_pushed, order_test3_confidence, order_test4_correct, order_test4_pushed,
order_test4_confidence, withdraw`.

| `phase` | Content |
|---|---|
| `bisection` | panel-block judgement: `pressure` (0/50/100), `block_order` (1-3), `probe_pos` (2-6, in the order read), `probe_eid`, `response_num` (1 = closer to End, 0 = Start, empty = no response), `rt` |
| `free_judgement` | panel-free judgement: same fields plus `last_pressure` (dissent in the final panel block) |
| `immediate_recall`, `post_distractor_recall`, `order_test3`, `order_test4` | written order tests: `given_E1..E7`, `true_E1..E7`, `recall_correct` (0-7), `pushed_order` (1 if the event read 3rd is placed after the event read 5th) |
| `order_test3_confidence`, `order_test4_confidence` | `confidence` (1-7) |
| `mc_connectedness` | JSON `mc_connected`, `mc_known` (0-6; the pipeline adds 1) |
| `mc_endorsement` | JSON `mc_endorse_count` (number of dissenters in the most recent panel block) |
| `fd_q1` … `fd_q4` | funnelled debrief |
| `climate_importance` | exploratory item after disclosure |
| `data_decision` | `withdraw` (true/false) |

No trial file is written for a participant who does not consent or who withdraws; the
manifest records the withdrawal.

---

## Analysis

```bash
Rscript analysis/roconn_pipeline.R data output
```

Required R packages: `lme4`, `lmerTest`; `logistf` for S3 if fewer than ten participants
report the pushed order after disclosure (the log says so if it is missing). The script
implements the registered plan exactly:

* **Exclusions** in the registered order, with a count at each step (RR 3.1).
* **H1**: logistic mixed model of judgements of the two critical events in the panel
  blocks, `end ~ crit*P*topo + crit*P*direc + crit*topo*direc + crit*bo + crit*pda + crit*trial`,
  random effects `(1 + crit + crit:P | pid)` with the registered fallback sequence;
  likelihood-ratio test of `crit:P:topo`.
* **H2**: the same for the panel-free block, test of `crit:topo`.
* **Drift-index model**: E1 equivalence (±0.15, 90 % CI), E2 estimate, and the
  equivalence test used to interpret a non-significant H1.
* **Checks C1-C6**, including the re-estimation of H1 relative to the control events if
  dissent moves them by more than 0.10.
* **Secondary S1-S4** and the exploratory summaries.

Output: `output/results.txt` (full log with the registered interpretation),
`confirmatory_summary.csv`, `screening.csv`, `drift_index_by_block.csv`,
`participant_measures.csv`, `H1_estimated_drift.csv`.

Blind coding of the open debrief answers is supplied as `data/suspicion_exclusions.csv`
(one column, `pid`).

---

## Power, model and tests

* `power/`: the power simulations reported in the manuscript (Table 2, Appendix B):
  `power_h1.R` (grid at N = 120), `power_h1_n.R` (any N), `power_h1_n_extra.R`,
  `power_h2.R`, their CSV outputs and logs, and `make_numbers.py`, which pools runs with
  identical settings and writes the manuscript's `numbers.tex` and power table
  (`RR_TEX_DIR=/path/to/overleaf/folder python3 power/make_numbers.py 48 13 8 85`).
* `field_model/`: the re-implementation of the field model of Lazarus et al. (2026)
  (`roconn_field.py`), the runs for the six panel configurations (`run_rr_cells.py`,
  `rr_cells.json`) and the figure script (manuscript Figure 1, Appendix A).
* `tests/`: headless tests of the experiment and an end-to-end test of the pipeline; see
  `tests/README.md`.

---

## Changes from v6

* Panels: no "Independent reviewer" card text, no "Connected group"/"Independent
  reviewers" subtitle, no cohort badge; cards read "Reviewer 1" … "Reviewer 6"; badges
  read "Restoration levy 3rd, Emission penalty 5th".
* Training text: connected reviewers "attended an earlier session together, where they read
  and discussed this report"; check options "They gave the same answer" / "They discussed
  the report with each other".
* Face rotation: every dissenting set mixes the two face styles.
* Block instructions explain that events repeat and answers need not be consistent.
* Rests between panel blocks: 2 min (was 3).
* New: panel-free block (40 trials), order test 3 + confidence, order test 4 after
  disclosure + confidence, climate item, separate data-decision screen; the old
  post-task confidence item was removed.
* Live sessions refuse to start without `cell`, `sg`, `pid`; random assignment only in demo.
* jsPsych bundled locally in `vendor/`.
* Analysis rewritten to the registered plan (the fitted midpoint is no longer the outcome;
  see the manuscript, Appendix C). Old scripts and `.bak` files removed; they remain in the
  git history.

---

## Licence

Code: MIT (see `LICENSE`). jsPsych and its plugins: MIT (see `vendor/jspsych-7.3.4/LICENSE`).
The narrative text and panel design are part of the protocol; please contact the
corresponding author before reusing them outside replication.

**Contact:** Dr Rakesh Sengupta, rakesh.sengupta@krea.edu.in, School of Interwoven Arts and
Sciences, Krea University, Sri City, Andhra Pradesh 517 646, India.
