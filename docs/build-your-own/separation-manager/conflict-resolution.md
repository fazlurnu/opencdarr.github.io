# Conflict Resolution

Conflict resolution is one of the three strategies the [Separation Manager](index.md) orchestrates. You build your own by subclassing `ConflictResolver` and implementing a single method:

```python
resolve(own, intruders, rpz, preferred) -> MotionCommand
```

It returns the ground-velocity command (`target_velocity=(v_east, v_north)`) that avoids the conflicting set. The built-ins are `MVP` (potential field) and `VO` (velocity obstacles).

See **[Separation Manager → Conflict resolution](index.md#conflict-resolution)** for the interface in context and a worked example with figures.
