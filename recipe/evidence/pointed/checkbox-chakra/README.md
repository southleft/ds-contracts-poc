# checkbox@1 pointed at chakra

- 1. capture   extract/computed/out/chakra/checkbox/captured-truth.json (24 captures)
- 2. roles     DRAFTED from the ledger — box:high glyph:high glyphPath:high label:high row:high hit:medium dash:medium opacityOn:high (review recipe/evidence/pointed/checkbox-chakra/roles.draft.json)
- 3. propose   42 leaves read from the ledger · 3 reviewed (named) · 10 archetype spellings · 0 invented → recipe/fixtures/generated/checkbox.chakra.ts
- 4. compile   fixed point ✔ · 6 variants · 70 carried · 3 receipts · recipe 5e8642f1
- 5. emit      writer.plugin.js (64 KB, page "Recipe Pivot / Checkbox / 5e8642f1-checkbox-v6") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- cited the glyph geometry from the package (glyph-file): @chakra-ui/react@3.37.0 dist/esm/components/checkmark/checkmark.js: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3px" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
- reviewed dash.width = 9.9167: checkmark.js indeterminate <path d="M5 12h14"> stroke 3 round caps in a 24 viewBox, rendered 14: line 14×14/24 = 8.1667 + one cap width 1.75 = 9.9167 (a round-capped stroke lowered to a rounded rect)
- reviewed dash.height = 1.75: stroke-width 3 × 14/24 = 1.75
- reviewed dash.radius = 0.875: round caps: half the lowered stroke height

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Checkbox / 5e8642f1-checkbox-v6" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/chakra/checkbox/orig-shots/unchecked.enabled__default.png --label checkbox/chakra --out <json> --reference-control-only`.
3. To keep it: add the generated module to the checkbox live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
