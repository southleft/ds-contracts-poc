# Fidelity Matrix — URL in, styled truth out

Four real components imported live, proposed, emitted, and scored against
their own capture. Every number below replays offline from the committed
fixtures:

```
npx tsx extract/fidelity-matrix/scripts/propose-emit.ts        # contracts + surfaces
npx tsx extract/fidelity-matrix/scripts/score-props.ts         # props vs property definitions
npx tsx extract/fidelity-matrix/scripts/score-styles.ts        # style facts vs dump resolved values
npx tsx extract/fidelity-matrix/scripts/score-convergence.ts   # D: design-proposed vs code-proposed
```

Truth sources: each Figma subject is scored against **its own dump** —
`rest-defs.json` `componentPropertyDefinitions` for props, `dump.json`
resolved node values for styles. D-code is scored against the TSX types and
the traced CSS. Ground-truth images: `out/<id>/figma.png` (Figma images API)
vs `out/<id>/render.png` (Playwright over the emitted `preview.html`);
eyeball notes in `out/pairs-notes.md`.

## Summary matrix

| Subject | Props (vs truth defs) | Style facts (vs dump values) | HTML | React | Canvas script | Image pair |
|---|---|---|---|---|---|---|
| A. Shoelace Tooltip | 1 MATCH · 1 PARTIAL · 1 MISS (of 3) | 56 MINTED ok · 7 MISSING · **0 value misses** | ok | ok | constructs, 8 variants | pill faithful; **arrows absent** (#42), placement inert |
| B. Shoelace Button Group | 4 MATCH · 1 MISS (of 5) | 0 own facts (bare composite — styling lives in child Button instances) | **REFUSED** (foreign child props ×8, name) | REFUSED | constructs, 24 variants | figma.png only |
| C. Eventz Button | 6 MATCH · 2 PARTIAL (of 8) | 143 MINTED ok · 12 MISSING · **0 value misses** | ok | ok | constructs, 16 variants | teal family faithful; **secondary/bare opaque black** (alpha drop), icons placeholders |
| D. CBDS Button (design) | 3 MATCH · 2 MISS (of 5) | 84 MINTED ok · 0 MISSING · 0 value misses | **REFUSED** (ds.icon no contract, name, emoji binding) | REFUSED | **ENGINE CRASH** (`undefined.name`) | figma.png only |
| D. CBDS Button (code) | 6 MATCH (of 6) | 30 MINTED ok · 2 MISSING · 0 value misses | ok | ok | constructs, 12 variants | vs design figma.png: brand surface byte-identical |
| **D convergence** | axes: 1 AGREE-shaped of 7 (4 PARTIAL · 2 CODE-ONLY · 1 DESIGN-ONLY) | facts: **12 AGREE · 2 DIVERGE · 5 one-sided** (of 19) | — | — | — | the thesis measurement |

Reading it honestly: style **values** are near-perfect *relative to what the
dump carries* (0 mismatches across 334 fact-cells) — the losses are in what
the capture and the proposers *drop*: paint alpha, vector geometry,
per-variant layout, toggles on component-ref parts, `:active`/`:focus-visible`
in code, and anything behind an instance boundary.

---

## A. Shoelace Tooltip (`37:142`, foreign community kit)

**Props** (`out/shoelace-tooltip/props-score.json`)

| truth def | verdict | why |
|---|---|---|
| `text#37:15` TEXT | MATCH | `text` prop, default preserved |
| `Text#507:175` TEXT | MISS | duplicate-named with `text`; no counterpart — its long lorem default appears in no captured node |
| `placement` VARIANT (8) | PARTIAL | enum complete; public values case-flattened (`topleft` vs `topLeft`) — figma binding preserves the originals |

**Styles**: 63 fact-cells, 56 MINTED all value-correct, 7 MISSING:
`Arrow Wrapper` 16px inline padding on 6 placements (per-variant auto-layout
collapsed to the default variant's) and `Body` background on `placement=left`
only — the kit itself paints Body in 1 of 8 variants; the fact rides the
proposal's own `unbound` list, not silence.

**Canvas**: script constructs (AsyncFunction), minted preamble present, 8 variants.

**Pair**: pill (bg/radius/padding/text) faithful across all 8; **no arrow, no
placement geometry** — VECTOR nodes carry no geometry in dump v1 (#42) and
per-variant layout is collapsed.

## B. Shoelace Button Group (`376:3540`)

**Props**: `position`/`size`/`type` MATCH; `isPill` VARIANT(false/true) MATCH
as boolean (bool⇄axis rule, mapping preserved); the *duplicate* orphan
`isPill#381:0` BOOLEAN is a MISS (name collision, only the variant axis modeled).

**Styles**: 0 own fact-cells — verified against the dump: the set root is a
bare auto-layout with `padding [0,0,0,0]` wrapping `Button` INSTANCEs. All
styling belongs to the child component, which dump v1 does not open.

**Surfaces**: emitHtml/emitReact **REFUSED**, correctly named — the wrapped
Button sets 8 props (`showLabel`, `label`, `isPill`, …) unknown to the repo's
`ds.button`, plus non-PascalCase name "Button group". A composite whose child
contract lives in a *different* design system cannot be emitted against ours.
The canvas script still constructs (24 variants; `isPill` boolean rendered at
default only).

## C. Eventz Button (`2313:42`)

**Props**: variant/state/isDisabled/text/hasStartIcon/hasEndIcon all MATCH;
`startIcon`/`endIcon` INSTANCE_SWAP are PARTIAL — kept as anatomy slots with
figma bindings; swap defaults/preferredValues not modeled as prop enums.

**Styles**: 155 fact-cells, 143 MINTED all value-correct (two-axis
variant×state minting incl. hover/active/focus fills), 12 MISSING —
`border-color #000002` (reported in `unbound`, no suggestions).

**Canvas**: constructs, 16 variants (variant×state; `isDisabled` at default).

**Pair — the biggest finding of the matrix**: secondary/bare render **opaque
black** where Figma shows near-white/transparent. Proven from
`rest-nodes.json`: those fills are black at **5% opacity** (stroke black at
10%) — **dump v1 drops paint opacity**, so minting is faithful-to-the-dump and
wrong-to-the-eye. Same cause hides the disabled wash-out (dump fills for
disabled variants are identical to enabled — verified). Also: slot
placeholders instead of play/pause icons (design-time swap content not
captured), focus ring collapses to a dot (RECTANGLE geometry not modeled).

## D. CBDS Button — the convergence subject

### Design side (`258:1838`)

**Props**: size/state/✏️text MATCH; `↪️icon-left`/`↪️icon-right` BOOLEAN
**MISS** — and the dump *does* capture the toggles (`propRefs.visible` on the
hidden Icon instances, 15 variants each). Cause read from
`core/propose-figma.ts`: the nested-INSTANCE-with-component-ref branch never
reads the `visible` propRef — `applyVisibleBinding` is wired only for
slot/swap/frame parts.

**Styles**: 84/84 fact-cells MINTED and value-correct (state-parameterized
bg/label color, per-size padding-inline, shared 8px radius/padding/gap).
Two repo-token **reconcile hits**: `{font.title.size}`/`{font.title.weight}`
bound instead of minted.

**Surfaces**: emitHtml/emitReact REFUSED (ds.icon referenced with no contract
in scope; "Button-Brand Primary" not PascalCase; `✏️text` not a legal code
binding). **Canvas: engine crash** — `Cannot read properties of undefined
(reading 'name')` — the one place in the matrix where the system broke its
own "named refusal, never a crash" rule.

### Code side (`Button.tsx` @ southleft/cbds-components)

**Props**: 6/6 MATCH — variant/size/fullWidth exact (enums, defaults);
iconLeft/iconRight/children as slots, the faithful shape for ReactNode.
**Styles**: 30 MINTED value-correct; 2 MISSING = ghost's `border: 1px solid`
(the proposal's own RAW VALUE note). All surfaces ok; canvas constructs,
12 variants.

### D-convergence (`out/d-convergence.json`) — the thesis measurement

Style facts on the shared surface (design set ≡ code `variant=primary`):

| verdict | count | receipts |
|---|---|---|
| AGREE | **12/19** | brand bg `#0e61ba`, hover `#003e81`, disabled bg `#dfe3eb`, label `#fcfeff`, radius 8px, padding-block 8px, padding-inline 12/16/16, gap 8px, font-size(large) 16px, font-weight 600 — px⇄rem normalized, byte-equal underneath |
| DIVERGE | 2 | disabled label `#556275` (design) vs `#738094` (code) — a real kit-vs-ship drift; font-size(small): kit truth **is 14px**, the *design proposal* flattened it, code is faithful |
| DESIGN-ONLY | 3 | pressed bg + focus ring ×2 — and the traced CSS **has** `&:active` and `&:focus-visible` rules: the code extractor dropped them, so the gap is in the code proposal, not the code truth |
| CODE-ONLY | 2 | min-height, line-height per size (design typography not token-derived / implied by auto-layout) |

Prop axes: `size` values identical but **defaults differ** (design `large`,
code `medium`) — a genuine contract question only this diff surfaces; states
modeled as variants vs pseudo-classes (PARTIAL); label as TEXT prop vs
children slot (PARTIAL); icons as dropped toggles vs optional slots
(PARTIAL); `variant`/`fullWidth` CODE-ONLY (single-set import can't see
axes spread across kit sets); disabled `Tooltip` helper DESIGN-ONLY.

---

## Named gaps, with causes

1. **Paint alpha dropped** — dump v1 `fill`/`stroke` carry hex only; Eventz
   secondary/bare are 5%/10% black → minted opaque. Visual damage class:
   severe. (Capture schema.)
2. **Canvas engine crash on cbds-button-design** — `undefined.name` instead
   of a named refusal (likely the contract-less `ds.icon` ref). Violates the
   refusal discipline.
3. **`visible` propRef dropped on component-ref parts** — CBDS icon toggles
   lost though captured; `applyVisibleBinding` not wired in the INSTANCE
   component-ref branch of `core/propose-figma.ts`.
4. **Code extractor drops `&:active` and `&:focus-visible` facts** — pressed
   and focus-ring became one-sided in the convergence diff though both truths
   have them.
5. **#42 vectors** — tooltip arrows have fill but no geometry; render invisible.
6. **Per-variant auto-layout collapses to the default variant's** — tooltip
   placement is inert (also Arrow Wrapper padding MISSING ×6).
7. **Instance boundary (dump v1)** — button-group scores zero style facts;
   eventz slot content placeholders; nested internals invisible.
8. **Sanitization refusals** — non-PascalCase set names and emoji prop names
   (`✏️text`) kill emit for otherwise-fine contracts; sanitize at propose,
   keep the figma binding raw.
9. **Foreign child contracts** — composite sets whose children belong to a
   different DS refuse against the repo's contract of the same name.
10. **Enum value case-flattening** — public API loses `topLeft` spelling
    (binding keeps it); cosmetic but visible in every generated type.
11. **INSTANCE_SWAP semantics** — slots carry the property but lose
    defaults/preferredValues; duplicate-named orphan defs (isPill, Text)
    dropped silently at the definition level (correctly, but only the score
    says so).
12. **Variables API 403 (non-Enterprise)** — REST fills carry
    `boundVariables` ids; names were one API tier away, so kit-token BINDING
    (instead of minting) is possible on Enterprise files or via plugin-side
    capture.

## Punch list (ordered)

1. Capture paint opacity in dump v1.1 (`fill.hex` → `{hex, opacity}`); remint.
2. Turn the cbds-design canvas crash into a named refusal; then fix the
   `ds.icon` stub path (auto-propose child contract stubs like the html
   surface's "no contract in scope" message suggests).
3. Wire `visible` propRefs on component-ref parts (gap 3).
4. Extract `:active` → `states.active` and `:focus-visible` outline facts in
   the code extractor (gap 4).
5. Sanitize names/props at propose time instead of refusing at emit (gap 8).
6. Per-variant layout modeling for placement-class components (gap 6).
7. Vector geometry capture (#42) — even a bounding-box triangle beats nothing.
8. Reconcile pass for two-sided D artifacts: size default, disabled label
   color, pressed/focus facts — the convergence table is the worklist.

## Proposed regression pin (not applied)

Add one eval (C5, `evals/` style) — **fidelity-pin**: replay the four
committed dumps + the code trace through `proposeFromDump`/`proposeFromCode`
in the eval scratch repo, re-run the scorers, and assert:

- every props row scored MATCH in the committed
  `out/*/props-score.json` files is still MATCH (20 pins),
- every styles row currently value-correct stays non-MISSING with
  `valueOk: true` (334 fact-cells),
- the two emit refusals and their violation lists stay *identical* (a
  refusal that silently changes shape is drift too),
- `emitFigmaScript` output still constructs as an AsyncFunction for the four
  subjects that build today.

Fixtures are already committed and deterministic; the pin turns this
scorecard from a snapshot into a ratchet. Estimated shape: one file
(`evals/fidelity-pin.ts`) reading `extract/fidelity-matrix/fixtures/**` and
the committed score JSONs as goldens, wired into `evals/run.ts` count.

---

## Punch-list addendum — items 1, 2, 3, 5 landed (2026-07-09)

Everything above is the original scored acceptance pass, kept verbatim. This
section records the re-run after punch items 1 (paint alpha), 2 (canvas
crash → named refusal), 3 (visible propRefs on component-ref parts), and
5 (identifier sanitization at proposal). Same scripts, same committed
fixtures (eventz remapped offline from its own committed `rest-nodes.json`
via `scripts/remap-fixtures.ts` — dump v1.1 now carries `{hex, alpha}`
paints and `hidden`).

### Updated matrix rows

| Subject | Props (vs truth defs) | Style facts (vs dump values) | HTML | React | Canvas script | Image pair |
|---|---|---|---|---|---|---|
| B. Shoelace Button Group | unchanged (4 MATCH · 1 MISS) | unchanged (0 own facts) | REFUSED — now **8** violations (the name violation is gone: set proposes as `ButtonGroup`; the 8 foreign `ds.button` props remain the honest refusal) | REFUSED (same) | constructs, 24 variants | figma.png only |
| C. Eventz Button | unchanged (6 MATCH · 2 PARTIAL) | 143 MINTED · 12 MISSING · **0 value misses — now scored on the FULL rgba** (truth carries alpha; scorer no longer truncates to 6-digit hex) | ok | ok | constructs, 16 variants | **secondary/bare render the near-white truth** — Punch-1 verified: 5%/0%-black fills mint as `#0000020d`/`#00000200` (8-digit hex; DTCG color + CSS-var + Figma-RGBA friendly) |
| D. CBDS Button (design) | **5 MATCH (of 5)** — `↪️icon-left`/`↪️icon-right` now booleans `iconLeft`/`iconRight` (defaults false from dump v1.1 `hidden` evidence), `✏️text` → `text` | 84 MINTED · 0 MISSING · 0 value misses (unchanged) | **ok** | **ok** | **constructs, 15 variants** (crash → named refusal → resolved by the ds.icon stub) | render.png now EXISTS; brand surface faithful, icon toggles render, disabled tooltip helper renders |

### What closed, receipt by receipt

1. **Punch-1 verified (gap 1, paint alpha)** — dump v1.1 paints are
   `{hex, alpha?}` (alpha omitted at 1) in BOTH the REST mapper and the
   plugin dump script; `paint-alpha-dropped` is retired (eventz map-report:
   386 → 358 degradations, all `variable-unresolved`). Minting spells
   alpha<1 paints as **8-digit hex** — chosen over `rgba()` because one
   string is simultaneously a legal DTCG color `$value`, a CSS color
   everywhere the pipeline speaks CSS (custom properties, inline styles,
   canvas preview), and mechanically invertible to Figma RGBA in the minted
   preamble. `out/eventz-button/render.png` now shows secondary near-white
   with its light border and bare fully transparent — the Figma truth.
2. **Punch-2 verified (gap 2, canvas crash)** — `emitFigmaScript` /
   `compileComponentData` now REFUSES by name (emit-react wording:
   `part "Icon" references component "ds.icon" which has no contract in
   scope`) instead of crashing `undefined.name`. The canvas stays MORE
   tolerant than emit-react on child props (B still constructs its 24
   variants). With the ds.icon stub in scope the refusal no longer fires
   for D-design — the script constructs 15 variants.
3. **Punch-3 verified (gap 3, dropped toggles)** — the component-ref branch
   of `core/propose-figma.ts` wires `visible` propRefs into boolean props +
   `visibleWhen` exactly like slot/swap/frame parts; the canvas engine binds
   instance visibility to the BOOLEAN property. Defaults come from POSITIVE
   dump v1.1 evidence only (node `hidden` in the default variant → false).
   D-design props-score: 3 MATCH · 2 MISS → **5 MATCH**.
4. **Punch-5 verified (gap 8, sanitization refusals)** — identifiers
   sanitize AT PROPOSAL: `Button-Brand Primary` → `ButtonBrandPrimary`,
   `✏️text` → `text`, `↪️icon-left` → `iconLeft`; the original spellings
   stay the design bindings (`bindings.figma.property` / `slot.figmaProperty`)
   and every sanitization is a named note. Emit no longer refuses on
   spelling for otherwise-fine contracts.
5. **New since the pass: auto-proposed child STUBS** (the punch-2 follow-up
   this scorecard suggested) — a nested instance whose child contract is not
   in scope now ships a STUB contract alongside the proposal
   (`childStubs` on the result; `out/cbds-button-design/stub.ds.icon.contract.json`):
   props are the OBSERVED applied values only, anatomy is an empty root,
   the description names its own provisionality. That is what turns
   D-design green on all four surfaces without guessing the child's API.

### Still open, now more precisely named

- **Disabled wash-out (Eventz) is NOT paint alpha** — re-proven during
  punch-1: the disabled variants' paints are byte-identical to enabled even
  with alpha captured; the wash rides **node opacity 0.4 on the variant
  root**, a channel dump v1.1 still does not carry. Gap re-filed as "node
  opacity capture" (the contract vocabulary already has an `opacity` token
  key; minting would need a unitless `number` kind).
- Eventz `border-color` stays 12× MISSING by design (stroke exists on only
  2 of 4 variants — a partial paint is a report entry, not a mint); its
  truth now reads `#0000021a` (10% black) instead of pretending opacity.
- D-convergence tallies are unchanged (12 AGREE · 2 DIVERGE · 5 one-sided;
  axes 4 PARTIAL · 1 DESIGN-ONLY · 2 CODE-ONLY) — but the icons axis is now
  a near-miss: BOTH sides keep two optional icon positions (design as
  boolean-toggled component refs, code as ReactNode slots); a bool⇄slot
  reconcile rule away from AGREE. Punch items 4 (code `:active` /
  `:focus-visible` extraction), 6 (per-variant layout), 7 (#42 vectors) and
  8 (reconcile pass) remain the ordered worklist.

---

## Style-fidelity addendum — dump v1.2 + the zero-silence audit (2026-07-09)

The STYLE-FIDELITY matrix (docs/STYLE-FIDELITY.md) audited every style
channel end-to-end and counted **13 SILENT-LOSS channels** in the dump v1.1
capture. This pass closed all of them: four became implementations (node
opacity, drop shadows, per-variant layout, per-variant literal triggers —
plus `:active` and the focus-ring outline on the code side), the other nine
became named degradation receipts in BOTH captures (REST mapper codes +
a new plugin-dump `_degradations` channel). Same scripts, same committed
fixtures (remapped offline to dump v1.2 from their committed rest-nodes).

### Updated matrix rows

| Subject | Props (vs truth defs) | Style facts (vs dump values) | HTML | React | Canvas script | Image pair |
|---|---|---|---|---|---|---|
| A. Shoelace Tooltip | unchanged (1 MATCH · 1 PARTIAL · 1 MISS) | 63 fact-cells: **62 MINTED · 1 MISSING · 0 value misses** (was 56 · 7) — the Arrow Wrapper's 16px inline padding mints per placement now; the 1 MISSING is Body background painted in 1/8 variants (named by design) | ok | ok | constructs, 8 variants (layoutByProp resolved per variant, reversed child order honored) | **placements now DIFFER**: root proposes `layoutByProp` on `placement` — 7 overrides (column/column-reverse/row-reverse + per-value align); arrows themselves stay #42, now receipted (`vector-geometry-unsupported` ×8, `rotation-unsupported` ×6) |
| C. Eventz Button | unchanged (6 MATCH · 2 PARTIAL) | unchanged (143 MINTED · 12 MISSING · 0 value misses; border-color stays the named partial-stroke report) | ok | ok | constructs, 16 variants | **disabled washes out at opacity 0.4** — dump v1.2 captures NODE opacity; it rides `stylesWhen { prop: isDisabled, styles: { opacity: 0.4 } }` and renders on every CSS surface (render.png row `isDisabled=true`); text lineHeight losses now receipted (`text-channel-unsupported` ×20) |
| D. CBDS Button (code) | unchanged (6 MATCH of 6) | 32 fact-cells: 30 MINTED · 2 MISSING (ghost `border: 1px solid` raw-value note, unchanged) — **and the proposal now carries the pressed fills per variant (`states.active`, minted `{imported.button.root.active.background-color.{variant}}`) AND the focus ring (`states.focus-visible` outline-width + outline-color from the expanded `outline:` shorthand)** | ok | ok | constructs, 12 variants | — |
| **D convergence** | axes unchanged: 4 PARTIAL · 1 DESIGN-ONLY · 2 CODE-ONLY (interaction-states note updated: hover+active+focus+disabled ALL overlap now) | facts: **15 AGREE · 2 DIVERGE · 2 CODE-ONLY · 0 DESIGN-ONLY** (was 12 · 2 · 3 DESIGN-ONLY · 2 CODE-ONLY) — pressed bg `#002854` and the focus ring (`#0e61ba`, 2px) moved from DESIGN-ONLY to AGREE | — | — | — | the thesis measurement, three rows greener |

### What closed, receipt by receipt

1. **Node opacity (the re-filed disabled wash-out) — closed.** dump v1.2
   captures `opacity` (node channel, distinct from paint alpha) in the
   plugin dump AND the REST mapper. propose inverts it three ways: constant
   or enum-correlated → a unitless **number-kind mint** on `tokens.opacity`
   ($type number — one spelling that is a CSS opacity value and a Figma
   FLOAT variable); a function of ONE boolean axis, opaque on the false
   side → `stylesWhen { prop, styles: { opacity } }` (Eventz `isDisabled`
   0.4 — the field case); anything else → a named note. The figma-script
   engine resolves stylesWhen opacity per compiled combo and sets
   `node.opacity` (runtime line emitted ONLY when a spec carries it — the
   golden byte-invariant, same discipline as the minted preamble).
2. **Code `:active` + focus ring (scorecard punch 4) — closed.** `active`
   joined the contract state vocabulary (schema enum; emit-react/emit-html
   render `:active:not(:disabled)`); the extractor inverts
   `&:active:not(:disabled)` rules and expands `outline: W solid C` to
   outline-width/outline-color exactly like `border` (the generator's
   focus boilerplate carries style/offset). CBDS-code now proposes
   `states.active` (per-variant) and `states.focus-visible` (ring facts).
3. **Per-variant layout (scorecard gap 6, the tooltip-placement class) —
   closed.** `invertLayoutByProp` inverts axis-correlated auto-layout
   differences into the v7 `layoutByProp` vocabulary (MIN spelled
   explicitly as `start` so overrides merge; a variant whose child order
   reverses the merged order inverts to `-reverse` directions). emit-html
   (the preview surface) now renders layoutByProp like emit-react always
   did. Tooltip render.png: the eight placements finally differ.
4. **Per-variant literal triggers (the other half of gap 6) — closed.**
   The unbound/mint triggers scan EVERY variant instead of the default
   one; the Arrow Wrapper padding MISSING ×6 became per-placement mints.
5. **Drop shadows — captured + minted.** dump v1.2 `effects` carries
   visible shadows with geometry + `{hex, alpha}` color (blur types by
   name). Exactly-one-DROP_SHADOW-in-every-variant mints as a box-shadow
   value (`0px 4px 8px #0000001a`, $type shadow, enum-axis correlation via
   the existing classifier); inner shadows / blurs / stacks / partial
   presence are NAMED notes; the minted preamble skips shadow leaves and
   the canvas names box-shadow as a v1 limit at proposal. (No matrix
   subject carries effects — the receipt is the synthetic eval pin.)
6. **The remaining nine silent channels — receipted.** New degradation
   codes in the REST mapper, mirrored by the plugin dump's `_degradations`
   channel: `paint-stack-truncated`, `stroke-weights-nonuniform`,
   `stroke-style-unsupported`, `blend-mode-unsupported`,
   `rotation-unsupported`, `vector-geometry-unsupported` (#42),
   `min-max-size-unsupported`, `text-channel-unsupported`; plus per-corner
   `radii-nonuniform` on the plugin side (was `figma.mixed` silence) and a
   propose note for bound variables outside the contract vocabulary
   (maxWidth, minHeight, …). Stroke DETAIL on instances stays unreceipted
   by design — instance styling is elided downstream.

### Still open, ranked (all NAMED)

1. Instance boundary (dump stops at instances) — the largest ceiling.
2. #42 vector geometry — arrows render invisible; receipted, not built.
3. Canvas token-key whitelist — box-shadow/line-height/min-height reach
   CSS surfaces only; named at proposal.
4. Multi-shadow / inner-shadow / blur effects; gradients & images as CSS
   values (capture receipts carry the types).
5. Text channels (lineHeight/letterSpacing/textCase/decoration) — dump
   v1.3 candidates, receipted per node.
6. Nested-part states, boolean-conditional styling, media queries — the
   authored vocabulary exists; inversion does not.

## Owner-P0 addendum — semantics + state-axis promotion + exact values (2026-07-09)

Everything above stands as written; this section is additive. Field case:
the owner's own CBDS **Button-Brand Primary** import (`WofZT8xaxXuc2Q6Je9S4XE`,
node `258-1838` — committed live at
`extract/figma/fixtures/cbds-button-brand-primary.rest-dump.json`, byte-identical
to the D-design fixture). What he got before this branch: a button rendering
as an unfocusable `div`, a fake `state` enum prop shipped to code, two
"ds.icon has no contract in scope" refusals, and — the trust-killer —
**wrong padding/font-size** (the small button rendered at 16px because the
proposer adopted a single text-style identity from the FIRST variant).

| # | fix | receipt |
|---|-----|---------|
| 1 | **semantics.element inferred deterministically** inside `proposeFromDump` — a pure name/axis table (`inferSemantics`), zero AI: button/btn→`button`, link→`a`, tooltip→`div`+role, heading+level axis→`h*`+elementByProp, switch/checkbox/select/input→form elements, `group`→no match, no-match→`div` hedge; an interaction-state axis alone corroborates `button`. Every hit is a NAMED review note. | `npm run extract:figma:cbds:check`; eval `design-semantics-element-inference` |
| 2 | **Interaction-state axis promotion** — an axis whose values ⊆ {default, hover, focus, focus-visible, active, pressed, disabled} never becomes a prop: base facts come from the default-state variants; hover→`states.hover`, pressed→`states.active`, focus→`states.focus-visible` as root overrides (bound→refs; raw→the SAME mint pass, per-remaining-axis substituted refs — Eventz hover = `{imported.button.state-hover.background-color.{variant}}`); `disabled`→ a native BOOLEAN prop + `states.disabled`; a stroke-only child drawn only in focus variants (both Focus rings) inverts to the **outline pair**; `figmaStatePreviews: true` round-trips the axis (respelled `State`/`Hover`/`Active`/`Focus Visible` — rename DOCUMENTED in a note). | eval `design-state-axis-promotion-cbds-replay`; base-instance-check re-pinned |
| 3 | **Exact per-size values** — the typography-uniformity guard refuses single-style adoption when fontSize/weight vary across variants (the 16px-everywhere bug); font-size mints per size. Emitted padding-inline/-block and font-size now resolve BYTE-EQUAL to the dump per size (large 16px/8px/16px, small 12px/8px/14px). Root cause was (a): `invertTextTokens` sampled `first(m.occ)` and matched the repo corpus (`font.title`) — a plausible-but-wrong constant; capture was correct all along. | cbds-check `size=*: padding/font-size EXACT` lines |
| 4 | **Child stubs registered in the playground** — `engine/stub-contracts.ts` (module store, the minted-layer pattern); `validate.ts` merges stubs into the contracts map (never overriding repo contracts or the edited contract); workspace persists/restores them; receipts carry a "Child stub contracts (provisional)" group. The owner's two ds.icon refusals cannot recur. | eval `design-child-stubs-prevent-scope-refusals` |

Re-scored after the change (scorers taught to read the promoted vocabulary —
`score-props` maps a state axis to contract `states`; `score-styles` overlays
`root.states` per state variant, remaps the focus ring to the outline pair,
and reclassifies part-level state diffs as MISSING-named per B7):

| subject | props | style fact-cells | mismatches |
|---|---|---|---|
| C. Eventz Button | 6✓ 2◐ 0✗ (state → states [hover, active, focus-visible]) | 155: 135 MINTED, 20 MISSING (all named: focus-ring radius ×8, partial stroke ×12) | **0** |
| D. CBDS design | 5✓ 0◐ 0✗ (state → states + native `disabled`) | 84: 78 MINTED, 6 MISSING (named: disabled label color B7 ×3, focus-ring radius ×3) | **0** |
| D-convergence | axes 1 AGREE / 3 PARTIAL / 1 DESIGN-ONLY / 2 CODE-ONLY — "interaction states" is now **AGREE** (both sides declare the SAME contract states) | facts **15 AGREE / 0 DIVERGE** / 4 CODE-ONLY (each named) | — |

The `font-size (small)` DIVERGE — the row that carried the owner's complaint —
is now AGREE at 14px on both sides. The two facts that left the AGREE column
(label-color-disabled, font-weight) did not become wrong values: both moved to
CODE-ONLY with the design side naming its own gap (B7 part-level states; no
weight identity without a single text style).
