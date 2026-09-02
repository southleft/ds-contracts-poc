# tooltip@1 pointed at shadcn

- 1. capture   extract/computed/out/shadcn/tooltip/captured-truth.json (1 captures)
- 2. roles     DRAFTED from the ledger — box:high label:high (review recipe/evidence/pointed/tooltip-shadcn/roles.draft.json)
- 3. propose   14 leaves read from the ledger · 1 reviewed (named) · 2 archetype spellings · 0 invented → recipe/fixtures/generated/tooltip.shadcn.ts
- 4. compile   fixed point ✔ · 1 variants · 26 carried · 3 receipts · recipe 332e14d0
- 5. emit      writer.plugin.js (26 KB, page "Recipe Pivot / Tooltip / 332e14d0-tooltip-v8") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)
- reviewed typography.label.resolved = Inter/Regular: "Inter Variable" is @fontsource-variable/inter's family name for Inter (the sandbox's index.css imports it); Figma names the same face Inter — reviewed fallback to Inter Regular

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Tooltip / 332e14d0-tooltip-v8" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/shadcn/tooltip/orig-shots/<off-state>__default.png --label tooltip/shadcn --out <json> --reference-control-only`.
3. To keep it: add the generated module to the tooltip live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
