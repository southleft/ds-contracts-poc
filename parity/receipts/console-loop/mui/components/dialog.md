# Dialog — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.514Z

## Generate

Dialog already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:448` (COMPONENT_SET on page **Dialog**, section `21:449`)
- **mode:** `existing`
- **variants:** 5
- **fingerprint:** `v6:915053960` (lineCount 221)

## Screenshot

- Dialog COMPONENT_SET 21:448: 5 variant(s), 2 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:915053960`
- **lineCount:** 221

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/dialog.contract.json`.

- **MATCH:** Max width enum → Sm/Xs/Md/Lg/Xl; TEXT Content
- **GAPS (canvas-absent, OK):** canvas-absent: first variant root fill not variable-bound (may be literal/slot)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=51.68%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/dialog.png`; card `parity/receipts/console-loop/mui/scores/dialog.json`).
