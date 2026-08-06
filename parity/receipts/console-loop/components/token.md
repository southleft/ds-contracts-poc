# Token — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:59:01.580Z

## Generate

Uploaded `46-token.js` via `ds_loop_script` clientStorage chunks, then eval’d.

- **nodeId:** `1:1238` (COMPONENT_SET on page **Token**, section `1:1239`)
- **variants:** 33
- **properties:** Disabled#1:318, Label#1:352, Icon#1:386, Show Icon#1:420, EndContent#1:454, Show EndContent#1:488, Color, Size

## Screenshot

Spot-check: dense Color×Size matrix of pill tokens with Label + dashed Slot placeholders; semantic color rows (default/danger/warning/…); consistent radius and slot anatomy; no visual defects.

Screenshot of section/node 1:1239 captured (ok). Token: 33 variant(s); type COMPONENT_SET; page Token. Props: Disabled, Label, Icon, Show Icon, EndContent, Show EndContent, Color, Size. First root fill bound to color/token/default/background. Sample text: "Slot", "Token", "Slot".

## Fingerprint (v6)

- **hash:** `v6:65099164`
- **lineCount:** 1431

## Round-trip

Compared canvas props to `contracts/token.contract.json`.

- **MATCH axes:** Color, Size, Disabled, Label
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states) — OK; canvas-absent: anatomy token channels beyond exposed component properties may live on styles/bindings — OK to note
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
