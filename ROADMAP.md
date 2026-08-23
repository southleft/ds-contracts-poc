# Roadmap

*Looking for how to **use** this rather than where it's going? Start at [Choose Your Path](docs/00-choose-your-path.md) — design-first (canvas into code), code-first (code into Figma), or a brownfield pair reconciled. Deciding whether to **adopt** it? Start at [Known Limitations](docs/23-known-limitations.md) instead — it is the honest counterweight to this page.*

The public roadmap lives in the documentation: **[docs/12-roadmap.md](docs/12-roadmap.md)**.

Short version — four phases, each with a falsifiable exit criterion:

0. **Prove the model** — complete (July 2026): 51 component contracts, two generated surfaces, three-way parity, 213/213 evals, measured governed-generation result. <!-- docs-check:ignore -->
1. **Harden the loop** — anatomy-level parity, fresh-file rebuild, automated visual regression.
2. **Brownfield adoption** — extract proposed contracts from *pre-existing* design + code libraries, reconcile, run diagnostic-only; public pilot on a real open-source pair.
3. **Spec candidacy** — separate format from implementation: normative spec draft, conformance kit, and a second independent implementation.
4. **Community & governance** — RFC process, engagement with DTCG / OpenUI / CEM, and a neutral multi-vendor home.

---

## Where it actually stands (2026-08-23)

Updated against source, registry, CI and the committed receipts separately,
rather than treating a manifest edit as a release. Repository `1.0.0-rc.1`,
CLI `0.5.0-rc.1`, schema `16.1.0-rc.1`, and emitter `0.4.0-rc.1` were
published as the coordinated candidate under npm `next`; `latest` remains on
the stable line. The source tree is ahead of both: CLI `0.5.0-rc.2`, schema
`17.0.0-rc.1` (schema 17 — the contract-level `bindings` hoist, a MAJOR with
the `ds-contracts migrate` codemod), emitter `0.4.0-rc.2`, and a fourth
package, `@ds-contracts/core` `0.1.0-rc.1`, none of them published. The
coordinated verification and approval sequence is
[docs/27](docs/27-release-process.md). Every open product limitation below
has its symptom and status in [docs/23](docs/23-known-limitations.md); the
2026-08-22 → 23 closures are its §D.12–D.28.

**Phase 0 — one truth (2026-08-22, PR #18).** *Done, and it was a
precondition, not progress.* Before it, all three required lanes had been red
on `main` since mid-August, `evals/results.json` claimed a pass count no CI
run had ever reproduced, `npm run maintain` existed only in an uncommitted
tree, and a clean clone could not build the plugin. Now the eval record
carries the commit it measured and `eval:record:check` fails the full lane
row-by-row on disagreement; `schema:fresh`, `figma:fresh` and
`capability:fresh` refuse stale projections; `ci:lanes` expands `maintain`
so every leaf provably runs in a lane, and `maintain:visual` runs in the
catalog-visual lane with the repository's `FIGMA_TOKEN`; the golden path was
re-run on a fresh clone at eight stems.

**Phase 1 — Harden the loop.** *The instruments moved, and this time the
engine moved with them.*

- ✅ Fresh-file rebuild (2026-07-06) — unchanged.
- ✅ **A standing offline drift instrument** — 54 rows across six libraries pinning `pctEqual` within tolerance, `cellsCompared` exactly, and `unresolvedTokenRefs` exactly ([docs/20](docs/20-regate-drift.md)). Still a dev-machine instrument: it runs in no lane and dirties tracked scorecards while it runs (docs/23 §B.28).
- ✅ **A canvas-drift fingerprint** in the plugin — per-variant, with snapshots of *what* changed; the update check refuses to overwrite a canvas edit without a named warning (G2). The dump script reads the stamp back and hop-4 recovers it; the CI-side headless recompute is still the open half (docs/23 §B.14).
- ✅ **Named or carried (2026-08-22, PRs #19, #21).** Eight verified silent losses closed with the check that would have caught each, all in `maintain` and the fast lane: root `attrs` on every code target, multi-axis state refs on WC, child-part state channels, the recovered ToggleSwitch thumb, per-fact `codeOnlyFacts` everywhere a person reads (2,321 named facts across 104 receipts), a visual gate that sees geometry, a token runtime that refuses and names, `tokens.css` on generate. The canvas round trip of the conformance fixture is at **0 SILENT** on a decrease-only ratchet (`conformance:roundtrip`, 46 cases).
- 🟡 **Anatomy-level parity** — instrument green (`variant-drift:check`, `anatomy-diff:check`); stale `parity/snapshots/` still report NOT EXTRACTED on a raw `npm run parity`, and `npm run diagnose` exits non-zero on the committed first-party snapshot (docs/23 §B.28).
- 🟡 **Automated visual regression** — the catalog gate now fails a geometry move by name (±4 device px, per-platform baselines), but it remains a regression net over the catalog, not a frontier detector.
- 🟡 **Nested-part states** — narrowed again, not closed: child-part state-only shadow / stroke / radius / opacity carry as `Part.states`; a delta that is a function of a state *and* an enum axis is still a named refusal.

**Phase 2 — Brownfield adoption.** *The held-out exam happened, and the honest half is still the one that moved.*

- ✅ The diagnostic loop runs green→red→green on surfaces this repo did not generate (`diagnose-foreign-green-red-green`).
- ✅ **The public pilot is real — and it was wrong before it was right.** The Shoelace pilot was found to be **58/58 false-red**; post-fix it produces 259 real findings, with two independent cross-checks agreeing exactly.
- ✅ **Foreign token import shipped** — `figma bundle --tokens` compiles contracts against an org's own DTCG tree, and since 2026-08-22 takes the layered grammar `generate` uses, so the first-party corpus rides the bundle too (`first-party-bundle:check`).
- ✅ **The coverage fraction is published with its denominators** — the 101 covered components are **10.7%** of the 943 in the seven libraries with a measured size ([docs/24 §2](docs/24-what-works.md)). It belongs on the roadmap because it defines what "adoption" currently means: *a hand-picked slice, configured by an expert, one round per novel styling method.*
- ✅ **The held-out canvas→code exam (2026-08-22 → 23, PRs #22, #23).** A hand-built kit this engine had never seen, through the REST Journey A path: 3,556 canvas facts, **295 silent → 2**, wrong-name 8 → 0, should-carry 25 → 0; Button recognisable, Card not, every Card loss named ([receipt](parity/receipts/phase-2/FIGMA-DS-EXAM.md)). The REST route now names a missing `file_variables:read` scope once, with the fix, instead of calling it a plan limit; `generate` refuses per contract; a prop named like a DOM attribute is `Omit<>`-ed and named. The two silences closed on 2026-08-23 (docs/23 §D.29 — `conformance:canvas` 152/152, 0 RED-EXPECTED; a native SLOT's primary-axis FILL now carries as `layout.grow`); the slot's interior auto-layout (§B.24) and the Card's slot content (§B.26) remain named.
- 🟡 **Still open:** binding-inference confidence scoring, the reconciliation UI, and the second half of the exit criterion — *a design system team confirming the drift report is true*. Reconciliation still compares API surfaces only.
- 🟡 **The concurrent-change story is partial** (G3 engine, G4 pin, G7 stubs under `workflow-spine:check`); UI surfaces, PR emitters and team confirmation remain open (docs/23 §B.13).

**Phase 3 — Spec candidacy.** *The format is separable from the implementation now; the second implementation is still nobody's.*

- ✅ **A CSS/DOM conformance fixture exists** ([conformance/](conformance/README.md)) — 82 synthetic cases whose expected dispositions are authored *independently* of the engine: 79 green, 3 red (the same three UNDECLARED-CARRY rows), 0 yellow, on a decrease-only ratchet — and its canvas half is now **measured**, not declared (`conformance:roundtrip`).
- ✅ **`@ds-contracts/core` exists (2026-08-22, PR #20, slices 1–2).** The emitter surface (`Emitter`, the registry, the token resolver, provenance) and the analysis half of `emit-react` (`validateContract`, `generateCss`, multi-root, grid, the prop classifiers, the prop/DOM collision rule) are a package that depends on the schema and nothing else; `verify:published` (full lane) packs the four tarballs into a temp project and generates the Flowbite eight through a Vue emitter that depends on the tarballs alone. This is what makes "Vue/Svelte/Angular as later plugins" a true sentence; it is not a second implementation.
- ✅ **Schema 17 (2026-08-22, PR #24).** Every Figma-only field lives under `bindings.figma`; a v16 spelling refuses by name with the codemod in the message (`contracts:migrate:check`, fast lane). The vendor-neutral claim is now a property of the document, not a comment.
- ⚠️ **The conformance fixture is not Phase 3's conformance kit and should not be read as one.** It measures *this* engine's frontier; Phase 3 asks for the suite repackaged to run against *any* implementation, and every case is still one combo with no state axes.
- 🟡 The `spec/` draft, namespacing, normative compatibility rules and the extension model — `spec/normative.md` v0.2 carries schema 17; the second independent implementation and the black-box harness remain open. `@ds-contracts/schema@16.0.0` is the latest published stable schema; the source tree's `17.0.0-rc.1` is not registry evidence until publication.

**Phase 4 — Community & governance.** Unstarted, as designed — it follows a second implementation.

---

## The next honest step

**Done (2026-08-23):** one truth (Phase 0), the verified silent losses named
or carried (Phase 1), the held-out exam to zero silences (Phase 2), the
published core and schema 17 (Phase 3 slices). `npm run maintain` is fifteen
steps and every one of them is a lane step; the committed eval record is the
one CI reproduces.

**Next, in order:** the exam SLOT's interior auto-layout and the Card's slot
content (docs/23 §B.24, §B.26); a read-only drift compare so `extract:computed:drift`
can be release evidence (§B.28); the first-party snapshot re-capture behind
`npm run diagnose` (§B.28); then the human/release gates on
`RELEASE_CHECKLIST.md` — whose automation evidence is still frozen at
`5adfc8bc`, before schema 17 and `@ds-contracts/core` existed, and must be
re-frozen before any approval row is read. Wave 11 packaging is READY
(`spec/conformance/`); Candidate status waits on a named second
implementation. Not a seventh library. Not v1.
