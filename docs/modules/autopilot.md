# Autopilot

The autopilot decides how the aircraft achieves its mission. Each decision tick it turns that intent into a single [`MotionCommand`](kinematics/index.md#motioncommand), the vehicle-neutral setpoint the airframe then flies. It is the setpoint **producer**; the low-level setpoint **tracker** (the [`Kinematics`](kinematics/index.md) step that banks a fixed-wing or slews a multirotor) lives one layer down. That is the same split [PX4](https://docs.px4.io/main/en/ros/offboard_control) draws between the mission navigator, which holds the plan, and the position controller, which flies it.

Like conflict detection or resolution, the autopilot is a swappable interface: a new guidance strategy is a file beside [`base.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/autopilot/base.py), not a fork of the loop. Two ship today. [`CruiseAutopilot`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/autopilot/cruise.py) holds a fixed heading and speed, the behaviour-preserving default. [`WaypointAutopilot`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/autopilot/waypoint.py) navigates a mission of waypoints, and does so for **both** airframes from one implementation.

## Producer, safety overlay, tracker

Three layers act on every tick, in order. The autopilot produces the aircraft's **nominal** command from its own live self-fix. The [separation manager](separation/index.md) may **override** that nominal when a conflict is predicted, releasing it back once [recovery](separation/recovery-criteria.md) says the plan is safe again. Whatever command survives is handed to the airframe's `Kinematics.step`, which tracks it under the vehicle's limits. Because the nominal is re-derived each tick from the current state, an aircraft that was pulled off its plan to avoid a conflict simply resumes navigating the moment the override lifts: nothing has to remember where it was going, the mission still says.

## The interface

Every autopilot implements one method:

$$ \texttt{step}(\text{state},\ \text{memory},\ \text{perf}) \longrightarrow (\text{MotionCommand},\ \text{memory}) $$

It is **pure**: a function of its arguments and the autopilot's own immutable configuration, reading and writing no global state, so a clone taken mid-flight evolves independently of its source. Any guidance progress, such as which leg of a plan is active, rides in the returned `GuidanceMemory`, threaded in and out and never stored as a mutable attribute on the object. This is the same no-hidden-state discipline the [separation memory](separation/index.md) keeps, and for the same reason: a probabilistic-IPR clone taken part-way through a mission has to resume the *same* leg it was on, so the leg index has to travel inside the clonable particle, not sit on a shared navigator.

`CruiseAutopilot` is the degenerate case that makes the layering visible. It precomputes a constant velocity command and returns it every tick, ignoring the state, the memory, and the performance it is passed:

```python
from opencdarr.autopilot import CruiseAutopilot

ap = CruiseAutopilot(heading=0.0, speed=17.0)  # hold due north at 17 m/s, forever
```

That is exactly the frozen nominal the loop used before a mission layer existed, so opting out of navigation reproduces the older runs unchanged. It is also the default: an encounter or a fleet given no autopilot flies its initial cruise.

## Flying a mission

A [`Mission`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/mission.py) is inert geometry, a `goto` point or an ordered `flight_plan`, in WGS84 lat/lon. It does not fly the aircraft; the `WaypointAutopilot` turns it into commands. *How fast* to fly, the arrival tolerance, and the loiter size are the autopilot's configuration, not the mission's:

```python
from opencdarr.autopilot import WaypointAutopilot
from opencdarr.mission import Mission, Waypoint

plan = Mission(flight_plan=(Waypoint(52.002, 4.000), Waypoint(52.003, 4.004)))
ap = WaypointAutopilot(plan, cruise_airspeed=17.0, capture_radius=40.0, loiter_radius=80.0)
```

Each tick it emits the **active waypoint** as a `target_position`, along with the previous waypoint as `target_leg_start` (the leg line) and a cruise airspeed. It advances to the next leg once the aircraft is within the `capture_radius` of the active waypoint, so it flies *through* the intermediate points rather than braking onto each one. At the final waypoint it stops advancing and adds a `target_loiter_radius`, asking the airframe to hold there.

## One autopilot, two airframes

Here is the reason a single `WaypointAutopilot` serves a multirotor and a fixed-wing alike: it emits a **position**, not a velocity. It never presumes how the vehicle will get there. Each airframe's controller interprets the same position setpoint through its own physics. The multirotor treats it as a point to fly straight at and slow to a hover on. The fixed-wing, which cannot stop or move sideways, treats the position plus its leg as a line to track and a point to orbit.

<figure markdown="span">
  ![Two panels of the same four-waypoint flight plan, flown by a multirotor and a fixed-wing. The multirotor cuts each corner tightly and stops on the final waypoint; the fixed-wing rounds each corner with a turn radius and circles the final waypoint on a loiter ring](../assets/img/autopilot-mission.png)
  <figcaption>The <strong>same mission</strong>, one <code>WaypointAutopilot</code>, two airframes. Left, the multirotor flies straight at each waypoint and settles into a hover on the last one (the dot). Right, the fixed-wing tracks each leg with L1 guidance, rounding the corners at its turn radius, and orbits the final waypoint because it cannot hover. Dotted rings are the capture radius at the intermediate waypoints and the loiter radius at the final one. Both paths come from the real <code>autopilot.step</code> feeding each airframe's <code>Kinematics.step</code>, nothing branches on which airframe is flying.</figcaption>
</figure>

Neither airframe is a special case in the autopilot. The multirotor ignores the leg and the loiter radius and reads only the point; the fixed-wing reads all three. This is what lets a [mixed fleet](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/mixed_fleet_demo.py) of both vehicle types fly one shared plan without a line of vehicle-specific navigation code.

## L1 leg tracking

Tracking a leg rather than cutting to its endpoint is worth a closer look, because it is the fixed-wing's whole answer to a waypoint. Given the leg line from the previous waypoint $A$ to the active one $B$, the aircraft steers toward a moving **reference point** a fixed lookahead $L_1$ ahead of it on the line. This is standard L1 guidance (Park, Deyst and How, 2004), used here for the effect it produces — a reference for how a fixed-wing follows a path. It runs on the [tracker](kinematics/fixedwing.md) side, from the leg the autopilot emits.

Work in a frame centred on the aircraft. With the unit vector along the leg $u = (B - A)/\lVert B - A \rVert$, the closest point on the line (the foot of the perpendicular) and the **cross-track distance** $d$ are

$$ F = A + \big((P - A)\cdot u\big)\,u, \qquad d = \lVert P - F \rVert. $$

The reference point advances from the foot along the leg by whatever keeps it on a circle of radius $L_1$ about the aircraft, and the commanded course is simply the bearing to it:

$$ R = F + \sqrt{\max(0,\ L_1^2 - d^2)}\ u, \qquad \chi_\text{cmd} = \operatorname{atan2}(R_E,\ R_N). $$

Three regimes fall out of that square root. On the line ($d = 0$) the reference sits $L_1$ straight ahead and the aircraft flies down the leg. Off the line but within $L_1$, the reference is the forward intersection of the circle with the line, and steering at it curves the aircraft *onto* the leg and then along it. Farther off than $L_1$, the square root vanishes, the reference collapses onto the foot, and the aircraft steers straight at the line for maximum correction. A bare `goto` with no leg reduces to pure pursuit, straight at the point.

<figure markdown="span">
  ![Left, the L1 construction: a leg line from A to B, an aircraft 50 m off it, the L1 circle of radius 80 m, the foot of the perpendicular, the reference point where the circle meets the line ahead, and the commanded-course arrow to it. Right, two fixed-wings starting 110 m off either side of a leg, each curving smoothly onto the line and tracking along it with no overshoot](../assets/img/autopilot-l1.png)
  <figcaption>Left, the <strong>construction</strong> for an aircraft 50 m off a leg, drawn from the real formulas: the foot <em>F</em>, the reference point <em>R</em> where the L1 circle meets the line ahead, and the commanded course toward it. Right, the <strong>result</strong>: two fixed-wings released 110 m off either side of a leg both capture the line and track along it, from either side, with no oscillation. The lookahead $L_1$ sets the capture-versus-tracking trade: larger is gentler and later, smaller is tighter and sooner.</figcaption>
</figure>

L1 is left unmodified here: without wind, a well-tuned L1 is what a fixed-wing needs, and the crab angle that wind introduces is handled separately in the [Wind](wind.md) module. The multirotor never runs any of this. To it the leg is invisible; it flies to the point and slows to a stop, tracking the position directly.

## In the code

The autopilots live in [`opencdarr/autopilot/`](https://github.com/fazlurnu/OpenCDaRR/tree/main/opencdarr/autopilot): `base.py` (the interface and `GuidanceMemory`), `cruise.py`, and `waypoint.py`, with the [`Mission`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/mission.py) it consumes beside them. You hand one to an encounter or a fleet per aircraft, and everything else stays the same:

```python
from opencdarr.autopilot import WaypointAutopilot

# a pairwise encounter: one autopilot per aircraft
outcome = run_encounter(own, intr, ...,
                        own_autopilot=WaypointAutopilot(own_mission),
                        intr_autopilot=WaypointAutopilot(intr_mission))

# a fleet: the autopilot rides on each Agent (default: CruiseAutopilot)
agents = [Agent(state=s, perf=p, autopilot=WaypointAutopilot(mission)), ...]
```

Give no autopilot and the aircraft flies its initial cruise. The figures on this page are generated by [`examples/handbook/autopilot.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/autopilot.ipynb) — the real `WaypointAutopilot` driving both airframes.

## Your own guidance law

A loiter that spirals in, a Dubins path planner, a follow-the-leader rule — any guidance law can be added the same way. See [Build your own → Autopilot](../build-your-own/autopilot.md).
