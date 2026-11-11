# =============================================================================
# power_h2.R -- power for H2: drift in the panel-free judgement block, after the
# three pressure blocks, compared between panel types (between subjects).
#
# Generative model: participant baseline D0 ~ N(-0.70, 0.22); a residual drift
# that survives into the panel-free block of 0.06 index points after
# independent panels and 0.06 + delta after connected panels, with
# between-participant SD 0.10 in that residual; response bias b ~ N(0, 0.4) on
# the logit scale. `reps` judgements per critical probe.
#
# Registered analysis: logistic GLMM on the two critical probes,
#   cbind(k, n - k) ~ crit * topo + crit * direc + crit * pda + crit * lastP
#                     + (1 + crit | pid)
# likelihood-ratio test of crit:topo; hit = p < .05 and estimate > 0.
# =============================================================================
suppressPackageStartupMessages({library(lme4); library(parallel)})
args <- commandArgs(trailingOnly = TRUE)
NSIM <- as.integer(ifelse(length(args) >= 1, args[1], 400))
SEED <- 20261111
NPC  <- as.integer(ifelse(length(args) >= 2, args[2], 30))

sim <- function(delta, reps, npc = NPC) {
  rows <- list(); r <- 0; id <- 0
  for (tt in c(-.5, .5)) for (dd in c(-.5, .5)) for (i in 1:npc) {
    id <- id + 1
    u0 <- rnorm(1, 0, .22); ur <- rnorm(1, 0, .10); b <- rnorm(1, 0, .4)
    lastP <- c(0, .5, 1)[((i - 1) %% 3) + 1]
    D  <- -.70 + u0 + .06 + ur + (if (tt > 0) delta else 0)
    p3 <- min(.98, max(.02, .5 + D / 2)); p5 <- min(.98, max(.02, .5 - D / 2))
    for (pr in c(3, 5)) {
      r <- r + 1
      rows[[r]] <- data.frame(pid = id, topo = tt, direc = dd, pda = sample(3:7, 1) - 5,
                              lastP = lastP - .5, crit = ifelse(pr == 3, .5, -.5),
                              k = rbinom(1, reps, plogis(qlogis(if (pr == 3) p3 else p5) + b)),
                              n = reps)
    }
  }
  do.call(rbind, rows)
}

one <- function(s, delta, reps) {
  set.seed(SEED + s * 104729 + round(delta * 1000) + reps)
  d <- sim(delta, reps)
  f <- function(fx) tryCatch(suppressWarnings(suppressMessages(
         glmer(fx, data = d, family = binomial,
               control = glmerControl(optimizer = "bobyqa", calc.derivs = FALSE)))),
         error = function(e) NULL)
  full <- f(cbind(k, n - k) ~ crit * topo + crit * direc + crit * pda + crit * lastP + (1 + crit | pid))
  if (is.null(full)) return(NA)
  red <- update(full, . ~ . - crit:topo)
  as.numeric(anova(red, full)$`Pr(>Chisq)`[2] < .05 && fixef(full)["crit:topo"] > 0)
}

grid <- expand.grid(delta = c(.15), reps = c(8, 12))
res <- lapply(seq_len(nrow(grid)), function(g) {
  h <- unlist(mclapply(1:NSIM, one, delta = grid$delta[g], reps = grid$reps[g], mc.cores = 2))
  out <- data.frame(grid[g, ], power_H2 = mean(h, na.rm = TRUE), nsim = NSIM)
  print(out); flush.console(); out
})
write.csv(transform(do.call(rbind, res), N = 4 * NPC), sprintf("power_h2_N%d.csv", 4 * NPC), row.names = FALSE)
