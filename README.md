<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
  <img alt="" src="docs/assets/logo-light.svg" width="96" height="58">
</picture>

# Design System Contracts

**A design system's source of truth should be neither the design file nor the code — but a machine-readable *contract* that sits between them and generates both.**

This repository is the working proof, and the candidate reference implementation for a vendor-neutral component contract specification. 51 component contracts and 282 DTCG tokens generate two surfaces — a typed React library and a native design-tool library — that are continuously proven to match the contracts by a three-way differ. Nothing is hand-maintained twice, and nothing pretends to be in sync when it isn't.

## Try it without cloning

**→ [ds-contracts-playground.pages.dev](https://ds-contracts-playground.pages.dev)**

The playground runs the repository's actual engine (`core/`) in your browser — no backend, no accounts, no analytics; credentials are session-only and never leave the browser:

- a gallery of live-emitted examples from the shipping contracts
- a governed contract editor — schema violations and generator refusals shown on screen, by name
- import a component from a **figma.com URL** (your token), with an honest degradation ladder when your plan gates the variables endpoint
- import code from a **public GitHub file URL** — the co-located stylesheet auto-discovered, every failure named
- paste **your own DTCG tokens** and watch every consumer rebind to them
- describe a component in a sentence and let Claude (your key) propose a contract the schema can refuse
- share any contract as a ~1 KB permalink

Both credential-gated paths — Figma URL import and prompt-to-contract — are live-verified against real endpoints ([MILESTONES.md](MILESTONES.md)).

## The model

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/contract-flow-dark.svg">
  <img alt="Workflow diagram: the contract sits between the design surface and the code surface. Generation flows outward from the contract to both surfaces; changes on either surface flow back into the contract as promotions, and the contract regenerates the other side. A three-way differ verifies all of it continuously. Surfaces never sync side-to-side." src="docs/assets/contract-flow-light.svg" width="920">
</picture>

Every organization that takes design systems seriously eventually splits into two camps. Some come in from the **code side**: the system is an npm package, and the design files are an aging picture of it. Others come in from the **design side**: the system is a canvas library, and the code is an approximation of the pictures. Both camps are answering the same question — *where does the truth live?* — and both answers fail the same way: whichever surface is declared canonical, the other becomes a hand-maintained copy. Copies drift. Drift erodes trust. Eroded trust is why design reviews turn into arguments about which surface is "right."

This project takes a third position: **the source of truth is neither surface.** Each component is defined once, in a small versioned JSON contract capturing everything design and engineering must agree on — props and their legal values, anatomy, token bindings, slot constraints, accessibility semantics, declared events. Both libraries are *renderers* of that contract: generated from it on the first pass, validated against it forever after.

The rule that makes it work: **surfaces never sync side-to-side.** An engineer's new prop and a designer's color change take the same path — flagged by the differ, promoted into the contract as a reviewable diff, then regenerated out to the other surface. One arbiter, version-controlled, no arbitration meetings. It's the governance model that made Git work for code and the DTCG token format work for design tokens, run one level up — at the component-API layer.

There's a second reason, and it's becoming the bigger one: **AI generation.** In this repo's A/B evaluation, an ungoverned agent building screens scored **69/100 adherence with 91 violations** — invented props, hard-coded colors, restyled components. The same model constrained by the compiled contract catalog scored **100/100 with zero violations**, and when it hit a real gap in the system, it *reported the gap* instead of faking around it. The gap became a contract proposal, the proposal became a version bump, and the score went back to 100. The contract isn't just how design and code stay aligned — it's how generation stays honest.

## What this proves

Every capability claim in this repository is backed by an executable check or a committed receipt — that's the house rule ([no capability claim without an eval behind it](CONTRIBUTING.md)). The dated log of what has been proven, in order, is **[MILESTONES.md](MILESTONES.md)**; release history is **[CHANGELOG.md](CHANGELOG.md)**. The standing claims and their mechanisms:

| Claim | Mechanism | Receipt |
|---|---|---|
| **Deterministic generation** | golden-output manifests, byte-compare — determinism proven against recorded output, not just against itself | `evals/golden.json` |
| **Refusal** | illegal contracts fail by name at build time, on both surfaces | C2 eval family |
| **Drift detection** | every claimed drift class has a failing test | C3 eval family |
| **Convergence** | promotion round-trips instead of ping-ponging | C4 eval family |
| **Honest AI generation** | catalog-governed 100/100 vs ungoverned 69/100, scored by a deterministic judge | [docs/10](docs/10-honest-generation.md) |
| **Round-trip identity** | this repo's own generated components re-extracted — code→contract and design→contract — match their shipping contracts with **zero mismatches**, both directions, red-tested | [`extract/ROUNDTRIP-CODE.md`](extract/ROUNDTRIP-CODE.md) · [`extract/figma/ROUNDTRIP.md`](extract/figma/ROUNDTRIP.md) · [`extract/figma/rest/ROUNDTRIP-REST.md`](extract/figma/rest/ROUNDTRIP-REST.md) |
| **Brownfield** | four unrelated design systems — Shoelace, Mantine, Eventz, CBDS — extracted and diagnosed, drift catalogued from real files | [`extract/pilots/`](extract/pilots/) |
| **Non-destructive sync** | in-place amend of live component sets: node IDs, property IDs, and instance overrides preserved through repeated passes, inside a foreign enterprise kit | CBDS pilot forensics ([`extract/pilots/cbds/`](extract/pilots/cbds/)) |
| **Theming** | a brand is a token-layer dimension, nothing else — adding one leaves every component byte-identical | `brand-added-token-layer-only` eval |
| **Engine as library** | the whole pipeline is browser-safe pure functions; CLI output golden-guarded through the refactor | `npm run core:browser-check` · [docs/15](docs/15-engine-as-library.md) |

All of it is gated by **59 executable checks** (`npm run eval`) that run the real pipeline in a scratch copy — not mocks.

## What's actually here

| Path | What it is | Edit by hand? |
|---|---|---|
| `contracts/` | **The source of truth.** 51 component contracts — buttons through banners, form fields, chat messages, navigation, progress meters, switches. APIs mirror a shipping industry component library ([coverage map](docs/research/astryx-coverage.md)) on this system's own tokens. | ✅ This is where changes happen |
| `tokens/` | 282 DTCG design tokens: primitives → **brand modes** (accent ramp + control radius per brand) → semantic aliases → light/dark mode files. One pipeline compiles them to CSS custom properties *and* design-tool variable collections. Adding a brand touches ONLY this directory — eval-proven. | ✅ |
| `core/` | **The engine as a library** — schema, token corpus, both extraction proposers, and four emitters (`react`, `html`, `react-inline`, `figma-script`) behind a pluggable `Emitter` interface. Browser-importable, zero node globals; the CLI scripts are thin shells over it. | ✅ |
| `src/components/` | The generated React library — typed, accessible, CSF3 stories, publishable package build. | ❌ Generated, never edited |
| `figma-sync/` | Generated, transport-agnostic scripts that build the canvas library — plus the **Sync Runner** dev plugin (`plugin/`) that executes them from disk. A from-blank rebuild of the entire library ran this way and verified clean. | ❌ Generated (`plugin/`, `arrange.js` hand-maintained) |
| `parity/` | The three-way differ: classifies every difference between contract, code, and canvas as *ahead*, *behind*, or *mismatched* — with a proposed remedy. Plus the adherence judge and the brownfield `diagnose` referee. | ✅ |
| `extract/` | Brownfield extraction: code→contract (React/TSX, CSS Modules, Custom Elements Manifest) and design→contract (plugin dump + Figma REST) adapters that propose **full contracts** — API, anatomy, and token bindings — plus the four pilot write-ups and the round-trip receipts. | ✅ |
| `catalog/` + `context/` | The compiled generation constraint (every API + every token + the governance rules) that an AI agent — or a human — can be held to, sharded to fit an agent's context window at any component count, plus the org rules and memory that feed it. | catalog ❌ · rules ✅ |
| `evals/` | 59 deterministic checks on the machinery itself: byte-identical regeneration against golden manifests, refusal of illegal contracts, detection of every claimed drift class, convergence after promotion, extraction round-trips. | ✅ |
| `playground/` | The public browser playground ([live](https://ds-contracts-playground.pages.dev)) — a Vite app importing `core/` unmodified. | ✅ |
| `dashboard/` | The **Contract Hub** — a local app visualizing the whole system: live component previews, per-prop binding maps across all three surfaces, token provenance, one-click parity runs, contract editing with regeneration, and the full docs. | ✅ |
| `docs/` | The working documents — start at [Getting Started](docs/00-getting-started.md). | ✅ |

## Quick start

Requires Node ≥ 20.

```bash
npm install
npm run build        # tokens → schema → all 51 components, validated against the contracts
npm run dashboard    # the Contract Hub → http://localhost:5180
npm run storybook    # the generated component library
```

Prove the loop to yourself in two minutes:

```bash
npm run parity   # ① clean — code, canvas, and tokens all match the contracts
# ② edit any contract in contracts/ — add an enum value, change a token binding
npm run build && npm run parity
#    ③ the differ reports exactly what is now behind, and how to fix it
npm run eval     # ④ 59 checks that detection, refusal, and convergence still hold
```

That honest red state in step ③ is the product. Most design-system tooling shows you the happy path; this one is built to tell you precisely when and where the surfaces have stopped agreeing. (Point a token binding at a token that doesn't exist and the *build itself* fails — the contract↔token integrity gate.)

## Try it with your own design system

The model isn't specific to these components, React, or any tool — and you can test that claim on **your** library:

```bash
npm run extract:code   # your components → schema-valid PROPOSED contracts (API, anatomy, token bindings)
npm run reconcile      # → the disagreement report: where your code and design libraries diverge
```

Code-side adapters ship for `react-tsx` (function components, forwardRef/memo, any props-type convention, defaults, `on*` events) with CSS Modules anatomy extraction, and `cem` (**any** library publishing a Custom Elements Manifest: Web Components, Lit, Shoelace-style systems). Design-side, a component imports from a figma.com URL (`npm run extract:figma:rest`) or a plugin dump. Adapters normalize into one shape, so everything downstream is framework-blind.

Field-tested against four systems this project doesn't own: **Shoelace** (59/59 components, reconciled against its community Figma kit — real kit rot found mechanically), **Mantine** (245 components, 1,691 props, <1s), **Eventz** (a complete brownfield pair: one team's real code library ⇄ its own hand-built design library), and **CBDS** (coexistence and in-place amend inside a foreign enterprise kit) — receipts in [`extract/pilots/`](extract/pilots/). Extraction proposes and reports; unbound or raw values are always reported with nearest-token candidates, never invented. Full walkthrough: [docs/13 — Try It With Your Own System](docs/13-try-it-with-your-system.md).

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

One file; two faithful renderings; a differ that can mechanically prove both. Composition (slots with `accepts` constraints, nested component refs), conditional parts (`visibleWhen`), declared events, icon assets, ARIA-by-prop, prop-driven elements and layout, and canvas state previews are all expressed the same way — see the [contract specification](docs/02-contract-spec.md).

## Toward a specification

The end state this project points at is a vendor-neutral, independently implementable **component contract specification** — doing for the component-API layer what the DTCG spec did for tokens — with this repository as its reference implementation and conformance suite.

That is a claim about the future, so it's held to the same standard as everything else: the **[roadmap](ROADMAP.md)** ([full version](docs/12-roadmap.md)) runs in four phases, each with a **falsifiable exit criterion** — from hardening the loop, through brownfield adoption, to a normative spec draft with a conformance kit, ending at the line that separates a format from a spec: *an implementation this repo's authors didn't write passes the conformance kit.* The schema groundwork — the concrete decisions weighed against A2UI, json-render, CEM, and native design-tool slot semantics, and the normative compatibility rules — is in [docs/08 — Composition & the Road to a Contributable Spec](docs/08-composition-and-spec.md).

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
11. [Brownfield Adoption](docs/11-brownfield-adoption.md) · connecting pre-existing design + code libraries — extraction, reconciliation, diagnostic-first
12. [Roadmap](docs/12-roadmap.md) · four phases toward a component contract spec, each with a falsifiable exit criterion
13. [Try It With Your Own System](docs/13-try-it-with-your-system.md) · extraction adapters, the design dump, and the disagreement report
14. [Questions & Objections](docs/14-questions-and-objections.md) · every hard question, asked the skeptic's way, answered with receipts
15. [The Engine Is a Library](docs/15-engine-as-library.md) · pure-function core, pluggable emitters, browser receipts
16. [Astryx Coverage Map](docs/research/astryx-coverage.md) · every component in a 93-component industry library: mirrored, gap-blocked, or behavior-bounded

## Honesty as a design principle

Not everything is expressible yet, and nothing here pretends otherwise:

- **Behavior is a declared boundary — drawn precisely.** Contracts own API, anatomy, tokens, semantics, and the *interaction surface*: declared events like `onToggle`, whose toggle + ARIA state are generated into code and whose presence the differ verifies. The canvas reflects events as description text — it cannot run behavior, and the docs say so. Everything richer (drag, typeahead, focus trapping) stays a hand-written layer by design, not omission.
- **Every absent component is attributed.** The coverage map accounts for an entire 93-component industry library: mirrored, blocked by a *named* schema gap, or behavior-bounded. Coverage has scaled with schema capability, not hand effort — each new schema feature has unlocked a cluster of components mechanically.
- **Degradation is named, never silent.** Canvas surfaces can't run CSS animations or bind SVG paint to variables, so generated canvas states document their limits; a Figma import on a plan without the variables API reports every unresolved binding by name with nearest-token candidates. Nothing is ever fabricated to look complete.

## Status

The model is validated end-to-end and running in public: generation into both surfaces, the parity loop executed in both directions with receipts, 59/59 evals, a measured 100-vs-69 governed-generation result, bidirectional anatomy extraction with zero-mismatch round-trip receipts, four brownfield pilots on systems this project doesn't own, in-place amend proven forensically on live files, and a launched browser playground running the same engine. The reference design-tool integration lives behind a transport-agnostic script boundary (`docs/internal/`) — the contract format itself is tool-agnostic.

- **What has been proven, dated, with receipts:** [MILESTONES.md](MILESTONES.md)
- **Release history:** [CHANGELOG.md](CHANGELOG.md)
- **Where this goes next:** [ROADMAP.md](ROADMAP.md)

## Contributing & license

MIT-licensed ([LICENSE](LICENSE)). Contributions follow one norm above all: [no capability claim without an eval behind it](CONTRIBUTING.md). Skeptical? Good — start with [Questions & Objections](docs/14-questions-and-objections.md).
