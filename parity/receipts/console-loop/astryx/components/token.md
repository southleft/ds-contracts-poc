# Token — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.token`  
**Recorded:** 2026-08-06T05:44:06.476Z

## Generate

Uploaded `examples/astryx/figma/token.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3763` (COMPONENT_SET on page **Token (astryx.token)**, section `1:3764`)
- **variants:** 33
- **properties:** Is Disabled#1:829, Label#1:863, Size, Color

## Screenshot

Token COMPONENT_SET 1:3763: 33 variant(s), 4 prop def(s) on page Token (astryx.token). Screenshot export of section/node 1:3764 ok (53972 bytes PNG@2x). First root fill bound to color-background-muted. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1746840295`
- **lineCount:** 569

## Round-trip

Compared canvas props to `examples/astryx/contracts/token.contract.json`.

- **MATCH axes:** TEXT Label, Size enum → Md/Sm/Lg, Color enum → Default/Red/Orange/Yellow/Green/Teal/Cyan/Blue/Purple/Pink/Gray, BOOLEAN Is Disabled, first-variant fill bound: color-background-muted
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: none
- defect: No developed site Token receipt — fail closed on matchDeveloped despite cream-surface contrast improvement.
