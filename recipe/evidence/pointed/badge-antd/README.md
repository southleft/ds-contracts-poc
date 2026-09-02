# badge@1 pointed at antd

- 1. capture   extract/computed/out/antd/badge/captured-truth.json (32 captures)
- 2. roles     DRAFTED from the ledger — indicator:high label:high host:high (review recipe/evidence/pointed/badge-antd/roles.draft.json)
- 3. propose   19 leaves read from the ledger · 0 reviewed (named) · 0 archetype spellings · 0 invented → recipe/fixtures/generated/badge.antd.ts
- 4. compile   fixed point ✔ · 2 variants · 28 carried · 4 receipts · recipe 5ecb1cc3
- 5. emit      writer.plugin.js (27 KB, page "Recipe Pivot / Badge / 5ecb1cc3-badge-v10") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)


## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Badge / 5ecb1cc3-badge-v10" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/antd/badge/orig-shots/<off-state>__default.png --label badge/antd --out <json> --reference-control-only`.
3. To keep it: add the generated module to the badge live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
