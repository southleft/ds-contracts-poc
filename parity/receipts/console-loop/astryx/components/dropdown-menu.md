# DropdownMenu — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.dropdown-menu`  
**Recorded:** 2026-08-06T05:44:14.392Z

## Generate

Uploaded `examples/astryx/figma/dropdown-menu.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:4050` (COMPONENT on page **DropdownMenu**, section `1:4062`)
- **variants:** 1
- **properties:** Has Chevron#1:1123

## Screenshot

DropdownMenu COMPONENT_SET 1:4050: 1 variant(s), 1 prop def(s) on page DropdownMenu. Screenshot export of section/node 1:4062 ok (11759 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:253339315`
- **lineCount:** 97

## Round-trip

Compared canvas props to `examples/astryx/contracts/dropdown-menu.contract.json`.

- **MATCH axes:** BOOLEAN Has Chevron
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: none
- defect: Not a COMPONENT_SET with expected item-state axes; no developed DropdownMenu site receipt — fail closed.
