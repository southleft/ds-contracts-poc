# Badge — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.badge`  
**Recorded:** 2026-08-06T05:44:07.010Z

## Generate

Uploaded `examples/astryx/figma/badge.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3794` (COMPONENT_SET on page **Badge (astryx.badge)**, section `1:3795`)
- **variants:** 14
- **properties:** Label#1:897, Variant

## Screenshot

Badge COMPONENT_SET 1:3794: 14 variant(s), 2 prop def(s) on page Badge (astryx.badge). Screenshot export of section/node 1:3795 ok (41333 bytes PNG@2x). First root fill bound to color-neutral. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1192491616`
- **lineCount:** 244

## Round-trip

Compared canvas props to `examples/astryx/contracts/badge.contract.json`.

- **MATCH axes:** Variant enum → Neutral/Info/Success/Warning/Error/Blue/Cyan/Green/Orange/Pink/Purple/Red/Teal/Yellow, TEXT Label, first-variant fill bound: color-neutral
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/astryx/receipts/site/Badge.png
- defect: Accent/default row uses near-black solid; docs Info status is saturated blue with white text — status mapping incomplete.
- defect: Missing icon treatments present in some docs badge examples; fail closed until status axis maps 1:1 to developed Neutral/Info/Success/Warning/Error row.
