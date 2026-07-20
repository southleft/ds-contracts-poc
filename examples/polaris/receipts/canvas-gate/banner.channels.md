# Banner — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.banner` v0.3.1. Canvas-drawn values are read directly off the
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
| blockstack | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| blockstack | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| blockstack | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack-2 | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| blockstack-2 | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack-2 | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack-2 | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack-2 | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack-2 | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack-2 | gap | 8 cells (e.g. `Tone=Info`) | `8px` | `8px` | 0 |  |
| blockstack-2 | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack-2 | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack-2 | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| blockstack-2 | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| box | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| box | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box-2 | background-color | `Tone=Info`, `Tone=Info, State=Focus Visible` | `rgba(145, 208, 255, 1)` | `rgba(145, 208, 255, 1)` | match |  |
| box-2 | background-color | `Tone=Critical`, `Tone=Critical, State=Focus Visible` | `rgba(199, 10, 36, 1)` | `rgba(199, 10, 36, 1)` | match |  |
| box-2 | background-color | `Tone=Warning`, `Tone=Warning, State=Focus Visible` | `rgba(255, 184, 0, 1)` | `rgba(255, 184, 0, 1)` | match |  |
| box-2 | background-color | `Tone=Success`, `Tone=Success, State=Focus Visible` | `rgba(4, 123, 93, 1)` | `rgba(4, 123, 93, 1)` | match |  |
| box-2 | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box-2 | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box-2 | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| box-2 | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| box-2 | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box-2 | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| box-2 | padding-bottom | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| box-2 | padding-left | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| box-2 | padding-right | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| box-2 | padding-top | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| box-3 | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| box-3 | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box-3 | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box-3 | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box-3 | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box-3 | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| box-3 | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| box-3 | padding-bottom | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| box-3 | padding-left | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| box-3 | padding-right | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| box-3 | padding-top | 8 cells (e.g. `Tone=Info`) | `12px` | `12px` | 0 |  |
| icon | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| icon | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| icon | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| icon | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| icon | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| icon | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| icon | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| icon | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| icon | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| icon | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| icon | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| inlinestack | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack | gap | 8 cells (e.g. `Tone=Info`) | `8px` | `8px` | 0 |  |
| inlinestack | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack-2 | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| inlinestack-2 | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack-2 | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack-2 | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack-2 | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack-2 | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack-2 | gap | 8 cells (e.g. `Tone=Info`) | `4px` | `4px` | 0 |  |
| inlinestack-2 | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack-2 | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack-2 | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| inlinestack-2 | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| label-2 | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label-2 | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| label-2 | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| label-2 | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| label-2 | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| label-2 | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| label-2 | color | 8 cells (e.g. `Tone=Info`) | `rgba(48, 48, 48, 1)` | `rgba(48, 48, 48, 1)` | match |  |
| label-2 | font-size | 8 cells (e.g. `Tone=Info`) | `13px` | `13px` | 0 |  |
| label-2 | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| label-2 | line-height | 8 cells (e.g. `Tone=Info`) | `20px` | `20px` | 0 |  |
| label-2 | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| label-2 | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| label-2 | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| label-2 | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-0-0-0-0 | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| part-0-0-0-0-0-0 | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-0-0-0-0 | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-0-0-0-0 | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-0-0-0-0 | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-0-0-0-0 | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-0-0-0-0 | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| part-0-0-0-0-0-0 | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-0-0-0-0 | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-0-0-0-0 | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-0-0-0-0 | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-1-0-0 | background-color | 8 cells (e.g. `Tone=Info`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| part-0-0-1-0-0 | border-bottom-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-1-0-0 | border-bottom-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-1-0-0 | border-top-left-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-1-0-0 | border-top-right-radius | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-1-0-0 | border-width | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-1-0-0 | gap | 8 cells (e.g. `Tone=Info`) | `0px` | `normal` | 0 |  |
| part-0-0-1-0-0 | padding-bottom | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-1-0-0 | padding-left | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-1-0-0 | padding-right | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
| part-0-0-1-0-0 | padding-top | 8 cells (e.g. `Tone=Info`) | `0px` | `0px` | 0 |  |
