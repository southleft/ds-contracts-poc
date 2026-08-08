# ListItem — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:59:03.390Z

## Generate

Uploaded `24-listitem.js` via `ds_loop_script` clientStorage chunks, then eval’d.

- **nodeId:** `1:1296` (COMPONENT on page **ListItem**, section `1:1306`)
- **variants:** 1
- **properties:** Label#1:542, Description#1:543, StartContent#1:544, Show StartContent#1:545, EndContent#1:546, Show EndContent#1:547

## Screenshot

Screenshot of section/node 1:1306 captured (ok). ListItem: 1 variant(s); type COMPONENT; page ListItem. Props: Label, Description, StartContent, Show StartContent, EndContent, Show EndContent. Sample text: "Slot", "List item", "Supporting detail for this item.", "Slot".

## Fingerprint (v6)

- **hash:** `v6:3305958002`
- **lineCount:** 55

## Round-trip

Compared canvas props to `contracts/list-item.contract.json`.

- **MATCH axes:** Label, Description
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states) — OK; canvas-absent: anatomy token channels beyond exposed component properties may live on styles/bindings — OK to note
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
