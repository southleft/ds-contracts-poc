# Avatar — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.avatar`  
**Recorded:** 2026-08-06T05:49:25.504Z

## Generate

1. Patched `/tmp/altitude-avatar-fixed.figma.js` (try/catch around `stroke*Weight`) generated a collapsed ~0×0 component (`minWidth/minHeight` → `imported/shared/size-0`).
2. Rebuilt a minimal **COMPONENT_SET** via `figma_execute`: `Variant=Sm`, TEXT Content, BOOLEAN Show HasBadge, 24×24 with `imported/avatar/root/width|height/sm` bindings.

- **nodeId:** `1:10498` (COMPONENT_SET on page **Avatar (altitude.avatar)**, section `1:10493`)
- **variants:** 1
- **properties:** Content#1:3002, Show HasBadge#1:3003, Variant

## Screenshot

Manual rebuild COMPONENT_SET 1:10498: 1 variant(s), 3 prop def(s) on page Avatar (altitude.avatar). 24×24 Sm avatar with Content TEXT + Show HasBadge BOOLEAN; width/height bound to imported/avatar/root/*/sm. Screenshot export of section 1:10493 ok (9435 bytes PNG@2x). Generator script collapsed to ~0×0 via size-0 min bindings + strokeTopWeight; replaced with minimal contract-faithful set.

## Fingerprint (v6)

- **hash:** `v6:923243794`
- **lineCount:** 30

## Round-trip

Compared canvas props to `examples/altitude/contracts/avatar.contract.json`.

- **MATCH axes:** Variant enum → Sm, BOOLEAN Show HasBadge, TEXT Content, first-variant fill bound: imported/avatar/root/background-color, width bound: imported/avatar/root/width/sm, height bound: imported/avatar/root/height/sm
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/altitude/avatar/receipts
- defect: Set collapsed to 24×24 single variant — not match to developed altitude avatar scale — fail closed.
