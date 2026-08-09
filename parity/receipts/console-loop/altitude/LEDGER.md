# Console-loop ledger — altitude

File: https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing  
Transport: Figma Console MCP `figma_execute` + `clientStorage` chunk upload (bridge :9228)  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Tokens | **completed** |
| Completed receipts | **8** / 8 |
| Failed | 0 |

Per-component evidence: `components/<stem>.json` + `.md` (kind `console-loop-altitude-component`).

## Summary

| Stem | Status | nodeId | v6 |
|---|---|---|---|
| avatar | completed | 1:10498 | v6:923243794 |
| badge | completed | 1:2963 | v6:3342646333 |
| button | completed | 1:2990 | v6:3196882528 |
| chip | completed | 1:3017 | v6:2414831033 |
| divider | completed | 1:3020 | v6:3296776669 |
| heading | completed | 1:3047 | v6:3593476120 |
| icon-close | completed | 1:3071 | v6:163654327 |
| link | completed | 1:3092 | v6:2052539233 |

### Notes
- **avatar:** completed via manual rebuild after patched generator collapsed to ~0×0 (`size-0` min bindings + `strokeTopWeight` not-extensible). Final set `1:10498` is 24×24 `Variant=Sm` with Content + Show HasBadge.
- **divider:** completed with gap (standalone COMPONENT; Variant axis not on prop surface).

## 2026-08-08 — REFERENCE-TRUTH round: three of the six passes were artifacts

**Reference basis for this lane: LIBRARY RENDER.** Every stem now scores against
`extract/computed/out/altitude/<comp>/orig-shots/<combo>__default.png` — the
`altitude-web-components@1.0.2` screenshot committed by
`extract/computed/run.ts --keep-originals`.

What the basis was before, per stem, and what class it belonged to:

| stem | prior reference | class |
|---|---|---|
| avatar, badge | `gate-shots/<key>.png` | **CONTRACT RENDER** (enriched contract → emit-html) |
| chip, link | `refs/*.png`, byte-identical copies of `gate-shots/` | **CONTRACT RENDER** |
| button, heading, icon-close | `refs/*.png`, hand crops of `gate-shots/` | **CONTRACT RENDER** |
| divider | `refs/divider.png`, `synthetic-horizontal-rule-from-theme-border` | **SYNTHETIC** — a rule drawn from a token, not a render of anything |

### Honest before → after (pctAAMasked, bar 5)

| stem | before | after (library) | verdict |
|---|---|---|---|
| button | 4.23 | **4.70** | **survives** |
| chip | 0.67 | **0.67** | **survives** (contract render is byte-identical to the library render here) |
| divider | 0.00 | **0.00** | **survives**, and the basis is now a real library render instead of a synthetic rule |
| heading | 3.77 | **11.40** | **artifact** — `FC-REF-STALE-COPY` |
| icon-close | 4.69 | **17.28** | **artifact** — `FC-REF-CONTRACT-RENDER` |
| link | 2.01 | **15.63** | **artifact** — `FC-REF-CONTRACT-RENDER` |
| avatar | 0.13 (comp ✗) | 5.47 (comp ✗) | already fail-closed; still fails |
| badge | 15.44 | 15.44 | already fail-closed; fails identically on both bases |

**Scorecard passes: 6 → 3.** The `RATCHET.json` floor for this lane is **6** and
is now **unsound**: it was seeded (2026-08-07, raised 4→6 on 2026-08-08) entirely
against contract-render references. `console-loop:altitude:evidence:check`
therefore fails with `ratchet violated: altitude scorecard-passed count 3 <
committed floor 6`. The floor was deliberately **not** edited by this round —
lowering it silently is the one thing that file forbids. Recommended
re-derivation: **6 → 3** (button, chip, divider), with the reasoning recorded by
the owner.

### The three that fell, each with its own cause

- **link — 2.01 → 15.63.** The prior reference was a byte-identical copy of
  `link/gate-shots/lg__default.png`. The `FC-FONT-SUBSTRATE` closure that
  produced the 2.01 loaded IBM Plex Sans into the **contract render** — it fixed
  the emitter's font, not the gap to the library. Canvas content box 32×14 vs
  library 34×16.
- **icon-close — 4.69 → 17.28.** Same class. Canvas 16×16 vs library 18×18: the
  canvas is drawing the icon at the contract's box, and the contract's box is not
  the library's.
- **heading — 3.77 → 11.40, and this one is a SECOND class.** Its reference was
  `refs/heading.png`, a crop whose content box is **94×24** while the artifact its
  own `referenceSource` names (`heading/gate-shots/display-lg.bold__default.png`)
  has a **91×24** box. The copy had drifted from its declared source. Measured
  against the current contract render **and** against the library render — which
  are byte-identical to each other for this key — heading is **11.40 on both**.
  So heading was never passing under either basis; `FC-REF-STALE-COPY`.

### Gaps this lane still carries

- **There is no `parity/receipts/console-loop/altitude/framing.json`**, so the
  capture-framing pin (C1–C6) never ran on this lane. The three stale/contract
  references above are precisely what C3b/C5/C6 exist to catch. Naming it here so
  it is a known hole, not a silent one.
- Re-running the capture at HEAD reproduced every committed `gate-shots/` PNG
  byte-for-byte except **avatar**, where 4 of 16 differ.

## 2026-08-09 — FONT/VIEWBOX/UNDERLINE round: 3 → 4 scored passes

Basis unchanged: every stem still scores against
`extract/computed/out/altitude/<comp>/orig-shots/<combo>__default.png`, the real
`altitude-web-components@1.0.2` render. No reference was re-pinned, re-cropped or
replaced this round — every number below moved because the CANVAS moved.

### Triage before any blame (the two lessons applied)

1. **Reference plane.** `scripts/console-loop-ref-plane-probe.mts --lane altitude`
   → **no cross-plane pin anywhere in this lane**. `extract/computed/configs/altitude.json`
   declares no `stateProps` (Altitude never reaches `:disabled` from a prop — the
   config's own note), so the mui failure class cannot occur here. Every pinned key
   names the same point in prop space as its canvas cell: avatar Sm↔`sm.off`,
   badge Info,Default↔`info.default`, button Secondary↔`secondary`,
   chip Info,Default↔`info.unset`, divider Default↔`unset`,
   heading Display Lg,Bold↔`display-lg.bold`, icon-close Lg↔`lg`, link Lg↔`lg`.
   **The brief's first hypothesis died here; the thread was stopped.**
2. **Stale / wrong-variant reference.** `console-loop-reference-audit.mjs altitude`
   → the pinned orig-shot is the argmin of its own sibling sweep for badge, button,
   chip, divider, heading and link. Nothing to retarget. (avatar's and icon-close's
   sweeps are won by siblings, but by the geometry defects named below, not by a
   wrong pin — re-pinning on argmin is cherry-picking and was refused.)

### Honest before → after (pctAAMasked, bar 5)

| stem | before | after | verdict |
|---|---|---|---|
| **heading** | 11.40 | **4.95** | **CONVERTED** (REST instrument agrees: 2.39) |
| button | 4.70 | **2.98** | pass, improved by the same fix |
| chip | 0.67 | **0.67** | pass, untouched |
| divider | 0.00 | **0.00** | pass, untouched |
| badge | 15.44 | 16.82 | fail-closed — `FC-CANVAS-TEXT-METRICS` |
| link | 15.63 | 16.83 | fail-closed — `FC-CANVAS-DECORATION-AUTO` |
| icon-close | 17.28 | 19.75 | fail-closed — `FC-AA-THIN-VECTOR` |
| avatar | 5.47 | 5.47 | fail-closed — `FC-AVATAR-MANUAL-REBUILD-UNREPRODUCIBLE` |

**Three numbers went UP and all three canvases got MORE correct.** That is the
whole shape of this round and it is stated here so nobody re-derives it: the
scorer normalises size before comparing, so a canvas that is the WRONG SIZE gets
resampled (and smoothed) while a canvas that is the RIGHT size is compared
pixel-for-pixel. icon-close's 17.28 was a 16×16 glyph being upsampled onto an
18×18 reference; its 19.75 is an 18×18 glyph against an 18×18 reference with the
same shape and the same ink percentage to six decimals. Keeping the lower number
would have meant keeping a canvas that draws the `unset` close icon at 6px where
the library draws 12px.

### The three canvas fixes

- **FC-FONT-STYLE-PER-FAMILY** (`core/emit-figma-script.ts`, converts heading).
  Every SemiBold text node in this lane was rendering in **Inter**. The emitter
  compiles style names from `FONT_STYLE_BY_WEIGHT`, spelled Inter's way
  (`"Semi Bold"`); IBM Plex Sans ships that face as `"SemiBold"`.
  `figma.listAvailableFontsAsync()` on `GnQnjSNBXtgtd2Ht0Hs1C8` returns
  `SemiBold` and no `Semi Bold`, so `loadFontAsync` threw and the runtime kept
  its Inter fallback **silently**. Live proof: heading's label was
  `Inter/Semi Bold` at 194px advance; IBM Plex Sans SemiBold measures 185px and
  the library render inks 182px. The runtime now retries the space-free
  per-family spelling and names `FC-FONT-STYLE-UNRESOLVED` on the console when
  nothing resolves, instead of substituting in silence.
  `RUNTIME_EMIT_REV` rt6-native-slots → **rt7-font-style-per-family**;
  `figma-sync/plugin/engine.receipt.json` re-recorded in the same change.
  *The 2026-08-08 note in the emitter that forbade exactly this fix is DEAD and
  was replaced: it reasoned against contract-render references made by a harness
  with no `@font-face`, and the references are now real library renders. It even
  said "revisit only together with a font-loading harness + reference re-pin" —
  both of which have since happened.*
- **Authored viewBox** (`examples/altitude/assets/icons/`,
  `extract/computed/out/altitude/iconclose/assets/`). Every icon-close asset
  carried a per-size viewBox (unset/xs/sm `0 0 40 40`; md 20; lg 24; xl 32;
  xxl 36; xxxl 40) where the package's own `dist/icons/close.svg` is
  `0 0 20 20` at every size. Only md was right. Canvas Vector at Size=Lg is now
  18.0×18.0 against the library's 18×18 ink.
- **Link underline** (`examples/altitude/contracts/link.contract.json`).
  `text-decoration-line: underline` is captured truth on the library root but
  the enricher dropped it as equal-to-its-UA-control, and `core/emit-html`
  renders the root `<a>` with **no href** — so it is never `:any-link` and never
  gets the UA rule. Carried now as a declared literal; the canvas cell's ink
  width went 32 → **34**, exactly the library's.

### Named refusals (probe evidence in-tree, fix NOT taken)

- **`FC-SVG-VIEWBOX-UNIFIED-MAX`** — `extract/computed/anatomy.ts` round-5c
  unification takes `cand = Math.max(...anchors.map(g => g.r.vb))` and lets only
  BUMPED members adopt it, while writing a receipt that calls the result "the
  package's own viewBox". For one glyph drawn at many sizes the authored space is
  the **minimum** unbumped computed size, and every member must adopt it.
  `npx tsx scripts/altitude-svg-viewbox-probe.mts` predicts the library ink
  exactly at 5/8 sizes from `0 0 20 20` and within 1px at the other 3, against
  **0/8** from the committed per-size viewBoxes. Not taken here: `anatomy.ts` is
  a shared capture heuristic and landing it means re-running `extract/computed`
  for every lane. Blast radius measured — altitude is the only lane that emits
  `svg-viewbox-unified` receipts (6, all IconClose); mui/carbon/astryx emit
  `svg-viewbox-bumped` with no multi-member group; polaris/tailwind emit neither.
- **`FC-AVATAR-MANUAL-REBUILD-UNREPRODUCIBLE`** — running the committed
  `examples/altitude/figma/avatar.figma.js` returns
  `{ skipped: true, reason: "set/standalone shape mismatch (COMPONENT_SET vs isSet=false) — a human retires the old node" }`.
  Node `1:10498` carries `ds_contracts/specHash "console-loop-manual-rebuild-v1"`
  and no `canvasFingerprint`. Regeneration is the production path and it is
  blocked; hand-patching is not a substitute. Two further named causes ride with
  it (`FC-AVATAR-SIZE`: 24×24 where the contract's own
  `line-height.sm` = `var(--theme-icon-xl)` = 32px and the library renders 32×32;
  `FC-AVATAR-AXIS-LOSS`: the capture kept only `variant=sm`, and that
  single-value enum is what makes the emitted component standalone).

### The capture-framing hole is CLOSED

`parity/receipts/console-loop/altitude/framing.json` now exists, minted from the
live bridge (`figma_execute`, fileKey pinned on every call). Before it, the lane
was skipped **entirely** by `console-loop-capture-framing-check.mjs`, which only
walks lanes that have the file. All 8 stems are C1-pinned (no cell-PENDING) and
the lane reports **0 named-open findings** under C1–C6 with
`requireResolvableProvenance`, `stageClipCheck`, `referenceSweepCheck` and
`referenceToneCheck` all on. `guard.marginSkewMaxPx` is 3 rather than 2 for one
measured reason, recorded in the file: heading is the only stem whose
`absoluteRenderBounds` (328×54.18) exceeds its box (328×52).

### Floor

Recommended `RATCHET.json` altitude floor: **3 → 4** (button, chip, divider,
heading). Not edited here.

### Instrument gap found (pre-existing, NOT caused by this round)

`node scripts/figma-scripts-fresh.mjs` reports altitude's 8 sync scripts STALE
even immediately after re-emission. The reason is structural: the committed
scripts are emitted with a `variableCollection` ("Altitude" — the
`_prefCol` block that pins variable lookup to this lane's collection), and the
freshness gate rebuilds them with `ds-contracts figma <contracts> --out …`,
whose `figma` verb **has no `--name`/collection flag** (only `figma bundle`
does). The gate's "fresh emission" is therefore not the emission that produced
the artifacts, and neither is the command
`examples/altitude/receipts/figma/COMPILE-RECEIPT.md` documents. Measured with
the pre-round emitter restored: astryx 9/13, carbon 9/10, fluent 5/11, mui 18/31,
polaris and shadcn 2/11 were already STALE by the same gate before this round
touched anything. Named here, not fixed — the gate and the CLI are shared
surfaces and the eval that consumes them
(`child-wider-ratchet-and-script-freshness`) is already a recorded failure for a
different reason (fluent has no child-wider baseline row).
