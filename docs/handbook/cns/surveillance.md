# Surveillance

Surveillance is the **S** of [CNS](index.md), and it is the receiving end of the chain. [Communication](communication.md) delivers a message or loses it. Surveillance then decides what an aircraft *holds* as its perceived traffic. **The input** to the surveillance model is the channel state from communication, the receiver, the source, and the current time. Then, **the output** is the perceived `AircraftState` of that source. Before that link delivers its first message, the output is `None`.

```python
perceived = LastKnown().perceived(state, receiver="OBS", source="SRC", t_now=0.0)
```

A decision reads that perceived state. A value of `None` shows that the receiver has never received a message from the source. The loop then flies that directed pair on its nominal path, and it does not estimate a position.

## The default, `LastKnown`

`LastKnown` holds the **last message from each directed link**, and it does not extrapolate the state forward.

When an update is lost or delayed, a receiver has two options. It can hold the last message without a change, or it can extrapolate that message forward along the last known velocity of the source. `LastKnown` holds the message. Extrapolation assumes that the source continued on a straight path. This assumption is incorrect at the most important moment, because a dead-reckoned estimate diverges from the truth when the source starts a manoeuvre. A held message shows correctly what data the receiver has. The data is a fix of a known age, not an estimate in the form of a measurement.

The result is that the perceived state becomes **stale** between two updates. In the figure below, a source flies at a ground speed that changes with time, and this speed has no noise. The source broadcasts its state one time each second, and the observer receives each broadcast with a probability of 0.88. After each lost update, the observer holds the previous value. Thus the perceived speed is a staircase with a lag behind the ground truth.

![The ground speed over one minute. The true speed has no noise, and it is a smooth curve. The hold-as-is view at the observer is a staircase. The staircase stops at each lost update, and the lag is largest where the true speed changes most quickly.](../../assets/img/surveillance-hold-as-is.png)

There is no measurement noise in this run. Thus the speed of the source is exact, and each *delivered* fix is exact. The **lost messages alone** cause the full difference between the true curve and the staircase. The lag is largest where the true speed changes most quickly, and the lag becomes zero at the turning points, where a stale value is still correct. That is the purpose of hold-as-is. The staleness is visible, and the update interval limits it. An extrapolation that looks correct hides the staleness.

## In the code

`LastKnown` is in [`opencdarr/cns/surveillance.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/surveillance.py). To switch it on, pass `surveillance=` to `run_encounter` or `run_fleet`. The model makes no random draw, so it needs no RNG substream of its own. Without `surveillance=`, each decision reads the state of the source directly. The same module has `age`, which gives the time since the last delivery on a link, or `None` before the first contact.

## The contract

A model of your own implements [`SurveillanceModel`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/base.py) with the one method `perceived(state, receiver, source, t_now)`, and a subclass of `LastKnown` is not necessary. A model that extrapolates the last message forward, or one that holds a message for a maximum age only, is a separate implementation beside it, judged in the same runs.

!!! code "Learn by doing"
    [L1.16 · CNS: surveillance](../../tutorials/l1-parts.md) (30 min, core) reads what the separation logic reads, one timestep through the full chain. A model of your own is [L7](../../tutorials/l7-write-your-own.md).
