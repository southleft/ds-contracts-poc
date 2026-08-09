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
