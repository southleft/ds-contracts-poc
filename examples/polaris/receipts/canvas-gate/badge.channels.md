# Badge — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.badge` v0.2.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/badge/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 1; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | `Badge` | `rgba(0, 0, 0, 0.06)` | `rgba(0, 0, 0, 0.06)` | match |  |
| root | border-bottom-left-radius | `Badge` | `8px` | `8px` | 0 |  |
| root | border-bottom-right-radius | `Badge` | `8px` | `8px` | 0 |  |
| root | border-top-left-radius | `Badge` | `8px` | `8px` | 0 |  |
| root | border-top-right-radius | `Badge` | `8px` | `8px` | 0 |  |
| root | border-width | `Badge` | `0px` | `0px` | 0 |  |
| root | gap | `Badge` | `0px` | `normal` | 0 |  |
| root | padding-bottom | `Badge` | `2px` | `2px` | 0 |  |
| root | padding-left | `Badge` | `8px` | `8px` | 0 |  |
| root | padding-right | `Badge` | `8px` | `8px` | 0 |  |
| root | padding-top | `Badge` | `2px` | `2px` | 0 |  |
| label | background-color | `Badge` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label | border-bottom-left-radius | `Badge` | `0px` | `0px` | 0 |  |
| label | border-bottom-right-radius | `Badge` | `0px` | `0px` | 0 |  |
| label | border-top-left-radius | `Badge` | `0px` | `0px` | 0 |  |
| label | border-top-right-radius | `Badge` | `0px` | `0px` | 0 |  |
| label | border-width | `Badge` | `0px` | `0px` | 0 |  |
| label | color | `Badge` | `rgba(97, 97, 97, 1)` | `rgba(97, 97, 97, 1)` | match |  |
| label | font-size | `Badge` | `12px` | `12px` | 0 |  |
| label | gap | `Badge` | `0px` | `normal` | 0 |  |
| label | line-height | `Badge` | `16px` | `16px` | 0 |  |
| label | padding-bottom | `Badge` | `0px` | `0px` | 0 |  |
| label | padding-left | `Badge` | `0px` | `0px` | 0 |  |
| label | padding-right | `Badge` | `0px` | `0px` | 0 |  |
| label | padding-top | `Badge` | `0px` | `0px` | 0 |  |
