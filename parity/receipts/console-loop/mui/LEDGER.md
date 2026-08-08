# Console-loop ledger — MUI Test 1

File: https://www.figma.com/design/59mLQlOMiD5w5za6SUcoO5/MUI-Test-1  
Denominator: `examples/mui/oracle/DENOMINATOR-50.json` (31 members)  
Transport: Figma Console MCP `figma_execute` + clientStorage chunk upload  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Completed | **31/31** |
| Failed | 0 |
| Existing (receipted in place) | 14 |
| Generated this session | 17 |

Gate: `npm run console-loop:mui:evidence:check`  
Eval: `console-loop-mui-evidence-receipt`

## 2026-08-08 — strict-lane conversion (J8: measured visual evidence)

31/31 stems pixel-scored headlessly (REST images API, scale-1 VARIANT cell vs
committed developed refs under `refs/`; MUI Test 1 was not open on the
Desktop Bridge, so this is the REST-only instrument). `fab`, `icon-button`,
`radio`, `select` had no gate-shots — regated offline
(`npm run extract:computed:regate -- --config extract/computed/configs/mui.json --out extract/computed/out/mui --component <Name>`)
to produce them; `table-pagination`'s reference lives in
`extract/computed/out/mui/pagination/` (stem-name mismatch previously hid it).

| Result | Count |
|---|---|
| scored-pass (both instruments) | **4** — checkbox 0.00, divider 0.00, table 2.08, snackbar 2.09 |
| fail-closed (named defects) | 27 |
| RATCHET floor seeded | 4 |

`alert` passes the lane scorer (4.50 after dpr+size normalization) but fails
the headless card (6.49) — instruments disagree, so it stays fail-closed with
the disagreement named. Gate flipped attested-only → STRICT
(`scripts/console-loop-mui-evidence-check.mjs`); attested claims are now
impossible in this lane.
