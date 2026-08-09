# Console-loop ledger — Polaris (on DS-Contracts-Testing)

File: https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing  
Transport: Figma Console MCP `figma_execute` + clientStorage chunk upload  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Completed | **12/12** |
| Failed | 0 |
| Canvas-projection (named curation) | text, text-field (per COMPILE-RECEIPT.md) |

Gate stems: all 12 under `components/`.

## 2026-08-08 — FC-CELL-FRAMING round: the defect was on the REFERENCE side

The three polaris stems that failed `compositionOk` ("use 1x VARIANT cell vs
gate-shot") were re-measured against the LIVE canvas via the Desktop Bridge.
Every committed shot is exactly its 1x VARIANT cell — the canvas capture was
never wrong. What was wrong was the reference each was scored against:

| stem | before | after | what actually moved |
|---|---|---|---|
| text-field | 9.56 AA, comp=false, sr=3.06 | **4.11 AA, comp=true — SCORED PASS** | reference re-pointed from a Times-substrate emit-html first-item render (69x47) to `extract/computed/out/textfield/gate-shots/inherit.medium.off.off.off.enabled__default.png` |
| text | 10.77 AA, comp=false, sr=6.59 | 26.07 AA, comp=true, sr=1.01 | old reference was a 949x23 strip carrying the sample string TWICE; re-pointed to `text/gate-shots/headingSm.base.regular__default.png` |
| thumbnail | 77.25 AA, comp=false, sr=1.18 | 85.72 AA, comp=false, sr=1.07 | framing fixed; residual is FC-REF-BROKEN-ASSET — the gate-shot renders a BROKEN `<img>` (broken-image glyph + alt text "Black choker necklace"), so its 29% ink can never agree with a solid Thumbnail |

Found by the new pin, not by the scorer: **polaris/checkbox** shipped a 16x20
hand crop of the checkbox BOX; the VARIANT cell 1:10019 is 160x28 and includes
its label. Re-exported at scale 1 from the live canvas; reference re-pointed to
`checkbox/gate-shots/unchecked.enabled__default.png`. 16.05 -> 18.39 AA, comp
true — an honest number for the first time.

Pin: `parity/receipts/console-loop/polaris/framing.json` +
`scripts/console-loop-capture-framing-check.mjs`.

## 2026-08-08 — Class B round: FIVE of nine "pixel-bar misses" were STALE EVIDENCE

The nine composition-clean misses were re-measured with a triangle probe
(`scripts/polaris-ref-triangle.mts`) that renders the CURRENT contract's
emit-html output at scale 1 on the real Inter face and compares it against BOTH
the committed reference AND the live canvas cell, re-exported from
`GnQnjSNBXtgtd2Ht0Hs1C8` over the Desktop Bridge. Evidence:
`refs-fresh/TRIANGLE.json`.

The triangle answers "reader, grammar, emitter or reference?" by construction:

| leg | reading |
|---|---|
| live canvas ↔ fresh code render ≈ 0, committed ref ↔ fresh large | the REFERENCE is stale |
| committed ref ↔ fresh ≈ 0, live ↔ fresh large | the CANVAS is wrong (emitter) |
| committed shot ↔ live cell large | the SHOT is stale |

Result: **not one of the nine was a canvas defect.**

| stem | before | after | cause |
|---|---|---|---|
| progress-bar | 59.77 | **0.17 SCORED PASS** | FC-STALE-REF (the FC-METER fix landed on the canvas; the reference was never re-rendered) |
| spinner | 7.79 | **0.00 SCORED PASS** | FC-STALE-REF |
| tag | 9.72 | **1.94 SCORED PASS** | FC-STALE-REF |
| radio-button | 20.60 | 14.07 | FC-STALE-REF (old ref was 142x18 — it predated the label) + glyph raster |
| avatar | 14.54 | 8.67 | FC-STALE-REF + glyph raster |
| checkbox | 18.39 | 15.47 | ref was the 18x18 box-only gate-shot + glyph raster |
| badge | 15.81 | 12.58 | FC-STALE-SHOT + FC-ENUM-DEFAULT-SPLIT |
| button | 11.61 | 16.62 | FC-STALE-SHOT + FC-WHITE-ON-WHITE (instrument; 4.91 on the declared cream surface) |
| banner | 8.96 | 9.50 | unchanged within noise — glyph raster + icon vector |

### The headline: progress-bar, 59.77 → 0.17

The canvas draws a #E3E3E3 track with a #91D0FF indicator 115/288 wide — 40%,
exactly the contract's `progress` default and exactly what today's emit-html
writes (`style="width: 40%"`). The committed reference was 99.3% solid #91D0FF:
a render of an OLDER emit-html in which the indicator spanned the whole track.
`receipts/pair--medium.highlight__default.png` in the computed output shows the
same frame from the other side — REAL POLARIS at 40%, CONTRACT RENDER at 100%.
The 59.77 was the age of a PNG.

### Named causes carried forward (fail-closed, canvas is NOT the defect)

- **FC-BORDER-STYLE-NOT-SYNTHESISED** (text-field, code side). `core/emit-react.ts`
  synthesises `border-style: solid` only when the SHORTHAND `border-width` sits in
  `part.tokens`/`part.literals` (lines ~1750 and ~2377). Since `c924c9c2` the
  TextField backdrop carries its width as per-variant LONGHAND literals
  (`border-top-width: 1px` … under `.text-field--variant-inherit`) and the base
  `{p.border-width-0165}` token binding is gone — so no keyword is emitted and CSS
  paints nothing. The v0.1.0 `gate.html` still carries `border-width` +
  `border-style: solid`, which is why the gate-shot reference has a border and the
  current render does not. The canvas is RIGHT (`stroke: p/color-input-border`,
  strokeSides 1) and so is the library (`border: var(--p-border-width-0165) solid
  var(--p-color-input-border)`). Reference deliberately LEFT on the gate-shot —
  re-basing would have installed a knowingly border-less reference and regressed a
  passing stem 4.11 → 10.62.
- **FC-ENUM-DEFAULT-SPLIT** (text 26.07, badge). `text` declares FIVE enum props
  with no `default`; emit-html renders a bare `<p class="text">` at base typography
  while the canvas cell is `Variant=Heading Sm`. The two emitters disagree about
  what the default IS, so the default cell can never be a like-for-like pair. Same
  shape on `badge.tone` (no default; canvas names the cell `Tone=enabled`).
- **FC-WHITE-ON-WHITE** (button, INSTRUMENT limit — added to `framing.json`
  `guard.framingCauses`). Polaris Button secondary's root fill IS #ffffff, the
  review substrate, so the content-box crop finds only the border and the shot box
  collapses to 63x21 for a 63x32 cell. Both sides on the cream `#F8F4ED`
  reviewSurface the receipts already declare: **4.91**, under the bar. The lane
  cannot simply move to cream — the scorer's crop trims WHITE only, so a cream
  margin reads as ink (measured: progress-bar 0.17 → 58.25 on cream). The fix is to
  teach the crop the substrate, not to re-shoot the canvas.
- **FC-REF-BROKEN-ASSET** (thumbnail 76.44, unchanged refusal). Both the gate-shot
  and the regenerated current render draw the browser's broken-image glyph plus the
  alt text; the contract slot default has no resolvable source.

### Two instrument findings worth keeping

1. **The framing pin is geometry-only.** `polaris/button` and `polaris/badge` both
   shipped a canvas shot of a DIFFERENT variant than the pinned cell (a dark
   Primary-looking button where the live Secondary cell is white; a blue pill where
   the live cell is neutral). Both passed `console-loop:capture-framing` because the
   dimensions matched. A content fingerprint, not just a box, would have caught it.
2. **pixelmatch at threshold 0.1 is blind to a tone swap.** badge's stale blue shot
   vs the live neutral cell differed on 94.43% of pixels per channel and scored
   7.13 AA — #F0F0F0 vs #D5EBFF has a YIQ delta of 158 against the 352 cutoff.

### Verification

`console-loop:capture-framing` ✔ (button open, named FC-WHITE-ON-WHITE) ·
`console-loop:polaris:evidence:check` ✔ 12/12, **4 scored-pass** (was 1) ·
`visual-truth:run --lib polaris` reproduces the board on the INDEPENDENT headless
REST instrument (progress-bar 0.04, spinner 0.00, tag 2.50, text-field 4.72 — all
pass) · `visual-truth:check` ✔ for polaris · `tsc --noEmit` ✔.

## 2026-08-08 — REFERENCE-TRUTH round: this lane WAS re-pointed, and here is why

**Reference basis for this lane: LIBRARY RENDER** for eleven of twelve stems —
`extract/computed/out/<comp>/orig-shots/<combo>__default.png`, the
`@shopify/polaris@13.9.5` screenshot committed by
`extract/computed/run.ts --keep-originals`.

Before this round every polaris reference was a **CONTRACT RENDER**: ten stems
pointed at `refs/*.png`, regenerated by `scripts/polaris-ref-triangle.mts --adopt`
from `examples/polaris/generated/html/<stem>.html#first-item` — emit-html over the
*current contract* — and `text` pointed straight at `out/text/gate-shots/`. That was
a deliberate earlier decision and it is a defensible basis for a contract-vs-emitter
question. It is **not** a basis on which the word "developed" can mean the library,
and this lane has a real npm package and a working sandbox
(`examples/polaris/.polaris-sandbox`), so a package render was obtainable and was
obtained.

### Honest before → after (pctAAMasked, bar 5)

| stem | before (contract render) | after (library) | verdict |
|---|---|---|---|
| text-field | 4.77 | **3.97** | **survives** |
| thumbnail | 76.44 | **0.06** | **NEW PASS** |
| banner | 9.50 | **4.39** | **NEW PASS** |
| progress-bar | **0.17** | **15.06** | **artifact** |
| spinner | **0.00** | **11.30** | **artifact** |
| tag | 1.94 | **not re-measured** | **UNVERIFIED** — see below |
| badge | 12.58 | 7.21 | fail → fail |
| radio-button | 14.07 | 10.03 | fail → fail |
| avatar | 8.67 | 10.97 | fail → fail |
| checkbox | 15.47 | 18.00 | fail → fail |
| button | 16.62 | 19.58 | fail → fail (FC-WHITE-ON-WHITE still applies) |
| text | 26.07 | 25.38 | fail → fail |

**Scorecard passes: 4 → 4**, but they are not the same four. Two passes were
artifacts and two new ones appeared. Both instruments agree (bridge lane and
headless `visual-truth`: banner, tag, text-field, thumbnail). Floor is **0** and
holds. Recommended re-derivation: **0 → 3** — banner, text-field, thumbnail, the
three verified against real Polaris pixels. `tag` is deliberately excluded.

### `spinner`'s 0.00 and `progress-bar`'s 0.17 are the cleanest specimens on the board

A perfect zero is what emitter agreement looks like when both sides draw the same
picture, and it says nothing about whether that picture is Polaris. Against the
package, spinner is 11.30 and progress-bar is 15.06.

### `tag`: the one pass on this board that could not be verified

`run.ts --keep-originals` **quarantines** polaris `Tag` before the fidelity gate:

> `polaris.tag: part "link" carries channel "width" as BOTH a token binding and a
> literal — ambiguous, refused by name`

No contract is written, no `orig-shots/` exist, and no library screenshot could be
committed. `tag`'s 1.94 therefore still measures **emitter agreement** against
`refs/tag.png`. The receipt now says so in `visual.referenceSource`. It stays
`scored-pass` because that is what its scorecard says on its stated basis — but it
must not be counted as a fidelity pass, which is why the floor recommendation above
leaves it out.

### An instrument defect found while doing this, and fixed

`console-loop-developed-score.mjs --manifest` resolves references from
`trap-corpus/manifest.json`, while `--lib/--stem` resolves them from the receipt.
For `polaris/text-field` and `polaris/button` those two disagreed, so a routine
`--manifest` run **silently rewrote both scorecards onto a different picture**
(text-field 4.77 pass → 4.80 fail; button 16.62 → 44.37) and minted a scorecard for
`astryx/toast`, a stem the lane never scored. The manifest rows for those two stems
are now aligned to the receipts, and the three retargeted trap stems
(altitude/badge, tailwind/toggle-switch, carbon/checkbox) were moved to `orig-shots/`
in the same file so the two paths cannot diverge again.

### Rebuildability, measured while capturing (no committed gate-shot was overwritten)

`button`, `progressbar`, `radiobutton`, `spinner`, `thumbnail` and `text` reproduce
their committed `gate-shots/` byte-for-byte at HEAD. `avatar` (40/40), `badge`,
`banner` (64/64), `checkbox` (24/24) and `textfield` (128/256) do not, and `tag`
cannot be rebuilt at all (quarantined above).
