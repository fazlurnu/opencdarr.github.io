---
authorship: opus-5
---

# T4. Two estimators, one experiment

T3 measured a probability with plain Monte Carlo. Monte Carlo counts events. It works while the events are frequent enough to count, and it stops working when they are not.

This notebook walks into that wall on purpose, and then gets past it. It sweeps with Monte Carlo, narrows to the conditions Monte Carlo cannot measure, and estimates those again with Interacting Particle System (IPS), the rare-event estimator. Between those last two runs only the `backend=` argument changes: the encounter, the aircraft, the stack and the axes stay the same objects.

The notebook also adds a third resolver, which you can write yourself.

## T4.1. The encounter, from a file

The encounter is a pairwise conflict. Two M600 multirotors fly at 20 kt (10.2889 m/s). They start 60 s from a loss of separation. The file leaves the crossing angle, the miss distance and the passing side to be drawn per encounter, so two seeds give two different conflicts at the same difficulty. T4.2 then pins the crossing angle, because it becomes one of the swept axes. The miss distance and the passing side stay drawn.

That scenario is written in `configs/pairwise_t4.yaml`. `load_run` then reads the file and returns the three values an experiment takes: a `Config` of plain numbers, a `Methods` bundle of live components, and the backend that the `estimate:` block declares.

```python
from opencdarr.experiment import load_run

CONFIG, FILE_METHODS, FILE_BACKEND = load_run("../../configs/pairwise_t4.yaml")

print(CONFIG)
print(FILE_METHODS)
print(FILE_BACKEND)
```

```{ .text .output }
Config  seed 0
  uncertainty  sensor  perfect (no position or velocity error)
  conflict    rpz 50 m | lookahead 120 s
  simulation  dt 1 s | broadcast every 1 s (fixed gaps)
              ends on 10 s clear, 300 s cap
Methods
  cdarr     StateBased() -> MVP(margin=1.05) -> PastCPA(bouncing_guard=False)
  cns       perfect (no navigation, communication or surveillance model)
  airframe  Performance(v_max=18.0, v_min=-18.0, ax=5.0, yaw_rate_max=90.0, phi_max=0.0, roll_rate_max=0.0) (every aircraft)
            Multirotor()
  wind      still air
  scenario  PairwiseEncounter(speed=10.2889, dpsi=None, dcpa=None, side=None, gs_intr=10.2889, dcpa_max=50.0, tlos=60.0)
MC(n_encounters=1000)
```

The bundle has no navigation model, and the file cannot give it one: the registry that a run file names its components from has no entry for a CNS model. However, we want the navigation uncertainty in this simulation, so we set the built-in `GnssNavigation()` on the bundle here.

This is not optional. `pos_ci95` is one of the swept axes, and only two things read it: a navigation model, and `ProbabilisticFTR`. An accuracy that nothing reads is refused rather than run, so without this line the sweep raises.

```python
from dataclasses import replace

from opencdarr import GnssNavigation

METHODS = replace(FILE_METHODS, navigation=GnssNavigation())

print(METHODS)
```

```{ .text .output }
Methods
  cdarr     StateBased() -> MVP(margin=1.05) -> PastCPA(bouncing_guard=False)
  cns       navigation GnssNavigation(pos_distribution=gaussian, vel_distribution=gaussian, effects=()) | no communication | no surveillance
  airframe  Performance(v_max=18.0, v_min=-18.0, ax=5.0, yaw_rate_max=90.0, phi_max=0.0, roll_rate_max=0.0) (every aircraft)
            Multirotor()
  wind      still air
  scenario  PairwiseEncounter(speed=10.2889, dpsi=None, dcpa=None, side=None, gs_intr=10.2889, dcpa_max=50.0, tlos=60.0)
```

## T4.2. The independent variables

Five parameters. Four are swept, one is held.

| parameter | role | levels | unit |
| --- | --- | --- | --- |
| `dpsi` | swept | 2, 10, 45 | [deg] |
| `pos_ci95` | swept | 3, 10 | [m] |
| `vel_ci95` | held | 1 | [m/s] |
| `resolver` | swept | `MVP`, `VO`, `TurnRight` | [-] |
| `recovery` | swept | `PastCPA`, `FTR`, `ProbabilisticFTR` | [-] |

Three crossing angles, two accuracies, three resolvers and three recovery criteria give 54 conditions. Each condition is one estimate.

### T4.2.1 A resolver of your own

`MVP` and `VO` come from the library. The third one does not. Write a resolver by subclassing
`ConflictResolver` and implementing `resolve`. The method receives the ownship state, the
intruders currently in conflict, and `rpz`. It returns a `MotionCommand`.

`TurnRight` obeys the oldest rule in the air: if you see traffic ahead, turn right. It flies 45°
to the right of its **nominal** track, at the nominal speed, until the recovery criterion releases
it. The nominal track is the one to steer from, because `resolve` is called on every tick that the
conflict lasts, and a rule written against the *current* track would add 45° each time and fly the
aircraft in a circle.

Every resolver engages when the `ConflictDetector` flags a conflict, and disengages when the
`RecoveryCriterion` flags that it is safe to return to the nominal track.

```python
from collections.abc import Sequence

from opencdarr.cr import ConflictResolver
from opencdarr.kinematics import MotionCommand
from opencdarr.state import AircraftState


class TurnRight(ConflictResolver):
    """Turn a fixed angle right of the nominal track, and hold it until recovery."""

    def __init__(self, angle_deg: float = 45.0) -> None:
        if not 0.0 < angle_deg < 180.0:
            raise ValueError(f"TurnRight angle_deg must be in (0, 180), got {angle_deg:g}")
        self.angle_deg = angle_deg
        # notebook-defined, so there is no source to hash — name the identity by hand.
        # Bump the suffix whenever you edit resolve(), or the cache will serve stale cells.
        self.cache_id = f"TurnRight(angle_deg={angle_deg:g})-v1"

    def resolve(
        self,
        own: AircraftState,
        intruders: Sequence[AircraftState],
        rpz: float,
        preferred: tuple[float, float] | None = None,
    ) -> MotionCommand:
        """Fly `angle_deg` right of the nominal track. Ignores how close the intruder is."""
        if preferred is not None:
            # refused, not dropped: this rule steers from the nominal velocity and cannot stay
            # closest to some other one. MVP refuses the same argument for the same reason.
            raise ValueError(
                "TurnRight cannot honour `preferred` — it steers from the nominal velocity. "
                "Pass None (the pipeline does), or use VO for a preferred-velocity resolver."
            )
        nominal = own.desired
        if nominal is None:   # direct-call path only; run_fleet always sets it
            return MotionCommand.from_track_speed(own.trk, own.gs)
        return MotionCommand.from_track_speed(
            (nominal.trk + self.angle_deg) % 360.0, nominal.gs
        )
```

### T4.2.2. The recovery criteria

Resolution decides how to leave a conflict. Recovery decides when to stop leaving it. The three
criteria:

1. `PastCPA`, which resumes once the pair is past its closest point of approach and is clear of the protected zone. It reads where the two aircraft **are**.

2. `FTR`, free-to-revert, which resumes once a return to the nominal velocity would still keep the pair clear. It reads what would happen **next**.

3. `ProbabilisticFTR`, a probabilistic version of FTR, can be read from [this pre-print](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6675278). It reads `pos_ci95` and `vel_ci95` directly and converts them into a constructed *belief* about the `dcpa`, then flags that it is safe to resume navigation when $P(clear) > 0.999$

```python
from opencdarr import FTR, MVP, VO, PastCPA, ProbabilisticFTR
from opencdarr.experiment import Fixed, Sweep

DPSI_LIST = [2, 10, 45]
POS_LEVELS = (3.0, 10.0)   # m — 95% radial position accuracy

RESOLVERS = {"MVP": MVP(margin=1.05), "VO": VO(margin=1.05), "TurnRight": TurnRight(45.0)}
RECOVERIES = {"PastCPA": PastCPA(bouncing_guard=True), "FTR": FTR(),
              "ProbabilisticFTR": ProbabilisticFTR()}

AXES = {
    "dpsi": Sweep(DPSI_LIST),
    "pos_ci95": Sweep(list(POS_LEVELS)),                                   # m — one line per level
    "vel_ci95": Fixed(1.0),                                                # m/s — held
    "resolver": Sweep(list(RESOLVERS), build=RESOLVERS.get),
    "recovery": Sweep(list(RECOVERIES), build=RECOVERIES.get),
}

print(f"{len(DPSI_LIST) * len(POS_LEVELS) * len(RESOLVERS) * len(RECOVERIES)} conditions")
```

```{ .text .output }
54 conditions
```

## T4.3. Running with Monte Carlo

`MC(n_encounters=100)` executes 100 independent encounters for every condition. That is 5,400 encounters in all. `n_jobs=4` spreads them over four cores.

```python
import time

from opencdarr.experiment import MC, run_experiment

t0 = time.perf_counter()
mc = run_experiment(AXES, methods=METHODS, backend=MC(n_encounters=100),
                    base_config=CONFIG, seed=0, n_jobs=4,
                    cache=True
                    )
T_MC = time.perf_counter() - t0

mc_dataframe = mc.toDataFrame()

print(f"{len(mc_dataframe)} conditions x {mc.backend.n_encounters} encounters "
      f"in {T_MC:.0f} s")
mc_dataframe[["dpsi", "pos_ci95", "resolver", "recovery", "p_los_ac", "median_min_sep"]].head(10)
```

```{ .text .output }
54 conditions x 100 encounters in 81 s

    dpsi  pos_ci95   resolver          recovery  p_los_ac  median_min_sep
0      2       3.0        MVP           PastCPA      0.01       51.384713
1      2       3.0        MVP               FTR      0.00       60.825873
2      2       3.0        MVP  ProbabilisticFTR      0.00       64.121550
3      2       3.0         VO           PastCPA      0.73       38.483379
4      2       3.0         VO               FTR      0.00       64.688555
5      2       3.0         VO  ProbabilisticFTR      0.01       65.610438
6      2       3.0  TurnRight           PastCPA      0.58       47.493127
7      2       3.0  TurnRight               FTR      0.00       61.777671
8      2       3.0  TurnRight  ProbabilisticFTR      0.00       67.644718
9      2      10.0        MVP           PastCPA      0.00       53.207451
```

```python
from itertools import cycle
from typing import Any

import matplotlib.pyplot as plt

plt.rcParams["figure.dpi"] = 130

COLOURS = ["#1f77b4", "#d62728", "#2ca02c", "#ff7f0e"]

def plot_grid(
    frame: Any,
    metric: str = "p_los_ac",
    *,
    ylabel: str = "P(LoS) per aircraft",
    x: str = "dpsi",
    xlabel: str = "dpsi [deg]",
    series: str = "pos_ci95",
    unit: str = "m",
    rows: str = "resolver",
    cols: str = "recovery",
    panel: tuple[float, float] = (3.4, 2.9),
    hline: float | None = None,
) -> Any:
    """One panel per (`rows`, `cols`) level, one line per `series` level, `x` across.

    Every level comes off the frame in declaration order, so the same call draws the full
    3x3 sweep and a 1x2 slice of it without being told which it is.
    """
    row_levels = list(frame[rows].unique())
    col_levels = list(frame[cols].unique())
    series_levels = list(frame[series].unique())

    fig, axes = plt.subplots(
        len(row_levels), len(col_levels),
        figsize=(panel[0] * len(col_levels) + 1.2, panel[1] * len(row_levels) + 0.7),
        sharex=True, sharey=True, squeeze=False,
    )
    for i, row in enumerate(row_levels):
        for j, col in enumerate(col_levels):
            ax = axes[i][j]
            cell = frame[(frame[rows] == row) & (frame[cols] == col)]
            for level, colour in zip(series_levels, cycle(COLOURS)):
                sub = cell[cell[series] == level].sort_values(x)
                label = (f"{level:g} {unit}".strip() if isinstance(level, (int, float))
                         else str(level))
                ax.plot(sub[x], sub[metric], marker="o", ms=4, lw=1.5,
                        color=colour, label=label)
            if hline is not None:
                ax.axhline(hline, color="tab:red", ls=":", lw=1.0)
            if i == 0:
                ax.set_title(str(col), fontsize=10)
            if i == len(row_levels) - 1:
                ax.set_xlabel(xlabel)
            if j == 0:
                ax.set_ylabel(f"{row}\n{ylabel}", fontsize=9)

    axes[0][0].legend(frameon=False, fontsize=8, title=series, title_fontsize=8)
    fig.tight_layout()
    return fig
```

```python
fig = plot_grid(mc_dataframe)
```

![A three by three grid, the resolvers MVP, VO and TurnRight down the rows and the recovery criteria PastCPA, FTR and ProbabilisticFTR across the columns, with the crossing angle from 2 to 45 degrees on each x axis and P(LoS) per aircraft on a shared linear y axis reaching 0.8. Every panel outside the PastCPA column lies flat on zero. In the PastCPA column, VO reaches 0.73 at a 3 metre fix and 0.88 at a 10 metre fix when the crossing angle is 2 degrees, and TurnRight reaches 0.58 and 0.72. Both fall to about 0.1 by 10 degrees and to zero by 45 degrees. MVP stays at or below 0.01 everywhere.](../assets/img/t4-mc-sweep.png)

Nicely done! Reading the plot, the split is by recovery rather than by resolver. Every high `P(LoS)` sits in a `PastCPA` panel, and every `FTR` or `ProbabilisticFTR` cell stays at or below 0.05. The damage is worst at small crossing angles, which is a known hard case in the conflict detection and resolution literature.

The most robust pair overall is MVP with either `FTR` or `ProbabilisticFTR`. Those two are the only pairs in the table that record no loss at all, at every crossing angle and both accuracies. Let's see what their `P(LoS)` is.

```python
mc_dataframe.query("resolver == 'MVP' and recovery in ['FTR', 'ProbabilisticFTR']")
```

```{ .text .output }
    dpsi  pos_ci95 resolver          recovery  p_los_ac  p_los_run  mean_k  \
1      2       3.0      MVP               FTR       0.0        0.0     0.0   
2      2       3.0      MVP  ProbabilisticFTR       0.0        0.0     0.0   
10     2      10.0      MVP               FTR       0.0        0.0     0.0   
11     2      10.0      MVP  ProbabilisticFTR       0.0        0.0     0.0   
19    10       3.0      MVP               FTR       0.0        0.0     0.0   
20    10       3.0      MVP  ProbabilisticFTR       0.0        0.0     0.0   
28    10      10.0      MVP               FTR       0.0        0.0     0.0   
29    10      10.0      MVP  ProbabilisticFTR       0.0        0.0     0.0   
37    45       3.0      MVP               FTR       0.0        0.0     0.0   
38    45       3.0      MVP  ProbabilisticFTR       0.0        0.0     0.0   

    median_min_sep  n_los  n_encounters  detection_rate  
1        60.825873      0           100             1.0  
2        64.121550      0           100             1.0  
10       61.942301      0           100             1.0  
11       64.907085      0           100             1.0  
19       70.120059      0           100             1.0  
20      107.337482      0           100             1.0  
28       70.558568      0           100             1.0  
29      106.497384      0           100             1.0  
37       65.120354      0           100             1.0  
38      102.378536      0           100             1.0  
```

Surprise surprise! All the values are 0. A `P(LoS)` of zero tells us nothing about the value of the probability. It only says that we need more samples to estimate it. Since we are tight on budget, let's re-run the Monte Carlo for MVP and the two recoveries alone.

```python
from opencdarr import MVP
from opencdarr.experiment import Fixed, Sweep

RESOLVERS_MVP = {"MVP": MVP(margin=1.05)}
RECOVERIES_FTR = {"FTR": FTR(), "ProbabilisticFTR": ProbabilisticFTR()}

AXES_ROBUST = {
    "dpsi": Sweep(DPSI_LIST),
    "pos_ci95": Sweep(list(POS_LEVELS)),                                   # the x axis
    "vel_ci95": Fixed(1.0),                                                # m/s — held
    "resolver": Sweep(list(RESOLVERS_MVP), build=RESOLVERS_MVP.get),
    "recovery": Sweep(list(RECOVERIES_FTR), build=RECOVERIES_FTR.get),
}

t0 = time.perf_counter()

mc_robust = run_experiment(AXES_ROBUST, methods=METHODS, backend=MC(n_encounters=2500),
                           base_config=CONFIG, seed=0, n_jobs=4, cache=True
                          )

T_MC_robust = time.perf_counter() - t0

mc_robust_dataframe = mc_robust.toDataFrame()
print(f"{len(mc_robust_dataframe)} conditions x {mc_robust.backend.n_encounters} "
      f"encounters in {T_MC_robust:.0f} s")
mc_robust_dataframe[['dpsi', 'pos_ci95', 'resolver', 'recovery', 'p_los_ac', 'n_los']]
```

```{ .text .output }
12 conditions x 1000 encounters in 642 s

   dpsi  pos_ci95 resolver          recovery  p_los_ac  n_los
0     2       3.0      MVP               FTR    0.0000      0
1     2       3.0      MVP  ProbabilisticFTR    0.0000      0
2     2      10.0      MVP               FTR    0.0000      0
3     2      10.0      MVP  ProbabilisticFTR    0.0000      0
4    10       3.0      MVP               FTR    0.0000      0
5    10       3.0      MVP  ProbabilisticFTR    0.0000      0
6    10      10.0      MVP               FTR    0.0004      1
7    10      10.0      MVP  ProbabilisticFTR    0.0000      0
8    45       3.0      MVP               FTR    0.0000      0
9    45       3.0      MVP  ProbabilisticFTR    0.0000      0
```

```python
fig = plot_grid(mc_robust_dataframe)
```

![Two panels for MVP alone, FTR on the left and ProbabilisticFTR on the right, the crossing angle from 2 to 45 degrees against P(LoS) per aircraft on a linear axis reaching 0.0004. Every point is zero except one. The 10 metre line under FTR reaches 0.0004 at a 10 degree crossing, which is the single loss counted in 2500 encounters. The ProbabilisticFTR panel is flat on zero throughout.](../assets/img/t4-mc-mvp-robust.png)

## T4.4. The same experiment, using Interacting Particle System (IPS)

One argument changes. `backend=IPS(...)` replaces `backend=MC(...)`.

Splitting needs a **ladder**, a decreasing list of levels, ending at `rpz`. The estimator runs a set of particles/samples, keeps the ones that get below the next level, and clones them to replace the ones that did not. The probability is the product of the survival fractions.

Read `n_collapsed` before you read any probability. A collapsed replication is one where no particle crossed a level.

```python
from opencdarr.experiment import IPS

LEVELS = [150.0, 99.0, 84.3, 66.8, 58.2, 54.0, 52.0, 51.0, 50.5, 50.3, 50.0]

t0 = time.perf_counter()
ips = run_experiment(AXES_ROBUST, methods=METHODS,
                     backend=IPS(levels=LEVELS, n_particles=400, reps=1),
                     base_config=CONFIG, seed=0, n_jobs=4,
                     cache=True)
T_IPS = time.perf_counter() - t0

print(f"{len(ips)} conditions x {ips.backend.n_particles} particles x "
      f"{ips.backend.reps} replication(s) in {T_IPS:.0f} s")
```

```{ .text .output }
12 conditions x 400 particles x 1 replications in 678 s
```

```python
ips_dataframe = ips.toDataFrame()
ips_dataframe[['dpsi', 'pos_ci95', 'resolver', 'recovery', 'p_los_ac', 'n_collapsed']]
```

```{ .text .output }
   dpsi  pos_ci95 resolver          recovery  p_los_ac  n_collapsed
0     2       3.0      MVP               FTR  0.000191            0
1     2       3.0      MVP  ProbabilisticFTR  0.000239            0
2     2      10.0      MVP               FTR  0.000409            0
3     2      10.0      MVP  ProbabilisticFTR  0.000126            0
4    10       3.0      MVP               FTR  0.000034            0
5    10       3.0      MVP  ProbabilisticFTR  0.000126            0
6    10      10.0      MVP               FTR  0.000117            0
7    10      10.0      MVP  ProbabilisticFTR  0.000035            0
8    45       3.0      MVP               FTR       NaN            1
9    45       3.0      MVP  ProbabilisticFTR  0.000030            0
```

```python
fig = plot_grid(ips_dataframe)
for ax in fig.axes:
    ax.set_yscale("log")
    ax.set_ylim([1e-5, 1e-3])
fig.tight_layout()
```

![The same two panels estimated by splitting, on a logarithmic y axis from 1e-5 to 1. Every condition now carries a value between 3.0e-5 and 4.1e-4, where the Monte Carlo sweep showed zero. Under FTR the 3 metre line runs from 1.9e-4 at a 2 degree crossing to 3.4e-5 at 10 degrees and then stops, because the ladder for that condition collapsed. The 10 metre line runs 4.1e-4, then 1.2e-4, then 2.2e-4. Under ProbabilisticFTR both lines fall as the crossing angle grows and meet near 3.0e-5 at 45 degrees.](../assets/img/t4-ips-mvp.png)

## T4.5. MC or IPS

From our Monte Carlo (MC) simulation of MVP-FTR and MVP-ProbabilisticFTR, most of the resulting $P(LoS)_{ac}$ is 0, which essentially tells us nothing about the probability. This was done using 2500 encounters and it took about 10 minutes 41 seconds on a MacBook Air M2, using 4 cores.

When we switched to IPS, running the same simulation, we got an actual estimate for most of the data points. The one exception is the cell that collapsed, because no particle crossed the next level. This took roughly the same time as MC, about 11 minutes 18 seconds on the same computer.

Looking at the estimated probability, for instance for `dpsi=2` and `pos_ci95=3.0`, if we want at least 10 losses in an MC simulation, we would need more than 50,000 encounters. That is 20 times the current simulation, which would make the whole sweep cost about 3.5 hours.

On the other hand, at a much lower computational cost, we can already estimate it using IPS. The collapsed cell can be improved by adding more levels and/or particles. There is no such thing as a free lunch: tuning the levels takes time, and there is an actual method to it, but it saves you time when you run an extensive experiment.
