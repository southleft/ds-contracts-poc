# Badge — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:39:58.190Z

## Generate

Uploaded `04-badge.js` (62942 bytes) via `ds_loop_script` clientStorage chunks (8× ~8KB), then eval’d.

- **nodeId:** `1:309` (COMPONENT_SET on page **Badge**, section `1:310`)
- **variants:** 5
- **properties:** `Label#1:0` (TEXT), `Variant` (VARIANT)

## Screenshot

Captured section `1:310`. Five stacked pills with label “Badge”: blue / green / amber / red / red. Spacing and padding look consistent. Danger vs Error are close in hue (token-driven), not a structural defect. No visual defects flagged.

## Fingerprint (v6)

- **hash:** `v6:4215075650`
- **lineCount:** 86
- Sample includes set propdefs, per-variant fills bound to `color/feedback/{variant}/background`, layout `HORIZONTAL CENTER/CENTER … pad 4,12,4,12`, and padding/radius bindings.

## Round-trip

Compared canvas Variant options and first-variant bindings to `contracts/badge.contract.json`.

- **MATCH:** Variant axis (Info/Success/Warning/Danger/Error), Label TEXT, feedback fill + inset/radius bindings on Info.
- **GAPS (canvas-absent, OK):** no State axis; font/anatomy beyond bound fills/padding/radius not exposed as component properties.
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
