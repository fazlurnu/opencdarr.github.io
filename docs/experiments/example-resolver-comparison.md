# Ex: resolver comparison

A worked experiment, start to finish. The question is narrow on purpose: **how do MVP and VO hold up as the crossing gets shallow and the position fix gets worse?** A third resolver is written in the notebook itself and swept alongside them, because the cost of standing your own algorithm beside the references is the thing this page is really about — a declaration of what varies, a backend that estimates it, and a table you read two metrics off.

Shallow crossings are the interesting end. Two aircraft converging at 2° close on each other at a fraction of their airspeed, so the geometry evolves slowly, the predicted miss distance is ill-conditioned, and a resolver has a long time to make a small mistake repeatedly.

## A third resolver

`CloseRangeAvoid` is the whole contribution surface in fifteen lines: subclass [`ConflictResolver`](../build-your-own/separation-manager/index.md#conflict-resolution), implement `resolve`, return a `MotionCommand`.

```python
class CloseRangeAvoid(ConflictResolver):
    """Hold course until an intruder is within `trigger` m, then turn 90 deg right."""

    cache_id = "close-range-avoid/v1"

    def __init__(self, trigger: float = 70.0) -> None:
        self.trigger = trigger

    def resolve(self, own, intruders, rpz, preferred=None) -> MotionCommand:
        v_east, v_north = velocity_enu(own)
        nearest = min((relative_enu(own, i).dist for i in intruders), default=float("inf"))
        if nearest <= self.trigger:
            return MotionCommand(target_velocity=(v_north, -v_east))   # 90 deg right
        return MotionCommand(target_velocity=(v_east, v_north))        # else: unchanged
```

It is deliberately naive — it ignores `rpz`, the closing speed, and the `preferred` velocity it is handed — because the point is to show what it costs to compare, not to propose it as a good algorithm.

The `cache_id` is the one piece of housekeeping. `cache=True` has to key each resolver distinctly, and by default `identity()` does that by hashing the class's own source, so an edit to `resolve` invalidates the entry. Declaring `cache_id` instead means you own that promise and must bump it when the logic changes — worth it for a class defined in a notebook, where the source is less stable than a file's.

## The declaration

Three parameters are swept and the rest are held. `Fixed` pins a value for every condition; `Sweep` fans one out, one condition per level. The cross-product is 4 × 3 × 2 = **24 conditions**, each an independent seeded batch of 500 encounters, so two conditions differ by their declared levels and nothing else.

```python
RESOLVERS = {"MVP": MVP(1.05), "VO": VO(1.05), "MINE": CloseRangeAvoid()}

sweep = run_experiment(
    {"dpsi":     Sweep([2.0, 5.0, 10.0, 30.0]),
     "resolver": Sweep(list(RESOLVERS), build=RESOLVERS.__getitem__, name="resolver"),
     "pos_ci95": Sweep([10.0, 30.0]),
     "vel_ci95": Fixed(1.0), "dcpa": Fixed(0.0),
     "tlos":     Fixed(180.0), "speed": Fixed(10.0)},
    methods=Methods(detector=StateBased(), recovery=PastCPA(),
                    navigation=GnssNavigation(), perf=M600),
    backend=MC(n_encounters=500),
    base_config=base, seed=0, cache=True, n_jobs=4,
)
```

Adding a resolver to the study is one dict entry. Nothing else in the notebook changes — the plots, the tables and the per-encounter drill-down all pick it up.

Two details in that call are worth naming. The resolver axis sweeps **names**, not objects: `build` maps each level onto the value the run needs, so the results table reads `MVP`, `VO` and `MINE` while the run receives the instances. And `navigation=GnssNavigation()` is load-bearing rather than decoration — `pos_ci95` is a number stamped on every aircraft state, and a navigation model is what draws an error from it. Without one the field is carried through the whole run and never read, so a noise sweep would return identical cells and report that accuracy does not affect safety. `run_experiment` refuses that declaration rather than running it.

Both aircraft are [DJI M600 multirotors](../modules/kinematics/multirotor.md) at 10 m/s, spawned head-to-head (`dcpa = 0`, the worst case at each angle) 180 s from protected-zone entry, with a 50 m protected zone and a 120 s look-ahead. Detection is [`StateBased`](../modules/separation/conflict-detection.md) and recovery is [Past-CPA](../modules/separation/recovery-criteria.md) throughout.

!!! note "The numbers here are not comparable with the pairwise environment page"
    The [pairwise environment](../environments/pairwise.md) page runs **fixed-wings at 17 m/s over a lossy, latent link**, and sweeps the recovery criterion rather than the position fix. This page runs multirotors with no communication model at all. Both report a 5° VO figure and they do not match — 0.164 there against 0.248 here. Different airframe, different [CNS](../modules/cns/index.md) stack, different experiment.

## What comes out

Each condition reports a loss-of-separation probability with a 95% Wilson interval, and the median separation the encounters actually achieved.

<figure markdown="span">
  ![Two panels against crossing angle, six curves each. Left, P(LoS): the two VO curves fall steeply from about 0.79 and 0.97 at 2 degrees to zero by 30 degrees; the two MVP curves lie on top of each other near zero throughout; the two MINE curves start near 0.47 and 0.89 and decline only slowly, still near 0.15 at 30 degrees, well above the other four. Right, median minimum separation: the MVP and VO curves rise together from 20 to 58 metres at 2 degrees to about 170 metres at 30 degrees, while the MINE pair sits flat on the 50 metre protected-zone line from 2 through 10 degrees before rising to about 147 metres at 30.](../assets/img/exp-response-curves.png)
  <figcaption>P(LoS) and median achieved separation against crossing angle, 500 encounters per point. Solid is a 10 m position fix, dashed 30 m; the shaded bands are 95% Wilson intervals. The right panel carries no band — a Wilson interval is for a binomial rate, and a median is not one.</figcaption>
</figure>

**The two library resolvers find shallow crossings hardest**, which is the expected shape. Both are comfortable by 30°, where they clear every one of 500 encounters.

**`CloseRangeAvoid` does not have that shape.** It declines far more slowly — 0.47, 0.48, 0.36, 0.15 across the axis — and is still losing separation in 15% of encounters at 30°, where the other two are at zero. That is the signature of a rule with no geometry in it: a fixed 70 m trigger does not know that a wider crossing gives it more room and more closing speed to work with, so it reacts the same way everywhere and the geometry never rescues it.

**Only one of the three is indifferent to the position fix.** MVP's two curves lie on top of each other — 0.050 against 0.046 at 2°, 0.038 against 0.032 at 5°, with intervals overlapping everywhere, so tripling the position error changed nothing we can measure. VO's separate cleanly (0.248 rising to 0.454 at 5°), and so do `CloseRangeAvoid`'s (0.474 to 0.894 at 2°).

**The second metric is not a restatement of the first.** It says something P(LoS) cannot in four places:

- *At 30°, where P(LoS) has bottomed out.* MVP and VO both read zero, so the rate cannot tell "equivalent" from "both below what 500 encounters resolves". The medians can, and they say equivalent: 174 m against 177 m at a 10 m fix, 168 m against 170 m at 30 m.
- *At 2°, where P(LoS) looks comfortable.* MVP reports 0.05, which reads as a 95% success rate. Its median is 53 m against a 50 m protected zone, and the middle half of its encounters falls between 51.8 m and 55.0 m. It steers to the boundary every time and crosses it when the noise goes the wrong way.
- *At 10°, where two of them disagree.* MVP and VO's medians nearly coincide — 83.0 m against 81.8 m — while P(LoS) reads 0.002 against 0.038.
- *Wherever `CloseRangeAvoid` runs.* Its median is 50.2 m at 2°, 50.2 m at 5° and 53.0 m at 10° — on the protected zone, or within three metres of it, across a fifteenfold change in closing speed. A resolver that starts avoiding at a fixed range ends up parked at that range, and one number says so where three P(LoS) values would not.

**One column gives the mechanism away.** `detection_rate` is ~1.0 for `CloseRangeAvoid` everywhere, while MVP's falls to 0.40 at 30°. That column counts encounters the true-state detector ever flagged: MVP opens the predicted miss past `rpz` before the look-ahead horizon reaches the encounter, so the detector never fires. `CloseRangeAvoid` never pre-empts — it waits for 70 m — so every encounter stays a conflict all the way in. This is exactly why `detection_rate` is a [diagnostic and never a denominator](../estimators/monte-carlo.md#the-unit-is-the-encounter): it moves with the resolver's behaviour.

!!! note "Read these numbers as a measurement of these implementations, not of the methods"
    Our MVP is cross-checked against [BlueSky](https://github.com/TUDelft-CNS-ATM/bluesky) at detection, resolution, turn dynamics and recovery. Our VO is a re-derivation with no reference implementation to check against, and on a symmetric two-intruder conflict it clears *better* than MVP does. `CloseRangeAvoid` is a toy, included to be compared against rather than proposed. The page is an example of swapping one component for another, not a verdict on any method.

## Taking it apart

Every layer of that table is reachable on its own, which is how you check that a surprising cell is real rather than a wiring mistake.

| layer | what it is | how to reach it |
|---|---|---|
| experiment | 24 conditions | `run_experiment(...)` |
| condition | 500 encounters at one set of levels | an all-`Fixed` declaration, or `sweep.cell(...)` |
| record | one achieved separation per encounter | `result.min_seps` |
| encounter | one geometry, one run, one outcome | `sample_pairwise` + `run_fleet` |

Declaring every parameter as `Fixed` gives a single row, and because it is the same code path with nothing to cross-product, it reproduces the matching cell exactly. The record behind that cell turns the reported metrics into reads rather than reruns: `P(min_sep < 50)` **is** P(LoS) by definition, and `P(min_sep < 25)` comes out at 0.000 for MVP at 2° — its failures are shallow incursions, not near-collisions.

The record also supplies the interval the table cannot. MVP's median *rises* with a worse position fix at the shallow end, 53.3 m to 57.8 m at 2°, while its P(LoS) does not move. Bootstrapping the median over the 500 stored values gives [53.12, 53.58] and [57.39, 58.21] — disjoint, so the rise is not sampling noise. Why it happens is a separate question: a resolver re-commanding from its own noisy fix re-aims slightly wrong each tick, and that random walk does real avoidance work.

At the bottom of the stack is one encounter.

<figure markdown="span">
  ![Three rows for one 2 degree encounter with four cases. Top, ground tracks to scale: all eight tracks collapse into a single near-vertical line about 5 km long. Middle, the true relative geometry and separation: the no-resolver case runs straight through the 50 m circle, MVP arcs well over the top of it, MINE skirts its edge, VO cuts through it. Bottom, the same geometry as the ownship believed it: visibly ragged, jittering by tens of metres each tick.](../assets/img/exp-encounter.png)
  <figcaption>One encounter at 2° with a 10 m position fix. Top, the ground tracks drawn to scale. Middle, the intruder relative to the ownship, with the protected zone as a circle at the origin, and the separation over time. Bottom, the same two views built from the noisy self-fixes each aircraft broadcast. The two relative rows share their scales.</figcaption>
</figure>

The ground tracks are drawn to scale, and all eight collapse into what looks like one line. That is not a plotting failure: at 2° the pair flies close to five kilometres while the conflict, the manoeuvres and the protected zone are a matter of tens of metres. Subtracting the ownship's position throws away the four kilometres both aircraft agree on and keeps the hundred metres they do not, which is why the two rows below use the relative frame.

The last row is the one that matters for reading any of this. **The outcome is scored on the true states — `min_sep` never sees the noise — but the resolver only ever acts on the broadcasts.** In this encounter MVP believed it was 41.9 m from the intruder, inside the protected zone, while the truth was 54.9 m and it never breached at all; VO believed 20.3 m against a true 27.4 m; `CloseRangeAvoid` thought it was at 39.3 m while flying 50.8 m. That last one is the same 10 m-scale error, and it matters more for a rule that triggers on a threshold. The belief trace is ragged because both fixes are redrawn independently every broadcast tick and nothing filters them — [`LastKnown`](../modules/cns/surveillance.md) surveillance holds the newest message as it arrived. `pos_ci95` is the width of the gap between those two rows, and P(LoS) asks what the gap costs.

One encounter is an anecdote, not a verdict. Change the seed and VO clears this same geometry by three tenths of a metre; and `CloseRangeAvoid` clears *this* one while failing 47% of the 500 at this angle.

## In the code

The whole page is one notebook, [`examples/handbook/resolver_comparison.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/resolver_comparison.ipynb), which defines `CloseRangeAvoid`, runs the experiment, writes both figures above, and prints every number quoted here. Run it top to bottom to reproduce them.

The declaration layer is [`experiment.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/experiment.py) — `Fixed`, `Sweep`, `Methods`, `MC`, and the `ExperimentResult` with `records()`, `frame()`, `cell()` and `plot()`. The estimate behind each cell is [`estimate_ipr`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/estimator.py), and each encounter is one [`run_fleet`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/fleet.py) from spawn to termination.

`cache=True` stores one entry per condition, keyed on the config, the component identities and a fingerprint of the library source, so re-running the notebook replots without re-simulating and extending the sweep only runs the new cells. Adding the third resolver re-ran only its eight cells; MVP's and VO's sixteen came back from cache, bit-identical.

At 30° both library resolvers sit at zero losses in 500 encounters, which is where plain Monte Carlo runs out of resolution. Swapping `backend=MC(...)` for `backend=IPS(...)` estimates the same quantity by splitting, with the rest of the declaration unchanged — see [rare-event simulation](../estimators/rare-event/index.md).
