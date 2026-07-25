# Navigation

Navigation is the **N** of [CNS](index.md): it answers one question — **given an aircraft's true state, what does its own sensor report?** In OpenCDaRR the sensor is GNSS (GPS/ADS-B), modelled by
[`GnssNavigation`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/navigation.py),
which measures position and velocity, each perturbed by a pluggable 2D error distribution, and returns a broadcastable `Message`. The error lives at the source and is applied once — everyone else perceives it through the broadcast that [communication](communication.md) then delivers.

## Where the noise magnitude lives

The noise magnitude is **not** a parameter of the navigation object. It is read
from the aircraft being measured, via two fields on `AircraftState`:

- `pos_ci95` — 95% radial position accuracy [m]
- `vel_ci95` — 95% radial velocity accuracy [m/s]

Accuracy is a property of *that aircraft's* sensor: it can differ between
aircraft and may evolve over a run (e.g. degrading GPS coverage), so it travels
with the clonable state rather than sitting on a shared navigation object. The
default `0.0` on both means a perfect sensor — the measurement equals the truth,
a clean regression to the no-noise case. `GnssNavigation` also **copies the same
accuracy onto the broadcast**, so a receiver gets the sender's declared accuracy
*with* the message, as ordinary state.

## Position error — from CI95 to σ

Position error is a zero-mean 2D isotropic Gaussian, each axis \(N(0, \sigma^2)\).
GNSS accuracy is quoted as a **95% radial CI** — the radius containing 95% of
fixes. The radial distance is Rayleigh, whose 95% quantile is
\(\sigma\sqrt{\chi^2_{2,0.95}}\) with \(\chi^2_{2,0.95} = 5.9915\), so

\[
\text{CI95} = \sigma\sqrt{5.9915} = 2.4477\,\sigma
\quad\Longrightarrow\quad
\sigma = \frac{\text{CI95}}{2.4477} \approx 0.4085\,\text{CI95}.
\]

The error is drawn in the local East–North frame by the pluggable distribution,
\((\text{rng}, \text{CI95}) \mapsto (e_E, e_N)\), and the measured position is the
true position offset by that error through the project's own geodesy:

\[
\beta = \operatorname{atan2}(e_E, e_N), \quad
\rho = \sqrt{e_E^2 + e_N^2}, \quad
(\varphi', \lambda') = \texttt{geo.forward}(\varphi, \lambda, \beta, \rho).
\]

## Velocity error

Velocity error is per-axis Gaussian \(N(0, \sigma_v^2)\) on the East–North
components, with the same isotropic-2D CI95→σ conversion
(\(\sigma_v = \text{vel\_ci95} / 2.4477\)). It is applied to the true velocity and
converted back to a measured track and ground speed:

\[
(v_E, v_N) = \big(v\sin\psi + \varepsilon_E,\; v\cos\psi + \varepsilon_N\big),
\quad
\psi' = \operatorname{atan2}(v_E, v_N), \quad
v' = \sqrt{v_E^2 + v_N^2}.
\]

The result is a `Message(source, state, t_meas)` — the noisy self-measurement,
timestamped for the communication layer to deliver.

!!! note "The own self-fix carries noise, but never staleness"
    An aircraft decides on its **own noisy self-fix**, not on its true state —
    both endpoints of an encounter carry navigation error. What the own fix skips
    is the [communication](communication.md) layer: an aircraft always has a
    *fresh* measurement of itself, never a dropped or stale one, whereas its view
    of **others** is whatever the broadcast last delivered. All navigation draws
    come from one dedicated RNG substream, drawn in agent order, so a run is fully
    reproducible.

## Noise distributions

A noise distribution is any callable matching the `NoiseDistribution` protocol:

```python
(rng: np.random.Generator, ci95: float) -> tuple[float, float]   # (east, north) error [m]
```

OpenCDaRR ships four, all in
[`opencdarr/cns/noise_distributions.py`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/cns/noise_distributions.py):

| Distribution | Factory | Shape |
|---|---|---|
| Isotropic Gaussian | `gaussian` | circular, thin-tailed |
| Heavy-tail mixture | `make_mixture_gaussian(tail_ratio, tail_weight)` | circular, occasional large outliers |
| Anisotropic Gaussian | `make_anisotropic_gaussian(var_ratio)` | elliptical (North axis wider) |
| Anisotropic mixture | `make_anisotropic_mixture_gaussian(...)` | elliptical **and** heavy-tailed |

The single invariant every distribution preserves: **the 95th percentile of the
2D radial error equals `ci95`**. That containment is what makes them
interchangeable — you can swap in a heavier tail or an ellipse without changing
what "50 m accuracy" means. For the Gaussian this is closed-form; for the others
the calibrating scale is solved once per `ci95` by bisection and cached in the
factory's closure, so per-sample draws stay cheap.

![Position-error distributions: scatter per distribution with the 95% containment circle, and their radial CDFs all crossing 0.95 at ci95.](../../assets/noise-distributions.png)

The scatters (top) all sit inside the same dashed `ci95` circle; the radial CDFs
(bottom) all cross 0.95 at the same radius. The tail and the ellipse reshape
*where* the error lands without changing the 95% budget — and note the anisotropy
is invisible in the radial CDF: it only reshapes the scatter.

!!! info "Anisotropy is axis-aligned, not track-aligned"
    The wider axis of the anisotropic distributions is always **North**, not the
    aircraft's heading. GPS position-error anisotropy comes from satellite
    geometry, not the vehicle's direction of travel, so the error ellipse is not
    oriented by track.

## A trajectory with the noise

Put navigation together with a moving aircraft and the noise becomes a stream of
**broadcast fixes** scattered around the true path. Below, one aircraft flies a
straight constant-speed leg (`pos_ci95 = 40 m`, a fix every 2 s); each dot is what
a receiver would actually see for that tick.

![A straight trajectory with navigation noise: broadcast fixes scattered around the true path, for the isotropic Gaussian and the heavy-tail mixture, both at pos_ci95 = 40 m.](../../assets/noisy-trajectory.png)

Both panels share the same `ci95`, so the fixes stay within a comparable band of
the true path. The difference is in the tails: the **Gaussian** jitters evenly
around the line, while the **heavy-tail mixture** hugs the path more tightly most
of the time but throws the occasional large outlier — the kind of rare, large
error that dominates safety metrics. This is the whole point of the pluggable
design: same declared accuracy, different failure behaviour.

The plot above is produced by measuring the true state at each tick:

```python
import numpy as np
from opencdarr.cns import GnssNavigation, make_mixture_gaussian
from opencdarr.state import AircraftState

nav = GnssNavigation(pos_distribution=make_mixture_gaussian(tail_ratio=3.0, tail_weight=0.1))
rng = np.random.default_rng(0)

true = AircraftState(id="OWN", lat=52.0, lon=4.0, trk=45.0, gs=10.0,
                     pos_ci95=40.0, vel_ci95=0.0)

msg = nav.measure(true, t=0.0, rng=rng)   # the broadcast fix a receiver sees
print(msg.state.lat, msg.state.lon)       # noisy position; pos_ci95 rides along
```

## Adding your own noise distribution

A distribution is just a callable, so you can add one without subclassing — write a
plain function or a calibrating factory that preserves the 95% containment
guarantee. See **[Build your own → CNS → Navigation](../../build-your-own/cns/navigation.md)**
for the two patterns and a worked `uniform_disk` example.
