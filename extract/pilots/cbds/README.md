# Field dump: CBDS UI Kit Demo — fourth real-world receipt (design-only)

Read-only API-surface dump of the CBDS UI Kit Demo (Figma `WofZT8xaxXuc2Q6Je9S4XE`, 2026-07-08) — a workshop-grade kit with **84 propertied components** and 3,047 propertyless ones (icon library). No code side exists, so this receipt documents what a *design-first* org's day-zero extraction looks like: the dump alone is the input a reconciliation workshop would start from. Reproduce: run `extract/figma-dump.js` in the file (read-only).

## What this kit adds to the drift taxonomy (new classes not seen in Shoelace/Eventz/Mantine)

1. **Emoji-prefixed property names as UX affordances**: `↪️icon-left` (swap), `✏️text` (editable text) — designers annotating property *kind* into the name. A reconciler needs a prefix-strip rule class beyond `is/has/show` (charset normalization); today these would all read as name mismatches.
2. **Variant-axis unrolling into component families**: NINE separate Button components (`Button-Brand Primary` … `Button-Danger Tertiary`) and six Icon Buttons where a code API would have one Button with `variant × emphasis` axes — the *inverse* of the state-axes problem: the kit under-uses variant axes where code over-uses them. Contract adoption here means *consolidation* proposals, a reconciliation move we haven't modeled (N components ⇄ 1 contract).
3. **Arity emulation via numbered slot booleans**: `↪️item-1 … ↪️item-10`, `↪️breadcrumb 2…6`, `↪️chip-1…5`, `show tab 3…5` — max-arity slots faked as boolean ladders. Maps naturally to contract slot `min/max` (already in the schema, unenforced) — strong evidence for enforcing it.
4. **Values-with-units-and-dimensions as enum options**: `size: ["2xsmall(16x16)", …]`, `progress: ["25%","50%","75%","100%"]` — presentation data baked into API vocabulary; value-mapping inference must tolerate decoration.
5. **State axes everywhere, again** (`state: default/hover/focus/pressed/disabled` on ~30 sets) — fourth consecutive system; plus genuine kit rot: an Alert boolean literally named **"Do you want it that way?"**, and `_Nav-item-menu`'s axis named `↪️expanded` (emoji inside a VARIANT axis name).

## Verdict for the pitch

Four systems dumped (Shoelace, Mantine-code, Eventz pair, CBDS), one consistent story: every real library carries the same 5-6 mechanical divergence classes, none of which any existing tool detects — and each class maps to a specific contract feature (state previews, slot arity, alias rules, value maps). The taxonomy is now evidence, not conjecture.

## Coexistence upgrade: full token sync + variable-bound Badge (2026-07-08)

The literal-values stub got its promised upgrade. Via the Sync Runner with a
filtered manifest (`FIGMA_SERVE_ONLY=01-tokens.js,05-badge.js`, scripts
regenerated with `FIGMA_FILE_KEY` pointing at the kit):

- **All three contract token collections now live in the CBDS kit** —
  Primitives (94, mode `Value`), Brand (10, modes `Default`/`Aurora`),
  Semantic (178, modes `Light`/`Dark`) — 282 variables created, zero
  collisions with the kit's five native collections (`colour primitive`,
  `colour semantic`, `number primitive`, `text primitive`, `text semantic`).
  Two token architectures from two organizations coexist in one file.
- **`Badge (ds.badge) — token-bound`** (set key `cdd03db0…`) sits on the test
  page below the resolved-values stub: same four variants, same `Label` TEXT
  property, but every fill is `setBoundVariableForPaint`-bound to
  `color/feedback/<variant>/background|foreground` in the contract's Semantic
  collection. Switching the Semantic mode to Dark (or Brand to Aurora)
  restyles it live, while every native CBDS component is untouched.

### Finding: name-collision skip needs identity, not just a name

`05-badge.js` did NOT build the component: its existence check found a
`COMPONENT_SET` named `Badge` — CBDS's own 72-variant native Badge — and
returned `{skipped: true}` with the foreign set's node id and key. Correct
refusal instinct (it mutated nothing), wrong evidence: **set name alone is not
identity in a brownfield file.** The skip/amend gate should require the
`ds_contracts`/`specHash` shared-plugin-data marker (or the anchored
componentSetKey) before treating an existing set as "ours"; a name match
without the marker is a foreign component and the script should create under a
disambiguated name instead. Filed as generator work; the bound set above was
built directly via the plugin API pending that fix.
