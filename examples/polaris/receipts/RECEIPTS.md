# Receipts — contract-generated rendering vs Polaris's own rendering

Every PNG in this directory is a PAIR: **left = HTML+CSS generated from the committed
contract** (core/emit-html.ts + the wrapped Polaris token set), **right = the REAL
`@shopify/polaris@13.10.1` component** (the npm release of the pinned SHA) rendered by
React with Shopify's own stylesheet. Same headless Chromium, same 600×800 viewport
(sub-md: breakpoint-conditional styling stays at base values — @media is a named
refusal in PROMOTION.md), 2× scale.

The numbers are computed-style comparisons on the CHANNELS THE CONTRACT CARRIES —
exact string equality, no tolerance. "named refusal lines" counts the promotion
ledger's refusal LINES for the whole component — one styling fact can refuse in
several query contexts (base, per axis value, per state), so lines ≥ declarations;
every line is in extraction/PROMOTION.md.

| component | combos | rows compared | rows matched | mismatched | named refusal lines (PROMOTION.md) |
|---|---|---|---|---|---|
| `polaris.button` | 6 | 95 | 93 | 2 | 316 |
| `polaris.badge` | 1 | 11 | 11 | 0 | 38 |
| `polaris.banner` | 4 | 44 | 44 | 0 | 27 |
| `polaris.checkbox` | 1 | 6 | 6 | 0 | 502 |
| `polaris.radio-button` | 1 | 6 | 6 | 0 | 339 |
| `polaris.text-field` | 1 | 13 | 13 | 0 | 905 |
| `polaris.tag` | 1 | 9 | 9 | 0 | 43 |
| `polaris.avatar` | 3 | 27 | 15 | 12 | 46 |
| `polaris.spinner` | 2 | 4 | 4 | 0 | 8 |
| `polaris.progress-bar` | 6 | 36 | 36 | 0 | 29 |
| `polaris.text` | 4 | 17 | 17 | 0 | 15 |
| `polaris.thumbnail` | 2 | 8 | 8 | 0 | 49 |

## Mismatched rows (named, no tolerance)

### polaris.button

- `variant-plain` label.font-size — ours: `font-size: 12px` · theirs: `font-size: 13px`
  - NAMED CAUSE: Polaris upgrades plain/monochromePlain labels to bodyMd when size !== 'micro' (Button.tsx 179-182) — a two-axis condition, refused by name (mint-code discipline); the carried bodySm base renders on our side
- `variant-plain` label.line-height — ours: `line-height: 16px` · theirs: `line-height: 20px`
  - NAMED CAUSE: same two-axis plain/monochromePlain bodyMd branch as the font-size row — refused by name, carried base renders

### polaris.avatar

- `default` root.background — ours: `background-color: rgb(197, 48, 197)` · theirs: `background-color: rgb(253, 75, 146)`
  - NAMED CAUSE: Polaris hashes the provided name/initials ('TP' → styleFive) into one of seven palette classes that override the default — value-derived styling has no contract channel (named in PROMOTION.md); the carried binding is Polaris's own name-less default (styleOne, cited from Avatar.tsx styleClass), so ours renders the styleOne palette while Polaris renders the hashed styleFive one
- `default` root.color — ours: `color: rgb(253, 239, 253)` · theirs: `color: rgb(255, 246, 248)`
  - NAMED CAUSE: same name-hash palette selection as background — the cited default (styleOne) text color is carried; the hashed one is not derivable from a prop
- `default` initials.font-size — ours: `font-size: 13px` · theirs: `font-size: 16px`
  - NAMED CAUSE: content-conditioned typography measured by the computed floor (v0.2.0): the floor's default mount renders Avatar WITHOUT initials, so the initials wrapper inherits the provider's body font-size — the resolved binding {p.font-size-325} = 13px (decisions ledger, extract/computed/out/avatar/decisions.md); with initials provided (this combo's 'TP'), Polaris renders the svg text at font-size-400 (16px) — a branch conditioned on a text prop's VALUE, the same no-contract-channel class as the name-hash palette
- `default` initials.color — ours: `color: rgb(253, 239, 253)` · theirs: `color: rgb(255, 246, 248)`
  - NAMED CAUSE: same name-hash palette selection as the root rows — the initials text color follows the hashed styleFive palette; the carried styleOne default renders on our side
- `size-xs` root.background — ours: `background-color: rgb(197, 48, 197)` · theirs: `background-color: rgb(253, 75, 146)`
  - NAMED CAUSE: Polaris hashes the provided name/initials ('TP' → styleFive) into one of seven palette classes that override the default — value-derived styling has no contract channel (named in PROMOTION.md); the carried binding is Polaris's own name-less default (styleOne, cited from Avatar.tsx styleClass), so ours renders the styleOne palette while Polaris renders the hashed styleFive one
- `size-xs` root.color — ours: `color: rgb(253, 239, 253)` · theirs: `color: rgb(255, 246, 248)`
  - NAMED CAUSE: same name-hash palette selection as background — the cited default (styleOne) text color is carried; the hashed one is not derivable from a prop
- `size-xs` initials.font-size — ours: `font-size: 13px` · theirs: `font-size: 16px`
  - NAMED CAUSE: content-conditioned typography measured by the computed floor (v0.2.0): the floor's default mount renders Avatar WITHOUT initials, so the initials wrapper inherits the provider's body font-size — the resolved binding {p.font-size-325} = 13px (decisions ledger, extract/computed/out/avatar/decisions.md); with initials provided (this combo's 'TP'), Polaris renders the svg text at font-size-400 (16px) — a branch conditioned on a text prop's VALUE, the same no-contract-channel class as the name-hash palette
- `size-xs` initials.color — ours: `color: rgb(253, 239, 253)` · theirs: `color: rgb(255, 246, 248)`
  - NAMED CAUSE: same name-hash palette selection as the root rows — the initials text color follows the hashed styleFive palette; the carried styleOne default renders on our side
- `size-xl` root.background — ours: `background-color: rgb(197, 48, 197)` · theirs: `background-color: rgb(253, 75, 146)`
  - NAMED CAUSE: Polaris hashes the provided name/initials ('TP' → styleFive) into one of seven palette classes that override the default — value-derived styling has no contract channel (named in PROMOTION.md); the carried binding is Polaris's own name-less default (styleOne, cited from Avatar.tsx styleClass), so ours renders the styleOne palette while Polaris renders the hashed styleFive one
- `size-xl` root.color — ours: `color: rgb(253, 239, 253)` · theirs: `color: rgb(255, 246, 248)`
  - NAMED CAUSE: same name-hash palette selection as background — the cited default (styleOne) text color is carried; the hashed one is not derivable from a prop
- `size-xl` initials.font-size — ours: `font-size: 13px` · theirs: `font-size: 16px`
  - NAMED CAUSE: content-conditioned typography measured by the computed floor (v0.2.0): the floor's default mount renders Avatar WITHOUT initials, so the initials wrapper inherits the provider's body font-size — the resolved binding {p.font-size-325} = 13px (decisions ledger, extract/computed/out/avatar/decisions.md); with initials provided (this combo's 'TP'), Polaris renders the svg text at font-size-400 (16px) — a branch conditioned on a text prop's VALUE, the same no-contract-channel class as the name-hash palette
- `size-xl` initials.color — ours: `color: rgb(253, 239, 253)` · theirs: `color: rgb(255, 246, 248)`
  - NAMED CAUSE: same name-hash palette selection as the root rows — the initials text color follows the hashed styleFive palette; the carried styleOne default renders on our side

## Receipt chrome (named)

- both stages are 320px wide with padding; ours sets the page font to Polaris's own
  `--p-font-family-sans` token (Polaris applies it via its global stylesheet)
- the RIGHT image crops the combo CONTAINER (Polaris components size to context);
  the LEFT crops our component root — geometry differences are visible by design
- text rasterization differs where typography channels are named-not-carried
  (e.g. label typography riding the Text primitive) — that is the honest gap, shown

