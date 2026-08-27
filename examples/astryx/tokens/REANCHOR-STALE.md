# Re-anchoring rows that could NOT be re-applied — FC-THEME-BASE

Regenerate: `npx tsx examples/astryx/scripts/promote-floor.ts`.

7 of 36 acked row(s) (28 leaf/leaves) did not re-apply against the
freshly captured minted tree. Each of those leaves ships as the LITERAL the capture
measured. Nothing here is wrong — the values are the measured truth — but those leaves
no longer follow light/dark mode, which is exactly what the re-anchoring bought.

## Why (measured, not inferred)

The capture mount renders under `<Theme theme={neutralTheme}>` (`@astryxdesign/theme-neutral`,
the library's documented Quick Start and the only mount where the base font resolves).
`tokens/astryx.dtcg.json` is wrapped from `@astryxdesign/core/src/theme/tokens.stylex.ts` —
the CORE DEFAULT palette. They are different themes:

| token | core default (the DTCG base) | @astryxdesign/theme-neutral (what the capture renders) |
|---|---|---|
| `--color-accent` | `#0064E0` | `#262626` |
| `--color-text-primary` | `#0A1317` | `#171717` |
| `--color-background-blue` | `#0171E333` | `#c4ddfb` |
| `--color-error` | `#E3193B` | `#a50c25` (button label) |

A value-identity join cannot bridge two palettes, so these rows have no target to
alias onto. Re-writing their acked literals in place would be the "silent no-op
dressed as the fix" `reanchor-minted.ts:assertNeutralAnchor` exists to refuse.
THE DECISION THIS NEEDS IS A HUMAN ONE: either re-base the astryx token layer onto
`@astryxdesign/theme-neutral` (and re-run `--propose` so the role choices re-join),
or mount the capture under the core default plane (and lose the base font again).

## The rows

| ids | acked target | acked literal | why it did not apply |
|---|---|---|---|
| `RA-ffffff` | `color-on-error` | `#ffffff` | leaf imported.button.label.color.destructive measured #a50c25, ledger acked #ffffff; leaf imported.button.part-0.color.destructive measured #a50c25, ledger acked #ffffff; leaf imported.button.part-1.color.destructive measured #a50c25, ledger acked #ffffff; leaf imported.button.root.color.destructive measured #a50c25, ledger acked #ffffff; leaf imported.button.root.outline-color.destructive measured #a50c25, ledger acked #ffffff |
| `RA-171717,RA-0a1317` | `color-text-primary` | `#171717` | leaf imported.slider.label-3.color is absent from the freshly minted tree |
| `RA-262626,RA-0064e0` | `color-accent` | `#262626` | leaf imported.badge.root.background-color.info measured #0074e2, ledger acked #262626 |
| `RA-0a1317` | `color-background-inverted` | `#0a1317` | leaf imported.slider.tooltip.background-color measured #171717, ledger acked #0a1317 |
| `RA-a50c25,RA-e3193b` | `color-error` | `#a50c25` | leaf imported.badge.root.background-color.error measured #e33f4a, ledger acked #a50c25; leaf imported.button.root.background-color.destructive measured #facecb, ledger acked #a50c25 |
| `RA-007004,RA-0d8626` | `color-success` | `#007004` | leaf imported.badge.root.background-color.success measured #198100, ledger acked #007004 |
| `RA-745b00,RA-e9af08` | `color-warning` | `#745b00` | leaf imported.badge.root.background-color.warning measured #ffce2f, ledger acked #745b00 |
