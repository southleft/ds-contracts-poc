# Banner — polaris console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `polaris.banner`  
**Recorded:** 2026-08-06T05:47:20.654Z

## Generate

Uploaded `examples/polaris/figma/banner.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:8463` (COMPONENT_SET on page **Banner (polaris.banner)**, section `1:8464`)
- **variants:** 8
- **properties:** Hide Icon#1:1342, Stop Announcements#1:1351, Show Dismissible#1:1360, Show WithAction#1:1369, Title#1:1378, Content#1:1387, Tone, State

## Screenshot

Banner COMPONENT_SET 1:8463: 8 variant(s), 8 prop def(s) on page Banner (polaris.banner). Screenshot export of section/node 1:8464 ok (101160 bytes PNG@2x). First root fill bound to p/color-bg-surface. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:75310864`
- **lineCount:** 1628

## Round-trip

Compared canvas props to `examples/polaris/contracts/banner.contract.json`.

- **MATCH axes:** TEXT Title, BOOLEAN Hide Icon, Tone enum → Info/Success/Warning/Critical, BOOLEAN Stop Announcements, BOOLEAN Show Dismissible, BOOLEAN Show WithAction, TEXT Content, first-variant fill bound: p/color-bg-surface
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/polaris/receipts/banner/tone-info.png
- defect: Warning icon / focus ring fidelity vs tone-* developed receipts — fail closed.
