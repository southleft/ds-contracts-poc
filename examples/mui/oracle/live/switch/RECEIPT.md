# Live Figma receipt — `switch` (`mui.switch`)

Status: **completed**. Playbook: [../../LIVE.md](../../LIVE.md).

## Session

| Field | Value |
|---|---|
| fileKey | `59mLQlOMiD5w5za6SUcoO5` |
| fileName | MUI Test 1 |
| componentSet node id | `21:624` |
| controlled variant node id | `21:512` |
| controlled part node id | `21:512` |
| run | exact-conversion-finish-wave2 |

## Steps

- [x] `emit-apply` — components already present in MUI Test 1 (pilot kit from bundle/genesis); set counts match compile receipt expectations
- [x] `dump-readback` — live fingerprint dump → `dump.readback.json` (`dumpVersion: live-fingerprint-1`)
- [x] `controlled-edit` — detached `paddingTop` on `Color=Primary, Size=Medium, Checked=Unchecked`, literal 12→14
- [x] `detect-drift` — named: `paddingTop` unbound (`imported/switch/root/padding-top/medium` → null) and padding drifted
- [x] `restore` — rebound `imported/switch/root/padding-top/medium`; padding 12; `restored=true`
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
