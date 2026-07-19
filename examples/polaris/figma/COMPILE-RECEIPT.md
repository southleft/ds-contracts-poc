# Figma script compile receipt (headless)

Every committed `figma/*.figma.js` passed BOTH gates at generation time:

1. **Referee** — `emitFigmaScript` refuses any contract violating the shared
   `validateContract` rules (same referee as the React generator); an emitted
   script is proof of a clean pass.
2. **Canvas-engine compile** — `createFigmaEngine().compileComponentData` (the
   exact compile step the sync script serializes, and the same engine the
   playground canvas preview renders) compiled every variant combination
   headlessly. Per-contract counts below.

| contract | variants compiled | variant axes | distinct bound variable names | script committed |
|---|---|---|---|---|
| `polaris.avatar` | 5 | 1 | 1 | yes |
| `polaris.badge` | 1 | 0 | 4 | yes |
| `polaris.banner` | 4 | 1 | 2 | yes |
| `polaris.button` | 200 | 4 | 15 | yes |
| `polaris.checkbox` | 1 | 0 | 3 | yes |
| `polaris.progress-bar` | 12 | 2 | 6 | yes |
| `polaris.radio-button` | 1 | 0 | 4 | yes |
| `polaris.spinner` | 2 | 1 | 0 | yes |
| `polaris.tag` | 1 | 0 | 3 | yes |
| `polaris.text-field` | 4 | 5 | 8 | yes (canvas projection, see below) |
| `polaris.text` | 55 | 5 | 4 | yes (canvas projection, see below) |
| `polaris.thumbnail` | 4 | 1 | 3 | yes |

## Canvas projections (owner ruling, floor round 2)

The CONTRACT keeps the full prop space; the committed script draws a NAMED curated
projection (generate.ts CANVAS_PROJECTIONS). Booleans are BOOLEAN properties (never
variant axes); interaction states ride the State-preview axis where the contract
declares them.

- `polaris.text-field`: CANVAS PROJECTION (named curation): the drawn set is variant (2) × size (2) = 4 cells; type/inputMode/align are pinned to one representative value each (text/text/left — they parameterize input behavior and text alignment, not component form). Booleans are BOOLEAN properties; disabled rides the state-preview vocabulary where the contract declares it. The full 1,344-cell cartesian stays intact in the contract and both code surfaces.
- `polaris.text`: CANVAS PROJECTION (named curation): the drawn set is variant (all 11) × tone (5 of 11 — base, success, critical, caution, subdued) = 55 sample cells; fontWeight/alignment/as are pinned to one representative value each (regular/start/p — fontWeight and alignment restyle text a designer sets per instance, `as` is a semantics-only tag swap). The full 23,232-cell cartesian stays intact in the contract and both code surfaces; the Polaris type scale itself ships as MINTED FIGMA TEXT STYLES (see the token script receipt below).

## Minted Figma text styles (Polaris type scale)

`00-tokens.figma.js` upserts **11 named text styles** — one per Polaris text role
(`p.text-<role>-font-size` → semantic `font.<role>.size` alias → text style with identity
marker `ds_contracts/textStyleToken`, rename-safe, idempotent):

- `body-lg`
- `body-md`
- `body-sm`
- `body-xs`
- `heading-2xl`
- `heading-3xl`
- `heading-lg`
- `heading-md`
- `heading-sm`
- `heading-xl`
- `heading-xs`

NAMED LIMITS: sample text cells keep raw font props — style attachment is an exact
identity match on the node's bound token path, and the floor-promoted contracts bind
Polaris's own primitives (`p.text-*`), which is the honest binding. Polaris's 450/550/650
font weights have no Inter style mapping in the shared weight table, so minted styles
carry the 'Medium' runtime fallback.

## Token variable upsert — named BYO limits

The wrapped Polaris set upserts as a literal-valued **Primitives** collection
(mode "Value"). Two mechanical, NAMED transformations apply only to the Figma
side (the committed DTCG wrap and both code surfaces keep values verbatim):

- rem dimensions convert at Polaris's own documented 1rem = 16px base
- in-set aliases flatten to their resolved values (alias-wired variables are a
  feature of the repo's 4-tree layout, not of a flat foreign set)

50 token(s) have NO Figma-variable representation (gradients, shadows,
font stacks, easing curves, keyframe names, media strings) and are excluded from
the upsert by name:

- `p.color-button-gradient-bg-fill` = `linear-gradient(180deg, rgba(48, 48, 48, 0) 63.53%, rgba(255, 255, 255, 0.15) 100%)`
- `p.color-scheme` = `light`
- `p.font-family-mono` = `ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace`
- `p.font-family-sans` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.motion-ease` = `cubic-bezier(0.25, 0.1, 0.25, 1)`
- `p.motion-ease-in` = `cubic-bezier(0.42, 0, 1, 1)`
- `p.motion-ease-in-out` = `cubic-bezier(0.42, 0, 0.58, 1)`
- `p.motion-ease-out` = `cubic-bezier(0.19, 0.91, 0.38, 1)`
- `p.motion-keyframes-appear-above` = `{ from { transform: translateY(var(--p-space-100)); opacity: 0; } to { transform: none; opacity: 1; } }`
- `p.motion-keyframes-appear-below` = `{ from { transform: translateY(calc(var(--p-space-100) * -1)); opacity: 0; } to { transform: none; opacity: 1; } }`
- `p.motion-keyframes-bounce` = `{ from, 65%, 85% { transform: scale(1) } 75% { transform: scale(0.85) } 82.5% { transform: scale(1.05) } }`
- `p.motion-keyframes-fade-in` = `{ to { opacity: 1 } }`
- `p.motion-keyframes-pulse` = `{ from, 75% { transform: scale(0.85); opacity: 1; } to { transform: scale(2.5); opacity: 0; } }`
- `p.motion-keyframes-spin` = `{ to { transform: rotate(1turn) } }`
- `p.motion-linear` = `cubic-bezier(0, 0, 1, 1)`
- `p.shadow-0` = `none`
- `p.shadow-100` = `0rem 0.0625rem 0rem 0rem rgba(26, 26, 26, 0.07)`
- `p.shadow-200` = `0rem 0.1875rem 0.0625rem -0.0625rem rgba(26, 26, 26, 0.07)`
- `p.shadow-300` = `0rem 0.25rem 0.375rem -0.125rem rgba(26, 26, 26, 0.20)`
- `p.shadow-400` = `0rem 0.5rem 1rem -0.25rem rgba(26, 26, 26, 0.22)`
- `p.shadow-500` = `0rem 0.75rem 1.25rem -0.5rem rgba(26, 26, 26, 0.24)`
- `p.shadow-600` = `0rem 1.25rem 1.25rem -0.5rem rgba(26, 26, 26, 0.28)`
- `p.shadow-bevel-100` = `0.0625rem 0rem 0rem 0rem rgba(0, 0, 0, 0.13) inset, -0.0625rem 0rem 0rem 0rem rgba(0, 0, 0, 0.13) inset, 0rem -0.0625rem 0rem 0rem rgba(0, 0, 0, 0.17) inset, 0rem 0.0625rem 0rem 0rem rgba(204, 204, 204, 0.5) inset`
- `p.shadow-border-inset` = `0rem 0rem 0rem 0.0625rem rgba(0, 0, 0, 0.08) inset`
- `p.shadow-button` = `0rem -0.0625rem 0rem 0rem #b5b5b5 inset, 0rem 0rem 0rem 0.0625rem rgba(0, 0, 0, 0.1) inset, 0rem 0.03125rem 0rem 0.09375rem #FFF inset`
- `p.shadow-button-hover` = `0rem 0.0625rem 0rem 0rem #EBEBEB inset, -0.0625rem 0rem 0rem 0rem #EBEBEB inset, 0.0625rem 0rem 0rem 0rem #EBEBEB inset, 0rem -0.0625rem 0rem 0rem #CCC inset`
- `p.shadow-button-inset` = `-0.0625rem 0rem 0.0625rem 0rem rgba(26, 26, 26, 0.122) inset, 0.0625rem 0rem 0.0625rem 0rem rgba(26, 26, 26, 0.122) inset, 0rem 0.125rem 0.0625rem 0rem rgba(26, 26, 26, 0.2) inset`
- `p.shadow-button-primary` = `0rem -0.0625rem 0rem 0.0625rem rgba(0, 0, 0, 0.8) inset, 0rem 0rem 0rem 0.0625rem rgba(48, 48, 48, 1) inset, 0rem 0.03125rem 0rem 0.09375rem rgba(255, 255, 255, 0.25) inset`
- `p.shadow-button-primary-critical` = `0rem -0.0625rem 0rem 0.0625rem rgba(142, 31, 11, 0.8) inset, 0rem 0rem 0rem 0.0625rem rgba(181, 38, 11, 0.8) inset, 0rem 0.03125rem 0rem 0.09375rem rgba(255, 255, 255, 0.349) inset`
- `p.shadow-button-primary-critical-hover` = `0rem 0.0625rem 0rem 0rem rgba(255, 255, 255, 0.48) inset, 0.0625rem 0rem 0rem 0rem rgba(255, 255, 255, 0.20) inset, -0.0625rem 0rem 0rem 0rem rgba(255, 255, 255, 0.20) inset, 0rem -0.09375rem 0rem 0rem rgba(0, 0, 0, 0.25) inset`
- `p.shadow-button-primary-critical-inset` = `-0.0625rem 0rem 0.0625rem 0rem rgba(0, 0, 0, 0.2) inset, 0.0625rem 0rem 0.0625rem 0rem rgba(0, 0, 0, 0.2) inset, 0rem 0.125rem 0rem 0rem rgba(0, 0, 0, 0.6) inset`
- `p.shadow-button-primary-hover` = `0rem 0.0625rem 0rem 0rem rgba(255, 255, 255, 0.24) inset, 0.0625rem 0rem 0rem 0rem rgba(255, 255, 255, 0.20) inset, -0.0625rem 0rem 0rem 0rem rgba(255, 255, 255, 0.20) inset, 0rem -0.0625rem 0rem 0rem #000 inset, 0rem -0.0625rem 0rem 0.0625rem #1A1A1A`
- `p.shadow-button-primary-inset` = `0rem 0.1875rem 0rem 0rem rgb(0, 0, 0) inset`
- `p.shadow-button-primary-success` = `0rem -0.0625rem 0rem 0.0625rem rgba(12, 81, 50, 0.8) inset, 0rem 0rem 0rem 0.0625rem rgba(19, 111, 69, 0.8) inset, 0rem 0.03125rem 0rem 0.09375rem rgba(255, 255, 255, 0.251) inset`
- `p.shadow-button-primary-success-hover` = `0rem 0.0625rem 0rem 0rem rgba(255, 255, 255, 0.48) inset, 0.0625rem 0rem 0rem 0rem rgba(255, 255, 255, 0.20) inset, -0.0625rem 0rem 0rem 0rem rgba(255, 255, 255, 0.20) inset, 0rem -0.09375rem 0rem 0rem rgba(0, 0, 0, 0.25) inset`
- `p.shadow-button-primary-success-inset` = `-0.0625rem 0rem 0.0625rem 0rem rgba(0, 0, 0, 0.2) inset, 0.0625rem 0rem 0.0625rem 0rem rgba(0, 0, 0, 0.2) inset, 0rem 0.125rem 0rem 0rem rgba(0, 0, 0, 0.6) inset`
- `p.shadow-inset-100` = `0rem 0.0625rem 0.125rem 0rem rgba(26, 26, 26, 0.15) inset, 0rem 0.0625rem 0.0625rem 0rem rgba(26, 26, 26, 0.15) inset`
- `p.shadow-inset-200` = `0rem 0.125rem 0.0625rem 0rem rgba(26, 26, 26, 0.20) inset, 0.0625rem 0rem 0.0625rem 0rem rgba(26, 26, 26, 0.12) inset, -0.0625rem 0rem 0.0625rem 0rem rgba(26, 26, 26, 0.12) inset`
- `p.text-body-lg-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-body-md-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-body-sm-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-body-xs-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-heading-2xl-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-heading-3xl-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-heading-lg-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-heading-md-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-heading-sm-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-heading-xl-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.text-heading-xs-font-family` = `'Inter', -apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif`
- `p.z-index-0` = `auto`

The token script (`00-tokens.figma.js`) upserts the wrapped Polaris token set as
Figma variables (collection per tree; values verbatim) so the component scripts'
variable lookups resolve in a BLANK file — Phase B runs the token script first,
then any component script, in any order.

