# Chip — altitude console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `altitude.chip`  
**Recorded:** 2026-08-06T05:43:13.030Z  
**Re-synced:** 2026-08-07T18:13:43.000Z

## Generate

Uploaded `examples/altitude/figma/chip.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:3017` (COMPONENT_SET on page **Chip**, section `1:3018`)
- **variants:** 20 (amended in place; added Type=Default pill variants)
- **properties:** Content#1:795, Variant, Type, State

## Re-sync (2026-08-07)

Re-uploaded `chip.figma.js` (90840 bytes, 16 chunks) via Figma Console MCP; eval amended COMPONENT_SET `1:3017` in place.

- **stored:** 90840 ✓
- **Type=Default** present (pill, 32/32/32/32 via `…/unset` tokens)
- **Type=Squared** present (4/4/4/4 via `…/squared` tokens)
- **screenshot:** `1:3017` PNG@1x (12116 bytes, 323×382)

## Screenshot

Chip COMPONENT_SET 1:3017: 20 variant(s), 4 prop def(s) on page Chip. Grid shows Default pill column (~32px radius) and Squared column (~4px radius) across Secondary/Info/Success/Warning/Danger × Default/Focus Visible.

## Fingerprint (v6)

- **hash:** `v6:2414831033`
- **lineCount:** 248

## Round-trip

Compared canvas props to `examples/altitude/contracts/chip.contract.json`.

- **MATCH axes:** Variant enum → Secondary/Info/Success/Warning/Danger, Type enum → Default + Squared, TEXT Content, first-variant fill bound: imported/chip/root/background-color/secondary
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: extract/computed/out/altitude/chip/receipts
- defect: Not verified vs altitude chip computed pairs — fail closed.

## 2026-08-08 — Track-2 hill-climb round 1

- regenerated (nodeId=60:10126). 5.12 AA, colors/sizes exact — FC-FONT-SUBSTRATE residual, fail-closed.
