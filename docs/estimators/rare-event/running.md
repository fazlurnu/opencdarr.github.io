# Running a simulation

This page runs the estimator end to end. It builds on the [theory](index.md); for the evidence it is correct, see [validation](validation.md).

!!! tip "A runnable version"
    Every cell below is from [`examples/handbook/rare_event_ips.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/rare_event_ips.ipynb), a quick trial that runs top to bottom in about two minutes after `pip install -e ".[examples]"` (the `examples` extra adds `joblib` for the parallel replications).

## What you supply

The estimator is scenario-agnostic. It needs exactly two things:

- a **factory** that builds one particle — its rules (`env`) plus its initial world (`state`) — from a random seed, and
- the **shell ladder** — a decreasing sequence of running-minimum separations ending at `rpz`.

Everything else rides the fleet interface. The scenario here is one fixed 90° crossing of two multirotors on a dead-on collision course, each with a GNSS self-fix error — the separation manager (`StateBased` + `MVP` + `PastCPA`) clears them to just outside the 50 m protected zone almost every time, and loss of separation is the thin tail where the navigation noise makes an aircraft under-clear.

```python
import time
from joblib import Parallel, delayed

from opencdarr.ips import Particle, ips_once, replication_seeds, combine_replications
from opencdarr.fleet import Agent, build_env
from opencdarr.performance import M600
from opencdarr.scenario import create_conflict
from opencdarr.state import AircraftState
from opencdarr.cd import StateBased
from opencdarr.cr import MVP
from opencdarr.crr import PastCPA
from opencdarr.cns.navigation import GnssNavigation

def build_initial(seq):
    """Sample one IPS particle: a fixed 90° crossing with GNSS noise, and its rules."""
    own = AircraftState(id="OWN", lat=52.0, lon=4.0, trk=0.0, gs=10.2889,
                        pos_ci95=3.0, vel_ci95=1.0)          # 3 m / 1 m/s self-fix error
    intr = create_conflict(own, intr_id="INT", dpsi=90.0, dcpa=0.0,
                           tlos=70.0, rpz=50.0, side=1)       # 90°, dead-on, LoS 70 s out
    agents = [Agent(own, M600), Agent(intr, M600)]
    env = build_env(agents, rpz=50.0, t_lookahead=60.0, dt=0.5,
                    detector=StateBased(), resolver=MVP(margin=1.05),
                    recovery=PastCPA(bouncing_guard=True), navigation=GnssNavigation(),
                    done_timeout=10.0)
    return Particle(env=env, state=env.initial_state(agents))

# a decreasing ladder of running-min shells, ending at rpz = 50 m
LEVELS = [150, 135, 122, 112, 104, 97, 90, 82, 74, 68, 63, 59, 56, 54, 52, 51, 50]
```

## Run it — replications in parallel

One IPS run (`ips_once`) evolves the $N$ particles shell by shell and returns $\hat P = \prod_k (S_k/N)$. Because a single run's particles interact, the confidence interval must come from **independent replications** on separate seed subtrees — which also parallelise perfectly, one per core.

```python
N_PARTICLES = 2000    # per shell (production uses ~10000 — see below)
REPS = 8              # independent replications -> the confidence interval

results = Parallel(n_jobs=-1)(
    delayed(ips_once)(build_initial, LEVELS, N_PARTICLES, seed)
    for seed in replication_seeds(20260728, REPS)
)
est = combine_replications(results)

print(f"P(LoS) = {est.prob:.2e}   95% CI [{est.ci[0]:.2e}, {est.ci[1]:.2e}]")
print(f"collapsed replications: {est.n_collapsed}/{REPS}")
```

```
P(LoS) = 4.17e-05   95% CI [1.78e-05, 6.15e-05]
collapsed replications: 0/8
```

## Reading the result

Three things to look at, in order:

- **`P ± CI`, never a bare probability.** The interval is the honest output; a point estimate for a number this small, on its own, is not to be trusted.
- **`collapsed` must be 0.** A replication collapses when a shell ends with zero survivors, and returns $\hat P = 0$. A nonzero count means the ladder is too aggressive or `N_PARTICLES` too small; add particles or re-space shells. Treat a collapsed run as failed rather than as data — but note that *discarding* the zeros is what would bias the mean, upward, since the product estimator is unbiased only when they are counted. A collapse is a signal to re-tune the ladder and re-run, not a number to drop from an otherwise good batch.
- **The per-shell survival fractions** are the diagnostic behind the estimate — each should sit roughly in 10–50%. A shell near 0 is about to collapse; one near 1.0 is a wasted shell.

```python
good = [r for r in est.reps if r.collapsed_at is None]
levels = good[0].levels
mean_surv = [sum(r.survival[k] for r in good) / len(good) for k in range(len(levels))]
for d, s in zip(levels, mean_surv):
    print(f"  {d:5.0f} m :  survival {s:.2f}")
```

## Scaling up

This trial is deliberately quick — `dt = 0.5 s`, 2000 particles, 8 replications — so the CI is loose and the point estimate carries some discretisation bias. To turn it into a production estimate:

- **`dt = 0.2 s`** — a finer step reduces shell overshoot (a particle jumping past a shell between ticks).
- **more particles** (~10000) — headroom against collapse in the deep tail.
- **more replications** — a tighter CI, and they fill more cores.

Those are exactly the settings behind the [validation](validation.md) sweep. Nothing else in the code changes.
