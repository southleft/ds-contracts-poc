# React ↔ contracts ↔ Figma

**Public project status · updated 2026-09-16 · v1 is not complete.**

V1 targets React; Lit/Web Components are parked for V1.1. The goal is to connect a team's code and design libraries through a shared contract: code becomes editable design components, design becomes reusable code, and supported changes can be repaired in either direction. This includes composed component sets such as data tables, forms and dialogs, with nested components, slots, instance swaps and other properties.

This page is the current status and outcome-based work order. It is also rendered in the playground and documentation site at `/system`. Earlier plans and dated measurements do not override it.

For installation and a step-by-step walkthrough from each starting point, read the [user journey guide](../docs/USER-JOURNEYS.md). The local app exposes it at `/start`; the documentation site at `/get-started/`. These entry points now link to available import and source-inspection actions and name unfinished delivery steps.

## The whole loop

![Intended workflows: code to contract to editable Figma; Figma to contract to reusable code; and changes through comparison, authorized repair and independent verification.](assets/product-loop.svg)

1. **Observe the original.** Record the actual source revision or Figma identity, states, themes, fonts and assets. Confirm that the reference is correctly styled.
2. **Derive a contract.** Carry supported APIs, anatomy, tokens, variants and composition into a shared representation. Name missing or ambiguous facts.
3. **Generate the target.** Compile the contract into native editable Figma elements or reusable code through the existing emitters.
4. **Verify the result independently.** Compare the actual native canvas or running code with the original, including structure, token bindings, content, editability and declared behavior.
5. **Maintain the agreement.** When either side changes, compare both with the last verified baseline, apply authorized repairs, and verify again. A repeat run must make no changes.

These steps describe the intended product workflow. The full application integration remains unfinished.

## Where we are

**Current milestone: complete the first React-led journey through the application.** The app opens the original styled React implementation for the fixed Button, Checkbox and composed Card cohort. Source validation records the originals, checks authored style/font/state witnesses, replays archived resources without network fallback, and checks that intentionally broken references are rejected. Native conversion is the next integration step for this React entry point.

| Area | Demonstrated today | Remaining product gap |
| --- | --- | --- |
| Original React source | A host-configured source preset opens ten original cases. The app exposes source checks, archived replay, measured trees, negative controls and side-by-side source images. Changed inputs or altered evidence invalidate readiness. | General repository onboarding, broader theme/state coverage and the admission boundary into conversion. |
| React → editable Figma | React import retains component families, tokens, root content and supported nested scalar properties. Shared native emitters and the companion-plugin operation journal exist. Scoped native checks demonstrate editable child controls and stable repeat identities. | Connect the validated React sources to the native operation path; verify original-versus-Figma fidelity, structure and editability across the whole cohort. Parent-to-child live property mappings remain incomplete. |
| Figma → reusable React | Readers propose contracts and deterministic emitters generate React. | Install and use the output from design-only input in a clean consumer, including content, variants, accessibility and declared behavior. |
| Changes and repair | Channel diffs, three-way merge rules, observations, a ledger and proposal planning exist. | The sync spine currently plans; it does not apply. Durable two-way apply, fresh verification, conflict handling, recovery and rollback need end-to-end proof. |
| Release readiness | Shared engine checks and bounded evidence are available. | Complete both journeys, repair/recovery and the independent cohort before qualifying V1. |

**No complete journey cohort has yet met the current v1 criteria.** Existing evidence reduces implementation uncertainty, but it is not a percentage of product completion. We do not have an evidence-backed completion date. The milestone exits below show what remains and prevent individual demos from being mistaken for the finish line.

### React import and composition checkpoint

The local **Source validation** page opens the actual React implementation for a fixed ten-case shadcn cohort: Button, Checkbox and a composed Card. **Load React originals**, then **Validate React sources**, records the source/dependency identities, checks styles, theme, painted fonts and selected states, and compares stable original screenshots and measured trees with a fresh network-isolated replay. Representative cases must also reject missing CSS, theme, fonts, missing content and hidden content. Results remain provisional until final source-integrity checks finish. All ten cases stay in the denominator.

This validates the configured reference; it does not qualify Figma fidelity, editability, behavior or a complete journey. It is a fixed source preset, not automatic onboarding for arbitrary React repositories. Evidence stays private; after a dev-server restart, previous captures remain archived and the app requires a new validation. The [React V1 scope](../docs/REACT-V1-SCOPE.md) freezes the selected cases and outcome requirements. Earlier Lit controls remain in a collapsed V1.1 archive.

**Inspect React APIs** reads the original component modules with their installed TypeScript declarations. It retains inherited property types (including Checkbox's boolean/indeterminate union), declared defaults, forwarded spreads, conditional root choices and nested component references. The app distinguishes unresolved reads and stores the original source/declaration hashes privately. These facts expose information the single-file importer currently misses, including inherited types and the `Comp` alias. The live family read retains nine definitions but remains incomplete because their inherited `inlist` field is typed `any`; that field is named as unresolved. Feeding supported facts into contract proposals and binding them to rendered nodes remain unfinished; the inspector does not generate a qualified contract.

Importing a React source file into the playground now retains its readable component family and each component's minted styling tokens. Generated React preserves explicit root content and forwards supported text and boolean properties to nested components, including empty text, explicit false and omission. Defaults are read from each component's own props input. Browser checks exercise live updates in both generated React formats; the static HTML preview follows the same scalar defaults.

Generated Figma compositions expose their child instances' existing controls in the parent properties panel. A scoped live check confirms nested text edits and boolean values, and an unchanged repeat preserves node identities and instance overrides. Create and amend paths are covered for standalone parents and variant sets. This exposes child controls; it does not alias a React parent prop to a child prop. Native generation still refuses live parent-to-child text and BOOLEAN-property links by name. An explicitly declared boolean variant axis can supply child values. These shared compiler fixes do not qualify React source rendering, native visual fidelity or the complete code-led journey. The next milestone remains the application workflow with independently verified editable Figma output.

### Why integration is taking time

The repository has accumulated readers, emitters and component-specific proofs with different boundaries. Completing the product requires them to share component identity, token meaning, content APIs and reliable execution state. Visual similarity alone cannot establish those properties.

The current source also carries behavior that cannot be inferred from its appearance. A faithful conversion must retain a verified runtime or use an explicitly supported behavioral adapter. That makes integration and verification substantial work even when an isolated component already renders correctly.

The next progress report should show an improvement in the user journey, its evidence and its remaining blockers. More internal checks alone do not close a milestone.

## Plan and measures of success

| Order | Milestone | Exit evidence | Status |
| --- | --- | --- | --- |
| 1 | Trust the original inputs | Pinned source/dependencies, correctly loaded styles/fonts/assets, stable originals and deliberately broken input rejected. | Bounded source flow demonstrated; cohort coverage remains open. |
| 2 | Complete code → Figma through the app | Simple, stateful and composed components; editable native output; original/native screenshots and structural/token/property checks; no manual role maps or pasted scripts; repeat makes no changes. | **Active integration milestone.** |
| 3 | Complete Figma → reusable React | Design-only input; clean consumer installs the generated library; content APIs, variants, tokens, accessibility and declared behavior work; independent browser comparison. | Engines exist; full journey unqualified. |
| 4 | Repair an existing pair safely | Real edits on either side; authorized changes applied; conflicting/stale edits handled; interruption/retry/rollback demonstrated; fresh verification; repeat makes no changes. | Foundations exist; full repair loop unqualified. |
| 5 | Qualify release readiness | Repeat the same journeys on an independently selected supported cohort, without component-specific operator intervention; reproducible evidence and explicit unsupported cases. | Not yet reached. |

For every milestone, report:

- **Outcome:** what a user can now complete, through which interface.
- **Coverage:** selected components, states, themes and composition features, including failures and refusals.
- **Fidelity and usability:** original and target renders plus independent semantic, structural and editability checks.
- **Manual intervention:** setup, mappings, scripts or repairs still required.
- **Reliability:** changed inputs, missing prerequisites, conflicts, interruption and repeat behavior.

Do not tune source styling or comparison thresholds to make a candidate pass. Native Figma evidence must come from actual native nodes, not an HTML imitation. Preserve existing signed evidence and leave release approval to the owners.

## Architecture and boundaries

The contract records supported semantics: identity, properties, anatomy, token references and modes, layout, content/slots, component references and declared behavior. Rendering representations are projections of that contract. They do not become competing sources of truth.

Code-led contracts may retain an immutable reference to a host-verified original runtime. Only qualified editable channels may alter that runtime; preservation does not make every design edit effective. Design-only observations cannot supply undeclared business logic or authorize executable dependencies.

| Connection | Responsibility |
| --- | --- |
| Figma REST | Read file/node observations for imports and drift checks. |
| Companion Figma plugin | Execute the shared engine's native operations and return observations. The development plugin connects to the local app on port 5181 using an operation-specific capability; native qualification is still pending. |
| Figma MCP / Desktop Bridge | Engineering access for native execution and screenshots. A successful engineering probe does not prove the application journey. |
| CLI and local application service | Invoke the same deterministic readers, compilers and verification logic; retain operation state. |

The local source workflow currently uses a configured sibling library. Each run must check the actual source and dependency identities; old captures do not establish current-source parity. Engineering writes are limited to Scratch and the user-provided DS Contracts Evaluations file. Existing operations remain bound to their original file; new targets require new operation identities. Altitude and CBDS remain read-only references.

### Implementation map

| Responsibility | Existing implementation to reuse |
| --- | --- |
| Browser engine imports and emitters | `playground/vite.config.ts`, `playground/src/engine/emitters.ts`, `core/index.ts` |
| Code and Figma contract proposals | `playground/src/engine/code-import.ts`, `playground/src/engine/figma-import.ts`, `extract/figma/rest/fetch.ts` |
| Contract-to-Figma programs | `core/emit-figma-script.ts` |
| Canonical recipe canvas IR and writer | `recipe/figma-ir.ts`, `recipe/figma-writer-runtime.ts` |
| Styled-source evidence and unqualified drafts | `source-reference/`, especially `source-reference/compile.ts` |
| Application-owned source candidate jobs | `source-reference/service.ts`, `source-reference/candidate-jobs.ts`, `source-reference/candidate-run.ts` |
| Verified evidence selection and candidate inventory | `source-reference/binding-jobs.ts`, `source-reference/candidate-report.ts`, `source-reference/button-candidate-semantics.ts` |
| Unaccepted source-owned visual candidate | `source-reference/source-bound-anatomy.ts`, `source-reference/source-visual-seed.ts`, `source-reference/source-visual-contract.ts` |
| Verified original runtime preparation and React lowering | `source-reference/runtime-artifact.ts`, `core/runtime-emission.ts`, `core/emit-react.ts` |
| Runtime identity preservation and adoption refusal | `core/runtime-reference.ts`, `packages/core/src/contract-provenance.ts` |
| Actual plugin host | `figma-sync/plugin/engine/entry.ts`, `figma-sync/plugin/code.js` |
| Drift classification and merge computation | `core/channel-diff.ts`, `core/three-way-merge.ts` |
| Observation, baseline ledger and plan-only coordinator | `sync/observe.ts`, `sync/ledger.ts`, `sync/spine.ts` |

## How drift must be detected and repaired

Compare fresh code and canvas observations with the last mutually verified baseline.

- **Neither changed:** report a verified no-op.
- **One changed:** propose its supported changes and apply only under recorded authority.
- **Both changed:** combine compatible edits; report unresolved same-channel conflicts.
- **Inputs became stale:** reobserve and replan before writing.
- **Execution failed or was interrupted:** preserve operation and target identities; recover or roll back owned changes under checked preconditions. Do not advance the baseline on partial success.
- **Evidence is unavailable:** report the missing source, font, asset or connection. Unknown state is not synchronized state.

These are required product behaviors. The full loop remains unqualified.

## Keeping the public status current

Every pull request should state the user-visible outcome, validation, remaining limits and next milestone step. Update this page when usability, coverage or milestone status changes; say explicitly when a change improves internal machinery only. A merge does not imply deployment or a published package.

Keep the README focused on the product and present usability. Keep detailed experiment logs, handoffs and superseded working narratives in the gitignored `private/` archive. Reproducible fixtures, CI inputs, public technical references and signed evidence remain with their checks; housekeeping must not break reproducibility or rewrite grades.

When resuming work, read this page, [AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md), then verify the current worktree, source and PR state. After two attempts without new evidence, diagnose and replan.

### Checking these pages

`npm run docs:check` validates public claims and links. `npm run test:playground` includes canonical-document integration checks. `npm run site:build` builds the documentation site. The desktop/mobile documentation smoke test is `npm run test:product-overview:browser` with local servers on ports 5181 and 5182. These checks validate documentation surfaces, not conversion readiness.
