# Introduction

OpenCDaRR is an open, distilled reference for **conflict detection, resolution, and recovery** (CDR) in autonomous aviation — the models and methods that keep uncrewed aircraft separated. It simulates airborne traffic as plain data advanced by interchangeable models. A single aircraft is an object with states such as position and velocity. The physics, the guidance, and the separation logic are strategy objects that act on it. A communication, navigation, and surveillance (CNS) layer governs what each aircraft knows about the others, and how imperfect that knowledge is. A simulation loop wires them together and steps time forward.

Source code is on [GitHub :octicons-link-external-16:](https://github.com/fazlurnu/OpenCDaRR).

## The problem

Separation management is the task of keeping aircraft apart, and it runs in three stages. **Conflict detection (CD)** predicts a loss of separation before it happens. **Conflict resolution (CR)** computes the manoeuvre that avoids it. **Recovery** decides when it is safe to return to the plan. Each stage acts not on the truth but on what the **CNS** layer delivers, which is noisy, sometimes late, and different for every aircraft. The gap between what an aircraft knows and what is real is what makes the problem hard, and it is what OpenCDaRR is built to study.

## The ideas

**Realism.** We build in as much uncertainty as the model can carry. Aircraft measure their own position with an error, broadcasts are dropped or delayed, receivers act on an asymmetric situational awareness, and wind pushes each airframe off its commanded track. Results then reflect how separation holds up against the imperfections a real system faces. It doesn't cover all, but you can add more.

**Modularity.** Conflict detection, conflict resolution, recovery criteria, the CNS, the vehicle dynamics, and the autopilot are each an abstract base class with one method. To change the experiment we swap an implementation, not the loop. A study comparing two resolvers, for example, changes one argument.

**Enabling rare event simulation.** The aircraft state, the guidance progress, and the separation memory are plain values passed in and out of each step. The full state of a run can therefore be copied at any instant and continued independently. That is what a rare-event estimator (importance splitting, IPS) needs to clone a particle mid-flight and follow the rare branch toward a collision.

## How to read this

- **[Installation](installation.md)** — get it running.
- **[How it works](how-it-works.md)** — the class structure and one full simulation step.
- **Modules** — the swappable pieces, from vehicle [dynamics](modules/dynamics/index.md) and [autopilot](modules/autopilot.md) to the separation stack of [conflict detection](modules/conflict-detection.md), [resolution](modules/conflict-resolution.md), and [recovery](modules/recovery-criteria.md), over the [CNS](modules/cns.md) layer beneath.
- **Environments** — how the pieces are exercised, from a [pairwise conflict](environments/pairwise.md) up to [multi-aircraft](environments/multi-aircraft.md) encounters.
- **[Build your own](build-your-own/index.md)** — a minimal runnable example and how to add your own model.
