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

A field an airframe does not use defaults to `0.0` and is ignored. The [multirotor](../modules/dynamics/multirotor.md) reads `v_max`, `ax`, and `yaw_rate_max`. The fixed-wing reads `v_max`, `v_min`, `ax`, `phi_max`, and `roll_rate_max`.

A multirotor can still fly backward, but that does not come from `v_min`, which it ignores. Its command is a velocity **vector**, so any direction (backward included) and a full stop are reached by pointing that vector, independent of where the nose faces. `v_min` only bounds the fixed-wing, as its stall speed.

## Set your own

Construct a `Performance` with the limits you want.

```python
from opencdarr.performance import Performance

# a slower, gentler multirotor
my_drone = Performance(v_max=12.0, v_min=-12.0, ax=3.0, yaw_rate_max=60.0)
```

Then pass it wherever an airframe's limits are read — an `Agent` in a fleet run, or a single dynamics step.

```python
from opencdarr.fleet import Agent

agent = Agent(state, my_drone)                    # a fleet run reads its limits from here
state = dyn.step(state, command, my_drone, dt)    # a single step clamps the command to them
```

The built-in envelopes `M600` (multirotor) and `SMALL_FIXEDWING` (fixed-wing) are two such values, defined in [`performance.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/performance.py). The quickest start is to copy one and change the numbers.
