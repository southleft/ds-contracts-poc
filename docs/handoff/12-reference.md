---
title: "Reference — glossary, file map, cheat-sheet"
doc_id: 12-reference
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 12
prerequisites: [05-architecture, 06-tooling]
related: [09-testing-and-gates]
---

# Reference

## Glossary

- **Contract** — a schema-validated JSON document describing a component
  completely enough to generate both code and canvas. The single source of truth.
- **Anatomy** — `Record<string, Part>`; the tree of named parts. Can be
  **multi-root** (e.g. `{dialog, backdrop}`).
- **Part** — a node in the anatomy: `element`, `content`, `component` (nested
  instance ref), `slot`, `repeat`, nested `parts`, `tokens`, `layout`, `states`.
- **Binding** — a prop's dual mapping: `bindings.figma` (kind + property name) and
  `bindings.code` (prop name). Lets one contract drive both surfaces.
- **Emitter** — a deterministic transform `contract → files`. Four built-ins:
  `react`, `html`, `react-inline`, `figma-script`.
- **Engine** (`window.DSC` / `createFigmaEngine`) — the Figma-side compute:
  `parseIncomingText`, `planGenerate`, `compileComponentData`,
  `buildComponentScript`, `buildTokensScript`, `proposeDiff`, `specHashOf`.
- **Spec** — the compact per-component data (`compileComponentData` output, ~6KB).
- **Runtime** — the shared interpreter (~34KB) that turns a spec into nodes.
- **Dump** — a read-only capture of a Figma component set (the plugin's dump
  script), the input to `canvas → contract`.
- **Propose** — `dump → proposed contract` (a reviewable diff, not final code).
- **Mock** — `scripts/plugin-engine-mock-figma.mjs`, the headless Figma-API stand-
  in used to gate the plugin path. Faithful for structure, imperfect for
  rendering (see `08#2`).
- **Golden** — `evals/golden.json`, a byte-hash manifest of generated output.
- **Token (DTCG)** — a design token in `tokens/`; contracts reference `{dot.path}`.
- **Multi-root** — anatomy with more than one top-level part (no wrapping root).
- **Determinism** — the conversion is a pure, byte-reproducible function; no AI.
- **CONTRACTS-BUNDLE** — a `{type, version, contracts[]}` envelope for pushing
  multiple contracts to the plugin.

## Repo file map (the files that matter)

```
packages/schema/src/contract-schema.ts   the Zod schema (the format)
core/emitter.ts                           the emitter registry + interface
core/emit-react.ts                        React emitter + validateContract (the refusal gate)
core/emit-html.ts, emit-react-inline.ts   HTML / inline emitters
core/emit-figma-script.ts                 the Figma emit engine (createFigmaEngine)
core/index.ts                             the core barrel (browser-pure)
packages/cli/src/cli.ts                   the CLI (init/extract/generate/figma/diff/propose-pr)
figma-sync/plugin/engine/entry.ts         the plugin engine (window.DSC)
figma-sync/plugin/ui.html, code.js        the plugin UI + runner
figma-sync/plugin/GET-STARTED.md          plugin install + deterministic demo guide
figma-sync/plugin/PUBLISHING.md           Figma Community submission kit
scripts/plugin-engine-mock-figma.mjs      the headless Figma-API mock
scripts/plugin-engine-check.mjs           the plugin-engine gate
scripts/deterministic-roundtrip.mjs       the determinism proof
scripts/build-plugin-zip.mjs              plugin packager + engine drift guard
scripts/generate-figma.ts                 emit all figma-sync/*.js
evals/run.ts                              the 146-check suite
evals/golden.json                         byte-hash manifest
contracts/*.contract.json                 51 component contracts (the corpus)
tokens/ (+ modes/)                         DTCG tokens
examples/depth-composite/                 the advanced composite exhibit + harness
examples/depth-composite/DEPTH-BUILD-PROOF.md   reproducible advanced-composition proof
docs/handoff/                             THIS package
docs/DIFFICULTY-TIERS.md                  T0–T3 component difficulty tiers
```

## Command cheat-sheet

```bash
# Verify the whole pipeline (from a clean clone)
npm install
npm run eval                              # 146/146
npm run plugin:check                      # plugin engine green
node scripts/deterministic-roundtrip.mjs  # determinism proof (no AI)
node scripts/core-browser-check.mjs       # core is browser-pure
npx tsc --noEmit                          # types

# contract → code
npx tsx packages/cli/src/cli.ts generate contracts/badge.contract.json --out /tmp/out --target react --stories

# contract → canvas scripts (deterministic)
npm run figma:plan                        # emits figma-sync/*.js

# build the plugin package
node scripts/build-plugin-zip.mjs         # + --update-engine-receipt only when core changed

# code → contract / round-trip
npm run extract:code
npm run roundtrip:code

# canvas → contract (needs a Figma dump)
npm run extract:figma

# regenerate golden (reviewed changes only)
npm run golden:update
```

## The deterministic contract→canvas demo (for a human, in Figma)

1. Import the plugin (dev): Plugins → Development → Import plugin from manifest →
   `figma-sync/plugin/manifest.json` (or the unzipped zip).
2. Fresh blank file → run **DS Contracts Sync Runner** → **Generate**.
3. Paste `examples/depth-composite/composite-modal.contract.json` (or
   `contracts/badge.contract.json` for a simple one).
4. "Sync token variables first" checked → **Generate in this file**.
5. It builds deterministically. (Individual components work; the composite has
   known live rendering bugs — see `08`.)

## Contacts / provenance

- Repo: `github.com/southleft/ds-contracts-poc` (PUBLIC, MIT).
- Owner: Southleft founder (joining Figma). Direction: 100% open source, never
  monetized; an official open component spec; determinism-only.
- This handoff package written 2026-07-21, grounded in the live codebase.

---

You have now read the full package. If you continue the work: start at
`08-status-what-doesnt-work.md` and `11-roadmap.md`, keep every gate in `09`
green, and never violate `03-determinism.md`.
