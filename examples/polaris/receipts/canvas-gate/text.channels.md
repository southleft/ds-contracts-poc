# Text — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.text` v0.2.0. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/text/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 14; cells with no captured combo (axis value or state the
computed sweep never mounted): 41. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| root | border-bottom-left-radius | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| root | border-bottom-right-radius | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| root | border-top-left-radius | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| root | border-top-right-radius | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| root | border-width | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| root | gap | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `normal` | 0 |  |
| root | padding-bottom | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| root | padding-left | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| root | padding-right | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| root | padding-top | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| label | background-color | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label | border-bottom-left-radius | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| label | border-bottom-right-radius | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| label | border-top-left-radius | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| label | border-top-right-radius | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| label | border-width | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| label | color | `Alignment=Start, As=P, Tone=Success, Font Weight=Regular, Variant=Heading Md`, `Alignment=Start, As=P, Tone=Success, Font Weight=Regular, Variant=Body Xs`, `Alignment=Start, As=P, Tone=Success, Font Weight=Regular, Variant=Body Md` | `rgba(1, 75, 64, 1)` | `rgba(1, 75, 64, 1)` | match |  |
| label | color | `Alignment=Start, As=P, Tone=Critical, Font Weight=Regular, Variant=Heading Md`, `Alignment=Start, As=P, Tone=Critical, Font Weight=Regular, Variant=Heading Xl`, `Alignment=Start, As=P, Tone=Critical, Font Weight=Regular, Variant=Body Md` | `rgba(142, 11, 33, 1)` | `rgba(142, 11, 33, 1)` | match |  |
| label | color | `Alignment=Start, As=P, Tone=Caution, Font Weight=Regular, Variant=Heading Sm`, `Alignment=Start, As=P, Tone=Caution, Font Weight=Regular, Variant=Heading3xl`, `Alignment=Start, As=P, Tone=Caution, Font Weight=Regular, Variant=Body Xs` | `rgba(79, 71, 0, 1)` | `rgba(79, 71, 0, 1)` | match |  |
| label | color | `Alignment=Start, As=P, Tone=Subdued, Font Weight=Regular, Variant=Heading Xs`, `Alignment=Start, As=P, Tone=Subdued, Font Weight=Regular, Variant=Heading Lg`, `Alignment=Start, As=P, Tone=Subdued, Font Weight=Regular, Variant=Body Sm` | `rgba(97, 97, 97, 1)` | `rgba(97, 97, 97, 1)` | match |  |
| label | font-size | `Alignment=Start, As=P, Tone=Success, Font Weight=Regular, Variant=Body Xs`, `Alignment=Start, As=P, Tone=Caution, Font Weight=Regular, Variant=Body Xs` | `11px` | `11px` | 0 |  |
| label | font-size | `Alignment=Start, As=P, Tone=Subdued, Font Weight=Regular, Variant=Heading Xs`, `Alignment=Start, As=P, Tone=Subdued, Font Weight=Regular, Variant=Body Sm` | `12px` | `12px` | 0 |  |
| label | font-size | 4 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `13px` | `13px` | 0 |  |
| label | font-size | `Alignment=Start, As=P, Tone=Success, Font Weight=Regular, Variant=Heading Md`, `Alignment=Start, As=P, Tone=Critical, Font Weight=Regular, Variant=Heading Md` | `14px` | `14px` | 0 |  |
| label | font-size | `Alignment=Start, As=P, Tone=Critical, Font Weight=Regular, Variant=Heading Xl`, `Alignment=Start, As=P, Tone=Subdued, Font Weight=Regular, Variant=Heading Lg` | `20px` | `20px` | 0 |  |
| label | font-size | `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading3xl`, `Alignment=Start, As=P, Tone=Caution, Font Weight=Regular, Variant=Heading3xl` | `30px` | `30px` | 0 |  |
| label | gap | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `normal` | 0 |  |
| label | line-height | `Alignment=Start, As=P, Tone=Success, Font Weight=Regular, Variant=Body Xs`, `Alignment=Start, As=P, Tone=Caution, Font Weight=Regular, Variant=Body Xs` | `12px` | `12px` | 0 |  |
| label | line-height | `Alignment=Start, As=P, Tone=Subdued, Font Weight=Regular, Variant=Heading Xs`, `Alignment=Start, As=P, Tone=Subdued, Font Weight=Regular, Variant=Body Sm` | `16px` | `16px` | 0 |  |
| label | line-height | 6 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `20px` | `20px` | 0 |  |
| label | line-height | `Alignment=Start, As=P, Tone=Critical, Font Weight=Regular, Variant=Heading Xl`, `Alignment=Start, As=P, Tone=Subdued, Font Weight=Regular, Variant=Heading Lg` | `24px` | `24px` | 0 |  |
| label | line-height | `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading3xl`, `Alignment=Start, As=P, Tone=Caution, Font Weight=Regular, Variant=Heading3xl` | `40px` | `40px` | 0 |  |
| label | padding-bottom | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| label | padding-left | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| label | padding-right | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
| label | padding-top | 14 cells (e.g. `Alignment=Start, As=P, Tone=Base, Font Weight=Regular, Variant=Heading Sm`) | `0px` | `0px` | 0 |  |
