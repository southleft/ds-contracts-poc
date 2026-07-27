# 22 — Generality: is this engine general, or is it just these libraries?

*The owner's question, 2026-07-25: "are these iterations specific to these
design systems, or general to ALL design systems? Not everybody is going to be
using Altitude and Material UI."*

*This document exists because the answer was scattered across commit messages,
four PROVENANCE files, a 46-row drift baseline and the gate code. It collects
the evidence, states the metric that would falsify the claim, and — in the
honest ledger at the bottom — names the four places where the claim as usually
stated is **not** true today.*

Companion reading: [docs/16 — The Sync Boundary](16-sync-boundary.md) (what a
contract carries and the tier-1 supported set),
[docs/20 — Regate Drift](20-regate-drift.md) (the instrument this document cites
for numbers), and [docs/21 — Bring Your Own Design System](21-bring-your-own-design-system.md)
(the onboarding *recipe*). This document is the **evidence**; docs/21 is the
**procedure**.

---

## 1. The claim, and what would falsify it

**The claim.** Libraries are *test vectors*, not targets. The engine
(capture → fuse → promote → emit) does not dispatch on library identity;
library-specific knowledge is supposed to live in declarative config
(`extract/computed/configs/*.json`); and the gates make a library-specific hack
expensive, because any engine change must leave every other library's generated
bytes identical or explain each diff by name.

**The falsifiable metric: engine files changed per new library.** If the engine
were secretly a bundle of per-library special cases, onboarding cost would scale
with library size and novelty — each new system would need engine changes
roughly proportional to how much of it you capture. The prediction is the
opposite: **engine changes per library trend to zero, and the ones that remain
are latent pre-existing bugs the new library merely exposed.**

The measurement to date:

| library | round | components | engine files changed | nature of the change |
|---|---|---|---|---|
| MUI (Emotion) | `82d312f` + six live-paste rounds | 14 | many, across six rounds | new reader + eight distinct engine classes (§5) |
| Flowbite / Tailwind v4 | `7b6f01b` | 5 | several (CSSOM grouping-rule recursion, oklch, pill sentinel) | new *styling method*, reusing the CSS-vars reader |
| Carbon | `28f4d85` | 10 | **1** | a latent pre-existing bug (empty-string children) |

Carbon was run deliberately as the **control case** — a recon predicted a
config-only round, and the round was executed to test that prediction rather
than to make it come true. The commit's own words (`28f4d85`):

> "10 components through the full pipeline in ONE round (vs MUI's six) with
> EXACTLY ONE engine change — and that change was a latent pre-existing bug, not
> Carbon-specific code."

**What would falsify the thesis:** a library requiring engine changes
proportional to its size — e.g. a system where each new component class needs
its own engine rule. Carbon (10 components, precompiled CSS, BEM, defaultless
enum axes, a class-scoped theme, a non-portalled modal) is the strongest
counter-evidence available today. It is *one* control case; two more would be
better, and Altitude (§9) is the next one.

---

## 2. The test vectors

**Six distinct libraries across seven rounds** (Polaris runs twice: a census
config and a depth/Modal config). Five are in the standing offline drift
instrument; a seventh library is in flight (§9).

### The styling-architecture matrix

| # | subject | styling method | token mechanism | reader used | config `varPrefix` | config `classAllow` |
|---|---|---|---|---|---|---|
| 1 | this repo's own 51 components | CSS Modules | DTCG → CSS custom properties | (native — generated *from* contracts) | n/a | n/a |
| 2 | `@shopify/polaris@13.9.5` | CSS Modules, precompiled `styles.css` | 453 `--p-*` custom properties | computed floor only | *(absent — see §8.1)* | *(absent: keep everything)* |
| 3 | `@astryxdesign/core@0.1.6` | **StyleX** (compile-time atomic classes) | `defineVars` tables, `light-dark()` modes | StyleX token reader (`core/stylex-tokens.ts`) | *(absent — names are compiled away)* | `^astryx-` |
| 4 | `@mui/material@9.2.0` | **Emotion runtime** (no static CSS) | `createTheme({cssVariables:true})` → `--mui-*` | Emotion / CSS-vars reader | `--mui-` | an 11-lookahead grammar |
| 5 | `flowbite-react@0.12.17` on `tailwindcss@4.3.3` | **Tailwind v4 utilities** | `@theme` → `--color-*`, `--radius-*`, oklch | the same CSS-vars reader | `--` | `^$` (keep nothing) |
| 6 | `@shopify/polaris@13.9.5` (depth config) | as #2 | as #2 | as #2 | — | — |
| 7 | `@carbon/react@1.112.0` + `@carbon/styles@1.111.0` | **precompiled CSS** (955 KB, no build step) | 366 `--cds-*` in theme *class scopes* | the same CSS-vars reader | `--cds-` | `^cds--(?!.*--)` |

Four distinct styling architectures — build-time atomic, runtime CSS-in-JS,
utility-first, and precompiled stylesheets — plus two token-delivery shapes
(`:root` vs class-scoped themes). The tier-1 guarantee in
[docs/16](16-sync-boundary.md) is exactly this set.

The load-bearing observation from the Tailwind round is worth restating,
because it is the cheapest generality result in the repo: **Tailwind v4 is
already a CSS-variables system**, so it bound token names through the *Emotion*
reader with `varPrefix: "--"` and no new reader architecture
(`examples/tailwind/PROVENANCE.md`). Carbon then reused the same reader again
with `varPrefix: "--cds-"`. One reader, three libraries, three unrelated
vendors.

### What bound, what degraded, and why

Counted from the committed token trees (`examples/<lib>/tokens/*.dtcg.json`):

| library | base tokens | minted leaves | source-aliased | literal | why the literals are literal |
|---|---|---|---|---|---|
| polaris | 453 | 980 | **0** | 980 | no `varPrefix` configured — see §8.1, this is a gap, not a library property |
| astryx | 186 | 237 | 54* | 183 | StyleX **compiles the token name away** into a literal hex in the atomic class; there is no `source-bindings.json` to read |
| mui | 150 | 1,498 | 73 | 1,425 | shadows serialize differently (value verification refuses); `calc(var(--mui-spacing)*N)` excluded by name |
| tailwind | 68 | 276 | 21 | 255 | Flowbite's `primary` palette is `@theme inline` — utilities compile to literal `#1A56DB`, by the library's own choice |
| carbon | 339 | 1,120 | 94 | 1,026 | **the family split** (below) |

*Astryx's 54 are **not** extraction facts. They are a human review ledger
(`examples/astryx/tokens/reanchor-decisions.json`, 19 acked alias rows + 2
kept-literal receipts, orchestrator-reviewed under owner delegation) — the
provenance is a decision, and the file says so.

**The family-split doctrine** is the correct way to read every alias count, and
Carbon states it most sharply (`examples/carbon/PROVENANCE.md`). Measured on
Carbon's compiled CSS: **336 distinct `--cds-*` referenced, 366 defined, 80
referenced-but-never-defined** — of which **77 are the TYPE family**
(`heading-*`, `body-*`, `label-*`, …), a Sass opt-in the compiled CSS does not
emit. Spacing: **0 defined.** Motion: **0 defined.** So a Carbon alias is nearly
always a *colour*, and every literal font-size, padding and duration in the
minted tree is **the library's own shape, not a reader shortfall.** The same
logic explains Flowbite's inline-themed palette and Astryx's compiled-away
names. Degradation here is the designed path working: correct pixels, poorer
token *names*.

---

## 3. Where library knowledge lives

### The config surface

One TypeScript interface (`CaptureConfig`, `extract/computed/capture.ts`)
declares everything a library may say about itself:

```
library:     package, version, framework, classPrefix, classAllow?, varPrefix?
mount:       imports[], wrapperOpen, wrapperClose
tokens:      dtcg[], css, minted?
icons?, browser, stage, enumeration{cartesianLimit, unsetLabel}
components[]: name, importName, contract, sampleText, axes, axisValueMap,
              fixedProps, stateProps, presenceProps, callbackProps,
              childWrap | childrenSpec, openDriver, portalCapture,
              blockStage, stage, triage, __note
```

Three keys carry *grammar*, and they are where the per-library craft actually
lives:

- **`classAllow`** — a raw regex compiled and shipped into the capture page.
  Carbon's is one rule (`^cds--(?!.*--)`); MUI's is eleven negative lookaheads
  naming MUI's modifier conventions; Tailwind's is `^$` (keep nothing, because
  utility classes are not anatomy); Polaris has none.
- **`varPrefix`** — the custom-property prefix that switches the CSS-vars
  source-binding reader on. Absent ⇒ reader off.
- **`classPrefix`** — the prefix stripped for part signatures.

`loadConfig` is a real referee, not a parser: a `__draft` marker refuses the run;
a declared-but-missing `tokens.minted` path refuses by name; `childWrap` +
`childrenSpec` together refuse; and a `stateProps[].state` outside
`CONTRACT_STATES` refuses by name — that last one added *after* MUI Switch
silently minted channel names no emitter could render (§5).

**The ratio.** 1,281 lines of config across the **six committed** configs,
against ~29,000 lines of engine (`extract/computed/*.ts` ≈ 9.4k, `core/*.ts`
≈ 19.6k). Roughly 1:23. (A seventh, `altitude.json`, is in flight — §9 — and is
already adding config *keys* rather than engine branches: `customElements`,
`preScript`, `headStyles`.)

| config | lines |
|---|---|
| `polaris.json` | 475 |
| `mui.json` | 391 |
| `carbon.json` | 189 |
| `astryx.json` | 113 |
| `tailwind.json` | 71 |
| `polaris-depth.json` | 42 |

### The engine audit — and where the claim leaks

An adversarial sweep of all 37 engine files for library names and
library-specific identifiers returns this:

**What holds.** There is **no dispatch on library identity anywhere** — no
`if (lib === 'mui')`, no switch on package name. `cfg.library.package` and
`.version` are used only as *data*: import statement text, harness version
pinning, provenance strings. The ~70 grep hits naming MUI, Polaris, Carbon or
Tailwind in `anatomy.ts`, `capture.ts`, `fuse.ts` and `emit-figma-script.ts` are
**comments attributing a generic rule to its discovering library** — provenance
annotations, not conditionals. The style-method readers (`core/stylex-tokens.ts`,
the CSS-vars reader) key off *methods* and config values, not vendors; the
variable literally named `muiRe` in `capture.ts` is built from the config's
`varPrefix` and serves Carbon and Tailwind unchanged.

**What leaks — four places, reported because a document that only reports the
green is not evidence:**

| # | site | what it hardcodes | consequence |
|---|---|---|---|
| L1 | `extract/computed/lib.ts:399`, inside `stems()` | `.filter(c => !c.includes('--'))` — a BEM assumption that `--` means *modifier*, applied **before** the prefix strip | **Carbon's `classPrefix` is `cds--`, which contains `--`, so every Carbon class is discarded.** No config key can override it. |
| L2 | `extract/computed/anatomy.ts:212` | `const PORTAL_PREFIX = 'Polaris-'` on the live portal-anatomy descent (`realRootsOf` → `descendToRealRoots`, reached by every `portalCapture: true` component) | the config's own `classPrefix` is ignored at this one call site; the docstring admits it and argues the failure is asymmetric |
| L3 | `extract/computed/capture.ts` (`grep -n '\^Polaris-'`) | `/^Polaris-/` inside the browser-evaluated portal reader | diagnostic plumbing (`currentReader`) with no downstream consumer found — low severity, still a literal |
| L4 | `extract/computed/drift-check.ts:52` | a five-entry `LIBRARIES` registry of config paths | adding a sixth library to the standing instrument edits engine source, not just a config |

**L1 is the real finding, and it is measurable from committed artifacts.**
Carbon's config author explicitly intended the opposite —
`examples/carbon/PROVENANCE.md:81` argues that `cds--checkbox-label-text` is an
ELEMENT and "stays", and `classAllow: "^cds--(?!.*--)"` correctly preserves it
through capture. The engine then throws it away in `stems()`. Compare the
committed root signatures in `extract/computed/out/*/captured-truth.json`:

| library | root signature | classes actually captured |
|---|---|---|
| polaris | `button\|Button` | `Polaris-Button`, … |
| mui | `button\|Button-root.ButtonBase-root` | `MuiButtonBase-root`, `MuiButton-root` |
| astryx | `button\|button` | `astryx-button` |
| tailwind | `button\|` | `[]` — *intentional*, `classAllow: "^$"` |
| **carbon** | **`button\|`** | **`["cds--btn"]`** — classes present, stem empty |

Carbon Checkbox degrades the same way: root `div|` with
`["cds--form-item","cds--checkbox-wrapper"]`, children named positionally
(`part-0`, `part-1`) rather than by class stem. Carbon's parts therefore align
on tag + position alone.

**How to read this honestly.** It did not *break* Carbon — the round still
converged, 10 components, floors 76.5–96.6%. But those floors were measured
*with* this degradation, and nothing in the repo names it. It violates the house
rule that degradation is named, never silent, and it is the strongest single
qualifier on the generality claim in this document. Fixing it means ordering the
modifier filter after the prefix strip (or making the modifier grammar a config
key) and re-measuring Carbon. **Open; owner: whoever takes the next Carbon
round.**

Lower-stakes cousins, for completeness: `run.ts:94`, `regate.ts:67` and
`resolve.ts:87` default to `configs/polaris.json` when `--config` is omitted, and
`run.ts:867` labels *every* library's receipt PNG `REAL POLARIS (NPM PACKAGE)`.
Cosmetic; still evidence that Polaris was library #2 and left fingerprints.

---

## 4. Rounds to convergence

The falsifiable metric, measured:

| library | live-paste / engine rounds | evidence |
|---|---|---|
| **MUI** | **six** | `f52c334` (live-review), `acb0342` (live-paste-2), `04498cc` (live-paste-3), `6e76346` (live-paste-4), then `3e14f6f` / `53792d3` / `2d2098a`, and `8dad6b2` explicitly labelled "round 6 of the live-paste loop" |
| **Carbon** | **one** | `28f4d85` — 10 components, one engine expression changed |

MUI cost six rounds because it was the *first* of its kind on almost every
axis: first Emotion-runtime system, first portal components, first organism
(`display:table`), first absolute-positioned overlay anatomy, first two-axis
nested token carriage. Each round bought a general rule (§5). Carbon arrived
after all six and paid one.

Carbon's round also produced the cleanest possible receipt for "config, not
engine": a second problem *looked* like an engine change and was not. Carbon is
the first library with a **defaultless enum axis reaching minting** (`size` on
Button/TextInput/Modal/IconButton, both of Tag's axes). The drafter's default
pseudo-value `"__unset"` becomes a segment of every minted token path, and the
contract's token-ref regex `/^\{[a-z0-9.{}-]+\}$/i` forbids underscores — so
fusion died with ~40 "must be brace-wrapped" errors, *not one of which mentions
an underscore*. The fix was `"unsetLabel": "unset"` in config. Named, not
papered over: `extract/draft-capture-config.ts` still drafts `"__unset"`, so the
next defaultless-axis library hits the identical wall with the identical
unhelpful error.

---

## 5. The cross-library fix record

The strongest evidence for generality is not that no library needed engine
changes. It is that **engine changes found through one library repaired others
in the same commit** — which is only possible if the rule was general and the
library was a probe.

### 5a. Same-commit repairs — one library's probe fixed another library's bytes

| defect, stated library-independently | exposed by | repaired, same commit | sha |
|---|---|---|---|
| A text part that also **contains parts** compiled its text and silently dropped its children (static HTML emitter) | MUI `TableSortLabel` (sort arrow missing) | **Polaris `Avatar`** — its person glyph had been missing from `generated/html/avatar.html` all along; gate 33.5 → 85.2 | `3e14f6f` |
| A **block-display root** was laid out with the control default (`HORIZONTAL/CENTER/CENTER`) instead of CSS block flow | MUI `Card` (centered text on a real card) | **five Polaris components** whose block roots had been silently centered: `Text`, `ProgressBar`, `Spinner`, `Avatar`, `Thumbnail` — goldens updated with review | `6e76346` |
| **Positioned parts must partition after in-flow siblings** so out-of-flow overlays paint on top | MUI `Slider` / `Switch` (thumb hidden under an in-flow track) | **Polaris `Tag`** — its link overlay now correctly paints last | `acb0342` |
| …and the same rule **over-reached**: a `relative` box stays IN flow, so partitioning it only reorders the row | MUI `TablePagination` (select jumped to toolbar end), `Autocomplete` (chips behind the input) | **Polaris `radio-button` + `tag`** — diffs audited as *pure reorderings* (node multisets byte-equal) | `3e14f6f` |
| The **bare-text lowering dropped `layout.grow`**, so a hugging text node inside a centering parent got centered instead of spanning | MUI `Accordion` summary title | **Tailwind `ToggleSwitch` label** — `fillW: true` removed on all 6 variants; the commit calls it "a genuine cross-library repair" | `8dad6b2` |
| **`checked` sat outside the closed state vocabulary**, so a captured plane minted channel names no emitter could re-read — captured, minted, rendered by nobody | MUI `Switch` (four literally invalid CSS declarations shipped) | **Flowbite `ToggleSwitch` 3 → 6 variants** — contract, extension, bundle and genesis batch all moved; closes the named gap in `examples/tailwind/PROVENANCE.md` by name | `53792d3` |
| **A box-padded text part must lower to FRAME(padding) → TEXT** — a Figma text node cannot carry side padding | MUI `Chip` (first live paste) | **this repo's own library** — `figma-sync/28-pagination.js`: the page cells' padding and radius bindings had been dropped all along | `f52c334` |
| **`px()` silently dropped `rem`/`em` units** (`parseFloat` ate the suffix) | **Astryx** — Meta's rem-scaled font tokens; real Figma refused `set_fontSize` on the first live paste | bytes moved in Astryx scripts, the genesis batch, **the repo's own `figma-sync`**, and **Polaris**; golden updated. The repo's own tokens are px/unitless, so 147 headless checks had never exercised the unit path | `5c93c8a` |
| **`out/<component>` was not namespaced**, so decision ledgers collided between libraries | **Astryx** — the Astryx `Button` run re-applied the committed **Polaris** `Button` ledger, surfacing a `{p.*}` repo-convention ref inside an Astryx contract | Polaris artifacts restored; all Astryx components re-captured clean | `b66e5a3` |
| **The v14 conflict rule spans `tokensByProp` *and* `literalsByProp`, but fusion's two merge blocks each checked only their own field** | the MUI-driven absolute round introduced it | **Polaris `Avatar` / `ProgressBar` / `Thumbnail` had been UNFUSABLE since that round** — the inverse direction, a MUI-round regression found and repaired in Polaris | `0ce7c67` |
| **Real Figma drops FILL the moment a node goes ABSOLUTE**, and min/max must clamp | MUI `Dialog` (backdrop drew as a squat grey band) | `resizeOutOfFlow` landed on **all three build paths**: emitted-script bytes moved in 13 Astryx, 12 Polaris and 5 Tailwind `*.figma.js` files, while the only *spec* change outside MUI was "24 grow additions + the ToggleSwitch fillW fix" | `8dad6b2` |

### 5b. Same-commit *non*-changes — the other half of the evidence

A general rule proves itself as much by leaving other libraries alone as by
repairing them. These are the rounds where the receipt is byte-identity:

| change | proof that other libraries did not move | sha |
|---|---|---|
| `sampleText: ""` mounted as a **real empty-string child** — React refuses children on a void element, the harness tree dies, and the failure surfaces as a nameless `waitForSelector` timeout (Carbon `Checkbox`/`TextInput`) | "Six libraries tolerated it by accident." A/B recapture of Tailwind `ToggleSwitch` + MUI `Switch` **on the same engine** — all six artifacts byte-identical each; `--stat` touches only Carbon + `capture.ts` + `drift-check.ts` + evals | `28f4d85` |
| **Inheritance-aware refusal** (a nested channel equal to its ancestor on every plane is inheriting) — repaired Polaris `Button` 85.858 → 91.331 | "The refusal also fires on `mui/Switch` `switch-thumb.color` and `polaris/Tag` `icon-3.color` with pctEqual and cellsCompared UNCHANGED — listed, not glossed." `--stat` shows only `fuse.ts` + `run.ts`; **zero example artifacts** | `d10511c` |
| The Figma-emitter twin of the text-holder bug (MUI `Tooltip`'s arrow never compiled) | childless-text lowering path byte-compared against the Tailwind bundle: unchanged | `aab937b` |
| **`demoteFullBleedScrim`** introduced for MUI `Menu` | one round later **Carbon `Modal` correctly REFUSED the demotion** — its scrim is a *visible* full-bleed layer, so it is real anatomy. The recon prediction held exactly. A generality confirmation, not a repair | `8dad6b2` → `28f4d85` |
| **Portal autofocus neutralization** (MUI Menu's first item carried a `:focus-visible` tint in its "default" plane) | exercised unchanged on Carbon `Modal`: `portal-autofocus-neutralized` receipted on all 5 combos | `8dad6b2` → `28f4d85` |
| **Gate inventory = config DTCG + fresh mint + shipped minted tree** — vindicated Astryx `Slider` 55.333 → 90.387 | the measurement moved for every library; `captured-truth.json`, `enriched.contract.json` and `resolved.contract.json` came back **byte-identical**. "The fix changed the measurement, not the artifact." | `05a8ce0` |

### 5c. Calibration — what did *not* turn out to be cross-library

Three rules that are genuinely general but whose fixes moved **only one
library's bytes**, reported so the record is not inflated:

- **`max-width` as a ceiling** (`8dad6b2`) — one root cause drove three MUI
  defects (Dialog papers, Tabs, Tooltip), and the rule is general, but no other
  library's spec changed. Single-library fix.
- **`align-items: stretch` lowering on the wrong axis** (`8dad6b2`) — surfaced
  underneath the max-width fix, MUI Tabs only.
- **`display:table` lowering with ARIA roles** (`3e14f6f`) — a real engine class
  for MUI's DataTable; the Polaris and Tailwind bytes in that commit trace to the
  *other three* defects in it, not to table lowering.

And one candidate that does not exist: there is **no "focus-visible default
sampling" defect** in the log. Every `focus-visible` hit is either a standing
*refusal* ("declares no token overrides … would render identically to Default")
or a named exclusion ("focus-visible + disabled have NO Figma trigger",
`2d593d8`). The autofocus half of that story is real (`8dad6b2`); the
focus-visible half is not.

### 5d. Two structural notes

1. **Sibling changes are reviewed, not blind-repinned.** `8dad6b2` re-emitted 30
   sibling example scripts and *states* the only spec change outside MUI.
   `3e14f6f` verified the Polaris script diffs were pure reorderings (node
   multisets byte-equal). That review step *is* the enforcement mechanism from
   §7, executed.
2. **Byte-identity proof is A/B on the same engine, not comparison to committed
   artifacts.** Carbon's PROVENANCE explains why: the committed Tailwind
   `ToggleSwitch` truth was already stale against the current engine (it predates
   the `translate-x`/`translate-y` decomposition), so comparing against it would
   have proven nothing. Both libraries' `out/` were restored from git afterwards.

---

## 6. The general vocabulary, discovered through libraries

Every rule below is stated without naming a vendor; the parenthesis is the
library that exposed it. This is the actual product of seven rounds.

- **`max-width` is a ceiling, not a width.** A part binds the ceiling and hugs
  beneath it; a component *root* keeps the design-width lowering, because a root
  has no container to be fluid inside. (MUI Dialog/Tabs/Tooltip — `8dad6b2`,
  `core/emit-figma-script.ts:1184`)
- **A full-bleed fixed root that draws no box of its own, with exactly one
  box-drawing, not-full-bleed child, is a modal LAYER — promote the child.**
  Refuses when that one child is itself full-bleed and visible, because then the
  scrim is real anatomy. (MUI Menu promoted; MUI Dialog and Carbon Modal both
  correctly *refused* the demotion — `capture.ts` `demoteFullBleedScrim`)
- **`display:block` children stack vertically at any depth**, decided by the
  children's *outside* display: all-block-level children stack; inline-level
  children keep the line box. Previously root-only. (MUI Menu items flowing
  horizontally — `core/emit-figma-script.ts:906`)
- **The CSS table box model is LOWERED, not admitted.** `table`/`*-group` →
  flex column with stretched children; `table-row` → flex row with stretched
  children; `table-cell` → flex row whose axes come from computed
  `vertical-align` / `text-align`. The *element* lowers too — a `<tr>` outside a
  `<table>` is deleted by the HTML parser (which scored the first capture 33.5%)
  — so each lowered part becomes a `<div>` with the matching ARIA role. Every
  lowering emits a `table-lowering:` receipt. (MUI Table — `anatomy.ts:1406`)
- **A nested channel that equals its ancestor's value on *every* captured plane
  is inheriting, and must not be bound.** Binding it pins the child to one
  plane and severs the inheritance chain. Restricted to genuinely CSS-inherited
  channels, and refused if the ancestor carries the channel nowhere (dropping it
  would bind the channel nowhere). (Polaris Button regression — `fuse.ts:1160`)
- **Overlays autofocus their first item, so the sampled "default" plane is
  secretly `:focus-visible`.** The portal capture blurs the focused element
  before sampling and receipts what it blurred
  (`portal-autofocus-neutralized`). (MUI Menu item 1 carrying a grey tint;
  Carbon Modal receipted the same on all 5 combos)
- **Real Figma drops FILL sizing the moment a node goes ABSOLUTE, and honors
  min/max clamps.** Both were mock blindnesses that let a squat grey backdrop
  band look perfect headlessly; both are now taught to the mock, plus a
  `resizeOutOfFlow` post-pass sizing every inset-0 absolute child against the
  parent's *final* box. (MUI Dialog — `8dad6b2`)
- **`checked` is a variant axis, not a state plane.** The contract state
  vocabulary is closed (`hover|active|focus-visible|disabled`); a value outside
  it minted channel names no emitter could re-read, so the facts were captured,
  minted, and dropped on the floor silently. Now one spelling of the vocabulary
  (`CONTRACT_STATES`) with three readers, and a load-time referee. (MUI Switch
  and Flowbite ToggleSwitch, same round — `53792d3`)
- **A focus-trap sentinel is DOM plumbing, not anatomy** — a direct child of a
  portal root that draws no box, carries no library class, and contains nothing.
  (MUI Modal's two classless `<div tabindex=0>` — `stripInertPortalChildren`)
- **`presence` axes lower to a Figma BOOLEAN component property**, not to a
  variant plane — which is why such a set is a single COMPONENT. (MUI Tooltip's
  arrow "that never materialised" — it was never lost; the compile receipt now
  pins the property, its type, its default and the wiring)
- **A synthetic translate channel is admitted for any overlay-cluster part whose
  entire enabled default plane is inside the translate grammar, with
  ABSENT ≡ `0px`** — because that is exactly what `transform: none` means.
  Previously keyed to the BASE plane, which meant a fact only present in
  non-default combos was invisible. (MUI Switch checked thumb — `2d2098a`)

---

## 7. Structural enforcement

What makes a library-specific hack expensive rather than merely discouraged:

| instrument | what it pins | how to run |
|---|---|---|
| **Eval suite** | 162/162 as of `evals/results.json` — 21 refusal, 28 determinism, 40 detection, 54 extraction, 3 convergence, 4 CLI, 11 journey, 1 theming | `npm run eval` |
| **Golden byte-identity** | recorded generated output, byte-compared — determinism against a *record*, not just against itself | `golden-generated-output` eval, `evals/golden.json` |
| **Per-library genesis pins** | one eval each: `astryx-figma-genesis`, `mui-figma-genesis`, `tailwind-figma-genesis`, `carbon-figma-genesis`, `polaris-showcase-reproducible` | `npm run eval` |
| **Sibling-bundle flows** | each library's `*.bundle.json` runs through the **real engine path** and must build its full component count with its full variable inventory — MUI 14, Astryx 13, Polaris 12, Carbon 10, plus the Astryx docs-theme re-skin proving the same inventory re-themes | `npm run plugin:check` (`scripts/plugin-engine-check.mjs`, ~1,150 lines) |
| **Offline drift instrument** | 46 rows across 5 libraries, per component: `pctEqual` within tolerance, `cellsCompared` **exactly** (a moved denominator is a vocabulary change and must be acknowledged), `unresolvedTokenRefs` exactly, and a hard fail if a component stops fusing | `npm run extract:computed:drift` |
| **Double-run byte identity** | every capture is swept twice in one session; unstable channels fail the run and the refusal **names its witness** (capture key, element path + signature, both values) | part of `npm run extract:computed` |
| **Shipped-contract refs resolve** | every shipped contract resolves every token ref against its library's inventory | `shipped-contract-refs-resolve` eval |
| **Gate inventory = shipped inventory** | the gate measures against the token set the shipped contract can actually see; withholding the shipped tree must bring the unresolved refs back (the falsification half) | `gate-inventory-shipped-minted` eval |

The drift baseline is what makes cross-library damage a number rather than a
vibe. Its 46 rows, recorded 2026-07-26: mui 14, polaris 12, carbon 10, astryx 5,
tailwind 5. `28f4d85` reports "drift 46/46 with **zero pre-existing rows
moved**" — adding a whole library moved no other library's number. That sentence
is the thesis, measured.

It is deliberately **not** an eval: it renders a real headless Chromium per
component, ~8–20s each, ~5–6 minutes total, against a ~10-minute eval suite. The
cheap invariant it makes legible (`computed-contract-refs`) *is* in the suite;
the number itself is an on-demand script CI can call.

---

## 8. The honest ledger

Scope boundaries, each with its cause located and its next step named. None of
these is an apology; a document without this section is marketing.

### 8.1 Named residuals that qualify the generality claim

- **L1 — the BEM modifier grammar in `stems()` silently strips every Carbon
  class** (§3). The single most important qualifier in this document, and
  previously undocumented anywhere in the repo. Config cannot fix it.
- **Polaris carries zero source-token facts.** Its config declares no
  `varPrefix`, so no `source-bindings.json` exists for any Polaris component and
  all **980** minted leaves are anonymous literals — while the token wrap shows
  **453 `--p-*`** custom properties exist in Polaris's vocabulary. The CSS-vars
  reader landed in the MUI round (library #4); Polaris (library #2) was never
  re-run with it. Whether Polaris's compiled CSS Modules reference those
  properties *at the point of use* is not verifiable from committed artifacts
  (the sandbox is gitignored). **Unmeasured, not ruled out.**
- **Overlay components carry ZERO source-token facts in EVERY library.**
  `portalSweep()` takes no `varPrefix`; `run.ts` calls it with
  `{ screenshots, classAllow }` and nothing else. Verified from committed
  artifacts:

  | component | facts in `source-bindings.json` |
  |---|---|
  | `mui/dialog`, `mui/menu`, `mui/tooltip`, `carbon/modal` | **0** each |
  | `mui/button` | 156 |
  | `carbon/button` | 126 |

  Pre-existing; Carbon made it visible by being the first round to check a
  portal component's number against a census sibling in the same library.
  **Not fixed there** because threading `varPrefix` changes MUI's Dialog / Menu
  / Tooltip captured truth and their promoted contracts — an MUI re-capture
  round. Tracked as task #23.
- **The gate samples mid-transition.** `extract/computed/gate.ts:380` waits a
  flat `30 ms` after driving an interaction, while the capture sweep polls to two
  consecutive stable samples for up to 1.5 s. Carbon's buttons transition at
  **70 ms**, so **58 of Button's 448** gate rows read an intermediate frame, and
  the offline instrument becomes non-reproducible on that row: four consecutive
  runs measured **77.528 / 77.552 / 77.567 / 77.577** against a 0.001 global
  tolerance. `carbon/Button` is the first and only baseline row carrying its own
  `tolerance` (0.08, sized to the measured noise) with the full measurement in
  its `gapCause`. Every engine-sized move this baseline has recorded
  (+1.042, +2.459, +20.155, −3.296) is an order of magnitude larger, so a real
  regression still fails the row. **Fixing `gate.ts` moves the number for every
  library and every committed scorecard — its own round.**
- **Class-filter grammars are per-library regex craft.** `classAllow` is the
  one place where onboarding cost is genuinely proportional to the library's
  naming conventions. Carbon's is one rule; MUI's is eleven negative lookaheads.
  `extract/draft-capture-config.ts` marks `classAllow`, `varPrefix`, `mount` and
  `fixedProps` as `__review:*` fields explicitly because they are "NOT inferable
  from static source". This is the "Emotion capture-config cliff" named as gap
  **G6** in [docs/18](18-user-flows.md).
- **The defaultless-axis trap is named, not closed.** `draft-capture-config.ts`
  still drafts `"__unset"` (§4); so does its test. One-word change plus a test
  update, owned by whoever owns the drafter.
- **Text wrapping is not implemented.** A hugging text node inside a
  fixed-width ancestor clips (MUI's `AccordionDetails` body copy at 426px inside
  288px). Fixing it changes every hugging text node in the corpus, so it is its
  own round, deliberately not attempted mid-molecule-round.
- **The two-axis decor product has no spelling.** Flowbite's toggle knob offset
  is a function of `Sizing × Checked`; `stylesWhen` conditions are single-prop
  and `literals`/`shape` are scalars, so no decor grammar can express it. On
  canvas the toggle draws its track only. Carbon's Toggle pins `size: md` for
  the same reason, rather than minting a product nothing can render. The named
  path forward is synthesizing the pseudo-element into the sweep as a real
  aligned part — exactly how MUI Switch's thumb offset is now carried.
- **The Accordion chevron is refused, not drawn.** `expandIcon` takes a React
  element; the marker grammar resolves package *exports* only, and the pinned
  sandbox has no `@mui/icons-material`. A hand-drawn chevron would be a
  fabricated canvas fact, so there is none.
- **Fonts are not loaded in the harness.** Carbon's `styles.css` carries 105
  `@font-face` blocks, every `src` an Akamai CDN URL, and the harness is
  network-free — so IBM Plex is not loaded and the metrics come from the fallback
  stack. (`document.fonts.check` returns `true` for fonts that are certainly not
  installed; it reports "can this be rendered", which fallback always satisfies.
  It proves nothing.) Both sides of the gate degrade identically, so percentages
  are unaffected; absolute text widths are fallback widths, and pixel-AA is 0
  everywhere for that reason plus the uncarried type family.
- **The `bound`-probe path spells a ref `{button-primary}` as
  `--button-primary`, not `--cds-button-primary`.** Shared pre-existing
  limitation across MUI, Tailwind and Carbon; harmless today because seed
  anatomy carries no refs. Named rather than claimed clean.

### 8.2 Scope boundaries by decision

- **Web DOM only.** Every capture is a browser-computed fact from a headless
  Chromium page. The tier-1 supported set in [docs/16](16-sync-boundary.md) is
  React and Web Components (CEM) with four styling methods. Non-DOM renderers
  (React Native, Flutter, native toolkits) are outside the computed floor
  entirely — not "not yet", but not on this path.
- **Behavior, motion, and a11y semantics beyond states** are downstream
  concerns the contract deliberately leaves to the code that owns them
  ([docs/16](16-sync-boundary.md)).
- **Overlay state planes do not exist in the captured truth.** `portalSweep`
  mounts and unmounts per combo, so hover / focus-visible / active planes for
  Dialog, Menu and Tooltip are absent, fusion skips them by name, and those
  contracts declare `states: []` — pinned by the contract, not by luck.

---

## 9. Altitude — in flight, no results claimed

A seventh library and a fifth styling architecture is in flight as this is
written: **`altitude-web-components@1.0.2` — Lit web components, shadow DOM**.
It is the first subject whose CSS lives in `shadowRoot.adoptedStyleSheets` (the
document's own `styleSheets` carry zero component rules) and whose every
rendered box lives inside an open shadow root.

At the time of writing there is an **uncommitted** capture config
(`extract/computed/configs/altitude.json`), an uncommitted sandbox, and
in-progress shadow-piercing work in `capture.ts`. There is **no committed
contract, no scorecard, and no drift baseline row.** Nothing about Altitude is
claimed here, and no number in this document includes it.

Two things about it are worth flagging in advance, because they bear directly on
§1's metric:

- It has already required **new config keys** (`customElements`, `preScript`,
  `headStyles`) rather than new library branches — which is the shape the thesis
  predicts, but it is a prediction until the round closes.
- Its config `__note` fields already read like the Carbon round's: three
  load-bearing mount facts, each stating what silently produced zero facts
  without it. That the failure mode is *silence* is exactly what §8's ledger is
  about.

When it lands it becomes the second control case for §1, and the first test of
whether the computed floor reads through a shadow boundary at all.

---

## 10. How to verify this yourself

Every number in this document is checkable from a clone. Nothing below needs a
Figma account or a network call except `npm install`.

```bash
npm install

# ── the claim's own numbers ────────────────────────────────────────────────
npm run eval                       # 162/162 as of evals/results.json
node -e "const r=require('./evals/results.json');console.log(r.passed+'/'+r.total)"

# 46 drift rows, per library
node -e "const b=require('./extract/computed/regate-baseline.json');
const by={};for(const r of b.rows)(by[r.library]??=[]).push(r.component);
console.log(b.recordedAt);for(const k in by)console.log(k,by[k].length)"

# the config:engine ratio
wc -l extract/computed/configs/*.json
cat extract/computed/*.ts core/*.ts | wc -l

# ── the engine audit (§3): no dispatch on library identity ─────────────────
grep -nE "=== *'(polaris|mui|astryx|tailwind|carbon)'" extract/computed/*.ts core/*.ts
# → no output. Then the four leaks, each a single line:
grep -n "PORTAL_PREFIX = " extract/computed/anatomy.ts          # L2
grep -n "includes('--')" extract/computed/lib.ts                # L1
grep -n "\^Polaris-" extract/computed/capture.ts                # L3
sed -n '52,58p' extract/computed/drift-check.ts                 # L4

# L1, measured — Carbon's stem is empty while its classes are present:
node -e "for(const l of ['button','mui/button','astryx/button','carbon/button']){
 const a=require('./extract/computed/out/'+l+'/captured-truth.json').anatomy[0];
 console.log(l.padEnd(16), JSON.stringify(a.signature), JSON.stringify(a.classes))}"

# ── overlays carry zero source facts (§8.1) ───────────────────────────────
node -e "for(const c of ['mui/dialog','mui/menu','mui/tooltip','carbon/modal','mui/button','carbon/button'])
 console.log(c.padEnd(16), require('./extract/computed/out/'+c+'/source-bindings.json').facts.length)"

# ── token binding vs degradation (§2) ─────────────────────────────────────
node -e "for(const l of ['polaris','astryx','mui','tailwind','carbon']){
 const j=require('./examples/'+l+'/tokens/'+l+'-minted.dtcg.json');let n=0,a=0;
 (function w(o){for(const k in o){const v=o[k];if(v&&typeof v==='object'){
  if('\$value' in v){n++;if(/^\{.*\}\$/.test(String(v['\$value'])))a++}else w(v)}}})(j);
 console.log(l.padEnd(9),'minted',n,'aliased',a,'literal',n-a)}"

# ── the cross-library fix record (§5): read the commit bodies ─────────────
git log -1 --format=%B 3e14f6f   # emit-html child drop → Polaris Avatar; relative back in flow
git log -1 --format=%B 6e76346   # block-flow root → five Polaris components
git log -1 --format=%B acb0342   # paint-order partition → Polaris Tag overlay
git log -1 --format=%B 8dad6b2   # text grow → Tailwind ToggleSwitch; FILL-on-absolute
git log -1 --format=%B 53792d3   # checked as a variant axis → Flowbite ToggleSwitch 3→6
git log -1 --format=%B f52c334   # box-padded text → this repo's own Pagination
git log -1 --format=%B 5c93c8a   # px() dropped rem → Astryx exposed it, Polaris + repo moved
git log -1 --format=%B b66e5a3   # out/<component> ledger collision across libraries
git log -1 --format=%B 0ce7c67   # inverse: a MUI-round regression repaired in Polaris
git log -1 --format=%B d10511c   # inheritance refusal: fires elsewhere, metrics UNCHANGED
git log -1 --format=%B 28f4d85   # Carbon control case, one engine change

# and the file lists that prove which libraries actually moved:
git show --stat 3e14f6f 6e76346 8dad6b2 28f4d85 | grep -E 'examples/|figma-sync/'

# ── the per-library engine-path flows (§7) ────────────────────────────────
npm run plugin:check             # MUI 14 / Astryx 13 / Polaris 12 / Carbon 10 bundles
```

Two commands are **not** in that list on purpose. `npm run extract:computed`
re-captures a library and needs a gitignored sandbox installed per the recipe in
that library's PROVENANCE. `npm run extract:computed:drift` costs ~6 minutes of
real Chromium and re-records `regate-baseline.json` when passed `--write`; run
it deliberately, alone, and say what moved.

---

## 11. What is claimed, and what is not

**Claimed, with receipts above:**
- No engine code dispatches on library identity.
- Four unrelated styling architectures and five vendors run through one
  pipeline, sharing one CSS-vars reader across three of them.
- Engine-change cost per library trends down, and the newest library
  (10 components, a fifth architecture) cost one expression — a latent bug.
- Fixes found via one library demonstrably repaired others in the same commit,
  with the sibling diffs reviewed rather than blind-repinned.
- 46 drift rows and 162 evals make cross-library damage a number.

**Not claimed:**
- That library knowledge lives *only* in config. It does not — see L1–L4.
- That onboarding is free. `classAllow` and `varPrefix` are expert work with a
  history of needing engine changes per styling method; that cost is gap G6 in
  [docs/18](18-user-flows.md), not a solved problem.
- That the supported set is "all design systems." It is React + Web Components
  on the web DOM, four styling methods, per [docs/16](16-sync-boundary.md).
  Everything outside degrades gracefully — correct pixels, poorer token names —
  and graduates via a community reader plugin under the open spec.
- Anything at all about Altitude.
