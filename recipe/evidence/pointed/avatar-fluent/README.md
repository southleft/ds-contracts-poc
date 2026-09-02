# avatar@1 pointed at fluent

- 1. capture   extract/computed/out/fluent/avatar/captured-truth.json (96 captures)
- 2. roles     DRAFTED from the ledger — box:high label:high (review recipe/evidence/pointed/avatar-fluent/roles.draft.json)
- 3. propose   13 leaves read from the ledger · 1 reviewed (named) · 1 archetype spellings · 0 invented → recipe/fixtures/generated/avatar.fluent.ts
- 4. compile   fixed point ✔ · 1 variants · 24 carried · 4 receipts · recipe af315e26
- 5. emit      writer.plugin.js (26 KB, page "Recipe Pivot / Avatar / af315e26-avatar-v6") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)
- reviewed typography.label.resolved = Arial/Bold: Segoe UI is a Windows face and is not installed on this machine (figma.listAvailableFontsAsync has no Segoe UI); Arial Bold is the nearest installed weight — a FONT-SUBSTRATE fallback, named

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Avatar / af315e26-avatar-v6" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/fluent/avatar/orig-shots/<off-state>__default.png --label avatar/fluent --out <json> --reference-control-only`.
3. To keep it: add the generated module to the avatar live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
