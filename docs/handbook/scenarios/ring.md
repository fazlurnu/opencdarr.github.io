---
authorship: opus-5
---

# Ring

A **ring** is the multi-aircraft stress case. It places `n` aircraft evenly around a centre and sends every one of them through the middle. Each aircraft then resolves against `n - 1` others at the same time, and each resolution changes the geometry that the others are solving. A ring of `n` aircraft holds `n * (n - 1) / 2` pairs, so a fleet size (`n`) of 6 is 15 pairs and a fleet size of 8 is 28. Every one of those pairs can lose separation.

This is what a [pairwise conflict](pairwise.md) cannot reach. There the resolution is a two-body problem with one answer. Here the answer moves while it is being computed.

## The three rings

This library provides three ring scenarios. All three place the fleet the same way, on `n` bearings spaced evenly around a centre. They differ in what each aircraft is aimed at, and in whether it carries a goal.

| scenario | each aircraft is aimed at | goal | sizing |
|---|---|---|---|
| `SwapRing` | another aircraft's start, the one `n // 2` places round the ring | that start position | `radius` |
| `CrossingRing` | the point opposite its own start, as a heading reference only | none | `radius` or `t_to_centre` |
| `ConvergingRing` | the ring centre | the centre | `radius` or `t_to_centre` |

`SwapRing` is `n / 2` simultaneous head-on pairs, all crossing the middle. `ConvergingRing` is the symmetric superconflict, where the goal itself is incompatible with separation. The aircraft cannot all occupy the centre, because the protected zone (`rpz`) forbids it, so the [separation stack](../separation/index.md) can only hold them apart as they close.

`CrossingRing` cruises straight across the diameter and carries no goal at all. That is what makes its declared `speed` the speed actually flown. A goal would turn each aircraft's nominal into a position command, and a position command is tracked by the airframe's own guidance. A [multirotor](../aircraft/kinematics/multirotor.md) reads only the range to the waypoint and flies `min(v_max, sqrt(2 * ax * range))`. At a range of 1400 m a DJI M600 gives `min(18.0, 118.3)`, so an M600 asked to cruise at 14 m/s would cover the ring at its 18 m/s ceiling instead. With no goal each aircraft holds the constant cruise it was placed at, and the placed geometry is exactly the geometry flown.

At even `n` the first two place the same positions on the same tracks, and differ only in that `SwapRing` carries a goal and `CrossingRing` cruises. At odd `n` they part company. `SwapRing` aims at a start that is not the antipode, so its routes miss the centre by `radius * cos(180 * (n // 2) / n)`, which is 750 m at `n = 3` on a 1500 m ring. Use `CrossingRing` when the fleet size is the variable, because a sweep over `SwapRing` steps the geometry at every odd value as well as the size.

`SwapRing` is also the one ring with no `t_to_centre`. Its routes do not always reach the centre, so a flight time to the centre would name an arrival that never happens.

## The mixed fleet

`speed` takes one value for the whole fleet, or one value per aircraft in ring order. The sequence form is what a mixed fleet needs. The built-in `SMALL_FIXEDWING` stalls at 12 m/s, above the 10 m/s a multirotor normally cruises at, so a single fleet speed either stalls one airframe or flies the other well above its real cruise.

The fleet here is the one from [T3](../../tutorials/t3-setting-up-an-experiment.md). We place six aircraft in ring order at 14, 20, 17, 17, 14 and 20 m/s. Two are DJI M600 multirotors at 14 m/s, two are a user-written fixed-wing at 20 m/s, and two are the built-in `SMALL_FIXEDWING` at 17 m/s.

```python
from opencdarr.scenario import CrossingRing

SPEEDS = (14.0, 20.0, 17.0, 17.0, 14.0, 20.0)  # m/s, in ring order
```

At a fleet size (`n`) of 6 the ring pairs aircraft `k` with aircraft `k + 3`, so this order makes every head-on pair a mixed pair. At one fleet speed the two sizing parameters below are the same parameter, related by `radius = speed * t_to_centre`. For this fleet they are two different experiments.

## Sizing by arrival time

The flight time to the centre (`t_to_centre`) places every aircraft the same flight *time* from the middle. Each start radius is then that aircraft's own cruise times that time.

```python
CrossingRing(n=6, t_to_centre=100.0, speed=SPEEDS).radii()
# [1400.0, 2000.0, 1700.0, 1700.0, 1400.0, 2000.0]
```

At a flight time to the centre (`t_to_centre`) of 100 s the fleet starts at 1400 m, 2000 m and 1700 m, one radius per cruise. The whole fleet arrives at once whatever each aircraft is flying, and that is what keeps the six-aircraft conflict one event. The price is that a mixed fleet no longer sits on a circle. The geometry is six radii and not one.

`radii()` reports those start distances in fleet order, as metres from the centre. Quote them rather than "the ring radius" once the fleet is mixed, because there is then no single radius to quote.

## Sizing by start circle

The start circle (`radius`) places every aircraft on one circle. It is 1500 m when neither knob is given.

```python
CrossingRing(n=6, radius=1500.0, speed=SPEEDS).radii()
# [1500.0, 1500.0, 1500.0, 1500.0, 1500.0, 1500.0]
```

The fleet is a ring again, but it is no longer a simultaneous encounter. The time to the centre is `radius / speed` per aircraft. On a 1500 m circle the two aircraft at 20 m/s reach the middle at 75.0 s, the two at 17 m/s at 88.2 s, and the two M600s at 14 m/s at 107.1 s. That is a spread of 32.1 s across a fleet of six, and the six-aircraft superconflict becomes a staggered sequence of smaller ones.

For `ConvergingRing` the effect is sharper, because there the centre is the goal rather than a point on the way. Under `radius` the slow aircraft do not merely arrive late. They arrive to find the fast ones already holding station at the middle.

Use `t_to_centre` when the `n`-aircraft conflict has to be one event. Use `radius` when the start circle is what has to be held fixed, and a staggered arrival is either acceptable or is itself the subject.

## Both parameters at once

Giving both is refused rather than resolved by precedence.

```python
CrossingRing(n=6, radius=1500.0, t_to_centre=100.0, speed=SPEEDS).radii()
# ValueError: give radius or t_to_centre, not both (radius=1500, t_to_centre=100)
```

The two set the same start positions, so one of them would have to win silently. The run file would then keep the loser on the page as documentation of a geometry that was never flown.

## A placed geometry

A ring is placed rather than drawn. Its `draw` reads no random number, so the geometry is the experiment and not a sample from it. When nothing else in the run is stochastic, every encounter is the same encounter, and one run says what a thousand would. Both committed ring run files therefore declare a perfect sensor and a sampling effort (`n_encounters`) of 1. Raise that effort once something in the run does read a random number, such as a noisy position fix or a lossy datalink.

## In the code

The three scenarios and their function forms are in [`opencdarr/scenario/ring.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/scenario/ring.py). `_start_radii` is where the difference between the two sizing parameters is written down, and `radii()` is the accessor that reports the result. The multi-aircraft stress case is worked in [`circle_scenario.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/circle_scenario.ipynb), a ring swept over fleet size with and without resolution, and [`ring_mc_vs_ips.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/ring_mc_vs_ips.ipynb), two to four aircraft on a ring under both estimators; the mixed-fleet declaration is worked in [`mixed_fleet.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/mixed_fleet.ipynb).

Two committed run files fly a ring. [`configs/ring.yaml`](https://github.com/fazlurnu/OpenCDaRR/blob/main/configs/ring.yaml) is an eight-aircraft `crossing_ring` at one fleet speed of 10.2889 m/s on a start circle (`radius`) of 1500 m, which is 145.8 s to the centre and 28 pairs. [`configs/ring_t3.yaml`](https://github.com/fazlurnu/OpenCDaRR/blob/main/configs/ring_t3.yaml) is the six-aircraft ring of [T3](../../tutorials/t3-setting-up-an-experiment.md), sized by a flight time to the centre (`t_to_centre`) of 100 s, which is 1400 m for its uniform 14 m/s fleet.

```yaml
scenario:
  type: crossing_ring   # also: swap_ring, converging_ring
  n: 6                  # fleet size, so 15 pairs
  speed: 14.0           # m/s, one value for the fleet or one per aircraft
  t_to_centre: 100.0    # s, or radius: in metres, never both
```
