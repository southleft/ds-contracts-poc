# The Polaris showcase — Shopify's design system, run through this pipeline end to end

## Verdict

We took Shopify Polaris — a design system we do not control, pinned at a public commit — ran it
through this repository's extraction pipeline, promoted twelve flagship components to
**contracts** (a contract is a reviewed, machine-readable description of one component: its
props, its structure, and which design token styles each part), generated working React and
plain-HTML implementations from those contracts, and then rendered our generated HTML
**side by side with Shopify's own published package in the same browser**. On the styled
properties the contracts carry, the computed styles match Shopify's rendering exactly in
**96 of 100 measured comparisons — and all 4 mismatches have committed, named causes**
(no tolerance was applied anywhere; a mismatch without a named cause would fail the report).
Everything the pipeline could NOT carry — a private-variable trick here, a gradient there, a
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
1 extracted event, and 114 token bindings** promoted from Polaris's own CSS: Button, Badge,
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
mechanical inverter re-read the same CSS and carry every single-token binding it can prove.
The promotion wrote **114 carried-binding ledger lines — one per binding in the committed
contracts, each citing its exact CSS rule — and 2,360 named refusal lines** —
[extraction/PROMOTION.md](./extraction/PROMOTION.md) is the complete record. Nothing was valued by hand; the two non-CSS promotions (Banner's tone
palette, the checkable-control geometry) cite the Polaris source lines they came from.

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
| `polaris.button` | 6 | 26 | 26 | 333 |
| `polaris.badge` | 1 | 6 | 6 | 37 |
| `polaris.banner` | 4 | 8 | 8 | 27 |
| `polaris.checkbox` | 1 | 2 | 1 | 502 |
| `polaris.radio-button` | 1 | 4 | 4 | 339 |
| `polaris.text-field` | 1 | 11 | 11 | 907 |
| `polaris.tag` | 1 | 3 | 3 | 43 |
| `polaris.avatar` | 1 | 4 | 2 | 57 |
| `polaris.spinner` | 2 | 4 | 4 | 8 |
| `polaris.progress-bar` | 4 | 12 | 12 | 32 |
| `polaris.text` | 4 | 16 | 15 | 17 |
| `polaris.thumbnail` | 2 | 4 | 4 | 58 |

**Total: 96/100 rows matched exactly across 28 prop combinations.** The 4 mismatches each
carry a committed named cause in [receipts/RECEIPTS.md](./receipts/RECEIPTS.md): Avatar's
name-hash palette (2 rows — Polaris derives avatar colors from a hash of the initials;
value-derived styling has no contract channel), Text's bold combo (1 row — the schema carries
ONE per-value token map per part and the variant axis won; a named schema limit this showcase
surfaced), and Checkbox's border width (1 row — Polaris's Choice wrapper zeroes the border and
repaints it as an inset shadow, a cross-component rule outside the promoted scope). "Named
refusal lines" counts the promotion ledger's refusals for that component (one styling fact can
refuse in several contexts, so lines ≥ declarations; every line is in PROMOTION.md).

## The honest gaps, by name

The styled channels their architecture does NOT expose to this pipeline, and what was dropped:

- **Sibling-file prop types**: Badge's `tone`/`progress`/`icon`/`size` (union in
  `Badge/types.ts`), Tag's `size`, Icon-typed props everywhere — dropped by name; Badge ships
  a 1-prop contract as the exhibit.
- **Component-private literal geometry**: Button/Avatar/Thumbnail/ProgressBar sizes are
  `--pc-*` pixel literals, not tokens — refused; the receipts show the geometry gap (checkable
  controls carry their 20px box through the schema's literal-shape channel, cited).
- **Multi-axis conditions**: Button tone styling is conditioned on tone AND variant classes —
  refused (the mint-code discipline: never guess across axes).
- **One `tokensByProp` per part** (schema limit, surfaced here): Button carries the variant
  axis (colors/shadows) and NAMES the lost size paddings; Text carries the variant scale and
  names the lost fontWeight/tone maps. Filed as engine work.
- **Breakpoint-conditional styling** (`@media (--p-breakpoints-*)`): no contract channel;
  verification renders sub-breakpoint where the carried base values apply.
- **Postcss mixins, pseudo-elements, sibling combinators**: focus rings, checked-state dots,
  inset bevels — refused by name.
- **Composition-owned typography**: labels render through Polaris's Text primitive; a
  component's contract does not carry another component's file.
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
