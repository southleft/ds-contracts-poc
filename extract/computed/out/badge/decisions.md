# Decisions ledger — Badge contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| root.padding-block | base | `{spacing-0-5}` | `{spacing-0}` | `0px` | `2px` | 28 |
| root.font-size | base | `{font-size-xs}` | `{font-size-sm}` | `12px` | `10px` | 14 |

## Named causes

- **root.padding-block** (28 items): UNTRIAGED — a defect until triaged
- **root.font-size** (14 items): UNTRIAGED — a defect until triaged

