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
pending-first-sync parity classification. **Eval suite: 57/57.**

## 2026-07-08 — Code Editor Simulator (Hub)

New `#/editor` page demos what a contract-governed in-tool code editor
experiences: a live contract JSON editor validated on every keystroke against
the actual `ContractSchema`, with consequences computed deterministically
client-side — API diff, an amendSet-mirrored canvas plan (ADDED/REBUILT/
EXTRA-reported over the enum cartesian product, all-defaults combo first), and
spec-policy version advice. Illegal edits are refused by the schema's own
names and never reach either surface; both keep rendering the last governed
version. Dashboard-only change; 57/57 evals unaffected.

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
**Eval suite: 57/57.**


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
`extract/figma/ROUNDTRIP.md`. **Eval suite: 57/57.**


## 2026-07-08 — Playground Phase 0: the engine becomes a library

Foundations for the public browser playground (playground/PLAN.md), both
golden-guarded — CLI output did not change by a byte:

- **`core/` barrel, browser-importable**: schema, token corpus, both
  proposers, and four emitters behind a pluggable `Emitter` interface —
  `react` (the shipping generator), `html` (no build step), `react-inline`
  (every token resolved to a literal — the zero-infrastructure tier), and
  `figma-script` (the canvas is just another emit target). Receipted by a
  platform=browser bundle + VM run with zero node globals.
- **Figma REST → dump mapper**: figma.com URL + token imports a component
  set without the plugin — the REST-mapped Badge dump is byte-equal to the
  live plugin dump, and the Enterprise-gated variables endpoint degrades to
  resolved literals with a named taxonomy and zero fabrication.

**Eval suite: 57/57.** Launch gate (per TJ): no public launch until the
Figma-URL import works end-to-end in the browser UI.


## 2026-07-08 — The loop runs in a stranger's browser (preview)

`playground/` deployed to https://ds-contracts-playground.pages.dev — a public
Vite app importing `core/index.ts` unmodified: a gallery of 10 live-emitted
examples, a governed contract editor with both refusal layers named on screen
(zod shape errors AND generator refusals like a nonexistent token ref), all
four registry emitters as output tabs with the html emitter doubling as the
live preview, code→contract behind a lazy TypeScript chunk, and the Figma-URL
import UI (session-only token; the degradation ladder rendered as first-class
receipts) verified end-to-end against committed REST fixtures through the same
`importFromUrl` the CLI runs. Browser-direct api.figma.com confirmed
CORS-viable. Initial bundle 152 KB gzip. Screenshot-verified live.
**Preview status: launch is gated on one real Figma-URL import with a live
token (per plan).**


## 2026-07-08 — Playground Phase 2: live-network imports, bring-your-own tokens

Paste a public GitHub file URL and the co-located stylesheet is
auto-discovered; every failure named — 404, rate-limit with reset time,
too-large, not-TSX. Paste your own DTCG trees and the whole loop rebinds:
proposals, nearest-token suggestions, inline literals, and a preview
stylesheet regenerated in the browser from the paste — while contracts
referencing repo-only tokens refuse by name. Verified against this repo's
own Badge **over the real network**: the proposed anatomy byte-matches the
shipping contract, in a stranger's browser. A genuine transient 429 during
testing was surfaced honestly and the proposal degraded to the props
surface — the ladder held under real rate limiting. 57/57, no core changes.


## 2026-07-08 — Playground Phase 3: the loop starts from nothing

A sentence and a user-supplied Anthropic key now produce a governed
contract: browser-direct claude-sonnet-5, generation constrained by a
forced tool call against a pruned contract schema with the ACTIVE token
inventory in the system prompt — the model can only propose what the
system can govern. Invalid output is refused by name and sent back as
user-triggered fix rounds (max 2, counted, receipted with model id and
token usage). A keyless fixture demo rides the same transport. Any
contract travels as a ~1 KB URL hash (deflate + base64url, 8 KB named
guard); first visits get a three-action guided strip. **The playground's
planned scope (W1–W10) is complete.** 57/57.


## 2026-07-08 — LAUNCHED: both credential-gated paths verified live

The two receipts the launch gate demanded, both against real endpoints with
real credentials (env-file, never in chat, never printed):

- **Figma URL import, live**: the Eventz Alert fetched from api.figma.com
  through the deployed import chain (`importFromUrl` → REST mapper →
  proposer). The token's plan hit the Enterprise-gated variables endpoint
  exactly as most visitors will — and the ladder held: every binding degraded
  to a named `variable-unresolved` report, gradients hit `paint-unsupported`,
  the proposal carried the full structure and API with 6 UNBOUND entries and
  nearest-token suggestions, zero fabrication. Paired with the earlier
  bridge-path run (which recovered Eventz's own token vocabulary), both
  degradation tiers now have live receipts on the same component.
- **Describe transport, live**: one real api.anthropic.com round trip with
  the module's own tool schema — HTTP 200, forced `tool_choice` honored,
  `thinking_tokens: 0` (the disabled-thinking pairing works), 4,545 prompt
  tokens (matching the design estimate), and a genuine `ds.stat-block`
  contract with the right props in the expected nested shape.

The playground is **launched**: https://ds-contracts-playground.pages.dev


## 2026-07-08 — Playground: refusals point at their line; imports collect in a workspace

A refusal now lands three ways: named under the editor, as a danger
background on the offending line (dependency-free textarea overlay — zod
paths walked, generator quotes anchored, unresolvable refusals highlight
nothing), and as a click that scrolls there. Every load remembers its
pristine original (one-click Reset; the onboarding strip gains the reset
step). Every successful import — Figma, code, prompt, JSON — lands in a
session workspace (capped at 30 with named eviction) that restores contract
+ receipts and tells the design↔code switch story in one dismissible line.
A plain help drawer covers every way in. 57/57, no core changes.


## 2026-07-08 — Playground speaks designer

The Preview grows per-prop controls (a single instance at any chosen state,
rendered by the same html emitter via defaults-substitution — one renderer,
zero drift; honest "no visible change — by design" notes; the all-variants
grid one segment away). The Contract pane gains a JSON | Spec toggle
rendering the same contract as a read-only spec sheet — props table,
variants with combination count, slots resolved to names, events, grouped
token chips, a11y — stale-on-invalid, refusals visible in both views. Every
gallery card teaches with a fact-checked "What to notice" caption; the help
drawer gains a seven-term glossary; first-session jargon explains itself in
place. 57/57 throughout; verified both themes.


## 2026-07-08 — Playground grows a workbench feel

The rail nav scrolls instead of wrapping (bottom border back on the shared
37px line), the three panes resize by draggable gutters (persisted,
keyboard-nudgeable, min-width honest), code surfaces step up to 14px/13.5px,
and Prism paints everything: the output panes (one 8.4 kB gzip lazy chunk,
our own Carbon-muted token palette on playground variables — no stock theme)
and the contract editor itself, where the metric-locked refusal backdrop
becomes the visible highlighted text under a transparent-glyph textarea —
caret, selection, and refusal-line highlighting all intact, verified
numerically in both themes. 57/57.


## 2026-07-08 — The ladder keeps your styles (minted provisional tokens)

Field finding (Shoelace Tooltip import, non-Enterprise plan): 129 named
degradations and a naked preview — the variables endpoint is gated, and the
proposer rightly refuses to invent bindings from raw values. The missing
rung: resolved values now MINT a provisional DTCG tree named by usage site
(`imported.tooltip.body.background-color`), deduped, per-variant where values
track an axis — and the proposal binds to it. Nothing semantic is ever
guessed: names never leave the `imported.` namespace, every minted ref is
flagged for rename, and renaming against your real tokens IS the adoption
workflow. Degraded-Badge receipt: 13 leaves, zero unbound, emitters green.
**57/57.**


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
