# Communication

Communication is the **C** of [CNS](index.md). Once [navigation](navigation.md) has produced a measurement, does it reach the other aircraft — and how late? The model, [`Comm`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/communication.py), captures the *effect* of a real datalink like ADS-B or ADS-L, where messages can be lost, delayed, and received at irregular update intervals. Note that this modeling focuses on the **reception** and **latency**, without simulating its message protocol.

## Reception and latency, per directed link

When an aircraft broadcasts, that message is offered to every other aircraft **independently**. For each one, `Comm` draws two things:

- **reception** — a Bernoulli trial[^adsb] with `reception_prob` the message is delivered, otherwise it is lost and the receiver simply keeps whatever it already held.
- **latency** — if it *is* received, a delay is drawn from a `LatencyDistribution`, and the message becomes available once simulation time reaches `t_meas + delay`.

Testing reception first and drawing the delay only if received is a **design choice**, not a physical one. Because the two are drawn independently, the reverse order, draw the delay then test reception, gives exactly the same distribution of delivered messages.

```python
from opencdarr.cns.communication import Comm, lognormal_latency

comm = Comm(reception_prob=0.9, latency=lognormal_latency(median=0.1, sigma=0.25))
```

Three latency shapes are provided with the model: `constant_latency` (a fixed delay, drawing no randomness), `uniform_latency(low, high)`, and `lognormal_latency(median, sigma)`. At the default setting `reception_prob=1.0, latency=0.0` every broadcast lands in the same step it is sent, and the layer reduces exactly to instant, perfect delivery.

Because latency can in principle exceed the broadcast interval, a late old message could arrive *after* a newer one. The model guards against that by having a receiver keeps the message that is **freshest by `t_meas`**, never letting a straggler clobber a more recent fix.

## Directed and asymmetric

The reason reception is drawn per link, not per message, is that real links are not symmetric. Two aircraft can be the same distance apart yet sit in different levels of interference, and so have a different `reception_prob`. Reception is keyed by the transmission direction — read "from → to" — so `A → B` and `B → A` can differ, and one can be delivered while the other is dropped in the very same tick. Read more on reception probability in [this paper](https://journals.open.tudelft.nl/joas/article/view/7895).

```python
comm = Comm(reception_prob={("OWN", "INT"): 0.80,    # OWN's broadcasts often lost
                            ("INT", "OWN"): 0.99})   # INT's nearly always heard
```

Think of your partner trying to communicate with you while you are in a shower. The distance between you are the same but you are under the shower so you have more *interference*. Your partner outside the shower room can hear you better than you hear her, this is translates as the reception probability.

## Reception probability and the update interval

Reception and latency matter only through what they do to a receiver's **picture of the traffic**. What an aircraft acts on is never the intruder's current state, it is the last position it received. So the quantity that matters is the time between one received position update and the next, called **update interval**. When every message is received the update interval is just the broadcast interval.

<figure markdown="span">
  ![Two panels comparing a reliable link (reception 0.99) and a lossy link (reception 0.80). Left: the time since the last received update over time, a stairstep that sits at one broadcast interval for the reliable link and lengthens to two, three, and four seconds for the lossy one during runs of missed messages. Right: the update-interval distribution, a single bump at one second for the reliable link and a geometrically decaying series of bumps at one, two, three, four seconds for the lossy one.](../../assets/img/comm-update-interval.png)
  <figcaption>One aircraft broadcasting once a second, received over a reliable link (reception 0.99) and a lower one (0.80). Left: the time since the last received update, each delivery resets it to one broadcast interval, each missed message lengthens it, so the lower reception probability link reaches several seconds. Right: the update interval is geometric.</figcaption>
</figure>

Two things follow. First, since reception is a Bernoulli trial, the number of broadcasts until the next success is **geometric**: the update interval falls in **bumps at multiples of the broadcast interval** — one interval if the last message arrived, two after a miss, and so on — decaying geometrically. Second, at this rate the interval is set by **missed messages, not latency**: decisions run only once per broadcast interval, so a sub-second delay still lands before the next decision and a delivered message is one interval old either way — every *extra* interval is a dropped message. The reliable link stays at one interval; the lossy one (0.80) runs ~25% longer and occasionally reaches a **five-interval** gap.

## Latency: a small smear, not a longer gap

The other half of the channel is **latency**, the delay between a message being sent and received. At a 1 Hz broadcast rate it is nearly invisible. A delay drawn from `lognormal_latency(median=0.1, sigma=0.25)` is far below the one-second interval, so a message still arrives before the next decision. It never *lengthens* the update interval, it only spreads it slightly around one interval.

<figure markdown="span">
  ![Two panels of the time between received messages at reception 0.9, with a lognormal(0.1, 0.25) latency. Left: the full distribution, geometric bumps at one, two and three seconds set by dropped messages. Right: zoomed to the one-second bump, the sub-second latency smears it over roughly 0.9 to 1.1 seconds but never past one second.](../../assets/img/comm-latency.png)
  <figcaption>The <strong>time between messages received</strong> (reception 0.9, lognormal(0.1, 0.25) latency). Left: geometric bumps at multiples of the interval, set by dropped messages. Right: zoomed to the first bump, where sub-second latency only smears it to roughly 0.9 to 1.1 s, never past the interval. Latency bites only as it nears the broadcast interval; here, missed messages dominate.</figcaption>
</figure>

## When a broadcast happens

Reception and latency are the **channel**; *when* a message is sent is the **transmit schedule**, a separate [`BroadcastSchedule`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/broadcast.py) that mirrors the ADS-B split of transmission timing from reception. It sets the broadcast `interval`, an optional per-aircraft **phase** offset (unsynchronised transmitters), and per-transmission **jitter** (the slot dithering real ADS-B uses against co-channel collisions). The jitter gives each update-interval bump its **spread**; without it the bumps stay sharp.

The resulting update-interval distribution (with **reception probability**, **latency**, and **jitter**) closely matches what is observed in real ADS-B data, both studied by the [TU Delft ATM/CNS group](https://journals.open.tudelft.nl/joas/article/view/7895) ([and here](https://pure.tudelft.nl/ws/portalfiles/portal/31444950/12th_ATM_RD_Seminar_paper_83.pdf))

<figure markdown="span">
  ![Two panels of the update-interval distribution for a link at reception 0.9. Left: a jitter of plus or minus 0.1 seconds spreads each geometric bump into a small hump around its multiple of one, two and three seconds. Right: the same, with channel latency added on top, which looks essentially identical to the jitter-only case.](../../assets/img/comm-jitter.png)
  <figcaption>The update interval on a link at reception 0.9. Left: a ±0.1 s broadcast jitter spreads each geometric bump around its multiple of the interval. Right: adding channel latency on top barely changes it; the spread is the transmitter's, not the channel's, which is why jitter is a transmit-schedule setting and latency a channel one.</figcaption>
</figure>

## In the code

`Comm` lives in [`opencdarr/cns/communication.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/communication.py). It is switched on by passing `communication=` (and its own RNG substream `comm_rng=`, kept separate from the navigation stream) to `run_encounter` or `run_fleet`; without it, delivery is instant and perfect. A decision's view of another aircraft is then whatever [surveillance](surveillance.md) holds for that link — the last message it delivered, or nothing before first contact. The figure on this page is produced by [`scripts/handbook/communication.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/handbook/communication.py).

[^adsb]: The reception-probability formulation — a Bernoulli trial per message, with the geometric update-interval distribution it produces — follows Rahman, Ellerbroek, and Hoekstra, *Modelling ADS-B Reception Probability using OpenSky Data*, Journal of Open Aviation Science (Proceedings of the 12th OpenSky Symposium).
