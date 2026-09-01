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

## First results — checkbox, unchecked/enabled

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
