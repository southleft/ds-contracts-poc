# Banner — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.banner`  
**Recorded:** 2026-08-06T05:44:07.801Z

## Generate

Uploaded `examples/astryx/figma/banner.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3813` (COMPONENT_SET on page **Banner (astryx.banner)**, section `1:3814`)
- **variants:** 8
- **properties:** Is Dismissable#1:912, Message#1:921, Status, Container

## Screenshot

Banner COMPONENT_SET 1:3813: 8 variant(s), 4 prop def(s) on page Banner (astryx.banner). Screenshot export of section/node 1:3814 ok (24687 bytes PNG@2x). First root fill bound to color-background-blue. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:3231585800`
- **lineCount:** 144

## Round-trip

Compared canvas props to `examples/astryx/contracts/banner.contract.json`.

- **MATCH axes:** Status enum → Info/Warning/Error/Success, Container enum → Card/Section, BOOLEAN Is Dismissable, TEXT Message, first-variant fill bound: color-background-blue
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/astryx/receipts/site/Banner.png
- defect: Pastel fills improved on cream, but still dense pill chips without status icons / title+body hierarchy of developed Banner docs.
- defect: Not full-width alert banners as in examples/astryx/receipts/site/Banner.png.
