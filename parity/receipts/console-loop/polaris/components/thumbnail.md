# Thumbnail — polaris console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `polaris.thumbnail`  
**Recorded:** 2026-08-06T05:47:39.023Z
**reSyncedAt:** 2026-08-07T16:37:22.237Z

## Generate

Uploaded `examples/polaris/figma/thumbnail.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:10491` (COMPONENT_SET on page **Thumbnail**, section `1:10492`)
- **variants:** 4
- **properties:** Transparent#1:2990, Alt#1:2995, Size

## Screenshot

Thumbnail COMPONENT_SET 1:10491: 4 variant(s), 3 prop def(s) on page Thumbnail. Screenshot export of section/node 1:10492 ok (6039 bytes PNG@2x). First root fill bound to p/color-bg-surface. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2374750881`
- **lineCount:** 71

## Round-trip

Compared canvas props to `examples/polaris/contracts/thumbnail.contract.json`.

- **MATCH axes:** Size enum → Medium/Extra Small/Small/Large, TEXT Alt, BOOLEAN Transparent, first-variant fill bound: p/color-bg-surface
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- note: Re-synced via clientStorage chunks (n=10, total=73709); amended nodeId=1:10491; rebuiltVariants=4. matchDeveloped left false.
- reference: examples/polaris/receipts/thumbnail/default.png
- defect: 0-radius gray squares; Polaris Thumbnails are rounded — geometry FAIL.
