# Navigation

Navigation is the **N** of [CNS](index.md). An aircraft measures its own position, and the measurement has a small error. That is the full task. One aircraft, its own sensor, one measurement. **The input** to the navigation model is the ground truth of the aircraft, the current time, and a random stream. The state itself carries the accuracy of the sensor as `pos_ci95` and `vel_ci95`. Then, **the output** is a `Message`, which holds the fix with its noise and the time of the measurement.

```python
nav = GnssNavigation()
message = nav.measure(nav.initial_state(), true_state, t=5.0, rng=rng)

message.state.lat       # the measured position, not the true one
message.t_meas          # the time of the measurement, which communication uses to find the age
message.state.pos_ci95  # the accuracy that the broadcast declares
```

The model applies the error **one time, at the source**. Thus all the parts after it get the same error. The aircraft broadcasts the incorrect position, the other aircraft accepts that position, and the conflict logic on the two sides uses it. One bad fix corrupts the perceived traffic at each receiver at the same moment. The `Message` then goes to [communication](communication.md), which decides if it arrives.

## What is provided by default

This library provides one model, four error shapes, one degradation effect, and the values that they pass to each other.

| Item | Name | Function |
|---|---|---|
| model | `GnssNavigation` | measures the position and the velocity, each with a replaceable error |
| error shape | `gaussian` | a round error, the default |
| | `make_mixture_gaussian` | a round error, with occasional large outliers |
| | `make_anisotropic_gaussian` | an ellipse, with more error north–south than east–west |
| | `make_anisotropic_mixture_gaussian` | an ellipse, with occasional large outliers |
| degradation | `GnssOutage` | a receiver that becomes worse, and possibly recovers |
| output | `Message` | the fix with its noise, and the time of the measurement |
| memory | `NavState` | the data that an effect keeps between two timesteps |
| quality | `NavQuality` | the increase above the nominal error, and the part that the broadcast declares |
| interfaces | `NavigationModel`, `NoiseDistribution`, `NavEffect` | for your own implementation |

That is the complete list. This library does not provide a bias that increases with time, a full multipath model, or a receiver that becomes worse above a city. To add one of these, refer to [writing your own](#writing-your-own). The task is smaller than it appears.

## Accuracy belongs to the aircraft, not the model

The usual design is `GnssNavigation(accuracy=20.0)`. This library does not use that design, and the reason is important.

A fleet has one navigation model, but it has many receivers, and the receivers are not equally good. One aircraft can have a survey-grade unit, and another aircraft can have a low-cost unit. The same aircraft can have a good fix above open country and a bad fix between buildings. Thus the two accuracy values belong to the **aircraft**:

- `pos_ci95` — the accuracy of the position in metres
- `vel_ci95` — the accuracy of the velocity in m/s

The default value of the two is `0.0`, which is a perfect sensor. Thus a run without navigation noise needs no configuration.

### What "95%" means, and where 0.4085 comes from

The datasheet of a receiver gives the accuracy as a **95% radial CI**. This value is the radius of a circle that contains 95 fixes out of 100. It is *not* a standard deviation. If you use the two as the same quantity, the error is a factor of 2.4.

The model draws the error as a round 2D Gaussian, with one draw for each axis. The distance from the ground truth then has a Rayleigh distribution. The 95th percentile of this distribution is at $\sigma\sqrt{5.9915}$. Thus the sigma for a given 95% radius is

$$\sigma = \frac{\text{CI95}}{\sqrt{5.9915}} \approx 0.4085 \times \text{CI95}$$

An accuracy of 20 m gives a sigma of approximately 8.2 m for each axis. Over 8 000 fixes, the 95th percentile of the error is 19.7 m against a target of 20 m, and 95.4% of the fixes are in the circle.

## The four error shapes

`pos_ci95` sets the *size* of the error. The **shape** is a separate choice, and this library provides four shapes. The position and the velocity use independent shapes, because they come from different measurements in the same receiver. The position comes from the time of the satellite signals, and the velocity comes from their Doppler shift. Thus the two errors do not have to occur together.

<figure markdown="span">
  ![Four scatter panels of the position error. Each panel has 4000 points and a grey circle at the accuracy of 20 m. The gaussian panel is a round blob, and most points are in the circle. The mixture panel is round, but occasional points are two to three times further out. The anisotropic panel is a vertical ellipse, longer north-south than east-west. The anisotropic mixture panel is a long ellipse with points far from the centre.](../../assets/img/nav-error-shapes.png)
  <figcaption>The four shapes at the same accuracy of 20 m. The grey circle is <code>pos_ci95</code> in each panel, and 95% of the points are in the circle in all four panels. That is the property that the four shapes share.</figcaption>
</figure>

| Shape | Appearance | Use |
|---|---|---|
| `gaussian` | a round blob | the default, if you have no reason for a different shape |
| `make_mixture_gaussian` | round, with rare points far from the centre | multipath, where signals reflect off buildings |
| `make_anisotropic_gaussian` | an ellipse, longer than it is wide | satellite geometry that is better in one direction |
| `make_anisotropic_mixture_gaussian` | a long ellipse, with points far from the centre | the two conditions together |

The ellipse is **aligned with the axes, not with the aircraft**. The positions of the satellites give the shape of the GNSS error, and the heading of the aircraft has no effect on it. Thus the distribution never reads the heading.

!!! note "The same advertised accuracy hides a factor-of-two difference in the worst case"
    All four shapes keep 95% of their fixes in a circle of 20 m. Over 20 000 draws, the worst single fix was **40.7 m** for `gaussian` and **79.0 m** for the anisotropic mixture. If your question is the frequency of the *unlucky* condition, the shape gives the full answer. The accuracy value gives no data about it.

A single number gives the size of an error, but it does not give the shape of the error. That is the reason for more than one shape.

## A declared accuracy that is not correct

A broadcast carries an accuracy value, with which the sender tells the other aircraft how much to trust the fix. By default, this value is correct. The model draws the error from `pos_ci95`, and it puts the same number on the air.

`pos_ci95_declared` separates the two values. Use this setting to study a sensor that declares an incorrect accuracy:

```python
liar = replace(aircraft, pos_ci95_declared=5.0)   # 20 m error, declares 5 m
```

The declared value has no effect on the draw. Thus the same seed gives the same fix, and only the label changes. There are two conditions, and they have opposite results:

- **A declared accuracy that is better than the true accuracy.** The receiver calculates its safety margin from a confident value that is incorrect. Receiver autonomous integrity monitoring exists to find this integrity failure. This is the only condition in which an aircraft acts with confidence on bad data.
- **A declared accuracy that is worse than the true accuracy.** The transmitter declares a lower performance than it has. The receivers are then more careful than necessary, which is inefficient but not dangerous.

## A receiver that becomes worse

All the text above assumes that the sensor is as good at the end of the flight as at the start. `NavEffect` is the hook for a sensor that becomes worse, and `GnssOutage` is the only implementation in this library.

`GnssOutage` models a receiver that loses satellites. The fix becomes **worse**, but it does not stop. This difference is deliberate. An aircraft with a degraded GNSS continues to broadcast a position, but that position is bad. An aircraft that stops all transmission has a *radio* failure, which `RadioHealth` on the [communication](communication.md) side models. One physical event has one model.

```python
GnssOutage(
    fail_rate=40.0,      # outages per hour
    recover_rate=25.0,   # per hour, 0 (the default) prevents recovery
    pos_factor=10.0,     # the factor on the error during the outage
    declare=True,        # does the broadcast declare the outage?
)
```

<figure markdown="span">
  ![The effective accuracy of the position against time for two aircraft over ten minutes. The two curves step between the nominal 20 m and the degraded 200 m, but at different times and for different durations. One aircraft is degraded for most of the run, and the other aircraft is nominal for most of the run.](../../assets/img/nav-outage.png)
  <figcaption>Two receivers with the same outage model, over ten minutes. They fail and recover independently. In this run, one receiver was degraded for 23% of the time and the other for 96%. With <code>recover_rate=0</code>, the step up is permanent.</figcaption>
</figure>

Two details are more important than they appear.

**The rates are per hour, not per broadcast.** A mean time to failure of half an hour is half an hour at 1 Hz and at 2 Hz. With a rate for each message, a change of the broadcast cadence also changes the failure rate. A cadence study then moves two quantities at the same time.

**`declare` is the important switch.** `True` is a transponder that declares its lower performance, so the receivers increase their margins correctly. `False` is a fix that becomes bad while the broadcast continues to declare the nominal accuracy. That condition causes the damage, because all the aircraft are then confidently incorrect.

!!! note "Estimate an outage study with plain Monte Carlo, not the rare-event estimator"
    A rare outage is the incorrect shape for splitting. It is a sudden jump, and the minimum separation gives no data about it. Thus the [shells](../../estimators/rare-event/index.md) cannot steer towards it. A *continuous* degradation of the accuracy is different, because it couples to the separation and splits correctly. A sensor that is permanently degraded needs no effect at all. It is only a larger `pos_ci95`.

## Why the model has two methods

`NavigationModel` requires `measure`, and it offers `evolve`. The difference between the two is not obvious, so:

| | `evolve` | `measure` |
|---|---|---|
| runs | one time in each timestep, for each aircraft | one time for each aircraft that transmits |
| memory | can change the memory of the model | can only read the memory |
| output | the new memory | the `Message` |

**All the operations that change the state are in `evolve`**, and the reason is reproducibility. Only some aircraft transmit in a given timestep. If `measure` changed the state, the number of random draws would depend on *which aircraft transmitted*. A change of the broadcast schedule would then move every subsequent random number in the run. `evolve` runs one time in each timestep for each aircraft. Thus the draws stay in the same place.

If your model has no state, ignore `evolve`. The default implementation does nothing, and it makes no draw.

## Writing your own

### An error shape

A shape is a function. It takes a generator and an accuracy, and it returns an east error and a north error in metres. It is not a class and not a subclass.

```python
def uniform_disk(g, ci95):
    radius = ci95 / math.sqrt(0.95)          # this size gives 95% of the draws inside ci95
    r = radius * math.sqrt(g.random())
    a = g.uniform(0.0, 2.0 * math.pi)
    return r * math.cos(a), r * math.sin(a)

nav = GnssNavigation(pos_distribution=uniform_disk)
```

!!! note "Draw the same number of times whatever the accuracy is, including zero"
    A shape can stop at `ci95 == 0` and make no draw. Then every subsequent random number in that run moves. A sweep over `pos_ci95` is then not a controlled comparison, because the zero cell uses a different noise stream from its neighbours. Multiplication of the output by zero has no cost. A draw that you do not make has a cost in correctness.

### A degradation effect

An effect has three methods. They give the initial state, the advance of the state, and the result for one aircraft. Return a `NavQuality` with the increase of the error (`pos_scale`) and the part of the increase that the broadcast declares (`pos_declared`). The value `1.0` for the two shows no failure. This library multiplies the values of more than one effect.

The same rule for the draws applies, for the same reason.

**[Build your own → CNS → Navigation](../../build-your-own/cns/navigation.md)** gives a worked example of the two.

## Where the fix goes next

The `Message` from this module goes to [communication](communication.md), which decides if it arrives and how late. It then goes to [surveillance](surveillance.md), which decides what a receiver perceives between two deliveries. The output of that chain is the only view that the [conflict logic](../separation/index.md) receives.

The score of a run uses the **true** states. The navigation error changes what the aircraft *do*. It never changes how the tool measures them.

## In the code

`GnssNavigation` is in [`opencdarr/cns/navigation.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/navigation.py), and the four error shapes are in [`noise_distributions.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/noise_distributions.py). To switch it on, pass `navigation=` to `run_encounter` or `run_fleet`. Also pass its own RNG substream `rng=`, which stays separate from the communication stream. Without `navigation=`, each aircraft measures its own state exactly. The two accuracy values stay on the aircraft state as `pos_ci95` and `vel_ci95`, and a run with no navigation model never reads them.

**Error shapes and `NavEffect` implementations** add the effects that `GnssNavigation` does not have, and a subclass of the model is not necessary. A shape is a function, and an effect holds its own state. Thus a receiver outage and a bias that increases with time are two effects, not a new class for the combination. To write a shape, an effect, or a full navigation model, refer to [Build your own → Navigation](../../build-your-own/cns/navigation.md).

[`examples/handbook/navigation.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/navigation.ipynb) makes every number and the two figures on this page.

!!! code "Run it yourself"
    The same notebook uses each setting on this page. It shows one measurement, then the four error shapes, then a declared accuracy that is not correct, then the `NavEffect` degradation, then the full stack, and last the two extension points. Run the notebook from the start to the end to reproduce the numbers.
