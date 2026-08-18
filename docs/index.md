---
authorship: fazlur
---

# Introduction

Source code is on [GitHub :octicons-link-external-16:](https://github.com/fazlurnu/OpenCDaRR).

OpenCDaRR evaluates the safety and efficiency of **conflict detection, resolution, and recovery** (CDaRR) algorithms under **communication, navigation, and surveillance (CNS) uncertainty**, for ATM/UTM applications.

Write your CDaRR algorithm, get your CDaRR performance.

## The motivation

Separation management typically requires a high safety standard. ICAO commonly uses a Target Level of Safety (TLS) of approximately 5 × 10⁻⁹ fatal accidents per flight hour when evaluating en-route separation standards for manned aviation. Although the same TLS for drones doesn't exist yet, the safety expectation remains high.

Before an algorithm is trusted in the air, we test it in simulation with as much of the uncertainty included as the model can carry. But verifying against a target that small with Monte Carlo simulation alone is computationally exhaustive. OpenCDaRR provides the pieces needed to run that test: a **kinematics** model, a **separation manager** framework, an environment with **CNS** uncertainty and **wind** perturbation, and a **rare-event estimator** that reliably reaches the tail probability with far fewer runs.

## What is inside

Three sections, in the order you are likely to need them.

- **[Getting started](getting-started/installation.md)** -  a quick look on how to [install the library](getting-started/installation.md), try [a first run](getting-started/first-run.md), and understand [how it works](getting-started/how-it-works.md).

- **[Tutorials](tutorials/index.md)** - a set of markdowns and codes that you can read, copy, and try yourself.


- **[Handbook](handbook/index.md)** — an explanation of how things work, intentionally written in detail so you don't have to read codes.

The tutorial covers the breadth of the library, the handbook covers the depth.

## AI-usage declaration

I personally believe that AI, more specifically LLMs, have become a good tool at consuming and generating text and code at a rate that no human can match.

Almost all [OpenCDaRR](https://github.com/fazlurnu/OpenCDaRR) are AI-generated. However, I tried to verify them by asking AI to generate test cases, on top of those that they already wrote. I also verified the results visually through plots.

In this website, you will see a signature at the end of the page to distinguish the main contributor of it. I wrote parts of them, hoping that you read parts of them, to communicate the goal of the page between us, human.