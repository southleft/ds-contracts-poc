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
| `polaris.badge` | 1 | 0 | 5 | yes |
| `polaris.banner` | 4 | 1 | 8 | yes |
| `polaris.button` | 200 | 4 | 3 | yes |
| `polaris.checkbox` | 1 | 0 | 2 | yes |
| `polaris.progress-bar` | 12 | 2 | 6 | yes |
| `polaris.radio-button` | 1 | 0 | 4 | yes |
| `polaris.spinner` | 2 | 1 | 0 | yes |
| `polaris.tag` | 1 | 0 | 3 | yes |
| `polaris.text-field` | 1344 | 5 | 6 | NO — variant explosion (see below) |
| `polaris.text` | 23232 | 5 | 0 | NO — variant explosion (see below) |
| `polaris.thumbnail` | 4 | 1 | 2 | yes |

## Variant-explosion exclusions (compiled, verified, NOT committed)

- `polaris.text-field`: 1344 variants (5 enum axes, full cartesian) — the script compiles headlessly and passed the referee, but a component set that size is not a buildable canvas artifact (and the 2.3MB script is not committed). Canvas modeling for this component needs AXIS CURATION (which axes become Figma variants vs. text-style/property choices) — a named Phase B owner decision, and a real finding: the canvas engine compiles the full cartesian by design.
- `polaris.text`: 23232 variants (5 enum axes, full cartesian) — the script compiles headlessly and passed the referee, but a component set that size is not a buildable canvas artifact (and the 13.8MB script is not committed). Canvas modeling for this component needs AXIS CURATION (which axes become Figma variants vs. text-style/property choices) — a named Phase B owner decision, and a real finding: the canvas engine compiles the full cartesian by design.

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

