# Modules

The simulation is assembled from a handful of swappable pieces — mostly abstract base classes with a single method, plus the environment field the loop flies them through. To change an experiment you replace one implementation and leave the loop untouched. This section takes them in turn — what each does, the model behind it, and what we found.

- **[Dynamics](dynamics/index.md)** — how a vehicle moves: a multirotor as a holonomic point, a fixed-wing through a bank-limited turn.
- **[Autopilot](autopilot.md)** — the nominal command that follows the mission.
- **[Conflict Detection](conflict-detection.md)** — predicting a loss of separation before it happens.
- **[Conflict Resolution](conflict-resolution.md)** — computing the avoidance manoeuvre against a set of intruders.
- **[Recovery Criteria](recovery-criteria.md)** — deciding when it is safe to return to the plan.
- **[CNS](cns/index.md)** — the communication, navigation, and surveillance layer that governs what each aircraft knows about the others.
- **[Wind](wind.md)** — the steady environment field the loop threads into every step, and how each airframe meets it.

Each piece is introduced on the [How it works](../how-it-works.md) page and exercised together in [A first run](../first-run.md); the pages here go deeper. To supply your own, see [Build your own](../build-your-own/index.md).
