# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — with one clarification about what the version refers to. The version in this file (and in `package.json`) tracks the **reference implementation**: the generators, differ, extractors, catalog, and eval suite in this repository. Individual component contracts carry their **own** semver, governed by the contract change policy ([docs/02 § Versioning & change policy](docs/02-contract-spec.md#versioning--change-policy)) — a Button at v1.5.0 and a repo at v0.1.0 are statements about two different things. Pre-1.0 on the repo signals that the spec shape may still move.

## [Unreleased]

- Round 5d — root-cause fixes for the four visual classes from the owner's live canvas review — is in flight on a branch and has not landed here.

## [0.7.0] - 2026-07-20

The showcase-and-shipping arc: the contract schema advanced v13 → v15 (closing a July v9 → v15 arc that moved the vocabulary from drawn shape to declared facts), the computed-capture floor joined extraction as its run-of-record instrument, the first npm packages shipped (`@ds-contracts/schema` 15.0.0, `@ds-contracts/cli` 0.1.0), and the eval suite grew 99 → 127 (60 → 127 across the two July releases). The dated narrative with receipts is [MILESTONES.md](MILESTONES.md). Bookkeeping note: schema v13, the live gauntlet, and the spec site landed inside the v0.6.0 *tag* window but after that entry was written — they are documented here.

### Added

- **Published npm packages (Two Journeys, Phase 1)** — `@ds-contracts/schema` 15.0.0 (the live Zod document + generated JSON schema, byte-identical to the repo's) and `@ds-contracts/cli` 0.1.0 (one zero-required-dependency binary: `init` / `extract` incl. the lazy computed floor / `generate --out --target --emitter --stories` / `figma` + `figma push` through the bridge / `diff` with CI exit codes / `propose-pr`), under npm workspaces. `registerEmitter()` opens the emitter registry (four built-ins unchanged; plugins appear in every consumer automatically); the bridge gains the CONTRACTS-BUNDLE route (the reverse direction: code pushes to the plugin). Publish stranger-verified: clean directory, `npm exec @ds-contracts/cli`, a working config in one command; every verb eval-pinned by a consumer-style smoke test that runs byte-stable twice from scratch.
- **Schema v13–v15.** v13: `Part.states` (part-level state overrides — color channels on text/icon/box) + cross-import token scope (linked contracts pull their own minted+captured layers on every surface). v14: multi-entry `tokensByProp` (ordered later-wins, conflicts refuse) + `literals`/`literalsByProp` channels. v15: `Part.declared` / `Part.declaredStates` carry keyword/literal channels with no token vocabulary (cursor, user-select, transitions, the A22 text channels, font-family stacks, background sub-channels, …) bounded by the `DECLARED_CHANNELS` registry (per-channel value grammars, draw|annotate canvas verdicts), plus `layout.wrap` and per-corner-radius / per-side-border-width literal channels. `contract.schema.json` regenerated at each step.
- **The computed-capture floor** (`extract/computed/`) — real-Chromium computed-style capture of every variant × state combo (double-run byte-identity REQUIRED; ≥3-axis pairwise certificate refuses by name), fusion into enriched contracts with leaf folding, a contradiction review queue with refusal-disciplined resolution (decisions ledgered, re-applied automatically), fidelity-gate scorecards against the real npm package, and an offline `regate` instrument that replays committed captures byte-reproducibly. Surfaced in the CLI as lazy `extract --computed`.
- **The Polaris showcase** (`examples/polaris/`) — 12 flagship Shopify Polaris components at a pinned SHA, run end to end: static promotion under a reviewed class map (114 carried / 2,360 named refusals) → the coverage round (var()-chain literal resolution with provenance and bounded calc; composition typography through Polaris's own Text css; carried 114→185) → floor promotion v0.2.0 (2,164 captures ×2 byte-identical) → v0.3.0 (Round 4, below) → v0.3.1 (Round 5c, below). Truth table 96/100 → **262/276 exact computed-style matches, every mismatch with a committed named cause**. The library was built LIVE into the owner's file (403/403 variables, Button 200 variants), rebuilt from the v0.2.0 floor with amend-in-place at scale, and finally rebuilt as **the verdict build** (Round 5b): 10/12 sets amended in place under stable node ids/keys (incl. the 220-variant Button), 2 named promotions by the script's own policy — the owner's first positive verdict on a live canvas build.
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
- **The spec site** (`site/`) — zero-new-dependency SSG (tsx + zod introspection), 22 pages, the schema reference GENERATED from the live Zod schema with a branch-coverage drift guard (the build fails by name on undocumented schema branches; 131/131 at v13), examples in three badge-labeled provenance classes (shipping / engine-replay / illustrative), engine-replayed How-it-works proofs (real differ findings verbatim, a build-computed dependency graph from the 1,618-set capture), byte-identical rebuilds.
- **The live gauntlet** (v0.6.0-tag window, documented here) — full-kit dump v1.6 capture (1,618 sets, 715 vars with modes, file version pinned), 1,106 variant PNGs banked, and a tiered live gauntlet: 127/127 refusal-free across all tiers yet a T2 parity median of 35.5% — **refusal-free ≠ pixel-right, quantified** — with 6 new failure classes ranked with fixtures into a separate live baseline (the standing visual-parity baseline untouched).
- **Astryx Phase A** (`examples/astryx/`) — the second-system exhibit: facebook/astryx (MIT, React + StyleX) pinned at `@astryxdesign/core@0.1.6`, extracted from the npm-shipped TSX source. Census 23/24 @ 57% median → **24/24 @ 65%** (keyof-enum + union-of-refs adapter rules, both eval-pinned on synthesized fixtures; 15 skips all named; proposals only, nothing promoted); StyleX token reader (`core/stylex-tokens.ts` — 186/186 tokens, `light-dark()` → the v1.6 modes shape); and the `.doc.mjs` referee — Meta's own shipped docs diffed against our proposals: 246 vendor props, 136 agree, 53 not-carried confirmed real by receipt, 93 named disagreements incl. **35 the vendor doc itself misses**, 0 silent — and it caught a real adapter gap (silent heritage drop), now receipted and pinned. The second-system assessment is committed (`extract/pilots/SECOND-SYSTEM-ASSESSMENT.md`), incl. the Nord license disqualification.

### Fixed

- **The six Phase B-3 canvas-engine findings at source** (`core/emit-figma-script.ts`): token-referenced shadow stacks lower to native effects (the rem-length parser gap that dropped every `p.shadow-button*`), the form-control placeholder color is contract-driven (no repo-vocabulary hardcode), the amend-seed carries variable alpha, the shape branch applies effect stacks, `amendSet` resizes the set container, inset-0 overlays lower to `layoutPositioning: 'ABSOLUTE'`. Plus the canvas-gate findings: padding LONGHANDS bind per side (token + literal paths), icon svg nodes carry intrinsic size (`createNodeFromSvg` + preview), effect stacks render in the canvas preview, declared `aspect-ratio` sizes height from the bound width.
- **De-noised canvas annotations** (owner directive): emitted component descriptions reduce to one caption line (`<Name> — generated from contract <id> v<version>`), a single trailing `†` marks the existence of code-only facts; all gap documentation lives in repo receipts only.
- Nested UA-margin neutralization (promoted `h2`/`p` parts no longer leak UA margins), emitted glyph `svg { display: block }`, and the fidelity gate now recreates the capture page's inherited text context from the control probe (a 13px Polaris body was scoring as a 16px page-chrome difference).
- **The react emitters emit VALID JS for hyphenated part names** — bracket access (`styles['label-2']`) in `emit-react` + `emit-react-inline`; identifier names keep the dot spelling byte-for-byte. Found by the CI validation executing every recipe step against the published CLI: `styles.label-2` parses as subtraction and throws at runtime, and the committed showcase output already carried it. The new `react-hyphenated-part-names-execute` eval EXECUTES both emitted modules (esbuild bundle + react-dom/server render) — grep-level checks cannot catch this class.
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

[Unreleased]: https://github.com/southleft/ds-contracts-poc/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/southleft/ds-contracts-poc/releases/tag/v0.1.0
