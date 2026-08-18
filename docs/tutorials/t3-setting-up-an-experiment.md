---
authorship: opus-5
---

# T3. Setting up an experiment

Previously, T2 estimated P(LoS) for one pairwise encounter configuration using `estimate_p_los`.

This notebook changes three things. First, the conflict becomes an encounter between six heterogeneous aircraft. Second, we use `run_experiment`: it takes the conditions we write, runs one estimate for each, and hands back one row for each. Third, since we already use `run_experiment`, we can use different kinds of `Config` and `Methods` and compare them within a single code execution.

The world and the CDaRR stack are not written here at all. They come from a configuration file, `configs/ring_t3.yaml`. The question the sweep puts to the two resolvers is whether `MVP` or `VO` ensures the safety of this multi-aircraft encounter as the position accuracy degrades.

## T3.1. Defining your kinematics

`MY_FIXEDWING` and `SimpleFixedWing` come over from T1 as they were.

```python
import math
from dataclasses import replace

from opencdarr import Performance, Kinematics
from opencdarr import AircraftState, MotionCommand
from opencdarr import WindField, NO_WIND
from opencdarr import geo

RPZ = 50.0     # protected-zone radius [m]
DT = 0.5       # integration step [s]
G = 9.80665    # standard gravity [m/s2]

MY_FIXEDWING = Performance(
    v_max=24.0, v_min=13.0, ax=1.8, yaw_rate_max=0.0, phi_max=40.0, roll_rate_max=60.0,
)


class SimpleFixedWing(Kinematics):
    """A bank-limited point mass, commanded in ground velocity. Ignores the wind."""

    def validate_performance(self, perf: Performance) -> None:
        """Refuse an envelope this model would fly silently wrong (a multirotor's, typically)."""
        bad: list[str] = []
        if perf.v_min <= 0.0:
            bad.append("v_min is a stall speed here and must be > 0")
        if perf.phi_max <= 0.0:
            bad.append("phi_max must be > 0 (this model turns by banking)")
        if bad:
            raise ValueError(
                "SimpleFixedWing was given an envelope it cannot fly: " + "; ".join(bad)
                + ". Pass a fixed-wing Performance such as MY_FIXEDWING."
            )

    def step(
        self,
        state: AircraftState,
        command: MotionCommand,
        perf: Performance,
        dt: float,
        wind: WindField = NO_WIND,
    ) -> AircraftState:
        """Advance one step. `wind` is accepted and deliberately not read (see L1.7)."""
        # speed: clamp the commanded speed into the envelope, then ramp toward it at ax
        v_cmd = min(max(command.gs, perf.v_min), perf.v_max)
        v = state.gs + min(max(v_cmd - state.gs, -perf.ax * dt), perf.ax * dt)

        # track: turn toward the commanded direction, no faster than a bank of phi_max allows
        omega_max = math.degrees(G * math.tan(math.radians(perf.phi_max)) / max(v, 1e-9))
        error = ((command.trk - state.trk + 180.0) % 360.0) - 180.0
        trk = (state.trk + min(max(error, -omega_max * dt), omega_max * dt)) % 360.0

        # position: a great-circle step along the new track
        lat, lon = geo.forward(state.lat, state.lon, trk, v * dt)
        return replace(
            state, lat=lat, lon=lon, trk=trk, gs=v, yaw=trk,
            # **odometry_update(state, v, dt)
        )
```

## T3.2. Defining the fleet and the scenario

In this notebook, we would like to fly six heterogeneous aircraft. They have different performance, kinematics, and initial speed. They are spawned using the `CrossingRing` scenario, such that they meet in the middle at exactly the same time. `t_to_centre` is what makes that true. Here, we first construct the `FLEET` as a helper to assign the airframe and speed.

```python
from opencdarr import Airframe
from opencdarr import M600, Multirotor
from opencdarr import SMALL_FIXEDWING, FixedWing
from opencdarr.scenario import CrossingRing

FLEET = [
    (Airframe(M600, Multirotor()), 14.0),               # A0  a multirotor
    (Airframe(MY_FIXEDWING, SimpleFixedWing()), 20.0),  # A1  your T1 fixed-wing
    (Airframe(SMALL_FIXEDWING, FixedWing()), 17.0),     # A2  the built-in fixed-wing
    (Airframe(SMALL_FIXEDWING, FixedWing()), 17.0),     # A3  meets A0
    (Airframe(M600, Multirotor()), 14.0),               # A4  meets A1
    (Airframe(MY_FIXEDWING, SimpleFixedWing()), 20.0),  # A5  meets A2
]

AIRFRAMES = [airframe for airframe, _ in FLEET]
SPEEDS = tuple(speed for _, speed in FLEET)

RING = CrossingRing(n=6, t_to_centre=100.0, speed=SPEEDS)
RING
```

```{ .text .output }
CrossingRing(n=6, radius=None, speed=(14.0, 20.0, 17.0, 17.0, 14.0, 20.0), t_to_centre=100.0)
```

## T3.3. The numbers and the stack, from a file

The environment this fleet flies in is not written here. It is written in `configs/ring_t3.yaml`, and `load_run` returns the three values an experiment takes: the `Config` of plain numbers, a `Methods` bundle of the components the file names, and the backend its `estimate` block declares.

```python
from opencdarr import Comm, GnssNavigation, LastKnown
from opencdarr.cns import lognormal_latency
from opencdarr.experiment import load_run

CONFIG, BASE_METHODS, BACKEND = load_run("../../configs/ring_t3.yaml")

print(CONFIG)
print(BASE_METHODS)
```

```{ .text .output }
Config  seed 0
  uncertainty  sensor  perfect (no position or velocity error)
  conflict    rpz 50 m | lookahead 120 s
  simulation  dt 0.5 s | broadcast every 1 s (fixed gaps)
              ends on 10 s clear, 600 s cap
Methods
  cdarr     StateBased() -> MVP(margin=1.05) -> FTR()
  cns       perfect (no navigation, communication or surveillance model)
  airframe  Performance(v_max=18.0, v_min=-18.0, ax=5.0, yaw_rate_max=90.0, phi_max=0.0, roll_rate_max=0.0) (every aircraft)
            Multirotor()
  wind      still air
  scenario  CrossingRing(n=6, radius=None, speed=14.0, t_to_centre=100.0)
```

Note that previously we defined the `Config` and `Scenario` in `Encounter` directly. Now, we load the base from the configuration file, then we change the fields we want with `replace`.

```python
METHODS = replace(
    BASE_METHODS,
    airframes=AIRFRAMES,   # one per aircraft, in ring order
    scenario=RING,         # one cruise per aircraft, which a single `speed:` cannot say
    navigation=GnssNavigation(),
    communication=Comm(reception_prob=0.7,
                       latency=lognormal_latency(median=0.5, sigma=0.6)),
    surveillance=LastKnown(),
)

print(METHODS)
```

```{ .text .output }
Methods
  cdarr     StateBased() -> MVP(margin=1.05) -> FTR()
  cns       navigation GnssNavigation(pos_distribution=gaussian, vel_distribution=gaussian, effects=()) | communication Comm(gates=(), reception_prob=0.7, latency=<lambda>) | surveillance LastKnown()
  airframe  6 per-aircraft airframes (mixed fleet)
  wind      still air
  scenario  CrossingRing(n=6, radius=None, speed=(14.0, 20.0, 17.0, 17.0, 14.0, 20.0), t_to_centre=100.0)
```

You can see how the printed `METHODS` changes after we replace the fields.

## T3.4. Experimenting using the `BASE_METHODS`

Start from the case with no uncertainty in it, because it sets the scale for everything below.

```python
from opencdarr.experiment import MC, Fixed, run_experiment

res = run_experiment(
    {"navigation": Fixed(None), "communication": Fixed(None)},  # a perfect sensor and datalink
    methods=BASE_METHODS,
    backend=MC(n_encounters=1),   # placed and deterministic: one run says what 1000 would
    base_config=CONFIG,
    seed=0,
)
res.cell()
```

```{ .text .output }
MonteCarloEstimate  0 losses in 1 encounters
  p_los      0 (per run, per aircraft and mean K coincide)
  closest    median 50.4 m (per-encounter record: min_seps)
  detection  rate 1 (a diagnostic, not the result)
```

With perfect navigation, MVP keeps the whole fleet separated with a 0.4 m margin.

## T3.5. MVP vs VO, under navigation uncertainty

Mirror, mirror on the wall, which is the safest of them all? Conflict resolution is technically solved when there is no uncertainty. Let's compare MVP and VO under navigation uncertainty. The **independent variables** in this experiment are the position uncertainty `pos_ci95` and the conflict resolution algorithm `resolver`. Also, we want to hold the velocity uncertainty `vel_ci95` at a `Fixed` value of 1 m/s. So, this is how the `run_experiment` call is written:

```python
from opencdarr import MVP, VO
from opencdarr.experiment import Sweep

RESOLVERS = {"MVP": MVP(margin=1.05), "VO": VO(margin=1.05)}

res = run_experiment(
    {"pos_ci95": Sweep([3.0, 10.0, 30.0]),                          # m — the first axis
     "vel_ci95": Fixed(1.0),                                        # m/s — held
     "resolver": Sweep(list(RESOLVERS),                             # the second axis
                       build=lambda name: RESOLVERS[name])},
    methods=METHODS,
    backend=MC(n_encounters=1000),   # for each of the six conditions
    base_config=CONFIG,
    seed=0,
    n_jobs=-1,
)
res.frame()[["pos_ci95", "resolver", "p_los_run", "p_los_ac", "mean_k", "n_los",
             "median_min_sep"]].round(4)
```

```{ .text .output }
   pos_ci95 resolver  p_los_run  p_los_ac  mean_k  n_los  median_min_sep
0       3.0      MVP      0.049    0.0187   0.062     49         65.2356
1       3.0       VO      0.027    0.0095   0.030     27         65.3821
2      10.0      MVP      0.068    0.0250   0.082     68         64.8709
3      10.0       VO      0.027    0.0097   0.031     27         65.9402
4      30.0      MVP      0.186    0.0723   0.243    186         65.3726
5      30.0       VO      0.097    0.0360   0.116     97         66.4255
```

### T3.5.1. The three metrics

Important note:

In a pairwise conflict the three metrics are equal. In a multi-aircraft encounter they differ: `p_los_run`, `p_los_ac`, and `mean_k`.

Each encounter $r$ gives three counts: $K_r$ pairs in a loss of separation, $A_r$ aircraft in a
loss of separation, and $N_r$ aircraft that flew. An estimate has $R$ encounters.

$$
P(\text{LoS})_\text{run} = \frac{1}{R}\sum_{r} \mathbf{1}\!\left[K_r \ge 1\right]
\qquad
P(\text{LoS})_\text{ac} = \frac{\sum_r A_r}{\sum_r N_r}
\qquad
\mathbb{E}[K] = \frac{1}{R}\sum_r K_r
$$

* $P(\text{LoS})_\text{run}$, the `p_los_run` column, is a probability per encounter. One pair in a loss of separation is sufficient to count the full encounter. 

* $P(\text{LoS})_\text{ac}$, the `p_los_ac` column, is a probability per aircraft. Each aircraft
counts one time in each encounter, and not one time for each intruder. 

* $\mathbb{E}[K]$, the `mean_k` column, is a frequency, not a probability. Its value can be more
than 1. The denominator of $P(\text{LoS})_\text{ac}$ is a sum over the encounters. Thus the ratio stays correct if the number of aircraft changes between the encounters.

For a fleet of two aircraft, the three values are identical.

**Extra note**: `list(RESOLVERS)` gives the dict's keys, and without `build` a `Sweep`'s levels go straight onto the bundle, so the run would get the string `"MVP"` where a resolver belongs and fail with `'str' object has no attribute 'resolve'`.

## T3.6. The result

```python
import matplotlib.pyplot as plt

plt.rcParams["figure.dpi"] = 130

fig, ax = plt.subplots(1, 2, figsize=(9.5, 3.6))
res.plot("p_los_ac", ax=ax[0])
res.plot("median_min_sep", ax=ax[1])
ax[0].set_xlabel("pos_ci95 [m]")
ax[1].set_xlabel("pos_ci95 [m]")
ax[1].set_ylabel("median_min_sep [m]")
ax[1].axhline(CONFIG.conflict.rpz, color="tab:red", lw=1.0, ls=":")   # the protected zone itself
fig.tight_layout()
plt.show()
```

![Two panels against the position accuracy, 3 to 30 metres. Left, P(LoS) for each aircraft: the MVP curve rises from 0.019 to 0.072, and the VO curve rises from 0.010 to 0.036, below MVP at every level and rising less steeply. Right, the median minimum separation: both curves are flat near 65 metres, VO above MVP by 0.1 metres at a 3 metre fix and by about 1 metre at 10 and 30 metres, and the dotted line of the 50 metre protected zone is well below them.](../assets/img/t3-mvp-vs-vo.png)

Voilà! For this type of scenario, it turns out that VO is safer than MVP. We move on to experimenting with VO, MVP, and user-defined conflict resolution in T4.
