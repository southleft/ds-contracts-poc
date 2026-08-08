# Card — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.511Z

## Generate

Card already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:308` (COMPONENT_SET on page **Card**, section `21:309`)
- **mode:** `existing`
- **variants:** 4
- **fingerprint:** `v6:2926211222` (lineCount 109)

## Screenshot

- Card COMPONENT_SET 21:308: 4 variant(s), 2 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2926211222`
- **lineCount:** 109

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/card.contract.json`.

- **MATCH:** Elevation enum → 1/0/3/8; TEXT Content; first-variant fill bound: imported/card/root/background-color
- **GAPS (canvas-absent, OK):** (none)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=31.48%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/card.png`; card `parity/receipts/console-loop/mui/scores/card.json`).
