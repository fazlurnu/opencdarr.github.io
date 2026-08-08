# Conflict Resolution

Once a pair is [detected](conflict-detection.md) in conflict, the resolver computes the avoidance manoeuvre. **The input** to the conflict resolution is the ownship state, the set of intruders it is currently in conflict with, and the protected-zone radius `rpz`. Then, **the output** is a `MotionCommand` carrying the ground velocity that clears them.

```python
from opencdarr.cr import MVP, VO

resolver = MVP(margin=1.05)          # or VO(margin=1.05)
command = resolver.resolve(own, conflicting_intruders, rpz=50.0)
```

That output velocity is vehicle-neutral, so each airframe flies it its own way. A multirotor takes it directly, and a fixed-wing is [turned onto it](../kinematics/fixedwing.md#flying-a-velocity-command) under its bank limit.

This library provides two resolvers, and they embody two different ideas of what clearing an intruder means. Both can take a `margin` ($\ge 1$) that enlarges the protected zone they clear to, so the manoeuvre finishes with a buffer beyond the protected zone.

## MVP, a potential push

[`MVP`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cr/mvp.py) (Modified Voltage Potential) treats each intruder as a repulsion, and it resolves by maximising the distance at the closest point of approach. It takes the vector distance at closest point of approach $\mathbf{d}_\text{CPA}$, and the resolution vector $\mathbf{dV}$ points along it. Its magnitude opens the projected distance $\lVert\mathbf{d}_\text{CPA}\rVert$ out to the protected zone radius $R_\text{PZ}$ before the time to intrusion entry $t_\text{in}$, and it is added to the ownship velocity $\mathbf{V}_o$.

$$ \mathbf{dV} = \frac{\dfrac{R_\text{PZ}}{\varepsilon} - \lVert\mathbf{d}_\text{CPA}\rVert}{t_\text{CPA}\,\lVert\mathbf{d}_\text{CPA}\rVert}\;\mathbf{d}_\text{CPA}, \qquad \mathbf{V}_\text{res} = \mathbf{V}_o + \mathbf{dV} $$

Here $\varepsilon$ is a geometric buffer parameter that keeps the resolution vector from grazing the protected zone, written with the relative position $\mathbf{x}_\text{rel}$.

$$ \varepsilon = \cos\!\left(\arcsin \frac{R_\text{PZ}}{\lVert\mathbf{x}_\text{rel}\rVert} - \arcsin\frac{\lVert\mathbf{d}_\text{CPA}\rVert}{\lVert\mathbf{x}_\text{rel}\rVert}\right) $$

That buffer applies when both the ownship and the projected closest point lie outside the protected zone. Otherwise a direct linear scaling $R_\text{PZ} - \lVert\mathbf{d}_\text{CPA}\rVert$ is applied. The $R_\text{PZ}$ in both is the protected zone after `margin`.

The push grows as the closest approach nears, through the $1/t_\text{CPA}$ term, which is what makes it a potential field. Against several intruders at once MVP **sums** the pairwise resolution vectors, because a potential field superposes. When $\lVert\mathbf{d}_\text{CPA}\rVert$ falls near zero its direction is noise-dominated, so it is floored and a perpendicular to $\mathbf{x}_\text{rel}$ picks a side.

## VO

[`VO`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cr/vo.py) (Velocity Obstacle) treats each intruder as a forbidden set of velocities and takes the shortest way out of it. What ships here is **our interpretation** of that idea, so the choices below are ours and yours to replace.

For each intruder the resolver builds the set of ownship velocities that lead to a future incursion. That set is a **cone** in velocity space, with its apex at the intruder's velocity, its axis along the bearing to it, and half-angle $\arcsin(R / d)$ at current range $d$. Any velocity inside the cone is unsafe for that pair. It resolves to the velocity outside the cone nearest the current one, the minimal change that just escapes.

Against several intruders the forbidden region is the **union** of the cones, and `VO` takes the nearest velocity outside *all* of them. This is deliberately not a sum. Adding pairwise escapes can land back inside a cone, because a union of cones is not something you can superpose. It finds the union's boundary analytically, from each cone edge plus the intersections of edges from different cones, and keeps the nearest exterior point. That sum-versus-union split is the sharpest practical difference between the two resolvers. It shows up in [multi-intruder encounters](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/multi_intruder_demo.py), where MVP's summed push can under-clear a symmetric double conflict while VO still leaves the union.

## The two on one conflict

For a single pair the two often resolve in a similar direction, but not identically. Below, a head-on-course crossing (worst-case zero-miss geometry, no noise) resolved cooperatively, both aircraft manoeuvring and the recovery criteria used here is the `PastCPA`. The `PastCPA` is deliberately used here as a fair comparison although it is not the basic construction of how `VO` decides to resume a mission.

<figure markdown="span">
  ![Two panels. Left, the ground tracks of a 90-degree crossing resolved by MVP and by VO: both ownship tracks bend west around the crossing and both clear to about 102 m, with VO bending noticeably further. Right, the ownship's cross-track detour from its straight path over time, rising to 36 m under MVP and 65 m under VO before levelling off.](../../assets/img/cr-mvp-vs-vo.png)
  <figcaption>MVP against VO on one crossing conflict (no noise, both aircraft cooperating). Both clear to a <strong>102 m</strong> miss, so the difference is in the manoeuvre. VO's shortest way out of the cone commits to a wider berth, a 65 m cross-track detour against MVP's 36 m. Neither is simply better. The gap widens with several intruders, where MVP sums and VO takes the union.</figcaption>
</figure>

Both resolvers live in [`opencdarr/cr/`](https://github.com/fazlurnu/OpenCDaRR/tree/main/opencdarr/cr). To add a resolver of your own behind the same interface, see [Build your own → Conflict Resolution](../../build-your-own/separation-manager/conflict-resolution.md).

!!! code "Run it yourself"
    The figure on this page is generated by [`examples/handbook/separation.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/separation.ipynb), which also draws the detection and recovery figures.
