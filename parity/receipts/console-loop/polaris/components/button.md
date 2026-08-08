# Button — polaris console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `polaris.button`  
**Recorded:** 2026-08-06T05:47:30.153Z

## Generate

Uploaded `examples/polaris/figma/button.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:10006` (COMPONENT_SET on page **Button (polaris.button)**, section `1:10017`)
- **variants:** 220
- **properties:** Full Width#1:1396, Remove Underline#1:1617, Data Primary Link#1:1838, Show WithIcon#1:2059, Size, Text Align, Tone, Variant, State

## Screenshot

Button COMPONENT_SET 1:10006: 220 variant(s), 9 prop def(s) on page Button (polaris.button). Screenshot export of section/node 1:10017 ok (179301 bytes PNG@2x). First root fill bound to imported/button/root/background-color/secondary/critical. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:3705147195`
- **lineCount:** 9134

## Round-trip

Compared canvas props to `examples/polaris/contracts/button.contract.json`.

- **MATCH axes:** Size enum → Medium/Micro/Slim/Large, Text Align enum → Center/Left/Right/Start/End, BOOLEAN Full Width, BOOLEAN Remove Underline, BOOLEAN Data Primary Link, Tone enum → Critical/Success, Variant enum → Secondary/Plain/Primary/Tertiary/Monochrome Plain, BOOLEAN Show WithIcon, first-variant fill bound: imported/button/root/background-color/secondary/critical
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/polaris/receipts/button/variant-primary.png; examples/polaris/contracts/button.contract.json
- defect: Contract tone enum is only critical|success — no undefined/default Tone, so dark Polaris Primary (examples/polaris/receipts/button/variant-primary.png) cannot be projected.
- defect: Primary+Critical is flat red without Polaris top-highlight gradient of developed primary receipts.
- defect: Emit/contract gap, not an intentional COMPILE canvas projection.
