# checkbox@1 pointed at shadcn

- 1. capture   extract/computed/out/shadcn/checkbox/captured-truth.json (24 captures)
- 2. roles     DRAFTED from the ledger — box:high glyph:high glyphPath:high label:medium row:medium hit:medium dash:medium opacityOn:high (review recipe/evidence/pointed/checkbox-shadcn/roles.draft.json)
- 3. propose   29 leaves read from the ledger · 6 reviewed (named) · 21 archetype spellings · 0 invented → recipe/fixtures/generated/checkbox.shadcn.ts
- 4. compile   fixed point ✔ · 6 variants · 69 carried · 6 receipts · recipe 45f207ad
- 5. emit      writer.plugin.js (59 KB, page "Recipe Pivot / Checkbox / 45f207ad-checkbox-v8") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- cited the glyph geometry from the package (glyph-file): lucide-react@1.30.0 dist/esm/icons/check.mjs: [["path", { d: "M20 6 9 17l-5-5" }]] with defaultAttributes.mjs viewBox "0 0 24 24" fill none stroke currentColor strokeWidth 2 strokeLinecap round strokeLinejoin round; mounted by examples/shadcn/.shadcn-sandbox/src/components/ui/checkbox.tsx <CheckIcon /> inside Indicator [&>svg]:size-3.5 (14px)
- reviewed dash.width = 0: shadcn's indeterminate state renders the CheckIcon itself (captured indeterminate.enabled__default: svg 14px, path d=M 20 6 L 9 17 L 4 12, stroke oklch(0.145 0 0) 2px on a transparent box) — checkbox@1 has no glyph-as-indeterminate cell, so the dash is zero-size and the two indeterminate cells are a NAMED GAP: not expressible, not scored
- reviewed dash.height = 0: shadcn's indeterminate state renders the CheckIcon itself (captured indeterminate.enabled__default: svg 14px, path d=M 20 6 L 9 17 L 4 12, stroke oklch(0.145 0 0) 2px on a transparent box) — checkbox@1 has no glyph-as-indeterminate cell, so the dash is zero-size and the two indeterminate cells are a NAMED GAP: not expressible, not scored
- reviewed dash.radius = 0: shadcn's indeterminate state renders the CheckIcon itself (captured indeterminate.enabled__default: svg 14px, path d=M 20 6 L 9 17 L 4 12, stroke oklch(0.145 0 0) 2px on a transparent box) — checkbox@1 has no glyph-as-indeterminate cell, so the dash is zero-size and the two indeterminate cells are a NAMED GAP: not expressible, not scored
- reviewed states.indeterminate.enabled.dashFill = #00000000: shadcn's indeterminate state renders the CheckIcon itself (captured indeterminate.enabled__default: svg 14px, path d=M 20 6 L 9 17 L 4 12, stroke oklch(0.145 0 0) 2px on a transparent box) — checkbox@1 has no glyph-as-indeterminate cell, so the dash is zero-size and the two indeterminate cells are a NAMED GAP: not expressible, not scored
- reviewed states.indeterminate.disabled.dashFill = #00000000: shadcn's indeterminate state renders the CheckIcon itself (captured indeterminate.enabled__default: svg 14px, path d=M 20 6 L 9 17 L 4 12, stroke oklch(0.145 0 0) 2px on a transparent box) — checkbox@1 has no glyph-as-indeterminate cell, so the dash is zero-size and the two indeterminate cells are a NAMED GAP: not expressible, not scored

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Checkbox / 45f207ad-checkbox-v8" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/shadcn/checkbox/orig-shots/unchecked.enabled__default.png --label checkbox/shadcn --out <json> --reference-control-only`.
3. To keep it: add the generated module to the checkbox live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
