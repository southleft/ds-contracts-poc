# F1 · Chakra Switch — a capture made today, then the one command

This is the held-out test of docs/36 end to end. Chakra's Switch had never
been captured. The person's step was two files: a seed contract
(`examples/chakra/contracts-seed/switch.contract.json`) and a component entry
in `extract/computed/configs/chakra.json` naming the composition from the
package's own exports (SwitchRoot ⊃ SwitchHiddenInput, SwitchControl ⊃
SwitchThumb, SwitchLabel) — the one input the reader cannot draft from a
capture, because it makes the capture. Then:

    npm run extract:computed -- --harness examples/chakra/.chakra-sandbox \
      --config extract/computed/configs/chakra.json --component Switch \
      --out extract/computed/out/chakra --keep-originals
    npm run recipe:point -- --archetype switch --library chakra

The capture: 16 combos, byte-equal on a second sweep, 16 real-library
screenshots kept. The proposal: **33 leaves read, 0 reviewed, 1 archetype
spelling, 0 invented** — a labelled control, so the label path of the
proposer is measured here too (Inter Medium 14px, text "Enable").

Two things the reader learned on the way, both general CSS:

- **`color(srgb r g b / a)`.** Chakra's shadow tokens arrive as CSS Color 4
  `color()` functions; sRGB is read exactly, any other colour space refuses
  by name.
- **A CSS-scaled thumb.** The thumb is a 20×20 box with `scale: 0.8`. The
  first mint (v11) carried 20 and scored 9.35%: the thumb filled the track and
  its shadow tail crossed the crop threshold. The schema now lowers the
  scale: size = width × scale (16), the thumb's inset = width × (1 − scale) / 2
  (2px, added to padding and border), every shadow length × scale, and the
  translate untouched (it is applied in the parent's space). The hand-written
  MUI and AntD switches re-derive unchanged through the same formulas.

## Scores (bar 5% AA-masked) — switch v12, page `218:88804`

| state | AA masked | ink canvas / real |
|---|---|---|
| unchecked.enabled | **0.00%** | 65.8 / 65.7 |
| checked.enabled | **0.00%** | 69.5 / 69.0 |
| unchecked.disabled | **0.00%** | 67.1 / 66.5 |
| checked.disabled | **0.00%** | 69.5 / 69.0 |

Four of four states pixel-identical to the package's own Chromium render.

## Files

- `canvas-<state>.png`, `score-<state>.json`, `score-<state>.diff.png`
- the proposal: `recipe/evidence/pointed/switch-chakra/`
