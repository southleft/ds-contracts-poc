# Decisions ledger — Banner contradiction resolutions

Every entry is an EXPLICIT human ack (`extract/computed/resolve.ts --apply <ids>`).
The generated enriched.contract.json is never mutated; resolutions land in
resolved.contract.json. Evidence for every row lives in review-queue.json.

| part.channel | scope | from | to | observed (computed truth) | expected (stale binding) | queue items |
|---|---|---|---|---|---|---|
| root.background-color | base | `{p.color-bg-fill-success}` | `{p.color-bg-surface}` | `rgba(255, 255, 255, 1)` | `rgba(4, 123, 93, 1)` | 4 |
| root.color | base | `{p.color-text-success-on-bg-fill}` | `{p.color-text}` | `rgba(48, 48, 48, 1)` | `rgba(250, 255, 251, 1)` | 4 |

## Named causes

- **root.background-color** (4 items): composition-owned tone surface: Polaris 13's DefaultBanner renders the tone fill/text on an inner Box ribbon (Box background=bg-fill-<tone> color=text-<tone>-on-bg-fill — Banner/utilities.js bannerAttributes.withinPage), NOT on the .Polaris-Banner root where the promotion bound the tone maps; the root is the white card (.Polaris-Banner { background-color: var(--p-color-bg-surface) }) with body-inherited text (html,body { color: var(--p-color-text) }). Resolve via the review queue with explicit refs (--to {p.color-bg-surface} / {p.color-text} — mechanical: the defining CSS rules name the tokens; several tokens share the resolved values). The tone ribbon colors ride the minted per-axis leaves on the inner box part.
- **root.color** (4 items): composition-owned tone surface: Polaris 13's DefaultBanner renders the tone fill/text on an inner Box ribbon (Box background=bg-fill-<tone> color=text-<tone>-on-bg-fill — Banner/utilities.js bannerAttributes.withinPage), NOT on the .Polaris-Banner root where the promotion bound the tone maps; the root is the white card (.Polaris-Banner { background-color: var(--p-color-bg-surface) }) with body-inherited text (html,body { color: var(--p-color-text) }). Resolve via the review queue with explicit refs (--to {p.color-bg-surface} / {p.color-text} — mechanical: the defining CSS rules name the tokens; several tokens share the resolved values). The tone ribbon colors ride the minted per-axis leaves on the inner box part.

