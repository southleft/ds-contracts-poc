# The grammar coverage spec

**Status:** measured artifact, held to the configs by a gate. **Gate:** `npm run grammar-coverage:check` (fast lane). **Machine-readable:** [`grammar-coverage.json`](./grammar-coverage.json).

This names every construct the **capture-config grammar** supports — the language in which a user
tells us how to mount their library — and every construct a real library needs that it does **not**.
Today that is **45** supported and **10** unsupported constructs, 55 rows in all, measured against **13** committed capture configs
using **90** distinct construct paths between them.

## Why this exists

Three holes in this grammar were found by **authoring** three held-out exam subjects, before any
capture had run against them ([HELD-OUT-MANIFEST](../parity/receipts/v1/HELD-OUT-MANIFEST.md)).
None was an engine bug. Each was a place the language could not say what a real library **is**:

> `importName` was emitted verbatim into `import { ... } from '<library.package>'`, so
> `TextField.Root` was a syntax error. Three of Radix Themes' ten components were unmountable,
> and the workaround — a sandbox barrel — makes `library.package`/`version` describe the barrel
> rather than the subject.

> `comboProps` folds every axis into one flat prop bag by assignment, so two class-token axes
> were last-writer-wins. Bootstrap's `variant × size` mounted `className: "btn btn-lg"` and
> **silently dropped the variant**. Not an error, not a receipt — a plausible-looking capture with
> an axis missing. `btn-sm`/`btn-lg` was deferred by name rather than ship it.

> The marker grammar had `$callback`, `$import`, `$render` and `$element`, and no way to spell a
> `Date` — while a calendar's entire rendering is a function of Dates.

All three are closed. The point of this file is the **rest of the list**: the constructs still
missing, each with the library that proves the need and what happens when it is absent. A
first-pass exam failure caused by a known grammar gap measures the grammar, not the engine, and
teaches nothing. Naming them is what makes the exam interpretable.

## How this is measured

The supported half is derived from the **capture configs on disk**, never from the TypeScript
`ComponentConfig` type. A coverage number computed from the declaration that defines the surface
is self-attestation; this tree has been burned by that before. So:

- Every construct path a committed config uses must be claimed by exactly one row. A config that
  uses something this spec does not name is a **refusal**: the grammar grew and the spec did not.
- Every supported row must name an **exerciser** — a config that uses it, or a test/eval that
  does — and the gate verifies the exerciser really exercises it. A row claiming support that
  nothing exercises is a claim, not a capability.
- Totals are recomputed from the rows on every run, never read from the file.

Some constructs are properties of a **value**, not of a path: `components[].importName` is one
path whether or not the name is dotted. Those rows carry a `probe` the gate runs instead.

## Totals

| status | constructs |
|---|---|
| supported | **45** |
| unsupported | **10** |
| **total** | **55** |

## How to read a row

- **id** — stable name; the gate requires this file to mention every one of them.
- **spelling** — how it is written in a capture config.
- **proven by** — the library whose real shape demands it. `every library` means all 13.
- **consequence** — what happens when it is missing or wrong. For unsupported rows this is the
  cost being paid right now, not a hypothetical.
- **exercised by** — `config:<stem>` for a committed config, `<file>#<token>` for a test.

## Supported (44)

### `library` — what is being mounted

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `library.classAllow` | `"library.classAllow": "^rdp-[a-z_]+$"` | day-picker | A part signature moves when an axis moves, and every variant looks like a different component. | `config:altitude`, `config:antd`, `config:astryx` |
| `library.classPrefix` | `"library.classPrefix": "cds--"` | carbon | Part names carry the vendor prefix into the contract and no two libraries' anatomies can be compared. | `config:altitude`, `config:antd`, `config:astryx` |
| `library.customElements` | `"library.customElements": true` | altitude, bootstrap5 | Bootstrap, and every framework-free CSS library, is unmountable. | `config:altitude`, `config:bootstrap5` |
| `library.identity` | `"library": {"package","version","framework"}` | every library | Without it there is nothing to mount and no pin to reproduce; `version` is what makes a capture re-runnable a year later. | `config:altitude`, `config:antd`, `config:astryx` |
| `library.tokenGroup` | `"library.tokenGroup": "p"` | polaris | Minted names collide with the shipped tree. | `config:polaris` |
| `library.varPrefix` | `"library.varPrefix": "--bs-"` | bootstrap5 | Zero source bindings, in complete silence — every computed value is minted as a fresh literal instead of resolving to the library's own token. | `config:altitude`, `config:antd`, `config:bootstrap5` |

### `mount` — how the page is built

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `mount.headStyles` | `"mount.headStyles": [{"id":"al-theme","files":["…"]}]` | altitude | A shadow-DOM library's global theme sheet is missing and every component renders unstyled while the page throws nothing. | `config:altitude` |
| `mount.imports` | `"mount.imports": ["import 'bootstrap/dist/css/bootstrap.css';"]` | every library | The library renders unstyled and the capture records the user-agent defaults as the library's truth. | `config:altitude`, `config:antd`, `config:astryx` |
| `mount.preScript` | `"mount.preScript": ["…"]` | altitude | Custom elements upgrade after first paint and the first captured frame is the un-upgraded DOM. | `config:altitude` |
| `mount.wrapper` | `"mount.wrapperOpen": "<Theme>", "mount.wrapperClose": "</Theme>"` | radix-themes | A library whose token scope is a DOM box (not `:root`) captures no tokens at all — see the unsupported row `theme-provider-is-a-box`. | `config:altitude`, `config:antd`, `config:astryx` |

### `tokens` — what the values resolve against

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `tokens.minted` | `"tokens.minted": "examples/…-minted.dtcg.json"` | every library | The gate falls back to the fresh mint only and scores the shipped contract's reviewed refs as unresolved. | `config:altitude`, `config:antd`, `config:astryx` |
| `tokens.mintedBootstrap` | `"tokens.mintedBootstrap": true` | bootstrap5, day-picker, radix-themes | Either a first pass is impossible, or the ordering guard is suppressed forever. | `config:bootstrap5`, `config:day-picker`, `config:radix-themes` |
| `tokens.sources` | `"tokens": {"dtcg": [...], "css": "…"}` | every library | Nothing to bind to; every captured value is minted. | `config:altitude`, `config:antd`, `config:astryx` |

### assets — icons and fonts

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `fonts.faces` | `"fonts.faces": [{"family","weight","style","file"}]` | altitude, antd, astryx, mui, shadcn | The capture silently re-pins fallback glyphs while claiming the library's real font (FC-FONT-SUBSTRATE). | `config:altitude`, `config:antd`, `config:astryx` |
| `icons` | `"icons": "@shopify/polaris-icons"` | polaris | Structure-creating icon props cannot be mounted. | `config:antd`, `config:fluent`, `config:polaris` |

### environment — browser, stage, enumeration

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `browser` | `"browser": {"viewport","deviceScaleFactor","colorScheme"}` | every library | Two runs on two machines disagree and nothing says why. | `config:altitude`, `config:antd`, `config:astryx` |
| `enumeration.cartesianLimit` | `"enumeration.cartesianLimit": 512` | every library | A four-axis component silently explodes the run instead of refusing by name. | `config:altitude`, `config:antd`, `config:astryx` |
| `enumeration.unsetLabel` | `"enumeration.unsetLabel": "unset"` | every library | `absent` is conflated with a chosen value, and the React surface's own default is never captured. | `config:altitude`, `config:antd`, `config:astryx` |
| `stage.global` | `"stage": {"width","height","padding"}` | every library | A component that fills its parent mints the CAPTURE WINDOW as its own width (the viewport-geometry defect). | `config:altitude`, `config:antd`, `config:astryx` |

### `components[]` — identity

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `component.identity` | `"components": [{"name","contract"}]` | every library | The capture invents its own denominator and every coverage number becomes self-attested. | `config:altitude`, `config:antd`, `config:astryx` |
| `component.importName` | `"importName": "InlineNotification"` | every library | Nothing to mount. | `config:altitude`, `config:antd`, `config:astryx` |
| `component.importName.compound` **(new this round)** | `"importName": "TextField.Root"` | radix-themes | Three of Radix Themes' ten components are unmountable without a sandbox barrel, and the barrel makes `library.package`/`version` describe the barrel rather than the subject. | `evals/run.ts#grammar-compound-import` |
| `component.sampleText` | `"sampleText": "Button"` | every library | Carbon's Checkbox forwards children onto a void `<input>`, React throws, and the whole harness page renders nothing. | `config:altitude`, `config:antd`, `config:astryx` |

### axes — what varies

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `component.axes` | `"axes": ["variant", "size"]` | every library | Nothing varies and one mount is reported as a whole component. | `config:altitude`, `config:antd`, `config:astryx` |
| `component.axisValueMap` | `"axisValueMap": {"checked": {"unchecked": false}}` | carbon, mui, tailwind, … | The contract's vocabulary must equal the library's, which no two libraries agree on. | `config:altitude`, `config:antd`, `config:bootstrap5` |
| `component.baseCombo` | `"baseCombo": {"variant": "primary"}` | no committed library | The base plane is chosen by contract default alone. | `evals/run.ts#baseCombo` |
| `component.presenceProps` | `"presenceProps": [{"prop":"dismissible","libraryProp":"onDismiss","value":{"$callback":true}}]` | polaris, mui, antd, fluent, altitude | The dismiss button, the tag ×, the input adornment are never captured and the anatomy is missing whole parts. | `config:altitude`, `config:antd`, `config:fluent` |
| `component.stateProps` | `"stateProps": [{"prop":"disabled","state":"disabled"}]` | every library with states | An out-of-vocabulary state mints channel names no emitter renders — captured, minted, and dropped on the floor silently. | `config:antd`, `config:astryx`, `config:bootstrap5` |

> `component.baseCombo` — SUPPORTED BUT UNUSED BY EVERY COMMITTED LIBRARY — a field the type declares and no real subject has needed. Named here so the claim is visible rather than implied.

### props and composition

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `component.callbackProps` | `"callbackProps": ["onChange"]` | mui, carbon, polaris, … | React logs a controlled/uncontrolled warning and some libraries refuse to render. | `config:antd`, `config:astryx`, `config:carbon` |
| `component.childWrap` | `"childWrap": {"importName": "CardContent"}` | mui | A bare mount nobody writes captures a truth nobody ships — MUI's flush, padding-less Card. | `config:antd`, `config:fluent`, `config:mui` |
| `component.childrenSpec` | `"childrenSpec": [{"importName","props","text","children"}]` | mui, carbon, bootstrap5, radix-themes, shadcn, fluent, antd | A composed organism (Table, Modal, Nav) can only be mounted as its bare root, and every part below the first level is invisible. | `config:antd`, `config:bootstrap5`, `config:carbon` |
| `component.fixedProps` | `"fixedProps": {"type": "button"}` | every library | A required prop is missing and the component throws, or the mount is not the one real consumers write. | `config:altitude`, `config:antd`, `config:astryx` |
| `component.triage` | `"triage": [{"part","channels","when","cause"}]` | polaris | A known-absent channel is reported as a fresh loss on every run and the ledger never converges. | `config:polaris` |

### stage and capture mode

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `component.blockStage` | `"blockStage": true` | mui | A display:block component is measured as a flex item and its width is wrong. | `config:altitude`, `config:antd`, `config:astryx` |
| `component.openDriver` | `"openDriver": {"open": true}` | mui, carbon, fluent, antd, shadcn, polaris-depth | The overlay is never open and there is nothing to capture. | `config:antd`, `config:carbon`, `config:fluent` |
| `component.portalCapture` | `"portalCapture": true` | mui, carbon, fluent, antd, shadcn, polaris-depth | An overlay (Dialog, Tooltip, Menu, Drawer) captures an empty stage and reports a zero box. | `config:antd`, `config:carbon`, `config:fluent` |
| `component.stage` | `"stage": {"width": 560, "height": 440, "padding": 16}` | mui, carbon, bootstrap5, … | A large organism is clipped by the global stage and its geometry is the clip, not the component. | `config:altitude`, `config:antd`, `config:astryx` |

### the marker grammar — values JSON cannot spell

| id | spelling | proven by | consequence if missing | exercised by |
|---|---|---|---|---|
| `marker.callback` | `{"$callback": true}` | polaris | A handler prop cannot be spelled in JSON and the subtree it creates is never captured. | `config:polaris`, `config:polaris-depth` |
| `marker.classTokens` **(new this round)** | `{"$classTokens": ["btn-primary"]}` | bootstrap5 | `comboProps` folds axes into one bag by assignment, so `variant × size` mounted `"btn btn-lg"` and SILENTLY DROPPED THE VARIANT — a silent loss in the mounting layer. Bootstrap's `btn-sm`/`btn-lg` was deferred by name rather than ship it. | `config:bootstrap5` |
| `marker.date` **(new this round)** | `{"$date": "2026-01-15T00:00:00.000Z"}` | day-picker | A calendar — the archetype the owner named as the one he fears — can only be mounted through a hand-written sandbox fixtures module holding three `new Date(...)` literals, which puts a JS file between the config and the subject. Unpinned, the DOM changes at midnight and no two captures can be byte-compared. | `config:day-picker` |
| `marker.element` | `{"$element": "pkg#Export", "props": {}, "text": "…"}` | mui, antd | An element-valued prop can only be a string. | `config:antd`, `config:mui` |
| `marker.import` | `{"$import": "pkg#Export"}` | polaris, carbon | Element- and component-valued props cannot be mounted. | `config:carbon`, `config:polaris` |
| `marker.child-props` | `{"$childProps": {"Textarea": {"value": "Meeting notes for Tuesday."}}}` | chakra | Without it a composition whose value lives on a child could only be captured bare (the root took every axis prop); the labelled plane of textarea@1 had no foreign held-out. |
| `marker.props` | `{"$props": {"checked": true, "indeterminate": true}}` | mui | A two-axis spelling would silently lose all three checkbox glyphs (the svg-content promotion carries per-value assets only when the markup is a function of exactly one axis). | `config:altitude`, `config:antd`, `config:bootstrap5` |
| `marker.render` | `{"$render": "pkg#Export"}` | mui | MUI's Autocomplete cannot be mounted at all (renderInput is required). Any richer function body is a named refusal, never config. | `config:mui` |

## Unsupported (10)

Every row here is a construct a **real, committed** library needs. None is speculative.

### `axis-arity-depends-on-another-axis`

**Spelling:** (none — the cartesian product is rectangular)  
**Proven by:** day-picker  
**Filed as:** examples/day-picker/README.md §5

An axis whose meaning or value count is a function of another axis, or of data.

*Instances.* day-picker `numberOfMonths: 2` DUPLICATES the whole month grid, so the anatomy's part count is a function of an axis value; a month grid's row count is a function of the date.

*Consequence.* The anatomy promoted from one combo does not describe the others, and parts appear to vanish between combos rather than being structurally absent.

### `boolean-variant-axis`

**Spelling:** (none — booleans may only be pseudo-class states)  
**Proven by:** day-picker  
**Filed as:** held-out finding, this round

A BOOLEAN prop that selects a rendering rather than a pseudo-class plane cannot be enumerated. `axes` refuses a non-enum prop; `stateProps` refuses a state outside the closed vocabulary. A boolean variant falls between them.

*Instances.* day-picker `showOutsideDays` and `showWeekNumber` are `boolean` in the seed contract and listed in `axes`; `propSpaceFor` refuses them by name (`is not an enum prop`), and there is no state named `showOutsideDays` to move them to.

*Consequence.* The config as committed cannot build a prop space at all — the subject is unmountable until the boolean is respelled as a two-value enum. The refusal is honest and named, but the grammar offers no other spelling.

*Workaround today.* Respell the contract prop as an enum of two values (`"off"`/`"on"`) with an `axisValueMap` to real booleans.

### `child-part-axes`

**Spelling:** (none — there is no spelling)  
**Proven by:** bootstrap5, radix-themes, carbon  
**Filed as:** docs/21 §7 item 3

The axis grammar drives the ROOT mount only. A prop that lives on a CHILD part cannot be enumerated.

*Instances.* Bootstrap `checked` on `.form-check-input`, the `.progress-bar` modifiers, `.nav-link` active/disabled; Radix `Tabs.List` size and `TextField.Slot` side; Carbon `contained` on `TabList`, `open` on `AccordionItem`.

*Consequence.* The child is PINNED at one value and the axis is deferred BY NAME. Every rendering the child's own prop selects is absent from the contract — not wrong, but missing, and the contract cannot say how many.

*Workaround today.* Pin the child in `childrenSpec` and defer the axis by name in the config `__note`. That is what every committed config does.

### `class-token-prop-is-fixed`

**Spelling:** (none — `$classTokens` always targets `className`)  
**Proven by:** none yet  
**Filed as:** named on landing, this round

`$classTokens` appends to `className` and only `className`. A library that takes its class tokens on a different prop, or on a per-part `classNames` object, cannot use the ordered form.

*Consequence.* Such a library falls back to `$props`, which is last-writer-wins — the silent drop the ordered form exists to prevent, reintroduced on a different prop name.

*Workaround today.* One class-token axis only, and defer the rest by name.

### `container-self-reference`

**Spelling:** (named, not built: {"$self": true} / {"$parent": true})  
**Proven by:** antd  
**Filed as:** antd RECON W9 — deliberately not built before the exam measures it

A prop whose value must be a reference to the mounted element or its container.

*Instances.* antd's `getPopupContainer` wants the trigger's parent node so an overlay renders in the stage rather than at `document.body`.

*Consequence.* The overlay portals to body and needs the whole `portalCapture` two-phase machinery for what a one-line container reference would solve.

*Workaround today.* `portalCapture` + `openDriver`.

### `drafter-cannot-draft-compound`

**Spelling:** (none — the drafter writes `importName: c.name`)  
**Proven by:** radix-themes  
**Filed as:** named on landing, this round

`extract/draft-capture-config.ts` has no notion of a namespace member, so the assisted path drafts a bare name for a compound component.

*Consequence.* The grammar now ACCEPTS `TextField.Root`, but the drafter can never produce it — a compound library's drafted config is silently unmountable and the human must know to fix it by hand.

*Workaround today.* Author the compound names by hand after drafting.

### `multi-package-mount`

**Spelling:** (none — one `library.package` per config)  
**Proven by:** radix-themes, shadcn  
**Filed as:** held-out finding 1, partially closed by compound `importName`

Components that live in more than one package cannot be mounted from one config.

*Consequence.* A sandbox barrel re-exporting everything under one name, which makes `library.package`/`version` describe the barrel rather than the subject. `$import` reaches other packages for VALUES but not for mounted components.

*Workaround today.* A local `file:` barrel package (`@shadcn-sandbox/ui`, `@radix-themes-sandbox/ui`).

### `no-steady-state`

**Spelling:** (none — there is no spelling)  
**Proven by:** bootstrap5  
**Filed as:** held-out finding 5

A component whose rendering is an infinite animation has no steady state to measure, and the two-stable-samples probe cannot converge.

*Instances.* Bootstrap's `.spinner-border` / `.spinner-grow` are infinite keyframe animations; measured across separate mounts the grow spinner reads 43×43, then 10×10, then 4×4.

*Consequence.* Whatever frame the sampler happened to catch is minted as the component's geometry, and it is different on every run. There is no way to say 'this component has no honest size' — so a number is recorded that is not a fact.

*Workaround today.* None in the grammar. `animate: false` where the library offers it (day-picker does; Bootstrap does not).

### `richer-function-props`

**Spelling:** (none — `$render` is the identity render-prop and nothing else)  
**Proven by:** mui  
**Filed as:** MOLECULE round, by design

Any function-valued prop whose body is not `(params) => <Export {...params} />`.

*Consequence.* A named refusal, never config — deliberately. A config that could carry arbitrary function bodies would stop being data, and the determinism argument would go with it.

*Workaround today.* None, by design. This row is a BOUNDARY, not a gap.

### `theme-provider-is-a-box`

**Spelling:** (partial — `mount.wrapperOpen` mounts it, but nothing declares the SCOPE)  
**Proven by:** radix-themes  
**Filed as:** held-out finding 6

A library whose entire token scope is declared on a DOM element, with nothing at `:root`.

*Instances.* Radix Themes declares all 1,091 custom properties on `.radix-themes` and nothing at `:root` — the docs/21 §4.2 trap in its purest form.

*Consequence.* `mount.wrapperOpen` is load-bearing rather than cosmetic, and nothing in the config SAYS so. Omit it and `getComputedStyle(:root)` returns the empty string for all 1,091 names — zero source bindings, every value minted as a literal, in complete silence.

*Workaround today.* `mount.wrapperOpen`/`wrapperClose` plus the §4.2 bind proof, run by hand.

## The gate

`npm run grammar-coverage:check` (fast lane) refuses when: a committed capture config uses a
construct path no row claims; a supported row claims a path no config uses; a supported row names
an exerciser that does not exercise it (a config that does not use it, a missing file, a token
absent from the named file); a supported marker row names a marker `extract/computed/capture.ts`
does not implement; an unsupported row omits its consequence or where it is filed; ids are
unsorted or duplicated; the stated totals disagree with the recomputed ones; this document fails
to name a construct or quote the real totals; `grammar-coverage.json` is not byte-canonical; or
**no capture config is found at all** — a gate that cannot observe must refuse rather than pass
vacuously.

`npm run grammar-coverage:check -- --self-test` plants ten deliberately broken specs — a dropped
construct a config uses, an exerciser that does not exercise, a ghost test file, a marker the
grammar does not implement, an unsupported row with no consequence, a duplicate id, a
non-canonical byte, stale totals, a construct this prose does not name, and an empty config
corpus — and requires each to go red **by name**. It also requires the committed spec to be green
first, or the red cases prove nothing.

## Standing rules

1. **A construct is supported when something exercises it, not when the type declares it.**
   `component.baseCombo` is in `ComponentConfig` and no committed library has ever needed it; it
   is carried as an exercised-by-eval row so the claim is visible rather than implied.
2. **An unsupported row names a real library.** Speculative gaps belong in an issue, not here.
3. **A boundary is not a gap.** `richer-function-props` will never be supported: a config that
   could carry arbitrary function bodies would stop being data, and the determinism argument
   would go with it. It is listed so the refusal is a decision on the record.
4. **Closing a hole means retiring its workaround.** `marker.date` retired the day-picker
   fixtures module in the same change; `marker.classTokens` un-deferred Bootstrap's
   `btn-sm`/`btn-lg`. `component.importName.compound` has *not* yet retired the Radix barrel —
   the held-out subjects' mounts are frozen until the exam runs, so `multi-package-mount` still
   carries that cost and says so.
