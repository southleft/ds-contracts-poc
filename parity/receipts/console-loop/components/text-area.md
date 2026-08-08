# TextArea — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:59:02.492Z

## Generate

Uploaded `43-textarea.js` via `ds_loop_script` clientStorage chunks, then eval’d.

- **nodeId:** `1:1271` (COMPONENT_SET on page **TextArea**, section `1:1272`)
- **variants:** 3
- **properties:** Required#1:522, Label#1:526, Description#1:530, Placeholder#1:534, Size

## Screenshot

Screenshot of section/node 1:1272 captured (ok). TextArea: 3 variant(s); type COMPONENT_SET; page TextArea. Props: Required, Label, Description, Placeholder, Size. Sample text: "Label", "Helper text that explains the expected content.", "Write something…".

## Fingerprint (v6)

- **hash:** `v6:1681029316`
- **lineCount:** 177

## Round-trip

Compared canvas props to `contracts/text-area.contract.json`.

- **MATCH axes:** Size, Required, Label, Description, Placeholder
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states) — OK; canvas-absent: anatomy token channels beyond exposed component properties may live on styles/bindings — OK to note
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
