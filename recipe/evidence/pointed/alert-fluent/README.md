# alert@1 pointed at fluent

- 1. capture   extract/computed/out/fluent/messagebar/captured-truth.json (32 captures)
- 2. roles     DRAFTED from the ledger — combos:high title:high icon:high iconPath:high iconWrap:high box:high (review recipe/evidence/pointed/alert-fluent/roles.draft.json)
- 3. propose   39 leaves read from the ledger · 2 reviewed (named) · 1 archetype spellings · 0 invented → recipe/fixtures/generated/alert.fluent.ts
- 4. compile   fixed point ✔ · 4 variants · 74 carried · 5 receipts · recipe b7744674
- 5. emit      writer.plugin.js (48 KB, page "Recipe Pivot / Alert / b7744674-alert-v10") and writer.scratch.js

## What a person did
- reviewed the role map (drafted with evidence, see roles.draft.json)
- (switch@1 has no glyph)
- reviewed icon.viewBox = 0 0 20 20: every MessageBar status glyph the capture wrote carries viewBox 0 0 20 20 (extract/computed/out/fluent/messagebar/assets/message-bar-icon-{info,success,warning,error}.svg), the 20px size @fluentui/react-icons draws at
- reviewed typography.title.resolved = Roboto/SemiBold: the capture's stack is "Segoe UI", "Segoe UI Web (West European)", -apple-system, "system-ui", Roboto, "Helvetica Neue", sans-serif. Segoe UI is not on the minting machine, and SF Pro — the fallback the Astryx and AntD fixtures cite — paints ZERO-WIDTH glyphs in this Figma at every style (measured 2026-09-04: SF Pro/Semibold and SF Pro/Regular render width 0 for the same string where Inter, Roboto and Helvetica render 98-108). Roboto is the next face the capture's own stack names, it is present, it paints, and it carries a SemiBold matching the captured weight 600

## What to do next
1. In Figma desktop, open the file the set should live in, open the development plugin, choose **Paste a script**, paste `writer.plugin.js`, run. It creates its own page named "Recipe Pivot / Alert / b7744674-alert-v10" and never touches an existing page.
2. To score it: export the unchecked variant's control and run `npx tsx recipe/fidelity-score.ts --canvas <png> --reference extract/computed/out/fluent/alert/orig-shots/<off-state>__default.png --label alert/fluent --out <json> --reference-control-only`.
3. To keep it: add the generated module to the alert live proof's sources and to the reader's subjects (see checkbox v6 for the pattern).
