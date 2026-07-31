# Estimators

One [encounter](../environments/index.md) is one sample. It either lost separation or it did not, and it reached one closest approach. An **estimator** is what turns many of those into a number you can quote — a probability, with an interval that says how much to trust it.

OpenCDaRR ships two. They estimate the same quantity and are driven by the same [declaration](../experiments/index.md), so swapping one for the other means changing one argument.

| | Monte Carlo | Interacting particle system |
|---|---|---|
| how | run *n* independent encounters, count | concentrate a fixed population on the trajectories already closing |
| gives | any per-encounter quantity | the rare probability, and anything conditional on it |
| good for | P(LoS) above roughly 10⁻³ | P(LoS) far below that |
| costs | one run per sample | tuning the shells |

## Monte Carlo

Sample encounters, run them, count what happened. Nothing is reweighted and nothing is discarded, so **every encounter is a sample of the real population** — which means a Monte Carlo (MC) batch answers any question you can ask of one encounter, not just the safety one. Loss-of-separation probability, the median closest approach, the whole distribution of miss distances, a threshold you thought of afterwards: all of them are reads of the same batch.

Its limit is arithmetic. Seeing an event *k* times takes about *k/p* runs, so the cost climbs as the event gets rarer, and a batch that observes nothing says very little: zero events in 500 encounters bounds the rate at roughly 0.8%, no tighter. Somewhere below one in a thousand, plain sampling stops being able to answer.

[Read more →](monte-carlo.md)

## Interacting particle system

The interacting particle system (IPS) buys the rare regime by never measuring anything rare. It splits the event into a ladder of **shells** — intermediate separations the encounter must pass through on its way to loss of separation — and estimates the conditional probability of each hop, which is an ordinary number. The rare probability is their product. A seventeen-shell ladder with survival fractions between 0.18 and 0.91 lands at 8.2 × 10⁻⁵ without a single rare observation.

The cost is that it is **a safety estimator and nothing else**. Particles that fail to reach a shell are dropped and survivors are cloned, so the surviving cloud samples the rare set rather than the population. Ask it for a median closest approach over all encounters and there is no honest answer — that is a Monte Carlo question. The ladder is also chosen by hand, and a shell placed too far from the last collapses the replication.

[Read more →](rare-event/index.md)

!!! note "Use the cheap estimator to check the clever one"
    The two overlap in a band where both are affordable, and that overlap is the validation: at `pos_ci95` = 40 m, Monte Carlo over 4000 encounters gives P(LoS) = 0.030 and IPS over eight replications gives 0.028, with overlapping intervals. A rare-regime number is only worth trusting once that check is green.

## What is coming

The shell ladder is fixed in advance today. **Adaptive multilevel splitting** (AMS) chooses each shell from the current cloud instead — as a quantile of where the particles have actually reached — which removes both the hand-tuning and the collapse risk. It is the planned third estimator, and it runs on the machinery already here.

Whichever estimates a given number, the run stays re-derivable from `config + seed + code-hash`.
