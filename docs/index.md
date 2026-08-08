# Introduction

Source code is on [GitHub :octicons-link-external-16:](https://github.com/fazlurnu/OpenCDaRR).

OpenCDaRR evaluates the safety and efficiency of **conflict detection, resolution, and recovery** (CDaRR) algorithms under **communication, navigation, and surveillance (CNS) uncertainty**, for ATM/UTM applications.

Write your CDaRR algorithm, get your CDaRR performance.

## The motivation

Separation management is held to a high safety standard. ICAO commonly uses a Target Level of Safety (TLS) of approximately 5 × 10⁻⁹ fatal accidents per flight hour when evaluating en-route separation standards for manned aviation. Although the same TLS for drones doesn't exist yet, the safety expectation remains high.

Before an algorithm is trusted in the air, we test it in simulation with as much of the uncertainty included as the model can carry. But verifying against a target that small with Monte Carlo simulation alone is computationally exhaustive. OpenCDaRR provides the pieces needed to run that test: a **kinematics** model, a **separation manager** framework, an environment with **CNS** uncertainty and **wind** perturbation, and a **rare-event estimator** that reliably reaches the tail probability with far fewer runs.

## What is inside

- **[Aircraft](handbook/aircraft/index.md)** — a [performance envelope](handbook/aircraft/performance.md), a [multirotor](handbook/aircraft/multirotor.md) and a [fixed-wing](handbook/aircraft/fixedwing.md), and the [autopilot](handbook/aircraft/autopilot.md) that flies the mission.
- **[Separation](handbook/separation/index.md)** — the detect → resolve → recover overlay, each stage a swappable one-method interface.
- **[CNS](handbook/cns/index.md)** — what each aircraft actually knows about the others, and how wrong that knowledge is.
- **[Wind](handbook/wind.md)** — the environment field every step flies through.
- **[Scenarios](handbook/scenarios/index.md)** — a [pairwise conflict](handbook/scenarios/pairwise.md), a [ring](handbook/scenarios/ring.md), and [random traffic](handbook/scenarios/random-traffic.md).
- **[Estimators](handbook/estimators/index.md)** — [Monte Carlo](handbook/estimators/monte-carlo.md) for anything you can afford to observe, and [rare-event simulation](handbook/estimators/rare-event/index.md) for the probabilities you cannot.
- **[Experiments](handbook/experiments/index.md)** — declaring what varies and reading one row per condition, with finished case studies on a [pairwise conflict](handbook/experiments/example-pairwise-conflict.md) and on [random traffic](handbook/experiments/example-random-traffic.md).
- **[Build your own](build-your-own/index.md)** — walkthroughs for supplying your own models, until the [L7 lessons](tutorials/l7-write-your-own.md) replace them.
