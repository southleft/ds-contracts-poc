# alert@1 pointed at antd

- 1. capture   extract/computed/out/antd/alert/captured-truth.json (128 captures)
- 2. roles     DRAFTED from the ledger — combos:high title:high icon:high iconPath:high iconWrap:high box:high (review recipe/evidence/pointed/alert-antd/roles.draft.json)
- 3. propose   39 leaves read from the ledger · 1 reviewed (named) · 1 archetype spellings · 0 invented → recipe/fixtures/generated/alert.antd.ts
- 4. compile   fixed point ✔ · 4 variants · 73 carried · 4 receipts · recipe 83c23591
- 5. emit      writer.plugin.js (42 KB, page "Recipe Pivot / Alert / 83c23591-alert-v9") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)
- reviewed icon.viewBox = 64 64 896 896: @ant-design/icons-svg icons are authored in viewBox 64 64 896 896 (node_modules/@ant-design/icons-svg/lib/asn/InfoCircleFilled.js attrs.viewBox)

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Alert / 83c23591-alert-v9" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/antd/alert/orig-shots/<off-state>__default.png --label alert/antd --out <json> --reference-control-only`.
3. To keep it: add the generated module to the alert live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
