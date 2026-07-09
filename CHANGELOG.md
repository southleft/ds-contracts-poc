# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) — with one clarification about what the version refers to. The version in this file (and in `package.json`) tracks the **reference implementation**: the generators, differ, extractors, catalog, and eval suite in this repository. Individual component contracts carry their **own** semver, governed by the contract change policy ([docs/02 § Versioning & change policy](docs/02-contract-spec.md#versioning--change-policy)) — a Button at v1.5.0 and a repo at v0.1.0 are statements about two different things. Pre-1.0 on the repo signals that the spec shape may still move.

## [Unreleased]

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

[Unreleased]: https://github.com/southleft/ds-contracts-poc/compare/v0.1.0...HEAD
[0.4.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/southleft/ds-contracts-poc/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/southleft/ds-contracts-poc/releases/tag/v0.1.0
