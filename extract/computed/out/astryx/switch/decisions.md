# Decisions ledger — Switch contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| root.color | base | `{color-text-primary}` | `{color-on-light}` | `rgba(0, 0, 0, 1)` | `rgba(10, 19, 23, 1)` | 2 |
| root.font-size | base | `{font-size-sm}` | `16px` | `16px` | `12px` | 2 |

## Named causes

- **root.color** (2 items): UNTRIAGED — a defect until triaged
- **root.font-size** (2 items): UNTRIAGED — a defect until triaged

