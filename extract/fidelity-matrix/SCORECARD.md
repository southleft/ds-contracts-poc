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
