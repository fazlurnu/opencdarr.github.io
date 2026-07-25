# CNS

Model your own communication, navigation, and surveillance by subclassing
`NavigationModel` (`measure`), `CommunicationModel` (`step`), or `SurveillanceModel`
(`perceived`) — see `GnssNavigation`, `Comm`, and `LastKnown` for the reference
implementations.

- **[Navigation](navigation.md)** — add your own position- or velocity-error
  distribution without subclassing: a distribution is just a callable, so a plain
  function (or a calibrating factory) is enough.

!!! note "Draft"
    Communication and surveillance recipes to be written.
