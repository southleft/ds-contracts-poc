# Foreign-runner harness (draft)

Report shape for implementations that do **not** import this repository's TypeScript engine.

## Invocation (suggested)

```text
dsc-conform --subset spec/conformance/subset-v0.1.json --report out/report.json
```

The runner MAY use any language. It MUST accept the frozen subset file and emit a JSON report matching the schema below.

## Report schema

```json
{
  "subsetId": "spec-conformance-subset-v0.1.1",
  "implementation": {
    "name": "string",
    "version": "string",
    "language": "string"
  },
  "results": [
    {
      "caseId": "border-radius-px",
      "expected": "CARRIED",
      "actual": "CARRIED",
      "pass": true,
      "notes": []
    }
  ],
  "summary": {
    "total": 11,
    "passed": 11,
    "failed": 0,
    "skipped": 0
  },
  "disclosures": [
    {
      "grammarRow": "optional free-text",
      "disposition": "UNSUPPORTED",
      "reason": "named — never silent"
    }
  ]
}
```

## Pass / fail rules

| Condition | Result |
|---|---|
| `actual === expected` for a fixture | pass |
| `actual !== expected` | fail |
| Case omitted from `results` | fail (skipped-as-green is forbidden — N-CONF-01) |
| Extra cases beyond the subset | MAY be reported; MUST NOT mask a missing required case |
| `UNSUPPORTED` without a disclosure when the fixture expects it | fail honesty check |

## Locating fixtures

Prefer [fixture-index-v0.1.json](./fixture-index-v0.1.json) — it lists `case` + `seed` paths for every frozen id.

For each `fixtures.cases[].id` in `subset-v0.1.json` (or each index row):

1. Read `conformance/cases/<id>/case.json` (expected disposition + construct prose).
2. Optionally mount `conformance/seeds/<id>.contract.json` if the implementation consumes contracts as input.
3. Do **not** require `extract/computed/*` or `core/*` — those are this engine's private path.

## Reference run (this repo only)

```bash
# Validates the frozen subset still matches conformance/MANIFEST.json
npx tsx spec/conformance/check-subset.ts

# Full CSS/DOM frontier (superset of the frozen cases)
npm run conformance
```
