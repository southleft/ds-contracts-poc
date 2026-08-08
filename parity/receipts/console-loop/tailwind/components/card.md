# Card — tailwind console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `flowbite.card`  
**Recorded:** 2026-08-06T05:42:58.099Z

## Generate

Uploaded `examples/tailwind/figma/card.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:2267` (COMPONENT on page **Card (flowbite.card)**, section `1:2270`)
- **variants:** 1
- **properties:** Content#1:765

## Screenshot

Card COMPONENT_SET 1:2267: 1 variant(s), 1 prop def(s) on page Card (flowbite.card). Screenshot export of section/node 1:2270 ok (15181 bytes PNG@2x). First root fill bound to imported/card/root/background-color. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:3067143140`
- **lineCount:** 29

## Round-trip

Compared canvas props to `examples/tailwind/contracts/card.contract.json`.

- **MATCH axes:** TEXT Content, first-variant fill bound: imported/card/root/background-color
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/tailwind/card/receipts/pair--__default.png
- defect: Not a COMPONENT_SET; border/shadow aesthetic not match to Flowbite card pairs — fail closed.
