# IconButton — carbon console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `carbon.iconbutton`  
**Recorded:** 2026-08-06T05:47:04.887Z

## Generate

Uploaded `examples/carbon/figma/icon-button.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:5645` (COMPONENT_SET on page **IconButton (carbon.iconbutton)**, section `1:5646`)
- **variants:** 16
- **properties:** Kind, Size

## Screenshot

IconButton COMPONENT_SET 1:5645: 16 variant(s), 2 prop def(s) on page IconButton (carbon.iconbutton). Screenshot export of section/node 1:5646 ok (9359 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1501913482`
- **lineCount:** 582

## Round-trip

Compared canvas props to `examples/carbon/contracts/iconbutton.contract.json`.

- **MATCH axes:** Kind enum → Primary/Secondary/Tertiary/Ghost, Size enum → Xs/Sm/Md/Lg
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/carbon/iconbutton/receipts/pair--primary.unset.enabled__default.png
- defect: Plus glyph placeholder only; not aesthetic match to computed iconbutton pairs — fail closed.

## Re-sync

- **reSyncedAt:** 2026-08-07T16:52:14.326Z
- **mode:** amended (rebuiltVariants=16, not skipped)
- **stored:** 111490 / 111490
- **verify:** btn-icon glyph centered in host (16/16 variants)
- matchDeveloped: **false**
