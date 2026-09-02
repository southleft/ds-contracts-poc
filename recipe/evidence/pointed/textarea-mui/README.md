# textarea@1 pointed at mui

- 1. capture   extract/computed/out/mui/textarea/captured-truth.json (16 captures)
- 2. roles     DRAFTED from the ledger — combos:high inner:high box:high outline:high legend:high label:high container:high opacityOn:high (review recipe/evidence/pointed/textarea-mui/roles.draft.json)
- 3. propose   40 leaves read from the ledger · 2 reviewed (named) · 3 archetype spellings · 0 invented → recipe/fixtures/generated/textarea.mui.ts
- 4. compile   fixed point ✔ · 6 variants · 62 carried · 6 receipts · recipe 5b048377
- 5. emit      writer.plugin.js (53 KB, page "Recipe Pivot / Textarea / 5b048377-textarea-v10") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)
- reviewed notchFill = #ffffffff: the paper surface showing through the legend gap: palette.background.paper #ffffff (recipe/sandboxes/input-field-mui/node_modules/@mui/material/styles/createPalette.js light.background.paper)
- reviewed states.empty.disabled.value = #00000061: a disabled field cannot take focus and MUI hides the rest placeholder under the label (::placeholder opacity 0) — palette.text.disabled rgba(0,0,0,0.38) (createPalette.js light.text.disabled)

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Textarea / 5b048377-textarea-v10" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/mui/textarea/orig-shots/<off-state>__default.png --label textarea/mui --out <json> --reference-control-only`.
3. To keep it: add the generated module to the textarea live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
