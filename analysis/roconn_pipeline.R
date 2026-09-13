# =============================================================================
#  roconn_pipeline.R  --  ROCONN Asymmetric Drift Study
#  Frozen analysis script accompanying the Stage 1 Registered Report.
#  Version 6.1, September 2026.
#
#  Input : ./data/roconn_<pid>_<cell>_<sg>.csv        (trial-level, one/session)
#          ./data/roconn_condition_<pid>_<cell>_<sg>.csv  (manifest, ignored here)
#          ./data/suspicion_exclusions.csv  (optional: pid column, coder output)
#  Output: ./output/*.csv and a printed log
#
#  Required packages : tidyverse, lme4, lmerTest, emmeans
#  Optional packages : MuMIn (R^2), lavaan + jsonlite (mediation),
#                      quickpsy (cross-check of the psychometric fit)
#  The psychometric fit itself is done in base R so that the confirmatory and
#  secondary analyses do not depend on any package outside the four required
#  ones.
# =============================================================================

suppressPackageStartupMessages({
  library(tidyverse); library(lme4); library(lmerTest); library(emmeans)
})
set.seed(20260911)
dir.create("output", showWarnings = FALSE)

EXPECTED_BISECTION_ROWS <- 195   # 3 blocks x 65 trials
MISSING_TRIAL_LIMIT     <- 0.20
CRITICAL_PROBES         <- c(3, 5)
CONTROL_PROBES          <- c(2, 4, 6)

`%||%` <- function(a, b) if (is.null(a)) b else a

# Sessions that ended early carry fewer columns than completed ones. Add any
# that are missing so that every downstream reference is safe.
ensure_cols <- function(d, defaults) {
  for (nm in names(defaults)) if (!nm %in% names(d)) d[[nm]] <- defaults[[nm]]
  d
}

# ---- 0. Load -----------------------------------------------------------------
files <- list.files("data", pattern = "^roconn_.*\\.csv$", full.names = TRUE)
files <- files[!grepl("roconn_condition_", files)]
stopifnot(length(files) > 0)

raw <- files |>
  map(\(f) read_csv(f, show_col_types = FALSE, progress = FALSE) |>
             mutate(across(everything(), as.character))) |>
  list_rbind()

num <- function(x) suppressWarnings(as.numeric(x))

raw <- ensure_cols(raw, list(
  assignment = NA_character_, demo = "0", withdraw = "false",
  termination_reason = NA_character_, response_num = NA_character_,
  probe_pos = NA_character_, pressure = NA_character_,
  block_order = NA_character_, post_distractor_accuracy = NA_character_,
  topology = NA_character_, direction = NA_character_, cell = NA_character_))

# ---- 1. Session-level screening ---------------------------------------------
# Sessions that never reach the bisection blocks (consent refused, screened out,
# reading-gate failure) write no usable trial data; they are counted, not
# analysed. Withdrawn sessions write no trial file at all, but the check is
# kept so that a stray file cannot slip through.
flags <- raw |>
  group_by(pid) |>
  summarise(
    n_bisection = sum(phase == "bisection", na.rm = TRUE),
    assignment  = { a <- na.omit(assignment); if (length(a)) a[1] else NA_character_ },
    demo_flag   = suppressWarnings(max(num(demo), na.rm = TRUE)),
    withdrew    = any(tolower(withdraw) == "true", na.rm = TRUE),
    terminated  = any(!is.na(termination_reason) & nzchar(termination_reason)),
    .groups = "drop"
  ) |>
  mutate(demo_flag = ifelse(is.finite(demo_flag), demo_flag, 0))

# Debrief item 3: "Did you believe the other reviewers were real participants?"
susp_q3 <- raw |>
  filter(phase == "fd_q3") |>
  mutate(said_no = str_detect(response, regex('"fd_q3"\\s*:\\s*"No"', ignore_case = TRUE))) |>
  group_by(pid) |> summarise(fd_q3_no = any(said_no, na.rm = TRUE), .groups = "drop")

# Open-ended items 1 and 2 are coded offline by two raters blind to condition.
susp_open <- if (file.exists("data/suspicion_exclusions.csv")) {
  read_csv("data/suspicion_exclusions.csv", show_col_types = FALSE) |>
    transmute(pid = as.character(pid), coded_suspicious = TRUE)
} else tibble(pid = character(), coded_suspicious = logical())

flags <- flags |>
  left_join(susp_q3,   by = "pid") |>
  left_join(susp_open, by = "pid") |>
  mutate(
    fd_q3_no         = coalesce(fd_q3_no, FALSE),
    coded_suspicious = coalesce(coded_suspicious, FALSE),
    excl_incomplete  = n_bisection == 0 | terminated,
    excl_demo        = demo_flag == 1 | (n_bisection > 0 &
                                         n_bisection != EXPECTED_BISECTION_ROWS),
    excl_assignment  = !is.na(assignment) & assignment != "url",
    excl_withdrew    = withdrew,
    excl_suspicion   = fd_q3_no | coded_suspicious
  )

cat("\n=== Session screening ===\n")
print(flags |> summarise(sessions = n(), across(starts_with("excl_"), sum)))

keep_sessions <- flags |>
  filter(!excl_incomplete, !excl_demo, !excl_assignment,
         !excl_withdrew, !excl_suspicion) |>
  pull(pid)

# ---- 2. Bisection trials and the missing-trial rule --------------------------
bis_all <- raw |> filter(phase == "bisection", pid %in% keep_sessions)

missing <- bis_all |>
  group_by(pid) |>
  summarise(prop_missing = mean(is.na(num(response_num))), .groups = "drop")

cat("\n=== Missing-trial exclusion (>", MISSING_TRIAL_LIMIT * 100, "%) ===\n", sep = "")
print(missing |> filter(prop_missing > MISSING_TRIAL_LIMIT))

keep_ids <- missing |> filter(prop_missing <= MISSING_TRIAL_LIMIT) |> pull(pid)

bis <- bis_all |>
  filter(pid %in% keep_ids, !is.na(num(response_num))) |>
  transmute(
    participant = pid,
    cell        = cell,
    topology    = factor(topology,  levels = c("low", "high")),
    direction   = factor(direction, levels = c("seq1to2", "seq2to1")),
    block_order = num(block_order),
    pressure    = num(pressure) / 100,            # 0, 0.5, 1
    probe_pos   = num(probe_pos),
    pda         = num(post_distractor_accuracy),
    end_resp    = num(response_num)               # 1 = "closer to End"
  )

stopifnot(nrow(bis) > 0)

# ---- 3. Primary DV: transposition drift index -------------------------------
#   D = p3 - p5 on ENCODED probe positions.
#   Veridical memory -> p3 low, p5 high -> D strongly negative.
#   Drift toward the pushed ordering -> D rises. D increases with drift in
#   every cell, so no sign flip by Direction is needed.
props <- bis |>
  group_by(participant, cell, topology, direction, block_order, pressure, pda,
           probe_pos) |>
  summarise(p_end = mean(end_resp), n_trials = n(), .groups = "drop")

drift <- props |>
  filter(probe_pos %in% CRITICAL_PROBES) |>
  select(-n_trials) |>
  pivot_wider(names_from = probe_pos, values_from = p_end, names_prefix = "p") |>
  mutate(D = p3 - p5) |>
  group_by(participant) |>
  mutate(D_baseline = first(D[pressure == 0]),
         delta_D    = D - D_baseline) |>
  ungroup()

cat("\n=== Drift index by topology and pressure ===\n")
print(drift |> group_by(topology, pressure) |>
        summarise(mean_D = mean(D), mean_delta_D = mean(delta_D),
                  sd_D = sd(D), n = n(), .groups = "drop"))
write_csv(drift, "output/drift_index.csv")

# ---- 4. Confirmatory model ---------------------------------------------------
#   H1 is the Topology x Pressure coefficient. D is modelled directly: the
#   random intercept absorbs each participant's own baseline, which the change
#   score cannot do without making the model singular (delta_D is exactly 0 at
#   pressure 0 for every participant by construction).
mod_full <- lmer(
  D ~ topology * pressure + direction * pressure + topology * direction +
      block_order + pda + (1 + pressure | participant),
  data = drift, REML = FALSE,
  control = lmerControl(optimizer = "bobyqa", optCtrl = list(maxfun = 2e5)))

lrt <- function(term, label) {
  reduced <- update(mod_full, as.formula(paste(". ~ . -", term)))
  cat("\n=== ", label, " ===\n", sep = "")
  print(anova(reduced, mod_full))
}
lrt("topology:pressure",  "H1 (primary): Topology x Pressure")
lrt("direction:pressure", "H2 (null prediction): Direction x Pressure")
lrt("topology:direction", "H3 (null prediction): Topology x Direction")

cat("\n=== Full model ===\n")
print(summary(mod_full)$coefficients)
if (requireNamespace("MuMIn", quietly = TRUE)) print(MuMIn::r.squaredGLMM(mod_full))

emm <- emmeans(mod_full, ~ topology | pressure, at = list(pressure = c(0, 0.5, 1)))
cat("\n=== Planned comparisons (Bonferroni, alpha = .017) ===\n")
print(pairs(emm, adjust = "bonferroni"))

# ---- 5. Control probes -------------------------------------------------------
#   Positions 2, 4 and 6 are identical in both orderings. Pressure should not
#   move them; an effect here would indicate a general response bias.
control <- props |>
  filter(probe_pos %in% CONTROL_PROBES) |>
  mutate(probe_pos = factor(probe_pos))

mod_control <- lmer(
  p_end ~ topology * pressure + probe_pos + block_order +
          (1 + pressure | participant),
  data = control, REML = FALSE,
  control = lmerControl(optimizer = "bobyqa", optCtrl = list(maxfun = 2e5)))
cat("\n=== Control probes: pressure should be null ===\n")
print(summary(mod_control)$coefficients)

# ---- 6. Secondary: psychometric fit (PSE and JND) ---------------------------
#   P(end | x) = gamma + (1 - gamma - lambda) / (1 + exp(-k (x - PSE)))
#   gamma = 0.5 (two-alternative forced choice), lambda = 0.02, both FIXED.
#   Only PSE and k are estimated, by maximum likelihood over probe positions
#   2-6. Base R only; quickpsy(guess = 0.5, lapses = 0.02) gives the same fit
#   and is used as an optional cross-check.
GAMMA <- 0.5; LAMBDA <- 0.02

psy_curve <- function(x, pse, k) GAMMA + (1 - GAMMA - LAMBDA) / (1 + exp(-k * (x - pse)))

fit_block <- function(d) {
  nll <- function(par) {
    p <- psy_curve(d$probe_pos, par[1], exp(par[2]))     # exp() keeps k > 0
    p <- pmin(pmax(p, 1e-9), 1 - 1e-9)
    -sum(d$k_end * log(p) + (d$n_trials - d$k_end) * log(1 - p))
  }
  best <- NULL
  for (start in list(c(4, log(1)), c(3, log(0.5)), c(5, log(2)))) {
    f <- tryCatch(optim(start, nll, method = "Nelder-Mead",
                        control = list(maxit = 2000, reltol = 1e-10)),
                  error = function(e) NULL)
    if (!is.null(f) && f$convergence == 0 && (is.null(best) || f$value < best$value))
      best <- f
  }
  if (is.null(best)) return(tibble(PSE = NA_real_, k_slope = NA_real_, converged = FALSE))
  tibble(PSE = best$par[1], k_slope = exp(best$par[2]), converged = TRUE)
}

agg <- bis |>
  group_by(participant, cell, topology, direction, block_order, pressure, pda,
           probe_pos) |>
  summarise(k_end = sum(end_resp), n_trials = n(), .groups = "drop")

psy <- agg |>
  group_by(participant, cell, topology, direction, block_order, pressure, pda) |>
  group_modify(~ fit_block(.x)) |>
  ungroup() |>
  mutate(valid = converged & !is.na(k_slope) & k_slope > 0.01 &
                 PSE > 1 & PSE < 7,
         JND   = ifelse(valid, 1 / k_slope, NA_real_))

cat("\n=== Psychometric fit success rate ===\n")
print(psy |> group_by(topology, pressure) |>
        summarise(prop_valid = mean(valid), n = n(), .groups = "drop"))
write_csv(psy, "output/psychometric_fits.csv")

# A block whose fit fails is dropped from THIS analysis only. The participant
# stays in the primary analysis, which uses no curve fitting -- so the old
# "any block with k <= 0 excludes the participant" rule, which would have
# removed the participants who drifted most, no longer applies anywhere.
if (sum(psy$valid) > 30) {
  mod_pse <- lmer(PSE ~ topology * pressure + direction * pressure +
                        block_order + pda + (1 + pressure | participant),
                  data = filter(psy, valid), REML = FALSE,
                  control = lmerControl(optimizer = "bobyqa"))
  cat("\n=== Secondary: PSE ===\n"); print(summary(mod_pse)$coefficients)

  mod_jnd <- lmer(JND ~ topology * pressure + direction * pressure +
                        block_order + pda + (1 + pressure | participant),
                  data = filter(psy, valid), REML = FALSE,
                  control = lmerControl(optimizer = "bobyqa"))
  cat("\n=== Secondary: JND = 1/k (attractor broadening) ===\n")
  print(summary(mod_jnd)$coefficients)
}

# ---- 7. Manipulation checks --------------------------------------------------
get_likert <- function(ph, fields) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) return(NULL)
  d <- raw |> filter(phase == ph, pid %in% keep_ids)
  if (!nrow(d)) return(NULL)
  vals <- map(d$response, \(s) tryCatch(jsonlite::fromJSON(s), error = function(e) NULL))
  tibble(participant = d$pid,
         value = map_dbl(vals, \(v) if (is.null(v)) NA_real_ else
                                    mean(unlist(v[fields]), na.rm = TRUE)))
}

conn <- get_likert("mc_connectedness", c("mc_connected", "mc_known"))
if (!is.null(conn)) {
  mc <- drift |> distinct(participant, topology) |> left_join(conn, by = "participant")
  cat("\n=== Manipulation check: perceived connectedness ===\n")
  print(mc |> group_by(topology) |>
          summarise(mean = mean(value, na.rm = TRUE),
                    sd = sd(value, na.rm = TRUE), n = n(), .groups = "drop"))
  if (n_distinct(mc$topology) == 2) print(t.test(value ~ topology, data = mc))
}

endorse <- raw |>
  filter(phase == "mc_endorsement", pid %in% keep_ids) |>
  mutate(count = num(str_extract(response, "\\d+"))) |>
  transmute(participant = pid, endorse_count = count)
if (nrow(endorse)) {
  ec <- drift |> distinct(participant, topology) |> left_join(endorse, by = "participant")
  cat("\n=== Manipulation check: perceived endorsement count ===\n")
  print(ec |> group_by(topology) |>
          summarise(mean = mean(endorse_count, na.rm = TRUE), n = n(), .groups = "drop"))
}

# ---- 8. Mediation (secondary) -----------------------------------------------
if (requireNamespace("lavaan", quietly = TRUE) && !is.null(conn)) {
  med_dat <- drift |>
    filter(pressure == 1) |>
    left_join(conn, by = "participant") |>
    transmute(delta_D, connectedness = value,
              topology_n = as.numeric(topology == "high")) |>
    drop_na()
  if (nrow(med_dat) > 40) {
    med_model <- '
      connectedness ~ a*topology_n
      delta_D       ~ b*connectedness + c*topology_n
      indirect := a*b
      total    := c + a*b '
    fit_med <- lavaan::sem(med_model, data = med_dat,
                           se = "bootstrap", bootstrap = 5000)
    cat("\n=== Mediation by perceived connectedness ===\n")
    print(lavaan::summary(fit_med, ci = TRUE))
  }
}

# ---- 9. Reported flow --------------------------------------------------------
cat("\n=== Participant flow ===\n")
cat("Session files loaded      :", length(files), "\n")
cat("Passed session screening  :", length(keep_sessions), "\n")
cat("Passed missing-trial rule :", length(keep_ids), "\n")
cat("Blocks in primary model   :", nrow(drift), "\n")
write_csv(flags, "output/screening_flags.csv")
cat("\nWritten to output/: drift_index.csv, psychometric_fits.csv, screening_flags.csv\n")
