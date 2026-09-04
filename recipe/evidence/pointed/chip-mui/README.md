# chip@1 pointed at mui

- 1. capture   extract/computed/out/mui/chip/captured-truth.json (112 captures)
- 2. roles     DRAFTED from the ledger — box:high label:high (review recipe/evidence/pointed/chip-mui/roles.draft.json)
- 3. propose   13 leaves read from the ledger · 0 reviewed (named) · 1 archetype spellings · 0 invented → recipe/fixtures/generated/chip.mui.ts
- 4. compile   fixed point ✔ · 1 variants · 23 carried · 3 receipts · recipe a2edcac5
- 5. emit      writer.plugin.js (26 KB, page "Recipe Pivot / Chip / a2edcac5-chip-v11") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)


## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Chip / a2edcac5-chip-v11" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/mui/chip/orig-shots/<off-state>__default.png --label chip/mui --out <json> --reference-control-only`.
3. To keep it: add the generated module to the chip live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
