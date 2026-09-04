# The same component, both paths — what the census rejects and the recipe path scores

**Measured 2026-09-04** on `main`, from two gates that never see each other:
`npm run census:check -- --phase full` (the older universal-contract path, blind
re-graded against the real library render) and `npm run recipe:fidelity:check`
(the recipe path, scored against the same real library render at a 5% bar).

The census carries **53 NOT-recognisable verdicts** under `--allow-red-verdicts`.
Nineteen of them name an archetype the recipe path now ships. For **ten** of
those, the recipe path scores the *same library's same component* against the
*same real render*:

| library + component | universal-contract path (census, blind re-grade) | recipe path (fidelity, vs the real render) |
| --- | --- | --- |
| altitude avatar | NOT recognisable | **0.38% PASS** |
| altitude link | NOT recognisable | 5.56% named (glyph rasterisation) |
| antd tooltip | NOT recognisable | **3.01% PASS** |
| astryx checkbox | NOT recognisable | **0.00% PASS** |
| fluent avatar | NOT recognisable | **0.00% PASS** |
| mui link | NOT recognisable | 20.22% named (the capture's face is a serif fallback) |
| mui radio | NOT recognisable | **3.75% PASS** |
| shadcn avatar | NOT recognisable | **0.29% PASS** |
| shadcn checkbox | NOT recognisable | **0.00% PASS** |
| shadcn switch | NOT recognisable | **0.00% PASS** |

Eight of the ten pass the fidelity bar; three are pixel-identical. The two that
do not are named rows whose cause is measured and is the font substrate, not
the geometry.

## What this says, and what it does not

**It says the pivot was the fix, not a relabelling.** These are not different
components judged by different people. They are the same export of the same
package, rendered by the same Chromium, compared against the same screenshot.
One path produces a canvas a blind grader calls unrecognisable; the other lands
within a few tenths of a percent. The audit's decision to drop the
universal-contract path from v1 (endorsed 2026-09-01, executed 2026-09-03) is
supported by measurement here, not by preference.

**It does not say the other 43 rejects are fine.** Thirty-four of the 53 name
components the recipe path has no archetype for at all — layout shells, cards,
accordions, chat messages, galleries. Nine more name an archetype the recipe
path ships but for a library it has not been pointed at. Those canvases are
still rejected, and the census still carries them, red, under a flag that names
them.

**It does not close the census.** The 53 verdicts remain the census's own
tally. This receipt exists so that a reader who sees "53 not recognisable" is
not left believing the current product path renders those components that way —
for ten of them, on the same evidence, it does not.

## How to re-derive this table

```
npm run census:check -- --phase full --allow-red-verdicts   # the 53 verdicts
npm run recipe:fidelity:check                                # the 53-row fidelity gate
```

Match on library + archetype. The census names components as
`<library>/<library>.<component>`; the fidelity gate names rows as
`<archetype>/<library>`, with `-proposed` where the fixture was read from the
capture rather than transcribed by hand. `checkbox-input`, `dropdown-menu`,
`inlinenotification`, `text-area` and `tag` are the same archetypes as
`checkbox`, `menu`, `alert`, `textarea` and `chip`.
