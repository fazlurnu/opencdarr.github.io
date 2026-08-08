# Reproducibility

Each number that an experiment reports is a function of four items only: the base configuration,
the declared levels, the seed, and the source of the library. Nothing else has an effect on it.

$$\texttt{config} + \texttt{seed} + \texttt{code-hash} \rightarrow \texttt{result}$$

Two runs of the same declaration give identical bits. This page gives the three parts that keep
that promise: the seed tree, the cache, and the provenance card.

## The seed tree

A run has one integer seed. From that seed the library builds a root `SeedSequence`, and it makes
each independent substream with `spawn`. The children of a `SeedSequence` are independent by
construction. An offset of the form `seed + k` is not, because those trees can correlate.

Each `SeedSequence` has one of two roles, and never both:

- an **internal node**, which spawns child sequences — one substream for each component of a run,
  or one for each clone of an IPS particle;
- a **leaf**, which gives the `Generator` that one function draws from.

Thus each stochastic component has its own generator, and there is no global or shared RNG. This is
what makes the assignment of the streams an explicit tree that a provenance record can describe.

Two consequences for an experiment:

- **Each condition is its own seeded fan-out.** Thus two conditions are different in their declared
  levels and in nothing else.
- **`n_jobs` has no effect on the numbers.** It spreads the conditions over processes, and the
  conditions are independent by construction, thus it is a scheduling choice only. It runs on the
  core install, and the components must be picklable. A lambda that is held on a component
  instance is not picklable.

To divide one condition into chunks, refer to
[Monte Carlo](../estimators/monte-carlo.md#reproducibility-and-chunking). The chunks must cut the
same seed tree that the serial run uses, and a root at `seed + i` for each chunk does not give the
serial answer.

## The cache

`cache=True` keeps one entry for each condition. Thus a second run of a notebook plots the results
again and does not simulate them again, and an extension of a sweep runs the new cells only.

The key is the parameters of the run, the seed, and a fingerprint of the source of `opencdarr`. The
fingerprint is a hash of each `.py` file in the package. Change any of the three and the key
changes, thus a stale result is never returned. Leave the three as they are and the result is
loaded and not calculated again.

The store is a `pickle` file for each entry, in the directory `.opencdarr_cache`. **That path is
relative to the working directory**, thus a notebook and a script that run from different
directories do not share a cache. A file that is corrupt or unreadable causes a new calculation.
Thus the cache can save time only, and it can never change a result.

### What identifies a component

The cache cannot read the key from the live objects, because a detector instance or a generator has
no stable identity to hash. `identity()` gives that identity, and it is sensitive to each item that
changes the numbers:

| the value | what the identity is |
|---|---|
| an explicit `cache_id` | that string, and it always wins |
| a primitive | its value |
| a sequence, or a frozen dataclass | its structure, element by element |
| a plain function | the module, the qualified name, the source, and the values that the closure captured |
| any other instance | the source of its class, and its public attributes |

The captured values do necessary work. The noise models and the latency models in the package are
factories that return a closure, thus two calls to one factory are different in their cells only.
Without the captured values, `constant_latency(0)` and `constant_latency(5)` would share a key.

An attribute or a free variable with a name that starts with an underscore is **derived**, and its
value is not in the key. A memo dictionary that a run fills is the motivating case: it would
otherwise make the key depend on how far the run went. The *names* stay in the key, thus to gain or
lose one changes the key.

`identity()` refuses a value that it cannot identify, and it raises `CacheIdentityError`. A key that
is incorrect is worse than no cache, because it gives numbers that different code or different
parameters calculated. The remedy is to name what makes your object distinct, and you then own that
promise:

```python
class MyResolver(ConflictResolver):
    cache_id = "my-resolver/v3"
```

Your own code is covered without a `cache_id` as well: the identity of an instance contains a hash
of the source of its class. Thus a resolver whose logic changed, but whose constructor arguments did
not, gets a new key. A class that you define in a plain REPL has no source to read, thus it is
refused and not keyed on its name alone.

## The provenance card

`card_dir=` writes one Markdown card for the run. `None`, which is the default, writes nothing.

The card holds the backend, the seed, the number of conditions, the swept axes, the code
fingerprint, the declaration with the role of each parameter, the identity of each component, the
base configuration as YAML, and the results table.

The identities on the card are the same strings that the cache keys on. Thus a card and a cache
entry cannot disagree about what was run. The identity on a card is best-effort: a component that
cannot be keyed is recorded as such, and the card is still written.

## From a file, without code

`run_one_experiment` takes a YAML configuration and runs the single experiment that it describes.
It is the case of `run_experiment` with each parameter `Fixed` and one condition. It names its
components as strings and resolves them through the registry.

It is a separate entry point because a configuration file is committable and diffable, and a Python
call is not. Thus `config + seed → result` needs no code. It is a thin wrapper and not a second
implementation: the estimator, the cache and the card are the same ones. The limit is the registry:
the names that the registry knows are the components that a file can reach. For each other
component, give the instance to `run_experiment`.

## What the promise does not cover

The fingerprint covers the `.py` files of `opencdarr`. It does not cover the version of Python or
the versions of the dependencies. Thus a result that is derived again on a different machine, some
years later, needs those versions to be recorded as well. The card gives the code fingerprint, and
the environment is your part.

## In the code

The seed tree is [`opencdarr/rng.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/rng.py)
(`root_seed_sequence`, `spawn`, `child`, `children`, `generator`). The store is
[`opencdarr/cache.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cache.py)
(`code_fingerprint`, `run_key`, `load_or_run`). `identity`, `CacheIdentityError`, the card writer
and `run_one_experiment` are in
[`opencdarr/experiment.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/experiment.py).
