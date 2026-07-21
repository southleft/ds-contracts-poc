# Badge — channel table (canvas-drawn vs captured browser truth)

Contract: `polaris.badge` v0.3.2. Canvas-drawn values are read directly off the
compiled variant node tree (`createFigmaEngine().compileComponentData`, bindings resolved through
the engine token trees, v14 literals as-is). Captured-truth values come from
`extract/computed/out/badge/captured-truth.json` — the computed styles of the REAL
`@shopify/polaris@13.9.5` package in `Chromium 148.0.7778.96 (playwright-core, headless)`;
that file is simultaneously the real-package computed truth, so the second column serves as both
reference columns the gate requires.

Cells with a capture match: 56; cells with no captured combo (axis value or state the
computed sweep never mounted): 0. A drawn value of `0px` means the renderer's default
applies (no binding, no literal). `gap` compares against computed `column-gap`; captured `normal` = 0px.

| part | channel | cell(s) | canvas-drawn | captured-truth (real Polaris computed) | delta | flag |
|---|---|---|---|---|---|---|
| root | background-color | 8 cells (e.g. `Tone=new, Progress=none`) | `rgba(0, 0, 0, 0.06)` | `rgba(0, 0, 0, 0.06)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=read-only, Progress=none`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=info-strong, Progress=none`) | `rgba(145, 208, 255, 1)` | `rgba(145, 208, 255, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=success, Progress=none`) | `rgba(175, 254, 191, 1)` | `rgba(175, 254, 191, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=critical-strong, Progress=none`) | `rgba(199, 10, 36, 1)` | `rgba(199, 10, 36, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=info, Progress=none`) | `rgba(213, 235, 255, 1)` | `rgba(213, 235, 255, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=magic, Progress=none`) | `rgba(233, 229, 255, 1)` | `rgba(233, 229, 255, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=critical, Progress=none`) | `rgba(254, 209, 215, 1)` | `rgba(254, 209, 215, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=warning-strong, Progress=none`) | `rgba(255, 184, 0, 1)` | `rgba(255, 184, 0, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=warning, Progress=none`) | `rgba(255, 214, 164, 1)` | `rgba(255, 214, 164, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=attention-strong, Progress=none`) | `rgba(255, 230, 0, 1)` | `rgba(255, 230, 0, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=attention, Progress=none`) | `rgba(255, 235, 120, 1)` | `rgba(255, 235, 120, 1)` | match |  |
| root | background-color | 4 cells (e.g. `Tone=success-strong, Progress=none`) | `rgba(4, 123, 93, 1)` | `rgba(4, 123, 93, 1)` | match |  |
| root | border-bottom-left-radius | 56 cells (e.g. `Tone=info, Progress=none`) | `8px` | `8px` | 0 |  |
| root | border-bottom-right-radius | 56 cells (e.g. `Tone=info, Progress=none`) | `8px` | `8px` | 0 |  |
| root | border-top-left-radius | 56 cells (e.g. `Tone=info, Progress=none`) | `8px` | `8px` | 0 |  |
| root | border-top-right-radius | 56 cells (e.g. `Tone=info, Progress=none`) | `8px` | `8px` | 0 |  |
| root | border-width | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
| root | gap | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `normal` | 0 |  |
| root | padding-bottom | 56 cells (e.g. `Tone=info, Progress=none`) | `2px` | `2px` | 0 |  |
| root | padding-left | 56 cells (e.g. `Tone=info, Progress=none`) | `8px` | `8px` | 0 |  |
| root | padding-right | 56 cells (e.g. `Tone=info, Progress=none`) | `8px` | `8px` | 0 |  |
| root | padding-top | 56 cells (e.g. `Tone=info, Progress=none`) | `2px` | `2px` | 0 |  |
| icon | background-color | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| icon | border-bottom-left-radius | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `0px` | 0 |  |
| icon | border-bottom-right-radius | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `0px` | 0 |  |
| icon | border-top-left-radius | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `0px` | 0 |  |
| icon | border-top-right-radius | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `0px` | 0 |  |
| icon | border-width | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `0px` | 0 |  |
| icon | gap | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `normal` | 0 |  |
| icon | padding-bottom | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `0px` | 0 |  |
| icon | padding-left | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `0px` | 0 |  |
| icon | padding-right | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `0px` | 0 |  |
| icon | padding-top | 42 cells (e.g. `Tone=info, Progress=incomplete`) | `0px` | `0px` | 0 |  |
| label | background-color | 56 cells (e.g. `Tone=info, Progress=none`) | `rgba(0, 0, 0, 0)` | `rgba(0, 0, 0, 0)` | match |  |
| label | border-bottom-left-radius | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
| label | border-bottom-right-radius | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
| label | border-top-left-radius | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
| label | border-top-right-radius | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
| label | border-width | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
| label | color | 4 cells (e.g. `Tone=info-strong, Progress=none`) | `rgba(0, 33, 51, 1)` | `rgba(0, 33, 51, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=info, Progress=none`) | `rgba(0, 58, 90, 1)` | `rgba(0, 58, 90, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=success, Progress=none`) | `rgba(1, 75, 64, 1)` | `rgba(1, 75, 64, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=critical, Progress=none`) | `rgba(142, 11, 33, 1)` | `rgba(142, 11, 33, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=success-strong, Progress=none`) | `rgba(250, 255, 251, 1)` | `rgba(250, 255, 251, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=critical-strong, Progress=none`) | `rgba(255, 250, 251, 1)` | `rgba(255, 250, 251, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=warning-strong, Progress=none`) | `rgba(37, 26, 0, 1)` | `rgba(37, 26, 0, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=enabled, Progress=none`) | `rgba(48, 48, 48, 1)` | `rgba(48, 48, 48, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=attention-strong, Progress=none`) | `rgba(51, 46, 0, 1)` | `rgba(51, 46, 0, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=attention, Progress=none`) | `rgba(79, 71, 0, 1)` | `rgba(79, 71, 0, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=magic, Progress=none`) | `rgba(87, 0, 209, 1)` | `rgba(87, 0, 209, 1)` | match |  |
| label | color | 4 cells (e.g. `Tone=warning, Progress=none`) | `rgba(94, 66, 0, 1)` | `rgba(94, 66, 0, 1)` | match |  |
| label | color | 8 cells (e.g. `Tone=new, Progress=none`) | `rgba(97, 97, 97, 1)` | `rgba(97, 97, 97, 1)` | match |  |
| label | font-size | 56 cells (e.g. `Tone=info, Progress=none`) | `12px` | `12px` | 0 |  |
| label | gap | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `normal` | 0 |  |
| label | line-height | 56 cells (e.g. `Tone=info, Progress=none`) | `16px` | `16px` | 0 |  |
| label | padding-bottom | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
| label | padding-left | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
| label | padding-right | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
| label | padding-top | 56 cells (e.g. `Tone=info, Progress=none`) | `0px` | `0px` | 0 |  |
