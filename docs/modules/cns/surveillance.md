# Surveillance

Surveillance is the **S** of [CNS](index.md): given what [communication](communication.md) delivers or drops, it determines what an aircraft ends up *holding* as its picture of the traffic. It is the receiving end of the chain, the state a decision actually reads.

The default model, `LastKnown`, holds the **last message each directed link delivered**, with no dead-reckoning forward. Before a link's first delivery it holds nothing, so that neighbour is dropped from the perceived set until first heard rather than guessed at.

## Hold-as-is, not dead-reckoning

When an update is dropped or delayed, a receiver can either **hold** the last message unchanged or **extrapolate** it forward along the source's last known velocity. `LastKnown` holds. Extrapolation assumes the source kept flying straight, which is wrong exactly when it matters most: the moment the source *starts* manoeuvring is the moment a dead-reckoned estimate diverges from reality. Holding is the honest picture of what the receiver actually has, a fix of known age rather than a guess dressed up as a measurement.

The consequence is that the perceived state goes **stale** between updates. Below, a source flies a noise-free but time-varying ground speed and broadcasts it every second; the observer receives each broadcast only with probability 0.88. Every dropped update leaves it holding the previous value, so the observed speed is a staircase that lags the truth.

![Ground speed over one minute: the true noise-free speed as a smooth curve, and the observer's hold-as-is view as a staircase that freezes on each dropped update, lagging most where the true speed changes fastest.](../../assets/img/surveillance-hold-as-is.png)

There is no measurement noise here: the source's speed is exact and every *delivered* fix is exact. The whole gap between the true curve and the staircase comes from **missed messages alone**. The lag is largest where the true speed changes fastest and vanishes at the turning points, where a stale value happens to still be right. That is the point of hold-as-is: staleness is visible and bounded by the update interval, not hidden inside a plausible-looking extrapolation.

```python
from opencdarr.cns.base import CommState, Message
from opencdarr.cns.communication import Comm
from opencdarr.cns.surveillance import LastKnown
from opencdarr.rng import generator, root_seed_sequence
from opencdarr.state import AircraftState

comm = Comm(reception_prob={("SRC", "OBS"): 0.88})   # 88% of broadcasts reach OBS
surveil = LastKnown()
rng = generator(root_seed_sequence(0))
state = CommState()

source = AircraftState(id="SRC", lat=52.0, lon=4.0, trk=90.0, gs=24.0, vel_ci95=0.0)
state = comm.step(state, [Message("SRC", source, t_meas=0.0)], ["SRC", "OBS"], t=0.0, rng=rng)

perceived = surveil.perceived(state, receiver="OBS", source="SRC", t_now=0.0)
print(perceived.gs if perceived else "not heard yet")   # the held speed, or None before first contact
```
