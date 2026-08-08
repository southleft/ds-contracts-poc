# MUI oracle — live session receipts

Scaffold for `corpus.liveSessionMinimum` stems: **button**, **switch**,
**table**. Playbook: [../LIVE.md](../LIVE.md).

## Layout

```text
live/
  README.md                 ← this file
  receipt.schema.json       ← machine schema for receipt.json
  button/
    RECEIPT.md              ← human narrative (template until filled)
    receipt.json            ← machine receipt (status: template until filled)
  switch/
    …
  table/
    …
```

Optional session artifacts (local OK; do not commit secrets / full private
API dumps unless redacted):

- `dump.readback.json` — output of `extract/figma/dump.plugin.js`
- `mcp/` — output of `npm run extract:figma:mcp -- …` (see
  `extract/figma/mcp/README.md` and committed receipt pattern
  `extract/figma/mcp/RECEIPT.md`)

## Filling a receipt

1. Follow [../LIVE.md](../LIVE.md) for one stem.
2. Set `receipt.json` `"status"` from `template` → `in-progress` →
   `completed`.
3. Record `session.fileKey` (redacted OK), optional `nodeIds`, and tick
   `stepsCompleted` through `compare-offline`.
4. Set `offlineVsLive.agreement` after `npm run mui:oracle:offline`.
5. Any `liveOnlyDefects[]` entry **must** include `headlessReproduction`
   before a fix is accepted. The checker fails if `agreement: true` while a
   defect lacks that field.
6. Mirror the narrative in `RECEIPT.md` (same facts as
   `parity/receipts/live-figma-variant-drift.md`).

## Validate

```bash
npm run mui:oracle:live:check
```

- No completed receipts yet (all missing or `status: "template"`) → exit **0**
  with `no live receipts yet`.
- Completed receipts → schema + agreement/defect gate.

## Do not

- Seed TextField / SpeedDial here.
- Claim agreement for dump-dependent PENDING offline channels without a dump.
- Weaken accuracy baselines to make live green.
