# F1 · textarea@1 proposed from captures — MUI and AntD from their own, Chakra held out

**2026-09-02.** The ninth archetype with a proposer
(`recipe/fixture-reader/schema-textarea.ts`, `draft-roles.ts#draftTextareaRoles`,
`propose-textarea.ts`; `npm run recipe:point -- --archetype textarea --library <lib>`),
and the first that needed a **recipe change to be honest**: textarea@1 now has a
BARE cell (`content.label: null`) for the many libraries whose textarea is a lone
`<textarea>` with no label part. Minted as textarea v9 (page `219:92517`, six
sources) through the shared writer runtime; scored width-normalised against the
real render of the empty state, exactly as the hand rows are.

| library | plane | reviewed | manifest row | score |
|---|---|---|---|---|
| mui (own capture) | floating, notched | `notchFill` (the paper behind the legend gap) and the disabled placeholder ink (hidden at rest AND focus) — both cited to createPalette.js | `textarea/mui-proposed` | 9.52% = the hand row (named real-defect: heights 58 vs 56, resize grip) |
| antd (own capture) | BARE | none (26 read, 17 spellings, 0 invented) | `textarea/antd-proposed` | **1.25%** — the hand row is a named 7.42% content mismatch (it mints a label AntD does not render) |
| chakra (HELD OUT, re-captured today) | BARE | none (26 read, 0 invented) | `textarea/chakra` | **1.64%** |

## What the schema reads that the hand tables reviewed

- **The label plane.** Floating when the label is absolutely positioned or its
  transform changes between the empty and value combos; every floating leaf
  is the label's transform matrix (tx, ty, scale × font-size). On a stacked
  label the same reads come out 0 and the label size, which is what the
  recipe spells for that plane.
- **The outline.** A bordered, absolutely positioned child of the box is a
  distinct outline (MUI's fieldset), drawn outside the box; a `<legend>`
  inside it is the notched treatment. The knockout colour is the surface
  behind the legend gap, which no computed channel carries — refused unless
  reviewed, as the hand table had it.
- **Rows.** The inner textarea's content height / line-height, box-sizing
  aware (AntD's 54px border-box height minus padding and border = 2 rows;
  the hand table had reviewed 2).
- **Placeholder ink.** `::placeholder` colour alpha × opacity at rest, or at
  the focus-visible interaction when rest hides it under an overlaying label
  (MUI); hidden in both refuses (MUI's disabled cell — reviewed with the
  palette citation, as the hand table had).
- **The placeholder text.** Not a computed channel. The ledger's provenance
  names the capture config, and the config's `fixedProps.placeholder` is the
  person's own entry — read and cited by file and entry.
- **The value ink.** `-webkit-text-fill-color` when it paints (MUI's
  disabled ink), else `color`.

## The bare cell

AntD's `Input.TextArea` and Chakra's `Textarea` mount one `<textarea>`; the
drafter reports the missing label as evidence (not unresolved), the proposer
writes `label: null`, the recipe compiles no label node (all-or-none across
variants, floating refused), and the label leaves are the recipe's inert
constants. AntD's hand row was a named content mismatch for exactly this
reason; its proposal is the fair comparison and scores 1.25%.

## Refused by name

MUI's `resize` grip (`resize: vertical` read from the inner), the fieldset
legend lowering, the hover/focus-visible/active interactions the capture
made — each a refusal row on the generated module.
