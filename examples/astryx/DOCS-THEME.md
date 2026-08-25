# Astryx docs-site theme — pinned capture + alternate bundle

`@astryxdesign/core@0.1.6` (the npm publication all 13 Astryx contracts were
extracted from) ships ONLY `theme-neutral` (primary `#0064E0` blue). The docs
site astryx.atmeta.com looks different because its own theme was never
published. This round captures the DOCS SITE's theme values and emits an
alternate CONTRACTS-BUNDLE — **same 13 contracts, docs look** — proving the
tokenSet section makes themes swappable.

## THE HONEST FINDING, RE-MEASURED: what is left is CARD, and it is a capture defect

The minted layer (`tokens/astryx-minted.dtcg.json`, 237 leaves) rides into
BOTH bundles — it held theme-neutral values captured at extraction time
(e.g. `imported.shared.color-0064e0 = #0064e0`, the neutral accent baked in
by hex). The **RE-ANCHORING ROUND** (`scripts/reanchor-minted.ts`, receipt
`tokens/MINTED.md`) has moved **54** of those leaves onto semantic tokens: 9
auto-clean badge tone rules, then **45 more in the REVIEWED round** (the 5
ranked value groups, split PER LEAF and decided — orchestrator-reviewed under
owner delegation, TJ 2026-07-26). Post-state, across the 13 contracts (222
refs on color-ish channels = **220 scalar-color + 2 gradient**):

| | refs | rethemes under docs bundle? |
|---|---|---|
| refs → base semantic tokens | **165** (109 always + **56 re-anchored**: 9 + 47) | yes |
| refs → minted literals | **57** (55 color + 2 gradient) | **NO — stays theme-neutral** |

Of the **55** color refs still on literals, every one is now DECIDED — the
queue is **resolved**, not merely counted:

| | refs | status |
|---|---|---|
| awaiting human review | **0** | The queue is empty: every live leaf is either re-anchored or carries a named kept-literal receipt. |
| REFUSED by name (degraded capture) | **48** | `imported.card.root.border-*-color.*` on the 12 zero-width-border variants — a degraded capture, not design intent (see `tokens/MINTED.md`). **The fix is to re-capture card**, not to re-anchor it. |
| REVIEWED AND KEPT LITERAL (receipted) | **7** | Two value-named SHARED leaves on Slider. `imported.shared.color-0a1317` serves a tooltip SURFACE and a label's TEXT through one path, and those two roles INVERT against each other in dark (`{color-background-inverted}` #FFFFFF dark vs `{color-text-primary}` #DFE2E5 dark) — one alias cannot serve both, and splitting the leaf is a path change this round forbids. `imported.shared.color-ffffff` is the tooltip's white content, whose surface is itself an unnamed literal, so nothing on disk grades the pairing. Named follow-up: split the shared leaf, then re-run the join. |

> **Two corrections to the original round**, found by re-measuring rather than
> re-asserting:
>
> 1. **Arithmetic.** The first version of this table said 111 semantic / 111
>    minted. Re-measured: the semantic side was **109**, and the 2
>    `background-image` GRADIENT refs (which are minted) had been folded into
>    it by subtraction from 222. The minted color count (111) and every
>    per-component number below were correct.
> 2. **A misattributed example, twice.** The first version wrote that "a Button
>    `primary` background bound to `imported.shared.color-0064e0` stays neutral
>    blue". It does not: Button `primary` binds `{color-accent}`, a SEMANTIC
>    token, and rethemes fully. The second version then said the three
>    axis-expanded refs to `imported.shared.color-0064e0` were Slider's "thumb
>    and the two value displays" — also wrong, and the review round caught it by
>    reading the contract instead of the doc: all three are `background-color`
>    (the filled track `part-1-0-1` plus BOTH thumb renderings, `slider-thumb`
>    and `slider-thumb-2`). The two value displays (`tooltip`/`label-2` and
>    `label-3`) bind `imported.shared.color-ffffff` and
>    `imported.shared.color-0a1317`. The correction mattered: it is why the leaf
>    needed no split and could land on `{color-accent}`.

Per component, minted share of scalar color channels — the reviewed round
moved four of these numbers:

| component | before | after |
|---|---|---|
| badge | 5/44 (was 14/44) | **0/44** — fully semantic |
| button | 32/41 | **0/41** — fully semantic (its 2 remaining minted refs are the `background-image` GRADIENTS, which no scalar token can carry) |
| slider | 13/14 | **7/14** |
| card | 52/67 | **48/67** — and all 48 are the refused zero-width borders |

The other nine contracts (banner, checkbox-input, dropdown-menu,
dropdown-menu-item, progress-bar, switch, text-input, toast, token) were and
remain 100% semantic. Concretely, the docs theme's near-black accent now also
lands on **every Button label** (primary/secondary/ghost/destructive, which
rode frozen literals on four rendered elements each), **Badge's neutral and
warning rules**, **Card's real 1px border**, **Slider's track, label, thumb
and filled track**. The old headline example is closed: `RA-0064e0`
(`imported.shared.color-0064e0`) is now `{color-accent}` — its three refs
turned out to be all `background-color` fills (filled track + both thumb
renderings), not "thumb + two value displays" as the 2026-07-25 version of
this doc said; the two value displays bind the OTHER two shared leaves, which
are the ones still literal. Radii/fonts/spacing ride semantic tokens, so the
shape and type delta (radius-element 8→12px, Figtree) lands everywhere.

This is a property of what the extraction minted as literals, not of the
bundle format. The fix is **finished as far as evidence allows**: 54 leaves
landed, 0 queued, 48 refs refused with evidence (re-capture card), 7 refs
reviewed and kept literal with receipts (split the shared leaf first).

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
  --name "Astryx (docs theme)" --icons examples/astryx/assets/icons \
  --out examples/astryx/figma/astryx-docs.bundle.json   # --icons since Banner promoted its four status glyphs as real assets
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
  "Astryx (docs theme)": 186 base, light/dark modes, minted tree. **266,824
  bytes on disk.**

  > The CLI's own log line for this file says `169952 bytes` — that is the
  > UTF-16 string length, not the UTF-8 byte count; they differ by the
  > multi-byte characters in the contract text. The 2026-07-25 version of this
  > doc quoted the CLI number (then `169,330`) as if it were the file size.
  > Both numbers are real; only one is the file. Fixed to the file size, and
  > the ambiguity named so the next reader does not chase a phantom drift.

**Determinism gates (re-run 2026-08-24, when `npm run bundles:fresh` first rebuilt every committed
example bundle and found BOTH of these stale — the code-only-fact receipts the engine had learned to
write since 2026-07-26 were missing, ~4.2 KB per bundle, and nothing noticed because executing a
stale bundle succeeds):** emit
run twice → all three dtcg files byte-identical; **both** bundles built twice
→ byte-identical:

| bundle | sha256 | rows |
|---|---|---|
| `astryx.bundle.json` | `da6571f4…ea05e32b` | 423 (COLOR 137 / FLOAT 178 / STRING 54 / **ALIAS 54**) |
| `astryx-docs.bundle.json` | `3f6bee30…abe5dfd0` | 423 (COLOR 137 / FLOAT 181 / STRING 51 / **ALIAS 54**) |

Both pass `parseTokenSet`. The deltas against the previous pin (neutral was
COLOR 182 / ALIAS 9, sha `4f309a04…41d3aed5`; docs COLOR 182 / ALIAS 9, sha
`f9d32636…4498781e`), accounted for BY NAME:

- **COLOR 182 → 137 + ALIAS 9 → 54** in both: the reviewed round re-anchored
  45 further minted leaves, which become Figma-NATIVE variable aliases and
  inherit their target's Light/Dark values instead of carrying a frozen
  literal. Row total is unchanged at 423, so the plugin-engine
  `docs.vars === astryx.vars` equality still holds (**423 variables**,
  verified through the real engine path in `scripts/plugin-engine-check.mjs`,
  which also pins one leaf per decision arm resolving its UNCHANGED neutral
  light value, and pins the two decided-literal leaves as still literal).
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
the docs delta is smaller than it looks. What still rides minted literals is
now down to 55 of 220 scalar color refs, 48 of them a card capture defect
(see the finding above).

12 further tokens differ only in whitespace serialization (computed values
drop spaces after commas: shadows, `ease-standard`, `font-family-code`,
`color-neutral`, `color-shadow`, `shadow-inset-*`) — semantically identical;
carried as captured.
