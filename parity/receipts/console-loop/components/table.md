# Table — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:59:08.063Z

## Generate

Uploaded `42-table.js` via `ds_loop_script` clientStorage chunks, then eval’d.

- **nodeId:** `1:1623` (COMPONENT_SET on page **Table**, section `1:1624`)
- **variants:** 2
- **properties:** Density

## Screenshot

Spot-check: two table previews with Name/Role/Status header + 3 data rows; header fill distinct; selected/hover row tint visible; row dividers sane; no layout defects.

Screenshot of section/node 1:1624 captured (ok). Table: 2 variant(s); type COMPONENT_SET; page Table. Props: Density. First root fill bound to color/surface/raised. Sample text: "Name", "Role", "Status", "Ada Lovelace", "Engineering", "Active", "Ada Lovelace", "Engineering".

## Fingerprint (v6)

- **hash:** `v6:772848675`
- **lineCount:** 409

## Round-trip

Compared canvas props to `contracts/table.contract.json`.

- **MATCH axes:** Density
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states) — OK; canvas-absent: anatomy token channels beyond exposed component properties may live on styles/bindings — OK to note
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
