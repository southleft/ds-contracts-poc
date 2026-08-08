# Alert — tailwind console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `flowbite.alert`  
**Recorded:** 2026-08-06T05:42:56.094Z

## Generate

Uploaded `examples/tailwind/figma/alert.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:2098` (COMPONENT_SET on page **Alert**, section `1:2099`)
- **variants:** 4
- **properties:** Content#1:689, Color

## Screenshot

Alert COMPONENT_SET 1:2098: 4 variant(s), 2 prop def(s) on page Alert. Screenshot export of section/node 1:2099 ok (21239 bytes PNG@2x). First root fill bound to imported/alert/root/background-color/info. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:438794735`
- **lineCount:** 90

## Round-trip

Compared canvas props to `examples/tailwind/contracts/alert.contract.json`.

- **MATCH axes:** Color enum → Info/Failure/Success/Warning, TEXT Content, first-variant fill bound: imported/alert/root/background-color/info
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/tailwind/alert/receipts/pair--info__default.png
- defect: Missing Flowbite alert icons / dismiss control; text-only chips — fail closed.

## Re-sync

- reSyncedAt: **2026-08-07T12:12:42.940Z**
- note: Re-synced via clientStorage chunks (n=10, total=79963); amended nodeId=1:2098; rebuiltVariants=4; literals for dismiss size/padding (no imported/alert/dismiss/* vars). matchDeveloped left false.
- matchDeveloped: **false**
