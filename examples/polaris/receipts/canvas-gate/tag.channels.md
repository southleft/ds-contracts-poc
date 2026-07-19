# Tag — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.tag` v0.2.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/tag/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 2; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | `State=Disabled` | `rgba(0, 0, 0, 0.05)` | `rgba(0, 0, 0, 0.05)` | match |  |
| root | background-color | `Tag` | `rgba(227, 227, 227, 1)` | `rgba(227, 227, 227, 1)` | match |  |
| root | border-bottom-left-radius | `Tag`, `State=Disabled` | `8px` | `8px` | 0 |  |
| root | border-bottom-right-radius | `Tag`, `State=Disabled` | `8px` | `8px` | 0 |  |
| root | border-top-left-radius | `Tag`, `State=Disabled` | `8px` | `8px` | 0 |  |
| root | border-top-right-radius | `Tag`, `State=Disabled` | `8px` | `8px` | 0 |  |
| root | border-width | `Tag` | `0px` | `0px` | 0 |  |
| root | border-width | `State=Disabled` | `1px` | `0px` | +1px |  |
| root | gap | `Tag`, `State=Disabled` | `0px` | `normal` | 0 |  |
| root | padding-bottom | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| root | padding-left | `Tag`, `State=Disabled` | `0px` | `6px` | -6px | EMITTER-DEFECT? (contract binds 6px) |
| root | padding-right | `Tag`, `State=Disabled` | `0px` | `6px` | -6px | EMITTER-DEFECT? (contract binds 6px) |
| root | padding-top | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| label | background-color | `Tag`, `State=Disabled` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label | border-bottom-left-radius | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| label | border-bottom-right-radius | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| label | border-top-left-radius | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| label | border-top-right-radius | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| label | border-width | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| label | color | `State=Disabled` | `rgba(181, 181, 181, 1)` | `rgba(181, 181, 181, 1)` | match |  |
| label | color | `Tag` | `rgba(48, 48, 48, 1)` | `rgba(48, 48, 48, 1)` | match |  |
| label | font-size | `Tag`, `State=Disabled` | `12px` | `12px` | 0 |  |
| label | gap | `Tag`, `State=Disabled` | `0px` | `normal` | 0 |  |
| label | line-height | `Tag`, `State=Disabled` | `20px` | `20px` | 0 |  |
| label | padding-bottom | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| label | padding-left | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| label | padding-right | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
| label | padding-top | `Tag`, `State=Disabled` | `0px` | `0px` | 0 |  |
