# Performance

A `Performance` is the flight envelope of one airframe — the limits every command is clamped to. It is a plain frozen value, kept separate from the integrator, so a new airframe is a new `Performance`, not a change to the model. To set your own, construct one and pass it wherever an airframe's limits are read.

## The fields

| Field | Meaning | Unit | Read by |
| --- | --- | --- | --- |
| `v_max` | maximum ground speed | m/s | both |
| `v_min` | minimum airspeed — a fixed-wing's stall speed, so it cannot stop or fly backward | m/s | fixed-wing |
| `ax` | maximum acceleration | m/s² | both |
| `yaw_rate_max` | maximum yaw rate | °/s | multirotor |
| `phi_max` | maximum bank angle | ° | fixed-wing |
| `roll_rate_max` | maximum roll rate | °/s | fixed-wing |

The [multirotor](../modules/dynamics/multirotor.md) reads `v_max`, `ax`, and `yaw_rate_max`. The [fixed-wing](../modules/dynamics/fixedwing.md) reads `v_max`, `v_min`, `ax`, `phi_max`, and `roll_rate_max`. A field an airframe does not read stays at its `0.0` default.

A multirotor can still fly backward, but that does not come from `v_min`, which it ignores. Its command is a velocity **vector**, so any direction (backward included) and a full stop are reached by pointing that vector, independent of where the nose faces. `v_min` only bounds the fixed-wing, as its stall speed.

## The envelope must match the airframe

Because the integrator reads these fields directly, an envelope built for one airframe cannot drive another — and the mismatch is not harmless. A fixed-wing turns by *banking*, so handed a multirotor's `phi_max = 0` it could never bank, and would fly dead straight through every manoeuvre. Rather than do that silently, each dynamics rejects an envelope it cannot fly, at the moment you build the `Agent`:

```python
from opencdarr.dynamics import FixedWing
from opencdarr.fleet import Agent
from opencdarr.performance import M600

Agent(state, M600, FixedWing())
# ValueError: FixedWing was given an envelope it cannot fly: phi_max must be > 0
# (a fixed-wing turns by banking); ... pass a fixed-wing Performance such as SMALL_FIXEDWING.
```

A fixed-wing needs real bank authority (`phi_max`, `roll_rate_max` above zero) and a positive stall speed (`v_min`); a multirotor, which never banks, rejects an envelope that carries bank limits. So a swapped envelope fails loudly here, instead of flying wrong.

## Set your own

Construct a `Performance` with the limits you want. For a multirotor the agility knobs are `v_max` and `ax` — how fast it goes, and how sharply it can swing its velocity vector around:

```python
from opencdarr.performance import Performance

# a slower, gentler multirotor
my_drone = Performance(v_max=12.0, v_min=-12.0, ax=3.0, yaw_rate_max=60.0)
```

For a fixed-wing the numbers that matter most are speed and bank, because together they set the turn radius `R = V² / (g·tan φ)`:

```python
# a large, fast fixed-wing — high stall speed, conservative bank
big_aircraft = Performance(v_max=100.0, v_min=50.0, ax=2.0, phi_max=30.0, roll_rate_max=15.0)
```

That `V²` is unforgiving. At 80 m/s and 30° of bank this aircraft needs a turn more than a kilometre wide, where a small UAV at 17 m/s curls around inside 30 m — see the [fixed-wing turn](../modules/dynamics/fixedwing.md) figure. A separation algorithm that ignored the envelope would ask the big aircraft for a manoeuvre it cannot physically make, which is why performance is an input, not a constant baked into the model.

Then pass it wherever an airframe's limits are read — an `Agent` in a fleet run, or a single dynamics step.

```python
from opencdarr.fleet import Agent

agent = Agent(state, my_drone)                    # a fleet run reads its limits from here
state = dyn.step(state, command, my_drone, dt)    # a single step clamps the command to them
```

## When a limit actually bites

An envelope limit only changes an encounter when the manoeuvre pushes against it. In a gently anticipated crossing the resolver commands turns well inside every airframe's authority, so `ax` and `phi_max` never bind and the closest approach is unchanged. What still moves the outcome is `v_max`, because a faster or slower airframe reaches the crossing at a different time. Push the manoeuvre harder — later detection, a tighter protected zone — and the envelope begins to decide who stays separated.

The built-in envelopes `M600` (multirotor) and `SMALL_FIXEDWING` (fixed-wing) are two such values, defined in [`performance.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/performance.py). The quickest start is to copy one and change the numbers, then watch it fly — the [build-your-own performance notebook](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/03_build_your_own_performance.ipynb) builds a heavy-lift multirotor and a big fixed-wing end to end.
