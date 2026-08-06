# 12 · Roadmap

Where this project intends to go, in public. Each phase has a **falsifiable exit criterion** — the same standard the rest of the repo holds itself to. Phases overlap in practice; the exit criteria don't move.

**The end state this roadmap points at:** a vendor-neutral, independently implementable **component contract specification** — doing for the component API layer what the DTCG spec did for tokens — with this repository as its reference implementation and conformance suite. Whether the spec ultimately lives here or graduates to a community-governed home, this is the candidate.

---

## Phase 0 — Prove the model *(complete, July 2026)*

The contract-as-source-of-truth loop, demonstrated end to end.

- [x] 51 component contracts generating a typed React library and a native design-tool library from the same JSON
- [x] 282 DTCG tokens compiled to CSS custom properties and design-tool variables (light + dark × Default/Aurora brand modes)
- [x] Three-way parity differ: every drift classified *ahead / behind / mismatched* with a proposed remedy
- [x] Promotion loop executed in both directions on live surfaces, with receipts ([docs/06](06-parity-loop.md))
- [x] 188/188 deterministic machinery evals ([docs/07](07-validation.md))
- [x] Governed AI generation measured: 100/100 with the contract catalog vs 69/100 without ([docs/10](10-honest-generation.md))
- [x] Coverage attributed against a full 93-component industry library ([coverage map](research/astryx-coverage.md))

**Exit criterion (met):** a skeptic can clone the repo, break parity on purpose, and watch the differ name the break and the fix.

## Phase 1 — Harden the loop

Close the honesty gaps the PoC itself documented, so every claim survives adversarial review.

- [x] **Anatomy-level parity** — extend the differ below the API surface with a per-variant anatomy fingerprint (part tree, layout, bindings), closing the gap described in [docs/07 § What "parity clean" does and doesn't mean](07-validation.md)
  - **Done (instrument):** `core/canvas-fingerprint.ts` v6 + `parity/extract-figma.plugin.js` transport + `parity/diff.ts` §2.5 + `npm run variant-drift:check` (fast lane). Offline fixtures prove a four-way interior edit is caught; absence of `variants` is NOT EXTRACTED.
  - **Wave 7 (2026-08-05):** `core/anatomy-diff.ts` + `npm run anatomy-diff:check` — contract anatomy channel lines and resolved cssVars floor on the code surface.
  - **Still honest:** committed `parity/snapshots/figma-components.json` may lag until a human re-extracts; CI trusts the fixture gate, not a stale snapshot's "clean" banner.
- [x] **Fresh-file rebuild** — executed 2026-07-06 via the Sync Runner dev plugin: blank file → 282 variables + 48 sets + arranged pages in one run, `diagnose` clean across all 50 contracts; caught three generator bugs incremental building had masked (docs/07 live checks) <!-- docs-check:ignore -->
- [ ] **Live token re-extraction in the loop** — the token snapshot is periodically re-extracted from the design tool, not only derived from `tokens/` (verified manually 264/264 on 2026-07-03; make it automatic)
  - **The COMPARATOR half is automated (2026-08-04).** `npm run tokens:snapshot:check` (fast lane) derives the variable table `tokens/` implies and diffs it against the extracted snapshot on name, every mode value and every alias target: **282/282** today, with two normalization rules that are each falsifiable (`--no-rule=px` → 26 phantom drifts, `--no-rule=alias` → 376). It prints the snapshot's age on every run rather than hiding it.
  - **The ACQUISITION half is human-gated, and the reason on record was wrong.** Two places in this repo called the Variables REST API Enterprise-plan-only. Measured with this repo's own PAT: `GET /v1/files/:key/variables/local` → 403 `"Invalid scope(s) … requires the file_variables:read scope"`, with a control `GET /v1/files/:key` → 200 on the same token. That is a **missing token scope**, not a plan tier, and nobody could have learned it because the tool swallowed the body. One curl with a scoped PAT settles whether this item is a cron job or unachievable as written — queued in [docs/HANDOFF.md](HANDOFF.md).
- [ ] **Visual regression baseline** — screenshot-per-variant-grid comparison, so the class of defect found in the July 2026 visual audit is caught mechanically
- [ ] **Close the declared schema gaps** ([docs/08](08-composition-and-spec.md)): ~~nested-part states~~ (see below), ~~parent→child prop mapping~~, ~~slot `min`/`max` + `restrict` enforcement~~, ~~slot default content~~ — **three of the four closed 2026-08-04; measuring them changed what each one was**
  - **parent→child prop mapping — was never open.** It is implemented on BOTH surfaces and was guarded by nothing, which is the more dangerous state. `contracts/table.contract.json` composes three `ds.table-header-cell` parts with `component.props = { density: "{density}" }`; `src/components/Table/Table.tsx` renders `<TableHeaderCell density={density}>`, and `figma-sync/42-table.js` carries `"Density": "Comfortable"` ×3 and `"Density": "Compact"` ×3 because `mapDepProps` resolves the placeholder against each combo's `subst` at COMPILE time. A grep for `density` in the emitted script therefore returns nothing, and inferring absence from that grep is the mistake this measurement avoided. Now pinned on both surfaces by `npm run composition-props:check`, falsified by breaking `PARENT_PROP_REF` in the real emitter and watching the literal `{density}` reach the script.
  - **slot `min`/`max` + `restrict` — a promise, not a live bug.** Measured over all 48 committed slots: `acceptsMode` 38, `accepts` 19, `defaultContent` 12, `required` 3, and `min` / `max` / `acceptsMode: 'restrict'` **zero**. All 38 `acceptsMode` values are `open` or `prefer`. The schema had accepted all three since slots existed while nothing refereed them — an author who wrote `max: 3` got silence. `validateContract` now refuses `min > max`, over-max and under-min `defaultContent`, `required` with `min: 0`, `restrict` with no `accepts`, and a `restrict` slot violating its own `accepts`. Gated by `npm run slot-constraints:check` with synthetic fixtures, because the corpus contains nothing to point at.
    - **`restrict` has no canvas spelling, and that is now proven rather than assumed.** Figma's `INSTANCE_SWAP` carries `preferredValues`, a picker HINT that sorts entries and prevents nothing. §4 of that gate drives the real engine over `ds.avatar-group` with only `acceptsMode` flipped and byte-compares: the two emitted scripts are IDENTICAL. The restriction is real in code and absent on canvas.
  - **slot default content — already implemented**, with reference resolution, cycle detection and a children-text check in `validateContract`; now covered by the legal-shapes pins in the same gate.
  - *nested-part states — STILL OPEN, and the measurement inverted its premise.* `Part.states` carries plain color-kind refs only on nested parts, which produced 371 named refusals — the largest single line in the loss ledger. But **199 of those 371 (53.6%) were never losses**: ten of the refused channels have the CSS initial value `currentColor`, so `getComputedStyle` reports the part's own `color` for any nobody authored, and in all 199 that sibling `color` is already carried. Carrying them would restate one fact as ten and pin what currently tracks. Two attempts at widening the door were built, adversarially reviewed and REVERTED — both shipped a safety claim that was false in the same direction (`packages/cli/src/promote.ts` turns `figmaStatePreviews` ON whenever `validateContract` accepts, so a newly carried nested binding is itself what unlocks the canvas path it was declared not to reach). The real remaining gap is smaller than this bullet implied and is specified on task #22.

**Exit criterion:** the differ (not a human with a screenshot) catches a hand-made change to a part's layout inside one variant; ~~a blank file rebuilds to parity in one run~~ *(✅ done — 2026-07-06, verified by diagnose)*.

## Phase 2 — Brownfield adoption

Connect **pre-existing** design and code libraries — no rewrite, no regeneration. Full plan: [docs/11](11-brownfield-adoption.md).

- [x] **Generalized code extractor (v0)** — `npm run extract:code`: react-tsx adapter (any props-type convention, forwardRef/memo, defaults, `on*` events) **plus a CEM adapter** covering any Custom-Elements-Manifest-publishing library; eval-covered (`extract-foreign-library`), walkthrough in [docs/13](13-try-it-with-your-system.md)
- [x] **Generalized design extractor (v0)** — `extract/figma-dump.js`: read-only, any file, API-surface properties only
- [ ] **Binding inference** — propose `figma`↔`code` name/value mappings with per-field confidence *(started: transparent alias rules + abbreviation mapping in `npm run reconcile`; confidence scoring and value-mapping inference still open)*
- [ ] **Reconciliation UI** — side-by-side proposal merge in the Contract Hub; extraction → contract v1 in minutes per component
- [x] **Foreign token import** — contracts reference an org's *existing* DTCG / Style Dictionary tokens, not this repo's *(✅ shipped — `figma bundle --tokens` compiles contracts against an org's own DTCG tree; the contract JSON is the only thing anyone pastes)*
- [x] **Public pilot** — Shoelace v2.20.1 (CEM extraction, 58/58 components) reconciled against the community Shoelace Figma kit (28 sets, dumped read-only). The extraction stands; the original drift report did not — it was discovered **58/58 false-red**: every name match failed, so zero design properties were ever compared. Post-fix the pilot produces **259 real findings**, cross-checked two independent ways with exact agreement — committed and reproducible (`extract/pilots/shoelace/`)

**Exit criterion:** the diagnostic loop runs green→red→green on two surfaces this repo did not generate *(✅ eval-proven: `diagnose-foreign-green-red-green` — `npm run diagnose` referees foreign code + a design dump)*, and a design system team confirms the pilot drift report is true — every finding real, none missed within declared scope.

## Phase 3 — Spec candidacy

Separate the **format** from the **implementation**, so a second party could build against it without reading this codebase.

- [ ] **`spec/` draft v0.1** — normative prose + the JSON Schema, versioned independently of the tooling; MUST/SHOULD language for refusal, drift-classification, and promotion semantics
- [ ] **Namespacing** — package-qualified or reverse-domain component IDs and a `$schema` URL convention (today's `ds.*` works for one system, not an ecosystem)
- [ ] **Normative compatibility rules** — widen-minor / narrow-major, prop and variant addition/removal semantics (currently prose in [docs/02](02-contract-spec.md))
- [ ] **Extension model** — namespaced binding blocks so new tools and frameworks add surfaces without forking the schema (the DTCG `$extensions` lesson)
- [ ] **Conformance kit** — the eval suite repackaged to run against *any* implementation, not just this one; a spec with a verifier is the differentiator over descriptive formats like CEM
- [ ] **Second independent implementation** — a renderer for another framework (e.g. Web Components) and/or a binding namespace for another design tool, built from the spec text alone

**Exit criterion:** an implementation this repo's authors didn't write passes the conformance kit. That is the line between "a format we use" and "a spec."

## Phase 4 — Community & governance

A spec is a social artifact. Single-author candidacy is where specs start, not where they live.

- [ ] **Contribution surface** — RFC process, CONTRIBUTING.md, versioned releases with changelogs
- [ ] **Engage the adjacent standards** — DTCG (the settled layer below; contracts consume DTCG tokens), the OpenUI Community Group (shared anatomy/part vocabulary), Custom Elements Manifest (emit/consume CEM as the code-side interop path)
- [ ] **Neutral governance home** — explore a W3C Community Group or equivalent multi-vendor venue once there is a second implementation and at least one adopting organization
- [ ] **Pilot organizations** — brownfield adoptions (Phase 2 tooling) feeding real-world requirements back into the spec draft

**Exit criterion:** a contract-format change is proposed, debated, and accepted by someone with no stake in this repository.

---

## Sequencing notes

- **Phase 1 and Phase 2 run in parallel.** Hardening protects the existing claims; brownfield creates the adoption evidence. Neither blocks the other.
- **Phase 3 starts when Phase 2's pilot exists**, because a spec drafted before contact with a foreign codebase would encode this repo's assumptions as requirements.
- **The Phase 2 public pilot is the highest-leverage single item on this page.** A methodology persuades nobody; a true drift report about a system people recognize starts every conversation that matters.
