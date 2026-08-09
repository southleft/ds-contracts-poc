# Console-loop ledger — MUI Test 1

File: https://www.figma.com/design/59mLQlOMiD5w5za6SUcoO5/MUI-Test-1  
Denominator: `examples/mui/oracle/DENOMINATOR-50.json` (31 members)  
Transport: Figma Console MCP `figma_execute` + clientStorage chunk upload  
Recorded: 2026-08-06

| Result | Count |
|---|---|
| Completed | **31/31** |
| Failed | 0 |
| Existing (receipted in place) | 14 |
| Generated this session | 17 |

Gate: `npm run console-loop:mui:evidence:check`  
Eval: `console-loop-mui-evidence-receipt`

## 2026-08-08 — strict-lane conversion (J8: measured visual evidence)

31/31 stems pixel-scored headlessly (REST images API, scale-1 VARIANT cell vs
committed developed refs under `refs/`; MUI Test 1 was not open on the
Desktop Bridge, so this is the REST-only instrument). `fab`, `icon-button`,
`radio`, `select` had no gate-shots — regated offline
(`npm run extract:computed:regate -- --config extract/computed/configs/mui.json --out extract/computed/out/mui --component <Name>`)
to produce them; `table-pagination`'s reference lives in
`extract/computed/out/mui/pagination/` (stem-name mismatch previously hid it).

| Result | Count |
|---|---|
| scored-pass (both instruments) | **4** — checkbox 0.00, divider 0.00, table 2.08, snackbar 2.09 |
| fail-closed (named defects) | 27 |
| RATCHET floor seeded | 4 |

`alert` passes the lane scorer (4.50 after dpr+size normalization) but fails
the headless card (6.49) — instruments disagree, so it stays fail-closed with
the disagreement named. Gate flipped attested-only → STRICT
(`scripts/console-loop-mui-evidence-check.mjs`); attested claims are now
impossible in this lane.

## 2026-08-08 — REFERENCE-TRUTH round: this lane lost four of its six passes

**Every one of this lane's 31 references was a CONTRACT RENDER.** Each
`parity/receipts/console-loop/mui/refs/<stem>.png` is a **byte-identical copy** of
the `extract/computed/out/mui/<comp>/gate-shots/<key>.png` its own
`referenceSource` names — i.e. the enriched contract passed through emit-html, the
right half of `receipts/pair--*.png`. Not one MUI pixel from
`@mui/material@9.2.0` had ever been committed to this lane.

Thirty of thirty-one stems are now scored against
`extract/computed/out/mui/<comp>/orig-shots/<key>.png` — the real package
screenshot, written by `extract/computed/run.ts --keep-originals`.

### Honest before → after (pctAAMasked, bar 5; `comp` = compositionOk)

| stem | before | after | comp | verdict |
|---|---|---|---|---|
| divider | 0.00 | **0.00** | ✓ | **survives** |
| table | 1.25 | **1.49** | ✓ | **survives** |
| checkbox | **0.00** | **81.48** | ✓ | **artifact** — see below |
| chip | 1.18 | 0.74 | **✗** | **artifact** — geometry, see below |
| snackbar | 2.32 | 17.45 | ✓ | **artifact** |
| alert | 4.72 | 7.03 | ✓ | **artifact** |
| accordion | 6.80 | 94.63 | ✗ | fail → fail |
| autocomplete | 8.14 | 8.93 | ✓ | fail → fail |
| avatar | 5.71 | 59.13 | ✗ | fail → fail |
| badge | 54.75 | 64.00 | ✗ | fail → fail |
| breadcrumbs | 22.17 | 14.82 | ✓ | fail → fail |
| button | 6.36 | 16.92 | ✓ | fail → fail |
| card | 31.48 | 31.48 | ✓ | fail → fail |
| circular-progress | 21.24 | 20.23 | ✓ | fail → fail |
| dialog | 51.68 | 94.61 | ✗ | fail → fail (portal, see limits) |
| drawer | 55.03 | 31.45 | ✓ | fail → fail |
| fab | 1.96 | 39.19 | ✗ | fail → fail |
| icon-button | 25.78 | 25.78 | ✗ | fail → fail |
| input-adornment | 20.83 | 20.83 | ✓ | fail → fail |
| linear-progress | 56.18 | 56.18 | ✗ | fail → fail |
| link | 14.15 | 29.89 | ✗ | fail → fail |
| menu | 10.46 | 80.58 | ✗ | fail → fail |
| paper | 25.94 | 25.94 | ✓ | fail → fail |
| radio | 38.50 | 38.50 | ✓ | fail → fail |
| select | 11.05 | 11.74 | ✓ | fail → fail |
| slider | 48.16 | 7.96 | ✓ | fail → fail |
| switch | 49.88 | 23.44 | ✗ | fail → fail |
| table-pagination | 17.83 | 11.62 | ✓ | fail → fail |
| tabs | 11.74 | 11.74 | ✓ | fail → fail |
| text-field | 7.29 | 7.61 | ✓ | fail → fail |
| tooltip | 23.47 | **not re-measured** | — | **named refusal** |

**Scorecard passes: 6 → 2** (divider, table). The `RATCHET.json` floor is **5** and
is now unsound — every seeded stem except divider and table was seeded against a
contract render. `console-loop:mui:evidence:check` fails with
`ratchet violated: mui scorecard-passed count 2 < committed floor 5`. The floor was
**not** edited by this round. Recommended re-derivation: **5 → 2**.

### `checkbox` — a 0.00 that was two renders being wrong together

The pinned combo is `checked.disabled`. Canvas and library agree **exactly** on
geometry: 18×18 both, `inkCanvasPct` 92.6 == `inkRealPct` 92.6. And
`pctAAMasked` is **81.48**. Centre-pixel readings say why:

| render | box | centre RGB |
|---|---|---|
| canvas cell | 18×18 | `25,118,210` |
| contract render (`gate-shots/checked.disabled__default.png`) | 18×18 | `25,118,210` |
| **library** (`orig-shots/checked.disabled__default.png`) | 18×18 | **`189,189,189`** |
| library `checked.**enabled**` | 18×18 | `25,118,210` |

The canvas paints MUI's *enabled* primary blue into the *disabled* variant. The
contract render made the identical mistake, so against it the stem scored a
perfect **0.00**. This is the exact failure mode the
old basis is structurally blind to: it cannot fall when the contract is wrong the
same way on both sides. Named `FC-DISABLED-NOT-PAINTED`.

### `chip` — a low AA that is whitespace, caught by composition

0.74 against the library, and `compositionOk` **false**: canvas 51×20 vs library
50×32. MUI's medium Chip is 32 px tall; the canvas — and the contract render that
agreed with it — is 20. Same class as astryx/text-input's 1.72. `FC-ABS-SIZE`.

### Limits, named rather than papered over

- **`tooltip`: the library render is UNOBTAINABLE.** `run.ts --keep-originals`
  refuses Tooltip on the double-run determinism self-check, **twice in a row with
  identical witnesses**: `MuiPopper-root` `transform`
  `matrix(1, 0, 0, 1, 19, 53)` vs `matrix(1, 0, 0, 1, 16, 53)` (`translate-x`
  19 px vs 16 px). Popper positions itself from a measurement that is not stable
  across two sweeps, so no deterministic package screenshot exists to commit. Its
  reference stays the contract render and the receipt now says so by name
  (`FC-CAPTURE-NONDETERMINISTIC`). It is fail-closed either way.
- **`dialog`, `menu`, `drawer` are `portalCapture` components**, so their
  un-collaged `orig-shots` are 900×1000 full-viewport screenshots (the overlay
  covers the stage). `menu` and `drawer` still yield a usable ink content box;
  `dialog` does not (`inkRealPct` 98.1 against a 424×123 canvas cell → 94.61,
  `compositionOk` false). All three were already fail-closed and remain so; the
  number for dialog is now a framing number, and is labelled as such on the receipt.

### Rebuildability, measured while capturing (no committed gate-shot was overwritten)

25 of the 30 captured components reproduce their committed `gate-shots/` byte-for-byte
at HEAD. `autocomplete` (8/8), `select` (8/8), `table` (8/8), `tabs` (24/24) and
`textfield` (4/4) do not.

## 2026-08-09 — CROSS-PLANE ROUND: the worst number on the board was the instrument

**2 → 4 scored-pass.** `checkbox` **81.48 → 0.00**, `accordion` **94.63 → 2.88**, both on BOTH
instruments (lane scorer `scores/` and headless REST `visual-truth/mui/`, fileVersion
2384477865735882405). `switch` **23.44 → 10.89**, still an honest fail.

### The checkbox root cause, and which side it lives on

**The 81.48 was NOT a canvas defect and NOT an emitter defect. It was a cross-plane reference pin.**

`extract/computed/configs/mui.json` declares `disabled` as a **state plane** (`stateProps`) for seven MUI
components. The capture key spells that plane as the LAST segment of the variant part —
`checked.enabled__default` / `checked.disabled__default`. `visual-truth-run.mjs`'s `pickGateShot` pins the
**alphabetically first** `*__default.png` in the capture directory, and *"disabled" sorts before
"enabled"*. Meanwhile the contract binds `disabled` as a Figma **BOOLEAN** property, so **no cell anywhere
in the emitted set is disabled** and `chooseCell` can only ever return an enabled cell. The scorer was
therefore comparing two different points in prop space, and its `pctAAMasked` measured the missing plane.

Localised with `scripts/console-loop-ref-plane-probe.mts` (the generalised successor to
`polaris-ref-triangle.mts`: that probe asked *"is the reference stale?"*, this one asks *"does the
reference name a plane the canvas cell IS?"*). It scores each committed canvas cell against **every**
`orig-shots`/`gate-shots` `__default` render and prints the matrix beside the pinned key. Re-pinning is
**not** done by argmin — `--repin` computes the target from the capture config's `stateProps` plus the
contract's own Figma binding kind, so it is deterministic and score-blind.

Exactly **three** stems were cross-plane (`checkbox`, `accordion`, `switch`). `button`, `fab`,
`icon-button`, `radio` carry the same state plane and were already pinned to `enabled`.

### The disabled plane IS genuinely absent from the canvas — named, not closed

The brief's premise ("a disabled-state colour is not reaching the canvas") is **true as a fact** and
**false as the cause of the 81.48**. Evidence, on the contract → emitter → canvas triangle:

| leg | finding |
|---|---|
| contract (capture/promote) | **CLEAN.** `states.disabled.color = {imported.shared.color-00000042}` on both `root` and `icon`. `#00000042` = `rgba(0,0,0,.26)` = **189,189,189** on white — exactly the library's paint. |
| emit-html | lowers it to `.checkbox:disabled { color: var(--imported-shared-color-00000042) }` — a pseudo-class that can never match the emitted `<span>` root (MUI itself uses a `.Mui-disabled` class). |
| capture gate | `extract/computed/gate.ts:367` admits this: it can only apply the plane via `el.disabled = true`, and stamps `data-gate-disabled-unsupported` when the root has no `disabled` IDL attribute. |
| emit-figma-script | compiles no `State=` axis (the contract sets no `figmaStatePreviews`), and a Figma BOOLEAN property cannot repaint a fill. |

**Consequence, measured:** `gate-shots/*.enabled__default.png` and `*.disabled__default.png` are
**byte-identical by sha256** for checkbox, switch and accordion, while every `orig-shots` enabled/disabled
pair for those components (and radio) **differs**. That byte-identity is exactly why the pre-`orig-shots`
basis scored checkbox 0.00 — both renders were the enabled picture.

**RETRACTED** from the switch/accordion receipts: *"the disabled/enabled token carries no information
here."* True of the contract renders, false of the library renders.

Closing the plane needs a canvas write (a `State=` axis) on `59mLQlOMiD5w5za6SUcoO5`, which was **not**
connected to the Desktop Bridge this round (`figma_list_open_files`: only `GnQnjSNBXtgtd2Ht0Hs1C8`,
`BMjUA2ue5CaZXU4kufxL0z`, `HherkaLt11JSCFJVAoyWlO`). Carried as `visual.unmeasured` /
`FC-STATE-PLANE-ABSENT`.

### The class cannot recur in this lane

`scripts/console-loop-mui-evidence-check.mjs` now **refuses** a scorecard whose reference names the
non-base value of a state plane the contract cannot express — in *either* direction, because a
fail-closed number is as void as a pass-claim when the pair is cross-plane. Covered by a new unit test
(`test:console-loop-mui-evidence`, 5/5). A read-only scan of astryx/carbon/polaris/tailwind/first-party
found **no** other cross-plane pin today; the alphabetical `pickGateShot` rule can still reintroduce one
in any lane whose receipt has no explicit `visual.reference`.

### Second group, by measured gap: FC-GEOMETRY-EXCLUDED (4 stems, one cause, refused by name)

| stem | canvas | library | root height/width token |
|---|---|---|---|
| chip | 51x20 | 50x32 | absent |
| avatar | 14x20 | 40x40 | absent |
| fab | 16x41 | 72x74 | absent |
| icon-button | 13x23 | 14x13 | absent |

The capture **did** record the box (`captured-truth.json` `base.root.style`: chip `height 32px`, avatar
`40x40`, fab `56x56`, icon-button `52x40`); `extract/computed/fuse.ts:555-565` excludes geometry channels
from fusion as environment-dependent, admitting them only for absolute-cluster parts, table cells and the
block-root/overlay doors. None of these roots qualify, so the contract gives them no box and the emitted
Figma root hugs its content. The computed gate cannot see the loss either — chip's row compares 61
channels for 0.20 pctAA and `height` is not among them.

**Not patched here on purpose.** Relaxing the geometry exclusion is the change that previously minted the
capture WINDOW as tokens in four of six libraries; it needs its own round with
`fuse.ts viewportDerivedRefusals` held. `badge` is NOT in this group — its root *does* carry
`{imported.badge.root.height/width}` and its 40x20-vs-20x20 gap has a different cause.

### Premises that died on re-measurement

1. **"The canvas paints the enabled blue into `checked.disabled`."** There is no `checked.disabled` cell
   on the canvas at all. The canvas painted the enabled blue into the **enabled** cell, correctly, and
   matches `@mui/material@9.2.0` at **0.00**.
2. **`accordion` FC-REF-WRONG-VARIANT** — "no correctly-collapsed MUI accordion reference exists". That
   was measured on the contract render. The library render `elevation.collapsed.enabled__default.png` is
   a correctly collapsed **290x50** header, exactly the canvas cell's box.
3. **"card/paper look like an elevation off-by-one"** (card scores 3.76 against library elevation-1 vs
   31.48 against elevation-0). REFUTED before acting: the elevation-1 render is 290x60 against a 98x13
   canvas cell and `compositionOk` is **false** — the lower AA is alignment noise on grossly mismatched
   boxes. The `0__default` pin is correct and the 31.48 is real.

### Floor

`RATCHET.json` floor for mui is **2** and was **not** edited by this round (owner's to move).
**Recommendation: 2 → 4** — `accordion` and `checkbox` pass on BOTH instruments against real
`@mui/material@9.2.0` pixels, which is the lane's stated rule for a floor move.
