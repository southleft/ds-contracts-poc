# tabs@1 pointed at mui

- 1. capture   extract/computed/out/mui/tabs/captured-truth.json (24 captures)
- 2. roles     DRAFTED from the ledger — selectedTab:high restTab:high list:high indicator:high (review recipe/evidence/pointed/tabs-mui/roles.draft.json)
- 3. propose   26 leaves read from the ledger · 0 reviewed (named) · 1 archetype spellings · 0 invented → recipe/fixtures/generated/tabs.mui.ts
- 4. compile   fixed point ✔ · 2 variants · 45 carried · 3 receipts · recipe fb303c8a
- 5. emit      writer.plugin.js (31 KB, page "Recipe Pivot / Tabs / fb303c8a-tabs-v17") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)


## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Tabs / fb303c8a-tabs-v17" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/mui/tabs/orig-shots/<off-state>__default.png --label tabs/mui --out <json> --reference-control-only`.
3. To keep it: add the generated module to the tabs live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
