# ProgressBar — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.progress-bar` v0.3.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/progressbar/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 12; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

Notes:
- mounted in a 288px container (floor stage content width): the real track is width:100% and collapses in a max-content stage; the canvas root is runtime-sized — width deltas are the named runtime-% cause.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `rgba(227, 227, 227, 1)` | `rgba(227, 227, 227, 1)` | match |  |
| root | border-bottom-left-radius | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `4px` | `4px` | 0 |  |
| root | border-bottom-right-radius | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `4px` | `4px` | 0 |  |
| root | border-top-left-radius | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `4px` | `4px` | 0 |  |
| root | border-top-right-radius | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `4px` | `4px` | 0 |  |
| root | border-width | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| root | gap | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `normal` | 0 |  |
| root | padding-bottom | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| root | padding-left | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| root | padding-right | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| root | padding-top | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| indicator | background-color | `Size=Medium, Tone=Highlight`, `Size=Small, Tone=Highlight`, `Size=Large, Tone=Highlight` | `rgba(145, 208, 255, 1)` | `rgba(145, 208, 255, 1)` | match |  |
| indicator | background-color | `Size=Medium, Tone=Critical`, `Size=Small, Tone=Critical`, `Size=Large, Tone=Critical` | `rgba(199, 10, 36, 1)` | `rgba(199, 10, 36, 1)` | match |  |
| indicator | background-color | `Size=Medium, Tone=Success`, `Size=Small, Tone=Success`, `Size=Large, Tone=Success` | `rgba(4, 123, 93, 1)` | `rgba(4, 123, 93, 1)` | match |  |
| indicator | background-color | `Size=Medium, Tone=Primary`, `Size=Small, Tone=Primary`, `Size=Large, Tone=Primary` | `rgba(48, 48, 48, 1)` | `rgba(48, 48, 48, 1)` | match |  |
| indicator | border-bottom-left-radius | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| indicator | border-bottom-right-radius | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| indicator | border-top-left-radius | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| indicator | border-top-right-radius | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| indicator | border-width | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| indicator | gap | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `normal` | 0 |  |
| indicator | padding-bottom | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| indicator | padding-left | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| indicator | padding-right | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
| indicator | padding-top | 12 cells (e.g. `Size=Medium, Tone=Highlight`) | `0px` | `0px` | 0 |  |
