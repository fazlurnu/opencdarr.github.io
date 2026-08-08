# Aircraft

An aircraft in this library is an `Agent`: a start state, an airframe — a `Kinematics` model with a [`Performance`](performance.md) envelope — and an [autopilot](autopilot.md) that flies the mission. This section explains each part, and why it is shaped the way it is.

## Kinematics

Kinematics is the interface that advances one aircraft by a single time step.

```python
state = kinematics.step(state, command, perf, dt, wind)
```

This library models every vehicle as a **point mass**, so an aircraft is a position, a ground track, and a ground speed. It is driven by a [PX4](https://docs.px4.io/main/en/ros/offboard_control)-style setpoint (the `MotionCommand`) and held inside that airframe's performance envelope. This is the fast-time modelling choice inherited from [BlueSky](https://github.com/TUDelft-CNS-ATM/bluesky). What matters for separation in traffic management is where an aircraft goes and how quickly it can change course, not its attitude or its rotor speeds. The point-mass kinematics are therefore integrated under acceleration and turn limits, rather than a full six-degree-of-freedom model. The envelopes come from an assumed DJI M600 and [published fixed-wing UAV performance data](https://www.mdpi.com/2504-446X/10/5/337).

## MotionCommand

A [`MotionCommand`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/kinematics/base.py) is what the aircraft is being asked to do, written in a form no single airframe owns. It is a frozen value shaped, and the fields follow [PX4](https://docs.px4.io/main/en/ros/offboard_control) offboard setpoint. There is one field per channel of motion, every field is optional, and `None` means *unspecified* rather than zero. Different airframes can interpret the fields differently. This library provides two built-in kinematics, the [multirotor](multirotor.md) and the [fixed-wing](fixedwing.md).

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

**Velocity is the common currency.** Everything upstream of the airframe speaks in velocity. The [autopilot](autopilot.md) proposes a nominal command each decision timestep, a [resolver](../separation/conflict-resolution.md) returns one carrying `target_velocity`, and the `SeparationManager` either passes the nominal through or replaces it with the resolver's. Only the last step is airframe-specific. Since fixed-wing does not have a native translation of `target_velocity`, such a command is first projected onto its course and airspeed channels, as [this page](fixedwing.md#flying-a-velocity-command) describes.

## Airframes

This library implements two airframes. They share this interface and differ only in how a command becomes motion.

- **[Multirotor](multirotor.md)** — a holonomic point mass that can move in any direction, stop, and hover, with facing decoupled from travel.
- **[Fixed-wing](fixedwing.md)** — a coordinated-turn model that banks to turn and cannot stop.

## The contract

`step` is a pure map from one state to the next. It reads the state, the command, the envelope, the timestep, and the wind, and returns the next state — no hidden state on the object, which is what lets the rare-event estimator replay and branch a trajectory. A vehicle of your own is a subclass of [`Kinematics`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/kinematics/base.py) implementing this one method, with the two built-ins as reference implementations. An envelope the vehicle cannot fly is rejected when the `Agent` is built — [Performance](performance.md) explains why.

!!! code "Learn by doing"
    [L1.1 · Aircraft state](../../tutorials/l1-parts.md) (30 min) makes one aircraft and reads its state, and [L1.4 · MotionCommand](../../tutorials/l1-parts.md) (40 min) writes every channel in the table above. [L1.2](../../tutorials/l1-parts.md) is the depth lesson on the frame and geometry. A vehicle of your own is [L7](../../tutorials/l7-write-your-own.md).
