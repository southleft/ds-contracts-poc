# Code ↔ contracts ↔ canvas

**Public project status · updated 2026-09-15 · v1 is not complete.**

The goal is to connect a team's code and design libraries through a shared contract: code becomes editable design components, design becomes reusable code, and supported changes can be repaired in either direction. This includes composed component sets such as data tables, forms and dialogs, with nested components, slots, instance swaps and other properties.

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

**Current milestone: complete the first code-led journey through the application.** Source inspection, bounded candidate preparation and a local companion-plugin connection are implemented. The first live Button inspection has completed through the app and development plugin: scoped variables, five variants, six comparison instances, independent structural readback and six native exports. One refused source case remains in the coverage total. The same candidate has passed read-only repeat inspection with identical exports and token values. A deliberate native text edit was detected, and restoring it recovered the original result. Slot identities remain traceable when Figma normalizes instance contents; no new creation commands were issued for these inspections. Source-derived framing is now available for all six native cases in the app: exact archived replay, measured bounds, preserved original pixels and a shared image scale. Visual fidelity, editability and admission remain unqualified.

| Area | Demonstrated today | Remaining product gap |
| --- | --- | --- |
| Original source inspection | The local `/sources` workflow records styled originals and checks source identity, font/style readiness, bounded API/content facts and negative controls on a configured library. New captures can compare supported lifecycle-generated local IDs by their verified label/help-text references; caller IDs and other state remain exact. The source-run selector retains access to earlier results and native inspections. | General onboarding and qualification across a complete state/theme/component cohort. |
| Code → editable Figma | The local app now offers **Prepare connection** and **Create and inspect**, linked to the development companion plugin. The journal drives scoped token creation, token readback, component/comparison creation and independent structural readback. The first live Button cycle has completed in Scratch, alongside API-mock and browser coverage. Native PNG exports are retained privately and displayed beside available recorded source cases as unqualified diagnostics. **Frame original for comparison** derives a crop from an exact archived replay; both images share a selectable scale while retaining their actual dimensions and separate backgrounds. Saved plugin receipts can retry delivery without repeating allocation; **Retry readback** replaces only an interrupted or refused observation; **Inspect again** reads the existing candidate after a successful inspection. | Compare native output with the styled original and verify editability and a no-change repeat across simple, stateful and composed components. The live Button result is a first integration checkpoint, not cohort qualification. A lost creation delivery remains explicitly unknown; complete interruption recovery is still unfinished. The source candidate is not accepted. |
| Figma → reusable code | Readers propose contracts; deterministic emitters generate code. Existing designer-file checks account for supported facts and refusals. | Install and use the output as a reusable React library from design-only input, including content, variants, accessibility and declared behavior. |
| Changes and repair | Channel diffs, three-way merge rules, observations, a ledger and proposal planning exist. | The sync spine currently plans; it does not apply. Durable two-way apply, fresh verification, conflict handling, recovery and rollback need end-to-end proof. |
| Release readiness | Engine checks and scoped component evidence are available. | The complete journeys and an independent cohort have not qualified v1. |

**No complete journey cohort has yet met the current v1 criteria.** Existing evidence reduces implementation uncertainty, but it is not a percentage of product completion. We do not have an evidence-backed completion date. The milestone exits below show what remains and prevent individual demos from being mistaken for the finish line.

### Stateful source intake

The fresh ten-state app capture now records semantic evidence for all four Checkbox states: default, checked, indeterminate and disabled. Total API/content intake is 8/10; the disabled Button and failed Card image remain refused. Original screenshots and tree records match the previous baseline byte for byte in all ten states. This is source intake progress, not Checkbox generation.

Fresh captures distinguish a narrow supported pattern of lifecycle-generated IDs from caller-supplied IDs. The source reader identifies direct `nanoid()` fallback assignments to declared string properties. An explicit lifecycle probe records unset-before/assigned-after values, and replay checks unique IDs and local label/help-text references in their actual shadow-root scopes. Every raw ID and receipt remains intact. Missing provenance, duplicate IDs, broken references, state changes and caller-ID changes remain refusals. This establishes bounded DOM-reference equivalence, not behavior or accessibility approval; historical captures are not retroactively qualified.

The next stateful step is to carry Checkbox anatomy, checked/disabled state and content through candidate preparation and native generation. The current candidate adapter is still Button-specific. Checkbox interaction behavior and the source's mixed-state accessibility remain unqualified.

The shared engine can now preserve an optional boolean as three distinct native variants: omitted, false and true. Typed readback restores the boolean API without inventing a default. A scoped live Figma fixture and both generated React surfaces preserve these states, and repeat native generation leaves its node identities and canonical readback unchanged. This is an engine prerequisite; it does not enable Checkbox candidate generation through the application.

The source reader retains TypeScript return casts and authored static-HTML input/label syntax. Fresh app captures can now observe the actual Lit render result and corroborate registered nested-component tags against exact source strings and archived replay. The observer does not call render again or rewrite the source, and unexpected substitutions remain refusals. The structural trace now retains pseudo-elements with their source-element owners and independently checked styles, and maps literal or scalar source text to its exact DOM position. The original Checkbox field note is traceable through its nested fallback component. Content changes still need causal verification; nested component preservation and the generic candidate adapter still require integration. These observations do not enable a new Checkbox generation action.

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
