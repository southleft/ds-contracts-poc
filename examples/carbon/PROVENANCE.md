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

---

# THE LIVE-DEFECT ROUND (task #30) — six defects a real canvas paste found

The owner pasted `examples/carbon/figma/carbon.bundle.json` into a real Figma
file and reported "lots of issues with these components". The canvas was
triaged through the desktop bridge and the evidence captured as **node trees,
not impressions**. Every defect below was first reproduced as a **failing
headless assertion** against the real engine bundle in the mocked canvas
(`scripts/plugin-engine-mock-figma.mjs`), then fixed at its source, then
re-measured green. **11 of 13 assertions were RED at 5e4c885; 12 are green now,
and the one that is still red is named at the bottom with its measurement.**

What was already right and is now pinned so it stays right: **Button** (80
variants — kind × size × disabled colours, fills, outlines and text) and
**Tag** (36 variants, per-type pill colours including high-contrast and
outline) were correct before and are byte-unchanged in their floors.

## The six, each with its root cause

### D1 — an SVG `<title>` was being rendered as visible canvas text

InlineNotification drew the literal words **"error icon"** beside the
notification heading, inside an `icon` FRAME **173×30** wrapping an `icon`
FRAME **173×16** — an icon frame the width of a sentence.

**Root cause, two consequences from one miss.** Carbon's notification icons
ship `<title>error icon</title>` inside the SVG for screen readers. `<title>`
/ `<desc>` / `<metadata>` are **non-painting** by spec (SVG 1.1 §5.4) but they
are real elements carrying real text, so the capture's DOM reader took them:

1. the title's text node promoted into a contract part and became canvas ink;
2. `reconstructSvg`'s bounded `path`/`g` asset grammar hit `<title>` and
   **refused the whole asset** — the receipt
   `svg-child-outside-grammar: InlineNotification.icon@error.high — <title>`
   was already in `enriched.extension.json` on every one of the 12 combos and
   nobody had read it — so one glyph exploded into five per-path parts.

**Fixed at the source** (`extract/computed/capture.ts`, both DOM readers — the
census one and the portal one): a child that `instanceof SVGElement` and whose
tag is `title|desc|metadata` is never captured. A promotion-side backstop
(`svg-metadata-not-a-part`) and a reconstruction-side skip
(`svg-metadata-skipped`) keep already-committed captures safe.
**Measured byte-safe by construction:** `"tag":"title"|"desc"|"metadata"`
appears in **0** committed `captured-truth.json` files in mui / polaris /
astryx / altitude / tailwind, and **1** in carbon.

**Result:** the six per-kind notification glyphs now promote as REAL icon
assets (`inline-notification-icon-{error,info,info-square,success,warning,
warning-alt}.svg`); the icon frame is **20×20**; floor **96.581 → 97.087%**.

### D2 — pseudo-element anatomy: two of ten components were hollow

Measured: the whole **Checkbox** was `288×20` containing only
`checkbox-label(93×20) → label(73×18) → label-text(68×18)` — **no box at all**;
**Toggle**'s `toggle__switch` was `48×24` **with no children** — the track drew
and the knob did not.

Both were refused by the v1 decor grammar, and the single refusal
(`pseudo-decor-nonuniform`) hid **two different reasons**:

| | what actually varies | v1 verdict |
|---|---|---|
| checkbox `::before` | geometry IDENTICAL in all 6 combos (16×16 at 2,0, r2); only PAINT moves — `transparent + 1px #161616 ring` when unchecked, `#161616` filled when checked/indeterminate, quarter-alpha when disabled | refused: fill not uniform; also **never even seen as drawn** when unchecked, because v1 required an opaque BACKGROUND and a box made of a RING has none |
| toggle `::before` | paint IDENTICAL in the enabled plane; only `left` moves (3px → 27px with `toggled`) | refused: geometry not uniform; and refused AGAIN as "unconditional placement" — it is drawn in EVERY combo, so it has no enum gate to hang a `stylesWhen` on |

**Neither is the two-axis product wall.** That wall (named in
`examples/tailwind/PROVENANCE.md` and `docs/22`) is Flowbite's knob offset as a
function of `Sizing × Checked` — two ENUM axes on one GEOMETRY channel. Carbon's
are one enum axis on geometry (toggled) and one enum axis on paint (checked).
The wall is still here and still refuses by name
(`pseudo-decor-geometry-multiaxis`, `pseudo-decor-paint-multiaxis`).

**PSEUDO-DECOR v2** (`extract/computed/anatomy.ts`), four bounded extensions:

1. **DRAWN means PAINTS ANYTHING** — an opaque background *or* a visible border
   (width > 0 with a non-transparent colour). A ring is a box.
2. **GEOMETRY and PAINT factor SEPARATELY**, each as uniform *or* a function of
   exactly ONE enum axis (`literalsByProp`, one ordered entry per driving axis).
3. **UNCONDITIONAL ABSOLUTE DECOR** — a decor drawn in every combo declares
   `position: absolute` and carries its own `top`/`left` literals, lowering
   through the same `absolutePartPlacement` every other absolute part uses. The
   enum-GATED spelling (Polaris's RadioButton dot) is untouched and
   byte-identical — every committed decor part in the repo is that shape.
4. **PERCENTAGE RADIUS** — `border-radius: 50%` is how most libraries spell a
   circle and the px regex silently read it as `0`. Carbon's round knob would
   have shipped as a **square**. (Same class as the `rounded-full`
   3.35544e+07px sentinel the v2/G3 round already covers.)

Three supporting changes rode with it, each a real silent-drop closed:
`LITERAL_CHANNELS` gains `top/right/bottom/left` (the emitter's
`absolutePartPlacement` has always READ them out of `resolveLiterals` — the
registry just never allowed the spelling) and `border-*-color`; `applyLiterals`
gains a **literal border colour** case (`lits.strokeColor`) which had no case
at all and was dropped on the floor; and the emitted shape runtime applies a
literal ring/weight/radius. All three are **feature-gated**, so a contract that
carries none of them emits a byte-identical script.

**Result:** `RECTANGLE "checkbox-label-before" 16×16 ABSOLUTE` (transparent
with a 1px `#161616` ring, per-`checked` paint) and
`ELLIPSE "toggle__switch-before" 18×18 ABSOLUTE` (per-`toggled` placement).
Toggle floor **83.140 → 84.302%**.

**NAMED, NOT CARRIED** (printed as `pseudo-decor-*` receipts, with the numbers):

- the checkbox **CHECKMARK** (`::after`): a 45°-rotated L drawn from two
  border sides — `pseudo-decor-outside-grammar` (non-identity scale/rotate
  matrix). The box is the visible defect; the tick is residue.
- the **DISABLED-plane paint** of both decors:
  `pseudo-decor-state-paint-uncarried` prints, per combo, what the disabled
  plane paints (`rgba(22,22,22,0.25)` ring / `rgba(141,141,141)` knob) against
  what the enabled plane paints. The decor carries the ENABLED plane. There is
  no contract spelling for a per-enum-value × per-state paint PRODUCT:
  `states` takes token refs and decor paint is literal. (Checkbox does not
  ship a disabled canvas plane at all — the referee refuses its
  `figmaStatePreviews` by name — so nothing on the canvas is wrong; the code
  surface is what loses the fact.)

### D3 — frames with no `layoutMode` let children overlap

Measured: `toggle__label` 75×32 containing BOTH `label (margin box)`(40×32) and
`toggle__appearance`(75×24) — the word "Toggle" collided with the track; and
`accordion__item`(328×48) containing `accordion__heading`(147×32) and
`accordion__wrapper`(**402**×48) — a panel wider than the component it lives in.

**Root cause: three separate holes in the display lowering, all of them
SILENT.** The promotion's display fact carries `flex`/`inline-flex` into
`Part.layout` and `inline|inline-block|block|contents|none` into
`Part.declared`; **everything else fell into a `display-outside-vocabulary`
receipt and reached the emitter with no display fact at all**, where the
default is `HORIZONTAL`. Measured across Carbon's ten:

```
accordion__item      = "list-item"   (an <li>)
toggle__appearance   = "inline-grid"
modal-container      = "grid"
```

1. **CSS GRID now lowers to the flex vocabulary** (`lowerGridDisplay`,
   the sibling of the organism round's `lowerTableDisplay`), from the
   **measured** `grid-template-columns` / `grid-template-rows` track counts —
   these resolve to explicit px track lists in computed style, so the counts
   are captured facts, not guesses. 1 column → flex COLUMN; 1 row → flex ROW;
   cross-axis from `justify-items` / `align-items` (grid's `normal` IS
   stretch). A genuine 2-D grid (>1 column AND >1 row) is **refused by name** —
   one axis would have to be invented. Carbon: `modal-container` is
   `1 × 4 → column`, `toggle__appearance` is `2 × 1 → row, align center`.
2. **`list-item` and `flow-root` join the declared display grammar.** Both are
   block-level boxes in CSS block flow. Leaving them out did not make them
   safe, it made them invisible.
3. **The block-flow rule was too narrow in two ways** (`core/emit-figma-script.ts`
   `layoutSpec`): its TRIGGER was `display:block` only (so an `inline` box and
   an `<li>` fell through), and a `display:none` child counted as an in-flow
   sibling (Accordion's second, hidden wrapper vetoed the whole rule on its
   own). The CSS truth it approximated is **blockification** — a block
   container with at least ONE block-level in-flow child wraps every child in
   anonymous block boxes and stacks them. `every` is only the safe half of
   that; the `some` half is now taken **only when no two inline-level children
   are ADJACENT**, because a run of ≥2 inline siblings shares one anonymous
   block (one LINE) which a flat VERTICAL frame cannot express — that shape
   keeps the row default and is named residue rather than guessed at. A part
   placed absolutely by a CONDITION (`stylesWhen … position: absolute` — the
   decor spelling) is also out of flow now, which it always was in CSS.

**Result:** `toggle__label` VERTICAL (label above the track),
`accordion__item` VERTICAL, `modal-container` VERTICAL,
`toggle__appearance` HORIZONTAL/center. Accordion floor **76.462 → 77.632%**,
Modal **89.744 → 90.038%**. Zero non-text container overflows remain in
Carbon's canvas (see D4 for what does).

### D4 — text truncation: NOT this round's, and here is why, with numbers

Three symptoms were reported: Tabs labels clipping to "Overvi…/Activ…/Settin…",
Accordion body copy clipping, the Checkbox label clipping. Checked against the
MUI round's max-width-as-ceiling fix and against D3's overflow — **it is
neither**. Two measured mechanisms, both the same corpus-wide round:

1. **A hugging TEXT node inside a fixed-width ancestor.** Carbon's
   `accordion__content` is 328px in the DOM with the copy WRAPPING inside it;
   on canvas the frame HUGS an unwrapped run and comes out 472px. This is
   character-for-character the case `docs/22` already names ("MUI's
   `AccordionDetails` body copy at 426px inside 288px"). **8 instances in
   Carbon**, all in Accordion — now COUNTED in the compile receipt's own
   column rather than being invisible.
2. **A shrink-to-fit box measured in the WRONG FONT and baked as fixed.**
   `tabs__nav-item-label-wrapper` carries `width: 62.3125px` — that number is
   "Overview" measured in the harness's FALLBACK font, because IBM Plex is not
   loaded (105 `@font-face` blocks, every `src` an Akamai CDN URL, harness is
   network-free — probe 2 above). The canvas draws **Inter**. A shrink-to-fit
   width from font A applied as a fixed box in font B clips, and Carbon's own
   `overflow: hidden` + `text-overflow: ellipsis` on `.cds--tabs__nav-item`
   are declared facts the canvas records but does not draw.

Complete inventory of Carbon text inside a fixed-width ancestor, measured:
Accordion `label`/`label-2` (root 328px), Checkbox `label`
(`checkbox-label` 92.9219px), Modal `label-2`/`label-3`/`label-6`/`label-7`,
Tabs `label`/`label-2`/`label-3` (62.3125 / 48 / 52.4688px), TextInput `label`
(288px). **Fixing this changes every hugging text node in the corpus** — it
needs either real text wrapping on canvas or a hug-vs-fixed decision in the
promotion, and it is deliberately not attempted mid-live-defect-round.

### D5 — the Modal was 980×4200 on canvas (measured here: 900×1000 per variant)

Carbon's Modal is `position: fixed` with `block-size: 100vh` and a VISIBLE
`rgba(0,0,0,.6)` scrim, so `demoteFullBleedScrim` correctly REFUSES to demote
it — **that rule is right and it is what keeps MUI's Dialog whole**. The result
was faithful to the DOM and useless on canvas: four modal variants as
900×1000 dim rectangles — the exact width and height of the capture viewport.

**This is a SHARED, pre-existing canvas defect, and Carbon only made it
unmissable.** Measured on the committed MUI bundle through the same engine:
`mui.dialog` builds at **900×126** — the 900 is the stage, not the dialog.

**The decision, and it is a deliberate canvas-vs-DOM divergence:** a component
ROOT that is a viewport-pinned overlay layer carries the CAPTURE STAGE as its
box, not the component's. Its canvas box is bound to the overlay's own content;
the scrim keeps its fill, its layout, its inset and z-index channels, and
**the contract is not edited** — `width`, `height` and all four insets are
still in it, saying exactly what the DOM does. The divergence joins the
component's code-only facts (the description dagger).

The signature needs **no new capture fact and no guessing**: only an
OUT-OF-FLOW box has computed insets at all, so a root carrying all four of
`top/right/bottom/left` resolving to 0 IS `inset: 0` on a positioned layer.
A root that declares `position: relative | static | sticky` is EXCLUDED, and
that exclusion is load-bearing: MUI's Accordion, Checkbox, Slider and Switch
roots all declare `position: relative` AND carry inset-0 channels, and without
it this rule would have thrown away four real component boxes (caught by the
cross-library A/B before anything was committed).

**Result:** Carbon Modal `Size=Xs` is **432×214**. MUI's Dialog is improved by
the same rule (see the cross-library section).

### D6 — IconButton was 24×24 with an invisible absolute tooltip part

Measured: component 24×24 → `popover` FRAME 24×24 **ABSOLUTE** + `tooltip-trigger__wrapper`(24×24)
→ `btn`(16×16) → `Vector`(11×11). Two independent defects in one component.

**(a) A carried part that draws nothing.** In Carbon an icon button *is* a
tooltip trigger, so its captured anatomy carries `span.cds--popover` and its
whole subtree (`popover-caret`, the tooltip label) — every one of them
`display: none` in every captured combo. Promoted, that is an absolutely-
positioned frame over the entire component that paints nothing. This is the
**census-capture sibling** of the molecule round's `stripInertPortalChildren`:
a new promotion refusal `inert-overlay-wrapper`, bounded to a part that paints
no box in EVERY captured combo, carries no ink of its own, and has ≥1 child
with EVERY child declared `display: none`. A CHILDLESS paintless frame is left
alone by name — it can be a real spacer and this round has no measurement that
says otherwise.

**(b) An icon-bearing part lost its own box.** The icon lowering compiled a
part with `part.icon` to a **bare svg node** sized by `icon.size` and threw the
part's entire box away — every fill, border, padding, radius and width/height
channel. Carbon's `button.cds--btn` carries the per-kind background, the 1px
border and the 24/32/40/48 control box AND hosts the glyph, so the canvas drew
a bare 16px glyph with no button chrome at all. Fixed with the **same lowering
the MUI round gave box-carrying TEXT parts** (`wrapTextInBox`): a box-carrying
icon part becomes FRAME(box) → svg child; a box-less one keeps the plain svg
lowering byte-identically. "Carries a box" = paints one (background / border /
shadow) or reserves space around the glyph (padding); a part whose only
geometry is a width equal to the glyph stays bare.

**Result:** IconButton is `tooltip-trigger__wrapper(24×24) → btn(24×24) →
btn-icon(16×16)`, 6 parts → 3, floor **91.810 → 100.000%**.
**Read that 100% correctly**: refusing the inert wrapper takes 8160 of 9280
compared cells out of the denominator. A 100% on 1120 cells is a *smaller*
claim than 91.810% on 9280, not a bigger one — the drift baseline row says so
in those words.

## Floors, before and after

| component | before | after | Δ | cellsCompared |
|---|---|---|---|---|
| Button | 77.276% | 77.276% | — | 20608 → 20608 |
| Tag | 80.521% | 80.521% | — | 12896 → 12896 |
| Checkbox | 84.291% | 84.291% | — | 1776 → 1776 |
| Toggle | 83.140% | **84.302%** | +1.162 | 1376 → 1376 |
| TextInput | 89.045% | 89.045% | — | 3560 → 3560 |
| InlineNotification | 96.581% | **97.087%** | +0.506 | 7488 → **4944** |
| Accordion | 76.462% | **77.632%** | +1.170 | 5472 → 5472 |
| Tabs | 92.742% | 92.742% | — | 1240 → 1240 |
| Modal | 89.744% | **90.038%** | +0.294 | 1560 → **1305** |
| IconButton | 91.810% | **100.000%** | +8.190 | 9280 → **1120** |

Every moved row is re-recorded in `extract/computed/regate-baseline.json` with
its `gapCause` naming what moved and why; the three moved `cellsCompared`
counts are VOCABULARY changes and each says which parts left the tree.

Downstream: **1425 variables** (was 1459) / **94 Figma-native source aliases**
(unchanged) / **952 minted literals** (was 987) / **132 variant cells across 10
sets** (unchanged) / 339 base tokens / Light+Dark. **15 icon assets** (was 9) —
the six per-kind notification glyphs are new, no orphans.

## Cross-library byte safety — proven by A/B, not by hope

A comparison against committed artifacts is not a valid proof (they can be
stale for unrelated reasons — Polaris's committed scripts already are). The
valid proof is **the same command, the same contracts, HEAD engine vs changed
engine**:

| library | scripts | result |
|---|---|---|
| tailwind | 5 | **all byte-identical** |
| astryx | 13 | **all byte-identical** |
| polaris | 12 | **all byte-identical** |
| altitude | 8 | **all byte-identical** |
| **mui** | 14 | **3 differ — all three are the same fixes IMPROVING MUI, named below** |

- `mui/dialog.figma.js` — D5. Root drops `fixedWidth 900` (the capture stage)
  and bounds to the dialog's own content.
- `mui/autocomplete.figma.js` — D6(b). `MuiAutocomplete-clearIndicator` and
  `-popupIndicator` are REAL BUTTONS (background + 1px border + padding on all
  four sides) that were drawing as bare 20/24px glyphs; they regain their box.
- `mui/table-pagination.figma.js` — D6(b). The two `MuiButtonBase-root`
  prev/next buttons, same shape.

That is the evidence the rules are general rather than a Carbon patch. **MUI's
committed artifacts are deliberately NOT regenerated in this round** (that
pulls in its bundle, receipts and the engine receipt, and it is an MUI round);
they are now knowingly stale by exactly those three improvements.

Three intermediate findings were caught by this A/B before anything was
committed, each of which would have silently damaged another library:
the D5 signature originally fired on any inset-0 root and stripped the boxes of
MUI's Accordion/Checkbox/Slider/Switch; the new literal-stroke and shape-lits
runtime lines were emitted unconditionally and moved 20 files' bytes for dead
code (now feature-gated); and the block-flow `some()` half flipped Polaris's
RadioButton because a `stylesWhen`-absolute decor was being counted as an
in-flow inline sibling.

The 54-row offline drift instrument was run before and after: **every
non-Carbon row EXACT**, Carbon's five moved rows re-recorded with causes.

## New instrument: child-wider-than-parent

"A container whose children overlap is never right" is now measurable. The
compile receipt fails Carbon on any in-flow child wider than its parent, with
ONE counted exemption (an overflow whose cause is a hugging TEXT descendant —
D4's round). Run across every committed bundle for a baseline, this is where
the corpus stands today:

| bundle | non-absolute children wider than their parent |
|---|---|
| altitude | 0 |
| tailwind | 0 |
| astryx | 11 (ProgressBar `fill` inside `track`, Slider label) |
| mui | 12 (AccordionDetails body — D4; Autocomplete indicator margin boxes) |
| polaris | 42 (Badge `icon` 20 inside a 12px margin box) |
| carbon | 16 → **8, all 8 text-caused (D4)** |

It is NOT turned on repo-wide in this round: four libraries would go red
immediately and each of those numbers is its own investigation. The
measurement is published so the next round starts from a number.

### CORRECTION + repo-wide posture (silent-loss round, task #33, 2026-07-27)

The next round started from that number and found it was measuring three
different things at once. The instrument moved to `scripts/child-wider.mjs`
(ONE implementation — Carbon's receipt now calls it) and separated a SECOND
exemption the table above had folded in: the CSS **margin box**. A part with a
NEGATIVE margin lowers to a wrapper frame named `"<part> (margin box)"` that
reserves LESS layout space than the child paints. That is the entire meaning of
a negative margin, not an overflow.

| bundle | real overflows | text-caused (D4) | margin-box paint-outside |
|---|---|---|---|
| altitude | 0 | 0 | 0 |
| tailwind | 0 | 0 | 0 |
| astryx | **5** | 6 | 0 |
| mui | **0** | 6 | 4 |
| polaris | **0** | 0 | 42 |
| carbon | **0** | 8 | 0 |

So the repo-wide real number is **5, all of them one defect**: astryx's
ProgressBar `fill` renders 100px inside a 48px `track` in all five Variant
cells — a PERCENT width baked as a px literal by the computed floor. The
published "polaris 42" was 42 negative margins; polaris has ZERO. The
published "mui 12" was 6 text + 4 margin-box + 2 that the MUI regen round
(task #31) closed on the way past.

The posture is the repo's existing RATCHET (drift-check, parity/baseline.json):
a committed per-library baseline in `scripts/child-wider-baseline.json` that
may only DECREASE, two-sided so an unrecorded IMPROVEMENT also fails — a stale
high baseline is room to regrow in silence. Every nonzero row names its cause.
Gated by `npm run child-wider` and the `child-wider-ratchet-and-script-freshness`
eval.

## What stays refused, by name

- The checkbox **CHECKMARK** — a rotated two-border L, outside the decor
  grammar (`pseudo-decor-outside-grammar`).
- The **disabled-plane paint** of both decors — no spelling for an
  enum × state paint product (`pseudo-decor-state-paint-uncarried`, with the
  measured values printed per combo).
- The **two-axis geometry product** (Flowbite's `Sizing × Checked` knob) —
  unchanged, and now refused with its own message
  (`pseudo-decor-geometry-multiaxis`).
- **Text wrapping / font-metric width** (D4) — the corpus-wide round, with
  Carbon's complete inventory measured above.
- A genuine **2-D grid** (>1 column AND >1 row) — `grid-two-dimensional`.
- A **run of ≥2 adjacent inline children** in a block container — one anonymous
  line box, no flat-frame spelling; keeps the row default.
- `portalSweep` still takes no `varPrefix`, so `carbon/modal` still has **0**
  source-binding facts (THE HEADLINE DEFECT above) — untouched by this round.
- `gate.ts`'s flat 30 ms interaction wait (Button's ±0.20 tolerance) —
  untouched by this round.

## THE HARNESS RECAPTURE WAVE (task #38)

Three rounds deferred library regeneration for the same reason, and every library's SHIPPED
artifacts had drifted behind fixes that were already in the engine. All 10 components were
re-captured against the pinned `.carbon-sandbox` with the recipe above, double-run byte-identity
required and met, then re-promoted and every downstream artifact rebuilt.

**Floors before -> after:** NONE — all 10 scorecards came back byte-identical (pctEqual and cellsCompared both).
That is the honest shape of this wave across the corpus: 37 scorecards were re-measured over
carbon/mui/tailwind/altitude and exactly ONE moved. The artifacts were stale in their VOCABULARY
(refusals, instrument fields, per-axis token maps), not in their floor numbers.

**THE SHORTHAND CEILING (task #27) — the real number, measured for the first time.**
`shorthandCeiling` counts source declarations dropped because the property they name is not in the
computed longhand sweep — overwhelmingly CSS SHORTHANDS carrying a `var()`, which are
pending-substitution values with no computed value to verify a token name against. The instrument
was STRUCTURALLY ZERO in every artifact ever written, because `normalizeNode` never preserved the
`vshorthands` field it reads; that was fixed but had never produced a real number until this wave.
**This library: 14** (accordion 5, inline-notification 5, button 1, icon-button 1, tabs 1, tag 1).

**The root max-width fix landed here (task #37).** Three roots and two nested parts now carry the MEASURED `hugsBelowMaxWidth` fact: Button (used width 123.5px under a 320px cap), InlineNotification (428 under 608), Tag (35.7 under 208), plus Modal's and IconButton's `btn`. On the canvas that is Button 320 -> 128, InlineNotification 608 -> 441, Tag 208 -> 38/46 per size. The counter-case is in the same library and is why the discriminator is a measurement and not a list: `inline-notification__close-button` sits AT its max-width in every combo, so it carries NO evidence and keeps the fixed-width lowering. A new D7 pin in the compile receipt (scripts/hug-ceiling-pin.mjs) refuses a hug-measured root that renders at its ceiling.

### The other two live-canvas findings from the same review

**FIXED — "Modal's Label renders centered at the top rather than top-left."** Not a Modal bug and
not a Carbon bug: a corpus-wide one. `core/emit-figma-script.ts` wraps a TEXT spec in a frame
whenever it carries a fill, a fixed size **or any bindings at all**, "so fills/dimensions/radius
apply to a container, not the glyphs" — and that wrapper was hard-coded `primaryAxisAlignItems:
CENTER, counterAxisAlignItems: CENTER`. Right for the case it was built for (a chip/dot/thumb: a
DRAWN box where centering the glyph is correct); wrong for the 46 of the corpus's 62 wrapped texts
that have **no fill and no fixed size at all** and are wrapped only to carry `min-width` /
`min-height` bindings the floor promoted. Carbon's Modal `label-2` is exactly that — a bare `<h2>`
whose only bindings are `min-width: 0` and `min-height: 0` from Carbon's own reset — so it FILLed
the 430px header and the wrapper centered it. A wrapper with no drawn box now takes MIN/MIN (the
CSS truth: `text-align` initial is `start`); a wrapper that draws a box keeps its centering. The
built header now measures `label-2 w=366 x=0 primary=MIN counter=MIN`. The change is in the emitted
RUNTIME, so all 53 `figma-sync/*.js` goldens moved by exactly that block and **zero spec bytes
changed** (verified by diffing the emission).

**NOT FIXED, NAMED PRECISELY — "Modal's footer buttons render 125/111 where Carbon's footer is an
equal-width flush-right pair."** After this round they measure **128 and 112**; Carbon's captured
truth is **377 and 377**. The cause is not the emitter and not the max-width lowering: Carbon
declares `.cds--modal-footer .cds--btn { flex: 0 1 50% }`, and the captured computed style records
`flex-basis: 50%` on both `label-6` and `label-7`. **`flex-basis` is not a carried channel
anywhere in the pipeline** — it is absent from `CHANNEL_TO_COMPUTED` in `extract/computed/lib.ts`,
so it never reaches the contract, and `core/emit-figma-script.ts` has no lowering for it. Closing
it is a real round, not a cheap win: a PERCENTAGE basis is not mintable (the mint takes
color/px/number/shadow/gradient), so it would have to enter the `DECLARED_CHANNELS` registry and
then lower to Figma `layoutGrow = 1` on every sibling that carries it — a new channel with
cross-library blast radius that this wrap-up round cannot measure. Until then the footer pair hugs
its labels. Recorded here rather than left for the owner to find on the canvas a second time.

### A standing gap this wave made visible: ORPHANED MINTED LEAVES

A part refused by `non-painting-part` / `inert-overlay-wrapper` leaves the ANATOMY but **not the
MINT**: `enriched.extension.json.mintedTokens` still carries its leaves, and `promote-floor` writes
them into the shipped token set, where `00-tokens.figma.js` creates Figma variables nothing binds.
Measured across the recaptured corpus: **224 orphan leaves** — carbon icon-button 122 (`label` 55,
`popover-caret` 47, `popover` 10, `tooltip-trigger-wrapper` 10), carbon tabs 21, carbon toggle 19,
carbon inline-notification 20, carbon text-input 18, carbon accordion 13, carbon modal 3, carbon
checkbox 1, mui autocomplete 3, altitude avatar 4. This is PRE-EXISTING and corpus-wide (the carbon
figures are already in the committed HEAD minted tree, from the earlier live-defect round); the
recapture only made it countable. The same ordering leaves an orphan SVG behind:
`examples/mui/assets/icons/autocomplete-autocomplete-clearindicator.svg` is still written by
promote-floor and referenced by no contract. Not fixed here — moving the refusal ahead of the mint
moves every library's variable count and every golden, and that is its own round.
