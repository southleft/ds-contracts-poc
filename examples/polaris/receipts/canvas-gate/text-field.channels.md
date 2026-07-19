# TextField — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.text-field` v0.2.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/textfield/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 8; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| root | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| root | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| root | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| root | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| root | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| root | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| root | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| root | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| root | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| root | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| backdrop | background-color | `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium, State=Disabled` | `rgba(0, 0, 0, 0.05)` | `rgba(0, 0, 0, 0.05)` | match |  |
| backdrop | background-color | `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium, State=Active`, `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium, State=Focus Visible` | `rgba(247, 247, 247, 1)` | `rgba(247, 247, 247, 1)` | match |  |
| backdrop | background-color | `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium, State=Hover` | `rgba(250, 250, 250, 1)` | `rgba(250, 250, 250, 1)` | match |  |
| backdrop | background-color | 4 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(253, 253, 253, 1)` | `rgba(253, 253, 253, 1)` | match |  |
| backdrop | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `8px` | `8px` | 0 |  |
| backdrop | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `8px` | `8px` | 0 |  |
| backdrop | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `8px` | `8px` | 0 |  |
| backdrop | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `8px` | `8px` | 0 |  |
| backdrop | border-width | 5 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0.66px` | `1px` | -0.34px | contract binds 0.66px |
| backdrop | border-width | `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium, State=Disabled` | `0.66px` | `0px` | +0.66px | contract binds 0.66px |
| backdrop | border-width | `Type=Text, Input Mode=Text, Align=Left, Variant=Borderless, Size=Medium`, `Type=Text, Input Mode=Text, Align=Left, Variant=Borderless, Size=Slim` | `0px` | `0px` | 0 |  |
| backdrop | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| backdrop | padding-bottom | 6 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| backdrop | padding-bottom | `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Slim`, `Type=Text, Input Mode=Text, Align=Left, Variant=Borderless, Size=Slim` | `2px` | `2px` | 0 |  |
| backdrop | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| backdrop | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| backdrop | padding-top | 6 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| backdrop | padding-top | `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Slim`, `Type=Text, Input Mode=Text, Align=Left, Variant=Borderless, Size=Slim` | `2px` | `2px` | 0 |  |
| input | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| input | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| input | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| input | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| input | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| input | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| input | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| input | padding-bottom | `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Slim`, `Type=Text, Input Mode=Text, Align=Left, Variant=Borderless, Size=Slim` | `2px` | `2px` | 0 |  |
| input | padding-bottom | 6 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `6px` | `6px` | 0 |  |
| input | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `12px` | `12px` | 0 |  |
| input | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `12px` | `12px` | 0 |  |
| input | padding-top | `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Slim`, `Type=Text, Input Mode=Text, Align=Left, Variant=Borderless, Size=Slim` | `2px` | `2px` | 0 |  |
| input | padding-top | 6 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `6px` | `6px` | 0 |  |
