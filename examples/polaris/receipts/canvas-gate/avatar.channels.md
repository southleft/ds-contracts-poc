# Avatar — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.avatar` v0.3.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/avatar/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 5; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | 5 cells (e.g. `Size=Md`) | `rgba(197, 48, 197, 1)` | `rgba(197, 48, 197, 1)` | match |  |
| root | border-bottom-left-radius | `Size=Xs` | `4px` | `4px` | 0 |  |
| root | border-bottom-left-radius | `Size=Md`, `Size=Sm` | `6px` | `6px` | 0 |  |
| root | border-bottom-left-radius | `Size=Lg`, `Size=Xl` | `8px` | `8px` | 0 |  |
| root | border-bottom-right-radius | `Size=Xs` | `4px` | `4px` | 0 |  |
| root | border-bottom-right-radius | `Size=Md`, `Size=Sm` | `6px` | `6px` | 0 |  |
| root | border-bottom-right-radius | `Size=Lg`, `Size=Xl` | `8px` | `8px` | 0 |  |
| root | border-top-left-radius | `Size=Xs` | `4px` | `4px` | 0 |  |
| root | border-top-left-radius | `Size=Md`, `Size=Sm` | `6px` | `6px` | 0 |  |
| root | border-top-left-radius | `Size=Lg`, `Size=Xl` | `8px` | `8px` | 0 |  |
| root | border-top-right-radius | `Size=Xs` | `4px` | `4px` | 0 |  |
| root | border-top-right-radius | `Size=Md`, `Size=Sm` | `6px` | `6px` | 0 |  |
| root | border-top-right-radius | `Size=Lg`, `Size=Xl` | `8px` | `8px` | 0 |  |
| root | border-width | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| root | gap | 5 cells (e.g. `Size=Md`) | `0px` | `normal` | 0 |  |
| root | padding-bottom | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| root | padding-left | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| root | padding-right | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| root | padding-top | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| initials | background-color | 5 cells (e.g. `Size=Md`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| initials | border-bottom-left-radius | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| initials | border-bottom-right-radius | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| initials | border-top-left-radius | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| initials | border-top-right-radius | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| initials | border-width | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| initials | color | 5 cells (e.g. `Size=Md`) | `rgba(253, 239, 253, 1)` | `rgba(253, 239, 253, 1)` | match |  |
| initials | font-size | 5 cells (e.g. `Size=Md`) | `13px` | `13px` | 0 |  |
| initials | gap | 5 cells (e.g. `Size=Md`) | `0px` | `normal` | 0 |  |
| initials | line-height | 5 cells (e.g. `Size=Md`) | `(ratio 1.2)` | `20px` | DIFFERS |  |
| initials | padding-bottom | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| initials | padding-left | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| initials | padding-right | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
| initials | padding-top | 5 cells (e.g. `Size=Md`) | `0px` | `0px` | 0 |  |
