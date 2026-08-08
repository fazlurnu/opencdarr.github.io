# Rare-event simulation: the short theory

A collision must be rare, and that fact is what makes it difficult to measure. If loss of separation occurs one time in a million encounters, plain Monte Carlo needs approximately one million runs to see one event. A batch that reads *zero* events does not tell you if the true rate is $10^{-6}$ or $10^{-9}$. At the [safety targets that are applicable](../../../index.md#the-motivation), near $10^{-9}$ for each flight hour, brute-force sampling is slow and also unreliable.

The answer in OpenCDaRR is a **rare-event estimator**. It is in the [`ips`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/ips.py) module, and it uses the fixed-effort **interacting particle system** (IPS) of Blom et al. (2007). This method is also called multi-level splitting. It does not wait for the rare event to occur. It keeps a fixed population of particles on the trajectories that already move to the event, and it reaches probabilities that plain sampling cannot.

This page gives the method. To run it, refer to [Running a simulation](running.md). For the evidence that it is correct, refer to [Validation](validation.md). For a plotted example of one run, refer to [`rare_event_ips_illustrated.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/rare_event_ips_illustrated.ipynb).

## The interacting particle system

The quantity of interest is a **reach probability**: $\gamma = P(\tau < T)$. This is the probability that the separation of an encounter reaches the rare set $D$ in the horizon $T$. The rare set is loss of separation, $\text{sep} < \texttt{rpz}$. The first time that the separation reaches the set is $\tau$.

Splitting uses one identity. Put the rare set in a ladder of smaller sets $D = D_m \subset \dots \subset D_1$, where $D_k = \{\,\text{sep} \le d_k\,\}$ for the shell distances $d_1 > \dots > d_m = \texttt{rpz}$. To reach $D$ is then a chain of steps, and each step is much more probable than the full chain. In the eight-level ladder of Blom et al. (2007, Table 10.8), the fractions for each level are between 0.005 and 0.76, and their product is near $10^{-6}$:

$$\gamma = \prod_{k=1}^{m} \gamma_k, \qquad \gamma_k = P(\tau_k < T \mid \tau_{k-1} < T).$$

The estimator calculates that product with a fixed population of $N$ particles (Blom et al. 2007, §10.2.4). For each shell $k$, it does three steps:

1. **Mutation** — move each particle forward (`env.advance`) until its running-minimum separation crosses $d_k$, or until the encounter ends first. A particle that crosses is a *survivor*, and the code holds it at the state of the crossing. A particle whose encounter ends first is *dropped*.
2. **Selection** — count the survivors. The conditional factor is $\hat p_k = S_k / N$.
3. **Splitting** — sample the $S_k$ survivors again, with replacement, back to $N$ particles. This puts the effort on the trajectories that came nearer.

$$\hat P = \prod_{k=1}^{m} \hat p_k = \prod_{k=1}^{m} \frac{S_k}{N}.$$

No step measures a rare quantity directly. Each survival fraction is a usual number, and only their product is small.

<figure markdown="span">
  ![Two panels from one IPS run. Left, a scatter plot of the running-minimum separation of each particle at the end of each shell leg, against a black staircase of the shell distances that descends. The particles that reached the shell are blue, and they are on the staircase or below it. The particles whose encounter ended first are red, and they are above it. After the first shell, all the points are near the staircase. Right, on a logarithmic axis, the survival fractions for each shell stay high and flat, and their running product decreases to the rare probability](../../../assets/img/rare-event-ips-ladder.png)
  <figcaption>One replication: 400 particles, 17 shells, <code>rpz</code> = 50 m. <strong>Left</strong> — the running-minimum separation of each particle at the end of its leg, blue if it reached the shell (the black staircase) and red if the encounter ended first. <strong>Right</strong> — the 17 survival fractions stay between 0.18 and 0.91, but their running product falls to P̂ = 8.2 × 10⁻⁵.</figcaption>
</figure>

The hats show the difference. $\gamma_k$ is the true conditional probability, and the model sets that number. $\hat p_k = S_k/N$ is the count from one run, thus it changes with the seed. If 300 particles of 1000 go through a shell, the value is $0.300$. The next seed can give $0.287$.

An average connects the two: $\mathbb{E}[\hat P] = \gamma$. This is exact, if the simulated process is strong Markov (Cérou et al. 2006, in the Feynman–Kac framework of Del Moral 2004; Blom et al. 2007, Remark 10.1). The **product** is unbiased, but the individual factors are not.

From the second shell, the cloud contains survivors that the code sampled again. Thus each $\hat p_k$ has a small error, and the factors have a correlation. Their errors cancel across the multiplication, and not in each factor. One value of $\hat P$ is one draw from a spread that is skewed to the right. For that reason a run is **replicated** on independent seed subtrees: each replication is an independent estimate of the same number, and the spread between them is what shows whether the budget was sufficient.

The population stays at $N$, and the resampling makes it equal at each shell. Thus there are **no weights for each particle**, only a product of the survival ratios. A shell with zero survivors makes the run **collapse**: `ips_once` records $\hat P = 0$ and marks the level. That result shows that the ladder is too aggressive, or that $N$ is too small. It is never a valid data point.

IPS estimates the same $P(\text{LoS})$ that Monte Carlo estimates. The initial particles come from the same distribution of the encounters. Splitting has an effect on the forward CNS noise only. There is no absorbing kill at CPA, thus a particle stays alive if its recovery manoeuvre moves it near again. This is what makes the [validation against Monte Carlo](validation.md) a direct comparison.

!!! note "Splitting reads the running minimum, not the instantaneous separation"
    The true separation decreases to the closest point of approach and then increases again.
    Thus a particle can cross a shell one time inward and one time outward. The running minimum
    only decreases. Thus each crossing occurs in one direction only, and each $\tau_k$ is a true
    first-hitting time. This is why splitting reads `FleetState.min_sep`.

## Multi-aircraft encounters

A particle is the full fleet, and not one pair. A `FleetState` holds each aircraft, the memory of
each aircraft and the clock, `env.advance` moves them together, and the resampling clones that full
state. Thus a fleet of eight aircraft is one particle in the same way that a pair is, and the three
steps of a shell do not change.

The level is the **smallest separation over the pairs**. At each step the code takes the minimum
over each pair, and `FleetState.min_sep` keeps the smallest of those values over the run. That
quantity only decreases, thus a crossing stays one-way for a fleet in the same way as for a pair.
The ladder does not record which pair is the closest, and it does not need to: two particles can
cross the same shell because of different pairs.

A [`MeasurementArea`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/fleet.py) gates
which pairs count. A pair contributes to `min_sep` only while the two aircraft are in the disc at
the two ends of the step. IPS splits on that same gated `min_sep`, thus the two estimators measure
one quantity. To gate at the end of the run only would leave the splitting on a different event
from the event that is reported.

The rare set is "one pair or more reaches `rpz`", thus what splitting estimates directly is a
**reach probability for each run**: a run with five simultaneous losses counts the same as a run
with one. That is not the number the library reports. `p_los` is
[for each aircraft](../monte-carlo.md#what-the-numerator-counts), and the step between the two is
the **tail leg**.

At the last shell a particle is frozen at its *first* loss of separation, where one pair is in
breach. The rest of the encounter is where a second loss, or a third aircraft, occurs. The tail leg
flies each survivor on to the termination and counts what happened:

$$P(\text{LoS}) = \hat P \cdot \frac{\mathbb{E}[A \mid \text{rare set}]}{N}.$$

Without that leg the only number available is two aircraft for each loss, which is exact for a pair
and too few for a fleet. Thus `IPS(..., tail=True)` is the default: it costs approximately
`n_particles` full encounter tails for each replication, and it leaves $\hat P$ unchanged.

At two aircraft the tail changes nothing, because $A$ is always 2 and the two aircraft in a loss
cancel the two aircraft in a run. Above two aircraft it is the difference between a measurement and
an assumption.

Note that the precision of `p_los` comes from the number of **distinct** survivors (`n_lineages`)
and not from `n_particles`: resampling fills the cloud with clones, and a clone gives no new
information about $A$.

## Status and limits

The last shell is $d_m = \texttt{rpz}$. Thus IPS estimates loss of separation, which is the same event that Monte Carlo estimates. The next step on the same machinery is to move $d_m$ down to a physical collision radius. That gives $P \sim 10^{-7}$ and less, which plain Monte Carlo cannot reach.

You select the ladder, and that is the primary obligation. If one shell is too far from the last shell, the survival fraction decreases to zero and the replication collapses. Thus you must tune the ladder to keep each fraction between approximately 10% and 50%. The shells also use `min_sep`, which uses the position only and does not change until the final approach. The look-ahead coordinate of Blom et al. (2007, eq. 10.7) separates the levels earlier.

The planned improvement is **adaptive multilevel splitting** (Cérou & Guyader 2007). It selects each shell as a quantile of the current cloud, and it does not fix the shell before the run. This removes the guesswork and the risk of collapse. Each run stays reproducible: `config + seed + code-hash → (P, CI)`.

!!! code "Learn by doing"
    [L6 · Rare events](../../../tutorials/l6-rare-events.md) makes you feel where counting stops, then runs IPS end to end — the ladder, the anchor test against Monte Carlo, and the parallel batch.

## References

- Blom, H. A. P., Krystul, J., Bakker, G. J., Klompstra, M. B., & Klein Obbink, B. (2007). Free flight collision risk estimation by sequential Monte Carlo simulation. In C. G. Cassandras & J. Lygeros (Eds.), *Stochastic Hybrid Systems* (pp. 249–281). CRC Press / Taylor & Francis.
- Cérou, F., Del Moral, P., Le Gland, F., & Lezaud, P. (2006). Genetic genealogical models in rare event analysis. *ALEA, Latin American Journal of Probability and Mathematical Statistics*, 1, 181–203.
- Cérou, F., & Guyader, A. (2007). Adaptive multilevel splitting for rare event analysis. *Stochastic Analysis and Applications*, 25(2), 417–443.
- Del Moral, P. (2004). *Feynman–Kac Formulae: Genealogical and Interacting Particle Systems with Applications*. Springer.
