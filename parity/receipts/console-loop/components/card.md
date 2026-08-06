# Card — console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**Recorded:** 2026-08-06T03:50:38.679Z

## Generate

Prerequisite: synced `ds.avatar` (`1:338`) then `ds.button` (`1:452`) — Card Actions preferred value requires Button. Cleared empty/partial Card leftovers, uploaded `07-card.js` (61011 bytes) via `ds_loop_script` clientStorage chunks (8× ~8KB), then eval’d.

- **nodeId:** `1:459` (COMPONENT on page **Card**, section `1:470`)
- **variants:** 1 (single component; no variant axes)
- **properties:** `Title#1:92` (TEXT), `Body#1:93` / `Actions#1:94` (INSTANCE_SWAP), `Show Actions#1:95` (BOOLEAN)

## Screenshot

Captured section `1:470`. Card shows Avatar (AB) + "Card title" header, Body slot and Actions slot placeholders, raised white surface with subtle border. Layout and composition look correct. No visual defects flagged.

## Fingerprint (v6)

- **hash:** `v6:3317660404`
- **lineCount:** 82
- Sample includes root fill/stroke bindings, radius/width/border-width bindings, propdefs, and avatar instance bindings.

## Round-trip

Compared canvas props/anatomy bindings to `contracts/card.contract.json`.

- **MATCH:** Title TEXT; Body/Actions swaps + Show Actions; avatar → ds.avatar sm; surface/border/radius/width tokens; header/body/footer inset + gap tokens.
- **GAPS (canvas-absent, OK):** no State axis; slot defaults are Slot utility; fonts via text styles.
- **MISMATCH:** none

## Acceptance

generated ✓ · screenshotReviewed ✓ · zeroMismatch ✓
