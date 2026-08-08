# ProgressBar — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.progress-bar`  
**Recorded:** 2026-08-06T05:44:09.675Z  
**Re-synced:** 2026-08-06T14:49:52.752Z

## Generate

Re-uploaded `examples/astryx/figma/progress-bar.figma.js` via `ds_loop_script` clientStorage chunks (72214 chars, djb2 verified), then eval’d. In-place amend on existing set.

- **nodeId:** `1:3900` (COMPONENT_SET on page **ProgressBar (astryx.progress-bar)**, section `1:3901`)
- **variants:** 5 (rebuilt)
- **properties:** Is Indeterminate, Is Disabled, Value, Max, Label, Variant
- **fingerprint:** `v6:1229328490`

## Screenshot

ProgressBar COMPONENT_SET `1:3900`: track width 240px with fill/meter (~96px / 40%) present across Accent/Success/Warning/Neutral/Error. Capture via `figma_capture_screenshot` ok.

## Fingerprint (v6)

- **hash:** `v6:1229328490`

## Round-trip

Compared canvas props to `examples/astryx/contracts/progress-bar.contract.json`.

- **MATCH axes:** TEXT Value, TEXT Max, TEXT Label, Variant enum → Accent/Success/Warning/Neutral/Error, BOOLEAN Is Indeterminate, BOOLEAN Is Disabled
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T14:49:52.752Z`
- matchDeveloped: **false**
- reference: none
- defect: re-synced from contract; developed score pending
