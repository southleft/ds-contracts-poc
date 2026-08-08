# Avatar — polaris console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `polaris.avatar`  
**Recorded:** 2026-08-06T05:47:17.394Z

## Generate

Uploaded `examples/polaris/figma/avatar.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:7849` (COMPONENT_SET on page **Avatar (polaris.avatar)**, section `1:7850`)
- **variants:** 5
- **properties:** Customer#1:1249, Show WithInitials#1:1255, Name#1:1261, Initials#1:1267, Source#1:1273, Accessibility Label#1:1279, Size

## Screenshot

Avatar COMPONENT_SET 1:7849: 5 variant(s), 7 prop def(s) on page Avatar (polaris.avatar). Screenshot export of section/node 1:7850 ok (12913 bytes PNG@2x). First root fill bound to p/color-avatar-one-bg-fill. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:635946300`
- **lineCount:** 146

## Round-trip

Compared canvas props to `examples/polaris/contracts/avatar.contract.json`.

- **MATCH axes:** Size enum → Md/Xs/Sm/Lg/Xl, TEXT Name, TEXT Initials, BOOLEAN Customer, TEXT Source, TEXT Accessibility Label, BOOLEAN Show WithInitials, first-variant fill bound: p/color-avatar-one-bg-fill
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/polaris/receipts/avatar/default.png
- defect: Saturated magenta placeholder not matching Polaris avatar developed defaults — fail closed.
