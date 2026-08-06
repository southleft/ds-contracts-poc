# Live Figma canvas-variant drift receipt

Recorded 2026-08-06 against `DS-Contracts-Testing` using the repository's
canonical v6 fingerprint (`core/canvas-fingerprint.ts`).

Machine twin: [live-figma-variant-drift.json](./live-figma-variant-drift.json)  
Console MCP replay scripts: [console-mcp/](./console-mcp/)

## Baseline

- File: `DS-Contracts-Testing` (`GnQnjSNBXtgtd2Ht0Hs1C8`)
- Component: `Tooltip` (`2:6`)
- Controlled part: `label` (`2:4`)
- Variable: `tooltip/label/padding-left` (`VariableID:2:3`)
- v6 baseline stamp: `v6:3552508208`
- Baseline snapshot lines: 13
- Baseline: label left padding 8, bound to `tooltip/label/padding-left`

Transport note: this session executed Plugin API JS through the official Figma
MCP `use_figma` because the cloud agent had no Figma Console MCP attached.
`figma_execute` (Console MCP / Desktop Bridge) is the equivalent transport —
replay scripts under `console-mcp/` are written for that path.

## Controlled edit

The label's left padding was changed from 8 to 12. Figma detached the
`paddingLeft` variable binding as part of the direct edit.

Live recompute produced `v6:4062076634`, which differed from the stamped
`v6:3552508208`. The changed facts were:

```text
/0:FRAME/label|layout
  HORIZONTAL MIN/MIN gap 0 pad 4,8,4,8
  →
  HORIZONTAL MIN/MIN gap 0 pad 4,8,4,12

/0:FRAME/label|bound:paddingLeft
  tooltip/label/padding-left
  →
  (removed)
```

This proves the real Figma runtime detects both the visible layout edit and the
meaning-changing variable detach. The result does not depend on mock geometry.

## Restoration

The label padding was restored to 8 and rebound to
`tooltip/label/padding-left` (`VariableID:2:3`). A final full recompute returned
`v6:3552508208` with zero residual fingerprint drift. Final visual matched the
baseline.

The component remains visually unchanged and clean under a v6 stamp. No token,
credential, file content, or private API response is included in this receipt.
