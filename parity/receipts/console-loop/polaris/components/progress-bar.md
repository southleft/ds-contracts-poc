# ProgressBar — polaris console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `polaris.progress-bar`  
**Recorded:** 2026-08-06T05:47:31.926Z

## Generate

Uploaded `examples/polaris/figma/progress-bar.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:10076` (COMPONENT_SET on page **ProgressBar (polaris.progress-bar)**, section `1:10077`)
- **variants:** 12
- **properties:** Animated#1:2308, Progress#1:2321, Aria Labelled By#1:2334, Size, Tone

## Screenshot

ProgressBar COMPONENT_SET 1:10076: 12 variant(s), 5 prop def(s) on page ProgressBar (polaris.progress-bar). Screenshot export of section/node 1:10077 ok (12127 bytes PNG@2x). First root fill bound to p/color-bg-fill-tertiary. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:3437476105`
- **lineCount:** 201

## Round-trip

Compared canvas props to `examples/polaris/contracts/progress-bar.contract.json`.

- **MATCH axes:** TEXT Progress, Size enum → Medium/Small/Large, BOOLEAN Animated, TEXT Aria Labelled By, Tone enum → Highlight/Primary/Success/Critical, first-variant fill bound: p/color-bg-fill-tertiary
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/polaris/receipts/progress-bar/default.png
- defect: Track fills lack Polaris rounded-track fidelity vs developed progress-bar receipts — fail closed.
