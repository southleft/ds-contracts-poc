# Tag — polaris console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `polaris.tag`  
**Recorded:** 2026-08-06T05:47:34.491Z

## Generate

Uploaded `examples/polaris/figma/tag.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:10192` (COMPONENT_SET on page **Tag (polaris.tag)**, section `1:10195`)
- **variants:** 8
- **properties:** Disabled#1:2368, Show Removable#1:2377, Show Clickable#1:2386, Show Linked#1:2395, Accessibility Label#1:2404, Url#1:2413, Content#1:2422, Size, State

## Screenshot

Tag COMPONENT_SET 1:10192: 8 variant(s), 9 prop def(s) on page Tag (polaris.tag). Screenshot export of section/node 1:10195 ok (25100 bytes PNG@2x). First root fill bound to p/color-bg-fill-tertiary. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2986545534`
- **lineCount:** 583

## Round-trip

Compared canvas props to `examples/polaris/contracts/tag.contract.json`.

- **MATCH axes:** BOOLEAN Disabled, TEXT Accessibility Label, TEXT Url, Size enum → none/large, BOOLEAN Show Removable, BOOLEAN Show Clickable, BOOLEAN Show Linked, TEXT Content, first-variant fill bound: p/color-bg-fill-tertiary
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/polaris/receipts/tag/default.png
- defect: Active/focus heavy borders atypical of Polaris Tag; size geometry inconsistent with developed tag receipt.
