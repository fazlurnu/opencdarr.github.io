# Wind

Wind is the one part of the environment that reaches inside the flight dynamics. It is not one of the swappable interfaces — it is a **field the loop threads into every step**, the same category as the timestep. Like the [CNS](cns/index.md) layer, it is something the world imposes on the aircraft rather than a choice the aircraft makes; unlike CNS, it acts on the *truth*, bending the path each airframe actually flies.

A [`WindField`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/wind.py) is a steady, uniform, horizontal wind — a single velocity vector, the same everywhere and at every instant. It is a read-only input passed to `Dynamics.step`, never stored on an aircraft, and it defaults to `NO_WIND` (calm), so a run without wind is byte-for-byte what it was before wind existed. Gusts, shear, and any field that varies in space or time are deliberately left out; `WindField` is the seam they would slot behind later.

## The one relation

Everything follows from a single vector sum: an aircraft's velocity over the ground is the velocity it flies through the air, plus the wind.

$$\vec{V}_{\text{ground}} = \vec{V}_{\text{air}} + \vec{V}_{\text{wind}}$$

What makes the two airframes behave differently under the *same* wind is which side of that equation each one controls and limits. A vehicle's [performance envelope](../build-your-own/performance.md) — its top speed — bounds the **airspeed** term. The multirotor is usually commanded a **ground** velocity; the fixed-wing flies a fixed **airspeed**. So the same wind shows up in each airframe's motion in a different place.

Wind is named the way meteorology names it — by the bearing it blows *from* — so a "north wind" (from 0°) pushes the air toward the south. `WindField.from_met(coming_from, speed)` builds one from that convention; in the figures below the faint red arrows are the wind **velocity vector**, pointing the way the air moves.

## Fixed-wing: a circle in the air is a trochoid over the ground

A fixed-wing flies a constant airspeed at a bank-limited heading. A steady turn is therefore a clean circle *in the air*, but the wind carries that whole circle downwind as it is drawn — so **over the ground the path is a trochoid**, each loop displaced by `wind × turn-period`.

The wind's effect on the fixed-wing is the kinematic point-mass model of [Reyner and Liem](https://www.mdpi.com/2504-446X/10/5/337)[^rl], the same coordinated-turn kinematics PX4's fixed-wing controller uses — OpenCDaRR takes the model, not their path planner. In the inertial frame ($x$ east, $y$ north, angles clockwise from north), the aircraft flies its true airspeed $V_{\text{TAS}}$ at heading $\psi$ and turns by banking $\phi$, with the wind added onto the ground velocity:

$$\dot{x} = V_{\text{TAS}}\sin\psi + w_x, \qquad \dot{y} = V_{\text{TAS}}\cos\psi + w_y, \qquad \dot{\psi} = \frac{g\tan\phi}{V_{\text{TAS}}}$$

Two consequences fall out of that wind term. The ground speed follows the wind triangle — fastest downwind, slowest upwind:

$$V_{\text{GS}} = \sqrt{V_{\text{TAS}}^2 + V_{\text{WS}}^2 - 2\,V_{\text{TAS}}\,V_{\text{WS}}\cos(\psi - \theta_{wa})}$$

and to make good a ground course $\chi$ the aircraft must **crab** into the wind by

$$\theta_w = \psi - \chi = \arcsin\!\left(\frac{V_{\text{WS}}}{V_{\text{TAS}}}\sin(\theta_{wa} - \chi)\right)$$

where $V_{\text{WS}}$ is the wind speed and $\theta_{wa}$ the bearing it comes from. At calm both wind terms vanish, so $\psi = \chi$ and $V_{\text{GS}} = V_{\text{TAS}}$ — the airframe reduces to still-air flight exactly.

<figure markdown="span">
  ![A 3x3 grid of a fixed-wing's ground track in a continuous turn, one panel per wind bearing plus a no-wind panel; with no wind the track is a closed circle, and under each wind it becomes a looping trochoid drifting in the direction the background wind-vector arrows point](../assets/img/wind-fixedwing.png)
  <figcaption>A fixed-wing in a continuous max-bank turn, one panel per wind direction (the faint arrows show the wind velocity). With no wind the ground track closes into a circle; under wind it becomes a trochoid, drifting downwind one turn-period at a time. Its ground speed swings between airspeed ± wind speed — fastest downwind, slowest upwind — so it crabs to hold a ground course and can never hold its speed constant.</figcaption>
</figure>

The consequence that matters for separation: a fixed-wing's **ground speed depends on its heading**. Commanded a ground course, it holds that course by crabbing into the wind, but its speed along it shifts with direction — which, as we will see, moves the timing of a conflict.

## Multirotor: the envelope is on airspeed

A multirotor is commanded a ground velocity, but its top speed limits the **airspeed** it can fly. So whether the wind is visible in its track comes down to one comparison — the airspeed the command *requires* against the airspeed the vehicle *has*. Being a holonomic point, it can fly its airspeed vector in any direction up to $V_{\max}$: to make good a commanded ground velocity $\vec{V}_g$ it flies the airspeed $\vec{V}_g - \vec{V}_{\text{wind}}$, clamped to the envelope, so its true ground velocity is

$$\vec{V}_{\text{ground}} = \operatorname{clip}_{\lVert\,\cdot\,\rVert \le V_{\max}}\!\left(\vec{V}_g - \vec{V}_{\text{wind}}\right) + \vec{V}_{\text{wind}}$$

While the required airspeed stays inside the envelope the clip does nothing and $\vec{V}_{\text{ground}} = \vec{V}_g$ exactly — the wind is fully cancelled. Once it saturates, the leftover wind is what drifts the vehicle.

<figure markdown="span">
  ![Two panels of a multirotor commanded to fly north through a crosswind; with wind below its top speed the ground track is a straight northward line, and with wind above its top speed the track is blown off to a downwind diagonal, over background wind-vector arrows](../assets/img/wind-multirotor.png)
  <figcaption>A multirotor commanded 5 m/s north through a crosswind. Below its top speed (left) it crabs into the wind and holds the commanded ground track exactly — the wind is invisible in the track. Above its top speed (right) the airspeed clamps, the drift can no longer be cancelled, and the track is blown downwind.</figcaption>
</figure>

Below the envelope the multirotor meets its ground command to the metre and the wind never shows in the track. Above it, the airspeed saturates and the vehicle drifts — gracefully, and honestly: the shortfall is reported in the state, not hidden. The sharpest version of this is holding a point: a multirotor can **hover into a wind** and null its ground speed to zero, as long as the wind stays under its top speed — something a fixed-wing, which can never stop, cannot do.

## Detect-and-avoid under wind

Separation management mostly holds up under wind because a **uniform** wind adds the *same* drift to both aircraft, and the separation stack decides on the wind-blown **ground** frame — which is exactly the geometry it should act on. So the wind cancels in the relative motion. What is left is each airframe's wind-relative performance, and — combined with asymmetric situational awareness — a minor chance of loss of separation.

<figure markdown="span">
  ![A fixed-wing crossing conflict resolved in still air and in a crosswind; the left panel shows the ground tracks bending and crabbing under wind near the closest approach with the protected-zone circle, and the right panel shows both separation curves reaching their minimum above the 50 m protected zone](../assets/img/wind-daa.png)
  <figcaption>A fixed-wing crossing conflict, resolved in still air and in a 6 m/s wind (MVP + Past-CPA). The ground tracks crab and bend under wind (left), and because ground speed shifts with heading the closure arrives sooner — but the manoeuvre still opens the miss past the protected zone (right). Here the wind widens the miss; other bearings tighten it. Either way it clears.</figcaption>
</figure>

A multirotor absorbs a uniform wind almost completely — it crabs the wind out and its encounters are nearly wind-invariant. A fixed-wing pays a small, bearing-dependent residual: because its ground speed varies with heading, a wind along the track widens the miss while a crosswind tightens it. On its own, wind is a *margin* effect — the miss moves by metres. Combined with asymmetric situational awareness, that margin erosion can tip a run into an actual loss of separation: in the [200-run Monte Carlo sweep](../first-run.md#wind) with a 10 m/s wind and GNSS self-noise, 2 of 200 runs lost separation (closest miss 34.8 m, inside the 50 m protected zone), against zero losses in the same sweep without wind. The large wind hazards, gusts and shear and anything that varies across the airspace, are exactly what a uniform field leaves out.

## In the code

`WindField` lives in [`opencdarr/wind.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/wind.py). It is passed to an encounter through one argument — `run_encounter(..., wind=field)` or `run_fleet(..., wind=field)` — and threaded into each `Dynamics.step`, so turning wind on is a one-line change to any run:

```python
from opencdarr.wind import WindField

wind = WindField.from_met(coming_from_deg=270.0, speed=6.0)  # 6 m/s from the west
# outcome = run_fleet(agents, ..., wind=wind)
```

The default everywhere is `NO_WIND`. The figures on this page are drawn by [`scripts/handbook/wind.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/handbook/wind.py).

[^rl]: Reyner and Liem, *Energy-Efficient Trochoidal Path Planning for Unmanned Aircraft Under Wind and Performance Constraints*, Drones **2026**, 10, 426. OpenCDaRR re-derives only its kinematic point-mass model (Eqs 1–9) — the coordinated-turn yaw and wind vector-sum kinematics — never its path planner.

## Your own wind model

A different wind effect can be modelled the same way — see [Build your own → Dynamics](../build-your-own/dynamics.md).