# Checkbox — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.checkbox` v0.2.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/checkbox/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 0; cells with no captured combo (axis value or state the
computed sweep never mounted): 5. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

Notes:
- mounted labelHidden: the contract anatomy carries no label part (input+backdrop only), so the real mount is scoped to the anatomy the canvas draws — named alignment, not a fudge.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
