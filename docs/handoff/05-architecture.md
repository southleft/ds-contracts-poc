---
title: "Architecture — how it is built"
doc_id: 05-architecture
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 5
prerequisites: [00-readme, 01-concept, 03-determinism]
related: [06-tooling, 09-testing-and-gates, 12-reference]
---

# Architecture

All facts below were verified against the codebase on 2026-07-21.

## Repository shape (npm workspaces)

- Root package is `private` (the PoC / reference implementation).
- `packages/schema/` — `@ds-contracts/schema` — the Zod contract schema (source of
  truth for the format). `scripts/contract-schema.ts` is a re-export shim over
  `packages/schema/src/contract-schema.ts` so repo code and the CLI share it.
- `packages/cli/` — `@ds-contracts/cli` (bin: `ds-contracts`) — the deterministic
  CLI, esbuild-bundled from the core barrel.
- `packages/emitter-web-components/` — `@ds-contracts/emitter-web-components` — a
  vanilla Web Components emitter (built; not yet published).
- `core/` — the engine: emitters, extractors, token resolution, the Figma
  emit engine. Verified browser-pure/bundleable (`scripts/core-browser-check.mjs`).
- `figma-sync/plugin/` — the Figma plugin (DS Contracts Sync Runner). The engine
  is bundled into `window.DSC` at package time.
- `contracts/` — 51 component contracts (the primary test corpus).
- `tokens/` — DTCG tokens: `primitives.tokens.json`, `semantic.tokens.json`, and
  `tokens/modes/` (`semantic.light`, `semantic.dark`, `brand.default`,
  `brand.aurora`).
- `evals/` — the 146-check suite (`run.ts`) + golden manifest (`golden.json`).
- `examples/depth-composite/` — the advanced composite exhibit + its harness.
- `docs/handoff/` — this package.

## The contract schema (`@ds-contracts/schema`)

A `Contract` (Zod-validated) has these top-level fields:
`id, name, version, status, props, anatomy, tokens, states, semantics, a11y,
anchors, figma, modes, literals, figmaStatePreviews`.

Key sub-schemas (exported): `TokenRefSchema`, `PropSchema`, `LayoutSchema`,
`VariantLayoutSchema`, `LayoutByPropSchema`, `TokensByPropSchema`,
`LiteralsByPropSchema`, `DeclaredValueSchema`, `StylesWhenSchema`,
`OverlaySchema`, `ShapeSchema`, `RepeatSchema`, `VisibleWhenSchema`.

The concepts you must understand:

- **`anatomy` is `Record<string, Part>`** — a map of top-level parts, so a
  component can be **multi-root** (e.g. a Modal is `{ dialog, backdrop }` with no
  wrapping root). A `Part` may have: `element` (native tag), `content`
  (`{ prop }` or literal text), `component` (a nested instance ref to another
  contract by `id`, with `props`), `slot` (named, with `accepts`), `repeat`
  (a template repeated over an `arrayOf` prop, with an observed `sample`),
  nested `parts`, `tokens`, `layout`, `states`, `visibleWhen`.
- **Props carry dual bindings**: `bindings.figma` (`kind`: VARIANT | TEXT |
  BOOLEAN | INSTANCE_SWAP | NONE, plus `property` name) and `bindings.code`
  (`prop` name). This is what lets one contract drive both surfaces.
- **Tokens** are DTCG; contracts reference them as `{group.name}`; the emitters
  resolve them (variables on the Figma side, CSS custom properties in code).
- **Composition channels**: `component` (a fixed nested instance), `repeat +
  component` (a repeated collection), `slot + accepts` (an INSTANCE_SWAP slot).

## The emitters (`core/emitter.ts` + `core/emit-*.ts`)

A registry of `Emitter { name, emit(contract, ctx) → files[] }`. Four built-ins:

| Export | `name` | Output |
|--------|--------|--------|
| `reactEmitter` | `react` | React component + CSS Module |
| `htmlEmitter` | `html` | static HTML + CSS (live-preview surface) |
| `reactInlineEmitter` | `react-inline` | React with resolved-literal inline styles |
| `figmaScriptEmitter` | `figma-script` | a Figma Plugin-API script that builds the set |

`registerEmitter()` makes the registry extensible; consumers iterate `emitters`
generically (the playground, `emitters:check`, the browser check light up
automatically). `validateContract` (in `core/emit-react.ts`) is the shared
refusal gate — it refuses invalid/unresolvable contracts *by name*.

## The Figma emit engine (`core/emit-figma-script.ts`)

`createFigmaEngine(ctx)` returns
`{ buildTokensScript, compileComponentData, buildComponentScript, buildBatchScript }`:

- `buildTokensScript(fileKey)` → a script that upserts the variable collections
  (Primitives / Brand / Semantic with modes). Run **first** on a fresh file.
- `compileComponentData(contract)` → a compact **spec** (the anatomy + bindings
  as data; ~6KB for the composite). This is the deterministic per-component data.
- `buildComponentScript(...)` → the spec + a shared **runtime** (the interpreter:
  `findComponentByName`, `setInstanceProps`, node building, variable binding).
  The runtime is ~34KB and largely identical across components; the data is the
  small part. (This split matters for the roadmap — see `11`.)

`emitFigmaScript(contract, ctx)` is the emitter wrapper over
`buildComponentScript`. The plugin runs these scripts. `figma.createNodeFromSvg`
is used for icon glyphs (this is where a real bug lived — see `08`/`10`).

## The plugin engine (`window.DSC`, `figma-sync/plugin/engine/entry.ts`)

The engine barrel is bundled (browser-pure IIFE, ~0.42MB minified) with the
repo's baked tokens/contracts/icons and injected into the packaged `ui.html` at
build time, landing on `window.DSC`. It is **pure compute** — contract text in,
plain-words reports and Plugin-API script text out; it never touches the `figma`
global. `code.js` executes the scripts. Public methods (used by the UI and the
headless harness): `parseIncomingText`, `planGenerate`, `proposeDiff`,
`specHashOf`, `updatePlan`, `updateApplySteps`, `prDryRunLines`,
`inventoryScriptSource`. A drift-guard receipt (`engine.receipt.json`) refuses a
stale bundle by name.

## The headless mock (`scripts/plugin-engine-mock-figma.mjs`)

A faithful mock of the Figma Plugin API used to run the engine's scripts in a
Node VM with **no Figma and no network**. It is how the plugin path is gated
headlessly. **Its fidelity is load-bearing and imperfect** — a lenient
`createNodeFromSvg` let a real bug through (fixed 2026-07-21; the mock now
validates SVG). See `08` for its known blind spots.

## The CLI (`@ds-contracts/cli`, bin `ds-contracts`)

Verbs (verified in `packages/cli/src/cli.ts`): `init`, `extract`, `generate`,
`figma` (+ `figma push`), `diff`, `propose-pr`. Deterministic; esbuild-bundled
from the core barrel. See `06-tooling.md` for usage.

## Extractors (design→code / code→design capture)

- **code → contract**: `extract:code` / `roundtrip:code` (react-tsx + CEM
  adapters).
- **canvas → contract**: a Figma "dump" (the plugin's dump script /
  `dump.plugin.js`) → `proposeBatchFromDump` / `proposeDiff` → a proposed
  contract. Session-linked by componentSetKey (rename-safe), mints provisional
  `imported.*` tokens for unmapped observed values.

## The tokens layer

DTCG JSON, resolved by the emitters. On the Figma side, `buildTokensScript`
creates variables (Primitives mode "Value"; Brand one mode per brand; Semantic
modes Light/Dark aliasing primitives and brand). In code, tokens become CSS
custom properties. Contracts bind parts to tokens by `{dot.path}`.

Continue to `06-tooling.md`.
