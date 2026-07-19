# The Polaris showcase — Shopify's design system, run through this pipeline end to end

## Verdict

We took Shopify Polaris — a design system we do not control, pinned at a public commit — ran it
through this repository's extraction pipeline, promoted twelve flagship components to
**contracts** (a contract is a reviewed, machine-readable description of one component: its
props, its structure, and which design token styles each part), generated working React and
plain-HTML implementations from those contracts, and then rendered our generated HTML
**side by side with Shopify's own published package in the same browser**. On the styled
properties the contracts carry, the computed styles match Shopify's rendering exactly in
**212 of 222 measured comparisons — and all 10 mismatches have committed, named causes**
(no tolerance was applied anywhere; a mismatch without a named cause would fail the report).
Everything the pipeline could NOT carry — a runtime-set variable here, a gradient there, a
breakpoint rule, a prop typed in a sibling file — is refused **by name** in a committed
ledger, not silently dropped. The receipts (a receipt is a committed artifact you can
re-derive and check — a screenshot pair, a numbers table, a decision ledger) are all in this
directory, and one `npm run eval` case re-generates the artifacts and fails if a single byte
or number drifts from what this document claims.

## What went in

- **Shopify/polaris @ `2b1ea88625e0613853ca8577c9acd1980a90f382`** (polaris-react 13.10.1,
  MIT © Shopify) — the same commit the [enterprise gauntlet](../../extract/pilots/ENTERPRISE-GAUNTLET.md)
  pinned. The mechanical extraction ran the repo's standard command over Polaris's component
  sources: `npm run extract:code -- examples/polaris/extract.config.json`
  → **182 components extracted, 109 with styling structure, 15 named skips** — Polaris-wide,
  before any curation.
- **Polaris's published token set**, mechanically wrapped to the DTCG format:
  **453 tokens, values verbatim, 0 skipped** (59 in-set `var()` references became standard
  aliases, 1:1).

## What came out (the 12-component showcase)

**12 committed contracts** (version 0.1.0, status draft) carrying **88 extracted props,
1 extracted event, and 185 carried styling facts** (token bindings plus provenance-cited
literals — see the coverage round below) promoted from Polaris's own CSS: Button, Badge,
Banner, Checkbox, RadioButton, TextField, Tag, Avatar, Spinner, ProgressBar, Text, Thumbnail.
(The owner's list named Card and Divider; both extract 0 props — their APIs are typed from
token aliases in another package, every prop a named skip — so Text and Thumbnail, two of the
richest extractions, took their places. The swap is itself a finding about single-file
extraction scope.)

Each contract is the **mechanical extraction verbatim on the API side** (no dropped prop was
re-added — Badge ships with 1 prop because that is what single-file extraction honestly
yields against a sibling-file type union), plus a **promotion step** for styling: Polaris
routes styles through `classNames()` helpers and `--pc-*` private variables the extractor
refuses by name, so a reviewed class map ([scripts/curation.ts](./scripts/curation.ts)) lets a
mechanical inverter re-read the same CSS and carry every single-token binding — and, since the
coverage round, every var()-chain-resolved same-package literal and every deterministic
composition-typography chain — it can prove.
The promotion wrote **185 carried ledger lines — one per carried fact in the committed
contracts, each citing its exact CSS rule (literals additionally cite their var() chain and
defining selector) — and 2,317 named refusal lines** —
[extraction/PROMOTION.md](./extraction/PROMOTION.md) is the complete record. Nothing was valued by hand; the non-CSS promotions (Banner's tone
palette, the checkable-control geometry, Avatar's cited default palette, the composition
typography maps) cite the Polaris source lines they came from.

From those contracts, with no further reference to the Polaris clone:

- `generated/react/` — React + CSS Modules (the shipping generator)
- `generated/html/` — static HTML + CSS (no build step), the surface used for verification
- `figma/` — Figma sync scripts (see below)

## The match, measured

Our generated HTML and the **real `@shopify/polaris` npm package** (13.9.5 — the pinned
commit's own version was never published; [extraction/VERSION-PARITY.md](./extraction/VERSION-PARITY.md)
proves by git blob hash that every showcase component's styling source is byte-identical
between the two) rendered in the same headless Chromium, 600×800. Every styled channel a
contract carries became a row: computed style read on both sides, compared for **exact string
equality — no tolerance**. Paired screenshots (ours | theirs) per combination are committed
under [receipts/](./receipts/).

<!-- polaris-showcase truth table — byte-checked against receipts/truth-table.json by `generate.ts --check` -->

| component | prop combos | rows compared | rows matched exactly | named refusal lines |
|---|---|---|---|---|
| `polaris.button` | 6 | 77 | 74 | 316 |
| `polaris.badge` | 1 | 10 | 10 | 38 |
| `polaris.banner` | 4 | 40 | 40 | 27 |
| `polaris.checkbox` | 1 | 2 | 1 | 502 |
| `polaris.radio-button` | 1 | 4 | 4 | 339 |
| `polaris.text-field` | 1 | 11 | 11 | 905 |
| `polaris.tag` | 1 | 7 | 7 | 43 |
| `polaris.avatar` | 3 | 18 | 12 | 46 |
| `polaris.spinner` | 2 | 4 | 4 | 8 |
| `polaris.progress-bar` | 6 | 24 | 24 | 29 |
| `polaris.text` | 4 | 17 | 17 | 15 |
| `polaris.thumbnail` | 2 | 8 | 8 | 49 |

**Total: 212/222 rows matched exactly across 32 prop combinations.** The 10 mismatches each
carry a committed named cause in [receipts/RECEIPTS.md](./receipts/RECEIPTS.md): Avatar's
name-hash palette (6 rows over 3 combos — Polaris hashes the initials into one of seven
palette classes; the contract carries Polaris's own name-less default, `styleOne`, cited from
`Avatar.tsx`, and the hash SELECTION stays a named refusal), Button's label typography
branches (3 rows — the primary label's weight is a media-dependent runtime branch and the
plain label's bodyMd upgrade is conditioned on two axes; both refused by name, the carried
base renders), and Checkbox's border width (1 row — Polaris's Choice wrapper zeroes the border
and repaints it as an inset shadow, a cross-component rule outside the promoted scope). "Named
refusal lines" counts the promotion ledger's refusals for that component (one styling fact can
refuse in several contexts, so lines ≥ declarations; every line is in PROMOTION.md).

## The coverage round (before → after)

The first Phase B canvas rebuild faithfully rendered only what the contracts then carried —
and the visually dominant channels were refusals, so buttons rendered label-less and
white-on-white, avatars invisible, progress bars heightless. The owner's verdict on that
canvas ("none of this is acceptable, at least from a stylistic point of view") triggered a
coverage round: convert refusal CLASSES into deterministically carried facts — chain-following,
never guessing — then re-prove everything. Before → after, same pinned SHA, same
zero-tolerance discipline:

| measure | before | after |
|---|---|---|
| carried ledger lines | 114 | 185 |
| named refusal lines | 2,360 | 2,317 |
| truth-table rows compared | 100 | 222 |
| rows matched exactly | 96 | 212 |
| mismatches (every one with a committed named cause) | 4 | 10 |

What converted, by class (each with engine/schema work, eval-pinned):

1. **var() → same-package literal resolution** (`literals`/`literalsByProp`, schema v14): a
   `--pc-*` chain that lands on a literal DEFINED in the same module.css now carries the
   resolved value with provenance (chain + defining selector + file), including deterministic
   `calc()` over resolved px literals. Carries ProgressBar's per-size track heights
   (8/16/32px), Avatar's per-size widths (20…40px), Thumbnail's per-size widths (24…80px),
   Button's `transparent` base background. Cycles refuse by name; unresolvable vars now
   refuse with a NARROWED message naming whether they are runtime-set, media-dependent, or
   defined only in other class contexts. Raw literals (never behind a var chain) still refuse
   — a raw value is reported, never invented into a carry.
2. **Composition-owned typography**: where a text node's styling flows through Polaris's Text
   primitive with LITERAL prop values readable in the parent's TSX (cited), the typography
   channels resolve mechanically from Text's own module.css under Text's reviewed class map —
   Button/Badge/Tag labels and Banner's title/body now carry font-size/weight/line-height/
   letter-spacing. Branches needing runtime logic (Button primary's `mdUp` weight) or two
   axes (plain+size → bodyMd) are refused by name and appear as named mismatch rows.
3. **Multiple `tokensByProp` per part** (schema v14): the one-map-per-part limit is lifted —
   ordered entries, later entries win per channel (mirroring the CSS source order the values
   came from; Polaris's own Text.module.css comment demands exactly this), conflicting
   channel+prop pairs refused by name. Button now carries variant colors AND size
   paddings/heights; Text carries the variant scale AND the fontWeight/tone maps (the old
   bold-combo mismatch now matches); TextField regains its slim padding.
4. **Figma emitter fixes at the source** (the Phase B in-flight shims are dead): the token
   script's color parser accepts `rgb()`/`rgba()` verbatim values (alpha preserved); the
   emitted shape branch applies `spec.stroke`/`spec.bindings` and clears the default gray
   paint when no fill channel is carried; the `background` channel now binds on the canvas
   exactly as it renders on the HTML surface (Avatar's fill was the cross-generator gap).

## The honest gaps, by name

The styled channels their architecture does NOT expose to this pipeline, and what was dropped:

- **Sibling-file prop types**: Badge's `tone`/`progress`/`icon`/`size` (union in
  `Badge/types.ts`), Tag's `size`, Icon-typed props everywhere — dropped by name; Badge ships
  a 1-prop contract as the exhibit.
- **Value-derived styling**: Avatar's palette SELECTION hashes the name/initials into one of
  seven classes — no contract channel can be a function of a text prop's value; the carried
  default is Polaris's own name-less default (`styleOne`, cited), so the mismatch is named and
  initials are never invisible.
- **Multi-axis conditions**: Button tone styling is conditioned on tone AND variant classes,
  and the plain label's bodyMd upgrade on variant AND size — refused (the mint-code
  discipline: never guess across axes).
- **Runtime-set and media-dependent values**: `--pc-progress-bar-percent` (inline style),
  `--pg-control-height` (global stylesheet), Button primary's `mdUp` label weight — refused
  with narrowed messages naming the class of unresolvability.
- **Breakpoint-conditional styling** (`@media (--p-breakpoints-*)`): no contract channel;
  verification renders sub-breakpoint where the carried base values apply.
- **Postcss mixins, pseudo-elements, sibling combinators**: focus rings, checked-state dots,
  inset bevels, Avatar's `::after` square-aspect trick — refused by name.
- **Raw literals outside a var() chain**: Avatar's per-size `border-radius: 4px/6px/8px` —
  a raw value is reported, never invented into a carry (the literal channel carries only
  chain-resolved definitions).
- **Inheritance keywords**: `color: inherit`, `height: inherit` — deterministic but carrying
  no standalone fact; refused by name.
- **Gradient overlays**: the primary button's gradient layer is named-not-carried; its color
  layer carries (CSS's own shorthand semantics) and matches exactly.

## Figma-ready (Phase B input)

`figma/00-tokens.figma.js` upserts the wrapped token set as Figma variables in a **blank
file**; `figma/<component>.figma.js` then builds each component as a variant set bound to
those variables. Every script passed the same referee as the code generators and compiled
headlessly in the canvas engine — per-contract variant counts in
[figma/COMPILE-RECEIPT.md](./figma/COMPILE-RECEIPT.md). **10 of 12 scripts are committed**;
Text (23,232 variants) and TextField (1,344) compile but explode the full variant cartesian —
a named finding: canvas modeling for many-axis components needs an axis-curation decision,
which is an owner call in Phase B.

**What Phase B needs from the owner: open a blank Figma file with the Desktop Bridge
connected.** Everything else is a run, not a build.

## Reproduce every number

See [README.md](./README.md) for the five commands (clone → wrap → extract → promote →
generate/verify). The committed `polaris-showcase-reproducible` eval re-runs generation from
the committed contracts on every `npm run eval` and fails on any byte or truth-table drift.

## Attribution

Polaris is MIT © Shopify Inc. This showcase commits derived metadata, wrapped token values
(verbatim, attributed), two spinner glyphs from `Spinner.tsx`, and screenshots — no vendored
source. Not affiliated with or endorsed by Shopify.
