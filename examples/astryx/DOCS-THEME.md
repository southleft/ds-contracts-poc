# Astryx docs-site theme — pinned capture + alternate bundle

`@astryxdesign/core@0.1.6` (the npm publication all 13 Astryx contracts were
extracted from) ships ONLY `theme-neutral` (primary `#0064E0` blue). The docs
site astryx.atmeta.com looks different because its own theme was never
published. This round captures the DOCS SITE's theme values and emits an
alternate CONTRACTS-BUNDLE — **same 13 contracts, docs look** — proving the
tokenSet section makes themes swappable.

## THE HONEST FINDING FIRST: the docs bundle still mostly half-rethemes Button/Card/Slider

The minted layer (`tokens/astryx-minted.dtcg.json`, 237 leaves) rides into
BOTH bundles — it holds theme-neutral values captured at extraction time
(e.g. `imported.shared.color-0064e0 = #0064e0`, the neutral accent baked in
by hex). The **RE-ANCHORING ROUND** (`scripts/reanchor-minted.ts`, receipt
`tokens/MINTED.md`) has since moved 9 of those leaves onto semantic tokens.
Post-state, across the 13 contracts (222 refs on color-ish channels = **220
scalar-color + 2 gradient**):

| | refs | rethemes under docs bundle? |
|---|---|---|
| refs → base semantic tokens | **118** (109 always + **9 re-anchored**) | yes |
| refs → minted literals | **104** (102 color + 2 gradient) | **NO — stays theme-neutral** |

Of the **102** color refs still on literals, every one is now NAMED rather
than merely counted:

| | refs | status |
|---|---|---|
| awaiting human review (`tokens/reanchor-proposals.md`) | **54** | 5 value groups whose literal matches 3–7 equal-valued semantic tokens. A value join cannot pick; ranking is presented, never applied. |
| REFUSED by name | **48** | `imported.card.root.border-*-color.*` on the 12 zero-width-border variants — a degraded capture, not design intent (see `tokens/MINTED.md`). |

> **Two corrections to the original round**, found by re-measuring rather than
> re-asserting:
>
> 1. **Arithmetic.** The first version of this table said 111 semantic / 111
>    minted. Re-measured: the semantic side was **109**, and the 2
>    `background-image` GRADIENT refs (which are minted) had been folded into
>    it by subtraction from 222. The minted color count (111) and every
>    per-component number below were correct.
> 2. **A misattributed example.** The first version wrote that "a Button
>    `primary` background bound to `imported.shared.color-0064e0` stays neutral
>    blue". It does not: Button `primary` binds `{color-accent}`, a SEMANTIC
>    token, and rethemes fully. The three axis-expanded refs to
>    `imported.shared.color-0064e0` are all **Slider** (thumb / the two value
>    displays). The finding stands; the illustration was wrong.

Per component, minted share of color channels: **slider 13/14 (93%)**,
**card 52/67 (78%)**, **button 32/41 (78%)**, badge **5/44 (11%, was 14/44 —
the 9 re-anchored tone rules)**. The other nine contracts (banner,
checkbox-input, dropdown-menu, dropdown-menu-item, progress-bar, switch,
text-input, toast, token) are 100% semantic and retheme fully. Concretely:
the docs theme's near-black accent lands on banner links, checkbox checks,
progress fills, text-input focus, Button `primary` (it binds `{color-accent}`),
and now on Badge's nine tone rules — but **Slider's thumb and both value
displays**, whose `background-color` binds `imported.shared.color-0064e0`,
**still stay neutral blue**. That leaf is row `RA-0064e0`: five candidates
(`color-accent`, `color-text-accent`, `color-icon-accent`, `color-border-blue`,
`color-icon-blue`), all identical in light and diverging in dark — one of the
54 awaiting review, and the single highest-leverage one. Radii/fonts/spacing
ride semantic tokens, so the shape and type delta (radius-element 8→12px,
Figtree) does land everywhere.

This is a property of what the extraction minted as literals, not of the
bundle format. The fix is **started, not finished**: 9 landed, 54 queued for
a human, 48 refused with evidence.

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
  "Astryx (docs theme)": 186 base, light/dark modes, minted tree. **169,536
  bytes on disk.**

  > The CLI's own log line for this file says `169426 bytes` — that is the
  > UTF-16 string length, not the UTF-8 byte count; they differ by the
  > multi-byte characters in the contract text. The 2026-07-25 version of this
  > doc quoted the CLI number (then `169,330`) as if it were the file size.
  > Both numbers are real; only one is the file. Fixed to the file size, and
  > the ambiguity named so the next reader does not chase a phantom drift.

**Determinism gates (re-run 2026-07-26, after the re-anchoring round):** emit
run twice → all three dtcg files byte-identical; **both** bundles built twice
→ byte-identical:

| bundle | sha256 | rows |
|---|---|---|
| `astryx.bundle.json` | `4f309a04…41d3aed5` | 423 (COLOR 182 / FLOAT 178 / STRING 54 / **ALIAS 9**) |
| `astryx-docs.bundle.json` | `f9d32636…4498781e` | 423 (COLOR 182 / FLOAT 181 / STRING 51 / **ALIAS 9**) |

Both pass `parseTokenSet`. Two deltas against the pre-re-anchoring pin
(neutral was COLOR 191 / FLOAT 178 / STRING 54, docs COLOR 191 / FLOAT 181 /
STRING 51, sha `2ca1861a…82bd8a` for docs), each accounted for BY NAME:

- **COLOR 191 → 182 + ALIAS 9** in both: the 9 re-anchored badge tone rules
  are now Figma-NATIVE variable aliases, so they inherit their target's
  Light/Dark values instead of carrying a frozen literal. Row total is
  unchanged at 423, so the plugin-engine `docs.vars === astryx.vars` equality
  still holds (**423 variables**, verified through the real engine path in
  `scripts/plugin-engine-check.mjs`).
- the 3-row STRING→FLOAT shift between neutral and docs is unchanged — still
  exactly the three display-weight alias breaks.

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
