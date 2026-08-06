# Live Figma receipt — `button` (`mui.button`)

Status: **completed**. Playbook: [../../LIVE.md](../../LIVE.md).

## Session

| Field | Value |
|---|---|
| fileKey | `59mLQlOMiD5w5za6SUcoO5` |
| fileName | MUI Test 1 |
| componentSet node id | `21:287` |
| controlled variant node id | `21:137` |
| controlled part node id | `21:137` |
| run | exact-conversion-finish-wave2 |

## Steps

- [x] `emit-apply` — components already present in MUI Test 1 (pilot kit from bundle/genesis); set counts match compile receipt expectations
- [x] `dump-readback` — live fingerprint dump → `dump.readback.json` (`dumpVersion: live-fingerprint-1`)
- [x] `controlled-edit` — detached `paddingTop` on `Variant=Text, Color=Primary, Size=Medium, State=Default`, literal 6→8
- [x] `detect-drift` — named: `paddingTop` unbound (`imported/button/root/padding-top/text/medium` → null) and padding drifted
- [x] `restore` — rebound `imported/button/root/padding-top/text/medium`; padding 6; `restored=true`
- [x] `compare-offline` — `npm run mui:oracle:offline` → 30 MATCH · 2 PENDING · 0 FAIL; stem facts MATCH (no live-only defects)

## Offline vs live

- Offline command: `npm run mui:oracle:offline`
- Offline report: `examples/mui/oracle/report.json` / `REPORT.md`
- Agreement: **true**
- Notes: PENDING facts are TextField `awaiting-seed` only — outside `liveSessionMinimum`.

## Live-only defects

None.

## Machine receipt

See [receipt.json](./receipt.json) and [edit-restore.json](./edit-restore.json).
