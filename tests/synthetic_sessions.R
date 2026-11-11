# =============================================================================
# synthetic_sessions.R -- builds a synthetic data set with KNOWN effects from
# the 24 template sessions written by make_templates.mjs, so that the analysis
# pipeline can be checked for recovery and for every exclusion rule.
#
# Usage: Rscript tests/synthetic_sessions.R [per_template] [delta_H1] [delta_H2] [out_dir] [bias]
#   per_template  participants generated from each template (default 8 -> N = 192)
#   delta_H1      extra drift over the full range of dissent for connected panels
#   delta_H2      extra drift in the panel-free block after connected panels
#   bias          optional general shift towards "closer to the end" with dissent,
#                 applied to ALL positions on the logit scale (tests check C6)
# Generative model as in the power simulation (RR Appendix B); the order read
# has no effect. Seven malformed sessions are added, one per exclusion rule.
# =============================================================================
args <- commandArgs(trailingOnly = TRUE)
K   <- if (length(args) >= 1) as.integer(args[1]) else 8
DH1 <- if (length(args) >= 2) as.numeric(args[2]) else 0.30
DH2 <- if (length(args) >= 3) as.numeric(args[3]) else 0.20
OUT <- if (length(args) >= 4) args[4] else "tests/pipeline_test/data"
BIAS <- if (length(args) >= 5) as.numeric(args[5]) else 0
TPL <- "tests/pipeline_test/templates"
set.seed(20261111)
unlink(OUT, recursive = TRUE); dir.create(OUT, recursive = TRUE)

num <- function(x) suppressWarnings(as.numeric(x))
write_session <- function(d, pid, cell, sg) {
  d$pid <- pid
  write.csv(d, file.path(OUT, sprintf("roconn_%s_%s_%s.csv", pid, cell, sg)), row.names = FALSE, na = "")
}
draw <- function(p, b) rbinom(length(p), 1, plogis(qlogis(pmin(pmax(p, .02), .98)) + b))

templates <- list.files(TPL, pattern = "\\.csv$", full.names = TRUE)
stopifnot(length(templates) == 24)
k <- 0
for (f in templates) {
  tpl <- read.csv(f, colClasses = "character", na.strings = c("", "NA", "null"))
  cell <- tpl$cell[1]; sg <- tpl$subgroup[1]; connected <- tpl$topology[1] == "high"
  for (r in seq_len(K)) {
    k <- k + 1; d <- tpl; pid <- sprintf("S%03d", k)
    D0 <- rnorm(1, -.70, .22); slope <- .12 + rnorm(1, 0, .12); b <- rnorm(1, 0, .4)
    pda <- sample(5:7, 1, prob = c(.35, .45, .2)); d$post_distractor_accuracy <- pda
    # panel blocks
    i <- which(d$phase == "bisection"); P <- num(d$pressure[i]) / 100; pos <- num(d$probe_pos[i])
    D <- D0 + slope * P + (if (connected) DH1 * P else 0)
    pe <- ifelse(pos == 3, .5 + D / 2, ifelse(pos == 5, .5 - D / 2, c(`2` = .10, `4` = .50, `6` = .90)[as.character(pos)]))
    resp <- draw(pe, b + BIAS * P); miss <- runif(length(i)) < .01; resp[miss] <- NA
    d$response_num[i] <- resp; d$response[i] <- ifelse(is.na(resp), NA, ifelse(resp == 1, "j", "f"))
    d$rt[i] <- ifelse(is.na(resp), NA, round(runif(length(i), 550, 1600)))
    # panel-free block
    j <- which(d$phase == "free_judgement"); posj <- num(d$probe_pos[j])
    Df <- D0 + .06 + rnorm(1, 0, .10) + (if (connected) DH2 else 0)
    pf <- ifelse(posj == 3, .5 + Df / 2, ifelse(posj == 5, .5 - Df / 2, c(`2` = .10, `4` = .50, `6` = .90)[as.character(posj)]))
    rf <- draw(pf, b); d$response_num[j] <- rf; d$response[j] <- ifelse(rf == 1, "j", "f")
    # ratings and written tests
    m <- which(d$phase == "mc_connectedness")
    cc <- if (connected) sample(4:6, 2, TRUE) else sample(0:2, 2, TRUE)
    d$response[m] <- sprintf('{"mc_connected":%d,"mc_known":%d}', cc[1], cc[2])
    last_P <- num(d$pressure[d$phase %in% "bisection" & d$block_order %in% "3"][1])
    e <- which(d$phase == "mc_endorsement")
    d$response[e] <- sprintf('{"mc_endorse_count":"%d"}', max(0, min(6, round(last_P / 100 * 6 + rnorm(1, 0, .7)))))
    p3 <- as.integer(runif(1) < plogis(4 * Df)); p4 <- as.integer(p3 == 1 && runif(1) < .5)
    d$order_test3_pushed <- p3; d$order_test3_confidence <- sample(if (connected) 4:7 else 3:6, 1)
    d$order_test4_pushed <- p4; d$order_test4_confidence <- sample(3:7, 1)
    d$response[d$phase == "fd_q3"] <- '{"fd_q3":"Yes"}'
    d$demo <- "0"; d$assignment <- "url"
    write_session(d, pid, cell, sg)
  }
}
# ---- malformed sessions, one per exclusion rule ----
base <- read.csv(file.path(OUT, sprintf("roconn_S001_%s_%s.csv",
                 read.csv(templates[1], colClasses = "character")$cell[1],
                 read.csv(templates[1], colClasses = "character")$subgroup[1])), colClasses = "character", na.strings = "")
cell <- base$cell[1]; sg <- base$subgroup[1]
x <- base; x$termination_reason <- "encoding_failure"; x <- x[!(x$phase %in% c("bisection", "free_judgement")), ]
write_session(x, "BAD_gate", cell, sg)                                         # rule 3
x <- base; x$withdraw <- "true";                    write_session(x, "BAD_withdrew", cell, sg)   # rule 4
x <- base; x$assignment <- "random";                write_session(x, "BAD_random", cell, sg)     # rule 5
x <- base; x$demo <- "1";                           write_session(x, "BAD_demo", cell, sg)       # rule 5
x <- base[-which(base$phase == "bisection")[1:10], ]; write_session(x, "BAD_short", cell, sg)   # rule 5
x <- base; i <- which(x$phase == "bisection"); x$response_num[i[1:50]] <- NA
write_session(x, "BAD_missing", cell, sg)                                       # rule 6
x <- base; x$response[x$phase == "fd_q3"] <- '{"fd_q3":"No"}'; write_session(x, "BAD_belief", cell, sg)  # rule 7
cat(k, "synthetic participants and 7 malformed sessions written to", OUT, "\n")
