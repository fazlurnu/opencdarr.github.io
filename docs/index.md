# Introduction

Source code is on [GitHub :octicons-link-external-16:](https://github.com/fazlurnu/OpenCDaRR).

OpenCDaRR evaluates the safety and efficiency of **conflict detection, resolution, and recovery** (CDaRR) algorithms under **communication, navigation, and surveillance (CNS) uncertainty**, for ATM/UTM applications.

Write your CDaRR algorithm, get your CDaRR performance.

## The problem

Separation management is held to a high safety standard. ICAO commonly uses a Target Level of Safety (TLS) of approximately 5 × 10⁻⁹ fatal accidents per flight hour when evaluating en-route separation standards for manned aviation. Before an algorithm is trusted in the air, we test it in simulation with as much of the real uncertainty included as the model can carry. But verifying against a target that small with Monte Carlo simulation alone is computationally exhaustive. OpenCDaRR provides the pieces needed to run that test: a **dynamics** model, a **separation manager** framework, an environment with **CNS** uncertainty and **wind** perturbation, and a **rare-event simulation** that reaches the tail with far fewer runs.

## Design principles

**Realism.** Aircraft measure their own position with an error, broadcasts are dropped or delayed, and wind pushes each airframe off its commanded track. Results then reflect how separation holds up against the imperfections a real system faces, not an idealised one. This is not an exhaustive list of uncertainty sources — more can be added.

**Modularity.** Conflict detection, conflict resolution, recovery criteria, the CNS, the vehicle dynamics, and the autopilot are each an abstract base class with one method. Changing an experiment means swapping an implementation, not the loop: a study comparing two resolvers changes one argument.

**Agent-based modelling and simulation (ABMS).** Each aircraft is an `Agent` carrying its own state, guidance and recovery memory, and — through the CNS — its own asymmetric situational awareness of the others rather than a global truth. Every aircraft runs the same detect → resolve → recover cycle against those perceived states, so fleet-level outcomes emerge from local decisions taken on incomplete information.

**Support for rare-event simulation.** The aircraft state, the guidance progress, and the separation memory are plain values passed in and out of each step, so the full state of a run can be copied at any instant and continued independently. That is what a rare-event estimator (multi-level splitting, IPS) needs to clone a particle mid-flight and follow the rare branch toward a collision.

## Contents

- **[Installation](installation.md)** — get it running.
- **[How it works](how-it-works.md)** — the class structure and one full simulation step.
- **[A first run](first-run.md)** — a complete mixed-fleet encounter, with and without noise.
- **[Modules](modules/index.md)** — the swappable pieces, from vehicle [dynamics](modules/dynamics/index.md) and [autopilot](modules/autopilot.md) to the [separation manager](modules/separation/index.md) that runs conflict detection, resolution, and recovery, over the [CNS](modules/cns/index.md) layer beneath.
- **[Environments](environments/index.md)** — how the pieces are exercised, from a [pairwise conflict](environments/pairwise.md) up to [multi-aircraft](environments/multi-aircraft.md) encounters.
- **[Build your own](build-your-own/index.md)** — a minimal runnable example and how to add your own model.
