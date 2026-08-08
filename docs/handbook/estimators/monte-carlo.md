# Monte Carlo

Sample the encounters, run them, and count the results. Monte Carlo (MC) is the plain estimator. Use it, unless the number that you want is too rare to observe. Nothing gets a new weight and nothing is removed. Thus the batch is a sample of the real population of the encounters, and you can ask it a question that you did not have at the start of the run.

```python
result = estimate_ipr(
    cfg, M600, StateBased(), MVP(1.05), PastCPA(), GnssNavigation(),
    dpsi=2.0, dcpa=0.0,
)

result.p_los          # 0.050   per aircraft
result.mean_los_pairs # 0.050   losing pairs per encounter
result.median_min_sep # 53.3 m
```

The run above is 500 encounters on a 2° crossing with `dcpa = 0` and a position fix of 10 m. It has 25 encounters with a loss of separation, thus 50 aircraft of the 1000 that flew.

There is no interval beside the estimate. Refer to [what a batch can say](#where-it-runs-out) for what to do when a batch reports zero.

The geometry slots `dpsi`, `dcpa`, `side`, and `gs_intr` set one parameter of the sampled encounter. Without a value, the estimator draws them from the distribution of the encounters.

## The unit is the encounter

One encounter is **one simulation run from one seed**. It is one sampled geometry, flown from the spawn to the termination, and it gives one outcome. The estimator runs `n_encounters` of them. Each encounter uses its own RNG substream from the seed of the run. Thus the encounters are independent by construction.

The denominator is the number of aircraft that flew, `n_encounters` times the fleet size — a number that *you selected*. It is not a number that the run found. The experiment design fixes the denominator, and the run never changes it. The aircraft inside one run are **not** independent of each other, because one conflict marks two aircraft at the same time; the *run* is the independent unit.

`detection_rate` is a **diagnostic**, the fraction that the detector flagged on the true states, and it is never a divisor. A value below 1 shows the encounters that spawned outside the look-ahead horizon. It also shows that the resolution opened the predicted miss distance before the horizon.

The scenario layer builds each sampled encounter as a true conflict. Thus the intrusion prevention rate (IPR) and the loss-of-separation probability are one quantity with two names:

$$ P(\text{LoS}) = \frac{\text{aircraft that lost separation}}{\sum_r N_r}, \qquad \text{IPR} = 1 - P(\text{LoS}) $$

### What the numerator counts

A run with two aircraft gives one answer. A run with more aircraft gives more than one, and they are different numbers. Each run reports two counts. $K$ is the number of **pairs** that lost separation. $A$ is the number of **aircraft** that lost separation. An aircraft that loses separation against two others at the same time adds 2 to $K$ and 1 to $A$.

**The library divides by the aircraft**, which is the normalisation of Blom and Bakker:

$$P(\text{LoS}) = \frac{\text{aircraft that lost separation}}{\sum_r N_r}, \qquad
\mathbb{E}[K] = \frac{\text{losing pairs}}{n}$$

`p_los` is the first of those, and `mean_los_pairs` is the second. The first is a probability and it
stops at 1. The second is a count and it does not, thus it keeps giving information in dense traffic
where a probability is at its limit.

**There is deliberately no per-run rate beside them.** "The fraction of runs with one loss or more"
counts a run with five simultaneous losses the same as a run with one, thus it increases with the
fleet size — by a factor of approximately $N/2$ for a rare event — while the airspace is not more
dangerous, and it reaches 1 in dense traffic and then says nothing more.

**At $N = 2$ the two definitions are one number.** One loss involves two aircraft, and one run has
two aircraft, thus the two factors cancel. There is one pair only, so $K$ is 0 or 1. No conversion is
necessary, and each pairwise number on this site is the same under either definition.

**At $N > 2$ they separate.** The table below compares the 500-encounter pairwise run on this page
with 100 runs at $N = 3$. In those runs, 50 have one losing pair, 30 have two losing pairs that share
an aircraft, and 20 have no loss.

| quantity | $N = 2$ (500 runs) | $N = 3$ (100 runs) |
|---|---|---|
| losing pairs, total | 25 | 110 |
| aircraft that lost separation, total | 50 | 190 |
| **`p_los`** — for each aircraft | **0.050** | **0.633** |
| `mean_los_pairs` — $\mathbb{E}[K]$ | 0.050 | 1.100 |
| *(the per-run rate that is not reported)* | *0.050* | *0.800* |

At $N = 3$ the totals are 190 aircraft against 110 pairs, thus fewer than two aircraft for each
losing pair. The reason is that some aircraft are in two losses at the same time. Note also that
$\mathbb{E}[K]$ is above 1, which a probability cannot be. The last row is the number that the
library no longer reports: it reads 0.800 for the same runs that give 0.633 for each aircraft.

!!! note "The per-aircraft denominator is what makes a number comparable with the literature"
    Blom and Bakker[^blom] report the event probability for each aircraft, not for each run. That choice is what lets them put a two-aircraft encounter and an eight-aircraft encounter on one figure. A per-run probability cannot do this, because it grows with $N$ by a factor of approximately $N/2$ for a rare event. For dense random traffic the same paper divides by the flight time as well, and it reports a rate for each aircraft for each flight hour, $\lambda = P_\text{ac} / T$. Here $T$ is the **measured** time, and their traffic organises itself for 10 minutes before the measurement starts. A [`MeasurementArea`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/fleet.py) does the same thing in space.

A `MeasurementArea` also limits the pairs that count. A pair contributes to `min_sep`, and thus to the loss counts, only while the two aircraft are in the disc at the two ends of the step. Thus a scenario can release traffic outside the area and measure only the events inside it. The rare-event estimator splits on the same `min_sep`, so the two estimators measure the same event.

[^blom]: Blom and Bakker, *Safety Evaluation of Advanced Self-Separation Under Very High En Route Traffic Demand*, Journal of Aerospace Information Systems, 2015, pp. 413–427, DOI [10.2514/1.I010243](https://doi.org/10.2514/1.I010243). The per-aircraft normalisation is on the vertical axes of Figs. 2 and 4. The rate for each flight hour is in Fig. 9.

## Reproducibility and chunking

`config + seed + code-hash → result`, with no hidden state. Two runs of the same configuration give identical bits.

The encounters are independent, so more than one process can run a batch. But the processes must **cut the one seed tree that the serial run uses**:

```python
root   = root_seed_sequence(cfg.seed)
pooled = combine_ipr([
    estimate_ipr(cfg, ..., seqs=children(root, lo, hi)) for lo, hi in bounds
])
pooled == whole    # True, for 3 chunks and for 7
```

`children(root, lo, hi)` addresses a continuous slice of the *same* fan-out. Thus a pool of the slices gives the serial answer exactly. This is true for the counts and for the record of each encounter, element by element, and also for bounds of different sizes.

A root at `seed + i` for each chunk does not give the serial answer. Those trees can correlate, and their union is not the tree of the serial run. Thus the result is a different estimate, and not the same estimate in parallel.

`combine_ipr` adds the counts and calculates the rates again from the pooled totals. A mean of the ratios of the chunks would give a chunk with few encounters the same weight as a chunk with many encounters.

## Where it runs out

To see an event $k$ times, the batch needs approximately $k/p$ encounters. A count of the events is what the estimate stands on, thus the size of the batch follows from the rate that you expect:

| true rate | runs for ~10 events | runs for ~100 events |
|---|---|---|
| 10⁻² | 1 000 | 10 000 |
| 10⁻³ | 10 000 | 100 000 |
| 10⁻⁴ | 100 000 | 1 000 000 |
| 10⁻⁶ | 10 000 000 | 100 000 000 |
| 10⁻⁹ | 10 000 000 000 | 100 000 000 000 |

At the safety targets of $10^{-9}$, this is not a question of patience.

**A batch that observes zero events did not measure zero.** It measured nothing: the rate is somewhere below the one event that it did not see, and the batch cannot say where. A batch of $n$ encounters resolves nothing below approximately $1/n$, thus 500 encounters say only "below approximately $2 \times 10^{-3}$". Read each cell of a sweep that reports `0.000` in that way, and not as a measurement.

In the sweep on the [pairwise conflict](../experiments/example-pairwise-conflict.md) page, 500 encounters resolve a rate of 5% correctly, but they cannot show a difference between two resolvers that both read zero. Below that point, [rare-event simulation](rare-event/index.md) estimates the same quantity by a split of the event. It uses the same [declaration](../experiments/index.md), and one argument changes the estimator.

## In the code

`estimate_ipr` is in [`opencdarr/estimator.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/estimator.py). To run a batch, give it the configuration, the models, and the geometry slots. It returns an `IPRResult` that holds `min_seps`, the counts `los_pairs`, `los_aircraft` and `fleet_sizes` for each encounter, and `n_conflict`. The values `p_los`, `ipr`, `mean_los_pairs`, `median_min_sep`, and `detection_rate` come from those counts. Thus they cannot become different from the counts. Each encounter is one [`run_fleet`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/fleet.py), and the seed tree is in [`opencdarr/rng.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/rng.py) as `root_seed_sequence`, `spawn`, and `children`.

**A different estimator is a different function over the same environment**, and a subclass is not necessary. `run_fleet` gives the same `advance` and `is_terminal` interface to each estimator, which is what makes the results comparable. Thus [rare-event simulation](rare-event/index.md) is a second function over that interface, and `combine_ipr` pools the results of more than one batch of the first function. To declare a sweep over either estimator, refer to [Experiments](../experiments/index.md).

!!! code "Learn by doing"
    [L1.17 · The RNG and repeatability](../../tutorials/l1-parts.md) (40 min, core) makes results repeat — the seed tree above, driven by hand. [L3 · From runs to rates](../../tutorials/l3-rates.md) turns runs into this page's numbers: the denominators, the counts, and the batch sizing.
