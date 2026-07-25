# OpenAP Handbook — Writing Style Guide

A distilled style reference derived from the OpenAP Handbook contrail pages
([`contrail.html`](https://openap.dev/contrail.html), chapter 7 — reference style; and
[`optimize/contrails.html`](https://openap.dev/optimize/contrails.html), chapter 12 —
narrative/tutorial style). Use this to write documentation that reads like OpenAP.

---

## 1. Voice & stance

- **Second-person plural, walking-alongside.** The reader is a collaborator, not an
  audience. Default to *"we will build…"*, *"we can see that…"*, *"let's reproduce…"*.
  Occasionally drop to second person for direct instruction (*"you can convert to
  ice"*).
- **First-person is allowed for judgment.** The author steps in with *"I"* only to
  register an opinion or a caveat — not to narrate mechanics. Example:
  > "I have more skepticism about its operational maturity, as a lot of the
  > uncertainties are yet to be addressed."

  This honesty is a signature move: state where the science or tooling is immature
  rather than overselling it.
- **Calm, plain-spoken expert.** No hype, no marketing verbs, no exclamation points in
  prose. Confidence comes from precision, not adjectives.
- **Intellectually honest about uncertainty.** Whole sections are devoted to *"the
  uncertainties that make or break the optimization."* Quantify the uncertainty, cite
  the range, and warn the reader about over-interpreting results.

## 2. Two registers — pick per page

**Register A — Reference (chapter 7 style).**
Terse, modular, exhaustive. Each concept is a short section: one or two framing
sentences, then a code block, then its printed output. Minimal narrative connective
tissue. Reads like an annotated API tour.

**Register B — Tutorial/narrative (chapter 12 style).**
Flowing prose that carries the reader through a worked problem end-to-end. Sections
narrate a decision process (*"First, we will download… Next, we will read… Before we
use the data, let's reproduce…"*). Includes motivation, trade-offs, and interpretation
of results.

Both registers share the same sentence-level voice; they differ only in how much
narration surrounds the code.

## 3. Section & document structure

- **Numbered chapters and sections** (`7`, `7.1`, `7.2.1`). Deep but shallow-titled.
- **Open with a plain-language definition.** The first paragraph defines the subject
  for a non-specialist before any math or code:
  > "Contrails (condensation trails) are line-shaped ice clouds produced by aircraft
  > engine exhaust."
- **Follow the definition with a short "why it matters" / "what this module does."**
  Often a bulleted "The module includes functions for:" list mapping concepts to
  capabilities.
- **Progressive build.** Each section assumes the previous one. Tutorials explicitly
  reference earlier chapters (*"In the previous chapter, we have built a cost grid…"*).
- **End with References.** Academic citations in author-year form, full journal
  reference, closing the page.

## 4. Sentence & paragraph patterns

- **Short declarative sentences carry the physics.** State the fact, then its
  consequence:
  > "Longwave forcing is always positive (warming) and increases with colder
  > contrails."
- **Parenthetical glosses** attach meaning to signs and units inline:
  *"(cooling effect, negative RF)"*, *"(warming)"*, *"(~FL350)"*, *"(very dry at cruise
  altitude)"*.
- **Signposting transitions** open sentences: *"First,"*, *"Next,"*, *"Before we…"*,
  *"In addition,"*, *"Again,"*, *"Note that…"*.
- **Interpret every result.** After output is shown, one sentence tells the reader what
  it means and why:
  > "This explains why nighttime contrails have a stronger warming effect — there's no
  > shortwave cooling to offset the longwave warming."
- **Quantify trade-offs concretely.** Don't say "a lot of fuel"; say *"about 1630 kg,
  which accounts for about 23% extra fuel."*

## 5. Code-example conventions

- **Every concept is demonstrated in runnable Python, immediately followed by its
  output.** Code is the primary explanatory medium; prose frames it.
- **Realistic, commented inputs.** Variables carry a unit comment and a plausible value:
  ```python
  pressure = 25000  # Pa (~FL350)
  temperature = 220  # K
  ```
- **Loop-and-print demonstrations** to show a function's behavior across a range, with
  aligned f-string formatting:
  ```python
  for t, p in zip(T, p_sat_water):
      print(f"T = {t} K: {p:.2f} Pa")
  ```
- **Import at point of first use** (`from openap import contrail`) rather than a big
  header block.
- **Convert units for the reader.** Print both K and °C, both Pa and hPa, both height
  and flight level — never make the reader do the arithmetic.
- **Build complexity in stages within a code block** using pandas method chaining and
  clearly named intermediates (`df_cost_world`, `df_cost_eu_250hpa`).

## 6. Callouts (admonitions)

Named boxes interrupt the flow for side-channel information. Keep them short and typed:

- **Note** — practical gotchas and data-wrangling caveats
  (*"longitude from ECMWF data is in the range of 0 to 360, we need to convert it…"*).
- **Important** — a warning that changes correctness
  (*"`auto_rescale_objective=True` is essential for climate-metric objectives"*),
  followed by an explanation of *why* the naive path silently fails.
- **Tip** — performance or workflow shortcuts
  (*"precompute the interpolant… subsequent calls load the cache in under a second"*).

Callout titles state the takeaway as a full imperative or claim, not a one-word label.

## 7. Terminology & formatting

- **Define the acronym on first use, then use it freely:** *"effective radiative
  forcing (ERF)"*, *"contrail temperature response (ATR20)"*, *"outgoing longwave
  radiation (OLR)"*.
- **Units are explicit and SI-first,** with domain units (FL, hPa, K/km) given
  alongside.
- **Physical constants and parameters in `code font`**; module and function names always
  in code font (`contrail.critical_temperature_water`).
- **Named references inline** as *Author et al. (year)* linking to the paper, with the
  full citation collected in the References section.
- **Tables for reference data** (constants: name / value / unit / description).

## 8. What to avoid (to stay in voice)

- No marketing adjectives ("powerful", "seamless", "cutting-edge").
- No unexplained outputs — always interpret.
- No unqualified certainty on contested science — name the uncertainty and its range.
- No hand-waved magnitudes — give the number and the percentage.
- No walls of prose without a code block, and no code block without a framing sentence.

## 9. Micro-template

> ## N.M  <Concept>
>
> <One or two sentences defining the concept and stating why it matters, with a
> parenthetical gloss on any sign or unit.>
>
> ```python
> # realistic input with unit comment
> value = ...  # unit (context)
> result = module.function(value)
> print(f"... {result:.2f} unit")
> ```
> ```
> ...printed output...
> ```
>
> <One interpretive sentence: what the output means and its practical consequence.>
>
> > **Note** — <a practical caveat, if any, stated as a full claim.>
