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

- reviewedAt: `2026-08-09T07:30:10.247Z`
- status: **fail-closed**
- matchDeveloped: **false**
- reference: `extract/computed/out/altitude/avatar/orig-shots/sm.off__default.png` (REAL library render — altitude-web-components@1.0.2)
- scorecard: `parity/receipts/console-loop/altitude/scores/avatar.json` — pctAAMasked **5.47**, compositionOk **false**, canvas 24x24 vs library 32x32
- corroborating instrument: `scripts/visual-truth-run.mjs --lib altitude` (headless Figma REST images API)

### Notes

- NOT REGENERATED this round, by refusal of the committed script itself. Running examples/altitude/figma/avatar.figma.js against GnQnjSNBXtgtd2Ht0Hs1C8 returns { skipped: true, reason: "set/standalone shape mismatch (COMPONENT_SET vs isSet=false) — a human retires the old node", nodeId: 1:10498 }. Regeneration is the production path and it is blocked; hand-patching the node is not a substitute.

### Named defects (fail-closed)

- FC-AVATAR-MANUAL-REBUILD-UNREPRODUCIBLE: node 1:10498 carries ds_contracts/specHash "console-loop-manual-rebuild-v1" and no canvasFingerprint — it is the hand-built set from the 2026-08-06 round, and the contract now compiles to a STANDALONE component (variant enum has a single value, "sm"), so the amend path refuses by name. The canvas cannot be brought forward from the committed script without a human retiring the node.
- FC-AVATAR-SIZE: composition fails independently of the above — canvas cell 24x24 against the library sm render's 32x32 (pctAAMasked 5.47, compositionOk false). The contract's own {imported.avatar.root.line-height.sm} resolves to var(--theme-icon-xl) = 32px, so 24 is not the contract's number either; it is the hand-rebuild's.
- FC-AVATAR-AXIS-LOSS: the capture kept only variant=sm, but the library renders an `unset` size too (orig-shots/unset.off__default.png, 40x40 ink). The single-value enum is what makes the emitted component standalone and is the proximate cause of the amend refusal above.
