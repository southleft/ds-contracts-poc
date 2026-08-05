# Live Figma canvas-variant drift receipt

Recorded 2026-08-05 against the repository's current v6 fingerprint source.

## Baseline

- File: `MUI Test 1` (`59mLQlOMiD5w5za6SUcoO5`)
- Component: `Tooltip` (`21:810`, contract `mui.tooltip`)
- Controlled part: `label` (`21:811`)
- Prior stamp: `v5:4163076382`
- v6 baseline stamp: `v6:1221797663`
- Baseline snapshot lines: 34
- Baseline visual: 72.5781 × 21, label left padding 8, bound to
  `imported/tooltip/label/padding-left`

The v6 baseline was computed in the live Desktop Bridge session with the
canonical `core/canvas-fingerprint.ts` algorithm and the file's local variable
IDs resolved to slash-form variable names.

## Controlled edit

The label's left padding was changed from 8 to 12. Figma detached the
`paddingLeft` variable binding as part of the direct edit.

The same-session live recompute produced `v6:3862784918`, which differed from
the stamped `v6:1221797663`. The changed facts were:

```text
/0:FRAME/label|layout
  HORIZONTAL MIN/MIN gap 0 pad 4,8,4,8
  →
  HORIZONTAL MIN/MIN gap 0 pad 4,8,4,12

/0:FRAME/label|bound:paddingLeft
  imported/tooltip/label/padding-left
  →
  (removed)
```

This proves the real Figma runtime detects both the visible layout edit and the
meaning-changing variable detach. The result does not depend on mock geometry.

## Restoration

The label padding was restored to 8 and rebound to
`imported/tooltip/label/padding-left` (`VariableID:15:1224`). A final full
recompute returned `v6:1221797663` with zero changed or removed snapshot lines.
Before/edit/after screenshots were captured through the Desktop Bridge; the
final visual matched the baseline.

The component remains visually unchanged and clean under a v6 stamp. No token,
credential, file content, or private API response is included in this receipt.
