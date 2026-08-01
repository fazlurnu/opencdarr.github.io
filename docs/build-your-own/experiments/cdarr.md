# CDaRR

The [separation-manager pages](../separation-manager/index.md) write one component at a time and look at a single encounter. This page assembles all three — a conflict **detector**, a **resolver** and a **recovery criterion**, none of them from the library — into one stack, and measures it against `StateBased` + `MVP` + `FTR` over 500 encounters per condition.

The point is not that the hand-written stack is good. It is that putting it on the same axes as the reference costs nothing but a second `Methods` bundle.

## The stack

All three are copied unchanged from the pages that introduced them: [`ProximityDetect`](../separation-manager/index.md#conflict-detection) flags a conflict inside 100 m, [`CloseRangeAvoid`](../separation-manager/index.md#conflict-resolution) turns 90° right inside 70 m, and [`RangeClear`](../separation-manager/index.md#recovery) resumes the mission once the pair is 120 m apart.

```python
STACKS = {
    "reference": Methods(detector=StateBased(), resolver=MVP(1.05), recovery=FTR(),
                         navigation=GnssNavigation(), perf=M600),
    "mine":      Methods(detector=ProximityDetect(100.0), resolver=CloseRangeAvoid(70.0),
                         recovery=RangeClear(120.0),
                         navigation=GnssNavigation(), perf=M600),
}
```

Each custom class carries a `cache_id`. `cache=True` has to key every component distinctly, and by default `identity()` does that by hashing the class's own source — which works, but is less stable for a class defined in a notebook than for one in a file. Declaring the id means you own the promise of bumping it when the logic changes.

## Two declarations, not one axis

A `Sweep` varies **one** parameter. A stack is three, so declaring `detector`, `resolver` and `recovery` as three axes would give the 2 × 2 × 2 cross-product — eight mixed stacks, most of them meaningless.

Stack-against-stack is two declarations that differ only in their `Methods` bundle:

```python
declared = {"dpsi": Sweep([2.0, 5.0, 10.0, 30.0]), "pos_ci95": Sweep([10.0, 30.0]),
            "vel_ci95": Fixed(1.0), "dcpa": Fixed(0.0),
            "tlos": Fixed(180.0), "speed": Fixed(10.0)}

rows = []
for name, methods in STACKS.items():
    result = run_experiment(declared, methods=methods, backend=MC(n_encounters=500),
                            base_config=base, seed=0, cache=True, n_jobs=4)
    rows += [{"stack": name, **r} for r in result.records()]
```

Everything outside the bundle — the seed, the base config, the swept geometry — is identical, so **both stacks fly the same 500 encounters at each condition**, from the same seeds, with the same noise draws. That is what makes a difference attributable to the stack rather than to luck.

## What comes out

<figure markdown="span">
  ![Two panels against crossing angle. Left, P(LoS): both reference curves lie flat along zero across the whole axis, while the two 'mine' curves sit far above them — the 10 metre one running 0.11, 0.10, 0.06 and rising to 0.20 at 30 degrees, the 30 metre one from 0.29 up to 0.44. Right, median minimum separation: the reference pair holds a flat band between 72 and 80 metres, while the 'mine' pair declines from about 63 and 58 metres at 2 degrees to 56 and 52 metres at 30 degrees, approaching the 50 metre protected-zone line.](../../assets/img/byo-cdarr-response.png)
  <figcaption>P(LoS) and median achieved separation against crossing angle, 500 encounters per point, for the two stacks. Solid is a 10 m position fix, dashed 30 m; shaded bands are 95% Wilson intervals.</figcaption>
</figure>

The reference clears essentially everything: **0.000 to 0.006** across the grid, with zero losses in 500 encounters in five of the eight cells. The hand-written stack loses separation in **5.6% to 43.8%** of them.

That gap is not the interesting part — a fifteen-line rule losing to MVP is not news. The **shape** is. The reference is flat and low across the angle axis. Ours gets *worse* as the crossing widens: 0.056 at 10° against **0.204 at 30°** with a 10 m fix. Wider crossings are the easy end for every resolver in the library, and this stack goes backwards there.

!!! note "A distance threshold is not a warning time"
    Both of this stack's triggers are **distances** — the detector fires inside 100 m, the resolver turns inside 70 m — and the same distance buys wildly different amounts of time depending on how fast the pair is closing:

    | crossing | closing speed | time from the 100 m trigger | time from the 70 m turn |
    |---|---|---|---|
    | 2° | 0.35 m/s | 287 s | 200 s |
    | 5° | 0.87 m/s | 115 s | 80 s |
    | 10° | 1.74 m/s | 57 s | 40 s |
    | 30° | 5.18 m/s | **19 s** | **13 s** |

    Thirteen seconds is not long enough to turn 90° and translate clear at 10 m/s. `StateBased` avoids this by predicting the closest point of approach and firing on `t_lookahead`, which is a time.

**It is also far more sensitive to the position fix.** Tripling `pos_ci95` barely moves the reference, while ours goes 0.106 → 0.288 at 2° and 0.056 → 0.302 at 10°. A rule that switches on a threshold fires at the wrong moment when the distance it reads is wrong by tens of metres; a rule that steers along a gradient degrades more gracefully.

**The medians say where each one lives.** Ours sits between 52 m and 63 m — on top of a 50 m protected zone, which is what a fixed trigger produces: start avoiding at a fixed range, finish at a fixed range. The reference holds 72–80 m and holds it *flat* across the angle axis, which is [FTR](../../modules/separation/recovery-criteria.md)'s signature — it reverts as soon as reverting is safe rather than over-holding, so it does not bank extra separation at wide angles the way `PastCPA` does.

One honest limit on all of this: three components changed at once, so nothing here attributes the failure to any single one.

## Sharpening it

- **Find which component costs what.** Declare `detector`, `resolver` and `recovery` as three separate axes and the cross-product gives all eight combinations, including the hybrids. That isolates each swap, at the price of eight times the runs and a table that invites reading interactions 500 encounters may not resolve.
- **Sweep your own parameter.** `Sweep([50.0, 70.0, 100.0], build=lambda t: CloseRangeAvoid(t), name="trigger")` puts your trigger distance in the table as a plottable numeric column — the fastest way to find out whether the threshold is the problem or the rule is.
- **Look at the record, not just the rate.** `result.cell(...).min_seps` holds every encounter's achieved separation, so `P(min_sep < 25)` or a quantile is a read rather than another run — see the [Monte Carlo estimator](../../estimators/monte-carlo.md).

## In the code

The whole page is one notebook, [`examples/handbook/byo_cdarr.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/byo_cdarr.ipynb), which defines the three components, runs both sweeps, writes the figure and prints the table. Run it top to bottom to reproduce it.

The interfaces are [`ConflictDetector`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cd/base.py), [`ConflictResolver`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cr/base.py) and [`RecoveryCriterion`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/crr/base.py) — one abstract method each. The runner is [`experiment.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/experiment.py); for what the declaration can express, and how to read the two metrics, see [Experiments](../../experiments/index.md) and the [resolver comparison](../../experiments/example-resolver-comparison.md).
