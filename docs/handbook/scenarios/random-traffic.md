---
authorship: opus-5
---

# Random traffic

!!! note "Draft"
    Placeholder. The random-traffic scenario will be described here.

The **random-traffic** scenario puts many aircraft in an area at a given traffic density. Each aircraft has a random origin and a random destination. Thus the conflicts occur at random times and at random geometries, and secondary conflicts can occur after a resolution.

The scenario is [`RandomTraffic`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/scenario/random_traffic.py), which carries its own measurement area: the traffic fills the simulation disc and the results are read from the smaller measured disc inside it. The notebook for this scenario is [`traffic_density.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/traffic_density.ipynb): it builds the traffic, raises the density, and measures safety with and without CNS uncertainty. A finished sweep over this scenario is the [random-traffic case study](../experiments/example-random-traffic.md).
