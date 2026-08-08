# Tabs — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.512Z

## Generate

Tabs already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:807` (COMPONENT_SET on page **Tabs**, section `21:808`)
- **mode:** `existing`
- **variants:** 6
- **fingerprint:** `v6:2607696146` (lineCount 508)

## Screenshot

- Tabs COMPONENT_SET 21:807: 6 variant(s), 2 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:2607696146`
- **lineCount:** 508

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/tabs.contract.json`.

- **MATCH:** Text color enum → Primary/Secondary/Inherit; Indicator color enum → Primary/Secondary
- **GAPS (canvas-absent, OK):** canvas-absent: first variant root fill not variable-bound (may be literal/slot)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=10.19%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/tabs.png`; card `parity/receipts/console-loop/mui/scores/tabs.json`).

## 2026-08-08 — FONT-SUBSTRATE round (Roboto cfg.fonts)

- reference re-pinned (offline regate, Roboto 400/500/700 data:-URI faces). 10.19 → 11.74 AA lane / 9.99 headless — still fail-closed; the glyph substrate is no longer the named cause.
