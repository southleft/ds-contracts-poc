# Console-loop ledger — astryx

File: https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing  
Transport: Figma Console MCP `figma_execute` + `clientStorage` chunk upload (bridge :9228)  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Tokens | **completed** |
| Completed receipts | **13** / 13 |
| Failed | 0 |

Per-component evidence: `components/<stem>.json` + `.md` (kind `console-loop-astryx-component`).

## Summary

| Stem | Status | nodeId | v6 |
|---|---|---|---|
| token | completed | 1:3763 | v6:1746840295 |
| badge | completed | 1:3794 | v6:1192491616 |
| banner | completed | 1:3813 | v6:3231585800 |
| button | completed | 1:3864 | v6:1886612596 |
| checkbox-input | completed | 1:3873 | v6:2853217606 |
| dropdown-menu-item | completed | 1:3876 | v6:2766064663 |
| progress-bar | completed | 1:3900 | v6:3944709192 |
| slider | completed | 1:3955 | v6:1713883142 |
| switch | completed | 1:3964 | v6:754295416 |
| text-input | completed | 1:4003 | v6:1777886922 |
| toast | completed | 1:4006 | v6:72066831 |
| card | completed | 1:4047 | v6:3092228042 |
| dropdown-menu | completed | 1:4050 | v6:253339315 |

## 2026-08-08 — FC-CELL-FRAMING round: the defect was on the REFERENCE side

All seven astryx stems that failed `compositionOk` were re-measured against the
LIVE canvas via the Desktop Bridge (fileKey GnQnjSNBXtgtd2Ht0Hs1C8). Every
committed shot is exactly its 1x VARIANT cell + an 8px margin — the canvas
capture was never wrong. The references are what fail:

| stem | sr | named cause |
|---|---|---|
| banner | 1.08 | **FC-REF-CROSS-LIBRARY** — the "developed reference" is a POLARIS Banner (`extract/computed/out/banner/gate-shots/info.off.off__default.png`, the polaris config's output). astryx has no Banner in `extract/computed/configs/astryx.json`. |
| text-input | 45.67 | **FC-REF-WHOLE-PAGE** — reference is a 1440x2200 full-page doc-site screenshot. Its pixel bar is ALREADY met (1.72 AA <= 5); a correctly framed single-cell reference is the only thing between this stem and a genuine pass. |
| card | 1.43 | reference re-pointed to `out/astryx/card/gate-shots/default__default.png`; residual height delta is driven by the pre-Theme-mount **Times** substrate in that stale gate-shot |
| slider | 4.90 | reference re-pointed to `out/astryx/slider/gate-shots/horizontal.tooltip__default.png` (correct library, correct variant, Figtree). Framing excuse gone — **FC-ABS-SIZE** is real: canvas track 240px vs developed ~49px. |
| checkbox-input, progress-bar, token | 1.61 / 3.53 / 1.42 | FC-REF-FRAMING — emit-html first-item renders in the Times fallback (token's reference lost the chip box entirely). No astryx entries in the computed config to retarget to. |

Found by the new pin, not by the scorer: **astryx/toast** shipped a 336x132 shot
of the 320x116 `Type=Info` cell of the UNRELATED `Toast` set 1:802. The astryx
Toast node 1:4006 is 360x64 — the receipt's own `visual.observations.size` said
so. Re-exported at scale 1. The scorer never caught it because toast has no
reference and is therefore never scored.

Also measured and NOT shipped: pointing the scorer at astryx card's padded 320x96
gate-shot stage instead of the committed tight 118x60 crop of the SAME image
(identical 114x56 content box) collapsed `inkRealPct` 68.4 -> 9.3 and AA
33.27 -> 86.30. The lane scorer's ink metric is not stage-padding invariant for
pale fills; the retarget was reverted and only the provenance label corrected.

Pin: `parity/receipts/console-loop/astryx/framing.json` +
`scripts/console-loop-capture-framing-check.mjs`.

## 2026-08-08 — REFERENCE-TRUTH round: the reference was never the library

Every astryx score before this round compared the canvas against something that
was not `@astryxdesign/core`. Four different wrong things, and the fourth was
invisible because it looked right:

| stem | what it was scored against | what that is |
|---|---|---|
| banner | `extract/computed/out/banner/gate-shots/info.off.off__default.png` | a **POLARIS** Banner |
| text-input | `examples/astryx/receipts/site/TextInput.png` | a 1440×2200 **doc-site page** |
| badge, checkbox-input, progress-bar, token | `parity/receipts/console-loop/astryx/refs/*.png` | **emit-html first-item** renders in the pre-Theme Times substrate |
| card, slider, switch | `extract/computed/out/astryx/*/gate-shots/*.png` | **the CONTRACT RENDER** |

That last row is the one worth naming. `gate-shots/<key>.png` is written by
`extract/computed/gate.ts` and is the *enriched contract → emit-html* render —
the **RIGHT half** of `receipts/pair--*.png`, whose own margin label reads
`CONTRACT RENDER (EMIT-HTML)`. The real npm-package render was written to a
scratch directory `run.ts` deletes on the way out (`OUT_ROOT/.orig-shots`,
removed at run.ts:1505), so the **only** library pixels this pipeline had ever
committed were baked into a labeled side-by-side collage at five keys. Scoring a
canvas built from a contract against another emitter's render of that same
contract measures emitter agreement — a real thing, but not fidelity, and not a
number that can fall when the contract is wrong in the same way on both sides.

`extract/computed/run.ts` now takes **`--keep-originals`** (default OFF; no other
library's artifacts move), which commits the real-library screenshots to
`<out>/<comp>/orig-shots/<combo>__default.png`. All ten astryx stems were
recaptured with it, and every reference in this lane now points there.

### Honest before → after (pctAAMasked, bar 5; `comp` = compositionOk)

| stem | before | ref it had | after | comp | dominant residual |
|---|---|---|---|---|---|
| badge | 11.55 | emit-html/Times | **10.12** | ✓ (was ✗) | palette + `FC-REF-SWEEP-DECOY` |
| banner | 63.31 | **polaris** banner | **8.60** | ✓ | palette (`FC-REF-TONE-SWAP`) |
| button | 89.31 | contract render | **90.75** | ✗ | width 100 vs 67 + palette |
| card | 33.27 | contract render | **84.41** | ✗ | `FC-TEXT-WRAP` 115×80 vs 119×48 + palette |
| checkbox-input | 21.84 | emit-html/Times | **14.10** | ✓ | palette |
| progress-bar | 28.75 | emit-html/Times | **24.82** | ✗ | label-row height 18 vs 28 |
| slider | 13.81 | contract render | **8.17** | ✓ (was ✗) | palette |
| switch | 14.21 | contract render | **14.19** | ✓ | palette + `FC-MISSING-AXIS` |
| text-input | **1.72** | 1440×2200 page | **11.39** | ✓ | palette + placeholder/glyph |
| token | 37.50 | emit-html/Times | **6.19** | ✗ | height 16 vs 24 |

**text-input's 1.72 was an artifact, not a near-pass.** The 320×48 cell was
union-padded into a 1424×2192 frame; `inkCanvasPct` was **0.046** — almost every
compared pixel was page whitespace. It is not the cheapest win on the board.

### Two mount defects found and fixed (both changed compositionOk)

- **Badge captured an EMPTY badge, 56 captures deep.** `sampleText` mounts as
  CHILDREN; astryx `Badge` takes a required `label: ReactNode`
  (`dist/Badge/Badge.d.ts:61`, its own `@example` is `<Badge label="Active" />`)
  and renders nothing from children. The library Variant=Blue render was a
  **16×20 label-less pill**. React swallowed the ignored child, and both sides of
  the fidelity gate mounted the same way, so nothing downstream could tell.
  With `label` mounted: 41×20 vs 42×20, `compositionOk` false → **true**.
- **`FC-ABS-SIZE` on slider was the HARNESS, not the component.** It read "canvas
  track 240px vs developed ~49px". Slider is fill-width; the default flex stage
  shrink-to-fits it. With the stage inner width pinned to the **240px the
  contract's own anatomy declares**, content boxes are 120×20 vs 120×20
  (scaleRatio 1.00) and AA fell 15.61 → 8.17. `FC-WIDTH-TOKEN` on progress-bar
  was the same harness fact; its width now agrees exactly and only the label-row
  height remains. `FC-ABS-SIZE` is **withdrawn as measured** for slider.
- Button's sample text was `"Save changes"`, a string the contract never
  declares (its `label` default is `"Button"` — the string the canvas paints).
  Every button comparison carried that mismatch on top of the real defect.

### THE BLOCKER — `FC-THEME-BASE` (new; a human decision, not a fix)

The capture mount renders under `<Theme theme={neutralTheme}>`
(`@astryxdesign/theme-neutral` — the library's documented Quick Start and the
only mount where the base font resolves). `examples/astryx/tokens/astryx.dtcg.json`
is wrapped from `@astryxdesign/core/src/theme/tokens.stylex.ts` — the **CORE
DEFAULT** palette. They are different themes:

| token | core default (the DTCG base, what the canvas paints) | theme-neutral (what the library renders) |
|---|---|---|
| `--color-accent` | `#0064E0` | `#262626` |
| `--color-text-primary` | `#0A1317` | `#171717` |
| `--color-background-blue` | `#0171E333` | `#c4ddfb` |

So `astryx/button` is blue-on-canvas vs near-black-in-library, and that is the
dominant residual on 8 of the 10 stems. **Re-promoting does not fix it** — it is
worse:

- A value-identity join cannot bridge two palettes. Promoting from the neutral
  captures strands **30 of the 36 acked re-anchoring rows (65 leaves)**: they
  ship as measured literals and **stop following light/dark mode**.
- The astryx bundle falls from **54 Figma-native aliases to 13**, failing the
  existing pin `plugin-engine-check.mjs:1636`.
- Re-writing the acked literals in place is exactly the "silent no-op dressed as
  the fix" that `reanchor-minted.ts:assertNeutralAnchor` refuses. (That probe
  also calls `#0064E0` "the theme-neutral" value — the repo's word *neutral*
  means "the un-re-themed core plane", **not** the `@astryxdesign/theme-neutral`
  package. The overload is what let this hide.)

So the promote + re-emit + canvas-regeneration leg of this round was **run,
measured, and rolled back**; `figma:fresh` and `plugin:check` are green on the
unchanged artifacts. The canvas on `GnQnjSNBXtgtd2Ht0Hs1C8` was **not** touched.

**And astryx has not been rebuildable since `0efa2f05`** ("THE ASTRYX CAPTURE
NEVER WORE ITS OWN THEME"): that commit recaptured Button and Switch under the
neutral Theme without re-running the promotion, so at HEAD —
committed captures + committed ledger + committed DTCG — `promote-floor.ts`
refuses on **23 leaves** (`imported.button.label.color.destructive` measures
`#a50c25`, the ledger acked `#ffffff`, and so on). Nothing measured this: the
`astryx-reanchor-minted` eval exercises `--propose` against the **shipped** tree
and never a fresh promote.

**The decision needed:** re-base the astryx token layer onto
`@astryxdesign/theme-neutral` (then `--propose` re-joins and the acked *role*
choices survive a mechanical re-measure), **or** mount the capture under the core
default plane and accept losing the base font again. Both are product decisions.

## 2026-08-08 — REFERENCE-TRUTH round (board-wide): astryx re-verified, not re-measured

This lane was already re-pointed at `orig-shots/` by the round recorded above, so
the board-wide sweep re-verified it rather than re-scoring it. Every number in the
"Honest before → after" table above reproduces exactly at HEAD: 0 scorecard passes,
13 fail-closed receipts, floor 0 held on both instruments (bridge lane and headless
`visual-truth`, which scores 11 of 13 cards and passes none).

**Reference basis: LIBRARY RENDER** for the ten captured stems.
`dropdown-menu`, `dropdown-menu-item` and `toast` have no computed-capture entry in
`extract/computed/configs/astryx.json`, so no library render exists for them. `toast`
now carries a scorecard (6.47, fail) produced by
`console-loop-developed-score --manifest` against
`trap-corpus/refs/astryx/toast/default__default.png` — an **emit-html render of the
promoted contract**, i.e. a CONTRACT RENDER. It is named here so it is a known
class; the receipt claims nothing and the number has no floor effect.

## 2026-08-09 — CANVAS-DRIFT sweep: the worst-drifted lane on the board (10 of 13)

Snapshot: `canvas-drift/LIVE-SNAPSHOT.json` (Desktop Bridge, `fileKey` pinned,
two batches of 7 + 6 stems; generated by
`scripts/console-loop-canvas-drift-capture.mjs astryx`).
Probe: `npm run console-loop:canvas-drift astryx`.

**3 in-sync / 10 DRIFT. The board does not move: this lane has ZERO scored
passes, so no pass is resting on a drifted canvas.** That is the only reason a
result this bad costs the board nothing.

Two distinct causes, and they should not be read as one number:

**Cause A — cross-library collection collisions (5 stems, 48 bindings).** The
lane's scripts create exactly one collection, `Astryx`. These bindings landed
elsewhere:

| stem | bindings in a foreign collection | worst case |
|---|---|---|
| `button` (90.75) | 7 | 4 corner radii in `Imported (provisional)`; **root `fills` → `imported/button/root/background-color/primary` resolved in CARBON** |
| `toast` (6.47) | 11 | `dismiss.paddingLeft` → `imported/button/root/padding-left` in **Carbon (15px)** while `dismiss.paddingRight` took Astryx's (12px) — the same name, two libraries, one node |
| `slider` (8.17) | 12 | tooltip radii + every `size-0` in `Imported (provisional)` |
| `dropdown-menu` (84.41) | 10 | `trigger.paddingLeft` Carbon 15 / `trigger.paddingRight` Astryx 12 — the identical split |
| `switch` (14.19) | 8 | `part-0-0.switch.width` → `imported/shared/size-40` resolved in **Carbon** |

This is precisely the collision the emitted runtime now guards with
`FC-THEME-ISO` (prefer the single collection covering the most of THIS script's
referenced names). These canvases predate the guard, so the wrong collection is
frozen into the nodes. Carbon's round found the same thing on `checkbox`; astryx
has it five times over, and twice with a *measurably different value* (15 vs 12).

**Cause B — the declared font family never resolves (6 stems).** Every astryx
contract declares `fontFamily: "-apple-system"`, which is a CSS system keyword,
not a Figma face. `checkbox-input`, `dropdown-menu-item`, `token`, `slider` and
`toast` draw **Inter**; `progress-bar` and `text-input` draw **Figtree**. Neither
is what the spec asked for, so all six carry `FC-FONT-STYLE-UNRESOLVED`. This is
an emitter/contract-channel fault, not a stale canvas, and it is counted
separately above for that reason.

`badge`, `banner`, `card`, `progress-bar` and `text-input` are clean on cause A;
`badge`, `banner` and `card` are clean on both.

**Floor: astryx stays at 0.** Nothing converted, nothing regressed,
`RATCHET.json` untouched. Regeneration was not attempted on this lane — see the
altitude ledger for the transport measurement and the named blocker.
