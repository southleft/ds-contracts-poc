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
pending-first-sync parity classification. **Eval suite: 60/60.**

## 2026-07-08 — Code Editor Simulator (Hub)

New `#/editor` page demos what a contract-governed in-tool code editor
experiences: a live contract JSON editor validated on every keystroke against
the actual `ContractSchema`, with consequences computed deterministically
client-side — API diff, an amendSet-mirrored canvas plan (ADDED/REBUILT/
EXTRA-reported over the enum cartesian product, all-defaults combo first), and
spec-policy version advice. Illegal edits are refused by the schema's own
names and never reach either surface; both keep rendering the last governed
version. Dashboard-only change; 60/60 evals unaffected.

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
**Eval suite: 60/60.**


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
`extract/figma/ROUNDTRIP.md`. **Eval suite: 60/60.**


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

**Eval suite: 60/60.** Launch gate (per TJ): no public launch until the
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
surface — the ladder held under real rate limiting. 60/60, no core changes.


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
planned scope (W1–W10) is complete.** 60/60.


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
A plain help drawer covers every way in. 60/60, no core changes.


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
place. 60/60 throughout; verified both themes.


## 2026-07-08 — Playground grows a workbench feel

The rail nav scrolls instead of wrapping (bottom border back on the shared
37px line), the three panes resize by draggable gutters (persisted,
keyboard-nudgeable, min-width honest), code surfaces step up to 14px/13.5px,
and Prism paints everything: the output panes (one 8.4 kB gzip lazy chunk,
our own Carbon-muted token palette on playground variables — no stock theme)
and the contract editor itself, where the metric-locked refusal backdrop
becomes the visible highlighted text under a transparent-glyph textarea —
caret, selection, and refusal-line highlighting all intact, verified
numerically in both themes. 60/60.


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
**60/60.**


## 2026-07-09 — The assist layer goes live (AI under governance, on a budget)

workers/assist deployed: three Opus 4.8 endpoints — repo fetch-planning,
minted-token semantic naming, and a cached repo-profile memory (7-day KV,
shared across visitors, zero-token hits) — behind forced tool schemas,
thinking disabled, CORS locked to the playground, 5 requests/day per
visitor, and a ~$10/day global budget with named 429s. The owner's key
lives only as a Worker secret. First live call: asked to rename two minted
tooltip tokens, Opus proposed color.surface.inverse and
color.content.inverse with pairing rationale — design-system judgment,
refereed by the same schema as everything else. 21/21 handler tests;
one workerd gotcha (unbound fetch = Illegal invocation masked as 502)
found by the live smoke and fixed.


## 2026-07-09 — The Enterprise gap closes on any plan (desktop MCP path)

Figma desktop ships a local Dev Mode MCP server whose variable access is not
plan-gated. The new import path joins its flat name→value defs against REST
structure — set scope first, per-node subtree refinement, a name resolves
only when exactly one candidate survives every occurrence, ambiguity
receipted and minted rather than guessed. Live receipts: Badge resolves all
13 variable ids and lands IDENTICAL to the plugin-dump comparator verdict;
the Eventz Alert recovers foreign vocabulary ({spacing.4}) and its U+2024
variable fires the grammar refusal through the new path. CI-safe via
recorded fixtures; the future remote transport reuses the join unchanged.
The fidelity ladder is now: desktop MCP / plugin dump / REST+minting —
every rung named in the receipts. **60/60.**


## 2026-07-09 — The degraded import stands up straight (v0.3.0)

A non-Enterprise Figma import now renders styled — minted `imported.*`
tokens are a live layer over the active source, listed in receipts,
renameable via the assist Worker with every apply refereed by the same
editor. The code side goes directory-first: imports traced and receipted,
gaps named, AI as the explicit next rung with repo profiles cached per
repo@ref. Stale previews, stale chunks, and the fidelity ladder each got
their honest UI. The owner's two field failures became the acceptance
receipts: the Shoelace-Tooltip class of import renders colored, and the
CBDS Button imports clean over live network in both URL forms. **60/60.**


## 2026-07-09 — The loop closes on the canvas (v0.4.0)

The contract got its design side on screen — Code | Canvas | Split, the
figma engine's variant grid rendered on a true white canvas with a
Light/Dark/Checker surface. Code imports caught up with Figma imports:
foreign var(--*) properties and raw literals mint the same imported.*
layer, with token stylesheets discovered across the repo tree (CBDS Button
imports STYLED at the fully deterministic rung — variant and size both
drive substituted refs). And the designer validation loop closed live,
owner-confirmed: a degraded import's Figma script upserts its provisional
variables first, builds the contract's version beside the original in the
source file, and the Sync Runner's paste box ends every run on the canvas —
zoomed to what it built, or plain words plus Select-it when it already
exists. **60/60.**


## 2026-07-09 — Ground truth on screen, chrome out of the way (v0.5.0)

The canvas got its referee: for Figma-imported contracts, a "Figma render"
toggle fetches the node's OWN render (images API, PNG @2x) beside the
compiled canvas — "Figma's own render" vs "compiled from the contract" —
the anchor riding the contract, the token session-only, and every
non-fetch state named (no source, token gone, rate limit, node deleted
since import — that last one observed live). And the output pane went
Storybook: one toolbar row, Controls | Receipts (N) in a collapsible
bottom dock, fidelity notes behind an info popover. **60/60.**


## 2026-07-09 — One foreign Button, three engine lessons

The owner's Eventz Button import taught the engine a pattern and killed
two failure modes: variants that solely wrap an instance of a shared base
component now FLATTEN (captured properties promote to real contract props
with exact Figma spellings — hasEndIcon stays hasEndIcon), a nested
instance of the set itself never emits a component ref, and a component
ref cycle refuses by name at the generator ("a contract cannot compose
itself") instead of blowing the stack — the crash observed live during
the owner's hand-fix. Unconfirmed patterns degrade to named skips that
still generate. **60/60.**


## 2026-07-09 — The fidelity matrix: URL in, styled truth out, scored

The charter's scored acceptance pass (`extract/fidelity-matrix/SCORECARD.md`):
four real components — Shoelace Tooltip and Button Group, the Eventz Button,
and the CBDS Button on both sides — imported live, proposed, emitted on every
surface, and scored against **their own captures** (props vs the dump's
property definitions, style facts vs resolved node values, D-convergence
design-proposed vs code-proposed, Figma-API PNGs vs emitted-preview renders).
Committed fixtures replay every number offline. Result honestly read: **0
style-value mismatches across 334 fact-cells**; the losses live in what the
capture drops — named as 12 gaps with causes and an ordered punch list.

Punch items 1, 2, 3, and 5 then landed, receipt by receipt: dump v1.1
captures paint alpha and node visibility (Eventz secondary/bare render the
near-white truth via 8-digit-hex minting; `paint-alpha-dropped` retired); the
one engine crash in the matrix became a named refusal; icon-toggle booleans
on component-ref parts survive into contracts; identifiers sanitize at
proposal instead of refusing at emit; and contract-less child instances ship
auto-proposed STUBS — turning the CBDS design proposal green on all four
surfaces without guessing a child's API. D-convergence stands at 12/19 style
facts in byte-agreement, each divergence attributed to the side that owns it.
**60/60.**

## 2026-07-09 — "This is a freaking button" (semantics + state promotion)

An owner field test exposed the worst failure class the project recognizes:
a component set named **Button-Brand Primary** imported as a non-focusable
`div` with a fake `state` enum prop and a first-variant font size shipped as
a constant for every size — plausible-but-wrong values wearing the costume of
truth. Three root causes, all fixed at the source, none with AI:

- **Deterministic semantics inference** inside `proposeFromDump` — a pure
  name/axis table (button/link/tooltip/heading/switch/…; `*group*`
  deliberately excluded; an interaction-state axis alone corroborates
  `button`). Every hit is a named review note; no hit stays `div` with the
  hedge. Emitted React is a real `<button>` on `ButtonHTMLAttributes`.
- **State-axis promotion** — a drawn `state=default|hover|focus|pressed|
  disabled` axis is the platform's interaction vocabulary, not API: it never
  ships as a prop. hover/pressed/focus become real `states` overrides
  (through the same mint pass, substituted refs per remaining axis),
  `disabled` becomes a native boolean, a stroke-only focus child inverts to
  the outline pair, and `figmaStatePreviews` round-trips the axis to canvas
  (the rename documented honestly in a proposal note).
- **Typography-uniformity guard** — style identity is adopted only when
  fontSize and weight agree across every variant; otherwise per-variant
  minting. The 16px-everywhere constant is dead: the acceptance receipt
  asserts **numeric equality** of emitted padding and font-size against the
  live REST dump per size variant (small = 12px inline / 14px type, large =
  16px / 16px), and pins that the values genuinely differ across sizes.
- **Playground stub registration** — the engine already proposed child stubs;
  the playground dropped them. `stub-contracts.ts` registers them
  (provisional, labeled, never overriding repo contracts), so the owner's
  `ds.icon has no contract in scope` refusals cannot recur.

Verified live in the deployed playground: Tab focuses a real button showing
the `:focus-visible` ring; controls show `size/text/iconLeft/iconRight/
disabled` and no state control. Fidelity matrix re-scored under the promoted
vocabulary: D-convergence **15 AGREE / 0 DIVERGE** (font-size small moved
DIVERGE→AGREE at 14px — the owner's exact complaint). Receipt:
`npm run extract:figma:cbds:check` (36 checks) on a committed live fixture.
**63/63.**

## 2026-07-10 — The tooltip renders whole (shape geometry + text channels)

Second owner field case, same file: his CBDS Tooltip imported clean but drew
no shadow (canvas had no box-shadow projection — a named v1 limit), no arrow
(the pointer is a rotated `REGULAR_POLYGON` — the receipted #42 class), and
an unbolded title (font-weight only carried via token-derived style
identity). All three became carried channels: dump v1.3 captures parametric
shape geometry (kind, intrinsic size, rotation, absolute placement +
constraints); contract v9 adds a bounded `Part.shape` with ONE shared CSS
projection so React/HTML/inline/canvas cannot fork, and the Figma script
constructs a *real* rotated polygon with a native DROP_SHADOW; per-variant
pointer placement is spelled from Figma's own constraints so it generalizes
with content; a fixed weight-name table (Semi Bold → 600) and PIXELS
line-heights mint when no style identity matches. The #42 receipt narrowed
to its true residue (freeform vectors, stars, boolean ops). Receipt:
`npm run extract:figma:tooltip:check` (30 exact-value checks) on his live
node; Playwright probed 8 placed arrows + 1 honest suppression, shadow on
all 9 bubbles, computed 600/16px. **67/67.**

## 2026-07-10 — Send to Playground (the Enterprise gap closes for everyone)

The plugin gained a bridge: a 6-char pairing code minted by the playground,
the repo's dump script embedded VERBATIM in the plugin (a build-time drift
guard refuses to package a stale copy — it fired on its first merge, catching
the v1.2→v1.3 bump, and was right), a one-time-read relay on the assist
worker (15-min TTL, 4MB cap, own kill switch, contents never logged), and a
downloadable plugin zip with an install walkthrough in the Figma tab. The
two import routes are now positioned honestly: URL+token = quick, values
exact, names receipted; plugin = full token NAMES and values on any Figma
plan. Live contrast: the same import = 0 `variable-unresolved` via the
bridge vs 50 via degraded REST. 45/45 worker tests; e2e proven without
Figma (simulated plugin POST → playground imports real token bindings).

## 2026-07-10 — The chain closes: his send, zero refusals, his tokens rendering

The owner's sixth field test walked the last unbuilt link. His plugin send
arrived semantically right (element button, states promoted, real token
names bound) — and the referee refused all nine of HIS names because it
knew only the repo corpus. Three fixes closed the chain: dump v1.4 carries
each bound variable's **resolved value** (`_variables`), and the playground
registers captured variables as an import-scoped token layer (repo tokens
win collisions, by name; the whole layer receipted, persisted per workspace
entry). The padding/height drop was root-caused honestly — the owner's
state-variant hypothesis was disproven by replay; the true cause was
name-level-only substitution in `unifyRefs` (`spacing.200` can't spell
"large") — fixed with value-level correlation over one enum axis
(injectivity not required) carried as schema-v10 `tokensByProp` on every
surface. Literal min/max sizing carries (his 44px tap target renders;
the degradation retired). Receipt: `extract:figma:cbds:bridge:check`
(60 checks) — ZERO refusals where he saw nine (the refusal reproduced as a
control), background #0e61ba from HIS `{bg.brand.default}`, hover/active/
disabled/focus from his state tokens, padding-inline 16/12px and heights
48/40/32px per size from `{spacing.*}`/`{component-size.*}`, min-height 44,
a focusable `<button>` — verified live in the built playground through the
bridge seam. **72/72.** The import frontier is now FROZEN by decision:
field fixtures are the standing acceptance suite; the next deliverable is
the confidence artifact, not features.

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
