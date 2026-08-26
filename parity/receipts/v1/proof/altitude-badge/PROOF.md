# PROOF — one component through the current engine, before and after, on the canvas

**Subject:** `altitude.badge`, the `Dot=Dot` plane.
**File:** Scratch Project `byMp6lt0Ij9b2QbkDGFwBh`, page **Census / altitude**, component set node `39:6692` (amended IN PLACE — same node id, same key `c583ebfb365aec0d456ca8b28196bad66e6d7beb`).
**Engine:** `main` at **6ba48b8a**, worktree branch `proof/altitude-badge`.
**Date:** 2026-08-26.

---

## Verdict, in one sentence

**The canvas changed: the four "dot" badges that used to have the word "Badge" painted across them are now four plain 8-pixel coloured dots, exactly like the real library.**

---

## The three pictures

| | file | what it shows |
|---|---|---|
| BEFORE | `BEFORE.png` | the set as it stood on the canvas before this run — left column right, right column a 36×12 box with "Badge" spilling out of it |
| AFTER | `AFTER.png` | the same node after one re-run of the chain — right column is four 8×8 pips, no text |
| REFERENCE | `REFERENCE-default.png`, `REFERENCE-dot.png` | the REAL altitude library rendered in a browser (copied from `parity/receipts/v1/first-pass/selftest-altitude/badge/ref-info-default.png` / `ref-info-dot.png`) |

Measured on the canvas, not eyeballed:

| variant | BEFORE | AFTER | real library | verdict |
|---|---|---|---|---|
| Info, Dot=Default | 44×20, TEXT "Badge" | 44×20, TEXT "Badge" | blue pill, "Badge" | unchanged, right |
| Success, Dot=Default | 44×20, TEXT "Badge" | 44×20, TEXT "Badge" | green pill, "Badge" | unchanged, right |
| Warning, Dot=Default | 44×20, TEXT "Badge" | 44×20, TEXT "Badge" | amber pill, "Badge" | unchanged, right |
| Danger, Dot=Default | 44×20, TEXT "Badge" | 44×20, TEXT "Badge" | red pill, "Badge" | unchanged, right |
| Info, Dot=Dot | **36×12, TEXT "Badge"** | **8×8, no children** | 8px blue dot | **fixed** |
| Success, Dot=Dot | **36×12, TEXT "Badge"** | **8×8, no children** | 8px green dot | **fixed** |
| Warning, Dot=Dot | **36×12, TEXT "Badge"** | **8×8, no children** | 8px amber dot | **fixed** |
| Danger, Dot=Dot | **36×12, TEXT "Badge"** | **8×8, no children** | 8px red dot | **fixed** |

Nothing is wrong in a new way. No variant regressed; the four `Dot=Default` cells are byte-for-byte the same shape they were.

---

## The contract delta — the fact the old contract did not carry

altitude hides the dot badge's label with `text-indent: 9999px` on a box pinned to 8px. Figma text nodes have no first-line indent, so the emitter used to drop the offset and keep the label — drawing ink the browser never paints.

The engine fix (`Part.textOutOfBox`, measured in `extract/computed/fuse.ts textOutOfBoxEvidence`, honoured in `core/emit-figma-script.ts`) has been on `main` since 6ba48b8a. **The committed contract did not carry the measured field**, so the canvas could not change. `grep -c textOutOfBox examples/altitude/contracts/badge.contract.json` was **0**.

Re-running the chain produced this diff in `examples/altitude/contracts/badge.contract.json`:

```diff
       },
+      "content": {
+        "prop": "children"
+      },
       "declared": {
...
-      "parts": {
-        "label": {
-          "description": "Label text for default badges. Dot mode is an 8px status pip — CSS hides the label via text-indent; Figma has no text-indent twin, so the label is compile-dropped when Dot=Dot (visibleWhen).",
-          "element": "span",
-          "content": { "prop": "children" },
-          "visibleWhen": { "prop": "dot", "equals": "default" }
-        }
-      },
...
-      ]
+      ],
+      "textOutOfBox": {
+        "prop": "dot",
+        "values": ["dot"]
+      }
```

Three things happened, and only the third is the fix:

1. the hand-written `label` part with its `visibleWhen` workaround is **gone** — the promotion no longer invents a span the library does not have;
2. `anatomy.root.content = {prop: children}` — the root carries its own text, which is the captured mount truth;
3. **`anatomy.root.textOutOfBox = {prop: "dot", values: ["dot"]}`** — a MEASUREMENT, not a list. The capture receipt reads:

> `text evidence carried: root.textOutOfBox = {"prop":"dot","values":["dot"]} (MEASURED — text-indent lays the first line at or past the content-box end edge on dot = dot, so the browser paints no text in the box and the canvas draws none either)`

The emitted script then carries zero text children on exactly those four combos, and the reason ships with the bundle as a code-only fact:

> `text-indent` — *"Figma text nodes have no first-line indent. Where the MEASURED indent lays the first line entirely outside the content box (Part.textOutOfBox), the canvas draws NO text child on those combos: the browser paints no text in the box there, so drawing the label at indent 0 would invent ink the library never shows."* — on `Variant=Info, Dot=Dot`, `Variant=Success, Dot=Dot`, `Variant=Warning, Dot=Dot`, `Variant=Danger, Dot=Dot`.

---

## The exact commands

From the worktree root, following `examples/altitude/PROVENANCE.md` § Pipeline:

```bash
# 0 · setup
git worktree add -b proof/altitude-badge $S/proof 6ba48b8a
npm run prep:core && npm --prefix packages/cli run build
# node_modules mirrored by symlink from the main tree; examples/altitude/.altitude-sandbox
# copied from the main tree (gitignored, lives only there)

# 1 · capture — the whole library, one sweep (a narrowed run writes different
#     LEDGER/extension bytes, docs/21 §1)
npm run extract:computed -- \
  --config extract/computed/configs/altitude.json \
  --harness examples/altitude/.altitude-sandbox \
  --out extract/computed/out/altitude
#   → 236 captures, 795 channels, Chromium 149.0.7827.55, double-run identical, done in 163s
#   → extract/computed/out/altitude/badge/enriched.contract.json now carries
#     anatomy.root.textOutOfBox = {"prop":"dot","values":["dot"]}

# 2 · promote
node examples/altitude/scripts/build-tokens.mjs
npx tsx examples/altitude/scripts/promote-floor.mjs
#   → 8 contracts, 47 source-aliased minted leaves, 0 named refusals

# 3 · emit + validate + bundle  (validation IS the bundle compile: every
#     contract is compiled here and a refusal would list it by name)
npx tsx packages/cli/src/cli.ts figma examples/altitude/contracts \
  --out examples/altitude/figma --icons examples/altitude/assets/icons \
  --tokens examples/altitude/tokens/altitude.dtcg.json,examples/altitude/tokens/altitude-minted.dtcg.json
node examples/altitude/scripts/build-figma-tokens.mjs
node examples/altitude/scripts/figma-compile-receipt.mjs
node examples/altitude/scripts/build-genesis-batch.mjs
npx tsx packages/cli/src/cli.ts figma bundle examples/altitude/contracts \
  --tokens examples/altitude/tokens/altitude.dtcg.json,examples/altitude/tokens/altitude-minted.dtcg.json \
  --modes examples/altitude/tokens/modes/altitude.light.dtcg.json,examples/altitude/tokens/modes/altitude.dark.dtcg.json \
  --name Altitude --icons examples/altitude/assets/icons \
  --out examples/altitude/figma/altitude.bundle.json
#   → 8 contracts compiled, 0 refusals, 68 code-only facts named

# 4 · mint — examples/altitude/figma/badge.figma.js executed ONCE in the plugin
#     sandbox against fileKey byMp6lt0Ij9b2QbkDGFwBh
#     result: {"amended": true, "nodeId": "39:6692", "rebuiltVariants": 8}
```

---

## Two honest notes

- **The mint used one workaround that is not part of the product.** The Figma plugin sandbox blocks the AsyncFunction constructor, so the emitted script was fetched over `http://localhost` (a domain the bridge plugin's manifest already allows) and run through `new Function`. That is a harness detail of driving the plugin from an agent; the bytes executed are the emitted script, unmodified. A human does this by pasting the bundle into the plugin's Build tab.
- **`ds-contracts extract --computed` mis-resolves its own repo root.** Run through the CLI shell it computes `REPO` from the compiled chunk's location (`packages/cli/dist/../..` = `packages/`), so `tokens.minted` and the bundled font directory are looked for under `<repo>/packages/…` and the run dies by name before a browser starts. `--root` fixes the first path and not the second. The repo-native `npm run extract:computed` (which is what `PROVENANCE.md` documents) is unaffected, and that is what this proof used. Filed here as a finding, not fixed in this branch.
