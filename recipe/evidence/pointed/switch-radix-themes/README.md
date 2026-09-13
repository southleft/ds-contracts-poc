# switch@1 pointed at radix-themes

- 1. capture   extract/computed/out/radix-themes/switch/captured-truth.json (144 captures)
- 2. roles     DRAFTED from the ledger — track:high trackImagePlanes:high thumb:high travelOn:high hit:medium label:medium (review recipe/evidence/pointed/switch-radix-themes/roles.draft.json)
- 3. propose   23 leaves read from the ledger · 2 reviewed (named) · 9 archetype spellings · 0 invented → recipe/fixtures/generated/switch.radix-themes.ts
- 4. compile   fixed point ✔ · 4 variants · 41 carried · 5 receipts · recipe bcff9e3e
- 5. emit      writer.plugin.js (40 KB, page "Recipe Pivot / Switch / bcff9e3e-switch-v13") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)
- reviewed states.true.enabled.trackFill = #3e63ddff: @radix-ui/themes@3.3.0 styles.css:14012-14016 .rt-SwitchRoot:where(.rt-variant-surface)::before paints background-image: linear-gradient(to right, var(--accent-track) 40%, transparent 60%) and :where([data-state='checked'])::before sets background-position: 0% (styles.css:13904), so the checked track shows the gradient's first stop var(--accent-track) = var(--indigo-9) = #3e63dd (styles.css:370, the theme's default indigo accent); the ledger's background-color on that plane is the base tint underneath, not the painted fill
- reviewed states.false.enabled.trackFill = #0000330f: @radix-ui/themes@3.3.0 styles.css:13900-13902 :where([data-state='unchecked'])::before sets background-position-x: 100%, which shows the gradient's transparent tail over background-color: var(--gray-a3) (styles.css:14013); with the theme's slate gray that is var(--slate-a3) = #0000330f (styles.css:64) — the painted unchecked track IS the base tint

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Switch / bcff9e3e-switch-v13" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/radix-themes/switch/orig-shots/<off-state>__default.png --label switch/radix-themes --out <json> --reference-control-only`.
3. To keep it: add the generated module to the switch live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
