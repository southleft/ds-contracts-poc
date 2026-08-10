# CONTINUE — freeze-board fidelity, feat/beta-rounds

BOARD — RE-DERIVED FROM THE ARTIFACTS, AND "18/77" WAS NEITHER OF THE TWO REAL
NUMBERS. It was inherited, I repeated it, and counting the files says:

  SCORECARD passes (scores/<stem>.json status=pass):   19/77
    alt 4/8  astryx 1/11  carbon 3/10  mui 4/31  polaris 4/12  tailwind 3/5
  CLAIMED passes (components/<stem>.json visual.ok):   17/77
    alt 4    astryx 0     carbon 3     mui 3     polaris 4     tailwind 3

The per-lane figures the old header listed sum to 19, while its headline said
18 — the arithmetic never matched its own row. The 2-stem gap between the two
columns is REAL and is the honest state, not an error: mui/checkbox and
astryx's one scorecard-pass have PASSING scorecards whose receipts still stand
fail-closed. A scorecard is permission to claim a pass; it is not the claim.
Quote which number you mean. first-party 11/54 (unre-derived this session).

Every one of the 19 is now backed by an emitter-built node and a CURRENT
capture — the fake divider pass and the stale-shot table pass are both gone,
and divider + linear-progress replaced them honestly.

HEAD: d4dbc91b. RUNTIME_EMIT_REV rt12-birthbox-declared-layout-only.
Gates: plugin-engine-check GREEN, figma-scripts-fresh 8/8, 7/7 genesis batches
mock-proven, console-loop-mui-evidence-check GREEN (31/31, ratchet 4).
FULL SUITE: 218/224 measured this session. `npm run golden:update` and
`npm run capability:report` already applied.

THE 6 SUITE FAILURES, triaged — MOST ARE NOT FROM THIS SESSION:
- `mui-figma-genesis` (switch-track expected 34x14, found 1x1) — **PRE-EXISTING.
  Proven**: stashed everything, checked out db4c90ae's (this session's OWN start
  commit) mock + switch.figma.js, and the pin fails there identically. The old
  CONTINUE named only capture-framing as red; that was incomplete.
- `child-wider-ratchet-and-script-freshness` — pre-existing (astryx textCaused
  33, the corpus-wide text-wrapping gap, docs/22).
- `console-loop-capture-framing-pin` + `console-loop-reference-content-checks` —
  pre-existing astryx FC-REF-FRAMING, PLUS the 6 new mui C1 violations below.
  C1 is never waivable; these must be fixed, not narrated.
- `capability-report-is-fresh` — was mine (I edited the capability matrix);
  FIXED by `npm run capability:report`.
- `console-loop-canvas-drift-probe` — was mine; FIXED. It asserted "mui: 30
  cell-pending", which encoded the blindness C1 just ended. The 30 did not
  become clean, they moved to SNAPSHOT-pending (cell pinned, no LIVE-SNAPSHOT
  entry). Expectation re-derived to 0 with that written down.
- `golden-generated-output` — was mine each time core changed; FIXED by
  `npm run golden:update` (run it after ANY re-emission).
EXPECTED STEADY STATE: 4 failures, all pre-existing and named
(mui-figma-genesis, child-wider-ratchet, capture-framing-pin,
reference-content-checks). If anything OTHER than those 4 is red, it is new and
belongs to this handoff.

VERIFIED BY TARGETED RUN (`npx tsx evals/run.ts --only <ids>` — use this; the
full suite cannot finish inside one turn in this environment and every
background attempt was killed at a turn boundary):
  ✔ capability-report-is-fresh
  ✔ console-loop-canvas-drift-probe
  ✖ console-loop-capture-framing-pin       1 unnamed/hard violation — mui/fab
  ✖ console-loop-reference-content-checks  same single cause
capture-framing hard violations went 8 -> 1 this session. THE ONLY ONE LEFT IS
mui/fab, and it is hard ON PURPOSE (see the residual status above). Every other
framing residual on all 79 pinned stems is now an "open (named)" FC-* refusal.

VERIFICATION STATUS, STATED PLAINLY. The last COMPLETE `npx tsx evals/run.ts`
was 218/224, taken BEFORE the last two eval-expectation fixes. Three attempts to
re-run it to completion afterwards were each killed by the environment at 139,
82 and 20 evals — with ZERO failures in the completed portion of the last two.
So the clean 220/224 is NOT yet observed end-to-end. The two fixes were instead
verified DIRECTLY against reality, which is stronger evidence than the eval
restating them:
  · capability-report-is-fresh — `npm run capability:report` now regenerates
    docs/24-what-works.md with NO diff. (It hashes evals/golden.json and
    evals/results.json, so it goes stale whenever eval OUTCOMES move and
    settles once they stop. Run it AFTER the suite, then commit.)
  · console-loop-canvas-drift-probe — the probe itself now reports
    "1 in-sync, 30 snapshot-pending, 0 cell-pending", matching the re-derived
    expectation of 0. And mui's scorecard passes are exactly
    checkbox/divider/linear-progress/radio, of which radio is the probed
    in-sync one — so the un-probed three ARE `wantUnmeasured`.
RUN THE FULL SUITE FIRST and confirm 220/224.
CAVEAT ON THAT RUN: the suite in flight at handoff STARTED BEFORE the C1
named-overhang change, so its capture-framing result will not reflect it.
Expect `console-loop-capture-framing-pin` and
`console-loop-reference-content-checks` to STILL be red afterwards regardless —
they are red on pre-existing astryx FC-REF-FRAMING entries, which this change
does not touch. Re-run once more to see the mui half settle.

## CLOSED THIS SESSION

- **FC-SLOT-BIRTH-BOX reaches COMPONENT roots.** buildNode was never the only
  call site; amendSet and amendComponent preserve the variant COMPONENT and
  rebuild only its interior, so the root kept Figma's 100px box forever. Three
  call sites now (one `birthBoxCall` helper). Proven on canvas: MUI Divider
  Inset 216x100 -> 216x1, Middle 256x100 -> 256x1, FullWidth now emitter-built
  rather than the hand-probe it was. `node.children` is an explicit container
  test — relaxing the guard first reached TEXT leaves and took down four
  genesis batches.

  **WHAT I ASSERTED WITHOUT MEASURING, and reverted (rt12).** Two claims in the
  rt10/rt11 commits were speculation stated as findings. Both are now reverted
  and the canvas is the reason:
   · The birth-box guard was relaxed from `spec.layout &&` to applyFrameSpec's
     default, described as closing "a latent hole". No such hole was measured —
     every divider root declares layout. MUI Switch's `switch-track` is a
     childless FRAME with NO declared layout measuring 34x14 FIXED live
     (21:612); a node the contract gave no layout is not one this repair
     understands. Guard restored.
   · The mock was taught the birth box for FRAME as well as COMPONENT. The
     evidence only ever covered a childless COMPONENT (Divider) and a SLOT;
     Switch's childless FRAME children measure 34x14 and 20x20 live, not
     100x100. Scoped back to COMPONENT. §8 still goes red-then-green, because
     the case it models is a COMPONENT root.
  I found both while hunting a "regression" (switch-track 1x1) that turned out
  to be RED AT db4c90ae, this session's own starting commit.
- **THE MOCK MODELED THE BIRTH BOX ONLY ON SLOT NODES** and was therefore
  structurally unable to see the divider defect (a plain COMPONENT). FRAME and
  COMPONENT now carry it, honored only while the axis reports HUG and dissolved
  by the first relayout. native-slots-check §8 red-tests both directions.
  CORRECTED LATER THE SAME SESSION: COMPONENT only, NOT plain FRAME — see
  "WHAT I ASSERTED WITHOUT MEASURING" below.
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

## RESIDUAL STATUS vs THE FREEZE-BOARD BAR

The bar is: foreign board green, OR every residual is a named FC-* refusal with
probe+pin. Where each residual stands as of this handoff:

  NAMED with probe+pin (done, see details below):
   · the 6 capture-framing C1 violations — each carries an FC code, a probe
     (what was read on the live canvas) and a pin (both boxes). FIVE of the six
     are C1's OWN semantics, not canvas defects.
   · FC-BASE-EQUAL-GEOMETRY-DROPPED — 15 findings, probe is
     `node scripts/base-equal-geometry-sweep.mjs`, pin is the committed
     BASE-EQUAL-GEOMETRY-SWEEP.json.
   · the 4 pre-existing suite failures — named above, one PROVEN pre-existing
     by checking out this session's own start commit.

   · C1's named-overhang vocabulary — DONE. `cellOverhang: {fc, renderW,
     renderH, why}` is accepted ONLY when the shot equals that
     independently-measured render box AND carries an FC code and a reason; it
     reports "open (named)", never a clean pass, and cannot launder a
     wrong-cell/whole-set shot (those match neither the box+margin nor the
     render box). mui C1 violations 6 -> 1.

  NOT YET NAMED — the one honest gap left:
   · **mui/fab.** It deliberately has NO cellOverhang entry and stays a HARD
     FC-CELL-FRAMING violation, because its 8x36 box for a Size=LARGE FAB is a
     genuine silent geometry loss and an allowance there would hide the very
     defect the gate should find. It is DIAGNOSED (below) but the fact is still
     neither carried nor ledgered, so it is not yet a named refusal. Fixing
     FC-BASE-EQUAL-GEOMETRY-DROPPED in fuse closes this AND the 15.

## NEXT 3 STEPS

1. **Verify the full suite** (`npx tsx evals/run.ts`) — see VERIFICATION STATUS
   above. Expect 220/224 with the 4 named pre-existing failures; anything else
   red is new. Everything else in this file is gate-verified; this is not.
2. **The 6 remaining C1 violations, which are the honest next FC.** All are
   "content RENDERS OUTSIDE its layout box":
     accordion  354x114 from 288x48   fab       44x72 from 8x36
     select     75x61 from 73.94x56   snackbar  324x85 from 288x49
     table-pagination 431x52 from 428x52        text-field 253x93 from 252.97x78.91
   **EACH RESIDUAL, PROBED AND NAMED (2026-08-10).** Every one of the six is a
   case where the SHOT (which is always absoluteRenderBounds — measured, five
   for five) legitimately exceeds the CELL BOX. None is a newly-found emitter
   bug; C1's margin guard already tolerates a UNIFORM overhang <=17px, and these
   six fail it on skew or magnitude:
     · mui/select — FC-OVERFLOW-NOT-DECLARED. PROBE: the contract ROOT declares
       NO overflow; only label / select-nativeinput / icon /
       outlinedinput-notchedoutline do. PIN: root 73.94x56, render 75x61, and
       the child `outlinedinput-notchedoutline` is 74x61. The notched outline
       renders ABOVE the box in real MUI too (inset:-5px). The canvas is right;
       nothing was dropped.
     · mui/table-pagination — FC-SCROLL-UNSUPPORTED. PROBE: the ROOT declares
       `overflow: auto/auto`. PIN: `auto` is held OFF canvas ON PURPOSE by
       DeclaredChannelSpec.drawExcept — Figma has no scroll container — so the
       root correctly does not clip. box 428x52, render 431.03x52 (3px).
       CARRY-CODE-ONLY, matrix row `overflow: scroll/auto`.
     · mui/snackbar — FC-EFFECT-BLEED. PROBE: root declares no overflow; the
       cell carries a drop shadow. PIN: box 288x49, render 324x85, a UNIFORM
       18px margin — 1px over C1's 17px allowance. This is the guard's own
       tolerance being marginally too tight for a shadow, not a geometry fault.
     · mui/fab — SILENT GEOMETRY LOSS (the real defect of the six). See the
       diagnosis below: box 8x36 for a Size=Large FAB because width/height were
       captured (56x56) and carried nowhere.
     · mui/accordion — FC-DECLARED-BY-PROP-MISSING. PROBE: overflow VARIES on
       the `expanded` enum, so fuse sent it to the sidecar as non-uniform. PIN:
       no `declaredByProp` vocabulary exists in the schema. Named schema gap.
     · mui/text-field — FC-AMBIGUOUS-IDENTITY. PROBE: rebuilding it REFUSES BY
       NAME on canvas — "duplicate ds_contracts/contractId mui.text-field on 3
       component targets". PIN: pre-existing canvas condition; the duplicates
       must be cleaned up in MUI Test 1 before the stem can be rebuilt at all.
   CONSEQUENCE FOR C1: five of six are the CHECK's semantics, not the canvas —
   C1 compares a render-bounds shot to a layout box and has no vocabulary for a
   legitimate, named overhang. It is documented "never waivable", which is right
   for "this shot is not that cell" and wrong for "this cell legitimately
   renders outside its box". THE NEXT DECISION IS C1's DESIGN, not six canvas
   fixes: give it a probed+named overhang allowance (per-stem, with the FC code
   above), keeping the never-waivable bite for wrong-cell/whole-set shots.
   Do NOT "fix" this by forcing clipsContent onto roots the contract never
   clipped — that would make the canvas lie to satisfy a gate.

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
     **FC-BASE-EQUAL-GEOMETRY-DROPPED — 15 silent geometry losses across
     10 stems in 6 libraries; fab is the exemplar, not the exception.**
     PROBE: `node scripts/base-equal-geometry-sweep.mjs`. PIN: the committed
     receipt BASE-EQUAL-GEOMETRY-SWEEP.json carries, per finding, the observed
     per-axis values and the base value they were measured against, plus the
     locus (INSIDE fuse) and the stated caveat. `node scripts/base-equal-geometry-sweep.mjs`
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
     **STOP — THE BASE-EQUAL-DELTA THEORY IS PROBABLY WRONG. READ THIS FIRST.**
     `extract/computed/replay.ts:148` starts each combo from
     `structuredClone(truth.base.root)` and then applies that combo's deltas on
     top (`:156`, `node.style[k] = v`). So a channel ABSENT from a delta
     RETAINS THE BASE VALUE — it is not undefined. For MUI Fab that means
     `el.node.style.width` is "56px" on the large combos, and the channel is
     fully observed as small 40 / medium 48 / large 56.
     If that is right (INSTRUMENT IT — one log line in the fuse mint loop for
     the fab root across the three sizes), then:
       · the value-level fallback I wrote could never have helped, which is
         exactly what was observed — it changed nothing;
       · the drop happens DOWNSTREAM, at the MINT/CARRY decision, not at
         observation. Something declines width/height for this part while
         accepting border-radius on the identical axis;
       · `scripts/base-equal-geometry-sweep.mjs` detects a real SYMPTOM (15
         channels carried nowhere and named nowhere — that part is verified
         from the shipped artifacts) but its stated CAUSE ("absent because it
         equals base") is a hypothesis that this reading contradicts. Keep the
         findings, distrust the explanation, and re-derive the cause at the
         mint.
     Three hypotheses about this bug have already died on measurement (value
     door, element level, and now most likely base-equal itself). Do not write
     another line of fix before the log line above prints.

     **SECOND ATTEMPT — THE PRECEDENCE OBSTACLE IS SOLVED, AND THE REAL GATE
     IS ONE LINE EARLIER THAN I THOUGHT.** Two findings, both reverted only
     because the third step is unfinished, not because they are wrong:
      1. PRECEDENCE IS SOLVED. Guarding at the literal's write site does NOT
         work — the token binding is minted AFTER the literal, so at write time
         there is nothing to detect. It must be a POST-PASS over
         `walkAnatomy(enriched)` just before fuse returns: for each part, drop
         `literals[ch]` when the same channel is carried in `tokens` or any
         `tokensByProp` map, and receipt the yield. The BINDING wins (named,
         themeable, per-variant); the literal is a base-plane fallback.
         With that, `npx tsx extract/computed/regate.ts` runs CLEAN across every
         library — polaris.tag no longer refuses — and computed-equal goes UP
         81.969% -> 82.189% (33968/41440 -> 34480/41952). More facts carried,
         nothing refused. This part is ready to re-apply.
      2. THE BASE FALLBACK STILL DOES NOT REACH FAB, and the reason is exact:
         `fuse.ts:1719` does `const el = a.getAligned(...)[pi]; if (!el)
         continue;` BEFORE any value inspection. For the axis value that equals
         base there is no aligned ELEMENT at all — not merely a missing value —
         so the loop skips the combo entirely and never reaches the
         `v === undefined` guard where a value-level fallback would live.
         Re-measured after the change: fab's enriched contract still has ZERO
         width/height and the sweep still reports 15.
      3. **CORRECTION TO (2) — MEASURED, DO NOT ACT ON THE "ELEMENT LEVEL"
         CONCLUSION.** I checked whether the large combos lack the ELEMENT or
         only the VALUE. They lack only the value:
             small  24 captures · elements[0] present · delta.width present
             medium 24 captures · elements[0] present · delta.width present
             large  23 captures · elements[0] present · delta.width UNDEFINED (23/23)
         So `if (!el) continue;` is NOT the gate and the fallback does NOT
         belong at the element level. The value-level fallback I wrote should
         have fired — and did not.
         THE REMAINING UNKNOWN, and the exact next question: the loop reads
         `el.node.style[channel]`, NOT `delta`. Raw captured-truth elements
         carry `delta` and no `style` at all (styleHasW is 0 for EVERY size,
         including the ones that carry a delta), so `a.getAligned()` is
         synthesising `.node.style` somewhere. FIND THAT RESOLUTION STEP and
         determine what it does with a channel absent from the delta — whether
         it merges base, or leaves the key unset. That is where the fact is
         lost, and it is one level below anything measured so far.
         NARROWED TO THE LAST UNKNOWN: `buildUnion` (anatomy.ts:922) sets
         `rep: node` — the captured node itself — and `alignedByKey` holds one
         FlatEl per union entry per capture, whose `.node` is THAT CAPTURE's
         node. So `el.node.style` is the aligned capture's own style object.
         But raw captured-truth elements carry `delta` and NO `style` at all
         (measured: styleHasW is 0 for every size). Therefore something in the
         CAPTURE LOADER expands `delta` into `style` before buildUnion ever
         sees it. THAT loader is the last unexamined layer and the only place
         left where fab's 56x56 can be going missing. Find where a Capture is
         read off disk and how it materialises `style` from `delta` + base.
         The decisive experiment is one log line: for the fab root, print
         `el.node.style.width` for a small, a medium and a large combo.

         NARROWED ONE MORE LEVEL: `getAligned` (fuse.ts:128) does nothing but
         return `union.alignedByKey.get(key)` — no resolution of its own. The
         aligned elements come from `buildUnion(captures, base, classPrefix)`
         (fuse.ts:101), and each carries `node: e.rep`. So `.node.style` is
         whatever buildUnion puts in `rep`, and THAT is the last unexamined
         layer between a capture that holds 56x56 and a loop that reads
         undefined. START THERE.
         INSTRUMENT IT (log the resolved style for the fab root across the
         three sizes). Do not reason from the call site — this is the third
         hypothesis in a row about this bug that measurement has overturned,
         and the pattern IS the finding: every layer here synthesises something
         for the layer above, so the altitude a fact dies at is never where
         reading the code suggests.

     **THE FIRST ATTEMPT AND ITS REVERT — and the attempt found the next
     obstacle, which is worth more than the hypothesis below.** The one-line
     change is exactly what you would expect: at fuse.ts ~1784, before
     `if (v === undefined) { unk ??= ...; continue; }`, fall back to the BASE
     capture's value when the channel is in BASE_FALLBACK_CHANNELS —
     `a.getAligned(space.baseComboKey + '__default')[pi]` — because an absent
     delta MEANS "same as base". It typechecks and it is the right semantic
     (scoped to the NON-INHERITED box-geometry channels only; an inherited
     channel must never do this).
     IT DOES NOT SURVIVE `npx tsx extract/computed/regate.ts`:
       polaris.tag: part "link" carries channel "width" as BOTH a token
       binding and a literal — ambiguous, refused by name
     So filling the gap creates a SECOND fact for a part that already had one,
     and the mint path has no precedence rule between a base-derived value and
     an existing binding/literal. THAT is the real work: decide precedence
     (existing binding wins? base fallback only when the channel is otherwise
     absent for that part?) and re-run regate across ALL libraries, not just
     mui. Reverted rather than shipped half-exercised.

     **HYPOTHESIS FOR THE FIX, NOT YET VERIFIED — instrument fuse before
     trusting it.** There are two doors and width appears to fall between them.
     fuse.ts:2390 (`b.ref === null`, UNCORRELATED) carries a BASE-PLANE LITERAL
     for exactly `BASE_FALLBACK_CHANNELS ∩ LITERAL_CHANNELS` — which width and
     height are in — but it is guarded on
     `baseOcc = obs.occurrences.find(o => o.variant === space.baseComboKey)`
     being defined. If the observation stream is built from DELTAS, the base
     combo contributes no occurrence and `baseOcc` is undefined, so that door
     never opens. Meanwhile the CORRELATED door sees only {small:40, medium:48}
     — large is missing for the same delta reason — so a 3-value size axis
     looks partial and is refused. Result: neither door, and no receipt.
     Border-radius reaching tokensByProp with all three values (incl. the
     base-equal large=28) is the counter-example that should tell you which
     door actually works and why.
     **THE LOSS IS INSIDE FUSE — promote/curation is ELIMINATED.** Checked
     fuse's own output: `extract/computed/out/mui/fab/enriched.contract.json`
     already mentions width and height ZERO times (min-height once), root
     `literals` is null, and its size map holds only the four radii. So the
     fact never leaves fuse; nothing downstream dropped it. Search fuse only.
     One more lead worth checking first: fuse.ts:1784 turns an absent value in
     ANY combo into `unk` ("unmintable"), which would explain a channel that is
     observed on two of three sizes vanishing wholesale — but fab's
     `codeOnlyChannels` has only 2 entries and width/height are not among them,
     so if that IS the path, the codeOnly receipt is ALSO not being written,
     which is a second defect on top of the first.
     CONFIRM BY INSTRUMENTING, not by reading —
     this exact style of reasoning-from-the-comment is what produced a wrong
     conflict measurement earlier this session.
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
