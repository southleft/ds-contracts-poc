# 13 · Try It With Your Own Design System

The contract model is not specific to this repo's components, React, CSS Modules, or any design tool. This page is the hands-on path for anyone who cloned the repo and wants to point the machinery at **their own** library — the first shipped slice of [brownfield adoption](11-brownfield-adoption.md).

What you get today (extraction v0):

1. **Proposed contracts** for your components — schema-valid, API-surface only
2. **The disagreement report** — where your code library and your design library disagree with *each other*, before any contract is adopted

3. **A continuous referee** — `npm run diagnose` checks your real surfaces against the contracts on every run, generating nothing

What you don't get yet: anatomy/token inference (deliberately — anatomy stays human-owned), token-surface checks against foreign token systems, and the reconciliation UI (both on the [roadmap](12-roadmap.md)).

## 0 · See it work before pointing it at your system

Fresh clone, zero config — the defaults run against this repo's own library:

```bash
npm install
npm run extract:code   # 51 components → extract/out/contracts/*.contract.json + proposals.md
npm run reconcile      # → extract/out/reconciliation.md (vs this repo's design snapshot)
```

Read `extract/out/reconciliation.md` first — it's the artifact everything else exists to produce.

## 1 · Point it at your code library

Create `extract.config.json` in the repo root:

```jsonc
{
  "code": {
    "adapter": "react-tsx",          // or "cem" — see below
    "root": "../your-repo/src/components"
  },
  "idPrefix": "acme",                // your namespace: acme.chip, acme.alert, …
  "out": "extract/out"
}
```

```bash
npm run extract:code
```

**Adapters:**

| Adapter | Input | Covers |
|---|---|---|
| `react-tsx` | a directory of `.tsx`/`.ts` source | React/TypeScript: function components, `forwardRef`/`memo` wrappers, interface or type-alias props (any name), intersection types, **cva + `VariantProps` variant axes and `defaultVariants`** (the shadcn-era convention), one-hop local type aliases, destructure defaults, legacy `defaultProps`, JSDoc descriptions |
| `cem` | a `custom-elements.json` path | **any library that ships a Custom Elements Manifest** — Web Components, Lit, FAST, Shoelace-style systems — regardless of authoring framework |

The CEM adapter is the framework-agnosticism proof: adapters normalize into one shared shape, so everything downstream (proposals, reconciliation, eventually the differ) is framework-blind. A Vue/Svelte adapter is the same ~200-line pattern against their SFC tooling.

What extraction reads is deliberately scoped to the **API surface** — props, enum values, defaults, booleans, text, `on*` events. It will not guess your anatomy or tokens; proposals ship with a stub root and explicit notes on every inference (`extract/out/proposals.md`).

## 2 · Dump your design library

Run `extract/figma-dump.js` in your design file through any bridge that executes Plugin API code (the same transport-agnostic boundary as `figma-sync/`). It is read-only and extracts only component-set properties: variant axes + options, boolean/text/instance-swap properties. Save the returned JSON:

```jsonc
// extract.config.json
{ "design": { "source": "extract/design.json" } }
```

## 3 · Reconcile — the report that starts the conversation

```bash
npm run reconcile
```

`extract/out/reconciliation.md` lists, per component: properties both surfaces agree on, option sets that differ, code-only props, design-only properties, and components that exist on only one side. Matching is transparent — normalized names plus two calibrated alias rules (`isDismissable ⇄ Dismissable`, `overflowLabel ⇄ Overflow`), each flagged when used; nothing else is silently guessed.

Calibration receipt: run against this repo's own (contract-generated, known-aligned) surfaces, reconciliation matches 49/51 components — the two unmatched are the layout primitives that intentionally have no canvas sets — with 103 properties agreeing and the flags dominated by design text properties bound to React `children`, which a props interface genuinely cannot show. On *your* system, the flags will be real drift: that's the point.

## 4 · Diagnose — the referee, running continuously

Once you've reviewed the proposals (edited or not), the differ can referee your real surfaces against them — generating nothing:

```bash
npm run diagnose        # contracts vs your code (and your design dump, if configured)
```

Same classification semantics as the greenfield differ — every finding is `ahead` / `behind` / `mismatch` with a remedy, on the API surface only. Without a design dump, design checks are *skipped and said to be skipped*, never silently passed. Wire it into CI and drift stops accumulating silently — that is the whole "keep your libraries, add a referee" pitch, now literal. The green→red→green loop on non-generated surfaces is eval-proven (`diagnose-foreign-green-red-green`).

Real-library receipt: extraction + diagnose ran against **Shoelace v2.20.1** — 58/58 components, 411 props, 113 events, every proposal schema-valid. Receipts and honesty notes: [`extract/pilots/shoelace/`](../extract/pilots/shoelace/README.md).

## 5 · From report to adoption

The sequence from here is [docs/11](11-brownfield-adoption.md): humans arbitrate each disagreement (code-is-right / design-is-right / neither), decisions land in the proposed contracts, and `npm run diagnose` becomes your CI gate — the contract as referee over your existing libraries, generating nothing. Later, per component and per layer, generation is opt-in ([docs/11 Phase 4](11-brownfield-adoption.md)).

## Honesty box

- Extraction is single-file syntactic (no TypeScript type checker): props composed from *imported* types in other files won't be read — but any component the adapter can see and cannot read is **listed in `proposals.md` with the reason**, never silently dropped. Every heuristic fill is marked `confidence: "inferred"`.
- CEM extraction trusts the manifest — CEM describes, it doesn't verify (that gap is why the differ exists).
- The alias rules were calibrated on one system (this one). Expect your naming conventions to add rules; the matcher is ~30 lines and reports every alias hit.
