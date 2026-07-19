# Spinner — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.spinner` v0.2.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/spinner/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 2; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | `Size=Large`, `Size=Small` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| root | border-bottom-left-radius | `Size=Large`, `Size=Small` | `0px` | `0px` | 0 |  |
| root | border-bottom-right-radius | `Size=Large`, `Size=Small` | `0px` | `0px` | 0 |  |
| root | border-top-left-radius | `Size=Large`, `Size=Small` | `0px` | `0px` | 0 |  |
| root | border-top-right-radius | `Size=Large`, `Size=Small` | `0px` | `0px` | 0 |  |
| root | border-width | `Size=Large`, `Size=Small` | `0px` | `0px` | 0 |  |
| root | gap | `Size=Large`, `Size=Small` | `0px` | `normal` | 0 |  |
| root | padding-bottom | `Size=Large`, `Size=Small` | `0px` | `0px` | 0 |  |
| root | padding-left | `Size=Large`, `Size=Small` | `0px` | `0px` | 0 |  |
| root | padding-right | `Size=Large`, `Size=Small` | `0px` | `0px` | 0 |  |
| root | padding-top | `Size=Large`, `Size=Small` | `0px` | `0px` | 0 |  |
