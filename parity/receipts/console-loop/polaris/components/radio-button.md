# RadioButton — polaris console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `polaris.radio-button`  
**Recorded:** 2026-08-06T05:47:32.776Z

## Generate

Uploaded `examples/polaris/figma/radio-button.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:10096` (COMPONENT_SET on page **RadioButton**, section `1:10097`)
- **variants:** 2
- **properties:** Label Hidden#1:2347, Disabled#1:2350, Aria Described By#1:2353, Name#1:2356, Value#1:2359, Checked

## Screenshot

RadioButton COMPONENT_SET 1:10096: 2 variant(s), 6 prop def(s) on page RadioButton. Screenshot export of section/node 1:10097 ok (13453 bytes PNG@2x). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2212519889`
- **lineCount:** 115

## Round-trip

Compared canvas props to `examples/polaris/contracts/radio-button.contract.json`.

- **MATCH axes:** TEXT Aria Described By, BOOLEAN Label Hidden, Checked enum → unchecked/checked, BOOLEAN Disabled, TEXT Name, TEXT Value
- **GAPS:** none
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/polaris/receipts/radio-button/default.png
- defect: Unchecked solid white disk / checked ring inverted vs Polaris radio outline+dot; labels missing.

## Contract fix (2026-08-07, re-emit)

- **backdrop** `literalsByProp` per `Checked`: unchecked = white fill + 1px `#8a8a8a` ring; checked = `#303030` fill + matching 1px ring; **backdrop-before** white 10×10 ellipse at `absolute` left 4 / top 4 (checked only).
- Re-emit: `npx tsx scripts/reemit-visual-fixes.ts` (polaris `checkbox`, `radio-button`).
- `matchDeveloped` left **false** until Figma canvas re-review.
