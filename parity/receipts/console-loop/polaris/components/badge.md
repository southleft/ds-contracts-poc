# Badge — polaris console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `polaris.badge`  
**Recorded:** 2026-08-06T05:47:19.080Z

## Generate

Uploaded `examples/polaris/figma/badge.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:8216` (COMPONENT_SET on page **Badge (polaris.badge)**, section `1:8217`)
- **variants:** 56
- **properties:** Tone And Progress Label Override#1:1285, Tone, Progress

## Screenshot

Badge COMPONENT_SET 1:8216: 56 variant(s), 3 prop def(s) on page Badge (polaris.badge). Screenshot export of section/node 1:8217 ok (56750 bytes PNG@2x). First root fill bound to imported/badge/root/background-color/info. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:68910415`
- **lineCount:** 2079

## Round-trip

Compared canvas props to `examples/polaris/contracts/badge.contract.json`.

- **MATCH axes:** Tone enum → info/success/warning/critical/attention/new/magic/info-strong/success-strong/warning-strong/critical-strong/attention-strong/read-only/enabled, Progress enum → none/incomplete/partiallyComplete/complete, TEXT Tone And Progress Label Override, first-variant fill bound: imported/badge/root/background-color/info
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/polaris/receipts/badge/default.png
- defect: Pill radius/padding/progress glyph fidelity vs developed badge receipts incomplete — fail closed.
