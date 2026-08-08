# Introduction

Source code is on [GitHub :octicons-link-external-16:](https://github.com/fazlurnu/OpenCDaRR).

OpenCDaRR evaluates the safety and efficiency of **conflict detection, resolution, and recovery** (CDaRR) algorithms under **communication, navigation, and surveillance (CNS) uncertainty**, for ATM/UTM applications.

Write your CDaRR algorithm, get your CDaRR performance.

## The motivation

Separation management is held to a high safety standard. ICAO commonly uses a Target Level of Safety (TLS) of approximately 5 × 10⁻⁹ fatal accidents per flight hour when evaluating en-route separation standards for manned aviation. Although the same TLS for drones doesn't exist yet, the safety expectation remains high.

Before an algorithm is trusted in the air, we test it in simulation with as much of the uncertainty included as the model can carry. But verifying against a target that small with Monte Carlo simulation alone is computationally exhaustive. OpenCDaRR provides the pieces needed to run that test: a **kinematics** model, a **separation manager** framework, an environment with **CNS** uncertainty and **wind** perturbation, and a [**rare-event estimator**](estimators/rare-event/index.md) that reaches the tail with far fewer runs.

## Contents

- **[Installation](installation.md)** — get it running.
- **[How it works](how-it-works.md)** — the class structure and one full simulation step.
- **[A first run](first-run.md)** — a complete mixed-fleet encounter, with and without noise.
- **[Modules](modules/index.md)** — the swappable pieces, from vehicle [kinematics](modules/kinematics/index.md) and [autopilot](modules/autopilot.md) to the [separation manager](modules/separation/index.md) that runs conflict detection, resolution, and recovery, over the [CNS](modules/cns/index.md) layer beneath.
- **[Estimators](estimators/index.md)** — turning many runs into one number with an interval: [Monte Carlo](estimators/monte-carlo.md) for anything you can afford to observe, and [rare-event simulation](estimators/rare-event/index.md) for the probabilities you cannot.
- **[Scenario](scenario/index.md)** — how the pieces are exercised, from a [pairwise conflict](scenario/pairwise.md) up to a [ring](scenario/ring.md) and [random traffic](scenario/random-traffic.md).
- **[Experiments](experiments/index.md)** — declaring what varies, running the cross-product, and reading one row per condition, with a worked comparison of two resolvers on a [pairwise conflict](experiments/example-pairwise-conflict.md) and on [random traffic](experiments/example-random-traffic.md).
- **[Build your own](build-your-own/index.md)** — a minimal runnable example and how to add your own model.
