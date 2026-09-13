# checkbox@1 pointed at radix-themes

- 1. capture   extract/computed/out/radix-themes/checkbox/captured-truth.json (216 captures)
- 2. roles     DRAFTED from the ledger — box:medium glyph:high glyphPath:high label:medium row:medium hit:medium dash:medium opacityOn:medium (review recipe/evidence/pointed/checkbox-radix-themes/roles.draft.json)
- 3. propose   30 leaves read from the ledger · 5 reviewed (named) · 21 archetype spellings · 0 invented → recipe/fixtures/generated/checkbox.radix-themes.ts
- 4. compile   fixed point ✔ · 6 variants · 69 carried · 8 receipts · recipe 2e537376
- 5. emit      writer.plugin.js (62 KB, page "Recipe Pivot / Checkbox / 2e537376-checkbox-v12") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- cited the glyph geometry from the package (glyph-file): @radix-ui/themes@3.3.0 dist/esm/components/icons.js: ThickCheckIcon — <svg width="9" height="9" viewBox="0 0 9 9" fill="currentcolor"><path fillRule="evenodd" clipRule="evenodd" d="…"/></svg>; read from the package file, not from our capture
- reviewed dash.width = 8.333: @radix-ui/themes@3.3.0 dist/esm/components/icons.js ThickDividerHorizontalIcon: viewBox 0 0 9 9, the bar path runs x 0.75→8.25 (7.5 units); the indicator svg renders 10×10 (captured-truth surface.2.indeterminate.enabled idx:0 width 10px), so the bar is 7.5/9×10 = 8.333px — the drafted dash part is the <path>, whose CSS width is 'auto' by construction
- reviewed dash.height = 1.667: @radix-ui/themes@3.3.0 dist/esm/components/icons.js ThickDividerHorizontalIcon: the bar path runs y 3.75→5.25 (1.5 units of a 9-unit viewBox) in a 10×10 rendered svg → 1.5/9×10 = 1.667px
- reviewed states.indeterminate.enabled.dashFill = #ffffffff: the icon paints fill='currentcolor' (icons.js) and the indicator's computed color is rgba(255, 255, 255, 1) on surface.2.indeterminate.enabled (captured-truth idx:0 color; the <path>'s fill channel agrees) — a <path> has no background-color, which is why the read refused
- reviewed states.indeterminate.disabled.dashFill = #00083046: the icon paints fill='currentcolor' (icons.js) and the indicator's computed color is rgba(0, 8, 48, 0.275) on surface.2.indeterminate.disabled (captured-truth idx:0 color; the <path>'s fill channel agrees) = #00083046

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Checkbox / 2e537376-checkbox-v12" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/radix-themes/checkbox/orig-shots/<off-state>__default.png --label checkbox/radix-themes --out <json> --reference-control-only`.
3. To keep it: add the generated module to the checkbox live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
