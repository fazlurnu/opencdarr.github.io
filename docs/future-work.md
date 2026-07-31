# Future work

This page is the backlog. Everything OpenCDaRR is missing, or could do better, is one row of the
table at the bottom of this page. The board is generated from that table when the page loads, so
the two cannot drift apart — there is only one list, written in Markdown, and it renders itself.

Nothing here is a schedule or a commitment. An item in **Idea** means someone thought it was worth
doing; it says nothing about when, or whether, it will happen.

<div class="backlog" markdown>

| Item | Area | Status | Effort | Champion | Notes |
| --- | --- | --- | --- | --- | --- |
| Rare-event estimator pages | Docs | In progress | M | @fazlurnu | Running a simulation and validation, under [Estimators](estimators/rare-event/index.md) |
| Experiment declaration layer | Experiments | In progress | L | @fazlurnu | Sweep declared, not scripted — one row per condition |
| Vertical manoeuvres in resolution | CR | Idea | L | — | Resolvers are horizontal-only today |
| Non-cooperative intruders | Environments | Idea | M | — | Traffic that neither broadcasts nor resolves |
| Spatially correlated wind field | Wind | Idea | M | — | Aircraft in one encounter currently draw their perturbation independently |
| ADS-L payload and update model | CNS | Idea | M | — | Message content and rate, rather than a generic broadcast |
| Sensitivity analysis over CNS parameters | Experiments | Idea | M | — | Which uncertainty source moves the IPR most |
| Second rare event: NMAC as well as LoS | Estimators | Idea | L | — | Splitting currently targets loss of separation only |
| Encounter viewer in the browser | Infra | Idea | M | — | Replay a logged run without opening Python |
| Fixed-wing kinematics validation | Kinematics | Planned | M | — | Compare the model against recorded flight data |
| Surveillance dropout model | CNS | Planned | M | — | Missed and stale tracks, not just noisy ones |
| Multi-aircraft environment page | Docs | Planned | S | — | Currently a placeholder |
| Reproducibility page | Docs | Planned | M | — | The cache, the provenance card, `config + seed + code` |
| Build-your-own placeholders | Docs | Planned | S | — | Autopilot, kinematics and CNS pages are still stubs |
| Installation page | Docs | Planned | S | — | Waiting on the packaging decision |
| Resolver comparison example | Experiments | Done | L | @fazlurnu | MVP against VO, swept over crossing angle and position error |
| CNS communication page | Docs | Done | M | @fazlurnu | Latency, jitter and radio failure, with figures |

</div>

## Adding an item

Anyone can add a row. The board is rebuilt on every deploy, so a merged edit shows up on the site
without anyone touching the rendering code.

1. Click the **edit** pencil at the top of this page. GitHub opens the Markdown source.
2. Add one row to the table. Keep the column order; leave a field as `—` if you do not know it.
3. Commit to a new branch and open a pull request. Say in one sentence why the item belongs here.

If the item needs a discussion before it becomes work — a design question, a choice between two
models — open an issue instead and link it from the **Notes** column once the row exists.

### The columns

<div class="col-widths" markdown>

| Column | What goes in it |
| --- | --- |
| **Item** | The work, as a short noun phrase. Not a sentence, not a question. |
| **Area** | Where it lands: `Kinematics`, `Autopilot`, `CD`, `CR`, `CRR`, `CNS`, `Wind`, `Environments`, `Estimators`, `Experiments`, `Docs`, `Infra`. A new area is fine — the board colours it automatically. |
| **Status** | `Idea`, `Planned`, `In progress` or `Done`. Any other value gets its own column at the end of the board. |
| **Effort** | `S` under a day, `M` a few days, `L` a week or more. A guess is more useful than a blank. |
| **Champion** | The GitHub handle of whoever is doing it, or `—` if nobody is. |
| **Notes** | One clause of context, or a link to the issue. Markdown links work. |

</div>

### Claiming an item

Put your handle in **Champion** and move the row to `In progress` in the same pull request. That is
the whole protocol — it is a note on a board, not a ticket system, and the point is that the state
of the project is legible from one file.
