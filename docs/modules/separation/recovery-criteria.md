# Recovery Criteria

Resolving a conflict is only half the manoeuvre. Once the ownship has turned away, something has to decide when it may stop resolving and return to its nominal plan, otherwise it would avoid forever. That decision is the recovery criterion. Each tick, for each pair it is still resolving, the [separation manager](index.md) asks the criterion a single question: whether this pair is clear enough to resume. The ownship reverts to nominal only once *every* active pair says yes, so a directed pairwise test generalises to "resume when clear of all" without the criterion itself knowing about more than one intruder.

Two criteria ship, and they differ in when they are willing to let go.

- [`PastCPA`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/crr/pastcpa.py) is **reactive**: resume once the pair is already past its closest approach and no longer overlapping.
- [`FTR`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/crr/ftr.py) (Free-To-Revert) is **proactive**: resume the moment reverting to the nominal velocity *would* keep the pair clear, without waiting for the pass.

## Past-CPA: wait until diverging

Past-CPA is purely geometric. The pair is past its closest approach when it is diverging, which is when the relative position and relative velocity point the same way, and a loss of separation is the current-range test from [detection](conflict-detection.md):

$$ \texttt{should\_resume} \;=\; \big(\mathbf{r}\cdot\mathbf{v} > 0\big)\ \wedge\ \neg\,\texttt{is\_los} $$

An optional bouncing guard refuses to resume while tracks are near-parallel and still close to the zone, where resuming would immediately re-detect the conflict and start an oscillation. The criterion is simple and robust, but it only ever looks backward: it cannot resume until divergence has actually happened.

## FTR: resume once reverting would clear

FTR asks a forward question instead. It takes the ownship's own **desired** (nominal) velocity, the one it wants to return to, and checks whether flying it would keep the closest approach beyond the protected zone:

$$ t_\text{cpa} = -\frac{\mathbf{r}\cdot\mathbf{v}}{|\mathbf{v}|^2}, \qquad d_\text{cpa} = \begin{cases} \lVert \mathbf{r} \rVert & t_\text{cpa} \le 0 \\ \lVert \mathbf{r} + t_\text{cpa}\,\mathbf{v} \rVert & t_\text{cpa} > 0 \end{cases} $$

where $\mathbf{v}$ is the relative velocity that *would* hold if the ownship reverted. It resumes when $d_\text{cpa} > \texttt{rpz}$. The intruder's side of that relative velocity is its currently observed velocity; when intent is shared, FTR additionally checks the case where the intruder reverts to its nominal too. Because it does not wait for the pass, FTR lets go as soon as it is provably safe, not a moment later. (A third criterion, `ProbabilisticFTR`, is the same forward check made under measurement uncertainty, resuming only when reverting clears the zone with a required confidence.)

## The two, head-on and near-parallel

Recovery timing is the whole difference, and it depends on the crossing angle. Below are two no-noise cases: a 180 degree head-on that closes fast, and a 5 degree near-parallel conflict that closes slowly, the regime where "wait until diverging" is at its weakest.

The scenario is the same in both, and worth stating plainly. Two aircraft (both M600 multirotors, 12 m/s, protected zone 50 m) are placed on a collision course, zero miss distance. **Both aircraft manoeuvre**: detection, resolution, and recovery run independently for each side, directed, so each resolves against the other and both turn away. The resolver is [MVP](conflict-resolution.md) with a **1.05 margin**, so they clear to 5% beyond the protected zone (about 52.5 m), not merely to its edge. Each run starts from a 10 second nominal lead-in, both flying straight before the conflict comes within the look-ahead and the avoidance begins.

<figure markdown="span">
  ![A 2x2 grid, rows for the 180 degree head-on and the 5 degree near-parallel conflict. Left column, ground tracks with the ownship solid and the intruder dashed, coloured by criterion, the resolving stretch drawn opaque and the nominal stretch faded, with both starting positions marked. Right column, separation over time from t = 0 with the resolving window shaded. In the head-on the aircraft turn hard apart and the tracks fan out; in the near-parallel case they barely deviate. In both, Past-CPA holds the avoidance longer than FTR and settles to a larger miss.](../../assets/img/crr-pastcpa-vs-ftr.png)
  <figcaption>Past-CPA against FTR at two crossing angles (no noise). <strong>Left column, the ground tracks</strong>: ownship solid, intruder dashed, coloured by criterion; the stretch drawn <strong>opaque is where each is resolving</strong>, the faded stretches are nominal flight (the 10 s lead-in and the flight after reverting). Both aircraft turn away, mirror-image. <strong>Right column, the separation</strong> from t = 0, with each criterion's resolving window shaded. <strong>Top, the 180 degree head-on</strong>: the conflict is detected 10 s in, FTR reverts early at 31 s and clears to 52 m (the margin), while Past-CPA waits until the pair is diverging at 52 s and <strong>over-holds</strong> to a 104 m miss. <strong>Bottom, the 5 degree near-parallel conflict</strong>: the aircraft barely turn (the detour is metres, so the east axis is exaggerated) and the slow closing makes the divergence signal Past-CPA waits for very weak, so it holds all the way to 188 s and an 88 m miss, where FTR has already reverted at 112 s to a tight 50 m.</figcaption>
</figure>

That near-parallel corner is also where Past-CPA's late resume turns fragile once noise enters: a weak, noise-sensitive divergence signal is exactly the wrong thing to wait on, and across a sweep of crossing angles it is near-parallel where Past-CPA actually loses separation. FTR's forward check clears every angle at a tight, near-constant margin.

## In the code

The criteria live in [`opencdarr/crr/`](https://github.com/fazlurnu/OpenCDaRR/tree/main/opencdarr/crr). Each takes the ownship, the perceived intruder, and the protected-zone radius, and returns whether it is safe to resume:

```python
from opencdarr.crr import PastCPA, FTR

recovery = FTR()                        # or PastCPA(bouncing_guard=True)
resume = recovery.should_resume(own, perceived_intr, rpz=50.0)
```

The figure on this page is drawn by [`scripts/handbook/separation.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/scripts/handbook/separation.py):

```
PYTHONPATH=. python scripts/handbook/separation.py
```

To add a recovery criterion of your own behind the same interface, see [Build your own → Recovery Criteria](../../build-your-own/separation-manager/recovery-criteria.md).
