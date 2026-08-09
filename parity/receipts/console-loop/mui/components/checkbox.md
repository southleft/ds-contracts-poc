# Checkbox — MUI console-loop receipt

**Status:** completed  
**File:** `59mLQlOMiD5w5za6SUcoO5` (MUI Test 1)  
**Recorded:** 2026-08-06T04:51:10.514Z

## Generate

Checkbox already on canvas; receipt completed via inspect/screenshot/fingerprint/round-trip (no re-generate).

- **nodeId:** `21:323` (COMPONENT_SET on page **Checkbox**, section `21:324`)
- **mode:** `existing`
- **variants:** 3
- **fingerprint:** `v6:820111622` (lineCount 84)

## Screenshot

- Checkbox COMPONENT_SET 21:323: 3 variant(s), 2 prop def(s). Structure looks sane; slot placeholders OK.

## Fingerprint (v6)

- **hash:** `v6:820111622`
- **lineCount:** 84

## Round-trip

Compared canvas axes/prop defs to `examples/mui/contracts/checkbox.contract.json`.

- **MATCH:** Checked enum → Unchecked/Checked/Indeterminate; BOOLEAN Disabled
- **GAPS (canvas-absent, OK):** canvas-absent: first variant root fill not variable-bound (may be literal/slot)
- **MISMATCH:** none

## Acceptance

generatedOrFound ✓ · screenshotReviewed ✓ · zeroMismatch ✓

**2026-08-08 pixel scorecard (strict-lane conversion):** scored-pass — pctAAMasked=0.00%, compositionOk=True (headless REST cell @1x vs committed developed ref `parity/receipts/console-loop/mui/refs/checkbox.png`; card `parity/receipts/console-loop/mui/scores/checkbox.json`).

## 2026-08-09 — CROSS-PLANE ROUND: the 81.48 was the instrument, and the disabled plane is real but was never what it measured

**Scored pass, BOTH instruments, against the real library:** lane scorer `pctAAMasked=0.00`
(`parity/receipts/console-loop/mui/scores/checkbox.json`) and headless REST visual-truth card `0.00`
(`parity/receipts/console-loop/visual-truth/mui/checkbox.json`, cell `21:315` "Checked=Checked",
fileVersion 2384477865735882405). 18x18 vs 18x18, inkDelta 0.

**What the 81.48 was.** The reference was pinned to
`extract/computed/out/mui/checkbox/orig-shots/checked.disabled__default.png`. The canvas set carries the
axis `Checked` and a Figma **BOOLEAN** property `Disabled`; no cell in it is disabled, so
`visual-truth-run.mjs`'s `chooseCell` matched only the token `checked` and returned the ENABLED cell.
The pair therefore named two different points in prop space, and its `pctAAMasked` measured the state
plane, not fidelity. The pin itself came from `pickGateShot`, which returns the alphabetically first
`*__default.png` in the capture dir — and "disabled" sorts before "enabled".

Re-pinned to the base plane by `scripts/console-loop-ref-plane-probe.mts --repin` (deterministic and
score-blind: the target is computed from `extract/computed/configs/mui.json` `stateProps` plus the
contract's own Figma binding kind, never from a score) the SAME canvas cell scores **0.00** against
`@mui/material@9.2.0`.

**The disabled plane is still a real, named gap** — carried in `visual.unmeasured`, not closed:

- `gate-shots/checked.enabled__default.png` and `gate-shots/checked.disabled__default.png` are
  **byte-identical by sha256**, while the library's `orig-shots` pair **differs** (`25,118,210` vs
  `189,189,189`). The contract render never painted the plane either — which is exactly why the pre-
  `orig-shots` basis scored this stem 0.00 while both renders were the enabled picture.
- The contract DOES carry the colour: `states.disabled.color = {imported.shared.color-00000042}` on both
  `root` and `icon` (`#00000042` = `rgba(0,0,0,.26)` = `189,189,189` flattened on white — precisely the
  library's paint). **Capture/promote is clean.**
- `core/emit-html.ts` lowers it to `.checkbox:disabled { color: var(--imported-shared-color-00000042) }`,
  a pseudo-class that can never match the emitted `<span>` root, and `extract/computed/gate.ts:367`
  admits this at capture time by stamping `data-gate-disabled-unsupported` when the root has no
  `disabled` IDL attribute.
- `core/emit-figma-script.ts` compiles no `State=` axis because the contract sets no
  `figmaStatePreviews`, and a Figma BOOLEAN property cannot repaint a fill.

Closing it needs a canvas write (a `State=` axis) on `59mLQlOMiD5w5za6SUcoO5`, which was **not**
connected to the Desktop Bridge this round (`figma_list_open_files` reported only
`GnQnjSNBXtgtd2Ht0Hs1C8`, `BMjUA2ue5CaZXU4kufxL0z`, `HherkaLt11JSCFJVAoyWlO`).
