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

## Where it actually stands (2026-08-04)

Updated against source, registry, and deployed surfaces separately rather than
treating a manifest edit as a release. Repository `1.0.0-rc.1`, CLI
`0.5.0-rc.1`, schema `16.1.0-rc.1`, and emitter `0.4.0-rc.1` were published as
the coordinated candidate under npm `next`; `latest` remains on the stable
line. The current conversion program advances CLI source to unpublished
`0.5.0-rc.2`, schema source to unpublished `17.0.0-rc.1` (schema 17, the `bindings` hoist), and emitter source
to unpublished `0.4.0-rc.2`. The coordinated verification and approval sequence is
[docs/27](docs/27-release-process.md).
Every open product limitation below has its symptom and status in
[docs/23](docs/23-known-limitations.md).

**Phase 1 — Harden the loop.** *In progress, and the instruments moved further than the parity work did.*

- ✅ Fresh-file rebuild (2026-07-06) — unchanged.
- ✅ **A standing offline drift instrument** — 54 rows across six libraries pinning `pctEqual` within tolerance, `cellsCompared` exactly, and `unresolvedTokenRefs` exactly ([docs/20](docs/20-regate-drift.md)). This is what makes cross-library damage a number rather than a vibe.
- ✅ **A canvas-drift fingerprint** in the plugin — per-variant, with snapshots of *what* changed — and the update check now refuses to overwrite a canvas edit without a named warning (gap G2, a live covenant violation, closed).
- 🟡 **Anatomy-level parity** — **instrument green (2026-08-05).**
  `npm run variant-drift:check` drives `parity/diff.ts` over committed
  fixtures and catches a four-way part-layout + binding edit inside one
  variant. Wave 7 also adds `npm run anatomy-diff:check` (contract anatomy
  channel lines + resolved cssVars floor). Stale `parity/snapshots/` without
  `variants` still report NOT EXTRACTED on a raw `npm run parity` until
  re-extracted — the CI exit criterion is the fixture gate, not the stale
  snapshot.
- 🟡 **Automated visual regression** — the per-library canvas gates are a regression net, not a frontier detector, and their canvas half is the weakest instrument in the repo (see Phase 3).
- 🟡 **Nested-part states** — narrowed, not closed: `Part.states` carries plain colour-kind refs only, so a delta that is a function of a state *and* an enum axis stays a named `overflowBindings` refusal. The base-plane equivalent is solved.

**Phase 2 — Brownfield adoption.** *The exit criterion is half met, and the honest half is the one that moved.*

- ✅ The diagnostic loop runs green→red→green on surfaces this repo did not generate (`diagnose-foreign-green-red-green`).
- ✅ **The public pilot is real — and it was wrong before it was right.** The Shoelace pilot was found to be **58/58 false-red**: because every name match failed, zero design properties had ever been compared. Post-fix it produces 259 real findings, with two independent cross-checks agreeing exactly.
- ✅ **Foreign token import shipped** — `figma bundle --tokens` compiles contracts against an org's own DTCG tree, and the contract JSON is now the only thing anyone pastes.
- ✅ **The coverage fraction is published for the first time** — 62 contracts across 893 library components, **6.9%**, per library, with denominators. It belongs on the roadmap because it defines what "adoption" currently means: *a hand-picked slice, configured by an expert, one round per novel styling method.*
- 🟡 **Still open:** binding-inference confidence scoring, the reconciliation UI, and the second half of the exit criterion — *a design system team confirming the drift report is true*. Note also that reconciliation compares API surfaces only; it cannot adjudicate a token or spacing disagreement.
- 🟡 **The concurrent-change story is partial.** Three-way merge engine (G3),
  awaiting-adoption pin (G4), and G7 propose-only suggested-diff stubs shipped
  under `workflow-spine:check`. UI surfaces, PR emitters, and team confirmation
  of a drift report remain open (docs/23 §B.13).

**Phase 3 — Spec candidacy.** *Groundwork, plus one distinction worth stating loudly.*

- ✅ **A CSS/DOM conformance fixture exists** ([conformance/](conformance/README.md)) — 53 synthetic cases whose expected dispositions are authored *independently* of the engine, so a construct that is neither carried nor named-refused is a hard failure rather than an absence. 50 green, 3 red, 0 yellow, on a decrease-only ratchet.
- ⚠️ **It is not Phase 3's conformance kit and should not be read as one.** It measures *this* engine's CSS/DOM frontier; Phase 3 asks for the eval suite repackaged to run against *any* implementation, which is a different artifact. Two things must also close before it could become one: the fixture's **canvas half is declared, not measured** ("carried" means "reached the contract", not "reached the canvas"), and every case is **one combo with no state axes** — precisely where the MUI and Carbon rounds found most of their defects.
- 🟡 The `spec/` draft, namespacing, normative compatibility rules and the extension model — **draft started 2026-08-05** (`spec/normative.md` + `spec/conformance/`). Second independent implementation and black-box harness remain open. `@ds-contracts/schema@16.0.0` is the latest published stable schema; the source tree's `16.1.0-rc.2` is not registry evidence until publication.

**Phase 4 — Community & governance.** Unstarted, as designed — it follows a second implementation.

---

## The next honest step

**Done (2026-08-05):** MUI predeclared 50% denominator is **31/31 carried**
(`examples/mui/oracle/DENOMINATOR-50.json`, `npm run mui:denominator:check`)
under the Exact Conversion Finish accuracy contract. SpeedDial remains a
fail-closed negative control outside the denominator. Offline oracle:
32 MATCH · 0 PENDING · 0 FAIL.

**Next:** Human/release gates on `RELEASE_CHECKLIST.md` (pilot sign-off,
Wave 8 drift confirmation, frozen-commit `ci:lane` full/catalog-visual,
live Figma re-probe, publish). Wave 11 packaging is READY (`spec/conformance/`);
Candidate status waits on a named second implementation. Not a seventh library.


