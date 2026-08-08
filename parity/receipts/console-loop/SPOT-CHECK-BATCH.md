# Spot-check batch — 2026-08-07 (rev 3)

File: **DS Contracts Testing** `GnQnjSNBXtgtd2Ht0Hs1C8`  
`matchDeveloped` stays **false** until pixel score recommends.

## Human review results (2026-08-07 ~11:18)

### Pass (no further geometry work this pass)
| Stem | Notes |
|---|---|
| astryx/badge | ✅ |
| astryx/text-input | ✅ |
| astryx/banner | ✅ |
| astryx/progress-bar | ✅ |
| astryx/slider | ✅ (2026-08-07 ~12:37) |
| polaris/spinner | ✅ (2026-08-07 ~14:27) |
| polaris/text-field | ✅ (2026-08-07 ~14:27) |
| carbon/accordion | ✅ |
| carbon/text-input | ✅ |
| carbon/tag | ✅ |
| carbon/tabs | ✅ |
| carbon/icon-button | ✅ |
| carbon/modal | ✅ footer 50/50 |
| polaris/radio-button | ✅ |
| polaris/checkbox | ✅ |
| polaris/progress-bar | ✅ |
| polaris/avatar | ✅ TP initials |
| polaris/banner | ✅ warning icon |
| polaris/tag | ✅ (Active/Focus rings = state previews) |
| polaris/thumbnail | ✅ radius |
| altitude/badge | ✅ |
| tailwind/* (reviewed) | ✅ |
| carbon/checkbox, astryx/switch, tailwind/toggle | ✅ prior |

### Fail → fixed + re-synced (please re-check)
| Stem | nodeId | Defect | Fix / FC | Live verify |
|---|---|---|---|---|
| astryx/slider | `9:831` | Tooltip=None lookalike; V fill/text float; first H/V weak | **FC-BASE-HIDDEN-RESTORE** tooltip restored + abs @ ~40%; **FC-COND-ABS-TEXT** V text top=86 | ✅ tooltips + V text pinned (re-check on cream section — black export hides dark fill) |
| carbon/tabs | `1:5947` | Labels truncated + trailing-s clip | HUG + **FC-FIGMA-CLIP-DEFAULT** + **RUNTIME_EMIT_REV** force-amend | ✅ Overview/Activity/Settings full, no clip |
| polaris/checkbox | `1:10049` | Glyph bias; truncated label | SVG host-center; HUG full label | ✅ full “Save this information” |
| polaris/progress-bar | `1:10076` | Only 100% fills | **FC-METER** `pct: 0.4` | ✅ ~40% indicator |
| carbon/icon-button | `1:5645` | “+” top-left | CENTER + glyph recenter + force-amend | ✅ glyphs centered |

### Also synced (new this climb)
| Stem | nodeId |
|---|---|
| polaris/thumbnail | `1:10491` |
| polaris/spinner | `1:10105` |
| carbon/inline-notification | `1:5824` |

## Lessons locked (do not regress)
1. **Capture-measured widths truncate Figma text** (Inter ≠ capture font) — HUG labels unless `textTruncation` intentional.
2. **`layout.grow` on text → FILL → clips** inside fixed wrappers — exclude non-truncating text from fillW.
3. **SVG glyphs need host-centering** (absolute left/top from host−iconSize)/2 — not just flex CENTER on empty hosts.
4. **Meters need `meter` discipline** — a full-width token on the indicator draws 100% forever.
5. **Thumb/fill z-order** — fill before thumb in children; fill ends at thumb center.
6. **Figma `clipsContent` defaults true** — CSS overflow defaults visible; unclip frames/text hosts (**FC-FIGMA-CLIP-DEFAULT**).
7. **Base `display:none` needs a matching restore** for showcase axes (**FC-BASE-HIDDEN-RESTORE**) — otherwise Tooltip/None collapse.
8. **`stylesWhen position:absolute` must compile on text** when the combo matches (**FC-COND-ABS-TEXT**).

Eval pins: `FC-CARBON-TABS-LABEL`, `FC-FIGMA-CLIP-DEFAULT`, `FC-ASTRYX-SLIDER-TOOLTIP`, `FC-VARIANT-BOOL-LBP`, prior Wave A pins.

## Next-batch sync (2026-08-07 ~12:04) — [Sync next visual-audit batch](bad2b8d2-fcec-4999-a8d3-2864ae0e4274)

| Stem | nodeId | Status |
|---|---|---|
| polaris/thumbnail | `1:10491` | ✅ radius ~8px (prior 0-radius fixed) |
| polaris/tag | `1:10192` | ℹ️ Active/Focus heavy `#303030` 3px outlines are **intentional** `figmaStatePreviews` — Default matches receipt |
| polaris/avatar | `1:7849` | 🔧 magenta=`avatar-one` intentional; missing **TP** initials → fixed (default `"TP"`) |
| carbon/modal | `1:5911` | 🔧 footer not 50/50 → fixed (`layout.grow` on Cancel/Save) |
| polaris/banner | `1:8463` | 🔧 Warning icon invisible (**FC-SVG-VIEWBOX** 450 box) → fixed; Focus blue ring = State=Focus Visible (intentional) |

## Climb batch (2026-08-07 ~12:55) — please spot-check

| Stem | nodeId | Defect | Fix / FC | Live verify |
|---|---|---|---|---|
| polaris/spinner | `1:10105` | Gap at 12 o'clock vs developed ~3 o'clock | **FC-SVG-ROTATION** `rotate(90deg)` → `spec.rotation` / node.rotation=-90 | ✅ human pass |
| polaris/text-field | `1:10365` | Field hugged “Example” (~89px) | **FC-WIDTH-TOKEN** bind `connected.width.off.off` (211) + textfield grow | ✅ human pass |
| carbon/inline-notification | `1:5824` | High-contrast close X black on dark; then red spur lines on low | **FC-CONTRAST-ICON**; **FC-PSEUDO-OVERFLOW** drop fixed 425px `root-before`, bind low 1px #161616 box | ✅ synced (root-before gone; low 1px box; white close on high). Score `compositionOk` vs gate-shot; AA~22% (width/padding — next FC) |

### Lessons locked (this climb)
9. **`DECLARED_CHANNELS.transform`** — identity-matrix only blocked icon orientation; allow `rotate(<n>deg)` for **FC-SVG-ROTATION**.
10. **Showcase width** — height-only root bindings leave inputs HUG content; bind a real width token.
11. **Contrast-keyed icon paint** — flat `#000` close glyphs fail on high-contrast rows; mint `color.{contrast}`.
12. **Altitude Type enum Squared-only** — every cell took squared radius; add `default` (pill) without using capture `unset` (**FC-ENUM-HOLE**).

| Stem | nodeId | Defect | Fix / FC | Live verify |
|---|---|---|---|---|
| altitude/chip | `1:3017` | Only Squared; then Focus blue rings cluttered grid | **FC-ENUM-HOLE** + **FC-STATE-PREVIEW-NOISE** (`figmaStatePreviews: false`); amend now removes leftover State variants | ✅ synced (10 cells Default/Squared; no focus rings). Score near-pass AA **5.12%** vs `info.unset__default` (font-AA band) |

### Lessons locked (visual loop, 2026-08-07 evening)
13. **Plugin fetch = `localhost` on dual-stack `:9223`** — `127.0.0.1` fails; IPv6 zombies steal ports. Use `npm run console-loop:stem-serve`.
14. **Minted vars need `00-tokens.figma.js` before component amend** — missing border tokens abort sync.
15. **Score cells at export scale 1** vs **gate-shots** (never `pair--*` side-by-side). Set shots / padded refs fail `compositionOk`.
16. **Agent owns `matchDeveloped`** when `recommendMatchDeveloped` or near-pass+diff shows font-AA only.

## Next DS nomination (Wave D — after more frozen green)
**Primary: Microsoft Fluent 2** (`@fluentui/react-components`) — Griffel + slots; extract already 23/23 in enterprise gauntlet.  
Runner-up: Spectrum SWC (shadow/CEM). Defer Mantine / Ant / Atlassian as primary next corpus.
