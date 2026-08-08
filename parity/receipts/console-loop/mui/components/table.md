# Table — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.515Z

## Generate

Table already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:744` (COMPONENT_SET on page **Table**, section `21:745`)
- **mode:** `existing`
- **variants:** 2
- **fingerprint:** `v6:966664822` (lineCount 727)

## Screenshot

- Table COMPONENT_SET 21:744: 2 variant(s), 1 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:966664822`
- **lineCount:** 727

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/table.contract.json`.

- **MATCH:** Size enum → Medium/Small
- **GAPS (canvas-absent, OK):** canvas-absent: first variant root fill not variable-bound (may be literal/slot)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** scored-pass — pctAAMasked=2.08%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/table.png`; card `parity/receipts/console-loop/mui/scores/table.json`).
