# Navigation — adding your own noise distribution

[`GnssNavigation`](../../modules/cns/navigation.md) perturbs position and velocity
with a pluggable 2D error distribution. Because a distribution is just a callable,
adding one needs no subclassing — write a function (or a factory returning one) that
matches the protocol and preserves the containment guarantee. Two patterns:

## Closed-form: a plain function

If the 95% radius has a closed form, calibrate inline. A uniform-in-disk error is
the simplest example — for a disk of radius \(R\), the radial CDF is \((r/R)^2\), so
\(R = \text{ci95}/\sqrt{0.95}\) puts exactly 95% inside `ci95`:

```python
import math

def uniform_disk(rng, ci95):
    """Error drawn uniformly over a disk, calibrated to the 95% radial ci95."""
    R = ci95 / math.sqrt(0.95)
    r = R * math.sqrt(rng.random())      # sqrt makes it uniform by area
    theta = rng.uniform(0.0, 2.0 * math.pi)
    return r * math.cos(theta), r * math.sin(theta)
```

Then plug it straight into navigation:

```python
from opencdarr.cns import GnssNavigation

nav = GnssNavigation(pos_distribution=uniform_disk)   # vel_distribution defaults to gaussian
```

## No closed form: a calibrating factory

When there is no closed form for the 95% radius (a heavy tail, an ellipse), follow
the pattern the built-ins use: a **factory** that solves the calibrating scale once
per `ci95` by bisection and caches it in a closure, returning the per-sample
callable. See `make_mixture_gaussian` in
[`noise_distributions.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/noise_distributions.py)
for the reference implementation — the bisection drives the analytic radial CDF to
0.05 (tail probability) and the `_cache` dict keeps repeated `ci95` values cheap.

!!! warning "Keep the containment guarantee"
    Every built-in distribution puts exactly 95% of its radial mass inside `ci95`.
    Preserve that in a custom distribution — otherwise `pos_ci95` no longer means
    "95% accuracy," and comparisons against the built-ins stop being apples to
    apples. A quick check: draw many samples, take the 95th percentile of
    `hypot(east, north)`, and confirm it lands on `ci95`.

A separate `vel_distribution` argument lets you supply a different (or the same)
model for velocity error, since position and velocity come from independent GNSS
observables (pseudorange vs Doppler).
