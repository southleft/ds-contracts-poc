# Decisions ledger — Button contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| label.font-weight | axis:variant=primary | `{p.font-weight-medium}` | `{p.font-weight-semibold}` | `650` | `550` | 12 |

## Named causes

- **label.font-weight** (12 items): composition-owned typography: the primary variant label renders Text fontWeight 650 (semibold); the carried binding is font-weight-medium (550) — same composition-owned class

