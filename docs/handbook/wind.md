# Wind

Wind is the one part of the environment that acts inside the kinematics. It is not one of the replaceable interfaces. It is a **field that the loop puts into each step**, in the same category as the timestep. Like the [CNS](cns/index.md) layer, the world applies the wind to the aircraft, and the aircraft does not select it. Unlike CNS, the wind acts on the *ground truth*, and it bends the path that each airframe flies.

A [`WindField`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/wind.py) is a steady, uniform, horizontal wind. It is one velocity vector, the same at each position and at each time. It is a read-only input to `Kinematics.step`, and no aircraft holds it. Its default value is `NO_WIND`, which is calm air. Thus a run without wind gives the same result as a run before this library had wind. Gusts, shear, and a field that changes in space or in time are deliberately not included. `WindField` is the seam for these fields at a later time.

## The one relation

All the behaviour comes from one vector sum. The velocity of an aircraft over the ground is the velocity through the air, plus the wind.

$$\vec{V}_{\text{ground}} = \vec{V}_{\text{air}} + \vec{V}_{\text{wind}}$$

The two airframes behave differently in the *same* wind, because each airframe controls and limits a different side of that equation. The [performance envelope](aircraft/performance.md) of a vehicle is its top speed, and it limits the **airspeed** term. The multirotor usually receives a command for a **ground** velocity. The fixed-wing flies a constant **airspeed**. Thus the same wind has a different effect on the motion of each airframe.

Meteorology gives the name of a wind from the bearing that it blows *from*. Thus a "north wind" (from 0°) moves the air to the south. `WindField.from_met(coming_from, speed)` makes a wind from that convention. In the figures below, the faint red arrows are the wind **velocity vector**, and they point in the direction of the air movement.

## Fixed-wing: a circle in the air is a trochoid over the ground

A fixed-wing flies a constant airspeed at a heading with a bank limit. Thus a steady turn is a clean circle *in the air*. The wind moves that full circle downwind during the turn. Thus **the path over the ground is a trochoid**, and the wind moves each loop by `wind × turn-period`.

The wind effect on the fixed-wing uses the kinematic point-mass model of [Reyner and Liem](https://www.mdpi.com/2504-446X/10/5/337)[^rl]. The fixed-wing controller of [PX4](https://docs.px4.io/main/en/ros/offboard_control) uses the same coordinated-turn kinematics. OpenCDaRR takes the model, but it does not take their path planner. In the inertial frame ($x$ east, $y$ north, angles clockwise from north), the aircraft flies its true airspeed $V_{\text{TAS}}$ at the heading $\psi$. It turns with the bank angle $\phi$. The equations add the wind to the ground velocity:

$$\dot{x} = V_{\text{TAS}}\sin\psi + w_x, \qquad \dot{y} = V_{\text{TAS}}\cos\psi + w_y, \qquad \dot{\psi} = \frac{g\tan\phi}{V_{\text{TAS}}}$$

Two results come from that wind term. First, the ground speed follows the wind triangle. It is fastest downwind and slowest upwind:

$$V_{\text{GS}} = \sqrt{V_{\text{TAS}}^2 + V_{\text{WS}}^2 - 2\,V_{\text{TAS}}\,V_{\text{WS}}\cos(\psi - \theta_{wa})}$$

Second, to make good a ground course $\chi$, the aircraft must **crab** into the wind by

$$\theta_w = \psi - \chi = \arcsin\!\left(\frac{V_{\text{WS}}}{V_{\text{TAS}}}\sin(\theta_{wa} - \chi)\right)$$

In these equations, $V_{\text{WS}}$ is the wind speed and $\theta_{wa}$ is the bearing that the wind comes from. In calm air the two wind terms are zero. Thus $\psi = \chi$ and $V_{\text{GS}} = V_{\text{TAS}}$, and the airframe flies exactly as it flies in still air.

<figure markdown="span">
  ![A 3x3 grid of the ground track of a fixed-wing in a continuous turn. There is one panel for each wind bearing, and one panel with no wind. With no wind, the track is a closed circle. Under each wind, the track becomes a trochoid with loops, and it moves in the direction of the wind-vector arrows in the background.](../assets/img/wind-fixedwing.png)
  <figcaption>A fixed-wing in a continuous turn at maximum bank, with one panel for each wind direction. The faint arrows show the wind velocity. With no wind, the ground track is a closed circle. Under wind, the track is a trochoid, and it moves downwind by one turn-period at a time. The ground speed changes between the airspeed plus the wind speed and the airspeed minus the wind speed. It is fastest downwind and slowest upwind. Thus the fixed-wing crabs to hold a ground course, and it cannot hold a constant speed</figcaption>
</figure>

One result is important for the separation. The **ground speed of a fixed-wing depends on its heading**. With a command for a ground course, the fixed-wing holds that course, and it crabs into the wind. But its speed along that course changes with the direction, and this change moves the time of a conflict.

## Multirotor: the envelope is on airspeed

A multirotor receives a command for a ground velocity, but its top speed limits the **airspeed** that it can fly. Thus one comparison decides if the wind is visible in the track. This comparison is the airspeed that the command *needs* against the airspeed that the vehicle *has*. A multirotor is a holonomic point, and it can fly its airspeed vector in any direction up to $V_{\max}$. To make good a commanded ground velocity $\vec{V}_g$, it flies the airspeed $\vec{V}_g - \vec{V}_{\text{wind}}$ with a limit at the envelope. Thus its true ground velocity is

$$\vec{V}_{\text{ground}} = \operatorname{clip}_{\lVert\,\cdot\,\rVert \le V_{\max}}\!\left(\vec{V}_g - \vec{V}_{\text{wind}}\right) + \vec{V}_{\text{wind}}$$

While the necessary airspeed stays in the envelope, the limit has no effect, and $\vec{V}_{\text{ground}} = \vec{V}_g$ exactly. The multirotor cancels the wind fully. When the airspeed saturates, the remainder of the wind moves the vehicle downwind.

<figure markdown="span">
  ![Two panels of a multirotor with a command to fly north through a crosswind. With a wind below its top speed, the ground track is a straight line to the north. With a wind above its top speed, the wind moves the track to a downwind diagonal. Wind-vector arrows are in the background of the two panels.](../assets/img/wind-multirotor.png)
  <figcaption>A multirotor with a command to fly north at 5 m/s through a crosswind. Below its top speed (left), it crabs into the wind and holds the commanded ground track exactly. The wind is not visible in the track. Above its top speed (right), the airspeed reaches its limit, the multirotor cannot cancel the drift, and the wind moves the track downwind</figcaption>
</figure>

Below the envelope, the multirotor holds its ground command to the metre, and the wind never shows in the track. Above the envelope, the airspeed saturates and the vehicle drifts. The drift is smooth, and the state reports the shortfall instead of a hidden error. The strongest example is a hold at one point. A multirotor can **hover into a wind** and hold its ground speed at zero, while the wind stays below its top speed. A fixed-wing cannot stop, so it cannot do this.

## Detect-and-avoid under wind

Separation management usually operates correctly under wind, for two reasons. A **uniform** wind adds the *same* drift to the two aircraft. The separation stack also decides in the wind-blown **ground** frame, which is the correct geometry for that decision. Thus the wind cancels in the relative motion. The remainder is the wind-relative performance of each airframe. Together with asymmetric situational awareness, this remainder gives a small probability of a loss of separation.

<figure markdown="span">
  ![A crossing conflict between two fixed-wing aircraft, resolved in still air and in a crosswind. The left panel shows the ground tracks, which bend and crab under wind near the closest approach, with the circle of the protected zone. The right panel shows the two separation curves, and each curve has its minimum above the protected zone of 50 m.](../assets/img/wind-daa.png)
  <figcaption>A crossing conflict between fixed-wing aircraft, resolved in still air and in a wind of 6 m/s (MVP and Past-CPA). The ground tracks crab and bend under wind (left). The ground speed changes with the heading, so the closure occurs earlier. The manoeuvre still opens the miss distance above the protected zone (right). This wind increases the miss distance, and other bearings decrease it. In the two conditions the aircraft stay clear</figcaption>
</figure>

A multirotor absorbs a uniform wind almost completely. It crabs the wind out, and its encounters are almost independent of the wind. A fixed-wing has a small residual that depends on the bearing. Its ground speed changes with the heading. Thus a wind along the track increases the miss distance, and a crosswind decreases it. Alone, the wind is a *margin* effect, and the miss distance moves by metres. Together with asymmetric situational awareness, that loss of margin can cause an actual loss of separation. In the [200-run Monte Carlo sweep](../getting-started/first-run.md#wind) with a wind of 10 m/s and GNSS self-noise, 2 of the 200 runs lost separation. The closest miss was 34.8 m, which is inside the protected zone of 50 m. The same sweep without wind had no loss of separation. A uniform field does not include the large wind hazards, which are gusts, shear, and each field that changes across the airspace.

## In the code

`WindField` is in [`opencdarr/wind.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/wind.py). One argument gives the wind to an encounter, `run_encounter(..., wind=field)` or `run_fleet(..., wind=field)`. The loop then puts the field into each `Kinematics.step`. Thus one line switches the wind on in any run:

```python
WindField.from_met(coming_from_deg=270.0, speed=6.0)  # 6 m/s from the west
```

The default value everywhere is `NO_WIND`. Without a `wind=` argument, each airframe flies in still air, and the ground velocity is equal to the air velocity.

**The kinematics hold the wind effect**, because `WindField` is a field and not an interface. Thus a wind that changes in space or in time is a new `Kinematics` implementation, not a new wind class. The airframe reads the field in its own `step`. To model a different wind effect, write your own kinematics — the contract is on the [Aircraft](aircraft/index.md#the-contract) page, and [L7 · Write your own](../tutorials/l7-write-your-own.md) builds one.

!!! code "Learn by doing"
    [L1.11 · Wind](../tutorials/l1-parts.md) (40 min, core) adds a wind field to single steps of both airframes and watches which speed each one holds. [A first run](../getting-started/first-run.md#wind) adds the same field to a full Monte Carlo sweep.

[^rl]: Reyner and Liem, *Energy-Efficient Trochoidal Path Planning for Unmanned Aircraft Under Wind and Performance Constraints*, Drones **2026**, 10, 426. OpenCDaRR uses only the kinematic point-mass model (Eqs 1–9), which is the coordinated-turn yaw and the wind vector sum. It does not use the path planner.
