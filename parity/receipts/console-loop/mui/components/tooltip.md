# Tooltip — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.514Z

## Generate

Tooltip already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:810` (COMPONENT on page **Tooltip**, section `21:814`)
- **mode:** `existing`
- **variants:** 1
- **fingerprint:** `v6:1221797663` (lineCount 34)

## Screenshot

- Tooltip COMPONENT 21:810: 1 variant(s), 1 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1221797663`
- **lineCount:** 34

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/tooltip.contract.json`.

- **MATCH:** BOOLEAN Show Arrow
- **GAPS (canvas-absent, OK):** canvas-absent: first variant root fill not variable-bound (may be literal/slot)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=23.47%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/tooltip.png`; card `parity/receipts/console-loop/mui/scores/tooltip.json`).

## 2026-08-08 — FONT-SUBSTRATE round (Roboto cfg.fonts)

- re-pin REFUSED: current-tree regate renders a drifted tooltip (cells 129→121, clipped bubble) while core/emit-* is mid-flight in a sibling workflow; ref keeps its committed pin, 23.47 AA, FC-FONT-SUBSTRATE stays open here.
