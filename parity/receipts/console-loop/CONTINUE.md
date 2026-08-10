# CONTINUE — freeze-board fidelity, feat/beta-rounds

BOARD: foreign 18/77 (alt 4/8, astryx 1/11, carbon 3/10, mui 4/31, polaris 4/12,
tailwind 3/5). first-party 11/54. Unlike the 18 this session opened with, every
one is now backed by an emitter-built node and a CURRENT capture — the fake
divider pass and the stale-shot table pass are both gone, and divider +
linear-progress replaced them honestly.

HEAD: 3c745d20. RUNTIME_EMIT_REV rt11-overflow-clip-drawn.
Gates: plugin-engine-check GREEN, figma-scripts-fresh 8/8, 7/7 genesis batches
mock-proven, console-loop-mui-evidence-check GREEN (31/31, ratchet 4).
console-loop-capture-framing-check EXITS NON-ZERO — 6 named C1 violations, see
below. A FULL `npx tsx evals/run.ts` was still RUNNING at handoff and its result
is UNVERIFIED — run it first. `npm run golden:update` was already applied for
the rt10/rt11 re-emissions (59 figma-sync files).

## CLOSED THIS SESSION

- **FC-SLOT-BIRTH-BOX reaches COMPONENT roots.** buildNode was never the only
  call site; amendSet and amendComponent preserve the variant COMPONENT and
  rebuild only its interior, so the root kept Figma's 100px box forever. Three
  call sites now (one `birthBoxCall` helper). Proven on canvas: MUI Divider
  Inset 216x100 -> 216x1, Middle 256x100 -> 256x1, FullWidth now emitter-built
  rather than the hand-probe it was. The layout guard also mirrors
  applyFrameSpec's default now (it had skipped every layout-less root), and
  `node.children` is an explicit container test — relaxing the guard first
  reached TEXT leaves and took down four genesis batches.
- **THE MOCK MODELED THE BIRTH BOX ONLY ON SLOT NODES** and was therefore
  structurally unable to see the divider defect (a plain COMPONENT). FRAME and
  COMPONENT now carry it, honored only while the axis reports HUG and dissolved
  by the first relayout. native-slots-check §8 red-tests both directions.
- **capture-framing C1 minted for the mui lane** (31/31, 0 cellPending). The
  open question in the old cellPending reason is MEASURED: `exportAsync` at
  scale 1 returns EXACTLY `absoluteRenderBounds`, five for five. C1 stays
  pinned to the LAYOUT box deliberately — pinning render bounds would make it
  compare the export to itself.
- **FC-OVERFLOW-CLIP-LOST.** 102 parts / 34 stems (162 hidden, 20 clip, 22
  auto) reached the contract and emit-react and died at applyDeclared's
  `default: break`. Now drawn as clipsContent.
  `DeclaredChannelSpec.drawExcept` + `channelDraws()` carry the per-VALUE split
  (auto/scroll stay off-canvas — Figma has no scroll container) and absorbed
  the overline carve-out that was hardcoded at the consumer.
  native-slots-check §9 red-tests it.

## NEXT 3 STEPS

1. **Verify the full suite** (`npx tsx evals/run.ts`) — it was mid-run at
   handoff. Everything else here is gate-verified; this is not.
2. **The 6 remaining C1 violations, which are the honest next FC.** All are
   "content RENDERS OUTSIDE its layout box":
     accordion  354x114 from 288x48   fab       44x72 from 8x36
     select     75x61 from 73.94x56   snackbar  324x85 from 288x49
     table-pagination 431x52 from 428x52        text-field 253x93 from 252.97x78.91
   Split, measured, not guessed:
   - **accordion / fab / snackbar / table declare NO overflow**, so the clip was
     never going to reach them. accordion's overflow VARIES on the `expanded`
     enum, so fuse.ts:1842 sent it to the sidecar as non-uniform; carrying it
     needs `declaredByProp` vocabulary that the schema does not have. That is a
     schema addition, scoped OUT here.
   - **fab: DIAGNOSED — a SILENT geometry loss, and it is the real find of the
     session.** The cell box is 8x36 for a Size=Large FAB (render 44x72). The
     root hugs its label because the contract carries NO width and NO height at
     all — only `min-width: {imported.shared.size-0}` (zero) and a uniform
     `min-height: 36px`. The `size` tokensByProp map carries ONLY the four
     border-radii.
     The capture SAW the geometry: `extract/computed/out/mui/fab/
     captured-truth.json` holds `/base/root/style` = **56px x 56px** and
     per-variant deltas of 40x40. The radii that DID carry prove it too —
     small 20 / medium 24 / large 28 are the radii of 40 / 48 / 56 circles.
     So the fact was captured, was dropped between capture and contract, and
     NOTHING NAMED THE LOSS: `fab.extension.json` mentions width/height ZERO
     times and the lane LEDGER.md has no entry.
     It is not a general fuse limitation — `width`/`height` are in
     LITERAL_CHANNELS and 12+ sibling mui contracts carry them (accordion 20
     occurrences, autocomplete 31). FAB is the outlier.
     **ROOT CAUSE FOUND (mechanism, not yet fixed).** Grouped the 71 captures
     by size (`captured-truth.json` capture `key` prefix):
         small  -> 40px x 40px
         medium -> 48px x 48px
         large  -> ABSENT
         base   -> 56px x 56px
     `large` has NO delta because the deltas record only what differs from
     BASE, and the base capture IS the large FAB. So the per-size map for
     width/height never completes and the channel is dropped, while
     border-radius — which has the SAME base-equal-large shape (20/24/28, and
     28 is the base) — carried all three. Both channels are in
     BASE_FALLBACK_CHANNELS *and* LITERAL_CHANNELS (fuse.ts:1435), so the
     base-fallback machinery exists and radius reaches it. Find why
     width/height do not take that path (start at fuse.ts:1828 `skipFolds &&
     BASE_FALLBACK_CHANNELS.has(channel) && LITERAL_CHANNELS.has(channel)` and
     the tokensByProp mint that radius went down instead).
     CONFIRMED SILENT: fab.extension.json `codeOnlyChannels` has exactly TWO
     entries (transition-behavior, vertical-align); the only minted geometry
     keys are line-height and min-height. width/height appear in no ledger, no
     codeOnly, no receipt. Must end CARRIED or LEDGERED — silent is the one
     outcome that is not allowed.
     **THE SWEEP IS DONE AND FAB IS NOT ALONE: 15 silent geometry losses across
     10 stems in 6 libraries.** `node scripts/base-equal-geometry-sweep.mjs`
     (receipt committed at BASE-EQUAL-GEOMETRY-SWEEP.json). It reports a
     geometry channel that is observed on SOME axis values, absent on at least
     one other, and present in NEITHER the contract NOR the extension ledger:
         altitude/button  width,height    altitude/chip     width,height
         altitude/heading height          altitude/iconclose height
         altitude/link    width,height    astryx/token      height
         carbon/button    width           fluent/dialog     width,height
         mui/fab          width,height    shadcn/card       height
     altitude/iconclose is the least deniable: height is observed as
     8/12/20/24/32/36/40 across xs..xxxl and carried NOWHERE.
     NOTE altitude/heading and altitude/link are already on the caveated-pass
     list below — a silent height loss is a candidate explanation for both, so
     fix this before re-examining them.
   - **select / table-pagination DO declare overflow** and the clip landed on
     inner parts, not the cell ROOT, so render is unchanged. Find why the root
     part does not carry it.
   - **text-field REFUSES BY NAME** on canvas: "duplicate ds_contracts/
     contractId mui.text-field on 3 component targets — refusing ambiguous
     identity". Pre-existing canvas condition; clean up the duplicates in
     MUI Test 1 before it can be rebuilt at all.
3. Then the other lanes' C1 — only mui was minted this session; astryx (1/11)
   and carbon (3/10) are the weakest boards.

## STANDING FACTS / HAZARDS

- **MEASURE THE TRIGGER, NOT THE COMMENT.** I measured the corpus for
  clip-vs-overhang conflicts, got ZERO, and the refusal fired on the first
  build. The comment said "overhanging children"; the code triggered on
  `childNode.clipsContent === false`, which is true of nearly every frame. The
  propagate walk now keys off `dsOverhangUnclip` (ancestors an overhang
  actually unclipped). Do not model a trigger from its docstring.
- The unclip heuristic is BROADER THAN CSS: it read "is out of flow" as "hangs
  outside the box". `position: absolute` inside `overflow: hidden` is clipped,
  normally. A DECLARED clip now STOPS the walk (`dsDeclaredClipStops`) — a
  captured fact outranks an inference about one. Fluent Spinner is the
  counter-example that made it visible.
- INSTRUMENT (scorer) is ink-box blind: extract/figma/canvas-gate/score.ts crops
  BOTH sides to their own ink box (WHITE_TRIM=250), so white-on-white chrome and
  frame-footprint deltas are invisible. Still open. Caveated passes to
  re-examine: altitude/heading, mui/radio, polaris/banner, polaris/text-field,
  polaris/tag, carbon/tag (+2.3px), tailwind/alert (+3.5px).
- mui/divider's scorecard covers ONE of three variants. Inset and Middle — the
  two that were actually broken — have references on disk
  (extract/computed/out/mui/divider/orig-shots/{inset,middle}__default.png) and
  no scorecard cell.
- 25 of 54 first-party receipts point at a SUPERSEDED emitted script (emitted/
  keeps 62 orphaned older-generation files). 10 of that lane's 11 scorecard
  passes were built from superseded scripts; only `card` is verified current.
- Carbon/checkbox indent: capture faithful (20+10). Do NOT "fix" contract to 24.

## RE-EMIT RECIPE (verified twice this session)

`npx tsx scripts/generate-figma.ts`; then per-lib `npx tsx
packages/cli/src/cli.ts figma examples/<lib>/contracts --out examples/<lib>/figma
--icons examples/<lib>/assets/icons --tokens
examples/<lib>/tokens/<lib>.dtcg.json,examples/<lib>/tokens/<lib>-minted.dtcg.json`
(mui carbon tailwind astryx shadcn fluent); altitude via
`npx tsx scripts/reemit-altitude-figma.ts`; polaris via
`npx tsx examples/polaris/generate.ts`; then every
`examples/<lib>/scripts/build-genesis-batch.mjs`; then
`node scripts/build-plugin-zip.mjs --update-engine-receipt`; verify with
`node scripts/figma-scripts-fresh.mjs` (must be 8/8) and
`node scripts/plugin-engine-check.mjs`. Bump RUNTIME_EMIT_REV on any runtime
template change or amend skips as "unchanged".

## CANVAS LOOP

MUI lane lives on fileKey 59mLQlOMiD5w5za6SUcoO5 ("MUI Test 1") and it IS
Desktop-Bridge connected — that is what unblocked C1. stem-serve on :9224
(dir /tmp/ds-stem-serve); route is `/file?name=<f>` (NOT `/<f>`), shots POST to
`/shot/<lib>/<stem>-cell`. Rebuild a stem by copying its emitted script into
/tmp/ds-stem-serve and `fetch`ing it from figma_execute — the plugin CAN fetch
localhost (not 127.0.0.1). Cell ids live in
parity/receipts/console-loop/visual-truth/mui/<stem>.json.

RULES: never relax compositionOk; flip only on scorecard; NEVER score a
hand-probed node.
