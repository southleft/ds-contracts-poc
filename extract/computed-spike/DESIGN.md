# The code-side capture floor — computed-style truth from real rendered components

**Status: design + working spike (no engine edits).** This directory is self-contained;
nothing under `core/`, `extract/adapters/`, or the schema is touched.

The design-side plugin (`extract/figma/dump.plugin.js`) established the capture
discipline this document mirrors on the code side:

| design-side (dump v1.x) | code-side (this design) |
|---|---|
| resolved-value floor (`_variables`, resolveForConsumer) | **computed-style floor** (getComputedStyle on real rendered DOM) |
| bound-name semantics (`bound`: field → variable name) | **static semantic layer** (var()/token evidence from CSS-module extraction + DTCG value match) |
| degradation receipts (`_degradations`, zero silent loss) | **capture receipts** (every unread/unstable/unrepresentable channel named) |

The owner bar, verbatim: *"not only the underlying infrastructure metadata properties
but also complete aesthetics. Every variant, every state, and any version of a
component that takes on a different form based on a property needs to be rendered in
the canvas and aligned with a property or a state that exists within code."* The
code-side floor is the half of that bar this repo does not yet have: today's code
extraction reads **source CSS** (what was written); the floor reads **computed style
on a real render** (what the browser actually resolved) — the same upgrade the design
side got when the plugin started reading resolved values instead of trusting names.

Why source-CSS reading is not enough (all field-proven in this repo):

- Polaris routes every Button color through `--pc-*` private-variable indirection the
  CSS inverter refuses by name — **333 named refusal lines** for Button alone
  (`examples/polaris/extraction/PROMOTION.md`). The rendered button HAS a background;
  the refusals are a fidelity ceiling of *source reading*, not of the component.
- Multi-axis conditions (`.toneCritical:is(.variantPrimary)`) refuse statically; the
  rendered combo has exactly one computed value.
- The cascade (specificity, inheritance, provider-injected CSS, `@layer`, resets) is
  only decidable by a browser. Computed style IS the cascade's output.

The floor never replaces the static layer — it grounds it. Static reading supplies
**names and intent** (which token, which prop conditions); computed reading supplies
**complete, resolved truth**. Fusion (§5) is where they meet.

---

## 1. Mounting recipe

### 1.1 React (the built path)

A **harness sandbox** outside the repo tree (the `examples/polaris/scripts/verify.ts`
pattern, proven): `npm i <library> react react-dom esbuild` into a scratch dir; the
capture tool writes an `entry.jsx` that mounts one instance per enumerated prop
combination inside the library's required providers, bundles with esbuild, and loads
the page `file://` in the pinned Chromium. Requirements the harness makes explicit:

- **Provider wrapping** is per-library configuration (Polaris: `<AppProvider i18n>`;
  MUI: `ThemeProvider`; Chakra: `ChakraProvider`). One config field, not inference.
  A component that throws without an unknown provider is a **named mount refusal**.
- **Prop space comes from the static extraction** — the contract's props (enums with
  value lists, booleans, text with a sample). The static side already yields this
  (`extract/adapters/react-tsx.ts` → contract props); the capture tool consumes the
  contract/proposal, never re-derives the API.
- **Required callbacks** (`onChange` etc.) are no-op stubs, per config (verify.ts's
  `needsOnChange`, generalized: any prop typed as a function stubs to `() => {}`).
- **children/text props** mount a fixed sample string (deterministic; recorded).
- Each combo mounts in a fixed-size white stage container (`data-combo` key) so
  geometry and screenshots are comparable.

### 1.2 Custom elements

`document.createElement(tag)` + attributes/properties from the CEM extraction
(`extract/adapters/cem.ts` already yields the attribute space), slot content =
sample nodes, then the same sweep. No bundler needed when the library ships an ESM
bundle; otherwise esbuild the entry the same way. Boolean attrs toggle
presence; rich properties are set via JS. This path is designed, not built in the
spike — the spike proves the React path.

### 1.3 The honest boundary

- **Vue / Svelte / Angular**: mountable in principle via each framework's client API
  (`createApp`, `mount`, `bootstrapApplication`) — each needs a mount adapter that
  does what §1.1 does for React. Until an adapter exists, components of that
  framework are a **named refusal** (`mount-adapter-missing:<framework>`), never a
  silent skip.
- **Components whose render depends on runtime data** (fetching, routing context,
  portals into app chrome): mount refusals by name when the mount throws or renders
  empty; a portal-rendering component (Modal, Toast) renders **outside** its
  container — the capture walks from the mounted root's actual DOM position (React
  18 `createRoot` container scan + `document.body` portal scan), and a portal escape
  is receipted.
- **SSR-only / RSC components**: no client mount → named refusal until an SSR render
  + hydrate path exists.

### 1.4 Prop-space enumeration policy

Let the axes be `A₁…Aₙ` (enums, including the pseudo-value `none` for optional
enums, and booleans as 2-value axes). Full cartesian is `∏|Aᵢ|`.

**What the contract vocabulary can express** bounds what enumeration must resolve:

- `tokens` — constant per part/channel.
- `tokensByProp` / `layoutByProp` / substituted refs — a function of **one** axis.
- `stylesWhen` — a predicate on **one** axis.
- mint's pair rule (`core/mint-tokens.ts`) — a function of exactly **two** axes.
- Anything conditioned on ≥3 axes jointly is **unrepresentable today** and can only
  become a named refusal (or an extension-block literal).

**Claim (when per-axis + pairwise is provably sufficient).** If, for a given
part/channel, the computed value is a "cascade-shaped" function — a base value
overridden by independent per-axis contributions, i.e.
`v(a₁…aₙ) = last-writer-wins over {base} ∪ {fᵢ(aᵢ)}` with at most one axis actually
writing the channel (which is exactly what single-axis CSS modifier classes
produce) — then sweeping **each axis while holding the others at defaults**
observes every `fᵢ` exactly, and the reconstruction predicts every cartesian point.
Adding **all pairwise combinations** (a 2-covering array — for Button's 5×3×4×2 that
is ≤ 60 rows vs 120 full) makes the policy *decidable*: every 2-axis interaction
(`.toneCritical:is(.variantPrimary)`) is directly observed, and any 2-axis
interaction test that disagrees between two pairwise contexts proves a ≥3-axis
interaction exists — detected, not missed. What pairwise cannot give you is the
*value* at an unvisited ≥3-axis point; it can only prove the channel is
unrepresentable and refuse it by name, which is the correct contract outcome anyway.

**Policy**: full cartesian when `∏|Aᵢ| ≤ 512` (computed reads are cheap — the spike
does 120 combos × 4 interactions in single-digit minutes); above that, per-axis +
pairwise with the certificate above, and the receipt names the policy used. Axes
typed `text`/`number`/`arrayOf` never enumerate (one sample value, recorded);
`disabled`-like booleans that gate interactions participate as axes AND as state
guards (§2). Button in the spike: 5 variants × 3 tones (incl. unset) × 4 sizes ×
2 disabled = **120, full cartesian**.

## 2. State sweep

Real browser states, driven exactly as `extract/figma/visual-parity/render.ts`
already drives them (that file's hard-won lessons are inherited verbatim):

| state | driver | notes |
|---|---|---|
| default | none | pointer parked at (0,0) first — **residual-pointer neutralization**; the CBDS field failure (hover fill under every focus ring) came from the virtual mouse keeping position across captures |
| hover | `locator.hover()` | |
| focus-visible | park pointer, then `keyboard.press('Tab')` from a per-combo sentinel | modality matters: script `el.focus()` does NOT match `:focus-visible` in Chromium; Tab does. One sentinel button before each combo container makes Tab land deterministically |
| active | `mouse.move(center)` + `mouse.down()`, capture, `mouse.up()` | Chromium applies `:hover` too — the capture is honestly hover+active, exactly what a user sees mid-press |
| disabled | **prop-driven, not an interaction** — `disabled` rides the prop sweep (§1.4) | interactions ARE still driven on disabled combos; a nonzero delta there is a receipt (`interaction-on-disabled-changed:<channel>`), because a disabled control that restyles on hover is a real finding |

Prop-driven pseudo-states (checked / selected / pressed / expanded) are prop axes,
not interactions — they enumerate in §1.4 and land in the same delta machinery.
States the harness cannot drive deterministically are **named receipts**, not
captures: `:visited` (privacy-restricted computed values — the browser lies by
design), `:target`, `::selection`, autofill.

**Every state capture is diffed against the same combo's default-state capture.**
The per-channel delta set is the raw material for the contract's `states.*` /
`Part.states` vocabulary (fusion rules in §5). Transitions/animations are frozen
during capture (`transition: none !important` injected — the render.ts discipline)
so an active capture reads the *target* value, not a mid-animation frame; the
injected freeze is itself recorded in provenance.

## 3. The read

### 3.1 Channel set: the browser's, not ours

The capture enumerates `getComputedStyle(document.documentElement)` by index —
**every longhand the running browser supports** (Chromium 139: 354 properties,
including `-webkit-` aliases) — and reads that full set per element. No whitelist:
the whitelist mistake is exactly what STYLE-FIDELITY.md audited out of the design
side. The enumerated property list ships in the capture's provenance block, so a
browser upgrade that adds/removes properties is a *visible diff*, not drift.

Per element, additionally:

- **`::before` / `::after`**: `getComputedStyle(el, '::before')` — captured whenever
  computed `content` is neither `none` nor `normal` (Polaris's focus ring is a
  `.Button:focus-visible::after`; a capture without pseudo-elements would silently
  lose focus rings — the enemy). `::marker`/`::placeholder`/`::selection` are named
  receipts in v1.
- **Custom properties are NOT enumerable** via `CSSStyleDeclaration` iteration — a
  named limit. The floor does not try to read `--pc-*` intent from the page; intent
  is the static layer's job (§5). (Chromium's `computedStyleMap()` does enumerate
  custom properties; adopting it is a v2 upgrade path, noted, with the caveat that
  its value objects need their own serialization discipline.)
- The element's **tag, classes, attributes, text**, and bounding box (geometry is
  provenance, not a style channel).

### 3.2 Normalization for determinism

Chromium's computed serialization is already canonical for most channels; the
normalizer makes the rest deterministic and documents itself:

- **Colors** → canonical `rgba(r, g, b, a)` (Chromium serializes opaque colors as
  `rgb()`; the normalizer re-serializes all to rgba with alpha rounded to 4 places;
  `color(srgb …)` wide-gamut serializations are passed through verbatim and counted,
  named `wide-gamut-passthrough`).
- **Lengths** → already `px` in computed values; numbers kept at Chromium's own
  rounding (never re-rounded — re-rounding is how silent drift starts).
- **Font stacks** → verbatim, quotes normalized to double quotes. A stack is an
  ordered fallback list; collapsing it to "the first family" would be a lie about
  what the code ships.
- **Shorthand policy: longhands only.** Computed style *is* longhand truth;
  shorthands are authoring sugar. The capture never reads shorthand keys
  (`background`, `border`) — the fusion layer may *re-compose* shorthands when a
  contract channel wants one (`box-shadow` is already a single computed longhand).
- **Logical-property aliases** → Chromium enumerates logical AND physical
  spellings (`border-block-end-width` ≡ `border-bottom-width` under the pinned
  `horizontal-tb`/`ltr` writing mode). Both are captured (the capture is the
  browser's set, verbatim); the FUSION layer folds logical aliases out by name —
  fusing both spellings would double-count every box channel. RTL/vertical
  writing modes re-open the mapping; the pinned mode is provenance.
- **Property order** → sorted lexically; JSON key order deterministic; the whole
  captured-truth file is byte-stable across identical runs (asserted, see §3.3).

### 3.3 What is NOT deterministic across environments — and how it is pinned

| source of drift | pinning | residual |
|---|---|---|
| browser build | executable discovery + **full version recorded in provenance** (`chromiumExecutable()` convention from render.ts); the gate compares only within one recorded build | cross-build diffs are expected and visible, never silent |
| font availability/metrics | `document.fonts.check` per family recorded (render.ts discipline); Polaris uses the system-ui stack, so **used** font differs by OS | layout-derived values (`width`, `height`, `inline-size`, `perspective-origin`, `transform-origin`, text-dependent geometry) are captured but **classified `environment-dependent` in provenance** and excluded from the cross-environment determinism claim; within one environment they are stable and ARE asserted |
| scrollbar geometry | components are captured un-scrolled in a fixed viewport; `scrollbar-gutter`/`overflow` values are computed style (stable), scrollbar *pixels* never enter computed values | none observed |
| OS dark mode / forced colors | `colorScheme: 'light'` forced on the context; `forced-colors` not emulated (named) | |
| viewport-relative units | fixed viewport recorded in provenance | |
| device pixel ratio | affects rasterization only, not computed values; screenshots pin `deviceScaleFactor: 2` | |
| animation time | frozen (§2) | |
| locale/direction | `en`, `ltr` pinned in the harness page | RTL sweep is a later axis, named |

**Determinism gate**: the spike runs its capture twice in the same session and
asserts byte-identical captured-truth JSON (the site build's double-run discipline).

## 4. DOM → anatomy mapping

The rendered tree IS the anatomy source — the code-side mirror of the plugin dump's
node tree.

**Mapping rules, in order:**

1. **Root** = the mounted component's outermost element inside the stage container
   (portal-escaped subtrees receipted, §1.3).
2. **Part identity signature** per element: `(tag, CSS-module class stems, depth,
   sibling-index-among-same-signature)`. CSS-module stems are recovered by stripping
   hash suffixes (`Button_abc123` → `Button`; Polaris's build ships plain
   `Polaris-Button` classes — both patterns handled); utility/atomic classes that
   appear on >50% of elements are discarded as noise, named.
3. **Role classification** → part-name proposal: element with a bound text prop's
   sample text → `label`; `svg`/`img` → `icon`; `input/select/textarea` → `control`;
   pseudo-elements → `<part>::after` decor parts; everything else → box part named
   by its dominant class stem, fallback `part-<depth>-<index>`.
4. **Stable identity across the sweep**: trees are aligned by signature across all
   combos/states (the presence/absence diffing the design-side importer already does
   for variant trees). A part present only under some combos → `visibleWhen`
   candidate when presence correlates with exactly one axis value-set; a presence
   pattern correlating with nothing is a named refusal
   (`part-presence-uncorrelated`). A part whose *signature itself* varies by prop
   (tag swap via `as`-style props) is two signatures with a named
   `element-varies-by-prop` receipt (schema: `elementByProp` exists for the root
   only — a part-level gap, see §5.4).
5. **Collision with statically-derived anatomy**: the static side (JSX extraction /
   curation map) wins **names and semantics** — its part names are human-reviewed
   vocabulary. The computed tree wins **existence**: an element the static pass
   missed is added as a computed-only part (provisional name), and a static part
   with no rendered counterpart in ANY combo is flagged `static-part-unrendered`
   (usually a conditional the sweep's prop space never triggered — a finding about
   the sweep, not the component). The join is recorded per part:
   `matched | computed-only | static-only`.

## 5. Fusion: computed floor × static semantic layer

Per (part, channel) — with the channel's value observed across all combos × states —
classification runs in strict precedence:

1. **BOUND** — the static layer proves a token name for this part/channel (a
   `var(--token)` declaration the CSS extraction carried, a promotion-ledger carried
   binding, or a DTCG match where exactly the token's resolved value equals the
   computed value AND static evidence names that token). The computed value then
   *labels* the binding: it is the resolved receipt that the bound name actually
   produces this value in this combo (the design side's `bound` + `_variables`
   pattern). A bound name whose resolved value ≠ computed value is a
   **binding-contradiction receipt** — the most valuable defect class this floor
   adds (it catches stale tokens, cascade overrides, provider theming).
2. **MINTED** — no name recoverable. The observed values feed the existing
   `core/mint-tokens.ts` machinery unchanged: uniform across combos → one
   `imported.<component>.<part>.<channel>` leaf (shared-value dedupe at threshold
   3); a function of one enum axis → per-axis-value leaves + substituted ref; a
   function of an axis pair → pair leaves; uncorrelated → **nothing minted**, named
   reason (the mint discipline, verbatim). Value kinds map: colors → `color` (hex),
   single px lengths → `px`, opacity → `number`, `box-shadow` → `shadow`. Interaction-state
   deltas mint per-state leaves feeding `states.*` / `Part.states` through the same
   correlation rules.
   **Value→token candidate labeling**: a minted value that exactly equals some DTCG
   token's resolved value gets the candidate name(s) attached *as review metadata*
   (`candidates: ["p.color-bg-fill-brand", …]`) — never auto-promoted; ambiguity
   (N tokens share `#ffffff`) is the norm, and guessing names is forbidden.
3. **CODE-ONLY** — the channel or value shape has no schema slot today. Lands in the
   enriched contract's **extension block** with the literal value, per-combo/state
   where needed, and a machine-readable reason code. Nothing is dropped: the
   extension block is the receipt.

**The delta ledger** — the fusion output's receipt — counts per component:
bound / minted (uniform, per-axis, per-pair) / code-only / refused-uncorrelated,
every line naming part, channel, and reason. This is the code-side
`PROMOTION.md`, generated instead of curated.

### 5.4 Contract representation: what fits, what needs additions

Fits today (no schema change): `tokens` (keys are free-form CSS property strings —
any longhand fits when its value is a token ref), **v14 multi-entry
`tokensByProp`** (one entry per driving axis, ordered, conflict-refusing — landed
mid-design as schema v14; the showcase's "one axis map per part" limit is retired),
**v14 `literals`/`literalsByProp`** (bounded grammar, `LITERAL_CHANNELS` whitelist —
component-private literal geometry now carries schema-validly), `states` root + v13
`Part.states` (color-kind), `stylesWhen` (whitelist), `layout`/`layoutByProp`,
`visibleWhen`, `shape`, minted `imported.*` trees.

**Precise schema-addition list** (enumerated from the Button spike's actual
overflow — see the spike's extension block for the live counts):

| # | addition | why (field evidence) |
|---|---|---|
| S1 | ~~multiple `tokensByProp` per part~~ — **shipped as schema v14 while this design was being written**; the spike consumes it | Button styling is f(variant) AND f(size) AND f(tone) on different channels of one part |
| S2 | **optional/nullable enum axes as mint-axis values** (`tone` has no default; "unset" is a real point in the space) | v14's resolver already treats an unset defaultless enum as "no override" — the remaining gap is on the MINT side: correlation needs `none` as a first-class axis value to classify tone-driven channels |
| S3 | **state × axis token maps** (`statesByProp` or substituted refs inside per-axis state maps) | hover/active deltas differ per variant (primary hover ≠ plain hover); today's `states` is one map, substituted refs only cover token vocabularies whose NAMES spell the axis |
| S4 | **channel whitelist lifts**: `transition`, `cursor`, `font-family` (stack), `outline-offset`, `text-decoration-*` per state, multi-layer `box-shadow`/`background` | observed computed channels with no token-ref slot, outside v14's `LITERAL_CHANNELS` grammar (stacks, time lists, multi-layer values), and outside `STYLES_WHEN_ALLOWED` as *base* (unconditional) styles |
| S5 | **pseudo-element decor parts** (`::after` focus ring as a first-class part with states) | Polaris focus ring lives entirely on `.Button:focus-visible::after`; anatomy has no pseudo-part spelling (B4's outline pair covers outline-style rings only) |
| S6 | **part-level `elementByProp`** | `as`-style tag swaps observed as signature variation (§4.4) |
| S7 | **`@media`-conditional bindings** | named refusal today (B10); computed capture at N viewports would feed it — deliberately out of spike scope |

**Canvas vs code-only gating**: every captured channel is classified
*canvas-representable* or *code-only* before it can become a canvas expectation.
The authoritative lookup is the **Figma capability matrix** a parallel research
agent is producing; until it lands, this design uses the `emit-figma-script`
whitelist (~15 keys, STYLE-FIDELITY C1) as the stand-in and NAMES it as a stand-in.
A channel the matrix marks canvas-impossible (cursor, transition, outline-offset)
is code-only **by declared fidelity limit**, not by refusal — the same class as
`animation` today.

## 6. Instrument: the definition-of-done gate

The like-for-like number, per variant × state:

```
captured contract ──emit-html──▶ our render ──┐
                                              ├── same pinned browser ──▶ pixel diff + computed-equality
original library (npm pkg) ──▶ their render ──┘
```

- **Computed-equality truth table** (exists: `examples/polaris/scripts/verify.ts`) —
  every carried channel, exact string equality, no tolerance; extended from
  default-state-only to the full §2 interaction sweep using render.ts's drivers.
  Target: **100% on carried channels**; any mismatch must carry a committed named
  cause or the gate fails.
- **Pixel like-for-like** — pixelmatch on paired element screenshots per
  variant × state, reported at **two fixed operating points**: exact (threshold 0)
  and the library default anti-aliasing point (threshold 0.1, `includeAA: false`).
  Both numbers are always quoted; **neither is ever widened** — a worse number ships
  as a worse number with a named cause. Text regions are masked only when the font
  is genuinely unavailable (`img.ts` discipline), never to improve a score.
  Targets: ≥ 99.5% pixels matching at the AA point for combos with zero code-only
  losses; combos WITH named losses report their number next to the loss list.
- **Determinism**: double-run byte-identity on the capture (§3.3) is part of the
  gate.
- **Harness slot-in**: the comparator reuses `visual-parity/`'s browser discovery,
  interaction drivers, and masking; the only new piece is the pairing (generated vs
  *original library* instead of generated vs Figma). The gate becomes an eval like
  `polaris-showcase-reproducible`: re-run, fail on drift.

**The spike below runs a stronger, vocabulary-independent version first**: it
replays the *captured computed truth directly* (every longhand inlined on a
reconstructed tree) and pixel/computed-compares that against the original. This
isolates the question "did the capture floor capture everything the pixels need?"
from "can today's contract vocabulary carry it?" — the two failure modes the
full gate would otherwise conflate. Contract-mediated emit-html replay is the
build-plan item that follows (it needs S1–S5 to avoid known losses).

---

## Spike map (this directory)

- `run.ts` — end-to-end: harness page build → capture sweep → fuse → replay →
  numbers. `npx tsx extract/computed-spike/run.ts --harness <dir>` (harness = npm
  sandbox with `@shopify/polaris`, `react@18`, `react-dom@18`, `esbuild`).
- `captured-truth.button.json` — (a) the capture: provenance block (browser build,
  viewport, enumerated channel list, font checks), per-combo/state per-element
  computed deltas over the base capture.
- `button.enriched.contract.json` + `button.enriched.extension.json` — (b) the
  prototype enriched contract (schema-valid; validated with `ContractSchema.parse`
  at generation) and the clearly-marked overflow extension block.
- `LEDGER.md` — the delta ledger: bound / minted / code-only, every refusal named.
- `REPORT.md` + `numbers.json` — (c) the like-for-like numbers, verbatim.
- `receipts/` — sample original|replay screenshot pairs.
