# Astryx docs-site theme — pinned capture + alternate bundle

`@astryxdesign/core@0.1.6` (the npm publication all 13 Astryx contracts were
extracted from) ships ONLY `theme-neutral` (primary `#0064E0` blue). The docs
site astryx.atmeta.com looks different because its own theme was never
published. This round captures the DOCS SITE's theme values and emits an
alternate CONTRACTS-BUNDLE — **same 13 contracts, docs look** — proving the
tokenSet section makes themes swappable.

## THE HONEST FINDING FIRST: the docs bundle only half-rethemes Button/Card/Slider

The minted layer (`tokens/astryx-minted.dtcg.json`, 237 leaves, **all
literals, zero aliases**) rides into BOTH bundles unchanged — it holds
theme-neutral values captured at extraction time (e.g.
`imported.shared.color-0064e0 = #0064e0`, the neutral accent baked in by
hex). Quantified across the 13 contracts (222 color-channel token refs
total):

| | refs | rethemes under docs bundle? |
|---|---|---|
| color refs → base semantic tokens | **111** | yes |
| color refs → minted literals | **111** | **NO — stays theme-neutral** |

Per component, minted share of color channels: **slider 13/14 (93%)**,
**card 52/67 (78%)**, **button 32/41 (78%)**, badge 14/44 (32%). The other
nine contracts (banner, checkbox-input, dropdown-menu, dropdown-menu-item,
progress-bar, switch, text-input, toast, token) are 100% semantic and
retheme fully. Concretely: the docs theme's near-black accent lands on
banner links, checkbox checks, progress fills, text-input focus — but a
Button `primary` background bound to `imported.shared.color-0064e0` **stays
neutral blue**. Radii/fonts/spacing ride semantic tokens, so the shape and
type delta (radius-element 8→12px, Figtree) does land everywhere.

This is a property of what the extraction minted as literals, not of the
bundle format — re-anchoring minted color literals onto semantic tokens is
the (unstarted) fix, named here rather than papered over.

## Snapshot provenance (the input boundary)

An external MUTABLE site — this capture is pinned the way a sandbox npm
install pins a package. Everything downstream is a pure function of the
committed capture file; re-CAPTURING on a later date may legitimately
produce different values and is a new snapshot, not a bug.

- **Captured**: 2026-07-26T00:52:45.460Z (2026-07-25 US)
- **Pages**: `https://astryx.atmeta.com/` and
  `https://astryx.atmeta.com/components/Button` (HTTP 200; values are
  root-scoped and were **identical across both pages — 0 disagreements**)
- **Browser**: chromium 149.0.7827.55 via playwright-core, headless,
  1440×1000, research UA
- **Theme scope**: `<html lang=en data-theme=light data-astryx-theme=astryx>`
  — the site's StyleX vars are **SEMANTIC names** (`--color-accent`, …), not
  hashed; the docs override rides `[data-astryx-theme="astryx"]`. No
  value-correlation step was needed.
- **Method**: computed value of `--<name>` at the document root for each of
  the 186 names in `tokens/astryx.dtcg.json`. `light-dark(A, B)` stays
  unresolved in a computed custom property, so one read carries both modes.
  Verified: a `data-theme=dark` + `prefers-color-scheme: dark` re-read
  matched the light read on all 186 names (**0 dark-read disagreements**).
- **Coverage**: **186/186 mapped, 0 unmapped**, 0 site-missing fallbacks.
  All 79 neutral-wrap mode-varying names came back as full `light-dark()`
  wraps — the same 79.

Raw capture: `tokens/docs-theme.capture.json` (values + its own
verification section; the emit REFUSES if that section shows instability).

## Files + regeneration

```
npx tsx examples/astryx/scripts/capture-docs-theme.mts   # browser → tokens/docs-theme.capture.json (NEW SNAPSHOT)
npx tsx examples/astryx/scripts/build-docs-tokens.ts     # pure emit → the three dtcg files below
npx tsx packages/cli/src/cli.ts figma bundle examples/astryx/contracts \
  --tokens examples/astryx/tokens/astryx-docs.dtcg.json,examples/astryx/tokens/astryx-minted.dtcg.json \
  --modes examples/astryx/tokens/modes/astryx-docs.light.dtcg.json,examples/astryx/tokens/modes/astryx-docs.dark.dtcg.json \
  --name "Astryx (docs theme)" --out examples/astryx/figma/astryx-docs.bundle.json
```

- `tokens/astryx-docs.dtcg.json` — 186 tokens, SAME names/order/$type/alias
  structure as the neutral wrap (25 aliases preserved — each proven by the
  capture: token and target computed identically; 3 broken→literal:
  `text-display-{1,2,3}-weight` are 600 on the site vs the package's
  `{font-weight-normal}` 400)
- `tokens/modes/astryx-docs.{light,dark}.dtcg.json` — the 79 mode-varying
  entries
- `figma/astryx-docs.bundle.json` — 13 contracts (byte-identical to the
  `contracts` section of `astryx.bundle.json`) + tokenSet
  "Astryx (docs theme)": 186 base, light/dark modes, minted tree. 169,330
  bytes.

**Determinism gates (run 2026-07-25):** emit run twice → all three dtcg
files byte-identical; bundle built twice → byte-identical
(sha256 `2ca1861a…82bd8a`). Bundle tokenSet passes `parseTokenSet`;
`compileTokenSetRows` → 423 rows (COLOR 191 / FLOAT 181 / STRING 51) vs
neutral 423 (COLOR 191 / FLOAT 178 / STRING 54) — the 3-row STRING→FLOAT
shift is exactly the three display-weight alias breaks.

## The theme delta (docs vs theme-neutral)

**17 of 186 tokens genuinely change** (light / dark):

| token | theme-neutral | docs |
|---|---|---|
| `color-accent` | `#0064E0` / `#2694FE` | `#15110C` / `#DFE2E5` |
| `color-accent-muted` | `#0082FB33` / `#0082FB3F` | `rgba(21,17,12,0.08)` / `rgba(223,226,229,0.14)` |
| `color-on-accent` | `#FFFFFF` / `#FFFFFF` | `#FFFFFF` / `#15110C` |
| `color-background-body` | `#F1F4F7` / `#111112` | `#F8F4ED` / `#111112` |
| `color-text-primary` | `#0A1317` / `#DFE2E5` | `#15110C` / `#DFE2E5` |
| `color-text-accent` | `#0064E0` / `#3E9EFB` | `#15110C` / `#DFE2E5` |
| `color-icon-accent` | `#0064E0` / `#2694FE` | `#15110C` / `#DFE2E5` |
| `color-icon-primary` | `#0A1317` / `#DFE2E5` | `#15110C` / `#DFE2E5` |
| `radius-inner` | 4px | 8px |
| `radius-element` | 8px | 12px |
| `radius-container` | 12px | 16px |
| `radius-page` | 28px | 32px |
| `font-family-body` | system stack | `Figtree, "Figtree Variable", system-ui, …` |
| `font-family-heading` | system stack | `Figtree, …` |
| `text-display-{1,2,3}-weight` | `{font-weight-normal}` (400) | `600` |

The docs look = a warm near-black accent (`#15110C`) on a cream body
(`#F8F4ED`), rounder corners, Figtree type. Notably `color-background-surface`
(`#FFFFFF` / `#1F1F22`) and `color-text-primary`'s dark arm are UNCHANGED —
the docs delta is smaller than it looks, and half of what remains rides
minted literals (see the finding above).

12 further tokens differ only in whitespace serialization (computed values
drop spaces after commas: shadows, `ease-standard`, `font-family-code`,
`color-neutral`, `color-shadow`, `shadow-inset-*`) — semantically identical;
carried as captured.
