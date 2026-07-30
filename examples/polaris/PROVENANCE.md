# Polaris round — provenance

**Subject:** `@shopify/polaris@13.9.5` (Shopify's admin design system, the
repo's library #2 and its most-cited exemplar), pinned in `.polaris-sandbox/`
with `react@18.3.x`, `react-dom@18.3.x`, `esbuild@0.28.x`. **The sandbox recipe
is COMMITTED** (`.polaris-sandbox/package.json` + `package-lock.json` — the
first library in this repo reproducible from committed bytes; the other five
libraries' recipes are still PROVENANCE prose like this file's block below,
named in docs/23 §3.2 as follow-up). Recreate:

```bash
cd examples/polaris/.polaris-sandbox && npm ci
```

**Why this file exists only now.** Polaris was captured before the repo had a
PROVENANCE convention, before per-library out-dir namespacing (its capture dirs
live at `extract/computed/out/<component>` directly), before the CSS-vars
reader existed (library #4, MUI, brought it), and before the shared promote
pipeline. Every one of those debts was paid in the **task-#26 recapture round
(2026-07-29)**, which this file records.

## The task-#26 recapture round (2026-07-29)

All 12 components recaptured through the committed sandbox, each with the
double-run byte-identity self-check, with the CSS-vars reader ON for the first
time — `varPrefix: "--p-"` plus the new `tokenGroup: "p"` config field
(`extract/computed/configs/polaris.json`), because Polaris's DTCG wrap nests
every leaf under a `p` group (`p.font-weight-medium`) where the four
reader-era libraries ship flat trees.

**Verified source facts read per component** (`source-bindings.json`):

| component | facts | | component | facts |
|---|---|---|---|---|
| textfield | 1440 | | checkbox | 61 |
| text | 1420 | | avatar | 35 |
| button | 1320 | | radiobutton | 30 |
| badge | 401 | | progressbar | 12 |
| banner | 272 | | thumbnail | 4 |
| tag | 204 | | spinner | 2 |

**Total: 5,201 facts.** Shorthand ceiling: 21 dropped `var()`-carrying
shorthand declarations (docs/23 §2.7's table row). The prior state — zero
source facts library-wide — was a missing re-run, not a property of Polaris:
the published `styles.css` carries 2,727 `var(--p-*)` references at point of
use across 328 distinct custom properties (measured 2026-07-29, docs/23 §3.2).

**Promotion moved to the shared pipeline.** `scripts/promote-floor.ts` is now a
shim over `packages/cli/src/promote.ts`, driven by `ds-library.json` — the
bespoke v0.3.2 promoter had NO source-alias pass, so recapturing without
migrating would have left every minted leaf anonymous. Result: contracts
v0.4.0, and the minted tree (`tokens/polaris-minted.dtcg.json`) carries
**179 DTCG aliases to Polaris's own `{p.*}` tokens**
(`imported.button.root.color.plain.none → {p.color-text-link}`), 1,174 literal
leaves, and exactly 1 named alias refusal (covering combos disagree:
`p.color-checkbox-icon-disabled` vs `p.color-text-brand-on-bg-fill` — kept
literal rather than guessed).

**Three general engine fixes this round forced** (each a latent class no flat
or alias-free library could reach, each proven byte-neutral for the others —
by re-promotion and the freshness gate, not by assumption):

1. **Reader var→leaf mapping vs nested DTCG groups** — `tokenGroup` prepend in
   `extract/computed/run.ts`; absent = byte-unchanged.
2. **Shared promote read the DTCG base as a flat map** — `tokenValue("p.…")`
   was `undefined`, silently zeroing the entire alias pass (pre-receipt break).
   Now flattens by walking; MUI/Carbon/Tailwind/Altitude re-promoted
   byte-identical.
3. **Alias-valued minted leaves crashed the provisional preamble and missed the
   token-sync target map** — `mintedPreamble` now emits a native
   `VARIABLE_ALIAS` to the real token variable with the resolved literal as
   named fallback (empty-file compile receipts exercise the fallback), and
   `compileTokenSetRows` spells alias TARGETS with the same dot→slash rule as
   base variable names (the exact sibling of the `7b02b42` base-name fix).

## Pipeline (all commands from repo root)

```bash
cd examples/polaris/.polaris-sandbox && npm ci && cd -   # the ONLY network step
npm run extract:computed -- --harness examples/polaris/.polaris-sandbox \
  --config extract/computed/configs/polaris.json --component <C>
                                                    # capture (double-run byte-identity REQUIRED)
npx tsx examples/polaris/scripts/promote-floor.ts   # shim → shared promote (ds-library.json):
                                                    # contracts v0.4.0 + minted tree + source-alias
                                                    # pass + resolution guard + statePreviews probe
npx tsx examples/polaris/generate.ts                # ALL surfaces: react, html, figma scripts,
                                                    # receipts (76 files; --check = byte-drift gate,
                                                    # run by the polaris-showcase-reproducible eval)
npx tsx packages/cli/src/cli.ts figma bundle examples/polaris/contracts \
  --tokens examples/polaris/tokens/polaris-light.dtcg.json,examples/polaris/tokens/polaris-minted.dtcg.json \
  --name Polaris --icons examples/polaris/assets/icons \
  --out examples/polaris/figma/polaris.bundle.json   # the ONE JSON a user pastes
```

**Freshness:** `scripts/figma-scripts-fresh.mjs` carries a real Polaris row
(via `generate.ts --check` — all 76 surfaces byte-compared, strictly wider than
the CLI-rebuild rows) since this round; the gate reports 6/6 libraries fresh,
zero named holes.

**Seeds vs promoted:** capture reads `extraction/static-contracts/` (the static
promotion's output — NOT the shared promote's output), so the
capture-seeds-are-not-promote-output gate holds for Polaris the same way it
holds everywhere (the dangling-ref trap, docs/23 §3.1).

**Canvas gate caveat (named):** `receipts/canvas-gate/` scorecards are the last
LIVE canvas measurement (v0.3.2 contracts, 7/10 PASS). The live re-run against
v0.4.0 requires the plugin on a real canvas — owner work, tracked in docs/23
§3.3.
