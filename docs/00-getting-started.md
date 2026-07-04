# Getting Started — What, Why, and How

New here? This page is the five-minute orientation. Everything else in the docs assumes you've read it.

## What is this?

A **design system where the source of truth is a contract, not a surface.**

Every component in the catalog is defined once, in a small JSON file called a **contract**. The contract records the things design and engineering must agree on: the component's props and their legal values, its anatomy (the parts it's made of), which design tokens style each part, what its slots accept, and its accessibility semantics. From that one file, generators produce **both** renderers:

- the **code library** — working, accessible React components with stories and a publishable package, and
- the **canvas library** — native design-tool components with variants, properties, and mode-aware variables.

Neither surface is hand-maintained. Neither is a copy of the other. Both are compiled from the contract, and a **three-way differ** continuously proves they still match it.

```
contracts/button.contract.json     ←  the source of truth
├── src/components/Button/         ←  generated React + CSS + stories
└── canvas library "Button" set    ←  generated variants + bound variables
```

## Why do we have this?

Because the alternative always ends the same way. If code is canonical, the design file becomes an aging picture of the product. If the design library is canonical, the code becomes an approximation of the pictures. Either way, one side is a hand-maintained copy — and copies drift, and drift erodes trust, and eroded trust is why design reviews turn into arguments about which surface is "right."

The contract dissolves the argument by making it a category error: **both surfaces are renderers.** Asking whether the design file or the code is the truth becomes like asking whether the PDF or the print-out is the original document. The original is the contract, it's versioned in Git, and every change to it is a reviewable diff.

There's a second reason, and it's becoming the bigger one: **AI generation.** When an agent builds UI, an ungoverned agent invents props, hard-codes colors, and restyles components — measured here at 69/100 adherence with 91 violations. The same model constrained by the compiled contract catalog scored **100/100 with zero violations**, and when it hit a genuine gap in the system it reported the gap instead of faking around it. The contract isn't just how design and code stay aligned — it's how *generation* stays honest. (Full evidence: [Validation](./07-validation.md).)

## How the two sides stay connected

<svg id="contract-flow" viewBox="0 0 920 470" role="img" aria-label="Workflow diagram: the contract sits between the design surface and the code surface. Generation flows outward from the contract to both surfaces; changes on either surface flow back into the contract as promotions, and the contract regenerates the other side. A differ continuously compares all three." style="max-width:100%;height:auto;font-family:inherit">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
    </marker>
  </defs>
  <style>
    #contract-flow .box { fill: var(--card, #fff); stroke: var(--border, #d1d5db); stroke-width: 1.5; rx: 8; }
    #contract-flow .core { fill: var(--primary, #171717); }
    #contract-flow .t { fill: var(--foreground, #111827); font-size: 15px; font-weight: 600; }
    #contract-flow .tc { fill: var(--primary-foreground, #fff); font-size: 15px; font-weight: 600; }
    #contract-flow .s { fill: var(--muted-foreground, #6b7280); font-size: 12px; }
    #contract-flow .sc { fill: var(--primary-foreground, #fff); opacity: .75; font-size: 12px; }
    #contract-flow .flow { stroke: var(--foreground, #111827); stroke-width: 1.8; fill: none; }
    #contract-flow .back { stroke: var(--muted-foreground, #6b7280); stroke-width: 1.6; fill: none; stroke-dasharray: 6 4; }
    #contract-flow .lbl { fill: var(--foreground, #111827); font-size: 12.5px; font-weight: 600; }
    #contract-flow .lbl2 { fill: var(--muted-foreground, #6b7280); font-size: 11.5px; }
  </style>

  <!-- Design surface -->
  <rect class="box" x="20" y="120" width="230" height="130" rx="8"/>
  <text class="t" x="135" y="152" text-anchor="middle">Design surface</text>
  <text class="s" x="135" y="178" text-anchor="middle">component sets · variants</text>
  <text class="s" x="135" y="196" text-anchor="middle">properties · slot swaps</text>
  <text class="s" x="135" y="214" text-anchor="middle">mode-aware variables</text>

  <!-- Contract -->
  <rect class="core" x="345" y="95" width="230" height="180" rx="10"/>
  <text class="tc" x="460" y="130" text-anchor="middle">THE CONTRACT</text>
  <text class="sc" x="460" y="156" text-anchor="middle">*.contract.json · versioned in Git</text>
  <text class="sc" x="460" y="178" text-anchor="middle">props · anatomy · token bindings</text>
  <text class="sc" x="460" y="196" text-anchor="middle">slots · a11y semantics</text>
  <text class="sc" x="460" y="222" text-anchor="middle">+ tokens · rules · context</text>
  <text class="sc" x="460" y="244" text-anchor="middle">compiled into the catalog</text>

  <!-- Code surface -->
  <rect class="box" x="670" y="120" width="230" height="130" rx="8"/>
  <text class="t" x="785" y="152" text-anchor="middle">Code surface</text>
  <text class="s" x="785" y="178" text-anchor="middle">React + CSS Modules</text>
  <text class="s" x="785" y="196" text-anchor="middle">stories · npm package</text>
  <text class="s" x="785" y="214" text-anchor="middle">tokens as custom properties</text>

  <!-- Generate arrows (contract → surfaces) -->
  <line class="flow" x1="345" y1="150" x2="255" y2="150" marker-end="url(#arrow)"/>
  <text class="lbl" x="300" y="138" text-anchor="middle">generate</text>
  <line class="flow" x1="575" y1="150" x2="665" y2="150" marker-end="url(#arrow)"/>
  <text class="lbl" x="620" y="138" text-anchor="middle">generate</text>

  <!-- Promotion arrows (surfaces → contract) -->
  <line class="back" x1="255" y1="222" x2="345" y2="222" marker-end="url(#arrow)"/>
  <text class="lbl" x="300" y="248" text-anchor="middle">promote</text>
  <text class="lbl2" x="285" y="263" text-anchor="middle">designer's change</text>
  <line class="back" x1="665" y1="222" x2="575" y2="222" marker-end="url(#arrow)"/>
  <text class="lbl" x="620" y="248" text-anchor="middle">promote</text>
  <text class="lbl2" x="635" y="263" text-anchor="middle">engineer's change</text>

  <!-- Differ -->
  <rect class="box" x="345" y="330" width="230" height="66" rx="8"/>
  <text class="t" x="460" y="357" text-anchor="middle" style="font-size:13.5px">three-way differ</text>
  <text class="s" x="460" y="377" text-anchor="middle">ahead · behind · mismatch</text>
  <line class="back" x1="135" y1="250" x2="135" y2="363 " />
  <line class="back" x1="135" y1="363" x2="340" y2="363" marker-end="url(#arrow)"/>
  <line class="back" x1="785" y1="250" x2="785" y2="363"/>
  <line class="back" x1="785" y1="363" x2="580" y2="363" marker-end="url(#arrow)"/>
  <line class="back" x1="460" y1="330" x2="460" y2="280" marker-end="url(#arrow)"/>
  <text class="lbl2" x="470" y="312" text-anchor="start">verified against the contract, continuously</text>

  <!-- Never arrow -->
  <path class="back" d="M 135 100 C 135 40, 785 40, 785 100" style="stroke: var(--destructive, #dc2626)"/>
  <text class="lbl" x="460" y="34" text-anchor="middle" style="fill: var(--destructive, #dc2626)">surfaces NEVER sync side-to-side</text>

  <text class="lbl2" x="460" y="440" text-anchor="middle">a change on either surface becomes a reviewable proposal to the contract — accept it, and the contract regenerates the other side</text>
</svg>

The one rule that makes the whole thing work: **surfaces never sync side-to-side.** A designer's change and an engineer's change both take the same path — into the contract as a reviewable proposal, then out to the other surface by regeneration. One arbiter, one diff, no arbitration meetings.

## The same story, in a real file

Here's a slice of an actual contract from this repo, with what each side does with it:

```json
{
  "id": "ds.banner",
  "props": [{
    "name": "status",
    "type": { "enum": ["info", "success", "warning", "error"] },
    "default": "info",
    "bindings": {
      "figma": { "kind": "VARIANT", "property": "Status" },
      "code":  { "prop": "status" }
    }
  }],
  "anatomy": {
    "root": {
      "tokens": { "background-color": "{color.feedback.{status}.background}" }
    }
  }
}
```

| Contract line | What the code renderer does | What the canvas renderer does |
|---|---|---|
| `status` enum with 4 values | `status?: 'info' \| 'success' \| 'warning' \| 'error'` prop, typed and defaulted | A **Status** variant axis with 4 options, default first |
| `background-color: {color.feedback.{status}.background}` | `.status-info { background: var(--color-feedback-info-background) }` … one class per value | Each variant's fill **bound to the variable** `color/feedback/info/background` … one per value |
| the token itself | CSS custom property, light + dark values | Design-tool variable, Light + Dark modes |

Same file, two faithful renderings, and the differ can mechanically prove both — that's the whole idea.

**And in both directions:** this repo has run the loop both ways with receipts. An engineer added a `loading` prop in code → the differ flagged code *ahead* → the prop was promoted into the contract (v1.1.0) → the canvas set gained a Loading property on regeneration. A designer changed a surface color on the canvas → the differ flagged the token *mismatched* with a proposed patch → the patch was promoted into the tokens → the CSS rebuilt. Neither change touched the other surface directly. (Blow-by-blow: [The Parity Loop](./06-parity-loop.md).)

## How do I use it?

**If you're a designer:** work in the canvas library like you always do — the components there are real, with variants, properties, and swappable slots. When something needs to change (a color that fails in context, a missing variant), change it. The differ will surface your change as a proposal; once accepted, code follows automatically. You never file a ticket asking engineering to "match the file."

**If you're an engineer:** `import { Banner } from` the package and build. The props are the contract's props — nothing more, nothing less. When the product needs a prop that doesn't exist, add it in code; the differ flags it, the promotion bumps the contract, and the design library gains it without anyone redrawing.

**If you're an AI agent (or pointing one at this):** generate against `catalog/catalog.json` — the compiled constraint containing every component API, every token, and the governance rules. The deterministic judge (`npm run judge -- <file.tsx>`) scores any screen against it. Off-catalog props, raw hex values, and style overrides are mechanical failures, not style feedback.

**If you maintain the system:** the contract files in `contracts/` are your entire authoring surface. Edit one (or use the Hub's *Evolve the contract* panel), and everything downstream — React, stories, CSS, canvas sets, catalog, docs data — regenerates.

## How to get started

```bash
git clone <repo> && cd ds-contracts-poc
npm install
npm run build        # tokens → schema → generated components (validated)
npm run dashboard    # the Contract Hub, http://localhost:5180
npm run storybook    # the generated component library
```

Then prove the loop to yourself in about two minutes:

1. `npm run parity` — see it report **clean**: code, canvas, and tokens all match the contracts.
2. Open a contract in `contracts/` and change something small — add an enum value, tweak a token binding.
3. `npm run build && npm run parity` — the differ now reports the canvas **behind**, naming exactly what's missing and how to fix it. That honest red state *is* the product: nothing pretends to be in sync when it isn't.
4. Revert, or carry the change through — regenerate, sync the canvas, and watch it go green again.
5. `npm run eval` — 26 deterministic checks that the machinery itself (detection, refusal, convergence, byte-identical regeneration) still holds.

From there: [The Bridge](./00-the-bridge.md) for the narrative, [Architecture](./01-architecture.md) for the model, [Contract Specification](./02-contract-spec.md) when you're ready to write one.
