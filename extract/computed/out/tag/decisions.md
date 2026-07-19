# Decisions ledger — Tag contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| label.line-height | base | `{p.text-body-sm-font-line-height}` | `{p.font-line-height-500}` | `20px` | `16px` | 1 |

## Named causes

- **label.line-height** (1 items): REAL STALE BINDING caught by the floor: Tag.module.css sets line-height {p.font-line-height-500} (20px) on its own inner .Polaris-Tag__Text span, overriding the carried Text-primitive bodySm chain (16px) the promotion bound; the showcase's verify.ts compared the Text root element, not the inner span the floor names `label` — resolve via the review queue (--to {p.font-line-height-500}; six tokens share the 20px value, so the explicit ref is required)

