# shadcn round — provenance

**Subject:** shadcn/ui registry defaults, vendored by **CLI 4.16.2** (`-b radix
-p vega`, baseColor neutral) over **`radix-ui@1.6.7`** + **`tailwindcss@4.3.3`**
+ `react@19.2.4`, `lucide-react@1.30.0`, `@fontsource-variable/inter@5.3.0` —
pinned in `.shadcn-sandbox/` (git-ignored; RECON §1 recreate block). The
**eighth library** through the pipeline and the **second control case** for the
generality thesis after Carbon: the capture-config review (RECON §4, approved
2026-08-08 by the coordinating session under owner delegation) predicted a
config-plus-seeds round; what it actually cost is the first section below.

shadcn is **copy-in source, not an npm package** (RECON §2): the mounted
`library.package` is the sandbox barrel `@shadcn-sandbox/ui@0.0.1`; the real
pin is the **sha256 ledger of the vendored files** in RECON §2.2. A re-fetch
that hashes differently is a *named registry drift*, never a silent one. The
coverage claim is "shadcn registry defaults as of that ledger", never "shadcn
users' components" (RECON §2.3).

## The generality verdict — predicted vs actual

**Engine files changed: 2.** Both are the exact remedy the engine's own
refusal message named, both are corpus-neutral by measurement (no committed
contract anywhere carries either channel class), and both are *first-library*
classes — shadcn is the first library through the pipeline with a
custom-property STATE delta, and the first with a stroke-drawn icon set.

1. **`extract/computed/fuse.ts` — the state-plane custom-property door.**
   Button's `active:not-aria-[haspopup]:translate-y-px` sets
   `--tw-translate-y: 1px` on the active plane. The BASE fusion has refused
   custom properties by name for two rounds ("a custom property is the
   library's token plumbing observed on the element, not a rendered fact");
   the STATE-mint path had no such door, so `--tw-translate-y` minted as a
   state token and the enriched contract failed generator validation
   (TOKEN_CHANNELS correctly has no entry for a custom property) —
   **quarantining Button**. The fix mirrors the existing base-plane rule onto
   state deltas; the rendered motion itself rides the registered `translate`
   channel alongside.
2. **`packages/schema/src/contract-schema.ts` — `stroke` / `stroke-width`
   registered in TOKEN_CHANNELS.** lucide glyphs are **stroke-drawn**
   (`stroke="currentColor" fill="none"`) where Carbon-class glyphs are
   fill-drawn, so the captured icon parts carry `stroke` (color) and
   `stroke-width` (px) — channels no prior library ever styled (`stroke`'s CSS
   initial is `none`, unmintable, so fill-based libraries never minted it).
   Unregistered, they **quarantined Select**. Both are drawn the same way
   `fill`'s registry entry already claims: the promoted glyph markup carries
   them verbatim and `iconSvg`'s currentColor pass bakes the paint.

**Sandbox/config, not engine** (the Carbon-precedent class):

- **`capture-input.css`: the `@fontsource-variable/inter` `@import` is
  stripped from the capture build.** The built `tailwind.css` otherwise embeds
  `@font-face` blocks whose `src: url(./files/…woff2)` are package-relative
  paths the harness bundler cannot resolve (esbuild refuses; run 1 died on
  it). The hermetic-harness answer is the Altitude precedent: the real
  `'Inter Variable'` face rides the config's `fonts.faces` substrate as a
  data: URI from the sandboxed npm package. `--font-sans` still names the
  family via the theme block, so glyphs are real Inter on every render —
  capture, gate, and replay.
- Select reshaped to the **closed surface** and Dialog **stopped** — the
  witnessed refusals below.

## Witnessed refusals — predicted vs surprise

**Predicted by the recon and honored (RECON §5):**

- **H2 — alpha-modified utilities bind no token names.** Every `/NN` modifier
  compiles to `color-mix(...)`; hover/destructive planes mint anonymous
  literals with correct pixels, base planes bind. Measured: **529 verified
  source facts** across 10 non-portal components (Button 400) against the
  `--` (whole-vocabulary) CSS-vars reader; minted tree splits **48
  source-aliased / 333 literal**.
- **H4 — every Radix `data-state` rendering is a prop-selected VARIANT AXIS**
  (`checked` on Checkbox tri-state, `Size × Checked` on Switch), never a
  stateProp.
- **H5 — dark mode is a class scope, not a capture mode.** One light capture;
  `.dark` became `tokens/modes/shadcn.dark.dtcg.json` at wrap time
  (53-name complete inventory per mode, the Carbon mode-gap lesson).
- **H6 — the Switch thumb offset is a named refusal, the knob still ships.**
  Measured: computed `translate` on the thumb is **`calc(100% - 2px)`** — the
  calc does NOT resolve to px in Chromium's computed value, exactly the open
  question H6 posed. Refused by name ("declared-channel value varies across
  combos"); the thumb's box/color promoted (real-DOM thumb, better than
  Flowbite's `::after`, as predicted).
- **H3 (Tooltip half) — portal degraded by design.** portalCapture +
  openDriver captured the bubble+arrow through the popper-wrapper unwrap;
  `states: []`, 0 source facts (portalSweep takes no varPrefix — standing
  corpus-wide degradation).
- **H9 — no random-id flake.** Both full sweeps byte-identical in every run;
  only Checkbox carries an `id` pin (per §4.2). No other witnessed pin was
  needed, so none was added.
- **AvatarImage refused by name**; fallback-only capture (Radix-canonical).

**Surprises (not in the hazard ledger):**

1. **Dialog is STOPPED — `MULTI-ROOT-CAPTURE` refusal.** Radix portals the
   Overlay and the Content as **flat siblings of `document.body`**, plus two
   `[data-radix-focus-guard]` spans: 4 portaled roots. Every prior modal
   through the pipeline (MUI, Carbon, flowbite) portals ONE wrapper root;
   single-root fusion carries exactly one, and multi-root fusion is a named
   future class in `portalSweep`. H3 predicted "degraded", not "refused" —
   the prediction was wrong and the round says so. The config entry is
   preserved verbatim under `__stopped-components`; no Dialog contract ships.
2. **Select's open list is the same stopped class** (3 portaled roots: two
   focus guards + the popper wrapper, plus the in-stage trigger). The
   §4.2-recommended companion capture of `SelectTrigger` as a plain component
   is ALSO unmountable — witnessed `` `SelectTrigger` must be used within
   `Select` `` (Radix scope context; same for `TabsList`, which kills the
   "TabsList-with-children as the mount" spelling). What ships is the
   §4.2-licensed fallback: the composed **root mounted closed** — the trigger
   IS the in-stage surface (placeholder shown; a controlled value without
   mounted items renders an empty `SelectValue`, so the placeholder is the
   canonical closed rendering) — with the child-axis `size`/`variant` pinned
   and deferred by name (docs/21 §7.3).
3. **`showCloseButton` cannot be a presenceProp** — the presence grammar
   drives ROOT props only and the prop lives on the child `DialogContent`
   (moot once Dialog stopped, but the grammar gap is real and named).
4. **The tooltip arrow is a `<polygon>` — outside the svg-asset v1 grammar**
   (`path`/`g`/`circle`; `svg-child-outside-grammar` refusal, receipted). The
   arrow therefore ships as an unsized box part, which the compile-receipt
   run measured as **one real child-wider overflow** (the mock's default
   100px frame inside the 10px icon). Extending the grammar needs *attribute*
   capture (`points` is not a computed style) — a capture-schema change, its
   own round.
5. **Instrument gap, named not exploited:** the shared `countChildWider` scans
   set-parented cells whenever ANY component set exists in the mock, so
   shadcn's STANDALONE Tooltip sits outside its denominator and the committed
   `scripts/child-wider-baseline.json` row records 0 — **understating by
   exactly the overflow above**. The row's `cause` field says so; widening
   the scan moves every library's committed number (standalone components
   exist corpus-wide) and is its own instrument round.
6. **RECON's "~63 declarations" estimate measured 53** `:root` variables
   (32 color [31 oklch→hex], 8 dimension, 2 number, 11 string).

## Reader configuration — what shadcn needed and why

`extract/computed/configs/shadcn.json` (408 lines): `classAllow: "^$"` (every
class is a utility; part identity rides geometry/DOM — `data-slot` noted as
the future signature key, not needed this round), `varPrefix: "--"` (shadcn's
`@theme inline` makes utilities reference the SEMANTIC variable directly:
`.bg-primary { background-color: var(--primary) }`, `:root`-scoped — the
recon's bind proof held at capture), mount = prebuilt `tailwind.css` +
`<TooltipProvider>` (context-only; SSR-witnessed and capture-verified to
render **no DOM box** — captured roots are the components themselves),
`fonts.faces` = Inter Variable (weight 100–900) from the sandboxed
fontsource package, `unsetLabel: "unset"`, `cartesianLimit: 512` (Button's 96
combos with the disabled plane is the max actually enumerated).

`mintedBootstrap` rode the first capture pass only (task-#28 ordering guard:
zero-leaf stub, receipted); promote filled the tree (381 leaves) and the
capture was **re-run against the shipped minted tree** — the committed
scorecards record `shippedMinted.leavesAdded` 243–350 per component. The flag
is gone from the committed config; the floors did not move between the two
passes.

## Pipeline (repo root)

```bash
npx tsx examples/shadcn/scripts/build-tokens.mjs      # built CSS → 53-token DTCG + Light/Dark modes + vars.css
npm run extract:computed -- --harness examples/shadcn/.shadcn-sandbox \
  --config extract/computed/configs/shadcn.json --out extract/computed/out/shadcn
npx tsx examples/shadcn/scripts/promote-floor.mjs     # + figmaStatePreviews probe + source-alias pass
npx tsx packages/cli/src/cli.ts figma examples/shadcn/contracts --out examples/shadcn/figma \
  --icons examples/shadcn/assets/icons \
  --tokens examples/shadcn/tokens/shadcn.dtcg.json,examples/shadcn/tokens/shadcn-minted.dtcg.json
npx tsx packages/cli/src/cli.ts generate examples/shadcn/contracts --target react \
  --out examples/shadcn/generated --icons examples/shadcn/assets/icons \
  --tokens examples/shadcn/tokens/shadcn.dtcg.json,examples/shadcn/tokens/shadcn-minted.dtcg.json
node examples/shadcn/scripts/build-figma-tokens.mjs
node examples/shadcn/scripts/figma-compile-receipt.mjs
node examples/shadcn/scripts/build-genesis-batch.mjs
npx tsx packages/cli/src/cli.ts figma bundle examples/shadcn/contracts \
  --tokens examples/shadcn/tokens/shadcn.dtcg.json,examples/shadcn/tokens/shadcn-minted.dtcg.json \
  --modes examples/shadcn/tokens/modes/shadcn.light.dtcg.json,examples/shadcn/tokens/modes/shadcn.dark.dtcg.json \
  --name Shadcn --icons examples/shadcn/assets/icons --out examples/shadcn/figma/shadcn.bundle.json
npm run extract:computed:scorecard -- --dir extract/computed/out/shadcn \
  --config extract/computed/configs/shadcn.json --write
```

Both emissions (React and figma scripts) were run **twice and byte-compared
identical**; the capture's own determinism proof is the built-in second full
sweep ("byte-identical across two full sweeps in one session" in every
component's numbers.json), run on THREE separate occasions in this round.

## Gates (default-state floor)

| component | axes | combos | computed | pixel AA perfect | src facts | named refusals |
|---|---|---|---|---|---|---|
| Alert | variant(2) | 2 | 61.404% | 0/8 | 11 | 3 |
| Avatar | size(3) | 3 | 50.000% | **12/12** | 9 | 0 |
| Badge | variant(6) | 6 | 82.341% | 0/24 | 25 | 5 |
| Button | variant(6)×size(8) × disabled | 96 | 74.516% | 0/384 | 400 | 11 |
| Card | size(2) | 2 | 70.370% | 0/8 | 16 | 8 |
| Checkbox | checked(3) × disabled | 6 | 67.544% | 7/24 | 10 | 7 |
| Input | — × disabled | 2 | 93.103% | 0/8 | 4 | 4 |
| Select (closed) | — × disabled | 2 | 73.884% | 0/8 | 8 | 9 |
| Switch | size(2)×checked(2) × disabled | 8 | 65.556% | 14/32 | 32 | 6 |
| Tabs | — (2-deep childrenSpec) | 1 | 82.120% | 0/4 | 14 | 7 |
| Tooltip | — (portal) | 1 | 57.143% | 0/1 | 0 | 11 |

**TOTALS: floor 73.6%** (computed equality, weighted over 22,516 cells) · 71
named refusals · **0 open review-queue items** · 0 unmeasurable · 0
quarantined (after the two engine fixes; Button and Select were quarantined
BY the pre-fix engine, receipts preserved in that run's refusal.json until
the fix landed).

Avatar is the row to read carefully: **pixel-AA-perfect 12/12 (meanAA 0)**
while computed string-equality sits at 50% — the render is visually exact and
the divergence is channel-string spelling, counted honestly by the exact
gate. This round is also the corpus's first with REAL webfont glyphs on both
sides of the pixel gate (the fonts substrate; Carbon's 0-AA-everywhere was a
fallback-glyph artifact).

Genesis: **72 API-grid variants across 8 sets + 3 standalone components**
(Select, Tabs, Tooltip), **418 variables (48 Figma-native source aliases,
Light/Dark modes)**, batch mock-proven (12 blocks, refuse-to-write). Compile
receipt: 11 scripts green with shadcn-specific pins — closed-Select surface
(placeholder present, "Option 1" must NOT appear), Checked-axis orthogonality
on the pure enum grid, tri-state glyph reaching `createNodeFromSvg` with real
path geometry.

## Named residuals and deferrals (defect-first)

- **Dialog: no contract this round** (multi-root portal refusal above). The
  multi-root fusion class is the named unlock; Radix's flat-sibling portal
  shape is now the canonical test case for it.
- **Select open list / Tooltip states**: portal-path degradations, standing
  corpus-wide (docs/23 §B.1/§B.2).
- **Child-axis deferrals (docs/21 §7.3):** Select `size` (on Trigger), Tabs
  `variant` (on TabsList) — pinned defaults, deferred by name. Radix context
  scoping makes child-first mounts impossible, so these stay until child-prop
  enumeration exists.
- **Switch thumb `translate: calc(100% - 2px)`** — named refusal (H6); the
  translate-longhand decomposition bakes plain percentages only.
- **Tooltip arrow polygon** — svg v1 grammar refusal + the child-wider
  instrument blind spot (both named above).
- **`type` on Input** deferred by name (attribute pass-through, not an enum).
- **figmaStatePreviews refused by the referee on Select and Tabs** (their
  active/focus-visible deltas carry no token overrides — the preview would
  render identically to Default); accepted on Badge/Button/Checkbox/Input/
  Switch.
- The **`-webkit-text-fill-color` family** and pseudo-element frontier lines
  are the standing corpus-wide receipts, unchanged.

## Coverage of this library — the denominator

**11 contracts shipped of 12 configured** (Dialog stopped, named) — the 12
were hand-picked for value density from a registry of ~50+ components
(blocks/charts/sidebar organisms out of scope by name, RECON §7). Every
number in this file is measured over that slice.
