# Fluent 2 round — provenance

**Subject:** `@fluentui/react-components@9.74.5` — Microsoft's Fluent 2, a
65-package `@fluentui/react-*` family behind one suite package, styled by
**Griffel** (`@griffel/react` 1.7.7 / `@griffel/core` 1.21.3), on
`@fluentui/react-icons@2.0.335` and React 19.2.4. Pinned in `.fluent-sandbox/`
(git-ignored; RECON §1 recreate block) and — because the suite pins its 64
siblings by CARET RANGE and the runner only checks the suite's own version —
by the committed `sandbox.package-lock.json`, sha256
`c3b230dfbd8abd68408fefed9c8abc0e0fd46722faf8652e16e5c038452e0536`. All 14
component-package pins were re-verified against RECON §1 before capture.

The **tenth library** through the pipeline and the first **CSS-in-JS with
atomic class generation**. The capture-config review (RECON §4, approved
2026-08-08 by the coordinating session under owner delegation) predicted a
**2-engine-change round**. What it actually cost is the first section below.

---

## The generality verdict — predicted vs actual

**The recon bet 2 engine changes (E1 + E2), with E4 held in reserve for the
Spinner. The round cost 7, and E4 was never needed.** The bet lost, and the
interesting part is *how*: **both predicted changes landed exactly as
specified**, and every one of the five unpredicted ones is a **silent loss in
the instrument** that Fluent was merely the first library to walk into. Not one
of them is about Fluent.

| # | change | file | predicted? | class |
|---|---|---|---|---|
| **E1** | inert body-level roots are DOM plumbing — the existing `stripInertPortalChildren` predicate re-aimed at the new-root list before the single-root policy, with a receipt | `extract/computed/capture.ts` | **YES** | capture |
| **E2** | (a) strip inert children BEFORE the wrapper measurement; (b) a zero-AREA box draws no ink whatever its `background-color` | `extract/computed/capture.ts` | **YES** | capture |
| 3 | `scale` registered in `TOKEN_CHANNELS` as **annotate** | `packages/schema/src/contract-schema.ts` | no | schema |
| 4 | the settle probe samples the **pseudo-element planes**, not just the element | `extract/computed/capture.ts` | no | capture |
| 5 | the determinism refusal **names** structural / serialized divergence | `extract/computed/run.ts` | no | instrument |
| 6 | a render that **throws** refuses by name instead of reporting zero roots | `extract/computed/capture.ts` | no | instrument |
| 7 | grid placement resolves the **real grid child** through a margin-box wrapper | `core/emit-figma-script.ts` | no | emitter |

**Corpus-neutrality is measured, not asserted.** The complete capture-side delta
(1, 2, 4, 6) was proven by running committed libraries with the engine reverted
and again with it applied, in the same session, and byte-comparing the two runs:

- `mui/menu`, `mui/dialog` — **byte-identical** (portal roots, focus-trap
  sentinels, the full-bleed scrim demotion path)
- `carbon/button`, `carbon/checkbox` — **byte-identical** (`::before`/`::after`
  decor and 70–110 ms transitions, the exact profile change 4 touches)

Both libraries *do* differ from their committed bytes; that drift reproduces
exactly with this round's edits reverted and belongs to `b5968ac9` (landed
earlier the same day), not here. Both corpora were restored untouched. Change 7
is corpus-neutral **by construction**: `message-bar.figma.js` is the only
emitted script in all of `examples/**/figma` that carries the grid placement
sequencer at all (116 scripts checked), because MessageBar is the corpus's first
grid-rooted component.

**Three further predicted changes — E3, E5, E6 — had already landed** the same
day in `b5968ac9`, so they are not this round's cost. E5 is verified working
(below). **E3 is verified NOT working**, which is the round's headline.

---

## The headline: a fix landed, was described as closing this, and did not

**RECON H3 predicted Checkbox would mint anonymous literals for every colour
channel. That prediction is still true, and the concrete check — "verify the 31
rules / 11 variables now recover their theme token names" — is FALSIFIED.**

Measured on the shipped capture: **zero recovered.** Checkbox's 96 verified
source facts are `font-size`, `line-height`, `padding-left` and root `color` —
not one indicator colour. The indicator channels are named skips:

```
indicator.background-color: candidate --fui-Checkbox__indicator--backgroundColor
  = #0f6cbd (value MATCHES the computed value) — no candidate names a leaf of
  this library's DTCG token file, so there is no NAME to bind.
```

One candidate, not two: the additive hop never fired. **The mechanism, measured
rather than inferred.** `probe5` shows the definitions exist —
`.f35ds98 { --fui-Checkbox__indicator--backgroundColor: var(--colorCompoundBrandBackground) }`
— and walking the real DOM shows `f35ds98` and `fei9a8h` sit on
**`span.fui-Checkbox`, the ROOT**. The indicator is a *descendant* that receives
those variables by **inheritance**. The reader builds `defs` only from rules
where `el.matches(sel)` for the element being read, so reading the indicator it
has nothing to hop to. The fix cannot fire on this shape **by construction**.

**Why it was certified anyway.** `extract/computed/local-var-hop-check.ts` — the
gate shipped with the fix — builds its page as:

```
#stage .ind { --fui-Checkbox__indicator--borderColor: var(--colorCompoundBrandStroke); }
#stage .ind { border-bottom-color: var(--fui-Checkbox__indicator--borderColor); }
```

Definition and use **on the same element**. Its docblock claims it is "a gate
and not a demo … against a page carrying the real indirection shape", but the
real shape is *define on the ancestor, consume on the descendant* — which is the
entire reason the idiom uses a custom property instead of a literal. The gate is
green and the case it was written for still loses every name.

**Named, not fixed here.** Resolving definitions through the inheritance chain
changes the reader for every library and would re-pin committed corpora; that is
its own round with its own corpus proof. Checkbox's 67.2% floor is this cost,
showing up exactly where the recon said it would.

---

## Witnessed refusals — predicted vs surprise

**Predicted by the recon and honored:**

- **H1 — MULTI-ROOT-CAPTURE on Dialog, measured to the exact number.** Witnessed
  `3 portaled + 1 in-stage new roots`, precisely as the recon's baseline-diff
  probe predicted: tabster appends two `<i data-tabster-dummy>` focus sentinels
  to `document.body` beside the portal node. Closed by E1. The recon's other
  claim held too — Fluent's overlay structure really is better than Radix's
  (backdrop and surface nest INSIDE one portal node), so the refusal was
  entirely the focus manager's plumbing.
- **H2 — every Fluent overlay captured the provider wrapper.** Witnessed as four
  `portal-screenshot-unavailable: … locator.screenshot: Timeout` receipts on
  Tooltip: the captured root was a 900×0 box that declares an opaque fill, draws
  no ink, and cannot be screenshotted. Closed by E2; the Tooltip root is now
  `div|Tooltip__content` and its pixel rows went from **0 measured / 4
  no-original** to **4 measured / 0 no-original**.
- **H4 — the shorthand ceiling costs radius and padding by name.** Measured
  across the slice: 45 `shorthandVarSkip` receipts (TabList alone 31). Fluent's
  alias story is a COLOUR story, exactly as Carbon's was.
- **H5 — overlays carry zero source-token facts.** Tooltip and Dialog both
  report `0 verified fact(s)` (`portalSweep` takes no `varPrefix` — the standing
  corpus-wide degradation, docs/22 §8.1).
- **H7 — `fui-Tab__content--reserved-space` dropped by the BEM modifier
  filter.** TabList's anatomy carries an unnamed `label-3(span|)` where that
  slot should be: one part, positionally aligned, name lost.
- **H9 — every axis defaultless.** Honored by hand-transcribing all 42 `@default`
  / `@defaultvalue` tags into the seeds. Cross-checked against the now-fixed
  extractor (E5, `b5968ac9`): **23 of 26 axis defaults agree exactly**; two
  differences are this round's documented spellings and the third is an
  extractor refusal-by-name (below).
- **H11 — icons are clean.** 6 floor-reconstructed assets promoted, single
  `<path>`, no stroke channel needed.
- **H12 — pseudo-decor everywhere.** Measured on Badge, Card, MessageBarTitle,
  Input, Tab and Spinner's tail; one named refusal
  (`pseudo-decor-outside-grammar` on the Tooltip arrow, which paints at
  `position:static` and the bounded grammar reads absolute boxes only).

**Surprises (not in the hazard ledger):**

1. **H8 is FALSIFIED, and the reason is a feature the recon did not know
   existed.** The recon measured `animation: rb7n1on 1.5s infinite` with the
   transform moving between two reads 300 ms apart, predicted a settle timeout
   or a double-run failure, and held E4 (`browser.reducedMotion`) in reserve.
   Measured: **byte-identical across two full sweeps**, 99.927% replay,
   **128/256 pixel-AA perfect** — one of the round's better rows. No quarantine,
   no `reducedMotion` lever, no E4.
   The mechanism is `pinInfiniteAnimationsJs` (`extract/computed/capture.ts`),
   which predates this round: every animation whose timing reports
   `iterations === Infinity` is **paused and set to `currentTime 0`** before each
   capture, so the sampled value is the animation's own 0% keyframe — a real,
   deterministic point of the declared animation — and the keyframe names are
   recorded in provenance (`animationPinning`). Finite animations and
   transitions are deliberately NOT touched, which is exactly why the Input
   `::after` underline (a finite transition) still needed change 4 while the
   Spinner needed nothing. **E4 was never the right lever**: reduced-motion
   emulation would have changed what the library renders, where pinning captures
   what it declares. The prediction failed loudly, which is why it was worth
   stating — and the correction is more useful than the guess would have been.
2. **A crashed render was reported as a measurement.** Tooltip's first capture
   returned `0 portaled + 0 in-stage new roots`. Nothing had portaled nothing:
   the render had **thrown**. Fluent's trigger components clone their child
   through `cloneTriggerTree`, which raises *"A trigger element must be a single
   element for this component"* when `React.isValidElement` is false — and the
   harness's `childrenSpec` always renders an ARRAY, so even a one-entry spec
   fails. Nothing in the harness listened for errors, so a crash and a
   legitimate zero were byte-identical. Fixed two ways: the config mounts the
   trigger through `childWrap` (one valid element), and change 6 makes the
   harness **refuse by name** with the library's own message. Dialog is
   unaffected — `useDialog` reads children through `React.Children.toArray`.
3. **The double-run gate could not name its own cause.** It failed twice with
   `UNSTABLE channels across double-run: (structural)` and an EMPTY witness
   list, sending the investigation to the wrong component. The witness loop read
   `node.style` at matching indices only; `node.pseudo` and `controls` are both
   inside `canon()` and neither was ever inspected. Change 5 adds structural
   witnesses and a catch-all that locates the divergence from the same
   serialization the comparison uses. It named it on the first run:
   `Input:outline.small.enabled__focus-visible … transform: "matrix(0.873374,…)"
   vs "matrix(0.87383,…)"`.
4. **…and the cause was a settle probe blind to pseudo-elements.** That transform
   is Fluent's Input focus underline — an `::after` transitioning
   `scaleX(0) → scaleX(1)`, sampled ~87% through its travel. `settleProbeJs` read
   `getComputedStyle(el)` and nothing else while both readers also record
   `::before`/`::after`/`::marker`/`::placeholder`, so a component whose motion
   lives ENTIRELY on a pseudo-element looked instantly stable — the element
   genuinely was not moving. Change 4 samples `READ_PSEUDOS` in the probe, so the
   settle frontier and the read frontier are the same list. **The file warns
   about this exact failure mode one function earlier, for shadow roots.**
5. **Dialog cost a second, unpredicted change after E1 closed H1.** With E1 in
   place it captured cleanly (3/3 combos, 15 parts) and then failed generator
   validation: `part "dialogsurface" tokens sets "scale" which is not a token
   channel`. Fluent's DialogSurface settles its open animation at an explicit
   `scale: 1` (the CSS initial is `none`, so the fusion is right to read `1` as a
   styled fact). `scale` is the third CSS Transforms Level 2 independent-transform
   longhand — the repo already handled `translate` (folded to absolute placement)
   and `rotate` (the `transform` grammar's rotate branch) — and had no entry at
   all. Registered as **annotate**, not drawn, deliberately: a Figma node's size
   IS its box, so a scale factor cannot be lowered without silently rewriting the
   box it applies to. `scale: 1` is the identity, so nothing is lost on canvas
   today; a non-identity scale now gets a named miss instead of a wrong box.
6. **The tri-state glyph did not promote, and the config could not have saved
   it.** The recon predicted the glyphs would ride the one-axis discipline, and
   the config honored it exactly (`checked` is ONE axis, mapped to
   `false`/`true`/`"mixed"`). Refused anyway:
   `svg-content-multi-axis: Checkbox.indicator — markup varies over more than one
   axis`. The glyph's viewBox is a function of `size` too (12×12 medium, 16×16
   large — see the `svg-viewbox-reconstructed` receipts), so the markup varies
   over TWO axes. **The single-axis rule is unsatisfiable by config here:** the
   only way to earn the glyph is to pin `size`, i.e. trade a real variant axis
   for an icon. The compile receipt now pins the *refusal*, not the promotion.
7. **A literal root text is carried and then silently dropped at emit.** The
   Tooltip bubble's copy IS captured and IS carried —
   `root-literal-text-carried: … carried verbatim (named)` — and lands at
   `anatomy.root.text`. It reaches **no canvas node**, because
   `core/emit-figma-script.ts` renders `text` on PARTS only and never reads the
   root's. Fluent's Tooltip is the **only** contract in the entire corpus
   carrying `anatomy.root.text`, which is why no earlier round could have found
   it: every other component's literal text either matches a prop sample and
   becomes `content`, or sits on a child part. Named, not fixed — where a root's
   own text becomes a canvas child is a grammar decision. Pinned in the compile
   receipt so the day it starts working, the pin fails loudly.
8. **MessageBar is CANVAS-STOPPED — the corpus's first grid-rooted component.**
   Its contract and React emission ship and pass every other gate; only the
   canvas script cannot build. Two defects, both in grid code that landed the
   same day: **(a) FIXED** — the placement sequencer read anchors from, and wrote
   positions to, the BUILT node even when `wrapInMarginBox` had made a wrapper
   the real grid child, so a margined part never claimed its cell and the next
   sibling hit a hard canvas refusal (`Can't place child at this position`);
   change 7 resolves the grid child by ancestry, which also covers any future
   wrapper. **(b) NAMED, left to the grammar's owner** —
   `grid-placement-cycle-no-spare`: breaking a permutation cycle by PARKING needs
   a spare cell and a fully-targeted 1×4 grid has none; the general technique is
   to detach one child, place the rest, and re-insert. Excluded **loudly** (the
   compile receipt and the batch banner both print it), never silently skipped.
9. **The extractor refused one default rather than guessing it.** `Input.appearance`
   documents `@default 'outline'` followed by a blank line and a deprecation
   note; the tag parser is line-greedy, so it read the literal plus the prose and
   refused: *"JSDoc @default carries PROSE, not a literal … no default carried"*.
   Correct, loud behaviour — and a quality note for the extractor's owner, since
   the literal is unambiguously alone on its first line. The seed supplies the
   value by hand.

---

## Control-case accounting — scoring the recon's bet

> *"7 of the 12 components (Button, Badge, Avatar, Card, MessageBar, Switch,
> Input) should be config-only; TabList costs two named residues; Spinner costs
> E4 or a named quarantine; the four overlays cost E1+E2 between them."*

| claim | outcome |
|---|---|
| Button, Badge, Card, Switch config-only | ✔ **4/4 exactly** |
| Avatar config-only | ✔ config-only, but needed **two config spellings** the review could not have known about (below) |
| **Input** config-only | ✘ cost change 4 — its `::after` focus underline broke the double-run gate |
| **MessageBar** config-only | ✘ cost change 7 and a canvas stop |
| TabList: two named residues | ✔ H7 and H12 both witnessed; also a referee-refused `figmaStatePreviews` |
| Spinner: E4 or quarantine | ✘ **neither — H8 falsified** |
| the overlays cost E1+E2 | ✔ both, plus `scale` for Dialog |

**5 of 7 config-only.** The falsification the recon told us to watch for — *"an
engine change that is about Fluent rather than about a mechanism"* — **did not
occur**: all seven changes are about a mechanism, and four of them were latent
silent losses that any library with the same shape would have hit.

**Three config spellings forced by named engine rules** (recorded on the
components they affect in `extract/computed/configs/fluent.json`; none changes a
mounted library value):

1. **Avatar `active`** — Fluent's third value is literally the string `"unset"`,
   which collides with `enumeration.unsetLabel` by an explicit refusal in
   `propSpaceFor`. Spelled `"none"` in the contract, mapped back through
   `axisValueMap`.
2. **Avatar `size`** — left DEFAULTLESS so the approved 3-of-13 subset
   `{24,48,96}` stays exactly as approved while the base combo still mounts the
   prop ABSENT and therefore renders Fluent's real documented default (**32**),
   which is not a member of that subset. Declaring any subset member as the
   default would assert a default the library does not have.
3. **TabList `vertical`** — a BOOLEAN, and `propSpaceFor` refuses boolean axes by
   name ("booleans ride stateProps"), while the presence-prop spelling would push
   every per-plane binding into overflow by rule. Spelled as a 2-value
   `orientation` enum mapped to `{vertical:false|true}`.

---

## Reader configuration — what Fluent needed and why

`extract/computed/configs/fluent.json`: `classAllow: "^fui-(?!FluentProvider)"`
with `classPrefix: "fui-"` — **Carbon's answer, not Tailwind's**, and the first
library in the corpus where atomic styling and named part identity coexist.
RECON §2.2 measured 366 distinct classes on the probe page: 44 stable `fui-*` BEM
slot classes cleanly separated from 322 Griffel hashes, and the `fui-*` classes
are **combo-invariant** (Button `primary/medium` carries 52 classes,
`subtle/small` carries 38, and the only non-atomic member of the 16-class
intersection is `fui-Button` plus its reset class). The negative lookahead drops
the provider and its `_r_0_` `useId` counter.

`varPrefix: "--"` (Fluent's custom properties carry no vendor prefix), no
`tokenGroup` — the reader's var→leaf transform never emits a `.`, so the DTCG
tree is FLAT: 459 leaves at top level, **zero collisions** measured across all
459.

**The mount is the whole round.** `<FluentProvider theme={webLightTheme}>`
declares all 459 theme custom properties on a WRAPPER DIV, never on `:root`. The
bind probe was re-run at capture time, before any sweep:
`getComputedStyle(document.documentElement)['--colorNeutralForeground1']` and the
same on `document.body` both return **`''`**; the provider div and the
`.fui-Button` inside it both return **`#242424`**. Without the provider the page
still renders and every `var()` silently falls back to the browser's initial
values — the Carbon trap and the astryx `@scope` trap in one. **No stylesheet
import**: Griffel ships no stylesheet at all and injects every rule at runtime —
the first library in the corpus with an empty CSS story.

**`fonts`: deliberately unconfigured, and recorded as an unobtainable
substrate.** Fluent's stack is `'Segoe UI', 'Segoe UI Web (West European)',
-apple-system, …` and the library ships **zero `@font-face` rules** (measured: 0
across all 19 injected sheets). Segoe UI is a Windows system font; it is not on
npm and cannot be inlined. This is **not** Carbon's situation — Carbon's faces
exist and were merely unconfigured; Fluent's do not exist to configure.
Substituting a metric-compatible lookalike would re-pin every pixel reference to
a face the library never names, so no `fonts` block is declared. Read the
computed-equality floor, not the pixel number — with the caveat that Button
(**341/360**) and Badge (**480/768**) are pixel-AA perfect anyway, because both
sides of the gate resolve the same fallback stack.

`mintedBootstrap` rode the first pass only (task-#28 ordering guard: zero-leaf
stub, receipted); promote filled the tree and the capture was **re-run against
the shipped minted tree** — the committed scorecards record
`shippedMinted.leavesAdded` **1441–1670** per component with `bootstrap: false`.
The flag is gone from the committed config.

---

## Pipeline (repo root)

```bash
node examples/fluent/scripts/build-tokens.mjs           # 459 flat DTCG + Light/Dark modes + vars.css
npm run extract:computed -- --harness examples/fluent/.fluent-sandbox \
  --config extract/computed/configs/fluent.json --out extract/computed/out/fluent
npx tsx examples/fluent/scripts/promote-floor.mjs       # + figmaStatePreviews probe + source-alias pass
npx tsx packages/cli/src/cli.ts figma examples/fluent/contracts --out examples/fluent/figma \
  --icons examples/fluent/assets/icons \
  --tokens examples/fluent/tokens/fluent.dtcg.json,examples/fluent/tokens/fluent-minted.dtcg.json
npx tsx packages/cli/src/cli.ts generate examples/fluent/contracts --target react \
  --out examples/fluent/generated --icons examples/fluent/assets/icons \
  --tokens examples/fluent/tokens/fluent.dtcg.json,examples/fluent/tokens/fluent-minted.dtcg.json
node examples/fluent/scripts/build-figma-tokens.mjs
node examples/fluent/scripts/figma-compile-receipt.mjs
node examples/fluent/scripts/build-genesis-batch.mjs
npx tsx packages/cli/src/cli.ts figma bundle examples/fluent/contracts \
  --tokens examples/fluent/tokens/fluent.dtcg.json,examples/fluent/tokens/fluent-minted.dtcg.json \
  --modes examples/fluent/tokens/modes/fluent.light.dtcg.json,examples/fluent/tokens/modes/fluent.dark.dtcg.json \
  --name Fluent --icons examples/fluent/assets/icons --out examples/fluent/figma/fluent.bundle.json
npm run extract:computed:scorecard -- --dir extract/computed/out/fluent \
  --config extract/computed/configs/fluent.json --write
```

The token wrap re-asserts and REFUSES on drift: **459** light keys, **459** dark
keys, the identical key SET, **315** differing values, 455 string + **4 number**
values (`fontWeight*`), 0 leaf collisions — all built twice and byte-compared.
Both emissions (React and Figma scripts) were run **twice and byte-compared
identical**; the capture's own proof is its built-in second full sweep
("byte-identical across two full sweeps in one session"), which ran green on the
final two passes after locating and closing the pseudo-plane settle hole.

---

## Gates (default-state floor)

| component | axes | combos | computed | pixel AA perfect | src facts | named refusals |
|---|---|---|---|---|---|---|
| Badge | appearance(4)×color(8)×size(6) | 192 | **97.849%** | 480/768 | 1000 | 1 |
| MessageBar | intent(4)×shape(2) | 8 | **97.015%** | 0/32 | 144 | 9 |
| Button | appearance(5)×size(3)×shape(3) × disabled | 90 | **96.283%** | **341/360** | 468 | 1 |
| Avatar | shape(2)×active(3)×size(4) | 24 | 92.385% | 32/96 | 96 | 5 |
| Tooltip | appearance(2)×withArrow(2) — portal | 4 | 91.964% | 0/4 | 0 | 6 |
| Spinner | size(8)×appearance(2)×labelPosition(4) | 64 | 83.333% | 128/256 | 384 | 13 |
| Dialog | modalType(3) — portal | 3 | 82.353% | 0/0 | 0 | 54 |
| Switch | checked(2)×labelPosition(3) × disabled | 12 | 81.492% | 0/48 | 70 | 2 |
| Input | appearance(6)×size(3) × disabled | 36 | 75.255% | 0/144 | 261 | 5 |
| Card | appearance(4)×size(3)×orientation(2) × disabled | 48 | 74.836% | 0/192 | 174 | 14 |
| Checkbox | checked(3)×size(2)×shape(2) × disabled | 24 | 67.195% | 8/96 | 96 | 22 |
| TabList | appearance(4)×size(3)×orientation(2) × disabled | 48 | 64.978% | 0/192 | 756 | 23 |

**TOTALS: floor 81.0%** (computed equality, exact string, weighted over
**134,570 cells**) · **155 named refusals** · **0 open review-queue items** ·
**0 unmeasurable** · **0 quarantined**. 2,191 gate-shots written for the visual
lane. Source-bindings: **3,549 verified facts** across the ten non-portal
components; the minted tree splits **288 source-aliased / 1321 literal**.

Genesis: **484 API-grid variants across 11 sets**, batch mock-proven (12 blocks,
refuse-to-write), **2163 variables** (288 Figma-native source aliases,
Light/Dark from `webLightTheme`/`webDarkTheme`). Compile receipt: 11 scripts
green, MessageBar canvas-stopped and printed.

---

## Named residuals and deferrals (defect-first)

- **Checkbox's indicator colours are anonymous literals** — the H3 mechanism
  above. Pixels right, names gone. The inheritance-chain hop is the named unlock.
- **MessageBar ships no canvas script** (`grid-placement-cycle-no-spare`).
- **The Tooltip bubble's copy reaches no canvas node** (`anatomy.root.text` is
  never read by the Figma emitter) — corpus-first, pinned.
- **Checkbox's tri-state glyphs do not promote** (`svg-content-multi-axis`);
  unsatisfiable by config while the viewBox is a function of `size`.
- **Dialog's captured root is still the zero-area provider wrapper** — E2 unwraps
  a wrapper with ONE live child, and Dialog's has two (backdrop + surface), which
  is correct for a multi-part overlay but leaves it with **no pixel evidence**
  (3 `no-original` rows, never scored).
- **Tooltip and Dialog carry zero source-token facts** (`portalSweep` takes no
  `varPrefix` — standing corpus-wide, docs/22 §8.1).
- **TabList's reserved-space slot loses its name** (H7) and its
  `figmaStatePreviews` is **refused by the referee by name** (its focus-visible
  plane declares no token overrides, so the preview would render identically to
  Default).
- **45 shorthand-ceiling skips** — radius and padding by name (H4).
- **11 calc() declarations lost the token name** across Card, Checkbox and Switch.
- **`type` on Input** and the **`icon` slot on Button** deferred by name;
  **Avatar's `image` slot** refused by name (needs a remote src in a network-free
  harness).
- **Tab's own axes** ride the child-axis limitation (docs/21 §7.3) — pinned,
  deferred by name.

---

## Coverage of this library — the denominator

**12 contracts shipped of 12 configured** (MessageBar canvas-stopped, named).
The denominator, measured from the suite package's rollup: **192 distinct
`<component>ClassNames` exports** across **65 `@fluentui/react-*` packages**.
Published fraction: **12 / 192 = 6.3%**. Excluded by name: every data-dense
organism (`DataGrid`, `Table`, `Tree`, `Virtualizer`, `Carousel`), every overlay
beyond the two probed, `Combobox`/`Dropdown`/`TagPicker`, the `unstable/`
subpath, and `@fluentui/react-icons`' ~2,700 icon components.

The static pass is a **simulation**, and says so: Fluent publishes **0 `.tsx`
and 0 non-`.d.ts` `.ts` files** across all 65 packages, so
`examples/fluent/scripts/rehydrate-types.mjs` applies two purely mechanical
rewrites to the api-extractor rollups. Types, members and JSDoc are copied
byte-for-byte; nothing about the API surface is invented.
