"""
run_rr_cells.py -- the six panel configurations of the Stage 1 RR, run through
the published field model (roconn_field.py).

Each Topology x Pressure cell gets two drives from Eq. 3: one toward the
ordering the participant read (confirming reviewers) and one toward the pushed
ordering (dissenting reviewers). Both act in Phase 2, as in the paper's
competing-drives protocol.

The paper's field holds no memory without input (a lone packet needs ~0.36 of
ongoing drive to survive), and in the paper the "own" drive is always social.
A participant's own encoded memory therefore has to be added as an extra,
constant drive at the read position, W_mem. The paper gives no value for it,
so it is swept from 0 (the protocol exactly as published) to 2.

Outcome is classified from the final field, not from the centre of mass:
  held  : only the read ordering is active      (f > 0.5 within +/-2 units)
  moved : only the pushed ordering is active
  both  : both are active (no winner-take-all)
  none  : neither is active (memory lost)

Geometry: positions 20 and 35 are not symmetric in a 50-unit field, so both
assignments are run.  A: read = 35, pushed = 20.  B: read = 20, pushed = 35.
Transforms: 'reanchored' (as RR Table 1) and 'published' (W_max 3, W_scale 2.5).
"""
import json, sys, itertools
from multiprocessing import Pool
import numpy as np
sys.path.insert(0, '.')
from roconn_field import run, f, panel_drives, eff

GEOM = {'A': (35, 20), 'B': (20, 35)}
CELLS = [(t, p) for t in ('high', 'low') for p in (0, 50, 100)]
WMEM = [round(v, 2) for v in np.arange(0.0, 2.01, 0.1)]
TRANSFORMS = ('reanchored', 'published')


def classify(own, alt, x):
    fx = f(x)
    a_own = fx[own - 2: own + 3].max() > 0.5
    a_alt = fx[alt - 2: alt + 3].max() > 0.5
    return {(True, False): 'held', (False, True): 'moved',
            (True, True): 'both', (False, False): 'none'}[(a_own, a_alt)]


def one(args):
    transform, g, topo, pres, wmem = args
    own, alt = GEOM[g]
    Wc_raw, Wa_raw = panel_drives(topo, pres)
    Wc, Wa = float(eff(Wc_raw, transform)), float(eff(Wa_raw, transform))
    c1, c2, x = run(own, alt, wmem + Wc, Wa, return_x=True)
    fx = f(x)
    return dict(transform=transform, geometry=g, topology=topo, pressure=pres,
                W_mem=wmem, W_confirm=round(Wc, 3), W_dissent=round(Wa, 3),
                state=classify(own, alt, x),
                f_read=round(float(fx[own - 2: own + 3].max()), 3),
                f_pushed=round(float(fx[alt - 2: alt + 3].max()), 3),
                com=round(c2, 2))


if __name__ == '__main__':
    jobs = list(itertools.product(TRANSFORMS, GEOM, ('high', 'low'), (0, 50, 100), WMEM))
    with Pool(2) as pool:
        res = pool.map(one, jobs, chunksize=8)
    json.dump(res, open('rr_cells.json', 'w'), indent=1)
    print(len(res), 'runs written to rr_cells.json')
