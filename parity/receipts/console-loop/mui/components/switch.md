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

## 2026-08-09 — CROSS-PLANE ROUND: 23.44 → 10.89, still an honest fail

Reference re-pinned off the unexpressible `disabled` plane onto
`orig-shots/default.medium.checked.enabled__default.png` by
`scripts/console-loop-ref-plane-probe.mts --repin`. Both instruments agree at **10.89** (lane scorer
`scores/switch.json`; headless REST `visual-truth/mui/switch.json`, cell `21:612`
"Color=Default, Size=Medium, Checked=Checked", fileVersion 2384477865735882405). The bar is 5, so this
stays **fail-closed** — the prior 23.44 is void, not improved.

The residual is geometry and paint inside a correctly-identified variant: canvas 37x22 vs library 38x19.

**RETRACTED from this receipt:** "the MUI harness emits BYTE-IDENTICAL gate-shots for .enabled and
.disabled on switch, accordion and checkbox … so the disabled/enabled token carries no information here."
The byte-identity is real and verified — but it is a property of the **contract renders**. Every
`orig-shots` enabled/disabled pair for switch (all 16), accordion (all 4), checkbox (all 3) and radio
**differs**. The old basis could not see the difference; that is what it was blind to.

**Unmeasured, named:** the `disabled` plane — see `visual.defects`.
