# Button — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.button`  
**Recorded:** 2026-08-06T05:44:08.324Z

## Generate

Uploaded `examples/astryx/figma/button.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3864` (COMPONENT_SET on page **Button (astryx.button)**, section `1:3865`)
- **variants:** 12
- **properties:** Is Disabled#1:930, Is Loading#1:943, Is Icon Only#1:956, Label#1:969, Variant, Size

## Screenshot

Button COMPONENT_SET 1:3864: 12 variant(s), 6 prop def(s) on page Button (astryx.button). Screenshot export of section/node 1:3865 ok (28357 bytes PNG@2x). First root fill bound to color-neutral. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1886612596`
- **lineCount:** 370

## Round-trip

Compared canvas props to `examples/astryx/contracts/button.contract.json`.

- **MATCH axes:** Variant enum → Secondary/Primary/Ghost/Destructive, Size enum → Md/Sm/Lg, BOOLEAN Is Disabled, BOOLEAN Is Loading, BOOLEAN Is Icon Only, TEXT Label, first-variant fill bound: color-neutral
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **true**
- reference: examples/astryx/receipts/site/Button.png; examples/astryx/tokens/astryx-docs.dtcg.json
- defects: none

## 2026-08-08 — FC-FONT-SUBSTRATE harness landed; this stem stays fail-closed by name

- cfg.fonts (per-library @font-face, data:-URI, network-free) landed and converted altitude chip/link. This library is left unconfigured: no library-true font file exists in a committed/sandboxed source (see receipt note). Reference NOT re-pinned; residual cause updated on the receipt.
