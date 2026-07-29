# Separation Manager

The **separation manager** is the detect-and-avoid safety overlay. It sits between the [autopilot](../autopilot.md), which says what the aircraft *wants* to do, and the [dynamics](../dynamics/index.md), which says what the aircraft is physically *able* to do. Its one job each tick: decide whether the aircraft's nominal command is safe given the traffic it perceives, and if not, replace it with an avoidance command until the danger has passed.

It answers that by running three steps in order, and this is why conflict detection, conflict resolution, and recovery live under it here:

- **[Conflict Detection](conflict-detection.md)** predicts a loss of separation within a look-ahead time.
- **[Conflict Resolution](conflict-resolution.md)** computes the avoidance manoeuvre against the intruders currently in conflict.
- **[Recovery Criteria](recovery-criteria.md)** decides when the conflict has cleared and it is safe to return to the plan.

The separation manager is the orchestrator that runs **detect → resolve → recover** and turns their verdicts into a single command. Each of the three is a swappable model with its own page; this page is about the layer that composes them.

## Input and output

Every tick, for one aircraft, the separation manager takes the aircraft's own (noisy) self-fix, the traffic it currently perceives through [CNS](../cns/index.md), and the nominal command the autopilot produced, and returns the command the airframe should actually fly:

```mermaid
flowchart LR
    NOM[nominal command<br/>from autopilot] --> SM
    PERC[perceived traffic<br/>from CNS] --> SM
    SM[Separation Manager<br/>detect → resolve → recover] --> CMD[final command]
    CMD --> DYN([Dynamics.step])
```

Concretely, that is one method:

$$ \texttt{step}(\text{state},\ \text{perceived traffic},\ \text{nominal},\ \text{memory},\ \ldots) \longrightarrow (\text{command},\ \text{memory}) $$

with the detector, resolver, and recovery criterion injected alongside the protected-zone radius `rpz` and the look-ahead time. The output is the `MotionCommand` for this tick and the aircraft's updated memory. While no conflict is live the output *is* the nominal, passed straight through, so an aircraft with nothing to avoid flies exactly what its autopilot asked for. The moment a conflict is predicted, the output becomes the resolver's avoidance command instead, and it stays there until recovery says the aircraft is clear, at which point it snaps back to the nominal. That is the Mission → Override → Mission switch a real detect-and-avoid vehicle flies.

One optional input is an **airframe adapter**: the resolvers speak in ground velocities, which a multirotor flies directly but a fixed-wing cannot. The adapter lowers the final command onto the channels the airframe can fly (a course and an airspeed for the fixed-wing), so the same resolver stays vehicle-neutral and one manager drives a mixed fleet.

## What it does inside

Detection, resolution, and recovery are pairwise primitives, and the manager is what generalises them to many intruders. It keeps a set of **active conflict pairs**: a pair becomes active when the detector flags it, resolution acts on the pairs *currently* detected, and recovery is checked for *every* active pair. The aircraft reverts to its nominal only once it is clear of **all** its conflicts, so the aggregate "resume when clear of everything" falls out of per-pair removals without the recovery criterion itself ever needing to know about more than one intruder. When a pair is active but not detected this instant, the aircraft coasts on its current velocity rather than snapping back early.

## No hidden state

The separation manager holds **no mutable state of its own**. A single instance is shared across the whole fleet, and every aircraft's conflict memory rides in a value that is threaded *into* `step` and returned *out*, never stored on the manager. This is not a style choice. The probabilistic-IPR machinery clones an aircraft by copying its state, and any future-affecting value kept *outside* that state would be silently shared between a clone and its parent, so a clone taken mid-conflict would fly differently from the original. Keeping the memory in the threaded value is what makes a clone independent. The same discipline runs through the [autopilot's](../autopilot.md) guidance memory and the aircraft state itself.

## Beyond detect-resolve-recover

The classical detect → resolve → recover pipeline is one way to keep aircraft apart, and it is the manager that ships today. But it is not the only shape a separation manager can take. What the layer really is, viewed from the loop, is a contract:

> given an aircraft's state, the traffic it perceives, and its nominal command, return the command it should fly.

Anything that honours that contract can stand in as the separation manager, whatever it does inside. A learned policy is the motivating case: a **reinforcement-learning separation manager** would map the same perceived picture and nominal straight to a command, with the detect-resolve-recover reasoning replaced by a trained network rather than three hand-built geometric pieces. The loop, the autopilot above it, and the airframe below it would not change, because none of them looks inside this layer — they only hand it the perceived state and fly the command it returns.

That is the direction this layer is built to grow in: promoting the separation manager to a swappable interface, with the classical orchestrator as one implementation and a learned policy as another, both judged on the same footing by the same [environments](../../environments/index.md) and metrics. To combine your own detector, resolver, and recovery criterion, or to write a manager of a different kind, see [Build your own → Separation Manager](../../build-your-own/separation-manager/index.md).
