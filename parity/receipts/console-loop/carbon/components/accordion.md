# Accordion — carbon console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `carbon.accordion`  
**Recorded:** 2026-08-06T05:47:02.201Z

## Generate

Uploaded `examples/carbon/figma/accordion.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:5365` (COMPONENT_SET on page **Accordion**, section `1:5366`)
- **variants:** 8
- **properties:** Align, Size, State

## Screenshot

Accordion COMPONENT_SET 1:5365: 8 variant(s), 3 prop def(s) on page Accordion. Screenshot export of section/node 1:5366 ok (77705 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1242425722`
- **lineCount:** 543

## Round-trip

Compared canvas props to `examples/carbon/contracts/accordion.contract.json`.

- **MATCH axes:** Align enum → End/Start, Size enum → Sm/Md/Lg
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/carbon/accordion/receipts/pair--end.unset.enabled__default.png
- defect: Missing expanded body panel aesthetic vs Carbon accordion developed pairs.

## Re-sync

- reSyncedAt: **2026-08-07T12:10:48.663Z**
- note: Re-synced via clientStorage chunks (n=14, total=111012); amended, rebuilt 8 variants
- matchDeveloped: **false**
