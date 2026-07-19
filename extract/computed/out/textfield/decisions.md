# Decisions ledger — TextField contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| backdrop.border-width | axis:variant=borderless | `{p.border-width-0165}` | `{p.border-width-0}` | `0px` | `1px` | 2 |

## Named causes

- **backdrop.border-width** (2 items): variant-conditioned border removal: .Polaris-TextField--borderless sets border:none on the backdrop — computed border-width is 0 for the borderless variant while the carried base binding paints 1px on the inherit variant. Single-axis partition (variant) — resolve via the review queue (--to {p.border-width-0}; several zero-valued tokens share 0px, border-width-0 is the exact name-class match)

