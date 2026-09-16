# Code ↔ contracts ↔ canvas

**Public project status · updated 2026-09-16 · v1 is not complete.**

The goal is to connect a team's code and design libraries through a shared contract: code becomes editable design components, design becomes reusable code, and supported changes can be repaired in either direction. This includes composed component sets such as data tables, forms and dialogs, with nested components, slots, instance swaps and other properties.

**V1 scope: React ↔ contracts ↔ Figma.** Lit and Web Components integration is paused for a planned V1.1 follow-up after the React journeys qualify. Their adapters, fixtures and evidence are preserved. The shared contract remains framework-neutral. Stateful and composed components, design-only React delivery and brownfield repair remain V1 requirements.

This page is the current status and outcome-based work order. It is also rendered in the playground and documentation site at `/system`. Earlier plans and dated measurements do not override it.

For installation and a step-by-step walkthrough from each starting point, read the [user journey guide](../docs/USER-JOURNEYS.md). The local app exposes it at `/start`; the documentation site at `/get-started/`. These entry points now link to available import and source-inspection actions and name unfinished delivery steps.

## The whole loop

![V1 workflows: React to contract to editable Figma; Figma to contract to reusable React; and changes through comparison, authorized repair and independent verification.](assets/product-loop.svg)

1. **Observe the original.** Record the actual source revision or Figma identity, states, themes, fonts and assets. Confirm that the reference is correctly styled.
2. **Derive a contract.** Carry supported APIs, anatomy, tokens, variants and composition into a shared representation. Name missing or ambiguous facts.
3. **Generate the target.** Compile the contract into native editable Figma elements or reusable code through the existing emitters.
4. **Verify the result independently.** Compare the actual native canvas or running code with the original, including structure, token bindings, content, editability and declared behavior.
5. **Maintain the agreement.** When either side changes, compare both with the last verified baseline, apply authorized repairs, and verify again. A repeat run must make no changes.

These steps describe the intended product workflow. The full application integration remains unfinished.

## Where we are

**Current milestone: complete the first React-led journey through the application.** Static React import, shared contract generators and a local companion-plugin connection exist. The React input path still needs a verified connection from the original styled component family to editable native Figma output. No complete React journey has qualified V1.

| Area | Demonstrated today | Remaining product gap |
| --- | --- | --- |
| React intake | Static TSX extraction and bounded CSS/StyleX anatomy extraction produce proposals. The reader can resolve some sibling types and helpers. | Publish the supported syntax/styling boundary, preserve complete dependency families through the app, and verify the original rendered states. API extraction alone is not visual or behavioral conversion. |
| Shared generation | Contract emitters represent layout, tokens, properties, content, slots and nested component references in React and native Figma programs. | Join these capabilities into the React user journey and verify their interactions across simple, stateful and composed components. |
| Native application connection | A bounded Lit Button cycle has exercised scoped variables, native variants, independent structural readback, native exports and repeat inspection through the app/plugin. Deliberate text drift was detected. | This is reusable integration evidence, not React import qualification. Visual fidelity, editability, candidate admission and complete interruption recovery remain unqualified. |
| Figma → reusable React | Readers propose contracts; deterministic emitters generate code. Existing designer-file checks account for supported facts and refusals. | Install and use the output as a reusable React library from design-only input, including content, variants, accessibility and declared behavior. |
| Changes and repair | Channel diffs, three-way merge rules, observations, a ledger and proposal planning exist. | The sync spine currently plans; it does not apply. Durable two-way apply, fresh verification, conflict handling, recovery and rollback need end-to-end proof. |
| Release readiness | Engine checks and scoped component evidence are available. | The complete React/Figma journeys and an independent cohort have not qualified v1. |

**No complete journey cohort has yet met the current v1 criteria.** Existing evidence reduces implementation uncertainty, but it is not a percentage of product completion. We do not have an evidence-backed completion date.

### Build rules that compose

A contract describes the component's parts, layout, tokens, properties, content and references to other components. Readers derive supported facts from React source or native Figma data; generators compile those facts into the other surface. The conversion path requires no AI. Optional AI proposals must pass the same validation as user-authored input.

A finite set of rules can describe many compositions. A table should reuse the rules for rows, cells, selection controls, slots and nested menus. Development must test those rules and their interactions rather than add a bespoke converter for every component name. New examples should expose a missing shared rule or verify an existing one.

This does not make arbitrary React programs convertible. Source patterns and styling systems need explicit support. Nor can a Figma drawing supply sorting logic, data fetching or validation rules. Existing code behavior needs a verified preservation boundary; design-only behavior needs a declared, tested implementation. Unresolved facts remain visible rather than receiving guessed values.

### Lit and Web Components: paused for planned V1.1

The configured Altitude `/sources` flow and its existing records remain available. They are not the React starting point or a prerequisite for React V1. Its native Button inspection is bounded evidence; Checkbox source observations do not establish native conversion. Neither qualifies a complete Web Components journey.

Preserve the current adapters, fixtures, tests, source captures and operation identities. Archive detailed working logs privately; keep reproducible checks and signed evidence intact. Resume framework-specific integration after the React V1 exits below, beginning with fresh source/dependency checks and a comparison against the then-current shared rules. Existing regression gates still run; pausing expansion does not waive them. V1.1 is a planned scope, not a release date or a support claim.

## Plan and measures of success

| Order | Milestone | Exit evidence | Status |
| --- | --- | --- | --- |
| 1 | Bound and verify React intake | Document supported React syntax and styling; pin source/dependencies; load original styles/fonts/assets; verify states and reject deliberately broken inputs. | Existing static readers; complete React intake qualification remains open. |
| 2 | Complete React → Figma through the app | Simple, stateful and composed React components through the same shared rules; editable native output; original/native screenshots and structural/token/property checks; no manual role maps or pasted scripts; repeat makes no changes. | **Active integration milestone.** |
| 3 | Complete Figma → reusable React | Design-only input; clean consumer installs the generated library; content APIs, variants, tokens, accessibility and declared behavior work; independent browser comparison. | Engines exist; full journey unqualified. |
| 4 | Repair an existing React/Figma pair safely | Real edits on either side; authorized changes applied; conflicting/stale edits handled; interruption/retry/rollback demonstrated; fresh verification; repeat makes no changes. | Foundations exist; full repair loop unqualified. |
| 5 | Qualify release readiness | Repeat the same journeys on independently selected supported React compositions, without component-specific conversion code or operator intervention; reproducible evidence and explicit unsupported cases. | Not yet reached. |

### React V1 acceptance surface

These are requirements to verify, not a list of features already qualified:

| Capability | Required evidence |
| --- | --- |
| Layout and styling | Supported sizing, alignment, spacing, typography and paint preserve their meaning; original and target renders are independently compared. Unsupported CSS is named. |
| Tokens and themes | Token identities, values, aliases and supported modes survive conversion and edits. |
| Properties and state | Text, enums, booleans and omitted values retain their semantics; declared interactions are tested separately from appearance. |
| Content and composition | Nested identities, parent-to-child property mappings, editable text, named slots and supported instance choices survive. Include a table, form or dialog-scale composition. |
| Delivery and maintenance | A clean consumer installs generated React; Figma output remains editable; authorized updates work both ways; conflicts, interruption, rollback and unchanged repeats are verified. |

Do not expand every property combination blindly. Cover each supported rule, its known interactions and representative compositions, then exercise an independently selected cohort. If a combination is unverified or unsupported, report it. A component-specific exception does not establish a general rule.

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

The paused Lit source workflow uses a configured sibling library. Each run must check the actual source and dependency identities; old captures do not establish current-source parity. Engineering writes are limited to Scratch and the user-provided DS Contracts Evaluations file. Existing operations remain bound to their original file; a new target requires a new operation identity. Altitude and CBDS remain read-only references.

### Implementation map

| Responsibility | Existing implementation to reuse |
| --- | --- |
| Browser engine imports and emitters | `playground/vite.config.ts`, `playground/src/engine/emitters.ts`, `core/index.ts` |
| React and Figma contract proposals | `playground/src/engine/code-import.ts`, `playground/src/engine/figma-import.ts`, `extract/figma/rest/fetch.ts` |
| Contract-to-Figma programs | `core/emit-figma-script.ts` |
| Canonical recipe canvas IR and writer | `recipe/figma-ir.ts`, `recipe/figma-writer-runtime.ts` |
| Paused Lit source workflow and reusable observation infrastructure | `source-reference/`, especially `source-reference/compile.ts` |
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
