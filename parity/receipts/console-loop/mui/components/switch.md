# Switch — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.511Z

## Generate

Switch already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:624` (COMPONENT_SET on page **Switch**)
- **mode:** `existing`
- **variants:** 28
- **fingerprint:** `v6:2381775060` (lineCount 1465)

## Screenshot

- Switch COMPONENT_SET 21:624: 28 variant(s), 5 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2381775060`
- **lineCount:** 1465

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/switch.contract.json`.

- **MATCH:** Color enum → Primary/Secondary/Error/Warning/Info/Success/Default; Size enum → Medium/Small; Checked enum → Unchecked/Checked; BOOLEAN Disabled
- **GAPS (canvas-absent, OK):** canvas-absent: first variant root fill not variable-bound (may be literal/slot)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=49.88%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/switch.png`; card `parity/receipts/console-loop/mui/scores/switch.json`).
