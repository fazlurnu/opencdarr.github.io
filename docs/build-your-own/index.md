# Build your own

Everything in OpenCDaRR that you might change is either a plain value or an interface with a single method, so extending it means writing one small class (or one value) and passing it in. The loop never changes. This section walks through each extensible piece.

- **[Performance](performance.md)** — the flight envelope of an airframe.
- **[Dynamics](dynamics.md)** — how a vehicle moves.
- **[Autopilot](autopilot.md)** — the nominal command that follows a mission.
- **[Separation Manager](separation-manager/index.md)** — build your own [conflict detection](separation-manager/index.md#conflict-detection), [resolution](separation-manager/index.md#conflict-resolution), and [recovery](separation-manager/index.md#recovery), and combine them into one object.
- **[CNS](cns/index.md)** — navigation, communication, and surveillance.

Each interface and what it does is listed on the [How it works](../how-it-works.md) page. The pages here show how to supply your own.
