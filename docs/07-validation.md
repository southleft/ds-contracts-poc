# 7 · Validation — Claims, Evals, Evidence

This PoC makes four falsifiable claims. Each is backed by an automated eval (`npm run eval`, 27 cases, runs the real pipeline in a scratch copy — not mocks) or an executed live design-tool check. Current status: **27/27 deterministic evals pass** (`evals/results.json`), all live checks pass. This section is written to be lifted into a PRD.

**Round 6 addendum (governed generation):** two eval cases exercise the deterministic generation judge itself — `judge-passes-canonical-screen` and `judge-catches-all-violation-classes` — backing the measured 100-vs-69 governed-generation A/B result in [docs/10](10-honest-generation.md).

**Round 7 addendum (events — the interaction surface):** contracts now declare events (`onToggle` + generated toggle + ARIA state; [docs/02 § Events](02-contract-spec.md)); a declared event callback deleted from code is detected as `code BEHIND` (`detect-code-removed-event`).

**Round 5 addendum (advanced composition + packaging):** the table family adds refusal of slot defaultContent outside `accepts` (`refuse-defaultContent-outside-accepts`) and detection of missing multi-child slot content (`detect-design-missing-multislot-content`) — plus the npm product-environment smoke test (`npm run verify:package`: SSR-renders a composed screen from `dist/`). See [docs/09](09-advanced-components.md).

**Round 4 addendum (composition):** the suite now also covers slots and nested components — refusal of circular/unknown composition (`refuse-circular-dependency`, `refuse-unknown-component-ref`), detection of missing slot properties, missing nested instances, slot-`accepts` drift against anchors, and removed slot props (`detect-design-missing-slot-property`, `detect-design-missing-nested-instance`, `detect-design-accepts-drift`, `detect-code-removed-slot-prop`). See [docs/08](08-composition-and-spec.md).

## The claims and their evidence

### C1 — The contract is deterministic
*Same contract in, byte-identical surfaces out. No generation lottery.*

| Eval | Result |
|---|---|
| `deterministic-regeneration` — full token build + component generation run twice, SHA-256 over every generated file | ✅ identical |

Why it matters for the PRD: determinism is what separates "generate from your design system" as an *architecture property* from "generate from your design system" as a model behavior you hope for. Compliance can be a property of the pipeline, not a judgment call about output.

### C2 — The contract refuses invalid states
*A drifted source fails loudly at build time; nothing is papered over.*

| Eval | Result |
|---|---|
| `refuse-unknown-token-reference` — contract binds a token that doesn't exist → generator must fail naming it | ✅ |
| `refuse-schema-invalid-contract` — structurally invalid contract → generator must fail | ✅ |
| `refuse-incomplete-mode-set` — token defined in light but not dark → token build must fail | ✅ |

### C3 — Drift on any surface is detected, classified, and actionable
*Ten drift classes across three surfaces; each caught with the correct classification (`ahead`/`behind`/`mismatch`) and, where applicable, a machine-generated promotion patch.*

| Eval | Drift class | Result |
|---|---|---|
| `baseline-parity-clean` | (control) no drift → no findings | ✅ |
| `detect-code-added-prop` | engineer adds a prop in code → `code AHEAD` + patch | ✅ |
| `detect-code-removed-prop` | prop deleted from code → `code BEHIND` | ✅ |
| `detect-code-enum-drift` | enum value added in code → `code MISMATCH` | ✅ |
| `detect-code-default-drift` | default changed in code → `code MISMATCH` | ✅ |
| `detect-design-missing-property` | property missing from the canvas set → `design BEHIND` | ✅ |
| `detect-design-extra-property` | property added on the canvas → `design AHEAD` + patch | ✅ |
| `detect-design-variant-options-drift` | variant option added on the canvas → `design MISMATCH` | ✅ |
| `detect-token-alias-drift` | variable alias retargeted in the design tool → `design-tokens MISMATCH` + adoption patch | ✅ |
| `detect-token-missing-variable` | token with no design-tool variable → `design-tokens BEHIND` | ✅ |
| `detect-token-extra-variable` | design-tool variable with no token → `design-tokens AHEAD` | ✅ |

*Eval ids and drift labels are shown here with the neutral `design` surface label; the ids and report labels on disk (`evals/`, `parity/report.json`) name the reference design tool's surface.*

### C4 — Promotion converges
*Applying the differ's own proposed patch returns the system to parity, with only the correct next step remaining.*

| Eval | Result |
|---|---|
| `promotion-converges` — code drifts ahead → differ's patch applied to the contract verbatim → regenerate → assert zero code findings and exactly one remaining finding: `design BEHIND` on the new property (the correct next action) | ✅ |

This is the loop's key property: the system never oscillates and never lies about what to do next.

## Live design-tool evals (executed July 3, 2026, not headless-repeatable yet)

| Check | Result |
|---|---|
| **Token round-trip losslessness** — the sync bridge's DTCG token export → dry-run re-import of the exported payload | ✅ **92 tokens parsed · 0 create · 0 update · 0 rename · 0 delete · 92 unchanged** (sync bridge v1.34.0) |
| **Export completeness** — exported DTCG carries scopes, code-syntax metadata, per-mode alias references, and the design tool's variable/collection IDs in `$extensions` (the dual-ID rename-survival pattern) | ✅ verified, including the previously promoted dark-mode change |
| **Two-direction promotion on live surfaces** | ✅ executed end-to-end — see [docs/06](06-parity-loop.md) |

## What is NOT yet validated (say this in the PRD too)

1. **Deep/complex composition** — one level of nesting is exercised across many contracts (Card ⊃ Avatar, ChatMessage ⊃ Avatar, Toolbar ⊃ IconButton, …). Not yet exercised: multi-level trees, slot arity enforcement, nested-part states.
2. **Multi-brand scale** — 50 components and 264 tokens, but one brand and one mode pair. No evidence yet about multi-brand systems (variant-matrix explosion per brand, token-set size, diff noise).
3. **Organizational behavior** — the promotion flow works mechanically; whether teams *accept* contract PRs as the arbitration door is a people question no eval answers.
4. **Visual fidelity** — out of scope by design; the loop guards structure and bindings, taste stays human. In practice this scope line matters more than it sounds: see "What 'parity clean' does and doesn't mean" below.
5. **Fresh-file rebuild** — the canvas library was built up incrementally in one file. Regenerating the whole library into a *blank* file from the current scripts has not been run end-to-end as a single operation.

## What "parity clean" does and doesn't mean

The differ verifies the **contracted API surface** on every component: props and their types, variant axes and option sets, boolean and text properties, slot properties and their `accepts`/preferred values, nested component instances, and every token variable (name, mode values, alias targets). That is what "parity clean" asserts — and each of those checks has a corresponding drift eval above.

It does **not** inspect anatomy internals: part-level layout and alignment, icon glyphs, meter geometry, static text parts, or `visibleWhen` wiring inside variants. Those are generated from the contract, but post-generation damage to them is invisible to the differ. This is not hypothetical: a July 2026 visual audit found a canvas-only defect (a chat bubble collapsing to hug-width because canvas and CSS have different `align` defaults) on a component the differ reported clean, because the defect lived below the API surface. The honest statement is therefore: *parity clean means the API contract holds on all three surfaces; anatomy fidelity is enforced at generation time and re-verified visually, not continuously.* Extending the differ one level down — an anatomy checksum per variant — is the identified next engineering round.

**Snapshot provenance:** the token snapshot the differ reads (`parity/snapshots/figma-tokens.json`) has been *derived* from `tokens/` since the token pipeline stabilized, rather than re-extracted from the design tool on every run. A full live extraction of all 264 variables (names, per-mode values, alias targets) was diffed against the derived snapshot on July 3, 2026: **264/264 exact matches, zero differences**. Derivation is safe today, but a periodic live re-extraction belongs in the loop so the check never becomes self-referential.

## AI adherence (the PRD's headline metric) — designed, then executed

Public design systems can't measure model adherence honestly — Material and Atlassian are in every frontier model's training data, so strong results flatter the ceiling. **This PoC's design system is private and novel, which makes it a clean adherence instrument.**

Harness design:

- **Tasks:** generation prompts ("build a settings form using this design system", …) given to an agent in two arms: (A) with the compiled contract catalog as context, (B) without.
- **Judges are deterministic, not LLM:** run the existing extraction + differ over each output — do all props/values exist in the contract? Are all colors/spacing `var(--…)` references into `tokens.css` (zero hex/px literals)? Are variant combinations legal? The parity differ **is** the judge; no rubric drift.
- **Metric:** adherence rate per arm; the gap A−B quantifies what the contract layer is worth.

**Executed result:** ungoverned arm **69/100 with 91 violations**; governed arm **100/100 with zero violations**, including honest gap-reporting when the system lacked a needed component. Full write-up, judge internals, and the two judge evals: [docs/10 — Honest Generation](10-honest-generation.md).

## Reproducing everything

```bash
npm install
npm run build     # C1/C2 gates run here too
npm run eval      # 16 deterministic evals → evals/results.json
npm run parity    # current three-surface drift report
```

Live checks additionally need the design tool's desktop app plus the sync bridge, v1.34+ (setup detail in the internal appendix, docs/internal/figma-sync.md). Keep the bridge's in-tool client updated with its server — client/server version skew was the root cause of an export failure during this work.
