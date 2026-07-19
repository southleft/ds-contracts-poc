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
| `polaris.button` | 6 | 26 | 26 | 0 | 333 |
| `polaris.badge` | 1 | 6 | 6 | 0 | 37 |
| `polaris.banner` | 4 | 8 | 8 | 0 | 27 |
| `polaris.checkbox` | 1 | 2 | 1 | 1 | 502 |
| `polaris.radio-button` | 1 | 4 | 4 | 0 | 339 |
| `polaris.text-field` | 1 | 11 | 11 | 0 | 907 |
| `polaris.tag` | 1 | 3 | 3 | 0 | 43 |
| `polaris.avatar` | 1 | 4 | 2 | 2 | 57 |
| `polaris.spinner` | 2 | 4 | 4 | 0 | 8 |
| `polaris.progress-bar` | 4 | 12 | 12 | 0 | 32 |
| `polaris.text` | 4 | 16 | 15 | 1 | 17 |
| `polaris.thumbnail` | 2 | 4 | 4 | 0 | 58 |

## Mismatched rows (named, no tolerance)

### polaris.checkbox

- `default` backdrop.border-width — ours: `border-bottom-width: 1px` · theirs: `border-bottom-width: 0px`
  - NAMED CAUSE: in Polaris's real composition the Choice wrapper's `.ChoiceLabel .Backdrop` rule sets border-width: 0 and repaints the outline as an inset box-shadow — a foreign-class descendant rule (named unmatched in PROMOTION.md); the carried binding renders the component's own standalone `.Backdrop` base rule

### polaris.avatar

- `default` root.background — ours: `background-color: rgb(181, 181, 181)` · theirs: `background-color: rgb(253, 75, 146)`
  - NAMED CAUSE: Polaris hashes the name/initials into one of seven palette classes (styleOne…styleSeven) that override the base avatar tokens — value-derived styling has no contract channel (named in PROMOTION.md), so the carried BASE binding renders the base palette while Polaris renders the hashed one
- `default` root.color — ours: `color: rgb(255, 255, 255)` · theirs: `color: rgb(255, 246, 248)`
  - NAMED CAUSE: same name-hash palette override as background — the base color token is carried, the hashed one is not derivable from a prop

### polaris.text

- `body-sm-bold` root.font-weight — ours: `font-weight: 450` · theirs: `font-weight: 700`
  - NAMED CAUSE: the fontWeight axis mechanically resolves per-value bindings (.bold → {p.font-weight-bold}) but the schema carries ONE tokensByProp per part and the variant axis won by curation order — the named schema limit in PROMOTION.md; the combo shows Polaris's bold (700) against the variant's weight (450)

## Receipt chrome (named)

- both stages are 320px wide with padding; ours sets the page font to Polaris's own
  `--p-font-family-sans` token (Polaris applies it via its global stylesheet)
- the RIGHT image crops the combo CONTAINER (Polaris components size to context);
  the LEFT crops our component root — geometry differences are visible by design
- text rasterization differs where typography channels are named-not-carried
  (e.g. label typography riding the Text primitive) — that is the honest gap, shown

