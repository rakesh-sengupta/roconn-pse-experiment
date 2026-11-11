"""
roconn_field.py -- re-implementation of the ROCONN neural field model of
Lazarus, Gundapaneni & Sengupta (2026), "The Asymmetric Pull of Falsehood",
FACEIT 2026, LAIS 63, pp. 200-209, doi:10.1007/978-3-032-29501-9_20.

Everything below is taken from the published equations and parameter values:

  Eq. 1   tau dx_i/dt = -A x_i + (B - x_i) f(x_i)
                        - (x_i + C) sum_{j != i} w_ij f(x_j) + S_i(t)
          A = 1, B = 1, C = 0.5, tau = 10 ms
          f(x) = 1 / (1 + exp(-gamma (x - theta))),  gamma = 10, theta = 0.2
          RK4, dt = 0.1 ms, N = 50 units, positions indexed 0..49
  Eq. 2   w_ij = w0 exp(-(i - j)^2 / (2 sigma^2)), w0 = 2, sigma = 10, w_ii = 0
  Eq. 3   W_u = alpha * sum_v a_uv s_v + beta * sum_{v,w} a_uv a_vw a_wu s_v s_w
          (alpha = 0.2, beta = 0.5 are implied by the worked example, Eqs. 4-5)
  Eq. 6   S_i = W_1 G(i; mu_1, delta) + W_2 G(i; mu_2, delta), delta = 3
  Protocol: Phase 1 (0-500 ms) encoding drive W_enc = 5 at the source position;
            Phase 2 both drives on; outcome = packet centre of mass (CoM)
            relative to the midpoint of the two positions (20 and 35 -> 27.5).

Choices the paper does not pin down, made explicit here:
  * positions are indexed 0..49 (Python arrays). With 1..50 indexing the
    published numbers are NOT reproduced; with 0..49 they are exactly
    (Sim 1 CoM 21.2 -> 24.0, Sim 2 32.7 -> 24.0, W*_ind = 0.808 as in the
    Fig. 3 caption, W*_corr = 1.950). The text's 0.825 and 1.975 are the
    midpoints of the 0.05-wide sweep steps that contain these values;
  * initial state x = 0;
  * CoM weights = f(x) (activation); the alternative max(x, 0) is a flag;
  * Phase 2 length: the paper says "~1000 steps" (= 100 ms) but also speaks of
    equilibrium. Default here is 1000 ms; run_sensitivity() checks 100-3000 ms.
"""
import numpy as np

P = dict(A=1.0, B=1.0, C=0.5, tau=10.0, gamma=10.0, theta=0.2,
         w0=2.0, sigma=10.0, delta=3.0, N=50, dt=0.1,
         W_enc=5.0, t_enc=500.0, t_phase2=1000.0)

POS_FALSE, POS_TRUE = 20, 35          # the paper's two narrative positions


def f(x, p=P):
    return 1.0 / (1.0 + np.exp(-p['gamma'] * (x - p['theta'])))


def kernel(p=P):
    i = np.arange(p['N'])
    d = i[:, None] - i[None, :]
    w = p['w0'] * np.exp(-d ** 2 / (2 * p['sigma'] ** 2))
    np.fill_diagonal(w, 0.0)
    return w


def gauss(mu, p=P):
    i = np.arange(p['N'])
    return np.exp(-(i - mu) ** 2 / (2 * p['delta'] ** 2))


def com(x, p=P, weights='f'):
    i = np.arange(p['N'])
    a = f(x, p) if weights == 'f' else np.maximum(x, 0)
    return float((i * a).sum() / a.sum())


def integrate(x, S, T, w, p=P):
    """RK4 for T ms with constant input vector S."""
    A, B, C, tau, dt = p['A'], p['B'], p['C'], p['tau'], p['dt']

    def rhs(x):
        fx = f(x, p)
        return (-A * x + (B - x) * fx - (x + C) * (w @ fx) + S) / tau

    for _ in range(int(round(T / dt))):
        k1 = rhs(x)
        k2 = rhs(x + 0.5 * dt * k1)
        k3 = rhs(x + 0.5 * dt * k2)
        k4 = rhs(x + dt * k3)
        x = x + dt / 6.0 * (k1 + 2 * k2 + 2 * k3 + k4)
    return x


def run(own, alt, W_own, W_alt, p=P, weights='f', return_x=False):
    """Encode at `own`, then Phase 2 with W_own at own and W_alt at alt.
    Returns CoM after Phase 1 and after Phase 2."""
    w = kernel(p)
    x = np.zeros(p['N'])
    x = integrate(x, p['W_enc'] * gauss(own, p), p['t_enc'], w, p)
    c1 = com(x, p, weights)
    S2 = W_own * gauss(own, p) + W_alt * gauss(alt, p)
    x = integrate(x, S2, p['t_phase2'], w, p)
    c2 = com(x, p, weights)
    return (c1, c2, x) if return_x else (c1, c2)


def crossed(own, alt, c):
    mid = 0.5 * (own + alt)
    return (c - mid) * np.sign(alt - own) > 0


def threshold(own, alt, W_own, p=P, lo=0.0, hi=6.0, tol=1e-3, weights='f'):
    """Smallest W_alt that carries the packet past the midpoint, by bisection.
    Returns np.inf if even `hi` does not."""
    if not crossed(own, alt, run(own, alt, W_own, hi, p, weights)[1]):
        return np.inf
    if crossed(own, alt, run(own, alt, W_own, lo, p, weights)[1]):
        return lo
    while hi - lo > tol:
        mid = 0.5 * (lo + hi)
        if crossed(own, alt, run(own, alt, W_own, mid, p, weights)[1]):
            hi = mid
        else:
            lo = mid
    return 0.5 * (lo + hi)


# ---- Eq. 3 for a drawn panel --------------------------------------------------
ALPHA, BETA = 0.2, 0.5

# High-C panel as drawn in js/panels.js (0-indexed positions 0..5):
# triad 0-1, 0-2, 1-2 plus bridges 0-5, 2-3, 3-4, 4-5. Low-C: no edges.
HIGH_C_EDGES = {(0, 1), (0, 2), (1, 2), (0, 5), (2, 3), (3, 4), (4, 5)}


def eq3_weight(broadcasters, edges):
    """All six reviewers are treated as the participant's neighbours.
    Second term counts ORDERED pairs (v, w) of connected broadcasters, which is
    what reproduces the paper's beta*K*(K-1)*C and the RR's Table 1."""
    b = set(broadcasters)
    k = len(b)
    pairs = sum(2 for (u, v) in edges if u in b and v in b)
    return ALPHA * k + BETA * pairs


def panel_drives(topology, pressure):
    edges = HIGH_C_EDGES if topology == 'high' else set()
    alt = {0: [], 50: [0, 1, 2], 100: [0, 1, 2, 3, 4, 5]}[pressure]
    own = [i for i in range(6) if i not in alt]
    return eq3_weight(own, edges), eq3_weight(alt, edges)


TRANSFORMS = {
    # Re-anchored so that 1.7 -> 0.8 and 4.7 -> 1.5 (what RR Table 1 uses)
    'reanchored': (1.68225876, 3.28680625),
    # As printed in the paper: W_max = 3.0, W_scale = 2.5
    'published': (3.0, 2.5),
}


def eff(W, transform):
    if transform == 'raw':
        return W
    wmax, wsc = TRANSFORMS[transform]
    return wmax * np.tanh(W / wsc)


def outcome(own, alt, x, p=P, alive=0.5):
    """Classify a final state by its peak, not its centre of mass.
    'held'  : a packet survives, nearer the read ordering
    'moved' : a packet survives, nearer the pushed ordering
    'none'  : no packet survives (peak activation below `alive`)"""
    fx = f(x, p)
    if fx.max() < alive:
        return 'none'
    k = int(fx.argmax())
    return 'moved' if abs(k - alt) < abs(k - own) else 'held'


def threshold_peak(own, alt, W_own, p=P, lo=0.0, hi=6.0, tol=1e-3):
    """As threshold(), but a flip means the surviving peak is at the pushed
    position (outcome == 'moved'), not that the CoM passed the midpoint."""
    def moved(Wa):
        x = run(own, alt, W_own, Wa, p, return_x=True)[2]
        return outcome(own, alt, x, p) == 'moved'
    if not moved(hi):
        return np.inf
    if moved(lo):
        return lo
    while hi - lo > tol:
        m = 0.5 * (lo + hi)
        if moved(m): hi = m
        else: lo = m
    return 0.5 * (lo + hi)
