# Canvas→code fidelity — 2026-07-31 @ HEAD

Score = % pixels within tolerance, both images normalized to a common 200px box (canvas ref up to 2x export vs standalone render). v1.1: unknown axes consumed generically; axis-not-carried counts variants unrenderable because the inversion dropped their axis. Trend metric, not the final gate.

| component | variants scored | mean fidelity % | axis-not-carried | unscored |
|---|---|---|---|---|
| badge-base | 8 | 85.1 | 0 | 0 |
| button-base | 20 | 58.1 | 0 | 0 |
| toggle-base | 4 | 100.0 | 28 | 0 |
| dropdown-list-item | 6 | 96.2 | 18 | 0 |
| input-field-base | 10 | 86.5 | 0 | 0 |
| avatar-group | 12 | 59.8 | 0 | 0 |
| tooltip | 28 | 68.0 | 0 | 0 |
| slider | 40 | 91.0 | 0 | 0 |
| progress-bar | 55 | 92.5 | 0 | 0 |
| progress-circle | 16 | 72.4 | 4 | 0 |
| **ALL** | 199 | **81.4** | | |
