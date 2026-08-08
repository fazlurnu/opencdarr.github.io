# Experiments

A [scenario](../scenarios/index.md) is one run. An **experiment** is many runs, and you declare it
instead of writing a script for it. You say which parameters stay fixed and which parameters vary,
you give the declaration a stack of methods and a backend, and you get one row for each condition.

```python
result = run_experiment(
    {"dpsi": Sweep([15, 45, 90]), "pos_ci95": Fixed(10.0)},   # what varies, what is held
    methods=Methods(detector=StateBased(), resolver=MVP(1.05),
                    recovery=ProbabilisticFTR(), navigation=GnssNavigation(), perf=M600),
    backend=MC(n_encounters=500),                              # which estimator
    base_config=CFG, seed=1,
)

result.records()      # one dict for each condition
result.frame()        # the same rows, as a pandas DataFrame
result.cell(dpsi=45)  # the raw result of the estimator for one condition
```

| part | what it gives |
|---|---|
| the axes | each parameter, as `Fixed(value)` or `Sweep([levels])` |
| `Methods` | the stack that does not change: the detector, the resolver, the recovery criterion, the CNS models, and the airframe |
| the backend | the estimator: `MC(n_encounters=...)` or `IPS(shells=..., n_particles=..., reps=...)` |
| `base_config` and `seed` | each parameter that no axis declares, and the root of the reproducibility |

The cross-product of the `Sweep` axes gives the conditions. Each condition is one independent
seeded batch, thus two conditions are different in their declared levels and in nothing else.

A parameter is `Fixed`, or it is a `Sweep`. There is no third role that draws a parameter from a
distribution: that role is one level below, in the [scenario](../scenarios/index.md).

`Sweep.build` maps each level onto the value that the run needs, thus a level can read as a number
or a name in the results table while the run receives an object:

```python
"resolver": Sweep(["MVP", "VO"], name="resolver", build=RESOLVERS.__getitem__)
```

This is what lets a component be an axis. The resolver, the recovery criterion, the navigation
model, the wind and the scenario are declared in the same way as a scalar is.

The backend is the only argument that changes between the two estimators. `MC` counts the losses in
a fixed number of encounters. `IPS` splits the same event into shells and reaches the probabilities
that Monte Carlo cannot measure at a cost that is reasonable; refer to
[validation](../estimators/rare-event/validation.md).

## The case studies

- **[Pairwise conflict](example-pairwise-conflict.md)** — MVP against VO on two aircraft, as
  the crossing becomes shallow and the position fix becomes worse.
- **[Random traffic](example-random-traffic.md)** — the same declaration on a fleet in a disc,
  with the two estimators in one table.

Each is a finished experiment — the question, the declaration, the figures, and the sentence the
question deserved. They are the model answers for [L8 · The full experiment](../../tutorials/l8-experiment.md).

## In the code

The declaration layer is
[`experiment.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/experiment.py):
`Fixed`, `Sweep`, `Methods`, `MC`, `IPS`, `Ladder`, and the `ExperimentResult` with `records()`,
`frame()`, `cell()` and `plot()`. Each Monte-Carlo cell is one
[`estimate_ipr`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/estimator.py), and each
rare-event cell is one
[`estimate_rare_prob`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/ips.py).

`run_experiment` refuses a declaration that it cannot run. An unknown parameter name fails
immediately, and so does a parameter that no component reads — a `pos_ci95` sweep with no
navigation model is the usual example.

!!! code "Learn by doing"
    [L4 · Comparing designs](../../tutorials/l4-comparison.md) writes declarations like the one above and reads their grids honestly. [L8 · The full experiment](../../tutorials/l8-experiment.md) carries one from the question to the report.
