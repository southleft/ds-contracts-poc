# The lowering register

**Status:** measured artifact, held to the code by gate. **Gate:** `npm run lowering:check` (fast lane). **Machine-readable:** [`lowering.json`](./lowering.json).

A **door** ([`DOOR-REGISTER.md`](./DOOR-REGISTER.md)) decides whether a computed fact is admitted or dropped. A **lowering** decides something else: given that a fact IS carried, *what shape does it take on the other surface?*

`margin` between two stacked siblings has no Figma twin. Something has to choose — parent `itemSpacing`, parent padding, a synthetic wrapper node, or a named refusal. That choice **is** the conversion, and every one of them was made in code and written down nowhere.

This register names **57** lowering rules across 6 stages. Each states the CSS construct, the exact context predicate it fires in, the Figma construct it produces, what the inverse returns, what is lost, and the **canonical form** the two directions must converge on.

## Why this exists, and why it is not a second door register

> **`core/emit-figma-script.ts` carries ZERO `// @door` markers** — 8,230 lines of forward lowering, and not one registered judgement call.

The 429-door register covers the capture stages and the *inverse* (`core/propose-figma.ts`). Its stage map — `STAGE_FILES` in `scripts/door-register-check.ts` — has no `emit` entry at all. So every **forward** structure decision was unregistered and ungated: the margin box, auto-layout inference, the slot birth box, the state plane, set placement. Its refusals are spelled ad hoc as `miss()` / `channelMiss` / `facts.push`, and its silent drops are spelled as nothing.

That is why a forward failure could never be cited to a line. **This is the register the forward direction never got, and `emit` is the stage it adds** — `// @lower` is the first machine-checked annotation the forward lowering has ever had.

It is also not a duplicate of the channel table. [`CHANNEL-TABLE.md`](./CHANNEL-TABLE.md) classifies each CSS property once, globally (CARRIED / LEDGERED / REFUSED / INERT). A lowering is per **(construct, context)**: `column-gap` is CARRIED on a horizontal row and refused on a vertical one, by the same code, three lines apart.

## Capture is complete; the lowering is not

The single most important framing fact. `window.__ALL_PROPS` records **every** Chromium longhand — `order`, `flex-wrap`, `align-self`, `place-*` included. Every loss in this register is a **lowering** loss, not a capture gap. The facts arrive and nothing downstream knows what to do with them.

## The marker convention

Every implemented rule is marked immediately above its deciding line:

```ts
// @lower emit.margin-uniform-sibling-to-gap
if (px <= 0 || !gaps.every((g) => g.px === px)) return;
```

`npm run lowering:check` refuses when a `@lower` marker exists with no register entry, when a registered rule has no marker, when a cited line has **moved** (the register records the line's own source text, so this is caught even where no marker can be planted), when a rule declares no **canonical** form, and when an implemented rule's inverse does not return that canonical form.

### Two conventions this register does NOT inherit from the door register

**`markerOutsideRule` is verified, not trusted.** 29% of `core/emit-figma-script.ts` (2,385 of 8,249 lines) is the serialized in-page plugin runtime — a template literal emitted as the generated Figma script. A `//` line inside it becomes generated text, not a source marker, so those rules carry `markerOutsideRule` and are pinned by their rule text instead. The gate **checks that the claim is true**, in both directions.

It checks this because the shipped door register gets it wrong at scale. Measured with the scanner in `scripts/lowering-check.ts`:

| | |
|---|---|
| doors carrying `markerOutsideRule` | **415 of 429**, all with one copy-pasted string claiming the rule "lives inside a serialized in-page function (a template literal)" |
| of those, whose `ruleLine` is genuinely inside a template literal | **15**. The other **400 claims are false.** |
| of those, whose marker sits immediately above **ordinary code** | **374** — the marker *is* at the rule, so nothing sits outside anything |
| lines of template text in `core/propose-figma.ts` | **0** (and 0 in `fuse.ts`, `anatomy.ts`, `contract-schema.ts`) |
| lines of template text in `core/emit-figma-script.ts` | **2,385 of 8,249** (29%) — the one file the door register does not cover |

**`ruleLine` is pinned by its own source text.** In the door register, `ruleLine` and the marker `line` drift apart by a median of **29 lines**, and **154 of 415** `ruleLine` values point at a comment or a blank line. The cause is mechanical: the law

```
ruleLine == (line + 1) - (number of @door markers at or before line)
```

holds for **293 of the 415** — `ruleLine` records where the rule sat *before the markers were inserted into the file*, and nothing ever re-derived it. `auditRegister()` reads **neither** `ruleLine` nor `markerOutsideRule`, which is how both drifted this far.

This register makes that unrepresentable: a marker must sit **immediately** above its rule (`ruleLine === line + 1`, gated), and every cited line — `proposed` and `wall` rules included — records its own source text, which the gate compares against the file.

*Reported, not fixed. Correcting 415 rows of another register would widen this change past its title.*

## How to read a verdict

| field | meaning |
|---|---|
| `implemented` | the engine does this today. Marked in code, or pinned by rule text where the runtime makes a marker impossible. |
| `proposed` | the current behaviour is cited to its exact line and is **wrong**, or absent. A `proposed` rule that cannot site-cite is an opinion, not a rule, and the gate keeps it out. Every one is a decision the owner still has to take. |
| `wall` | no lowering exists and the honest answer is refusal, not invention. |
| `canonical` | the fixed-point form both directions must converge on. A rule without one is refused. |
| `roundTrip` | **re-derived from the committed `conformance/CANVAS-BASELINE.json`**, never self-attested. A rule whose cases are absent from the baseline must say `untested`. |

### The honest totals

| | count |
|---|---:|
| rules | **57** |
| `implemented` | 36 |
| `proposed` | 18 |
| `wall` | 3 |
| firing with **no receipt at all** | **43** |
| **untested** by the 94-case conformance kit | **37** |
| round-tripping on a committed case | 11 |
| failing a committed case, by name | 9 |

**37 of 57 rules are untested**, and that number is the most important one in this document. `untested` is a first-class verdict here, not a gap to fill with optimism: `margin` — the family this round is *about* — has exactly one case in the entire kit, and it already fails. The register proposes rules the corpus cannot yet test, and says so.

**No behaviour changed in this round.** Every `proposed` rule names the line its current behaviour lives at and stops there.

## The rules

### `margin` — 8 rules (4 implemented, 3 proposed, 1 wall)

The family the owner asked for by name, and the excavation changed the shape of the answer: **one of his four cases is already built, one is actively wrong, and two do not exist.** Uniform margin between stacked siblings has been lowering to parent `itemSpacing` since `lowerMarginGaps` was written — his insight is already the engine's behaviour, it was simply never written down or defended. Collapsing margins are **summed** where CSS block flow collapses to `max`, so a 16/16 vertical pair becomes `itemSpacing: 32` with no receipt. A lone child's margin has no lowering to parent padding at all. And asymmetric margins fall to the `(margin box)` wrapper — which is option (a), the spacer node, with the inverse half never written.

**Margin is also the least-tested construct in the kit.** `antd-empty-margin-only-parts` is the ONLY margin case among 94 — the kit expects it CARRIED, and the canvas baseline measures it **NAMED**, quoting `FC-EMIT-MARGIN-BOX-SKIPPED`. So most of this family is `proposed` against a corpus that cannot yet test it. That is the finding, not a gap to paper over.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.margin-auto-unparsed` | `wall` | `emit-figma-script.ts:2412` | margin: auto — the standard "push to the far edge" and "centre in the container" idiom → nothing — it is never lowered to SPACE_BETWEEN, to MAX counter-axis alignment, or to a spacer | a named refusal — `auto` margins must be REFUSED by name, never lowered to a used pixel value | **none** | `untested` |
| `emit.margin-box-absent-on-amend` | `proposed` | `emit-figma-script.ts:8077` | margin-* on a direct child of a STANDALONE component’s root, amended rather than created → nothing — no margin box is built on this path | the same lowering the create path performs — create and amend must agree | **none** | `untested` |
| `emit.margin-box-skipped-refused` | `implemented` | `emit-figma-script.ts:5400` | margin-* on a child the margin box provably cannot wrap → nothing — the margins are stripped from the spec before the runtime sees them | a named refusal (FC-EMIT-MARGIN-BOX-SKIPPED) | `emit-facts` | `named` |
| `emit.margin-box-wrapper` | `implemented` | `emit-figma-script.ts:5824` | residual margin-* on an in-flow child that no gap or padding lowering consumed → a synthetic FRAME named "<child> (margin box)", fills [], clipsContent false, sized w+l+r × h+t+b, child placed at (l, t) | gap or padding on the parent, with any residual REFUSED by name — never a synthetic node | **none** | `named` |
| `emit.margin-collapse-summed-not-maxed` | `proposed` | `emit-figma-script.ts:5754` | adjoining vertical margins between block-flow siblings (margin-bottom of one, margin-top of the next) → itemSpacing = t + l | gap on the parent, equal to the COLLAPSED value | **none** | `untested` |
| `emit.margin-gap-token-identity` | `implemented` | `emit-figma-script.ts:5764` | margin-* lowered to itemSpacing whose contributing margins name more than one token, or none → a LITERAL itemSpacing (spec.lits.itemSpacing), not a bound variable | gap on the parent, bound to the token when one token explains every contributor | **none** | `untested` |
| `emit.margin-lone-child-to-padding` | `proposed` | `emit-figma-script.ts:5743` | margin-* on the ONLY in-flow child of a container → nothing — the margin survives on the child and is later drawn as a synthetic wrapper frame | padding-* on the parent, on the matching sides | **none** | `untested` |
| `emit.margin-uniform-sibling-to-gap` | `implemented` | `emit-figma-script.ts:5758` | margin-* between in-flow siblings, on the parent’s MAIN axis → itemSpacing on the parent auto-layout frame | gap on the parent | **none** | `round-tripped` |

#### `emit.margin-auto-unparsed`

**Context.** parseLitPx accepts only a signed decimal with an optional px/rem/em unit. `auto` fails the regex and returns undefined; the token path additionally requires a finite number.

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the auto margin, in both directions
- worse: Chromium resolves `auto` to its USED px value, so fusion can mint a harness-stage-derived number as a design token — the viewport-geometry defect class, with no equivalent door

**Why.** Registered as a WALL rather than a proposal because the honest answer is refusal, not lowering. `justify-content: space-between` is a real Figma fact and `margin-left: auto` sometimes means it, but only sometimes — and the difference is not recoverable from a used pixel value. This tree already has a doctrine for numbers that are functions of the capture window (fuse.viewport-derived-geometry-refused): refuse them by name. `auto` margins have no such door, and that is the gap.

#### `emit.margin-box-absent-on-amend`

**Context.** amendComponent emits insetOverlayCall, gridChildrenCall, outOfFlowResizeCall and birthBoxCall on this line — but NOT marginBoxCall. The two paths that do call it are buildNode (create) and amendSet.

**Inverse.** None — this lowering has no return leg.

**Lost.**
- every residual margin on a standalone component’s direct children, on the amend path only
- and it is not even named: refuseSkippedMargins covers FILL/grow/out-of-flow/empty, not this exit

**Why.** Reported as a plain BUG, not a decision. Three call sites exist for birthBoxCall (buildNode, amendSet, amendComponent) and only two for marginBoxCall — the third was missed. Nothing in the code or the register says amend should differ from create here, and a fact that survives creation but vanishes on re-sync is the shape of defect this tree keeps finding. Not fixed in this PR: a fix shipped inside a documentation PR is how unexercised claims get made.

#### `emit.margin-box-skipped-refused`

**Context.** refuseSkippedMargins, running AFTER annotateFillW: the child is out of flow, or carries grow, or fillW, or is an empty runtime-sized frame (frame, 0 children, no fixedHeight/lits.height/shape)

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the margin, entirely — but named, with the side list and the reason

**Why.** One of the honest rules in this file, and the model the rest of the margin family should follow: it computes exactly why the wrapper cannot be built, refuses, and says so by name in a code the conformance baseline can quote. A FILL-sized child genuinely cannot be wrapped without destroying the fill, so refusing beats inventing.

#### `emit.margin-box-wrapper`

**Context.** runtime: the child is not overlay/insetOverlay/absolute/grow, and NEITHER axis reads layoutSizingHorizontal/Vertical === FILL

**Inverse** (`propose-figma.ts`, no recognizer exists) emits `an ordinary anatomy part — the wrapper is read back as a real FRAME part of the component` — **asymmetric**. THE fixed-point violation. `grep -a "(margin box)"` over the 11,574-line inverse returns exactly ONE hit, at propose-figma.ts:3850, and it is a mention inside a note string — not a recognizer. The inverse cannot see its own forward artifact..

**Lost.**
- the margin itself, as a margin — it becomes wrapper geometry
- the fixed point: pass 1 mints the wrapper, the inverse promotes it to a real part, pass 2 lowers THAT part again, so the structure grows every pass

**Why.** This is the incumbent, and it is the thing that already broke. It is option (a) — the spacer node — with the inverse half never written, and its measured result is the committed NAMED failure on the one margin case the kit has, plus unbounded structure growth across passes. The register records it as implemented because it IS what the engine does, and names the canonical form it does not reach.

#### `emit.margin-collapse-summed-not-maxed`

**Context.** lowerMarginGaps computing the inter-sibling gap. The sum t + l is CORRECT on a HORIZONTAL row — horizontal margins do not collapse. It is WRONG on a VERTICAL stack, where CSS block flow collapses adjoining margins to max(t, l).

**Inverse** (`propose-figma.ts`, gap: <ref> from itemSpacing) emits `gap on the parent` — **asymmetric**. the inverse emits `gap`, and `gap` does NOT collapse — so the doubled value is re-authored as a real doubled gap and the error is laundered into the contract.

**Lost.**
- the collapsed value: margin-bottom:16 + margin-top:16 renders as 16px in CSS and is lowered as itemSpacing: 32

**Why.** Not a style preference — a measurable defect with no receipt. `grep -rn "collaps"` across /core finds only stroke-glyph collapsing; nothing in the forward path models block-flow margin collapsing. The rule must resolve to the collapsed value BEFORE lowering, and the axis is the discriminator: keep the sum for HORIZONTAL, take max() for VERTICAL. Load-bearing for the fixed point too — only the collapsed gap converges, because the inverse re-emits `gap`, which never collapses.

#### `emit.margin-gap-token-identity`

**Context.** the uniform-gap lowering succeeded, but the margins do not all resolve to ONE token variable (sources.size !== 1, or any contributor is a bare literal)

**Inverse** (`propose-figma.ts`, gap: <literal px> from itemSpacing) emits `gap on the parent as a literal px value` — **asymmetric**. a literal cannot name the token it came from, so the return trip cannot restore the binding.

**Lost.**
- the token identity of the gap — the Figma inspector shows a number where the library authored a spacing token

**Why.** Defensible as far as it goes: Figma binds ONE variable to itemSpacing, so two different tokens genuinely cannot both be carried, and a literal preserves the render. What is not defensible is the silence — losing a token binding is exactly the kind of fact this tree receipts everywhere else, and here nothing is said at all.

#### `emit.margin-lone-child-to-padding`

**Context.** lowerMarginGaps declines here: with fewer than two children there is no inter-sibling gap to compute, so a lone child’s margin is never lowered to any parent field. It falls through to the (margin box) wrapper instead.

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the chance to express the space as parent padding, which is what it renders as
- the child’s ability to respond to parent resize, because the wrapper it takes instead is FIXED-sized

**Why.** Space between a lone child and its container edge is indistinguishable, in the rendered box, from container padding — and Figma has padding but not margin. The guard the rule needs: the container must carry no competing declared padding on that side, or the two sum. Today this case takes the wrapper, which is strictly worse: a FIXED frame that stops the child reflowing, and an artifact the inverse cannot recognise.

#### `emit.margin-uniform-sibling-to-gap`

**Context.** lowerMarginGaps: the parent carries a layout, no CSS `gap` already claimed itemSpacing, ≥2 in-flow children (no overlay/insetOverlay/absolute), and every inter-sibling trail(i)+lead(i+1) sum is EQUAL and > 0

**Inverse** (`propose-figma.ts`, gap: <ref> from itemSpacing) emits `gap on the parent` — **asymmetric**. the inverse cannot know the canvas gap was authored as sibling margins; it emits `gap`, which is the CSS the author should have written.

**Lost.**
- which of the two siblings owned the space (CSS margin is per-child; Figma itemSpacing is per-parent)
- the distinction between `gap: 16` and `margin-bottom: 16` on every child but the last

**Why.** This is the owner’s own rule, already the engine’s behaviour, never written down or defended. Figma’s itemSpacing IS between-sibling space — the only construct in the API with the same meaning. The asymmetry is admitted rather than hidden: the round trip converges on `gap`, and `gap` is the canonical form because it is the one spelling both surfaces can hold. The all-or-nothing uniformity guard is right: a non-uniform run has no single itemSpacing, and inventing one would change the render.

### `gap` — 5 rules (2 implemented, 3 proposed, 0 wall)

Two facts that must agree, produced by doors that never talk. Fusion never carries `gap` as a **layout** fact — `LAYOUT_CHANNEL_TO_FIELD` has no entry for it — so it mints as an independent pixel token and the emitter has to re-derive the axis that layout enrichment may or may not have carried. The token path receipts a cross-axis gap properly; the literal path drops the identical value with an `if` that has no `else`. And the literal fallback that would rescue an uncorrelated gap is spelled `gap`, a shorthand computed style never reports.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.gap-literal-cross-axis-silent` | `proposed` | `emit-figma-script.ts:2601` | a LITERAL column-gap on a VERTICAL stack (and the row-gap twin four lines below) → nothing | a named refusal, exactly as the token path already does | **none** | `untested` |
| `emit.gap-token-cross-axis-refused` | `implemented` | `emit-figma-script.ts:2040` | column-gap bound to a token on a VERTICAL stack (and, at the twin site, row-gap on a HORIZONTAL one) → nothing — refused | a named refusal | `channel-miss` | `untested` |
| `emit.gap-token-main-axis` | `implemented` | `emit-figma-script.ts:2033` | column-gap bound to a token → bindings.itemSpacing, bound to the same variable | gap on the parent | **none** | `round-tripped` |
| `fuse.gap-literal-fallback-misspelled` | `proposed` | `fuse.ts:1925` | an uncorrelated row-gap / column-gap that should take the base-plane or set-plane literal fallback → nothing — the guard `BASE_FALLBACK_CHANNELS.has(channel) && LITERAL_CHANNELS.has(channel)` can never be true for a real gap | the live longhand spellings (row-gap, column-gap) in both sets | **none** | `untested` |
| `fuse.gap-not-a-layout-fact` | `proposed` | `fuse.ts:1558` | row-gap / column-gap on a flex container → nothing here; the gap survives only as an ordinary styled px channel that mints as a token | layout.gap on the container, carried by the same rule that carries its axis | **none** | `round-tripped` |

#### `emit.gap-literal-cross-axis-silent`

**Context.** litPx already returned a number, so its own literalMiss did not fire; the condition is simply false and there is no else

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the cross-axis gap, with NO receipt of any kind — no miss(), no literalMiss(), no fact

**Why.** Reported as a BUG, not a decision. The token path for the identical situation calls miss() and says why; the literal path drops the value with an `if` that has no else. Same construct, same impossibility, half of it named and half silent — nobody chose that. The fix is one else branch, and it is not made here.

#### `emit.gap-token-cross-axis-refused`

**Context.** the gap names the CROSS axis, which Figma has no field for

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the cross-axis gap — named

**Why.** The right answer, receipted. Figma has exactly one itemSpacing and `counterAxisSpacing` is never written anywhere in this file (0 occurrences), so a cross-axis gap genuinely has nowhere to go. This rule is the standard its literal twin below fails to meet.

#### `emit.gap-token-main-axis`

**Context.** the part’s layout mode is HORIZONTAL, so column-gap is the MAIN axis

**Inverse** (`propose-figma.ts`, gap: <ref> from itemSpacing) emits `gap on the parent` — **asymmetric**. the axis-specific spelling is lost: column-gap goes out and the generic `gap` comes back.

**Lost.**
- the axis-specific spelling — the conformance baseline records this verbatim as "channel respelled: column-gap → gap"

**Why.** Correct and measured — `flex-gap` round-trips today. The respelling is a genuine asymmetry rather than a defect: Figma has ONE itemSpacing and it is the main axis, so on a horizontal row `column-gap` and `gap` are the same fact, and `gap` is the form that survives the trip. Naming it here is what stops it being read as drift.

#### `fuse.gap-literal-fallback-misspelled`

**Context.** BASE_FALLBACK_CHANNELS spells the SHORTHAND `gap`; so does LITERAL_CHANNELS. Computed style enumerates LONGHANDS only, so the channel that actually arrives is `row-gap` or `column-gap` — and neither set contains either spelling.

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the literal fallback for every uncorrelated gap, while the same fallback works for padding because the padding LONGHANDS were later added to both sets and gap was not

**Why.** Reported as a BUG. Measured, not argued: `gap` is a member of CSS_SHORTHANDS, and this repo’s own shorthandVarSkip() says computed style never reports shorthands. So the `gap` entry in both sets is dead code that can never match, and the two spellings that do arrive are absent. This is the same defect class as the three-name whitelist whose `border-color` entry can never match — an allow-list written in a vocabulary the producer does not speak.

#### `fuse.gap-not-a-layout-fact`

**Context.** the enrichment vocabulary covers exactly four properties — display, flex-direction, align-items, justify-content — and has no gap entry at all

**Inverse** (`propose-figma.ts`, grid carries {row, column}; flex cannot spell row-gap) emits `gap on the parent (flex) or the independent {row, column} pair (grid)` — **asymmetric**. the engine gives two different answers for the same CSS construct, chosen by the parent’s display.

**Lost.**
- gap as a LAYOUT fact — so the emitter must re-derive the axis that enrichLayout may or may not have carried

**Why.** A gap is a property of a layout, and this pipeline carries it as a property of a box. The consequence is the axis re-derivation in the emitter: two doors that never talk have to agree about which axis a number belongs to. Grid already carries the pair independently, which is proof the schema can hold it — flex simply was never widened.

### `axis` — 11 rules (6 implemented, 5 proposed, 0 wall)

Where the owner's two visible failures live. **There is no `layoutMode: 'NONE'` anywhere in `core/emit-figma-script.ts`** — 0 occurrences — so no frame is ever lowered to a non-auto-layout frame, and every unclaimed part becomes a horizontal row. Three independent defaults turn "unknown" into "row", and two further construction sites bypass the axis function entirely. Upstream, layout enrichment refuses any container that is not `flex` at its base combo. The two halves compose: fusion carries no direction for a block container, and the emitter invents one.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.axis-adjacent-inlines-unnamed` | `proposed` | `emit-figma-script.ts:1812` | two or more adjacent inline siblings inside a block container — one CSS line box → nothing — the container falls through to a horizontal row | a named refusal: an inline formatting context has no auto-layout spelling and should say so | **none** | `untested` |
| `emit.axis-block-declared-vertical` | `implemented` | `emit-figma-script.ts:1747` | display:block carrying align/justify facts but no flex-direction → layoutMode VERTICAL with stretchChildren, alignment mapped from the carried align/justify | a block-level box lowers to a vertical stack | **none** | `named` |
| `emit.axis-blockification` | `implemented` | `emit-figma-script.ts:1814` | a block-flow container (block \| list-item \| flow-root \| inline) with no layout fact → layoutMode VERTICAL, MIN/MIN, stretchChildren | a block-level box lowers to a vertical stack | **none** | `named` |
| `emit.axis-default-horizontal` | `proposed` | `emit-figma-script.ts:1818` | any container whose flex-direction was not carried — including one that carries NO layout at all → layoutMode HORIZONTAL | an explicit no-declared-axis outcome that refuses rather than defaults | **none** | `named` |
| `emit.axis-icon-host-bypass` | `proposed` | `emit-figma-script.ts:4233` | display:block (or any block-flow display) on an icon part that also carries box channels → layoutMode HORIZONTAL, CENTER/CENTER — layoutSpec is never consulted | one axis rule for every part — the host frame must go through layoutSpec like everything else | **none** | `untested` |
| `emit.axis-layoutless-root-centered-row` | `proposed` | `emit-figma-script.ts:1764` | a ROOT that carries no layout fact at all → layoutMode HORIZONTAL, primaryAxisAlignItems CENTER, counterAxisAlignItems CENTER — an invented centered row | no layout invented: a root with no carried layout must lower to its declared display, and refuse rather than guess an axis | **none** | `named` |
| `emit.axis-reverse-as-child-order` | `implemented` | `emit-figma-script.ts:4550` | flex-direction: row-reverse / column-reverse → the same children in reversed CHILD ORDER inside a forward auto-layout frame | reversed child order, with the reverse keyword refused by name | **none** | `untested` |
| `emit.axis-runtime-default-row` | `implemented` | `emit-figma-script.ts:7353` | any node reaching the generated plugin runtime with no compiled layout → layoutMode HORIZONTAL, MIN/MIN | no layout invented at the backstop — a node that reaches the runtime unclaimed is a defect upstream and should be named, not defaulted | **none** | `untested` |
| `emit.axis-textbox-bypass` | `proposed` | `emit-figma-script.ts:4404` | a text part carrying a padding channel, whose display is block-flow → layoutMode HORIZONTAL, MIN/MIN | one axis rule for every part | **none** | `untested` |
| `fuse.axis-flex-only-enrichment` | `implemented` | `fuse.ts:1594` | flex-direction / align-items / justify-content on any container → nothing for a non-flex container: no direction, no align, no justify ever reaches the emitter | layout facts carried for any container that has them, keyed on the combo being measured rather than on the base display | **none** | `named` |
| `fuse.axis-vocabulary-narrow` | `implemented` | `fuse.ts:1622` | any layout value outside a 4-property, 12-pair vocabulary → nothing — the value stays code-only | a vocabulary at least as wide as the schema enums it feeds | `receipts` | `untested` |

#### `emit.axis-adjacent-inlines-unnamed`

**Context.** computed to DECLINE the vertical rescue; the container then takes the horizontal default

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the anonymous block / line-box structure, and the fact that it was declined at all — the comment above calls this "named residue" but no miss() or facts.push() ever fires

**Why.** Reported as a receipt hole. The engine correctly identifies a construct it cannot express, and then says nothing — while the code comment claims it is named. A claim of honesty the code does not have is exactly what the door register was built to stop, and this site is outside its reach because emit has no doors.

#### `emit.axis-block-declared-vertical`

**Context.** a layout exists, its direction is absent, and the declared display is exactly `block`

**Inverse.** None — this lowering has no return leg.

**Lost.**
- counterAxisAlignItems BASELINE is silently coerced to MIN a few lines below, because Figma throws on BASELINE in a vertical stack

**Why.** Right rule, too narrow a test. It matches `display === "block"` only, while the block-flow rescue thirty lines below was widened to block|list-item|flow-root|inline (the Carbon fix). So a `list-item` carrying layout.align still falls through to HORIZONTAL. The asymmetry between the two block branches is unreceipted and looks like an oversight rather than a decision.

#### `emit.axis-blockification`

**Context.** at least TWO in-flow children, and either all of them are block-level or some are and no two inline siblings are adjacent

**Inverse.** None — this lowering has no return leg.

**Lost.**
- a container with ONE child, or with a run of two adjacent inline children, never reaches this rescue and keeps the horizontal default

**Why.** The best rule in the axis family: it reads CSS blockification properly rather than guessing, and a run of adjacent inline siblings really is one line box, so declining is correct there. The problem is what happens after it declines — the fall-through invents a row instead of refusing, and the decline itself is silent.

#### `emit.axis-default-horizontal`

**Context.** the terminal fall-through of layoutSpec, after the block-flow rescues above have declined

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the distinction between "row was measured" and "nothing was measured" — both produce a row, and nothing receipts the second

**Why.** The candidate cause of "the dialog on one row", and the second half of a composition. Its partner is the fuse-side rule below: a non-flex container never receives a direction, so `l` arrives undefined here and the ternary supplies HORIZONTAL. Neither half is receipted, which is precisely why the symptom could never be cited to a line. The committed conformance case `display-block` already measures the outcome: seed `block`, and the value comes back as `flex`.

#### `emit.axis-icon-host-bypass`

**Context.** the icon-with-box host frame builds its layout inline and calls layoutSpec ONLY when resolveLayout returns something; otherwise it hard-codes a centered row

**Inverse.** None — this lowering has no return leg.

**Lost.**
- every block-flow rescue in layoutSpec, for this whole class of part

**Why.** A bypass, not a decision: the blockification rescue was added to layoutSpec and these two construction sites were never routed through it. The text-with-box wrapper does the same thing a hundred and seventy lines later. Two code paths that build a frame without asking the function whose job is to decide a frame’s axis.

#### `emit.axis-layoutless-root-centered-row`

**Context.** layoutSpec, with no resolved layout and the root not declaring display:block

**Inverse** (`propose-figma.ts`, if (direction === 'row' && justify === 'center' && align === 'center' && !grow && !overlap && wrapping === 0) {) emits `no layout block at all (the proposal elides exactly this shape as "the generator default")` — **asymmetric**. the two halves agree that row/center/center is the default — but packages/core/src/css.ts then re-inflates an absent root layout as INLINE-flex, so the display keyword flips on every trip.

**Lost.**
- the real CSS display of a layout-less root — it is not read, it is invented

**Why.** The candidate cause of "cards as pills", cited to the line. A card-shaped contract whose root layout was never carried is drawn as a horizontally centered row — which IS the shape of a pill. There is no `layoutMode: 'NONE'` anywhere in this file (0 occurrences), so no frame is ever lowered to a non-auto-layout frame and this default is unavoidable once a root reaches here unclaimed. Stated as a candidate cause with the line cited, NOT as a verified fix — this PR changes no behaviour, so it cannot claim a symptom is closed.

#### `emit.axis-reverse-as-child-order`

**Context.** resolved per variant; the children array is reversed in place

**Inverse** (`propose-figma.ts`, no reverse recognizer) emits `a plain forward stack — the reverse-ness is not a canvas fact and cannot be read back` — **asymmetric**. the render is right and the fact is gone; a second forward pass over the returned contract would NOT re-reverse, so the render is stable but the authored spelling is not.

**Lost.**
- `row-reverse` / `column-reverse` as a declared fact — only its effect on order survives

**Why.** Genuinely the right lowering — Figma has no reverse flag, and reversing the children produces the identical render. It belongs in the register because the loss is real and unnamed, and because the schema disagrees with itself about it: LayoutSchema.direction admits only row|column, while the proposal appends `-reverse` to that same field and only VariantLayoutSchema accepts it.

#### `emit.axis-runtime-default-row`

**Context.** applyFrameSpec, the last backstop — by construction nothing upstream claimed this node

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the third and last chance to notice that no axis was ever measured

**Why.** The third of three independent places that turn "unknown" into "row" (the other two are the layout-less root default and the terminal ternary). Three defaults, one direction, no receipts — which is why a horizontal-row symptom has three possible origins and no way to tell them apart from the output.

#### `emit.axis-textbox-bypass`

**Context.** wrapTextInBox builds the wrapper; with no resolved layout it takes a hard-coded MIN/MIN row rather than asking layoutSpec

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the block-flow rescue, for every padded text box

**Why.** The twin of the icon-host bypass, and the reason the axis family needs a register: the same decision is taken in four different places in one file, three of them defaulting to a row, and no two of them agree about which inputs matter.

#### `fuse.axis-flex-only-enrichment`

**Context.** enrichLayout — the ONLY producer of a Part.layout main-axis fact in the entire pipeline — reads display from the BASE combo only, and skips the part unless it is flex or inline-flex

**Inverse.** None — this lowering has no return leg.

**Lost.**
- every layout fact of every block, inline-block, grid, list-item, flow-root and table container
- and a part that is `block` at base but flex in every other combo is skipped on the base reading alone

**Why.** The upstream half of the row-default composition, and the largest silent subtraction in enrichLayout. The premise — only flex containers have layout — was true when the vocabulary was four properties, and CSS blockification means a block container absolutely does have an axis. Compounding it: the same function requires a counterpart in the REVIEWED static contract, which most parts in a foreign-kit run do not have — the exact population v1 is graded on.

#### `fuse.axis-vocabulary-narrow`

**Context.** LAYOUT_CHANNEL_TO_FIELD maps display{flex,inline-flex}, flex-direction{row,column}, align-items{flex-start,center,flex-end,stretch}, justify-content{flex-start,center,flex-end,space-between} — and nothing else

**Inverse.** None — this lowering has no return leg.

**Lost.**
- row-reverse, column-reverse and baseline — all three of which are ALREADY in the schema enum
- space-around, space-evenly, and every logical alignment keyword

**Why.** Honestly receipted, which is why it is `implemented` and not a bug — the refusal says what it dropped. It is in the register because the boundary is arbitrary rather than principled: this is not a carriage limit, it is a vocabulary nobody widened. Three of the missing values already have a home in the schema, so carrying them costs nothing but the widening.

### `display` — 3 rules (2 implemented, 1 proposed, 0 wall)

The stage where the two directions disagree about a keyword. The proposer elides a root drawn at `flex`/row/center/center as "the generator default"; the code generator, seeing no root layout, emits **`inline-flex`**. The display keyword flips on every round trip and nothing receipts it.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `css.display-absent-root-inflates-inline-flex` | `proposed` | `css.ts:219` | the CSS emitted for a contract whose root carries no layout block → n/a — this is the CSS the contract renders to | the two defaults must be the SAME keyword, or the elision is not an elision | **none** | `untested` |
| `propose.display-root-layout-elided` | `implemented` | `propose-figma.ts:5642` | a canvas root drawn at exactly row / center / center → n/a — this is the return leg: the Figma fact is dropped rather than proposed | the elision is only sound if the absence re-inflates to the SAME shape it elided | **none** | `untested` |
| `schema.display-block-to-vertical-stack` | `implemented` | `contract-schema.ts:964` | display: inline \| block \| list-item → frame nesting; a block-level box lowers to a vertical stack | a block-level box lowers to a vertical stack | **none** | `named` |

#### `css.display-absent-root-inflates-inline-flex`

**Context.** the code generator’s default for an absent root layout

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the `flex` vs `inline-flex` distinction: the eliding side dropped `flex`, and this side restores `inline-flex`

**Why.** Reported as a defect of AGREEMENT rather than of either line alone. Neither default is wrong in isolation; together they guarantee that a root layout, once elided, comes back spelled differently. A contract that survives a round trip byte-for-byte is the property this whole exercise is for, and one keyword breaks it for every centered root.

#### `propose.display-root-layout-elided`

**Context.** the inverse treats that shape as "the generator’s own default" and proposes NO layout block for the root

**Inverse.** None — this lowering has no return leg.

**Lost.**
- display, direction, justify and align on every root that happens to be drawn centered — with receipt channel "none", fully silent

**Why.** It does not re-inflate to the same shape, and that is the finding. The proposer elides at `flex` / row / center / center; packages/core/src/css.ts, seeing no root layout, emits `inline-flex` / center / center. The display keyword flips from flex to inline-flex on every round trip, with nothing receipting it — an elision whose premise about its own partner is false.

#### `schema.display-block-to-vertical-stack`

**Context.** the declared-channel registry’s note for `display` — the rule stated in prose, in the schema, since before any of this was gated

**Inverse** (`css.ts`, rootDecls.push('display: inline-flex', 'align-items: center', 'justify-content: center');) emits `display: block from the declared registry, when it was carried` — **asymmetric**. when the block display was NOT carried as declared, the return trip inflates the absent layout as inline-flex instead — see the css-stage rule.

**Lost.**
- the inline formatting context; block is approximated, not reproduced

**Why.** This rule was already WRITTEN DOWN — in a schema comment, in prose, ungated — and the emitter has three separate defaults that contradict it. That gap is the whole argument for this register: six such prose rules exist in contract-schema.ts, none of them was machine-checked against the code, and the forward file that is supposed to obey them has no markers at all.

### `padding` — 2 rules (1 implemented, 1 proposed, 0 wall)

The cleanest lowering in the tree, and the standard the rest of the register is measured against — four CSS longhands, four Figma fields, the same meaning. Both padding conformance cases round-trip.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.padding-longhand-bound` | `implemented` | `emit-figma-script.ts:2012` | padding-left / -right / -top / -bottom bound to a token → bindings.paddingLeft (and siblings) bound to the same variable | the logical shorthand when both sides agree, longhands otherwise | **none** | `round-tripped` |
| `emit.padding-shorthand-registry-hole` | `proposed` | `emit-figma-script.ts:2349` | any token-bound channel with no case in the switch — including the `padding` shorthand itself → nothing | a named refusal for every unhandled channel, whether or not a registry row exists | `channel-miss` | `untested` |

#### `emit.padding-longhand-bound`

**Context.** each side independently bindable; the logical padding-inline / padding-block forms bind the same variable to both sides

**Inverse** (`propose-figma.ts`, padding-* proposed from the bound padding fields) emits `padding-inline / padding-block when both sides share a variable, padding-* longhands otherwise` — **asymmetric**. the baseline records this verbatim as "channel respelled: padding-left → padding-inline".

**Lost.**
- the authored spelling: a longhand pair with one token returns as the logical shorthand

**Why.** The cleanest lowering in the file, and the one to hold the others to: Figma has four padding fields, CSS has four padding longhands, and they mean the same thing. Both padding conformance cases round-trip. The respelling is named here so it is never mistaken for drift.

#### `emit.padding-shorthand-registry-hole`

**Context.** the token default branch receipts ONLY when the channel exists in TOKEN_CHANNELS and is marked non-draw; a channel absent from that registry falls through with nothing

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the value, AND the receipt, for any channel the registry does not carry — the receipt is conditional on the very registry that failed to know about the channel

**Why.** A receipt guarded by the wrong condition. The literal side of the same switch calls literalMiss() in ALL branches including the catch-all else, and has no such hole. This matters beyond padding: it is the general escape through which any unregistered token channel leaves without a word, which is the shape of the tab-size incident that once made validateContract refuse 32 whole components.

### `size` — 6 rules (5 implemented, 1 proposed, 0 wall)

Contains both the best and the weakest reasoning in the register. `hugEvidence` and the text hug/fill rule ask real measurements and refuse by name when the measurement is not uniform. The text-part geometry exclusion asks presence-of-ink instead — a proxy standing in for a question the same file already knows how to ask.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.size-maxwidth-ceiling-or-fixed` | `implemented` | `emit-figma-script.ts:2251` | max-width → bindings.maxWidth when the ceiling holds; spec.fixedWidth when it does not | maxWidth as a ceiling; a cap that cannot be carried refused by name rather than baked | **none** | `round-tripped` |
| `emit.size-minheight-dropped-under-height` | `implemented` | `emit-figma-script.ts:2280` | min-height alongside a height token → nothing — the min-height is dropped in favour of the fixed height | both facts carried — Figma has minHeight and a fixed height and they compose | **none** | `untested` |
| `emit.size-text-hug-vs-fill` | `implemented` | `emit-figma-script.ts:4769` | a text child inside a container that grants FILL → alignment-safe non-truncating text HUGS; alignment-displaced text keeps FILL and carries fillText | text hugs unless hugging would move it | `emit-facts` | `named` |
| `fuse.size-geometry-admit-disjunction` | `implemented` | `fuse.ts:799` | width / height and the inset quartet on any part → a carried dimension when a door opens; otherwise the box sizes from its content, padding and min/max channels | admit a dimension when it is a library fact, refuse it when it is an environment measurement | `receipts` | `untested` |
| `fuse.size-hug-evidence` | `implemented` | `fuse.ts:1395` | the relationship between a part’s used width and its max-width → a boolean the max-width lowering consumes to decide ceiling-versus-fixed | a measured, uniform, per-part verdict or no verdict at all | `receipts` | `round-tripped` |
| `fuse.size-text-part-geometry-excluded` | `proposed` | `fuse.ts:194` | width, height and all four insets on any part carrying a non-empty direct text run → nothing — no geometry reaches the canvas for that part | exclude geometry that is a font-metric artifact, carry geometry the library authored — decided by measurement, not by the presence of ink | `receipts` | `untested` |

#### `emit.size-maxwidth-ceiling-or-fixed`

**Context.** carried as a real Figma maxWidth (the box hugs beneath the cap) only for non-text parts that are either not the root, or measured to hug below the cap; otherwise the cap is BAKED as a fixed width

**Inverse.** None — this lowering has no return leg.

**Lost.**
- CSS semantics, inverted, in the else branch: a cap becomes a fixed size, so a box that should shrink no longer can. Text parts always take that branch — Figma text has no maxWidth field.

**Why.** A genuinely hard case handled with real care — hugEvidence measures whether the box actually hugs beneath its cap in every combo rather than assuming, and `min-max-width` round-trips. The register records it because the fallback silently inverts the meaning of the property: `max-width: 300px` and `width: 300px` are different facts, and in the else branch they become the same one.

#### `emit.size-minheight-dropped-under-height`

**Context.** min-height binds ONLY when the part carries no height token at all

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the min-height, with no receipt

**Why.** Defensible reasoning, unnecessary loss. Treating the fixed height as the drawn design truth is reasonable, but Figma supports minHeight and a size simultaneously, so nothing forces the choice — and the choice is silent. Registered as implemented with the loss named, so a future round can widen it deliberately rather than discover it.

#### `emit.size-text-hug-vs-fill`

**Context.** hugTextSafe requires the box’s horizontal packing to MATCH the text’s own textAlignH (LEFT↔MIN, CENTER↔CENTER, RIGHT↔MAX); JUSTIFIED and SPACE_BETWEEN never qualify

**Inverse.** None — this lowering has no return leg.

**Lost.**
- nothing silently — the trade is between two real renderings and the code picks the one that keeps the glyphs where CSS put them

**Why.** One of the best rules in the file and worth defending explicitly, because a register that only listed faults would be read as an attack. It asks a MEASUREMENT (does the packing agree with the text alignment?) rather than a proxy, and it names the outcome with a code. This is the standard the presence-of-ink geometry exclusion below fails to meet.

#### `fuse.size-geometry-admit-disjunction`

**Context.** geometry is refused by default and admitted only through four escape doors: the absolute/overlay cluster, an admitted table cell, the block root, and a token-named dimension

**Inverse.** None — this lowering has no return leg.

**Lost.**
- a plain flex component’s authored width, in the register’s own words — three of the four doors are structural accidents rather than questions about the number

**Why.** Registered with a split verdict. The DOCTRINE is right and this repo learned it the hard way: a drawn pixel is usually a fact about the capture window, not about the library, and refusing by default is correct. One of the four doors — token-named-geometry-admitted — asks exactly the right question, "does the library’s own stylesheet name this number?", and is the best door in the cluster. The other three ask whether an unrelated absolute descendant exists, whether this is a table, and whether this is the root. Those are accidents of anatomy standing in for a semantic question the good door already knows how to ask.

#### `fuse.size-hug-evidence`

**Context.** for every enabled combo: both values must parse as bare px, and the verdict `width < max` must be UNIFORM across all of them

**Inverse.** None — this lowering has no return leg.

**Lost.**
- nothing — a non-uniform or unmeasurable verdict voids the evidence and is receipted by name

**Why.** Included as the positive example the register needs. This is what a good lowering input looks like: it asks a question that can be answered from the capture, requires the answer to be the same in every combo, and refuses by name when it is not. The text-part geometry exclusion is thirteen hundred lines away in the same file and asks a proxy instead — the difference is the point.

#### `fuse.size-text-part-geometry-excluded`

**Context.** inside an overlay-anatomy component, the presence of ink alone excludes the ENTIRE GEOM_ADMIT set: width, height, top, left, right, bottom, translate-x, translate-y

**Inverse.** None — this lowering has no return leg.

**Lost.**
- an AUTHORED width on any text-bearing part; and height and the four insets, where the font-metric argument does not even apply

**Why.** The premise — "text width is font-metric-dependent" — is true of INTRINSIC width and false of AUTHORED width, and the predicate never asks which. It is a proxy where a measurement is available: hugEvidence in this same file already asks exactly the right question of max-width, and could ask it here. It also over-reaches to height and all four insets. Receipted, which is why it is visible at all — but a receipt does not make a proxy into a measurement.

### `position` — 3 rules (2 implemented, 1 proposed, 0 wall)

Strict where strictness is right (a partial inset set genuinely does not determine a stretched box) and silent where it declines. `fixed` and `sticky` are a correct, honest, registry-level wall.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.position-inset-overlay-four-sides` | `implemented` | `emit-figma-script.ts:3769` | position:absolute with all four insets carried and every one a px length → an inset overlay — a child with STRETCH constraints on both axes and recorded offsets | a four-sided inset quartet lowers to a stretched overlay; anything less is refused by name | **none** | `round-tripped` |
| `emit.position-no-inset-falls-in-flow` | `proposed` | `emit-figma-script.ts:3709` | position:absolute with NO inset carried — the static-position case → nothing — the part is drawn as an ordinary in-flow child | out-of-flow is a fact even when the offsets are zero — it should lower to ABSOLUTE positioning at the static position, or be refused by name | **none** | `untested` |
| `schema.position-fixed-sticky-unspellable` | `implemented` | `contract-schema.ts:917` | position: fixed and position: sticky → nothing — there is no carried spelling | a named refusal | **none** | `untested` |

#### `emit.position-inset-overlay-four-sides`

**Context.** strictly all four; any missing side or any non-px value (auto, %, calc) fails the test

**Inverse** (`propose-figma.ts`, ctx.notes.push() emits `position:absolute plus minted geometry read off the drawn box` — **asymmetric**. the inverse cannot tell an authored inset quartet from a margin that drew the same rectangle — it says so in its own words and names FC-GEOMETRY-EXCLUDED.

**Lost.**
- the authored inset spelling; and, for a part with one to three insets, the overlay lowering entirely, with nothing said

**Why.** The strictness is correct — a partial inset set genuinely does not determine a stretched box — and `position-absolute-insets` round-trips. What is missing is the receipt on the decline: a part with three insets falls back to in-flow lowering and no one is told. The inverse, by contrast, states its own loss explicitly, which is the asymmetry the register exists to surface.

#### `emit.position-no-inset-falls-in-flow`

**Context.** absolutePartPlacement returns null, and the part falls back to ordinary in-flow lowering

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the out-of-flow-ness itself: the part now occupies space in the auto-layout it should have been lifted out of

**Why.** A silent fall-through with a visible consequence. An absolutely-positioned element at its static position still does not participate in flow, so drawing it in flow changes the layout of its siblings, not just of itself. The comment reasoning is that the inset-overlay and parent-bound paths own this case, but neither fires when there are no insets at all.

#### `schema.position-fixed-sticky-unspellable`

**Context.** the declared-channel registry admits exactly relative | static | absolute

**Inverse.** None — this lowering has no return leg.

**Lost.**
- fixed and sticky, completely — but by name, in the registry, with a note saying so

**Why.** A correct and honest wall, and both conformance cases are classified REFUSED to match. Figma has no viewport-anchored or scroll-anchored positioning, so there is nothing to lower to; the registry says so in the one place a reader would look. Registered as the shape a wall should take.

### `grid` — 5 rules (4 implemented, 1 proposed, 0 wall)

Two thirds of the layout conformance kit — 30 of the 45 layout cases — and the **healthiest family in the register**. Nothing in it drops silently: every impossibility is a `throw` or a named refusal. It is also where the schema is now out of date: the prose still says grids lower to nested auto-layout stacks, and the emitter has used Figma's native GRID layout mode for some time.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `anatomy.grid-align-fallback-stretch` | `proposed` | `anatomy.ts:154` | justify-items / align-items / justify-self / align-self on a grid, with any value the mapper does not recognise → stretch alignment, invented | stretch when CSS says stretch or normal; a named refusal otherwise | **none** | `round-tripped` |
| `anatomy.grid-two-dimensional-refused` | `implemented` | `anatomy.ts:283` | a genuinely two-dimensional grid reaching the FLEX-LOWERING path → nothing — refused by name | a named refusal: a 2D grid has no single-axis spelling | `refusals` | `untested` |
| `emit.grid-gap-pair-kept` | `implemented` | `emit-figma-script.ts:1732` | row-gap and column-gap on a grid container → rowGap and columnGap on the GRID frame, independently | the independent { row, column } pair | **none** | `round-tripped` |
| `emit.grid-hug-track-written-bare` | `implemented` | `emit-figma-script.ts:6302` | a fit-content grid track → { type: 'HUG' }, never { type: 'HUG', value: n } | fit-content lowers to a bare HUG track | `emit-facts` | `round-tripped` |
| `emit.grid-tracks-to-native-grid` | `implemented` | `emit-figma-script.ts:1707` | grid-template-columns / grid-template-rows → layoutMode 'GRID' with FIXED / FLEX / HUG tracks, plus gridRowCount and gridColumnCount | grid-template-columns / grid-template-rows in the declared spelling | **none** | `round-tripped` |

#### `anatomy.grid-align-fallback-stretch`

**Context.** gridAlign maps center, start-family and end-family explicitly, and returns `stretch` for EVERYTHING else

**Inverse.** None — this lowering has no return leg.

**Lost.**
- space-around, space-evenly, baseline and any unknown keyword — all collapse to stretch with no receipt

**Why.** The comment is right that `normal` means stretch for a grid item. The defect is the scope of the else: an unrecognised value is not the same as `normal`, and returning stretch for `baseline` invents an alignment the CSS never asked for. Adjacent to it, lowerTableDisplay hard-codes align:stretch for table and table-row from no observation at all — same pattern, same silence.

#### `anatomy.grid-two-dimensional-refused`

**Context.** lowerGridDisplay, the fallback for inline-grid and for grids that declined structured promotion: more than one column AND more than one row

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the whole layout for that container — named

**Why.** A model refusal, and the reason the grid family is the healthiest in this register: lowering a 2D grid to a one-axis stack would require inventing an axis, so the code declines and says which grid and why. Nothing in the grid family drops silently — every impossibility is a throw or a named refusal.

#### `emit.grid-gap-pair-kept`

**Context.** grid keeps BOTH axes — unlike flex, where one itemSpacing forces a choice

**Inverse** (`propose-figma.ts`, out.gap = { row, column }) emits `the independent { row, column } pair` — **asymmetric**. an authored `gap` shorthand and an authored row-gap/column-gap pair are indistinguishable in CSSOM, so the pair is the only recoverable form.

**Lost.**
- the authored `gap` shorthand spelling — receipted by name in the anatomy stage

**Why.** Both gap cases round-trip, and this is the rule that proves the flex side did not have to be lossy. The SAME CSS construct gets two different answers depending on the parent’s display: grid carries the pair, flex cannot spell row-gap at all. One of those two answers is a limitation of Figma; the other is a limitation of the schema, and the register is where that distinction becomes visible.

#### `emit.grid-hug-track-written-bare`

**Context.** runtime track write — a HUG track must be written as the bare type with NO value

**Inverse.** None — this lowering has no return leg.

**Lost.**
- nothing — the asymmetry is in the API and the rule accommodates it

**Why.** Registered because it is a lowering rule that exists ONLY because of an API asymmetry, and it is exactly the kind of thing that gets silently undone by a well-meaning refactor. The Figma API reads a HUG track back with a value attached, and writing that value back reinterprets the track as FIXED at that number — every fit-content track silently became a 1px column. The rule is right, it is named, and now it is gated.

#### `emit.grid-tracks-to-native-grid`

**Context.** a carried structured grid; each track lowers by kind — px to FIXED, fr to FLEX, fit-content to HUG

**Inverse** (`propose-figma.ts`, invertGridLayout) emits `grid-template-columns / grid-template-rows in the declared spelling` — symmetric.

**Lost.**
- minmax(), repeat(), named lines and auto-fit/auto-fill have no spelling and are refused upstream by the grid fences

**Why.** Worth stating plainly: the schema comment says "Figma has no grid track sizing; the canvas lowers grids to nested auto-layout stacks", and that prose is now OUT OF DATE. Figma shipped a native GRID layout mode with FIXED/FLEX/HUG tracks, this emitter uses it, and four track cases round-trip. The register records the rule the engine actually implements, which is better than the one the schema still describes.

### `placement` — 2 rules (2 implemented, 0 proposed, 0 wall)

Forward-only decisions with no CSS source at all. Two rules that look identical in shape — one is a deliberate, defensible layout of variant cells; the other silently reverts a designer's own repositioning on every amend. Telling them apart is the reason to write both down.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.placement-host-section-origin-pinned` | `implemented` | `emit-figma-script.ts:7313` | n/a — canvas placement has no CSS source; this is a pure forward-only structure decision → a NEW host section is placed at x = 0, y = (max bottom edge of the page’s existing children) + a 200px gutter; an EXISTING one is re-fitted in size and keeps the coordinates it already has | position on create; never move an existing section on amend | **none** | `untested` |
| `emit.placement-variant-cells-gridded` | `implemented` | `emit-figma-script.ts:7961` | n/a — the arrangement of variant cells within a component set → each variant cell placed on a padded grid derived from accumulated column and row extents | variant cells laid out on a deterministic grid | **none** | `untested` |

#### `emit.placement-host-section-origin-pinned`

**Context.** ensureHostSection, guarding the two position writes; still reached from all three call sites (the create path, amendSet and amendComponent), but now only ACTS on a section this call created

**Inverse.** None — this lowering has no return leg.

**Lost.**
- a host section that GROWS on amend can grow into the gutter below it and touch its neighbour (FC-HOST-SECTION-GROWTH) — preventing that would mean reflowing the neighbours, which is the one thing that cannot coexist with keeping a designer’s position

**Why.** REGISTERED AS `proposed` BECAUSE THE BEHAVIOUR IT DESCRIBED WAS A DEFECT, AND IT IS NOW `implemented` BECAUSE THE CANONICAL FORM THIS RULE ALREADY NAMED IS WHAT THE EMITTER DOES. The old write was `section.x = 100; section.y = 100;` run UNCONDITIONALLY after the create block, from all three call sites — so every component this emitter touched was pinned to one coordinate, and an amend reverted a designer’s deliberate move with no receipt. Measured live on the scratch file 2026-08-26, page "Census / altitude": five of eight host sections at the identical (100, 100), drawn on top of each other, which is exactly the stacking this rule predicted. The guard cited here is what makes “position on create; never move an existing section on amend” true, and core/host-placement-check.ts pins both halves plus the fixed point (an unchanged set is still placed, so re-running the sync converges instead of leaving a bad coordinate untouched forever).

#### `emit.placement-variant-cells-gridded`

**Context.** the per-variant placement loop, on both the create and the amend path, from accumulated column and row extents plus a fixed pad

**Inverse.** None — this lowering has no return leg.

**Lost.**
- nothing meaningful — variant cell coordinates are presentation, not contract

**Why.** Registered as a deliberate, defensible forward-only decision, to make the point that not every unregistered rule is a defect. Cell coordinates carry no library fact, the layout is deterministic, and the inverse correctly ignores it. Its neighbour twenty lines away — the pinned section origin — looks identical in shape and is not defensible, and the only way to tell them apart is to write both down.

### `slot` — 3 rules (3 implemented, 0 proposed, 0 wall)

Rules that exist purely to work around platform behaviour — the kind of knowledge that evaporates from a codebase and takes a 100×100 empty box with it.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.slot-birth-box-dissolved` | `implemented` | `emit-figma-script.ts:796` | an empty container that should size to its content → a FIXED → resize(1) → HUG round-trip, which forces the relayout a childless node never gets | an empty box measures its content, not its birth box | `emit-facts` | `untested` |
| `emit.slot-empty-fill-cleared` | `implemented` | `emit-figma-script.ts:7572` | a slot with no declared background → fills cleared, so the slot renders as Figma’s own empty-slot affordance | an undeclared background is no background | **none** | `untested` |
| `emit.slot-grid-refused` | `implemented` | `emit-figma-script.ts:4661` | display:grid on a slot part → nothing — refused by name, quoting the platform’s own error | a named refusal | **none** | `untested` |

#### `emit.slot-birth-box-dissolved`

**Context.** runtime: the axis reports HUG and the contract declared no size for it. Figma's createSlot / createFrame gives every childless node a 100×100 birth box that a HUG write alone does not dissolve.

**Inverse.** None — this lowering has no return leg.

**Lost.**
- nothing — and a refused round-trip throws rather than leaving a 100×100 box behind

**Why.** A lowering rule that exists purely to work around a platform behaviour, which is exactly the kind of knowledge that evaporates from a codebase. Without it every empty slot and every childless frame ships at 100×100. It refuses loudly when it cannot complete, and the guard that decides WHEN it runs is deliberately narrow — relaxing it once shipped a switch track at 1×1.

#### `emit.slot-empty-fill-cleared`

**Context.** runtime slot mint; Figma's default slot carries a solid white fill

**Inverse.** None — this lowering has no return leg.

**Lost.**
- no dashed chrome, no "Slot" label, no placeholder instance — the affordance is whatever Figma draws for an empty slot

**Why.** Correct — inheriting Figma’s default white would invent a paint the contract never declared, and this tree has a whole door register born from exactly that class of mistake. Registered so the reasoning survives, since the visible result (an apparently empty slot) is the kind of thing that gets "fixed" by someone adding a placeholder.

#### `emit.slot-grid-refused`

**Context.** Figma refuses GRID layoutMode on Slot frames outright

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the grid layout of that slot — named

**Why.** The right shape for a platform wall: it names the construct, quotes the API’s verbatim refusal, and states what a slot interior CAN be. A reader hitting this does not have to go and rediscover the constraint.

### `state` — 2 rules (2 implemented, 0 proposed, 0 wall)

The honest half of the story. When the state plane is not drawn, every part×state×channel is named individually rather than dropped in bulk. The unset-plane rule matters more than it looks: its loss propagates INTO the inverse, which reads the first variant cell as a default the library never declared.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.state-plane-undrawn` | `implemented` | `emit-figma-script.ts:5482` | :hover, :focus, :active and every other state’s channel values → nothing — the state plane is not drawn | a named refusal per channel (FC-STATE-PLANE-UNDRAWN) | `emit-facts` | `untested` |
| `emit.state-unset-plane-undrawn` | `implemented` | `emit-figma-script.ts:5471` | the library’s rendering when a defaultless enum prop is not supplied at all → nothing — there is no variant cell for the unset case | a named refusal (FC-UNSET-PLANE-UNDRAWN), one per defaultless axis | `emit-facts` | `untested` |

#### `emit.state-plane-undrawn`

**Context.** the contract carries states but statePreviews is off, so no State preview variant cell exists for a state binding to land on

**Inverse.** None — this lowering has no return leg.

**Lost.**
- every part×state×channel value — but each one individually named, in a triple loop, rather than dropped in bulk

**Why.** The honest half of the state story, and a good example of naming at the right granularity: it does not say "states were skipped", it enumerates every channel that did not land. A reader can tell exactly what the canvas is missing and turn one flag on to get it.

#### `emit.state-unset-plane-undrawn`

**Context.** an enum VARIANT axis with no default: the set enumerates the declared values and has no cell for "the prop was absent"

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the unset rendering; and a proposal read back from that set will wrongly call the first enum value the default

**Why.** Registered because the loss propagates INTO THE INVERSE, which makes it more than a drawing gap. The canvas cannot represent "absent", so the return trip reads the first cell as the default and writes a default the library never declared — a lowering loss that becomes a code-generation error one hop later. Named, which is why it is recoverable.

### `svg` — 3 rules (2 implemented, 1 proposed, 0 wall)

A sign convention, a first-wins tie-break, and a token binding that stops at one paint.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `anatomy.svg-host-plan-first-wins` | `implemented` | `anatomy.ts:1894` | a second (or third) <svg> under a host element that already has an svg plan → nothing for the later svgs — only the first becomes an icon | one icon per host, chosen deliberately, with the others refused by name | **none** | `untested` |
| `emit.svg-multipaint-token-identity-lost` | `proposed` | `emit-figma-script.ts:4136` | fill / stroke colour on an icon whose markup carries MORE THAN ONE paint → the imported SVG keeps baked hex paints, bound to nothing | each distinct paint bound to the token that produced it, or a named refusal | **none** | `untested` |
| `emit.svg-rotation-negated` | `implemented` | `emit-figma-script.ts:7461` | transform: rotate(Ndeg) on an icon part → node.rotation = -N | rotate(N) lowers to rotation -N | `emit-facts` | `untested` |

#### `anatomy.svg-host-plan-first-wins`

**Context.** the first svg found for a host wins; later ones are skipped

**Inverse.** None — this lowering has no return leg.

**Lost.**
- every svg after the first per host — with receipt channel "none", fully silent

**Why.** First-wins is a defensible tie-break; being silent about it is not. A button with a leading and a trailing icon is an ordinary shape, and this rule drops the second one without a word. It is one of the six structure decisions that carry receipt channel "none" — the silent frontier of the forward direction.

#### `emit.svg-multipaint-token-identity-lost`

**Context.** svgSinglePaintVar binds a variable only when the markup has a single paint; a multi-paint glyph gets no svgPaintVar

**Inverse.** None — this lowering has no return leg.

**Lost.**
- the token identity of every paint in a multi-paint glyph, with no receipt; and a part with no ink at all silently becomes #000000

**Why.** Registered as a proposal because the single-paint case proves the machinery exists — it just stops at one. Two silent outcomes hide here: a two-colour icon ships unbound hexes that no theme switch will move, and an inkless part is given pure black by a `??` fallback rather than being asked about.

#### `emit.svg-rotation-negated`

**Context.** CSS rotation is clockwise-positive; the Figma Plugin API is counterclockwise-positive

**Inverse.** None — this lowering has no return leg.

**Lost.**
- nothing — the sign flip is the whole rule, and it is exact

**Why.** Trivial-looking and exactly why it belongs in a register: a sign convention is invisible in review, silently correct in one direction, and produces a mirrored glyph if anyone "simplifies" it. Only a non-square rotation makes the error visible, which is how it survived to be found on a spinner.

### `wrap` — 2 rules (1 implemented, 1 proposed, 0 wall)

`layout.wrap` is documented in the schema as natively CARRY-BOTH, is written by the emitter, is applied by the runtime, and is read back by the inverse — and **nothing anywhere reads the CSS `flex-wrap` property**. Every link of the chain exists except the first.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `emit.wrap-horizontal-only` | `implemented` | `emit-figma-script.ts:6041` | flex-wrap: wrap → node.layoutWrap = 'WRAP' | layoutWrap on a horizontal stack; a named refusal on a column | **none** | `untested` |
| `schema.wrap-declared-never-detected` | `proposed` | `contract-schema.ts:406` | flex-wrap: wrap on any captured component → nothing — the field is reachable only by hand-authoring a contract | flex-wrap: wrap detected at capture and carried as layout.wrap | **none** | `untested` |

#### `emit.wrap-horizontal-only`

**Context.** runtime: applied only when the frame is HORIZONTAL, because Figma throws if layoutWrap is set on a column

**Inverse.** None — this lowering has no return leg.

**Lost.**
- wrap on a COLUMN stack, skipped at runtime — the only receipt is a comment emitted into the GENERATED SCRIPT TEXT, which never reaches facts or a dump
- the wrap cross-axis gap: counterAxisSpacing appears 0 times in this file

**Why.** The guard is required — Figma genuinely throws — so the rule itself is right. Two things make it registrable: the receipt is written into the wrong artifact (the generated script, not the fact stream), and the cross-axis gap that wrapping introduces has no field written anywhere, so a wrapping chip row gets its rows packed at whatever Figma defaults to.

#### `schema.wrap-declared-never-detected`

**Context.** the schema documents layout.wrap as natively CARRY-BOTH with a real Figma twin — and NOTHING in extract/ ever reads flex-wrap. Zero occurrences in fuse.ts and anatomy.ts.

**Inverse.** None — this lowering has no return leg.

**Lost.**
- every wrapping row in every captured library: a wrapping chip row lowers to one overflowing line

**Why.** A decision by OMISSION, which is the purest form the register can record: the schema declares the field, the emitter writes it, the runtime applies it, the inverse reads it back — and no producer ever sets it, because nothing reads the CSS property. Every link of the chain exists except the first. Capture is not the gap: window.__ALL_PROPS records every Chromium longhand including flex-wrap. This is a lowering hole, not a capture hole.

### `overlap` — 1 rule (0 implemented, 0 proposed, 1 wall)

`layout.overlap` is the mirror image: the INVERSE can detect it on a canvas a designer built by hand, and the forward direction has no code path to produce it. The Figma emitter reads `overlap` only inside comments.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `schema.overlap-declared-never-produced` | `wall` | `contract-schema.ts:403` | negative sibling margins — the AvatarGroup idiom → nothing — negative itemSpacing is never written by this emitter | negative sibling margins lower to negative itemSpacing | **none** | `untested` |

#### `schema.overlap-declared-never-produced`

**Context.** the schema documents layout.overlap as negative itemSpacing. No detector exists; the Figma emitter reads `overlap` only inside comments (4 occurrences, all prose); and the one CSS idiom that produces it is explicitly excluded by the `px <= 0` guard in the margin-gap lowering.

**Inverse** (`propose-figma.ts`, negative itemSpacing in every variant → layout.overlap) emits `layout.overlap = true, from a canvas the forward direction can never produce` — **asymmetric**. the INVERSE detects overlap and the FORWARD cannot emit it — a one-way channel.

**Lost.**
- overlapping avatar stacks and every similar composition, with no code path and no receipt whatsoever

**Why.** Registered as a WALL because today it is total: the React emitter honours layout.overlap, the Figma emitter does not read it at all, and the margin lowering excludes negative gaps before they could reach it. The asymmetry is the interesting part — the inverse can RECOGNISE overlap on a canvas a designer built by hand, so the two directions disagree about whether the construct exists.

### `order` — 1 rule (0 implemented, 0 proposed, 1 wall)

Read nowhere, and more dangerous than a plain drop: it mints as a channel no registry knows, which is the exact shape of the incident that once made `validateContract` refuse 32 whole components by name.

| rule | status | site | CSS construct → Figma | canonical | receipt | round trip |
|---|---|---|---|---|---|---|
| `schema.order-unregistered-channel` | `wall` | `contract-schema.ts:1372` | the CSS `order` property on a flex child → nothing — Figma has no order field; child order is the only ordering | a named refusal before minting — `order` lowers to child order or to nothing, never to a token | **none** | `untested` |

#### `schema.order-unregistered-channel`

**Context.** `order` is read NOWHERE in extract/ or core/. It survives isFusable, matches the numeric mintable kind, and mints as a token named `order` — which is in neither TOKEN_CHANNELS, nor DECLARED_CHANNELS, nor LITERAL_CHANNELS.

**Inverse.** None — this lowering has no return leg.

**Lost.**
- visual reordering entirely; and, worse than a drop, a channel name no registry knows can make validateContract refuse the whole component

**Why.** Cited to the tab-size incident recorded at this very site, because the shape is identical: a page-global numeric property nobody registered reached the mint, became a channel the registry did not know, and made validateContract refuse 32 whole components by name. `order` has every one of those properties today. Registered as a WALL because the honest lowering is refusal — CSS `order` reorders without moving the DOM, and Figma has only child order, so the two are not the same fact.

## What this register does not do

It does not change what the engine lowers. Naming, not carrying — the same discipline as the door register. The five items below are **plain bugs rather than decisions**; every one is registered as `proposed` with its site cited, and every one is left alone. A fix shipped inside a documentation change is how unexercised claims get made.

| bug | site | rule |
|---|---|---|
| `marginBoxCall` is missing from the standalone amend path — margins on a component root's direct children vanish on amend only, and `refuseSkippedMargins` does not cover that exit, so nothing names it | `emit-figma-script.ts:8077` | `emit.margin-box-absent-on-amend` |
| adjoining vertical margins are **summed** where CSS block flow collapses to `max` — a doubled gap, no receipt (the sum is correct for a horizontal row; the axis is the discriminator) | `emit-figma-script.ts:5754` | `emit.margin-collapse-summed-not-maxed` |
| literal `column-gap` on a column (and `row-gap` on a row) is dropped with **no receipt of any kind**, while the token path for the identical case calls `miss()` | `emit-figma-script.ts:2601` | `emit.gap-literal-cross-axis-silent` |
| the literal fallback set spells `gap`, a shorthand computed style never reports — the guard can never fire for a real gap, while the padding longhands were added and gap was not | `fuse.ts:1925` | `fuse.gap-literal-fallback-misspelled` |
| `order` mints into a channel registered in no registry — the exact shape of the `tab-size` incident that made `validateContract` refuse 32 whole components | `contract-schema.ts:1372` | `schema.order-unregistered-channel` |

## What is defensible as it stands

A register that only listed faults would be read as an attack rather than a specification. A real majority of these rules are well reasoned, and several are better receipted than the spec would be:

- **`emit.size-text-hug-vs-fill`** asks a measurement — does the box's packing agree with the text's own alignment? — rather than a proxy, and names the outcome with a code.
- **`fuse.size-hug-evidence`** requires its verdict to be uniform across every enabled combo and refuses by name when it is not. It is the model the text-part geometry exclusion, 1,300 lines away in the same file, fails to follow.
- **The whole `grid` family** refuses rather than invents. `anatomy.grid-two-dimensional-refused` declines to lower a 2D grid because doing so would require inventing an axis, and says which grid and why.
- **`emit.margin-box-skipped-refused`** computes exactly why the wrapper cannot be built and names it in a code the conformance baseline can quote.
- **`emit.grid-hug-track-written-bare`** exists only because of an API asymmetry that silently turned every `fit-content` track into a 1px column. It is precisely the knowledge a register is for.
- **`schema.position-fixed-sticky-unspellable`** is a correct wall, stated in the one place a reader would look, with both conformance cases classified to match.

## The fixed point

The gate mechanises the fixed-point constraint **declaratively**: an `implemented` rule with an inverse must have `inverse.emits` equal to its `canonical` form, or declare `inverse.asymmetric: true` **and** name in `lost` what the asymmetry costs. A rule that changes spelling on the way back and calls itself symmetric is refused.

This is a check on the *declared* forms, not an executed round trip — the empirical half is `conformance/CANVAS-BASELINE.json`, which the `roundTrip` column re-derives from. The two are kept apart on purpose. The sharpest fixed-point violation in the tree is recorded rather than asserted:

> **`emit.margin-box-wrapper`.** The forward leg mints a frame literally named `<child> (margin box)`. `grep -a` over the 11,574-line inverse finds exactly **one** occurrence, and it is a mention inside a note string — not a recognizer. So the inverse reads the wrapper as an ordinary anatomy part, promotes it, and the next forward pass lowers *that* part again. **The structure grows every pass.**

That is the measured result of option (a) — the spacer node — with its inverse half never written. It is the incumbent, and it is the thing that already broke.
