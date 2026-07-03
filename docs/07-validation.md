# 7 · Validation — Claims, Evals, Evidence

This PoC makes four falsifiable claims. Each is backed by an automated eval (`npm run eval`, 22 cases, runs the real pipeline in a scratch copy — not mocks) or an executed live-Figma check. Current status: **22/22 deterministic evals pass** (`evals/results.json`), all live checks pass. This section is written to be lifted into a PRD.

**Round 4 addendum (composition):** the suite now also covers slots and nested components — refusal of circular/unknown composition (`refuse-circular-dependency`, `refuse-unknown-component-ref`), detection of missing slot properties, missing nested instances, slot-`accepts` drift against anchors, and removed slot props (`detect-figma-missing-slot-property`, `detect-figma-missing-nested-instance`, `detect-figma-accepts-drift`, `detect-code-removed-slot-prop`). See [docs/08](08-composition-and-spec.md).

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
| `detect-figma-missing-property` | property missing from Figma set → `figma BEHIND` | ✅ |
| `detect-figma-extra-property` | property added in Figma → `figma AHEAD` + patch | ✅ |
| `detect-figma-variant-options-drift` | variant option added in Figma → `figma MISMATCH` | ✅ |
| `detect-token-alias-drift` | variable alias retargeted in Figma → `figma-tokens MISMATCH` + adoption patch | ✅ |
| `detect-token-missing-variable` | token with no Figma variable → `figma-tokens BEHIND` | ✅ |
| `detect-token-extra-variable` | Figma variable with no token → `figma-tokens AHEAD` | ✅ |

### C4 — Promotion converges
*Applying the differ's own proposed patch returns the system to parity, with only the correct next step remaining.*

| Eval | Result |
|---|---|
| `promotion-converges` — code drifts ahead → differ's patch applied to the contract verbatim → regenerate → assert zero code findings and exactly one remaining finding: `figma BEHIND` on the new property (the correct next action) | ✅ |

This is the loop's key property: the system never oscillates and never lies about what to do next.

## Live-Figma evals (executed July 3, 2026, not headless-repeatable yet)

| Check | Result |
|---|---|
| **Token round-trip losslessness** — `figma_export_tokens` (DTCG) → `figma_import_tokens` dry-run of the exported payload | ✅ **92 tokens parsed · 0 create · 0 update · 0 rename · 0 delete · 92 unchanged** (figma-console-mcp v1.34.0) |
| **Export completeness** — exported DTCG carries scopes, `codeSyntax`, per-mode alias references, and Figma `variableId`/`collectionId` in `$extensions` (the dual-ID rename-survival pattern) | ✅ verified, including the previously promoted dark-mode change |
| **Two-direction promotion on live surfaces** | ✅ executed end-to-end — see [docs/06](06-parity-loop.md) |

## What is NOT yet validated (say this in the PRD too)

1. **Deep/complex composition** — one level of nesting (Card ⊃ Avatar), two slots, four components. Not yet exercised: multi-level trees, parent→child prop mapping, slot arity enforcement, nested-part states.
2. **Scale** — 4 components, 106 tokens, 1 brand. No evidence yet about 60-component, multi-brand systems (variant-matrix explosion, token-set size, diff noise).
3. **Organizational behavior** — the promotion flow works mechanically; whether teams *accept* contract PRs as the arbitration door is a people question no eval answers.
4. **Visual fidelity** — out of scope by design. The loop guards structure and bindings; taste stays human.
5. **AI generation adherence** — designed but not run; see below.

## Designed next eval: AI adherence (the PRD's headline metric)

Public design systems can't measure model adherence honestly — Material and Atlassian are in every frontier model's training data, so strong results flatter the ceiling. **This PoC's design system is private and novel, which makes it a clean adherence instrument.**

Harness design (buildable on what exists today):

- **Tasks:** N generation prompts ("build a settings form using this design system", …) given to an agent in two arms: (A) with the contracts + tokens as context, (B) without.
- **Judges are deterministic, not LLM:** run the existing extraction + differ over each output — do all props/values exist in the contract? Are all colors/spacing `var(--…)` references into `tokens.css` (zero hex/px literals)? Are variant combinations legal? The parity differ **is** the judge; no rubric drift.
- **Metric:** adherence rate per arm; the claim to test is that arm A approaches 100% *because the checks are structural*, and the gap A−B quantifies what the contract layer is worth.

## Reproducing everything

```bash
npm install
npm run build     # C1/C2 gates run here too
npm run eval      # 16 deterministic evals → evals/results.json
npm run parity    # current three-surface drift report
```

Live checks additionally need Figma Desktop + the figma-console-mcp Desktop Bridge (v1.34+; keep the plugin re-imported when the server updates — version skew between server and plugin was the root cause of an export failure during this work).
