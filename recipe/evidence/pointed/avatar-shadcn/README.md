# avatar@1 pointed at shadcn

- 1. capture   extract/computed/out/shadcn/avatar/captured-truth.json (12 captures)
- 2. roles     DRAFTED from the ledger — box:high label:high (review recipe/evidence/pointed/avatar-shadcn/roles.draft.json)
- 3. propose   13 leaves read from the ledger · 1 reviewed (named) · 1 archetype spellings · 0 invented → recipe/fixtures/generated/avatar.shadcn.ts
- 4. compile   fixed point ✔ · 1 variants · 24 carried · 4 receipts · recipe ea8faf59
- 5. emit      writer.plugin.js (26 KB, page "Recipe Pivot / Avatar / ea8faf59-avatar-v6") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)
- reviewed typography.label.resolved = Inter/Regular: "Inter Variable" is @fontsource-variable/inter's family name for Inter (the sandbox's index.css imports it); Figma names the same face Inter — reviewed fallback to Inter Regular

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Avatar / ea8faf59-avatar-v6" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/shadcn/avatar/orig-shots/<off-state>__default.png --label avatar/shadcn --out <json> --reference-control-only`.
3. To keep it: add the generated module to the avatar live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
