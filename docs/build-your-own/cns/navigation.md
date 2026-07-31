# Navigation — extending the fix

[`GnssNavigation`](../../modules/cns/navigation.md) perturbs position and velocity
with a pluggable 2D error distribution, and can carry effects that degrade a
receiver over time. Three things are extensible, in increasing order of effort:
the **error shape**, a **persistent effect**, and the **model** itself.

## Your own error distribution

A distribution is just a callable, so adding one needs no subclassing:

```python
(rng: np.random.Generator, ci95: float) -> tuple[float, float]   # (east, north) error [m]
```

Two rules keep it comparable with the built-ins.

1. **Preserve the containment guarantee.** The 95th percentile of the radial
   error must equal `ci95`, or `pos_ci95` stops meaning "95% accuracy" and
   comparisons against the built-ins stop being valid.
2. **Draw unconditionally.** The same number of draws at every `ci95`, including
   zero. A distribution that returns early at zero puts the first cell of a
   `pos_ci95` sweep on a different random stream from its neighbours, so the
   cells are no longer the same experiment with a different parameter.

### Closed-form: a plain function

If the 95% radius has a closed form, calibrate inline. A uniform-in-disk error is
the simplest example — for a disk of radius \(R\), the radial CDF is \((r/R)^2\), so
\(R = \text{ci95}/\sqrt{0.95}\) puts exactly 95% inside `ci95`:

```python
import math

def uniform_disk(rng, ci95):
    """Error drawn uniformly over a disk, calibrated to the 95% radial ci95."""
    radius = ci95 / math.sqrt(0.95)
    # both draws happen whatever ci95 is; at zero they simply scale to (0.0, 0.0)
    r = radius * math.sqrt(rng.random())      # sqrt makes it uniform by area
    theta = rng.uniform(0.0, 2.0 * math.pi)
    return r * math.cos(theta), r * math.sin(theta)
```

Then plug it straight into navigation:

```python
from opencdarr.cns import GnssNavigation

nav = GnssNavigation(pos_distribution=uniform_disk)   # vel_distribution defaults to gaussian
```

Check both rules before trusting it. Twenty thousand samples put the 95th
percentile at 19.99 m against a 20 m target, and the two draws leave a freshly
seeded generator in the same place whatever `ci95` was:

```python
import numpy as np

rng = np.random.default_rng(8)
pts = np.array([uniform_disk(rng, 20.0) for _ in range(20_000)])
print(np.quantile(np.hypot(pts[:, 0], pts[:, 1]), 0.95))    # 19.99

print(uniform_disk(np.random.default_rng(0), 0.0))          # zero error, but it cost two draws
```

### No closed form: a calibrating factory

When there is no closed form for the 95% radius (a heavy tail, an ellipse), follow
the pattern the built-ins use: a **factory** that solves the calibrating scale once
per `ci95` by bisection and caches it in a closure, returning the per-sample
callable. See `make_mixture_gaussian` in
[`noise_distributions.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/noise_distributions.py)
for the reference implementation — the bisection drives the analytic radial CDF to
0.05 (tail probability) and the `_cache` dict keeps repeated `ci95` values cheap.

The leading underscore on `_cache` is not cosmetic. The experiment cache
identifies a closure by its captured variables and treats underscore-prefixed
names as derived, so a memo that changes between runs does not invalidate a key.

### A bias, and what it costs

A fixed offset needs no new machinery — it is a wrapper over an existing
distribution:

```python
def with_bias(base, east, north):
    """``base``'s error, displaced by a fixed offset."""
    def biased(rng, ci95):
        e, n = base(rng, ci95)     # draw first, so the offset never moves the stream
        return e + east, n + north
    return biased
```

!!! warning "A biased error is no longer described by its declared radius"
    This breaks rule 1, which is why it is shown here rather than shipped
    alongside `gaussian`. A 12 m eastward bias on a 20 m Gaussian pushes the 95th
    percentile of the radial error to 27.5 m, so the declared `pos_ci95`
    understates the error a receiver actually faces by nearly 40%. That may be
    exactly the effect you want — just do not compare the result against a
    built-in and call it the same accuracy.

## Your own navigation effect

A distribution is memoryless: every fix is an independent draw. When degradation
has to **persist** — a receiver that loses satellites and stays degraded, an
urban canyon, a slow drift — the model needs state between ticks, and that is a
`NavEffect`.

It has three methods:

- `initial()` — the state before anything happens. Per-aircraft state keys by id,
  so an absent key means "nothing has happened to that aircraft yet" and no
  roster is needed up front.
- `evolve(own, aircraft, elapsed, rng)` — advance over `elapsed` seconds, called
  once per tick over the whole fleet before any aircraft measures. It receives
  whole `AircraftState` values, not just ids, so an effect can depend on *where*
  an aircraft is.
- `quality(own, aircraft_id)` — the degradation right now, as a `NavQuality`. It
  must not draw.

The state is threaded rather than held on the effect: the effect is shared
immutable configuration, one instance serving every particle of a rare-event run,
while the state clones with the particle. Make it a frozen dataclass so the
experiment cache can identify it structurally.

An urban-canyon corridor shows why `evolve` takes states rather than ids:

```python
from dataclasses import dataclass
from opencdarr.cns import NavEffect, NavQuality


@dataclass(frozen=True)
class CanyonRoster:
    """Which aircraft were inside the canyon at the last tick."""

    inside: frozenset = frozenset()


@dataclass(frozen=True)
class Canyon(NavEffect):
    lon_min: float = 4.005
    factor: float = 6.0

    def initial(self):
        return CanyonRoster()

    def evolve(self, own, aircraft, elapsed, rng):
        # draws nothing, so it cannot shift the measurement stream underneath it
        return CanyonRoster(frozenset(ac.id for ac in aircraft if ac.lon >= self.lon_min))

    def quality(self, own, aircraft_id):
        if aircraft_id in own.inside:
            return NavQuality(pos_scale=self.factor, pos_declared=self.factor)
        return NavQuality()


nav = GnssNavigation(effects=(Canyon(),))
```

`NavQuality` carries four multipliers: `pos_scale` and `vel_scale` size the error
actually drawn, `pos_declared` and `vel_declared` size what the broadcast claims.
Setting them equal is honest degradation; leaving `*_declared` at `1.0` while
raising `*_scale` is a receiver that has gone bad without knowing it. All four
default to `1.0`, so an effect that has nothing to say about a quantity says
nothing, and several effects compose by multiplying.

!!! note "An effect that draws must draw a constant number of times"
    Two effects with different parameters must consume the same randomness, or a
    parameter sweep shifts the measurement draws underneath it and the cells stop
    being comparable. `GnssOutage` makes exactly one draw per aircraft per tick
    whatever its health and whatever its rates, including zero — see
    [`hazard.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/hazard.py)
    for the shared `toggle` helper that enforces it. An effect that draws nothing,
    like `Canyon` above, is trivially safe.

!!! info "An effect modulates quality; it never suppresses a broadcast"
    There is no veto in the contract. A degraded receiver reports a worse
    position, not no position, and an aircraft that stops transmitting entirely
    is a channel failure — `RadioHealth`, on the
    [communication](communication.md) side. Keeping one spelling per physical
    event is why `NavEffect` has no `admits` where a link gate does.

## Your own navigation model

When the effect contract cannot express what you need — a model with its own
filter state, a completely different sensor — subclass `NavigationModel` and
return your own `NavState` subclass from `initial_state()`. `measure` then
receives your state type on **every** tick including the first, so you never have
to detect and upgrade a bare state by hand.

```python
from dataclasses import dataclass
from opencdarr.cns import NavState
from opencdarr.cns.base import NavigationModel


@dataclass(frozen=True)
class MyNavState(NavState):
    ticks: int = 0


class MyNav(NavigationModel):
    def initial_state(self):
        return MyNavState()

    def evolve(self, state, aircraft, t, rng):
        assert isinstance(state, MyNavState)      # never a bare NavState
        return MyNavState(effects=state.effects, t_prev=t, ticks=state.ticks + 1)

    def measure(self, state, true, t, rng):
        ...
```

Assert your own type rather than falling back to an `isinstance` check that
upgrades a bare state. A model written that way fails loudly if the seam
regresses, instead of quietly working around it.

!!! note "Run it yourself"
    The [navigation notebook](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/navigation.ipynb)
    executes every example on this page, including the containment and draw-count
    checks.
