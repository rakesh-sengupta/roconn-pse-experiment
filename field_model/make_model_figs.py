"""Figure: model outcome for each RR cell across the own-memory drive W_mem."""
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Patch

R = json.load(open('rr_cells.json'))
SURF, INK, INK2, GRID = '#fcfcfb', '#0b0b0b', '#52514e', '#e4e3df'
COL = {'held': '#2a78d6', 'moved': '#eb6834', 'both': '#1baf7a', 'none': '#d9d8d4'}
LET = {'held': 'H', 'moved': 'M', 'both': 'B', 'none': '·'}
ROWS = [('high', 0), ('high', 50), ('high', 100), ('low', 0), ('low', 50), ('low', 100)]
RR_PRED = {('high', 0): 'held', ('high', 50): 'moved', ('high', 100): 'moved',
           ('low', 0): 'held', ('low', 50): 'held', ('low', 100): 'held'}
WM = sorted({r['W_mem'] for r in R})
PANELS = [('reanchored', 'A'), ('reanchored', 'B'), ('published', 'A'), ('published', 'B')]
TTL = {'reanchored': 'Saturation as used in RR Table 1',
       'published': 'Saturation as printed (W_max 3.0, W_scale 2.5)'}
GEO = {'A': 'read ordering at 35, pushed at 20', 'B': 'read ordering at 20, pushed at 35'}

plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 8.5,
                     'text.color': INK, 'axes.labelcolor': INK2,
                     'xtick.color': INK2, 'ytick.color': INK2})
import sys
MODE = sys.argv[1] if len(sys.argv) > 1 else 'full'
STRIP = MODE == 'full'
if MODE == 'compact':
    PANELS = [('reanchored', 'A'), ('published', 'A')]
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 3.6), facecolor=SURF)
    TTL = {'reanchored': 'Effective weights as reported (1.5, 0.8)',
           'published': 'Parameters as printed (W_max 3.0, W_scale 2.5)'}
else:
    fig, axes = plt.subplots(2, 2, figsize=(12.5, 6.6), facecolor=SURF)
for ax, (tr, g) in zip(axes.ravel(), PANELS):
    ax.set_facecolor(SURF)
    sub = {(r['topology'], r['pressure'], r['W_mem']): r['state']
           for r in R if r['transform'] == tr and r['geometry'] == g}
    for yi, cell in enumerate(ROWS):
        y = len(ROWS) - 1 - yi
        if STRIP:
            s = RR_PRED[cell]          # left strip: the earlier Table 1 prediction
            ax.add_patch(Rectangle((-2.6, y + 0.06), 1.8, 0.88, fc=COL[s], ec=SURF, lw=2))
            ax.text(-1.7, y + 0.5, LET[s], ha='center', va='center', color='white',
                    fontsize=8, weight='bold')
        for xi, w in enumerate(WM):
            s = sub[(cell[0], cell[1], w)]
            ax.add_patch(Rectangle((xi + 0.04, y + 0.06), 0.92, 0.88,
                                   fc=COL[s], ec=SURF, lw=1.5))
            ax.text(xi + 0.5, y + 0.5, LET[s], ha='center', va='center',
                    color=INK if s == 'none' else 'white', fontsize=7, weight='bold')
    ax.set_xlim(-2.8 if STRIP else -0.1, len(WM) + 0.1); ax.set_ylim(-0.1, len(ROWS) + 0.05)
    ax.set_yticks([len(ROWS) - 1 - i + 0.5 for i in range(len(ROWS))])
    ax.set_yticklabels([f"{'Connected' if t == 'high' else 'Independent'}  {p}%"
                        for t, p in ROWS])
    ticks = [i for i, w in enumerate(WM) if abs(w * 10 % 5) < 1e-6]
    ax.set_xticks(([-1.7] if STRIP else []) + [i + 0.5 for i in ticks])
    ax.set_xticklabels((['Earlier\nprediction'] if STRIP else []) + [f'{WM[i]:g}' for i in ticks])
    ax.tick_params(length=0)
    for sp in ax.spines.values():
        sp.set_visible(False)
    ax.axhline(3, color=INK2, lw=0.8, xmin=0.0, xmax=1.0)
    ax.set_title(TTL[tr] if MODE == 'compact' else f'{TTL[tr]}\nGeometry {g}: {GEO[g]}',
                 fontsize=9, color=INK, loc='left', pad=6)
    ax.set_xlabel("Participant's own-memory drive, W_mem")

fig.legend(handles=[Patch(fc=COL[k], label=f'{LET[k]}  {lab}') for k, lab in
                    [('held', 'held: only the read ordering is active'),
                     ('both', 'both orderings active (no winner)'),
                     ('moved', 'moved: only the pushed ordering is active'),
                     ('none', 'none: memory lost')]],
           loc='lower center', ncol=4, frameon=False, fontsize=8.5,
           bbox_to_anchor=(0.5, -0.005))
if MODE == 'compact':
    plt.tight_layout(rect=(0, 0.09, 1, 1))
    plt.savefig('fig3_model.pdf', facecolor=SURF); plt.savefig('fig3_model.png', dpi=180, facecolor=SURF)
else:
    plt.tight_layout(rect=(0, 0.05, 1, 1))
    plt.savefig('figA1_model_full.pdf', facecolor=SURF); plt.savefig('figA1_model_full.png', dpi=180, facecolor=SURF)
print('saved')
