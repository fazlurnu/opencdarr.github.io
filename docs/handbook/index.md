# Handbook

The handbook explains the library: what each model is, why it is built the way it is, what it assumes, and — where a piece is swappable — the contract a replacement must honour. Nothing on these pages needs to be run. The runnable course is the [Tutorials](../tutorials/index.md) section, and the two are linked page by lesson: come here when a lesson leaves you asking *why*, and take the "Learn by doing" pointer at the foot of a page when reading stops being enough.

The chapters follow the build:

- **[Aircraft](aircraft/index.md)** — the performance envelope, the two airframes, and the autopilot that flies the mission.
- **[Separation](separation/index.md)** — the detect → resolve → recover overlay that keeps aircraft apart.
- **[CNS](cns/index.md)** — the communication, navigation, and surveillance layer that governs what each aircraft knows about the others.
- **[Wind](wind.md)** — the steady environment field the loop threads into every step, and how each airframe meets it.
- **[Scenarios](scenarios/index.md)** — the traffic a run flies: a pairwise conflict, a ring, random traffic.
- **[Estimators](estimators/index.md)** — from many runs to one probability with an interval, by plain counting and by rare-event splitting.
- **[Experiments](experiments/index.md)** — declared comparisons across all of the above, with two finished case studies.

Every page keeps the same shape: what the piece is, why it is built this way, where it breaks, then the contract and the lesson that drives it. [How it works](../getting-started/how-it-works.md) is the five-minute map of how the pieces connect; to replace one with code of your own, the walkthroughs under [Build your own](../build-your-own/index.md) cover the ground until the L7 lessons land.
