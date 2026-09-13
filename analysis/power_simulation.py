# Power simulation for the pre-registered primary DV (drift index D = p3 - p5).
# Seed 20260911. 200 simulations per effect size, N = 120 (30 per cell).
# Result: 0.10 -> 66%, 0.15 -> 93%, 0.20 -> 99%.
# Re-run in R with simr against the final lme4 specification before posting.
import numpy as np, pandas as pd, warnings
warnings.filterwarnings("ignore")
import statsmodels.formula.api as smf

rng_master = np.random.default_rng(20260911)

def simulate(n_per_cell, delta_slope, seed):
    """delta_slope = High-C minus Low-C drift in D over the full 0->100% range."""
    rng = np.random.default_rng(seed)
    rows = []
    base_slope_low = 0.12          # Low-C drift over full pressure range
    D0_mean, D0_sd  = -0.70, 0.22  # baseline drift index and between-subject SD
    slope_sd        = 0.12         # between-subject SD of the pressure slope
    n_crit_trials   = 13           # trials per critical probe per block
    pid = 0
    orders = [[0,.5,1],[0,1,.5],[.5,0,1],[.5,1,0],[1,0,.5],[1,.5,0]]
    for topo in (-0.5, 0.5):          # -0.5 = Low-C, +0.5 = High-C
        for direc in (-0.5, 0.5):
            for i in range(n_per_cell):
                pid += 1
                u0 = rng.normal(0, D0_sd)
                u1 = rng.normal(0, slope_sd)
                slope = base_slope_low + (topo + 0.5) * delta_slope + u1
                order = orders[i % 6]
                pda = rng.integers(3, 8)          # post-distractor accuracy 3-7
                for b, P in enumerate(order):
                    Dtrue = D0_mean + u0 + slope * P
                    # D = p3 - p5 ; recover implied p3,p5 symmetric about 0.5
                    p3 = np.clip(0.5 + Dtrue/2, 0.02, 0.98)
                    p5 = np.clip(0.5 - Dtrue/2, 0.02, 0.98)
                    k3 = rng.binomial(n_crit_trials, p3)
                    k5 = rng.binomial(n_crit_trials, p5)
                    Dobs = k3/n_crit_trials - k5/n_crit_trials
                    rows.append(dict(pid=pid, topo=topo, direc=direc, P=P,
                                     block_order=b+1, pda=pda, D=Dobs))
    return pd.DataFrame(rows)

def run(n_per_cell, delta_slope, nsim=500):
    hits = 0; ok = 0
    for s in range(nsim):
        df = simulate(n_per_cell, delta_slope, int(rng_master.integers(1e9)))
        try:
            m = smf.mixedlm("D ~ topo*P + direc*P + topo:direc + block_order + pda",
                            df, groups=df["pid"], re_formula="~P").fit(reml=False)
            ok += 1
            p = m.pvalues.get("topo:P", np.nan)
            est = m.params.get("topo:P", np.nan)
            if p < 0.05 and est > 0:
                hits += 1
        except Exception:
            pass
    return hits/max(ok,1), ok

for d in (0.10, 0.15, 0.20):
    for npc in (30,):
        pw, ok = run(npc, d, nsim=200)
        print(f"delta(High-C - Low-C) over full pressure range = {d:.2f} | n/cell={npc} (N={4*npc}) | power = {pw:.3f}  (converged {ok}/200)")
