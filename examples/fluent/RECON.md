# Fluent 2 (`@fluentui/react-components` v9) round — RECON (pre-capture)

**Status: RECON ONLY.** The sandbox exists and is pinned, the static pass ran,
the browser probes ran, and the capture config is a **drafted, unreviewed
proposal** — `out/capture-config.draft.json` still carries
`"__unreviewed-draft"` and all 45 `"__review:*"` markers, deliberately. This
file records the proposed answers and the reasoning; the config review gate
(docs/21 §1) decides them. **No computed capture has run.**

Library #10 of the gauntlet, and the first **CSS-in-JS with atomic class
generation** (Griffel). Every claim below that says "measured" was measured in
a real headless Chromium against the pinned sandbox. The probe host and the
five probe scripts are committed at [`probe/`](probe/) with a run recipe and a
table mapping each probe to the section it feeds — no number here is a claim
you have to take on trust.

---

## 1 · Subject and pins

**Fluent 2** — Microsoft's design system, shipped as a 65-package
`@fluentui/react-*` family behind one suite package. Styling is **Griffel**
(`@griffel/react`), a CSS-in-JS engine that inserts rules into the document at
runtime from build-time-extracted style objects. Theme tokens are CSS custom
properties, declared by `FluentProvider` **on a wrapper `<div>`** — §2.3 is the
whole point of this round.

Sandbox: `examples/fluent/.fluent-sandbox/` (git-ignored, same rule as
`.carbon-sandbox` / `.shadcn-sandbox`; this block is the source of truth).

| pin | value |
|---|---|
| `@fluentui/react-components` | **9.74.5** (the suite package) |
| `@fluentui/react-icons` | **2.0.335** |
| `@griffel/react` / `@griffel/core` | **1.7.7** / **1.21.3** (transitive — the styling engine under test) |
| `@fluentui/tokens` | **1.0.0-alpha.23** (transitive — the token source, §2.5) |
| `@fluentui/react-theme` | **9.2.1** (transitive) |
| component packages (transitive, resolved) | react-button **9.10.1** · react-badge **9.5.4** · react-avatar **9.11.4** · react-card **9.7.1** · react-message-bar **9.7.4** · react-checkbox **9.6.3** · react-switch **9.7.4** · react-input **9.8.5** · react-tabs **9.12.3** · react-tooltip **9.10.4** · react-dialog **9.18.2** · react-spinner **9.8.4** |
| infrastructure packages (transitive) | react-provider **9.22.19** · react-utilities **9.26.5** |
| react / react-dom | 19.2.4 |
| vite 8.2.1 · @vitejs/plugin-react 6.0.5 · typescript 7.0.2 · esbuild 0.27.3 | host app + the bundler the capture harness invokes |

**Version-drift note — and why this library needs a committed lockfile.** The
runner refuses drift against `library.version`, which is the SUITE package's
version (9.74.5). But Fluent is 65 packages, and the suite pins all 64 others
by **caret range**. A re-install six weeks from now resolves `react-button` to
9.11.x and the runner says nothing, because 9.74.5 has not moved. `npm i -E`
only pins the top level.

So the sandbox's lockfile is committed as
[`sandbox.package-lock.json`](sandbox.package-lock.json) (lockfileVersion 3,
183 package entries, sha256
`c3b230dfbd8abd68408fefed9c8abc0e0fd46722faf8652e16e5c038452e0536`) — the same
reasoning as the shadcn round's sha256 ledger for registry-fetched source: a
version pin that a caret range can walk out from under is not a pin. Recreate
with it in place (`cp examples/fluent/sandbox.package-lock.json
examples/fluent/.fluent-sandbox/package-lock.json && npm ci`) or accept a
**named drift**. Verify any sandbox against the table above with:

```bash
node -e "for (const p of ['react-button','react-badge','react-avatar','react-card','react-message-bar','react-checkbox','react-switch','react-input','react-tabs','react-tooltip','react-dialog','react-spinner','react-provider','react-utilities'])
  console.log(p, require('./examples/fluent/.fluent-sandbox/node_modules/@fluentui/'+p+'/package.json').version)"
```

### Recreate (the only network-touching step; everything downstream is offline)

```bash
mkdir -p examples/fluent/.fluent-sandbox && cd examples/fluent/.fluent-sandbox
printf '{"name":"fluent-sandbox","private":true,"version":"0.0.0","type":"module"}\n' > package.json
npm i -E react@19.2.4 react-dom@19.2.4 \
       @fluentui/react-components@9.74.5 @fluentui/react-icons@2.0.335
npm i -E -D vite@8.2.1 @vitejs/plugin-react@6.0.5 typescript@7.0.2 \
       @types/react@19.2.18 @types/react-dom@19.2.4 esbuild@0.27.3
# the recon probe host + the five probe scripts — committed at examples/fluent/probe/,
# NOT the capture harness (which writes its own entry from the config).
# Copy recipe + per-probe run commands: examples/fluent/probe/README.md
cd ../../.. && node examples/fluent/scripts/rehydrate-types.mjs   # §3
```

No CSS build step: Griffel ships **no stylesheet at all**. There is nothing to
`@import`, nothing to precompile, and `mount.imports` is empty (§4.1) — a first
for this corpus.

---

## 2 · What Griffel actually does — measured, not assumed

The brief's premise was "atomic class generation, one declaration per class,
so what can `classAllow` possibly mean". Half of that is right and the other
half is the interesting part.

### 2.1 Griffel emits TWO rule families, not one

Measured on the 12-component probe page: **19 `<style>` elements, 1,173
style rules**, distributed like this (histogram of declarations-per-rule):

| rule family | selector shape | count | declarations |
|---|---|---|---|
| `makeStyles` **atomic** | `.f1p3nwhy`, `.fhovq9v` … | 846 | **828 rules carry exactly ONE declaration** |
| `makeResetStyles` **reset** | `.r1f29ykk`, `.r1iycov` … | 141 | 1,449 declarations total, **max 48 in one rule** |
| the theme block | `.fui-FluentProvider_r_0_` | 1 | **459 custom properties** (§2.3) |

So Fluent's per-component *base* look is one big multi-declaration class
(`makeResetStyles`), and everything that varies by prop is atomic
(`makeStyles`). The reset class also carries its own pseudo-class and
attribute variants as separate rules on the same class name
(`.r1f29ykk:hover`, `.r1f29ykk:hover:active`, `.r1f29ykk[data-fui-focus-visible]`,
`.r1iycov::after`).

**Consequence for the capture: none.** The computed floor never reads rules to
learn what a component looks like — it reads `getComputedStyle`. The rule
families matter only to the source-binding reader (§2.5) and to `classAllow`
(§2.2).

### 2.2 `classAllow` has a real answer here — Fluent ships BEM-shaped slot classes

This is the finding that separates Fluent from every other atomic/utility
library in the corpus. Griffel's hashes are **not the only classes on the
element**. Fluent applies a stable, human-readable class per slot, exported
from the package as `<component>ClassNames` (`buttonClassNames.root ===
'fui-Button'`).

Measured across the probe page: **366 distinct classes in the document — 44
`fui-*` and 322 Griffel-generated**, with a clean separation (no Griffel hash
matches `^fui-`; the hashes are `f…`, `r…`, `___…` with no hyphens):

```
fui-Avatar  fui-Avatar__initials  fui-Badge  fui-Button  fui-Button__icon
fui-Card  fui-CardHeader  fui-CardHeader__description  fui-CardHeader__header
fui-CardPreview  fui-Checkbox  fui-Checkbox__indicator  fui-Checkbox__input
fui-Checkbox__label  fui-DialogActions  fui-DialogBody  fui-DialogContent
fui-DialogSurface  fui-DialogSurface__backdrop  fui-DialogTitle
fui-FluentProvider  fui-FluentProvider_r_0_  fui-Icon  fui-Input
fui-Input__input  fui-Label  fui-MessageBar  fui-MessageBarBody
fui-MessageBarTitle  fui-MessageBar__icon  fui-Spinner  fui-Spinner__label
fui-Spinner__spinner  fui-Spinner__spinnerTail  fui-Switch
fui-Switch__indicator  fui-Switch__input  fui-Switch__label  fui-Tab
fui-TabList  fui-Tab__content  fui-Tab__content--reserved-space  fui-Text
fui-Tooltip__content
```

Two measured facts about this list:

- **The `fui-*` classes are combo-INVARIANT.** Button `appearance=primary
  size=medium` carries **52** classes and `appearance=subtle size=small`
  carries **38**; they share exactly **16**, and the only non-atomic members of
  that intersection are `fui-Button` and the reset class `r1f29ykk`. The
  identity class does not move with the axes — which is the entire requirement
  `classAllow` exists to satisfy. (Contrast Tailwind/shadcn, where nothing on
  the element is invariant and `^$` is the only honest answer.)
- **One casualty, named:** `fui-Tab__content--reserved-space` contains `--`
  after the prefix strip, so `stems()` (`extract/computed/lib.ts:650`) drops it
  as a BEM modifier. It is not a modifier — it is a distinct slot. That part
  falls back to positional naming. Named, not fixed (§5 H7).

So Fluent's answer is **Carbon's answer, not Tailwind's**: `classAllow:
"^fui-(?!FluentProvider)"`, `classPrefix: "fui-"` (§4.1). This is the first
library in the corpus where atomic styling and named part identity coexist.

### 2.3 The token layer — and the `@scope`-trap answer, nailed

**The theme is ONE rule, on a `<div>`, injected into a `<style id="fui-FluentProvider_r_0_">`:**

```
.fui-FluentProvider_r_0_ { --borderRadiusNone: 0; --borderRadiusSmall: 2px; … --shadow64Brand: … }   /* 459 custom properties */
```

Probe, verbatim (this is the docs/21 §4.2 probe, run before any capture):

| element | `--colorNeutralForeground1` | `--borderRadiusMedium` | `--fontSizeBase300` |
|---|---|---|---|
| `document.documentElement` | **`''`** | **`''`** | **`''`** |
| `document.body` | **`''`** | — | — |
| `.fui-FluentProvider` (the wrapper div) | `#242424` | `4px` | `14px` |
| the `<button class="fui-Button">` inside it | `#242424` | — | — |

**This is the Carbon trap and the astryx-`@scope` trap in one.** Without the
provider the page renders — Griffel's rules still apply, and every `var()`
resolves to nothing, so colours fall back to the browser's initial values.
`getComputedStyle(document.documentElement)` returns the empty string for all
459. So: **`mount.wrapperOpen` MUST be `<FluentProvider theme={webLightTheme}>`,
and the round is invalid without it.**

Two mount details, both measured, both load-bearing:

- The harness wraps the **whole stage list** (`cfg.mount.wrapperOpen` sits
  outside `SPECS.map` — `capture.ts:841`), so one provider covers every combo
  and each stage's `firstElementChild` is still the component. Custom
  properties inherit, and the reader resolves them with
  `getComputedStyle(el)` on the element being captured
  (`capture.ts:1238`) — **there is no `:root` assumption anywhere in the value
  path.** An ancestor-declared token resolves normally. Verified above on the
  `fui-Button` itself.
- `FluentProvider` renders a REAL box: `display:block`, `background-color:
  var(--colorNeutralBackground1)` (white), the Fluent font stack, `dir="ltr"`.
  It is not `display:contents`. Since it wraps the stage list rather than each
  stage, it never becomes a captured root — **except in portals**, where it
  does, and that is §5 H2.

### 2.4 Token names: camelCase, no vendor prefix, and they survive the transform

Fluent's custom properties are the theme object's keys verbatim:
`--colorNeutralForeground1`, `--fontSizeBase300`, `--borderRadiusMedium`,
`--spacingHorizontalM`, `--strokeWidthThin`, `--shadow4`, `--fontFamilyBase`.
There is **no prefix**, so `varPrefix` must be `"--"` (the Tailwind/shadcn
spelling).

The reader turns a captured var name into a DTCG leaf path with exactly one
transform (`extract/computed/run.ts:563`): strip the prefix, insert `-` between
a lower/digit and a following uppercase, lowercase, prepend `tokenGroup`.
Checked against all 459 keys:

| custom property | required DTCG leaf |
|---|---|
| `--colorNeutralForeground1` | `color-neutral-foreground1` |
| `--colorNeutralForeground1Hover` | `color-neutral-foreground1-hover` |
| `--fontSizeBase300` | `font-size-base300` |
| `--spacingHorizontalM` | `spacing-horizontal-m` |
| `--shadow4Brand` | `shadow4-brand` |

**Zero collisions across all 459** (measured). The trailing digit is carried,
not split. The transform never emits a `.`, so **the DTCG tree must be FLAT**
(leaf at the file's top level) unless `library.tokenGroup` is declared, which
buys exactly one level of nesting (Polaris's `p.`). Proposal: flat, no
`tokenGroup` (§4.1) — matching carbon/mui/tailwind/shadcn.

### 2.5 The family split — measured before capture (docs/21 §4.4)

Griffel writes `var()` **at the point of use** (`tokens.colorNeutralForeground1`
is literally the string `var(--colorNeutralForeground1)`), so the CSS-vars
reader has real work to do. Measured over the 12-component page's 1,173 rules:

| measurement | count | consequence |
|---|---|---|
| declarations carrying `var()` | **798** | the reader's whole input |
| …on a **LONGHAND** property | **653 (81.8%)** | **bindable** — this is the alias story |
| …on a **SHORTHAND** property | **134 (16.8%)** | **the shorthand ceiling** — named skip, pixels right, name lost |
| …containing `calc()` | 59 | the calc ceiling applies to the non-identity ones |
| custom-property *definitions* carrying `var()` | 11 sites / **31 rules** | §5 H3 — the indirection that cannot be followed |
| distinct custom properties referenced | **293** | of which **275 are theme tokens**, 18 are component-local `--fui-*` |
| theme tokens defined but never referenced by this slice | **184** of 459 | the slice's own coverage, not a defect |

The shorthand breakdown is worth printing, because it predicts exactly which
families lose their names:

```
border-radius 41 · border 28 · border-color 22 · padding 20 · margin 6 · gap 6
border-width 5 · padding-block 3 · border-bottom 2 · outline 1
```

and the longhand winners:

```
color 155 · background-color 125 · border-{bottom,top,right,left}-color 124
font-size 24 · box-shadow 21 · line-height 20 · font-weight 16 · font-family 15
transition-duration 11 · transition-timing-function 9 · padding-{left,right} 18
```

**Read that as Carbon's family table:** colour binds (155+125+124 = 404 of the
653 longhands), typography binds, motion binds; **radius and padding largely do
not**, because `makeResetStyles` writes them as shorthands. That is the
library's own authoring shape meeting a known reader ceiling — a named
degradation, measured before the round rather than explained after it.

### 2.6 The published package ships NO source — the static pass has no input

Measured on the installed tree: **0 `.tsx` files and 0 non-`.d.ts` `.ts`
files** across all 65 `@fluentui/react-*` packages. Each package publishes
`lib/*.js` + a single api-extractor **rollup** `dist/index.d.ts`; the suite
package's rollup is a pure re-export barrel with no declarations of its own.

The react-tsx adapter's walker skips `*.d.ts` by name
(`SKIP_FILE` in `extract/adapters/react-tsx.ts:41`), so pointing it at the real
library walks **zero candidate files**. Measured:

```
$ npm run extract:code -- <config with root=node_modules/@fluentui/react-button>
Error: No components found — check code.root / code.manifest and that props are visible in source.
```

Loud, but **not diagnostic**: because no file is opened, there is no skip
ledger, no named refusal, nothing that says "this library publishes only
ambient declarations". §3 measures what the surface would be, and §5 H10 names
the engine-side remedy.

---

## 3 · Static extract — what the react-tsx adapter got

**How the input was produced.** `examples/fluent/scripts/rehydrate-types.mjs`
applies two purely mechanical rewrites to each of the 12 component packages'
rollups and writes them to the (git-ignored) sandbox as
`types-src/<Package>.tsx`:

1. `export declare const X: T;` → `export const X = React.forwardRef(() => null) as T;`
2. `declare ` → `` everywhere else

Rewrite (1) restores the exact idiom **Fluent's own source carries** —
`) as ForwardRefComponent<XProps>;`, which the enterprise gauntlet measured in
29 component files — and which `findComponents` already reads through
(`core/extract-react-tsx.ts:581-592`, the cast-unwrap that landed after that
gauntlet). Type declarations, members and JSDoc are copied byte-for-byte;
nothing about the API surface is invented. It is a **simulation**, in the same
spirit as the gauntlet's own "measured what-if", and the engine-side
alternative is H10.

**Result: 23 extracted / 23 seen-but-not-extractable (all named), 0 anatomies.**
Anatomy is a stub everywhere, as it must be — there is no CSS to read, the
styles are in JS objects the adapter does not parse.

| target | extracted as | enum axes recovered (values) | booleans | not carried |
|---|---|---|---|---|
| Button | `Button` | `appearance`(5) `iconPosition`(2) `shape`(3) `size`(3, *inferred* via the `ButtonSize` alias) | `disabled`, `disabledFocusable` | the `icon` **slot** (lives in `ButtonSlots`) |
| Badge | `Badge` | `appearance`(4) `color`(8) `iconPosition`(2) `shape`(3) `size`(6) | — | `icon` slot |
| Avatar | `Avatar` | `active`(3) `activeAppearance`(3) `shape`(2) | — | `size` (numeric union → `other`), `color` (alias → `other`), `idForColor` |
| Card | `Card` | `appearance`(4) `focusMode`(4) `orientation`(2) `size`(3) | `selected`, `defaultSelected`, `disabled` | — |
| MessageBar | `MessageBar` | `intent`(4) `politeness`(2) `shape`(2) | — | `icon`/`actions` slots |
| Checkbox | `Checkbox` | `labelPosition`(2) `shape`(2) `size`(2) | — | `checked` → `other` (**tri-state `'mixed' \| boolean`** — §4.2) |
| Switch | `Switch` | `labelPosition`(3) `size`(2) | `checked`, `defaultChecked`, `disabledFocusable` | — |
| Input | `Input` | `size`(3) `appearance`(6) `type`(12) | — | `contentBefore`/`contentAfter` slots |
| TabList / Tab | `TabList`, `Tab` | TabList `appearance`(4) `size`(3); Tab — none | TabList `vertical`, `disabled`, `reserveSelectedTabSpace`, `selectTabOnFocus`; Tab `disabled` | `selectedValue` (`TabValue` alias → `other`) |
| Tooltip | `Tooltip` | `appearance`(2) `relationship`(3) | `visible`, `withArrow` | `positioning` → `other` |
| Dialog | `Dialog` | `modalType`(3) | `open`, `defaultOpen`, `inertTrapFocus`, `unmountOnClose` | — |
| Spinner | `Spinner` | `appearance`(2) `labelPosition`(4) `size`(8) | — | — |

Three structural findings, in order of how much they cost:

**(a) The default IS in the source and the extractor drops it — so ALL 42 enum
axes are DEFAULTLESS.** Every Fluent prop documents its default in JSDoc, in
**two tag spellings** (`@default 'secondary'` on Button, `@defaultvalue medium`
on Badge — both appear in the same library). The extractor stores the whole
description block — the default is literally inside the prose it keeps — and
emits no `default` field. The drafter therefore writes a `__review:baseCombo`
for every component and pins each axis to its **first enum value**. Measured
against the JSDoc, that pin is:

| axis | first enum value (what the drafter pins) | documented default | verdict |
|---|---|---|---|
| `Button.appearance` | `secondary` | `secondary` | right, by luck |
| `Badge.appearance` | `filled` | `filled` | right, by luck |
| **`Badge.size`** | **`tiny`** | **`medium`** | **WRONG** |
| **`Avatar.active`** | **`active`** | **`unset`** | **WRONG** |
| `Avatar.activeAppearance` | `ring` | `ring` | right, by luck |

Left unreviewed, two of the twelve components capture their whole variant grid
around a base combo the library would never render. Nothing errors.
**The seeds must carry hand-transcribed defaults** (§4.2); H9 names the
engine remedy.

**(b) The 23 skips are ONE class, and it is the slot API.** 14 of 23 are
`props type "XProps" resolves only to named reference(s) [ComponentProps<XSlots>]
whose members are outside module scope — 0 readable props; skipped instead of
proposing a hollow contract` (the hollow-extraction receipt working). The
other 9 are `XContextProviderProps not found in this file`. Every casualty is
a **sub-part**: `CardHeader`, `CardPreview`, `CardFooter`, `DialogBody`,
`DialogSurface`, `DialogTitle`, `DialogContent`, `MessageBarBody`,
`MessageBarTitle`, `MessageBarActions`, `CompoundButton`, `MenuButton`,
`SplitButton`, `AvatarGroupItem`.

**(c) `ComponentProps<XSlots>` is in-file, and `XSlots` is a real declared
map.** `ButtonSlots = { root: NonNullable<Slot<ARIAButtonSlotProps<'a'>>>;
icon?: Slot<'span'> }` sits in the SAME rollup, 50 lines from `ButtonProps`.
Resolving it is not an alias hop — `ComponentProps<T>` maps slot keys to
`Slot<>` props plus native props, which needs slot-aware semantics — but the
declaration is *right there*. This is the "future slot-extraction channel" the
gauntlet named, and Fluent is the library that makes it worth building:
**a slot is exactly a contract PART**, and Fluent declares its part list in
the type system. Not proposed for this round; named as the highest-value
follow-on.

---

## 4 · Proposed capture config — answers + reasoning (markers stay until review)

`out/capture-config.draft.json` is untouched machine output: 23 components, **45
`__review:*` fields**, `"__unreviewed-draft"` in place. Two drafter defects
worth carrying forward, both observed here:

- it wrote `library.package: "ds-contracts-poc"` / `version: "1.0.0-rc.1"` —
  it reads the **repo's** `package.json`, not the sandbox's. Harmless with a
  review gate; still a wrong value presented as a detection.
- **there is no `__review:tokenGroup` and no `__review:portalCapture` marker.**
  `tokenGroup` is exactly the key a nested DTCG tree needs (§2.4), and
  `portalCapture` is the difference between capturing a Dialog and capturing
  nothing. Both are silently absent from the checklist.

(`enumeration.unsetLabel` is `"unset"` at HEAD — docs/21 §5.1's "KNOWN BUG
(drafter writes `__unset`)" is **stale**, second round in a row to observe it.)

### 4.1 The three that fail quietly

| field | proposed | reasoning |
|---|---|---|
| `library.classPrefix` | **`"fui-"`** | Fluent's stable slot classes are `fui-<Component>__<slot>`. Stripping the prefix gives `Button`, `Button__icon`, `Checkbox__indicator` — the library's own part vocabulary, exactly Carbon's shape after the class-stem prefix-order fix. |
| `library.classAllow` | **`"^fui-(?!FluentProvider)"`** | **Not `^$`.** §2.2 measured 44 identity classes cleanly separated from 322 Griffel hashes, and the identity classes are combo-invariant. Keeping them buys named parts instead of `part-0/part-1`; keeping the hashes would make every signature combo-dependent (the worst case §4.1 of docs/21 warns about). The negative lookahead drops `fui-FluentProvider` and `fui-FluentProvider_r_0_`: the provider is never component anatomy, and `_r_0_` is a React `useId` counter — stable within a page (double-run probe: **two full page loads produced byte-identical class sets**, 366/366) but an implementation counter has no business in a part signature. |
| `library.varPrefix` | **`"--"`** | Fluent's custom properties carry no vendor prefix (§2.4). `"--"` is the tailwind/shadcn spelling and makes `muiRe ≡ anyRe`. **Bind proof (recon-level, §2.3)**: `''` at `:root`, `#242424` on the provider and on the button — so the answer is inseparable from the mount, and both are verified. The browser-level probe still runs at capture time per §4.2 discipline. Cost: with `vp = "--"` every name starts with the prefix, so the reader's one-hop `defs` branch is unreachable — H3. |
| `library.tokenGroup` | **absent (flat DTCG)** | The transform can only produce a top-level leaf or one group hop. Flat matches carbon/mui/tailwind/shadcn. |
| `mount.imports` | **`["import { FluentProvider, webLightTheme } from '@fluentui/react-components';"]`** | **No stylesheet import** — Griffel injects everything at runtime. First library in the corpus with an empty CSS story. |
| `mount.wrapperOpen` / `wrapperClose` | **`<FluentProvider theme={webLightTheme}>` / `</FluentProvider>`** | §2.3. This is the whole round. It wraps the stage LIST (not each stage), renders one real `display:block` white box behind all stages, and every stage's `firstElementChild` is still the component. Verify on the review screenshot that no stage gained a wrapper box. |
| `tokens.dtcg` | `examples/fluent/tokens/fluent.dtcg.json` | built from `@fluentui/tokens`' `webLightTheme` (§4.3) |
| `tokens.css` | `examples/fluent/tokens/fluent.vars.css` | the same 459 as a `:root` block, for the bound-probe |
| `browser` / `stage` | `{viewport: 1100×1400, dsf 1, colorScheme light}` / `{width: 360, height: 120, padding: 16}` | measured boxes: Button 97×32, Badge 20×20, Avatar 48×48, Checkbox 108×32, Switch 111×36, Input 180×32, Spinner (label) 200×32. Per-component overrides: Card `{460,160}` + `blockStage`, MessageBar `{560,56}` + `blockStage`, TabList `{360,60}`, Dialog `{600,300}`. |
| `fonts` | **none obtainable — named limitation** | Fluent's font stack is `'Segoe UI', 'Segoe UI Web (West European)', -apple-system, …` and the library ships **zero `@font-face` rules** (measured: **0** across all 19 injected sheets — Griffel emits none, and nothing else does either). Segoe UI is a Windows system font, not on npm. So text metrics are fallback metrics on any non-Windows harness and pixel-AA will read low — the Carbon situation, for a different reason: Carbon's faces exist and were not configured, Fluent's do not exist to configure. Read the computed-equality number, not the pixel number, and say so in PROVENANCE. |

### 4.2 Axis-vs-state and per-component proposals

State vocabulary is closed; every prop-selected rendering is an axis. Two
Fluent-specific notes first:

- **`disabled` is a genuine state plane** and it works: Fluent styles
  `:disabled` / `[aria-disabled="true"]` — verified in the selector census
  (75 attribute selectors, 239 pseudo-class selectors).
- **`focus-visible` works, and this was not obvious.** Fluent's focus ring is
  driven by **tabster**, which sets a `data-fui-focus-visible` attribute (45
  rules key on it) rather than relying on the pseudo-class (34 rules do use
  `:focus-visible`). The capture drives focus-visible with a real
  sentinel-plus-`Tab` keypress (`capture.ts:1721-1723`), which is exactly the
  keyboard modality tabster listens for. **Measured**: after one `Tab`,
  `document.activeElement` is the button, `matches(':focus-visible')` is
  `true`, AND `data-fui-focus-visible` is present; the ring renders through the
  `::after` pseudo-element (`border-color` white over an `outline` — Fluent's
  double ring). A CDP-forced pseudo-state would have captured **nothing**;
  the real keypress captures the ring.

| component | axes (× values) | stateProps | key fixedProps / drivers | portal | composition |
|---|---|---|---|---|---|
| Button | `appearance`×5, `size`×3, `shape`×3 = 45 | `disabled` | `iconPosition` pinned `before`; **`icon` deferred by name** (a slot, not a prop — §3c) | — | text |
| Badge | `appearance`×4, `color`×8, `size`×6 = 192 | — | `shape` pinned `circular`, `iconPosition` pinned (no icon mounted) — full cartesian is 1,152, over the 512 limit; this trim keeps it exact rather than taking the pairwise certificate | — | text `"9"` |
| Avatar | `shape`×2, `active`×3, `size`×3 (`{"$props":{"size":24\|48\|96}}` — a **named 3-of-13 subset** of the numeric union) | — | `name: "Fluent Two"` (initials are deterministic); `image` slot refused by name (needs a remote src in a network-free harness) | — | none |
| Card | `appearance`×4, `size`×3, `orientation`×2 = 24 | `disabled` | `focusMode` pinned `off`; `selected` pinned false | — | `childrenSpec`: CardPreview(text) + CardHeader(header text, description text) — **CardHeader/CardPreview have no readable props (§3b), so they are composition, not components** |
| MessageBar | `intent`×4, `shape`×2 = 8 | — | `politeness` pinned | — | `childrenSpec`: MessageBarBody ⊃ MessageBarTitle + text |
| Checkbox | `checked` (ONE tri-state axis: `unchecked:{"checked":false}` / `checked:{"checked":true}` / `mixed:{"checked":"mixed"}` — the one-axis discipline, so the glyph promotes), `size`×2, `shape`×2 = 12 | `disabled` | `id: "fluent-checkbox"`, `onChange` stub, `label: "Checkbox"` | — | none (indicator is internal) |
| Switch | `checked`×2, `labelPosition`×3 = 6 | `disabled` | `id: "fluent-switch"`, `onChange` stub, `label: "Switch"` | — | thumb is a real DOM child (`fui-Switch__indicator` ⊃ `fui-Icon`) |
| Input | `appearance`×6, `size`×3 = 18 | `disabled` | `type` pinned `"text"` and **deferred by name** (12 HTML input types are not a visual axis); `placeholder: "Value"`, `defaultValue: ""` | — | none |
| TabList / Tab | `appearance`×4, `size`×3, `vertical`×2 = 24 (on **TabList**) | `disabled` | controlled `selectedValue: "tab-1"` + `onTabSelect` stub (the Carbon TabList double-run lesson, and Fluent's `selectTabOnFocus` makes it mandatory) | — | `childrenSpec`: TabList ⊃ 2 × Tab. **Tab's own axes ride the child-axis limitation (docs/21 §7.3) — pinned, deferred by name** |
| Tooltip | `appearance`×2, `withArrow`×2 | — | `openDriver: {"visible": true}`, `relationship: "label"`, `positioning: "after"` | **yes** | Trigger (Button) + content text |
| Dialog | `modalType`×3 | — | `openDriver: {"open": true}` | **yes** | `childrenSpec`: DialogSurface ⊃ DialogBody ⊃ (DialogTitle, DialogContent, DialogActions ⊃ Button) |
| Spinner | `size`×8, `appearance`×2, `labelPosition`×4 = 64 | — | `label: "Loading"`, `delay: 0` | — | none — **but see H8: the spinner ANIMATES** |

`enumeration`: `cartesianLimit: 512`, `unsetLabel: "unset"`.
**Every axis is defaultless (§3a)** — the seeds must transcribe the JSDoc
`@default` values, or `baseCombo` silently pins the first enum value and the
"default" variant on canvas is not the library's default. This is the single
most likely quiet failure of this round.

### 4.3 Tokens — the cleanest wrap in the corpus

`@fluentui/tokens@1.0.0-alpha.23` exports the theme as a plain JS object whose
**keys are the CSS custom-property names verbatim**:

- `webLightTheme` — **459 keys**; `webDarkTheme` — **459 keys, the identical
  key SET, 315 differing values**. That is the docs/22 §3 mode-corroboration
  structural test passing on the nose: → `modes/fluent.light.dtcg.json` +
  `modes/fluent.dark.dtcg.json`, Carbon-style, capture stays single-mode light.
- Families: color 366, spacing 22, font 17, shadow 12, border 11, line-height
  10, curve 9, duration 8, stroke 4.
- Value types: 455 strings, **4 numbers** (`fontWeight*` = 400/500/600/700) —
  the wrap must not assume strings.
- `tokens` (the point-of-use map) has **467** keys: the 459 plus **8
  `zIndex*`** that are referenced-but-never-defined by the theme. That is
  Fluent's version of Carbon's 80-token referenced/defined gap, and it is tiny.
- Also available and **not** wrapped for v1: `typographyStyles` (17 composite
  text styles), `teamsLight/Dark/HighContrast` themes.

Wrap: `examples/fluent/scripts/build-tokens.mjs`, retargeted from Carbon's —
with Carbon's discipline of **re-asserting the count** (459) and refusing on
drift.

### §4 addendum — review disposition

**NOT REVIEWED.** No approving session has run. `out/capture-config.draft.json`
carries `__unreviewed-draft` and all 45 markers; `loadConfig` refuses it by
name. This section is a proposal, not a decision.

---

## 5 · Hazard ledger — predicted refusal classes, defect-first

Ordered by predicted cost. H1 and H2 are the ones that decide whether this is a
config-only round; both were measured, not guessed.

- **H1 · PORTALS: Fluent does NOT flat-sibling its overlay like Radix — but
  tabster's body-level focus sentinels put Dialog and Popover in the
  MULTI-ROOT-CAPTURE class anyway. MEASURED.**
  The brief asked for this one early, so here is the baseline-diff experiment
  in full. Render an empty stage, snapshot `document.body`'s children, mount
  one overlay, snapshot again; new roots = elements not in the baseline whose
  parent IS (the exact rule at `capture.ts:2167`):

  | component | new body-level roots | what they are |
  |---|---|---|
  | Button (control) | **0** | in-stage |
  | Tooltip | **1** | `div.fui-FluentProvider[data-portal-node]` ⊃ (`div.fui-Tooltip__content`, inert `span`) |
  | Menu | **1** | same shape ⊃ (`div.fui-MenuPopover`, inert `span`) |
  | Popover | **3** | the portal div **+ 2 × `<i data-tabster-dummy>`** |
  | Dialog | **3** | the portal div ⊃ (`div.fui-DialogSurface__backdrop`, `div.fui-DialogSurface`, inert `span`) **+ 2 × `<i data-tabster-dummy>`** |

  (`probe3.mjs` diffs by tag+attributes and reports **4** for Dialog, because
  the existing `#root` gains `aria-hidden="true"` when a modal opens. The
  engine's baseline is a `Set` of element *identities*
  (`markBaselineJs`, `capture.ts:2067` — `document.querySelectorAll('*')`, so
  `<body>` itself is in it), and an element that merely gains an attribute is
  not new. The engine-rule answer is 3. Both numbers are in the probe output;
  this table reports the one the runner will act on.)

  **The good news is real and worth stating**: Fluent nests backdrop and
  surface INSIDE one portal node. Radix put Overlay and Content as flat
  siblings of `<body>` and that is why shadcn's Dialog stopped. Fluent's
  overlay structure is strictly better.

  **The refusal comes from somewhere else.** Tabster (Fluent's focus manager)
  appends its focus-trap sentinels to `document.body`, not to the portal node:
  `<i tabindex role="none" data-tabster-dummy aria-hidden="true">`, 1×1,
  `position: fixed`, transparent, no classes, no children. Two of them, one
  before and one after. Against `capture.ts:2526-2542` that is
  `portaled.length === 3` → **`MULTI-ROOT-CAPTURE refusal`, thrown, component
  stops, no contract ships** — for Dialog and Popover, and for anything else
  that traps focus (Drawer, TeachingPopover, the Menu variants that trap).

  The remedy is already argued and already implemented one scope too narrow.
  `stripInertPortalChildren` (`capture.ts:2478-2486`) tests
  `classes.length === 0 && !capturedDrawsBox(k) && k.nodes.length === 0` — the
  tabster sentinel satisfies all three, exactly. It is applied to the *children
  of the picked root*, and these are *siblings*. **Predicted engine change E1:
  apply the same predicate to the new-root list before the single-root policy,
  and receipt what it dropped.** The general rule is the one docs/22 §6 already
  states — *a focus-trap sentinel is DOM plumbing, not anatomy* — with "child
  of a portal root" widened to "appended to the document". No new judgement.

- **H2 · The captured root for EVERY Fluent overlay is the provider wrapper —
  a 900×0 white box. MEASURED.**
  Fluent re-wraps each portal in its own
  `div.fui-FluentProvider[data-portal-node]` (which is why tokens still resolve
  inside portals — nice). The portal-wrapper unwrap
  (`capture.ts:2194-2233`) refuses to descend through it on **both** of its
  tests: the wrapper has `background-color: rgb(255,255,255)` so `drawsBox` is
  true, and it has **two** element children (the surface plus tabster's inert
  `span`) so the "exactly ONE element child" test fails. Measured boxes:
  wrapper 900×0, `fui-Tooltip__content` 109×28, `fui-DialogSurface__backdrop`
  1100×1400.
  So even the single-root overlays (Tooltip, Menu) capture a **zero-area root**
  — un-screenshottable, and the real surface demoted to a child.
  **Predicted engine change E2**, two ordering/measurement facts, both general:
  (a) run the inert-child strip BEFORE the wrapper measurement (then Tooltip
  and Menu have exactly one element child); (b) a **zero-area** box paints no
  ink whatever its `background-color`, so `drawsBox` should be measured against
  the rendered rect, not the declaration. Neither is Fluent-specific; both are
  refinements of rules written for flowbite's `@floating-ui` wrapper.

- **H3 · `varPrefix: "--"` makes the one-hop indirection unreachable — and
  Fluent's Checkbox lives entirely inside it. MEASURED.**
  The reader's rule is `if (name.startsWith(vp)) push(name); else push(defs[name])`
  (`capture.ts:1266-1277`). With `vp = "--"` the first branch always wins, so a
  channel written as `border-color: var(--fui-Checkbox__indicator--borderColor)`
  yields the candidate `--fui-Checkbox__indicator--borderColor`, which is not a
  DTCG leaf → dropped, and the theme token behind it
  (`var(--colorCompoundBrandStroke)`) is never a candidate. **31 rules across
  11 local variables do exactly this**: all of Checkbox's indicator colours
  across default/hover/active/disabled (10 rules), `--fui-Card--border-radius`,
  `--fui-Spinner--strokeWidth`, `--fui-Avatar-ringWidth`,
  `--fui-Avatar-badgeGap`, `--fui-Button__icon--spacing`,
  `--fui-Tab__indicator--offset/scale`. Predict: **Checkbox mints anonymous
  literals for every colour channel** with correct pixels. No `varPrefix` value
  can fix it (Fluent's theme names share no prefix beyond `--`).
  **Predicted engine change E3 (optional for this round):** push the direct
  name AND its `defs` hop targets as candidates — value verification already
  decides between them, so adding a candidate cannot bind a wrong name.

- **H4 · The shorthand ceiling costs radius and padding by name.** 134 of 798
  `var()`-carrying declarations are shorthands (§2.5) — `border-radius` ×41,
  `border` ×28, `border-color` ×22, `padding` ×20. Each becomes a named
  `shorthandVarSkip` receipt: pixel right, name lost. Budget: **Fluent's
  alias story is a COLOUR story**, like Carbon's. Do not "fix" the reader
  mid-round; write the family table (§2.5) into PROVENANCE.

- **H5 · Overlays carry ZERO source-token facts.** `portalSweep` takes no
  `varPrefix` (standing corpus-wide defect, docs/22 §8.1, task #23). Tooltip
  and Dialog will mint anonymous literals where `--colorNeutralBackground1` has
  a perfectly good name — **even though the portal node re-declares the whole
  theme**, which makes it especially annoying here. Named, not re-litigated.

- **H6 · Griffel is runtime-injected, so there is no stylesheet to pin.**
  No `mount.imports` CSS, no build step, no `@font-face`. Two consequences:
  (a) the CSSOM is only as complete as the mounted combos — a rule for an
  unmounted variant does not exist. Harmless (we read computed values, not
  rules) but it means the §2.5 family split is a **per-slice** measurement, not
  a library-wide one, and must be labelled that way. (b) Griffel dedupes by
  content hash across mounts, so rule insertion order varies with mount order;
  the reader's "specificity is never guessed from document order" discipline
  (`run.ts`) is load-bearing here in a way it was not for precompiled CSS.

- **H7 · `fui-Tab__content--reserved-space` is dropped by the BEM modifier
  filter.** `stems()` discards any class containing `--` after the prefix
  strip. That class is a distinct SLOT, not a modifier. Predict: TabList's
  reserved-space part loses its name and aligns positionally. One part, one
  library — named, and the honest note is that the rule L1 was fixed for
  (`--` means modifier) is a Carbon convention Fluent does not share.
  Do not widen the rule for one part.

- **H8 · The Spinner animates forever, and its transform is already moving
  between samples. MEASURED — this one is not a guess.**
  `fui-Spinner__spinner` runs `animation: rb7n1on 1.5s **infinite**`, and two
  reads 300 ms apart returned
  `matrix(-0.00100531, -0.999999, …)` then `matrix(0.951766, -0.306825, …)`.
  The sweep polls to two consecutive stable samples (60 ms apart, up to 1.5 s);
  a perpetual rotation never stabilises. Predict a settle timeout or a
  double-run byte-identity failure naming a transform channel — the gate that
  is *supposed* to catch exactly this.
  The witnessed remedy is `prefers-reduced-motion`: measured **false** in this
  harness, and Fluent ships **4 rules across 2 reduced-motion media blocks**
  (plus 8 `@keyframes`) that stop the animation. Emulating reduced motion is a
  `browser` config field this corpus does not have; adding it is a **fifth
  predicted engine change (E4)** and it is general — every library with a
  spinner, skeleton or shimmer has this problem, and every one of them is
  currently uncapturable for the same reason.
  Button transitions are 0.1s — comfortably inside the probe, and the gate's
  flat 30 ms sampling (docs/21 §7.6) may still want a measured per-component
  `tolerance`, Carbon-style.

- **H9 · `@default` is dropped, so every axis is defaultless.** §3a. Not a
  refusal — a **silent wrong-base-combo** risk, which is worse. The mitigation
  is the seeds. **Predicted engine change E5 (extraction side, general):** read
  the `@default` JSDoc tag into `prop.default`. Every library that documents
  defaults in JSDoc benefits; Fluent documents all 42.

- **H10 · A `.d.ts`-only package is invisible AND unreceipted.** §2.6. The
  walker skips `*.d.ts` before anything can name them, so the only signal is
  `No components found`. **Predicted engine change E6 (extraction side,
  general):** either admit `.d.ts` (and teach `findComponents` that
  `declare const X: ForwardRefComponent<P>` names its props in the annotation —
  `propsFromComponentType(decl.type)` already exists at
  `core/extract-react-tsx.ts:590`, it is simply never reached without an
  initializer), or refuse by name: *"N `.d.ts` files skipped — this package
  publishes ambient declarations only"*. The invariant the repo claims is
  "reported, never silently dropped"; today a rollup-only library is dropped
  silently and the error blames the config.

- **H11 · Icons are clean.** `@fluentui/react-icons` renders inline SVG:
  `<svg class="fui-Icon" data-fui-icon width="1em" height="1em"
  viewBox="0 0 20 20" fill="currentColor"><path d="…"/></svg>` — a single
  `<path>`, no strokes, no `<polygon>`, colour inherited. This is the shape the
  svg-content promotion already handles (shadcn's lucide needed a `stroke`
  channel; Fluent will not). Icons are per-package React components, so the
  `{"$import": "@fluentui/react-icons#CalendarMonthRegular"}` marker works
  as-is.

- **H12 · Pseudo-element decor is everywhere, and it is v2-grammar shaped.**
  Measured `::before`/`::after` with content on: `fui-Badge::after`,
  `fui-Card::after`, `fui-Input::after` (the focus underline),
  `fui-Tab::after` (the selection indicator), `fui-Spinner__spinnerTail::before/::after`,
  `fui-MessageBarTitle::after`. All are rings/underlines — exactly what
  PSEUDO-DECOR v2 was built for (DRAWN now means *paints anything*). The one
  to watch is `fui-Tab::after`, whose offset/scale ride the local variables
  `--fui-Tab__indicator--offset` / `--scale` and are a function of
  `size × vertical` — the **two-axis decor product** that has no spelling
  (docs/22 §8.1). Predict a named refusal there.

### Per-component captureability prediction (docs/22 matrix idiom)

| component | prediction | why |
|---|---|---|
| Button | **full** | 45 combos, 4 state planes, colour binds, real `:disabled`, ring via tabster+Tab (verified). Icon slot deferred by name |
| Badge | **full** | trimmed to 192 combos; single element + `::after` ring |
| Avatar | **full, named size subset** | initials only; image slot refused (network-free) |
| Card | **good, radius anonymous** | `--fui-Card--border-radius` rides H3; container is `blockStage` |
| MessageBar | **good** | composed children, an icon per intent (4 glyphs, single-axis → promotes) |
| Checkbox | **full pixels, ZERO colour names** | H3 in full force — all indicator colours behind local vars. The tri-state glyphs should promote (one-axis discipline) |
| Switch | **full** | real-DOM thumb, `fui-Switch__indicator` ⊃ `fui-Icon`; no translate trickery observed |
| Input | **full — likely the round's best floor** | single element + `::after` underline; the shadcn precedent (93.1%) is the comparable |
| TabList | **good, two named residues** | H7 (reserved-space part) + H12 (two-axis indicator) |
| Spinner | **AT RISK — determinism** | H8: perpetual animation vs. the steady-state probe |
| Tooltip | **degraded by design, plus H2** | single portaled root (good) but the captured root is the 900×0 provider wrapper; no state planes; no source names (H5) |
| Dialog | **STOPPED as of today** | H1: 3 portaled roots → `MULTI-ROOT-CAPTURE` refusal. Ships nothing until E1 lands |

---

## 6 · Capture-phase command sequence (after config approval)

```bash
# 0 · gate: reviewer edits examples/fluent/out/capture-config.draft.json →
#     answers every "__review:*" (45), deletes each marker, deletes
#     "__unreviewed-draft", trims 23 → the 12 components, saves as
#     extract/computed/configs/fluent.json. Hand-author the 12 seed contracts
#     (examples/fluent/contracts-seed/) — INCLUDING the enum defaults
#     transcribed from the rollups' @default JSDoc tags (§3a).
# 1 · tokens (@fluentui/tokens webLightTheme/webDarkTheme → flat DTCG + modes/)
node examples/fluent/scripts/build-tokens.mjs
# 2 · bind probe BEFORE any sweep (docs/21 §4.2) — the whole round depends on it:
#     getComputedStyle(document.documentElement)['--colorNeutralForeground1']  → '' (expected)
#     getComputedStyle(document.querySelector('.fui-FluentProvider'))['--colorNeutralForeground1'] → '#242424'
# 3 · capture — full sweep, double-run byte-identity required
npm run extract:computed -- --harness examples/fluent/.fluent-sandbox \
  --config extract/computed/configs/fluent.json --out extract/computed/out/fluent
# 4 · promote (generalized verb + per-library manifest)
ds-contracts promote --config examples/fluent/ds-library.json
# 5 · emit + receipts + genesis
npx tsx packages/cli/src/cli.ts figma examples/fluent/contracts --out examples/fluent/figma \
  --tokens examples/fluent/tokens/fluent.dtcg.json,examples/fluent/tokens/fluent-minted.dtcg.json
node examples/fluent/scripts/build-figma-tokens.mjs
node examples/fluent/scripts/figma-compile-receipt.mjs
node examples/fluent/scripts/build-genesis-batch.mjs
# 6 · bundle — the ONE paste
npx tsx packages/cli/src/cli.ts figma bundle examples/fluent/contracts \
  --tokens examples/fluent/tokens/fluent.dtcg.json,examples/fluent/tokens/fluent-minted.dtcg.json \
  --modes examples/fluent/tokens/modes/fluent.light.dtcg.json,examples/fluent/tokens/modes/fluent.dark.dtcg.json \
  --name Fluent --out examples/fluent/figma/fluent.bundle.json
# 7 · gates
npm run extract:computed:scorecard -- --dir extract/computed/out/fluent \
  --config extract/computed/configs/fluent.json --write
npm run eval && npm run plugin:check && npx tsc --noEmit
```

### The engine-change prediction (the falsifiable part)

Carbon was run as the control case with a config-only prediction, and cost 1.
shadcn predicted config-only and cost 2. **This recon does NOT predict a
config-only round.** The prediction, stated so it can be scored:

| # | change | scope | why it is general, not Fluent-specific | blocks |
|---|---|---|---|---|
| **E1** | inert body-level roots are DOM plumbing — apply `stripInertPortalChildren`'s existing predicate to the new-root list before the single-root policy, with a receipt | `extract/computed/capture.ts`, ~5 lines | docs/22 §6 already states the rule for portal *children*; tabster proves the same sentinels get appended to the document instead. Any focus-manager library (tabster, focus-trap, Reach) does this | **Dialog, Popover** — hard refusal today |
| **E2** | (a) strip inert children before the wrapper measurement; (b) a zero-AREA box draws no ink regardless of `background-color` | `extract/computed/capture.ts`, ordering + one predicate | both refine the flowbite `@floating-ui` wrapper rule with facts that rule's own docstring anticipates | **all 4 overlays** — zero-area captured root |
| **E3** | the CSS-vars reader should offer BOTH the direct var name and its one-hop `defs` targets as candidates | `extract/computed/capture.ts` (in-page reader) | any library that routes theme tokens through component-local custom properties (a very common CSS-in-JS idiom) loses names whenever `varPrefix` is `"--"` | **Checkbox** colour names, 4 more components partially |
| **E4** | a `browser.reducedMotion` field (CDP `Emulation.setEmulatedMedia`) | `extract/computed/capture.ts` + config | every library with a spinner / skeleton / shimmer — a perpetual animation can never satisfy the steady-state probe | **Spinner**, if the double-run gate fires as predicted |
| **E5** | read the JSDoc `@default` / `@defaultvalue` tag into `prop.default` | `core/extract-react-tsx.ts`, extraction side | every library that documents defaults in JSDoc | not blocking — a silent wrong-base-combo risk (measured wrong on 2 of 12) |
| **E6** | admit `.d.ts` (or refuse it BY NAME) | `extract/adapters/react-tsx.ts` + `core/extract-react-tsx.ts` | every library that publishes api-extractor rollups instead of source — i.e. most enterprise systems | the static pass, entirely |

**Predicted cost: 2 engine changes (E1 + E2) — both widenings of rules this
repo has already argued in writing — to ship all 12, with a third (E4) held in
reserve for the Spinner if its double-run gate fires as H8 predicts.** E3, E5
and E6 are quality, not blockers: without them the round still ships, with
Checkbox's colour names anonymous, two seeds hand-corrected, and the static
pass run through the rehydration script.

Stated as the falsifiable bet: **7 of the 12 components (Button, Badge, Avatar,
Card, MessageBar, Switch, Input) should be config-only; TabList costs two named
residues; Spinner costs E4 or a named quarantine; the four overlays cost E1+E2
between them.** If the round lands there with every other library's committed
bytes unchanged, the generality claim survives its first CSS-in-JS atomic
library — which is the point of running it.

The falsification to watch for: **an engine change that is about Fluent rather
than about a mechanism.** Nothing in this recon predicts one.

---

## 7 · Coverage denominator (honest slice)

12 components of Fluent 2. The denominator, measured from the suite package's
rollup: **192 distinct `<component>ClassNames` exports** (one per slot-set —
a PART-level unit in docs/22 §8.3a's taxonomy, since `cardHeaderClassNames` and
`cardClassNames` both count), or **214 `*Props` exports**, across **65
`@fluentui/react-*` packages**. Published fraction: **12 / 192 = 6.3%**.

Excluded from this round by name: every data-dense organism (`DataGrid`,
`Table`, `Tree`, `Virtualizer`, `Carousel`), every overlay beyond the four
probed, `Combobox`/`Dropdown`/`TagPicker` (composed overlays), the
`unstable/` subpath, and `@fluentui/react-icons`' ~2,700 icon components.
