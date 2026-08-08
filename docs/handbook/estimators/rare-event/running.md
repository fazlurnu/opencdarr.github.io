# Running a simulation

This page runs the estimator from the start to the end. It uses the [theory](index.md). For the evidence that the estimator is correct, refer to [validation](validation.md).

## What you supply

The estimator does not know the scenario. It needs two items only:

- a **factory** that builds one particle from a random seed — the rules of the particle (`env`) and its initial world (`state`), and
- the **shell ladder** — a sequence of running-minimum separations that decreases and ends at `rpz`.

The fleet interface gives all the other items. The scenario here is one fixed 90° crossing of two multirotors on a collision course. Each aircraft has a GNSS error in its own fix. The separation manager (`StateBased` + `MVP` + `PastCPA`) moves the two aircraft to a position immediately outside the 50 m protected zone almost every time. Loss of separation is the thin tail: it occurs when the navigation noise causes an aircraft to give too small a clearance.

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

One IPS run (`ips_once`) moves the $N$ particles forward, one shell after the other. It returns $\hat P = \prod_k (S_k/N)$. The particles of one run interact, thus one run cannot tell you how much it varies. That is why a run is **replicated** on independent seed subtrees: the replications are independent estimates of the same number, and they are also fully parallel.

`tail=True` is what gives the per-aircraft number: it flies each survivor on past its first breach,
thus the count of aircraft in a loss is measured and not assumed.

```python
N_PARTICLES = 2000    # per shell (production uses ~10000 — see below)
REPS = 8              # independent replications -> the spread between estimates

results = Parallel(n_jobs=-1)(
    delayed(ips_once)(build_initial, LEVELS, N_PARTICLES, seed, tail=True)
    for seed in replication_seeds(20260728, REPS)
)
est = combine_replications(results)

print(f"P(LoS) = {est.p_los:.2e}   per aircraft")
print(f"collapsed replications: {est.n_collapsed}/{REPS}")
```

```
P(LoS) = 4.17e-05   per aircraft
collapsed replications: 0/8
```

## Reading the result

Look at three items, in this sequence:

- **The spread between the replications.** Each replication is an independent estimate of the same number, thus the spread between them is what tells you whether the budget was sufficient. They are on `est.reps`. Two replications an order of magnitude apart mean the ladder or the particle count needs work, whatever the mean says.
- **`collapsed` must be 0.** A replication collapses when a shell ends with zero survivors, and it returns $\hat P = 0$. A count that is more than zero shows that the ladder is too aggressive, or that `N_PARTICLES` is too small. Add particles, or put the shells at different distances. A collapsed run is a failure, and it is not data. But do not *remove* the zero values from a batch. The product estimator is unbiased only when you count them, thus removal of them makes the mean too high. A collapse is an instruction to tune the ladder again and to run the batch again.
- **The survival fractions for each shell** are the diagnostic for the estimate. Each fraction must be between approximately 10% and 50%. A shell near 0 will collapse soon. A shell near 1.0 has no use.

```python
good = [r for r in est.reps if r.collapsed_at is None]
levels = good[0].levels
mean_surv = [sum(r.survival[k] for r in good) / len(good) for k in range(len(levels))]
for d, s in zip(levels, mean_surv):
    print(f"  {d:5.0f} m :  survival {s:.2f}")
```

## Scaling up

This trial is intentionally quick: `dt = 0.5 s`, 2000 particles, and 8 replications. Thus the replications are far apart, and the estimate has some discretisation bias. To make it a production estimate, change three settings:

- **`dt = 0.2 s`** — a smaller step decreases the shell overshoot. Overshoot occurs when a particle moves past a shell between two timesteps.
- **more particles** (approximately 10000) — this gives a margin against collapse in the deep tail.
- **more replications** — this brings the independent estimates closer together, and it also uses more cores.

Those are the settings of the [validation](validation.md) sweep. No other part of the code changes.

!!! code "Run it yourself"
    Each cell on this page comes from [`examples/handbook/rare_event_ips.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/rare_event_ips.ipynb). Run the notebook from the start to the end to reproduce the numbers. It is a quick trial, and it needs approximately two minutes. Install the examples first with `pip install -e ".[examples]"`, because the notebook plots its results with `matplotlib`. `joblib`, for the parallel replications, is already in the core install.

This recipe becomes the [L6 · Rare events](../../../tutorials/l6-rare-events.md) lessons; until those notebooks land, this page is the walkthrough.
