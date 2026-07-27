# Carbon round — provenance

**Subject:** `@carbon/react@1.112.0` + `@carbon/styles@1.111.0` + `@carbon/themes@11.77.0`
+ `@carbon/icons-react`, pinned in `.carbon-sandbox/` with `react@19`, `esbuild`.
The **seventh library** through the pipeline, and the round that was run as the
generality thesis's **CONTROL CASE**: the recon predicted a config-only round
with zero engine changes. What that prediction actually cost is the first
section below.

Recreate (git-ignored):

```bash
mkdir -p examples/carbon/.carbon-sandbox && cd examples/carbon/.carbon-sandbox \
  && printf '{"name":"carbon-sandbox","private":true}\n' > package.json \
  && IBM_TELEMETRY_DISABLED=true npm i @carbon/react@1.112.0 @carbon/styles@1.111.0 \
       @carbon/themes@11.77.0 @carbon/icons-react react@19 react-dom@19 esbuild
```

`IBM_TELEMETRY_DISABLED=true` is not cosmetic: `@carbon/react` ships a
postinstall telemetry step, and an install that phones home is not a
reproducible pin. **No CSS build step** — `@carbon/styles` ships
`css/styles.css` precompiled (955 KB); every `url()` in it is an absolute
Akamai CDN URL (0 relative), so esbuild bundles it with no loader configuration
and the harness stays network-free.

> **SUPERSEDED IN PART — read "THE CLASS-STEM PREFIX DEFECT" first.** Round 1's
> numbers below were measured with EVERY Carbon class discarded by the engine.
> The floors are unchanged (they were never wrong), but the part names and the
> generality verdict are. The corrected round is recorded at the end of this
> file.

## The generality verdict

**Engine files changed: 1** (`extract/computed/capture.ts`, one expression,
mirrored in the portal harness). Everything else Carbon needed was config,
seed contracts, and per-library scripts. Both engine-shaped problems the round
hit are recorded below — the one that turned out to be config, and the one
that genuinely was not.

**CORRECTED (task #25):** the honest count is **2**. The round shipped with a
second, unnoticed engine defect — `extract/computed/lib.ts` `stems()` read
Carbon's own `cds--` prefix as a BEM modifier marker and threw away every
class the config had carefully preserved. See the last section. The round's
own prediction ("a new library costs CONFIG ONLY") was not falsified by that
defect; it was *hidden* by it, because the engine degraded to positional
naming instead of refusing.

### CONFIG, not engine — the defaultless-axis underscore

Carbon is the **first library through the pipeline with a defaultless enum
axis that reaches minting**: `size` on Button / TextInput / Modal / IconButton,
`size` on Accordion, and BOTH of Tag's axes ship with no default. The capture
prepends `enumeration.unsetLabel` as a pseudo-value, that value becomes a
**segment of every minted token path**
(`imported.tag.root.background-color.<pseudo>`), and the contract's token-ref
regex is `/^\{[a-z0-9.{}-]+\}$/i`. Underscores are not in that character class,
so the drafter's default `"__unset"` fails `ContractSchema.parse` at the end of
fusion with ~40 "Token reference must be brace-wrapped" errors, **not one of
which mentions an underscore**. The config carries `"unsetLabel": "unset"` and
`loadConfig` already refuses a collision with a real axis value by name, so
this is genuinely a config fix.

**NAMED, NOT FIXED:** `extract/draft-capture-config.ts` still *drafts*
`"__unset"`, and so does `packages/cli/test/draft-capture-config.test.ts`. The
next library with a defaultless axis will hit the identical wall with the
identical unhelpful error. Closing it is a one-word change plus a test update
and belongs to whoever owns the drafter.

### ENGINE — `sampleText: ""` is a real empty-string child

`buildHarnessPage` mounted every component as `<C {...props}>{s.text}</C>`. For
`sampleText: ""` that passes `children: ''` — and React does **not** treat an
empty string as "no children". Carbon's `Checkbox` and `TextInput` forward
their rest props (children included) straight onto an `<input>`, and React
refuses children on a void element: the exception took down the entire harness
tree, so the page rendered **nothing at all** and the run died on
`waitForSelector('[data-combo]')` timing out after 15 s, with no message
anywhere naming children. Two of the ten components failed this way.

Six libraries tolerated the empty child by accident. `renderKids` now returns
`undefined` when the sample text is `''` — "no sample text" and "the empty
string" are different mounts — in both the census page and the portal page.

**Byte-identity was proven, not assumed.** `examples/tailwind` ToggleSwitch and
`examples/mui` Switch (both `sampleText: ""`) were re-captured through the
changed engine and their `captured-truth.json` came back byte-identical. See
"Byte-identity proof" below.

## Reader configuration — what Carbon needed and why

| knob | value | why |
|---|---|---|
| `varPrefix` | `--cds-` | the compiled CSS binds channels as `var(--cds-button-primary, #0f62fe)`; the existing fallback-chain candidate rule reads it unchanged |
| `classPrefix` | `cds--` | |
| `classAllow` | `^cds--(?!.*--)` | Carbon is BEM: `cds--checkbox-label-text` and `cds--inline-notification__title` are ELEMENTS and stay; `cds--btn--primary`, `cds--layout--size-md`, `cds--inline-notification--error` are MODIFIERS that vary per axis and would make every part signature axis-dependent |
| `mount.wrapperOpen` | `<Theme theme="white">` | **load-bearing, see below** |

### The `<Theme>` wrapper is the whole round

Carbon themes are **class scopes** (`.cds--white`, `.cds--g10`, `.cds--g90`,
`.cds--g100`), never `:root`. Without the wrapper the page still renders
**pixel-perfect**, because every `var()` in Carbon's compiled CSS carries a
literal fallback — and every custom property resolves to the empty string, so
the CSS-vars reader verifies zero candidates and the round yields **zero source
facts in complete silence**. Probed before any capture:
`getComputedStyle(document.documentElement)['--cds-layer-01']` is `''`;
inside `.cds--white` the same property is `#f4f4f4`. The wrapper's implicit
`cds--layer-one` context is also what makes the layer/field token family
resolve at all.

## Tokens — the compiled CSS, not `@carbon/themes`

`examples/carbon/scripts/build-tokens.mjs` parses
`@carbon/styles/css/styles.css`, not the `@carbon/themes` JS package. The JS
package exposes camelCase keys (`layer01`, `textPrimary`) while the properties
the components actually reference are kebab-and-numbered (`--cds-layer-01`,
`--cds-text-primary`); a camelCase→kebab guess mismatches every numbered token
and a mismatched name binds nothing. The script re-asserts the block sizes it
was written against and **refuses** if a Carbon bump moves them.

- **base = 339 tokens**: the `.cds--white` block (327) + the `:root` LAYOUT
  block (12: `--cds-layout-size-height-*`, `--cds-layout-density-padding-inline-*`).
  The layout block matters more than it looks — Carbon does **not** size
  controls with per-component rules. `.cds--text-input--sm` and
  `.cds--btn--2xl` have **zero CSS rules**; the height comes from the shared
  `.cds--layout--size-*` classes reading those `:root` tokens.
- **EXCLUDED BY NAME**: the other `:root` blocks are the responsive GRID
  cascade (`--cds-grid-columns` redeclared per breakpoint) — a media-varying
  value with no single truth.
- **modes are real**: Light = `.cds--white` (339), Dark = `.cds--g100` (338).
  The one light-only name is `notification-action-hover`, printed by the build.
- **contextual aliases resolved one hop, in-block**: 15 declarations are
  `--cds-layer: var(--cds-layer-01, #f4f4f4)`. The wrap resolves them against
  **the same theme block**, not against the literal fallback — the fallback is
  frozen at the light value inside *every* theme block, so taking it would have
  baked `#f4f4f4` into Dark. `layer` = `#f4f4f4` light / `#262626` dark.

### THE FAMILY SPLIT (read every alias count with this in hand)

Measured on the compiled CSS: **336 distinct `--cds-*` referenced, 366 defined,
80 referenced-but-never-defined.**

| family | custom properties? | consequence |
|---|---|---|
| colour / border / focus | yes, defined | these BIND, and they are almost the entire alias story |
| TYPE (`heading-*`, `body-*`, `label-*`, `code-*`, `helper-text-*`, `productive-*`) | **referenced, never defined** — 77 of the 80 | Carbon's type custom properties are a Sass opt-in the compiled CSS does not emit → **minted literals** |
| `popover-*` | referenced, never defined — the other 3 | minted literals |
| SPACING | **0 defined** | the compiled utilities carry literal `rem` → minted literals |
| MOTION | **0 defined** | literal durations → minted literals |

So a Carbon alias is nearly always a **colour**, and every literal font-size,
padding and duration in the minted tree is **the library's own shape, not a
reader gap**. This is the single most important number-reading instruction in
this file.

## First smoke probes (run before any capture, per the wave brief)

1. **`matchMedia('(any-hover: hover)')` → `true`** in headless Chromium
   (`hover: hover` and `pointer: fine` likewise). Carbon wraps all hover
   styling in `@media (any-hover: hover)`, so a `false` here would have made
   every hover delta vanish silently. Confirmed live as well: the primary
   Button's background moved `rgb(15,98,254) → rgb(0,80,230)` under
   `.hover()`. **No Playwright lever was needed.**
2. **Fonts.** `document.fonts.check('16px "IBM Plex Sans"')` returns `true` —
   and so does the same probe for `Inter`, which is certainly not installed.
   `fonts.check` reports "can this text be rendered", which fallback always
   satisfies, so it **does not prove the font loaded**. What is actually true:
   `styles.css` carries **105 `@font-face` blocks and every `src` is an Akamai
   CDN URL**, and the harness is network-free, so IBM Plex is **NOT loaded** —
   the metrics come from the fallback stack (`system-ui`). Both sides of the
   gate degrade identically, so the percentages are unaffected; the absolute
   text widths are fallback widths. Recorded, not worked around.
3. **Reduced motion** is `false` and was left alone: the capture's steady-state
   probe requires two consecutive stable samples at 60 ms up to 1.5 s, which
   comfortably outlasts Modal's 240 ms presence animation, and the portal path
   adds a 700 ms settle on top. Nothing needed pinning.

## Pipeline (repo root)

```bash
node examples/carbon/scripts/build-tokens.mjs        # compiled CSS → 339-token DTCG + Light/Dark modes
npm run extract:computed -- --harness examples/carbon/.carbon-sandbox \
  --config extract/computed/configs/carbon.json --component <C> --out extract/computed/out/carbon
npx tsx examples/carbon/scripts/promote-floor.mjs    # + figmaStatePreviews probe + source-alias pass
npx tsx packages/cli/src/cli.ts figma examples/carbon/contracts --out examples/carbon/figma \
  --icons examples/carbon/assets/icons \
  --tokens examples/carbon/tokens/carbon.dtcg.json,examples/carbon/tokens/carbon-minted.dtcg.json
node examples/carbon/scripts/build-figma-tokens.mjs
node examples/carbon/scripts/figma-compile-receipt.mjs
node examples/carbon/scripts/build-genesis-batch.mjs
npx tsx packages/cli/src/cli.ts figma bundle examples/carbon/contracts \
  --tokens examples/carbon/tokens/carbon.dtcg.json,examples/carbon/tokens/carbon-minted.dtcg.json \
  --modes examples/carbon/tokens/modes/carbon.light.dtcg.json,examples/carbon/tokens/modes/carbon.dark.dtcg.json \
  --name Carbon --icons examples/carbon/assets/icons --out examples/carbon/figma/carbon.bundle.json
```

## Gates (default-state floor)

> Re-measured after the class-stem prefix fix. Every number below is unchanged
> except Button (77.281 → **77.276**, inside that row's own recorded gate-timing
> tolerance); part counts and `cellsCompared` are unchanged on all ten. See
> "THE CLASS-STEM PREFIX DEFECT" for why the floors held while the part NAMES
> all moved.

| component | axes | combos | computed | pixel AA perfect |
|---|---|---|---|---|
| Button | kind(8)×size(6+unset) × disabled | 112 | 77.276% | 0/448 |
| Tag | type(12+unset)×size(3+unset) | 52 | 80.521% | 0/208 |
| Checkbox | checked(3) × disabled | 6 | 84.291% | 0/24 |
| Toggle | toggled(2) × disabled | 4 | 83.140% | 0/16 |
| TextInput | size(4+unset) × disabled | 10 | 89.045% | 0/40 |
| InlineNotification | kind(6)×contrast(2) | 12 | **96.581%** | 0/48 |
| Accordion | align(2)×size(3+unset) × disabled | 16 | 76.462% | 0/64 |
| Tabs | — (2-deep childrenSpec) | 1 | 92.742% | 0/4 |
| Modal | size(4+unset) | 5 | 89.744% | 0/20 |
| IconButton | kind(4)×size(4+unset) × disabled | 40 | 91.810% | 0/160 |

Genesis: **132 variant cells across 10 sets, 1459 variables (94 Figma-native
source aliases), Light/Dark modes**, batch mock-proven. (All four totals
survived the re-capture unchanged — the aliases only after the promotion's
part-name join was fixed; see the last section.)
Truth replay ≥ 99.76% on every component; all ten double-run byte-identical.

**Read the 94 aliases with the FAMILY SPLIT above**: 94 aliased vs 987 kept
literal is not a reader shortfall. Only colour/border/focus are custom
properties in Carbon at all; type, spacing and motion are literal by Carbon's
own compilation, so they *cannot* alias and correctly stay minted literals.

**Pixel-AA is 0 everywhere** — the fonts are the reason and it is the same on
every library that does not ship its webfont locally (see probe 2): the
contract render and the original render both fall back, but Carbon's type
tokens are also un-carried (family split), so glyph metrics diverge enough that
no cell is AA-perfect. The computed-equality number is the instrument that
means something here.

## Named residuals and deferrals (defect-first)

### THE HEADLINE DEFECT — overlay components have no source layer at all

`portalSweep()` takes no `varPrefix`. `extract/computed/run.ts` calls it with
`{ screenshots, classAllow }` and nothing else, so **every `portalCapture`
component in the entire repo reads zero CSS-variable source facts**. Measured:
`mui/dialog`, `mui/menu`, `mui/tooltip` and `carbon/modal` all have
`source-bindings.json` with **0 facts**, while `mui/button` has 156 and
`carbon/button` has 126. Every overlay component in every library therefore
ships with anonymous minted literals where a named semantic token exists in the
library's own stylesheet.

This is **pre-existing** — Carbon did not cause it, Carbon made it visible by
being the first round to check the number on a portal component against a
census component in the same library. **NOT FIXED HERE**: threading `varPrefix`
through changes MUI's Dialog/Menu/Tooltip captured truth and their promoted
contracts, which is an MUI re-capture round, and this wave was scoped not to
move those artifacts.

### THE GATE SAMPLES MID-TRANSITION

`extract/computed/gate.ts` drives an interaction and waits a **flat 30 ms**
(`await page.waitForTimeout(30)`) — while the capture sweep polls to two
consecutive stable samples for up to 1.5 s. Carbon's buttons transition at
70 ms, so 58 of Button's 448 gate rows read an intermediate frame:
`rgba(0,70,206)` where the target is `rgba(0,67,206)`, `rgba(58,58,58)` for
`rgba(57,57,57)`, and 13 rows reading a blue-tinted white `rgba(229,239,250)`
where the target is pure white. It also makes the offline instrument itself
non-reproducible on that row: four consecutive runs measured
**77.528 / 77.552 / 77.567 / 77.577** — a 0.049 spread against a 0.001 global
tolerance.

Recorded, not papered over: `carbon/Button` is the first baseline row to carry
its own `tolerance` (0.08, sized to the measured noise) with the full
measurement in its `gapCause`. Every engine-sized move this baseline has ever
recorded (+1.042, +2.459, +20.155, −3.296) is an order of magnitude larger, so
a real regression still fails the row. **Fixing gate.ts moves the number for
every library and every committed scorecard — its own round.**

### Recon corrections (the recon was wrong about these; the library decided)

- **`TextInput` size `xs` EXISTS** and is a real 24 px plane. The recon
  suspected it did not because `.cds--text-input--xs` has zero CSS rules — true,
  and irrelevant: Carbon sizes controls through the shared
  `.cds--layout--size-*` classes. All four sizes shipped.
- **`Tabs` has no `type` enum.** The recon predicted `type[line,contained]`.
  Carbon spells it as a BOOLEAN `contained` on **`TabList`, a child**. The axis
  grammar drives the ROOT mount only, so it cannot reach a child prop.
  `contained: false` (line tabs) is pinned in the `childrenSpec`; a Contained
  axis needs child-prop enumeration and is **deferred by name**.
- **`Accordion` expansion is not a root prop either.** `open` lives on
  `AccordionItem`. The item is pinned open; an Expanded axis is **deferred by
  name**, same blocker as Tabs.
- **`IconButton` accepts `renderIcon`** (through its rest spread to
  `ButtonBase`) — so the `{"$import":"@carbon/icons-react#Add"}` marker works
  with **no new grammar**, and no `children` are needed. Its captured ROOT is
  Carbon's tooltip popover container (`span.cds--popover-container.cds--icon-tooltip`):
  in Carbon an icon button *is* a tooltip trigger, so that is the canonical
  rendering, not a wrapper the harness invented.
- **Modal behaved exactly as predicted.** Not portalled — it renders in place as
  a `position:fixed`, viewport-filling scrim (`document.body` gains no child).
  It worked unmodified: `demoteFullBleedScrim` correctly REFUSED to demote
  (Carbon's scrim is *visible*, `rgba(0,0,0,0.6)`, so it is real anatomy), the
  in-stage branch picked it, 18 parts and the close-button glyph were promoted,
  and the receipts carry `portal-autofocus-neutralized` on all 5 combos (Carbon
  autofocuses the primary button on open, and the sampler blurs it so the
  default plane is not silently a `:focus-visible` plane).

### Determinism pins (witnessed, never precautionary)

- **Tabs `selectedIndex: 0` + `onChange`.** Uncontrolled, Carbon's `TabList`
  defaults to `activation: 'automatic'`, so the focus-visible driver's `Tab`
  keypress SELECTS whichever tab it lands on — and the selection survived into
  the next sweep. The double-run self-check failed with Tab 0's
  `border-block-end-color` reading `rgba(15,98,254)` in run 1 and
  `rgba(224,224,224)` in run 2, and the list width jittering 261.781 vs
  261.922 px as the selected tab's bolder text remeasured. Controlled
  (`useControllableState`) it is stable — the same fix MUI Tabs carries as
  `value: 0`.
- **Toggle `size` pinned to `md`.** A Size×Toggled knob offset is the two-axis
  product the decor grammar cannot spell (named in
  `examples/tailwind/PROVENANCE.md`); pinning the size keeps the round honest
  instead of minting a product nothing can render.

### Other deferrals, by name

- `TextInput` `invalid` / `warn` — a validation subtree plus a second border
  plane.
- `Dropdown` — Downshift-driven open state, unverified.
- `DataTable` — the organism, a round of its own.
- Sticky / zebra table modifiers.
- `Checkbox` and `IconButton` were **REFUSED `figmaStatePreviews` by the
  referee, by name** (`state "focus-visible"` / `state "active"` declares no
  token overrides, so its preview variant would render identically to Default).
  Printed by the promotion, not worked around; the states still drive the code
  surface. Button, Toggle, TextInput, Accordion and Tabs were accepted.
- The `bound`-probe path (`refToVar`) spells a ref `{button-primary}` as
  `--button-primary`, not `--cds-button-primary`. Harmless here — seed anatomy
  carries no refs so nothing is probed — and it is the same for MUI and
  Tailwind, so it is a **shared pre-existing** limitation, named rather than
  claimed as Carbon-clean.

## Byte-identity proof for the `renderKids` engine change

Comparing against the committed artifacts is NOT a valid proof: the committed
`extract/computed/out/tailwind/toggleswitch/captured-truth.json` is already
stale against the current engine (it predates the `translate-x`/`translate-y`
synthetic-channel decomposition, and the re-capture adds exactly those keys).
That is a separate, pre-existing staleness — named here because it was found
here.

The valid proof is A/B on the SAME engine, changing only this expression:

| subject | artifacts compared | result |
|---|---|---|
| `tailwind` ToggleSwitch (`sampleText: ""`) | captured-truth, enriched contract, extension, scorecard, source-bindings, numbers | **all 6 byte-identical** |
| `mui` Switch (`sampleText: ""`) | same 6 | **all 6 byte-identical** |

Both libraries' committed `out/` artifacts were restored from git afterwards, so
this round moves nothing outside `examples/carbon` and the files listed in the
task report.

---

# THE CLASS-STEM PREFIX DEFECT (task #25) — the round that re-ran Carbon

Carbon shipped (28f4d85) with **every one of its CSS classes discarded by the
engine**, and nothing in the repo said so. This section records the defect, the
fix, what moved, and — the uncomfortable part — what did *not*.

## The defect

`extract/computed/lib.ts` `stems()` is the function that decides what a
captured element **is**. A signature is `tag + stems`, alignment across combos
matches on signatures, and a part's NAME comes from its dominant stem. It drops
"modifier" classes by testing for `--`, and it did that test **before**
stripping the library's own class prefix:

```ts
classes
  .map(c => c.endsWith('--root') ? c.slice(0, -6) : c)
  .filter(c => !c.includes('--'))          // ← ran FIRST
  .map(c => c.startsWith(prefix) ? c.slice(prefix.length) : c)
```

`--` means "BEM modifier" only in what the library wrote **after** its prefix.
Carbon's `classPrefix` is **`cds--`**. So the filter read the PREFIX's own
separator: `cds--btn` and `cds--btn__icon` were both discarded as modifiers,
every Carbon element captured the signature `button|` (tag only) while its
`classes` array still said `["cds--btn"]`, alignment fell back to **position**,
and every part was named `part-<path>`.

The config was never wrong. `classAllow` (`^cds--(?!.*--)`) had preserved
exactly the right classes — the engine threw them away one step later, no
config key could override it, and the round's own reader-configuration table
above argues the opposite intent. **274 of the 394 classed nodes** in Carbon's
committed captures produced zero stems.

## The fix

Strip the prefix FIRST, then filter modifiers (plus an explicit empty-stem
drop, for a class that *is* the prefix):

```ts
classes
  .map(c => c.endsWith('--root') ? c.slice(0, -6) : c)
  .map(c => c.startsWith(prefix) ? c.slice(prefix.length) : c)
  .filter(c => c !== '' && !c.includes('--'))
```

`cds--btn` → `btn` (KEPT). `cds--btn--primary` → `btn--primary` (DROPPED —
correctly a modifier). Pinned as a CLASS, not an instance, by the eval
`class-stem-prefix-order`.

### Byte-safety for the other six libraries — proven twice, not assumed

**1. Pure-function A/B over every committed capture.** Both orders were run
over all `classes` arrays in every committed `captured-truth.json`:

| library | prefix | classed nodes | nodes where the two orders DIFFER |
|---|---|---|---|
| polaris | `Polaris-` | 415 | **0** (`Polaris-Text--root` → `Text` under both — the `--root` case runs first either way) |
| mui | `Mui` | 988 | **0** |
| astryx | `astryx-` | 170 | **0** |
| altitude | `al-c-` | 80 | **0** |
| tailwind | `` (empty) | 42 | **0** |
| **carbon** | **`cds--`** | **394** | **274** |

**2. Harness A/B on the SAME engine, changing only this ordering** (the proof
pattern this round's `renderKids` change used — a comparison against committed
artifacts is not valid, since those can be stale for unrelated reasons):

| subject | artifacts compared | result |
|---|---|---|
| `tailwind` ToggleSwitch | captured-truth, enriched contract, extension, scorecard, source-bindings, numbers, LEDGER, pixel-rows, replay/gate HTML, **every gate + receipt PNG** | **all byte-identical** |
| `mui` Switch (224 captures) | same | **all byte-identical** |

Both libraries' `out/` artifacts were restored from git afterwards.

**3. The 54-row offline drift instrument**, before and after: every non-Carbon
row EXACT. Carbon's ten rows are re-recorded (below).

## What moved — and what did NOT

**Floors did not move.** This is the finding, and it is not the one the round
expected:

| component | committed (round 1) | re-captured | Δ |
|---|---|---|---|
| Button | 77.281% | 77.276% | −0.005 |
| Tag | 80.521% | 80.521% | — |
| Checkbox | 84.291% | 84.291% | — |
| Toggle | 83.140% | 83.140% | — |
| TextInput | 89.045% | 89.045% | — |
| InlineNotification | 96.581% | 96.581% | — |
| Accordion | 76.462% | 76.462% | — |
| Tabs | 92.742% | 92.742% | — |
| Modal | 89.744% | 89.744% | — |
| IconButton | 91.810% | 91.810% | — |

`cellsCompared` is **identical** on all ten, and so is every component's PART
COUNT (1/2/5/7/7/12/8/16/18/6). Button's −0.005 is an order of magnitude inside
that row's own recorded ±0.08 gate-timing tolerance ("THE GATE SAMPLES
MID-TRANSITION" above) — the two runs of *this* round measured 77.276 twice.

**Why the floors held.** The gate walks the promoted tree and compares channel
values per part. Positional alignment and class-identity alignment produced the
**same tree** here, because Carbon's DOM shape is stable across every combo of
every component — no combo adds or removes an element. The defect corrupted
**identity**, not measurement. That is worth stating plainly: the number that
would have caught this was never going to catch it, and the thing that did was
reading the captured `classes` array next to the captured signature.

**Names moved — 42 parts across 8 of the 10 components**, from position to the
library's own vocabulary:

| component | before → after |
|---|---|
| Checkbox | `part-0` → `checkbox`, `part-1` → `checkbox-label`, `part-2` → `checkbox__validation-msg` |
| Toggle | `part-0` → `toggle__button`, `part-1` → `toggle__label`, `part-1-1` → `toggle__appearance`, `part-1-1-0` → `toggle__switch` |
| TextInput | `part-0` → `text-input__label-wrapper`, `part-1` → `text-input__field-outer-wrapper`, `part-1-0` → `text-input__field-wrapper`, `part-1-0-0` → `text-input`, `part-1-0-1` → `text-input__counter-alert` |
| InlineNotification | `part-0` → `inline-notification__details`, `part-0-1` → `inline-notification__text-wrapper`, `part-1` → `inline-notification__close-button` |
| Accordion | `part-0` → `accordion__item`, `part-0-0` → `accordion__heading`, `part-0-1` → `accordion__wrapper` (+ `-2`) |
| Tabs | `part-1-0/2/4` → `tabs__nav-item{,-2,-3}`, `part-1-*-0` → `tabs__nav-item-label-wrapper{,-2,-3}` |
| Modal | `part-1` → `modal-container`, `part-1-0` → `modal-header`, `part-1-0-2` → `modal-close-button`, → `icon-tooltip` → `tooltip-trigger__wrapper` → `btn`, `part-1-0-2-0-1` → `popover`, `part-1-2` → `btn-set` |
| IconButton | `part-0` → `tooltip-trigger__wrapper`, `part-0-0` → `btn`, `part-1` → `popover`, `part-1-1` → `popover-caret` |

Button (root only) and Tag (root + label) were already fully named.

Nine parts keep a positional name and that is CORRECT: they are Carbon
elements with no `cds--` class at all (Tabs' scroll buttons and `<path>`
glyphs, InlineNotification's inner `<path>`s). A `part-<path>` name is now a
real statement — "this element carries no library class" — rather than the
engine's silence.

**Seed contracts needed no change**: all ten `contracts-seed/*.json` carry
`anatomy.root` with no `parts`, so nothing referenced a promoted part name.

## The alias join this exposed (defect-first)

The rename cost **4 verified source aliases** on the first re-promotion
(94 → 90) before anyone asked for them back. Cause: `promote-floor.mjs` joins a
MINTED TOKEN PATH segment against a source fact's raw `part` name, and the two
spellings are not the same string — the minted path runs every segment through
`core/mint-tokens.ts` `sanitizeSegment`. With positional names
(`part-1-1-0`) the sanitized form equalled the raw form and the join worked
**by coincidence**. Carbon's BEM element stems carry `__`: `toggle__switch`
mints as `toggle-switch`, the join missed, and three Toggle-switch aliases plus
one Tabs nav-item alias fell back to anonymous literals **with no receipt**.

Fixed here by joining on the minted spelling; **94 source-aliased / 987
literal restored exactly**. Two things ride with the fix:

- The rule is **mirrored, not imported** — `sanitizeSegment` is module-private
  in `core/mint-tokens.ts` and exporting it would change the plugin ENGINE
  BUNDLE to serve a per-library promotion script. The copy carries that note.
- An **unjoined-fact receipt**: any verified source fact that reaches no minted
  leaf is now printed into `tokens/MINTED.md` by name. It surfaced 16 such
  facts that were ALWAYS unjoined and always silent (svg `fill` channels that
  promote to assets, `-webkit-text-fill-color`, `max-block-size`). None is a
  new loss; all sixteen are now visible.

**LATENT ELSEWHERE, NAMED:** every other library's `promote-floor.mjs` carries
the identical join. Measured: no other library has a part name whose sanitized
form differs from its raw form, so the defect is latent there and was live only
here. Each closes it on its next re-promotion.

## Task #28 — the gate ordering guard

All ten of Carbon's round-1 scorecards recorded `shippedMinted.leavesAdded: 0`.
That was not a measurement: the pipeline runs the harness **before**
`promote-floor.mjs` writes `tokens/carbon-minted.dtcg.json`, so the gate scored
against a tree that did not exist yet. (The task-#21 refusal only covers a
DECLARED-but-ABSENT path; an empty stub written to satisfy it passes.) The
offline re-fuse of the same captures against the shipped tree measured 755–1037
leaves added — every divergence `resolvedEqual: true`, so no value was ever
wrong; the receipts simply understated what the gate saw.

The general fix is in `loadConfig`, not in Carbon:

- a DECLARED `tokens.minted` whose tree carries **ZERO leaves** is **refused by
  name** — "the fidelity gate would record shippedMinted.leavesAdded: 0 for a
  tree the promotion has not written yet (ORDERING: the harness runs BEFORE
  promote-floor)";
- a library's genuine first-ever pass sets `tokens.mintedBootstrap: true`,
  which allows it **explicitly** and makes the scorecard carry
  `shippedMinted.bootstrap: true` + the receipt sentence *"measured without a
  shipped minted tree"*. Chosen over a silent pass because a bootstrap run is a
  real state that must be legible in the artifact, not inferred from a zero;
- the allowance **cannot rot**: leaving the flag set once the tree carries
  leaves is itself refused by name.

Re-run naturally produces correct receipts: `leavesAdded` is now 755 (Button)
to 1105 (Checkbox) across the ten, `divergent: 0` everywhere.

## Vendor names removed from the live path

- `anatomy.ts` `PORTAL_PREFIX = 'Polaris-'` — a module constant used by
  `realRootsOf` for every library. Now `realRootsOf(node, classPrefix)` /
  `descendToRealRoots(node, classPrefix)`, threaded from the capture config.
  Behaviourally a no-op today (the descent only asks whether a wrapper has ANY
  own stem, and every library's classes answer the same under both prefixes) —
  removed because a library-dependent answer to a library-independent question
  is a defect waiting for a subject.
- `capture.ts` in-page portal reader `/^Polaris-/` + its own copy of the
  modifier filter. Replaced with a `stemsOf` mirror of the CORRECTED rule,
  taking the config's `classPrefix`. Diagnostic-only (`currentReader.sig`); the
  committed depth receipt records `present: false, sig: ""`, so the change is a
  no-op on committed bytes.

## Instrument generality

`extract/computed/drift-check.ts` listed its six libraries in a hand-written
array, so adding a capture config left the instrument silently stale. The
registry is now DERIVED from `extract/computed/configs/*.json`, with the output
directory resolved by asking which directory actually holds that config's own
components (never by name-matching). A config with no committed scorecard is
SKIPPED **and printed** — `polaris-depth.json` is the standing case, and it now
says so on every run instead of being invisible.

## Re-run pipeline and receipts

Identical to the pipeline above, plus `--icons examples/carbon/assets/icons` on
the `figma` compile (the round-1 recipe omitted it; the emit refuses without
it once a promoted part carries an icon asset).

- capture: 1012 census captures + 5 portal captures, **double-run byte-identity
  IDENTICAL**; a full SECOND harness run reproduced the quoted computed number
  on all ten to three decimals and every `captured-truth.json`,
  `enriched.contract.json`, `enriched.extension.json` and `source-bindings.json`
  byte-for-byte. What did NOT reproduce: Button's and IconButton's
  `:focus-visible`/`:active` gate PNGs and their pixel sub-scores — the
  pre-existing mid-transition sampling named above, unchanged by this round.
- promotion, figma emit, token sync, compile receipt, genesis batch and bundle
  all **double-run byte-identical**.
- unchanged downstream totals: **1459 variables (94 Figma-native aliases),
  132 variant cells across 10 sets, 339 base tokens, Light/Dark**.
- six orphaned icon assets named after the old positional parts
  (`tabs-part-1-1-0.svg`, `modal-part-1-0-2-0-0-0.svg`, …) were deleted; their
  replacements carry the class-stem names.

## Coverage of this library — the denominator

| committed contracts | pinned by the drift instrument | library size | **coverage** |
|---|---|---|---|
| 10 | 10 | 243 | **4.1%** |

Library size: **this repo's own extractor over the whole library** — `extract/pilots/ENTERPRISE-GAUNTLET.md` (243 extracted, 62 named-skipped).

Every per-component number in this file — floors, `pctEqual`, token counts,
variant cells — is measured over that slice, and the slice was hand-picked for
tractability. The engine generalizing across libraries (`docs/22`) and a
library being *captured* are different claims; this row is the second one, and
it is small. Full table and how to re-derive it: [docs/22 §8.3](../../docs/22-generality.md).
