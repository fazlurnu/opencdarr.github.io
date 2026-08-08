# Communication

Communication is the **C** of [CNS](index.md). After [navigation](navigation.md) makes a measurement, `Comm` decides if the measurement reaches the other aircraft, and how late. **The input** to the communication model has five parts. These parts are the messages that the aircraft broadcast in this timestep, the receivers for these messages, the current time, a random stream, and the channel state from the last timestep. **The output** is the new channel state. For each directed link, this state holds the most recent message that arrived.

```python
comm = Comm(reception_prob=0.9, latency=lognormal_latency(median=0.1, sigma=0.25))
state = comm.step(state, broadcasts, receivers, t=5.0, rng=comm_rng)
```

[`Comm`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/communication.py) models the *effect* of a real datalink, for example ADS-B or ADS-L. On such a datalink, messages can be lost or delayed, and they arrive at irregular update intervals. `Comm` models **reception** and **latency**, but it does not simulate the message protocol. [Surveillance](surveillance.md) then reads the data that `Comm` holds.

## What is provided by default

Six settings act on the path from the broadcast of one aircraft to the perceived traffic of another aircraft. Three settings belong to the **transmit schedule**, which sets when a message goes out. Three settings belong to the **channel**, which sets what occurs to the message after the transmission.

| Setting | Location | Unit | Function |
|---|---|---|---|
| `interval` | `BroadcastSchedule` | s | the time between two transmissions from one aircraft (`at_rate` uses Hz) |
| `phase` | `BroadcastSchedule` | s | a start offset for each aircraft, which keeps the transmitters unsynchronised |
| `jitter` | `BroadcastSchedule` | s | a dither on each transmission slot, `U(-j, +j)` on each gap |
| `reception_prob` | `Comm` | probability | the probability that a message arrives, for each directed link |
| `latency` | `Comm` | s | the delay of a message that arrives |
| `tx_fail_rate` / `rx_fail_rate` | `RadioHealth` | **per hour** | the failure rate of a transmitter or a receiver, which fails for a period of time; the mean time to failure is `1 / rate` hours |
| `tx_recover_rate` / `rx_recover_rate` | `RadioHealth` | **per hour** | the recovery rate after a failure; `0` (the default) makes the failure permanent |

## Reception and latency, per directed link

When an aircraft broadcasts a message, each other aircraft receives that message **independently**. For each receiver, `Comm` draws two values:

- **reception** — a Bernoulli trial[^adsb] with the probability `reception_prob`. If the trial fails, the message is lost. The receiver then keeps the message that it already holds.
- **latency** — the delay of a message that arrives. `Comm` draws the delay from a `LatencyDistribution`. The message becomes available when the simulation time is `t_meas + delay`.

`Comm` tests the reception first, and it draws the delay only for a message that arrives. This sequence is a **design choice**, not a physical effect. The two draws are independent. Thus the opposite sequence gives the same distribution of the messages that arrive.

This library provides three latency shapes. These shapes are `constant_latency` (a fixed delay with no random draw), `uniform_latency(low, high)`, and `lognormal_latency(median, sigma)`. At the default setting `reception_prob=1.0, latency=0.0`, each broadcast arrives in the timestep of its transmission. The layer then gives immediate and perfect delivery.

The latency can be more than the broadcast interval. Thus an old message can arrive after a newer message. The model prevents an error from this sequence. A receiver always keeps the message with the most recent `t_meas`, and a late message cannot replace a more recent fix.

## Directed and asymmetric

`Comm` draws the reception for each link, not for each message, because real links are not symmetric. Two aircraft can be at the same distance from each other, but in different levels of interference. Thus the two aircraft can have a different `reception_prob`. The key for the reception is the direction of the transmission, read as "from → to". Thus `A → B` and `B → A` can be different, and one link can deliver a message while the other link loses a message in the same timestep. For more data about the reception probability, refer to [this paper](https://journals.open.tudelft.nl/joas/article/view/7895).

```python
comm = Comm(reception_prob={("OWN", "INT"): 0.80,    # OWN broadcasts are frequently lost
                            ("INT", "OWN"): 0.99})   # INT broadcasts almost always arrive
```

The same distance does not give the same reception. An obstruction, an antenna orientation, or a better receiver on one side can make one direction more reliable than the other direction. This is correct for the same two aircraft.

!!! note "`reception_prob` and the perceived traffic use opposite key orders"
    The key for `reception_prob` is `(source, receiver)`, which is the link that *carries* a broadcast. The key for the data that a receiver holds is `(receiver, source)`, which is what B *perceives about* A. The two mappings answer different questions. Thus `("AC1", "AC2")` is the link that carries the view of AC1 to AC2. A link that is not in the mapping gets the default value 1.0. Thus an incorrect identifier applies no loss, and it gives no error message. `validate_ids` compares the mapping with the real fleet when the tool builds the run. An incorrect identifier then causes an error immediately.

## Reception probability and the update interval

The reception and the latency are important only for their effect on the **perceived traffic** of a receiver. An aircraft never acts on the current state of the intruder. It acts on the last position that it received. Thus the important quantity is the time between two received position updates. This time is the **update interval**. If each message arrives, the update interval is equal to the broadcast interval.

<figure markdown="span">
  ![Two panels that compare a reliable link (reception 0.99) with a lossy link (reception 0.80). Left: the time since the last received update against time. The curve is a stairstep. It stays at one broadcast interval for the reliable link. It increases to two, three, and four seconds for the lossy link during a sequence of lost messages. Right: the distribution of the update interval. It is one bump at one second for the reliable link. It is a geometric series of bumps at one, two, three, and four seconds for the lossy link.](../../assets/img/comm-update-interval.png)
  <figcaption>One aircraft broadcasts one time each second. Two links receive the broadcast, a reliable link (reception 0.99) and a lower link (0.80). Left: the time since the last received update. Each delivery sets the time to one broadcast interval, and each lost message increases the time. Thus the link with the lower reception probability reaches several seconds. Right: the update interval is geometric.</figcaption>
</figure>

There are two results. First, the reception is a Bernoulli trial. Thus the number of broadcasts before the next success is **geometric**. The update interval occurs in bumps at multiples of the broadcast interval. The interval is one interval if the last message arrived, two intervals after one loss, and more after more losses. The bumps decrease geometrically. Second, at this rate, the **lost messages** set the interval, not the latency. A decision occurs one time in each broadcast interval. Thus a delay of less than one second still arrives before the next decision, and a message that arrives is one interval old in the two conditions. Each **extra** interval is a lost message. The reliable link stays at one interval. The lossy link (0.80) is approximately 25% longer, and it sometimes reaches a **five-interval** gap.

## Latency: a small spread, not a longer gap

The second part of the channel is the **latency**. The latency is the delay between the transmission and the reception of a message. At a broadcast rate of 1 Hz, the effect is very small. `lognormal_latency(median=0.2, sigma=0.3)` gives a median delay of 0.2 s, which is one fifth of the interval. Thus a message still arrives before the next decision. The latency does not make the update interval longer. It only spreads the update interval around one interval.

<figure markdown="span">
  ![Two panels. Left: the lognormal distribution of the delay. It is a hump with a skew to the right. The peak is near 0.2 seconds, and a thin tail continues to approximately 0.6 seconds. Right: the distribution of the update interval on a link at reception 0.6. There are four separate bumps with their centres at one, two, three, and four seconds. Each bump has a spread around a dashed reference line. The line shows the position of that bump with no latency.](../../assets/img/comm-latency.png)
  <figcaption>Left: the delay, <code>lognormal(median 0.2, sigma 0.3)</code>. Right: the effect of the delay on the update interval on a lossy link (reception 0.6). Without latency, each gap is a whole number of intervals, shown by the dashed lines, because a gap is a count of lost messages. The delay <strong>spreads each bump around its multiple, but it does not move the bump</strong>. The mean update interval changes by 0.003 s, from 1.634 s to 1.637 s, and the spread increases by 3%. Each extra interval is a lost message, not a slow message.</figcaption>
</figure>

This difference makes the two settings independent. The reception sets the bump into which a gap falls. The latency sets only the width of each bump. A delay must be almost equal to the broadcast interval before one bump mixes with the next bump.

## When a broadcast happens

The reception and the latency are the **channel**. The time of a transmission is the **transmit schedule**. The transmit schedule is a separate object, [`BroadcastSchedule`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/broadcast.py). It follows the ADS-B division between the transmission timing and the reception. The schedule sets the broadcast `interval` (or `at_rate` in hertz). It also sets an optional **phase** offset for each aircraft, for transmitters that are not synchronised. It also sets the **jitter** on each transmission, the slot dither that real ADS-B uses against co-channel collisions. The jitter gives the **spread** of each update-interval bump. Without the jitter, the bumps stay sharp.

The default schedule aligns each aircraft at `t = 0`. This is the most correlated condition, because the full fleet updates in the same timestep. Thus a phase offset is closer to real unsynchronised transmitters than the default is.

The update-interval distribution from the **reception probability**, the **latency**, and the **jitter** agrees with the distribution in real ADS-B data. The [TU Delft ATM/CNS group](https://journals.open.tudelft.nl/joas/article/view/7895) studied these data ([and here](https://pure.tudelft.nl/ws/portalfiles/portal/31444950/12th_ATM_RD_Seminar_paper_83.pdf))

<figure markdown="span">
  ![Two panels of the distribution of the update interval for a link at reception 0.9. Left: a jitter of plus or minus 0.1 seconds spreads each geometric bump into a small hump around its multiple of one, two, and three seconds. Right: the same distribution with the channel latency added. It looks almost the same as the distribution with the jitter alone.](../../assets/img/comm-jitter.png)
  <figcaption>The update interval on a link at reception 0.9. Left: a broadcast jitter of ±0.1 s spreads each geometric bump around its multiple of the interval. Right: the channel latency on top of the jitter causes almost no change. The spread comes from the transmitter, not from the channel. Thus the jitter is a transmit-schedule setting and the latency is a channel setting.</figcaption>
</figure>

## Radio failure

`reception_prob` loses one message, then it makes a new draw for the next broadcast. Thus it has no memory, and it cannot model a radio that is out of operation for a period of time. `RadioHealth` adds this function. `RadioHealth` is a **link gate**, an effect on the channel that can stop a directed link before `Comm` draws the reception for that link.

The transmitter and the receiver of each aircraft fail independently. The rate is in **events per hour**, which is the usual unit for reliability. Thus the mean time to failure is `1 / rate` hours for each broadcast cadence. A probability for each broadcast connects the reliability to the interval, and a sweep of the cadence then moves two quantities at the same time. The default recover rates are zero, which makes a failure permanent for the remainder of the encounter. Give the recover rates a value to make the radio intermittent.

```python
TransceiverComm(reception_prob=0.9, rx_fail_rate=3.6)   # MTTF ~17 min, no recovery
```

An encounter is short in comparison with a realistic mean time between failures. Thus select the rate against the length of the run, not against a datasheet. The probability that a given radio has failed at the end of an encounter of `T` seconds is `1 - exp(-rate · T / 3600)`:

| `rx_fail_rate` [1/h] | Mean time to failure | Failure in a 250 s encounter |
|---|---|---|
| `0.036` | 28 h | 0.25%, approximately 1 encounter in 400 |
| `3.6` | 17 min | 22% |
| `36` | 100 s | 92% |

A realistic rate almost never causes a failure in one run. Thus an outage study is a Monte Carlo over many encounters, not one long encounter.

The two failures are **opposite**. If the **transmitter** fails, no other aircraft receives the broadcast of that aircraft. The aircraft is silent, but it continues to perceive all the other aircraft. If the **receiver** fails, that aircraft receives no message. The aircraft is blind, but all the other aircraft continue to perceive it.

<figure markdown="span">
  ![Two panels of the perceived ground speed against time for three aircraft. The radio of AC1 fails at fifteen seconds. Left: the transmitter of AC1 fails. The staircase views of AC1 at AC2 and at AC3 become flat at the failure, but the true speed of AC1 continues to oscillate. Right: the receiver of AC1 fails. The views of AC2 and AC3 at AC1 become flat instead, but their true speed continues. Before the failure, the staircase of the poorer link is more coarse than the staircase of the better link.](../../assets/img/comm-radio-failure.png)
  <figcaption>The radio of AC1 fails at 15 s, on two links of different quality (<code>AC1 → AC2</code> at reception 0.9, <code>AC1 → AC3</code> at 0.5). Left: a failed <strong>transmitter</strong> freezes what all the other aircraft perceive about AC1. At 40 s, the error at the better observer is 9.8 m/s. Right: a failed <strong>receiver</strong> freezes the view of AC1 about the other aircraft, with an error of 3.0 m/s. Their view of AC1 stays current. Before the failure, the poorer link updates in more coarse steps.</figcaption>
</figure>

In the two conditions, the affected receiver continues to **hold** the last data that it received ([surveillance](surveillance.md)). It continues to make decisions with data that becomes older during the outage. Thus an outage is not the same experiment as `reception_prob = 0`. At zero reception, a pair of aircraft never perceives each other, and each aircraft flies its nominal path. During an outage, each side manoeuvres against a fix that becomes stale.

**At least three aircraft** are necessary to identify which failure occurred. With two aircraft, a failed transmitter on AC1 and a failed receiver on AC2 break the same single link. The two conditions leave an identical state. Thus a pairwise encounter cannot show the difference, and a sweep of `tx_fail_rate` against `rx_fail_rate` moves one parameter two times.

!!! warning "Estimate an outage study by plain Monte Carlo, not by importance splitting"
    A radio failure is a discrete jump, and the minimum separation gives no data about this jump. Thus the [rare-event](../estimators/rare-event/index.md) shells cannot steer towards it. Use plain Monte Carlo, or condition on the failure time and calculate new weights.

## In the code

`Comm` is in [`opencdarr/cns/communication.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/communication.py). To switch it on, pass `communication=` to `run_encounter` or `run_fleet`. Also pass its own RNG substream `comm_rng=`, which stays separate from the navigation stream. Without `Comm`, the delivery is immediate and perfect. Pass the transmit schedule with `schedule=`. A `jitter` that is not zero takes its own `broadcast_rng=`. The view of another aircraft in a decision is then the data that [surveillance](surveillance.md) holds for that link. This data is the last message from the link, or no data before the first contact.

**Link gates** add the effects that are not the reception or the latency, and a subclass is not necessary. Each gate holds its own state, and it is possible to use more than one gate together. Thus a radio failure and a terrain mask are two gates, not a new class for the combination. To write a gate, a latency shape, a broadcast rate, or a full channel, refer to [Build your own → Communication](../../build-your-own/cns/communication.md).

!!! code "Learn by doing"
    [L1.14 · CNS: communication](../../tutorials/l1-parts.md) (60 min, core) delays, loses, and spaces out the messages, one setting at a time. [L1.15 · Link gates](../../tutorials/l1-parts.md) (40 min, depth) turns a directed link off for a physical reason. A gate, a latency shape, or a channel of your own is [L7](../../tutorials/l7-write-your-own.md).

[^adsb]: The reception-probability formulation is a Bernoulli trial for each message, and it gives the geometric update-interval distribution. It follows Rahman, Ellerbroek, and Hoekstra, *Modelling ADS-B Reception Probability using OpenSky Data*, Journal of Open Aviation Science (Proceedings of the 12th OpenSky Symposium).
