# 11 · Brownfield Adoption — Connecting Pre-Existing Libraries

> **Status:** extraction v0 shipped — `npm run extract:code` + `npm run reconcile`, two adapters (React/TS + Custom Elements Manifest), eval-covered. Hands-on guide: [docs/13](13-try-it-with-your-system.md).

Everything in this repo so far is **greenfield**: the contract came first and generated both surfaces. No real organization starts there. Atlassian, Shopify, and Google each have a mature code library, a mature design library, and years of accumulated drift between them. Nobody is going to regenerate Polaris.

So the adoption question is not *"will you rebuild on contracts?"* It is:

> **Can the contract method be retrofitted onto two pre-existing surfaces without rewriting either one?**

This document is the plan for answering yes. The core move is to run the PoC's pipeline **in reverse**: instead of contract → surfaces, it's surfaces → *proposed* contract → reconciliation → diagnostic loop — and only then, optionally and per-component, generation.

## Why this is more tractable than it sounds

The extraction machinery already exists in this repo, and it was built honestly from day one:

- **`parity/extract-code.ts`** does not read the contract. It reads the *actual React source* with the TypeScript compiler API — props interfaces, enum unions, booleans, optionality, destructuring defaults — plus the CSS custom properties each component consumes. Its only coupling to this repo is file-layout convention (`src/components/<Name>/<Name>.tsx`, a `<Name>Props` interface).
- **`parity/extract-figma.plugin.js`** does not read the contract either. It reads the *actual canvas*: variant axes and their options, boolean/text/instance-swap properties, bound variables.

Both halves of a brownfield extractor already run against real surfaces every time `npm run parity` executes. What's missing is not extraction — it's **inference and reconciliation**: turning two independent extractions into one proposed contract when nobody pre-aligned the names.

## The adoption sequence

### Phase 1 — Extract two proposals, and let them disagree

Point the code extractor at the org's component source and the design extractor at their library file. Each produces a *proto-contract* per component: the API surface as that surface believes it to be.

These two proposals **will disagree** — different prop names (`Size=Small` vs `size="sm"`), options that exist on one side only, defaults that quietly diverged years ago. That disagreement is not a failure of the tool. **It is the first deliverable**: a mechanical, exhaustive drift report between the org's own two libraries, produced before a single contract exists and before anyone commits to anything. Most design system teams have never seen this document about their own system. It is the artifact that makes the rest of the conversation happen.

### Phase 2 — Reconcile into contract v1 (humans arbitrate, once)

For each disagreement, someone decides: code is right, design is right, or neither. The output is the component's first contract — including the `bindings` block, which is where the schema already absorbs naming differences (`figma: { property: "Size" }` / `code: { prop: "size" }` mapping to shared values). The contract is born as a **record of decisions**, not a mandate handed down. That framing matters: teams accept a written-down arbitration they participated in; they reject a new source of truth imposed on them.

This needs tooling — a reconciliation view (the Contract Hub is the obvious home) showing each field side-by-side with accept-left / accept-right / edit. Per-field confidence scores from the extractors decide what needs human eyes versus what can auto-merge (identical on both sides → merged silently).

### Phase 3 — Diagnostic-only adoption (the wedge)

**Generate nothing.** Run the differ continuously against both existing surfaces. The org keeps its hand-written code and hand-drawn canvas exactly as they are; the contract acts purely as referee — a CI gate and a drift dashboard. Every check the differ performs today (props, variant sets, boolean/text properties, slot wiring, token variables) works identically whether the surfaces were generated or not, because the extractors never assumed generation.

This is the low-commitment pitch, and it must stay low-commitment: *keep your libraries; add a referee.* Value is immediate (drift stops accumulating silently) and the exit cost is zero (delete the contracts, nothing breaks).

### Phase 4 — Selective, progressive generation (opt-in, per component, per layer)

Only after the diagnostic loop has earned trust does generation enter, and never all at once:

1. **Types first** — generate the TS prop types and Storybook argTypes from the contract; keep the hand-written implementation. Lowest risk, immediate consistency win.
2. **Token bindings second** — generated CSS custom-property wiring replaces hard-coded values.
3. **New components contract-first** — anything born after adoption starts life the greenfield way.
4. **Legacy components: diagnostic forever** is a legitimate permanent end state. Full-shell regeneration of a mature component is the *last* step and frequently the wrong one.

## The real work items

| # | Work item | What exists | What's new |
|---|---|---|---|
| 1 | **Generalized code extractor** — configurable file layout, props-interface discovery, support for `forwardRef`/styled-components/vanilla-extract patterns | TS-compiler extraction of props/enums/defaults/CSS vars | Convention adapters; framework variety |
| 2 | **Generalized design extractor** — arbitrary page structure, component discovery by publish status rather than by name match | Variant/property/bound-variable extraction | Discovery heuristics; token-naming maps |
| 3 | **Binding inference** — propose the `figma`↔`code` name/value mappings automatically (case conventions, edit-distance, value-set overlap) | Schema's `bindings` block models the mapping | The inference engine + confidence scoring |
| 4 | **Reconciliation UI** — side-by-side proposal merge in the Contract Hub | Hub, contract editing, parity views | The merge workflow |
| 5 | **Token bridge for foreign token systems** — orgs have existing token names; the contract must reference *their* tokens, not this repo's | DTCG pipeline, alias model | Import path for external DTCG/Style Dictionary sets |
| 6 | **Pilot on a real public pair** — e.g. an open-source React library plus its community design kit; publish the extraction + drift report | Everything above, once built | The credibility artifact: "we ran this on a system we don't own and here is what it found" |

Item 6 is the one that changes the conversation with enterprise teams. A methodology document persuades nobody; a drift report about a system they recognize does.

## Scope discipline (learned the hard way in this repo)

Extraction should target **exactly the differ's current scope** — the contracted API surface — and not attempt anatomy inference. Recovering part-level anatomy, icon usage, or `visibleWhen` logic from arbitrary hand-written code is a research project; recovering props, variants, defaults, and token references is engineering. The PoC's own validation history ([docs/07](07-validation.md)) shows the API surface is where drift is detectable, classifiable, and actionable. Anatomy stays human-owned on brownfield components, which is also the answer teams want to hear.

## What this phase must prove

1. Two independent extractions of a real, un-generated component pair converge on a usable proposed contract with human review measured in **minutes per component, not hours**.
2. The diagnostic loop runs green→red→green on surfaces this repo did not generate.
3. At least one org-shaped pilot (item 6) produces a drift report a design system team confirms is *true* — every finding real, no finding missed within the declared scope.

Same standard as the rest of this project: falsifiable claims, receipts attached.

## Code-first anatomy: when the org arrives code-only

The plan above assumed anatomy stays human-owned. Extraction v1 keeps it human-**reviewed** but no longer starts from a stub: when a React component has a co-located CSS Module, the extractor inverts the generator's emission model back out of the source — JSX `className={styles.x}` nesting becomes the part tree; `property: var(--a-b-c)` becomes a `{a.b.c}` binding (the hyphen-to-dot split is refereed against *your* token tree via `config.tokens`, and ambiguity is reported, never guessed); `.variant-primary` rule families become substituted refs like `{color.action.{variant}.background}`; flex declarations become `layout`; `:hover/:focus-visible/:disabled` rules become `states`; `{children}`/ReactNode props become slots; imported component instances become anatomy refs; and the uncontrolled-toggle pattern yields real event triggers. The result is a proposal that can generate a faithful canvas on day one.

The honesty rules carry over unchanged: a literal color or px value **never** becomes an invented token — it lands in proposals.md as a named RAW VALUE with nearest-token candidates by value; everything the adapter can see but not read (tailwind class strings, shorthands, media queries, foreign variant hooks) is skipped *by name*. The executable receipt is `npm run roundtrip:code`: this repo's own generated Badge/Switch/Card, re-extracted and compared to their shipping contracts — zero MISMATCH, with every genuinely code-absent field (figma bindings, canvas defaults, slot constraints) listed rather than waved through (`extract/ROUNDTRIP-CODE.md`).
