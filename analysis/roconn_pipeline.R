# =============================================================================
#  roconn_pipeline.R  --  frozen analysis script for the Stage 1 Registered
#  Report "Does the perceived interdependence of dissenting sources change
#  memory for the order of events?" (Lazarus & Sengupta). Protocol v7.0.
#
#  Usage:   Rscript analysis/roconn_pipeline.R [data_dir] [output_dir]
#           (defaults: ./data and ./output)
#  Input:   data_dir/roconn_<pid>_<cell>_<sg>.csv            trial-level files
#           data_dir/roconn_condition_<pid>_<cell>_<sg>.csv  one-row manifests
#           data_dir/suspicion_exclusions.csv  (optional; column pid) -- the
#             participants whom two blind coders judged to have seen through
#             the panel in the open debrief answers (RR 3.1, item 7)
#  Output:  output_dir/results.txt (full log) and CSV tables.
#
#  Required packages: lme4, lmerTest.   Optional: logistf (Firth, S3).
#  Section numbers in comments refer to the Stage 1 manuscript.
# =============================================================================
suppressPackageStartupMessages({ library(lme4); library(lmerTest) })
args    <- commandArgs(trailingOnly = TRUE)
DATA    <- if (length(args) >= 1) args[1] else "data"
OUT     <- if (length(args) >= 2) args[2] else "output"
dir.create(OUT, showWarnings = FALSE, recursive = TRUE)
set.seed(20261110)

N_PANEL_TRIALS <- 195     # 3 blocks x 5 positions x 13
N_FREE_TRIALS  <- 40      # 5 positions x 8
MISSING_LIMIT  <- 0.20
SESOI          <- 0.15    # drift-index units (RR 3.8)
C2_BOUND       <- 1       # reviewers (check C2)
N_BOOT         <- 5000

log_file <- file.path(OUT, "results.txt")
sink(log_file, split = TRUE)
say  <- function(...) cat(..., "\n", sep = "")
head_ <- function(x) { cat("\n", strrep("=", 78), "\n", x, "\n", strrep("=", 78), "\n", sep = "") }
num  <- function(x) suppressWarnings(as.numeric(x))
json_field <- function(s, key) {               # value of "key":... in a jsPsych JSON string
  m <- regmatches(s, regexec(paste0('"', key, '"\\s*:\\s*"?([^",}]*)"?'), s))
  vapply(m, function(z) if (length(z) == 2) z[2] else NA_character_, "")
}
first_non_na <- function(x) { x <- x[!is.na(x) & x != ""]; if (length(x)) x[1] else NA }

say("roconn_pipeline.R  |  protocol v7.0  |  run ", format(Sys.time()))
say("R ", R.version$major, ".", R.version$minor, "  lme4 ", as.character(packageVersion("lme4")),
    "  lmerTest ", as.character(packageVersion("lmerTest")))

# ---- 0. Load -----------------------------------------------------------------
files <- list.files(DATA, pattern = "^roconn_.*\\.csv$", full.names = TRUE)
man_files <- files[grepl("roconn_condition_", basename(files))]
files <- files[!grepl("roconn_condition_", basename(files))]
stopifnot(length(files) > 0)
read_one <- function(f) {
  d <- read.csv(f, colClasses = "character", na.strings = c("", "NA", "null"))
  d$.file <- basename(f); d
}
all_cols <- character(0); raw_list <- lapply(files, read_one)
for (d in raw_list) all_cols <- union(all_cols, names(d))
raw <- do.call(rbind, lapply(raw_list, function(d) { for (c in setdiff(all_cols, names(d))) d[[c]] <- NA; d[all_cols] }))
manifests <- if (length(man_files)) do.call(rbind, lapply(man_files, function(f)
  read.csv(f, colClasses = "character", na.strings = c("", "NA")))) else NULL

# ---- 1. Session screening (RR 3.1) ------------------------------------------
head_("1. EXCLUSIONS (RR 3.1)")
sess <- do.call(rbind, lapply(split(raw, raw$pid), function(d) {
  ph <- d$phase
  data.frame(
    pid         = d$pid[1],
    cell        = first_non_na(d$cell),
    topology    = first_non_na(d$topology),
    direction   = first_non_na(d$direction),
    demo        = num(first_non_na(d$demo)),
    assignment  = first_non_na(d$assignment),
    termination = first_non_na(d$termination_reason),
    withdrew    = any(tolower(d$withdraw) == "true", na.rm = TRUE),
    n_panel     = sum(ph == "bisection", na.rm = TRUE),
    n_free      = sum(ph == "free_judgement", na.rm = TRUE),
    miss_panel  = mean(is.na(num(d$response_num[ph %in% "bisection"]))),
    miss_free   = mean(is.na(num(d$response_num[ph %in% "free_judgement"]))),
    fd_q3_no    = any(json_field(d$response[ph %in% "fd_q3"], "fd_q3") == "No", na.rm = TRUE),
    stringsAsFactors = FALSE)
}))
coded <- if (file.exists(file.path(DATA, "suspicion_exclusions.csv")))
  as.character(read.csv(file.path(DATA, "suspicion_exclusions.csv"), colClasses = "character")$pid) else character(0)
sess$coded_suspicious <- sess$pid %in% coded

# Steps 1-2 (no consent; ineligible/topic screen) write no trial file; they are
# counted from the manifests. Steps 3-7 are applied to the trial files in order.
if (!is.null(manifests)) {
  say("Manifests found: ", nrow(manifests))
  tr <- table(ifelse(is.na(manifests$termination_reason), "(completed or withdrew)", manifests$termination_reason))
  print(tr)
  say("Withdrawals recorded in manifests: ", sum(manifests$withdrew == "1", na.rm = TRUE))
}
steps <- list(
  "3 reading gate failed (order test 1 < 6/7)" = function(s) s$termination %in% "encoding_failure",
  "4 withdrew after disclosure"                = function(s) s$withdrew,
  "5 protocol violation (assignment / demo / trial count)" =
      function(s) s$assignment != "url" | s$demo %in% 1 | s$n_panel != N_PANEL_TRIALS | s$n_free != N_FREE_TRIALS,
  "6 missing > 20% (panel or panel-free block)" = function(s) s$miss_panel > MISSING_LIMIT | s$miss_free > MISSING_LIMIT,
  "7 did not believe the panel (fd_q3 = No, or coded)" = function(s) s$fd_q3_no | s$coded_suspicious)
# Sessions that ended for any reason other than the reading gate write no trial
# file, so every trial file is either complete or a reading-gate failure.
keep <- is.na(sess$termination) | sess$termination %in% "encoding_failure"
say("Trial files loaded: ", nrow(sess))
for (nm in names(steps)) {
  hit <- keep & steps[[nm]](sess); hit[is.na(hit)] <- TRUE
  say(sprintf("  excluded at step %-58s %3d", nm, sum(hit & keep)))
  keep <- keep & !hit
}
sess$included <- keep
say("Analysable participants: ", sum(keep))
print(table(sess$cell[keep]))
write.csv(sess, file.path(OUT, "screening.csv"), row.names = FALSE)
ids <- sess$pid[keep]

# ---- 2. Coding (RR 3.2) -------------------------------------------------------
d0 <- raw[raw$pid %in% ids, ]
pda_raw <- tapply(num(d0$post_distractor_accuracy), d0$pid, function(x) first_non_na(x))
pda_c   <- pda_raw - mean(pda_raw)
code_trials <- function(d, phase) {
  d <- d[d$phase %in% phase, ]
  d$end   <- num(d$response_num)
  d$pos   <- num(d$probe_pos)
  d$topo  <- ifelse(d$topology == "high", 0.5, -0.5)
  d$direc <- ifelse(d$direction == "seq1to2", 0.5, -0.5)          # +0.5 = read Sequence 1
  d$pda   <- as.numeric(pda_c[d$pid])
  d$tix   <- num(d$trial_index)
  d
}
pan <- code_trials(d0, "bisection")
pan$P  <- num(pan$pressure) / 100
pan$bo <- num(pan$block_order) - 2
pan <- do.call(rbind, lapply(split(pan, list(pan$pid, pan$block_order), drop = TRUE), function(b) {
  b <- b[order(b$tix), ]; b$trial <- (seq_len(nrow(b)) - 1) / (nrow(b) - 1) - 0.5; b }))
fre <- code_trials(d0, "free_judgement")
fre$lastP <- num(fre$last_pressure) / 100 - 0.5
fre <- do.call(rbind, lapply(split(fre, fre$pid), function(b) {
  b <- b[order(b$tix), ]; b$trial <- (seq_len(nrow(b)) - 1) / (nrow(b) - 1) - 0.5; b }))
crit_code <- function(d) { d <- d[d$pos %in% c(3, 5) & !is.na(d$end), ]; d$crit <- ifelse(d$pos == 3, 0.5, -0.5); d }
panC <- crit_code(pan); freC <- crit_code(fre)
say("\nPanel-block judgements on critical events: ", nrow(panC), "   panel-free: ", nrow(freC))

# ---- helpers: fitting with the registered fallback sequence -------------------
fit_glmm <- function(fixed, re_seq, data) {
  for (re in re_seq) {
    warn <- character(0)
    m <- withCallingHandlers(
      tryCatch(glmer(as.formula(paste(fixed, "+", re)), data = data, family = binomial,
                     control = glmerControl(optimizer = "bobyqa", optCtrl = list(maxfun = 2e5))),
               error = function(e) NULL),
      warning = function(w) { warn <<- c(warn, conditionMessage(w)); invokeRestart("muffleWarning") })
    conv_ok <- !is.null(m) && !isSingular(m) && !any(grepl("converge", warn, ignore.case = TRUE))
    say("  random effects ", re, ": ", if (is.null(m)) "failed" else if (conv_ok) "converged" else
        paste0("not used (", if (isSingular(m)) "singular" else "convergence warning", ")"))
    if (conv_ok) return(list(model = m, re = re))
  }
  stop("No random-effects structure converged.")
}
lrt <- function(m, term) {
  red <- update(m, as.formula(paste(". ~ . -", term)))
  a <- anova(red, m)
  list(chisq = a$Chisq[2], df = a$Df[2], p = a$`Pr(>Chisq)`[2])
}
wald <- function(m, term, level = 0.95) {
  est <- fixef(m)[[term]]; se <- sqrt(vcov(m)[term, term]); z <- qnorm(1 - (1 - level) / 2)
  c(estimate = est, se = se, lo = est - z * se, hi = est + z * se)
}
fmt <- function(x, d = 3) formatC(x, format = "f", digits = d)
pfmt <- function(p) if (is.na(p)) "NA" else if (p < .001) "< .001" else paste0("= ", formatC(p, format = "f", digits = 3))

results <- list()

# ---- 3. H1 (RR 3.3) -----------------------------------------------------------
head_("2. H1: Panel structure x Dissent on drift, panel blocks (RR 3.3)")
FIX_H1 <- "end ~ crit * P * topo + crit * P * direc + crit * topo * direc + crit * bo + crit * pda + crit * trial"
RE_H1  <- c("(1 + crit + crit:P | pid)", "(1 + crit + crit:P || pid)", "(1 + crit | pid)", "(1 | pid)")
h1 <- fit_glmm(FIX_H1, RE_H1, panC)
m1 <- h1$model
t1 <- lrt(m1, "crit:P:topo"); w1 <- wald(m1, "crit:P:topo")
say(sprintf("H1  crit:P:topo  estimate %s (SE %s, 95%% CI %s to %s);  LRT chi2(%d) = %s, p %s",
            fmt(w1["estimate"]), fmt(w1["se"]), fmt(w1["lo"]), fmt(w1["hi"]), t1$df, fmt(t1$chisq, 2), pfmt(t1$p)))
results$H1 <- c(w1, chisq = t1$chisq, p = t1$p)   # numeric only

# model-estimated drift index for each panel structure x dissent (other predictors at 0)
pred_D <- function(m, topo, P) {
  b <- fixef(m); X <- function(crit) {
    v <- c("(Intercept)" = 1, crit = crit, P = P, topo = topo, `crit:P` = crit * P, `crit:topo` = crit * topo,
           `P:topo` = P * topo, `crit:P:topo` = crit * P * topo)
    sum(b[names(v)] * v, na.rm = TRUE) }
  plogis(X(0.5)) - plogis(X(-0.5))
}
est_tab <- expand.grid(P = c(0, 0.5, 1), topo = c(-0.5, 0.5))
est_tab$D_model <- mapply(function(t, p) pred_D(m1, t, p), est_tab$topo, est_tab$P)
est_tab$panel <- ifelse(est_tab$topo > 0, "connected", "independent")
say("\nModel-estimated drift index (p3 - p5) by panel structure and dissent:")
print(est_tab[, c("panel", "P", "D_model")], row.names = FALSE, digits = 3)
write.csv(est_tab, file.path(OUT, "H1_estimated_drift.csv"), row.names = FALSE)

# ---- 4. H2 (RR 3.4) -----------------------------------------------------------
head_("3. H2: panel structure and drift in the panel-free block (RR 3.4)")
FIX_H2 <- "end ~ crit * topo + crit * direc + crit * pda + crit * lastP + crit * trial"
RE_H2  <- c("(1 + crit | pid)", "(1 + crit || pid)", "(1 | pid)")
h2 <- fit_glmm(FIX_H2, RE_H2, freC)
m2 <- h2$model
t2 <- lrt(m2, "crit:topo"); w2 <- wald(m2, "crit:topo")
say(sprintf("H2  crit:topo  estimate %s (SE %s, 95%% CI %s to %s);  LRT chi2(%d) = %s, p %s",
            fmt(w2["estimate"]), fmt(w2["se"]), fmt(w2["lo"]), fmt(w2["hi"]), t2$df, fmt(t2$chisq, 2), pfmt(t2$p)))
results$H2 <- c(w2, chisq = t2$chisq, p = t2$p)   # numeric only

# ---- 5. Drift-index model: E1, E2, and the H1 equivalence test (RR 3.6, 3.3) -----
head_("4. DRIFT-INDEX MODEL: E1, E2 and equivalence for H1 (RR 3.6)")
Dtab <- aggregate(end ~ pid + topo + direc + P + bo + pda + pos, data = panC, FUN = mean)
Dw <- reshape(Dtab, idvar = c("pid", "topo", "direc", "P", "bo", "pda"), timevar = "pos", direction = "wide")
Dw$D <- Dw$end.3 - Dw$end.5
write.csv(Dw, file.path(OUT, "drift_index_by_block.csv"), row.names = FALSE)
mD <- lmer(D ~ topo * P + direc * P + topo * direc + bo + pda + (1 + P | pid), data = Dw, REML = FALSE,
           control = lmerControl(optimizer = "bobyqa"))
if (isSingular(mD)) {
  say("  drift-index model singular with (1 + P | pid); using (1 | pid)")
  mD <- update(mD, . ~ . - (1 + P | pid) + (1 | pid))
}
ci90 <- function(m, term) {
  s <- summary(m)$coefficients[term, ]
  q <- qt(0.95, s[["df"]]); c(est = s[["Estimate"]], lo = s[["Estimate"]] - q * s[["Std. Error"]],
                              hi = s[["Estimate"]] + q * s[["Std. Error"]], df = s[["df"]])
}
e1 <- ci90(mD, "P:direc"); e1_eq <- e1["lo"] > -SESOI & e1["hi"] < SESOI
say(sprintf("E1  Order read x Dissent: %s, 90%% CI %s to %s -> %s", fmt(e1["est"]), fmt(e1["lo"]), fmt(e1["hi"]),
            if (e1_eq) "EQUIVALENT within +/-0.15" else "equivalence NOT established"))
h1eq <- ci90(mD, "topo:P"); h1_eq <- h1eq["lo"] > -SESOI & h1eq["hi"] < SESOI
say(sprintf("H1 (drift-index scale) Panel structure x Dissent: %s, 90%% CI %s to %s -> %s",
            fmt(h1eq["est"]), fmt(h1eq["lo"]), fmt(h1eq["hi"]),
            if (h1_eq) "within +/-0.15" else "not within +/-0.15"))
mE2 <- update(mD, . ~ . + topo:direc:P)
s2 <- summary(mE2)$coefficients["topo:P:direc", ]
q2 <- qt(0.975, s2[["df"]])
say(sprintf("E2  Panel structure x Order read x Dissent: %s, 95%% CI %s to %s (reported only)",
            fmt(s2[["Estimate"]]), fmt(s2[["Estimate"]] - q2 * s2[["Std. Error"]]), fmt(s2[["Estimate"]] + q2 * s2[["Std. Error"]])))
results$E1 <- c(e1, equivalent = e1_eq); results$H1_equiv <- c(h1eq, equivalent = h1_eq)

# H1 interpretation as registered
h1_sig <- results$H1[["p"]] < .05; h1_sign <- sign(results$H1[["estimate"]])
stopifnot(is.numeric(results$H1), is.numeric(results$H2))

# ---- 6. Outcome-neutral checks C1-C6 (RR 3.6) -----------------------------------
head_("5. OUTCOME-NEUTRAL CHECKS (RR 3.6)")
per <- do.call(rbind, lapply(split(d0, d0$pid), function(d) {
  ph <- d$phase
  mc <- d$response[ph %in% "mc_connectedness"]
  conn <- mean(num(c(json_field(mc, "mc_connected"), json_field(mc, "mc_known")))) + 1   # 0-6 -> 1-7
  rep_n <- num(gsub("[^0-9]", "", json_field(d$response[ph %in% "mc_endorsement"], "mc_endorse_count")))
  bis <- d[ph %in% "bisection", ]; last_block_P <- num(bis$pressure[num(bis$block_order) == 3][1])
  data.frame(pid = d$pid[1], topology = first_non_na(d$topology), direction = first_non_na(d$direction),
             connectedness = conn, reported = rep_n, actual = last_block_P / 100 * 6,
             pda = num(first_non_na(d$post_distractor_accuracy)),
             t3_pushed = num(first_non_na(d$order_test3_pushed)), t3_conf = num(first_non_na(d$order_test3_confidence)),
             t4_pushed = num(first_non_na(d$order_test4_pushed)), stringsAsFactors = FALSE)
}))
per$error <- per$reported - per$actual
write.csv(per, file.path(OUT, "participant_measures.csv"), row.names = FALSE)
con <- per$topology == "high"
c1 <- t.test(per$connectedness[con], per$connectedness[!con], alternative = "greater")
say(sprintf("C1 perceived connectedness: connected %s vs independent %s; Welch t = %s, one-sided p %s -> %s",
            fmt(mean(per$connectedness[con], na.rm = TRUE), 2), fmt(mean(per$connectedness[!con], na.rm = TRUE), 2),
            fmt(c1$statistic, 2), pfmt(c1$p.value), if (c1$p.value < .05) "PASS" else "FAIL"))
if (sum(!is.na(per$error[con])) >= 2 && sum(!is.na(per$error[!con])) >= 2) {
  c2 <- t.test(per$error[con], per$error[!con], conf.level = 0.90)
  c2_ok <- c2$conf.int[1] > -C2_BOUND & c2$conf.int[2] < C2_BOUND
  say(sprintf("C2 error in reported number of dissenters, difference %s, 90%% CI %s to %s -> %s",
              fmt(diff(rev(c2$estimate)), 2), fmt(c2$conf.int[1], 2), fmt(c2$conf.int[2], 2), if (c2_ok) "PASS" else "FAIL"))
} else { c2_ok <- NA; say("C2 not estimable: too few valid answers to the perceived-dissent item.") }
mis <- mean(1 - per$pda / 7, na.rm = TRUE)
say(sprintf("C3 proportion of events misplaced in order test 2: %s -> %s", fmt(mis, 3),
            if (mis >= .10 && mis <= .20) "inside 10-20%" else "OUTSIDE 10-20% (reported)"))
b <- fixef(m1); V <- vcov(m1)
z_crit <- b[["crit"]] / sqrt(V["crit", "crit"])
say(sprintf("C4 encoding: crit at P = 0 = %s, z = %s, one-sided p %s -> %s", fmt(b[["crit"]]), fmt(z_crit, 2),
            pfmt(pnorm(z_crit)), if (b[["crit"]] < 0 && pnorm(z_crit) < .05) "PASS" else "FAIL"))
z_cp <- b[["crit:P"]] / sqrt(V["crit:P", "crit:P"])
c5_ok <- b[["crit:P"]] > 0 && pnorm(z_cp, lower.tail = FALSE) < .05
say(sprintf("C5 drift present: crit:P = %s, z = %s, one-sided p %s -> %s", fmt(b[["crit:P"]]), fmt(z_cp, 2),
            pfmt(pnorm(z_cp, lower.tail = FALSE)), if (c5_ok) "PASS" else "FAIL"))
ctrl <- pan[pan$pos %in% c(2, 4, 6) & !is.na(pan$end), ]
cm <- aggregate(end ~ pos + P, data = ctrl, FUN = mean)
chg <- sapply(c(2, 4, 6), function(p) cm$end[cm$pos == p & cm$P == 1] - cm$end[cm$pos == p & cm$P == 0])
say("C6 change in P(closer to end), 0% -> 100% dissent, control events 2/4/6: ", paste(fmt(chg), collapse = " / "),
    if (any(abs(chg) > 0.10)) "  -> exceeds 0.10: H1 re-estimated relative to control events below" else "  -> PASS")
if (any(abs(chg) > 0.10)) {
  all5 <- pan[!is.na(pan$end), ]
  all5$lin  <- (all5$pos - 4) / 2
  all5$crit <- ifelse(all5$pos == 3, 0.5, ifelse(all5$pos == 5, -0.5, 0))
  mC6 <- fit_glmm("end ~ lin * P * topo + crit * P * topo + crit * P * direc + lin * P * direc + bo + pda",
                  c("(1 + lin + crit | pid)", "(1 + lin | pid)", "(1 | pid)"), all5)$model
  wC6 <- wald(mC6, "P:topo:crit")
  say(sprintf("   H1 relative to control events (crit:P:topo beyond the linear trend): %s, 95%% CI %s to %s",
              fmt(wC6["estimate"]), fmt(wC6["lo"]), fmt(wC6["hi"])))
}
results$checks <- c(C1 = c1$p.value < .05, C2 = c2_ok, C3 = mis >= .10 && mis <= .20,
                    C4 = b[["crit"]] < 0 && pnorm(z_crit) < .05, C5 = c5_ok, C6 = !any(abs(chg) > 0.10))

# ---- 7. Interpretation of the confirmatory tests, as registered ----------------
head_("6. REGISTERED INTERPRETATION")
interp_h1 <- if (h1_sig && h1_sign > 0) "Supported: drift rises more steeply with dissent for connected panels (complex contagion / field model)." else
             if (h1_sig && h1_sign < 0) "Supported in the opposite direction: drift rises less steeply for connected panels (source independence)." else
             if (h1_eq) "No difference of the size of interest (equivalence within +/-0.15)." else "Inconclusive."
if (!all(results$checks[c("C1", "C4", "C5")])) interp_h1 <- paste(interp_h1, "CAUTION: C1, C4 or C5 failed; see RR 3.3.")
interp_h2 <- if (results$H2[["p"]] < .05) paste0("Significant, ", if (as.numeric(results$H2[["estimate"]]) > 0) "more" else "less",
             " drift after connected panels.") else "Not significant."
say("H1: ", interp_h1); say("H2: ", interp_h2)

# ---- 8. Secondary analyses S1-S4 (RR 3.5) ---------------------------------------
head_("7. SECONDARY ANALYSES (RR 3.5)")
# S1: one- vs two-component normal mixture on connected 50% drift index
mix2 <- function(x, iter = 500) {
  n <- length(x); best <- NULL
  for (start in 1:20) {
    mu <- sort(sample(x, 2)); s <- rep(sd(x), 2); w <- 0.5
    for (k in 1:iter) {
      a <- w * dnorm(x, mu[1], s[1]); c2_ <- (1 - w) * dnorm(x, mu[2], s[2]); r <- a / (a + c2_)
      w <- mean(r); mu <- c(sum(r * x) / sum(r), sum((1 - r) * x) / sum(1 - r))
      s <- pmax(c(sqrt(sum(r * (x - mu[1])^2) / sum(r)), sqrt(sum((1 - r) * (x - mu[2])^2) / sum(1 - r))), 0.02)
    }
    ll <- sum(log(w * dnorm(x, mu[1], s[1]) + (1 - w) * dnorm(x, mu[2], s[2])))
    if (is.null(best) || ll > best$ll) best <- list(ll = ll, mu = mu, s = s, w = w)
  }
  best
}
D50c <- Dw$D[Dw$topo > 0 & Dw$P == 0.5]; D0c <- Dw$D[Dw$topo > 0 & Dw$P == 0]
if (mean(D50c) > mean(D0c)) {
  ll1 <- sum(dnorm(D50c, mean(D50c), sqrt(mean((D50c - mean(D50c))^2)), log = TRUE))
  m2c <- mix2(D50c); n <- length(D50c)
  bic1 <- -2 * ll1 + 2 * log(n); bic2 <- -2 * m2c$ll + 5 * log(n)
  say(sprintf("S1 mean drift index, connected panels: 0%% block %s, 50%% block %s", fmt(mean(D0c), 2), fmt(mean(D50c), 2)))
  verdict <- if (bic2 - bic1 > 2 && mean(D50c) > mean(D0c)) "SUPPORTED (one component, coexistence)" else
             if (bic1 - bic2 > 2 && min(m2c$mu) < 0 && max(m2c$mu) > 0) "CONTRADICTED (two components either side of zero)" else "inconclusive"
  say(sprintf("S1 BIC one component %s, two components %s (means %s, %s) -> %s", fmt(bic1, 1), fmt(bic2, 1),
              fmt(m2c$mu[1], 2), fmt(m2c$mu[2], 2), verdict))
} else say("S1 not carried out: mean drift in the connected 50% block does not exceed the 0% block.")
# S2: confidence among those who placed the proposals in the pushed order (order test 3)
pp <- per[per$t3_pushed %in% 1, ]
if (sum(pp$topology == "high") >= 2 && sum(pp$topology == "low") >= 2) {
  s2t <- t.test(t3_conf ~ factor(topology, levels = c("high", "low")), data = pp)
  say(sprintf("S2 confidence, pushed order at order test 3 (n = %d): connected %s vs independent %s, difference 95%% CI %s to %s",
              nrow(pp), fmt(s2t$estimate[1], 2), fmt(s2t$estimate[2], 2), fmt(s2t$conf.int[1], 2), fmt(s2t$conf.int[2], 2)))
} else say("S2 not estimable: fewer than two participants per panel type placed the proposals in the pushed order (n = ", nrow(pp), ").")
# S3: persistence after disclosure
s3d <- data.frame(y = per$t4_pushed, topo = ifelse(per$topology == "high", .5, -.5),
                  direc = ifelse(per$direction == "seq1to2", .5, -.5), pda = per$pda - mean(per$pda, na.rm = TRUE))
n_ev <- sum(s3d$y, na.rm = TRUE)
if (n_ev == 0) say("S3 not estimable: no participant placed the proposals in the pushed order after disclosure.") else {
  if (n_ev < 10 && requireNamespace("logistf", quietly = TRUE)) {
    f3 <- logistf::logistf(y ~ topo + direc + pda, data = s3d)
    or <- exp(c(coef(f3)["topo"], f3$ci.lower["topo"], f3$ci.upper["topo"])); meth <- "Firth"
  } else {
    f3 <- glm(y ~ topo + direc + pda, data = s3d, family = binomial)
    ci <- confint.default(f3)["topo", ]; or <- exp(c(coef(f3)["topo"], ci)); meth <- if (n_ev < 10) "ML (logistf not installed)" else "ML"
  }
  say(sprintf("S3 pushed order after disclosure: %d of %d; odds ratio for connected panels %s, 95%% CI %s to %s (%s)",
              n_ev, sum(!is.na(s3d$y)), fmt(or[1], 2), fmt(or[2], 2), fmt(or[3], 2), meth))
}
# S4: mediation of the 0% -> 100% change in drift by perceived connectedness
dd <- merge(Dw[Dw$P == 1, c("pid", "D")], Dw[Dw$P == 0, c("pid", "D")], by = "pid", suffixes = c(".100", ".0"))
dd$change <- dd$D.100 - dd$D.0
dd <- merge(dd, per[, c("pid", "topology", "connectedness")], by = "pid")
dd$topo <- ifelse(dd$topology == "high", 1, 0)
ind <- function(x) { a <- coef(lm(connectedness ~ topo, x))["topo"]; bb <- coef(lm(change ~ connectedness + topo, x))["connectedness"]; a * bb }
boots <- replicate(N_BOOT, ind(dd[sample(nrow(dd), replace = TRUE), ]))
say(sprintf("S4 indirect effect via perceived connectedness: %s, bootstrap 95%% CI %s to %s (%d resamples)",
            fmt(ind(dd)), fmt(quantile(boots, .025)), fmt(quantile(boots, .975)), N_BOOT))

# ---- 9. Exploratory (labelled as such) -------------------------------------------
head_("8. EXPLORATORY")
rt <- num(pan$rt); ok <- !is.na(rt)
say("Median RT (ms) by panel structure x dissent, panel blocks:")
print(round(tapply(rt[ok], list(ifelse(pan$topo[ok] > 0, "connected", "independent"), pan$P[ok]), median)))

# ---- 10. Summary -----------------------------------------------------------------
head_("9. SUMMARY")
summ <- data.frame(
  test = c("H1 crit:P:topo", "H2 crit:topo", "E1 P:direc (drift index)", "H1 equivalence topo:P (drift index)"),
  estimate = c(as.numeric(results$H1[["estimate"]]), as.numeric(results$H2[["estimate"]]), e1[["est"]], h1eq[["est"]]),
  lower = c(as.numeric(results$H1[["lo"]]), as.numeric(results$H2[["lo"]]), e1[["lo"]], h1eq[["lo"]]),
  upper = c(as.numeric(results$H1[["hi"]]), as.numeric(results$H2[["hi"]]), e1[["hi"]], h1eq[["hi"]]),
  p = c(as.numeric(results$H1[["p"]]), as.numeric(results$H2[["p"]]), NA, NA),
  random_effects = c(h1$re, h2$re, "(1 + P | pid)", "(1 + P | pid)"))
print(summ, row.names = FALSE, digits = 3)
write.csv(summ, file.path(OUT, "confirmatory_summary.csv"), row.names = FALSE)
say("\nChecks: ", paste(names(results$checks), ifelse(results$checks, "pass", "FAIL"), collapse = "  "))
sink()
