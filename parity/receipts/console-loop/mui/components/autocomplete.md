# Autocomplete — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.513Z

## Generate

Autocomplete already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:134` (COMPONENT_SET on page **Autocomplete**, section `21:135`)
- **mode:** `existing`
- **variants:** 2
- **fingerprint:** `v6:1521385897` (lineCount 345)

## Screenshot

- Autocomplete COMPONENT_SET 21:134: 2 variant(s), 1 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1521385897`
- **lineCount:** 345

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/autocomplete.contract.json`.

- **MATCH:** Size enum → Medium/Small
- **GAPS (canvas-absent, OK):** canvas-absent: first variant root fill not variable-bound (may be literal/slot)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=8.48%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/autocomplete.png`; card `parity/receipts/console-loop/mui/scores/autocomplete.json`).

## 2026-08-08 — FONT-SUBSTRATE round (Roboto cfg.fonts)

- reference re-pinned (offline regate, Roboto 400/500/700 data:-URI faces). 8.48 → 8.14 AA lane / 8.14 headless — still fail-closed; the glyph substrate is no longer the named cause.
