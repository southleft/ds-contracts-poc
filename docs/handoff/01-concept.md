---
title: "The Concept — contracts as the source of truth"
doc_id: 01-concept
audience: "Another AI platform with ZERO prior knowledge of this project"
status: authoritative
last_updated: 2026-07-21
reading_order: 1
prerequisites: [00-readme]
related: [02-thesis-and-north-star, 03-determinism, 05-architecture]
---

# The concept

## The problem

Every design-system team lives with the same pain: the **Figma component
library** and the **coded components** drift apart. A designer changes a padding
token; the code doesn't know. An engineer adds a `loading` prop; the Figma
component doesn't know. Keeping the two surfaces in sync is manual, continuous,
and lossy. "Design–dev handoff" tools mostly translate *one direction, once* —
they don't keep the two in a durable, two-way agreement.

## The idea

Put a **contract** between design and code. A contract is a small, human- and
machine-readable JSON document that describes a component completely enough to
*generate both surfaces from it*:

- its **props** (name, type, defaults) and how each binds to a Figma
  component-property and to a code prop,
- its **anatomy** (the tree of named parts: elements, text, nested component
  instances, slots, repeated collections),
- its **tokens** (which design tokens paint which part),
- its **states**, **variants**, **slots**, **composition** (references to other
  contracts), and accessibility facts.

From one contract you can deterministically produce:

- **React** (+ CSS Module or inline styles) and static **HTML**,
- a **Figma Plugin-API script** that builds the component set on a canvas,
  token-bound and identity-marked.

And you can go the other way: read a Figma component (a "dump") and **propose a
contract** back; read code and **extract a contract** back.

The contract is the hub. Code and canvas are spokes. Neither side is "primary" —
the contract is, and it is the thing that is version-controlled, reviewed, and
enforced.

## Why this is different

- **Two-way, durable.** Not a one-time export. The contract is the persistent
  agreement; either side can regenerate from it, and either side can propose a
  change *to it* (which becomes a reviewable diff).
- **Deterministic, not AI.** The generation is a pure function of the contract
  (see `03-determinism.md`). The same contract always produces the same output,
  byte-for-byte. This is the load-bearing property — it is what makes "the
  contract is the source of truth" *true* rather than aspirational.
- **The authority is the layer that can mechanically refuse.** Contracts are
  schema-validated (Zod). An emitter refuses to generate from an invalid or
  unresolvable contract, *by name*. Drift is caught at a gate, not by a human
  noticing.

## The mental model

```
            ┌──────────────────────────────┐
   code ◀───┤          CONTRACT            ├───▶ Figma canvas
     extract│  (JSON, schema-validated,    │build (plugin runs the
     ───────▶ │   the single source of      │◀─── deterministic emitter)
   generate  │   truth, version-controlled) │ propose (dump → contract)
            └──────────────────────────────┘
```

Every arrow is a **deterministic transform**. No arrow is an AI making a
judgment call. The AI (me, or you) builds and improves the transforms; it does
not *run* them.

## What a contract looks like (abbreviated)

```jsonc
{
  "id": "ds.badge",
  "name": "Badge",
  "version": "1.1.0",
  "props": [
    { "name": "variant", "type": { "enum": ["info","success","warning","danger","error"] },
      "default": "info",
      "bindings": { "figma": { "kind": "VARIANT", "property": "Variant" }, "code": { "prop": "variant" } } },
    { "name": "children", "type": "text", "default": "Badge",
      "bindings": { "figma": { "kind": "TEXT", "property": "Label" }, "code": { "prop": "children" } } }
  ],
  "anatomy": {
    "root": { "element": "span", "tokens": { "background-color": "{color...}", "border-radius": "{radius.pill}" },
              "parts": { "label": { "element": "span", "content": { "prop": "children" } } } }
  }
}
```

Note the **bindings**: every prop knows its Figma component-property name AND its
code prop name. That is how one contract drives both surfaces without a human
mapping them each time.

Continue to `02-thesis-and-north-star.md`.
