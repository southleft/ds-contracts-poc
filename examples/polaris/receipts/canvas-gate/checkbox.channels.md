# Checkbox — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.checkbox` v0.3.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/checkbox/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 3; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

Notes:
- round 4: the promoted anatomy CARRIES the label part — the real mount shows the label (floor fixedProps), retiring the round-3 labelHidden scoping.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| root | border-bottom-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| root | border-bottom-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| root | border-top-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| root | border-top-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| root | border-width | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| root | gap | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `normal` | 0 |  |
| root | padding-bottom | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `4px` | `4px` | 0 |  |
| root | padding-left | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| root | padding-right | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| root | padding-top | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `4px` | `4px` | 0 |  |
| backdrop | background-color | `Checked=unchecked` | `rgba(255, 255, 255, 1)` | `rgba(255, 255, 255, 1)` | match |  |
| backdrop | background-color | `Checked=checked`, `Checked=indeterminate` | `rgba(48, 48, 48, 1)` | `rgba(48, 48, 48, 1)` | match |  |
| backdrop | border-bottom-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `4px` | `4px` | 0 |  |
| backdrop | border-bottom-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `4px` | `4px` | 0 |  |
| backdrop | border-top-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `4px` | `4px` | 0 |  |
| backdrop | border-top-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `4px` | `4px` | 0 |  |
| backdrop | border-width | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| backdrop | gap | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `normal` | 0 |  |
| backdrop | padding-bottom | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| backdrop | padding-left | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| backdrop | padding-right | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| backdrop | padding-top | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| checkbox | background-color | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| checkbox | border-bottom-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| checkbox | border-bottom-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| checkbox | border-top-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| checkbox | border-top-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| checkbox | border-width | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| checkbox | gap | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `normal` | 0 |  |
| checkbox | padding-bottom | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| checkbox | padding-left | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| checkbox | padding-right | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| checkbox | padding-top | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__control | background-color | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| choice__control | border-bottom-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__control | border-bottom-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__control | border-top-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__control | border-top-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__control | border-width | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__control | gap | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `normal` | 0 |  |
| choice__control | padding-bottom | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__control | padding-left | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__control | padding-right | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__control | padding-top | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__label | background-color | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| choice__label | border-bottom-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__label | border-bottom-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__label | border-top-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__label | border-top-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__label | border-width | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__label | gap | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `normal` | 0 |  |
| choice__label | padding-bottom | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__label | padding-left | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__label | padding-right | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| choice__label | padding-top | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon | background-color | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| icon | border-bottom-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon | border-bottom-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon | border-top-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon | border-top-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon | border-width | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon | gap | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `normal` | 0 |  |
| icon | padding-bottom | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon | padding-left | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon | padding-right | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon | padding-top | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| icon-2 | background-color | `Checked=unchecked`, `Checked=checked` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| icon-2 | border-bottom-left-radius | `Checked=unchecked`, `Checked=checked` | `0px` | `0px` | 0 |  |
| icon-2 | border-bottom-right-radius | `Checked=unchecked`, `Checked=checked` | `0px` | `0px` | 0 |  |
| icon-2 | border-top-left-radius | `Checked=unchecked`, `Checked=checked` | `0px` | `0px` | 0 |  |
| icon-2 | border-top-right-radius | `Checked=unchecked`, `Checked=checked` | `0px` | `0px` | 0 |  |
| icon-2 | border-width | `Checked=unchecked`, `Checked=checked` | `0px` | `0px` | 0 |  |
| icon-2 | gap | `Checked=unchecked`, `Checked=checked` | `0px` | `normal` | 0 |  |
| icon-2 | padding-bottom | `Checked=unchecked`, `Checked=checked` | `0px` | `0px` | 0 |  |
| icon-2 | padding-left | `Checked=unchecked`, `Checked=checked` | `0px` | `0px` | 0 |  |
| icon-2 | padding-right | `Checked=unchecked`, `Checked=checked` | `0px` | `0px` | 0 |  |
| icon-2 | padding-top | `Checked=unchecked`, `Checked=checked` | `0px` | `0px` | 0 |  |
| label | background-color | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label | border-bottom-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| label | border-bottom-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| label | border-top-left-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| label | border-top-right-radius | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| label | border-width | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| label | font-size | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `14px` | `13px` | +1px |  |
| label | gap | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `normal` | 0 |  |
| label | line-height | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `(ratio 1.2)` | `20px` | DIFFERS |  |
| label | padding-bottom | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| label | padding-left | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| label | padding-right | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
| label | padding-top | `Checked=unchecked`, `Checked=checked`, `Checked=indeterminate` | `0px` | `0px` | 0 |  |
