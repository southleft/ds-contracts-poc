# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — with one clarification about what the version refers to. The version in this file (and in `package.json`) tracks the **reference implementation**: the generators, differ, extractors, catalog, and eval suite in this repository. Individual component contracts carry their **own** semver, governed by the contract change policy ([docs/02 § Versioning & change policy](docs/02-contract-spec.md#versioning--change-policy)) — a Button at v1.5.0 and a repo at v0.1.0 are statements about two different things. Pre-1.0 on the repo signals that the spec shape may still move.

## Design→code census (canvas → contract → React/WC, deterministic)

- **dump v1.32** (both producers): the set's own `description` + `documentationLinks` are captured; the REST route now sends `plugin_data=shared` and reads back the `ds_contracts` emit stamps (contractId / specHash / version / propNames / semantics+roleException / statePreviewAxis, per-TEXT fontWeightVar / lineHeightVar) — a REST dump of a stamped set no longer forgets its own identity, and EXACT-mode proposal works over the REST route (variant tuples cross-validated against the structured VARIANT definitions, never invented from names alone).
- **schema 18 additive**: optional `documentationLinks: [{ uri }]` on the contract — carried Figma→contract by propose, contract→Figma by the emitter, and into code as JSDoc `@see` lines, Storybook docs links and the WC file header.
- propose carries an UNSTAMPED set's description VERBATIM (the designer's words; provenance rides a note), names a stamped set's emit caption, names manual grid cells the carried grid cannot place, and names the aspect-ratio lock on elided slot content.
- **`census:check -- --phase design-to-code`**: the committed fixtures (`extract/figma/fixtures/census-d2c/`) re-run map → propose → validate → generate (React + stories + Web Components) twice in memory; the gate holds SILENT = 0 (every canvas fact CARRIED or NAMED — extract/figma/census/d2c-facts.ts), byte-idempotence (sha256 per generated file), the committed per-set rows, the render pairs (`canvas-*.png` beside `code-*.png`) and the recognisability verdicts. Receipt: `parity/receipts/v1/DESIGN-TO-CODE-CENSUS.md`.

## [Unreleased]

### Honesty pass — retired RC framing (2026-08-30)

- README **What's released vs what's proven** replaces **Release-candidate
  status**. Recipe-IR never shipped as an npm RC; published `@ds-contracts/*`
  and GitHub `v1.0.0-rc.1` are the pre-pivot envelope; product v1 stays
  incomplete (F1). Playground, spec site, package READMEs, docs/27, ROADMAP,
  and CONTRIBUTING now say the same thing in the places a reader hits first.

### Recipe-IR pivot landed on main (2026-08-30)

- Merge `4caebfc5b`: archetype recipes + canonical Figma-capability IR +
  named-or-carried receipts replace the universal-contract envelope as the
  **v1 proof surface**. The `*.contract.json` path still ships (CLI,
  playground, Journeys A–C); it is not what v1 proved.
- Five archetypes have stayed live Scratch mints and owner-signed human
  grades: Button (`183:69150`), Input (`115:295378`), Combobox
  (`163:35981`), Table (`173:48924`), Calendar (`181:64873`).
- Product **v1 remains incomplete**. F1 (whole-corpus / unseen-library on
  the recipe path) is unmet. `overallSuccess` is not flipped for Button,
  Input, Combobox, or Calendar (Table keeps the `true` its v32 record
  already set). Hashed RECORDs are not restamped.
- Named leftover work: Combobox chrome remint after hardening; signed
  cleanup of older Calendar Scratch pages; npm publish deferred and not a
  v1-proof substitute.
- **No semver bump. No npm publish.** Published GitHub releases
  (`v1.0.0-rc.1` and earlier) predate this pivot and still describe the
  universal-contract RC.

### Phase 2 closed out — every exam construct carried or named (152/152)

- **The held-out kit's last two silences are closed** (docs/23 §D.29). The
  Card Inline Image SLOT's FIXED 308px width gets its `FC-GEOMETRY-EXCLUDED`
  receipt per variant (`nameFixedChildGeometry` no longer skips an axis when
  any occurrence fills it), and its `fillHeight` under mixed parent modes is
  named per variant (`nameCrossAxisFillByVariant`; `crossAxisFillByProp`
  gained the height twin; the native-SLOT branch now walks the same
  cross-axis doors as the FRAME branch). `npm run conformance:canvas`:
  **152 cases · 152 PASS · 0 RED-EXPECTED**; `accuracy/grammar.json` pins
  CARRIED 105 · LEDGERED 38 · REFUSED 9; `exact-proposal:check` §47–§48.
- **A native SLOT's primary-axis FILL is `layout.grow`** (r10). The SLOT
  branch of `buildPart` reads `primaryAxisGrow` — the one rule every FRAME
  part inverts through, extracted rather than copied — and
  `emit-figma-script`'s slot spec lowers `layout.grow` to
  `layoutSizingHorizontal FILL` like every other part class. Two new
  conformance cases (`slot-primary-axis-fill`, `rest-slot-primary-axis-fill`,
  CARRIED); `exact-proposal:check` §49; `emitters:check`. The slot's own
  interior auto-layout is still not inverted — named, docs/23 §B.24.
- **The Flowbite eight carry their Figma identity** (docs/23 §D.30).
  `bindings.figma.anchors = { fileKey, nodeId, componentSetKey }` on all
  eight demo contracts, each verified read-only against the live file; the
  eight `*.figma.js`, `GENESIS-BATCH.figma.js` and `tailwind.bundle.json`
  re-emitted (`flowbite-bundle-fresh:check`). The specHash moves for all
  eight because `anchorKey` is inside the hashed spec; the next Apply
  re-reconciles in place by stamp, then by key. The plugin still plans
  against the open file; the standalone console scripts now refuse any other
  file by name (`WRONG FILE`). Recovery unchanged
  (`flowbite-dump-propose:check`, 8 stems verified-exact). Consequence for
  Code Connect (PR #25): the eight as committed now EMIT
  `code-connect/<Name>.figma.tsx` with the URL built from the live anchors;
  `code-connect:check` asserts that, and that the same eight with the
  fileKey stripped still refuse by name. The anchors ride the tailwind
  authored-facts ledger (eight rows on `bindings.figma.anchors`), so
  re-promotion still reproduces the committed contracts byte for byte
  (`promote-generalization`; MINTED.md quotes 14 applied rows).
- **Four first-party sync scripts regenerated** (`figma-sync/50-toast.js`,
  `54-topnav.js`, `batch-04.js`, `batch-05.js`): the Toast and TopNav
  `children` slots declare `layout.grow: true`, which the slot spec used to
  drop on the way to the canvas; it now lowers to `layoutSizingHorizontal
  FILL` (`grow`/`fillW` on the slot spec). `evals/golden.json` moved for
  exactly those four files.
- **Docs truth pass.** docs/23 §B.24–B.28 and §D.12–D.30, docs/26's
  commands, BETA, docs/00, README, ROADMAP, NORTH-STAR, RELEASE_CHECKLIST,
  GET-STARTED and the package READMEs re-read against the tree; every count
  re-derived (`docs:check`).

### BREAKING — `@ds-contracts/schema` 17.0.0-rc.1: contract-level `bindings` (the vendor-neutral hoist)

The contract is billed as vendor-neutral — props spell their design side as
`bindings.figma.*` and their code side as `bindings.code.*` — yet the
2026-08-22 audit found four Figma-only fields outside that namespace:
`anchors.figma`, `figmaRepresentation`, `figmaStatePreviews` and
`slot.figmaProperty`. Schema 17 moves them under `bindings.<surface>` at
every level. This is a pure rename; nothing is loosened, tightened or retyped:

| v16 | v17 |
|---|---|
| `figmaRepresentation` | `bindings.figma.representation` |
| `figmaStatePreviews` | `bindings.figma.statePreviews` |
| `anchors.figma` | `bindings.figma.anchors` |
| `anchors.code` | `bindings.code.anchors` |
| `<part>.slot.figmaProperty` | `<part>.slot.bindings.figma.property` |

Every old spelling is REFUSED BY NAME with the new spelling in the message
(`LEGACY_V16` in the Zod document — tombstone fields, not a silent
"unrecognized key"). The codemod is `ds-contracts migrate <paths..> [--check]`
(`npm run contracts:migrate` / `contracts:migrate:check` for the whole
tree), built on the ONE implementation the schema package exports
(`migrateDocumentToV17`): it rewrites every JSON document that embeds a
contract in key order, keeps each file's own indentation / trailing newline /
`\uXXXX` convention, and refuses by name any file it cannot round-trip
byte-for-byte rather than reformat it. 812 committed JSON files were
rewritten (contracts, seeds, bundles, proposals, receipts — 791 by the CLI, 21
hand-formatted ones by a text-level pass that preserved their inline
formatting); every generated CODE surface is byte-identical (`src/`, the
three storybook trees, the emitted CSS/TSX/WC), and every surface that embeds
a contract (the 60 first-party figma-sync scripts, 8 libraries' figma scripts,
GENESIS batches and bundles, the golden manifest, the plugin engine receipt)
was regenerated per its recipe. `@ds-contracts/core` now requires
`@ds-contracts/schema@^17.0.0-rc.1`. The `$extensions`-style alternative was
rejected in the schema's own comment: the design surface is a first-class
conformance target, props had already established the short surface keys,
and unknown surface keys stay refused. docs/02 § Bindings, docs/14,
spec/normative.md v0.2 and CONTRIBUTING § Contract change policy carry the
rule.

### Added — `@ds-contracts/core` (packages/core, slice 1)

The emitter contract is now a published package: `Emitter` / `EmitterCtx` /
`EmittedFile`, the registry (`emitters`, `emitterByName`, `getEmitters`,
`registerEmitter`), the DTCG token resolver (`tokenInventoryFromJson`,
`flattenTokens`, `makeResolveLiteral`, `collectTokenPaths`, `aliasTarget`,
`px`, `pxOrNull`), `kebab`, and the contract-provenance helpers. The repo's
`core/tokens.ts`, `core/contract-provenance.ts`, `core/emitter.ts` and
`extract/types.ts` (`kebab`) are re-export shims over `packages/core/src` —
one implementation, zero behaviour change (golden byte-identical). The CLI and
`@ds-contracts/emitter-web-components` import these from `@ds-contracts/core`
(bundled from source via tsconfig `paths` + esbuild `alias`). The
web-components README's unresolvable `'ds-contracts core'` specifier is fixed.
`npm run verify:published` packs schema + core + emitter-web-components + cli,
installs the four tarballs into a temp project with no path back to this repo,
and runs `ds-contracts generate` over the Flowbite eight with a throwaway Vue
emitter that resolves a token through `@ds-contracts/core` alone, plus the
web-components emitter from its tarball. Dependency policy: core depends on
`@ds-contracts/schema` and nothing else (the smoke refuses otherwise).

### Added — `@ds-contracts/core` (packages/core, slice 3: the cheap pure siblings)

Four more pure modules are package source, each a verbatim move with a root
re-export shim: `core/emit-tokens-css.ts` (`tokensCssLayers`,
`emitTokensCss`, `cssVarName`, `cssValueOf`, `referencedCssVars`,
`mentionedCssVars`, `undefinedCssVars` — the `tokens.css` every generate
shell writes), `core/grid-css.ts` (the A2 grid CSS inversion parsers +
`GRID_STRUCTURAL_PROPS`; its `GRID_REFUSALS` import now reads
`@ds-contracts/schema` directly), `core/canvas-code-plan.ts`
(`plannedCodePaths`, `canvasCodePlan`, the provenance sentence, the
proposal file-name spellings) and `core/figma-names.ts` (`camel`,
`canonicalPropName`). Layout: `packages/core/src/{emit-tokens-css,grid-css,canvas-code-plan,figma-names}.ts`;
the CLI's `generate`, `figma` and `propose-pr` commands import the moved
names from `@ds-contracts/core`. Zero behaviour change: golden
byte-identical; the RC tarball allowlist lists the eight new dist files; the
plugin engine receipt is re-recorded (the bundle's input list names the new
paths).

### Added — `@ds-contracts/core` (packages/core, slice 2: the analysis layer)

The half of `core/emit-react.ts` that is a contract fact rather than a React
projection is now package source: `validateContract` (the deep referee —
published with its append-to-`errors` / icon-map signature as-is),
`generateCss` + `stripCanvasOnlyChannels`, multi-root anatomy
(`rootElementsOf`, `topRoots`, `topRootNames`, `isMultiRoot`), the prop
classifiers (`isEnum` … `textDefault`), the A2 grid CSS helpers
(`gridCellPlan` and siblings), and the fact tables (`NATIVE_ROLE_HOSTS`,
`PART_STATE_CHANNELS`, `UA_*`). `ELEMENT_META` and `holderDeclaresPosition`
were hoisted out of the TSX half first — the analysis layer read them, and
they are contract facts, not React facts. Layout:
`packages/core/src/{anatomy,elements,grid,validate,css}.ts`; root
`core/emit-react.ts` keeps `generateTsx` / `generateStories` / `emitReact`
and re-exports every moved name, so every `./emit-react.js` import
(emit-html, emit-react-inline, emit-figma-script, the check scripts,
`scripts/generate-components.ts`) compiles unchanged. The web-components
emitter and the CLI's promote step now import the moved symbols from
`@ds-contracts/core` directly. Because the moved modules VALUE-import
`@ds-contracts/schema`, every in-repo resolver pins that specifier to
`packages/schema/src` (tsconfig `paths` at root / cli / emitter-web-components,
esbuild `alias` in the two package builds and the plugin-engine bundle, vite
`resolve.alias` in playground + dashboard) — one Zod document per bundle,
never `packages/*/dist`. Zero behaviour change: golden byte-identical; the
plugin engine receipt is re-recorded (+35 bytes, 124 → 131 inputs).
`npm run verify:published`'s Vue emitter now calls `validateContract` +
`generateCss` from the tarball and the smoke refuses on the first byte where
that CSS differs from the in-repo `core/emit-react.ts` output.

### Added — Phase 0, one truth (2026-08-22, PR #18)

No feature work: the panel describes the engine again. `evals/run.ts` stamps
every full-run record with the commit it measured and whether the tree was
dirty, takes `--record <path>`, and `npm run eval:record:check` refuses a
record with no provenance, a dirty-tree record or one from a commit that is
not an ancestor of HEAD (fast lane), and in the full lane compares CI's own
measurement against the committed record row by row. `npm run schema:fresh`
refuses when either committed `contract.schema.json` differs from the Zod
document. `.github/scripts/lane-coverage.ts` expands composite scripts, so
`npm run maintain` ≡ fast + full leaves and a gate that runs only inside a
composite cannot hide; CI checkouts are full-history so ancestry can be
proven. `maintain` is split into the token-free `maintain` and
`maintain:visual` (`FIGMA_TOKEN` + the Figma PNG cache), and `maintain:visual`
runs in the catalog-visual lane with the repository's secret. The
visual-truth astryx floor is a named advisory rather than a standing red.
The promoter gains an authored-facts ledger (`examples/<lib>/authored-facts.json`)
so a hand-authored canvas fact survives re-promotion. Every receipt was
regenerated by its own command rather than edited: 8/8 libraries' Figma
scripts, the golden manifest, the plugin engine receipt, both schema
projections, the dagger census, the per-platform catalog-visual baselines
(`baseline.darwin.json`, `baseline.linux.json`), the child-wider baseline.
The token prune shipped opt-in (`globalThis.DS_PRUNE_TOKENS`; it had deleted
style-bound variables) and exact projection is strict again (an unrecovered
preview cell is an `EXACT_ROWS_MISSING` refusal). The golden-path receipt was
re-run on a fresh clone at eight stems.

### Fixed — Phase 1, named or carried (2026-08-22, PRs #19, #21)

Eight verified silent losses, each raised by one agent and confirmed by a
second told to refute it, each closed test-first with the check in
`maintain` and the fast lane:

- **`anatomy.root.attrs` reached only the static HTML target** — React and
  WC emitters dropped root `aria-*`, `type`, `role` and `href` (shipped link
  components could not link). Carried on all four code targets; one root
  role claim; WC `statesByProp` emitted. `root-attrs:check`.
- **WC emitted multi-placeholder part refs with the braces intact** (invalid
  CSS, the part colour lost). One rule per value tuple, byte-compared against
  React's `generateCss`; `states` refs with two or more placeholders expand
  on every code surface; a placeholder naming no axis refuses by name.
  `emitters:check`.
- **Child-part state-only channels vanished under `verified-exact`** —
  carried as the part's `states.<state>` channels or NAMED per
  part+state+channel. `exact-proposal:check` §30.
- **The recovered ToggleSwitch drew its thumb outside the track** — the
  holder of a `stylesWhen`-absolute child declares `position: relative`.
  §31.
- **Per-fact canvas receipts collapsed to a bare `†`** — `codeOnlyFacts`
  `{part, kind, channel, value, reason, variants}` ride the compiled data,
  `bundle.codeOnlyFacts`, plugin data `ds_contracts/codeOnlyFacts`, the
  plugin run report and `figma bundle` stdout (54 on the Flowbite eight,
  2,321 corpus-wide). `code-only-facts:check`; the dagger census counts named
  facts beside daggers.
- **The visual gate could not see geometry** — every catalog row now holds
  both content boxes within ±4 device px of a per-platform baseline;
  `--self-test` red-tests nine refusals; first catch: three `cbds-dialog`
  cells moved 8/8/32 px under green pixel scores.
- **The token runtime wrote `[object Object]`, added Dark unguarded, and
  reverted designer values** — composite `$value`s refused by name at bundle
  and plan time; Dark only when carried; value edits named as
  `variableDrift` and kept unless `DS_OVERWRITE_TOKENS`.
  `token-set-prune:check`.
- **Generated code referenced custom properties nothing defined** —
  `generate` emits `tokens.css` (`:root` + `[data-theme="dark"]` +
  `[data-brand=…]`) beside the components for every code target; `index.ts`
  and stories import it; referenced ⊆ defined or refuse by name.
  `css-vars:check`.

Also: `figma bundle` takes the layered `--tokens` grammar `generate` already
had (a directory, `slot=file`, `--modes light,dark`; `tokenSet.layers`), so
the first-party corpus rides the bundle and a refusal is ONE named list
rather than one per paste (`first-party-bundle:check`); a root that IS the
text node draws (`root-text:check`); `literals.color` is carried as the text
fill and `applyLiterals`' silent `default: break` is gone; the emitted Figma
runtime's thirty bare `catch {}` sites push named `FC-RT-*` degradations;
propose carries boolean axes, italic regardless of the weight stamp,
`clipsContent` on pipeline-drawn sets, and writes `captured.dtcg.json` (one
tree per Figma mode) or names its absence; `conformance/canvas.ts`
(`npm run conformance:roundtrip`) measures the canvas half of every
CARRIED/LOWERED conformance case through the plugin engine, the dump and
propose on a decrease-only ratchet — 0 SILENT (aspect-ratio is lowered to a
fixed height when a bound width exists and named either way);
`extract/figma/dump.plugin.js` `TARGET_SETS` defaults to every local set
(it shipped with the repo's three fixture names) and a non-empty list refuses
by name on a missing set; every dump degradation names its CSS channel; the
hop-4 literal lifts start at `drawnByThisPipeline` (they had run on unstamped
foreign dumps and turned fourteen C5 replay evals red);
`console-loop-canvas-drift-probe` reads a committed `EMIT-SPECS.json`
receipt instead of a gitignored directory.

### Fixed — Phase 2, the held-out exam and its fix rounds (2026-08-22 → 23, PRs #22, #23)

`parity/receipts/phase-2/FIGMA-DS-EXAM.md`: a hand-built "Figma Design
System" kit this engine had never seen, through the REST Journey A path.
Before any fix: 3,556 canvas facts, 1,502 carried · 1,759 named · **295
silent** · 8 wrong-name · 25 should-carry; Button and Card not
recognisable; nineteen canvas conformance cases authored RED-EXPECTED before
the engine was touched. After rounds 1–2, same file, same token: **1,594 ·
1,960 · 2 · 0 · 0**. What changed:

- **REST honesty** — the `/variables/local` 403 is classified once as a
  missing `file_variables:read` scope with its one-line fix (it had been
  reported as "Enterprise" 1,595 times); the mapper's receipts ride the dump
  as `_degradations` and repeat in `figma-proposals.md` instead of living on
  stderr; `captured.dtcg.json` is written on the REST path when the scope
  allows; SLOT property definitions are kept with a `{guid}` default and
  `preferredValues` carried AS RETURNED (`[]` is an UNCONSTRAINED swap, by the
  designer's own declaration, not "not captured").
- **Dump v1.31** (REST and plugin, mirrored): `fillHeight`,
  `text.fontFamily` / `text.textAlign`, `effectStyle` / `effectStyleKey`,
  `effects[].bound`, `reactions`, `hostOverrides` / `textOverrides`,
  `fixedSwaps`, `itemReverseZIndex`, `targetAspectRatio` — each carried as a
  declaration or named with the node, the variant and the reason.
- **Propose constructs** — the set's DECLARED axis default wins over the
  first variant; a root fill absent in some variants mints `#00000000` for
  the absent ones (the reason Button rendered white-on-white); a state that
  unsets a channel is named; SLOT FRAME children and nested INSTANCE_SWAP
  fixed values are named; a GRID root with a fit row gets one spelling.
- **`generate` refuses per contract** — a contract that fails to parse,
  validate or emit is refused BY NAME (and anything composing it); the rest
  are written; exit 1 with the list. The exam's 80 proposals now land 78/78
  first try and type-check.
- **Prop/DOM collision rule** (`packages/core/src/prop-collision.ts`, table
  extracted from `@types/react` + `lib.dom`): a prop or slot named like a DOM
  attribute is `Omit<>`-ed from the React base attrs type and named in the
  header; a prop that is an `HTMLElement` member gets no WC accessor.
  `prop-collision:check` joins `maintain`.

`npm run conformance:canvas` at that point: 150 cases, 148 PASS, 2 RED-EXPECTED
— the two silences left (both the Card Inline Image SLOT: a FIXED width
skipped when any occurrence fills; `fillHeight` under mixed parent modes)
were pinned by name, not fixed (closed below, docs/23 §D.29). Card remains
not recognisable with every loss named (docs/23 §B.26).

### Changed — the `maintain` team command

`npm run maintain` is fifteen token-free steps and every one of them is a
fast- or full-lane step (`ci:lanes` refuses otherwise):
`string-boolean-coercion:check`, `token-set-prune:check`,
`exact-proposal:check`, `flowbite-bundle-fresh:check`, `plugin:check`,
`flowbite-dump-propose:check`, `extract:figma:visual:anchors`,
`functional:flowbite`, `parity:flowbite`, `root-attrs:check`,
`css-vars:check`, `code-only-facts:check`, `root-text:check`,
`first-party-bundle:check`, `prop-collision:check`. `npm run maintain:visual`
is the Figma-rendered catalog gate (pixels AND geometry) and runs in the
catalog-visual lane.

### Coordinated release candidate

> Historical (pre-pivot). These source versions describe the
> **universal-contract** envelope. Recipe-IR never shipped as an npm RC;
> GitHub `v1.0.0-rc.1` predates merge `4caebfc5b`. See [Unreleased](#unreleased).

The source tree stages repository `1.0.0-rc.1`,
`@ds-contracts/cli@0.5.0-rc.2`, `@ds-contracts/schema@17.0.0-rc.1` (the
BREAKING `bindings` hoist above), `@ds-contracts/core@0.1.0-rc.1` (new), and
`@ds-contracts/emitter-web-components@0.4.0-rc.2`. These are source versions,
not publication claims. Registry checks on 2026-08-04 reported npm `latest` as
CLI `0.4.0`, schema `16.0.0`, and emitter `0.3.0`.

The RC adds release gates for deterministic v1 evidence, atomic generation,
contract provenance, static empty-content refusal, per-variant canvas drift,
cross-surface catalog visuals, dependency/security review, package smoke and
coverage, and live deployment freshness. The exact release mechanics,
migration review, cross-platform verification, human approvals, and rollback
procedure are in [docs/27](docs/27-release-process.md).

**Repository history note:** no `v0.7.0` tag currently exists. The repository
version was introduced at commit
[`cd886e97`](https://github.com/southleft/ds-contracts-poc/commit/cd886e97a2f45464d1b0883a2adce3efab6acdaa)
on 2026-07-20. The release owner must either approve a signed historical tag
pointing to that exact commit or record in the GitHub release notes that the
tag was intentionally omitted. This changelog does not invent or imply an
existing tag.

The eight-day arc from `0.7.0` (2026-07-20) to HEAD (`f3b9bbf`, 2026-07-28): **110 commits** and the eval suite **129 → 176**. Four libraries joined the corpus in this window — MUI, Flowbite/Tailwind, Carbon and Altitude — taking it to **seven distinct libraries across five styling architectures**. A standing offline drift instrument was built and grew to **54 rows across six libraries**. And the project gained the first instrument it owns that can be *surprised*: a synthetic CSS/DOM conformance fixture whose denominator is authored independently of the engine.

Two things characterise the arc more than any feature. The first is that **the round that measures and the round that repairs were deliberately separated** — the conformance fixture landed with an empty `git diff --stat` over `extract/ core/ figma-sync/ scripts/`, on the stated principle that *"a round that both measures and repairs cannot be trusted to have measured honestly."* The second is the size of the **Fixed** section below, and specifically how many entries are corrections of this project's own published claims. Read that section first.

**New in this release, and the thing to read before adopting: [docs/23 — Known Limitations](docs/23-known-limitations.md).**

---

### Historical release-readiness snapshot — `1.0.0` versus `0.8.0`

*No version number is changed by this entry. This is the argument; the call is the owner's.*

**Historical context.** This argument captured the state around the 2026-07-29
stable publication and is retained as decision history, not as a current
registry or tree claim. See the coordinated-RC section above for current
source and registry state.

**What a version number promises, taken one promise at a time:**

**1. Schema stability — the strongest argument *for* 1.0, and it is already spent.** `@ds-contracts/schema` has been at a major version ≥1 for a long time; it is at **15**. Fifteen majors is not instability, it is a *functioning* semver contract: each spec revision that changed the document's shape took a major bump, and consumers who pinned were never broken silently. The schema package is therefore *already* making a 1.0-grade promise, and has been keeping it. Note what that implies: **the schema's stability is not an argument for bumping the repo**, because the two version numbers describe different artifacts (see the note at the top of this file). It is an argument that the *format* is mature enough to be specified — which is exactly Phase 3 of the roadmap, not a release event.

  One caveat that must not be glossed: the repo's schema document had advanced to **spec v16** (`Part.hugsBelowMaxWidth`, the root max-width round) while the package version string still read `15.0.0`. That was verified against the registry rather than assumed — `npm pack @ds-contracts/schema@15.0.0` and `grep hugsBelowMaxWidth` over the extracted tarball returns nothing, while the repo's copy carries the field in `contract.schema.json`, `src/`, and `dist/`. **Two different documents under one version string.** ✅ **Resolved** — published as `16.0.0` on 2026-07-29; the registry and the tree now agree.

**2. CLI surface stability — the strongest argument *against* 1.0.** The published `@ds-contracts/cli@0.2.0` exposes `init`, `extract`, `generate`, `figma`, `diff`, `propose-pr`. It does **not** contain `onboard` or `promote` — verified against the tarball (`grep -c onboard package/dist/cli.js` → `0`). `ds-contracts onboard` is the two-command entry point that Journey A in the README is now written around, and `promote` was generalized out of six per-example scripts into a real verb this week. A 1.0 on the reference implementation while the shipped CLI cannot run the documented first step would be the most user-visible false claim this project has ever made.

  ✅ **The false-claim half is resolved** — `0.3.0` shipped on 2026-07-29 with both verbs, the `examples/ci/` recipes are pinned to it, and their receipt is a real execution against the published package. **The argument against 1.0 survives in weaker form**: `onboard` and `promote` are *one release old*. A surface that reached the registry yesterday has no track record, and 1.0 is a claim about track record, not about existence. **Mid-surface-change is the definition of pre-1.0, and one release is not evidence of stability.**

**3. Is the known-limitations list compatible with the word "stable"?** Partly, and the split is instructive:

  - **Compatible.** Most of [docs/23](docs/23-known-limitations.md) is *scope*, not *instability*: web DOM only, five styling methods, no behavior, no RTL, no transforms. A 1.0 is allowed — expected, even — to have a bounded surface, provided the boundary is documented and enforced. This project enforces its boundary by refusing rather than guessing, and that machinery is mature.
  - **Not compatible.** Three items are not scope:
      1. **Two of six example libraries cannot be regenerated by any command in this repository** — Polaris has no committed sandbox (a permanent hole until one is written); Astryx's `promote` refuses on a stale ledger row and its capture reads its own output, so it is not idempotent. Shipping 1.0 with a third of the corpus un-rebuildable makes "reproducible" a claim with an asterisk.
      2. **The conformance fixture's canvas half is declared, not measured.** "Carried" currently means "reached the contract", not "reached the canvas". The instrument that would make a 1.0 fidelity claim falsifiable exists at half its span.
      3. **Coverage has never exceeded 11.9% of any library.** Nobody has met the long tail. A 1.0 invites people to point this at a whole design system; the repo has never tested that and says so.

**Recommendation: `0.8.0`.**

The work in this window is easily large enough for a minor bump and is not the kind of work a 1.0 is made of. 1.0 is a promise about *the surface you will not change*, and the CLI surface changed this week, in the entry point. Concretely, the smallest honest path to 1.0 looks like: publish `@ds-contracts/schema@16.0.0` and a CLI carrying `onboard`/`promote`; live on that CLI surface for a release without changing it; close the Polaris sandbox and the Astryx ledger so the whole corpus rebuilds; and measure the conformance fixture's canvas half. None of those is speculative — each is a named, scoped round in [docs/23](docs/23-known-limitations.md).

There is a second reading worth stating rather than burying: **1.0 also means "safe to depend on", and by that reading the deterministic core has earned it** — byte-identical re-runs, refusal over substitution, 176 evals, 54 drift rows, a golden byte-comparison. If the owner values the adoption signal over the surface promise, the defensible version of that choice is `1.0.0` **on the CLI package once `onboard` ships**, with the repo staying pre-1.0. What is not defensible is a repo 1.0 while the published CLI cannot run step one of the documented Journey A.

---

### Added

#### The generality gauntlet — to seven libraries, one pipeline

- **MUI (`@mui/material@9.2.0`) — the first EMOTION-RUNTIME system** (`82d312f`, then six live-paste rounds). No static CSS at all; token names arrive through `createTheme({cssVariables:true})`. 61 source-aliased, 0 refusals. The union-explosion fix turned out to be **config, not code** — Switch went from 42 phantom branches to 5 real parts. Followed by the **molecule torture wave** (`aab937b`: Tabs, Accordion, Autocomplete, Dialog, Menu, Tooltip) and a live-defect round.
- **Flowbite / Tailwind v4 (`flowbite-react@0.12.17`)** (`7b6f01b`) — the cheapest generality result in the repo: **Tailwind v4 is already a CSS-variables system**, so it bound token names through the *Emotion* reader with `varPrefix: "--"` and no new reader architecture. Seven load-bearing discoveries, including CSSOM grouping-rule recursion (the reader saw **zero** rules under `@layer`) and the pill-radius sentinel (`rounded-full` computes to `3.35544e+07px`, carried as 9999px). Button's **97.6% is the best first-shot floor of any library**; Badge 48/48 and Alert 16/16 pixel-perfect.

- **Carbon (`@carbon/react@1.112.0`) — library #7, run deliberately as the *control case*** (`28f4d85`). A recon predicted a config-only round and the round was executed to test that prediction rather than to make it come true: **10 components in one round with exactly one engine change**, and that change was a latent pre-existing bug (`buildHarnessPage` mounting `sampleText ""` as a real empty-string child, which killed React on any component forwarding rest props onto a void `<input>` — six libraries had tolerated it by accident). `classAllow` is one rule. Floors 76.5–96.6%. Published the **family-split doctrine**: 336 distinct `--cds-*` referenced, 366 defined, 80 referenced-but-never-defined — 77 of them the TYPE family, a Sass opt-in the compiled CSS never emits — so 94 source-aliased against 987 minted literals is the *library's own shape*, not a reader shortfall.
- **Altitude (`altitude-web-components@1.0.2`) — library #8, the first SHADOW-DOM subject** (`a1e404b`), and the round that partially falsifies the config-only reading of the generality claim, which is the most useful thing about it. It cost **one engine file** (`extract/computed/capture.ts`), every change a general open-shadow-DOM rule that is a no-op on a page without shadow roots: per-root CSSOM collection, shadow-host descent to the first box-drawing element, `<slot>` splice into `assignedNodes()`, and shadow-walking in the settle poll / form reset / focus-visible receipt. 8 components, 236 captures, all double-run byte-identical; 41 variant cells and 672 Figma variables through the unchanged genesis path. **Byte-identity for the seven light-DOM libraries was proven by re-capture, not asserted.** Library knowledge stayed in config; *platform* knowledge did not, and the round says so.
- **[docs/22 — Generality](docs/22-generality.md)** (`bdf02ee`) — the falsifiable case, written because the answer was scattered across commit messages, four PROVENANCE files, a drift baseline and the gate code. States the metric that would falsify the claim (engine files changed per new library), publishes the styling-architecture matrix, **11 same-commit cross-library repairs plus 6 same-commit non-changes verified by `--stat`**, an adversarial engine audit that found four places where the claim leaked, and an honest ledger. **[docs/21 — Bring Your Own Design System](docs/21-bring-your-own-design-system.md)** ships alongside it as the procedure to docs/22's evidence.
- **`npm run docs:check`** (`bdf02ee`) — every number a doc quotes about this repo is re-derived from the repo and disagreements fail by name, in ~50ms, with no browser and no eval run. Red-tested by reverting a count. It now gates **30 documents**.

#### The conformance fixture — a frontier that is measured, not discovered on the owner's canvas

- **`conformance/`** (`e717f71`) — a synthetic design system whose only purpose is to be captured. **53 CSS/DOM cases through the unmodified `extract/computed` pipeline as a real library**, with each case's expected disposition declared *in advance* in a manifest deliberately independent of `isFusable`, `styled`, `DECLARED_CHANNELS`, `CHANNEL_TO_COMPUTED`, `TOKEN_CHANNELS` and `carriedParts` (an eval refuses an import of any of them). Because the manifest is independent, **a construct that is neither carried nor named-refused is a hard failure** rather than an absence — which is the structural reason every other instrument here cannot be surprised. First measurement: **37 green / 11 red / 5 yellow**. Calibration held both ways: all 16 known-good controls carried, all 11 known-refused refused by name.
- **The reds closed** (`7b56f4a`) — **50 green / 3 red / 0 yellow**, 8 of 11 reds and all 5 yellows, with the UNSUPPORTED ratchet 19 → 18 (decrease-only without an explicit manifest edit). A cross-library A/B over all six libraries' committed captures (62 components) bounded the blast radius to **78 differing lines, 74 of them additive `-webkit-` census receipts**; the only structural change in the whole corpus was mui/autocomplete's four-line refusal. `RUN-ABORTED` is no longer reachable for a contract the generator refuses: an unregistered channel is now quarantined to the component (writing `captured-truth.json` + `REFUSAL.md` + `refusal.json`, no contract, non-zero exit) instead of killing the round — previously a real library shipping `accent-color` on one component could not be onboarded at all.
- **`conformance/EXPECTATIONS.md`** — generated, and the living capability matrix. It names what it cannot yet test rather than skipping it: the canvas half, state planes and axes, infinite animations, multi-viewport.

#### Composition, depth and the organism

- **Multi-root anatomy and advanced composition** (the depth arc, `76741ea` → `1305073`) — Modal captured as a real portaled dialog (0 → a 3,765-byte emission, 21 parts at depth 8, census-faithful); ResourceList as `{ul + repeat(ResourceItem)×3 → ref ds.resource-item}`; a composite Stage C exhibit. **Two findings are the headline: no schema change was needed, and there were ZERO `core/emit-*.ts` changes** — composition was already latent in the multi-root component+repeat channels, so Stage C is proof rather than new engine code. The 51 repo contracts stayed diff-clean and the golden byte-untouched through the emitter generalization.
- **The organism / DataTable round** (`3e14f6f`) — the composed MUI DataTable through the real pipeline; the first `display:table` organism, lowered to the flex vocabulary from measured track counts. 34 parts, 85.2% floor; MUI reaches 14 components / 146 variants / 1,514 variables / 14 embedded icons. Column widths mint as one shared token per column with a ≤0.5px agreement tolerance and a `table-column-width-disagreement` refusal beyond it; row height is baked from the **row**, because per-cell computed height lies (30px inside a 63px row). Adds recursive `childrenSpec` (depth-N), the `$props` config grammar, and ARIA table/rowgroup/row/columnheader/cell lowering. The bounded scope of that capture is itemized in [docs/23 §1.2](docs/23-known-limitations.md).
- **State-plane projection** (`53792d3`, `2d2098a`) — `checked` becomes a real variant axis rather than an out-of-vocabulary state string: MUI Switch 14 → 28 variants, Flowbite ToggleSwitch 3 → 6, MUI Button 63 → 75. Switch floor 73.6 → **77.679%** and pixel AA **0/224 → 56/224**. The generalized translate door then mints MUI Switch's thumb travel as a `{size} × checked` product (medium 0 → 20px, small 0 → 16px), and the compile receipt's expectation flips from a negative assertion to a positive travel pin, so 16 → 17 fails loudly. 31 of 39 components verified byte-identical under the door.
- **Schema v16 — `Part.hugsBelowMaxWidth`** (`2aabe5a`) — measured sizing evidence, set only when the captured used width stayed strictly below the cap in **every** combo; `width == cap` produces no field and a non-pixel cap produces a named receipt and no field.

#### The journeys, each collapsed to one action

- **`ds-contracts onboard`** (`f3b9bbf`) — code → canvas in two commands with a **non-skippable review gate** between them. There is deliberately no flag that skips it: an unreviewed `classAllow` / `varPrefix` / `mount` produces confident *wrong* contracts silently. Proven end to end on Tailwind in **2m34s** — real browser capture of 5 components producing a bundle **byte-identical to the committed one**, with zero committed bytes moved.
- **`promote` is finally a verb** (`f3b9bbf`) — six near-identical `examples/*/scripts/promote-floor.*` collapse into one shared module, proven by re-promoting Carbon, MUI, Tailwind and Altitude and comparing **109 committed artifacts byte-for-byte**. Polaris and Astryx keep their scripts, named with reasons ([docs/23 §3](docs/23-known-limitations.md)).
- **A canvas → code PR now carries the generated component** (`f3b9bbf`) — the contract *and* `Badge.tsx`, `Badge.module.css`, `index.ts`, both diffs, and a provenance sentence chosen by the actual `ds_contracts/contractId` marker: tool-generated says "a true round trip … byte for byte"; **hand-built says the contract is an inversion and a starting point, not a reproduction**; unreadable says "not recorded" rather than guessing. **The round-trip claim is a receipt, not an assertion** — the dry run prints "identical to the file in this checkout, no diff" for every generated file, and the `canvas-code-loop` eval carries the *negative* assertion that a hand-built PR body never says "byte for byte".
- **The reverse bridge** (`8d772d0`) — `ds-contracts figma receive --out [--apply]`; the worker learns a `proposal` kind. Writes nothing without `--apply`.

#### The standing CI↔Figma channel (gap G1, deliver half)

- **A standing channel on the assist worker** (`f493249`) with a write-key/read-key split where `readKey = sha256(writeKey)` — a leaked Figma-side key reads and can never inject. 200 publishes/day per channel, 10 claims/day IP-keyed, 4 MB cap, 30-day rolling TTL, non-consuming peek reads. `figma claim-channel` mints the pair; `figma publish` posts a bundle with a GitHub-Actions **provenance sibling** kept outside the bundle bytes so `figma bundle` stays byte-deterministic. The plugin peeks on open and on a button — a plugin has no background execution, so there is no timer and there cannot be one. Worker suite 79/79.
- **A freshness guard** closing a real silent-downgrade hole: deliveries carry a monotonic `seq`, out-of-order deliveries are named, and every Apply box starts unchecked.
- **Still open and named:** deliveries are not signed (the plugin sandbox has no WebCrypto), and G1's read half — a headless drift recompute off a REST dump — is not started.

#### Foreign-token bundles: the contract JSON is the only thing anyone pastes

- **`figma bundle … --tokens base[,minted] [--modes light,dark]`** (`899f017`) — closes the owner's live conceptual finding, *"I thought we were entering contracts as JSON but you keep giving me JavaScript."* New pure `core/token-set.ts`; contracts compile against an inventory of base + minted, and the named cannot-resolve refusal survives. Equivalence gate: the bundle path through the real engine ≡ the compiled-script path — same sets, same 982-variable name inventory, 61 alias-typed, an out-of-inventory ref refusing by name, and the bundle built twice byte-identically.
- **Bundles for every example** (`72b5075`, `7b02b42`) — MUI 202 KB, Tailwind 87 KB, Astryx (13 contracts / 423 variables), Polaris (12 contracts, 22 embedded icons, 1,433 variables), plus an **Astryx docs-theme re-skin proving the same variable inventory re-themes rather than re-mints**.
- **The re-skin round published its honest half first** (`da1cc5e`): only **half the colour surface rethemes** — 111 of 222 colour-channel refs ride minted literals. 186/186 site variables mapped by name, zero value-correlation, zero guesses.

#### Brownfield

- **Round 1 — tell the truth** (`9fcf016`). The flagship Shoelace pilot was **58/58 false-red**: because every name match failed, **zero design properties had ever been compared**. Post-fix it produces 259 real findings (30 truly-absent sets, 178 missing properties, 41 unclaimed kit variant axes, 8 orphan sets, 2 option mismatches), with two independent cross-checks agreeing exactly. This round also **published the coverage fraction for the first time** — 62 contracts against 893 library components, **6.9%**, per-library, with both the committed and the drift-pinned counts.
- **Round 2 — cut the door** (`5e4c885`). Base-less propose (one `if` was the entire blocker). The plugin's answer to a 300-set hand-built library is no longer "nothing here is contract-backed" but "**This file already has 300 component sets — none of them are under contract yet.**" `plugin:ui-check` 54 → 85 assertions.

#### Plugin, drift and IA

- **Plugin IA re-housing** (`87dd943`) — seven implementation-shaped tabs become **Build / Changes / Send** plus an Advanced drawer, per the owner's markup, recorded in [docs/19](docs/19-plugin-ia.md). `code.js` grew 25 lines and the engine receipt was unchanged.
- **The canvas-drift arc** (`c0beeec` → `fc28144`) — `core/canvas-fingerprint.ts` and a Drift tab, then **v2 geometry-free**, then **per-variant fingerprints with click-to-zoom** (closing the owner's *"it says Button was edited; there are 63 buttons"*), then **v3 snapshots (what changed)** and **v4 set-level facts**, then Drift → Propose → PR glue.
- **G2, G8, G9, G12, G6 and G14 shipped** (`c0aed6f`) — drift-aware update warnings, plain-words style diffs, a sample-library cold start, designer-language narration, `extract --draft-capture-config`, and refusal triage. The [docs/18](docs/18-user-flows.md) status column is verified against the shipped surfaces rather than against commit messages.
- **[docs/18 — User Flows](docs/18-user-flows.md)** (`8d772d0`) — seven end-to-end flows with every step tagged `[EXISTS—surface]` or `[GAP→Gn]`, and the ranked G0–G14 gap list that drove the build order above.

#### Instruments added this window

- **The offline drift instrument, new this window** (`0ce7c67`) — `regate-baseline.json`, 36 rows at first record and **54 today across six libraries** (mui 14, polaris 12, carbon 10, altitude 8, astryx 5, tailwind 5), pinning `pctEqual` within tolerance, `cellsCompared` *exactly*, `unresolvedTokenRefs` exactly, and hard-failing if a component stops fusing. ~5m17s with a real Chromium per component, which is why it is an on-demand script rather than an eval. Triage published as [docs/20](docs/20-regate-drift.md).
- **`npm run figma:fresh`** (`e5ea286`) — every rebuildable library's committed `*.figma.js` byte-compared to a fresh emission, falsified by reverting one. The one library whose emit command is unrecorded is **printed as a named hole**, never skipped.
- **`npm run child-wider`** (`9c30204`, corrected `e5ea286`) — a two-sided per-library count of in-flow children wider than their parent; an unrecorded *improvement* fails too, because a stale high baseline is room to regrow in silence.
- **`npm run conformance`** and **`conformance:report`** — the gate reads committed artifacts and never launches a browser; only `:capture` needs Chromium.
- **The mock's blind spots modeled** — `plugin-engine-mock-figma.mjs` now computes auto-layout sizing (FILL children contribute zero intrinsic size, so hug↔fill collapse is measurable headlessly) and follows the real component-property contract (set-level definitions, variant-child refusals, instance subtree deep-clones with TEXT/BOOLEAN reflection onto bound nodes, unknown-key throws), plus a harness flag simulating real Figma's instance-property exposure lag. `plugin-engine-check` builds the composite **through** the simulated lag and pins the built dialog width, the repeated badges' rendered item text, the footer Cancel/Save labels and gap, and backdrop-behind-dialog stacking.
- **Composite exhibit v1.1.0** — footer actions are real `ds.button` instances (secondary/primary) with a `{space.gap.control}` gap; the dialog declares a 480px width plus surface/border/radius/padding/gap tokens; the backdrop is a parent-bound inset-0 scrim painted BEHIND the dialog (anatomy order = paint order).
- **Background Sections** — every generated component lands on an identity-marked (`ds_contracts/hostFor`), light-filled SECTION; create and amend re-fit the same section instead of stacking new ones.
- **Plugin distribution hardening** — `npm run plugin:zip` also refreshes an unpacked `figma-sync/plugin-dist/` dev-import folder in place, and injects a content-derived engine build stamp (`engine <hash12> · <bytes>B`) into the plugin header, so a stale engine is diagnosable at a glance.
- **Determinism proof strengthened ~42×** — `deterministic-roundtrip.mjs` fingerprints the full tracked property surface (layout, sizing, paints, text, bindings, markers; run-scoped ids normalized) instead of names/types/nesting only, and runs under `npx tsx` — the documented `node` invocation never worked from a clean clone.

### Changed

- **The corpus was re-captured** (`2aabe5a`) — Carbon, MUI, Tailwind and Altitude are fresh, so the shipped contracts finally contain this window's fixes. **37 scorecards re-measured and exactly one moved** (mui/Chip 87.705 → 90.164, `cellsCompared` unchanged): the artifacts had been stale in their *vocabulary* — refusals, instrument fields, per-axis token maps — not in their floor numbers. **Astryx is blocked and Polaris is impossible**, both named rather than carried silently ([docs/23 §3](docs/23-known-limitations.md)).
- **The README is restructured around three journeys** (`2aabe5a`) — "I have code", "I have a canvas component", "I have both" — because the previous structure explained the machine rather than what a person does.
- **Eleven stale public-site claims corrected** (`3949238`); "the canvas cannot run behavior" narrowed from a blanket statement to a named slice.
- **The re-anchoring ledger** (`1427b77`, `c9242cc`) — 47 of 54 Astryx refs re-anchored (45 leaves), 7 kept literal with `DECIDED-LITERAL` receipts, 0 pending; Astryx moves from 111 semantic / 111 minted to **165 semantic / 57 minted of 222**. The provenance is recorded as a *human decision ledger*, and the file says so.
- **A retraction** (`c1ce72d`) — unreviewed work-in-progress from a concurrent agent was swept into `1427b77` by an over-broad `git add -A`, and was retracted and returned properly reviewed. Recorded because "unreviewed work-in-progress does not ship" is a policy, not an aspiration.

### Fixed

*A changelog that lists only features is marketing. These are the real defects — including the ones that were this project's own published claims.*

#### The beta bar — three things a first outside user would have hit

- **Capture could mount the WRONG ELEMENT and report success.** Point the capture at anything needing a trigger — Popover, Dropdown, Menu — with no open state configured, and the harness renders the *activator*. Nothing throws; a "Popover contract" ships describing a button. Two checks now stand in the way. **Mount sanity** (`extract/computed/mount-sanity.ts`) is a hard, run-level stop: two different components cannot render the same DOM with the same styles, so when two do, the run names both and exits non-zero. **The trigger advisory** warns at the `onboard` review gate, before a browser starts, when a queued component declares `open`/`active`/`activator` and the config drives none of them.
  **The obvious check was measured and rejected**, which is the part worth reading. "Does the captured root carry a class the component's own name predicts?" refuses real components: Carbon's `Button` stems to `btn`, Tailwind's `classAllow` is `^$` so all five have no stems at all, seven of Altitude's eight are shadow hosts with no `:host` rules, and eight of Polaris's twelve carry only generic stems (`icon`, `label`, `box`). Three fingerprints were then measured against the conformance fixture — 50 deliberately near-identical single-div documents, the adversarial input for this exact check: structure alone collides **41** times, structure plus channel *names* **17** times, structure plus channel names plus *values* **zero** times across all 104 captured components. The third one ships. **The gap is stated rather than papered over**: the collision only fires when the thing mounted instead is *also* a configured component.
- **One of four emitter targets shipped dangling token references, silently.** Three registered targets refuse a token that is not in the inventory; the web-components emitter had **no inventory in its ctx at all**, so a contract referencing a token that does not exist compiled cleanly and emitted `var(--p-does-not-exist)` — a custom property that renders as *nothing* at runtime. It now validates through **`generateCss`'s own checker rather than a second implementation**, deliberately: two targets disagreeing about whether a contract is valid would be worse than one that never checked. Omitting the inventory is itself a named refusal, so the check cannot be opted out of by leaving a field undefined.
- **The published CLI could not run the documented first command.** `@ds-contracts/cli@0.2.0` contained no `onboard` — verified against the tarball, zero matching files — while the README's Journey A is written around it. **Published 2026-07-29**: cli `0.3.0`, emitter-web-components `0.3.0` (the token check changes what it accepts), schema `16.0.0`. The `examples/ci/` pins moved to `0.3.0` in the same change as the publish and not before — a workflow pinned to a version that does not exist is the exact defect those files had just been repaired for — and `examples/ci/VALIDATION.md` was **regenerated by executing both recipes against the published package**, not hand-edited.

#### Phantoms and silent successes — the class that a green gate cannot see

- **A live phantom in the shipped MUI Autocomplete contract** (found `7b56f4a`, removed from the artifact `2aabe5a`). `autocomplete-clearindicator` — a `visibility: hidden` `<button>` MUI reveals only on hover — was promoted as a **fully visible part**: inline-flex layout, a committed SVG glyph asset, `cursor: pointer`, background and radius tokens. *A clear button drawn on the canvas that the browser paints nowhere.* Fixed with a general non-painting invariant (a part that paints no ink in every combo it appears in, and whose subtree paints nothing, is refused by name), bounded so mui/accordion's collapsed `visibility: hidden` panel survives because it paints in the expanded combo. **Shipped artifacts moved**: anatomy 16 → 15 parts, bundle 14 → 13 icons.
  **And the fidelity gate could not see the fix**: mui/Autocomplete measured 95.110% on 2,536 cells before *and* after, because refused parts are removed from scoring. A hidden element contributes no styled channels, so the phantom never flattered the score — **it only ever misled the canvas.** This is the concrete case behind [docs/23 §5.1](docs/23-known-limitations.md).
- **Polaris Popover, in the depth probe** (`76741ea`) — the floor captures the *activator's* computed styles, believes it succeeded, and mints a "Popover contract" that actually describes a button. Named, not fixed; it is the most dangerous shape of failure in the repo because nothing errors.
- **Three silent losses and four harmful carries, found by the conformance fixture** (`e717f71`, fixed `7b56f4a`). The sharpest: `-webkit-text-fill-color` — painted ink `rgb(153,153,153)`, authored colour `rgb(17,17,17)`, and the contract mints `#111111` with no receipt. **A colour that is not on screen** — and it is the disabled-input grey every library ships. Also: `calc(var(--tok)*2)` carried the right value while losing the token *name*, with `source-bindings` reporting `facts:[] skips:[]` and stdout printing "0 named skip(s)" — *the receipt asserting completeness over a loss it had just taken*. And `visibility: hidden` text carried as a part with text plus `declared.display "block"` — the contract asserting a visible block containing text the browser paints nowhere.
- **`checked` outside the state vocabulary produced CSS nobody rendered** (`53792d3`) — minted names like `background-color-state-checked` never re-parsed into `Part.states`, so the committed Switch contract emitted **four literally invalid CSS declarations** (verified through `emitReact`) while the Figma emitter dropped the same channels silently. *Captured, minted, rendered by nobody.* A load-time guardrail now fires, and it fired on the real config before the reclassification.
- **Root `states` had no channel gate at all** (`e5ea286`) — nested-part states were gated and root states were not. It caught a live bug on the first run: `Switch.module.css` was emitting `translate-y` plus four `translate-x` declarations. `TOKEN_CHANNELS` now registers 71 channels with a canvas verdict and a CSS spelling, and unknown channels refuse by name on `tokens`, `tokensByProp` **and** `states`.
- **Read-only enforcement in the plugin was a word** (`5e4c885`) — `ui.html` sent `{readOnly: true}` on five call sites and **the string never appeared in `code.js`**. Replaced with a hardened `figma` façade whose gate lifts the marked block out of the *real* `code.js` and drives it against the mock. Its scope is stated honestly in the UI: it bounds the Figma API surface, not a VM sandbox, and the Advanced "paste a script" path deliberately does not go through it.

#### Corrections of this project's own published claims

- **A broken instrument whose zero had been reported twice as a measurement** (`7b56f4a`, real numbers `2aabe5a`). `normalizeNode` never preserved `vshorthands`, so the shorthand-ceiling instrument had been **structurally zero in every artifact it ever wrote**. The detector was proven to fire on a synthetic case; the plumbing carrying its result to disk was not. *Proving an instrument fires is not proving its output survives the trip to disk.* First true numbers: **carbon 14, tailwind 16, altitude 16, mui 2**, with astryx and polaris **not measured** — and "not measured is not zero."
- **Two of five audit claims were wrong, corrected with measurements rather than shipped as told** (`e5ea286`). (a) The shorthand ceiling's named site was the wrong *layer*: Chromium's CSSOM enumerates a shorthand's longhands with the empty string and never the shorthand, so `capture.ts` dropped it before `run.ts` saw it, and fixing only the named site would have been a no-op. (b) **The pixel-gate premise was inverted** — `pctExact`/`pctAA` are the percentage of pixels that *differ*, so 100 was the worst value, not the best. Under that inversion, three real defects: a **fabricated** number (pixelmatch never ran; 100 was asserted and then averaged, indistinguishable from a measured 100), two roll-ups of the same concept disagreeing, and **regate reporting a mean over 15 "pairs" that never existed** — regate takes no original screenshots at all. All 54 committed scorecards were rewritten into the honest shape.
- **The child-wider-than-parent numbers published one commit earlier were wrong** (`e5ea286` correcting `9c30204`). "Polaris 42" was 42 *negative margins*; Polaris has **zero**. The real repo-wide total is **5**, all one defect. "Four libraries would go red" was never true.
- **`stems()` filtered `--` before stripping `classPrefix`, so every Carbon class was discarded** (named `bdf02ee`, fixed `d8478ea`). Carbon's `classPrefix` *is* `cds--`. Its parts were aligned and named positionally — captured signature `button|` while the classes array read `["cds--btn"]` — and its 76.5–96.6% floors were measured that way. No config key could override it and nothing named it.
  **And the round's own expectation was wrong, and it says so:** floors were predicted to rise and did not move at all. Carbon's DOM shape is stable across every combo, so positional and class-identity alignment built the same tree. **The defect corrupted identity, not measurement** — and no percentage was ever going to catch it.
- **The 58/58 brownfield pilot had never been run against the config the directory ships** (`9fcf016`) — the committed diagnose report carries `designChecked: false`. Six further documented claims exceeded what the code does, including "amend inside a foreign enterprise kit" (coexistence is proven; **amending a hand-built set is not** — the only foreign-kit set ever amended was tool-created), and G1's "the loop starts closing" **verified to exist only in a commit message**.
- **Two generations of doc rot were live simultaneously** (`bdf02ee`) — README said 146 evals, docs said 99, reality was 162. This is what `docs:check` now prevents.
- **A dependency claim corrected against the registry rather than the lockfile** (`b3a272f`) — the previous commit's "wrangler already at latest" was checked against the *local* version. Corrected; 0 vulnerabilities across all workspaces.
- **Two MUI compile-receipt pins were pinning the wrong artifacts** (`2aabe5a`) — one asserted the phantom was *present*, the other a blanket `padding === 12`. Both corrected, not loosened.
- **The "byte-lockstep fingerprint copy, gate-pinned" claim was false** (`2d593d8`) — the gate only evaluated the TS side, so the hand-maintained copy could have drifted silently forever. Now a byte-substring assertion, falsified with a one-comment drift.

#### Stale artifacts that green gates could not see

- **MUI's shipped scripts sat three engine fixes stale through a 167/167 green suite** (`e5ea286`), and three gates looked straight at them: compile receipts *execute* the committed scripts (a stale script executes fine); the genesis eval byte-compares a rebuild of the **bundle**, which is contracts + tokens and contains no engine output; and the equivalence check compares set shapes, variant counts and variable inventory, while all three fixes changed geometry and node kind. Closed three ways, including the new `figma:fresh` gate, falsified by reverting one script.
- **Plugin distribution went stale silently** (`39c89f5`) — a live session re-validated a stale midday engine because the dev import pointed at a hand-unzipped copy; importing `figma-sync/plugin/` directly gives the `ui.html` stub with no engine at all.
- **The playground's #1 "recommended" import route had been dead** (`3949238`) — the IA round removed the plugin's Send-to-Playground UI, so `ui.html` posted `run-send` zero times while `code.js` still handled it: the playground minted pairing codes nothing on earth could fulfil, under a heading that said RECOMMENDED.
- **`extract/out` was stale against HEAD** (`dfa7ab6`), found by a determinism check rather than by a person.

#### Cross-library contamination

- **`out/<component>` collided across libraries** (`b66e5a3`) — the Astryx Button run re-applied the committed **Polaris** Button decisions ledger, and Astryx decisions polluted the Polaris ledgers in return. Foreign decisions had been helping and hurting silently. The polluted promotion was discarded and shipped contracts **reverted** to v0.2.0 rather than carried forward.
- **Polaris Badge's decision ledger was Astryx's ledger wholesale — and it was a loaded gun** (`d10511c`). `promote-floor` prefers `resolved` over `enriched`, so the next promotion would have silently regressed the shipped contract with Astryx tokens. Badge 95.159 → 97.327, unresolved refs 2 → 0. The guard is an apply-time **value** check, because ids cannot be the guard: 6 of 9 legitimate Polaris ledgers carry ids from an older combo enumeration.
- **Family discipline** (`0078020`) — the triage driver re-widened to off-family candidates when a family pool was empty, acknowledging a 16px font-size to `{spacing-4}`: value-identical, wrong family, and invisible to every later queue once baked into a promoted contract.
- **`regate` had no `--out`** (`2d2098a`) — so the offline re-fuse door was only ever open for Polaris; every other library silently read Polaris's same-named component and died with a misleading error.

#### Instruments measuring the wrong thing

- **The gate built its token inventory without the shipped minted tree** (diagnosed `d10511c`/`0ce7c67`, fixed `05a8ce0`) — it measured shipped truth against an inventory the shipped contract could not see. Astryx Slider **55.333 → 90.387**, Badge 96.296 → **100.000**, Button 95.391 → **98.724**, and every unresolved ref across 36 components went to zero. Two load-bearing twins fixed alongside: `mintedTokenCss` printed DTCG aliases verbatim as invalid CSS (without which Slider scores 79.789, not 90.387), and the apply-time decision check's "same inventory the gate renders with" claim had been true only by coincidence. **No artifact moved — the fix changed the measurement, not the truth.**
- **The scary regate number was false** (`0ce7c67`) — Astryx Slider's 55.3 was contract/mint skew rendering unresolved refs black *in the gate page only*, with the canvas verified unaffected. Three engine fixes underneath, each reproducing its committed number exactly: `regate` gated the raw fused contract while `run.ts` gates the decision-applied one; the gate rendered unresolvable refs silently as empty custom properties; and **Polaris Avatar / ProgressBar / Thumbnail had been unfusable since the absolute round** because the v14 conflict rule spans `tokensByProp` and `literalsByProp` while fuse's two merge blocks each checked only their own field. Discipline held: no committed harness receipt was rewritten, because a harness number may only be refreshed by a harness run with its double-run byte check.
- **The fidelity gate rendered every token binding as an undefined custom property** (`2f494ab`) — the tell was a score identical to three decimals before and after rebinding.
- **`carbon/Button`'s drift tolerance was undersized** (`a1e404b`) — eight runs spanned 77.441–77.577, a 0.136 spread against a 0.08 tolerance. Widened to 0.20 **with the measurement written next to it**, never re-pinned silently. The underlying cause — a flat 30 ms interaction wait against a 70 ms transition — is [docs/23 §2.9](docs/23-known-limitations.md), still open.
- **The determinism refusal was a half-receipt** (`3e14f6f`) — no witness. It now names the capture key, element path + signature and both values, and that upgrade immediately found TablePagination's Select opening under the active driver with a persisting 180° icon rotation.
- **The engine collapsed three conditions into one indistinguishable message** (`7b56f4a`) — semantic-alias, token-absent-from-DTCG and genuine value disagreement, the same condition that had hidden Carbon's hollow checkbox.

#### Wrong renders on a real canvas

- **Carbon's six live canvas defects** (`9c30204`), each closed as a general rule rather than a Carbon patch — and **the same fixes improved MUI, which is the generality claim demonstrating itself rather than being asserted.** 11 of 13 assertions were red before; 12 are green after. `<title>`/`<desc>`/`<metadata>` are non-painting per SVG 1.1 §5.4 but were captured as anatomy and poisoned `reconstructSvg`, exploding one glyph into five per-path parts — *the refusal receipt had been firing on all 12 combos and nobody had read it*. Pseudo-decor v2 factors geometry and paint separately (v1 hashed size, offsets, fill and radius into one key, so a transparent-with-border checkbox square was invisible to it), and a literal border colour had **no case in `applyLiterals` at all** — a silent canvas drop. `display: grid | inline-grid | list-item` reached the emitter with no display fact and took the horizontal default, so Carbon's Modal drew header/body/footer side by side. The root carried the **capture stage (900×1000)** as its box. Geometry after: icon frame 196px → 20px; Modal 4,200px grey slab → 432×214; container overflows across the bundle **16 → 0**.
- **Duplicate SVG fill broke real Figma's `createNodeFromSvg`** (`981e446`) — stroke-based icons got a second `fill` injected onto the `<svg>` tag, producing invalid XML and a live "Failed to convert SVG file". **146 headless gates missed it** because the mock was lenient. The pattern is now a standing discipline: headless-green does not mean live-correct.
- **`px()` silently dropped rem units** (`5c93c8a`) — `parseFloat('0.875rem')` is `0.875`, and the real canvas refused it by name. The repo's own tokens are px or unitless, so 147 headless checks never exercised the unit path; a foreign library's rem-scaled font tokens did, on the *first* live paste.
- **`max-width` lowered as a fixed width** (`8dad6b2` for parts, `2aabe5a` for roots) — a 360px Tabs strip baked into 288px with two of three labels off-canvas; 900/1200/1536px Dialog papers clipped off their cells; Carbon Button 320 → 128/80 against a captured truth of 123.5. All 21 hand-authored roots were verified as design-widths, with `figma:plan` byte-identical and zero golden movement.
- **The text-wrapper centering bug was corpus-wide** (`2aabe5a`) — the emitter's text wrapper was hard-coded CENTER/CENTER, and **46 of the corpus's 62 wrapped texts** have no fill and no fixed size (wrapped only to carry `min-width: 0`). All 53 figma-sync scripts moved by exactly that runtime block, with zero spec bytes changed.
- **Menu captured MUI's Popover scrim as the component root** (`8dad6b2`) — 900×1000 → 115×124. In the same round: the first item's grey tint was MUI's **autofocus** baked into the base plane; Modal's two classless focus-trap sentinel divs had become parts; block-flow lowering was root-only, so Menu items flowed horizontally.
- **Hidden inputs painted over the thumbs** (`acb0342`) — both promoted parts carried default white backgrounds. The Switch thumb was there all along — 20×20, primary-filled, exactly placed — under a white square.
- **Emitters silently dropped children of text parts** — in the Figma emitter (`aab937b`: Tooltip's arrow never compiled) and, separately, in the static emitter (`3e14f6f`: **Polaris Avatar's person glyph had been missing from generated HTML all along**; the gate moved 33.5 → 85.2 once fixed).
- **Block roots were silently centered** (`6e76346`) — the same class improved five Polaris components.
- **Drift v1 self-flagged a fresh generation** (`40e7a3f`) — a fresh MUI generation immediately reported 5/5 canvas-edited with zero edits, because real Figma computes auto-layout geometry lazily. **A class the mock structurally cannot imitate**, since its layout math is synchronous. Fixed by making the fingerprint geometry-free.
- **Drift's diff parser truncated keys, so every change detail silently vanished** (`43daddf`) — v4 stamps present, edits made, zero details rendered. Every fact on a node collided in the map and only the last line was compared. The meta-lesson was gated: the module was pinned, but *the handler's parsing was its own unpinned code path*.
- **G2, a live covenant violation** (found `8d772d0`, fixed `c0aed6f`) — the Update tab's Apply never consulted drift and silently overwrote canvas edits. Now a named overwrite warning with a default-unchecked box: warn and default-safe, never block.
- **A silent-downgrade hole in Apply** (`f493249`) — no ordering existed anywhere; `updatePlan` compared `specHash` for equality only, so an *older* bundle applied as an ordinary default-selected change. Fixed on the channel path only; the pairing-code path is deliberately untouched, because it carries no ordering and inventing a warning would be worse than none.
- **A downloaded `<id>.contract.json` was actually a proposal envelope** (`f3b9bbf`) — feeding it to `propose-pr` committed an envelope where a contract belongs, and every downstream consumer then refuses it. Renamed `.proposal.json`; `propose-pr` now unwraps envelopes as `figma receive` already did.
- **The composite Modal renders correctly on a live canvas** — closes the three handoff `08#1` defects (2026-07-21/22, live-confirmed by the owner). (1) Auto-layout **hug↔fill collapse**: FILL is now a compile-time decision (`annotateFillW`) gated on the parent's width being established — the all-FILL-under-hug degenerate that collapsed the dialog to ~3px can no longer be emitted; the Banner mixed pattern (intrinsic sibling + filling ribbon) survives by construction. (2) **Set-instance text/boolean properties**: the create path now mints component properties on the SET after `combineAsVariants` (one key per name, wired into every variant — matching the amend path, which always had it right), instead of per-variant pre-combine keys that real set-instances never surface. (3) `setInstanceProps` **refuses by name** on an unmatched property instead of silently skipping — the refusal is what turned the final live failure into a one-line diagnosis.
- **Real-Figma instance property-exposure lag** (live finding 2026-07-22, Desktop Bridge forensics; supersedes and corrects an earlier "mixed VARIANT+TEXT setProperties" inference): a freshly created instance's `componentProperties` can lag behind its component set within a session, listing only VARIANT axes. `setInstanceProps` now resolves keys against the instance first and falls back to the owning set's always-complete `componentPropertyDefinitions`, applying with the full key (probe-verified to work during the lag).

### Known issues carried into this release

*Found, published, and deliberately not fixed here. The complete inventory with symptoms and status is [docs/23 — Known Limitations](docs/23-known-limitations.md); these are the ones this window discovered.*

- **Two of six example libraries cannot be regenerated.** Polaris has no committed sandbox — its captured truth, enriched contracts and scorecards are frozen at whatever engine produced them, and anything in the *capture* half can never reach it. Astryx's `promote` refuses on a stale re-anchor ledger row (`RA-ffffff`) and its capture config reads its own shipped contracts, so capture+promote is not idempotent (observed: card `0.1.0` → `0.3.0`, provenance written twice).
- **Orphaned minted leaves, corpus-wide** — a refused part leaves the anatomy but not the mint, so libraries ship variables nothing binds. Counted and ratcheted decrease-only; the residual class (a real part whose *binding* was dropped downstream) is a library-level sweep.
- **Per-component capture cross-contaminates ledgers** — the same component yields different bytes depending on which siblings ran, and Carbon's capture is not byte-reproducible run to run. Nothing warned a user that re-capturing dirties their tree.
- **`buildEmitterCtx` flattens every `--tokens` tree into `primitives`**, so `--target react-inline` cannot resolve a multi-tier token set. Pre-existing; hit independently by two rounds.
- **`row-rule-color` is 55% of all channel misses** — a Chromium gap-decoration longhand nobody authored.
- **No `.github/` exists**, so the site's drift guards and `docs:check` fire only locally, while the contribute page claims the coverage guard "fails the build."
- **The playground's canvas preview re-implements `emit-figma-script`'s node spec in 737 lines with no gate** — the sharpest un-pinned coupling in the repo.
- **`portalSweep` takes no `varPrefix`**, so every overlay component in every library carries zero source-token facts, and **`gate.ts` waits a flat 30 ms** after driving an interaction against transitions of 70–200 ms.
- **`tailwind/tokens/MINTED.md` is titled "MUI minted tokens"** — a clone artifact carried verbatim with a `__note`, because retitling should be done on purpose rather than as a refactor side effect.

## [0.7.0] - 2026-07-20

The showcase-and-shipping arc: the contract schema advanced v13 → v15 (closing a July v9 → v15 arc that moved the vocabulary from drawn shape to declared facts), the computed-capture floor joined extraction as its run-of-record instrument, the first npm packages shipped (`@ds-contracts/schema` 15.0.0, `@ds-contracts/cli` 0.1.0), and the eval suite grew 99 → 129 (60 → 129 across the two July releases). The dated narrative with receipts is [MILESTONES.md](MILESTONES.md). Bookkeeping note: schema v13, the live gauntlet, and the spec site landed inside the v0.6.0 *tag* window but after that entry was written — they are documented here.

### Added

- **Published npm packages (Two Journeys, Phase 1)** — `@ds-contracts/schema` 15.0.0 (the live Zod document + generated JSON schema, byte-identical to the repo's) and `@ds-contracts/cli` 0.1.0 (one zero-required-dependency binary: `init` / `extract` incl. the lazy computed floor / `generate --out --target --emitter --stories` / `figma` + `figma push` through the bridge / `diff` with CI exit codes / `propose-pr`), under npm workspaces. `registerEmitter()` opens the emitter registry (four built-ins unchanged; plugins appear in every consumer automatically); the bridge gains the CONTRACTS-BUNDLE route (the reverse direction: code pushes to the plugin). Publish stranger-verified: clean directory, `npm exec @ds-contracts/cli`, a working config in one command; every verb eval-pinned by a consumer-style smoke test that runs byte-stable twice from scratch.
- **Schema v13–v15.** v13: `Part.states` (part-level state overrides — color channels on text/icon/box) + cross-import token scope (linked contracts pull their own minted+captured layers on every surface). v14: multi-entry `tokensByProp` (ordered later-wins, conflicts refuse) + `literals`/`literalsByProp` channels. v15: `Part.declared` / `Part.declaredStates` carry keyword/literal channels with no token vocabulary (cursor, user-select, transitions, the A22 text channels, font-family stacks, background sub-channels, …) bounded by the `DECLARED_CHANNELS` registry (per-channel value grammars, draw|annotate canvas verdicts), plus `layout.wrap` and per-corner-radius / per-side-border-width literal channels. `contract.schema.json` regenerated at each step.
- **The computed-capture floor** (`extract/computed/`) — real-Chromium computed-style capture of every variant × state combo (double-run byte-identity REQUIRED; ≥3-axis pairwise certificate refuses by name), fusion into enriched contracts with leaf folding, a contradiction review queue with refusal-disciplined resolution (decisions ledgered, re-applied automatically), fidelity-gate scorecards against the real npm package, and an offline `regate` instrument that replays committed captures byte-reproducibly. Surfaced in the CLI as lazy `extract --computed`.
- **The Polaris showcase** (`examples/polaris/`) — 12 flagship Shopify Polaris components at a pinned SHA, run end to end: static promotion under a reviewed class map (114 carried / 2,360 named refusals) → the coverage round (var()-chain literal resolution with provenance and bounded calc; composition typography through Polaris's own Text css; carried 114→185) → floor promotion v0.2.0 (2,164 captures ×2 byte-identical) → v0.3.0 (Round 4, below) → v0.3.1 (Round 5c, below) → v0.3.2 (Round 5d, below). Truth table 96/100 → **262/276 exact computed-style matches, every mismatch with a committed named cause**. The library was built LIVE into the owner's file (403/403 variables, Button 200 variants), rebuilt from the v0.2.0 floor with amend-in-place at scale, and finally rebuilt as **the verdict build** (Round 5b): 10/12 sets amended in place under stable node ids/keys (incl. the 220-variant Button), 2 named promotions by the script's own policy — the owner's first positive verdict on a live canvas build.
- **Round 4 — DOM-anatomy promotion (schema-neutral, the one-to-one round).** Computed-only DOM elements are REAL contract parts: union-tree alignment joins every capture (hierarchical signature matching — structure-creating optional props add parts the base combo never renders), `extract/computed/anatomy.ts` promotes the full rendered tree into the enriched contract (static layer keeps names via element+content rejoin), svg glyph content reconstructs into committed icon assets from the captured CSS `d`/`fill`/`stroke` channels (named viewBox reconstruction; per-axis-value glyphs as `visibleWhen` parts), presence facts carry as `visibleWhen` + `stylesWhen display:none` products (defaultless axes via the base-hidden strategy; non-factoring presence refuses by name), and geometry evidence carries as facts (`layout.grow` full-width, declared `aspect-ratio 1 / 1` squares, per-part display, declared `position: absolute` inset overlays, sr-only parts as hidden). Banner's tone ribbon + per-tone icon + dismiss × + action row, Checkbox's check/indeterminate glyphs, Tag's remove button and TextField's prefix/suffix all render from the contract on every surface.
- **Structure-creating optional props in the capture space** (owner directive): `presenceProps` config axes mount `onDismiss`/`action`/`onRemove`/`onClick`/`url`/`initials`/`icon`/`prefix`/`suffix`/`clearButton` (marker grammar `$callback`/`$import`), promoted as boolean contract props gating the created subtrees; `axisValueMap` enum axes capture Checkbox `checked` (incl. `indeterminate`) and RadioButton `checked`; Badge gains its real `tone`(14)/`progress`(3) axes and Tag its `size` axis. Captured-truth v2 `offBase` template encoding keeps the files delta-compact, per-capture byte-equal-verified at write time.
- **The canvas pixel gate** (`extract/figma/canvas-gate/`, receipts in `examples/polaris/receipts/canvas-gate/`): headless canvas-engine renders vs the REAL @shopify/polaris package per curated cell — masked/unmasked pixelmatch, a blank-canvas guard (low % against nothing is not a pass), per-channel NUMERIC tables (canvas-drawn vs captured truth), named cause required on every cell over 10%.
- **Site-calibration receipts** (`examples/polaris/receipts/site-calibration/`): the documented polaris-react.shopify.com examples (banner-success, banner-critical, button-primary, badge-default) fetched live (JS disabled — the docs site hydrates a deprecation hero over the SSR example; every case asserts the documented text) vs the same props on the local npm package: structural checklists pass both sides; the harness reference is proven against the site.
- **Labeled receipt pairs**: every committed pair image names its halves in the image margin (5×7 bitmap font — "REAL POLARIS (NPM PACKAGE)" vs "CONTRACT RENDER (EMIT-HTML)"); an unlabeled pair was misread as a single reference.
- Round-4 eval pins: `dom-anatomy-promotion` (the committed Banner contract carries ribbon/glyphs/dismiss/action and the emitted HTML draws them), `svg-content-round-trip` (capture → reconstruction → committed asset byte-equal), `canvas-pixel-gate-receipts` (scorecards present, row-consistent, >10% cells named).
- **Rounds 5a + 5c — the canvas gate re-earned**: Round 5a taught the canvas engine to draw the v0.3.0 anatomy (13 renderer/compile classes + gate-harness truth fixes incl. the checked-mount bug); Round 5c fixed the six promotion-level causes at source (complement-of-product presence, root-hosted svg plans, carried-channel re-mint on defaultless axes, shape geometry recarried from captured truth, authored-viewBox unification, drawn pseudo-element decor as shape parts) plus text-part typography always carried. Contracts promoted v0.3.1; harnessed gate run: **7/10 acceptance PASS (was 2/10), Avatar/RadioButton/Spinner at EXACT 0.00**, zero unnamed >10% cells, zero blank-deceptive passes; the standing `canvas-gate-standing-pin` eval moved to the re-earned numbers.
- **Canvas carriage for the ranked capability-matrix additions** — per-corner radius and per-side width variable BINDINGS, linear-gradient → native `GRADIENT_LINEAR` paints (paint-order inversion documented; radial/conic are named description limits), full box-shadow stacks incl. inset → native effect lists, the A22 text channels drawn natively (`textCase`/`textDecoration`/`textAlignHorizontal`/pixel letter-spacing/first font-family stack entry/`textTruncation`), `layoutWrap`. Declared-not-drawn channels land the capability-matrix annotation copy in component descriptions (`docs/FIGMA-CAPABILITY-MATRIX.md`).
- **Computed-floor fusion promotes declared facts** — uniform registry-channel values (and full-coverage uniform state deltas) carry as `declared`/`declaredStates` instead of extension residue; `box-shadow: none` and gradient values are mintable kinds. New offline instrument `npm run extract:computed:regate` re-scores the contract-mediated gate over the COMMITTED captures: baseline reproduced exactly (Button 79.578%, Tag 77.500%), post-lift **Button 90.617%** (192/480 rows fully equal) and **Tag 92.500%**.
- **Plugin v2** — six tabs (Generate / Update library with a mandatory plain-words report / Propose with PR dry-run, beside the original send paths); the engine ships into the plugin as a 0.41 MB bundle (core barrel + baked tokens/contracts/icons) guarded by a committed input-hash receipt — the zip build refuses a stale engine by name (the guard fired correctly on its first post-merge re-record); a 407-line mocked-figma harness executes the REAL bundle in a VM (generate, dependency-ordered bundles, verbatim update report + amend-in-place apply, dump→proposal round trip, duplicate-contract-id refusals). Eval pins: `plugin-engine-bundle`, `plugin-update-report`, `plugin-propose-dry-run`.
- **Web Components emitter** (`packages/emitter-web-components` 0.1.0) — contract → vanilla Custom Elements, zero runtime dependencies, through the open registry. Closure evals: `wc-emitter-roundtrip` (emitted elements re-extracted through the existing CEM adapter land back on the contract) and `wc-emitter-css-parity` (**165/165 computed channels equal** across the react, html, and WC emissions in a real Chromium).
- **CI recipes + journey standing gates** — code-led and design-led GitHub Actions recipes over the published CLI (`examples/ci/`; the CONTRACTS-BUNDLE artifact is the bridge envelope, diff exit codes are the design-led gate), with a validator that executes every `run:` step locally, verbatim (`examples/ci/VALIDATION.md`); `journey-engineer` and `journey-designer` E2E evals run both product journeys end to end, reading their command lines ONLY from `evals/fixtures/journey-commands.json` — the docs-drift seam.
- **The spec site** (`site/`) — zero-new-dependency SSG (tsx + zod introspection), 22 pages at launch (25 at the v15 reference), the schema reference GENERATED from the live Zod schema with a branch-coverage drift guard (the build fails by name on undocumented schema branches; 131/131 at v13, 140/140 at v15), examples in three badge-labeled provenance classes (shipping / engine-replay / illustrative), engine-replayed How-it-works proofs (real differ findings verbatim, a build-computed dependency graph from the 1,618-set capture), byte-identical rebuilds.
- **The live gauntlet** (v0.6.0-tag window, documented here) — full-kit dump v1.6 capture (1,618 sets, 715 vars with modes, file version pinned), 1,106 variant PNGs banked, and a tiered live gauntlet: 127/127 refusal-free across all tiers yet a T2 parity median of 35.5% — **refusal-free ≠ pixel-right, quantified** — with 6 new failure classes ranked with fixtures into a separate live baseline (the standing visual-parity baseline untouched).
- **Astryx Phase A** (`examples/astryx/`) — the second-system exhibit: facebook/astryx (MIT, React + StyleX) pinned at `@astryxdesign/core@0.1.6`, extracted from the npm-shipped TSX source. Census 23/24 @ 57% median → **24/24 @ 65%** (keyof-enum + union-of-refs adapter rules, both eval-pinned on synthesized fixtures; 15 skips all named; proposals only, nothing promoted); StyleX token reader (`core/stylex-tokens.ts` — 186/186 tokens, `light-dark()` → the v1.6 modes shape); and the `.doc.mjs` referee — Meta's own shipped docs diffed against our proposals: 246 vendor props, 136 agree, 53 not-carried confirmed real by receipt, 93 named disagreements incl. **35 the vendor doc itself misses**, 0 silent — and it caught a real adapter gap (silent heritage drop), now receipted and pinned. The second-system assessment is committed (`extract/pilots/SECOND-SYSTEM-ASSESSMENT.md`), incl. the Nord license disqualification.

### Fixed

- **The six Phase B-3 canvas-engine findings at source** (`core/emit-figma-script.ts`): token-referenced shadow stacks lower to native effects (the rem-length parser gap that dropped every `p.shadow-button*`), the form-control placeholder color is contract-driven (no repo-vocabulary hardcode), the amend-seed carries variable alpha, the shape branch applies effect stacks, `amendSet` resizes the set container, inset-0 overlays lower to `layoutPositioning: 'ABSOLUTE'`. Plus the canvas-gate findings: padding LONGHANDS bind per side (token + literal paths), icon svg nodes carry intrinsic size (`createNodeFromSvg` + preview), effect stacks render in the canvas preview, declared `aspect-ratio` sizes height from the bound width.
- **De-noised canvas annotations** (owner directive): emitted component descriptions reduce to one caption line (`<Name> — generated from contract <id> v<version>`), a single trailing `†` marks the existence of code-only facts; all gap documentation lives in repo receipts only.
- Nested UA-margin neutralization (promoted `h2`/`p` parts no longer leak UA margins), emitted glyph `svg { display: block }`, and the fidelity gate now recreates the capture page's inherited text context from the control probe (a 13px Polaris body was scoring as a 16px page-chrome difference).
- **The react emitters emit VALID JS for hyphenated part names** — bracket access (`styles['label-2']`) in `emit-react` + `emit-react-inline`; identifier names keep the dot spelling byte-for-byte. Found by the CI validation executing every recipe step against the published CLI: `styles.label-2` parses as subtraction and throws at runtime, and the committed showcase output already carried it. The new `react-hyphenated-part-names-execute` eval EXECUTES both emitted modules (esbuild bundle + react-dom/server render) — grep-level checks cannot catch this class.
- **Round 5d — the owner's four live-review visual classes fixed at source** (contracts promoted v0.3.2): svg dash channels drop with a named receipt (pathLength-relative draw-on animation vehicles are not resting truth — the check glyph is one continuous round-cap stroke, the segmented-capsule class retired); shorthand coverage maps the full constituent set (the reviewed `border-radius`/`border-width`/`gap` binding rules every corner/side — the `imported.*` sibling longhand mints are retired); spec margins now APPLY on canvas (uniform sibling gaps bind itemSpacing to the margin variable; residual margins become a real margin-box wrapper — the Badge pip keeps the 20px pill); outline lowers to an OUTSIDE-aligned stroke with a full color+width pair rule (the Banner focus ring wraps the tone ribbon's top arc; the pair rule was caught by the gate itself before pinning); single-paint glyphs re-bind their contract variable after svg import. Gate pins re-earned (Banner 4.60→3.17, Tag 29.97→22.55, still 7/10 PASS, zero unnamed >10% cells); two new eval pins; the live canvas is untouched this round — `PHASE-B5-RECEIPT.md` records what the next bridge re-amend changes.
- **Bridge origin policy for plugin receives** (closes the Phase 2 named gap): DUMP reads stay playground-only and a refused read does NOT consume the one-time payload; CONTRACTS-BUNDLE reads deliver to any origin (the pairing code is the auth — the pusher targeted this code); session minting open to any origin with per-IP limits. 53/53 worker tests.
- **#60 — the four canvas-emitter defects, each eval-pinned** (`figma-60-canvas-emitter-fixes` executes the emitted runtime): (1) `fillClear` can no longer trample a spec-carried fill (compile + runtime precedence); (2) per-component sync scripts are AMEND-CAPABLE (shared sync runtime — re-running a committed script reconciles in place instead of `{ skipped }`); (3) standalone COMPONENTs amend in place (`amendComponent` — the "variant sets in v1" skip is retired); (4) empty runtime-sized children default to FILL height, never Figma's 100×100 `createFrame` artifact. `figma-sync/` and `examples/polaris/figma/` re-emitted; golden regenerated (flagged — the emitted-script shape change IS the fix).

## [0.6.0] - 2026-07-12

The July field-test arc: the contract schema advanced v9 → v12, the plugin dump format v1.0 → v1.6, the eval suite 60 → 99, and three standing instruments joined the suite — the whole-kit census, the visual-parity pixel gate, and the enterprise code gauntlet. The dated narrative with receipts is [MILESTONES.md](MILESTONES.md).

### Added

- **Schema v9–v12** — `Part.shape` (drawn vector geometry: the tooltip pointer), `tokensByProp` on every surface (per-enum-value token substitution recovered by value-level correlation, not name matching), `part.repeat` + `arrayOf` props (repeated-children collections: React maps the live array, static surfaces render the observed sample), and receipt-grade `modes` metadata (theme/mode-axis promotion). `contract.schema.json` regenerated at each step.
- **Dump v1.2–v1.6** — box shadows and per-corner radii; shape geometry; the `_variables` resolved-value channel (bound token names arrive WITH their values — the captured-token layer registers them as an import-scoped layer, repo tokens winning collisions by name); `instanceKey`/`instanceSetKey`, bounding boxes, boolean defaults, `swapPreferredValues`, and native SLOT nodes (composite child linking); collection modes with alias resolution (per-mode token values). Every channel the capture reads but cannot carry is a named degradation receipt — the zero-silent-losses rule, REST mapper included.
- **The whole-kit census** (`npm run extract:figma:gauntlet`) — every component set in a live enterprise Figma kit (1,618 sets, 76 variant composites) replayed through the full import pipeline; per-set facts-carried, named-note, and degradation counts; class fixtures retained for regression replay. 63.2% composite-clean at first measure, 100.0% after the class-fix batches — the instrument stands so the number cannot silently regress.
- **The visual-parity instrument** (`npm run extract:figma:visual`) — emitted previews perceptually diffed against Figma's own PNG renders: pixelmatch, a text-masked second score (cross-renderer font rasterization never flatters a result), real browser interaction states, disk-cached Figma PNGs, worst-first REPORT with per-row diagnosis and triptychs.
- **The enterprise code gauntlet** (`extract/pilots/ENTERPRISE-GAUNTLET.md`) — Carbon, Fluent 2, Spectrum, and Polaris at pinned SHAs through the unmodified pipeline, plus the fix batch it demanded: sibling-type-file resolution, cast transparency, intersection-named-ref rules (Fluent 0→23 components, Polaris hollow 5→0), nameless-CEM-event named skips, one function-prop rule shared by propose and diagnose (26 false findings → 0), and `wrap-plain-tokens` (all four enterprise token shapes load via a mechanical `$value` wrap).
- **Send-to-Playground plugin bridge** — a one-time 6-char pairing code relays the plugin's dump (the repo's dump script embedded verbatim, a build-time drift guard refusing stale copies — it has fired three times, correctly) through a one-time-read relay on the assist worker (15-min TTL, 4 MB cap, own kill switch); full token names AND values on any Figma plan.
- **Composite children render real** — key-based session linking (`resolveChildContract`: key first, name fallback noted, name-contradicting-key refused), linked refs rendering child anatomy with applied + threaded `{parentProp}` props, unlinked stubs rendering observed geometry via minted `imported.stub-*` tokens; workspace imports join the propose scope.
- **Proposer trio** — theme/mode-axis promotion (a structurally-corroborated Theme axis is a token mode, never a prop; near-misses stay props by name), repeated-children collections (≥3 homogeneous siblings → one item-template part + `arrayOf`), negative-spacing overlap (`layout.overlap` carries the drawn magnitude; a negative-px gap token can no longer mint).
- **Native controls** — Checkbox/Switch 2.0.0 render a real `input[type=checkbox]`; standing `NATIVE_ROLE_HOSTS` semantic lint (role-on-non-native refuses by name; declared `roleException` is the governed escape).
- **Enforced a11y** — `a11y.minHitArea` emits the non-visual `::before` hit-target floor on both CSS surfaces (previously declarative-only); UA margins neutralized on component roots.
- **Fidelity matrix** (`extract/fidelity-matrix/`) — four real components (Shoelace Tooltip and Button Group, Eventz Button, CBDS Button design + code) imported live, proposed, emitted, and scored against their own captures; committed fixtures replay every number offline. SCORECARD with 12 named gaps, causes, and an ordered punch list.
- **Dump v1.1** — solid paints capture `{hex, alpha}` and node visibility (`hidden`) in both the REST mapper and the plugin dump; alpha<1 paints mint as 8-digit hex (one string that is a legal DTCG color `$value`, a CSS color, and invertible to Figma RGBA); the `paint-alpha-dropped` degradation is retired.
- **Auto-proposed child contract stubs** — a nested instance whose child contract is not in scope ships a STUB contract alongside the proposal (observed applied values only, provisionality named) so component refs emit instead of refusing.
- **Base-instance flattening + self-reference guard** — variants that solely wrap an instance of a shared base component flatten (captured properties promote to real props, Figma spellings preserved); a set never emits a component ref to itself; component-ref cycles refuse by name at the generator instead of overflowing the stack.
- **Identifier sanitization at proposal** — non-PascalCase set names and emoji-prefixed prop/slot names sanitize when the contract is proposed (original spellings stay the figma bindings, every sanitization noted); emit no longer refuses on spelling.
- **Visible propRefs on component-ref parts** — icon-toggle booleans captured on nested instances become contract props with `visibleWhen`, defaults recovered from dump v1.1 `hidden` evidence.

### Changed

- Contract-global part-name dedup with named renames (first drawn part keeps the name; collisions take a parent-derived prefix, else an ordinal suffix) and a 24-char derived-name cap.
- Playground surface batch: captions derived from the contracts (eval-refused hardcoded counts), receipts wall dedups repeats with exact counts preserved, deliberate refusals labeled, tab rail and landing strip wrap instead of clipping, plain-words JSON errors.
- ds.token 1.1.0: the declared size scale is live (per-size `tokensByProp` against existing repo tokens; md byte-identical).

### Fixed

- Canvas engine crash (`undefined.name`) on contracts referencing a contract-less component — now a named refusal.
- Styles scorer compares full RGBA instead of truncating to 6-digit hex.
- Switch canvas thumb spec carries fill/box/radius; state previews use literal node opacity (a bound 0–1 variable rendered the disabled preview at 0.5%); empty slots render empty, absent-and-named, instead of placeholder text; focus no longer renders the pressed fill (real-Chromium keyboard-focus probe pins it).
- Figma's manifest validator rejects IP-literal dev URLs — plugin manifest fixed so the plugin loads at all.

## [0.5.0] - 2026-07-09

### Added

- **Figma ground truth** — a "Figma render" toggle on the Canvas/Split views fetches the imported node's own render via the images API (any plan) beside the compiled canvas; anchors ride the contract, tokens stay session-only; every non-fetch state is named (no source, token gone, rate limit, node deleted since import).

### Changed

- **Playground declutter** — one output toolbar row with compact view controls; Controls | Receipts (N) become a Storybook-style collapsible bottom dock (count badge, auto-select on import, persisted collapse, keyboard accessible); canvas fidelity notes and provenance move into info popovers; nothing triple-stacks at laptop widths.


## [0.4.0] - 2026-07-09

### Added

- **Canvas preview** — Code | Canvas | Split views: the figma engine's compiled variant grid rendered Figma-canvas-styled; Light/Dark/Checker preview surface independent of app theme.
- **Code-import token minting** — raw literals and foreign `var(--*)` properties mint the provisional `imported.*` layer (substituted refs per enum axis, state leaves, verbatim carry for unresolvables); token stylesheets discovered across the repo tree when traced CSS uses undeclared properties.
- **The designer validation loop** — a minted contract's Figma script upserts an 'Imported (provisional)' variable collection before first lookup, so pasting it back into the source file builds the contract's version beside the original; the Sync Runner gained a paste-box UI that ends every run on the canvas (zoom to result, or plain-words already-exists with Select-it).
- **Wild-CSS extraction** — nesting, clsx/classnames maps, BEM modifiers, padding/border shorthand inversion.
- **Describe quality rules** — every enum axis must drive a visible binding, text props must render, selects render through options; Button exemplar.

### Fixed

- emitHtml select content model (previews showed an empty box); minted receipts parity for code imports; Cloudflare re-auth deploy gap.


## [0.3.0] - 2026-07-09

### Added

- **Minted provisional token layer** — degraded Figma imports render at literal fidelity; `imported.*` names never guess semantics; the workspace restores the layer; a receipts group lists every minted token with rename guidance.
- **Assist layer (server-side AI, under governance)** — Opus 4.8 behind forced tool schemas, CORS-locked, per-visitor daily limits and a global daily budget with named 429s: semantic rename suggestions for minted tokens (per-row/group/all Apply, refereed by the editor) and fetch-planning for code imports with repo profiles cached per repo@ref.
- **Directory-first GitHub import** — file or directory URLs; relative imports traced and fetched (capped, each receipted); gaps named; "Plan fetches with AI" as the explicit next rung.
- **Desktop Figma MCP import path** (CLI) — full variable names on any plan via the user's own Figma desktop app; recorded-fixture receipts at plugin-dump fidelity.
- **Describe model picker** — Claude Sonnet 5 or Claude Opus 4.8, choice receipted.
- Prism syntax highlighting across output tabs and the editable contract editor; resizable panes; chunk-failure recovery banner; Figma-tab fidelity ladder.

### Changed

- Figma REST imports and pasted dumps propose with minting enabled; code type steps up to 14px/13.5px; rail nav scrolls on one bordered row.

### Fixed

- Live Describe generations validate correctly (the API's tool-input envelope is unwrapped — refusals now name real issues).
- The preview no longer shows the previous component's render for a different contract id; demo refusals label themselves.
- The playground locks to the viewport; long outputs scroll inside their panes.
- Dependabot: 3 high / 2 moderate development-scope advisories cleared.


## [0.2.0] - 2026-07-08

### Added

- **Refusal-line highlighting** — a refusal names its line, paints it, and clicking it scrolls there (dependency-free editor overlay; unresolvable refusals highlight nothing).
- **Session workspace** — every import (Figma, code, prompt, JSON) collects in a source-tagged list that restores the contract with its receipts and states each entry's design↔code direction.
- **Interactive preview controls** — per-prop knobs (enum selects, boolean toggles, text inputs) render a single instance at any chosen state through the same html emitter; "no visible change — by design" noted honestly; Single | All variants toggle.
- **Spec-sheet view** — a JSON | Spec toggle renders the same contract as a read-only designer spec sheet: props table, variant combination count, slots, events, grouped token chips, a11y.
- **Help drawer** — coming-from-design / from-code / examples / from-nothing guides plus a seven-term glossary.
- **"What to notice" captions** on every gallery card, fact-checked against the contracts.
- **Reset affordances** — one-click restore of any loaded source's pristine original; the onboarding loop gains its reset step.
- Named refusal for anatomy references to contracts not in scope (was a crash).
- Fixed instance props canonicalize through the child contract's bindings (Size/"Small" → size/"sm").

### Changed

- Describe and Tokens rail panels: consistent vertical rhythm; active token source reads as a status line.
- Source rail widened with more tab spacing; contract and output pane headers share one aligned border.
- Emitter output tabs carry designer-language tooltips; receipts panel explains itself.

### Fixed

- Playwright verification artifacts removed from the repository tree and ignored.


## [0.1.0] - 2026-07-08

First public release: the contract-as-source-of-truth loop, proven end-to-end and running in a public browser playground. The dated evidence log for everything below is [MILESTONES.md](MILESTONES.md).

### Added

- **51 component contracts** (schema v8) — small versioned JSON files capturing props, anatomy, token bindings, slot constraints, accessibility semantics, and declared events — generating a typed React library and a native design-tool library from the same source.
- **282 DTCG design tokens** — primitives → brand modes → semantic aliases, light + dark themes × two brands — compiled by one pipeline to CSS custom properties and design-tool variable collections.
- **Multi-brand theming as a token-layer dimension**: adding a brand touches only `tokens/`; every generated component stays byte-identical (eval-proven).
- **Three-way parity differ** (`npm run parity`): every difference between contract, code, and canvas classified as *ahead*, *behind*, or *mismatched*, with a proposed remedy — plus the promotion loop, executed in both directions on live surfaces.
- **Eval suite: 56 executable checks** (`npm run eval`) running the real pipeline in a scratch copy — determinism against golden-output manifests, refusal of illegal contracts by name, detection of every claimed drift class, convergence after promotion, extraction round-trips.
- **Governed AI generation**: a compiled contract catalog (sharded — routing index + per-component shards — to fit an agent's context window at any component count) and a deterministic adherence judge; measured A/B result of 100/100 governed vs 69/100 ungoverned.
- **Contract-declared events** (schema v6): callback props with toggle semantics — controlled/uncontrolled handling and ARIA wiring generated into code; reflected on canvas as description text, a declared fidelity limit.
- **Schema expressiveness round** (v7): `elementByProp` (prop-driven HTML element), `layoutByProp` (per-enum-value layout), `stylesWhen` (whitelisted conditional literals), `overlay` (out-of-flow anatomy for tooltips/popups), `arrayOf` structured props — each shipped with a consuming contract.
- **Canvas state previews + text styles** (schema v8): an opt-in State variant axis (Hover / Focus Visible / Disabled) generated from the same declared state tokens that emit the CSS pseudo-classes, refused by name when hollow; named design-tool text styles minted from semantic typography tokens.
- **N-axis variants**: every enum prop becomes a canvas variant axis — full cartesian product with deterministic ordering.
- **In-place AMEND**: a contract change updates live component sets in place — set keys, variant node IDs, property IDs, and instance overrides all preserved; "regenerate" no longer means "destroy and recreate."
- **Provenance & staleness guards**: extraction snapshots carry file identity and age; the differ refuses to reason over the wrong file or stale data; an acknowledged-drift baseline ratchets known drift without going permanently red.
- **Brownfield extraction** (`extract/`): code→contract adapters for React/TSX (any props-type convention, forwardRef/memo, cva) and any Custom-Elements-Manifest-publishing library; design→contract from a plugin dump or straight from a **figma.com URL** via the REST mapper — all proposing full contracts (API, anatomy, token bindings), with unbound values reported alongside nearest-token candidates, never invented.
- **Round-trip identity receipts**: this repo's own generated components re-extracted from both surfaces match their shipping contracts with zero mismatches, red-tested (`extract/ROUNDTRIP-CODE.md`, `extract/figma/ROUNDTRIP.md`, `extract/figma/rest/ROUNDTRIP-REST.md`).
- **Four brownfield pilots** (`extract/pilots/`): Shoelace (58/58 components, reconciled against its community design kit), Mantine (245 components extracted in under a second), Eventz (a complete real-world code ⇄ design pair), and CBDS (full token sync, variable-bound generation, and in-place amend coexisting inside a foreign enterprise kit — native components untouched through four sync passes).
- **`core/` — the engine as a library**: schema, token corpus, both extraction proposers, and four emitters (`react`, `html`, `react-inline`, `figma-script`) behind a pluggable `Emitter` interface; browser-importable with zero node globals, receipted by `npm run core:browser-check`.
- **Public playground** at <https://ds-contracts-playground.pages.dev>, importing `core/` unmodified: examples gallery, governed contract editor with both refusal layers named on screen, all four emitters as output tabs with live preview, Figma URL import with the degradation ladder rendered as receipts, GitHub code import (verified over the real network), bring-your-own DTCG tokens, prompt-to-contract via a user-supplied Anthropic key (schema-constrained tool call, refusal-driven fix rounds), and shareable ~1 KB permalinks. Both credential-gated paths live-verified.
- **Contract Hub** (`npm run dashboard`): live component previews, per-prop binding maps across all three surfaces, token provenance, one-click parity runs, contract editing with regeneration, the full docs, and a Code Editor Simulator demonstrating contract-governed in-tool editing.
- **Sync Runner dev plugin**: executes generated sync scripts from disk with SHA-256 script-integrity verification; the entire canvas library rebuilt from a blank file this way and verified clean.
- **Documentation set** (docs/00–15): architecture, contract specification, token pipeline, parity loop, validation with evidence, honest generation, brownfield adoption, roadmap with falsifiable exit criteria, engine-as-library — plus the Astryx coverage map attributing every component in a 93-component industry library.

### Changed

- Anatomy extraction graduated from API-surface-only proposals to **full contracts** — parts, layout, token bindings, states, and events — in both reverse directions.
- The steady-state canvas update path changed from regenerate-by-replacement to **non-destructive in-place amend**, identity-matched by marker with an anchor-key fallback.
- The generation catalog changed from a single monolith to a **sharded catalog** (routing index + per-component shards + tokens), keeping retrieval inside an agent's context window as the component count grows.
- Determinism claims upgraded from self-comparison to **golden-output manifests** — byte-compare against recorded output, because determinism-vs-self proves nothing about correctness.

### Fixed

- Differ blind spots found by adversarial audit: boolean/text canvas defaults, property kinds, numeric code defaults, and one-sided deletions now all detected.
- Merge-attack refusals: contracts with duplicate code bindings are rejected by name.
- Amend identity at live-file scale: name-collision duplication of legacy standalone components (fixed via anchor-key identity fallback) and variant-axis changes gained by duplication instead of rename (fixed via rename-matching).
- Canvas renderer quirks: base-color seeding on reassigned bound paints; children-text default reconciliation.
- Three generator bugs masked by incremental building, caught by the from-blank rebuild.
- Three contract defects found by the visual canvas audit.
- Extractor gaps found by self-audit: cva/`VariantProps` support; skipped components are always reported, never silent.

[Unreleased]: https://github.com/southleft/ds-contracts-poc/compare/cd886e97a2f45464d1b0883a2adce3efab6acdaa...HEAD
[0.7.0]: https://github.com/southleft/ds-contracts-poc/commit/cd886e97a2f45464d1b0883a2adce3efab6acdaa
[0.6.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/southleft/ds-contracts-poc/releases/tag/v0.1.0
