# Recovery Criteria

Resolving a conflict is only half the manoeuvre. Once the ownship has turned away, something has to decide when it may stop resolving and return to its nominal plan, otherwise it would avoid forever. **The input** to the recovery criterion is the ownship state, the perceived intruder state, and the protected-zone radius `rpz`. Then, **the output** is a single `bool`, whether this pair is clear enough to resume.

```python
recovery = FTR()                        # or PastCPA(bouncing_guard=True)
resume = recovery.should_resume(own, perceived_intr, rpz=50.0)
```

The [separation manager](index.md) asks that question each timestep, once for every pair the ownship is still resolving. The ownship reverts to nominal only once *every* active pair says yes. A directed pairwise test therefore generalises to resume when clear of all, without the criterion itself knowing about more than one intruder.

This library provides two criteria, and they differ in when they are willing to let go.

## PastCPA, wait until diverging

[`PastCPA`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/crr/pastcpa.py) resumes once the pair is already past its closest approach and no longer overlapping. The test is purely geometric. A pair is past its closest approach when it is diverging, which is when the relative position and the relative velocity point the same way, and the overlap test is the current-range one from [detection](conflict-detection.md).

$$ \texttt{should\_resume} \;=\; \big(\mathbf{r}\cdot\mathbf{v} > 0\big)\ \wedge\ \neg\,\texttt{is\_los} $$

An optional `bouncing_guard` refuses to resume while tracks are near-parallel and still close to the zone, where resuming would immediately re-detect the conflict and start an oscillation. It cannot resume until divergence has actually happened.

## FTR, resume once reverting would clear

[`FTR`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/crr/ftr.py) (Free-To-Revert) is built based on [Schaberg's thesis](https://repository.tudelft.nl/record/uuid:529b6868-f0b4-49e3-94c3-82e52ebe0c7d). It asks a forward question and reads the ownship's own desired velocity, carried on the state as `desired`, and checks whether flying it would keep the closest approach beyond the protected zone.

$$ t_\text{cpa} = -\frac{\mathbf{r}\cdot\mathbf{v}}{|\mathbf{v}|^2}, \qquad d_\text{cpa} = \begin{cases} \lVert \mathbf{r} \rVert & t_\text{cpa} \le 0 \\ \lVert \mathbf{r} + t_\text{cpa}\,\mathbf{v} \rVert & t_\text{cpa} > 0 \end{cases} $$

Here $\mathbf{v}$ is the relative velocity that *would* hold if the ownship reverted, and FTR resumes when $d_\text{cpa} > \texttt{rpz}$. The intruder's side of that relative velocity is its currently observed velocity. When intent is shared, FTR also checks the case where the intruder reverts to its nominal too. Because it does not wait for the pass, FTR lets go as soon as it is provably safe.

In [our paper](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6675278), we explain that this is similar to two-collision-cone where the resume navigation is allowed only when the relative velocity is outside two collision cones, that is built on *assuming intruder maintains its velocity* and *assuming intruder reverts to its original velocity*.

## Test cases on head-on and near-parallel

Recovery timing is the whole difference between them, and it depends on the crossing angle. Below are two no-noise cases, a 180 degree head-on that closes fast and a 5 degree near-parallel conflict that closes slowly. The near-parallel case is the regime where waiting for divergence is at its weakest.

The scenario is the same in both. Two M600 multirotors fly at 12 m/s with a 50 m protected zone, placed on a collision course at zero miss distance. Both aircraft manoeuvre, because detection, resolution and recovery run independently for each side, so each resolves against the other and both turn away. The resolver is [MVP](conflict-resolution.md) with a 1.05 margin, so they clear to about 52.5 m rather than to the edge of the zone. Each run starts with a 10 second nominal lead-in, both flying straight before the conflict comes within the look-ahead.

<figure markdown="span">
  ![A 2x2 grid, rows for the 180 degree head-on and the 5 degree near-parallel conflict. Left column, ground tracks with the ownship solid and the intruder dashed, coloured by criterion, the resolving stretch drawn opaque and the nominal stretch faded, with both starting positions marked. Right column, separation over time from t = 0 with the resolving window shaded. In the head-on the aircraft turn hard apart and the tracks fan out; in the near-parallel case they barely deviate. In both, Past-CPA holds the avoidance longer than FTR and settles to a larger miss.](../../assets/img/crr-pastcpa-vs-ftr.png)
  <figcaption>Past-CPA against FTR at two crossing angles (no noise). Left, the ground tracks, opaque where the aircraft is resolving. Right, the separation, with each criterion's resolving window shaded. Head-on, FTR reverts at 31 s to a 52 m miss while Past-CPA waits for divergence at 52 s and over-holds to 104 m. Near-parallel, the slow closing leaves a weak divergence signal, so Past-CPA holds to 188 s and 88 m where FTR reverted at 112 s to a tight 50 m. The east axis is exaggerated.</figcaption>
</figure>

That near-parallel corner is also where Past-CPA's late resume turns fragile once noise enters. A weak, noise-sensitive divergence signal is exactly the wrong thing to wait on, and across a sweep of crossing angles it is near-parallel where Past-CPA actually loses separation. FTR's forward check clears every angle at a tight, near-constant margin.

## The contract

A criterion of your own subclasses [`RecoveryCriterion`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/crr/base.py) and implements one method, `should_resume(own, intr, rpz) -> bool` — `True` when this pair is clear enough to resume. It is asked per pair, and the manager reverts only once every active pair agrees, so the criterion never needs to know about more than one intruder. It must be pure, with no state on the object between calls. The built-ins — `PastCPA`, `FTR`, and `ProbabilisticFTR` — live in [`opencdarr/crr/`](https://github.com/fazlurnu/OpenCDaRR/tree/main/opencdarr/crr) as references.

!!! code "Learn by doing"
    [L1.10 · Recovery](../../tutorials/l1-parts.md) (45 min, core) decides when to go back to the plan, and builds a small loop by hand — the bridge into [L2](../../tutorials/l2-simulation.md). A criterion of your own is [L7](../../tutorials/l7-write-your-own.md).
