# Badge — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T05:22:31.359Z

## Generate

Generated via `examples/mui/figma/badge.figma.js` chunk upload + eval.

- **nodeId:** `84:2376` (COMPONENT_SET on page **Badge**, section `84:2377`)
- **mode:** `generated`
- **variants:** 14
- **fingerprint:** `v6:3419500101` (lineCount 398)

## Screenshot

Screenshot reviewed on section/node 84:2377; structure/variants look sane (slot placeholders OK).

## Fingerprint (v6)

- **hash:** `v6:3419500101`
- **lineCount:** 398

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/badge.contract.json`.

- **MATCH:** Color enum → Default/Primary/Secondary/Error/Info/Success/Warning; Variant enum → Standard/Dot
- **GAPS (canvas-absent, OK):** canvas-absent: first variant root fill not variable-bound (may be literal/slot)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=54.00%, compositionOk=False (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/badge.png`; card `parity/receipts/console-loop/mui/scores/badge.json`).
