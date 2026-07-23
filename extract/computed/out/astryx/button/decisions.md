# Decisions ledger — Button contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| part-0.font-size | base | `{imported.shared.size-14}` | `{font-size-base}` | `14px` | `16px` | 12 |
| part-0.font-weight | base | `{imported.shared.num-500}` | `{font-weight-medium}` | `500` | `400` | 12 |
| label.font-size | base | `{imported.shared.size-14}` | `{font-size-base}` | `14px` | `16px` | 12 |
| label.font-weight | base | `{p.font-weight-semibold}` | `{font-weight-medium}` | `500` | `400` | 12 |
| part-1.font-size | base | `{imported.shared.size-14}` | `{font-size-base}` | `14px` | `16px` | 12 |
| part-1.font-weight | base | `{imported.shared.num-500}` | `{font-weight-medium}` | `500` | `400` | 12 |

## Named causes

- **part-0.font-size** (12 items): UNTRIAGED — a defect until triaged
- **part-0.font-weight** (12 items): UNTRIAGED — a defect until triaged
- **label.font-size** (12 items): UNTRIAGED — a defect until triaged
- **label.font-weight** (12 items): UNTRIAGED — a defect until triaged
- **part-1.font-size** (12 items): UNTRIAGED — a defect until triaged
- **part-1.font-weight** (12 items): UNTRIAGED — a defect until triaged

