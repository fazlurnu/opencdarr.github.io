# Communication

Communication is the **C** of [CNS](index.md). Once [navigation](navigation.md) has produced a measurement, `Comm` decides whether it reaches the other aircraft, and how late. The model, [`Comm`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/communication.py), captures the *effect* of a real datalink like ADS-B or ADS-L, where messages can be lost, delayed, and received at irregular update intervals. Note that this model focuses on **reception** and **latency**, without simulating the message protocol itself.

Six settings act on the path from one aircraft's broadcast to another's picture of it. Three belong to the **transmit schedule** — when a message is sent — and three to the **channel**, what happens to it afterwards:

| Setting | Where it lives | Unit | What it does |
|---|---|---|---|
| `interval` | `BroadcastSchedule` | s | how often an aircraft transmits (`at_rate` takes Hz instead) |
| `phase` | `BroadcastSchedule` | s | per-aircraft start offset, so transmitters are not synchronised |
| `jitter` | `BroadcastSchedule` | s | per-transmission slot dither, `U(-j, +j)` on each gap |
| `reception_prob` | `Comm` | probability | that a message is delivered, per directed link |
| `latency` | `Comm` | s | how late a delivered message is |
| `tx_fail_rate` / `rx_fail_rate` | `RadioHealth` | **per hour** | a transmitter or receiver that fails for a stretch of time; mean time to failure is `1 / rate` hours |
| `tx_recover_rate` / `rx_recover_rate` | `RadioHealth` | **per hour** | how quickly it comes back; `0` (the default) makes the failure permanent |

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

Because latency can in principle exceed the broadcast interval, a late old message could arrive *after* a newer one. The model guards against that: a receiver always keeps the message that is **freshest by `t_meas`**, never letting a straggler clobber a more recent fix.

## Directed and asymmetric

The reason reception is drawn per link, not per message, is that real links are not symmetric. Two aircraft can be the same distance apart yet sit in different levels of interference, and so have a different `reception_prob`. Reception is keyed by the transmission direction — read "from → to" — so `A → B` and `B → A` can differ, and one can be delivered while the other is dropped in the very same tick. Read more on reception probability in [this paper](https://journals.open.tudelft.nl/joas/article/view/7895).

```python
comm = Comm(reception_prob={("OWN", "INT"): 0.80,    # OWN's broadcasts often lost
                            ("INT", "OWN"): 0.99})   # INT's nearly always heard
```

The same distance does not guarantee the same reception. A physical obstruction, an antenna orientation, or a stronger receiver on one side can make one direction more reliable than the other, even between the same two aircraft.

!!! note "Two orderings, deliberately opposite"
    `reception_prob` is keyed `(source, receiver)` — the link *carrying* a broadcast. What a receiver ends up holding is keyed `(receiver, source)` — what B *knows about* A. They answer different questions, so `("AC1", "AC2")` is the link on which AC2's view of AC1 arrives. A link absent from the mapping defaults to 1.0, which is why a mistyped identifier would silently apply no loss at all; `validate_ids` checks the mapping against the real fleet when the run is built, so the typo fails loudly instead.

## Reception probability and the update interval

Reception and latency matter only through what they do to a receiver's **picture of the traffic**. What an aircraft acts on is never the intruder's current state — it is the last position it received. So the quantity that matters is the time between one received position update and the next, called **update interval**. When every message is received the update interval is just the broadcast interval.

<figure markdown="span">
  ![Two panels comparing a reliable link (reception 0.99) and a lossy link (reception 0.80). Left: the time since the last received update over time, a stairstep that sits at one broadcast interval for the reliable link and lengthens to two, three, and four seconds for the lossy one during runs of missed messages. Right: the update-interval distribution, a single bump at one second for the reliable link and a geometrically decaying series of bumps at one, two, three, four seconds for the lossy one.](../../assets/img/comm-update-interval.png)
  <figcaption>One aircraft broadcasting once a second, received over a reliable link (reception 0.99) and a lower one (0.80). Left: the time since the last received update, each delivery resets it to one broadcast interval, each missed message lengthens it, so the lower reception probability link reaches several seconds. Right: the update interval is geometric.</figcaption>
</figure>

Two things follow. First, since reception is a Bernoulli trial, the number of broadcasts until the next success is **geometric**: the update interval falls in **bumps at multiples of the broadcast interval** — one interval if the last message arrived, two after a miss, and so on — decaying geometrically. Second, at this rate the interval is set by **missed messages, not latency**: decisions run only once per broadcast interval, so a sub-second delay still lands before the next decision and a delivered message is one interval old either way — every *extra* interval is a dropped message. The reliable link stays at one interval; the lossy one (0.80) runs ~25% longer and occasionally reaches a **five-interval** gap.

## Latency: a small smear, not a longer gap

The other half of the channel is **latency**, the delay between a message being sent and received. At a 1 Hz broadcast rate it is nearly invisible. A delay drawn from `lognormal_latency(median=0.2, sigma=0.3)` has a median of 0.2 s — a fifth of the interval — so a message still lands well before the next decision. It never *lengthens* the update interval, it only spreads it around one.

<figure markdown="span">
  ![Two panels. Left: the lognormal delay distribution, a right-skewed hump peaking near 0.2 seconds with a thin tail out to about 0.6 seconds. Right: the update-interval distribution on a link at reception 0.6, four separate bumps centred on one, two, three and four seconds, each smeared around a dashed reference line marking where that bump would sit with no latency at all.](../../assets/img/comm-latency.png)
  <figcaption>Left: the delay itself, <code>lognormal(median 0.2, sigma 0.3)</code>. Right: what it does to the update interval on a lossy link (reception 0.6). Without latency every gap is exactly a whole number of intervals — the dashed lines — because a gap is just a count of dropped messages. Adding the delay <strong>smears each bump around its multiple without moving it</strong>: the mean update interval shifts by 0.003 s, from 1.634 s to 1.637 s, while the spread grows 3%. Every extra interval is a missed message, not a slow one.</figcaption>
</figure>

That separation is what makes the two settings independent knobs. Reception sets *which* bump a gap falls into; latency only sets how wide each bump is. A delay would have to approach the broadcast interval before it started merging one bump into the next.

## When a broadcast happens

Reception and latency are the **channel**; *when* a message is sent is the **transmit schedule**, a separate [`BroadcastSchedule`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/broadcast.py) that mirrors the ADS-B split of transmission timing from reception. It sets the broadcast `interval` (or `at_rate` in hertz), an optional per-aircraft **phase** offset (unsynchronised transmitters), and per-transmission **jitter** (the slot dithering real ADS-B uses against co-channel collisions). The jitter gives each update-interval bump its **spread**; without it the bumps stay sharp.

The default schedule aligns every aircraft at `t = 0`. That is the pessimally correlated case — the whole fleet updates on the same tick — so a phase offset is closer to real unsynchronised transmitters than the default is.

The resulting update-interval distribution (with **reception probability**, **latency**, and **jitter**) closely matches what is observed in real ADS-B data, both studied by the [TU Delft ATM/CNS group](https://journals.open.tudelft.nl/joas/article/view/7895) ([and here](https://pure.tudelft.nl/ws/portalfiles/portal/31444950/12th_ATM_RD_Seminar_paper_83.pdf))

<figure markdown="span">
  ![Two panels of the update-interval distribution for a link at reception 0.9. Left: a jitter of plus or minus 0.1 seconds spreads each geometric bump into a small hump around its multiple of one, two and three seconds. Right: the same, with channel latency added on top, which looks essentially identical to the jitter-only case.](../../assets/img/comm-jitter.png)
  <figcaption>The update interval on a link at reception 0.9. Left: a ±0.1 s broadcast jitter spreads each geometric bump around its multiple of the interval. Right: adding channel latency on top barely changes it; the spread is the transmitter's, not the channel's, which is why jitter is a transmit-schedule setting and latency a channel one.</figcaption>
</figure>

## Radio failure

`reception_prob` drops one message and re-draws from scratch on the next broadcast, so it has no memory. A radio that is *out* for a stretch of time cannot be expressed with it. That is what `RadioHealth` adds — a **link gate**, an effect layered onto the channel that can veto a directed link before reception is drawn for it.

Each aircraft's transmitter and receiver fail independently, at a rate in **events per hour** — the unit reliability is normally quoted in — so the mean time to failure is `1 / rate` hours whatever the broadcast cadence. Quoting a probability per broadcast instead would tie reliability to the interval, and a cadence sweep would then be moving two things at once. The recover rates default to zero, which makes a failure permanent for the rest of the encounter; give them a value and the radio is intermittent instead.

```python
from opencdarr.cns import TransceiverComm

comm = TransceiverComm(reception_prob=0.9, rx_fail_rate=3.6)   # MTTF ~17 min, no recovery
```

Encounters are short next to any realistic mean time between failures, so pick the rate against the length of the run rather than against a datasheet. The probability that a given radio has failed by the end of an encounter of `T` seconds is `1 - exp(-rate · T / 3600)`:

| `rx_fail_rate` [1/h] | Mean time to failure | Failed within a 250 s encounter |
|---|---|---|
| `0.036` | 28 h | 0.25% — about 1 encounter in 400 |
| `3.6` | 17 min | 22% |
| `36` | 100 s | 92% |

A rate low enough to be realistic will almost never fire in a single run, so an outage study is a Monte Carlo over many encounters, not one long one.

The two failures are **mirror images**. A down *transmitter* means that aircraft's broadcast is offered to nobody, so it goes silent while still seeing everyone. A down *receiver* means it is offered nothing, so it goes blind while everyone still sees it.

<figure markdown="span">
  ![Two panels of perceived ground speed against time for three aircraft, with AC1's radio failing at fifteen seconds. Left: AC1's transmitter fails, and both AC2's and AC3's staircase views of AC1 flatten at the failure while AC1's true speed continues to oscillate away from them. Right: AC1's receiver fails, and AC1's views of AC2 and AC3 both flatten instead, while their true speed continues. Before the failure the poorer link's staircase is visibly coarser than the better link's.](../../assets/img/comm-radio-failure.png)
  <figcaption>AC1's radio fails at 15 s, over two links of different quality (<code>AC1 → AC2</code> at reception 0.9, <code>AC1 → AC3</code> at 0.5). Left: a failed <strong>transmitter</strong> freezes what everyone else knows about AC1 — by 40 s the better-informed observer is off by 9.8 m/s. Right: a failed <strong>receiver</strong> freezes AC1's own picture of the others instead, off by 3.0 m/s, while their view of AC1 stays current. Before the failure, the poorer link updates in visibly coarser steps.</figcaption>
</figure>

Either way the affected receiver keeps **holding** what it last got ([surveillance](surveillance.md)) and keeps deciding on data that ages for as long as the outage lasts. That is why an outage is not the same experiment as `reception_prob = 0`: at zero reception a pair never hears of each other at all and flies its nominal path, where an outage leaves each side manoeuvring against a fix that is quietly going stale.

Telling the two failures apart needs **at least three aircraft**. With two, "AC1's transmitter died" and "AC2's receiver died" sever the same single link and leave an identical state, so a pairwise encounter cannot distinguish them and a sweep of `tx_fail_rate` against `rx_fail_rate` would be moving one parameter twice.

!!! warning "Estimate an outage study by plain Monte Carlo, not by importance splitting"
    A radio failure is a discrete jump that minimum separation carries no information about, so the [rare-event](../../estimators/rare-event/index.md) shells cannot steer toward it. Use plain Monte Carlo, or condition on the failure time and reweight.

## In the code

`Comm` lives in [`opencdarr/cns/communication.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/communication.py). It is switched on by passing `communication=` (and its own RNG substream `comm_rng=`, kept separate from the navigation stream) to `run_encounter` or `run_fleet`; without it, delivery is instant and perfect. The transmit schedule is passed alongside as `schedule=`, and a non-zero `jitter` takes its own `broadcast_rng=`. A decision's view of another aircraft is then whatever [surveillance](surveillance.md) holds for that link — the last message it delivered, or nothing before first contact.

Effects beyond reception and latency are added as **link gates** rather than by subclassing: a gate owns its own state, and several compose, so a radio failure and a terrain mask are two gates rather than a new class for the combination. To write one — or your own latency shape, broadcast rate, or a whole channel — see [Build your own → Communication](../../build-your-own/cns/communication.md).

The figures on this page are produced by [`scripts/handbook/communication.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/handbook/communication.py).

!!! note "Run it yourself"
    Every setting on this page is exercised end to end in [`examples/handbook/communication.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/communication.ipynb) — one tick through the whole stack, each effect on its own, and the four extension points.

[^adsb]: The reception-probability formulation — a Bernoulli trial per message, with the geometric update-interval distribution it produces — follows Rahman, Ellerbroek, and Hoekstra, *Modelling ADS-B Reception Probability using OpenSky Data*, Journal of Open Aviation Science (Proceedings of the 12th OpenSky Symposium).
