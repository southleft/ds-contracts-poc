# Tag — carbon console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `carbon.tag`  
**Recorded:** 2026-08-06T05:47:08.323Z

## Generate

Uploaded `examples/carbon/figma/tag.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:6024` (COMPONENT_SET on page **Tag**, section `1:6025`)
- **variants:** 36
- **properties:** Content#1:1212, Type, Size

## Screenshot

Tag COMPONENT_SET 1:6024: 36 variant(s), 3 prop def(s) on page Tag. Screenshot export of section/node 1:6025 ok (53945 bytes PNG@2x). First root fill bound to imported/tag/root/background-color/red. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:640356538`
- **lineCount:** 619

## Round-trip

Compared canvas props to `examples/carbon/contracts/tag.contract.json`.

- **MATCH axes:** Type enum → Red/Magenta/Purple/Blue/Cyan/Teal/Green/Gray/Cool Gray/Warm Gray/High Contrast/Outline, Size enum → Sm/Md/Lg, TEXT Content, first-variant fill bound: imported/tag/root/background-color/red
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/carbon/tag/receipts/pair--unset.unset__default.png
- defect: Padding/type scale / High Contrast/Outline rows not verified as matchDeveloped — fail closed.

## Re-sync

- reSyncedAt: **2026-08-07T12:10:48.663Z**
- note: Re-synced via clientStorage chunks (n=15, total=115875); amended, rebuilt 36 variants
- matchDeveloped: **false**
