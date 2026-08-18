---
authorship: opus-5
---

# Scenario

!!! note "Draft"
    Placeholder. This section will describe the three scenarios.

The [modules](../index.md) give the parts. A *scenario* puts the parts to work. Each scenario sets up traffic that comes into conflict, runs the traffic to the end of the encounter, and measures the separation. The core is the same directed, pairwise primitive in each scenario, from two aircraft to many aircraft.

- **[Pairwise conflict](pairwise.md)**: one encounter between two aircraft. This is the simplest scenario for a study of the detection and the resolution. It is also the scenario in which a sweep moves one variable at a time.
- **[Ring](ring.md)**: many aircraft on a circle, and each aircraft flies to the opposite side. All the conflicts arrive at the centre at the same time.
- **[Random traffic](random-traffic.md)**: many aircraft with random origins and destinations in an area, at a given traffic density.

For one worked encounter from the start to the end, refer to [A first run](../../getting-started/first-run.md). The notebooks for this chapter are [`circle_scenario.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/circle_scenario.ipynb) for the ring and [`traffic_density.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/traffic_density.ipynb) for random traffic; the pairwise encounter drives [`monte_carlo.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/monte_carlo.ipynb) and [`resolver_comparison.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/resolver_comparison.ipynb).
