# =============================================================================
# power_h1_n.R -- (sample-size version of power_h1.R) power for the primary (H1) and equivalence (E1, E2) tests of the
# revised Stage 1 Registered Report.
#
# Generative model (probability scale, as in the original protocol):
#   participant baseline drift index D0 ~ N(-0.70, 0.22)
#   pressure slope: independent panel 0.12 over the full range (+ N(0, 0.12));
#   connected panel adds `delta` (the effect of interest) in one of two shapes:
#     linear     : delta * P
#     saturating : delta * min(1, 2P)  -- full effect already at 50%
#   p3 = 0.5 + D/2, p5 = 0.5 - D/2, then a participant response bias b ~ N(0, 0.4)
#   is added on the logit scale to both probes (it shifts both, not D).
#   Direction has no effect (the null that E1/E2 should accept).
#
# Analyses, exactly as registered:
#   H1 : trial-level logistic GLMM on the two critical probes, fitted to the
#        equivalent binomial counts (no trial-level covariates are simulated);
#        likelihood-ratio test of crit:pressure:topology; hit = p < .05 and
#        estimate > 0. Random effects (1 + crit + crit:pressure | pid) with the
#        registered fallback sequence if the fit is singular. Power runs use
#        nAGQ = 0 for speed; the registered analysis uses the Laplace fit.
#   E1, E2 : drift-index LMM; equivalence by TOST, i.e. the 90% CI of the
#        Direction x Pressure (E1) or Topology x Direction (E2) coefficient lies
#        inside +/- 0.15.
# =============================================================================
suppressPackageStartupMessages({library(lme4); library(parallel)})
args  <- commandArgs(trailingOnly = TRUE)
NSIM  <- as.integer(ifelse(length(args) >= 1, args[1], 200))
SEED  <- 20261113
NPC   <- as.integer(ifelse(length(args) >= 2, args[2], 30))
ORD <- list(c(0,.5,1), c(0,1,.5), c(.5,0,1), c(.5,1,0), c(1,0,.5), c(1,.5,0))

sim_data <- function(delta, reps, shape, npc = NPC) {
  rows <- vector("list", npc * 4 * 3 * 2); r <- 0; id <- 0
  for (tt in c(-.5, .5)) for (dd in c(-.5, .5)) for (i in 1:npc) {
    id <- id + 1
    u0 <- rnorm(1, 0, .22); u1 <- rnorm(1, 0, .12); b <- rnorm(1, 0, .4)
    ord <- ORD[[((i - 1) %% 6) + 1]]; pda <- sample(3:7, 1)
    for (blk in 1:3) {
      P <- ord[blk]
      extra <- if (tt > 0) delta * (if (shape == "linear") P else min(1, 2 * P)) else 0
      D  <- -.70 + u0 + (.12 + u1) * P + extra
      p3 <- min(.98, max(.02, .5 + D / 2)); p5 <- min(.98, max(.02, .5 - D / 2))
      for (pr in c(3, 5)) {
        p <- plogis(qlogis(if (pr == 3) p3 else p5) + b)
        r <- r + 1
        rows[[r]] <- data.frame(pid = id, topo = tt, direc = dd, P = P, bo = blk,
                                pda = pda - 5, crit = ifelse(pr == 3, .5, -.5),
                                k = rbinom(1, reps, p), n = reps)
      }
    }
  }
  do.call(rbind, rows)
}

# Registered random-effects structure and fallback sequence: participant bias
# (intercept), memory strength (crit) and individual drift slope (crit:P).
RE <- c("(1 + crit + crit:P | pid)", "(1 + crit | pid)", "(1 | pid)")
FIX <- "cbind(k, n - k) ~ crit * P * topo + crit * P * direc + crit * topo * direc + crit * bo + crit * pda"

fit_glmm <- function(d) {
  for (re in RE) {
    m <- tryCatch(suppressWarnings(suppressMessages(
      glmer(as.formula(paste(FIX, "+", re)), data = d, family = binomial,
            nAGQ = 0,   # power runs only; estimates/SEs within ~3% of Laplace
            control = glmerControl(optimizer = "bobyqa", calc.derivs = FALSE)))),
      error = function(e) NULL)
    if (!is.null(m) && !isSingular(m)) return(list(m = m, re = re))
  }
  list(m = m, re = "singular")
}

one <- function(s, delta, reps, shape) {
  set.seed(SEED + s * 7919 + round(delta * 1000) + reps * 13 + (shape == "saturating"))
  d <- sim_data(delta, reps, shape)
  f <- fit_glmm(d)
  if (is.null(f$m)) return(c(h1 = NA, e1 = NA, e2 = NA, re = NA))
  red <- update(f$m, . ~ . - crit:P:topo)
  lr  <- anova(red, f$m)
  est <- fixef(f$m)["crit:P:topo"]
  h1  <- as.numeric(lr$`Pr(>Chisq)`[2] < .05 && est > 0)
  # drift-index LMM for the equivalence tests
  w <- reshape(transform(d, prop = k / n)[, c("pid","topo","direc","P","bo","pda","crit","prop")],
               idvar = c("pid","topo","direc","P","bo","pda"), timevar = "crit",
               direction = "wide")
  w$D <- w$prop.0.5 - w$`prop.-0.5`
  lm1 <- tryCatch(suppressMessages(lmer(D ~ topo * P + direc * P + topo * direc + bo + pda +
                                       (1 + P | pid), data = w, REML = FALSE,
                                       control = lmerControl(optimizer = "bobyqa"))),
                  error = function(e) NULL)
  if (is.null(lm1)) return(c(h1 = h1, e1 = NA, e2 = NA, re = f$re))
  cf <- summary(lm1)$coefficients
  inside <- function(term) {
    ci <- cf[term, "Estimate"] + c(-1, 1) * qnorm(.95) * cf[term, "Std. Error"]
    as.numeric(ci[1] > -.15 && ci[2] < .15)
  }
  c(h1 = h1, e1 = inside("P:direc"), e2 = inside("topo:direc"), re = f$re)
}

grid <- data.frame(delta = .15, reps = as.integer(ifelse(length(args) >= 3, args[3], 13)),
                   shape = "saturating", stringsAsFactors = FALSE)
out <- list()
for (g in seq_len(nrow(grid))) {
  res <- mclapply(1:NSIM, one, delta = grid$delta[g], reps = grid$reps[g],
                  shape = grid$shape[g], mc.cores = 2)
  M <- do.call(rbind, res)
  num <- function(x) mean(as.numeric(x), na.rm = TRUE)
  out[[g]] <- data.frame(grid[g, ], N = 4 * NPC, power_H1 = num(M[, "h1"]),
                         equiv_E1 = num(M[, "e1"]), nsim = NSIM)
  print(out[[g]]); flush.console()
}
write.csv(do.call(rbind, out), sprintf("power_h1_N%d_sat_extra.csv", 4 * NPC), row.names = FALSE)
