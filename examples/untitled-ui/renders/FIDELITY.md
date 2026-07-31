# Canvas→code fidelity — 2026-07-31 @ HEAD

Score = % pixels within tolerance, both images normalized to a common 200px box (canvas ref up to 2x export vs standalone render). v1.2: unknown axes consumed generically; axis-not-carried counts variants unrenderable because the inversion dropped their axis (genuine carriage losses only); state=disabled scores through the contract's disabled boolean; state=hover|focus variants are interaction-state (CSS-rendered, not statically scorable). Trend metric, not the final gate.

| component | variants scored | mean fidelity % | axis-not-carried | interaction-state | unscored |
|---|---|---|---|---|---|
| badge-base | 8 | 85.1 | 0 | 0 | 0 |
| button-base | 20 | 58.1 | 0 | 0 | 0 |
| toggle-base | 16 | 93.6 | 0 | 16 | 0 |
| dropdown-list-item | 12 | 97.2 | 0 | 12 | 0 |
| input-field-base | 10 | 86.5 | 0 | 0 | 0 |
| avatar-group | 12 | 59.8 | 0 | 0 | 0 |
| tooltip | 28 | 68.0 | 0 | 0 | 0 |
| slider | 40 | 91.0 | 0 | 0 | 0 |
| progress-bar | 55 | 92.5 | 0 | 0 | 0 |
| progress-circle | 16 | 72.4 | 4 | 0 | 0 |
| **ALL** | 217 | **82.4** | | | |
