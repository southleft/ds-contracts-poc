# Link — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.link`  
**Recorded:** 2026-08-06T05:43:14.695Z

## Generate

Uploaded `examples/altitude/figma/link.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3092` (COMPONENT_SET on page **Link**, section `1:3096`)
- **variants:** 9
- **properties:** Content#1:819, Variant, State

## Screenshot

Link COMPONENT_SET 1:3092: 9 variant(s), 3 prop def(s) on page Link. Screenshot export of section/node 1:3096 ok (8734 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:3448013784`
- **lineCount:** 4

## Round-trip

Compared canvas props to `examples/altitude/contracts/link.contract.json`.

- **MATCH axes:** Variant enum → Xs/Sm/Lg, TEXT Content
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-09T07:30:10.247Z`
- status: **fail-closed**
- matchDeveloped: **false**
- reference: `extract/computed/out/altitude/link/orig-shots/lg__default.png` (REAL library render — altitude-web-components@1.0.2)
- scorecard: `parity/receipts/console-loop/altitude/scores/link.json` — pctAAMasked **16.83**, compositionOk **true**, canvas 34x18 vs library 34x16
- corroborating instrument: `scripts/visual-truth-run.mjs --lib altitude` (headless Figma REST images API)

### Notes

- UNDERLINE RESTORED 2026-08-09. `text-decoration-line: underline` is captured truth on the library root but the enricher dropped it as equal-to-UA-control, and core/emit-html renders the root <a> with no href so it is never :any-link and never gets the UA rule. Carried now as a declared literal in examples/altitude/contracts/link.contract.json; the canvas cell went from NO underline to textDecoration=UNDERLINE and its ink width from 32 to 34, exactly the library's 34.

### Named defects (fail-closed)

- FC-CANVAS-DECORATION-AUTO: the contract carries `text-decoration-thickness: auto` (the library's own computed value) and Figma's textDecorationThickness/Offset are AUTO to match. Chromium resolves auto at 18px IBM Plex Sans to a 1px rule 1px below the glyph box; Figma resolves it to a 2px rule 2px below. Canvas ink 34x18 vs library 34x16 — width now exact, the 2px of height is entirely the decoration metric. pctAAMasked 16.83 (was 15.63 with NO underline at all: the scorer size-normalises 34x18 onto 34x16 and squashes the glyph rows out of registration). Probed on the live canvas: setting textDecorationThickness to 1px did not change the export, so the thickness is not plugin-addressable at this size; the node was restored to AUTO.
