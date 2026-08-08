# Chip — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.511Z

## Generate

Chip already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:410` (COMPONENT_SET on page **Chip**, section `21:411`)
- **mode:** `existing`
- **variants:** 28
- **fingerprint:** `v6:1499592056` (lineCount 652)

## Screenshot

- Chip COMPONENT_SET 21:410: 28 variant(s), 4 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:1499592056`
- **lineCount:** 652

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/chip.contract.json`.

- **MATCH:** Variant enum → Filled/Outlined; Color enum → Default/Primary/Secondary/Error/Success/Warning/Info; Size enum → Medium/Small; TEXT Label; first-variant fill bound: imported/chip/root/background-color/filled/default
- **GAPS (canvas-absent, OK):** (none)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=6.47%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/chip.png`; card `parity/receipts/console-loop/mui/scores/chip.json`).

## 2026-08-08 — FONT-SUBSTRATE round (Roboto cfg.fonts)

- reference re-pinned (offline regate, Roboto 400/500/700 data:-URI faces). 6.47 → **1.18 AA, scored-pass** on BOTH instruments (headless 1.18). Prior refs rendered the machine-local Roboto-Thin face, not Helvetica — the substrate defect was a wrong local face.
