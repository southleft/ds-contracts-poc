# Visual failure root causes (developed-render bar)

These are **not** “looks sane on cream.” A stem passes only when Figma-capable props **and** aesthetics match developed renders (`examples/*/receipts`, `extract/computed/out/*/receipts/pair--*.png`).

## User screenshots — verdict

| Capture | Pass? | Why |
|---|---|---|
| Checked checkbox with white ✓ + label | Reference OK | Target aesthetic for checkbox — canvas Carbon/Astryx still fail this |
| Polaris TextField row with `{placeholder}` | **FAIL** | Unresolved brace text; label beside field; inconsistent borders |
| Astryx Toast clipped + Slot | **FAIL** | Unitless line-height as 1.4px; optional slot defaulted Show=true |
| Astryx Switch Off-only | **FAIL** | Off chrome improved; **no On axis / no thumb in contract** |
| Astryx Slider line/semi thumbs | **FAIL** | `applyInsetOverlay` STRETCH into hug-zero parent |
| Astryx ProgressBar Upload/ing | **FAIL** | Root width was `spacing-12` (48px); fill not a meter |
| Altitude Badge small overflow | **FAIL** | Dot=8px pip still painted “Badge” (CSS `text-indent` has no Figma twin) |
| Tailwind ToggleSwitch no knob | **FAIL** | Thumb is `::after` refused at promote (`pseudo-decor-size-varies`) |
| ChatMessage Slot wireframe | **FAIL** | Empty slots → dashed util; optional Show defaulted true |

## Shared engine lessons (every DS)

| Failure class | Mechanism | Fix location |
|---|---|---|
| Absolute thumb/glyph collapses | Inset overlay STRETCH vs hug-zero / `display:contents` parent | `applyInsetOverlay` / `resizeOutOfFlow` — respect `fixedWidth`/`fixedHeight` |
| Clipped text | CSS unitless `line-height: 1.4286` compiled as **1.4286px** | `compileLineHeight` → PERCENT |
| `{placeholder}` on canvas | `formControlSpec` used unresolved attr when prop had no default | Prefer prop default; never brace form |
| Label beside field | `layout.align` without `direction` skipped block-flow VERTICAL | Block root + align-only → VERTICAL |
| Dashed Slot as default | Optional slots minted `Show X = true` | Default `false` |
| Missing thumb/check | Pseudo-elements refused or never in contract | Promote / contract anatomy — **not** canvas paint |
| Dot badge text overflow | CSS hide via `text-indent`; Figma still draws text | `visibleWhen` / omit content for Dot |

## Status of code fixes (this pass)

**Landed in `core/emit-figma-script.ts`**
- Fixed-size inset overlays
- Unitless line-height → PERCENT
- Placeholder brace suppression
- Block + align-only → column
- Optional slot Show default false

**Contract / re-emit**
- `astryx.progress-bar` — 240px width + meter
- `polaris.text-field` — placeholder default + column direction
- `altitude.badge` — label `visibleWhen` Dot=Default only
- Re-emitted via `scripts/reemit-visual-fixes.ts` into `examples/*/figma/`

**Still require anatomy / promote work (do not mark pass)**
- Astryx Switch On + thumb
- Astryx/Carbon checkbox check glyph
- Tailwind ToggleSwitch thumb (`::after` size-by-axis)
- ChatMessage filled `defaultContent`
- Polaris TextField border fidelity vs receipt (layout/placeholder only fixed above)

## Process rule

1. Screenshot COMPONENT_SET (not isolated translucent cells on black).
2. Put developed PNG beside it.
3. Fail closed on geometry, missing axes, placeholder chrome, mid-word wrap, missing glyphs.
4. Fix **emit/contract/promote** — canvas hand-patches are not evidence.
