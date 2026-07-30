# Communication — extending the channel

[`Comm`](../../modules/cns/communication.md) delivers a broadcast over each directed
link with a reception probability and a latency. Four ways to change what it does,
in order of how much you have to write: the first two are configuration, the third
adds an effect to the standard channel, and the fourth replaces the channel.

## Your own broadcast rate

*When* a message is sent is a `BroadcastSchedule`, separate from the channel and
taken by both runners. Give it an `interval` in seconds, or `at_rate` in hertz:

```python
from opencdarr.cns.broadcast import BroadcastSchedule

BroadcastSchedule(interval=0.5)     # every half second
BroadcastSchedule.at_rate(2.0)      # the same thing, in Hz
```

The default schedule starts every aircraft at `t = 0`, so the whole fleet updates on
the same tick. Two settings break that up — a per-aircraft `phase` offset, and a
per-transmission `jitter` of \(U(-j, +j)\) added to each gap, which is the slot
dithering real ADS-B uses. Jitter leaves the mean cadence unchanged:

```python
BroadcastSchedule(interval=1.0, phase=[0.0, 0.45], jitter=0.15)
```

Pass it as `schedule=` to `run_fleet` or `run_encounter`. A non-zero `jitter` is a
random draw, so it needs its own generator:

```python
out = run_fleet(agents, schedule=BroadcastSchedule(interval=1.0, jitter=0.2),
                broadcast_rng=generator(bc_seq), **cdr)
```

From a configuration file the same three are `broadcast_interval`,
`broadcast_jitter` and `broadcast_random_phase` under `simulation`.

!!! note "The cadence moves the result, so hold it fixed when sweeping something else"
    On a 90° crossing conflict with GNSS noise, dropping 1 Hz to 0.5 Hz costs 198 m
    of minimum separation — 56% of the 1 Hz result — because the resolver acts on a
    picture twice as old. Reliability parameters are quoted per **second** rather
    than per broadcast for the same reason: a cadence sweep should move one thing.

## Your own latency model

A `LatencyDistribution` is any callable taking a generator and returning a delay in
seconds. There is no base class to inherit and nothing to register — a plain
function is enough. The built-ins `constant_latency`, `uniform_latency` and
`lognormal_latency` are just factories returning one.

A bimodal delay, where most messages arrive quickly but a fraction need a
retransmission:

```python
def bimodal_latency(fast, slow, p_slow):
    """Most messages arrive quickly; a fraction take much longer."""
    def draw(rng):
        return slow if rng.random() < p_slow else fast
    return draw

comm = Comm(reception_prob=1.0, latency=bimodal_latency(0.05, 1.2, p_slow=0.15))
```

Draw from the generator you are handed rather than from a global source, so the run
stays reproducible from its seed. A distribution that draws **nothing** is fine —
`constant_latency` is exactly that — but note it changes how much randomness a tick
consumes, so a run using it is not stream-comparable with one that draws.

## Your own link gate

A `LinkGate` adds one effect to the standard channel. It answers a single question,
*may this broadcast be offered on this directed link right now*, and carries whatever
state it needs to answer it across ticks. Gates **compose**: a link is offered only
if every gate admits it, so a radio failure and a transmit duty cycle are two gates
rather than a new class for the combination.

Three methods — `initial` returns the gate's starting state, `evolve` advances that
state once per step, and `admits` decides one link:

```python
from dataclasses import dataclass
from opencdarr.cns import LinkGate

@dataclass(frozen=True)
class DutyCycle(LinkGate):
    """A transmitter that is only on for part of each period."""

    period: float = 4.0
    on_time: float = 1.0

    def initial(self):
        return 0.0                       # seconds elapsed so far

    def evolve(self, own, receivers, elapsed, rng):
        return own + elapsed             # draws nothing: deterministic

    def admits(self, own, source, receiver):
        return (own % self.period) < self.on_time
```

Then hand it to the channel, alone or beside another:

```python
from opencdarr.cns import Comm, RadioHealth

# RadioHealth's four rates are in events per hour: 3.6/h is a receiver
# with a mean time to failure of about 17 minutes.
comm = Comm(reception_prob=0.9, gates=(RadioHealth(rx_fail_rate=3.6), DutyCycle()))
```

Each gate's state rides in `CommState.gates`, positionally, and threads through the
run like the rest of the comm state.

Two rules are worth knowing before writing one.

**A veto is not `reception_prob = 0`.** `admits` is consulted *ahead of* the
reception draw, so a denied link consumes no randomness at all. Returning a zero
probability instead would spend one draw per suppressed link and move every number
after it. This is why the contract is a boolean and not a multiplier — an effect
that *modulates* the probability leaves the draw in place, and belongs in
`reception_prob` rather than in a gate.

**Draw a constant number of times in `evolve`, if you draw at all.** `RadioHealth`
makes its two draws per aircraft every step whatever the current health and whatever
the rates, including when a rate is zero. That keeps the stream position a function
of the roster and the tick count rather than of the failure history, so sweeping a
rate moves the outages without shifting the reception and latency draws underneath
them.

Implement the gate as a frozen dataclass, so the experiment cache can key on it by
value; a plain object's `repr` carries a memory address and is not stable across
processes.

## Your own channel

When the effect is not a veto on top of Bernoulli reception — a queue, a
retransmission protocol, a bandwidth budget shared across the fleet — replace the
channel itself. Subclass `CommunicationModel` and implement `step`, plus
`initial_state` if the model needs memory of its own.

A shared budget of one delivery per tick, fleet-wide:

```python
from dataclasses import dataclass
from opencdarr.cns import CommState
from opencdarr.cns.base import CommunicationModel

@dataclass(frozen=True)
class TokenState(CommState):
    """A CommState carrying this model's own memory."""
    tokens: int = 0

class TokenBucket(CommunicationModel):
    def __init__(self, capacity=1):
        self.capacity = capacity

    def initial_state(self):
        return TokenState(tokens=self.capacity)

    def step(self, state, broadcasts, receivers, t, rng):
        budget, held = self.capacity, dict(state.held)
        for msg in broadcasts:
            for receiver in receivers:
                if receiver == msg.source or budget == 0:
                    continue
                held[(receiver, msg.source)] = msg
                budget -= 1
        return TokenState(held=held, tokens=budget)
```

`step` must be **pure**: thread the state in and return a new one rather than
mutating it, so a cloned run can never write through to its parent. Returning your
own `CommState` subclass from `initial_state` is what puts the model's memory in
place before the first tick — a model written this way fails loudly on a missing
`initial_state` rather than quietly working around a bare `CommState`.

It then drops into the stack like any other model:

```python
out = run_fleet(agents, communication=TokenBucket(capacity=1),
                comm_rng=generator(comm_seq), **cdr)
```

!!! note "Run it yourself"
    All four extension points are worked end to end in
    [`examples/handbook/communication.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/communication.ipynb),
    alongside each of the channel's own settings.
