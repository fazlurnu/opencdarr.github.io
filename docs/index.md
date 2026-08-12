# Introduction

Source code is on [GitHub :octicons-link-external-16:](https://github.com/fazlurnu/OpenCDaRR).

OpenCDaRR evaluates the safety and efficiency of **conflict detection, resolution, and recovery** (CDaRR) algorithms under **communication, navigation, and surveillance (CNS) uncertainty**, for ATM/UTM applications.

Write your CDaRR algorithm, get your CDaRR performance.

## The motivation

Separation management is held to a high safety standard. ICAO commonly uses a Target Level of Safety (TLS) of approximately 5 × 10⁻⁹ fatal accidents per flight hour when evaluating en-route separation standards for manned aviation. Although the same TLS for drones doesn't exist yet, the safety expectation remains high.

Before an algorithm is trusted in the air, we test it in simulation with as much of the uncertainty included as the model can carry. But verifying against a target that small with Monte Carlo simulation alone is computationally exhaustive. OpenCDaRR provides the pieces needed to run that test: a **kinematics** model, a **separation manager** framework, an environment with **CNS** uncertainty and **wind** perturbation, and a **rare-event estimator** that reliably reaches the tail probability with far fewer runs.

## What is inside

Three sections, in the order you are likely to need them.

- **[Getting started](getting-started/installation.md)** — [install the library](getting-started/installation.md), then fly [a first run](getting-started/first-run.md): two aircraft on a collision course, once with nothing switched on and once with a separation stack that clears them. [How it works](getting-started/how-it-works.md) is the five-minute map of the design principles and the parts.
- **[Tutorials](tutorials/index.md)** — the runnable course, four lessons that each build on the one before. Write your own [performance envelope and kinematics under CNS uncertainty](tutorials/t1-cns-uncertainty.md), estimate P(LoS) [with the built-in estimator](tutorials/t2-monte-carlo-with-config-and-scenario.md), [sweep a full experiment from a configuration file](tutorials/t3-setting-up-an-experiment.md), and [reach the rare tail with two estimators](tutorials/t4-two-estimators.md).
- **[Handbook](handbook/index.md)** — the reference behind the course: [aircraft](handbook/aircraft/index.md), [separation](handbook/separation/index.md), [CNS](handbook/cns/index.md), [wind](handbook/wind.md), [scenarios](handbook/scenarios/index.md), [estimators](handbook/estimators/index.md), and [experiments](handbook/experiments/index.md). Every page says what the piece is, why it is built that way, where it breaks, and — where it is swappable — the contract a replacement must honour.

Nothing in the handbook needs to be run. The tutorials cover the breadth; the handbook explains the depth. Come to it when a tutorial leaves you asking *why*.
