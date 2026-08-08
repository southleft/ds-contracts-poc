# Card — astryx console-loop receipt

**Status:** completed  
**File:** `GnQnjSNBXtgtd2Ht0Hs1C8` (DS Contracts Testing)  
**contractId:** `astryx.card`  
**Recorded:** 2026-08-06T05:44:13.994Z

## Generate

Uploaded `examples/astryx/figma/card.figma.js` via `ds_loop_script` clientStorage chunks (`/run-script` on bridge :9228), then eval’d.

- **nodeId:** `1:4047` (COMPONENT_SET on page **Card (astryx.card)**, section `1:4048`)
- **variants:** 13
- **properties:** Body#1:1109, Variant

## Screenshot

Card COMPONENT_SET 1:4047: 13 variant(s), 2 prop def(s) on page Card (astryx.card). Screenshot export of section/node 1:4048 ok (72910 bytes PNG@2x). First root fill bound to imported/card/root/background-color/default. Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:3092228042`
- **lineCount:** 292

## Round-trip

Compared canvas props to `examples/astryx/contracts/card.contract.json`.

- **MATCH axes:** Variant enum → Default/Transparent/Muted/Blue/Cyan/Gray/Green/Orange/Pink/Purple/Red/Teal/Yellow, TEXT Body, first-variant fill bound: imported/card/root/background-color/default
- **GAPS:** canvas-absent: no State axis (contract has empty/absent states)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

## Visual match (developed)

- reviewedAt: `2026-08-06T13:32:20.271Z`
- matchDeveloped: **false**
- reference: examples/astryx/receipts/site/Card.png
- defect: Color variants still lack developed title/body hierarchy and elevation/border cues from Card docs.
- defect: Body-only placeholder aesthetic — fail closed.
