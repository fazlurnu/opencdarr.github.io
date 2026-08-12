# Tutorials

The tutorials run as a series. Each one builds on the one before it:

- [T1. Under CNS uncertainty](t1-cns-uncertainty.md)
- [T2. Using built-in estimator](t2-monte-carlo-with-config-and-scenario.md)
- [T3. Setting up an experiment](t3-setting-up-an-experiment.md)
- [T4. Two estimators](t4-two-estimators.md)
- [T5. Calibrating the ladder](t5-calibrating-the-ladder.md)

The tutorials are deliberately not organised per [`Modules`](../handbook/index.md), because that would end up as a lot of small tutorials. Instead, modifications to an existing `Module`, and implementations of your own, are included in the tutorial that needs them.

As a heads-up, here is what each one covers.

**T1. Under CNS uncertainty**

1. Write your own `performance` envelope and your own `kinematics`.
2. Build a pairwise conflict with `communication` and `navigation` uncertainty in it.
3. Run one encounter, then many, and estimate P(LoS) with your own loop.

**T2. Using built-in estimator**

1. Carry your components over from T1, and hold the numbers in a `Config` and the geometry in a `Scenario`.
2. Estimate P(LoS) on a `pairwise` scenario with the built-in `estimate_p_los`, run in parallel over your cores.

**T3. Setting up an experiment**

1. Fly six heterogeneous aircraft, spawned by the `CrossingRing` scenario so they meet in the middle together.
2. Read the world and the CDaRR stack from a configuration file with `load_run`, instead of writing them in the notebook.
3. Sweep with `run_experiment`, one row per condition, and compare `MVP` against `VO` as the position accuracy degrades.

**T4. Two estimators**

1. Write your own conflict resolution, and sweep it against the two built-in ones.
2. Sweep the recovery criteria as well, and watch plain Monte Carlo run out of events to count.
3. Estimate the same conditions again with the rare-event estimator, changing nothing but the `backend=` argument.

**T5. Calibrating the ladder**

1. Fly a 500-encounter Monte Carlo pilot that counts zero losses, and read its 500 achieved separations as a distribution.
2. Put the levels of the rare-event ladder on that distribution, for a 100 m protected zone and for a 50 m one, and check both by their per-level survival.
3. Measure two ladders that fail, and see what calibration is and is not worth.

The tutorials cover the breadth of what OpenCDaRR can do. The [Handbook](../handbook/index.md) explains and justifies the depth of each part.
