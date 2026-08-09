# IconClose — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.iconclose`  
**Recorded:** 2026-08-06T05:43:14.336Z

## Generate

Uploaded `examples/altitude/figma/icon-close.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3071` (COMPONENT_SET on page **IconClose**, section `1:3072`)
- **variants:** 7
- **properties:** Size

## Screenshot

IconClose COMPONENT_SET 1:3071: 7 variant(s), 1 prop def(s) on page IconClose. Screenshot export of section/node 1:3072 ok (8852 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1912940653`
- **lineCount:** 2

## Round-trip

Compared canvas props to `examples/altitude/contracts/iconclose.contract.json`.

- **MATCH axes:** Size enum → Xs/Sm/Md/Lg/Xl/Xxl/Xxxl
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-09T07:30:10.247Z`
- status: **fail-closed**
- matchDeveloped: **false**
- reference: `extract/computed/out/altitude/iconclose/orig-shots/lg__default.png` (REAL library render — altitude-web-components@1.0.2)
- scorecard: `parity/receipts/console-loop/altitude/scores/icon-close.json` — pctAAMasked **19.75**, compositionOk **true**, canvas 18x18 vs library 18x18
- corroborating instrument: `scripts/visual-truth-run.mjs --lib altitude` (headless Figma REST images API)

### Notes

- AUTHORED-VIEWBOX CORRECTED 2026-08-09. Every icon-close asset carried a per-size viewBox (unset/xs/sm 0 0 40 40; md 20; lg 24; xl 32; xxl 36; xxxl 40) where altitude-web-components' own dist/icons/close.svg is `0 0 20 20` for every size. The glyph path spans 15.2 user units, so the canvas drew 15.2/24 of a 24px box at Size=Lg (16px of ink) where the library draws 15.2/20 (18px), and at `unset` it drew 6px where the library draws 12px. Assets corrected in examples/altitude/assets/icons/ and extract/computed/out/altitude/iconclose/assets/; the canvas Vector is now 18.0x18.0 against the library's 18x18 ink, identical shape and identical ink percentage (48.148148 both). Evidence: scripts/altitude-svg-viewbox-probe.mts.

### Named defects (fail-closed)

- FC-SVG-VIEWBOX-UNIFIED-MAX (generator, NOT taken this round): extract/computed/anatomy.ts round-5c unification takes `cand = Math.max(...anchors.map(g => g.r.vb))` and lets only BUMPED members adopt it, while writing a receipt that calls the result "the package's own viewBox". For one glyph drawn at many sizes the authored space is the MINIMUM unbumped computed size and every member must adopt it. The probe predicts the library ink exactly at 5/8 sizes from `0 0 20 20` and within 1px at the other 3, against 0/8 from the committed per-size viewBoxes. Landing it means re-running extract/computed for every lane, so it is named and handed over rather than taken: altitude is the only lane emitting svg-viewbox-unified receipts (6, all IconClose).
- FC-AA-THIN-VECTOR: with the geometry now exact the residual is rasterizer coverage. Aligned on their ink boxes the two 18x18 glyphs have the SAME coverage pattern, but Chromium fills the thin diagonal arms fatter than Figma does — total ink mass 111.05 (library) vs 97.49 (canvas), ~12% — so every fringe pixel of a shape that is almost all fringe differs by ~30/765. pctAAMasked 19.75 (was 17.28 only because the 16x16-vs-18x18 mismatch made the scorer resample and smooth). This is a floor for this glyph on this instrument, not a canvas defect.
