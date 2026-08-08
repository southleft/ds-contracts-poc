# Badge — tailwind console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `flowbite.badge`  
**Recorded:** 2026-08-06T05:42:56.743Z

## Generate

Uploaded `examples/tailwind/figma/badge.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:2149` (COMPONENT_SET on page **Badge (flowbite.badge)**, section `1:2162`)
- **variants:** 24
- **properties:** Content#1:694, Color, Size, State

## Screenshot

Badge COMPONENT_SET 1:2149: 24 variant(s), 4 prop def(s) on page Badge (flowbite.badge). Screenshot export of section/node 1:2162 ok (43124 bytes PNG@2x). First root fill bound to imported/badge/root/background-color/info. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2933199349`
- **lineCount:** 428

## Round-trip

Compared canvas props to `examples/tailwind/contracts/badge.contract.json`.

- **MATCH axes:** Color enum → Info/Failure/Success/Warning/Indigo/Pink, Size enum → Xs/Sm, TEXT Content, first-variant fill bound: imported/badge/root/background-color/info
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/tailwind/badge/receipts/pair--info.xs__default.png
- defect: State Active/Hover fill shifts not verified vs Flowbite badge pairs — fail closed.
