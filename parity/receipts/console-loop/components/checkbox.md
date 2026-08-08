# Checkbox — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:54:41.169Z

## Generate

Uploaded `08-checkbox.js` (76081 bytes) via `ds_loop_script` clientStorage chunks (10× ~8KB), then eval’d.

- **nodeId:** `1:510` (COMPONENT_SET on page **Checkbox**, section `1:511`)
- **variants:** 6
- **properties:** Label, Description (TEXT), Value, Size (VARIANT)

## Screenshot

Captured section `1:511`. Six checkbox rows: Unchecked/Checked/Indeterminate × Medium/Small with label + description. Box tokens and spacing look consistent. No visual defects flagged.

## Fingerprint (v6)

- **hash:** `v6:3433570960`
- **lineCount:** 234
- Sample includes Value/Size propdefs, unchecked box fill/stroke bindings to checkbox tokens, gap `space/gap/sm`.

## Round-trip

Compared canvas to `contracts/checkbox.contract.json`.

- **MATCH:** Value/Size axes, Label/Description TEXT, gap + unchecked box token bindings.
- **GAPS:** no State axis (contract empty) — OK.
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
