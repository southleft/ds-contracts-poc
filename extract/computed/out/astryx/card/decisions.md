# Decisions ledger — Card contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| root.color | base | `{color-text-primary}` | `{color-on-light}` | `rgba(0, 0, 0, 1)` | `rgba(10, 19, 23, 1)` | 13 |
| root.padding-block | axis:variant=default | `{spacing-4}` | `15px` | `15px` | `16px` | 2 |
| root.padding-inline | axis:variant=default | `{spacing-4}` | `15px` | `15px` | `16px` | 2 |
| root.font-size | base | `{font-size-base}` | `16px` | `16px` | `14px` | 13 |

## Named causes

- **root.color** (13 items): UNTRIAGED — a defect until triaged
- **root.padding-block** (2 items): UNTRIAGED — a defect until triaged
- **root.padding-inline** (2 items): UNTRIAGED — a defect until triaged
- **root.font-size** (13 items): UNTRIAGED — a defect until triaged

