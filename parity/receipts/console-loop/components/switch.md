# Switch — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:46:01.569Z

## Generate

Uploaded `18-switch.js` (65385 bytes) via `ds_loop_script` clientStorage chunks (9× ~8KB), then eval’d.

- **nodeId:** `1:328` (COMPONENT_SET on page **Switch**, section `1:329`)
- **variants:** 2
- **properties:** `Label#1:6` (TEXT), `Description#1:9` (TEXT), `Value` (VARIANT)

## Screenshot

Captured section `1:329`. Off (gray track, thumb left) stacked above On (blue track, thumb right). Label + description present; spacing looks consistent. Thin blue fringe on On thumb treated as AA, not a defect. No visual defects flagged.

## Fingerprint (v6)

- **hash:** `v6:4045282924`
- **lineCount:** 99
- Sample includes set propdefs, Off/On track fills bound to `color/switch/{value}/track`, thumb `color/switch/thumb`, size/padding/radius bindings.

## Round-trip

Compared canvas Value options and bindings to `contracts/switch.contract.json`.

- **MATCH:** Value Off/On, Label + Description TEXT defaults, track/thumb/size/radius/gap bindings.
- **GAPS (canvas-absent, OK):** no State axis; native checkbox semantics not drawn on canvas; font via text style.
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
