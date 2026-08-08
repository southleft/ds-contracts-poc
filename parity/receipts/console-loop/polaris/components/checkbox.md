# Checkbox — polaris console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `polaris.checkbox`  
**Recorded:** 2026-08-06T05:47:31.032Z

## Generate

Uploaded `examples/polaris/figma/checkbox.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:10049` (COMPONENT_SET on page **Checkbox (polaris.checkbox)**, section `1:10050`)
- **variants:** 3
- **properties:** Label Hidden#1:2280, Disabled#1:2284, Aria Controls#1:2288, Aria Described By#1:2292, Name#1:2296, Value#1:2300, Label Class Name#1:2304, Checked

## Screenshot

Checkbox COMPONENT_SET 1:10049: 3 variant(s), 8 prop def(s) on page Checkbox (polaris.checkbox). Screenshot export of section/node 1:10050 ok (15541 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1753212640`
- **lineCount:** 190

## Round-trip

Compared canvas props to `examples/polaris/contracts/checkbox.contract.json`.

- **MATCH axes:** Checked enum → unchecked/checked/indeterminate, TEXT Aria Controls, TEXT Aria Described By, BOOLEAN Label Hidden, BOOLEAN Disabled, TEXT Name, TEXT Value, TEXT Label Class Name
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/polaris/receipts/checkbox/default.png
- defect: Unchecked/indeterminate geometry inverted vs Polaris checkbox; labels missing vs developed receipt.

## Contract fix (2026-08-07, re-emit)

- **backdrop** `literalsByProp` per `Checked`: unchecked = white fill + 1px `#8a8a8a` border (replaces inset box-shadow tokens that inverted on canvas); checked/indeterminate = `#303030` fill, 0 border.
- **icon-4** indeterminate minus: `fill` → `{imported.checkbox.icon-6.color}` (white on dark).
- **label** text → `Save this information` (developed receipt).
- Re-emit: `npx tsx scripts/reemit-visual-fixes.ts` (polaris `checkbox`, `radio-button`).
- `matchDeveloped` left **false** until Figma canvas re-review.
