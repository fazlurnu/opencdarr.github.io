# Dynamics

Dynamics is the interface that advances one aircraft by a single time step.

```python
state = dyn.step(state, command, perf, dt, wind)
```

We model every vehicle as a **point mass** — a position, a ground track, and a ground speed — driven by a [PX4](https://docs.px4.io/main/en/ros/offboard_control)-style setpoint (the `MotionCommand`) and held inside that airframe's performance envelope. This is the fast-time modelling choice inherited from [BlueSky](https://github.com/TUDelft-CNS-ATM/bluesky). What matters for separation is where an aircraft goes and how quickly it can change course, not its attitude or its rotor speeds, so we integrate the point-mass kinematics under acceleration and turn limits rather than a full six-degree-of-freedom model. The envelopes come from assumed DJI M600 and [published fixed-wing UAV performance data](https://www.mdpi.com/2504-446X/10/5/337).

Two airframes are implemented. They share this interface and differ only in how a command becomes motion.

- **[Multirotor](multirotor.md)** — a holonomic point mass that can move in any direction, stop, and hover, with facing decoupled from travel.
- **[Fixed-wing](fixedwing.md)** — a coordinated-turn model that banks to turn and cannot stop.

You can also [Build your own → Dynamics](../../build-your-own/dynamics.md).
