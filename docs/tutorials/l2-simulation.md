# L2 · One pairwise simulation

!!! note "In preparation"
    The nine L2 notebooks are being written. The plan below is the commitment; the [curriculum document](https://github.com/fazlurnu/OpenCDaRR/blob/main/docs/curriculum.md) holds the live version.

Level 1 called each part directly. Level 2 hands them to `run_fleet` and watches the same behaviour come out of the loop — that is the test of whether Level 1 stuck. The level builds one pairwise encounter and then complicates it one seam at a time, so every change in the plot has exactly one cause.

The planned lessons:

- **Agents** — two aircraft as a fleet, and what `run_fleet` does each tick.
- **Termination rules** — when a run decides it is finished.
- **`create_conflict`** — spawn two aircraft so their nominal paths meet at a chosen geometry.
- **Record and plot** — pull the trace out of a run and draw the standard pictures.
- **Noise added** — the first navigation error, and what it does to detection.
- **The noise shape changed** — the same error budget under a different distribution.
- **The datalink** — delay, loss, and update interval between the aircraft.
- **Wind** — the shared field, and which modules feel it.
- **A mission** — waypoints under all of the above.

Read ahead: [Scenarios → Pairwise conflict](../handbook/scenarios/pairwise.md) for the geometry, and [How it works](../getting-started/how-it-works.md) for the tick order the loop enforces.
