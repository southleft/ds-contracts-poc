# DS Contracts PoC

**Proof of concept: a machine-readable component contract as the single source of truth for a design system — sitting between the Figma canvas and the codebase, generating and validating both.**

Neither the canvas nor the code is the canonical source. The contract is. Figma and React are two *renderers* of the same governed definition, and changes on either side are **promoted into the contract** rather than synced side-to-side.

## The 60-second version

```
                    ┌───────────────────────────┐
                    │        contracts/          │
                    │  *.contract.json  (SoT)    │
                    │        tokens/             │
                    │  *.tokens.json    (DTCG)   │
                    └──────┬──────────────┬──────┘
              npm run build│              │figma-console MCP (phase 2)
                           ▼              ▼
              ┌────────────────┐   ┌────────────────────┐
              │  Code side      │   │  Figma side         │
              │  React + CSS    │   │  Variables (modes)  │
              │  Modules +      │   │  Component sets     │
              │  Storybook      │   │  (variants, props)  │
              └───────┬─────────┘   └─────────┬──────────┘
                      │                       │
                      └──── parity check ─────┘
                         drift → contract PR (phase 3)
```

- A **contract** (`contracts/button.contract.json`) declares a component's canonical API: props, allowed values, states, anatomy, token bindings, accessibility requirements — plus explicit **bindings** describing how each prop manifests in Figma (variant properties) and in code (React props).
- **Tokens** (`tokens/*.tokens.json`, DTCG format) are the aesthetic half of the contract. Light/dark live as mode files.
- `npm run build` regenerates everything downstream: CSS custom properties, React components, CSS Modules, and Storybook stories. **Generated files are never edited by hand.**
- Phase 2 generates the same contracts into Figma (variables + component sets) via the [Figma Console MCP](https://docs.figma-console-mcp.southleft.com/). Phase 3 closes the loop with drift detection and contract promotion.

## Quickstart

Requires Node ≥ 20.

```bash
npm install
npm run build        # tokens → CSS, schema → JSON Schema, contracts → components
npm run storybook    # browse the generated components at http://localhost:6006
npm run parity       # three-surface drift report (code / Figma / tokens vs contract)
npm run eval         # 16-case validation suite → evals/results.json
```

Try the loop: edit `contracts/button.contract.json` (add a value to the `size` enum, or point a token binding at a different token), run `npm run build`, and watch the component, its styles, and its stories update. Point a binding at a token that doesn't exist and the build **fails** — that's the contract↔token integrity gate.

## Repository map

| Path | What it is | Edit by hand? |
|---|---|---|
| `contracts/*.contract.json` | **The source of truth.** One contract per component. | ✅ Yes — this is where changes happen |
| `contracts/contract.schema.json` | JSON Schema for contracts (generated from Zod) | ❌ Generated |
| `tokens/` | DTCG design tokens: primitives, semantics, per-mode files | ✅ Yes |
| `scripts/contract-schema.ts` | The contract schema, defined in Zod | ✅ Yes (schema evolution) |
| `scripts/build-tokens.mjs` | Zero-dependency token build: tokens → CSS custom properties | ✅ Yes |
| `scripts/generate-components.ts` | The generator: contracts → React + CSS Modules + stories | ✅ Yes |
| `src/styles/tokens*.css` | Generated CSS custom properties (`:root` + `[data-theme="dark"]`) | ❌ Generated |
| `src/components/` | Generated components, styles, stories | ❌ Generated |
| `.storybook/` | Storybook 10 config + theme (light/dark) toolbar | ✅ Yes |
| `figma-sync/` | Generated Plugin API scripts (contract → Figma), transport-agnostic | ❌ Generated (`npm run figma:plan`) |
| `parity/` | The diagnostic loop: extractors, three-way differ, snapshots | ✅ Yes (snapshots refreshed by tooling) |
| `docs/` | The full documentation set — start at `01-architecture.md` | ✅ Yes |

## Documentation

1. [Architecture & the contract model](docs/01-architecture.md) — the thesis, the promotion flow, what each phase proves
2. [Contract specification](docs/02-contract-spec.md) — every field, with examples
3. [Token pipeline](docs/03-token-pipeline.md) — DTCG dialect decisions, modes, the Style Dictionary build
4. [Code generation](docs/04-code-generation.md) — what gets emitted and how to add a component
5. [Figma sync](docs/05-figma-sync.md) — the MCP-driven design side: setup, generation, fidelity scope
6. [The parity loop](docs/06-parity-loop.md) — drift detection, promotion flow, and the executed two-direction demo
7. [Validation](docs/07-validation.md) — claims → evals → evidence (16/16 passing), live round-trip results, and the designed AI-adherence eval

## Status — all three phases executed

**Phase 1 ✅** contract → code generation with token integrity checking, visualized in Storybook.
**Phase 2 ✅** contract → Figma generation: variable collections (Light/Dark modes, aliases, scopes, codeSyntax) and component sets, in [DS Contracts POC](https://www.figma.com/design/8nim1d0IPnehMxA7B7SYxC/DS-Contracts-POC); anchors written back into the contracts.
**Phase 3 ✅** the parity loop (`npm run parity`): three-way drift detection with promotion patches, proven in both directions — a hand-added code prop promoted into the contract and pushed to Figma, and a designer's Figma token change promoted into `tokens/` and rebuilt into CSS. See [docs/06-parity-loop.md](docs/06-parity-loop.md) for the evidence trail.
**Validation ✅** 16/16 deterministic evals (`npm run eval`) covering determinism, refusal of invalid states, ten drift classes, and promotion convergence — plus a live Figma token round-trip verified lossless (92 tokens, zero diff). See [docs/07-validation.md](docs/07-validation.md).
