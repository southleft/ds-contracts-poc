# Avatar — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:48:31.671Z

## Generate

Uploaded `03-avatar.js` (59412 bytes) via `ds_loop_script` clientStorage chunks (8× ~8KB), then eval’d.

- **nodeId:** `1:338` (COMPONENT_SET on page **Avatar**, section `1:339`)
- **variants:** 2
- **properties:** `Initials#1:12` (TEXT), `Size` (VARIANT)

## Screenshot

Captured section `1:339`. Two stacked circular avatars with initials “AB”: Small above Medium. Identity blue fill + dark initials; spacing and centering look consistent. No visual defects flagged.

## Fingerprint (v6)

- **hash:** `v6:1787641672`
- **lineCount:** 34
- Sample includes set propdefs, Size=Small fill bound to `color/identity/background`, layout `HORIZONTAL CENTER/CENTER`, and width/height/radius bindings.

## Round-trip

Compared canvas Size options and first-variant bindings to `contracts/avatar.contract.json`.

- **MATCH:** Size axis (Small/Medium), Initials TEXT, identity fill + size/radius bindings, text fill `color/identity/foreground`.
- **GAPS (canvas-absent, OK):** no State axis; font family/weight/size token channels not all exposed as component properties.
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
