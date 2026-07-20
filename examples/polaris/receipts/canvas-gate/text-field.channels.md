# TextField — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.text-field` v0.3.2. Canvas-drawn values are read directly off the
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
| clearbutton | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(253, 253, 253, 1)` | DIFFERS | contract binds #00000000 |
| clearbutton | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `8px` | -8px |  |
| clearbutton | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `8px` | -8px |  |
| clearbutton | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `8px` | -8px |  |
| clearbutton | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `8px` | -8px |  |
| clearbutton | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `1px` | -1px | contract binds 0px |
| clearbutton | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| clearbutton | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| clearbutton | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| clearbutton | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| clearbutton | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| connected | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| connected | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected__item | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| connected__item | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected__item | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected__item | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected__item | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected__item | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected__item | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| connected__item | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected__item | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected__item | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| connected__item | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
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
| label | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| label | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label__text | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label__text | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label__text | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label__text | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label__text | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label__text | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label__text | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| label__text | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label__text | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label__text | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label__text | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label-2 | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label-2 | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label-2 | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label-2 | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label-2 | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label-2 | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label-2 | color | `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium, State=Disabled` | `rgba(181, 181, 181, 1)` | `rgba(181, 181, 181, 1)` | match |  |
| label-2 | color | 7 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(48, 48, 48, 1)` | `rgba(48, 48, 48, 1)` | match |  |
| label-2 | font-size | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `13px` | `13px` | 0 |  |
| label-2 | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| label-2 | line-height | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `20px` | `20px` | 0 |  |
| label-2 | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label-2 | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label-2 | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| label-2 | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| labelled__labelwrapper | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| labelled__labelwrapper | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| labelled__labelwrapper | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| labelled__labelwrapper | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| labelled__labelwrapper | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| labelled__labelwrapper | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| labelled__labelwrapper | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| labelled__labelwrapper | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| labelled__labelwrapper | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| labelled__labelwrapper | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| labelled__labelwrapper | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| prefix | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| prefix | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| prefix | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| prefix | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| prefix | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| prefix | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| prefix | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| prefix | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `6px` | -6px |  |
| prefix | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `12px` | -12px |  |
| prefix | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `12px` | -12px |  |
| prefix | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `6px` | -6px |  |
| suffix | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(253, 253, 253, 1)` | DIFFERS |  |
| suffix | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `8px` | -8px |  |
| suffix | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `8px` | -8px |  |
| suffix | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `8px` | -8px |  |
| suffix | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `8px` | -8px |  |
| suffix | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `1px` | -1px |  |
| suffix | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| suffix | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| suffix | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| suffix | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| suffix | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| textfield | background-color | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| textfield | border-bottom-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| textfield | border-bottom-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| textfield | border-top-left-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| textfield | border-top-right-radius | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| textfield | border-width | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| textfield | gap | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `normal` | 0 |  |
| textfield | padding-bottom | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| textfield | padding-left | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| textfield | padding-right | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
| textfield | padding-top | 8 cells (e.g. `Type=Text, Input Mode=Text, Align=Left, Variant=Inherit, Size=Medium`) | `0px` | `0px` | 0 |  |
