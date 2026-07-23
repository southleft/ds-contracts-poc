# Astryx — the developer journey, end to end

**Make it real on a fresh system.** This directory runs the full *developer
journey* on a real, third-party design system — **Astryx**, Meta's
open-source system (`@astryxdesign/core@0.1.6`, MIT) — starting from nothing
but the npm package and ending in runnable React + Storybook and a
Figma-ready sync bundle.

The genesis goal: **Astryx ships no official Figma kit** as of 0.1.6 (see
`PROVENANCE.md`). The contracts extracted here become the seed a future bridge
run compiles into a blank Figma file = the **first Astryx Figma library**.

```
npm package ──▶ contracts ──▶ React + CSS + Storybook stories
(@astryxdesign    (10 flagship        (examples/astryx/storybook — npm i && npm run storybook)
 /core@0.1.6)      .contract.json)
                       │
                       └──▶ Figma-ready sync scripts (genesis prep)
                            (examples/astryx/figma — a bridge run builds the first kit)
```

## Honest fidelity scope — read this first

This round is the developer-journey **mechanics** + genesis-ready artifacts
using **CODE-SIDE extraction** (the public API + StyleX/code token bindings).
It is **structural truth + token bindings, NOT pixel-perfect styling.**

- **Real:** component names, prop names, enum values, variant grids, token
  *names* and *values* (the StyleX `light-dark()` wrap, light + dark), the
  code anchor (`@astryxdesign/core` exports), and the Figma variant counts.
- **Not yet real:** exact paddings/sizes/geometry from Astryx's compiled
  StyleX atomic classes; native a11y hosts (Checkbox/Switch/Slider/TextInput
  render as styled boxes, not native `<input>`/`<progress>`); live geometry
  (ProgressBar `value` does not yet drive the fill width).

That pixel-fidelity pass is **Astryx Phase A-2** — the computed-floor,
real-browser computed-style capture — gated on the depth build freeing
`extract/computed`. Phase A-2 will add: exact per-variant paddings/sizes from
computed styles, native-host a11y semantics, and live-geometry bindings.

## The four legs

### 1 · npm package → contracts (promotion)

`PROVENANCE.md` pins the subject; Phase A already extracted 24/24 census
components at 65% median facts-carried (`extraction/CENSUS.md`,
`extraction/proposals.md`, `extraction/static-contracts/`). This round
**promotes** 10 flagship proposals to committed contracts:

| contract | census facts | contract | census facts |
|---|---|---|---|
| Button | 70% | Card | 17% (13-value `keyof` recovery) |
| Badge | 33% (14-value `keyof`) | Token (Tag/Chip) | 82% |
| Banner | 56% | **ProgressBar** | **89% (richest)** |
| CheckboxInput | 74% | TextInput | 83% |
| Switch | 80% | Slider | 82% (union-of-refs recovery) |

Promotion (`contracts/PROMOTION.md`) is the human-owned step: props verbatim
on the structural/visual axes, string defaults added for required text props,
anatomy authored with StyleX token bindings. **Dropped props are named per
contract** (HTML passthrough, link-mode, cross-file a11y text, ReactNode
slots). 42 props promoted verbatim + 3 declared materializations, 49 named
drops, **0 invented** — proven by the `.doc.mjs` cross-check below.

### 2 · contracts → React + Storybook

The **local `ds-contracts` CLI build** runs the shipping generator:

```bash
# build the CLI once
node packages/cli/build.mjs

# generate React + CSS Modules + CSF3 stories (the fixture's own script does this)
cd examples/astryx/storybook
npm run tokens      # StyleX DTCG → src/tokens.css (186 light + 79 dark overrides)
npm run generate    # ds-contracts generate ../contracts --out src/generated
                    #   --target react --tokens ../tokens/astryx.dtcg.json --stories
npm i && npm run storybook   # SEE the Astryx components
```

`examples/astryx/storybook/` is a runnable Storybook fixture (the
`evals/fixtures/storybook-skeleton` layout: its own `package.json`,
`.storybook/main.ts` glob over `src/generated/**/*.stories.tsx`, and
`src/tokens.css`). The 10 components are committed generated.

**What booted** (`receipts/storybook/RENDER-PROOF.md`, self-contained — no
network install): the `render-proof.ts` harness (the `journey-engineer` eval
pattern) esbuild-bundles all ten CSF story modules and renders each in a real
headless Chromium with `tokens.css` inlined:

- **10/10 components mount**, all CSF titles present;
- StyleX token bindings resolve to published values — Button primary
  background = `color-accent` `rgb(0, 100, 224)` (#0064E0), ProgressBar track
  = `color-track` `rgb(204, 211, 219)` (#CCD3DB).

### 3 · contracts → Figma-ready (genesis prep)

```bash
ds-contracts figma examples/astryx/contracts --out examples/astryx/figma \
  --tokens examples/astryx/tokens/astryx.dtcg.json,examples/astryx/tokens/astryx-minted.dtcg.json
```

→ 10 Figma Plugin API sync scripts (`examples/astryx/figma/*.figma.js`). A
future bridge run builds these into a blank Figma file = the first Astryx
kit. **No live canvas is driven here** (owner + bridge later).

**Compile receipt** (`receipts/figma/COMPILE-RECEIPT.md`): each script is
proven two ways — (1) **referee**: the emitted `COMPONENTS` payload
(createFigmaEngine's build product) parses and its set identity + variant grid
match the contract axes; (2) **headless execute**: the whole script runs to
completion in a VM against the mocked `figma` global (the `plugin-engine-check`
pattern), token variables pre-seeded, no network. **104 variants across 10
sets** compile: Badge 14, Banner 8, Button 12, Card 13, CheckboxInput 2,
ProgressBar 5, Slider 6, Switch 2, TextInput 9, Token 33.

> Named limit: Astryx's StyleX tokens are **literal**, not aliases into a
> primitive layer; the engine's alias-based `buildTokensScript` doesn't yet
> emit a token-sync script for a literal set. The genesis bundle still needs a
> literal-variable token sync (the plugin/bridge creates these; the receipt
> seeds them directly). A literal-token `buildTokensScript` path is follow-up.

### 4 · the independent witness — Meta's own `.doc.mjs`

Meta ships a machine-readable props+anatomy table per component *inside* the
package (`<Name>.doc.mjs`). Phase A ran that witness against the whole census
(`extraction/DOC-REFEREE.md`): **246 vendor-documented props, 0 silent
losses** — every documented prop was carried or receipted by name.

The flagship cross-check (`receipts/doc/FLAGSHIP-CROSSCHECK.md`, rebuild:
`node examples/astryx/scripts/flagship-doc-crosscheck.mjs`) ties the promotion
back to that witness: every promoted prop is verbatim from the
`.doc.mjs`-witnessed proposal or a declared materialization — **0 invented
API**, every drop named.

## Reproduce on a fresh system

```bash
# from the repo root
node packages/cli/build.mjs                                   # build the CLI

# leg 2 — code
npx tsx examples/astryx/scripts/build-storybook-tokens.ts     # tokens.css
node packages/cli/dist/cli.js generate examples/astryx/contracts \
  --out examples/astryx/storybook/src/generated --target react \
  --tokens examples/astryx/tokens/astryx.dtcg.json,examples/astryx/tokens/astryx-minted.dtcg.json --stories
npx tsx examples/astryx/scripts/render-proof.ts               # render receipt

# leg 3 — figma
node packages/cli/dist/cli.js figma examples/astryx/contracts \
  --out examples/astryx/figma --tokens examples/astryx/tokens/astryx.dtcg.json,examples/astryx/tokens/astryx-minted.dtcg.json
node examples/astryx/scripts/figma-compile-receipt.mjs        # compile receipt

# leg 4 — witness
node examples/astryx/scripts/flagship-doc-crosscheck.mjs

# and the standing gate
npm run eval    # 138/138, incl. the astryx-dev-journey pin
```

## Gate: `astryx-dev-journey` (evals/run.ts)

Self-contained, no network/sandbox: the 10 flagship contracts generate
**byte-stable** across two runs of the same generator `npm run generate` uses,
and the committed `badge.figma.js` **compiles** (referee: the `COMPONENTS`
payload parses to the Badge set with the 14-tone variant grid). Part of the
138/138 suite.
