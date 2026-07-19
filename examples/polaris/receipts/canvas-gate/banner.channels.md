# Banner — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.banner` v0.2.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/banner/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 8; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(255, 255, 255, 1)` | `rgba(255, 255, 255, 1)` | match |  |
| root | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| root | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| root | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| root | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| root | border-width | 4 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| root | border-width | 4 cells (e.g. `Tone=Info, State=Focus Visible`) | `2px` | `0px` | +2px |  |
| root | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| root | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| root | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| root | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| root | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| body | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| body | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| body | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| body | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| body | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| body | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| body | color | 8 cells (e.g. `Tone=Info`) | `rgba(48, 48, 48, 1)` | `rgba(48, 48, 48, 1)` | match |  |
| body | font-size | 8 cells (e.g. `Tone=Info`) | `13px` | `13px` | 0 |  |
| body | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| body | line-height | 8 cells (e.g. `Tone=Info`) | `20px` | `20px` | 0 |  |
| body | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| body | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| body | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| body | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
