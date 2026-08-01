# Ex: resolver comparison

A worked experiment, start to finish. The question is narrow on purpose: **how do MVP and VO hold up as the crossing gets shallow and the position fix gets worse?** What the page is really showing is the shape of an experiment — a declaration of what varies, a backend that estimates it, and a table you read two metrics off.

Shallow crossings are the interesting end. Two aircraft converging at 2° close on each other at a fraction of their airspeed, so the geometry evolves slowly, the predicted miss distance is ill-conditioned, and a resolver has a long time to make a small mistake repeatedly.

## The declaration

Three parameters are swept and the rest are held. `Fixed` pins a value for every condition; `Sweep` fans one out, one condition per level. The cross-product is 4 × 2 × 2 = **16 conditions**, each an independent seeded batch of 500 encounters, so two conditions differ by their declared levels and nothing else.

```python
sweep = run_experiment(
    {"dpsi":     Sweep([2.0, 5.0, 10.0, 30.0]),
     "resolver": Sweep(["MVP", "VO"], build=RESOLVERS.__getitem__, name="resolver"),
     "pos_ci95": Sweep([10.0, 30.0]),
     "vel_ci95": Fixed(1.0), "dcpa": Fixed(0.0),
     "tlos":     Fixed(180.0), "speed": Fixed(10.0)},
    methods=Methods(detector=StateBased(), recovery=PastCPA(),
                    navigation=GnssNavigation(), perf=M600),
    backend=MC(n_encounters=500),
    base_config=base, seed=0, cache=True, n_jobs=4,
)
```

Two details in that call are worth naming. The resolver axis sweeps **names**, not objects: `build` maps each level onto the value the run needs, so the results table reads `MVP` and `VO` while the run receives the instances. And `navigation=GnssNavigation()` is load-bearing rather than decoration — `pos_ci95` is a number stamped on every aircraft state, and a navigation model is what draws an error from it. Without one the field is carried through the whole run and never read, so a noise sweep would return identical cells and report that accuracy does not affect safety. `run_experiment` refuses that declaration rather than running it.

Both aircraft are [DJI M600 multirotors](../modules/kinematics/multirotor.md) at 10 m/s, spawned head-to-head (`dcpa = 0`, the worst case at each angle) 180 s from protected-zone entry, with a 50 m protected zone and a 120 s look-ahead. Detection is [`StateBased`](../modules/separation/conflict-detection.md) and recovery is [Past-CPA](../modules/separation/recovery-criteria.md) throughout.

!!! note "The numbers here are not comparable with the pairwise environment page"
    The [pairwise environment](../environments/pairwise.md) page runs **fixed-wings at 17 m/s over a lossy, latent link**, and sweeps the recovery criterion rather than the position fix. This page runs multirotors with no communication model at all. Both report a 5° VO figure and they do not match — 0.164 there against 0.248 here. Different airframe, different [CNS](../modules/cns/index.md) stack, different experiment.

## What comes out

Each condition reports a loss-of-separation probability with a 95% Wilson interval, and the median separation the encounters actually achieved.

<figure markdown="span">
  ![Two panels against crossing angle. Left, P(LoS): both VO curves fall steeply from about 0.8 and 0.97 at 2 degrees to zero by 30 degrees and separate widely from each other, while the two MVP curves lie on top of each other near zero throughout. Right, median minimum separation: all four curves rise together from about 20 to 55 metres at 2 degrees to about 170 metres at 30 degrees, with the VO pair well below the MVP pair at 2 degrees and converging with it by 10 degrees.](../assets/img/exp-response-curves.png)
  <figcaption>P(LoS) and median achieved separation against crossing angle, 500 encounters per point. Solid is a 10 m position fix, dashed 30 m; the shaded bands are 95% Wilson intervals. The right panel carries no band — a Wilson interval is for a binomial rate, and a median is not one.</figcaption>
</figure>

**Both resolvers find shallow crossings hardest**, which is the expected shape. Everything is comfortable at 30°, where both clear every one of 500 encounters.

**Only one of them cares about the position fix.** MVP's two curves lie on top of each other — 0.050 against 0.046 at 2°, 0.038 against 0.032 at 5°, with intervals overlapping everywhere, so tripling the position error changed nothing we can measure. VO's two curves separate cleanly: 0.248 rising to 0.454 at 5°, and 0.038 to 0.098 at 10°, both with disjoint intervals.

**The second metric is not a restatement of the first.** It says something P(LoS) cannot in three places:

- *At 30°, where P(LoS) has bottomed out.* Both resolvers read zero, so the rate cannot tell "equivalent" from "both below what 500 encounters resolves". The medians can, and they say equivalent: 174 m against 177 m at a 10 m fix, 168 m against 170 m at 30 m.
- *At 2°, where P(LoS) looks comfortable.* MVP reports 0.05, which reads as a 95% success rate. Its median is 53 m against a 50 m protected zone, and the middle half of its encounters falls between 51.8 m and 55.0 m. It steers to the boundary every time and crosses it when the noise goes the wrong way.
- *At 10°, where the two disagree.* The medians nearly coincide — 83.0 m for MVP against 81.8 m for VO — while P(LoS) reads 0.002 against 0.038.

!!! note "Read VO's numbers as a measurement of this implementation, not of velocity obstacles"
    Our MVP is cross-checked against [BlueSky](https://github.com/TUDelft-CNS-ATM/bluesky) at detection, resolution, turn dynamics and recovery. Our VO is a re-derivation with no reference implementation to check against, and on a symmetric two-intruder conflict it clears *better* than MVP does. The comparison here is an example of swapping one component for another, not a verdict on the method.

## Taking it apart

Every layer of that table is reachable on its own, which is how you check that a surprising cell is real rather than a wiring mistake.

| layer | what it is | how to reach it |
|---|---|---|
| experiment | 16 conditions | `run_experiment(...)` |
| condition | 500 encounters at one set of levels | an all-`Fixed` declaration, or `sweep.cell(...)` |
| record | one achieved separation per encounter | `result.min_seps` |
| encounter | one geometry, one run, one outcome | `sample_pairwise` + `run_fleet` |

Declaring every parameter as `Fixed` gives a single row, and because it is the same code path with nothing to cross-product, it reproduces the matching cell exactly. The record behind that cell turns the reported metrics into reads rather than reruns: `P(min_sep < 50)` **is** P(LoS) by definition, and `P(min_sep < 25)` comes out at 0.000 for MVP at 2° — its failures are shallow incursions, not near-collisions.

The record also supplies the interval the table cannot. MVP's median *rises* with a worse position fix at the shallow end, 53.3 m to 57.8 m at 2°, while its P(LoS) does not move. Bootstrapping the median over the 500 stored values gives [53.12, 53.58] and [57.39, 58.21] — disjoint, so the rise is not sampling noise. Why it happens is a separate question: a resolver re-commanding from its own noisy fix re-aims slightly wrong each tick, and that random walk does real avoidance work.

At the bottom of the stack is one encounter.

<figure markdown="span">
  ![Three rows for one 2 degree encounter. Top, ground tracks to scale: all six tracks collapse into a single near-vertical line about 5 km long. Middle, the true relative geometry and separation: the no-resolver case runs straight through the 50 m circle, MVP arcs over the top of it, VO cuts through it. Bottom, the same geometry as the ownship believed it: visibly ragged, jittering by tens of metres each tick.](../assets/img/exp-encounter.png)
  <figcaption>One encounter at 2° with a 10 m position fix. Top, the ground tracks drawn to scale. Middle, the intruder relative to the ownship, with the protected zone as a circle at the origin, and the separation over time. Bottom, the same two views built from the noisy self-fixes each aircraft broadcast. The two relative rows share their scales.</figcaption>
</figure>

The ground tracks are drawn to scale, and all six collapse into what looks like one line. That is not a plotting failure: at 2° the pair flies close to five kilometres while the conflict, the manoeuvres and the protected zone are a matter of tens of metres. Subtracting the ownship's position throws away the four kilometres both aircraft agree on and keeps the hundred metres they do not, which is why the two rows below use the relative frame.

The last row is the one that matters for reading any of this. **The outcome is scored on the true states — `min_sep` never sees the noise — but the resolver only ever acts on the broadcasts.** In this encounter MVP believed it was 41.9 m from the intruder, inside the protected zone, while the truth was 54.9 m and it never breached at all; VO believed 20.3 m against a true 27.4 m. The belief trace is ragged because both fixes are redrawn independently every broadcast tick and nothing filters them — [`LastKnown`](../modules/cns/surveillance.md) surveillance holds the newest message as it arrived. `pos_ci95` is the width of the gap between those two rows, and P(LoS) asks what the gap costs.

One encounter is an anecdote, not a verdict: change the seed and VO clears this same geometry by three tenths of a metre.

## Your own components in the same sweep

Everything compared above ships with the library, but nothing in the declaration knows that. The `resolver` axis takes objects, and where those objects came from is not its concern — so an algorithm you wrote this morning is swept exactly the way `MVP` and `VO` are here, against the same encounters, from the same seeds, with the same two metrics coming out.

[**Build your own → Experiments → CDaRR**](../build-your-own/experiments/cdarr.md) does that end to end: a hand-written conflict detector, resolver and recovery criterion, run as a complete stack against MVP through this same machinery. That page is the one to read if you are here to evaluate your own algorithm rather than to learn the runner.

## In the code

The whole page is one notebook, [`examples/handbook/resolver_comparison.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/resolver_comparison.ipynb), which runs the experiment, writes both figures above, and prints every number quoted here. Run it top to bottom to reproduce them.

The declaration layer is [`experiment.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/experiment.py) — `Fixed`, `Sweep`, `Methods`, `MC`, and the `ExperimentResult` with `records()`, `frame()`, `cell()` and `plot()`. The estimate behind each cell is [`estimate_ipr`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/estimator.py), and each encounter is one [`run_fleet`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/fleet.py) from spawn to termination.

`cache=True` stores one entry per condition, keyed on the config, the component identities and a fingerprint of the library source, so re-running the notebook replots without re-simulating and extending the sweep only runs the new cells.

At 30° both resolvers sit at zero losses in 500 encounters, which is where plain Monte Carlo runs out of resolution. Swapping `backend=MC(...)` for `backend=IPS(...)` estimates the same quantity by splitting, with the rest of the declaration unchanged — see [rare-event simulation](../estimators/rare-event/index.md).
