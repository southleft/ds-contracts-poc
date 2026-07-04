# Design System Contracts

**A proof of concept that a design system's source of truth should be neither the design file nor the code — but a machine-readable *contract* that sits between them and generates both.**

50 components. 264 tokens. Two surfaces — a working React library and a native design-tool library — generated from the same JSON files and continuously proven to match them by a three-way differ. Nothing is hand-maintained twice, and nothing pretends to be in sync when it isn't.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/contract-flow-dark.svg">
  <img alt="Workflow diagram: the contract sits between the design surface and the code surface. Generation flows outward from the contract to both surfaces; changes on either surface flow back into the contract as promotions, and the contract regenerates the other side. A three-way differ verifies all of it continuously. Surfaces never sync side-to-side." src="docs/assets/contract-flow-light.svg" width="920">
</picture>

## Why this exists

Every organization that takes design systems seriously eventually splits into two camps. Some come in from the **code side**: the system is an npm package, and the design files are an aging picture of it. Others come in from the **design side**: the system is a canvas library, and the code is an approximation of the pictures. Both camps are answering the same question — *where does the truth live?* — and both answers fail the same way: whichever surface is declared canonical, the other becomes a hand-maintained copy. Copies drift. Drift erodes trust. Eroded trust is why design reviews turn into arguments about which surface is "right."

This project takes a third position: **the source of truth is neither surface.** Each component is defined once, in a small versioned JSON contract capturing everything design and engineering must agree on — props and their legal values, anatomy, token bindings, slot constraints, accessibility semantics. Both libraries are *renderers* of that contract: generated from it on the first pass, validated against it forever after.

The rule that makes it work: **surfaces never sync side-to-side.** An engineer's new prop and a designer's color change take the same path — flagged by the differ, promoted into the contract as a reviewable diff, then regenerated out to the other surface. One arbiter, version-controlled, no arbitration meetings. It's the governance model that made Git work for code and the DTCG token format work for design tokens, run one level up — at the component-API layer.

There's a second reason, and it's becoming the bigger one: **AI generation.** In this repo's A/B evaluation, an ungoverned agent building screens scored **69/100 adherence with 91 violations** — invented props, hard-coded colors, restyled components. The same model constrained by the compiled contract catalog scored **100/100 with zero violations**, and when it hit a real gap in the system, it *reported the gap* instead of faking around it. The gap became a contract proposal, the proposal became a version bump, and the score went back to 100. The contract isn't just how design and code stay aligned — it's how generation stays honest.

## What's actually here

| Path | What it is | Edit by hand? |
|---|---|---|
| `contracts/` | **The source of truth.** 50 component contracts — buttons through banners, form fields, chat messages, navigation, progress meters, switches. APIs mirror a shipping industry component library ([coverage map](docs/research/astryx-coverage.md)) on this system's own tokens. | ✅ This is where changes happen |
| `tokens/` | 264 DTCG design tokens: primitives → semantic aliases → light/dark mode files. One pipeline compiles them to CSS custom properties *and* design-tool variables. | ✅ |
| `src/components/` | The generated React library — typed, accessible, CSF3 stories, publishable package build. | ❌ Generated, never edited |
| `figma-sync/` | Generated, transport-agnostic scripts that build the canvas library: variant sets, bound variables, slot properties, mode-aware theming. | ❌ Generated |
| `parity/` | The three-way differ: classifies every difference between contract, code, and canvas as *ahead*, *behind*, or *mismatched* — with a proposed remedy. | ✅ |
| `catalog/` + `context/` | The compiled generation constraint (every API + every token + the governance rules) that an AI agent — or a human — can be held to, plus the org rules and memory that feed it. | catalog ❌ · rules ✅ |
| `evals/` | 26 deterministic checks on the machinery itself: byte-identical regeneration, refusal of illegal contracts, detection of every claimed drift class, convergence after promotion. | ✅ |
| `dashboard/` | The **Contract Hub** — a local app visualizing the whole system: live component previews, per-prop binding maps across all three surfaces, token provenance, one-click parity runs, contract editing with regeneration, and the full docs. | ✅ |
| `docs/` | The working documents — start at [Getting Started](docs/00-getting-started.md). | ✅ |

## Quick start

Requires Node ≥ 20.

```bash
npm install
npm run build        # tokens → schema → all 50 components, validated against the contracts
npm run dashboard    # the Contract Hub → http://localhost:5180
npm run storybook    # the generated component library
```

Prove the loop to yourself in two minutes:

```bash
npm run parity   # ① clean — code, canvas, and tokens all match the contracts
# ② edit any contract in contracts/ — add an enum value, change a token binding
npm run build && npm run parity
#    ③ the differ reports exactly what is now behind, and how to fix it
npm run eval     # ④ 26 checks that detection, refusal, and convergence still hold
```

That honest red state in step ③ is the product. Most design-system tooling shows you the happy path; this one is built to tell you precisely when and where the surfaces have stopped agreeing. (Point a token binding at a token that doesn't exist and the *build itself* fails — the contract↔token integrity gate.)

## How a contract reads

```jsonc
// contracts/banner.contract.json (excerpt)
{
  "id": "ds.banner",
  "props": [{
    "name": "status",
    "type": { "enum": ["info", "success", "warning", "error"] },
    "default": "info",
    "bindings": {
      "figma": { "kind": "VARIANT", "property": "Status" },   // → a 4-option variant axis
      "code":  { "prop": "status" }                            // → a typed union prop
    }
  }],
  "anatomy": {
    "root": {
      "tokens": { "background-color": "{color.feedback.{status}.background}" }
      //           → one CSS class per value     → one bound variable per variant
    }
  }
}
```

One file; two faithful renderings; a differ that can mechanically prove both. Composition (slots with `accepts` constraints, nested component refs, parent→child prop mapping), conditional parts (`visibleWhen`), icon assets, ARIA-by-prop, and number-driven progress meters are all expressed the same way — see the [contract specification](docs/02-contract-spec.md).

## Documentation

1. [Getting Started — What, Why, and How](docs/00-getting-started.md) · the five-minute orientation, per-persona usage, and the workflow schematic
2. [The Bridge — Why This Exists](docs/00-the-bridge.md) · the narrative case
3. [Architecture & the Contract Model](docs/01-architecture.md) · generative-first, diagnostic-forever
4. [Contract Specification](docs/02-contract-spec.md) · every field, with examples
5. [Token Pipeline](docs/03-token-pipeline.md) · DTCG dialect, modes, zero-dependency build
6. [Code Generation](docs/04-code-generation.md) · what gets emitted, and how to add a component
7. [The Parity Loop](docs/06-parity-loop.md) · drift detection and the executed both-directions demo
8. [Validation — Claims, Evals, Evidence](docs/07-validation.md) · what's proven and how
9. [Composition & the Road to a Contributable Spec](docs/08-composition-and-spec.md)
10. [Honest Generation](docs/10-honest-generation.md) · the catalog, the deterministic judge, and the 100-vs-69 A/B result
11. [Brownfield Adoption](docs/11-brownfield-adoption.md) · the plan for connecting pre-existing design + code libraries — extraction, reconciliation, diagnostic-first
12. [Astryx Coverage Map](docs/research/astryx-coverage.md) · every component in a 93-component industry library: mirrored, gap-blocked, or behavior-bounded

## Honesty as a design principle

Not everything is expressible yet, and nothing here pretends otherwise:

- **Behavior is a declared boundary.** Contracts own API, anatomy, tokens, and semantics. Interactive behavior (open/close, drag, typeahead) is a hand-written layer beside the generated shells — by design, not omission.
- **Every absent component is attributed.** The coverage map accounts for an entire 93-component industry library: mirrored, blocked by a *named* schema gap, or behavior-bounded. Coverage has scaled with schema capability, not hand effort — each new schema feature has unlocked a cluster of components mechanically.
- **Fidelity limits are documented**, never papered over: canvas surfaces can't run CSS animations, bind SVG paint to variables, or restyle on a boolean — so the generated canvas state is the contract's *default* state, and the docs say exactly that.

## Status

A working proof of concept, validated end-to-end: generation into both surfaces, the parity loop run in both directions with receipts, 26/26 evals, and a measured 100-vs-69 governed-generation result. The reference design-tool integration lives behind a transport-agnostic script boundary (`docs/internal/`) — the contract format itself is tool-agnostic, and the road to a contributable spec is sketched in [docs/08](docs/08-composition-and-spec.md).
