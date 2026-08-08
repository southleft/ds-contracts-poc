# Wave 11 — Governance / second-impl path

- Status: **started (plan only)**
- Depends on: Wave 9 `spec/` draft; a second independent implementation
- Disposition target: READY only when a second impl exercises `spec/conformance/`

## Goal

Turn the Wave 9 draft into a governance surface: normative claims that a second implementation can pass or fail without sharing this repo's TypeScript emitters.

## Non-goals

- Do not treat Wave 10 human release gates as Wave 11 work
- Do not shrink accuracy denominators
- Do not invent a second impl in-tree as a rubber stamp

## Entry criteria (all must hold)

1. Wave 9 `spec/normative.md` + `spec/conformance/README.md` still present
2. Committed eval suite green (`188/188` or later N/N)
3. At least one external or sibling implementation identified (owner + language)

## Work packages

| ID | Work | Exit |
|---|---|---|
| W11-A | Freeze a minimal normative subset (IDs + MUST/MUST NOT) from `spec/normative.md` | Tagged subset list in `spec/conformance/` |
| W11-B | Package fixture contracts + expected refuse/pass receipts for that subset | Runnable kit without this monorepo's CLI |
| W11-C | Second-impl dry run (even if partial) with named gaps | Report under `.agents/runs/.../wave11/` |
| W11-D | Governance README: how claims graduate from draft → normative | `spec/README.md` update |

## Sequencing note

Wave 11 is **blocked on second-impl availability**, not on further ECF automation. Until a second impl exists, keep disposition **BLOCKED** and only advance W11-A/B packaging.
