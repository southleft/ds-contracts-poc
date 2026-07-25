# 16 — The Sync Boundary

*What a contract will carry, what it will never carry, and where determinism
ends by decision rather than by failure.*

This document turns a settled architectural decision (2026-07-24) into spec
doctrine. It answers the question every code-led team asks first: **"my
component is 10× richer than anything a canvas can express — what happens to
the rest?"**

---

## The boundary, stated plainly

**The contract carries only canvas-expressible facts.** Concretely, the five
fact classes the schema models today:

| carried | examples |
|---|---|
| **Props & variants** | enum axes, booleans, text props, defaults, per-axis planes |
| **Anatomy** | the part tree, slots, nested component instances, repeated collections |
| **Token bindings** | channel → `{token}` per part, per-axis maps, minted `imported.*` literals |
| **Layout** | direction, alignment, padding, gap, sizing (hug/fill/fixed) |
| **States** | hover / active / focus-visible / disabled / checked planes, visibleWhen |

**The contract will never carry:** hooks, event handlers, business logic,
data fetching, side effects, or any behavior that exists only at runtime.
Not "not yet" — *never, by design*. Code is allowed to be arbitrarily richer
than the canvas; the **sync surface** is capped at what a Figma component set
can express, because that is the largest surface on which a *deterministic*
round trip is possible.

This is the same separation the industry already preaches as
presentational/container discipline. The contract doesn't invent the
boundary — it makes it mechanical.

## Where the rest goes: the extension sidecar

Nothing is silently dropped. Every extraction writes a
**`*.extension.json` sidecar** next to the contract: the named overflow —
every captured fact the vocabulary refuses to carry, each entry stating *why*
it does not fit (code-only channels, pairwise refusals, state overflow,
structure receipts). Two rules make the sidecar trustworthy:

1. **Refusal is named, never silent.** A fact outside the vocabulary appears
   in the sidecar with its reason — it is findable, diffable, and countable
   (the eval suite gates 17 distinct refusal classes).
2. **The sidecar is not contract vocabulary.** Emitters never read it;
   nothing downstream can quietly depend on unspecified facts.

## Consequences for each direction

**Code → canvas.** Extraction reads only render truth (the computed-capture
floor) plus declared API surface. A `useEffect`, a handler, a data hook —
none of it exists at the boundary, so none of it can leak into the canvas or
be damaged by a later sync back. The 10×-richer code is *untouched territory*
by construction.

**Canvas → code (brownfield write-back).** A canvas edit can only change
facts the contract carries — a token value, an enum member, a structural
part, a layout property. The write-back is therefore a **bounded patch
class**, not code generation: the sync updates the one fact at its source
location (see provenance anchors, below) and touches nothing else in the
file. A canvas edit cannot delete your `onChange`, because the boundary
never admitted `onChange` in the first place.

**Composition (Make and friends).** Assembly tools compose only the real
components the contracts describe. A missing component is a **named gap**
("this system has no Pagination — request it"), never an invented or
imported substitute. Gap analysis over silent invention, always.

## Deterministic core, bounded assist

The vocabulary matters. Two different claims live under "deterministic," and
this spec keeps them separate:

- **The deterministic core** — every conversion the contract performs:
  extraction, emission, genesis, drift detection. Pure functions,
  byte-reproducible, zero AI tokens, gated by double-run identity checks.
  If it can be counted, it is counted.
- **The bounded assist** — everything outside the core where an LLM may
  *propose*: repairing a write-back patch where no anchor exists, suggesting
  a fix for a drift diff, composing prototypes from real components. Assist
  output is always visible, always checked against the previous revision,
  linted, and reviewed. Guardrailed composition is *bounded*, not
  deterministic — the spec never calls it otherwise.

The rule joining them (already enforced by the resolver's decision ledger):
**assist may write proposals; only explicit acks write contracts.** No AI
output reaches a contract without a named, receipted human decision.

## Where determinism ends — by decision

The known edges, so nobody discovers them the hard way:

- **Unknown styling methods** degrade gracefully, never block: the computed
  floor captures correct rendered values for *any* CSS-producing method; a
  dedicated reader (CSS Modules, StyleX, Emotion/CSS-vars, CEM today) only
  upgrades anonymous literals to source-named tokens. Missing reader =
  poorer token *names*, identical pixels.
- **Brownfield write-back without anchors** falls to the assist layer:
  AI-proposed patch, old-revision diff, linters, then the pull request — four
  nets, all visible.
- **Behavior, motion, a11y semantics beyond states** are downstream
  concerns the contract deliberately leaves to the code that owns them.

## Why this bounds the roadmap

The target vocabulary — Figma's expressible surface — is **finite and
slow-moving**. The unbounded side (arbitrary code) is out of scope by this
decision, not by unfinished work. That is the difference between a path
that has an end and a thread that unravels forever: new frameworks, new
styling methods, and new component patterns land as *reader plugins* and
*named gaps*, never as prerequisites for correctness.
