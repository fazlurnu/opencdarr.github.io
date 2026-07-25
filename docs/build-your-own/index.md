# Build your own

Everything in OpenCDaRR that you might change is either a plain value or an interface with a single method, so extending it means writing one small class (or one value) and passing it in. The loop never changes. This section walks through each extensible piece.

- **[Performance](performance.md)** — the flight envelope of an airframe.
- **[Dynamics](dynamics.md)** — how a vehicle moves.
- **[Autopilot](autopilot.md)** — the nominal command that follows a mission.
- **[Conflict Detection](conflict-detection.md)** — predicting a loss of separation.
- **[Conflict Resolution](conflict-resolution.md)** — the avoidance manoeuvre.
- **[Recovery Criteria](recovery-criteria.md)** — deciding when to return to the plan.
- **[Separation Manager](separation-manager.md)** — wiring detection, resolution, and recovery together.
- **[CNS](cns.md)** — navigation, communication, and surveillance.

Each interface and what it does is listed on the [How it works](../how-it-works.md) page. The pages here show how to supply your own.

!!! note "Draft"
    A minimal end-to-end runnable example will open this section once the public API settles.
