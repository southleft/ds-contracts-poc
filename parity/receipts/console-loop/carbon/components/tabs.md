# Tabs — carbon console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `carbon.tabs`  
**Recorded:** 2026-08-06T05:47:07.520Z

## Generate

Uploaded `examples/carbon/figma/tabs.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:5947` (COMPONENT_SET on page **Tabs**, section `1:5950`)
- **variants:** 3
- **properties:** State

## Screenshot

Tabs COMPONENT_SET 1:5947: 3 variant(s), 1 prop def(s) on page Tabs. Screenshot export of section/node 1:5950 ok (14876 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:3251309082`
- **lineCount:** 271

## Round-trip

Compared canvas props to `examples/carbon/contracts/tabs.contract.json`.

- **MATCH axes:** n/a
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/carbon/tabs/receipts/pair--__default.png
- defect: Label truncation and missing Carbon selected underline/bar treatment vs computed tabs pairs.

## Re-sync

- **reSyncedAt:** 2026-08-07T16:52:14.326Z
- **mode:** amended (rebuiltVariants=3, not skipped)
- **stored:** 85367 / 85367
- **verify:** all 9 `*label-wrapper*` clipsContent=false; Overview/Activity/Settings intact
- matchDeveloped: **false**
