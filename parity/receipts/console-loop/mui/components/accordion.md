# Accordion — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.513Z

## Generate

Accordion already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:79` (COMPONENT_SET on page **Accordion**, section `21:80`)
- **mode:** `existing`
- **variants:** 4
- **fingerprint:** `v6:4119792290` (lineCount 337)

## Screenshot

- Accordion COMPONENT_SET 21:79: 4 variant(s), 3 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:4119792290`
- **lineCount:** 337

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/accordion.contract.json`.

- **MATCH:** Variant enum → Elevation/Outlined; Expanded enum → Collapsed/Expanded; BOOLEAN Disabled; first-variant fill bound: imported/accordion/root/background-color
- **GAPS (canvas-absent, OK):** (none)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** fail-closed — pctAAMasked=6.80%, compositionOk=False (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/accordion.png`; card `parity/receipts/console-loop/mui/scores/accordion.json`).

## 2026-08-09 — CROSS-PLANE ROUND: 94.63 → 2.88, and FC-REF-WRONG-VARIANT died on re-measurement

**Scored pass, BOTH instruments, against the real library:** lane scorer `pctAAMasked=2.88`
(`parity/receipts/console-loop/mui/scores/accordion.json`) and headless REST visual-truth card `2.88`
(`parity/receipts/console-loop/visual-truth/mui/accordion.json`, cell `21:39`
"Variant=Elevation, Expanded=Collapsed", fileVersion 2384477865735882405). 290x50 vs 290x50.

**Two prior defects retired, both because they were facts about the CONTRACT render, not the library:**

1. **Cross-plane pin.** The reference was `elevation.collapsed.disabled__default`; the set binds
   `disabled` as a Figma BOOLEAN property, so no cell in it is disabled. Re-pinned to the base plane by
   `scripts/console-loop-ref-plane-probe.mts --repin`.
2. **FC-REF-WRONG-VARIANT is REFUTED.** The receipt claimed no correctly-collapsed MUI accordion
   reference existed — that `elevation.collapsed` ink was 290x89 and included the details paragraph.
   That was measured on `gate-shots/` (the contract render). The **library** render
   `orig-shots/elevation.collapsed.enabled__default.png` is a correctly collapsed 290x50 header, which is
   exactly the canvas cell's box. The harness honours the `Expanded` axis; the emitter did not.

**Unmeasured, named:** the `disabled` plane, identically to `checkbox` — see `visual.unmeasured`.
