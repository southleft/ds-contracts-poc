# Tag — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.tag` v0.3.1. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/tag/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 4; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | `Size=large, State=Disabled` | `rgba(0, 0, 0, 0.05)` | `rgba(0, 0, 0, 0.05)` | match |  |
| root | background-color | `Size=large`, `Size=large, State=Active`, `Size=large, State=Focus Visible` | `rgba(227, 227, 227, 1)` | `rgba(227, 227, 227, 1)` | match |  |
| root | border-bottom-left-radius | 4 cells (e.g. `Size=large`) | `8px` | `8px` | 0 |  |
| root | border-bottom-right-radius | 4 cells (e.g. `Size=large`) | `8px` | `8px` | 0 |  |
| root | border-top-left-radius | 4 cells (e.g. `Size=large`) | `8px` | `8px` | 0 |  |
| root | border-top-right-radius | 4 cells (e.g. `Size=large`) | `8px` | `8px` | 0 |  |
| root | border-width | `Size=large`, `Size=large, State=Disabled` | `0px` | `0px` | 0 |  |
| root | border-width | `Size=large, State=Active`, `Size=large, State=Focus Visible` | `3px` | `0px` | +3px |  |
| root | gap | 4 cells (e.g. `Size=large`) | `0px` | `normal` | 0 |  |
| root | padding-bottom | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| root | padding-left | 4 cells (e.g. `Size=large`) | `8px` | `8px` | 0 |  |
| root | padding-right | 4 cells (e.g. `Size=large`) | `8px` | `8px` | 0 |  |
| root | padding-top | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| label | background-color | 4 cells (e.g. `Size=large`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label | border-bottom-left-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| label | border-bottom-right-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| label | border-top-left-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| label | border-top-right-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| label | border-width | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| label | color | `Size=large, State=Disabled` | `rgba(181, 181, 181, 1)` | `rgba(181, 181, 181, 1)` | match |  |
| label | color | `Size=large`, `Size=large, State=Active`, `Size=large, State=Focus Visible` | `rgba(48, 48, 48, 1)` | `rgba(48, 48, 48, 1)` | match |  |
| label | font-size | 4 cells (e.g. `Size=large`) | `12px` | `12px` | 0 |  |
| label | gap | 4 cells (e.g. `Size=large`) | `0px` | `normal` | 0 |  |
| label | line-height | 4 cells (e.g. `Size=large`) | `20px` | `20px` | 0 |  |
| label | padding-bottom | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| label | padding-left | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| label | padding-right | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| label | padding-top | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| link | background-color | 4 cells (e.g. `Size=large`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| link | border-bottom-left-radius | 4 cells (e.g. `Size=large`) | `8px` | `0px` | +8px | contract binds 8px |
| link | border-bottom-right-radius | 4 cells (e.g. `Size=large`) | `8px` | `0px` | +8px | contract binds 8px |
| link | border-top-left-radius | 4 cells (e.g. `Size=large`) | `8px` | `0px` | +8px | contract binds 8px |
| link | border-top-right-radius | 4 cells (e.g. `Size=large`) | `8px` | `0px` | +8px | contract binds 8px |
| link | border-width | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| link | gap | 4 cells (e.g. `Size=large`) | `0px` | `normal` | 0 |  |
| link | padding-bottom | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| link | padding-left | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| link | padding-right | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| link | padding-top | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text | background-color | 4 cells (e.g. `Size=large`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| text | border-bottom-left-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text | border-bottom-right-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text | border-top-left-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text | border-top-right-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text | border-width | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text | gap | 4 cells (e.g. `Size=large`) | `0px` | `normal` | 0 |  |
| text | padding-bottom | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text | padding-left | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text | padding-right | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text | padding-top | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text-2 | background-color | 4 cells (e.g. `Size=large`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| text-2 | border-bottom-left-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text-2 | border-bottom-right-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text-2 | border-top-left-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text-2 | border-top-right-radius | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text-2 | border-width | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text-2 | gap | 4 cells (e.g. `Size=large`) | `0px` | `normal` | 0 |  |
| text-2 | padding-bottom | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text-2 | padding-left | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text-2 | padding-right | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
| text-2 | padding-top | 4 cells (e.g. `Size=large`) | `0px` | `0px` | 0 |  |
