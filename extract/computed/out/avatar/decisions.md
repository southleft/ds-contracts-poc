# Decisions ledger — Avatar contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| initials.font-size | base | `{p.font-size-400}` | `{p.font-size-325}` | `13px` | `16px` | 5 |

## Named causes

- **initials.font-size** (5 items): content-conditioned element: .Polaris-Avatar__Text { font-size: var(--p-font-size-400) } styles the Text element Polaris renders only when initials/name are given; the default mount renders the empty .Polaris-Avatar__Initials wrapper, which inherits the provider's body typography (html,body { font-size: var(--p-font-size-325) } = 13px). Computed truth wins: resolve to the unique DTCG candidate {p.font-size-325}; the initials-present branch stays named residue (no contract channel can be a function of a text prop's value — the standing Avatar refusal class).

