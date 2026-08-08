# Case study: random traffic

What does a resolver do to random traffic, and is the choice of the resolver important? Three
resolvers (none, MVP, VO) against three fleet sizes (4, 6, 8 aircraft) gives nine conditions.

The traffic is [random traffic](../scenarios/random-traffic.md): the aircraft cross a disc of 1000 m
on random headings, released on a circle of 1200 m. Each aircraft is a
[DJI M600 multirotor](../aircraft/multirotor.md) at 10 m/s with a 10 m GNSS fix, the
protected zone is 50 m, and the look-ahead is 30 s. Detection is
[`StateBased`](../separation/conflict-detection.md) and recovery is the
[probabilistic criterion](../separation/recovery-criteria.md). The reported probability is
[for each aircraft](../estimators/monte-carlo.md#what-the-numerator-counts): the aircraft that lost
separation, over the aircraft that flew.

One drawn fleet of 6 aircraft, flown 50 times under each resolver, with the navigation noise as the
only difference between the repetitions:

![Three square panels of ground tracks, one for each resolver, in metres east and north from the centre of the disc. A dashed circle of 1000 m radius shows the measured disc. In each panel six tracks cross the disc as straight chords. In the panel with no resolver the tracks are straight lines and the title says that 50 of 50 repetitions lost separation. In the MVP panel and the VO panel two of the tracks turn where they meet, and the title says that 0 of 50 repetitions lost separation. The turns are drawn 50 times each, thus they are a narrow bundle and not one line](../../assets/img/experiment-random-traffic-tracks.png)

One fleet axis, used by the two calls:

```python
FLEET = Sweep([4, 6, 8], name="n_aircraft",
              build=lambda n: RandomTraffic(n, r_inner=1000.0, r_outer=1200.0))
```

Without a resolver the losses are frequent, thus the baseline uses Monte Carlo:

```python
baseline = run_experiment(
    {"scenario": FLEET, "resolver": Fixed(None)},
    methods=STACK, backend=MC(n_encounters=500), base_config=CFG, seed=1, n_jobs=-1,
)
```

With a resolver they are rare, thus the two resolvers use the rare-event estimator. The backend is
the only argument that changes:

```python
resolved = run_experiment(
    {"scenario": FLEET,
     "resolver": Sweep(["MVP", "VO"], name="resolver", build=RESOLVERS.__getitem__)},
    methods=STACK,
    backend=IPS(shells=Ladder(pilot=2000), n_particles=1000, reps=5),
    base_config=CFG, seed=1, n_jobs=-1, cache=True,
)
```

`Ladder` gives the [shells](../estimators/rare-event/index.md) from a pilot Monte-Carlo run of that
condition, because the conditions are not equally rare.

| aircraft | no resolver (MC) | MVP (IPS) | VO (IPS) |
|---|---|---|---|
| 4 | 0.284 | 4.2 × 10⁻⁵ | 1.1 × 10⁻² |
| 6 | 0.586 | 1.2 × 10⁻⁴ | 2.2 × 10⁻² |
| 8 | 0.800 | 5.7 × 10⁻⁴ | 5.0 × 10⁻² |

No replication collapsed. The pilot gave 12 to 24 shells for each condition, with survival
fractions between 0.20 and 1.00.

![One plot of P(LoS) for each aircraft against the number of aircraft in the disc, on a logarithmic vertical axis. Three lines increase from left to right. The line with no resolver is at the top, between 0.3 and 0.8. The VO line is in the middle, between 0.011 and 0.050. The MVP line is at the bottom, three to four orders of magnitude below the top line. ](../../assets/img/experiment-random-traffic.png)

The two backends do not report the same columns: Monte Carlo gives counts and the median achieved
separation, and IPS gives a replicated probability and a count of the collapsed replications. The
probability itself is the same quantity, for each aircraft, in both.

!!! note "Read the VO numbers as a measurement of this implementation"
    The MVP here is cross-checked against [BlueSky](https://github.com/TUDelft-CNS-ATM/bluesky) at
    the detection, the resolution, the turn dynamics and the recovery. The VO here is a
    re-derivation, and there is no reference implementation to check it against.

## In the code

The notebook is
[`examples/handbook/example_random_traffic.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/example_random_traffic.ipynb).
The scenario is
[`RandomTraffic`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/scenario/traffic.py),
which carries its own measurement area.

!!! code "Run it yourself"
    Run the notebook from the start to the end to reproduce the table and the two figures. The
    Monte-Carlo call needs approximately two minutes, and the rare-event call needs approximately
    one hour on eight cores. `cache=True` keeps one entry for each condition, thus a second run
    plots the results again and does not simulate them again.

This case study is the finished form of what [L5 · Beyond two aircraft](../../tutorials/l5-traffic.md) and [L8 · The full experiment](../../tutorials/l8-experiment.md) teach — traffic density as the axis, and both estimators on one question.
