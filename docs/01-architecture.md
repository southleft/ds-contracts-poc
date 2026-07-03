# 1 · Architecture & the Contract Model

## The problem this PoC exists to settle

Every design system team eventually argues about where the canonical source of truth lives: the Figma library or the code library. Both answers are wrong in the same way — each leaves the other side as a hand-maintained copy that drifts. Developers outnumber designers, so code accumulates decisions design never signed off on; design files freeze into snapshots of intent that stop being true.

The position this PoC takes: **the source of truth is neither surface. It's a machine-readable contract that sits between them.** The Figma library and the React library are both *renderers* of the contract — generated from it on first pass, validated against it forever after.

This isn't a novel claim (see the spring 2026 essays from izaias, TJ Pitre, and Cristian Morales Achiardi converging on it), but nobody has shipped it: every existing artifact makes one side primary. Custom Elements Manifest, Storybook manifests, and story.to.design are code-first. Supernova and the EightShapes Specs plugin are Figma-first. Subframe and Knapsack own both ends and are proprietary. The token layer is the exception — the DTCG format proved a neutral, Git-versioned, tool-agnostic artifact can govern both sides. **This PoC runs the DTCG playbook one level up, at the component-API layer.**

## The model: generative first, diagnostic forever after

Two prior architectures compete in the literature:

- **Compile-forward** (izaias): the contract is generative; everything downstream is regenerated; Figma is demoted to a renderer. Clean, but has no answer for when code legitimately gets ahead of design.
- **Reconcile-bidirectionally** (the diagnostic layer): both artifacts stay live; tooling diffs and repairs. Honest about reality, but under-specified about *arbitration* — when design and code disagree, who wins, by what rule?

This PoC is a deliberate hybrid:

1. **First pass is generative.** The contract compiles both sides. Code side: React components, CSS Modules, CSF3 stories (`npm run build`, working today). Figma side: variables with modes/aliases and component sets with variant properties (phase 2, via the Figma Console MCP).
2. **Steady state is diagnostic.** Both surfaces are live and humans edit them. Parity tooling reads each side back into contract-shaped data and diffs both against the contract (phase 3).
3. **The arbitration rule:** neither side ever syncs directly to the other. **A change on either side is a *proposal* to the contract.** Drift detection produces a contract diff; a human accepts it as a contract PR; merging regenerates the *other* side.

```
  code change ──extract──▶ contract diff ──PR + review──▶ contract ──generate──▶ Figma
  Figma change ──extract──▶ contract diff ──PR + review──▶ contract ──generate──▶ code
```

The contract wins not because it's sacred but because **it is the only place a change becomes canonical.** A developer adding a prop and a designer adding a variant go through the same door: a reviewable, versionable, diffable change to a JSON file in Git. That's what "keep both sides honest" looks like as a mechanism instead of a slogan.

### Why the style mapping lives in the contract

A subtle failure mode in contract-first proposals: if the contract declares `variant: primary | secondary` but a handwritten "resolver" maps those values to styles, drift hasn't been eliminated — it's moved into the resolver. So in this PoC, the contract's **anatomy** section binds each named part directly to design token references (`"background-color": "{color.action.{variant}.background}"`), and the CSS Module is *generated* from those bindings. There is no handwritten style layer to drift. The generator fails the build if a binding references a token that doesn't exist — contract and tokens cannot silently disagree.

## What each phase proves

| Phase | Deliverable | Proves |
|---|---|---|
| **1** (done) | Contract schema, DTCG tokens, generator, Storybook | The contract is generative for code; token integrity is enforceable at build time |
| **2** | Figma variables + component sets generated from the same contracts | The contract is generative for design; one definition, two renderers |
| **3** | Extraction + three-way diff + promotion flow | The contract is diagnostic; the arbitration model works in both directions |

The phase-3 demo that settles the argument: add a prop by hand in `Button.tsx` → parity flags code-ahead-of-contract → accept the generated contract patch → the Figma component set sprouts the property automatically. Then the reverse, starting from a variable change in Figma.

## Design lineage (assembled, not invented)

| Piece of the contract | Borrowed from |
|---|---|
| Member model (props / slots / parts) | [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) |
| Prop/value binding grammar (`"primary"` ↔ `"Primary"`) | [Figma Code Connect](https://developers.figma.com/docs/code-connect/) |
| Dual-anchor identity (rename-safe IDs per side) | [DTCG `$extensions`](https://www.designtokens.org/) pattern |
| Token format | DTCG (see [token pipeline doc](03-token-pipeline.md) for dialect notes) |
| Spec taxonomy (anatomy, properties, a11y) | Nathan Curtis's [component specifications](https://medium.com/eightshapes-llc/component-specifications-1492ca4c94c) |

One cautionary datapoint shaped the scope: Specify built a standalone "design API" business between Figma and Git and sunset. This PoC deliberately proves a **format + generators + linters** — plain files in a repo — not a hosted middleman.
