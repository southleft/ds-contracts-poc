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

## 2026-07-10 — The gauntlet: his whole kit, censused to 100%

The owner asked for proactive class coverage instead of failure-per-test.
Three parallel audits delivered it: an **engine capability matrix**
(expressible vs proposed vs rendered per surface — surfacing the
never-proposed free wins: overlay, icon parts, arrayOf, number props, and
the name-only session-linking gap), a **pattern taxonomy** across a dozen
design systems (25 composite patterns crossed against the vocabulary,
APG role graphs for 22 composites, theme/mode-axis promotion rules, an
11-item DON'T-infer list, native-Figma-slots addendum), and the
centerpiece: **the census** — his entire CBDS kit live-recaptured at dump
v1.4 (1,618 sets, 127 variables, zero stale) and replayed through the
full pipeline, every failure classified and ranked by frequency.

Starting score: 1,577/1,618 whole-kit, **48/76 composites (63.2%)** — the
measured explanation for "every test finds an issue" (his random draws
had ~10% odds of five clean composites). The Dialog batch (global part
dedup, canvas border-box + root tokensByProp, code auto-renew, AI-removal
guardrails) took composites to 75.0%. The class-fix batch (unmappable
child props dropped-with-note, boolean visibleWhen truthy form with the
false side named-inexpressible, digit-led prop prefix, and a figma-script
referee guard the census itself exposed) finished it:
**1,618/1,618 — 100.0% — and 76/76 composites, zero named residue.**
`npm run extract:figma:gauntlet` is a standing deterministic instrument;
class fixtures are retained for regression replay. **79/79 evals.**
Next: the taxonomy's ranked richness program (repeat/arrayOf collections,
theme-axis promotion, slot capture pass incl. native slots + session
linking, overlay inference) — richness, not refusals.

## 2026-07-11 — Pixels as receipts: the visual-parity instrument, and the fix queue it opened

Refusal-free was never the same claim as pixel-right, so the gap got its own
instrument: `npm run extract:figma:visual` renders every subject variant in a
real Chromium, fetches Figma's own PNG of the same node, and scores the pair
with pixelmatch — twice, the second score masking text rects so cross-renderer
font rasterization can never flatter or damn a result. Cross-renderer deltas
(glyph hinting, antialiasing, blur kernels, fractional-pixel layout) are NAMED
in the report header, handled by masking — never by a fatter threshold. The
baseline was honest and ugly: **115 variants diffed, 40 over the provisional
10% line**, and the worst rows were real defects, not noise — focus rendering
the pressed fill on the owner's button, the dialog losing its panel chrome,
literal slot placeholder text rendering as content.

The queue drove three merge batches. Native controls: Checkbox/Switch 2.0.0
render a real `input[type=checkbox]` (indeterminate set as the DOM property via
callback ref; Space toggles natively), plus a standing semantic lint —
`NATIVE_ROLE_HOSTS` refuses role-on-non-native by name, with declared
`roleException` as the governed escape (evals 79→81). A playground surface
batch closed 12 adversarial-review defects, including caption drift fixed at
the root: display captions are now DERIVED from the contracts, with an eval
refusing future hardcoded counts (81→82). The engine-fix batch landed six
pinned defects — the switch canvas thumb, state-preview opacity literals,
empty slots rendering empty, UA-margin neutralization, `a11y.minHitArea`
ENFORCED (the `::before` hit-target floor, previously aspirational), and
ds.token's dead size prop made live — each with its own eval, golden updates
reviewed ×3 (82→88). Residue, named: the re-run improved the original worst-10
out of the list and exposed the next queue top — shoelace-button-group's 36
variants, newly measurable at 95–98% masked because child buttons weren't
resolved (the composite-children problem, below). **88/88 evals.**

## 2026-07-12 — The enterprise code gauntlet: Carbon, Fluent 2, Spectrum, Polaris

The owner's mandate: pretend it's Carbon, Fluent, Spectrum, Polaris. The
gauntlet didn't pretend — it RAN all four, shallow-cloned at pinned SHAs,
through the unmodified pipeline (`extract/pilots/ENTERPRISE-GAUNTLET.md`;
nothing tuned to make the numbers better, every workaround named). Starting
truth: Carbon 20/24 with three silent losses, **Fluent 0/23** (every shipping
component invisible behind sibling `types.ts` files and `ForwardRefComponent`
casts), Spectrum via CEM 22/22, Polaris 23/23 with **5 silently hollow** — and
two of those classes violated the nothing-silent invariant outright:
`as`-expression exports vanished without a note, intersection-of-named-refs
props extracted hollow. A nameless CEM event crashed the run over Spectrum's
1,264-module manifest. Raw DTCG ingest: 0% on all four token sets (all publish
plain values; the spec wants `$value`).

The fix batch made the type-legibility tier real: sibling-type-file resolution,
cast transparency, cast-alias and intersection-named-ref rules take **Fluent
0→23** and Polaris hollow 5→0 with named heritage receipts (Carbon silent
losses 3→0, TextField 0→35 props); nameless CEM events become named skips
(crash → exit 0); one function-prop rule shared by propose AND diagnose kills
26 false findings on foreign libraries; and `wrap-plain-tokens` loads all four
enterprise token shapes via a mechanical `$value` wrap, offered in the
playground's Tokens tab (live Polaris bind: 351→71 foreign notes, 0→48
bindings). Residue, named: fact coverage is honest, not flattering — Carbon
78%, Spectrum 73%, Polaris 57% of facts carried; the ranking put code-side
type legibility ABOVE the taxonomy's richness program, which is why this
batch jumped the queue. **93/93 evals; golden and the design census untouched.**

## 2026-07-12 — Composite children render real: dump v1.5 + session linking

The shoelace queue-top and the dialog's flat children were one defect class:
component refs rendered as named boxes, not as their contracts. Dump v1.5
captures what linking needs — `instanceKey`/`instanceSetKey` (identity that
survives renames), bounding boxes on instances and variant roots, boolean
property defaults, `swapPreferredValues`, native SLOT nodes, and
`_provenance.dumpVersion`; the plugin UI re-embedded it behind the drift
guard. `resolveChildContract` links key-first with name fallback NOTED — and a
name match that contradicts the key REFUSES, never guesses. Linked refs now
render the child's real anatomy with applied + threaded `{parentProp}` props;
unlinked refs render honest stubs at OBSERVED geometry via minted
`imported.stub-*` tokens instead of naked boxes; workspace imports join the
propose scope through a session registry, so importing the child set upgrades
the parent's stubs to real renders.

The parity meter moved the way the claim said it should: shoelace-button-group
36 rows median **92→8.2%** masked (sizes Δ0), eventz width Δ−82→Δ0–6
(boolDefaults render the icons that were silently hidden), dialog large
5.6→0.6%; the >10% bucket **73→47** (the bucket had grown 40→73 as previously
refusing rows became measurable — both moves honest). Residue, named: two
dialog regressions stay on the queue — instance-level FILL overrides on refs
are a vocabulary limit, and stub widths correlated with a parent axis render
one observed width. **96/96 evals; census 1,618/1,618 regen reviewed.**

## 2026-07-12 — The proposer trio: modes, collections, overlap (dump v1.6, schema v12)

The taxonomy's ranked richness program, shipped as three proposers in one
merge. **Theme/mode-axis promotion (P17):** a drawn Theme|Mode axis with
values inside the light/dark/high-contrast vocabulary, STRUCTURALLY
corroborated (identical anatomy + identical bound variable names across the
axis), is a token mode, never a prop — the axis leaves the API, mode-excluded
variants never feed the mint pass (no fabricated second palette), and dump
v1.6 captures collection modes with alias resolution so promoted bindings
resolve per mode. Near-misses stay props BY NAME, never guessed. No themed set
exists in the owner's kit — checked, so the fixture is synthetic in the CBDS
shape and says so in the receipt. **Repeated-children collections (P9, schema
v12):** ≥3 adjacent siblings of the same child with a homogeneous applied-prop
shape propose as ONE item-template part plus a code-only `arrayOf` prop —
React maps the live array, static surfaces render the OBSERVED sample as the
collection's honest static state, field carry rules deterministic and named
per skip. **Negative-spacing overlap (P21):** uniform-negative auto-layout
spacing inverts to `layout.overlap` carrying the drawn magnitude (the
ds.avatar-group owner-precedent); a negative-px gap token — invalid CSS,
silently ignored — can no longer mint anywhere; mixed-sign spacing is a named
limit.

Census re-run: **1,618/1,618 HOLDS**, zero violation deltas — 11 sets GAIN P9
receipts, 2 propose repeat (their per-sibling note piles collapse, 65→46 and
18→11), total named notes 5,414→5,496. Parity: zero moved rows. The v1.6
re-embed was initially missed — and the plugin zip drift guard refused the
build until the canonical script was re-embedded, exactly as designed, third
time it has fired. **99/99 evals.**

## 2026-07-19 — Published: the spec has an install command

`@ds-contracts/schema` 15.0.0 and `@ds-contracts/cli` 0.1.0 are live on the
public npm registry under the `ds-contracts` org — the first shipped artifacts
of the Two Journeys product. The CLI carries the whole surface as one
zero-required-dependency binary (`init / extract` incl. the lazy computed
floor `/ generate --out --target --emitter --stories / figma` + `figma push`
through the bridge `/ diff` with CI exit codes `/ propose-pr`), every verb
eval-pinned by a consumer-style smoke test that runs byte-stable twice from a
scratch directory. The emitter registry is open (`registerEmitter()` — four
built-ins unchanged, plugins appear in every consumer automatically), the
schema package ships the live Zod document + generated JSON schema
byte-identical to the repo's, and the publish was stranger-verified: a clean
directory, `npm exec @ds-contracts/cli`, a working config in one command.
**115/115.**


## 2026-07-19 — Phases 3+4: CI recipes execute verbatim — and catch a real emitter defect

The CI recipes (`examples/ci/`) are code-led and design-led GitHub Actions
workflows over the **published** `@ds-contracts/cli@0.1.0` — and their
validator executes every `run:` step locally, verbatim, in scratch consumers
built from committed fixtures. That discipline paid immediately, defect
first: **the react emitter emitted invalid JavaScript for hyphenated part
names** — `styles.label-2` parses as subtraction, a runtime ReferenceError —
and the committed Polaris showcase output already carried it. Grep-level
checks cannot catch this class (the defect parses); execution did. The fix
(bracket access for non-identifier part names, identifier names byte-stable)
landed with an eval that **executes** both emitted modules through esbuild +
react-dom/server. Alongside: the two journeys became standing E2E gates —
`journey-engineer` (committed CBDS dump → real propose path → the local CLI
build runs the manifest command → emitted story rendered in a real browser,
11 computed-style checks against the bridge-receipt Figma ground truth) and
`journey-designer` (committed Polaris Badge → figma-emit → headless canvas
compile → dry-run push through the real worker pipeline, zero network) —
both reading their command lines ONLY from
`evals/fixtures/journey-commands.json`, the docs-drift seam. **117/117 at
merge.**


## 2026-07-19 — Phase 6: a third code surface (the WC emitter)

`emitter-web-components` 0.1.0: contract → vanilla Custom Elements, zero
runtime dependencies, through the same open registry any consumer already
loads. The closure receipts are the point: `wc-emitter-roundtrip` re-extracts
the emitted elements through the existing CEM adapter and lands back on the
contract, and `wc-emitter-css-parity` renders the react, html, and WC
emissions of the same contracts in a real Chromium — **165/165 computed
channels equal across emitters** (3 subjects, 15 showcase items, 0
mismatches). One contract, one computed truth, three code surfaces.
**123/123 at merge.**


## 2026-07-19 — Phase 2: the plugin becomes an engine host (plugin v2)

The Figma plugin grew from a dump/bridge conduit into six tabs — Generate,
Update library (with a mandatory plain-words report before any apply), and
Propose with a PR dry-run, beside the original send paths. The engine ships
INTO the plugin as a 0.41 MB bundle (core barrel + baked tokens/contracts/
icons, vs ~5 MB of full core) guarded by a committed input-hash receipt: the
zip build **refuses a stale engine by name** — and the guard fired correctly
on its first post-merge re-record, exactly as designed. A 407-line
mocked-figma harness executes the REAL bundle in a VM: generate runs the
tokens/component/version scripts (stored specHash equals the engine mirror),
the update report and amend-in-place apply are pinned verbatim, the embedded
dump script round-trips to a proposal diff, duplicate-contract-id bundles
refuse by name. Three eval pins. Residue named at merge: the worker's
receive path for plugin reads — closed days later by the **bridge origin
policy** (DUMP reads stay playground-only and refused reads never consume
the one-time payload; CONTRACTS-BUNDLE reads deliver to any origin because
the pairing code IS the auth; session minting open with per-IP limits;
53/53 worker tests). **121/121 at merge.**


## 2026-07-19 — Round 5c: the canvas gate goes 2/10 → 7/10, three at EXACT 0.00

Round 5a had taught the canvas engine to draw what the v0.3.0 contracts
carry (thirteen renderer/compile classes plus gate-harness truth fixes,
including a checked-mount bug that had every real Checkbox cell rendering
checked) — Badge 0.07% and Thumbnail 2.16% PASS, and the honest diagnosis
that the remaining eight causes were **promotion-level**, not rendering.
Round 5c fixed those six causes at the source — complement-of-product
presence (Tag's label subtree), root-hosted svg plans (Spinner's glyphs),
carried-channel re-mint when a defaultless axis contests the reviewed
carriage (Button's tone×variant paints), shape geometry recarried from
captured truth, authored-viewBox unification (Avatar), drawn pseudo-element
decor as shape parts (the RadioButton dot) — plus text-part typography
always carried (the 13px-vs-14px class). Contracts promoted **v0.3.1**; the
gate re-earned in a harnessed run: **7/10 acceptance PASS (was 2/10), with
Avatar, RadioButton, and Spinner at EXACT 0.00**, zero blank-deceptive
passes, zero unnamed >10% cells. The residue is named, not hidden: Button's
fully-masked font-raster cells, ProgressBar's runtime-% indicator, Tag's two
state-preview-vs-resting cells. The standing pin moved to the 5c numbers —
a legitimate pin move, re-earned by the run it quotes. **124/124.**


## 2026-07-19 — Round 5b: the verdict build

The owner's Polaris Contracts file rebuilt **live** from the v0.3.1
contracts: 10/12 sets amended IN PLACE — node id and key stable, including
the 220-variant Button — and the 2 exceptions were named promotions
recreated by the script's own policy, operator-retired. The Round-5c wins
render on the real canvas: Avatar initials + palette + square, the
RadioButton ring and dot, Spinner's #303030 arcs, the Checkbox check glyph,
Tag's Wholesale label, Button tone×variant fills with native shadow-button
effects (the B-3 ring loss retired), the Banner tone ribbon (the loudest B-3
gap retired). Two engine findings were named and canvas-corrected to the
compiled spec (a shape-literal fill drop — exactly one node repo-wide — and
checkbox glyph z-order). All 12 canvas notes rewritten to round-5b truth, 12
fresh surface composites committed. **The owner's first positive verdict on
a live canvas build.** Evals 124/124, `results.json` byte-unchanged.


## 2026-07-20 — The owner's live review: four visual classes → Round 5d

Defect-first, because the finding was a defect — four of them. Reviewing the
verdict build live in Figma, the owner found four visual classes the
CSS-rendering gate had scored past: the Checkbox check drew as **segmented
capsules** (Polaris's pathLength-relative dash animation channels, rebased by
computed-style capture onto the real path length); control-to-label gaps sat
**flush** and the Badge pip drew **oversized** (spec margins were a
preview-only fact the sync runtime never applied on canvas); the Banner
focus ring drew **bottom-only** (outline respelled as an inside-aligned
border that opaque children paint over); and Badge's radius and pip
**inspected as bare literals** instead of their tokens (shorthand coverage
minting sibling longhands over the semantic binding; svg import baking
paints). A gate that passes while the owner's inspector disagrees is a gap
in the gate's coverage, and it is recorded as such. Round 5d — two
extraction-layer and four emitter/runtime-layer root-cause fixes — answered
same day, below.


## 2026-07-20 — Astryx Phase A: the second system, refereed by its vendor's own docs

The second-system assessment ran four candidates hands-on and picked
**Astryx** (facebook/astryx — Meta's MIT-licensed React + StyleX system,
shipped with per-component `.doc.mjs` prop/anatomy tables). One finding
recorded rather than shaded: **Nord posted the best numbers ever measured
here (22/22 @ 100% median) but its license is proprietary — disqualified for
a public exhibit.** Phase A, all proposals-only, nothing promoted:

- **Census 23/24 @ 57% median → 24/24 @ 65%**, library-wide 216 proposals /
  21 skips → 222 / 15 (all named), via two adapter rules with eval pins on
  synthesized fixtures: keyof-enum resolution (+29 enum props, 25 keyof
  receipts, 0 refusals) and union-of-refs composition (Slider recovered at
  82% — was a named skip). Selector still correctly refuses (generic
  branches).
- **StyleX token reader** (`core/stylex-tokens.ts`): 186/186 tokens from 13
  `defineVars` tables, `light-dark()` split into the v1.6 modes shape, 79
  mode-varying, 0 skips, drift-refusing regeneration script.
- **The `.doc.mjs` referee** — Meta's own shipped docs diffed against our
  proposals, neither side winning automatically: 246 vendor props across 24
  components — 136 agree, 53 not-carried CONFIRMED real by our own receipts,
  93 named disagreements **including 35 the vendor doc itself misses**
  (Button `href`/`target`/`rel`: undocumented but shipped), 0 silent. And
  the referee earned its keep against us too: it **caught a real adapter
  gap** — heritage of interfaces with their own members was dropped silently
  — now receipted and pinned.
- 9 docs-site screenshot fixtures banked for the Phase A-2 visual gates
  (politely captured, nothing diffed yet). **124 → 127 evals.**


## 2026-07-20 — The genesis reframe: there is no kit to reconcile against

The assessment recorded it plainly (`examples/astryx/PROVENANCE.md`): Astryx
has **no official Figma library** — only an unofficial community kit at
v0.14. So the exhibit's design-side leg is not parity against an existing
kit, and cannot be. The reframe: the pipeline will **generate the first
contract-governed Figma library** for a system Meta actually ships — genesis,
not reconciliation. This is the Two Journeys developer path demonstrated at
full length: npm-shipped source in, contracts refereed by the vendor's own
docs, and a design surface that exists *because* the contracts do.


## 2026-07-20 — Round 5d: the owner's four classes, fixed at the source

All four live-review classes root-caused and retired — two at the extraction
layer (svg **dash channels drop with a named receipt** — pathLength-relative
animation vehicles are not resting truth, so the check glyph is one
continuous round-cap stroke again; **shorthand coverage** maps every
constituent longhand, so the reviewed `border-radius` binding rules all four
corners and the `imported.*` sibling mints are retired) and four at the
emitter/runtime layer (**margins now apply on canvas** — uniform sibling
gaps bind itemSpacing to the margin variable, residual margins become a real
margin-box wrapper, so the Badge pip keeps the 20px pill; **outline lowers
to an OUTSIDE-aligned stroke** — the Banner focus ring wraps the full
banner including the tone ribbon's top arc; **single-paint glyphs ride
their contract variable** after svg import, so the inspector shows the
token, with the honesty note that Polaris's pip is genuinely NOT
text-colored on 6 of 13 tones). Promotion **v0.3.2**; the gate re-earned
with pins moved — Banner 4.60→3.17, Tag 29.97→22.55, everything else
holding, still 7/10 PASS with zero unnamed >10% cells — and the gate earned
its keep AGAIN mid-round: the ring-pair rule (outline previews require the
full color+width pair; a lone resting outline-color is inert in CSS) was
caught by the gate before pinning, twice. Two new eval pins; **129/129.**
Residue named: the live canvas was NOT touched this round — the margin-box
and svgPaintVar fixes become visible at the next bridge re-amend, and
`PHASE-B5-RECEIPT.md` records exactly what that re-amend will change.

## 2026-07-21/22 — The composite closes LIVE: advanced composition proven on a real canvas

The flagship stress test — `ds.composite-modal`, a multi-root Modal whose body
composes a Card instance and a repeated Badge collection — went from a
documented live FAIL (collapsed ~3px dialog, set-instance labels not applied,
crammed unstyled footer; handoff `08#1`) to a complete, correct LIVE build in
two days, with every fix following the fix→teach-the-mock→gate→live pattern:

- **Both morning root causes found headlessly, at line level** (no live
  debugging needed): the dialog collapse was the auto-layout **hug↔fill
  degenerate** (an align-unset flex container compiled `stretchChildren` and
  the runtime force-FILLed every child while the parent hugged — no intrinsic
  width anywhere). FILL is now a **compile-time decision** (`annotateFillW`)
  gated on the parent's width being established; the Banner mixed pattern
  survives by construction. The set-instance text failure was the create path
  minting TEXT/BOOLEAN/INSTANCE_SWAP properties **per-variant before
  `combineAsVariants`** — keys real set-instances never surface — while the
  amend path had always minted set-level; the create path now matches it, and
  an unmatched instance property is a **refusal by name**, never a silent skip.
- **The mock got the two blind spots that hid all of it**: computed
  auto-layout sizing (a FILL child contributes zero intrinsic size, so
  collapse is measurable in Node) and real component-property semantics
  (set-level definitions, variant-child refusals, instance subtree clones
  with TEXT/BOOLEAN reflection). Both classes now fail headlessly, forever.
- **Two real-Figma quirks were caught by the live runs and pinned by Desktop
  Bridge forensics** — and one earlier inference was **corrected in public**:
  the real quirk is that a freshly created instance's `componentProperties`
  can LAG behind its set within a session, listing only VARIANT axes (the
  named refusal read exactly `available: Variant, Size, State`); the set's
  `componentPropertyDefinitions` are always complete and full-key
  `setProperties` works during the lag (probe-verified). The runtime now
  falls back to the owner's definitions; the mock simulates the lag and the
  composite gate builds THROUGH it.
- **The exhibit contract grew up** (v1.1.0): footer actions are real
  `ds.button` instances with a control gap, the dialog carries a 480px width
  + surface tokens, and the backdrop is an inset-0 scrim painted BEHIND the
  dialog (anatomy order = paint order).
- **The determinism proof got ~42× stronger**: the round-trip fingerprint
  now serializes every tracked property (33.9KB byte-compared across two
  runs, run-scoped ids normalized) instead of names/types/nesting (807B).
- **Distribution stopped lying**: `npm run plugin:zip` now refreshes an
  unpacked `figma-sync/plugin-dist/` dev-import folder in place and injects a
  visible engine build stamp into the plugin header — after a live session
  silently re-validated a stale engine, staleness is now diagnosable at a
  glance. Generated components land on identity-marked background Sections
  (owner request), create and amend re-fitting the same section.
- **2026-07-22, the owner's live verdict: it did it.** 480px dialog, scrim
  behind, composed Card with applied title, three badges carrying their item
  text, Cancel/Save Button instances with a real gap — from one pasted
  contract, deterministically, no AI in the conversion. Suite: **146/146**.

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
| Enterprise scale (code) | Carbon/Fluent 2/Spectrum/Polaris at pinned SHAs, pipeline unmodified | `extract/pilots/ENTERPRISE-GAUNTLET.md` |
| Whole-kit census | 1,618/1,618 sets clean, facts/degradations counted | `npm run extract:figma:gauntlet` → `CENSUS.md` |
| Visual parity | pixel diff vs Figma's own renders, worst-first queue | `npm run extract:figma:visual` → `REPORT.md` |
| Published spec + CLI | `@ds-contracts/schema` 15.0.0 · `@ds-contracts/cli` 0.1.0 on public npm, stranger-verified | `cli-smoke` eval (byte-stable double run from scratch) |
| Journey E2E | both product journeys as standing gates, commands read only from the docs seam | `journey-engineer` / `journey-designer` evals · `evals/fixtures/journey-commands.json` |
| CI executes verbatim | every recipe `run:` step executed locally against the published CLI | `examples/ci/VALIDATION.md` |
| Plugin engine freshness | zip build refuses a stale engine by committed input-hash receipt | `plugin-engine-bundle` eval (guard fires on a real core mutation) |
| Canvas fidelity | headless canvas renders vs the real npm package, 7/10 PASS (3 at exact 0.00), every >10% cell named | `canvas-gate-standing-pin` eval · `examples/polaris/receipts/canvas-gate/` |
| Vendor-doc referee | extraction proposals diffed against the vendor's own shipped docs, 0 silent rows | `examples/astryx/extraction/DOC-REFEREE.md` |
| Advanced composition, LIVE | the multi-root composite (composed instance + repeated collection + labeled set-instances + inset backdrop) builds correctly on a real canvas from one pasted contract; both real-Figma quirks found en route are mock-modeled | owner's live run 2026-07-22 · `npm run plugin:check` composite pins |
