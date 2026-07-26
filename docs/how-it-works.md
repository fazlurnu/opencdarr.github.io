# How it works

This page opens up the simulation. First the parts it is built from, then one full step that shows how they interact.

## The class structure

The stack is built from eight interfaces. Each is an abstract base class with a single method and one or more implementations, and each has its own page under **Modules**. To change an experiment we pick a different implementation of one interface, and nothing else moves. Of course, you can also add yours.

<div class="col-widths" markdown>

| Interface | Role |
| --- | --- |
| [`ConflictDetector`](modules/conflict-detection.md) | Predict loss of separation within a look-ahead time |
| [`ConflictResolver`](modules/conflict-resolution.md) | Compute the avoidance manoeuvre against a set of intruders |
| [`RecoveryCriterion`](modules/recovery-criteria.md) | Decide when it is safe to return to the plan |
| [`Dynamics`](modules/dynamics/index.md) | Integrate the equations of motion for one vehicle |
| [`Autopilot`](modules/autopilot.md) | Produce the nominal command that tracks the mission |
| [`NavigationModel`](modules/cns/navigation.md) | Measure an aircraft's own (noisy) state to broadcast |
| [`CommunicationModel`](modules/cns/communication.md) | Deliver or drop a broadcast, with latency |
| [`SurveillanceModel`](modules/cns/surveillance.md) | Hold the perceived state of a receiver |

</div>

Two objects tie these parts together. `SeparationManager` runs detection, resolution, and recovery against the traffic it is handed. `Agent` bundles one aircraft's state with the models that fly it. Above both sits the simulation loop, and that loop is where the CNS layer and the wind field come in.

The command that moves between these layers is a vehicle-agnostic setpoint called `MotionCommand`. The autopilot proposes one, `SeparationManager` may override it to resolve a conflict, and `Dynamics` adjusts it to the aircraft's flight envelope.

## How a step works

The figure below shows one step for a pair of aircraft, `i` and `j`, inside `run_fleet` (the multi-aircraft loop; `run_encounter` is the same shape for a single pair).

<figure markdown="span">
  ![Two aircraft, i and j, each running its own dynamics, autopilot, CNS, and separation manager, coupled only through the CNS layer](assets/img/ObjectInteractions.drawio.png)
  <figcaption>One step for a pair of aircraft. Each runs the same loop, and the two meet only through CNS.</figcaption>
</figure>

Start from one aircraft's true state. **Navigation** adds noise to that state, producing the measurement the aircraft acts on and broadcasts. **Communication** carries the broadcast to the other aircraft, each link with its own reception probability and latency, so a message can arrive late or never. **Surveillance** on the receiving side updates the perceived traffic when a message lands and holds the last one otherwise. The `SeparationManager` then reads the aircraft's own noisy navigation and its perceived traffic, and overrides the `Autopilot` command when it infers a conflict. Finally, `Dynamics` takes that command and advances the true state to the next step, with **wind** perturbing the motion along the way.

The [next page](first-run.md) runs this loop for a full encounter — two aircraft flying to a waypoint, meeting in conflict, and avoiding — and shows what the noise changes.
