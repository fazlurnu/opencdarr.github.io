# Conflict Detection

Conflict detection is one of the three strategies the [Separation Manager](index.md) orchestrates. You build your own by subclassing `ConflictDetector` and implementing a single method:

```python
detect(own, intr, rpz, t_lookahead) -> bool
```

It returns one yes/no verdict per directed pair. The built-in is `StateBased` (predictive, horizontal CPA).

See **[Separation Manager → Conflict detection](index.md#conflict-detection)** for the interface in context and a worked example with figures.
