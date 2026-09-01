# Recipe fidelity v1 — does the mint look like the real library?

Written 2026-08-31. Gate: `npx tsx recipe/fidelity-score.ts`.

The recipe path had no answer to this question. Every existing gate measures
**accounting** (is each fact carried, named or receipted) or **usability** (is
each cell inside its box, correctly roled, non-overlapping). A mint can pass all
of them and still not look like the library it claims to describe — which is
exactly the doubt the owner raised after eyeballing three libraries' checkboxes
and finding them near-identical.

This scores a Figma export against the **real library's own Chromium render**
(`extract/computed/out/<lib>/<component>/orig-shots/`), reusing the canvas-gate
scorer that already backs the console-loop lane. Bar: `pctAAMasked ≤ 5%`.

## Result — the loop closed

| subject | v3 mint | v4 mint (after fix) |
| --- | --- | --- |
| `checkbox/astryx` | 0.00% PASS | **0.00% PASS** |
| `checkbox/antd` | 0.00% PASS | **0.00% PASS** |
| `checkbox/mui` | 49.31% FAIL (24×24 vs 18×18) | **0.00% PASS (18×18 vs 18×18)** |

The gate found a defect no other instrument could see, the fix was made, the
archetype was reminted (page `199:78556`), and the gate now passes at 0.00% on
all three. MUI's ink coverage matches the real render exactly: 39.5% / 39.5%.

Fixing it also surfaced a **latent break**: the checkbox archetype could not
mint at all. `check.path` carried MUI's shipped compact spelling
(`M19 3H5c-1.11…`) and Figma's `vectorPaths` parser refuses it —
`Invalid command at H5c-1.11`. The live v3 page predates that path and still
carried an older hand-flattened square, so nothing had caught it. See
`recipe/figma-vector-path.ts` for the probed grammar and the lowering.

## First results — checkbox, unchecked/enabled (v3 mint, before the fix)

| subject | canvas | real | AA masked | verdict |
| --- | --- | --- | --- | --- |
| `checkbox/astryx` | 22×22 | 22×22 | **0.00%** | **PASS** |
| `checkbox/antd` | 16×16 | 16×16 | **0.00%** | **PASS** |
| `checkbox/mui` | 24×24 | 18×18 | **49.31%** | **FAIL** |

Two of three minted checkboxes are **pixel-identical** to the real package
render, verified down to raw pixel values (differences of 1–3/255, pure
anti-aliasing). The owner's "they all look the same" impression came from a
low-zoom page screenshot where three correctly-different controls
(24px, 42px wrapper, 16px) sit beside labels in the same fallback font.

## The MUI defect, and why only a pixel gate could find it

The MUI row is a real defect, and the interesting part is that **every other
instrument says it is fine**:

```
wrapper.size   fixture=42  captured=42  match
box.size       fixture=24  captured=24  match
```

The fixture says 24, and the capture *agrees* — because 24 is the size of MUI's
`MuiSvgIcon-root`, the icon **container**. MUI does not paint that container. It
paints an 18×18 rounded rect **inside** it, as an SVG path with its own padding.

So the mint draws the icon's bounding box where MUI draws the icon's path. The
reader cannot see this: it compares a declared number to a computed number and
both are 24. Only rasterising both sides catches it.

That is the class of defect this gate exists for, and it is the answer to "why
did accounting-green mints still look wrong".

## Switch — three more subjects, two more real defects

| subject | canvas | real | AA masked | verdict |
| --- | --- | --- | --- | --- |
| `switch/astryx` | 40×24 | 40×24 | **0.00%** | **PASS** |
| `switch/antd` | 44×22 | 44×24 | 6.82% | FAIL |
| `switch/mui` | 17×14 ink | 38×19 ink | 35.04% | FAIL |

**`switch/antd` is not a defect, and I recorded it as one before re-measuring.**
The trim counts anything below 250/255 as ink. Chromium's render carries two
rows of AA fringe at 241–248 that Figma's export does not produce, so the
reference measures 44×24 and the canvas 44×22. At a threshold of 240 or stricter
**both are 44×22 exactly**. The 6.82% is the misalignment those 2px cause in the
union pad, not a difference in the design.

| threshold | reference | canvas |
| --- | --- | --- |
| 250 (scorer default) | 44×24 | 44×22 |
| 245 | 44×23 | 44×22 |
| **240** | **44×22** | **44×22** |
| 230 | 44×22 | 44×22 |

Worth stating plainly: a trim threshold is a tuning choice, and this one
manufactured a defect out of two renderers' anti-aliasing.

**`switch/mui`** is the more serious one, and it is visible at a glance. MUI's
unchecked switch is a **white circular thumb sitting on a grey track**. The mint
renders a single grey blob: the thumb is not white and does not read as separate
from the track. Ink extent gives it away — 17×14 painted against the real 38×19.

Neither is fixed here. They are named, measured, and reproducible.

## Two instrument limits found while measuring

- **`cropLeadingControl` assumes the control is visually contiguous.** It is,
  for a checkbox and for the Astryx/AntD switches. MUI's unchecked switch has
  internal whitespace between thumb and track, so the 6px gap rule splits it and
  measures the thumb alone. `--canvas-box x,y,w,h` takes explicit bounds from the
  scene instead; tuning the heuristic per subject would have been fitting the
  instrument to the answer.
- **pngjs cannot decode one particular Figma export.** The 58×38
  `switch/hit` PNG is structurally valid (identical chunk layout to exports that
  read fine, IEND terminated, no trailing bytes) and pngjs still refuses it with
  "unrecognised content at end of stream". Worked around by exporting the parent
  variant instead. Named, not silently skipped.

## What these numbers do NOT mean

- **One state of one component.** A pass here is not a pass for the archetype.
  Nothing here flips `overallSuccess`, and no grade is invented.
- **Ink coverage is quoted beside every score** because a near-blank canvas
  scores a deceptively low diff. Read `inkCanvasPct` / `inkRealPct`.
- **The reference is one MOUNT.** Astryx renders differently under
  `@astryxdesign/core` alone than under `<Theme theme={neutralTheme}>`. These
  Astryx scores use the **core-only** capture
  (`extract/computed/out/astryx-core/`, config `astryx-core.json`), because that
  is the surface `recipe/fixtures/library-*.ts` actually transcribes. Scoring
  against the themed capture would fail on the theme, not on the mint.
- **Labels are cropped out** by `cropLeadingControl`. Figma and Chromium
  rasterize text with different hinting; scoring "Accept terms" measures two
  renderers, not two designs. Scored whole, the Astryx checkbox reads 16.08% —
  and the diff image is almost entirely label glyph edges. The console-loop lane
  already used control-only crops; this makes that convention explicit.

## Reproduce

```bash
npx tsx recipe/fidelity-score.ts \
  --canvas    recipe/evidence/fidelity-v1/shots/checkbox-astryx-glyph.png \
  --reference extract/computed/out/astryx-core/checkboxinput/orig-shots/unchecked.md.no-isDisabled__default.png \
  --reference-control-only \
  --label     checkbox/astryx \
  --out       recipe/evidence/fidelity-v1/checkbox-astryx.json
```

Canvas shots are read-only exports of signed Scratch page `198:77718`
(`checkbox/hit` frames `198:77942`, `198:77822`, `198:78063`). Zero Figma writes.

## 2026-09-01 — every existing reference scored

The manifest went from 8 subjects to 24. Two additions to the instrument:

- `component` resolver — the boilerplate v1 stays are single components inside
  wrap frames, not sets (`scripts/capture-fidelity-shots.mjs`).
- `widthNormalised` — fill-width controls (textarea) are scored as two equal
  edge windows after an ink trim, so corners, border, radius and every vertical
  metric count and the container-owned interior width does not
  (`recipe/fidelity-score.ts` `scoreEdgeWindows`). The three textareas the
  previous manifest excluded by prose are now measured rows.

Result: **10 pass · 1 fringe · 13 fail.** The 13 are named in
`KNOWN-FAILURES.json`, a shrink-only ratchet the gate reads: a failing subject
not named there is red, a named subject that passes is red (stale), and no row
changes a score. Classes: 7 real-defect, 4 content-mismatch, 2 font-substrate.
The headline real defect is the alert archetype: all three libraries ship the
status glyph as an SVG asset in the capture output and the mint paints a
filled disc. See `scripts/fidelity-contact-sheet.ts` for the side-by-side.

Still excluded, with the reason in the manifest: dialog/menu (the only
references are full-viewport overlay captures) and the four signed legs whose
pages carry two identically named sets (name resolution cannot pick a leg).

## 2026-09-01 (later) — the alert glyphs, closed by remint

The headline real defect above is fixed at the source. `alert@1` now carries
each library's status glyph as a vector read from the capture's own SVG asset
(`recipe/fixtures/capture-glyph.ts`), lowered through
`recipe/figma-vector-path.ts` — which gained arc lowering with a reported
bound and SVG-style closing of open filled subpaths — and placed in a centred
host that refuses an off-centre source. Two more defects surfaced on the way
and were fixed in the same remint: AntD's height omitted its 1px border
(38 → 40, border-box), and the Astryx title provenance recorded SF Pro Medium
because Semibold was not installed when v1 minted (the writer's tamper check
caught it). Title text now comes from each capture's sample, and the Astryx
reference is captured title-only to match the recipe's declared scope, with
`description` a named refusal.

    subject        v1 (disc)   v3 (glyph)
    alert/astryx   64.6% FAIL   7.57% known (font-substrate)
    alert/mui       6.98% FAIL   3.95% PASS
    alert/antd     15.86% FAIL   3.35% PASS

Two attempts before v3 were refused by the writer's own guards (the glyph
bounds guard at 0.15px on the Astryx warning icon; the font tamper check)
and their partial pages and collections were removed before the next attempt.
The gate is now **12 pass · 1 fringe · 11 known**.
