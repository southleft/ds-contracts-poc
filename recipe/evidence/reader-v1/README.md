# Reader v1 — side-by-side review sheet (docs/35 Phase 1)

> No Figma writes were made for this artifact (page exports are read-only via
> the local Desktop Bridge). No grade is minted. `overallSuccess` stays false.
> Product **v1 remains INCOMPLETE**.

Open [`index.html`](index.html) in a browser from a checkout — it references
the committed real-package Chromium screenshots
(`extract/computed/out/<lib>/<component>/orig-shots/`, the `--keep-originals`
artifacts of the capture runs that produced the fixture-drift ledgers)
relative to the repo tree, beside read-only PNG exports of the latest minted
Figma v3 pages:

| page | node | export |
|---|---|---|
| Recipe Pivot / Checkbox / 548cf953-…-checkbox-v3 | `198:77718` | `figma-checkbox-v3-198-77718.png` |
| Recipe Pivot / Textarea / 71033c6d-…-textarea-v3 | `198:77456` | `figma-textarea-v3-198-77456.png` |

The per-fact machine verdicts live in
[`recipe/fixture-reader/out/DRIFT-REPORT.md`](../../fixture-reader/out/DRIFT-REPORT.md)
(gate: `npm run recipe:fixture-drift:check`). Headline: 172 facts match,
35 drift rows carried by name (34 = the Astryx theme-mount divergence, 1 =
the antd indeterminate-dash lowering), 75 named receipts, 0 unread, 0 silent.
