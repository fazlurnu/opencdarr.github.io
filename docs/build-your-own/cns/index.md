# CNS

Model your own communication, navigation, and surveillance by subclassing
`NavigationModel` (`measure`), `CommunicationModel` (`step`), or `SurveillanceModel`
(`perceived`) — see `GnssNavigation`, `Comm`, and `LastKnown` for the reference
implementations.

- **[Communication](communication.md)** — change the broadcast rate, write your own
  latency shape, add a composable link gate, or replace the channel outright.
- **[Navigation](navigation.md)** — add your own position- or velocity-error
  distribution without subclassing (a distribution is just a callable), attach a
  stateful effect that degrades a receiver over time, or replace the measurement
  model outright.

!!! note "Draft"
    Surveillance recipes to be written.
