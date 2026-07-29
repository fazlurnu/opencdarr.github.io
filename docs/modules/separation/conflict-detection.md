# Conflict Detection

Conflict detection is the trigger for everything the [separation manager](index.md) does. It answers one yes/no question about one **directed** pair: given the state the ownship *perceives* of an intruder, whether the two will lose their required separation within a look-ahead time. It is a pure prediction from the current states, and it returns a boolean, nothing more.

Directed matters. Detection runs on the ownship's own perceived picture of the intruder, delivered by the [CNS](../cns/index.md) layer, not on ground truth. So the ownship and the intruder can disagree about whether they are in conflict when their perceptions differ, which is exactly the asymmetric-awareness effect CNS is there to model. In a no-noise run the two directed views coincide.

The one detector that ships, [`StateBased`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cd/statebased.py), is horizontal closest-point-of-approach, and it has **no tunable parameters**. The protected-zone radius and the look-ahead are operating conditions handed in by the manager, not knobs on the detector.

## Closest point of approach

Work in the local East-North frame. With the intruder's position and velocity taken relative to the ownship (both as intruder minus own, so they share one sign convention), the separation vector at a future time $t$ is a straight line:

$$ \mathbf{s}(t) = \mathbf{r} + \mathbf{v}\,t $$

Minimising its length gives the time of closest approach and the miss distance there:

$$ t_\text{cpa} = -\frac{\mathbf{r}\cdot\mathbf{v}}{|\mathbf{v}|^2}, \qquad d_\text{cpa} = \big|\,\mathbf{r} + \mathbf{v}\,t_\text{cpa}\,\big| $$

If the closest approach still clears the protected zone ($d_\text{cpa} \ge R$) there is no conflict. Otherwise the pair spends a window inside the zone, half a chord either side of the closest approach:

$$ \tau = \frac{\sqrt{R^2 - d_\text{cpa}^2}}{|\mathbf{v}|}, \qquad t_\text{in} = t_\text{cpa} - \tau, \qquad t_\text{out} = t_\text{cpa} + \tau $$

and the pair is **in conflict** when that breach window overlaps the look-ahead $[0, T]$:

$$ \text{conflict} \;=\; \big(d_\text{cpa} < R\big)\ \wedge\ \big(t_\text{in} < T\big)\ \wedge\ \big(t_\text{out} > 0\big) $$

Two edges are handled explicitly. When the relative velocity is zero (parallel tracks at equal speed) there is no approach, so the pair is reported clear. And a **loss of separation** is a separate fact about *now*, not a prediction: $\texttt{is\_los} = (d < R)$, kept as its own function so a run can count predicted conflicts and actual losses independently (the ratio of the two is the intrusion prevention rate the environments report).

<figure markdown="span">
  ![Two panels. Left, the relative frame: the ownship fixed at the origin inside its dashed protected-zone circle, the intruder's straight relative track passing through, the closest-approach point marked at a 25 m miss, and the two points where the track crosses the circle. Right, the separation between the pair over time, a V that dips below the 50 m protected zone between the entry and exit times, with the closest approach marked at the bottom.](../../assets/img/cd-detection.png)
  <figcaption>State-based detection on one crossing pair (no noise). <strong>Left</strong>, in the relative frame the intruder travels a straight line past the ownship; the closest approach misses by <em>dcpa</em> = 25 m, inside the 50 m protected zone, so the track cuts the circle at $t_\text{in}$ and $t_\text{out}$. <strong>Right</strong>, the same encounter as separation over time: it dips under the protected zone, and because that breach window falls within the look-ahead, the pair is flagged <strong>in conflict</strong>. A miss wider than the zone, or a breach entirely beyond the look-ahead, would not be.</figcaption>
</figure>

## In the code

`StateBased` lives in [`opencdarr/cd/`](https://github.com/fazlurnu/OpenCDaRR/tree/main/opencdarr/cd), alongside `is_los`. Both take the ownship, the perceived intruder, the protected-zone radius, and (for detection) the look-ahead:

```python
from opencdarr.cd import StateBased, is_los

detector = StateBased()
conflict = detector.detect(own, perceived_intr, rpz=50.0, t_lookahead=120.0)  # a prediction
breached = is_los(own, perceived_intr, rpz=50.0)                              # a fact about now
```

The figure on this page is drawn by [`scripts/handbook/separation.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/handbook/separation.py):

```
PYTHONPATH=. python scripts/handbook/separation.py
```

To write a detector of your own (a different prediction model behind the same one-method interface), see [Build your own → Conflict Detection](../../build-your-own/separation-manager/conflict-detection.md).
