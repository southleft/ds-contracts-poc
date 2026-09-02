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

## Scores (bar 5% AA-masked) — checkbox v11, page `218:86637`

| state | AA masked | exact unmasked | ink canvas / real | verdict |
|---|---|---|---|---|
| unchecked.enabled | **0.00%** | — | 24.3 / 29.4 | pass, **16×17 both sides**: shadcn's `shadow-xs` is now a carried leaf (`boxShadow`), lowered to a Figma drop shadow that never shows behind its node, on a hit frame that no longer clips it |
| unchecked.disabled | **0.00%** | — | 23.0 / 20.3 | pass |
| checked.disabled | 3.13% | — | 97.3 / 96.1 | pass |
| checked.enabled | **5.15%** | — | 96.0 / 94.9 | **FAIL by 0.15** — the glyph's 1.17px stroke: the diff hugs the whole stroke; Chromium spreads it softly over two rows, Figma renders it crisper and ~1px higher. Thin-stroke rasterisation, not a missing fact (the same path at 1.75px on Chakra is 0.00%). |
| indeterminate.enabled | 2.94% | — | 24.3 / **39.0** | **NOT A PASS** — the glyph is absent (named gap). The number is the instrument: the AA mask excuses a 1.17px stroke entirely. Read the ink columns. |
| indeterminate.disabled | 3.13% | — | 23.0 / 30.5 | **NOT A PASS** — same gap at 50% opacity |

Two of six cells are named as not expressible; one fails by 0.15 on the
rasterisation of a stroke thinner than 2px. Earlier rounds of this table (v7,
v8) had the checked state failing on the uncarried shadow; carrying it moved
the unchecked crop to 16×17 and left the checked score unchanged, which is how
the residual was attributed to the glyph and not the shadow.

### What the shadow taught the runtime (v8 → v11)

v8 carried the shadow but scored the same: the minted box had
`showShadowBehindNode: true` (Figma's default when a plugin creates an
effect), so the shadow bled through the transparent unchecked fill, and the
hit frame had Figma's default `clipsContent: true`, so the shadow below a box
that fills its hit area was cut off. CSS has neither behaviour. The first
correction (v9: never behind the node; clip only when the IR says so) moved
one other subject — switch/mui 4.57% → 5.92% — and a probe on a throwaway
clone measured why: Figma renders a frame's **own** drop shadow like Chromium
only when that frame clips its content (thumb tail rows against the real
27/37/44/54: clipping 45/51/71/80, not clipping 73/76/84/88 and a row
longer), while the behind-node flag is byte-identical for an opaque node.
The rules that stand (`recipe/figma-writer-runtime.ts`, v11): a lowered
shadow shows behind its node only when the node is fully opaque; a frame
clips when the IR says so, or when it carries a drop shadow, and otherwise
does not. All thirteen archetypes were reminted through them with every
score unchanged.

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
