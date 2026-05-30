# =============================================================================
#  roconn_pipeline.R  —  ROCONN Asymmetric PSE Shift, v5 analysis pipeline
#
#  Adapted from Protocol v5 Appendix C to consume the jsPsych CSV output of
#  this repository (one trial-data file per participant in ./data/).
#
#  Statistical choices (logistic fit; gamma = 0.5; lambda fixed; aggregated
#  input; LMM with topology*pressure as the primary test) follow Appendix C
#  verbatim. Only the data-loading/aggregation step is changed to match the
#  jsPsych column names.
#
#  Requires: lme4, lmerTest, quickpsy, tidyverse, emmeans, MuMIn
#            (lavaan + jsonlite only for the optional mediation block)
# =============================================================================

library(quickpsy); library(lme4); library(lmerTest)
library(tidyverse); library(emmeans); library(MuMIn)

# ---- 0. Load every trial-data file in ./data/ -------------------------------
#   jsPsych writes two files per session:
#     roconn_<pid>_<cell>_<sg>.csv            <- trial-level data (USE THESE)
#     roconn_condition_<pid>_<cell>_<sg>.csv  <- one-row condition manifest
#   We load only the trial-level files (exclude the "condition" manifests).
files <- list.files("data", pattern = "^roconn_.*\\.csv$", full.names = TRUE)
files <- files[!grepl("roconn_condition_", files)]
stopifnot(length(files) > 0)

dat <- files |>
  map(read_csv, show_col_types = FALSE) |>
  list_rbind()

# ---- 1. Keep bisection trials; recode response ------------------------------
#   response_num: 1 = "j"/closer-to-End, 0 = "f"/closer-to-Start,
#                 NA = no response within 4 s (dropped — NOT counted as 0).
#   block_num is the protocol's block_order (1 = first block run, etc.).
bis <- dat |>
  filter(phase == "bisection") |>
  filter(!is.na(response_num)) |>
  transmute(
    participant = pid,
    cell        = cell,
    topology    = factor(topology,  levels = c("low", "high")),
    direction   = factor(direction, levels = c("seq1to2", "seq2to1")),
    block_num   = as.numeric(block_order),
    block_order = as.numeric(block_order),
    pressure    = as.numeric(pressure),
    probe_pos   = as.numeric(probe_pos),
    post_distractor_accuracy = as.numeric(post_distractor_accuracy),
    response_num = as.numeric(response_num)
  )

# ---- 2. AGGREGATE: one row per participant x block x probe position ---------
#   quickpsy requires aggregated data, NOT raw trial-level data.
dat_agg <- bis |>
  group_by(participant, cell, topology, direction,
           block_num, pressure, block_order,
           post_distractor_accuracy, probe_pos) |>
  summarise(k_resp = sum(response_num),   # number of "j"/End responses
            n_resp = n(),                 # total scored trials at this position
            .groups = "drop")

# ---- 3. Fit psychometric function per participant x block -------------------
#   gamma = 0.5 (fixed, forced choice); lambda fixed; PSE and k estimated.
fit_one_block <- function(d) {
  tryCatch({
    fit <- quickpsy(d = d,
                    x = probe_pos,
                    k = k_resp,
                    n = n_resp,
                    fun = logistic_fun,    # logistic, NOT cum_normal
                    guess = 0.5,           # gamma fixed
                    lapses = FALSE,        # lambda handled per Appendix C note
                    parini = list(c(2, 6),    # PSE: search between 2 and 6
                                  c(0.1, 10))) # k: positive only
    tibble(PSE = fit$par$par[1], k_slope = fit$par$par[2])
  }, error = function(e) tibble(PSE = NA_real_, k_slope = NA_real_))
}

pse_list <- dat_agg |>
  group_by(participant, cell, topology, direction,
           block_num, pressure, block_order,
           post_distractor_accuracy) |>
  group_modify(~ fit_one_block(.x)) |>
  ungroup()

# ---- 4. Exclude participants with any invalid block (k <= 0) ----------------
pse_list <- pse_list |>
  mutate(valid = !is.na(k_slope) & k_slope > 0)

keep_ids <- pse_list |>
  group_by(participant) |>
  summarise(n_valid = sum(valid), .groups = "drop") |>
  filter(n_valid == 3) |>
  pull(participant)

pse_clean <- pse_list |>
  filter(participant %in% keep_ids, valid)

# ---- 5. Compute DeltaPSE (within-participant 0% baseline) -------------------
pse_delta <- pse_clean |>
  group_by(participant) |>
  mutate(baseline_PSE = PSE[pressure == 0],
         delta_PSE    = PSE - baseline_PSE) |>
  ungroup()

# ---- 6. Primary linear mixed-effects model ----------------------------------
mod_full <- lmer(
  delta_PSE ~ topology * pressure +
              direction * pressure +
              topology * direction +
              block_order +
              post_distractor_accuracy +
              (1 + pressure | participant),
  data    = pse_delta,
  REML    = FALSE,
  control = lmerControl(optimizer = "bobyqa", optCtrl = list(maxfun = 2e5))
)

# Likelihood-ratio tests for the key interactions
mod_noB4 <- update(mod_full, . ~ . - topology:pressure)
cat("\n=== Primary test: Topology x Pressure (beta_4) ===\n")
print(anova(mod_noB4, mod_full))

mod_noB5 <- update(mod_full, . ~ . - direction:pressure)
cat("\n=== Null prediction: Direction x Pressure (beta_5) ===\n")
print(anova(mod_noB5, mod_full))

cat("\n=== Full model summary ===\n")
print(summary(mod_full))
print(r.squaredGLMM(mod_full))     # marginal & conditional R^2

# ---- 7. Planned comparisons: High-C vs Low-C at each pressure ---------------
emm <- emmeans(mod_full, ~ topology | pressure)
cat("\n=== Planned comparisons (Bonferroni, alpha_corr = .017) ===\n")
print(pairs(emm, adjust = "bonferroni"))

# ---- 8. OPTIONAL: mediation by perceived connectedness ----------------------
#   jsPsych's survey-likert stores its answers as a JSON object in the
#   `response` column of the mc_connectedness row. Extract mc_connected and
#   mc_known, average them, merge into pse_delta, then fit the SEM.
#
# library(lavaan); library(jsonlite)
# conn <- dat |>
#   filter(phase == "mc_connectedness") |>
#   rowwise() |>
#   mutate(r = list(fromJSON(response)),
#          connectedness = mean(c(r$mc_connected, r$mc_known))) |>
#   ungroup() |>
#   transmute(participant = pid, connectedness)
# pse_med <- pse_delta |> left_join(conn, by = "participant")
# med_model <- '
#   connectedness ~ topology
#   delta_PSE     ~ connectedness + topology
# '
# fit_med <- sem(med_model, data = pse_med, se = "bootstrap", bootstrap = 5000)
# summary(fit_med, fit.measures = TRUE, ci = TRUE)
