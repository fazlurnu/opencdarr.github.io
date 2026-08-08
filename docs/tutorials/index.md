# Tutorials

The [Handbook](../handbook/index.md) explains the library; this section teaches it. The tutorials are a course: nine levels of runnable notebooks that start at `pip install` and end at a full experiment with a report. Each lesson is one notebook, run from the top to the bottom, and each one ends with a check question you should be able to answer before you move on.

The notebooks live in the library repository, under [`examples/curriculum`](https://github.com/fazlurnu/OpenCDaRR/tree/main/examples/curriculum). Install once — that is lesson [L0.1](l0-setup.md) — then open the folder in Jupyter and work in order.

## The two paths

Each lesson is **core** or **depth**. Core lessons carry the course from one level to the next. Depth lessons stay on one level and open a single seam further — error models that persist across steps, link gates, the geometry helpers.

| Path | Lessons | Time |
| --- | --- | --- |
| Short | the core lessons only | about 12 hours |
| Full | all lessons | about 40 hours |

Do the short path first. Then come back for the depth lessons that your own work needs — after Level 2, most readers know which seam they care about.

## How to work a lesson

1. Read the goal at the top of the level page, so you know what you are trying to be able to do.
2. Run the notebook cell by cell, not all at once. Before each cell, predict what it will print or plot; the difference between your prediction and the output is the lesson.
3. Answer the check question at the end without scrolling back up.
4. When a *why* itches — why is the turn an arc, why does the resolver push sideways — follow the **Read** link on the lesson row. It goes to the handbook page that justifies the model you just drove, and that page links back here.

## The levels

| Level | Subject | Status |
| --- | --- | --- |
| [L0 · Setup](l0-setup.md) | Install, run one answer end to end, map the public surface. | available |
| [L1 · The parts](l1-parts.md) | Every module called directly, no simulation loop. | available |
| [L2 · One simulation](l2-simulation.md) | The parts assembled into a pairwise `run_fleet`. | in preparation |
| [L3 · From runs to rates](l3-rates.md) | Many encounters, one probability. | in preparation |
| [L4 · Comparing designs](l4-comparison.md) | More than one module varied at the same time. | in preparation |
| [L5 · Beyond two aircraft](l5-traffic.md) | Rings, traffic density, mixed fleets. | in preparation |
| [L6 · Rare events](l6-rare-events.md) | Where counting stops, and what replaces it. | in preparation |
| [L7 · Write your own](l7-write-your-own.md) | A resolver, a detector, an airframe, a scenario of your own. | in preparation |
| [L8 · The full experiment](l8-experiment.md) | From a question to a report, with everything above in service. | in preparation |

The plan for the whole course, including the lessons not yet written, is the [curriculum document](https://github.com/fazlurnu/OpenCDaRR/blob/main/docs/curriculum.md) in the library repository.
