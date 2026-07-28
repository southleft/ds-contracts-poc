# Altitude round — provenance

**Subject:** `altitude-web-components@1.0.2` (published npm; Lit 3; 65 components),
pinned in `.altitude-sandbox/` with `react@18`, `react-dom@18`, `esbuild`.
The **eighth library** through the pipeline and the **first with a shadow DOM**:
every component's CSS lives in `shadowRoot.adoptedStyleSheets` and every
component's rendered box lives inside an open shadow root, so the reader had to
learn to cross that boundary before a single number could be trusted.

Recreate (git-ignored):

```bash
mkdir -p examples/altitude/.altitude-sandbox && cd examples/altitude/.altitude-sandbox \
  && printf '{"name":"altitude-sandbox","private":true}\n' > package.json \
  && npm i altitude-web-components@1.0.2 react@18 react-dom@18 esbuild
```

The source repo (`/Users/tjpitre/Sites/altitude`) was read for ground truth, but
**every number here is measured against the PUBLISHED dist** — that is the
artifact a user installs. Where the two disagree, the disagreement is a finding
(see "THE TOGGLE DOES NOT SHIP").

---

## THE SHADOW-DOM VERDICT

**Engine files changed: 1** (`extract/computed/capture.ts`), plus one field added
to `SweepResult` and threaded into provenance (`run.ts`) and the offline re-fuse
(`regate.ts`). Every change is a general open-shadow-DOM rule and every one is a
no-op on a page without shadow roots — proven, not asserted, in "CROSS-LIBRARY
BYTE-IDENTITY PROOF" below.

### The two policy decisions

**POLICY 1 — the captured root of a shadow host DESCENDS.** The reader picks the
stage's first box-drawing child as before, then walks down through open shadow
roots to the first box-drawing element it finds, recording the host chain as
provenance (`_provenance.shadowHostTrails`).

*Probed first, and the probe decided it.* Altitude's hosts draw **nothing**: the
published bundle contains exactly **one `:host` selector across all 65
components** (`:host(:last-child) .al-c-list-item`, on `al-list-item`) and
**zero `display:contents`**. So a host has no class stem, no background, no
padding — carried as the captured root it would add a nameless wrapper part to
every component's anatomy and hand the class-stem part namer nothing to name.
Descending gives `button.al-c-button`, `div.al-c-badge`, `hr.al-c-divider` —
the elements that actually draw, and the ones the `al-c-` class prefix names.

**POLICY 2 — `<slot>` is SPLICED AWAY, replaced by `assignedNodes()`.** The brief
proposed "descend into assignedNodes()", i.e. keep the slot as a node and read
its assignment as children. The probe changed that: a `<slot>` computes to
`display: contents`, measures 0×0, and carries no class — keeping it would put a
nameless boxless part in the anatomy of **all eight** round-1 components (every
one of them slots its text). Splicing removes it and loses nothing: `::slotted()`
rules style the assigned elements themselves, and the host's light children are
never walked directly, so slotted content is neither lost nor duplicated.

A **nested** host is a different case and is KEPT: `al-avatar hasBadge=on`
mounts a real `<al-badge>` inside the avatar's shadow tree, and that host
occupies a box in its parent's layout and is the inheritance link its inner box
reads. Only the *captured root* descends past a host. This is the **depth-2**
case, and this round exercises it on exactly that axis.

### W-items — what landed, what did not, and why

| item | verdict |
|---|---|
| **W1** shadow traversal in `readEl` + root pick | **LANDED** (policies 1 and 2). Without it, every Altitude capture would have been the host's light children — the slotted text with no box around it. |
| **W2** per-root VRULES | **LANDED.** `document.styleSheets` carries **zero** component rules; the rules are constructed `CSSStyleSheet`s on `shadowRoot.adoptedStyleSheets`. Rules are collected per `el.getRootNode()` and an element only ever matches rules from its own root — which is also the correct cascade. |
| **W2b** the `:host` branch | **LANDED, UNPROVEN.** `el.matches(':host…')` does **not** throw in Chromium (the brief expected it to); it quietly returns `false` for every element *including the host*, so the existing `try/catch` was never even reached and a `:host` binding would be dropped in silence. The branch splits the leftmost `:host` / `:host(S)` compound and tests it against the root's host. **Altitude exercises it zero times** (one `:host` rule library-wide, none on a round-1 component), so it is correct by construction and unproven by capture. `:host-context()` and a combinator immediately after the host compound are outside the grammar. |
| **W3/W4** interaction root locator | **LANDED, and the diagnosis was wrong.** The premise was `display:contents` hosts (29/65). In the *published* dist there are none. The real failure is simpler: Playwright's CSS engine pierces open shadow DOM for **descendant** combinators but not for `>`, so `[data-combo] > *` resolves to the HOST — and an unstyled host can have a zero-size box, at which point `.filter({visible:true})` resolves **empty** and `hover()`/`mouse.down()` throw. Measured on `al-divider` (0×1 in a flex stage) and `al-toggle` (0×0). The fix is not a second heuristic: the page stamps `data-capture-root` on the element `alStageRoot()` picks — the **same function the reader uses** — and the driver targets that attribute. Nothing is stamped, and the locator is byte-for-byte the old one, unless the stage's chosen child really is a shadow host. |
| **W5** focus-visible receipt | **LANDED — it was wrong, not merely missing.** Measured on `al-button`: `document.activeElement` is the HOST, `host.matches(':focus-visible')` is **false**, and `button.al-c-button` inside the shadow root is **true** with a real `3px` outline. The old receipt would have recorded "the driver never reached the focus-visible plane" on every Altitude capture while the capture itself recorded the ring. |
| **W6** settle probe | **LANDED.** `querySelectorAll` does not pierce shadow roots, so the poll saw the stage and the unstyled host only — nothing it looked at ever transitions, the first pair of samples matched, and the sweep declared stability **instantly**. Every Altitude component transitions (`transition: all var(--al-theme-animation-duration)` = 200 ms), so this was a guaranteed mid-flight capture and a guaranteed double-run failure. |
| **W7** form-state reset | **LANDED** (shadow-piercing input collection), and **unexercised**: the only round-1 candidate with a shadow-internal `<input>` was `al-toggle`, which is dropped (below). |
| **W8** portal-in-shadow | **NOT THIS ROUND**, as scoped. `al-dialog`/`al-drawer` render inside their own shadow root rather than portaling to `document.body`, which is a different problem shape from the baseline-diff reader. The portal harness page was kept in **lockstep** with the census page anyway (custom-element mount, head styles, pre-script) so the two cannot drift — the Carbon `renderKids` lesson. |
| depth-3 nested shadow | **NOT THIS ROUND.** Depth-**2** is exercised (avatar → badge). |

### Two non-W-item findings the engine had to absorb

**`tagName` can be SHADOWED by a reactive property.** `al-heading` declares
`accessor tagName: 'h1'|…|'h6' = 'h2'`, so on every instance `el.tagName` reads
`"h2"` instead of `"AL-HEADING"`. The reader now takes `tagName` off
`Element.prototype`. Identical for every ordinary element; the committed captures
do not move.

**Stripping `@import` naively voids the entire token block, silently.** The
harness inlines the library's global stylesheet (it must exist as
`style#al-theme-sheet` *before* the first `connectedCallback`), and the harness is
network-free, so the Google-Fonts `@import` has to go. Altitude's spells it
`@import"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400;1,600&display=swap";`
— **the URL contains semicolons.** A `/@import[^;]+;/` strip cuts at the first
one, leaves `0,600;1,400;1,600&display=swap";` at the top of the file, and the
CSS parser folds that fragment into the *prelude* of the `:root{…}` block that
follows. Measured live: **323 custom properties at `:root` → 0**, every component
rendering unstyled, nothing thrown and nothing logged. `stripAtImports()` matches
the quoted string (or `url()`) first. This is the Carbon `<Theme>`-wrapper defect
in a new costume: a whole round of zero token facts, in silence.

---

## Mount recipe — what Altitude needed and why

| knob | value | why |
|---|---|---|
| `library.customElements` | `true` | `importName` IS the tag name; `React.createElement('al-button', props, children)`. React 18 passes unknown props through as **attributes**, which is the custom-element contract. |
| `mount.preScript` | `globalThis.alAutoRegistry = true;` | **Without it not one top-level tag registers** — `<al-button>` stays an unknown element. An `imports` line cannot do this: ES import hoisting runs the library first. Inline `<script>` in `<head>` runs before the module bundle. |
| `mount.headStyles` | `main.css` + `tokens-light.css` as `style#al-theme-sheet` | `ALElement.getGlobalStyles()` looks that id up **once**, memoizes it on `globalThis`, and adopts a stripped copy into every shadow root; otherwise it `console.error`s `Altitude style#al-theme-sheet not found` and every component renders unstyled. It **strips every `--*` declaration** from the copy, so the tokens reach components by *inheritance* from `:root` in the light DOM — the same `<style>` is doing both jobs. |
| tokens-light **after** main.css | ordering is load-bearing | `main.css`'s own `:root` block is the **DARK** set (322 names, dark values). Loading `main.css` alone under `colorScheme: light` gives a dark page. |
| `varPrefix` | `--al-` | see "Tokens" below — the recon's `--al-theme-` would have made every direct primitive reference unbindable. |
| `classPrefix` | `al-c-` | |
| `classAllow` | `^al-(c|u)-(?!.*--)[a-z_-]+$` | Altitude is BEM. `al-c-button__text` is an ELEMENT and stays; `al-c-button--danger`, `al-c-badge--success`, `al-c-divider--vertical` are MODIFIERS that vary per axis and would make every part signature axis-dependent (the Carbon `^cds--(?!.*--)` rule). `al-is-*` state classes drop by not matching the `c|u` group. It also drops three **raw prop values that leak into `class`** — a real library defect: `<al-link href="#al">` renders `class="al-c-link #al"`, `variant="vertical"` renders `class="al-c-divider vertical al-c-divider--vertical"`, and `isChecked` renders a literal `true`. |
| boolean props | omitted when `false` | Lit's `type: Boolean` converter reads **attribute presence**, so `isDisabled="false"` is TRUE. The mount drops `false`/`undefined`/`null` and function values for custom elements. |

`wrapperOpen`/`wrapperClose` are a bare fragment: there is no provider.

---

## Tokens — the shipped Style-Dictionary output

`examples/altitude/scripts/build-tokens.mjs` parses
`dist/css/tokens-light.css` and `dist/css/tokens-dark.css`. The Tokens-Studio
JSON the design system authors from is **not in the published package** (`files:
["dist", …]`), so the emitted CSS is both the only shipped source and the one
that names properties the way components reference them.

- **323 tokens** (light): **208 primitives** (`color-blue-500`, `space-2`,
  literal values) + **115 semantic aliases** (`theme-color-background-brand-…`,
  each `var(--al-<primitive>)`). Dark declares 322; the one light-only name is
  `theme-color-background-inverse-strong`.
- **Alias resolution follows the chain inside its own mode block**, not a literal
  fallback (Altitude's aliases carry none). 114 aliases resolve, **2 of them
  two-hop** (`theme-color-header-background`, `theme-color-body-background`);
  the wrap refuses a cycle and an over-long chain by name.
- **`varPrefix` is `--al-`, not `--al-theme-`.** The reader strips the prefix to
  get the DTCG leaf path, so the prefix chooses the whole naming scheme.
  Prefixing at `--al-theme-` would name only the semantic tier and leave every
  direct primitive reference unbindable. The recon's argument for the narrower
  prefix — that the ~40 **undefined** per-component escape hatches
  (`--al-button-padding`, `--al-toggle-width`) would "crowd the candidates" — is
  wrong and was measured: an undefined custom property computes to the **empty
  string**, and the reader drops empty candidates before scoring them.
- **The dark mode is thin.** Light and Dark differ on **29 of 323** names: the
  six `box-shadow-*` primitives and their six `theme-box-shadow-*` aliases, plus
  17 neutral surface/content/border tokens. Every brand and status colour is
  **identical in both modes**. That is Altitude's own choice, recorded here so
  the mode-diff number is not read as a parsing failure (contrast: Carbon's two
  theme blocks differ on 200+).

### THE SHORTHAND CEILING — the round's biggest source-layer limit, and it is a READER gap

Altitude defines a full custom-property inventory, so colour, spacing, radius and
motion *could* all bind. Most of them do not, and the reason is not the library:

**the source reader carries LONGHAND facts only.** `run.ts` skips any channel
whose captured computed value is `undefined` (`if (el.node.style[ch] ===
undefined) continue;` — "shorthand/pending-substitution"), and `getComputedStyle`
enumerates longhands, so a `var()` reference written on a **shorthand** is
dropped. Altitude writes shorthands constantly. Measured across the seven shipped
component stylesheets in round 1:

| | count |
|---|---|
| `var()`-carrying **shorthand** declarations | **95** |
| `var()`-carrying longhand / custom-property declarations | 136 |

with the shorthands being `font` ×36, `background` ×19, `border-radius` ×14,
`outline` ×5, `gap` ×5, `padding` ×5, `border` ×4, `transition` ×4, and four
singletons. `al-button`'s own root rule is the shape in miniature: eight
`var()`-carrying declarations, of which exactly **three** (`background-color`,
`color`, `font-weight`) are longhands and bind — while
`padding: var(--al-button-padding, var(--al-theme-space-xs) var(--al-theme-space))`,
`border-radius: var(--al-theme-border-radius)`, `gap: var(--al-theme-space-xs)`,
`font: var(--al-typography-preset-16)` and `transition: all var(…) var(…)` are
all lost. That is why Button shows only **15 facts over 3 channels** while its
CSS names eight tokens.

**Named, not fixed, and the reason is byte-safety.** Expanding a shorthand's
`var()` references onto the longhands it feeds is real engine work, and it would
add facts to **every** library that writes shorthands — MUI, Carbon and Tailwind
all do — which changes their `source-bindings.json`, their promoted aliases and
their committed contracts. This wave was scoped to move no other library's
artifacts, so the ceiling is measured and recorded rather than raised.

**A second, smaller defect in the same place: the skip is SILENT.** A channel
dropped for having no verified candidate lands in `source-bindings.json`'s
`skips` array; a channel dropped for being a shorthand is `continue`d before any
receipt is written, so `"skips": []` reads as "nothing was lost". Altitude's
`skips` are empty on seven of eight components, and 95 shorthand references were
dropped. Adding that receipt also changes every committed `source-bindings.json`,
so it is named here rather than done here.

---

## Smoke probes (run before any capture)

1. **Registration.** `customElements.get('al-button')` is `undefined` without
   `globalThis.alAutoRegistry = true`. Nine of nine round-1 tags register with
   it. The README documents neither the flag nor the theme sheet.
2. **Fonts are NOT loaded, and `document.fonts.check` cannot tell you that.**
   The probe returns `true` for `-apple-system`, `Segoe UI` **and `Inter`** —
   `fonts.check` answers "can this text be rendered", which any fallback
   satisfies. What is actually true: the published dist contains **zero
   `@font-face` blocks** (`grep -c @font-face` across `dist/css/*.css` and
   `bundle.js` = 0). The only font delivery Altitude ships is the Google-Fonts
   `@import` in `main.css`, which the harness strips for hermeticity, so
   **IBM Plex Sans is not loaded** and the metrics come from the fallback
   stack. Both sides of the gate degrade identically, so the percentages are
   unaffected; the absolute text widths are fallback widths. This is the same
   situation Carbon recorded, arrived at from the opposite direction (Carbon
   ships 105 `@font-face` blocks pointing at a CDN; Altitude ships none).
3. **Does Playwright's `>` combinator pierce open shadow roots?** **No.**
   `[data-combo="x"] > *` resolves to the HOST. A *descendant* selector does
   pierce — `[data-combo="divider"] .al-c-divider` resolves the shadow element,
   count 1 — which is what makes the `data-capture-root` stamp work.
4. **Do the theme tokens reach shadow-root elements?** Yes, by inheritance:
   323 custom properties at `:root` in the light DOM, and
   `getComputedStyle(button.al-c-button).getPropertyValue('--al-theme-color-background-primary-default')`
   resolves `#4375ff`, which is exactly the background the button paints. The
   library's adopted copy of the theme sheet has every `--*` declaration
   stripped out, so inheritance is the *only* path — and it works across the
   boundary.
5. **`display: contents` hosts:** zero in the published dist (source: 29).
   **`:host` rules:** one in the whole 65-component bundle.

---

## Pipeline (repo root)

```bash
node examples/altitude/scripts/build-tokens.mjs
npm run extract:computed -- --harness examples/altitude/.altitude-sandbox \
  --config extract/computed/configs/altitude.json --out extract/computed/out/altitude
npx tsx examples/altitude/scripts/promote-floor.mjs
npx tsx packages/cli/src/cli.ts figma examples/altitude/contracts --out examples/altitude/figma \
  --tokens examples/altitude/tokens/altitude.dtcg.json,examples/altitude/tokens/altitude-minted.dtcg.json
node examples/altitude/scripts/build-figma-tokens.mjs
node examples/altitude/scripts/figma-compile-receipt.mjs
node examples/altitude/scripts/build-genesis-batch.mjs
npx tsx packages/cli/src/cli.ts figma bundle examples/altitude/contracts \
  --tokens examples/altitude/tokens/altitude.dtcg.json,examples/altitude/tokens/altitude-minted.dtcg.json \
  --modes examples/altitude/tokens/modes/altitude.light.dtcg.json,examples/altitude/tokens/modes/altitude.dark.dtcg.json \
  --name Altitude --out examples/altitude/figma/altitude.bundle.json
```

---

## Gates (default-state floor)

| component | axes (incl. `unset`) | combos | anatomy | computed | pixel AA perfect | source facts |
|---|---|---|---|---|---|---|
| Button | variant(4+unset) | 5 | root(button) → label(span) | 74.766% | 5/20 | 15 |
| Badge | variant(4+unset) × dot(2) | 10 | root(div) | 93.750% | 4/40 | 40 |
| Chip | variant(5+unset) × type(1+unset) | 12 | root(button) | 94.309% | 40/48 | 24 |
| Link | variant(3+unset) | 4 | root(a) | 63.889% | 0/16 | 4 |
| Avatar | variant(1+unset) × hasBadge(presence) | 4 | root(div) → **avatar__badge(al-badge)** → badge(div) | 81.690% | 0/16 | 34 |
| Heading | variant(6+unset) × weight(2) | 14 | root(h2) | **100.000%** | 56/56 | 21 |
| Divider | variant(1+unset) | 2 | root(hr) | **100.000%** | 0/8 | 4 |
| IconClose | size(7+unset) | 8 | root(span) → icon(svg) → part-0-0(path) | **100.000%** | 4/32 | 16 |

59 combos, **236 captures**, all eight **double-run byte-identical** — and
stronger: the whole sweep was re-run in a **separate browser session hours
later**, and all 32 artifacts (`captured-truth`, `enriched.contract`,
`source-bindings`, `numbers` × 8) came back **byte-identical**. Truth replay
≥ 99.559% everywhere (four components at 100.000%). Promotion: 8 contracts,
**8 reconstructed svg assets** (one per icon size), **349 minted leaves**,
**41 source-aliased** to Altitude's own custom properties, 310 kept literal,
**0 named alias refusals**. Genesis: **41 variant cells across 6 sets + 2
standalone components, 672 variables (41 Figma-native source aliases),
Light/Dark modes**, batch mock-proven; `altitude.bundle.json` byte-identical
across two builds.

**Where the computed number is lost, by cause** (all four are pre-existing engine
limits, none is shadow-DOM):

- `display: flex` vs `inline-flex` — every row of every inline-flex-rooted
  component. The contract render draws a frame.
- **the 30 ms gate settle** — the whole hover / focus-visible / active spread on
  Button (74.766%) and Link (63.889%). Altitude transitions everything at 200 ms.
  Link is the worst row set in the round for exactly this reason and for nothing
  else.
- `transition-behavior: normal` vs `normal, normal` — a shorthand-arity artifact
  on multi-property transitions.
- Avatar's `border-radius 20px` vs `50%` (the %-radius bake against the captured
  40px box) and the nested badge's absolute `inset` channels.

Heading, Divider and IconClose reach **100.000%** — a component with no
transition and no percentage geometry goes through the shadow reader clean.

---

## DEFECT-FIRST — what this round found

### THE TOGGLE DOES NOT SHIP

`al-toggle` was a round-1 component and is **dropped by name**. The published
package renders it as a **0×0 control**.

Its source sizes itself from two custom properties seeded on its own host:

```scss
/* components/toggle/toggle.scss */
:host { --al-toggle-width: 40px; --al-toggle-height: 22px; }
```

and the shipped CSS still reads them everywhere:

```css
.al-c-toggle__label{…width:var(--al-toggle-width);height:var(--al-toggle-height);
  border-radius:var(--al-toggle-height);…}
.al-c-toggle__label:after{…width:calc(var(--al-toggle-height) - var(--al-theme-space-xxs));…}
```

but the `:host` block that defines them is **not in the published bundle**.
Measured live: host `0×0`, `div.al-c-toggle` `0×0`, `input.al-c-toggle__checkbox`
`0×0`, `label.al-c-toggle__label` `0×0` (with a real background colour), and the
`::after` thumb likewise. There is no truth to capture and no box for the
interaction drivers to target.

**Root cause — a lossy build, not staleness.** `webpack.config.js` runs
`@fullhuman/postcss-purgecss` over each component's SCSS with the component's
`.ts` as the content source. A bare `:host { … }` rule contains no class or tag
token that appears in the TS, so purgecss deletes it. That is why **29 of 65
components declare `:host{display:contents}` in source and zero ship it**, why
`al-divider`'s `:host{display:flex}` is gone, and why the toggle has no size.
A locally built `dist/` in the source repo reproduces the same zero count, so
this is current build behaviour, not a stale artifact.

Everything downstream of that is the visible symptom: every host renders at the
UA default `display: inline`, so `<al-button>` inside a flex or grid parent does
not behave as the design system intends.

### `al-button`'s disabled style is unreachable from its prop

`isDisabled` emits **`aria-disabled="true"` only**; the shipped CSS keys the
disabled look on `:disabled`, which a `<button>` only takes from the `disabled`
attribute. Measured: `isDisabled` vs enabled — background `rgb(67,117,255)` in
both, `cursor: pointer` in both, `opacity: 1` in both. The disabled STYLE cannot
be reached. The axis is **dropped and receipted**, not captured as a no-op plane.

Across the other seven, `disabled` is spelled as an `al-is-disabled` **class** on
a shadow element. That is a prop-selected *rendering* — a variant axis under this
engine's own closed-state-vocabulary rule — not a pseudo-class plane. **No
component in this round declares a `disabled` state.**

### THE GATE STILL SAMPLES MID-TRANSITION (pre-existing, re-measured)

Named first in `examples/carbon/PROVENANCE.md` and unfixed: `extract/computed/gate.ts`
drives an interaction and waits a **flat 30 ms**, while the capture sweep polls to
two consecutive stable samples for up to 1.5 s. Altitude transitions everything at
200 ms, so the gate reads intermediate frames on every hover / focus-visible /
active row. On `Button` the mismatch histogram is dominated by them —
`rgba(93,136,255)` where the target is `rgba(107,147,255)`, and the same one-step
offset propagated across `color`, the four `border-*-color`s, `caret-color`,
`column-rule-color`, `text-decoration-color`, `text-emphasis-color` (all
`currentColor` followers of one wrong `color`). Fixing `gate.ts` moves the number
for every library and every committed scorecard — its own round.

### Recon corrections (the library decided; the recon was wrong)

- **`display:contents` on 29/65 hosts: TRUE in source, ZERO in the published
  dist.** W3/W4 were designed against a premise that does not ship.
- **`el.matches(':host')` does not throw.** It returns `false`. The existing
  `catch` was never the thing dropping `:host` bindings — nothing was.
- **There is no icon FONT.** No `components/icon/fonts/iconfont.css`, no
  `@font-face`, no base64 anywhere in `dist`. Icons are **37 separate custom
  elements** (`al-icon-close`, `al-icon-add`, …) each rendering an inline `<svg>`;
  the shipped `bundle.js` deliberately excludes the `al-icon` router. So the
  glyph reaches the capture through the shadow reader and the existing svg
  promotion path, with no new grammar. `fontProbes` needed no entry.
- **There is no `variant="primary"`.** Primary IS the absence of the attribute.
  **Every enum in the library is defaultless** (the single exception is
  `al-heading.tagName = 'h2'`), which makes the `unset` pseudo-value a segment of
  a minted token path on **every component** — the Carbon `unsetLabel` lesson
  applies here at full width, and the config carries `"unset"`.
- **`al-icon-close` has 7 sizes** (`xs…xxxl`), so the axis is 8 values counting
  `unset`.
- **The published dist bakes version `"1.0.0"`**, not `1.0.2` — the package was
  republished without a rebuild. It only matters with the auto-registry flag
  *off* (nested tags would suffix `-1-0-0`); the harness sets the flag, so tags
  are clean.

### Deferrals, by name

- `al-toggle` (above) — and with it W7's only exercise.
- `al-chip isDismissible` — a depth-2 presence subtree (`<al-icon-close>` inside
  the chip's shadow root) whose `close()` mutates the **host's** classList.
- `al-badge position` — `handlePosition()` writes `this.parentElement.style.position`.
  A component that mutates the DOM *outside itself* has no anatomy the contract
  can carry, and the mutation makes the captured stage a function of the combo.
- `al-heading tagName` — a semantic axis (h1…h6), not a visual one, and the
  property that shadows `Element.prototype.tagName`.
- `al-dialog` / `al-drawer` — overlays that render inside their **own** shadow
  root (W8).
- `al-alert` and friends — depth-3 (`al-alert` composes `al-icon-*` **and**
  `al-button`, each with its own shadow root).
- `portalSweep()` still takes no `varPrefix` — every `portalCapture` component in
  every library reads zero source facts. Pre-existing, named by Carbon, and
  Altitude has no portal component to make it worse.

---

## CROSS-LIBRARY BYTE-IDENTITY PROOF

Comparing against committed artifacts is only a valid proof where the committed
artifacts are fresh; where they are not, the staleness is a finding, named here
because it was found here.

Three components across two light-DOM libraries were **re-captured through the
changed engine** and diffed against the committed files:

| subject | what it exercises | result |
|---|---|---|
| `carbon` **Toggle** | `sampleText: ""`, real `<input>` (W7's collector), transitions (W6's poll), `varPrefix` (W2's rule collection) | `captured-truth`, `enriched.contract`, `enriched.extension`, `numbers`, `source-bindings`, `LEDGER` — **all byte-identical** |
| `carbon` **Checkbox** | tri-state `$props` axis, `::before`/`::after` pseudo decor, `varPrefix` | same six — **all byte-identical** |
| `tailwind` **ToggleSwitch** | the sr-only-first-child root pick (W1's fallback path), `translate` decomposition | five byte-identical; `captured-truth.json` differs by **exactly** the `pseudo/part-0::after/translate-x`/`translate-y` keys on 12 captures |

That last one is **pre-existing staleness, not a regression**: the committed
tailwind capture predates the `translate-x`/`translate-y` synthetic-channel
decomposition, and `examples/carbon/PROVENANCE.md` already names it and predicts
exactly this delta ("the re-capture adds exactly those keys"). Nothing else moved.

Two `scorecard.json` files also moved, on a field unrelated to capture:
`shippedMinted.leavesAdded` went `0 → 1083` (Toggle) and `0 → 1097` (Checkbox),
with every listed divergence carrying `resolvedEqual: true` and `pctEqual`
unchanged. **Carbon's committed scorecards are stale against Carbon's own shipped
minted tree** — the gate ran before `promote-floor.mjs` wrote
`carbon-minted.dtcg.json`, so the gate-inventory receipt records a tree that did
not exist yet. Pre-existing, found here, not fixed here (re-running the gate
moves committed Carbon numbers, which is a Carbon round).

All re-captured artifacts were restored from git afterwards, so this round moves
nothing outside `examples/altitude`, `extract/computed/out/altitude`, and the
engine files listed in the task report.

The **offline drift instrument** covers the other half: `npm run
extract:computed:drift` re-fuses every committed capture in all six libraries
through the current engine, and all 46 pre-existing rows must be unchanged.

## Coverage of this library — the denominator

| committed contracts | pinned by the drift instrument | library size | **coverage** |
|---|---|---|---|
| 8 | 8 | 67 | **11.9%** |

Library size: component directories in `altitude-web-components@1.0.2/dist/components` (`.altitude-sandbox`) — the header's "65 components" omits `bundle` and `focus-trap`, which are not components.

Every per-component number in this file — floors, `pctEqual`, token counts,
variant cells — is measured over that slice, and the slice was hand-picked for
tractability. The engine generalizing across libraries (`docs/22`) and a
library being *captured* are different claims; this row is the second one, and
it is small. Full table and how to re-derive it: [docs/22 §8.3](../../docs/22-generality.md).

## THE HARNESS RECAPTURE WAVE (task #38)

Three rounds deferred library regeneration for the same reason, and every library's SHIPPED
artifacts had drifted behind fixes that were already in the engine. All 8 components were
re-captured against the pinned `.altitude-sandbox` with the recipe above, double-run byte-identity
required and met, then re-promoted and every downstream artifact rebuilt.

**Floors before -> after:** NONE — all 8 scorecards came back byte-identical.
That is the honest shape of this wave across the corpus: 37 scorecards were re-measured over
carbon/mui/tailwind/altitude and exactly ONE moved. The artifacts were stale in their VOCABULARY
(refusals, instrument fields, per-axis token maps), not in their floor numbers.

**THE SHORTHAND CEILING (task #27) — the real number, measured for the first time.**
`shorthandCeiling` counts source declarations dropped because the property they name is not in the
computed longhand sweep — overwhelmingly CSS SHORTHANDS carrying a `var()`, which are
pending-substitution values with no computed value to verify a token name against. The instrument
was STRUCTURALLY ZERO in every artifact ever written, because `normalizeNode` never preserved the
`vshorthands` field it reads; that was fixed but had never produced a real number until this wave.
**This library: 16** (heading 6, badge 4, chip 3, link 3).
