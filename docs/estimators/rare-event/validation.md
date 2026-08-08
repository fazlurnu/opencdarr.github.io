# Validation

An estimator for a number this small is trustworthy only if you check it where a check is still possible. This page compares IPS with plain Monte Carlo on two properties. **Accuracy** asks if the two estimators agree. **Efficiency** asks what the agreement costs. The comparison runs the two estimators across the full space of the CNS uncertainty. This page uses the [theory](index.md) and the [run recipe](running.md).

## Accuracy and efficiency

The geometry is fixed: a 90° crossing, dead-on, `rpz` 50 m, lookahead 60 s, `MVP(margin=1.05)` with `PastCPA`, and `dt` 0.2 s. Each cell runs a Monte-Carlo anchor of **2 million encounters**. It also runs IPS at **10 replications × 10 000 particles × 17 shells**. That is approximately 1.7 million particle segments, thus it is the same order as the 2 million full encounters of Monte Carlo, and not a small fraction of them. The navigation uncertainty is a GNSS error in the own fix (`pos_ci95`), and `vel_ci95` stays at 1 m/s. The communication uncertainty is a reception probability `rx` for each link.

**Accuracy.** Across the sweep, the results of IPS agree closely with the results of Monte Carlo:

<figure markdown="span">
  ![Two line plots of P(LoS) against the reception probability rx, one plot for pos_ci95 = 3 m and one plot for 10 m. Each plot has a Monte Carlo line and an IPS line. In the two plots, the two lines stay near each other. They decrease from rx 1.0 to a minimum near rx 0.5 to 0.7, and they increase a small quantity again at rx 0.3](../../assets/img/rare-event-p-vs-rx.png)
  <figcaption>P(LoS) against the reception probability, Monte Carlo and IPS.</figcaption>
</figure>

**Efficiency.** Each cell ran two times. The first time is the initial sweep. The second time is IPS alone, with the same configuration and the same seeds, as a check of the reproducibility. Each P(IPS) was identical to six decimal places, thus the second run is a literal repeat of the same computation.

The second run also used a new lockstep schedule of the tasks: 200 tasks for each level on 100 workers, in place of one process for each replication. That schedule decreased the wall-clock cost of IPS by a factor of approximately 6. Monte Carlo did not run again, thus its cost does not change. The figure below compares Monte Carlo with the second IPS run only.

<figure markdown="span">
  ![A bar chart that compares the mean wall-clock time for each cell across the sweep of twelve cells. Monte Carlo is at approximately 27 minutes, and IPS is at approximately 4.3 minutes. Each bar has a whisker that shows the range across the cells, and the individual cells are points](../../assets/img/rare-event-timing.png)
  <figcaption>Wall-clock time for each cell, mean across the twelve cells (whiskers: minimum and maximum; points: the individual cells). IPS gives the same estimate as Monte Carlo in approximately one sixth of the time.</figcaption>
</figure>

The sweep shows two results:

- **IPS agrees with Monte Carlo across the full space.** Each cell is between $10^{-4}$ and $10^{-5}$, which is the rare regime, and the two estimators agree to the same order.
- **No replication collapsed** (0 of 10 in each cell). One ladder of 17 shells was sufficient for probabilities that change by a factor of ten, and for two different mechanisms of uncertainty. The fixed ladder was tuned one time from the percentiles of the running minimum, and it stayed satisfactory across the sweep.

!!! warning "Learn the first principles"
    Read the primary sources on the theory of rare-event simulation before you use this library.
    This is necessary to know your own needs and to interpret the results correctly.

In summary: in a regime that Monte Carlo can still reach ($\sim 10^{-4}$ to $10^{-5}$), IPS gives the same results across the experiments. That is the evidence that you need before you use IPS in the more rare regimes, where Monte Carlo cannot go.
