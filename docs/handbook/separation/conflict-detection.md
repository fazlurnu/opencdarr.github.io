# Conflict Detection

Conflict detection is the trigger for everything the [separation manager](index.md) does. It answers one yes/no question about one directed pair. **The input** to the conflict detection is the percevied ownship state, the perceived intruder state, the protected-zone radius `rpz`, and the look-ahead time `t_lookahead`. Then, **the output** is a single `bool`, whether the two aircraft have to start a resolution manoeuvre or not.

```python
conflict = StateBased().detect(own, perceived_intr, rpz=50.0, t_lookahead=120.0)  # a prediction
breached = is_los(own, perceived_intr, rpz=50.0)                                  # a fact about now
```

When the [CNS](../cns/index.md) uncertainty is active, the intruder state going in is the perceived one, delivered by the [CNS](../cns/index.md) layer rather than by ground truth. Detection is therefore directed. The ownship and the intruder can disagree about whether they are in conflict, which is the asymmetric awareness CNS is there to model. In a no-noise run the two views coincide.

A loss of separation is a fact about now rather than a prediction, so `is_los` stays its own function, evaluated on the ground truth state. A run can then count predicted conflicts and actual losses independently.

## The default, `StateBased`

[`StateBased`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cd/statebased.py) is horizontal closest point of approach, and it has no tunable parameters. The protected zone and the look-ahead are operating conditions handed in by the manager, not knobs on the detector.

The detector works in the local East-North frame, taking the intruder's position $\mathbf{r}$ and velocity $\mathbf{v}$ relative to the ownship. The separation vector at a future time is then the straight line $\mathbf{s}(t) = \mathbf{r} + \mathbf{v}\,t$, and minimising its length gives the time of closest approach and the distance at CPA there.

$$ t_\text{cpa} = -\frac{\mathbf{r}\cdot\mathbf{v}}{|\mathbf{v}|^2}, \qquad d_\text{cpa} = \big|\,\mathbf{r} + \mathbf{v}\,t_\text{cpa}\,\big| $$

If the CPA still clears the protected zone there is no conflict. Otherwise the pair spends a window inside the zone, half a chord either side of the closest approach, and a conflict is reported when that window overlaps the look-ahead $[0, T]$.

$$ \tau = \frac{\sqrt{R^2 - d_\text{cpa}^2}}{|\mathbf{v}|}, \qquad t_\text{in} = t_\text{cpa} - \tau, \qquad t_\text{out} = t_\text{cpa} + \tau $$

$$ \text{conflict} \;=\; \big(d_\text{cpa} < R\big)\ \wedge\ \big(t_\text{in} < T\big)\ \wedge\ \big(t_\text{out} > 0\big) $$

<!-- One edge case is handled explicitly. A zero relative velocity, from parallel tracks at equal speed, is never an approach, so the pair is reported clear.

<figure markdown="span">
  ![Two panels. Left, the relative frame: the ownship fixed at the origin inside its dashed protected-zone circle, the intruder's straight relative track passing through, the closest-approach point marked at a 25 m miss, and the two points where the track crosses the circle. Right, the separation between the pair over time, a V that dips below the 50 m protected zone between the entry and exit times, with the closest approach marked at the bottom.](../../assets/img/cd-detection.png)
  <figcaption>State-based detection on one crossing pair (no noise). Left, the relative frame. The closest approach misses by <em>dcpa</em> = 25 m, inside the 50 m protected zone, so the track cuts the circle at $t_\text{in}$ and $t_\text{out}$. Right, the same encounter as separation over time. The breach window falls within the look-ahead, so the pair is flagged <strong>in conflict</strong>.</figcaption>
</figure> -->

## The contract

A detector of your own subclasses [`ConflictDetector`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cd/base.py) and implements one method, `detect(own, intr, rpz, t_lookahead) -> bool` — one verdict per directed pair, computed from the ownship's perceived picture. It must be **pure**: a function of its arguments only, with nothing stored on the object between calls, which is what lets a run reproduce exactly and a rare-event particle clone safely. How it decides — predictive, reactive, probabilistic — is entirely yours. `StateBased` and `is_los` live in [`opencdarr/cd/`](https://github.com/fazlurnu/OpenCDaRR/tree/main/opencdarr/cd) as the reference.

!!! code "Learn by doing"
    [L1.8 · Conflict detection](../../tutorials/l1-parts.md) (40 min, core) predicts a conflict by hand and then with `StateBased`. A detector of your own is [L7](../../tutorials/l7-write-your-own.md).
