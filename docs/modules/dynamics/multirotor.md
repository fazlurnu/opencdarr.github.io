# Multirotor

The multirotor is a **holonomic point mass**. Its velocity can point in any direction and change direction in a single bounded step, and it can slow, stop, and hover. Facing is separate from travel, so the nose heading (`yaw`) can point one way while the vehicle moves another, the way a camera drone holds a subject while flying sideways. We use the DJI M600 envelope — top speed `v_max` 18 m/s, isotropic acceleration `a_x` 5 m/s², and yaw rate 90 °/s. These limits are a `Performance` value, so you can [Build your own → Performance](../../build-your-own/performance.md).

## Equation of motion

The state advanced each step is the ground velocity $\mathbf{v} = (v_E, v_N)$ and the position. Given a target ground velocity $\mathbf{v}_c$ read from the command, the velocity moves straight toward it under the acceleration limit, after the target is clamped to top speed.

$$ \mathbf{v}_t = \operatorname{clip}_{\lVert\cdot\rVert}\!\left(\mathbf{v}_c,\; v_{\max}\right) $$

$$ \mathbf{v}' = \mathbf{v} + \operatorname{clip}_{\lVert\cdot\rVert}\!\left(\mathbf{v}_t - \mathbf{v},\; a_x\,\Delta t\right) $$

Here $\operatorname{clip}_{\lVert\cdot\rVert}(\mathbf{u}, m)$ scales a vector down to magnitude $m$ when it is longer and leaves it otherwise. Position then advances by a great-circle step of $\lVert\mathbf{v}'\rVert\,\Delta t$ along the new track. Because the bound is on the velocity **vector**, a right-angle change of direction is one bounded step rather than a turn-rate-limited arc, and a zero target brings the vehicle to a hover.

The nose heading is a separate channel. It turns toward a commanded `target_yaw`, or integrates a commanded `target_yawspeed`, under the yaw-rate limit, taking the shortest way round and snapping onto the target once it is within a single step. It never feeds back into the velocity.

$$ \psi' = \psi + \operatorname{clip}\!\left(\psi_c - \psi,\; \pm\,\dot\psi_{\max}\,\Delta t\right) $$

Under wind the same limits act on **airspeed** rather than ground speed. The vehicle solves for the airspeed vector it must fly to meet the commanded ground velocity and limits that, so a feasible command is met by crabbing and an infeasible one drifts downwind. At zero wind airspeed equals ground speed and the equations above hold as written.

## MotionCommand

A `MotionCommand` is a [PX4](https://docs.px4.io/main/en/ros/offboard_control)-style setpoint with many optional channels, and each dynamics model reads only the ones its vehicle understands. For the multirotor the command has **two independent axes** — a translation channel that says where to go, and an optional yaw channel that says where the nose points. The two never re-couple, which is why a multirotor can fly one way while looking another.

**Translation.** One of three channels, in priority order.

- **`target_position`**, a point given as latitude and longitude. Fly straight to it and hover, capping speed by the stopping-distance law $\sqrt{2\,a_x\,r}$ at range $r$ so the vehicle stops on the point.
- **`target_body_velocity`**, a velocity in the nose frame (forward, right), resolved to the world through the current yaw.
- **`target_velocity`**, an inertial ground velocity $(v_E, v_N)$, the resolver's native output.

**Yaw.** Optional, and it rides alongside any translation channel. `target_yaw` points at an absolute heading, `target_yawspeed` spins at a rate, and neither steers the velocity. Channels a multirotor does not have — course, airspeed, bank — are ignored.

Every example below drives the real model from a hover with the same one-line step.

```python
from opencdarr.dynamics import Multirotor, MotionCommand
from opencdarr.performance import M600

dyn = Multirotor()
command = MotionCommand(...)                      # one of the cases below
state = dyn.step(state, command, M600, dt=0.5)    # advance one step from an AircraftState
```

The grey arrows in every figure are the **nose** (`yaw`), sampled along the track. Where they line up with the path, facing follows travel. Where they do not, the two are decoupled.

### Inertial velocity — `target_velocity`

An inertial ground velocity is a world-frame vector, so the yaw does not steer it. All three commands fly due north, and only the nose changes.

```python
MotionCommand(target_velocity=(0.0, 15.0))                        # nose follows travel
MotionCommand(target_velocity=(0.0, 15.0), target_yaw=90.0)       # nose held east (camera-point)
MotionCommand(target_velocity=(0.0, 15.0), target_yawspeed=45.0)  # nose spinning
```

<figure markdown="span">
  ![Three inertial-velocity commands, all flying north, with the nose arrows differing between hold, fixed east, and spinning](../../assets/img/mc-velocity.png)
  <figcaption>Inertial velocity, 15 m/s north, under three yaw modes. The track is identical in all three, because velocity is a world-frame vector. Left, the nose follows travel. Middle, the nose is held east while the vehicle flies north. Right, the nose spins.</figcaption>
</figure>

### Body velocity — `target_body_velocity`

Body forward is along the nose, so here the yaw **does** steer the travel. The same three yaw modes now change the path.

```python
MotionCommand(target_body_velocity=(15.0, 0.0))                       # forward along the nose
MotionCommand(target_body_velocity=(15.0, 0.0), target_yaw=90.0)      # re-point, travel follows
MotionCommand(target_body_velocity=(15.0, 0.0), target_yawspeed=45.0) # forward + spin = circle
```

<figure markdown="span">
  ![Three body-velocity commands whose tracks follow the yaw, giving a straight line, a turn to east, and a circle](../../assets/img/mc-body.png)
  <figcaption>Body velocity, 15 m/s forward. Because forward is along the nose, the track follows the yaw. Left, a fixed nose gives a straight line. Middle, turning the nose to east swings the travel with it. Right, a constant yaw rate turns forward flight into a circle.</figcaption>
</figure>

### Position — `target_position`

A position command flies to a point and hovers. Like inertial velocity, the path is yaw-independent, and the yaw only turns the nose.

```python
MotionCommand(target_position=(lat, lon))                        # go-to and hover
MotionCommand(target_position=(lat, lon), target_yaw=180.0)      # fly there facing south
MotionCommand(target_position=(lat, lon), target_yawspeed=45.0)  # fly there spinning
```

<figure markdown="span">
  ![Three position commands to the same point, with identical tracks and only the nose differing](../../assets/img/mc-position.png)
  <figcaption>A point 130 m to the north-east. All three reach it and hover, so the track is yaw-independent, and only the nose differs — following travel, held south, or spinning.</figcaption>
</figure>

### Edge cases

When more than one translation channel is set, the priority order decides. A zero velocity is a valid command that decelerates to a hover.

```python
MotionCommand(target_position=P, target_velocity=(15.0, 0.0))  # position wins, velocity ignored
MotionCommand(target_velocity=(0.0, 0.0))                      # decelerate to a hover
```

<figure markdown="span">
  ![Left, a command with both position and velocity flies to the point; right, a zero velocity from cruise stops](../../assets/img/mc-edge.png)
  <figcaption>Left, both a position and a velocity are set, so position wins and the velocity is ignored. Right, a zero velocity from a 15 m/s cruise decelerates to a stop within the stopping distance.</figcaption>
</figure>

A command that carries no channel this vehicle can use is a programming error, and the model says so rather than guessing.

```python
MotionCommand()   # nothing set
# ValueError: MotionCommand has no target_velocity: this channel requires a ground-velocity
#             vector ... An under-specified command for this vehicle is a programming error.
```

!!! note "Run it yourself"
    Every figure on this page is generated by [`examples/handbook/dynamics_multirotor.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/dynamics_multirotor.ipynb) — the same commands shown above, driving the real `Multirotor` from a hover.
