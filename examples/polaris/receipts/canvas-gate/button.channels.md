# Button — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.button` v0.3.1. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/button/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 60; cells with no captured combo (axis value or state the
computed sweep never mounted): 160. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary, State=Disabled`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Tertiary, State=Focus Visible`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Tertiary, State=Hover` | `rgba(0, 0, 0, 0.05)` | `rgba(0, 0, 0, 0.05)` | match |  |
| root | background-color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Tertiary, State=Active` | `rgba(0, 0, 0, 0.08)` | `rgba(0, 0, 0, 0.08)` | match |  |
| root | background-color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Primary, State=Disabled` | `rgba(0, 0, 0, 0.17)` | `rgba(0, 0, 0, 0.17)` | match |  |
| root | background-color | 33 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| root | background-color | 4 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Primary`) | `rgba(199, 10, 36, 1)` | `rgba(199, 10, 36, 1)` | match |  |
| root | background-color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary, State=Active` | `rgba(247, 247, 247, 1)` | `rgba(247, 247, 247, 1)` | match |  |
| root | background-color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary, State=Focus Visible`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary, State=Hover` | `rgba(250, 250, 250, 1)` | `rgba(250, 250, 250, 1)` | match |  |
| root | background-color | 8 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `rgba(255, 255, 255, 1)` | `rgba(255, 255, 255, 1)` | match |  |
| root | background-color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Primary, State=Focus Visible`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Primary, State=Hover` | `rgba(26, 26, 26, 1)` | `rgba(163, 10, 36, 1)` | DIFFERS | contract binds #c70a24 |
| root | background-color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Primary, State=Active` | `rgba(26, 26, 26, 1)` | `rgba(142, 11, 33, 1)` | DIFFERS | contract binds #c70a24 |
| root | background-color | 4 cells (e.g. `Size=Medium, Text Align=Center, Tone=Success, Variant=Primary`) | `rgba(4, 123, 93, 1)` | `rgba(4, 123, 93, 1)` | match |  |
| root | border-bottom-left-radius | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain, State=Focus Visible`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Monochrome Plain, State=Focus Visible` | `12px` | `12px` | 0 |  |
| root | border-bottom-left-radius | 58 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `8px` | `8px` | 0 |  |
| root | border-bottom-right-radius | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain, State=Focus Visible`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Monochrome Plain, State=Focus Visible` | `12px` | `12px` | 0 |  |
| root | border-bottom-right-radius | 58 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `8px` | `8px` | 0 |  |
| root | border-top-left-radius | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain, State=Focus Visible`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Monochrome Plain, State=Focus Visible` | `12px` | `12px` | 0 |  |
| root | border-top-left-radius | 58 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `8px` | `8px` | 0 |  |
| root | border-top-right-radius | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain, State=Focus Visible`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Monochrome Plain, State=Focus Visible` | `12px` | `12px` | 0 |  |
| root | border-top-right-radius | 58 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `8px` | `8px` | 0 |  |
| root | border-width | 40 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| root | border-width | 15 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary, State=Disabled`) | `1px` | `0px` | +1px | EMITTER-DEFECT? (contract binds 0px) |
| root | border-width | 5 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary, State=Focus Visible`) | `2px` | `0px` | +2px | EMITTER-DEFECT? (contract binds 0px) |
| root | gap | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `2px` | `2px` | 0 |  |
| root | padding-bottom | 10 cells (e.g. `Size=Micro, Text Align=Center, Tone=Critical, Variant=Secondary`) | `4px` | `4px` | 0 |  |
| root | padding-bottom | 50 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `6px` | `6px` | 0 |  |
| root | padding-left | 50 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `12px` | `12px` | 0 |  |
| root | padding-left | 10 cells (e.g. `Size=Micro, Text Align=Center, Tone=Critical, Variant=Secondary`) | `8px` | `8px` | 0 |  |
| root | padding-right | 50 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `12px` | `12px` | 0 |  |
| root | padding-right | 10 cells (e.g. `Size=Micro, Text Align=Center, Tone=Critical, Variant=Secondary`) | `8px` | `8px` | 0 |  |
| root | padding-top | 10 cells (e.g. `Size=Micro, Text Align=Center, Tone=Critical, Variant=Secondary`) | `4px` | `4px` | 0 |  |
| root | padding-top | 50 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `6px` | `6px` | 0 |  |
| icon | background-color | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| icon | border-bottom-left-radius | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| icon | border-bottom-right-radius | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| icon | border-top-left-radius | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| icon | border-top-right-radius | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| icon | border-width | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| icon | gap | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `normal` | 0 |  |
| icon | padding-bottom | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| icon | padding-left | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| icon | padding-right | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| icon | padding-top | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| label | background-color | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label | border-bottom-left-radius | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| label | border-bottom-right-radius | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| label | border-top-left-radius | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| label | border-top-right-radius | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| label | border-width | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| label | color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain, State=Active` | `rgba(0, 46, 106, 1)` | `rgba(47, 4, 11, 1)` | DIFFERS |  |
| label | color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain, State=Focus Visible`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain, State=Hover` | `rgba(0, 66, 153, 1)` | `rgba(95, 7, 22, 1)` | DIFFERS |  |
| label | color | 12 cells (e.g. `Size=Medium, Text Align=Center, Tone=Success, Variant=Secondary`) | `rgba(1, 75, 64, 1)` | `rgba(1, 75, 64, 1)` | match |  |
| label | color | 12 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `rgba(142, 11, 33, 1)` | `rgba(142, 11, 33, 1)` | match |  |
| label | color | 4 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary, State=Disabled`) | `rgba(181, 181, 181, 1)` | `rgba(181, 181, 181, 1)` | match |  |
| label | color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Primary, State=Disabled` | `rgba(181, 181, 181, 1)` | `rgba(255, 255, 255, 1)` | DIFFERS |  |
| label | color | 11 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Primary`) | `rgba(255, 255, 255, 1)` | `rgba(255, 255, 255, 1)` | match |  |
| label | color | 11 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Monochrome Plain`) | `rgba(48, 48, 48, 1)` | `rgba(48, 48, 48, 1)` | match |  |
| label | color | 4 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary, State=Focus Visible`) | `rgba(48, 48, 48, 1)` | `rgba(95, 7, 22, 1)` | DIFFERS |  |
| label | color | `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary, State=Active`, `Size=Medium, Text Align=Center, Tone=Critical, Variant=Tertiary, State=Active` | `rgba(48, 48, 48, 1)` | `rgba(47, 4, 11, 1)` | DIFFERS |  |
| label | font-size | 34 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `12px` | `12px` | 0 |  |
| label | font-size | 16 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain`) | `12px` | `13px` | -1px | contract binds 12px |
| label | font-size | 10 cells (e.g. `Size=Large, Text Align=Center, Tone=Critical, Variant=Secondary`) | `13px` | `13px` | 0 |  |
| label | gap | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `normal` | 0 |  |
| label | line-height | 34 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `16px` | `16px` | 0 |  |
| label | line-height | 16 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Plain`) | `16px` | `20px` | -4px | contract binds 16px |
| label | line-height | 10 cells (e.g. `Size=Large, Text Align=Center, Tone=Critical, Variant=Secondary`) | `20px` | `20px` | 0 |  |
| label | padding-bottom | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| label | padding-left | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| label | padding-right | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
| label | padding-top | 60 cells (e.g. `Size=Medium, Text Align=Center, Tone=Critical, Variant=Secondary`) | `0px` | `0px` | 0 |  |
