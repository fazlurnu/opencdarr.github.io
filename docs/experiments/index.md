# Experiments

!!! note "Draft"
    Placeholder — the declaration layer will be described here.

An [environment](../environments/index.md) is one run. An **experiment** is many of them, declared
rather than scripted: you say which parameters are held and which are swept, hand it a backend, and
get one row per condition.

- **[Ex: resolver comparison](example-resolver-comparison.md)** — a worked experiment end to end:
  MVP against VO as the crossing gets shallow and the position fix gets worse.
- **[Reproducibility](reproducibility.md)** — the cache, the provenance card, and what makes a
  result re-derivable from `config + seed + code`.
