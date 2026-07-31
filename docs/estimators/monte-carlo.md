# Monte Carlo

Sample encounters, run them, count what happened. Monte Carlo (MC) is the plain estimator, and the one to reach for unless the number you want is too rare to observe. Nothing is reweighted and nothing is thrown away, so the batch you end up with is a sample of the real encounter population — which is what lets you ask it questions you had not thought of when you started it.

```python
result = estimate_ipr(
    cfg, M600, StateBased(), MVP(1.05), PastCPA(), GnssNavigation(),
    dpsi=2.0, dcpa=0.0,
)

result.p_los          # 0.050
result.ci95           # (0.034, 0.073)   95% Wilson
result.median_min_sep # 53.3 m
```

Everything on this page comes from [`monte_carlo.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/monte_carlo.ipynb), which also writes the two figures. The run above is 500 encounters on a 2° crossing with `dcpa = 0`, a 10 m position fix, and 25 losses of separation.

The geometry slots — `dpsi`, `dcpa`, `side`, `gs_intr` — pin one parameter of the sampled encounter; left alone they are drawn from the encounter distribution.

## The unit is the encounter

One encounter is **one simulation run from one seed**: one sampled geometry, flown from spawn to termination, giving one outcome. The estimator runs `n_encounters` of them, each on its own RNG substream spawned from the run seed, so they are independent by construction and the batch is a genuine binomial sample.

That makes the denominator `n_encounters` — a number *you chose*, not one the run discovered. The distinction is not pedantry, and it was a real bug here.

!!! note "A denominator must be fixed by the experiment design, never discovered from the run"
    The estimator used to divide by "encounters where the detector fired", which sounds reasonable and is not. A conflict detector reports nothing once the predicted miss distance exceeds the protected zone, so a resolver that builds separation early does not merely avoid the conflict — it **erases it from its own denominator**. Over 300 encounters spawned at `tlos` = 180 s against a 120 s look-ahead:

    | position / velocity accuracy | resolver | conflicts counted |
    |---|---|---|
    | 0 m / 0 m/s | none | 299 |
    | 10 m / 1 m/s | none | 299 |
    | 60 m / 6 m/s | none | 299 |
    | 0 m / 0 m/s | MVP | 299 |
    | 10 m / 1 m/s | MVP | **164** |
    | 60 m / 6 m/s | MVP | **276** |

    With no resolver the count is flat at 299 whatever the noise, because it is a property of the sampled geometry. Switch the resolver on and it drops to 164 at a 10 m fix, then back up to 276 at 60 m — not even monotone, so there is no correction to apply. A resolver would be graded only on the conflicts it failed to pre-empt, and the better it worked the smaller its own denominator.

`detection_rate` is what that quantity became: a **diagnostic**, the fraction the detector flagged on the true states, and never a divisor. Below 1 it tells you encounters spawned outside the look-ahead horizon, or that resolution opened the predicted miss before the horizon caught them.

Because the scenario layer builds every sampled encounter to be a genuine conflict, the intrusion prevention rate (IPR) and the loss-of-separation probability are one quantity under two names:

$$ P(\text{LoS}) = \frac{n_\text{LoS}}{n}, \qquad \text{IPR} = 1 - P(\text{LoS}) $$

## The interval

A rate from a fixed number of trials is a binomial proportion, so it gets a **Wilson score interval** rather than the textbook $\hat p \pm z\sqrt{\hat p(1-\hat p)/n}$. The normal approximation misbehaves exactly where safety numbers live: near zero it runs below 0, and at zero observed events it collapses to $(0, 0)$ — false certainty from a batch that saw nothing.

<figure markdown="span">
  ![Two panels. Left, on log-log axes, the 95 percent Wilson interval width against the number of samples for observed rates of 0.05 and 0.20: both are straight descending lines, the 0.20 line above the 0.05 line, falling from about 0.13 and 0.25 at 50 samples to about 0.009 and 0.016 at 10000. Right, on a log x-axis, the Wilson upper bound when zero events are observed, falling steeply from 0.072 at 50 samples through 0.008 at 500 to 0.0004 at 10000, with a flat line at zero marking where the normal approximation puts it.](../assets/img/mc-interval.png)
  <figcaption><strong>Left</strong> — the interval width shrinks as $1/\sqrt{n}$, a straight line of slope $-\tfrac{1}{2}$ on log-log axes, so a tenfold tighter answer costs a hundredfold more runs. <strong>Right</strong> — with zero events observed, Wilson still returns a positive upper bound while the normal approximation returns the flat zero line. Both panels are properties of the interval itself, so the axis counts <em>samples</em>; here one sample is one encounter.</figcaption>
</figure>

| samples | width at a 5% rate | upper bound with zero events |
|---|---|---|
| 100 | 0.0902 | 0.0370 |
| 500 | 0.0387 | **0.0076** |
| 2 000 | 0.0192 | 0.0019 |
| 10 000 | 0.0085 | 0.0004 |

The right column is the one to remember. **Zero losses in 500 encounters bounds the rate at 0.0076**, which is the honest reading: *below about 0.8%*, not *zero*. Any cell of a sweep reporting `0.000` should be read that way.

## Every encounter is kept

The estimator stores the achieved minimum separation of each encounter, so the reported metrics are reductions of a record rather than the only things measured. `P(LoS)` is one point on that distribution; every other point is a read, not another simulation.

```python
seps = np.array(result.min_seps)   # one per encounter, in fan-out order

(seps < 50).mean()                 # 0.050  <- this is p_los, by definition
(seps < 25).mean()                 # 0.000
np.percentile(seps, [25, 50, 75])  # [51.8, 53.3, 55.0] m
```

<figure markdown="span">
  ![The cumulative distribution of achieved minimum separation over 500 encounters. The curve rises steeply from near zero at 48 metres to about 0.95 by 57 metres, then flattens out to 1.0 by 62 metres, with a long thin tail to 70 metres. A vertical line marks the 50 metre protected zone, and a red dot on the curve where it crosses that line is labelled P of LoS equals 0.050.](../assets/img/mc-cpa-distribution.png)
  <figcaption>Where the curve crosses the protected zone <em>is</em> P(LoS) — the red dot at 0.050. Every other height on the curve is available from the same 500 runs. Note how tight the distribution is: the middle half of these encounters falls between 51.8 m and 55.0 m, so MVP steers to within a few metres of the boundary every time and crosses it when the noise goes the wrong way.</figcaption>
</figure>

`los` and `min_sep` are not two measurements. The fleet loop accumulates both from the same per-step segment minimum, so `los` is exactly `min_sep < rpz` — which is what makes the first line above true *by definition* rather than by coincidence.

This is where MC earns its keep against a splitting estimator. A median closest approach, a quantile, the shape of the tail, a threshold nobody had thought of — all of them come from the same batch, because the batch is the population.

## Reproducibility and chunking

`config + seed + code-hash → result`, with no hidden state. Two runs of the same configuration are bit-identical.

Encounters are independent, so a batch splits across processes — but **only by slicing the one seed tree the serial run walks**:

```python
root   = root_seed_sequence(cfg.seed)
pooled = combine_ipr([
    estimate_ipr(cfg, ..., seqs=children(root, lo, hi)) for lo, hi in bounds
])
pooled == whole    # True, for 3 chunks and for 7
```

`children(root, lo, hi)` addresses a contiguous slice of the *same* fan-out, so pooling the slices reproduces the serial answer exactly — the counts and the per-encounter record, element by element, and for ragged bounds too.

Rooting each chunk at `seed + i` does not. Those trees can correlate, and their union is not the serial run's tree at all, so what comes back is a different estimate rather than the same one computed in parallel.

`combine_ipr` sums counts and recomputes the rates from the pooled totals. Averaging per-chunk ratios would weight a chunk of few encounters as heavily as one of many.

## Where it runs out

Seeing an event $k$ times takes roughly $k/p$ encounters, and pinning it to a given relative precision costs more again:

| true rate | runs for ~10 events | runs for 10% precision |
|---|---|---|
| 10⁻² | 1 000 | 38 032 |
| 10⁻³ | 10 000 | 383 776 |
| 10⁻⁴ | 100 000 | 3 841 216 |
| 10⁻⁶ | 10 000 000 | 384 159 616 |
| 10⁻⁹ | 10 000 000 000 | 384 159 999 616 |

At the $10^{-9}$ safety targets that matter this is not a question of patience.

The practical boundary is softer than the arithmetic: it is wherever the interval stops being narrow enough to answer the question. In the sweep on the [resolver comparison](../experiments/example-resolver-comparison.md) page, 500 encounters resolve a 5% rate comfortably and cannot distinguish two resolvers that both sit at zero. Past that point, [rare-event simulation](rare-event/index.md) estimates the same quantity by splitting — with the same [declaration](../experiments/index.md), changing one argument.

## In the code

[`estimate_ipr`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/estimator.py) runs the batch and returns an `IPRResult` carrying `min_seps`, `n_los` and `n_conflict`, with `p_los`, `ipr`, `ci95`, `median_min_sep` and `detection_rate` derived from them so they cannot drift out of step with the counts.

Each encounter is one [`run_fleet`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/fleet.py) — the same `advance` / `is_terminal` environment the rare-event estimator drives, which is what makes the two comparable. The seed tree is [`opencdarr/rng.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/rng.py): `root_seed_sequence`, `spawn`, `children`.
