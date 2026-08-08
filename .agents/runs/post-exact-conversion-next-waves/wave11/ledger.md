# Wave 11 — packaging ledger

- Updated: 2026-08-05
- Disposition: **BLOCKED** (second impl) · packaging **READY** for A/B/D

## Done

| ID | Artifact |
|---|---|
| W11-A | `spec/conformance/subset-v0.1.json` — 14 MUST/MUST NOT IDs + 11 fixtures (all four dispositions) |
| W11-B | `spec/conformance/harness.md` + `fixture-index-v0.1.json` + `check-subset.ts` + `npm run spec:conformance:subset:check` |
| W11-D | `spec/README.md` Draft → Candidate → Normative graduation table |

## Still blocked

| ID | Need |
|---|---|
| W11-C | Named second implementation + harness report (even partial, with gaps listed) |

## Verify

```bash
npm run spec:conformance:subset:check
```
