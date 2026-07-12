# The Bridge — Why This Exists

Every organization that takes design systems seriously eventually splits into two camps, usually without noticing.

Some organizations come in from the **code side**. Their design system is an npm package. The components are real, tested, and shipped — and the design files are an approximation of them, redrawn by hand, aging from the moment they're published. Designers work against a picture of the product, not the product. When an engineer adds a prop or changes a default, no one redraws anything, and the picture quietly becomes fiction.

Other organizations come in from the **design side**. Their design system is a canvas library. The components are beautifully specified, every variant enumerated — and the code is an approximation of *them*, rebuilt by hand, drifting from the moment it's merged. Engineers work against screenshots and redlines. When a designer restructures a component, no one refactors anything, and the library becomes a wish list.

Both camps are answering the same question — *where does the truth live?* — and both answers fail the same way: whichever side is declared canonical, the other side becomes a hand-maintained copy. Copies drift. Drift erodes trust. Eroded trust is why design reviews devolve into archaeology ("is the file right, or is prod right?") and why every design system team ends up with a human whose actual job is reconciliation.

## The position this proof of concept takes

**The source of truth is neither surface.** It's a machine-readable **contract** that sits between them.

A contract is a small, versioned JSON document that captures everything both sides must agree on: the component's API (props, types, enum vocabularies, defaults, what's required), its anatomy (the parts it's made of and how they nest), its bindings to design tokens (never raw values), its slots (what it accepts, and how strictly), and its semantics (element, ARIA role). The canvas library and the code library are both **renderers** of that contract — generated from it on the first pass, validated against it forever after.

That second half is the important half. Generation is a party trick; lots of tools generate code or draw components once. The contract model is **generative first, diagnostic forever**: after the first pass, a three-way differ continuously compares the contract, the code, and the canvas, and classifies every difference as *ahead* (a surface has something the contract doesn't), *behind* (a surface is missing something the contract has), or *mismatched*. Nothing syncs side-to-side. Ever.

## Fluidity, not enforcement

The bridge would be worthless if it only policed. Real teams evolve their systems from both ends — an engineer adds a `loading` prop because the product needed it; a designer adjusts a surface color because the old one failed in context. Both of those are *good* changes that started on the "wrong" side.

So the loop is built around **promotion**: when a surface runs ahead of the contract, that difference becomes a reviewable proposal *to the contract*. Accept it, and the contract version bumps and regenerates the other side — the designer's color change flows to code, the engineer's prop flows to the canvas, and both surfaces stay honest without either being demoted. Reject it, and the surface is flagged as drift to be reverted. Either way there is exactly one arbiter, and it's a diffable, reviewable, version-controlled file — the same governance model that made Git work for code and made the DTCG token format work for design tokens. This proof of concept runs that playbook one level up, at the component-API layer.

## What "validated" means here

This isn't an architecture diagram — the loop in these docs has been run end to end, in both directions, with the receipts committed:

- **One contract, two surfaces**: every component in the catalog is generated into working, accessible React (with stories and a publishable package) and into a native canvas library (variants, mode-aware variables, slot properties) from the same JSON — including composition three levels deep and enterprise patterns mirrored from a shipping industry component library.
- **Deterministic honesty**: a mutation-tested eval suite proves the differ detects every class of drift it claims to, refuses illegal contracts, converges after promotion, and regenerates byte-identically.
- **Governed generation measurably wins**: the same AI model building the same screens scored **100/100 adherence with zero violations** when constrained by the contract catalog, versus **69/100 with 90 violations** (invented APIs, hard-coded values, style overrides) without it. And when the constrained agent hit a real gap in the system, it *reported the gap instead of faking around it* — the gap became a contract proposal, the proposal became a version bump, and the score went back to 100. That's the loop working under pressure.

The rest of these docs walk the same path in detail: the contract spec, the token pipeline, generation into each surface, the parity loop, the validation evidence, and the road toward a contributable spec. Start with [Architecture & the Contract Model](./01-architecture.md).
