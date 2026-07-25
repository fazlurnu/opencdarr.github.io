# Separation Manager

!!! note "Draft"
    The `SeparationManager` is not subclassed — it is the orchestrator you hand a detector, a resolver,
    and a recovery criterion to. Build your own separation behaviour by combining your CD, CR, and CRR
    implementations and passing them to `SeparationManager.step(...)`. To be written.
