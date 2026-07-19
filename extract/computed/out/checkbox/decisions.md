# Decisions ledger — Checkbox contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| backdrop.border-width | base | `{p.border-width-0165}` | `{p.border-width-0}` | `0px` | `1px` | 1 |

## Named causes

- **backdrop.border-width** (1 items): cross-component zeroing (the showcase's own named Checkbox gap, now measured): Polaris's Choice wrapper CSS zeroes the checkbox backdrop border and repaints the control edge as an inset box-shadow, so the carried Checkbox.module.css border-width binding loses the cascade — computed border-width is 0. Computed truth wins: resolve via the review queue (--to {p.border-width-0}; several zero-valued tokens share 0px, border-width-0 is the exact name-class match). The edge itself rides the minted box-shadow channel.

