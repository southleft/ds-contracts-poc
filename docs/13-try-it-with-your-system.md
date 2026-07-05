# 13 · Try It With Your Own Design System

The contract model is not specific to this repo's components, React, CSS Modules, or any design tool. This page is the hands-on path for anyone who cloned the repo and wants to point the machinery at **their own** library — the first shipped slice of [brownfield adoption](11-brownfield-adoption.md).

What you get today (extraction v0):

1. **Proposed contracts** for your components — schema-valid, API-surface only
2. **The disagreement report** — where your code library and your design library disagree with *each other*, before any contract is adopted

What you don't get yet: anatomy/token inference (deliberately — anatomy stays human-owned), and running the three-way differ against un-generated surfaces (the next Phase 2 slice).

## 0 · See it work before pointing it at your system

Fresh clone, zero config — the defaults run against this repo's own library:

```bash
npm install
npm run extract:code   # 48 components → extract/out/contracts/*.contract.json + proposals.md
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
| `react-tsx` | a directory of `.tsx`/`.ts` source | React/TypeScript: function components, `forwardRef`/`memo` wrappers, interface or type-alias props (any name), one-hop local type aliases, destructure defaults, legacy `defaultProps`, JSDoc descriptions |
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

Calibration receipt: run against this repo's own (contract-generated, known-aligned) surfaces, reconciliation matches 46/48 components — the two unmatched are the layout primitives that intentionally have no canvas sets — with 102 properties agreeing and the only flags being design text properties bound to React `children`, which a props interface genuinely cannot show. On *your* system, the flags will be real drift: that's the point.

## 4 · From report to adoption

The sequence from here is [docs/11](11-brownfield-adoption.md): humans arbitrate each disagreement (code-is-right / design-is-right / neither), decisions land in the proposed contracts, and you adopt **diagnostic-only** — the contract as referee over your existing libraries, generating nothing. Wiring the three-way differ to extraction-shaped (rather than generated) surfaces is the next slice on the [roadmap](12-roadmap.md).

## Honesty box

- Extraction is single-file syntactic (no TypeScript type checker): props composed from imported/spread types in other files won't be seen. Every heuristic fill is marked `confidence: "inferred"`.
- CEM extraction trusts the manifest — CEM describes, it doesn't verify (that gap is why the differ exists).
- The alias rules were calibrated on one system (this one). Expect your naming conventions to add rules; the matcher is ~30 lines and reports every alias hit.
