# CheckboxInput — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.checkbox-input`  
**Recorded:** 2026-08-06T05:44:08.786Z

## Generate

Uploaded `examples/astryx/figma/checkbox-input.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3873` (COMPONENT_SET on page **CheckboxInput**, section `1:3874`)
- **variants:** 2
- **properties:** Is Disabled#1:982, Is Read Only#1:985, Is Required#1:988, Label#1:991, Size

## Screenshot

CheckboxInput COMPONENT_SET 1:3873: 2 variant(s), 5 prop def(s) on page CheckboxInput. Screenshot export of section/node 1:3874 ok (9626 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2853217606`
- **lineCount:** 57

## Round-trip

Compared canvas props to `examples/astryx/contracts/checkbox-input.contract.json`.

- **MATCH axes:** TEXT Label, Size enum → Md/Sm, BOOLEAN Is Disabled, BOOLEAN Is Read Only, BOOLEAN Is Required
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: none
- defect: Only Size axis; missing checked/indeterminate visual states vs typical Astryx checkbox UX.
- defect: No developed site Checkbox receipt — fail closed on matchDeveloped.
