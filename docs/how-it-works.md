# How it works

This page describes the design principles, the parts it is built from, then a full step of the parts interaction.

## Design principles

**Realism.** Aircraft measure their own position with an error, broadcasts are dropped or delayed, and wind pushes each airframe off its commanded track. Results then reflect how separation holds up against the imperfections a real system faces, not an idealised one. This is not an exhaustive list of uncertainty sources — more can be added.

**Modularity.** Conflict detection, conflict resolution, recovery criteria, the CNS, the vehicle kinematics, and the autopilot are each an abstract base class with one method. Changing an experiment means swapping an implementation, not the loop: a study comparing two resolvers changes one argument.

**Agent-based modelling and simulation (ABMS).** Each aircraft is an `Agent` carrying its own state, guidance and recovery memory, and — through the CNS — its own asymmetric situational awareness of the others rather than a global truth. Every aircraft runs the same detect → resolve → recover cycle against those perceived states, so fleet-level outcomes emerge from local decisions taken on incomplete information.

**Support for rare-event simulation.** The aircraft state, the guidance progress, and the separation memory are plain values passed in and out of each step, so the full state of a run can be copied at any instant and continued independently. That is what a rare-event estimator (multi-level splitting, IPS) needs to clone a particle mid-flight and follow the rare branch toward a collision.

## The class structure

The stack is built from eight interfaces. Each is an abstract base class with a single method and one or more implementations, and each has its own page under **[Modules](modules/index.md)**. To change an experiment we pick a different implementation of one interface, and nothing else moves. A new implementation can be added the same way.

<div class="col-widths" markdown>

| Interface | Role |
| --- | --- |
| [`ConflictDetector`](modules/separation/conflict-detection.md) | Predict loss of separation within a look-ahead time |
| [`ConflictResolver`](modules/separation/conflict-resolution.md) | Compute the avoidance manoeuvre against a set of intruders |
| [`RecoveryCriterion`](modules/separation/recovery-criteria.md) | Decide when it is safe to return to the plan |
| [`Kinematics`](modules/kinematics/index.md) | Integrate the equations of motion for one vehicle |
| [`Autopilot`](modules/autopilot.md) | Produce the nominal command that tracks the mission |
| [`NavigationModel`](modules/cns/navigation.md) | Measure an aircraft's own (noisy) state to broadcast |
| [`CommunicationModel`](modules/cns/communication.md) | Deliver or drop a broadcast, with latency |
| [`SurveillanceModel`](modules/cns/surveillance.md) | Hold the perceived state of a receiver |

</div>

Two objects tie these parts together. [`SeparationManager`](modules/separation/index.md) runs detection, resolution, and recovery against the traffic it is handed. `Agent` bundles one aircraft's state with the models that fly it. Above both sits the simulation loop, and that loop is where the CNS layer and the wind field come in.

The command that moves between these layers is a vehicle-agnostic setpoint called [`MotionCommand`](modules/kinematics/index.md#motioncommand). The autopilot proposes one, [`SeparationManager`](modules/separation/index.md) may override it to resolve a conflict, and [`Kinematics`](modules/kinematics/index.md) adjusts it to the aircraft's flight envelope.

## An aircraft is an `Agent`

An `Agent` is everything that belongs to *one* aircraft. It is the object you build to put an aircraft in a run, and it holds four things:

```python
Agent(state, perf, kinematics(), autopilot())
#     |      |     |             |
#     |      |     |             +-- what it is trying to do when no conflict
#     |      |     +---------------- how it moves
#     |      +---------------------- what it is capable of
#     +----------------------------- where it is right now
```

The last two have sensible defaults, so `Agent(state, perf)` is already a complete aircraft: it gets a [`Multirotor`](modules/kinematics/multirotor.md) airframe and a [`CruiseAutopilot`](modules/autopilot.md) holding whatever heading and speed the state started with.

### What is per-aircraft, and what is shared

This is the part worth reading twice, because the split is not obvious and it decides what you can and cannot express.

| on each `Agent` | shared by the whole run |
|---|---|
| where it is | conflict detection |
| what it can do (`Performance`) | conflict resolution |
| how it moves (`Kinematics`) | recovery criterion |
| what it is trying to do (`Autopilot`) | the CNS models — navigation, communication, surveillance |
| | the wind |

The idea behind the line: **the left column is the aircraft, the right column is the airspace it is flying in.** A multirotor and a fixed-wing genuinely are different vehicles, so they carry their own physics and their own limits. But separation rules, and the datalink everyone talks over, are properties of the *system* rather than of any one aircraft — so there is one of each, handed to the run.

With:

**You can fly a mixed fleet.** Give one `Agent` a `Multirotor` with an `M600` envelope and another a `FixedWing` with `SMALL_FIXEDWING`, and they will fly side by side under their own physics. [A first run](first-run.md) does exactly that.

**You cannot give two aircraft different resolvers.** There is one detector, one resolver and one recovery criterion for the whole run, so every aircraft reasons the same way. A mixed fleet is mixed in *airframe*, not in separation logic. This is done assuming you want to test the same separation algorithm accross the fleet.

### Saying it in an experiment

`run_fleet` takes a list of `Agent`s, so a mixed fleet is a single line there. The [experiment runner](experiments/index.md) declares it as `airframes` — one `Airframe` per aircraft, ownship first — which replaces the single `perf`/`kinematics` rather than joining them:

```python
Methods(detector=StateBased(), resolver=MVP(1.05), recovery=PastCPA(),
        airframes=[Airframe(M600), Airframe(SMALL_FIXEDWING, FixedWing())])
```

`Airframe` is the `Performance` and the `Kinematics` bundled, because those two have to agree — a fixed-wing on a multirotor's envelope has `phi_max = 0` and could never turn. Bundling them means a mismatched pair is rejected on the line you write it, instead of flying silently straight.

!!! note "In a mixed fleet, each aircraft needs a speed its own airframe can fly"
    The two envelopes differ — a multirotor is happy at 10 m/s and a small fixed-wing stalls below 12. The sampler sets them separately (`speed` for the ownship, `gs_intr` for the intruder), and an aircraft spawned outside its own envelope is refused rather than flown. See [the worked example](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/mixed_fleet.ipynb).

## One simulation step

The figure below shows one step for a pair of aircraft, `i` and `j`, inside `run_fleet` (the multi-aircraft loop; `run_encounter` is the same shape for a single pair).

<figure markdown="span">
  ![Two aircraft, i and j, each running its own kinematics, autopilot, CNS, and separation manager, coupled only through the CNS layer](assets/img/ObjectInteractions.drawio.png)
  <figcaption>One step for a pair of aircraft. Each runs the same loop, and the two meet only through CNS.</figcaption>
</figure>

Start from one aircraft's true state. **Navigation** adds noise to that state, producing the measurement the aircraft acts on and broadcasts. **Communication** carries the broadcast to the other aircraft, each link with its own reception probability and latency, so a message can arrive late or never. **Surveillance** on the receiving side updates the perceived traffic when a message lands and holds the last one otherwise. The `SeparationManager` then reads the aircraft's own noisy navigation and its perceived traffic, and overrides the `Autopilot` command when it infers a conflict. Finally, `Kinematics` takes that command and advances the true state to the next step, with **wind** perturbing the motion along the way.

The [next page](first-run.md) runs this loop for a full encounter — two aircraft flying toward a conflict and avoiding it — and shows what the noise and wind change.
