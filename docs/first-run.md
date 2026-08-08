# A first run

Let's put two aircraft, one multirotor flying north and one fixed-wing crossing the trajectory while flying east. They are on a collision course. Then, we turn a resolver on, layer on sensing and communication uncertainty, and finish by repeating the encounter hundreds of times to measure the safety of the separation algorithm under uncertainty.

## Two aircraft from the built-in models

Each aircraft is an [`Agent`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/fleet.py) consisting of an initial state, an airframe (a [`Kinematics`](modules/kinematics/index.md) + a [`Performance`](build-your-own/performance.md) envelope), and an [`Autopilot`](modules/autopilot.md) for the mission. We first create a multirotor cruising north, flown by the built-in `M600` envelope and `Multirotor` model and its mission is to keep its track and speed when not avoiding.

```python
from opencdarr.kinematics import FixedWing, Multirotor
from opencdarr.fleet import Agent, run_fleet
from opencdarr.performance import M600, SMALL_FIXEDWING
from opencdarr.autopilot import CruiseAutopilot
from opencdarr.scenario import create_conflict
from opencdarr.state import AircraftState

# ownship: a multirotor cruising north on the built-in M600 envelope
copter = AircraftState(id="COPTER", lat=52.0, lon=4.0, trk=0.0, gs=18.0, yaw=0.0)
agent_copter = Agent(copter, M600, Multirotor(), CruiseAutopilot(copter.trk, copter.gs))
```

Then, we create another aircraft that is a fixed-wing. We use the built-in `SMALL_FIXEDWING` envelope and `FixedWing` model, and again a [`CruiseAutopilot`](modules/autopilot.md) holds its track and speed whenever it is not avoiding. Rather than hand-place the intruder, [`create_conflict`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/scenario.py) function returns an `AircraftState` spawned directly in conflict with a reference `AircraftState`. Here, the two aircraft are at a 90° crossing angle (`dpsi`), 0 m projected distance at closest point of approach (`dcpa`), and 30 s into the loss of separation (`tlos`). We also set the radius of protected zone (`rpz`) as 50 m and we spawn the intruder with 15 m/s ground speed (`gs_intr`). Finally, we gather the two agents into one list called `agents` and pass it to the simulation later.

```python
plane = create_conflict(copter, intr_id="PLANE", dpsi=90.0, dcpa=0.0,
                        tlos=30.0, rpz=50.0, gs_intr=15.0, side=1)
agent_plane = Agent(plane, SMALL_FIXEDWING, FixedWing(), CruiseAutopilot(plane.trk, plane.gs))

agents = [agent_copter, agent_plane]   # the framework is agent-based: collect them into a fleet
```

## The first run — no resolution

[`run_fleet`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/fleet.py) advances the whole fleet to termination. We set several parameters here. First is the `rpz` as mentioned before, the previous one is used to spawn the drone while this one is actually used to measure the safety. Then, since typically a conflict detection needs a time threshold, we set the threshold of the lookahead time (`t_lookahead`) to 20 s. Then, the simulation advances by 0.1 s timestep (`dt`). We deliberately set no conflict resolution algorithm (`resolver`) and recovery criteria (`recovery`) to see whether the two aircraft are actually spawned in conflict. Finally, we terminate the simulation when the conflict resolution has been passed (`done_timeout`) for 10 s and we `record` the trajectory for plotting.

```python
from opencdarr.cd import StateBased
from opencdarr.viz import plot_pairwise

run = run_fleet(
    agents, rpz=50.0, t_lookahead=20.0, dt=0.1,
    detector=StateBased(), resolver=None, recovery=None,
    done_timeout=10.0, record=True,
)
print(run.min_sep, run.los)   # 0.8 m  True  — they collide
fig = plot_pairwise(run, rpz=50.0, title="Pairwise crossing (perfect information), no reso")
```

<figure markdown="span">
  ![Ground tracks of a multirotor flying north and a fixed-wing crossing eastward, meeting at the crossing; the separation on the right falls straight through the 50 m protected zone to near zero](assets/img/fr-noreso.png)
  <figcaption>No conflict resolution algorithm: the legs cross and separation collapses to 0.8 m, deep inside the 50 m protected zone.</figcaption>
</figure>

## Adding a resolver

The separation stack has three pieces. First, [detector](modules/separation/conflict-detection.md), returning a `bool` of whether a separation manoeuvre should start or not. Then, a [resolver](modules/separation/conflict-resolution.md) to tell the aircraft where to go using the `MotionCommand`. Finally, a [recovery criterion](modules/separation/recovery-criteria.md) to tell when the separation manoeuvre can be disengaged. In this example, we use a built-in `MVP` resolver and a `PastCPA` recovery. A `VO` resolver drops into the same slot in case you want to have a quick try.

```python
from opencdarr.cr import MVP, VO
from opencdarr.crr import PastCPA

run = run_fleet(
    agents, rpz=50.0, t_lookahead=20.0, dt=0.1,
    detector=StateBased(), resolver=MVP(), recovery=PastCPA(bouncing_guard=True),
    done_timeout=10.0, record=True,
)
print(run.min_sep, run.los)   # 89.3 m  False  — clear
```

<figure markdown="span">
  ![The same crossing with MVP resolution: the copter's track bends east near the conflict and the separation on the right arrests well above the protected zone](assets/img/fr-mvp.png)
  <figcaption>With MVP and PastCPA, the two aircraft are safely separated.</figcaption>
</figure>

## Sensing uncertainty

So far every aircraft has acted on the truth. To make it realistic we turn on GNSS noise, so each aircraft measures its own position and velocity with an error before acting and broadcasting. The position and velocity noise are assigned to each agent and are stated in terms of 95% confidence interval, called `pos_ci95` and `vel_ci95` respectively. Then we add [`navigation`](modules/cns/navigation.md) as an input argument to `run_fleet` as well as a seeded random stream `rng`.

```python
from dataclasses import replace
from opencdarr.cns.navigation import GnssNavigation
from opencdarr import rng

noisy_agents = [replace(a, state=replace(a.state, pos_ci95=15.0, vel_ci95=1.5)) for a in agents]

noisy_run = run_fleet(
    noisy_agents, rpz=50.0, t_lookahead=20.0, dt=0.5,
    detector=StateBased(), resolver=MVP(), recovery=PastCPA(bouncing_guard=True),
    navigation=GnssNavigation(), rng=rng.generator(rng.root_seed_sequence(42)),
    stop_within=100.0, done_timeout=10.0, record=True,
)
print(noisy_run.min_sep, noisy_run.los)   # 72.3 m  False
```

<figure markdown="span">
  ![The crossing with GNSS self-noise: the tracks are slightly ragged but still separate cleanly, and the separation stays above the protected zone](assets/img/fr-gnss.png)
  <figcaption>With a 15 m / 1.5 m·s⁻¹ GNSS error each aircraft acts on a noisy self and traffic measurement. The path differs from the no-noise, here it clears at 72.3 m.</figcaption>
</figure>

## Communication uncertainty

Communication uncertainty layers on the same way. A directed [`Comm`](modules/cns/communication.md) model gives each transmission direction its own reception probability. In our case, `COPTER→PLANE` is more reliable than the reverse, and we add a lognormal latency. The navigation and communication use two separate `rng`/`comm_rng`. Additionally, we enlarge the `margin` for `MVP` to 1.1 because we want to be more conservative.

```python
from opencdarr.cns import Comm, lognormal_latency

nav_seq, comm_seq = rng.spawn(rng.root_seed_sequence(42), 2)   # independent nav / comm streams

comm = Comm(
    reception_prob={("COPTER", "PLANE"): 0.9, ("PLANE", "COPTER"): 0.6},   # directed, asymmetric
    latency=lognormal_latency(median=0.5, sigma=0.4),                      # seconds
)

# the same run, now also given a slightly wider resolver buffer and the comm model
noisy_run = run_fleet(
    noisy_agents, rpz=50.0, t_lookahead=20.0, dt=0.5,
    detector=StateBased(), resolver=MVP(margin=1.1), recovery=PastCPA(bouncing_guard=True),
    navigation=GnssNavigation(), rng=rng.generator(nav_seq),
    communication=comm,          comm_rng=rng.generator(comm_seq),
    stop_within=100.0, done_timeout=60.0, record=True,
)
print(noisy_run.min_sep, noisy_run.los)   # 109.6 m  False
```

<figure markdown="span">
  ![The crossing with GNSS noise and lossy, delayed communication: the tracks are noisier but clear each other by a wide margin](assets/img/fr-comm.png)
  <figcaption>Missed and delayed broadcasts change which perceived states each aircraft acts on. With the slightly wider `MVP(margin=1.1)` buffer this seed clears at 109.6 m.</figcaption>
</figure>

## Running a Monte Carlo simulation

That noisy run cleared, but a different seed draws different errors, so it is one sample of a random outcome. The safety metric is the aggregate over many independent repeats. We use one substream per run, all spawned from a single root seed, so the whole batch is fixed by that seed alone and each run draws independent navigation *and* communication noise. Here, we remove the `margin` from the `MVP`, and we add a new argument `stop_within` 100 m, working with an `OR` operator with the `done_timeout`.

```python
n_runs = 200
outcomes = [
    run_fleet(
        noisy_agents, rpz=50.0, t_lookahead=20.0, dt=0.2,
        detector=StateBased(), resolver=MVP(), recovery=PastCPA(bouncing_guard=True),
        navigation=GnssNavigation(), rng=rng.generator(nav_seq),
        communication=comm,          comm_rng=rng.generator(comm_seq),
        stop_within=100.0, done_timeout=60.0, record=True,
    )
    for nav_seq, comm_seq in (rng.spawn(sub, 2) for sub in rng.spawn(rng.root_seed_sequence(42), n_runs))
]

lost = sum(o.los for o in outcomes)
min_seps = [o.min_sep for o in outcomes]
print(f"{lost}/{n_runs} lost separation; dCPA min {min(min_seps):.1f} m, "
      f"median {sorted(min_seps)[n_runs // 2]:.1f} m")   # 2/200 lost; min 48.1 m, median 96.3 m
```

From the simulation, we can use [`plot_pairwise_montecarlo`](https://github.com/fazlurnu/OpenCDaRR/blob/main/opencdarr/viz.py) to overlay every run's ground tracks. Then, we can also plot a histogram of the closest approaches to show the CPA distance distribution.

<figure markdown="span">
  ![Two hundred faintly overlaid ground tracks for the cruise sweep; the copter fans north and the fixed-wing fans east, forming a dense core with sparse tails](assets/img/fr-mc-cruise.png)
  <figcaption>200 noisy repeats of the crossing. The dense core is where the fleet usually goes; the faint threads are the noise tails.</figcaption>
</figure>

<figure markdown="span" style="max-width: 32rem; margin-inline: auto;">
  ![Histogram of the closest approach over 200 cruise runs; most of the distribution sits to the right of the 50 m protected-zone line, with a small mass touching it](assets/img/fr-hist-cruise.png)
  <figcaption>The distance at closest point of approach (dCPA) over the 200 runs. Two fall just inside the protected zone (min 48.1 m, a ~1% rate), the rest are safe.</figcaption>
</figure>

## Waypoint mission

Let's give the `copter` a bounded mission, for instance a waypoint 75 s of cruise ahead. Whenever the `copter` is not doing a separation manoeuvre, it will go to this waypoint and the simulation ends when the `agent` flies within the `stop_within` radius. Note that only the ownship's autopilot changes.

```python
from opencdarr.autopilot import WaypointAutopilot
from opencdarr.mission import Mission
from opencdarr import geo

wp_copter = geo.forward(copter.lat, copter.lon, copter.trk, copter.gs * 75.0)
agent_copter = Agent(copter, M600, Multirotor(), WaypointAutopilot(Mission(goto=wp_copter)))

agents = [agent_copter, agent_plane]
noisy_agents = [replace(a, state=replace(a.state, pos_ci95=15.0, vel_ci95=1.5)) for a in agents]
# ... the same 200-run sweep (stop_within=50)  ->  2/200 lost; dCPA min 48.1 m, median 96.3 m
```

<figure markdown="span">
  ![The waypoint sweep overlay; the copter's tracks converge toward its goal north of the crossing while the fixed-wing fans east](assets/img/fr-mc-waypoint.png)
  <figcaption>With a waypoint the copter's tracks pinch toward its goal, but the safety picture is unchanged.</figcaption>
</figure>

<figure markdown="span" style="max-width: 32rem; margin-inline: auto;">
  ![Histogram of the closest approach over 200 waypoint runs, again almost entirely to the right of the protected-zone line](assets/img/fr-hist-waypoint.png)
  <figcaption>The dCPA distribution for the waypoint sweep. The same ~1% low tail as the cruise, median 96.3 m.</figcaption>
</figure>

## Wind

Finally, a constant wind. One line builds the field, one argument passes it in.

```python
from opencdarr.wind import WindField

wind = WindField.from_met(coming_from_deg=30.0, speed=10.0)   # constant 10 m/s from the NNE
# ... the same sweep, now with  wind=wind  in run_fleet and n_runs=100
#     ->  5/100 lost; dCPA min 45.7 m, median 73.7 m
```

Both airframes here are built-in and wind-aware defined in their `kinematics`, so both are affected by the wind. The multirotor and the fixed-wing each fly a slightly displaced path, and the margin that resolution had bought erodes. The median closest approach falls from the mid-nineties to the low seventies, and the LoS rate rises to about 5%.

<figure markdown="span">
  ![The wind sweep overlay with a faint downwind arrow field; the copter's tracks are pushed and spread, and several reach lower closest approaches](assets/img/fr-mc-wind.png)
  <figcaption>The same sweep in a 10 m/s wind from the north-northeast (faint arrows point downwind). Both aircraft crab, the margins tighten, and five of the 100 runs enter the protected zone.</figcaption>
</figure>

<figure markdown="span" style="max-width: 32rem; margin-inline: auto;">
  ![Histogram of the closest approach over 100 wind runs; the distribution shifts left and a small tail crosses the 50 m protected-zone line](assets/img/fr-hist-wind.png)
  <figcaption>With wind the whole distribution shifts left, the low tail reaches 45.7 m, and a small mass falls left of the protected zone, ~5% probability of loss of separation.</figcaption>
</figure>

A hundred to two hundred runs are enough to *see* a rate of a few percent, but far too few to resolve the much smaller probabilities a real safety target asks for. Estimating those needs [rare-event simulation](estimators/rare-event/index.md), which reaches the same tail with far fewer runs.

Every piece assembled above, the airframes, the resolver, the CNS layers, the mission, and the wind, is a value or a single-method object passed to `run_fleet`. [Build your own](build-your-own/index.md) shows how to replace any of them with code of your own. [Modules](modules/index.md) documents the built-ins.

!!! code "Run it yourself"
    Every step on this page is the notebook [`examples/handbook/a_first_run.ipynb`](https://github.com/fazlurnu/OpenCDaRR/blob/main/examples/handbook/a_first_run.ipynb), top to bottom — the build, each run, and all three Monte-Carlo sweeps.
