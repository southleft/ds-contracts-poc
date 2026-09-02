# F1 · shadcn Checkbox — the first BARE control, proposed and scored

The shadcn checkbox fixture (`recipe/fixtures/generated/checkbox.shadcn.ts`)
was **proposed** by `npm run recipe:point` from
`extract/computed/out/shadcn/checkbox/captured-truth.json`: 28 leaves read
from the ledger, 6 reviewed (all naming one gap, below), 21 archetype
spellings, 0 invented. Minted as the fifth source of checkbox v7
(page `217:82808`) and scored against the real package's Chromium render
(`orig-shots/`, control-only crop).

Three things the recipe path had never done before, all measured here:

- **A control with no label.** shadcn mounts a bare `<button role=checkbox>`.
  The drafter reports the missing label as evidence (not a refusal), the
  recipe compiles the label-less cell (`content.label: null` — one child per
  variant), and every label leaf is a bare-cell spelling
  (`BARE_CHECKBOX_SPELLINGS`, values from `recipes/checkbox.ts`).
- **oklch colours.** Tailwind v4 declares colours in `oklch()` and Chromium
  reports them verbatim. `ledger.ts hex8` converts by CSS Color 4 and the
  conversion is pinned to the render's own pixels: `oklch(0.205 0 0)` →
  `#171717` (23,23,23 sampled), `oklch(0.922 0 0)` → `#e5e5e5` (229 sampled).
  An out-of-sRGB colour refuses by name rather than carrying its clipped cousin.
- **A named gap.** shadcn's indeterminate state renders the *check glyph*
  (svg 14px, `M 20 6 L 9 17 L 4 12`, stroke `oklch(0.145 0 0)` 2px) on a
  transparent box. checkbox@1 has a dash cell, not a glyph-as-indeterminate
  cell, so the dash is a zero-size reviewed receipt and the two indeterminate
  cells mint as an empty box.

## Scores (bar 5% AA-masked)

| state | AA masked | exact unmasked | ink canvas / real | verdict |
|---|---|---|---|---|
| unchecked.enabled | **0.00%** | 20.6% | 22.1 / 29.4 | pass (the real crop is 16×17: `shadow-xs` adds a row the recipe does not carry) |
| unchecked.disabled | **0.00%** | — | 23.0 / 20.3 | pass |
| checked.disabled | 3.13% | 25.4% | 97.3 / 96.1 | pass |
| checked.enabled | **5.15%** | 31.3% | 91.5 / 94.9 | **FAIL by 0.15** — the uncarried `shadow-xs` (`0 1px 2px rgb(0 0 0 / .05)`) and the 1.17px glyph stroke's rasterisation |
| indeterminate.enabled | 2.94% | 30.1% | 22.1 / **39.0** | **NOT A PASS** — the glyph is absent (named gap). The number is the instrument: the AA mask excuses a 1.17px stroke entirely. Read the ink columns. |
| indeterminate.disabled | 3.13% | 24.6% | 23.0 / 30.5 | **NOT A PASS** — same gap at 50% opacity |

Two of six cells are named as not expressible; one fails by 0.15 on a shadow
the archetype has no leaf for. **checkbox@1 does not carry a box shadow** —
that is the next grammar increment, not a fixture value.

## Instrument note

`pctAAMasked` masks every pixel adjacent to an edge on either side. A stroke
thinner than ~2px is *all* edge, so a whole missing thin glyph can score under
the bar (2.94% here, against a 16.9-point ink gap). A generic ink-delta guard
was surveyed across every scored row and does not separate cleanly: the real
`shadow-xs` row costs 7.4 points on a passing state, the same as the missing
50%-opacity glyph. So the gate keeps its bar and this README keeps the
verdicts honest; a score for a state that is *known* not to be expressible is
never reported as a pass.

## Files

- `canvas-<state>.png` — read-only export of the shadcn variant's `checkbox/hit`
- `score-<state>.json` / `score-<state>.diff.png` — `recipe/fidelity-score.ts`
- the proposal: `recipe/evidence/pointed/checkbox-shadcn/` (roles, proposal, glyph citation from `lucide-react@1.30.0 dist/esm/icons/check.mjs`, both writer programs)
