# avatar@1 pointed at mui

- 1. capture   extract/computed/out/mui/avatar/captured-truth.json (12 captures)
- 2. roles     DRAFTED from the ledger — box:high label:high (review recipe/evidence/pointed/avatar-mui/roles.draft.json)
- 3. propose   13 leaves read from the ledger · 0 reviewed (named) · 1 archetype spellings · 0 invented → recipe/fixtures/generated/avatar.mui.ts
- 4. compile   fixed point ✔ · 1 variants · 23 carried · 3 receipts · recipe 4ae3dd12
- 5. emit      writer.plugin.js (27 KB, page "Recipe Pivot / Avatar / 4ae3dd12-avatar-v7") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)


## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Avatar / 4ae3dd12-avatar-v7" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/mui/avatar/orig-shots/<off-state>__default.png --label avatar/mui --out <json> --reference-control-only`.
3. To keep it: add the generated module to the avatar live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
