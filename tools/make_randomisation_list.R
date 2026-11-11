# =============================================================================
# make_randomisation_list.R -- the pre-generated randomisation list (RR 2.7).
# Permuted blocks of 24: every block contains each of the 4 cells x 6 block
# orders exactly once, in random order, so balance holds at every multiple of
# 24 sessions. Each row gives the URL used to start that station.
#
# Usage: Rscript tools/make_randomisation_list.R [n_sessions] [seed] [base_url]
#   defaults: 260 sessions (the recruitment ceiling), seed 20261110,
#             base_url index.html
# Record the seed in the registration. Use rows strictly in order.
# =============================================================================
args <- commandArgs(trailingOnly = TRUE)
N    <- if (length(args) >= 1) as.integer(args[1]) else 260
SEED <- if (length(args) >= 2) as.integer(args[2]) else 20261110
BASE <- if (length(args) >= 3) args[3] else "index.html"
set.seed(SEED)
combos <- expand.grid(subgroup = paste0("SG", 1:6), cell = paste0("C", 1:4), stringsAsFactors = FALSE)
blocks <- ceiling(N / nrow(combos))
rows <- do.call(rbind, lapply(seq_len(blocks), function(b)
  cbind(block = b, combos[sample(nrow(combos)), c("cell", "subgroup")])))[seq_len(N), ]
rows$order <- seq_len(N)
rows$pid   <- sprintf("P%04d", rows$order)
rows$url   <- sprintf("%s?cell=%s&sg=%s&pid=%s", BASE, rows$cell, rows$subgroup, rows$pid)
out <- rows[, c("order", "block", "pid", "cell", "subgroup", "url")]
write.csv(out, "randomisation_list.csv", row.names = FALSE)
cat(sprintf("randomisation_list.csv: %d sessions in %d blocks of 24, seed %d\n", N, blocks, SEED))
print(table(out$cell[seq_len(min(N, 24 * floor(N / 24)))], out$subgroup[seq_len(min(N, 24 * floor(N / 24)))]))
