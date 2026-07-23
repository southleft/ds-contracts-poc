# Decisions ledger — Badge contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| root.background-color | axis:variant=neutral | `{color-background-gray}` | `{color-neutral}` | `rgba(5, 54, 89, 0.1)` | `rgba(10, 19, 23, 0.2)` | 1 |
| root.background-color | axis:variant=info | `{color-background-blue}` | `{color-accent}` | `rgba(0, 100, 224, 1)` | `rgba(1, 113, 227, 0.2)` | 1 |
| root.background-color | axis:variant=success | `{color-background-green}` | `{color-success}` | `rgba(13, 134, 38, 1)` | `rgba(36, 187, 94, 0.2)` | 1 |
| root.background-color | axis:variant=warning | `{color-background-orange}` | `{color-warning}` | `rgba(233, 175, 8, 1)` | `rgba(242, 121, 2, 0.2)` | 1 |
| root.background-color | axis:variant=error | `{color-background-red}` | `{color-error}` | `rgba(227, 25, 59, 1)` | `rgba(227, 25, 59, 0.2)` | 1 |
| root.padding-block | base | `{spacing-0-5}` | `{spacing-0}` | `0px` | `2px` | 28 |
| root.font-size | base | `{font-size-xs}` | `{font-size-sm}` | `12px` | `10px` | 14 |
| root.color | axis:variant=error|info|success | `{color-text-blue}` | `{color-on-accent}` | `rgba(255, 255, 255, 1)` | `rgba(4, 47, 151, 1)` | 3 |
| root.color | axis:variant=warning | `{color-text-orange}` | `{color-on-warning}` | `rgba(10, 19, 23, 1)` | `rgba(107, 34, 3, 1)` | 1 |

## Named causes

- **root.background-color** (1 items): UNTRIAGED — a defect until triaged
- **root.background-color** (1 items): UNTRIAGED — a defect until triaged
- **root.background-color** (1 items): UNTRIAGED — a defect until triaged
- **root.background-color** (1 items): UNTRIAGED — a defect until triaged
- **root.background-color** (1 items): UNTRIAGED — a defect until triaged
- **root.padding-block** (28 items): UNTRIAGED — a defect until triaged
- **root.font-size** (14 items): UNTRIAGED — a defect until triaged
- **root.color** (3 items): UNTRIAGED — a defect until triaged
- **root.color** (1 items): UNTRIAGED — a defect until triaged

