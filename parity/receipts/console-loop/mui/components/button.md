# Button — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.510Z

## Generate

Button already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:287` (COMPONENT_SET on page **Button**, section `21:294`)
- **mode:** `existing`
- **variants:** 75
- **fingerprint:** `v6:437388687` (lineCount 1690)

## Screenshot

- Button COMPONENT_SET 21:287: 75 variant(s), 6 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:437388687`
- **lineCount:** 1690

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/button.contract.json`.

- **MATCH:** Variant enum → Text/Contained/Outlined; Color enum → Primary/Secondary/Error/Success/Warning/Info/Inherit; Size enum → Medium/Small/Large; BOOLEAN Disabled; TEXT Label; first-variant fill bound: imported/button/root/background-color/text/primary
- **GAPS (canvas-absent, OK):** (none)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=88.31%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/button.png`; card `parity/receipts/console-loop/mui/scores/button.json`).
