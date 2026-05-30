# ROCONN Asymmetric PSE Shift Experiment

> A jsPsych 7 implementation of the Sequence Bisection Task with
> confederate-network social pressure manipulation.
> Tests whether memory-attractor drift is steeper under
> high-clustering (triadic) social pressure than under low-clustering
> (disconnected) pressure, holding endorsement count constant.

This is the in-lab experiment from Protocol v5 of *"The Asymmetric Pull of
Falsehood: A Computational Model of Temporal Narrative Drift in Echo
Chambers"* (Computational Cognition Laboratory, SIAS, Krea University).
The original protocol was specified for PsychoPy Builder; this repository
re-implements the full session in jsPsych so it can be served from any
static-file host or local lab server.

---

## Core hypothesis

For a participant who has encoded a sequence of events, social pressure
toward an alternative ordering will shift the Point of Subjective Equality
(PSE) of a Sequence Bisection Task. The rate of that shift per unit of
social pressure is predicted to be steeper when the pressure comes from a
*high-clustering* confederate network than from a *low-clustering*
(disconnected) one:

```
  d(ΔPSE)/d(P_social) | High-C  >  d(ΔPSE)/d(P_social) | Low-C
```

The design is `2 (Topology) × 2 (Direction)` between-subjects ×
`3 (Pressure)` within-subjects. Endorsement count is matched across topology
conditions (6 of 6 at 100%, 3 of 6 at 50%, 0 of 6 at 0%); only the network
edges and group badging differ.

---

## Quick start

```bash
git clone https://github.com/rakesh-sengupta/roconn-pse-experiment.git
cd roconn-pse-experiment

# Serve the directory over HTTP. Any static server will do; here are three.
python -m http.server 8000          # Python 3
# or:  npx http-server -p 8000 -c-1   # Node
# or:  php -S localhost:8000          # PHP
```

Then open in a modern browser (Chrome / Edge / Firefox):

```
http://localhost:8000/
```

**Condition assignment is random on every run.** Opening the bare URL draws a
cell (C1–C4) and a block-order subgroup (SG1–SG6) uniformly at random and
auto-generates a participant ID. No query string is needed.

To **override** the random draw — e.g. to follow a pre-generated *balanced*
randomisation list (recommended for live data collection; see
`Counterbalancing` below) — pass any of the parameters explicitly; any omitted
parameter is still randomised:

```
http://localhost:8000/?cell=C1&sg=SG1&pid=P0001
```

At the end of the session the experiment downloads **two CSV files** (see
`Data output`): the full trial-level data and a one-row **condition manifest**.

> The experiment **must** be served over HTTP. Opening `index.html` directly
> with the `file://` protocol will break the jsPsych CDN imports and the
> CSV downloads.

### Deploying on GitHub Pages

The experiment is entirely client-side (static files + the jsPsych CDN), so it
runs on GitHub Pages with no build step and no server code. The repository
ships with everything Pages needs: a `.nojekyll` file (so Pages serves the
files as-is) and a deploy workflow at `.github/workflows/deploy-pages.yml`.

**One-time setup:**

1. **Create the repo and push.** From inside the project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: ROCONN PSE experiment"
   git branch -M main
   git remote add origin https://github.com/<you>/roconn-pse-experiment.git
   git push -u origin main
   ```
   (If your default branch is `master`, edit the `branches:` line in
   `.github/workflows/deploy-pages.yml` to match.)

2. **Turn on Pages with GitHub Actions as the source.** In the repo:
   **Settings → Pages → Build and deployment → Source → "GitHub Actions."**
   That is the only setting to change; the included workflow does the rest.

3. **Wait for the deploy.** The **Actions** tab shows the "Deploy to GitHub
   Pages" run. When it finishes, your experiment is live at:
   ```
   https://<you>.github.io/roconn-pse-experiment/
   ```

Every later `git push` to the default branch redeploys automatically. You can
also trigger a deploy manually from the **Actions** tab (the workflow has a
`workflow_dispatch` button).

**Using the live experiment.** Open the Pages URL with no query string: each
visit is assigned a random cell/subgroup and downloads the two CSV files at the
end (see `Data output`). Append `?demo=1` to the Pages URL to walk the whole
thing as a demo. URL overrides for a balanced list work too, e.g.
`https://<you>.github.io/roconn-pse-experiment/?cell=C1&sg=SG1&pid=P0001`.

> **Read before collecting data online.** GitHub Pages is *read-only* static
> hosting — there is no backend to receive data. By default the experiment
> saves by triggering a CSV **download in the participant's browser**, which is
> reliable for **supervised, in-lab** sessions (you control the machine and can
> collect the file). For **unsupervised online** runs, a closed tab or a
> blocked download means a lost session, so route the data to a collector — see
> *Server-side data saving* below. The Pages site itself never stores data.

### Testing the full experiment (demo mode)

A real session ends quickly if the participant declines consent, is excluded
at the pre-quiz, or fails the **immediate-recall ≥6/7 gate** — the last of
which happens whenever you click through to test without memorising the seven
events. The session then terminates *before* the 20-minute distractor and
*before* any of the 195 bisection trials, so a quick test looks deceptively
short (often only a handful of screens). This is the protocol's intended
behaviour (§2.5–2.6, §3.4).

**Two ways to see the entire experiment run end-to-end in ~2–3 minutes:**

1. **Just open `index.html` as a local file (double-click it).** When the page
   is loaded over `file://`, demo mode turns on automatically — because you
   cannot serve or collect real data that way, so a local-file open is, by
   definition, a test. A red banner marks the session.
2. **Over HTTP, append `?demo=1`:** `http://localhost:8000/?demo=1`.

Demo mode bypasses the pre-quiz and recall gates, shortens the distractor /
rest / inter-block timers, and reduces the bisection blocks to 10 trials each,
so you walk every phase — including all three confederate-pressure blocks and
the deception debrief.

To force demo **off** even on a local file (e.g. to test the real gated flow),
open `index.html?demo=0`. A genuine full data-collection run must be **served
over HTTP** (so the two CSV files download reliably), assigns conditions
randomly, requires passing recall at ≥6/7, and takes the full ~75 minutes with
65 trials per block.

---

## Cover story

The participant-facing study name is deliberately neutral — **"Document Review
Study"** — so it does not reveal that the experiment concerns memory or social
conformity. All welcome/consent/instruction text is framed around "reviewing a
report" and "other reviewers," and the recall screens are labelled
"comprehension check," not "memory test." The true purpose is revealed only in
the full-disclosure debrief at the end. To rename the study, edit a single
line in `js/config.js`:

```js
ROCONN.studyName = 'Document Review Study';
```

---

## Project structure

```
roconn-pse-experiment/
├── index.html              # Entry point; loads jsPsych and project sources.
├── README.md               # This file.
├── LICENSE                 # MIT.
├── .gitignore              # Ignores collected data/ CSVs.
├── css/
│   └── style.css           # Academic-serif styling for trials and panels.
├── js/
│   ├── config.js           # Cells, subgroups, sequences, narrative, params,
│   │                       #   and RANDOM condition assignment.
│   ├── panels.js           # Confederate-panel HTML + SVG edge overlay
│   │                       #   (the clustering/deception manipulation).
│   ├── tasks.js            # In-browser distractor tasks: matrix puzzles
│   │                       #   + interactive word search (no paper, no
│   │                       #   experimenter hand-outs).
│   ├── phases.js           # Trial timeline builders for each session phase.
│   └── experiment.js       # Master timeline assembly, jsPsych init, CSV export.
├── analysis/
│   └── roconn_pipeline.R   # quickpsy + LMM pipeline (Appendix C, adapted).
└── data/                   # (git-ignored) drop collected session CSVs here.
```

Each phase of the session is a small, self-contained timeline builder in
`phases.js`. The master `experiment.js` concatenates them. The only file
likely to need editing on first use is `config.js` (narrative text, timing
parameters, recall-test gate thresholds).

---

## Session structure

The full session is ~75 minutes:

| # | Phase                                | File location in `phases.js`     | Duration  |
|---|--------------------------------------|----------------------------------|-----------|
| 1 | Consent, instructions, pre-quiz      | `buildIntro`                     | ~7 min    |
| 2 | Encoding (two read-throughs of narrative) | `buildEncoding`             | ~12 min   |
| 3 | Immediate recall (≥6/7 gate)         | `buildRecallTest('immediate_recall')` | ~5 min |
| 4 | Distractor: matrix puzzles + word search + rest (all in-browser) | `buildDistractor` / `tasks.js` | ~16–20 min |
| 5 | Post-distractor recall (covariate)   | `buildRecallTest('post_distractor_recall')` | ~2 min |
| 6 | Confederate panel training           | `buildTraining`                  | ~3 min    |
| 7 | Three bisection blocks (65 trials each, with inter-block rests) | `buildBisectionBlock` ×3 | ~25 min |
| 8 | Manipulation checks                  | `buildPostMeasures`              | ~5 min    |
| 9 | Funnelled debrief + full disclosure  | `buildDebrief`                   | ~5 min    |

---

## Counterbalancing

By default the experiment assigns each session a cell and subgroup **uniformly
at random** in the browser. Per-session random draws are independent and
stateless, so they do **not** guarantee equal cell counts across a finite
sample. For live data collection where balance matters, generate a balanced
randomisation list (below) and pass `cell`/`sg`/`pid` via the URL to override
the random draw; the `assignment` column in the data records which path was
used.

### Between-subjects cells (4)

| Cell | Topology  | Encodes Seq | Pushed toward Seq | URL param |
|------|-----------|-------------|-------------------|-----------|
| C1   | High-C    | 1           | 2                 | `cell=C1` |
| C2   | High-C    | 2           | 1                 | `cell=C2` |
| C3   | Low-C     | 1           | 2                 | `cell=C3` |
| C4   | Low-C     | 2           | 1                 | `cell=C4` |

Target N = 30 per cell (recruit 36 to allow ~17% exclusion).

### Within-subjects: pressure block order (6 subgroups)

A balanced Latin square for three pressure levels {0%, 50%, 100%}:

| Subgroup | Block 1 | Block 2 | Block 3 | URL param |
|----------|---------|---------|---------|-----------|
| SG1      | 0%      | 50%     | 100%    | `sg=SG1`  |
| SG2      | 0%      | 100%    | 50%     | `sg=SG2`  |
| SG3      | 50%     | 0%      | 100%    | `sg=SG3`  |
| SG4      | 50%     | 100%    | 0%      | `sg=SG4`  |
| SG5      | 100%    | 0%      | 50%     | `sg=SG5`  |
| SG6      | 100%    | 50%     | 0%      | `sg=SG6`  |

Within each cell, distribute participants approximately evenly across the
six subgroups (~5 per subgroup per cell).

### Generating a randomisation list

Before each cohort run, pre-generate participant assignments. R example:

```r
library(blockrand); set.seed(20251110)
n_total   <- 144
cells     <- rep(c("C1","C2","C3","C4"), each = n_total / 4)
subgroups <- rep(c("SG1","SG2","SG3","SG4","SG5","SG6"), times = n_total / 6)
assignments <- data.frame(
    pid       = sprintf("P%04d", sample(1:9999, n_total)),
    cell      = sample(cells),
    subgroup  = sample(subgroups)
)
write.csv(assignments, "randomisation_list.csv", row.names = FALSE)
```

On arrival, the experimenter reads the next participant ID off the list and
opens the experiment with the matching URL.

---

## Data output

At session end the experiment downloads **two CSV files**:

```
roconn_<pid>_<cell>_<subgroup>.csv            # 1. full trial-level data
roconn_condition_<pid>_<cell>_<subgroup>.csv  # 2. one-row condition manifest
```

Both download automatically. If a browser blocks the programmatic download,
the completion screen also shows **“Download condition file”** and **“Download
data file”** buttons that download on click. Because conditions are assigned
randomly in the browser (with no server to log them), the condition manifest
is the per-session record of *what* was assigned — keep it alongside the data
file.

### File 2 — condition manifest

One header row + one data row, with the columns: `pid`, `cell`, `subgroup`,
`topology`, `direction`, `encoded_seq`, `pushed_seq`, `pressure_block1..3`,
`assignment` (`random` or `url`), `session_start`, `completed_at`,
`prequiz_yes_count`, `immediate_recall_correct`, `post_distractor_accuracy`,
`withdrew`. The outcome columns are filled best-effort (blank if the session
ended before reaching them, e.g. a pre-quiz exclusion).

### File 1 — trial-level data

Every row carries the following session-level metadata in addition to the
trial-specific columns:

| Column            | Type     | Notes                                            |
|-------------------|----------|--------------------------------------------------|
| `pid`             | string   | Participant ID                                   |
| `cell`            | string   | C1 / C2 / C3 / C4                                |
| `subgroup`        | string   | SG1 – SG6                                        |
| `topology`        | string   | `high` / `low`                                   |
| `direction`       | string   | `seq1to2` / `seq2to1`                            |
| `encoded_seq`     | int      | 1 / 2                                            |
| `pushed_seq`      | int      | 1 / 2                                            |
| `assignment`      | string   | `random` (default) / `url` (override)            |
| `phase`           | string   | Per-phase tag (see below)                        |
| `immediate_recall_correct` | int  | 0–7                                          |
| `post_distractor_accuracy` | int  | 0–7                                          |

Bisection-trial rows (`phase = "bisection"`) additionally include:

| Column        | Notes                                                  |
|---------------|--------------------------------------------------------|
| `pressure`    | 0 / 50 / 100                                           |
| `block_index` | 0 / 1 / 2 (drives avatar rotation)                     |
| `block_order` | 1 / 2 / 3 (first/second/third block run)               |
| `probe_pos`   | 2–6 (position in encoded sequence)                     |
| `probe_eid`   | Event id used as probe                                 |
| `response`    | `"f"` or `"j"` (or `null` if no response in 4 s)       |
| `response_side` | `"start"` / `"end"` / `null`                         |
| `response_num`| 1 if `"j"` (end), 0 if `"f"` (start)                   |
| `rt`          | Response time, ms                                      |

Phase tags include: `consent`, `instructions`, `prequiz`, `encoding`,
`encoding_pass2_intro`, `immediate_recall`, `distractor_matrix`,
`distractor_wordsearch`,
`distractor_wordsearch`, `distractor_rest`, `post_distractor_recall`,
`training_slide1`, `training_slide2`, `training_check`, `panel_load`,
`block_intro`, `bisect_anchor_preview`, `bisection`, `iti`,
`inter_block_rest`, `mc_connectedness`, `mc_endorsement`, `mc_confidence`,
`fd_q1`, `fd_q2`, `fd_q3`, `fd_q4`, `full_disclosure`.

### Server-side data saving (for online / Pages runs)

The experiment always downloads the two CSV files locally. For online runs you
will also want the data sent somewhere it cannot be lost. There is a built-in
hook for this — **no code edit required**: append a `data=` parameter pointing
at any endpoint that accepts a POST, and the experiment will POST both CSVs to
it (as JSON) at the end, in addition to the local download.

```
https://<you>.github.io/roconn-pse-experiment/?data=https://your-endpoint.example/submit
```

The POST body is JSON: `{ pid, cell, subgroup, data_filename, data_csv,
condition_filename, condition_csv }`. The endpoint can be anything that accepts
cross-origin POSTs — a Google Apps Script web app, a Cloudflare Worker, a
Formspree-style form backend, or your own server. The local download still
happens regardless, so the hook is purely additive.

Alternatives that replace the save mechanism entirely:

* **JATOS** — wrap the experiment as a JATOS study and call
  `jatos.submitResultData(jsPsych.data.get().csv())` in `on_finish`.
* **Pavlovia** — supports jsPsych natively; see
  https://pavlovia.org/docs/experiments/create-jspsych.

For either, edit the `on_finish` handler in `js/experiment.js`.

---

## Customising the experiment

### The narrative

The supplied narrative is a working ~600-word draft of a fictional bilateral
trade dispute between two invented nations (Vorland and Selkavia). Protocol
v5 calls for ~1,200 words; expand the per-event paragraphs in
`config.js → ROCONN.narrative.seq1` and they will automatically propagate to
Sequence 2 (only E3 and E5 are transposed).

Before main data collection, run the pilot validation described in
Protocol v5 §3.5: 20 participants, free recall, plausibility, and reading
time should match across the two sequences. Run LIWC and Flesch-Kincaid
checks on the two paragraph orderings; they should be near-identical because
only the order changes, but content edits introduced by your group may
unbalance them.

### Timing

All timing parameters are in `config.js → ROCONN.params` and are in
milliseconds (except `ravenSecsPerItem`). Defaults match Protocol v5:

```js
anchorPreviewMs:   2000     // anchors shown before probe appears
maxResponseMs:     4000     // bisection response window
panelLoadPauseMs:  5000     // post-panel-appearance pause
itiMinMs / itiMaxMs: 800 / 1200   // jittered ITI between trials
distractorTotalMs: 1200000  // 20 min
interBlockRestMs:  180000   // 3 min
```

### Recall gates

Defaults are `immediateRecallGate: 6` (out of 7) and
`postDistractorRecallGate: 4`. The immediate-recall gate terminates the
session on failure (with the standard fail-track screen); the
post-distractor gate is informational only — `post_distractor_accuracy` is
recorded and intended to be entered as a covariate in the LMM.

### Confederate panel

The 12 PNG images of Protocol v5 §5.2 are replaced by dynamic SVG
generation in `panels.js`. Network positions, edges, badge colours, and
avatar rotation schedules are all defined as constants at the top of the
file. If you want to introduce a third topology (e.g. star, ring) you can
add it to `ROCONN.cells` and define its edge set alongside `HIGH_C_EDGES`.

Avatars are six geometric SVG faces (`Fa`–`Fc`, `Ga`–`Gc`) generated by
`avatarSVG()`. Swap in your own avatar images if you have an approved set
— place them under `assets/avatars/` and replace the SVG-generating call
with `<image href="...">` tags.

---

## Analysis pipeline

The R analysis pipeline from Protocol v5 Appendix C consumes the CSV output
of this experiment directly. The relevant columns it expects are
`participant` (= `pid`), `cell`, `topology`, `direction`, `block_num`
(= `block_order`), `pressure`, `block_order`, `probe_pos`, `response_num`,
`post_distractor_accuracy`. The pipeline:

1. Aggregates raw trial data to one row per participant × block × probe
   position (number of "end" responses out of 13).
2. Fits the 2-parameter logistic psychometric function (PSE, *k*) per
   participant × block using `quickpsy`, with γ = 0.5 (forced choice) and
   λ = 0.02 fixed a priori.
3. Computes ΔPSE per participant by subtracting the within-participant
   0%-block baseline.
4. Fits the primary linear mixed-effects model with `topology × pressure`,
   `direction × pressure`, `topology × direction`, `block_order`, and
   `post_distractor_accuracy` as fixed effects, plus random
   intercept-and-slope per participant.
5. Runs Bonferroni-corrected planned comparisons of High-C vs. Low-C at
   each pressure level (α = .017).
6. Runs a bootstrapped mediation model with perceived connectedness
   (`mc_connected` averaged with `mc_known`) as the mediator.

Copy the R script from Protocol v5 Appendix C into a file named
`analysis/roconn_pipeline.R` and point it at the directory containing the
session CSVs.

---

## Running a cohort session

Procedure for a 20–25-station lab cohort (per Protocol v5 §2.2):

1. **Before participants arrive.** Open every station to the experiment URL
   with the next pre-assigned pid/cell/subgroup. Print copies of the Raven's
   APM-Short sheet and word-search puzzle.
2. **Welcome and seating.** Read the cover-story script (`buildIntro`
   matches it on-screen). Confirm consent at each station.
3. **The experimenter leaves the room before Phase 2 (bisection) begins.**
   A research assistant remains for technical problems only and does not
   interact with participants. The 5–6-minute training plus loading-pause
   timing makes this transition unobtrusive.
4. **Distractor.** The matrix puzzles and word search run entirely on screen;
   the participant completes them with mouse/keyboard. No sheets are handed
   out and no experimenter action is required. The word search auto-advances
   at its time limit, which enforces the minimum distractor duration.
5. **Bisection blocks.** Self-contained; the experimenter stays out of the
   room.
6. **Debrief and disclosure.** Once all participants have reached the full
   disclosure screen, the experimenter re-enters, reads the disclosure
   script aloud, and answers any questions individually.
7. **Funnelled debrief screening.** Review the `fd_q1`–`fd_q3` responses
   that evening; flag any participant who named the confederate
   manipulation or answered `"No"` to `fd_q3` for exclusion.

---

## Browser support and requirements

* Modern desktop browser (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+).
* Full-screen API support (most modern browsers).
* JavaScript enabled.
* Local storage (used by jsPsych for some plugins).
* Display resolution 1280×800 or larger (panel + task layout assumes ~1100 px wide).

Touch tablets and phones are not supported. The bisection task uses
keyboard (`F`/`J`) responses; touch input is intentionally not enabled.

---

## Known limitations / things to verify before going live

1. **Narrative length.** Default is ~600 words. Expand to the protocol's
   1,200 words before main data collection, and re-validate balance in a
   pilot.
2. **Avatar realism.** SVG faces are deliberately schematic. For higher
   ecological validity, replace with a set of approved photo or illustration
   avatars.
3. **Data persistence.** Default save is a browser CSV download. For
   unsupervised online deployments, integrate with JATOS, Pavlovia, or your
   own server endpoint.
4. **Timing precision.** jsPsych in a browser is not millisecond-accurate
   for stimulus onset; observed jitter is typically < 17 ms (one screen
   refresh) on modern hardware, which is acceptable for a sequence
   bisection task but would not be for sub-50-ms visual psychophysics.
5. **Fail-track activity.** The current immediate-recall-failure screen
   asks the participant to call the experimenter. Replace with a 15-minute
   filler task of your choice if you want fully self-contained handling.

---

## Citing

If you publish results obtained with this implementation, please cite:

> Sengupta, R., Lazarus, J. (in preparation). *The Asymmetric Pull of
> Falsehood: A Computational Model of Temporal Narrative Drift in Echo
> Chambers.* Computational Cognition Laboratory, SIAS, Krea University.

and the jsPsych framework:

> de Leeuw, J. R. (2015). jsPsych: A JavaScript library for creating
> behavioral experiments in a Web browser. *Behavior Research Methods*,
> 47(1), 1–12.

---

## License

This repository is released under the MIT License. The narrative content,
panel design, and protocol logic are described in greater detail in the
unpublished protocol document and may be subject to additional usage
constraints — please contact the corresponding author at the Computational
Cognition Laboratory before re-using them outside replication efforts.

jsPsych is © Joshua de Leeuw and contributors, released under the MIT
License: <https://www.jspsych.org>.

---

## Contact

**Maintainer:** Dr. Rakesh Sengupta
**Email:** rakesh.sengupta@krea.edu.in
**Institution:** School of Interwoven Arts and Sciences, Krea University, Sri City, Andhra Pradesh 517 646, India

For bug reports and feature requests, please open an [issue](https://github.com/rakesh-sengupta/roconn-pse-experiment/issues).
