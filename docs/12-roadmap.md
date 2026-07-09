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
- [x] 60/60 deterministic machinery evals ([docs/07](07-validation.md))
- [x] Governed AI generation measured: 100/100 with the contract catalog vs 69/100 without ([docs/10](10-honest-generation.md))
- [x] Coverage attributed against a full 93-component industry library ([coverage map](research/astryx-coverage.md))

**Exit criterion (met):** a skeptic can clone the repo, break parity on purpose, and watch the differ name the break and the fix.

## Phase 1 — Harden the loop

Close the honesty gaps the PoC itself documented, so every claim survives adversarial review.

- [ ] **Anatomy-level parity** — extend the differ below the API surface with a per-variant anatomy fingerprint (part tree, layout, bindings), closing the gap described in [docs/07 § What "parity clean" does and doesn't mean](07-validation.md)
- [x] **Fresh-file rebuild** — executed 2026-07-06 via the Sync Runner dev plugin: blank file → 282 variables + 48 sets + arranged pages in one run, `diagnose` clean across all 50 contracts; caught three generator bugs incremental building had masked (docs/07 live checks)
- [ ] **Live token re-extraction in the loop** — the token snapshot is periodically re-extracted from the design tool, not only derived from `tokens/` (verified manually 264/264 on 2026-07-03; make it automatic)
- [ ] **Visual regression baseline** — screenshot-per-variant-grid comparison, so the class of defect found in the July 2026 visual audit is caught mechanically
- [ ] **Close the declared schema gaps** ([docs/08](08-composition-and-spec.md)): nested-part states, parent→child prop mapping, slot `min`/`max` + `restrict` enforcement, slot default content

**Exit criterion:** the differ (not a human with a screenshot) catches a hand-made change to a part's layout inside one variant; ~~a blank file rebuilds to parity in one run~~ *(✅ done — 2026-07-06, verified by diagnose)*.

## Phase 2 — Brownfield adoption

Connect **pre-existing** design and code libraries — no rewrite, no regeneration. Full plan: [docs/11](11-brownfield-adoption.md).

- [x] **Generalized code extractor (v0)** — `npm run extract:code`: react-tsx adapter (any props-type convention, forwardRef/memo, defaults, `on*` events) **plus a CEM adapter** covering any Custom-Elements-Manifest-publishing library; eval-covered (`extract-foreign-library`), walkthrough in [docs/13](13-try-it-with-your-system.md)
- [x] **Generalized design extractor (v0)** — `extract/figma-dump.js`: read-only, any file, API-surface properties only
- [ ] **Binding inference** — propose `figma`↔`code` name/value mappings with per-field confidence *(started: transparent alias rules + abbreviation mapping in `npm run reconcile`; confidence scoring and value-mapping inference still open)*
- [ ] **Reconciliation UI** — side-by-side proposal merge in the Contract Hub; extraction → contract v1 in minutes per component
- [ ] **Foreign token import** — contracts reference an org's *existing* DTCG / Style Dictionary tokens, not this repo's
- [x] **Public pilot** — Shoelace v2.20.1 (CEM extraction, 60/60) reconciled against the community Shoelace Figma kit (28 sets, dumped read-only): 42 property agreements, 236 human decisions itemized — the drift report is real, committed, and reproducible (`extract/pilots/shoelace/`)

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
