---
authorship: opus-5
---

# Pairwise conflict

!!! note "Draft"
    Placeholder. The pairwise scenario will be described here.

The **pairwise** scenario is the building block of two aircraft. All the other scenarios scale from it. Two aircraft start on a collision course, each aircraft flies a mission, and the run continues to the end of the encounter through the full stack.

The geometry and the sampler are in [`opencdarr/scenario/pairwise.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/scenario/pairwise.py): `create_conflict` places one intruder from the crossing angle `dpsi`, the miss distance `dcpa`, the time to loss of separation `tlos`, and the side; `PairwiseEncounter` is the sampled distribution over those slots. The sampled encounter drives [`monte_carlo.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/monte_carlo.ipynb) and the sweep in [`resolver_comparison.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/resolver_comparison.ipynb).
