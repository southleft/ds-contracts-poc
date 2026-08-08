# DropdownMenuItem — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.dropdown-menu-item`  
**Recorded:** 2026-08-06T05:44:09.106Z

## Generate

Uploaded `examples/astryx/figma/dropdown-menu-item.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3876` (COMPONENT on page **DropdownMenuItem**, section `1:3878`)
- **variants:** 1
- **properties:** Is Disabled#1:994, Label#1:995

## Screenshot

DropdownMenuItem COMPONENT_SET 1:3876: 1 variant(s), 2 prop def(s) on page DropdownMenuItem. Screenshot export of section/node 1:3878 ok (3924 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2766064663`
- **lineCount:** 19

## Round-trip

Compared canvas props to `examples/astryx/contracts/dropdown-menu-item.contract.json`.

- **MATCH axes:** TEXT Label, BOOLEAN Is Disabled
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: none
- defect: Not a COMPONENT_SET; missing hover/selected/destructive variants; no developed site reference — fail closed.
