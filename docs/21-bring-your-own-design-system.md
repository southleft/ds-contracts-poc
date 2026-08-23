# 21 · Bring Your Own Design System

> **Path:** this is the deep recipe for **path B — code-first** ([Choose Your Path](00-choose-your-path.md)): your code, captured in a real browser, into contracts and Figma sets.

*The onboarding path for a stranger's library. Eight distinct libraries across
nine rounds have now gone through this pipeline — five styling methods —
and **not one of them was special-cased in the engine**. This page is the recipe
those rounds actually followed, written so the next one can follow it without an
engine change — and honest about the three places where it is still craft rather
than procedure. Round 8 (a shadow-DOM library) is the honest counterexample to
the "no engine change" reading of that sentence: it needed general new reader
rules — not library-specific ones — and `examples/altitude/PROVENANCE.md` says
so in its first section.*

---

## 0 · Who this is for, and what it costs

You have a component library. It might be proprietary, community, huge, or five
components in a monorepo. You want it to become contracts — and from contracts,
a real design-tool library and a governed generation catalog.

**The claim being tested here is generality**, and it has a receipt. The Carbon
round (the seventh library, `examples/carbon/PROVENANCE.md`) was deliberately
run as a *control case*: predict "config-only, zero engine changes," then count
what it actually cost. Result: **one expression changed in
`extract/computed/capture.ts`** — and that change was a real, universal bug
(`sampleText: ""` was mounting `children: ''`, which React does not treat as "no
children"), not a Carbon accommodation. Everything else Carbon needed was a
JSON config, ten seed contracts, and five per-library scripts. *(One of those
five — the promote script — has since been generalized into `ds-contracts
promote` + a per-library manifest, so a new library today copies four; §2.6.)*

*(This page is the **how**. For the **evidence** behind the generality claim —
the metric that would falsify it, and the places where it is not true today —
see [docs/22 — Generality](22-generality.md).)*

So the honest framing:

| | |
|---|---|
| **Engine code you write** | none — if your library is React and ships either static CSS or runtime styling |
| **JSON you write** | one capture config + one seed contract per component |
| **Scripts you copy** | four, from `examples/carbon/scripts/` — token wrap, receipt, genesis, and (optionally) a per-library gate. **Promote is no longer one of them**: it is `ds-contracts promote`, driven by the `ds-library.json` manifest (§2.6) |
| **Time** | the recon and the config are the cost. Budget hours, not minutes; the capture itself is machine time |
| **The part that is still craft** | `classAllow`, `varPrefix`, and axis-vs-state — §4. A wrong answer on any of the three fails *quietly* |

### Two routes in

There are two doors into this repo, and choosing wrong wastes a day.

| Your library ships… | Route | Effort |
|---|---|---|
| static CSS (CSS Modules, plain classes) or a Custom Elements Manifest | **the static path** — [docs/13](13-try-it-with-your-system.md), `npx @ds-contracts/cli extract` | minutes; no browser |
| runtime styling (Emotion, StyleX, Tailwind utilities, compiled-CSS-with-theme-scopes) | **the computed-capture floor** — this page | hours |

The computed floor renders your real package in a pinned headless Chromium and
takes the **browser's computed truth** as the contract. It is styling-agnostic
by construction: it never parses your CSS to know what a component looks like.
What it *does* parse your CSS for is **names** — which is the entire subject of
§4.2.

---

## 1 · Start here: `ds-contracts onboard`

The whole pipeline is one command, in **two phases with a human acknowledgement
between them**.

```bash
# PHASE 1 — detect the adapter and styling, create or reuse a sandbox, seed
# contracts from the static pass, DRAFT the capture config. Then STOP.
ds-contracts onboard @acme/ui

# …review the drafted config (§4 is the whole subject), then:

# PHASE 2 — capture → promote → emit → bundle → publish, without stopping.
ds-contracts onboard --continue --channel-key $DS_CONTRACTS_CHANNEL_KEY
```

The designer clicks **Check for updates** in the plugin. **No JSON touches a
clipboard.**

### Why it stops in the middle

Because there is exactly one decision in this pipeline a machine cannot make,
and getting it wrong does not produce an error — it produces a **confident
wrong contract**. `classAllow`, `varPrefix` and the mount recipe are §4's whole
subject, and phase 1 prints them with the value the config carries and one line
on how each one fails:

```
⏸  STOPPED at the review gate — .ds-contracts/onboard/capture-config.json is an UNREVIEWED DRAFT.

   There is no flag that skips this, and that is deliberate. The three fields
   below cannot be inferred from source, and a wrong answer on any of them does
   not error — it produces a CONFIDENT WRONG CONTRACT (docs/21 §4).

   THE THREE THAT FAIL QUIETLY
   · library.classAllow = (absent)
       which CSS classes survive into a part SIGNATURE. Too loose on a hashed/atomic
       system (StyleX, Tailwind) and every combo looks like a different element, so the
       anatomy union explodes; too tight and two genuinely different parts collapse into
       one. Absent = keep every class (the CSS-Modules behaviour).
   · library.varPrefix = (absent)
       the custom-property prefix the CSS-vars source reader follows to learn the NAME of
       the token a channel binds. Absent = reader off: the pixels stay correct and the
       token names degrade to anonymous literals — a silent loss of semantics, not an error.
   · mount.wrapperOpen = ""
       the mount recipe wrapped around EVERY stage — the theme provider / locale wrapper
       the library needs to render at all. Wrong here and you capture an unthemed component
       that still renders, which is the worst kind of wrong: it looks like a result.

   ⚠  1 COMPONENT(S) MAY CAPTURE THEIR TRIGGER INSTEAD OF THEMSELVES
   · Popover
       Popover declares `active`, `activator` but the config drives no open state (no
       openDriver, no portalCapture, and fixedProps sets none of them). If this component
       renders its activator when closed, the capture will measure the ACTIVATOR and report
       success. Check the review screenshot before continuing.

   1. Open …/capture-config.json, answer every "__review:*" field, delete each marker.
   2. Delete the top-level "__unreviewed-draft" key. That deletion IS the acknowledgement.
   3. ds-contracts onboard --continue
```

`--continue` re-checks that gate **before anything else**, including when you
resume a later stage with `--from bundle`. There is no `--yes`.

### The fourth thing that fails quietly — and it is not a config field

A component that needs a **trigger** or an **open state** — Popover, Dropdown,
Menu, Tooltip — renders its *activator* when it is closed. Point the capture at
one with nothing driving it open and the sweep measures the activator, finishes
cleanly, and mints a contract describing a button. **Nothing errors.**

Two things stand in the way, and it is worth knowing which is which:

- **The advisory above** is a *warning*, printed before a browser starts,
  whenever a queued component's own prop surface declares `open` / `active` /
  `activator` and your config drives none of them. It can be wrong in both
  directions — a component may legitimately be captured closed (MUI's Accordion
  is), and a component whose disclosure prop is named something unconventional
  will not be flagged.
- **`mount-collision`** is a *hard stop* at the end of the run: two different
  components cannot render the same DOM with the same styles, so if two do, the
  run names both and exits non-zero. Nothing is published. Note the shape of
  its blind spot — it only fires when the thing that got mounted instead is
  **also a component in your config**.

The fix is a `openDriver` (and usually `portalCapture`) on that component's
config entry:

```json
{ "name": "Popover", "portalCapture": true, "openDriver": { "active": true } }
```

If `mount-collision` fires on two components that genuinely *are* the same
component under two exported names, the right answer is to remove one from the
config — not to relax the check.

### The per-library manifest

Everything `onboard` needs about a library lives in one file,
`ds-library.json` — see [`examples/carbon/ds-library.json`](../examples/carbon/ds-library.json).
Phase 1 writes one; a directory that already has one is **adopted** instead of
re-detected, which is also what a second `onboard` run does:

```bash
ds-contracts onboard examples/carbon      # adopts the manifest, gates on review
ds-contracts onboard --continue           # capture → … → publish
```

The manifest is also the input to the promote verb on its own:

```bash
ds-contracts promote --config examples/carbon/ds-library.json
```

### What it prints, and what it refuses

One progress line per stage, then a summary naming what was produced *and what
was refused* — state previews the referee rejected, components the capture
**quarantined** (a quarantined component ships no contract, drops out of the
bundle, and the exit status is non-zero because a quarantine is a defect, not a
waiver), and whether the publish actually happened.

Two things worth knowing before you run it:

- **Capture is one sweep for the whole library** unless you narrow it with
  `--components`. That is not only faster — the runner's read-boundary frontier
  receipts are collected *across* the components of a run and written into every
  component's `LEDGER.md` and `enriched.extension.json`, so a narrowed run and a
  whole-library run produce **different bytes** for the same component. Narrowing
  is fine for iteration; the artifacts you commit should come from a full sweep.
- **`--from <stage>`** resumes over artifacts that already exist (`capture`,
  `promote`, `emit`, `bundle`, `publish`) so a failed bundle does not cost
  another browser run. It is not a way past the review gate.

---

## 1b · The recipe, at a glance — what `onboard` does for you

Nine steps. Every one of them is a real command from a committed PROVENANCE
file; §2 gives them verbatim. **You do not have to run these by hand** —
`onboard` runs them in order — but when something goes wrong, this is the
sequence you are debugging.

| # | Step | Artifact it produces |
|---|---|---|
| 1 | **Sandbox** — pin the exact package version, offline thereafter | `examples/<lib>/.<lib>-sandbox/` (git-ignored) |
| 2 | **Tokens** — wrap the library's own token source as DTCG | `examples/<lib>/tokens/<lib>.dtcg.json` + `modes/` |
| 3 | **Capture config** — the mount recipe + per-component axis vocabulary | `extract/computed/configs/<lib>.json` |
| 4 | **Seed contracts** — the prop space the capture enumerates against | `examples/<lib>/contracts-seed/*.contract.json` |
| 5 | **Capture** — headless Chromium sweep, double-run byte-identity self-check | `extract/computed/out/<lib>/<comp>/` |
| 6 | **Promote** — fuse captured truth into contracts, alias minted leaves | `examples/<lib>/contracts/*.contract.json` |
| 7 | **Emit + receipt** — Figma sync scripts, token sync, compile receipt, genesis batch | `examples/<lib>/figma/`, `receipts/` |
| 8 | **Bundle** — the ONE JSON a user pastes | `examples/<lib>/figma/<lib>.bundle.json` |
| 9 | **Gates** — scorecard, drift check, `npm run eval`, `npm run plugin:check` | numbers you can defend |

Before step 1, do a **recon**: read the library's compiled stylesheet or theme
package and answer §4's three questions on paper. Carbon's recon was wrong about
three things and the library corrected it (a `size` axis the recon thought did
not exist; a `type` enum that turned out to be a boolean on a *child*; an
accordion `open` that lives on the item, not the root). Expect to be corrected —
the point of the recon is to be corrected cheaply.

---

## 2 · The steps, with the real commands

The commands below are Carbon's, verbatim from
[`examples/carbon/PROVENANCE.md`](../examples/carbon/PROVENANCE.md). Swap
`carbon` for your library name.

### 2.1 Sandbox — pin, then go offline

```bash
mkdir -p examples/carbon/.carbon-sandbox && cd examples/carbon/.carbon-sandbox \
  && printf '{"name":"carbon-sandbox","private":true}\n' > package.json \
  && IBM_TELEMETRY_DISABLED=true npm i @carbon/react@1.112.0 @carbon/styles@1.111.0 \
       @carbon/themes@11.77.0 @carbon/icons-react react@19 react-dom@19 esbuild
```

Three rules, each learned the hard way:

- **Pin exact versions.** The capture runner refuses version drift against
  `library.version` by name.
- **The sandbox is the only network-touching step.** Everything downstream must
  be a pure function of it. `IBM_TELEMETRY_DISABLED=true` is not cosmetic —
  `@carbon/react` ships a postinstall that phones home, and an install that
  phones home is not a reproducible pin.
- **The sandbox is git-ignored.** The PROVENANCE file's recreate block *is* the
  sandbox's source of truth.

If your library needs a CSS build (Tailwind), that build belongs in this step
and must itself be deterministic — see the Tailwind recreate block in
[`examples/tailwind/PROVENANCE.md`](../examples/tailwind/PROVENANCE.md).

### 2.2 Tokens — wrap the library's own token source

```bash
node examples/carbon/scripts/build-tokens.mjs   # compiled CSS → 339-token DTCG + Light/Dark modes
```

Copy `examples/carbon/scripts/build-tokens.mjs` and retarget it. The two rules
that matter:

**Parse the artifact your components actually reference, not the prettiest
one.** Carbon ships `@carbon/themes` (a JS package with camelCase keys:
`layer01`, `textPrimary`) *and* a compiled `styles.css` whose custom properties
are kebab-and-numbered (`--cds-layer-01`, `--cds-text-primary`). A
camelCase→kebab guess mismatches every numbered token, and **a token that does
not match by name binds nothing** — silently. The wrap parses the compiled CSS.

**Re-assert the counts you wrote the script against.** Carbon's wrap hard-codes
the declaration counts of the `.cds--white` / `.cds--g100` blocks and *refuses*
if a version bump moves them. A token wrap that silently shrinks is the worst
failure mode in this pipeline, because every downstream number still looks fine.

Excluded-by-name matters too: Carbon's other `:root` blocks are the responsive
grid cascade (`--cds-grid-columns` redeclared per breakpoint) — a media-varying
value with no single truth, so it is excluded *by name in a comment*, not
quietly dropped.

### 2.3 · 2.4 Capture config + seed contracts

The config is `extract/computed/configs/<lib>.json` — the full field reference
is §3, the judgement calls are §4, and the assisted draft path is §5.

Seed contracts are minimal: they carry the **prop space** (props, enum values,
defaults) the capture enumerates against. The capture tool *never re-derives
your API* — it reads it from the contract. If your library goes through the
static path first (`npm run extract:code`), those proposals are your seeds.

### 2.5 Capture

```bash
npm run extract:computed -- --harness examples/carbon/.carbon-sandbox \
  --config extract/computed/configs/carbon.json --component Button \
  --out extract/computed/out/carbon
```

Run it per component. Each run:

- mounts every enumerated combo on a shared census page (or a two-phase
  baseline-diff page for `portalCapture` components),
- reads the browser's **full longhand enumeration** — no whitelist,
- drives the state planes (hover / active / focus-visible / disabled),
- and **runs the whole sweep twice and asserts byte-identity**. This
  double-run self-check is not optional and is the single most valuable gate in
  the pipeline: it catches uncontrolled component state, random ids, and
  animation sampling before any of them reach a contract.

Output lands in `extract/computed/out/<lib>/<comp>/`: `captured-truth.json`,
`source-bindings.json` (the library's own stylesheet naming the token each
channel binds), `scorecard.json` (the fidelity gate), and
`enriched.extension.json` (every named refusal).

### 2.6 Promote

```bash
ds-contracts promote --config examples/carbon/ds-library.json
# (examples/carbon/scripts/promote-floor.mjs is a shim over the same module)
```

Promotion **used to be** the one step with no CLI verb: six near-identical
copies of a ~450-line script under `examples/*/scripts/`, which is why the
class-stem join fix (task #25) landed in Carbon's copy and stayed latent in the
other five. The pipeline now lives once in
[`packages/cli/src/promote.ts`](../packages/cli/src/promote.ts), driven by the
per-library `ds-library.json`. Carbon, MUI, Tailwind and Altitude go through
it and reproduce their committed artifacts **byte-for-byte** (the
`promote-generalization` eval case re-promotes all four and compares every
file). Two libraries keep their own scripts, by name:

| Library | Why it is not generalized |
|---|---|
| `polaris` | a different generation — contract version 0.3.2, no source-alias pass, bespoke per-component provenance prose, `ContractSchema.parse` enforcement, and un-namespaced capture out dirs |
| `astryx` | its re-anchoring decisions ledger must be re-applied *after* the mint merge or promotion silently reverts acked aliases — and it refuses at HEAD on a stale ledger row (task #43) |

It fuses captured truth into
the seed contracts, runs the **source-alias pass** (a minted leaf whose covering
combos all agree on one source token, and whose minted value equals that token's
DTCG value, becomes a DTCG alias to it — value-verified twice, so aliasing can
never move a pixel), and probes `bindings.figma.statePreviews` against the real referee.

Refusals here are the product working. Carbon's Checkbox and IconButton were
**refused state previews by name** ("state declares no token overrides, so its
preview variant would render identically to Default"); the refusal is printed,
not worked around.

### 2.7 Emit + receipt

```bash
npx tsx packages/cli/src/cli.ts figma examples/carbon/contracts --out examples/carbon/figma \
  --tokens examples/carbon/tokens/carbon.dtcg.json,examples/carbon/tokens/carbon-minted.dtcg.json
node examples/carbon/scripts/build-figma-tokens.mjs
node examples/carbon/scripts/figma-compile-receipt.mjs
node examples/carbon/scripts/build-genesis-batch.mjs
```

The compile receipt proves each emitted script two ways: a **referee** (the
emitted payload's set identity and variant-grid size are computed *from the
contract*, never hardcoded) and a **headless execute** (the script runs in a VM
against a mocked Figma global and must not throw). The genesis batch refuses to
write a batch it cannot run.

### 2.8 Bundle — the one paste

```bash
npx tsx packages/cli/src/cli.ts figma bundle examples/carbon/contracts \
  --tokens examples/carbon/tokens/carbon.dtcg.json,examples/carbon/tokens/carbon-minted.dtcg.json \
  --modes examples/carbon/tokens/modes/carbon.light.dtcg.json,examples/carbon/tokens/modes/carbon.dark.dtcg.json \
  --name Carbon --out examples/carbon/figma/carbon.bundle.json
```

This is the artifact a stranger consumes: **contracts + token set in one
self-contained JSON**, pasted into the plugin's Build tab. Deterministic —
same inputs, identical bytes.

### 2.9 Gates

```bash
npm run extract:computed:scorecard -- --dir extract/computed/out/carbon \
  --config extract/computed/configs/carbon.json --write
npm run eval           # the machinery's own suite
npm run plugin:check   # the plugin engine against the mocked canvas
npx tsc --noEmit
```

The scorecard is the number you defend in a review: per-component computed
equality, weighted by cells, plus **components counted as unmeasurable by
name** rather than folded into an average.

---

## 3 · The capture config, field by field

Source of truth: the `CaptureConfig` / `ComponentConfig` interfaces in
[`extract/computed/capture.ts`](../extract/computed/capture.ts). Worked
examples: the 10 committed capture configs in `extract/computed/configs/`
(`carbon`, `mui`, `tailwind`, `astryx`, `polaris`, `polaris-depth`, `altitude`,
`shadcn`, `fluent`)
— read the one whose styling method is closest to yours before writing a line
of your own.

Any key starting with `__` is ignored by the loader. Every committed config uses
`"__note"` to carry the round's reasoning **inline, next to the decision** —
copy that habit; it is why the Carbon config is readable a month later.

### 3.1 Top level

| Field | Required | What it's for | Real example |
|---|---|---|---|
| `library.package` | ✅ | npm name mounted from the harness | `"@carbon/react"` |
| `library.version` | ✅ | exact pin; the runner refuses drift | `"1.112.0"` |
| `library.framework` | ✅ | `"react"` (the only value today) | `"react"` |
| `library.classPrefix` | ✅ | class prefix stripped when naming parts/signatures; `""` keeps full names | `"cds--"`, `"Polaris-"` |
| `library.classAllow` | ⚠️ | regex of classes **kept** in captured signatures. Absent = keep everything. **See §4.1** | `"^cds--(?!.*--)"`, `"^astryx-"`, `"^$"` |
| `library.varPrefix` | ⚠️ | custom-property prefix the CSS-vars source reader follows. Absent = reader off: pixels stay right, token *names* degrade to literals. **See §4.2** | `"--cds-"`, `"--mui-"`, `"--"` |
| `mount.imports[]` | ✅ | raw import lines emitted into the harness entry (stylesheet, providers) | `["import '@carbon/styles/css/styles.css';", "import { Theme } from '@carbon/react';"]` |
| `mount.wrapperOpen` / `wrapperClose` | ✅ (may be `""`) | JSX wrapped around **every** stage | `"<Theme theme=\"white\">"` / `"</Theme>"` |
| `tokens.dtcg[]` | ✅ | DTCG files the bound-probe and the fidelity gate resolve against | `["examples/carbon/tokens/carbon.dtcg.json"]` |
| `tokens.css` | ✅ | the stylesheet defining those tokens as custom properties | `"examples/carbon/tokens/carbon.vars.css"` |
| `tokens.minted` | ⚠️ strongly | the library's **shipped** minted tree from a previous round. Omit it and the gate scores your shipped contract against an inventory it was never promoted against — the score falls silently. A declared-but-missing path is refused at load | `"examples/carbon/tokens/carbon-minted.dtcg.json"` |
| `icons` | optional | dir of committed `<name>.svg` for contracts whose anatomy carries `icon.asset` refs | `"examples/polaris/assets"` |
| `browser` | ✅ | `viewport`, `deviceScaleFactor`, `colorScheme` — the environment pin | `{ "viewport": {"width":900,"height":1000}, "deviceScaleFactor": 1, "colorScheme": "light" }` |
| `stage` | ✅ | default per-combo stage box | `{ "width": 320, "height": 96, "padding": 16 }` |
| `enumeration.cartesianLimit` | ✅ | full cartesian product up to this many combos; above it, per-axis + pairwise with a certificate | `512` |
| `enumeration.unsetLabel` | ✅ | pseudo-value prepended to a **defaultless** enum axis. **Must be `"unset"`, not the drafter's `"__unset"` — see §5.1** | `"unset"` |
| `components[]` | ✅ | §3.2 | |

**Landing with the web-components round (in flight — check the interface before
relying on these):** `library.customElements` (mount `importName` as a *tag
name* via `React.createElement('al-button', …)` so props ride through as
attributes, with `false` booleans omitted rather than rendered as `="false"` —
Lit reads attribute *presence*); `mount.headStyles[]` (stylesheets inlined into
`<head>` as `<style id="…">` **before** the bundle runs, for libraries whose
global theme sheet is discovered by DOM id at element-upgrade time — `@import`
rules are always stripped, since the harness is network-free); and
`mount.preScript[]` (raw statements in an inline `<script>` before the module
bundle evaluates, for a global flag the library reads at import time). None of
these can be expressed as an `imports` line, because ES imports hoist above any
statement that would set them up.

### 3.2 Per component

| Field | What it's for | Real example |
|---|---|---|
| `name` | display name; also the capture output dir (lowercased) | `"InlineNotification"` |
| `importName` | the named export mounted from `library.package` | `"InlineNotification"` |
| `contract` | repo-relative seed contract — **the prop space**, never re-derived from the library | `"examples/carbon/contracts-seed/tag.contract.json"` |
| `sampleText` | deterministic `children`. `""` means **no children** (not the empty string — that distinction is the Carbon engine fix) | `"Button"`, `""` |
| `axes[]` | enum props that ENUMERATE as variant axes. Every other prop is held at its default and receipted | `["kind", "size"]` |
| `axisValueMap` | contract-side axis value → the library value mounted for it. `{"$props": {…}}` mounts *several* library props for one axis value | `{"contrast": {"high": {"$props": {"lowContrast": false}}, "low": {"$props": {"lowContrast": true}}}}` |
| `stateProps[]` | boolean props driven as **pseudo-class planes**. `state` is a closed vocabulary (`hover`, `active`, `focus-visible`, `disabled`) — out-of-vocabulary is refused by name. **See §4.3** | `[{"prop": "disabled", "state": "disabled"}]` |
| `presenceProps[]` | structure-creating optional props (a prop whose *presence* creates DOM: `onDismiss` → a dismiss button). Enumerated as a 2-value `off`/`on` axis and promoted as a boolean prop with `visibleWhen`-gated parts | `[{"prop":"dismissible","libraryProp":"onDismiss","value":{"$callback":true}}]` |
| `fixedProps` | props pinned to fixed values on **every** mount. Scalars, arrays, objects, and markers | `{"id":"carbon-toggle","labelText":"Toggle","size":"md"}` |
| `callbackProps[]` | function props the library requires at mount; each stubbed to `() => {}` | `["onChange"]` |
| `childWrap` | the library's canonical **single** child composition (`<Card><CardContent>text</CardContent></Card>`). Mutually exclusive with `childrenSpec` | `{"importName": "CardContent"}` |
| `childrenSpec[]` | the canonical **multi/nested** child composition; recurses, marker grammar resolved at every depth. A node is a text leaf **or** a composition, never both (refused at load) | Carbon Tabs: `TabList` ⊃ 3 × `Tab`, `TabPanels` ⊃ 3 × `TabPanel` |
| `blockStage` | mount the stage as a block formatting context instead of the default flex row — needed for `display:block` roots, which otherwise shrink-to-fit | `true` |
| `stage` | per-component stage override (taller stages for accordions, wider for notifications) | `{"width":460,"height":140,"padding":16}` |
| `baseCombo` | override the base-combo axis values (defaults to each axis prop's contract default) | rarely needed |
| `triage[]` | named-cause triage for binding contradictions: `{part, channels[], when?, cause}`. **A mismatch without a committed named cause is a defect** | see `mui.json` |
| `portalCapture` | capture through the whole-document baseline-diff reader instead of the in-stage read. Required for anything that portals, and for full-bleed overlays that would paint over the shared census page | `true` (Modal, Dialog, Menu, Tooltip) |
| `openDriver` | the props that drive a `portalCapture` component into its rendered state at mount | `{"open": true}` |

### 3.3 The marker grammar

Config is pure JSON, but three mounts need values JSON cannot spell. The
grammar is resolved in the harness entry, at every depth of `childrenSpec`,
and every referenced export is imported automatically.

| Marker | Mounts | Use it for |
|---|---|---|
| `{"$callback": true}` | `() => {}` | required handlers, presence props |
| `{"$import": "pkg#Export"}` | the named import itself | icon components (`{"$import":"@carbon/icons-react#Add"}`) |
| `{"$render": "pkg#Export"}` | `(params) => <Export {...params} />` | render props — **the only function shape the vocabulary admits** (MUI Autocomplete's `renderInput`). Anything richer is a named refusal, never config |
| `{"$props": {…}}` | several library props for one axis value | tri-state spelled as two booleans (`checked` + `indeterminate`) |

---

## 4 · The decision guide — the part that is still craft

Three questions decide whether your round succeeds. Each of them **fails
quietly** when answered wrong, which is exactly why they get a section instead
of a table row.

### 4.1 Choosing `classAllow`

`classAllow` is a regex; classes that do not match are dropped from captured
signatures. Its job: **keep the classes that identify a part, drop the classes
that vary per combo.** If a modifier class survives, every part signature
becomes axis-dependent, parts stop aligning across combos, and the fusion
either explodes the anatomy or refuses.

The four committed answers, and the reasoning behind each:

| Library | `classAllow` | Why |
|---|---|---|
| **Carbon** (BEM) | `^cds--(?!.*--)` | One rule, because Carbon is disciplined BEM. `cds--checkbox-label-text` and `cds--inline-notification__title` are ELEMENTS (single `--` prefix) and stay; `cds--btn--primary`, `cds--layout--size-md`, `cds--inline-notification--error` are MODIFIERS (a second `--`) and go. The negative lookahead `(?!.*--)` says exactly that: no *second* `--` anywhere |
| **Astryx** (StyleX) | `^astryx-` | Hashed atomic classes (`x1a2b3c…`) carry no identity at all; the one stable per-component class is the identity that matters |
| **Tailwind** (utilities) | `^$` | Every class is a modifier. Keep **none** — utility class names are pure styling, and the geometry/computed read carries the truth |
| **MUI** (Emotion) | a stack of enumerated negative lookaheads on `Mui` | MUI has no single naming rule. `MuiButton-root` is identity; `MuiButton-containedPrimary`, `-sizeSmall`, `-paperWidthSm`, `-directionAsc`, `-rounded` are per-axis. Each was found, named, and excluded individually |

**The method:** capture one component with `classAllow` absent, open
`captured-truth.json`, and diff the class lists between two combos on the same
axis. Every class that differs is a modifier. If a single rule separates them,
write the rule (Carbon). If not, enumerate (MUI) — an enumerated list is honest;
a too-clever regex that accidentally drops an identity class is not.

**How it fails:** silently. A surviving modifier shows up as parts that refuse
to align, or an anatomy whose part count changes per combo. If your fusion
output looks combinatorially weird, suspect `classAllow` first.

### 4.2 Finding `varPrefix` — and proving it binds

`varPrefix` turns on the CSS-vars **source reader**: the capture walks CSSOM for
rules matching your components, follows **one** indirection hop, and records
every candidate `(customProperty, resolvedValue)` per channel. Node keeps a
candidate only when its resolved value **equals the captured computed value**
(specificity is never guessed from document order) and the kebab-cased name
exists as a DTCG leaf. That is how anonymous captured pixels become *your token
names*.

Finding it is usually easy — open the compiled stylesheet and look at what
`var()` references are spelled as (`--cds-`, `--mui-`, and for Tailwind v4
simply `--`, because v4 is already a CSS-variables system).

**Proving it binds is the part people skip, and it is the single most expensive
mistake in this pipeline.** The Carbon lesson, in full:

> Carbon's themes are **class scopes** (`.cds--white`, `.cds--g100`), never
> `:root`. Without a `<Theme>` mount wrapper the page still renders
> **pixel-perfect**, because every `var()` in Carbon's compiled CSS carries a
> literal fallback. But every custom property resolves to the empty string at
> `:root`, so the reader verifies **zero candidates** and the round yields
> **zero source facts, in complete silence.** Your screenshots look right. Your
> percentages look right. Every token name is gone.

So, before any capture, run the probe:

```js
// in the harness page, or a scratch Playwright script
getComputedStyle(document.documentElement)['--cds-layer-01']   // '' → NOT bound at :root
// inside the wrapper:
getComputedStyle(document.querySelector('.cds--white'))['--cds-layer-01']  // '#f4f4f4' → bound
```

If the value is empty at the root, your `mount.wrapperOpen` is missing a
provider or theme scope. **A non-empty `source-bindings.json` is the receipt
that `varPrefix` is real.** Check the fact count on a component you know is
colorful; compare against another component in the same library. (That
comparison is exactly what exposed the standing portal defect — §6.)

Other smoke probes worth running before capture, all from the Carbon round:

- `matchMedia('(any-hover: hover)')` — Carbon wraps *all* hover styling in
  `@media (any-hover: hover)`. A `false` here would make every hover delta
  vanish silently. (It is `true` in headless Chromium; no Playwright lever was
  needed.)
- **Fonts.** `document.fonts.check('16px "IBM Plex Sans"')` returns `true` — and
  so does the same probe for a font that is certainly not installed, because
  `fonts.check` reports "can this text be rendered", which fallback always
  satisfies. If your library's `@font-face` sources are remote URLs and the
  harness is network-free, **your webfont is not loaded by default** and your
  text metrics are fallback metrics. If the real font files are obtainable
  from a committed or sandboxed source (many ship on npm — IBM Plex does),
  declare them in the config's `fonts` field (docs/23 §C.5): each face is
  inlined as a `data:` URI, still zero network. Where they are not
  obtainable, record it; do not work around it.
- **Reduced motion / transitions.** Check that your library's transition
  durations are shorter than the capture's steady-state probe (two consecutive
  stable samples at 60 ms, up to 1.5 s). Carbon's 240 ms modal animation is
  comfortably inside it; a 2 s animation would not be.

### 4.3 Axis or state? — the checked-is-an-axis doctrine

This one has a rule, and the rule is enforced by the loader:

> **A state is a pseudo-class plane the same instance takes without any prop
> changing. A rendering that a prop selects is a variant axis.**

`stateProps[].state` is a **closed vocabulary** (`hover`, `active`,
`focus-visible`, `disabled`) and `loadConfig` refuses anything else *by name*.
That refusal exists because of a real, silent data loss: MUI's Switch declared
`checked` as a `stateProp`, which minted channel names like
`background-color-state-checked` that the mint-property parser could not re-read
and **no emitter rendered**. The value was captured, minted into the DTCG tree,
and dropped on the floor — silently. Flowbite's ToggleSwitch had the same bug.

Both are now axes:

```jsonc
{
  "axes": ["sizing", "checked"],
  "axisValueMap": { "checked": { "unchecked": false, "checked": true } }
}
```

…and the delta becomes an ordinary per-axis base-plane fact that the emitters
render, plus a real `Checked` variant on canvas.

Practical test: **can two instances differ in this at the same moment, with
different props?** If yes → axis. Carbon's `toggled`, `lowContrast`, Checkbox's
tri-state `checked/indeterminate` — all axes. `disabled` is the borderline one
and it lives in the state vocabulary because it is also a real pseudo-class
(`:disabled`) with its own token plane.

**One-axis discipline.** When one library concept is spelled as several library
props (MUI's checkbox tri-state = `checked` + `indeterminate`), model it as
**one** contract axis with `{"$props": …}` values. This is not cosmetic: the
svg-content promotion carries per-value icon assets only when the markup is a
function of exactly one axis (`svg-content-multi-axis` refusal otherwise), so a
two-axis spelling would have silently lost all three checkbox glyphs.

### 4.4 When your tokens don't bind — name the split, degrade honestly

Some of your channels will not resolve to a token name, and the right response
is a **measurement**, not a shrug. Carbon's, verbatim, is the model:

> Measured on the compiled CSS: **336 distinct `--cds-*` referenced, 366
> defined, 80 referenced-but-never-defined.**
>
> | family | custom properties? | consequence |
> |---|---|---|
> | colour / border / focus | yes, defined | these BIND — almost the entire alias story |
> | TYPE (`heading-*`, `body-*`, `label-*`, …) | referenced, **never defined** (77 of the 80 — a Sass opt-in the compiled CSS does not emit) | minted literals |
> | `popover-*` | referenced, never defined (the other 3) | minted literals |
> | SPACING | **0 defined** — the utilities carry literal `rem` | minted literals |
> | MOTION | **0 defined** | minted literals |

With that table in hand, Carbon's "94 source aliases vs 987 kept literals" (the promote round's receipt, `examples/carbon/PROVENANCE.md`; a later dedupe round shrank the shipped minted tree to 868 leaves — the *ratio* is the point, and it barely moved) reads
correctly: **not a reader shortfall — the library's own shape.** Without it, the
same number reads as a broken extraction, and someone spends a week "fixing" a
reader that is working perfectly.

So: run the count (`grep -o '\-\-yourprefix-[a-z0-9-]*'` over your compiled CSS,
referenced vs defined), write the family table into your PROVENANCE, and say
plainly which families degrade to minted literals **and why**. Minted literals
are a supported, honest output — the value is right, only the *name* is
anonymous. Silent degradation is the thing this project refuses; named
degradation is the designed path.

---

## 5 · The assisted path — draft, then review

You do not have to write the config from a blank file.

```bash
npm run extract:code            # static pass first — the draft is generated FROM it
npm run extract:draft-config    # → <out>/capture-config.draft.json
# or, from your own repo:
npx @ds-contracts/cli extract --draft-capture-config
```

The drafter fills what the static extraction genuinely knows — component list,
`axes` from enum props, `sampleText`, `stateProps` for the two inferable
booleans (`disabled`/`checked`), and the stage/browser/enumeration defaults.
Everything it **cannot** know gets an explicit `"__review:*"` marker with
one-line guidance, never a guessed value: `classAllow`, `varPrefix`, the mount
recipe, `fixedProps` for required props, `callbackProps`, numeric axis maps.

**Draft ≠ approved.** The draft carries a top-level `"__unreviewed-draft"`
marker and `loadConfig` **refuses any config carrying it, by name**. You review
every marker, fix the value, delete the marker, then delete the top-level key.
The runner never captures from a draft.

### 5.1 KNOWN BUG in the drafter — read this before your first capture

**The drafter emits `enumeration.unsetLabel: "__unset"`, and that value breaks
any library with a defaultless enum axis.**

What happens: the capture prepends `unsetLabel` as a pseudo-value on a
defaultless axis, and that value becomes a **segment of every minted token path**
(`imported.tag.root.background-color.<pseudo>`). The contract's token-ref regex
is `/^\{[a-z0-9.{}-]+\}$/i` — **underscores are not in that character class** —
so `"__unset"` fails `ContractSchema.parse` at the end of fusion with a wall of
"Token reference must be brace-wrapped" errors, **not one of which mentions an
underscore**. Carbon hit this on seven axes across five components.

**The fix, in your config:**

```jsonc
"enumeration": { "cartesianLimit": 512, "unsetLabel": "unset" }
```

`loadConfig` already refuses a collision between `unsetLabel` and a real axis
value by name, so any underscore-free label that does not collide is safe.

**Status: NAMED, NOT FIXED.** The one-word change in
`extract/draft-capture-config.ts` also requires updating the value pinned in
`packages/cli/test/draft-capture-config.test.ts`; both belong to whoever owns
the drafter, in one commit, with the test moved with it. Until then, every
library with a defaultless enum axis hits this wall with the same unhelpful
error. (This is the second time it has been written down —
`examples/carbon/PROVENANCE.md` named it first.)

---

## 6 · Troubleshooting — real failures from the record

| Symptom | Cause | Fix |
|---|---|---|
| `waitForSelector('[data-combo]')` **times out after 15 s with no error anywhere** | An exception took down the whole harness React tree, so the page rendered *nothing*. Carbon's class: `sampleText: ""` used to pass `children: ''`, and React does not treat an empty string as "no children" — components that forward rest props onto a void `<input>` threw | Fixed in the engine (`renderKids` returns `undefined` for `''`). If it recurs: open the harness page in a headed browser and read the console. **The symptom is always "nothing rendered", never "component X failed"** |
| **Zero source facts** — `source-bindings.json` is empty, but screenshots look perfect | Missing theme/provider wrapper (custom properties resolve to `''` at `:root`), or a wrong `varPrefix` | §4.2. Probe `getComputedStyle` at the root *and* inside the wrapper before capturing |
| Source facts are zero **only for overlay components** | **Standing defect, not yours:** `portalSweep()` takes no `varPrefix`, so every `portalCapture` component in every library reads zero CSS-variable source facts. Measured: `mui/dialog`, `mui/menu`, `mui/tooltip`, `carbon/modal` = 0 facts; `mui/button` = 156, `carbon/button` = 126 | Known and named in `examples/carbon/PROVENANCE.md`. Your overlays will ship anonymous minted literals where a named token exists. Not silent any more — but not fixed |
| **Double-run byte-identity fails** with values flipping between runs | Uncontrolled component state leaking between sweeps. Carbon's Tabs: `TabList` defaults to `activation:'automatic'`, so the focus-visible driver's Tab keypress *selected* a tab, and the selection survived into the next sweep (border color `rgba(15,98,254)` vs `rgba(224,224,224)`; list width 261.781 vs 261.922 px) | Make it **controlled** via `fixedProps` (`selectedIndex: 0` + the `onChange` stub; MUI Tabs carries `value: 0`). Same treatment for nanoid-style random ids — pin them (`fixedProps: {"id": "carbon-checkbox"}`) |
| Double-run identity fails on **geometry only**, by tiny amounts | Text remeasuring (a selected tab's bolder font), or an animation sampled mid-transition | Pin the state; check your transition durations against the steady-state probe (§4.2) |
| `ContractSchema.parse` fails at the end of fusion with **~40 "Token reference must be brace-wrapped"** errors | `unsetLabel` contains an underscore | §5.1 — set `"unsetLabel": "unset"` |
| **Unresolved refs** in the gate; a shipped component's score falls with no code change | The gate's inventory was base + *fresh* mint only, while the shipped contract's reviewed layer binds leaves from a **previous** round's minted tree | Declare `tokens.minted` (a declared-but-missing path is refused at load; an absent one is the defect). See [docs/20](20-regate-drift.md) |
| `loadConfig` refuses: *"declares state X, outside the closed contract state vocabulary"* | You modelled a prop-selected rendering as a state | §4.3 — make it an axis with `axisValueMap` |
| `loadConfig` refuses: *"childWrap and childrenSpec are mutually exclusive"* / *"node carries BOTH text and children"* | Two canonical compositions, or an ambiguous child node | Pick one composition; a node is a text leaf **or** a composition |
| Refused: *"is an UNREVIEWED DRAFT capture config"* | The `"__unreviewed-draft"` marker is still there | §5 — review the `__review:*` fields first; the marker is the point |
| Parts refuse to align; part count changes per combo | A modifier class survived `classAllow` | §4.1 |
| A `display:block` component captures shrink-to-fit (MUI's 114 px Card) | The stage is a flex row by default | `"blockStage": true` |
| A full-bleed overlay paints over every other stage and swallows the interaction drivers | Overlay captured on the shared census page | `"portalCapture": true` + `openDriver` |
| Pixel-AA is 0 everywhere while computed equality is high | Your webfont is not loaded (no `fonts` field in the config); both renders fall back but glyph metrics diverge | Expected on any library that does not ship its webfont locally and declares no `fonts` faces. If the files are obtainable offline, configure `fonts` (docs/23 §C.5); otherwise **read the computed-equality number, not the pixel number**, and say so in your PROVENANCE |

---

## 7 · Where this is genuinely harder than the guide can make it

Defect-first, because a smooth guide that hides these costs you a week:

1. **The three §4 decisions are judgement, not procedure.** `classAllow` in
   particular has no mechanical derivation: Carbon's one-rule BEM regex and
   MUI's stack of eleven enumerated lookaheads are both *correct*, and nothing in
   the repo can tell you which shape your library needs. The method in §4.1
   (diff class lists across combos) narrows it; it does not decide it.
2. **Every one of the three fails silently.** Wrong `varPrefix` → perfect
   pixels, zero token names. Wrong `classAllow` → plausible-looking anatomy that
   is subtly per-combo. Wrong axis/state → a captured fact minted and dropped on
   the floor. The gates catch the third now (by name, at load); the first two
   are caught only by a human checking a fact count.
3. **The axis grammar drives the ROOT mount only.** If the prop you want to
   enumerate lives on a *child* (Carbon's `contained` on `TabList`, `open` on
   `AccordionItem`), you cannot make it an axis today. Pin the child and defer
   the axis **by name** — that is what the committed configs do.
4. **Two-axis products cannot be spelled.** `stylesWhen` conditions are
   single-prop and `literals`/`shape` are scalars, so a value that is a function
   of *two* axes (Flowbite's toggle knob offset = `Sizing × Checked`) has no
   spelling in the decor grammar. The path exists (synthesize the pseudo into
   the sweep as a real aligned part, as MUI's Switch thumb now is), but it is a
   capture change, not a config tweak.
5. **Overlay components lose their token names** (the `portalSweep` /
   `varPrefix` defect above). If your library is overlay-heavy, budget for
   anonymous literals on those components until that is threaded.
6. **The fidelity gate samples mid-transition.** `extract/computed/gate.ts`
   waits a flat 30 ms after driving an interaction, while the capture sweep
   polls to stability. On a library with ~70 ms transitions (Carbon), some gate
   rows read an intermediate frame and the instrument itself becomes
   non-reproducible at the third decimal (four runs measured 77.528 / 77.552 /
   77.567 / 77.577 against a 0.001 global tolerance). Carbon's Button carries
   its own `tolerance: 0.08` sized to the measured noise, with the measurement
   in its `gapCause`. Fixing this moves the number for every library and every
   committed scorecard, so it is its own round.
7. **Non-React libraries: partly there.** The *static* path already covers any
   library shipping a Custom Elements Manifest. On the *computed* floor,
   `framework` is still `'react'` because the React harness is the only one
   that exists — a web-components round (custom elements + shadow-DOM
   traversal) is in flight and works by mounting tag names through that same
   harness rather than by adding a second one. Vue and Svelte are the same
   ~200-line adapter pattern against their SFC tooling, unwritten. If your
   library is neither React nor custom elements, this page is a design
   document for you, not a runbook.

---

## 8 · Bringing your round back

If you run this on your own library, the thing worth contributing is not the
config — it is the **PROVENANCE file**: what your library's shape actually was,
which decision cost you a day, and what number to read with what caveat.

Use [`examples/carbon/PROVENANCE.md`](../examples/carbon/PROVENANCE.md) as the
template. Its structure is the deliverable:

1. **Subject** — exact pins, and a recreate block that a stranger can run
2. **The generality verdict** — engine files changed, and for each engine-shaped
   problem: was it config, or was it real?
3. **Reader configuration** — a table of every knob and *why* that value
4. **Tokens** — what you parsed, what you excluded by name, and the **family
   split** (§4.4)
5. **Smoke probes** — what you checked before capturing, including the ones that
   came back "fine"
6. **Pipeline** — the verbatim commands
7. **Gates** — the numbers, per component
8. **Named residuals and deferrals — defect-first**, before the good news
9. **Determinism pins** — witnessed, never precautionary (say which double-run
   failure each pin fixes)

And the house rule, from [CONTRIBUTING.md](../CONTRIBUTING.md): **no capability
claim without an eval behind it.** If your round teaches the pipeline a lesson,
teach the gate the same lesson in the same commit.
