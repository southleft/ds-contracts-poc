# ENTERPRISE GAUNTLET — Carbon · Fluent 2 · Spectrum · Polaris vs the code-extraction pipeline

The owner's mandate: *"Pretend you're working on Carbon or Microsoft's Fluent, or Adobe
Spectrum or Shopify's Polaris. These are the types of systems this application is built to
maintain."* This report doesn't pretend — it RAN them. All four systems were shallow-cloned
from public GitHub (2026-07-12) and pushed through the repo's existing pipeline exactly as an
adopter would: `npm run extract:code` / `npm run diagnose` with a per-system
`extract.config.json`, plus BYO-token ingestion against each system's published token set.
Nothing in this repo was modified to make the numbers better; every workaround is named.

**Inputs (exact, reproducible):**

| System | Repo @ SHA | Adapter | Source root |
|---|---|---|---|
| Carbon | carbon-design-system/carbon @ `bc66fc71eae0d335f915ac6b01f013b78a6d2f89` | `react-tsx` | `packages/react/src/components` |
| Fluent 2 | microsoft/fluentui @ `bc5035bfcd53277a39075c596b14b9731020d1de` | `react-tsx` | `packages/react-components` |
| Spectrum | adobe/spectrum-web-components @ `afe0954b1505d0c28b1932d0b9c3f830536b08c0` (source ref) + **published `@spectrum-web-components/*@1.12.2` per-package `custom-elements.json`, 65 packages merged** | `cem` | merged manifest (2,510 modules) |
| Spectrum (rejected alt) | adobe/react-spectrum @ `b14cbd543940cc59d22ed190d2ee6053be1518d3` | `react-tsx` | `packages/@react-spectrum` |
| Polaris | Shopify/polaris @ `2b1ea88625e0613853ca8577c9acd1980a90f382` | `react-tsx` | `polaris-react/src/components` |

Clones live in the session scratchpad, not the repo. Commands per system:

```bash
git clone --depth 1 <repo>   # SHAs above
cat > <sys>.config.json      # { code: { adapter, root|manifest }, idPrefix, out }  (+ tokens for the BYO run)
npm run extract:code -- <sys>.config.json
npm run diagnose     -- <sys>.config.json
# SWC only: curl per-package custom-elements.json from cdn.jsdelivr.net/npm/@spectrum-web-components/<pkg>/
#           merge modules[] into one manifest; 3 packages publish none (clear-button, iconset, modal) — named skip
```

**Which Spectrum, and why.** Both Adobe repos were run. `react-spectrum` *appears* to extract
(421 components, all schema-valid) but the result is hollow and partly wrong: the public API
lives in the separate `@react-types/*` packages, so `Button` extracts with **1 prop**
(`children`), `TableView` with 1, and monorepo name collisions make the first-seen winner
arbitrary — the extracted "Switch", "Tag", and "Link" are **gradient illustration icons** from
`@react-spectrum/s2/spectrum-illustrations`, not the components. `spectrum-web-components`
through the CEM adapter is the tractable fit (the Shoelace lineage: a published manifest is
exactly what the adapter was built for), and it delivered 22/22 attempted census components.
SWC is the pick; react-spectrum's numbers are kept below as evidence, not as the Spectrum row.

---

## 1. Scoreboard

Census = 25 hard component categories (button, checkbox, switch, badge, tooltip, dialog,
menu, tabs, accordion, table, text-field, select/combobox, toast, pagination, breadcrumb,
avatar, card, popover, progress, slider, tag/chip, banner, skeleton, stepper, link), mapped to
each system's own names. "Attempted" excludes categories the system genuinely doesn't ship
(named in the table). "Schema-valid" is by construction — `proposeContract` refuses to emit
an invalid proposal — so the honest signal is proposed vs attempted, and what the proposal
*carries*. "Facts carried" = (contract props + events) / (extracted props minus platform
props), median over the census set.

| | Carbon | Fluent 2 | Spectrum (SWC/CEM) | Polaris |
|---|---|---|---|---|
| Census attempted | 24 (no avatar) | 23 (no pagination, stepper) | 22 (no pagination, skeleton, stepper) | 23 (no switch, stepper) |
| Census proposed | **20** | **0** | **22** | **23** |
| …of which hollow (0 props, silent) | 0 | — | 1 (Badge 0/3) | **5** (TextField, Badge, Tag, Toast, RangeSlider) |
| Schema-valid | 20/20 | 0 | 22/22 | 23/23 |
| Referee (diagnose) | exit 1 — **16 findings** | exit 0 (vacuously clean) | exit 0, 1,264 contracts hold | exit 1 — **3 findings** |
| Median facts-carried (census) | **78%** | **0%** | **73%** | **57%** |
| Whole library: extracted / named-skipped | 243 / 62 | 57 / **561** | 1,265 (118 non-icon + 1,147 icons) / 0 | 180 / 15 |
| Anatomy proposals (structure + bindings) | **0** | 0 | 0 (CEM has no styling channel) | **109** (+145 raw values, 351 foreign vars) |

Plain statements the table can't soften:

- **Fluent public-component extraction is 0%.** The 57 "extracted" components are storybook
  and docs helpers (`FluentDocsPage`, `RenderArgsTable`, `Toc`, …). Every shipping component —
  Button, Checkbox, Dialog, all 23 census attempts — was either named-skipped ("props type
  X not found in this file", 561 entries) or **silently invisible** (see failure class B).
  That's a finding, not a disgrace: two bounded adapter fixes recover 22/23 (measured, §3).
- **Carbon's referee findings are self-inflicted.** All 16 are the propose/diagnose
  disagreement on non-`on*` function props (class F) — not real drift.
- **Polaris is the best overall fit** (co-located `*.module.css` → 109 anatomy proposals, the
  only system with a styling channel today) yet has the *worst* census median because five
  headline components extract **silently hollow** (class C).
- **SWC's referee is clean but the adapter crashed first**: the published Spectrum manifests
  contain 7 events without a `name`, and `extract/adapters/cem.ts:82` (`eventPropName`)
  throws `TypeError: Cannot read properties of undefined (reading 'replace')`. The run above
  used a sanitized manifest with those 7 dropped — named here, since the pipeline itself
  couldn't name them.

## 2. Ranked failure classes

Ranked by props/components affected across all four systems. Every class is reproducible from
the committed configs + SHAs; example components are named.

**A. Imported/composed props type → whole component named-skipped.** The single biggest
class: 664 component skips total (Fluent 561, Carbon 62, react-spectrum 26, Polaris 15). The
`react-tsx` adapter is single-file by design; enterprise systems put the props type in a
sibling or another package.
*Carbon:* `Button` (`ButtonProps<T>` = generic alias to `PolymorphicComponentPropWithRef`),
`Tooltip`, `Accordion` (`PropsWithChildren<...>`). *Fluent:* `Avatar`, `Badge`, `Card` — every
component's `XProps` lives in a sibling `X.types.ts`. *Polaris:* `TextField`'s inner `Item`,
`ResourceItem`, `Loading`. *react-spectrum:* everything typed from `@react-types/*`.

**B. `as`-cast component exports → SILENTLY invisible.** `findComponents` reads variable
initializers but never unwraps `AsExpression`, so `export const Button = React.forwardRef(...)
as ForwardRefComponent<ButtonProps>` is neither extracted **nor skipped** — it violates the
repo's own "reported, never silently dropped" discipline. Verified by single-file probe:
extraction of Carbon `Popover/index.tsx` returns `extracted: []`, `skipped: [PopoverContent]`
— `Popover` itself vanishes.
*Fluent:* the `) as ForwardRefComponent<…>` idiom appears in **29 component files** (Button,
Checkbox, Switch, …) — this, compounded with class A, is why Fluent is 0%. *Carbon:*
`Popover` (`index.tsx:166`), `Tag` (`Tag.tsx:323` `TagBase as TagComponent`), `Link`
(`Link.tsx:159`), `FlexGrid`. The public names `Tag`/`Link` are absent even though
`TagBase`/`LinkBase` extract with 12/8 props.

**C. Intersection-of-named-refs → SILENTLY hollow (0 props, `resolved:true`).** `membersOf`
keeps only `TypeLiteralNode` members of an intersection; `type BadgeProps =
NonMutuallyExclusiveProps & MutuallyExclusiveInteractionProps` (all refs, even when the
referenced interfaces are in the *same file*) yields an empty-but-"resolved" API with **no
note**. A schema-valid contract with zero props for a 40-prop component is the worst outcome:
plausible, valid, wrong.
*Polaris (11):* `TextField`, `Badge`, `Tag`, `Toast`, `RangeSlider`, `IndexTable`, …
*react-spectrum (25):* `ClearButton`, `ColorArea`, `DialogTrigger`, … *Carbon (4, mixed
cause):* `RadioTile`, `TableBody` (extends-only interfaces — legitimately zero *own* props,
but indistinguishable from class C in the output — same receipt gap).

**D. Imported alias types at the prop level → kind `other`, never proposed.** 1,134 props
across the four systems classify `other` (Carbon 289, SWC 350, Polaris 285, Fluent 68,
react-spectrum 142) and are named in the report but carry nothing.
*Carbon:* `Button.kind` (conditional type over `ButtonKind`), `size` behind
`(typeof ButtonSizes)[number]` — the const-array-indexed-access idiom appears **15×** in
Carbon components (ButtonKinds, ButtonSizes, ButtonTooltipAlignments, …): the values are
*right there in the file* as `as const` arrays and still unreadable to one-hop alias
resolution. *SWC (CEM flavor):* manifest type texts are alias *names* not unions —
`ElementSize` (8×), `Placement`, `AlertBannerVariant`, `BadgeVariant` — which is why SWC
Badge carries 0/3. *Polaris:* `Tooltip.width/padding` (`TooltipWidth`), `ActionList.items`
(complex object arrays — legitimately out of scope, but binned identically).

**E. Styling channel absent for Sass / CSS-in-JS / shadow-CSS systems → anatomy 0.** The
css-module adapter requires a co-located `*.module.css`. *Carbon:* styles live in a different
**package** (`packages/styles/scss/components/button/_button.scss`) — 0/243 anatomies.
*Fluent:* griffel runtime styles (`useButtonStyles.styles.ts`, `makeStyles({...})` — note: the
style objects are **syntactic literals with 94 `tokens.*` references** in Button alone).
*react-spectrum S2:* `style()` macro literals (`s2/src/Button.tsx:312`). *SWC:* Lit shadow CSS
(`button.css`/`spectrum-button.css` co-located but not css-modules, and the CEM path reads no
CSS at all). Only Polaris (author-time CSS modules) exercises the channel — and proves it: 109
anatomy proposals with parts, states, and (with BYO tokens, §4) real bindings.

**F. Non-`on*` function props → propose skips them, diagnose then flags its own skip as
drift.** `proposeContract` notes "function-typed but not on* — skipped"; `parity/diagnose.ts`
counts the same prop as `[code AHEAD]`. Every diagnose finding in this gauntlet is this class:
Carbon 16 (`Slider.formatLabel`, `Pagination.pageText`, `DataTable.render`-style props),
react-spectrum 7 (`Picker.renderValue`, `TagGroup.renderEmptyState`), Polaris 3
(`Cell.setRef`, `IndexFilters.setMode`). The referee cries wolf on foreign systems out of the
box — an adopter's first diagnose is red for reasons the pipeline itself created.

**G. CEM manifest hardening gaps.** (1) Nameless events **crash** extraction (7 in SWC:
`DialogBase`/`DialogWrapper` TransitionEvent, `MenuItem`, `OverlayNoPopover`/`OverlayPopover`)
— the only hard crash in the gauntlet. (2) Base classes and controllers extract as components
(28 plain classes: `ButtonBase`, `InteractionController`, `HandleController`, …) and icon
packages flood the set (1,147 of 1,265 are `icons-workflow`/`icons-ui` elements) — real, but
an adopter needs a customElement/tagName filter to see their system. (3) `InteractionController`
declared in 2 modules → duplicate names survive.

**H. Token ingestion: no system publishes DTCG.** Detail in §4 — raw ingest is 0 tokens for
all four; mechanical wrapping recovers 100% of each set.

## 3. Adapter-gap analysis — where each architecture defeats the pipeline

**Carbon (Sass tokens + polymorphic TS).** Two independent walls. *API wall:* Carbon's
polymorphic-component convention (`ButtonProps<T extends ElementType>` via
`PolymorphicComponentPropWithRef`) defeats `membersOf` even though `ButtonBaseProps` (an
in-file interface with plain members) would carry nearly everything; and enum vocabularies are
`as const` arrays + `(typeof X)[number]`, one AST shape away from the existing
`literalUnion`. *Styling wall:* tokens are consumed in Sass in another package
(`@carbon/styles`), reached via classnames (`cds--btn--primary`), so the anatomy channel never
opens. Carbon *themes* however are the cleanest mode-corroboration data in the gauntlet: the
four published themes (white/g10/g90/g100) have **identical 306-key sets** — exactly the §3
PATTERN-TAXONOMY structural test for "this axis is a token mode, not API".

**Fluent 2 (griffel + .types.ts + as-casts).** Three stacked gaps, all bounded: (1) sibling
`X.types.ts` holds `XProps` (class A); (2) the export is always cast (class B); (3) styles are
griffel `makeStyles` hooks (class E). **Measured what-if** (scratchpad probe, no repo change):
concatenate `<X>.tsx + <X>.types.ts` and strip `as ForwardRefComponent<…>` before the existing
extractor → **22/23 census components extract, 130 props, 42 enum axes** (Button:
appearance/iconPosition/shape/size; Badge: 5 axes; MessageBar: intent/politeness/shape; …).
Accordion still fails (props composed from `@fluentui/react-utilities` types — cross-package,
the honest residue). Fluent's `ComponentProps<Slots>` pattern also means every slot is
declared in a typed `Slots` map — a future slot-extraction channel the pipeline doesn't read.

**Spectrum.** *SWC/CEM:* the architecture fits (published manifests, attributes with defaults,
events); the defeats are manifest-quality issues (class G) plus alias-name type texts (class
D) — the values exist in the package's `.d.ts`, one resolution hop outside the manifest.
*react-spectrum:* `@react-types/*` cross-package props are the definitive single-file defeat;
S2's `style()` macro is a second (class E). No amount of single-file cleverness fixes
react-spectrum — it needs cross-package type resolution or a `.d.ts`-based adapter.

**Polaris (CSS modules + tokens).** The architecture *matches* the pipeline — and that's what
makes its two losses precise: (1) class C hollow extraction hits its five headline components
because Polaris types props as unions-of-interfaces for mutually-exclusive APIs; (2) before
BYO tokens, all 351 `var(--p-*)` bindings were foreign. With BYO tokens (§4) Polaris becomes
the only system producing contracts with structure, states, *and* token bindings end-to-end.

## 4. Token ingestion — tokenCorpusFromJson / tokenIndexFromJson vs published sets

Sources tried: `@carbon/themes@11.76.1` (JS module, no JSON), `@fluentui/tokens@1.0.0-alpha.23`
(`webLightTheme`, JS module, no JSON), `@adobe/spectrum-tokens@14.14.0`
(`dist/json/variables.json`, 2,469 tokens, non-DTCG `sets`/`ref`/`value` shape),
Polaris tokens from the cloned repo (`polaris-tokens/src/themes/base`, `{value}` maps;
**no JSON is published in `@shopify/polaris-tokens@9.4.2`'s dist**).

| | Raw ingest (as published) | After mechanical DTCG wrap (`$value`) | Corpus (`tokenCorpusFromJson`) | `suggestFor('#ffffff')` |
|---|---|---|---|---|
| Carbon | no JSON exists → 0 | **272** loaded, 272 resolved (34 non-scalar skipped) | 272 semantic, 0 textStyles | ✔ `cds.background`, … |
| Fluent | no JSON exists → 0 | **459** / 459 | 459, 0 textStyles | ✔ `fluent.colorNeutralForegroundInverted`, … |
| Spectrum | `variables.json` → **0** (`$value`-less) | **2,469** / 2,469 (549 `{ref}` aliases resolve through the flat namespace) | 2,469, 0 textStyles | ✘ (values are `rgb(...)` strings — normalizer only handles 6-digit hex) |
| Polaris | no JSON published → 0 | **453** / 453 | 453, 0 textStyles | ✘ (`rgba(...)` values, same normalizer gap) |

**The live bind test (Polaris, the one system with a CSS channel):** re-running extraction
with `tokens: [polaris.dtcg.json]` (tree rooted at `p` so `p.space-100` hyphen-joins to
`--p-space-100`):

```
foreign-var notes  351 → 71     (280 vars now referee-resolved)
contract token bindings  0 → 48
raw-value reports  145 → 145    (unchanged — literals stay reported, never invented)
```

The 71 residuals are all *named* refusal classes, not binding misses: `--pc-*`
component-private vars (correctly foreign), `--p-breakpoints-*` inside media queries, and
`var()` inside `calc()`/shorthand ("not invertible to a single binding" — the note says so).

Named limits found: (1) `TokenCorpusInput` hard-codes the repo's 4-tree layout
(primitives/semantic/light/brandDefault) — foreign sets must be shoehorned into `semantic`;
(2) derived text styles require the `font.<group>.size` naming convention — 0 for all four
systems; (3) `suggestFor` normalizes only hex + numbers, so Spectrum/Polaris `rgb()/rgba()`
palettes get no nearest-token candidates; (4) none of the four publish DTCG — a
tokens-adapter layer (JS-module reader + `value`-key and `sets`-format readers) is the real
BYO story, and the wraps above prove it's mechanical.

## 5. The ten engine/adapter changes that would most raise the enterprise numbers

Ranked by measured props/components unlocked per unit of bounded work. "Taxonomy" = status in
`extract/figma/gauntlet/PATTERN-TAXONOMY.md` (which ranks the *design-side* proposer).

| # | Change | Unblocks | On the taxonomy program? |
|---|---|---|---|
| 1 | **Module-scope type resolution**: extend the type table to sibling files in the component directory (`X.types.ts` first) + one-hop *local import* resolution | Fluent 0→22/23 census (measured); Carbon (most of 62 skips); Polaris 15; react-spectrum partially | **No** — code-side; named as the known gap in the Mantine pilot README ("cross-file alias resolution, a known roadmap item") |
| 2 | **Unwrap `AsExpression`/`satisfies` in `findComponents`** + record cast-alias exports (`const Tag = TagBase as T` → alias of TagBase) | Fluent (29 files — prerequisite to #1 landing at all); Carbon Popover/Tag/Link/FlexGrid. Converts a **silent** loss to carried (or at worst named) | **No** — new finding; it repairs a violated invariant (nothing silent) |
| 3 | **Resolve named refs inside intersections** (one hop, same module scope as #1) + a **hollow receipt**: a 0-prop extraction must say *why* | Polaris TextField/Badge/Tag/Toast/RangeSlider/IndexTable; react-spectrum 25; Fluent `ComponentProps<Slots> & {…}` | **No** — new finding; the receipt half is invariant-repair |
| 4 | **Const-array enums**: `(typeof Xs)[number]` where `Xs` is an in-file `as const` string array → enum values | Carbon (15 vocabularies incl. Button kind/size — its headline axes) | **No** |
| 5 | **CEM hardening**: tolerate nameless events (receipt, don't crash); expand alias type-texts through the package's `.d.ts` when adjacent; filter non-customElement classes behind a flag; dedupe cross-module declarations | SWC (crash + Badge-class 0-carries + 28 phantom classes); every Lit/FAST adopter | **No** |
| 6 | **BYO-token adapter layer**: readers for JS-module themes (Carbon/Fluent), `value`-key maps (Polaris), `sets` format (Spectrum); rgb()/rgba() normalization in `suggestFor`; free the 4-tree corpus input | All four (3,653 tokens wrapped mechanically in this gauntlet; Polaris foreign-vars 351→71, bindings 0→48 measured) | **Supports taxonomy #1 (P17/§3)** — multi-mode sets (Carbon's four identical-key themes, Spectrum's light/dark `sets`) are precisely the mode-corroboration input §3 needs |
| 7 | **CSS-in-JS token harvest**: parse griffel `makeStyles({...})` and S2 `style({...})` object literals (syntactic, no runtime) for token refs per slot → part `tokens`/`states` | Fluent (94 `tokens.*` refs in Button's styles file alone); react-spectrum S2 | **Adjacent** — feeds P16 (per-value token functions) and P18 (part-level states) with code-side facts |
| 8 | **Propose/diagnose parity on non-`on*` function props** (render props/formatters): one shared classification, receipt as code-only, referee stops flagging its own skip | Carbon (16 false findings), react-spectrum (7), Polaris (3) — makes first-contact diagnose honest | **No** — referee-integrity fix |
| 9 | **Compiled-CSS anatomy route**: compile the system's Sass (`@carbon/styles`) or read shipped shadow CSS (SWC's co-located `button.css`), map component classnames → parts | Carbon (anatomy 0/243 today); SWC; any BEM/Sass system | **Adjacent** — the data source that would let P18 (part-level states) receipts become proposals for code-first orgs |
| 10 | **Monorepo identity discipline**: scope `seen` by package/export path; receipt name collisions instead of first-wins | react-spectrum (Switch/Tag/Link silently shadowed by illustration icons — *wrong component extracted*, worse than none); Fluent (helper-name collisions) | **No** — invariant repair (a collision is a silent decision today) |

**Does the enterprise gauntlet confirm or reorder PATTERN-TAXONOMY's ranking?** It confirms
it *within its scope* and adds a tier below it. The taxonomy ranks design-side proposer
hardening (mode-axis promotion #1, `preferredValues`→`accepts` #2, repeated-children #3); this
gauntlet's code-side numbers say the mode-axis bet is right — Carbon/Fluent/Spectrum all ship
multi-mode token sets with identical key structure across modes, so the §3 corroboration gate
has real data to run on (via change #6), and Carbon documents themes as token layers, never
props, exactly as §3 assumes. Composite frequency also confirms P9/P19: menu/tabs/table
compound families dominate all four inventories (Carbon `Menu*`/`Table*`/`Dialog*`, SWC
`Menu/MenuItem/MenuGroup`, Fluent `Menu`+9 sub-packages). What the taxonomy never ranked —
because its scope was the Figma proposer — is the tier this gauntlet exposes: **type-system
legibility (changes 1–4) gates everything on the code half**. For these four systems the
sequencing is: land 1–3 (else two of four systems contribute ~0 code-side facts), then #6
(tokens are the design↔code hinge and P17's fuel), then the taxonomy's own program in its
existing order.

## 6. Design-side prerequisites (owner actions for the Figma half)

The reconciliation half needs each system's kit dumped read-only (duplicate to drafts →
run `extract/figma-dump.js` in the file, or use the REST path with a URL). Current kits:

- **Carbon** — official IBM: **(v11) Carbon Design System**,
  https://www.figma.com/community/file/1157761560874207208/v11-carbon-design-system
  (all four themes; Code-Connected to `@carbon/react` — the reconciliation should be
  unusually clean, which makes surviving drift more credible).
- **Fluent 2** — official Microsoft: **Microsoft Fluent 2 Web**,
  https://www.figma.com/community/file/836828295772957889/microsoft-fluent-2-web
  (recently refactored with variables aligned to code).
- **Spectrum** — **no official Adobe Figma kit found** (Adobe's own UI-kit page historically
  ships XD; verify inside Figma search before settling). Strongest community file:
  **Adobe Spectrum Design System**,
  https://www.figma.com/community/file/1211274196563394418/adobe-spectrum-design-system —
  it models Spectrum 1, which *matches* SWC 1st-gen (the extraction above), so the pairing is
  coherent; name it as community-made in any published numbers.
- **Polaris** — Shopify publishes two: **Polaris Components (Legacy)**,
  https://www.figma.com/community/file/1571239587122046021/polaris-components-legacy —
  matches `polaris-react` (this gauntlet's code side) → use this one for reconciliation;
  and **Polaris UI Kit – Community**,
  https://www.figma.com/community/file/1554895871000783188/polaris-ui-kit-community —
  matches the newer Polaris *web components*, NOT `polaris-react`; pairing it with this
  extraction would manufacture false drift.

Expected first-contact result, from the Shoelace precedent: state-as-variant axes everywhere,
boolean-axis spellings, coverage drift both ways — the reconciliation report is the product.

## 7. Honesty appendix

- **Read-only run.** This file is the only repo write. Clones, configs, merged manifests,
  outputs, and probe scripts live in the session scratchpad. Nothing committed.
- **The SWC manifest was sanitized** (7 nameless events removed) because the unsanitized run
  crashes (§2-G). Every removed event is listed in §2-G. All other numbers are from unmodified
  inputs through unmodified pipeline code.
- **The Fluent 22/23 recovery is a simulation** (file concatenation + cast-strip in
  scratchpad, run through the real `extractFromSource`), quantifying changes #1+#2 — it is
  not a shipped capability.
- **Schema-valid 100% is partly survivorship**: the validator refuses bad proposals, so
  validity is guaranteed for whatever is emitted; the honest metrics are proposed-vs-attempted
  and facts-carried.
- **Referee cleanliness is baseline-by-construction** (contracts checked against the same
  source they were extracted from — the Shoelace pilot's caveat applies). Its value here is
  that it ran at all on four foreign systems, and that its 26 total findings across
  Carbon/Polaris/react-spectrum are all pipeline self-disagreements (class F), which is
  itself the finding.
- **Census mapping judgment calls**: Carbon tag/link measured via `TagBase`/`LinkBase` (the
  public `Tag`/`Link` are class-B silent); Polaris popover via `PopoverComponent` (export
  name); SWC select via `Picker`. Carbon has no Avatar; Fluent v9 no Pagination/Stepper; SWC
  no Pagination/Skeleton/Stepper packages; Polaris no Switch/Stepper — all counted out of
  "attempted", never as failures.
- **Versions**: `@spectrum-web-components/*@1.12.2` (65 manifests; `clear-button`, `iconset`,
  `modal` publish none), `@carbon/themes@11.76.1`, `@fluentui/tokens@1.0.0-alpha.23`
  (webLightTheme), `@adobe/spectrum-tokens@14.14.0`, Polaris tokens from repo SHA above.
  Extraction host: this repo at working tree of 2026-07-12 (post `075e893`).
