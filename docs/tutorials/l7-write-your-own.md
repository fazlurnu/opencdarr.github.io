# L7 · Write your own

!!! note "In preparation"
    The L7 notebooks are being written. The plan below is the commitment; the [curriculum document](https://github.com/fazlurnu/OpenCDaRR/blob/main/docs/curriculum.md) holds the live version.

Everything you have used is a plain value or an interface with one method, and this level has you implement each one. Every lesson follows the same arc: read the contract, write the smallest class that honours it, drop it into the same simulation you have run since L2, and watch the one behaviour you changed — and nothing else — change.

The planned lessons:

- **A resolver** — your own way out of a conflict.
- **A detector** — your own definition of trouble.
- **An airframe** — a `Performance` envelope that is not the built-in one.
- **A kinematics model** — a vehicle that moves by your rules.
- **A noise distribution** — an error shape the library does not ship.
- **A scenario** — an encounter generator of your own design.

Read ahead: each handbook module page states the contract its piece must honour — start from [Separation](../handbook/separation/index.md) for the resolver and detector, [Aircraft](../handbook/aircraft/index.md) for the airframe and kinematics. Until the notebooks land, the [Build your own](../build-your-own/index.md) walkthroughs cover this ground in page form — [Separation Manager](../build-your-own/separation-manager/index.md) in particular writes a detector, a resolver, and a recovery criterion, then combines them into one object.
