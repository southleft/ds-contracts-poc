# Decisions ledger — Button contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| root.gap | base | `{spacing-1}` | `{spacing-2}` | `8px` | `4px` | 24 |
| root.font-size | base | `{font-size-sm}` | `{font-size-base}` | `14px` | `12px` | 12 |
| root.font-weight | base | `{font-weight-semibold}` | `{font-weight-medium}` | `500` | `600` | 12 |
| root.padding-block | axis:size=lg|sm | `{spacing-1}` | `{spacing-2}` | `8px` | `4px` | 16 |
| root.padding-inline | axis:size=lg|sm | `{spacing-2}` | `{spacing-3}` | `12px` | `8px` | 16 |
| root.background-color | axis:variant=secondary | `{color-background-muted}` | `{color-neutral}` | `rgba(5, 54, 89, 0.1)` | `rgba(5, 54, 89, 0.047)` | 3 |

## Named causes

- **root.gap** (24 items): UNTRIAGED — a defect until triaged
- **root.font-size** (12 items): UNTRIAGED — a defect until triaged
- **root.font-weight** (12 items): UNTRIAGED — a defect until triaged
- **root.padding-block** (16 items): UNTRIAGED — a defect until triaged
- **root.padding-inline** (16 items): UNTRIAGED — a defect until triaged
- **root.background-color** (3 items): UNTRIAGED — a defect until triaged

