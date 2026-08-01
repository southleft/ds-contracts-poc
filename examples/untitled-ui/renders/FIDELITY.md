# Canvas→code fidelity — 2026-08-01 @ HEAD

Score = % pixels within tolerance. v2.0 clips the render to the UNION bounding box of the root and all its VISIBLE descendants (clamped to the viewport, +8px margin) instead of the root's border box: absolutely-positioned overflow — the slider's and progress bar's floating value tooltips, a badge hanging off a corner — used to be cropped out of the screenshot before scoring, so a variant that drew it correctly was measured against a reference that shows it and a render that could not. The union is a deliberate superset (an overflow:hidden ancestor clips visually, not geometrically); surplus white is removed by the trim that follows, whereas ink destroyed at render time was unrecoverable. v2.0 CHANGES THE DENOMINATOR of every number below — it is not comparable to a v1.3 table; `FIDELITY_CLIP=root` reproduces the v1.3 harness (fidelity-v13.json). Both images are then content-trimmed and normalized to a common 200px box (canvas ref up to 2x export vs standalone render; v1.3 trims margins — unequal margins misaligned every pixel). v1.2: unknown axes consumed generically; axis-not-carried counts variants unrenderable because the inversion dropped their axis (genuine carriage losses only); state=disabled scores through the contract's disabled boolean; state=hover|focus variants are interaction-state (CSS-rendered, not statically scorable). Trend metric, not the final gate.

| component | variants scored | mean fidelity % | axis-not-carried | interaction-state | unscored |
|---|---|---|---|---|---|
| badge-base | 8 | 94.4 | 0 | 0 | 0 |
| button-base | 20 | 88.8 | 0 | 0 | 0 |
| toggle-base | 16 | 98.7 | 0 | 16 | 0 |
| dropdown-list-item | 12 | 76.7 | 0 | 12 | 0 |
| input-field-base | 10 | 85.1 | 0 | 0 | 0 |
| avatar-group | 12 | 89.3 | 0 | 0 | 0 |
| tooltip | 28 | 81.1 | 0 | 0 | 0 |
| slider | 40 | 92.9 | 0 | 0 | 0 |
| progress-bar | 55 | 93.4 | 0 | 0 | 0 |
| progress-circle | 16 | 86.5 | 4 | 0 | 0 |
| avatar | 162 | 82.7 | 0 | 0 | 0 |
| avatar-label-group | 12 | 87.0 | 0 | 24 | 0 |
| avatar-add-button | 6 | 94.9 | 0 | 6 | 0 |
| button-group-base | 32 | 79.5 | 0 | 0 | 0 |
| social-button | 108 | 88.5 | 0 | 0 | 0 |
| **ALL** | 537 | **86.7** | | | |
