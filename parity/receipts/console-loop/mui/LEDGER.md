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
