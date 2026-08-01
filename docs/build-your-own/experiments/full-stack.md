# Every seam at once

The [CDaRR page](cdarr.md) replaces the separation manager and keeps the rest of the library. This one replaces **everything**: every pluggable interface implemented from scratch, plus a wind field, run through `run_experiment` exactly as if it shipped with the package.

| seam | interface | written from scratch |
|---|---|---|
| noise shape | `NoiseDistribution` | `multipath` — a Gaussian core with a heavy tail |
| navigation | `NavigationModel` | `DriftingGnss` — a bias that random-walks between fixes |
| communication | `CommunicationModel` | `DutyCycleComm` — the link is up half the time |
| surveillance | `SurveillanceModel` | `DeadReckon` — extrapolate a stale fix rather than hold it |
| detection | `ConflictDetector` | `ProximityDetect` — react inside 100 m |
| resolution | `ConflictResolver` | `CloseRangeAvoid` — 90° right inside 70 m |
| recovery | `RecoveryCriterion` | `RangeClear` — resume past 120 m |
| kinematics | `Kinematics` | `LaggedRotor` — first-order velocity response |
| environment | `WindField` | swept: calm, and 14 m/s from the west |

Nothing is special-cased. The runner takes the objects and where they came from is not its concern.

## What feeds what

Once per tick, the nine components form one chain:

```
true AircraftState                      <- LaggedRotor.step produced it last tick
   |
   +-> DriftingGnss.evolve  ---------->  NavState      (the drifting bias, advanced once)
   +-> DriftingGnss.measure ---------->  Message       (a noisy self-fix, timestamped)
                                            |
        DutyCycleComm.step  <---------------+
                    |
                    +-------------------->  CommState  (what each receiver now holds)
                                               |
        DeadReckon.perceived <-----------------+
                    |
                    +-------------------->  Perception (own fix + the traffic it believes in)
                                               |
        ProximityDetect.detect <---------------+         -> is this pair a conflict?
        RangeClear.should_resume <-------------+         -> drop the pair from the active set?
        CloseRangeAvoid.resolve <--------------+         -> MotionCommand
                                                             |
        LaggedRotor.step <-----------------------------------+
                    |
                    +-------------------->  the next true AircraftState
```

Two things fall out of that diagram. The CDaRR stack only ever sees a `Perception`, never the truth. And `LaggedRotor.step` is handed the **true** state, because physics acts on what is real — only the *decisions* run on what was believed.

The notebook annotates every component with its own inputs, outputs, and which other component they come from.

## Two declarations, not one axis

A `Sweep` varies one parameter. A stack is nine, so stack-against-stack is two `Methods` bundles sharing everything else — the same seed, the same base config, the same swept geometry, so **both stacks fly the same 500 encounters at each condition**.

```python
STACKS = {
    "reference": Methods(detector=StateBased(), resolver=MVP(1.05), recovery=PastCPA(),
                         navigation=GnssNavigation(), communication=Comm(),
                         surveillance=LastKnown(), kinematics=Multirotor(), perf=M600),
    "mine":      Methods(detector=ProximityDetect(100.0), resolver=CloseRangeAvoid(70.0),
                         recovery=RangeClear(120.0), navigation=DriftingGnss(),
                         communication=DutyCycleComm(), surveillance=DeadReckon(),
                         kinematics=LaggedRotor(4.0), perf=M600),
}
```

`wind` is on the bundle too. It is not a pluggable model, but it is a per-run input the runner has to thread, so it is declared and swept the same way any component is.

## What comes out

<figure markdown="span">
  ![Two panels against crossing angle, four curves each. Left, P(LoS): both reference curves lie flat along zero from 10 to 90 degrees, while the two 'mine' curves climb from about 0.30 at 10 degrees to 0.80 at 90. Right, median minimum separation: the reference pair rises steeply from 83 metres at 10 degrees to about 300 at 90, while the 'mine' pair falls from 60 metres to 41, crossing below the 50 metre protected-zone line between 10 and 45 degrees.](../../assets/img/byo-full-stack.png)
  <figcaption>P(LoS) and median achieved separation against crossing angle, 500 encounters per point, for the two stacks. Solid is calm, dashed a 14 m/s wind; shaded bands are 95% Wilson intervals.</figcaption>
</figure>

The reference never loses separation in any of the six cells. The hand-written stack loses it in **30% to 80%** of encounters, and its median drops **below the protected zone** at 45° and 90° — 45.0 m and 40.6 m against a 50 m zone. The median encounter is a breach.

**The two run in opposite directions.** The reference improves as the crossing widens; ours gets steadily worse. Wide crossings are the easy end for a predictive detector and the hard end for a distance-triggered one, because the same distance buys less and less time:

| crossing | closing speed | time from the 100 m trigger | time from the 70 m turn |
|---|---|---|---|
| 10° | 1.74 m/s | 57 s | 40 s |
| 45° | 7.65 m/s | 13 s | 9 s |
| 90° | 14.14 m/s | **7 s** | **5 s** |

Five seconds is not enough for a laggy rotorcraft to turn 90° and translate clear. `StateBased` fires on `t_lookahead`, which is a *time*, so it is unaffected.

**`detection_rate` separates the two designs in one column**: ~1.0 for ours everywhere, 0.44 to 0.74 for the reference. A predictive detector stops firing once resolution has opened the predicted miss past `rpz`; a reactive one cannot, because it never predicted anything.

## The wind result is a lesson about the model, not the wind

`LaggedRotor` responds to wind at 10° and is **bit-identical** at 45° and 90°. That is not a wiring bug — it is arithmetic.

Substitute the wind $w$ into the update. The air-frame current and target are $c - w$ and $t - w$, the lag gives

$$a_{new} = (c - w) + k\,[(t - w) - (c - w)] = c - w + k\,(t - c)$$

and raising back to the ground frame adds $w$ again, leaving $v_{new} = c + k\,(t - c)$. **The wind has cancelled.** A first-order lag is a linear operator and a uniform wind is an additive shift, so the two commute exactly. The only thing that breaks it is the `v_max` clamp — the single nonlinearity — which at a 10 m/s cruise on an 18 m/s envelope needs about 15 m/s of wind. At 10° both aircraft fly nearly north and need 17.2 m/s of airspeed against the crosswind, so it fires; at 45° and 90° the intruder's leg needs about 10 m/s and never saturates.

`Multirotor` responds at every angle because it clamps its *target* to `v_max` before stepping, so its nonlinearity fires whenever a commanded ground velocity would need more than 18 m/s of airspeed.

This generalises past these two models: **any velocity tracker that is linear between saturation limits is blind to a uniform wind.** A wind shows up only through the envelope, through a non-uniform field, or through a controller working in the air frame rather than the ground frame.

!!! note "A wind approaching the cruise speed deletes the scenario rather than stressing it"
    The sweep is capped at 14 m/s for a second reason. `create_conflict` builds the geometry from *ground* velocities, and once the aircraft cannot fly those, the pair never converges. Swept to 20 m/s, every cell returned `detection_rate = 0` and both stacks reported identical medians — not a tie, but two stacks that never did anything, being blown apart in the same way.

## The honest limit

Nine components changed at once, so nothing here attributes the failure to any single one. This page demonstrates that the seams compose; the [CDaRR page](cdarr.md) changes three and is correspondingly easier to reason about, and changing one at a time is the [separation manager](../separation-manager/index.md) and [CNS](../cns/index.md) pages.

To find which component costs what, declare each as its own axis and read the cross-product — at the price of two-to-the-nth cells and a table that invites reading interactions the sample size cannot resolve.

## In the code

The page is one notebook, [`examples/handbook/byo_full_stack.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/byo_full_stack.ipynb), which defines all nine components, runs both sweeps, writes the figure and prints the table.

The interfaces are [`ConflictDetector`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cd/base.py), [`ConflictResolver`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cr/base.py), [`RecoveryCriterion`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/crr/base.py), [`Kinematics`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/kinematics/base.py), and `NavigationModel` / `CommunicationModel` / `SurveillanceModel` / `NoiseDistribution` in [`cns/base.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/base.py) — one abstract method each, except navigation which has [two](../../modules/cns/navigation.md#why-the-model-has-two-methods).
