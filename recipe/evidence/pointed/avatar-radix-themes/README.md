# avatar@1 pointed at radix-themes

- 1. capture   extract/computed/out/radix-themes/avatar/captured-truth.json (72 captures)
- 2. roles     DRAFTED from the ledger — box:high label:high (review recipe/evidence/pointed/avatar-radix-themes/roles.draft.json)
- 3. propose   13 leaves read from the ledger · 1 reviewed (named) · 1 archetype spellings · 0 invented → recipe/fixtures/generated/avatar.radix-themes.ts
- 4. compile   fixed point ✔ · 1 variants · 24 carried · 4 receipts · recipe 02a7a9c3
- 5. emit      writer.plugin.js (28 KB, page "Recipe Pivot / Avatar / 02a7a9c3-avatar-v7") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)
- reviewed typography.label.resolved = Roboto/Medium: @radix-ui/themes@3.3.0 styles.css --default-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI (Custom)', Roboto, … ; the reference render (macOS Chromium 149) resolves -apple-system to SF Pro, but the shared writer refuses SF Pro on this Figma (AVATAR-FONT-ZERO-INTRINSIC: it paints zero-width, measured 2026-09-13); BlinkMacSystemFont is not a face and 'Segoe UI (Custom)' is not installed (figma.listAvailableFontsAsync); Roboto is the next face in the package's stack and is installed with style Medium (styles.css --font-weight-medium: 500) — a FONT-SUBSTRATE fallback, named

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Avatar / 02a7a9c3-avatar-v7" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/radix-themes/avatar/orig-shots/<off-state>__default.png --label avatar/radix-themes --out <json> --reference-control-only`.
3. To keep it: add the generated module to the avatar live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
