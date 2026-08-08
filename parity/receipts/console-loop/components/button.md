# Button — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:53:58.768Z

## Generate

Button COMPONENT_SET already present from Card prerequisite sync (`05-button.js` via `ds_loop_script` clientStorage). This session completed receipt evidence only (no re-upload).

- **nodeId:** `1:452` (COMPONENT_SET on page **Button**, section `1:457`)
- **variants:** 24
- **properties:** Disabled (BOOLEAN), Loading (BOOLEAN), Label (TEXT), Variant, Size, State

## Screenshot

Captured section `1:457`. Grid of 24 buttons: Primary/Secondary/Danger/Ghost × sizes and Hover/Focus Visible/Disabled previews. Focus ring and disabled fade read correctly. No visual defects flagged.

## Fingerprint (v6)

- **hash:** `v6:2550751704`
- **lineCount:** 638
- Sample includes set propdefs, Primary Medium Default fill bound to `color/action/primary/background`, layout `HORIZONTAL CENTER/CENTER gap 8 pad 8,16,8,16`, and padding/radius bindings.

## Round-trip

Compared canvas axes and first-variant bindings to `contracts/button.contract.json`.

- **MATCH:** Variant/Size/State axes, Label/Disabled/Loading props, primary fill + inset/radius bindings.
- **GAPS (canvas-absent, OK):** loading indicator not a separate axis; Size option order differs from contract enum order (membership match).
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
