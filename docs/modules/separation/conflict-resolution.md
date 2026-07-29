# Conflict Resolution

Once a pair is [detected](conflict-detection.md) in conflict, the resolver computes the avoidance manoeuvre: given the ownship and the set of intruders it is currently in conflict with, it returns the velocity that clears them. The output is a **ground-velocity vector**, vehicle-neutral, which the airframe below then flies its own way (a multirotor takes it directly, a fixed-wing turns onto it under its bank limit). Two resolvers ship, and they embody two different ideas of what "clear them" means.

- [`MVP`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cr/mvp.py) (Modified Voltage Potential) treats each intruder as a repulsion and steers away from the predicted collision point.
- [`VO`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cr/vo.py) (Velocity Obstacle) treats each intruder as a forbidden cone of velocities and takes the shortest way out of it.

Both take a `margin` ($\ge 1$) that enlarges the zone they clear to, so the manoeuvre finishes with a buffer beyond the bare protected zone. Both stay closest to the ownship's **current** velocity, not its nominal: pulling back toward the nominal destabilised the resolver in testing (it snaps back the instant a return looks feasible, re-enters the conflict, and oscillates), so returning to the plan is left to [recovery](recovery-criteria.md), a separate layer.

## MVP: a potential push

MVP computes the closest-approach point $\mathbf{c}$ (the relative position at CPA, pointing from the ownship toward the intruder) and pushes the ownship's velocity *away* from it, by just enough that the resolved trajectory grazes the resolution zone $R = \texttt{rpz}\times\texttt{margin}$ rather than merely reaching range $R$ at the closest approach:

$$ \mathbf{v}_\text{own}' = \mathbf{v}_\text{own} - \frac{\text{gain}}{|t_\text{cpa}|}\,\hat{\mathbf{c}} $$

The push grows as the closest approach nears (the $1/|t_\text{cpa}|$ term), which is what makes it a potential field. Against several intruders at once MVP **sums** the pairwise pushes: a potential field superposes, so the resolved velocity is the current velocity minus the sum of the individual avoidance vectors. (When the predicted miss is essentially zero the push direction is undefined, so MVP falls back to a fixed perpendicular to pick a side.)

## VO: shortest way out of the cone

VO builds, for each intruder, the set of ownship velocities that lead to a future incursion: a **cone** in velocity space, apex at the intruder's velocity, axis along the bearing to it, half-angle $\arcsin(R / d)$ where $d$ is the current range. Any velocity inside the cone is unsafe for that pair. The resolution is the velocity **outside** the cone nearest the current one, the minimal change that just escapes.

Against several intruders the forbidden region is the **union** of the cones, and the resolution is the nearest velocity outside *all* of them. This is deliberately not a sum: adding pairwise escapes can land back inside a cone, because a union of cones is not something you can superpose. VO finds the union's boundary analytically (each cone edge, plus the intersections of edges from different cones) and keeps the nearest exterior point. This sum-versus-union split is the sharpest practical difference between the two resolvers, and it shows up in [multi-intruder encounters](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/multi_intruder_demo.py), where MVP's summed push can under-clear a symmetric double conflict while VO still leaves the union.

## The two on one conflict

For a single pair the two often resolve in a similar direction, but not identically. Below, a head-on-course crossing (worst-case zero-miss geometry, no noise) resolved cooperatively, both aircraft manoeuvring.

<figure markdown="span">
  ![Two panels. Left, the ground tracks of a 90-degree crossing resolved by MVP and by VO: both ownship tracks bend west around the crossing and both clear to about 102 m, with VO bending noticeably further. Right, the ownship's cross-track detour from its straight path over time, rising to 36 m under MVP and 65 m under VO before levelling off.](../../assets/img/cr-mvp-vs-vo.png)
  <figcaption>MVP against VO on one crossing conflict (no noise, both aircraft cooperating). Both clear the protected zone comfortably, to a <strong>102 m</strong> miss. The difference is in the manoeuvre: VO's shortest-way-out of the cone commits to a <strong>wider berth</strong> (a 65 m cross-track detour, against MVP's 36 m potential push). Neither is simply better; they trade off differently. The wider gulf between the two opens up with several intruders at once, where MVP sums and VO takes the union.</figcaption>
</figure>

## In the code

The resolvers live in [`opencdarr/cr/`](https://github.com/fazlurnu/OpenCDaRR/tree/main/opencdarr/cr). Each takes the ownship, the conflicting set, and the protected-zone radius, and returns a `MotionCommand` carrying the avoidance velocity:

```python
from opencdarr.cr import MVP, VO

resolver = MVP(margin=1.05)          # or VO(margin=1.05)
command = resolver.resolve(own, conflicting_intruders, rpz=50.0)
```

The figure on this page is drawn by [`scripts/handbook/separation.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/handbook/separation.py):

```
PYTHONPATH=. python scripts/handbook/separation.py
```

To add a resolver of your own behind the same interface, see [Build your own → Conflict Resolution](../../build-your-own/separation-manager/conflict-resolution.md).
