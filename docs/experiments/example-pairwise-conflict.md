# Ex: pairwise conflict

How do MVP and VO hold up as the crossing becomes shallow and the position fix becomes worse?

Two [DJI M600 multirotors](../modules/kinematics/multirotor.md) at 10 m/s, head-to-head
(`dcpa = 0`) at 180 s from the entry to the protected zone, a 50 m protected zone and a 120 s
look-ahead, [`StateBased`](../modules/separation/conflict-detection.md) detection and
[Past-CPA](../modules/separation/recovery-criteria.md) recovery. Three parameters are swept, thus
the cross-product is 4 × 2 × 2 = 16 conditions of 500 encounters each.

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

Each condition reports P(LoS) for each aircraft, and the median separation that the encounters
achieved:

![Two panels against the crossing angle. Left, P(LoS): the two VO curves decrease steeply from approximately 0.8 and 0.97 at 2 degrees to zero at 30 degrees, and they are far apart from each other. The two MVP curves are on top of each other and near zero at each angle. Right, the median minimum separation: the four curves increase together from approximately 20 to 55 metres at 2 degrees to approximately 170 metres at 30 degrees. The two VO curves are much below the two MVP curves at 2 degrees, and they come together at 10 degrees.](../assets/img/exp-response-curves.png)

The two MVP curves are on top of each other: 0.050 against 0.046 at 2°, and 0.038 against 0.032 at
5°. The two VO curves separate: 0.248 increases to 0.454 at 5°, and 0.038 increases to 0.098 at 10°.
Each number is 500 encounters, thus a difference of a few thousandths is not a measurement and a
difference of a factor of two is.

!!! note "Read the VO numbers as a measurement of this implementation, and not of velocity obstacles"
    The MVP here is cross-checked against [BlueSky](https://github.com/TUDelft-CNS-ATM/bluesky) at
    the detection, the resolution, the turn dynamics and the recovery. The VO here is a
    re-derivation, and there is no reference implementation to check it against.

One encounter at 2° with a 10 m position fix, with the ground tracks, the true relative geometry,
and the same geometry from the noisy self-fixes that the aircraft broadcast:

![Three rows for one encounter at 2 degrees. Top, the ground tracks to scale: the six tracks are one line that is almost vertical and approximately 5 km long. Middle, the true relative geometry and the separation: the case with no resolver goes through the 50 m circle, MVP goes above it, and VO cuts through it. Bottom, the same geometry as the ownship believed it: it is ragged, and it moves by tens of metres at each timestep.](../assets/img/exp-encounter.png)

The outcome is scored on the true states, and `min_sep` never sees the noise. The resolver acts on
the broadcasts only: MVP believed that it was 41.9 m from the intruder while the true distance was
54.9 m, and VO believed 20.3 m against a true 27.4 m.

## In the code

The notebook is
[`examples/handbook/example_pairwise_conflict.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/example_pairwise_conflict.ipynb).
The declaration layer is
[`experiment.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/experiment.py), the
estimate behind each cell is
[`estimate_ipr`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/estimator.py), and each
encounter is one
[`run_fleet`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/fleet.py).

!!! code "Run it yourself"
    Run the notebook from the start to the end to reproduce each number and the two figures on
    this page.
