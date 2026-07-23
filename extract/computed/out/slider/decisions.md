# Decisions ledger — Slider contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| root.color | base | `{color-text-secondary}` | `{color-on-light}` | `rgba(0, 0, 0, 1)` | `rgba(78, 96, 111, 1)` | 6 |
| root.gap | base | `{spacing-2}` | `{spacing-1}` | `4px` | `8px` | 12 |
| root.font-size | base | `{font-size-xs}` | `{spacing-4}` | `16px` | `10px` | 6 |

## Named causes

- **root.color** (6 items): UNTRIAGED — a defect until triaged
- **root.gap** (12 items): UNTRIAGED — a defect until triaged
- **root.font-size** (6 items): UNTRIAGED — a defect until triaged

