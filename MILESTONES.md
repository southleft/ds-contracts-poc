# Milestones

A dated log of what this system has **proven**, in order. Every entry is backed
by receipts in the repo — commits, pilot write-ups, eval cases, or live-file
forensics. Nothing here is aspirational; the roadmap holds the aspirations.

## 2026-07-03 — The loop exists

- **Generation from contract into both surfaces** — working React + CSS Modules
  and a scripted Figma library from the same JSON, no handwritten style layer.
- **The parity loop, both directions** — drift detected as ahead/behind/mismatch;
  promotion (canvas → contract) converges instead of ping-ponging.
- **Governed vs. ungoverned generation measured** — the adherence-judge A/B:
  catalog-constrained generation scored 100 vs. 65–69 for freehand.
- **50-component catalog** (schema v5), Contract Hub, docs site, public README.

## 2026-07-03 — Events (schema v6)

The interaction surface enters the contract: declared event callbacks with
toggle semantics (controlled/uncontrolled, ARIA wiring). Canvas reflection is
description text — a **declared fidelity limit**, the pattern for every
code-only surface since.

## 2026-07-05 → 07-06 — Brownfield turns real

- **Extraction v0**: `extract/` reads *your* library (React/TSX and custom
  elements manifests) into proposed contracts; skipped components are always
  reported, never silent.
- **Shoelace pilot**: 58/58 components extracted; code reconciled against its
  community Figma kit — 28/58 matched, 236 recorded decisions, real kit rot
  found mechanically (`deafult`, `isCheched`, `endicon`).
- **Mantine field test**: 245 components extracted in under a second.
- **Multi-brand theming (tokens v7)**: brands as a token-layer dimension —
  byte-identical components, brand-switchable canvas (Default/Aurora modes).

## 2026-07-06 — Fresh-file rebuild, executed

The entire canvas library rebuilt from a **blank Figma file** via the Sync
Runner plugin, then verified against the contracts: zero findings. The test
itself caught three masked generator bugs — the pattern that repeats: hostile
runs are how the system hardens.

## 2026-07-08 — Adversarial hardening round

Three audit agents (red team, scale lab, schema gauntlet) produced 14+
findings; fixes landed: differ blind spots (boolean/text canvas defaults,
property kinds, numeric code defaults, one-sided deletions), merge-attack
refusals (duplicate code bindings), and **golden-output manifests** — because
determinism-vs-self proves nothing about correctness.

## 2026-07-08 — In-place AMEND, forensically proven

A contract change (Button v1.4.0 ghost variant) amended live component sets
**in place** on two files: set key byte-identical, every variant node ID and
property ID preserved, instance overrides intact. Instances never break;
"regenerate" no longer means "destroy and recreate."

## 2026-07-08 — Scale + trust plumbing

- **N-axis variants**: full cartesian product with deterministic ordering.
- **Sharded catalog**: routing index + per-component shards keeps the catalog
  inside an agent's context window at any component count.
- **Provenance & staleness**: snapshots carry fileKey + age; the differ refuses
  to reason over the wrong file or stale extractions. Acknowledged-drift
  baseline ratchets known drift without going permanently red.

## 2026-07-08 — Four design systems, four receipts

Extraction and diagnosis run against **Shoelace, Mantine, Eventz, and CBDS** —
four unrelated architectures. New drift classes catalogued from real files:
state-as-variant-axes, breakpoint axes, boolean arity ladders, emoji-prefixed
property names, variant-unrolled families, decorated enum values.

## 2026-07-08 — The CBDS coexistence proof (the hostile-file finale)

Into a foreign enterprise kit with its own five token collections and its own
72-variant component named "Badge":

1. **Full token sync** — all 282 contract variables landed alongside the kit's
   collections, zero collisions.
2. **Variable-bound generation** — a contract Badge with live token bindings,
   coexisting with the native one.
3. **In-place AMEND from a contract change** (Badge v1.1.0 `error` variant) —
   found by identity marker, not name; same set key, same nodes, same property
   IDs; the native Badge untouched through **four sync passes**.

The passes caught three real generator bugs (name-collision identity, a Figma
renderer base-color quirk on reassigned bound paints, children-text default
reconcile) — all fixed, all eval-gated. Receipts: `extract/pilots/cbds/`.

## 2026-07-08 — Schema round 2: the expressiveness round

Five features, each shipped with a consuming contract: `elementByProp`
(dynamic h1–h6, Heading), `layoutByProp` (ChatMessage sender flip, both
surfaces), `stylesWhen` (whitelisted conditional literals), `overlay`
(out-of-flow anatomy for tooltips/popups), `arrayOf` structured props (code-only
with `kind: NONE`, skipped by every design-side consumer). Plus
pending-first-sync parity classification. **Eval suite: 54/54.**

## 2026-07-08 — Code Editor Simulator (Hub)

New `#/editor` page demos what a contract-governed in-tool code editor
experiences: a live contract JSON editor validated on every keystroke against
the actual `ContractSchema`, with consequences computed deterministically
client-side — API diff, an amendSet-mirrored canvas plan (ADDED/REBUILT/
EXTRA-reported over the enum cartesian product, all-defaults combo first), and
spec-policy version advice. Illegal edits are refused by the schema's own
names and never reach either surface; both keep rendering the last governed
version. Dashboard-only change; 54/54 evals unaffected.

## 2026-07-08 — State previews + canvas text styles (schema v8)

The canvas stops lying about interaction. `figmaStatePreviews` generates a
State variant axis (Hover / Focus Visible / Disabled previews) from the same
declared state tokens that emit the CSS pseudo-classes — the mirror image of
code-only events, bounded to the primary enum axis, refused by name when
hollow. The differ works both directions: a missing axis is BEHIND; a
hand-built State axis without the opt-in is the kit-rot detector (all four
pilot systems carry rotting hand-built state axes). Plus named Figma
TextStyles minted from semantic typography tokens, upserted by identity
marker, ridden by matching text nodes. Button v1.5.0 ships previews.
**Eval suite: 54/54.**


## 2026-07-08 — Full-circle sync: drift acknowledged → resolved → ratchet retired

The main file caught up with three contract versions in one governed pass
(Badge v1.1.0, Button v1.5.0 with the State axis, Heading v1.0.0 first sync),
plus 7 minted text styles and text-style adoption across all 31 variant sets.
The first pass exposed two amend gaps at live-file scale — 17 legacy standalone
components duplicated by the marker-only identity check, and the State axis
gained by duplication instead of rename — both repaired on canvas with every
original node ID preserved, and both fixed at the source (anchor-key identity
fallback; rename-matching for axis changes). The verification pass ran with
zero creates, zero duplicates, zero extras; the snapshot was re-extracted and
**the parity baseline is empty again**: no acknowledged drift anywhere in the
system. Also surfaced for the queue: `figma.fileKey` is null in the dev-plugin
runtime, so WRONG-FILE guards only bind over the bridge transport — a
file-identity marker check is the fix.


## 2026-07-08 — Round-trip identity, both directions (anatomy extraction)

The "anatomy is human-owned" stub era ends. Both reverse directions now
propose FULL contracts — API and anatomy and token bindings:

- **Code → contract**: the css-module adapter inverts the generator's emission
  model (class nesting → parts, `var(--a-b-c)` → `{a.b.c}` refereed against
  the real token tree, variant-class families → substituted refs, pseudo-class
  rules → states, uncontrolled-toggle pattern → events).
- **Design → contract**: the node-tree dump proposes contracts from the drawn
  structure (variable bindings → token refs, per-variant enum substitution,
  spacers reconstructed with visibility conditions, propRefs → text/slot/
  optional parts, nested instances → component refs).

The proof standard is **round-trip identity**: this repo's own generated
components re-extracted and compared to their shipping contracts. Badge,
Switch, Card: **zero mismatches in both directions** (code: 28 matched /
21 code-absent named; design: 82 matched / 31 canvas-absent named), red-tested
— a retokenized property, a deleted part, or an uncorrelated cross-variant
binding each fail by name. Unbound/raw values are always reported with
nearest-token candidates, never invented. Receipts: `extract/ROUNDTRIP-CODE.md`,
`extract/figma/ROUNDTRIP.md`. **Eval suite: 54/54.**


---

**Standing scoreboard** (updated with each milestone):

| Claim | Mechanism | Receipt |
|---|---|---|
| Determinism | golden manifests, byte-compare | `evals/golden.json` |
| Refusal | illegal contracts fail by name | C2 eval family |
| Detection | every claimed drift class has a failing test | C3 eval family |
| Convergence | promotion round-trips | C4 eval family |
| Brownfield | 4 external systems extracted/diagnosed | `extract/pilots/` |
| Non-destructive sync | in-place amend, IDs preserved | CBDS + Instance Lab forensics |
| Theming | brand = token layer only | `brand-added-token-layer-only` eval |
