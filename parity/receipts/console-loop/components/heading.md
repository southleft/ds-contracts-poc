# Heading — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:58:57.762Z

## Generate

Uploaded `21-heading.js` via `ds_loop_script` clientStorage chunks, then eval’d.

- **nodeId:** `1:947` (COMPONENT_SET on page **Heading**, section `1:948`)
- **variants:** 18
- **properties:** Text#1:285, Level, Size

## Screenshot

Spot-check: 6×3 Level×Size grid of “Heading” on light canvas; sizes step down H1→H6; columns read as Size Small/Medium/Large; spacing consistent; no layout defects.

Screenshot of section/node 1:948 captured (ok). Heading: 18 variant(s); type COMPONENT_SET; page Heading. Props: Text, Level, Size. Sample text: "Heading".

## Fingerprint (v6)

- **hash:** `v6:822703176`
- **lineCount:** 151

## Round-trip

Compared canvas props to `contracts/heading.contract.json`.

- **MATCH axes:** Level, Size, Text
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states) — OK; canvas-absent: anatomy token channels beyond exposed component properties may live on styles/bindings — OK to note
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
