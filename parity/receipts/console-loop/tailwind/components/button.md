# Button — tailwind console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `flowbite.button`  
**Recorded:** 2026-08-06T05:42:57.761Z

## Generate

Uploaded `examples/tailwind/figma/button.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:2254` (COMPONENT_SET on page **Button (flowbite.button)**, section `1:2265`)
- **variants:** 45
- **properties:** Content#1:719, Color, Size, State

## Screenshot

Button COMPONENT_SET 1:2254: 45 variant(s), 4 prop def(s) on page Button (flowbite.button). Screenshot export of section/node 1:2265 ok (74288 bytes PNG@2x). First root fill bound to imported/button/root/background-color/default. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2297298321`
- **lineCount:** 888

## Round-trip

Compared canvas props to `examples/tailwind/contracts/button.contract.json`.

- **MATCH axes:** Color enum → Default/Alternative/Dark/Green/Red, Size enum → Md/Xs/Sm/Lg/Xl, TEXT Content, first-variant fill bound: imported/button/root/background-color/default
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/tailwind/button/receipts/pair--default.md.enabled__default.png
- defect: Size ladder still not verified as Flowbite height scale fidelity vs pair--default.md.enabled__default.png — fail closed.
- defect: Cream surface improved reviewability; aesthetic match not claimed.

## Re-sync

- reSyncedAt: **2026-08-07T12:12:42.940Z**
- note: Re-synced via clientStorage chunks (n=20, total=152832); amended nodeId=1:2254; rebuiltVariants=45; literals for root height (no imported/button/root/height/* vars). matchDeveloped left false.
- matchDeveloped: **false**
