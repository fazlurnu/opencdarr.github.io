# Kinematics

Kinematics is the interface that advances one aircraft by a single time step.

```python
state = kinematics.step(state, command, perf, dt, wind)
```

We model every vehicle as a **point mass** — a position, a ground track, and a ground speed — driven by a [PX4](https://docs.px4.io/main/en/ros/offboard_control)-style setpoint (the `MotionCommand`) and held inside that airframe's performance envelope. This is the fast-time modelling choice inherited from [BlueSky](https://github.com/TUDelft-CNS-ATM/bluesky). What matters for separation is where an aircraft goes and how quickly it can change course, not its attitude or its rotor speeds, so we integrate the point-mass kinematics under acceleration and turn limits rather than a full six-degree-of-freedom model. The envelopes come from assumed DJI M600 and [published fixed-wing UAV performance data](https://www.mdpi.com/2504-446X/10/5/337).

## MotionCommand

The `command` in that call is a [`MotionCommand`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/kinematics/base.py) — what the aircraft is being asked to do, written in a form no single airframe owns. It is a frozen value shaped like a [PX4](https://docs.px4.io/main/en/ros/offboard_control) offboard setpoint: one field per channel of motion, every field optional, and `None` meaning *unspecified* rather than zero. The channels are the union across airframes, not a set every vehicle has.

| Channel | Meaning | Unit | Read by |
| --- | --- | --- | --- |
| `target_velocity` | ground velocity $(v_E, v_N)$ — the resolver's native output | m/s | multirotor |
| `target_body_velocity` | velocity in the nose frame (forward, right) | m/s | multirotor |
| `target_position` | waypoint, latitude and longitude | ° | both |
| `target_leg_start` | previous waypoint — with `target_position` it gives the leg line to track | ° | fixed-wing |
| `target_loiter_radius` | orbit radius about `target_position` | m | fixed-wing |
| `target_yaw` | absolute nose heading, decoupled from travel | ° | multirotor |
| `target_yawspeed` | nose rotation rate, used when `target_yaw` is unset | °/s | multirotor |
| `target_course` | ground-track course $\chi$ to make good | ° | fixed-wing |
| `target_airspeed_direction` | heading $\psi$ of the airspeed vector — overrides `target_course` | ° | fixed-wing |
| `target_airspeed` | airspeed to hold | m/s | fixed-wing |
| `target_lateral_accel` | lateral acceleration, a feedforward on the bank | m/s² | fixed-wing |
| `target_altitude`, `target_vertical_speed` | defined for the 3D pass, ignored today | m, m/s | neither |

What a channel does to the aircraft that flies it belongs with that aircraft's equations of motion, so the details are on the [multirotor](multirotor.md#motioncommand) and [fixed-wing](fixedwing.md#motioncommand) pages. Two rules are shared.

**A channel an airframe does not have is ignored; one it needs and did not get raises.** A `target_yaw` on a fixed-wing is not an error — heading is coupled to travel there, so the channel is simply an absent degree of freedom. A fixed-wing handed nothing but `target_velocity` is a different case: it has no velocity channel to fly, and rather than invent a course it fails immediately, because an under-specified command is a programming error and not a flight condition. Where more than one channel the model *does* read is set, priority decides — position over body velocity over velocity for the multirotor, airspeed direction over course for the fixed-wing.

**Everything upstream of the airframe speaks in velocity.** The [autopilot](../autopilot.md) proposes a nominal command each decision tick, a [resolver](../separation/conflict-resolution.md) returns one carrying `target_velocity`, and the `SeparationManager` either passes the nominal through or replaces it with the resolver's. Only the last step is airframe-specific: a velocity command bound for a fixed-wing is first projected onto its course and airspeed channels, as [that page](fixedwing.md#flying-a-velocity-command) describes. Because velocity is the common currency, a `MotionCommand` can be built straight from one — `MotionCommand.from_velocity(v_east, v_north)` or `from_track_speed(hdg, spd)` — and read back through `gs`, `trk`, `v_east`, and `v_north`, which raise if the velocity channel is unset.

## Airframes

Two airframes are implemented. They share this interface and differ only in how a command becomes motion.

- **[Multirotor](multirotor.md)** — a holonomic point mass that can move in any direction, stop, and hover, with facing decoupled from travel.
- **[Fixed-wing](fixedwing.md)** — a coordinated-turn model that banks to turn and cannot stop.

You can also [Build your own → Kinematics](../../build-your-own/kinematics.md).
