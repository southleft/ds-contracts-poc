# Console-loop ledger — carbon

File: https://www.figma.com/design/GnQnjSNBXtgtd2Ht0Hs1C8/DS-Contracts-Testing  
Transport: Figma Console MCP `figma_execute` + `clientStorage` chunk upload (bridge :9228)  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Tokens | **completed** |
| Completed receipts | **10** / 10 |
| Failed | 0 |

Per-component evidence: `components/<stem>.json` + `.md` (kind `console-loop-carbon-component`).

## Summary

| Stem | Status | nodeId | v6 |
|---|---|---|---|
| accordion | completed | 1:5365 | v6:1242425722 |
| button | completed | 1:5528 | v6:310064922 |
| checkbox | completed | 1:5562 | v6:789543823 |
| icon-button | completed | 1:5645 | v6:1501913482 |
| inline-notification | completed | 1:5824 | v6:1173442392 |
| modal | completed | 1:5911 | v6:2103121654 |
| tabs | completed | 1:5947 | v6:3251309082 |
| tag | completed | 1:6024 | v6:640356538 |
| text-input | completed | 1:6091 | v6:2635523164 |
| toggle | completed | 1:6126 | v6:756328093 |

## 2026-08-09 — CANVAS-DRIFT round: the triage cleared every stem, and the largest gap was a canvas that predates its own script

**Board unchanged: 3 scored-pass, 7 honest fail-closed. Nothing was converted
and nothing regressed.** What moved is the *attribution*: four named causes on
this board were re-measured, three of them died, and the biggest remaining
number got a new owner.

### Triage first — all three briefed hypotheses died

| # | hypothesis | verdict | evidence |
|---|---|---|---|
| 1 | cross-plane pin (mui's `"disabled" < "enabled"`) is live here | **DEAD** | `console-loop-ref-plane-probe.mts --lane carbon`: `crossPlane=false` on all ten. Every pinned key names the BASE (`enabled`) plane, and where the contract declares defaults the score-free defaults key **equals** the pinned key (`checkbox` → `unchecked.enabled__default`, `toggle` → `untoggled.enabled__default`, `tabs` → `__default`). |
| 2 | a reference wants re-pinning | **REFUSED, with the argmins named** | Lower-scoring siblings do exist — `accordion` `end.sm.disabled` 4.41 vs pinned 9.23, `button` `primary.md.enabled` 5.96 vs 39.38, `text-input` `lg.disabled` 2.12 vs 5.26 — but each differs from the pinned cell by a **size** or **state** token the cell is not. Re-pinning on those is cherry-picking; refused, exactly as the altitude round refused it. |
| 3 | the lane has no `framing.json` / content checks off | **DEAD** | `framing.json` exists with `referenceSweepCheck: true` (C5) and `referenceToneCheck: true` (C6). `npm run console-loop:capture-framing` prints **zero** open findings for carbon across all 79 pinned stems. |

### Two recorded carbon leads, re-checked rather than trusted

**`carbon/checkbox` — "the reference contains no checkbox" is DEAD on the new
basis.** It was true of the CONTRACT render and only of it:
`gate-shots/unchecked.enabled__default.png` has ink **66×12 starting at x=46** —
pure label. The LIBRARY render this stem has been pinned to since the
REFERENCE-TRUTH round draws the control: `orig-shots/unchecked.enabled__default.png`
has ink **90×16** with column profile `INK[19-34]=16` (the box) · gap 11 · label
from x=46. The consequential `FC-REF-FRAMING` (scaleRatio 1.47) dies with it —
97×16 against 90×16 is **1.08**, inside the guard. Both are retired on the receipt.

**`carbon/button` — "a 119px harness stage against a 79px hug" is DEAD too, in
both halves.** 119×24 is the *gate-shot*; the pinned library render is **124×24**,
and 124 is Carbon's own geometry: measured inside the fill, the box spans x16–139
and the label glyph x33–74, i.e. left pad 17 and right pad 65 — `.cds--btn`'s
15px/63px plus the `B` side bearings. There is no min-width doing that work and
the contract never hugged symmetrically.

### The finding: two stems' canvases are not the product of their own emit script

New instrument, committed this round: **`scripts/console-loop-canvas-drift-probe.mjs`**
(`npm run console-loop:canvas-drift carbon`). It asks the question that sits
underneath C1 and the reference audit — *is the live cell what
`examples/carbon/figma/<stem>.figma.js` would build today?* EXPECTED is parsed
offline from the committed script's `const COMPONENTS = […]` payload; OBSERVED
comes from `canvas-drift/LIVE-SNAPSHOT.json`, minted off the Desktop Bridge with
the fileKey pinned. Live facts are never back-derived from the committed PNGs.

**8 of 10 in sync. Two drifted — and they are the two largest non-framing gaps
on the board.**

| stem | drift | measured consequence |
|---|---|---|
| `button` (39.82) | the spec binds **four** paddings on cell 1:5368 — `paddingLeft`→15, `paddingRight`→63, `paddingTop`→1.5, `paddingBottom`→2 — and the live node binds **none** of them, sitting at a literal, unbound 16/16/2/2. The same bindings map's stroke weights, `maxWidth` and `minHeight` **did** land, so this is not an abort. | 15 + 45 + 63 = **123px** against the library's **124px**. The canvas hugs at 79. |
| `checkbox` (19.33) | five bindings resolved in the **"Imported (provisional)"** collection instead of Carbon: root `width` (136.359 vs Carbon's 288), root `height`, and `checkbox-label`'s `paddingLeft` / `paddingTop` / `height`. | `imported/*` names are not namespaced per library; this canvas predates the emitter's own `FC-THEME-ISO` collision guard, so the wrong collection is frozen into the nodes. |

Two controls make this a canvas fact and not an emitter fact:

1. **A fresh re-emit at HEAD is byte-identical to the committed script** except
   `RUNTIME_EMIT_REV` (`rt6-native-slots` → `rt7-font-style-per-family`) and the
   1,518-byte rt7 text-extras block. The COMPONENTS payload does not move. The
   committed scripts are current with the contracts.
2. **A self-cleaning live probe** (`createFrame` → `layoutMode HORIZONTAL` →
   `setBoundVariable` on `paddingLeft`/`paddingRight`/`maxWidth` → read back →
   `remove()`) landed all three bindings with zero exceptions on this very file.
   The runtime is not refusing padding bindings; the node never had them.

**Regeneration was NOT performed, and the reason is transport.** The only
headless write path is `figma_execute`, which would carry the whole 230KB script
through ~29 `clientStorage` chunks; plugin-context `fetch` to a local server was
probed and is **blocked** (`Failed to fetch` against 127.0.0.1:9228, which is up
and answering `curl`), and `ds-contracts figma push` needs a 6-character pairing
code a designer types into the plugin. Regenerating also invalidates this lane's
committed shots, framing pins and scorecards, and the export-back path that would
re-mint `shots/<stem>-cell.png` at 1× is not reachable from here either. Named
refusal with the fix localised, rather than half-applied.

### The lane-wide term the pixel score cannot see past

**Every text node on the carbon canvas draws Inter.** Measured live: `button`
label Inter/Regular/14, `checkbox` label-text Inter/Regular/14 (68px advance vs
the library's 63px in IBM Plex Sans), `inline-notification` title Inter/**Semi
Bold**/14, `toggle` "Toggle" and "Off", `tag`, `text-input`, `modal`.

**No carbon contract carries a `font-family` channel at all — 0 of 10**, against
mui 22/31, fluent 6/11, altitude 5/8 (astryx is also 0/10). So `spec.fontFamily`
is never emitted and the rt7 per-family style loader never fires for this lane,
while the pinned references are the real `@carbon/react` renders in IBM Plex Sans.

Located: `font-family` **is** captured (`extract/computed/out/carbon/toggle/captured-truth.json`
records `"IBM Plex Sans", system-ui, …` on the root and every descendant) and it
**is** fusable (`extract/computed/lib.ts` carries it in the alias map). It is
dropped at fusion, by the *inheritance-aware refusal*: `@carbon/styles` sets the
typeface globally on `html`/`body`, so every captured part equals its ancestor on
every captured plane and the channel is recorded as pure CSS inheritance. MUI,
Fluent and Altitude set the family on the component itself, which is exactly why
they carry it and carbon does not. **Not fixed here** — `extract/computed/fuse.ts`
is outside this lane's territory, and relaxing its refusals is the move that
minted the capture window itself as design tokens in four of six libraries.

`accordion` and `tabs` carry **no** font measurement of their own: the snapshot
walks three levels and their label text nests deeper. Named as not-asserted on
both receipts rather than assumed.

### Floor

**Hold at 2.** No stem converted this round. The prior round's 2 → 3
recommendation still stands on its own evidence and is still the owner's edit;
the `text-input` instrument split it flagged is unchanged (bridge 2.16, headless
5.26, ref-audit 3.06 — three numbers, one nominal pair). `RATCHET.json` untouched.

## 2026-08-08 — REFERENCE-TRUTH round: the board can rise as well as fall

**Reference basis for this lane: LIBRARY RENDER** for nine of ten stems —
`extract/computed/out/carbon/<comp>/orig-shots/<combo>__default.png`, the
`@carbon/react@1.112.0` screenshot committed by
`extract/computed/run.ts --keep-originals`. Eight stems previously pointed at
`gate-shots/` (the **CONTRACT RENDER**: enriched contract → emit-html); two
(`icon-button`, `modal`) were already library pixels, hand-cropped from the
`receipts/pair--*.png` collage's package half.

**`modal` is the one stem that keeps a cropped basis, and it is named here.**
Modal is a `portalCapture` component: its un-collaged `orig-shots/unset__default.png`
is a **900×1000 full-viewport screenshot** (the backdrop covers the whole stage),
which is not like-for-like with a 540×215 canvas cell — retargeted to it the stem
reads 83.92 with `compositionOk=false`, a framing number, not a fidelity one. Its
reference stays `refs/modal.png`, the `#package-dialog-bbox` crop. That crop is
**library pixels**, so this is not the contract-render class; it is a crop whose
provenance is a collage. `FC-REF-COLLAGE-CROP` is recorded on the receipt.

### Honest before → after (pctAAMasked, bar 5)

| stem | before | prior basis | after | verdict |
|---|---|---|---|---|
| icon-button | 0.95 | library pixels (`#package-left` crop) | **0.95** | **survives** |
| text-input | 1.49 | contract render | **2.16** | **survives** |
| tag | 76.04 | contract render | **2.85** | **NEW PASS** |
| toggle | 6.92 | contract render | 6.38 | fail on both |
| tabs | 17.61 | contract render | 11.07 | fail on both |
| accordion | 11.73 | contract render | 11.63 | fail on both |
| checkbox | 30.93 | contract render | 19.33 | fail on both |
| inline-notification | 25.31 | contract render | 25.10 | fail on both |
| button | 39.22 | contract render | 39.82 | fail on both |
| modal | 12.66 | library crop | 12.66 | fail (basis unchanged) |

**Scorecard passes: 2 → 3.** The floor is 2 and still holds. Recommended
re-derivation: **2 → 3** (icon-button, tag, text-input) — owner's edit, not this
round's.

### `tag` is the clearest demonstration of what the old basis was measuring

The committed reference `tag/gate-shots/blue.lg__default.png` has a **208×32**
ink content box. The library renders the same combo at **44×32** and the canvas
cell is **46×32**. The canvas was right the whole time and the *reference* was
carrying a width defect — 76.04 was the distance to a broken emit, not to Carbon.
Re-running the capture at HEAD confirms the committed gate-shot is also **stale**:
a fresh contract render of the same key measures 45×32.

### Rebuildability, measured while capturing (no committed gate-shot was overwritten)

`accordion`, `button`, `iconbutton`, `tabs`, `textinput`, `toggle` reproduce their
committed `gate-shots/` byte-for-byte at HEAD. **`checkbox` (24/24),
`inlinenotification` (48/48), `modal` (5/5) and `tag` (192/208) do not** — those
components' committed contract renders no longer correspond to the tree that
produced them.

### Side effect worth naming: the retarget also fixed which CELL the headless lane compares

`visual-truth-run.mjs` picks the canvas cell by `variant-token-match` — it matches the
cell name against the **reference's own combo key**. Re-pointing the references at
`orig-shots/<combo>__default.png` therefore changed the cell three stems were being
compared against, at the **same `fileVersion` (2385245229284424737)** — the canvas did
not move, the instrument was aiming at the wrong picture:

| stem | headless cell BEFORE | headless cell AFTER |
|---|---|---|
| button | `1:5450` "Kind=Danger Ghost, Size=2XL" (35.66) | `1:5368` "Kind=Primary, Size=Xs" (39.38) |
| tag | `1:5956` "Type=Red, Size=Lg" (92.44) | `1:5974` "Type=Blue, Size=Lg" (**2.85**) |
| toggle | `1:6102` "Toggled=Toggled" (8.56) | `1:6094` "Toggled=Untoggled" (6.51) |

`carbon/text-input` is the one stem where the two instruments now **disagree**: the
bridge lane scores 2.16 (pass) and the headless lane 5.26 (fail). Under the
established both-instruments rule it is not a floor-worthy pass, which is why the
recommendation above says "2 → 3 **or hold at 2**". Its receipt stays `scored-pass`
because that is what its lane scorecard says, and the disagreement is recorded here.

## 2026-08-09 — the transport refusal, RE-MEASURED: two of its three named reasons are dead

The 2026-08-09 canvas-drift round above refused regeneration for three named
transport reasons. The board-wide sweep re-measured all three from the plugin
context. **The refusal still stands, but two of its legs do not, and the real
blocker is somewhere else entirely.**

| claim | verdict | evidence |
|---|---|---|
| "plugin-context `fetch` to a local server is **blocked**" | **DEAD as stated, HOLDS as refined** | `fetch('http://localhost:9228/')` returns **200**; `fetch('http://127.0.0.1:9228/')` returns `Failed to fetch`. The earlier probe used the numeric literal only. (This lane's own `CODE-TO-CANVAS-HILLCLIMB.md` §105 already recorded "no `127.0.0.1` — plugin resolves `localhost` → IPv6".) The door is real but narrow: a server stood up on `localhost:9377` was `Failed to fetch` from the plugin, so the allowlist admits the **bridge's own origin only**, and that origin is the MCP server, which 404s arbitrary paths. A local script server is still unreachable — for a different reason than was written down. |
| "a 230KB script is past what the execute path carries" | **DEAD** | `figma_execute` carried **20,000 chars in a single call** (2.5× the chunker's default 8,000), and `clientStorage` accepted a **400,000-char** value in one `setAsync`. 81,000 chars of the altitude Avatar script went up in **5 calls** and verified **djb2 byte-identical** to the file on disk. 230KB is ~12 calls, not "past what the path carries" — and this is the same chunk path that originally built all 49 receipts. |
| "the export-back path that would re-mint `shots/<stem>-cell.png` at 1× is not reachable from here" | **DEAD** | `node.exportAsync({ format:'PNG', constraint:{ type:'SCALE', value:1 } })` on carbon's live `1:2107` returned a **978-byte** PNG, and `figma.base64Encode` is present (1,304-char base64, header `iVBORw0KGgo…`). The round trip is reachable. |
| "`ds-contracts figma push` needs a 6-character pairing code a designer types" | **UNCHALLENGED** | not re-probed this round; it remains the reason the CLI door is human-gated. |

**The blocker that actually stops regeneration is none of these, and it was
found by trying.** Carried end-to-end on altitude's `avatar`, the committed
script refused itself:

> `skipped: true, reason: "set/standalone shape mismatch (COMPONENT_SET vs isSet=false) — a human retires the old node"`

The live node is a COMPONENT_SET; the script compiles a standalone COMPONENT.
`resolveComponentIdentity` refuses rather than delete-and-recreate, because that
would re-mint the node id and key every instance binds to. And the live set's
stored `ds_contracts/specHash` is the literal `console-loop-manual-rebuild-v1` —
**that canvas was hand-built, so no script's guards ever ran over it.**

Two operational notes for the next round: `new AsyncFunction(src)` throws
`TypeError: Not available` inside the plugin realm — the working door is
`eval('(async function(){' + src + '})()')`, which is what the original loop
used. And a full eval of a large set can hit the 30s Desktop Bridge cap
(astryx/slider already recorded that), so big sets need per-variant amends.

**Carbon's own two drifted stems (`button`, `checkbox`) were NOT regenerated**
and their receipts are unchanged — their scripts are 228KB and 84KB, and the
board does not move either way since neither is a scored pass. Carbon's drift
result is unchanged by the probe's two premise fixes this round (8 in sync, 2
drifted), which is the control that those fixes are corrections and not
relaxations.
