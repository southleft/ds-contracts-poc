# CONTINUE — freeze-board fidelity, feat/beta-rounds

BOARD (re-measured, not trusted): foreign 18/77 (alt 4/8, astryx 1/11, carbon 3/10,
mui 4/31, polaris 4/12, tailwind 3/5). first-party 11/54 scorecards.
NOTE: mui 4 counts divider, which is a PROVEN FAKE PASS (see below) — real is 3.

HEAD: 25213c01 (slot birth box, card PASS 1.02, mui checkbox restored 0.00).
Suite: plugin-engine-check GREEN; native-slots-check GREEN (§7 + red test).
console-loop-capture-framing-check EXITS NON-ZERO (mui/accordion FC-REF-FRAMING) — unfixed.

ACTIVE FC: FC-SLOT-BIRTH-BOX (generalized, UNCOMMITTED work in tree).
Figma's 100x100 birth box survives on ANY childless auto-layout node reporting HUG.
Proven twice live: Card Body SLOT 100->16 (card 320x142->320x58 = ref exactly);
MUI Divider COMPONENT 288x100->288x1 (library truth 288x1). Re-asserting HUG is a
no-op; only a FIXED resize round-trip re-measures. Fix = remeasureBirthBox in
core/emit-figma-script.ts, gated hasChildlessBox, GRID excluded (resize reverts
HUG tracks to FLEX). RUNTIME_EMIT_REV rt7->rt9-birth-box-general.

IN TREE, UNCOMMITTED: core/emit-figma-script.ts (generalized fix), evals/fixtures/
native-slots-check.ts (renamed to remeasureBirthBox), figma-sync/*.js (59 regenerated
by `npx tsx scripts/generate-figma.ts` — diff is ONLY rt9 + remeasureBirthBox, verified),
figma-sync/plugin/engine.receipt.json (re-recorded).

NEXT 3 STEPS
1. **THE FIX DOES NOT REACH COMPONENT ROOTS — finish it.** Measured after the
   rt9 rebuild of MUI Divider (set 83:1610, `amended:true, rebuiltVariants:3`):
   Variant=FullWidth 288x1 but Inset 216x100 and Middle 256x100. FullWidth is
   288x1 ONLY because I hand-probed that node earlier — the rebuild did not fix
   the other two. Two candidate causes, both unverified, MEASURE before fixing:
   (a) my call-site guard starts `if (spec.layout && ...)` but applyFrameSpec
       defaults it (`const l = spec.layout || {mode:'HORIZONTAL',...}`), so a
       root with no declared layout SKIPS the re-measure. Use the same default.
   (b) the AMEND path preserves the variant COMPONENT node and rebuilds only its
       interior, so buildNode never runs on the root and never re-measures it.
       If so the round-trip must also run in amendSet/amend-variant.
   Re-emit ALL artifacts again after any change (see step 0 below) and bump
   RUNTIME_EMIT_REV to rt10.
0. Re-emit recipe (verified this session): `npx tsx scripts/generate-figma.ts`
   for figma-sync/; then per-lib `npx tsx packages/cli/src/cli.ts figma
   examples/<lib>/contracts --out examples/<lib>/figma --icons ... --tokens ...`
   (args in scripts/figma-scripts-fresh.mjs LIBRARIES map); altitude via
   `npx tsx scripts/reemit-altitude-figma.ts`; polaris via
   `npx tsx examples/polaris/generate.ts`; then every
   `examples/<lib>/scripts/build-genesis-batch.mjs`; then
   `node scripts/build-plugin-zip.mjs --update-engine-receipt`.
   Verify with `node scripts/figma-scripts-fresh.mjs` (must be 8/8 byte-fresh).
2. mui/divider scorecard STILL CLAIMS PASS 0.00 AND IS STILL A FAKE PASS. Do NOT
   re-shoot it until step 1 lands — the current 288x1 FullWidth is a hand-probed
   node, and scoring it would launder a manual edit into evidence. Once the
   emitter builds it at 288x1, re-shoot -> POST /shot/mui/divider-cell -> rescore.
   If it does not pass, it is an honest FAIL and mui's RATCHET floor must be
   re-derived DOWN with justification (allowed: prior number measured a different
   thing). Also turn on capture-framing C1 for the mui lane — it was the check
   that would have caught this and it is cellPending on 30/31 stems.
3. Then FC-OVERFLOW-CLIP-LOST (below) — fully scoped, ready to implement.

BLOCKED-ON / OPEN
- FC-OVERFLOW-CLIP-LOST — FULLY SCOPED, READY TO IMPLEMENT. CORRECTION to my first
  read: overflow-x/overflow-y ARE already contract vocabulary and 103 parts across
  52 stems in 7 libraries ALREADY SHIP `declared: {"overflow-x":"hidden"}`. The fact
  reaches the contract fine and emit-react renders it. It dies in the CANVAS emitter.
  Change (4 files):
   1. packages/schema/src/contract-schema.ts:826-835 — overflow-x/y are registered
      with `canvas: "annotate"`, which routes them to the description footnote.
      Flip to "draw". CAUTION: the verdict is per-CHANNEL not per-VALUE, and
      docs/FIGMA-CAPABILITY-MATRIX.md:91-92 splits hidden|visible (native
      clipsContent) from scroll|auto (code-only). 22 `auto` entries get silently
      reclassified unless that is decided explicitly.
   2. core/emit-figma-script.ts ~2497-2514 — set spec.clipsContent = true beside the
      existing `box-sizing` / `aspect-ratio` reads. NOT inside applyDeclared: that
      returns a TextCtx, has no `spec`, and its `default: break` (~:2437) is the
      unreceipted sink eating all 103 parts today.
   3. extract/figma/channel-closure-check.ts:67 CHANNEL_TO_FIGMA — add both channels
      -> {properties:['clipsContent']}, or the closure gate hard-fails UNMAPPED.
   4. docs/FIGMA-CAPABILITY-MATRIX.md:91,329 — it already predicts this fix.
  HAZARD: three runtime loops (emit-figma-script.ts :5358, :5426, :5545) walk
  ancestors setting clipsContent=false for overhanging children. A newly-set true
  on a root WILL be silently reverted by any descendant that trips them; they fight
  last-write-wins and nothing reports the conflict. Also NodeSpec.clipsContent is
  typed `?: true` — there is no spelling for "explicitly unclip".
  NOT IN SCOPE: MUI Accordion collapse-root (the 354x114-from-288x48 case I measured
  live). Its overflow VARIES on the `expanded` enum, so fuse.ts:1842 sent it to the
  sidecar as non-uniform; there is no `declaredByProp` vocabulary in the schema and
  stylesWhen is documented "Canvas v1: not represented". That is a schema addition
  on top of this fix, not part of it.
- INSTRUMENT (scorer) is ink-box blind, measured: extract/figma/canvas-gate/score.ts
  crops BOTH sides to their own ink box (WHITE_TRIM=250, white is not ink) and the
  diff denominator is that union. So white-on-white chrome AND frame-footprint deltas
  are invisible. 9 stems have a background that renders >=250 over white; 23/73 have an
  ink box under-covering the declared box by >10%. Caveated passes to re-examine:
  altitude/heading, mui/radio, mui/table, polaris/banner, polaris/text-field,
  polaris/tag (off-lane ref), carbon/tag (+2.3px), tailwind/alert (+3.5px).
  mui divider is the one CONFIRMED fake pass. Also: capture-framing C1 is UNASSERTED
  for 30/31 mui stems (framing.json cellPending) — the geometry check that would have
  caught divider is off.
- 25 of 54 first-party receipts point at a SUPERSEDED emitted script (emitted/ keeps
  62 orphaned older-generation files; "exists" != "current"). 10 of the lane's 11
  scorecard passes were built from superseded scripts. Only `card` is verified current.
- Carbon/checkbox indent: capture faithful (20+10). Do NOT "fix" contract to 24.

RULES: never relax compositionOk; flip only on scorecard; localhost (not 127.0.0.1)
for plugin fetch; stem-serve running on :9224 (dir /tmp/ds-stem-serve).
