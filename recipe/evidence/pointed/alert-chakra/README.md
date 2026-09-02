# alert@1 pointed at chakra

- 1. capture   extract/computed/out/chakra/alert/captured-truth.json (16 captures)
- 2. roles     DRAFTED from the ledger — combos:high title:high icon:high iconPath:high iconWrap:high box:high (review recipe/evidence/pointed/alert-chakra/roles.draft.json)
- 3. propose   39 leaves read from the ledger · 1 reviewed (named) · 1 archetype spellings · 0 invented → recipe/fixtures/generated/alert.chakra.ts
- 4. compile   fixed point ✔ · 4 variants · 73 carried · 4 receipts · recipe 3cc66b45
- 5. emit      writer.plugin.js (42 KB, page "Recipe Pivot / Alert / 3cc66b45-alert-v9") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)
- reviewed icon.viewBox = 24: Chakra's InfoIcon/WarningIcon/CheckCircleIcon are authored in viewBox 0 0 24 24 (examples/chakra/.chakra-sandbox/node_modules/@chakra-ui/react/dist/esm/components/icons.js)

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Alert / 3cc66b45-alert-v9" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/chakra/alert/orig-shots/<off-state>__default.png --label alert/chakra --out <json> --reference-control-only`.
3. To keep it: add the generated module to the alert live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
