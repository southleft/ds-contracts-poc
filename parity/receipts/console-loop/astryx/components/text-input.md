# TextInput — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.text-input`  
**Recorded:** 2026-08-06T05:44:12.948Z

## Generate

Uploaded `examples/astryx/figma/text-input.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:4003` (COMPONENT_SET on page **TextInput**, section `1:4004`)
- **variants:** 9
- **properties:** Is Required#1:1056, Is Disabled#1:1066, Has Clear#1:1076, Label#1:1086, Placeholder#1:1096, Type, Size

## Screenshot

TextInput COMPONENT_SET 1:4003: 9 variant(s), 7 prop def(s) on page TextInput. Screenshot export of section/node 1:4004 ok (45230 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1777886922`
- **lineCount:** 281

## Round-trip

Compared canvas props to `examples/astryx/contracts/text-input.contract.json`.

- **MATCH axes:** Type enum → Text/Password/Email, TEXT Label, Size enum → Md/Sm/Lg, TEXT Placeholder, BOOLEAN Is Required, BOOLEAN Is Disabled, BOOLEAN Has Clear
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/astryx/receipts/site/TextInput.png
- defect: Missing light-gray border / leading-icon treatments shown in TextInput docs.
- defect: Placeholder hierarchy not demonstrated vs examples/astryx/receipts/site/TextInput.png.
