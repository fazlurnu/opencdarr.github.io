# Reproducibility

!!! note "Draft"
    Placeholder — the cache, the provenance card and parallel conditions will be described here.

Every number an experiment reports is a function of the base configuration, the declared levels,
the seed and the library source, and nothing else. `cache=True` stores one entry per condition
keyed on exactly those things, `card_dir=` writes them down beside the results, and `n_jobs`
spreads conditions over processes without touching the numbers.
