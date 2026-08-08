# Autopilot

The autopilot decides how the aircraft achieves its mission. Each timestep turns that intent into a single [`MotionCommand`](kinematics/index.md#motioncommand), and the airframe then flies according to it. This library provides two built-in autopilots, the `CruiseAutopilot` and the `WaypointAutopilot`. [`CruiseAutopilot`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/autopilot/cruise.py) holds a fixed heading and speed, while [`WaypointAutopilot`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/autopilot/waypoint.py) navigates a mission of waypoints for *both* airframes from one implementation.

The command from the autopilot is considered as the aircraft's **nominal** command. However, to maintain safety, the [separation manager](separation/index.md) may override that nominal when a conflict is predicted, and releases it back once [recovery](separation/recovery-criteria.md) says it is save to resume the mission. The nominal command is calculated every timestep from the current state, so an aircraft that was flying off its plan resumes navigating the moment the override is gone.

## The interface

Every autopilot implements one method:

$$ \texttt{step}(\text{state},\ \text{memory},\ \text{perf}) \longrightarrow (\text{MotionCommand},\ \text{memory}) $$

It is a function of its arguments and of the autopilot's own immutable configuration. Guidance progress, such as which leg of a plan is active when we are on multi-waypoint mission, rides in the returned `GuidanceMemory` rather than on the object. This is required to enable the rare-event simulation.

`CruiseAutopilot` is the simple case that makes the layering visible. It precomputes a constant velocity command and returns it every timestep, ignoring the state, the memory, and the performance it is passed:

```python
from opencdarr.autopilot import CruiseAutopilot

ap = CruiseAutopilot(heading=0.0, speed=17.0)  # hold due north at 17 m/s, forever
```

## Flying a mission

A [`Mission`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/mission.py) is inert geometry, a `goto` point or an ordered `flight_plan`, in WGS84 lat/lon. How fast to fly, the arrival tolerance, and the loiter size are the autopilot's configuration rather than the mission's.

```python
from opencdarr.autopilot import WaypointAutopilot
from opencdarr.mission import Mission, Waypoint

plan = Mission(flight_plan=(Waypoint(52.002, 4.000), Waypoint(52.003, 4.004)))
ap = WaypointAutopilot(plan, cruise_airspeed=17.0, capture_radius=40.0, loiter_radius=80.0)
```

Each timestep the autopilot emits the **active waypoint** as a `target_position`, along with the previous waypoint as `target_leg_start` and a cruise airspeed. The autopilot advances to the next leg once the aircraft is within the `capture_radius` of the active waypoint. It therefore flies *through* the intermediate points, rather than braking onto each one. At the final waypoint it stops advancing and adds a `target_loiter_radius`, asking the airframe to hold there.

## One autopilot, two airframes

One `WaypointAutopilot` serves a multirotor and a fixed-wing alike, because it emits a position and not a velocity. It never presumes how the vehicle will get there. Each airframe reads the same setpoint through its own physics.

<figure markdown="span">
  ![Two panels of the same four-waypoint flight plan, flown by a multirotor and a fixed-wing. The multirotor cuts each corner tightly and stops on the final waypoint; the fixed-wing rounds each corner with a turn radius and circles the final waypoint on a loiter ring](../assets/img/autopilot-mission.png)
  <figcaption>The <strong>same mission</strong>, one <code>WaypointAutopilot</code>, two airframes. Left, the multirotor flies straight at each waypoint and settles into a hover on the last one (the dot). Right, the fixed-wing tracks each leg with L1 guidance, rounding the corners at its turn radius, and orbits the final waypoint because it cannot hover. Dotted rings are the capture radius at the intermediate waypoints and the loiter radius at the final one. Both paths come from the real <code>autopilot.step</code> feeding each airframe's <code>Kinematics.step</code>, nothing branches on which airframe is flying.</figcaption>
</figure>

Neither airframe is a special case in the autopilot. That is what lets a [mixed fleet](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/mixed_fleet_demo.py) of both vehicle types fly one shared plan without a line of vehicle-specific navigation code.

## L1 leg tracking

Tracking a leg rather than cutting to its endpoint is the fixed-wing's whole answer to a waypoint, so it is worth a closer look. Take the leg line from the previous waypoint $A$ to the active one $B$. The aircraft steers toward a moving **reference point**, a fixed lookahead $L_1$ ahead of it on the line. This is standard L1 guidance ([Park, Deyst and How, 2004](https://arc.aiaa.org/doi/10.2514/6.2004-4900)), and it is used here for the effect it produces, a reference for how a fixed-wing follows a path. It runs on the [tracker](kinematics/fixedwing.md) side, from the leg the autopilot emits, as seen from the figure below.

<!-- We work in a frame centred on the aircraft, and we write $u = (B - A)/\lVert B - A \rVert$ for the unit vector along the leg. The closest point on the line (the foot of the perpendicular) and the **cross-track distance** $d$ are then

$$ F = A + \big((P - A)\cdot u\big)\,u, \qquad d = \lVert P - F \rVert. $$

The reference point then advances from the foot along the leg by whatever keeps it on a circle of radius $L_1$ about the aircraft, and the commanded course is the bearing to it.

$$ R = F + \sqrt{\max(0,\ L_1^2 - d^2)}\ u, \qquad \chi_\text{cmd} = \operatorname{atan2}(R_E,\ R_N). $$

Three regimes fall out of that square root. On the line ($d = 0$) the reference sits $L_1$ straight ahead and the aircraft flies down the leg. Off the line but within $L_1$, the reference is the forward intersection of the circle with the line. Steering at it curves the aircraft *onto* the leg and then along it. Farther off than $L_1$, the square root vanishes, the reference collapses onto the foot, and the aircraft steers straight at the line for maximum correction. -->

<figure markdown="span">
  ![Left, the L1 construction: a leg line from A to B, an aircraft 50 m off it, the L1 circle of radius 80 m, the foot of the perpendicular, the reference point where the circle meets the line ahead, and the commanded-course arrow to it. Right, two fixed-wings starting 110 m off either side of a leg, each curving smoothly onto the line and tracking along it with no overshoot](../assets/img/autopilot-l1.png)
  <figcaption>Left, the <strong>construction</strong> for an aircraft 50 m off a leg, drawn from the real formulas: the foot <em>F</em>, the reference point <em>R</em> where the L1 circle meets the line ahead, and the commanded course toward it. Right, the <strong>result</strong>: two fixed-wings released 110 m off either side of a leg both capture the line and track along it, from either side, with no oscillation. The lookahead $L_1$ sets the capture-versus-tracking trade: larger is gentler and later, smaller is tighter and sooner.</figcaption>
</figure>

This library leaves L1 unmodified. Without wind a well-tuned L1 is what a fixed-wing needs, and the crab angle that wind introduces is handled separately in the [Wind](wind.md) module.

## In the code

The autopilots live in [`opencdarr/autopilot/`](https://github.com/fazlurnu/OpenCDaRR/tree/main/opencdarr/autopilot), which holds [`base.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/autopilot/base.py) (the interface and `GuidanceMemory`), `cruise.py`, and `waypoint.py`. The [`Mission`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/mission.py) they consume sits beside them. You hand one autopilot to an encounter or a fleet per aircraft, and everything else stays the same:

```python
from opencdarr.autopilot import WaypointAutopilot

# a pairwise encounter: one autopilot per aircraft
outcome = run_encounter(own, intr, ...,
                        own_autopilot=WaypointAutopilot(own_mission),
                        intr_autopilot=WaypointAutopilot(intr_mission))

# a fleet: the autopilot rides on each Agent (default: CruiseAutopilot)
agents = [Agent(state=s, perf=p, autopilot=WaypointAutopilot(mission)), ...]
```

Give no autopilot and the aircraft flies its initial cruise.

## Your own guidance law

Any guidance law can be added the same way, whether it is a loiter that spirals in, a Dubins path planner, or a follow-the-leader rule. See [Build your own → Autopilot](../build-your-own/autopilot.md).

!!! code "Run it yourself"
    The figures on this page are generated by [`examples/handbook/autopilot.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/autopilot.ipynb) — the real `WaypointAutopilot` driving both airframes.
