# Figma Console MCP — live drift probe scripts

These scripts are for **Figma Console MCP** (`figma_execute` via Desktop Bridge
at `node …/figma-console-mcp/dist/local.js`). They replay the V1-EVID-04
edit→detect→restore probe against
[DS-Contracts-Testing](https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing).

## Prerequisites

1. Open the testing file in **Figma Desktop**.
2. Run **Figma Desktop Bridge** (Console MCP companion plugin) — status `Local · ready`.
3. Ensure Console MCP is enabled in Cursor (`figma_get_status` → connected).
4. Navigate: `figma_navigate` to the testing file URL if needed.

## Sequence

| Step | Tool | Script |
|---|---|---|
| 0 | `figma_get_status` / `figma_list_open_files` | confirm bridge + file |
| 1 | `figma_execute` | `01-seed-or-inspect.js` |
| 2 | `figma_execute` | `02-baseline-fingerprint.js` → record stamp |
| 3 | `figma_execute` | `03-controlled-edit.js` |
| 4 | `figma_execute` | `04-detect-drift.js` → must differ + unbound |
| 5 | `figma_execute` | `05-restore.js` → must match baseline |
| 6 | repo | `npm run live-figma:evidence:check` |

Scripts discover `Tooltip` / `label` by name (node IDs churn across re-seeds).
If inspect reports `tooltip: null`, re-seed via `figma_execute` (see receipt
narrative) before step 2. Variable `tooltip/label/padding-left` may already
exist (`VariableID:2:3` on the 2026-08-06 file).

## Eval surface

Committed evidence is gated by:

```bash
npm run live-figma:evidence:check
npm run variant-drift:check   # offline half of V1-EVID-04
npm run human-gates:inventory # remaining human-only rows (report)
```
