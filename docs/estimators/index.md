# Estimators

One [encounter](../scenario/index.md) is one sample. The encounter lost separation or it did not, and it reached one closest approach. An **estimator** makes one number from many of these samples. The number is a probability with an interval, and the interval shows how much to trust the probability.

This library provides two estimators. They estimate the same quantity, and the same [declaration](../experiments/index.md) drives the two. Thus one argument changes the estimator.

| | Monte Carlo | Interacting particle system |
|---|---|---|
| method | runs *n* independent encounters and counts the results | keeps a fixed population on the trajectories that come closer |
| output | any quantity from one encounter | the rare probability, and the quantities that are conditional on it |
| use | P(LoS) above approximately 10⁻³ | P(LoS) far below 10⁻³ |
| cost | one run for each sample | the adjustment of the shells |

## Monte Carlo

Sample the encounters, run them, and count the results. Nothing gets a new weight and nothing is removed. Thus **each encounter is a sample of the real population**. A Monte Carlo (MC) batch therefore answers each question about one encounter, not only the question about the safety. The loss-of-separation probability, the median closest approach, the full distribution of the miss distances, and a threshold that you select later are all reads of the same batch.

The limit of the method is arithmetical. To see an event *k* times, the batch needs approximately *k/p* runs. Thus the cost increases as the event becomes more rare. A batch that observes no event gives very little data. Zero events in 500 encounters limits the rate to approximately 0.8%, and no lower. Below approximately one in a thousand, plain sampling cannot give an answer.

[Read more →](monte-carlo.md)

## Interacting particle system

The interacting particle system (IPS) reaches the rare regime, because it never measures a rare quantity. It divides the event into a ladder of **shells**. A shell is an intermediate separation through which the encounter must pass before the loss of separation. IPS estimates the conditional probability of each step, and each of these probabilities is an ordinary number. The rare probability is the product of the steps. A ladder of seventeen shells with survival fractions between 0.18 and 0.91 gives 8.2 × 10⁻⁵ without one rare observation.

The cost is that IPS is **a safety estimator and nothing else**. The algorithm removes the particles that do not reach a shell, and it clones the survivors. Thus the cloud of survivors samples the rare set, not the population. There is no correct answer for a median closest approach over all the encounters, because that quantity is a Monte Carlo question. The ladder also needs a manual selection. A shell that is too far from the last shell causes a collapse of the replication.

[Read more →](rare-event/index.md)

!!! note "Use the cheap estimator to check the clever one"
    The two estimators overlap in a band in which the two are affordable, and that overlap is the validation. At `pos_ci95` = 40 m, Monte Carlo over 4000 encounters gives P(LoS) = 0.030, and IPS over eight replications gives 0.028. The two intervals overlap. Trust a number from the rare regime only after that check passes.

## What is coming

Today the shell ladder is fixed before the run. **Adaptive multilevel splitting** (AMS) selects each shell from the current cloud instead, as a quantile of the positions that the particles reached. Thus AMS removes the manual adjustment and the risk of a collapse. It is the planned third estimator, and it runs on the machinery that is already here.

The run stays re-derivable from `config + seed + code-hash` for each of these estimators.
