# Recovery Criteria

Recovery is one of the three strategies the [Separation Manager](index.md) orchestrates. You build your own by subclassing `RecoveryCriterion` and implementing a single method:

```python
should_resume(own, intr, rpz) -> bool
```

It returns `True` when ownship may stop resolving and return to its mission. The built-ins are `PastCPA`, `FTR`, and `ProbabilisticFTR`.

See **[Separation Manager → Recovery](index.md#recovery)** for the interface in context and a worked example with figures.
