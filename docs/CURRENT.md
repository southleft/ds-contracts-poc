# React ↔ contracts ↔ Figma

**Public project status · updated 2026-09-16 · v1 is not complete.**

V1 targets React; Lit/Web Components are parked for V1.1. The goal is to connect a team's code and design libraries through a shared contract: code becomes editable design components, design becomes reusable code, and supported changes can be repaired in either direction. This includes composed component sets such as data tables, forms and dialogs, with nested components, slots, instance swaps and other properties.

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

**Current milestone: complete the first React-led journey through the application.** The app opens the original styled React implementation for the fixed Button, Checkbox and composed Card cohort. Source validation records the originals, checks authored style/font/state witnesses, replays archived resources without network fallback, and checks that intentionally broken references are rejected. The app can now create and independently inspect supported native root drafts. A separate Button instance now contains caller text and passes independent structure readback. The app now compares source/native images at original pixel scale with measured dimensions. Visual fidelity, state and composed-component comparisons remain unfinished.

| Area | Demonstrated today | Remaining product gap |
| --- | --- | --- |
| Original React source | A host-configured source preset opens ten original cases. The app exposes source checks, archived replay, measured trees, negative controls and side-by-side source images. Changed inputs or altered evidence invalidate readiness. | General repository onboarding, broader theme/state coverage and the admission boundary into conversion. |
| React → editable Figma | The local app creates native root variants with bound variables and empty editable content slots through the companion plugin. A Button root operation and a separate caller-text comparison instance passed independent structure readback. Saved operations reopen without repeating creation. | Complete caller-content comparisons, runtime states and composed components; verify fidelity and editability across the whole cohort. Parent-to-child live property mappings remain incomplete. |
| Figma → reusable React | Readers propose contracts and deterministic emitters generate React. | Install and use the output from design-only input in a clean consumer, including content, variants, accessibility and declared behavior. |
| Changes and repair | The app applied a reviewed opacity correction to four existing Checkbox variants and independently read it back twice, preserving their node identities. Channel diffs, three-way merge rules and proposal planning also exist. | This correction is bounded to opacity. The sync spine currently plans; it does not apply. General two-way apply, baseline advancement, interruption recovery and rollback still need end-to-end proof. |
| Release readiness | Shared engine checks and bounded evidence are available. | Complete both journeys, repair/recovery and the independent cohort before qualifying V1. |

**No complete journey cohort has yet met the current v1 criteria.** Existing evidence reduces implementation uncertainty, but it is not a percentage of product completion. We do not have an evidence-backed completion date.

### What the React application can do now

The local `/sources` page opens a fixed ten-case shadcn cohort: Button, Checkbox and a composed Card. **Validate React sources** checks the originals, theme, fonts and selected states against an isolated archived replay; representative cases must reject deliberately missing or hidden content and assets. This is a configured source preset, not arbitrary repository onboarding. The [React V1 scope](../docs/REACT-V1-SCOPE.md) defines the cohort and required outcomes.

**Inspect React APIs** reads installed declarations and original JSX into incomplete contract proposals. It preserves supported typed values, omission, defaults and source-proven caller-content slots. Unsupported APIs and ambiguous content remain explicit. **Trace React structure** pairs component ownership with unchanged original renders, then observes admitted finite string/null property combinations in an isolated copy. Shared rules derive root layout, source token identities and supported fixed sizing. Boolean/runtime states, descendant styling and broader CSS remain incomplete.

**Inspect editable Figma roots** connects those observations to the existing native compiler and operation journal. Prepare a supported case, connect the companion in the authorized file, then choose **Create and inspect native draft**. The app records token creation, token readback, component creation and independent node readback. It checks identities, layout, properties, bindings and supported shadow stacks; native exports are displayed as diagnostics. One live Button operation retained its 63 root variants and 121 variables through a server/plugin restart and read-only reinspection. No contract was accepted and visual fidelity remains unverified.

**The next gap is complete, qualified component content.** Reusable mains contain empty editable slots. The app can now fill a separate instance of an observed main with supported caller content for comparison. Checkbox's runtime content and the complete nested Card remain unfinished and stay in the cohort denominator. Existing composition rules preserve supported nested scalar properties in React and expose child controls in Figma; live parent-to-child text and Boolean property aliases still refuse. Root inspection is not a completed code-to-design journey. Reloading unchanged originals after a restart now restores structure observations pinned by an existing operation, without rerunning the property matrix. The composed Card review lists all seven nested instances and the missing native mappings or unsupported inputs. Supported child roots can now be prepared from their saved source observations through the same companion workflow. Live CardContent, CardFooter and CardHeader mains passed independent readback and appear as verified matches in the review (3 of 7 children). New child operations can pin an authenticated source inspection and preserve supported parent-relative sizing; existing operations retain their original evidence. Their empty slots are editable; other inputs, behavior and visual fidelity remain unqualified. Composed generation remains blocked until every required child is resolved.

The shared engine supports editable grid content, declared tracks and managed extra-row sizing, plus parent-relative widths for nested content roots. Reusable mains stay empty. Native comparisons retain main links and token bindings; checked reverse extraction preserves reusable React layout rules instead of sample dimensions. These capabilities have isolated native and browser verification. The application now carries source-proven column stretch into a CardFooter main without freezing its measured width. The Card header now uses a bounded intrinsic-row lowering through the application. Complete nested composition remains unfinished.

The application review distinguishes current CSS grid constraints from rendered pixel tracks. It now lowers a source-proven single implicit column with intrinsic rows for auto-height, horizontal block content in a definite-width parent. Browser checks cover wrapping, added/removed content and different widths; this does not qualify arbitrary min-content grids or native visual fidelity. The remaining Card mappings need block roots and nested input/state qualification. Managed native writes materialize extra rows, while direct canvas child insertion can require companion reconciliation. Full-width comparisons require a definite containing column or grid; unsupported parent contexts refuse.

The shared native writer also preserves explicit literal dimensions on empty frames during creation and update. Live readback confirmed the intended root and child sizes. That trial still failed full structural verification on an unsupported literal fill; dimension preservation alone does not qualify the output.

**Prepare caller-content comparison** now reads the unchanged original behind a saved operation, records the fonts actually used for its text and any SVG viewports, and compiles a comparison draft through the shared engine. It preserves text/icon order and distinguishes SVG stroke color from inherited fill. The app reports preparation and unsupported facts separately from native structure. **Prepare native comparison operation** then connects that content to the same durable journal and companion plugin. **Create and inspect native comparison** creates a separate instance of the existing main and independently checks its content, tokens, main linkage and unchanged parent. One live Button text comparison passed, including read-only reinspection after reconnecting; creation ran once. **Measure original comparison frame** independently measures the unchanged original, then crops archived pixels for an unscaled side-by-side comparison. The full original remains available; measured source and native layout dimensions stay visible. Framing survives reload and rejects changed originals. The live Button measures 115.81 × 36 px in React and 116 × 36 px in Figma; text rendering differs visibly. No visual fidelity result is claimed. Runtime states, reusable nested mappings and the composed cohort remain unfinished. This action does not fill reusable mains or repeat the property matrix. The earlier Button comparison currently refuses fresh reinspection because the opacity compiler correction changed its derived content. Its historical receipt is preserved; an explicit recovery path is still needed before that comparison can qualify the current journey.

**Inspect initial states** now reuses the saved source archive to vary finite caller-supplied inputs on fresh React mounts. The app saves the observed states and original-pixel previews, verifies restoration, and reopens the same result without rerunning the matrix. A live Checkbox action observed the supported initial input combinations, including omission. The app also derives one unaccepted contract draft with the complete observed input domain and conditional content. The Checkbox draft has 12 native variant specifications, with booleans and omission preserved. It also retains directly observed root CSS-variable names across those states and displays them in the app; descendant identities, aliases and themes remain unqualified. Shared anatomy rules retain verified unpainted absolute boxes as editable geometry and annotate pointer behavior separately. The shared writer and independent reader now account for supported shapes and SVG descendants, with duplicate and partial-allocation checks in synthetic execution. The app now pins the saved initial-state evidence into its native operation journal. One live Checkbox operation created 12 editable native variants and passed independent structural readback, including a read-only repeat after reconnecting. Its original and native state images are available together in the app without resizing. This verifies the supported initial-state structure, not visual fidelity, keyboard behavior or interaction preservation. Live comparison exposed a fidelity defect: the disabled checked source has opacity 0.5, while the saved native main reads back as opacity 1. The shared computed-channel map now retains node opacity, and recompiling the unchanged observations produces the correct disabled values. Native execution regressions reject incorrect or missing opacity readback. The app’s **Review compiler update** action now pins a proposal listing the four existing disabled variants and their opacity changes. The app now delivers that pinned correction through the companion: fresh preflight, one guarded update and a separate independent readback. The live correction changed the four existing disabled nodes to opacity 0.5, retained the same 44 owned nodes, and passed a second read-only inspection without another write. Original creation evidence and fresh exports remain visible separately. Controlled companion tests cover conflicts, source changes, restart, lost acknowledgements and interrupted reads; the engine also tests rollback on assignment and postcondition failures. An interrupted write with no saved result remains blocked against automatic replay. This bounded repair does not qualify the complete two-way recovery journey or visual fidelity. Descendant token provenance and absolute-box coordinate equivalence remain open. The action currently requires a previously prepared root operation to locate its source archive; general source onboarding is unfinished.

Evidence remains private. Reloading unchanged originals restores saved native operations from their pinned evidence after a server restart; reinspection reads the same native objects. The saved fully opaque Button comparison also reopened after the opacity compiler correction and passed a fresh read-only inspection without duplicate creation. This narrowly verified compatibility rule does not qualify general compiler migrations. The source-validation panel does not yet restore its earlier validation result. Broader source admission, visual qualification and repair/recovery remain required.

### Build rules that compose

A contract describes the component's parts, layout, tokens, properties, content and references to other components. Readers derive supported facts from React source or native Figma data; generators compile those facts into the other surface. The conversion path requires no AI. Optional AI proposals must pass the same validation as user-authored input.

A finite set of rules can describe many compositions. A table should reuse the rules for rows, cells, selection controls, slots and nested menus. Development must test those rules and their interactions rather than add a bespoke converter for every component name. New examples should expose a missing shared rule or verify an existing one.

This does not make arbitrary React programs convertible. Source patterns and styling systems need explicit support. Nor can a Figma drawing supply sorting logic, data fetching or validation rules. Existing code behavior needs a verified preservation boundary; design-only behavior needs a declared, tested implementation. Unresolved facts remain visible rather than receiving guessed values.

### Lit and Web Components: paused for planned V1.1

The configured Altitude flow and its existing records remain available under the collapsed Lit evaluation archive on `/sources`. They are not the React starting point or a prerequisite for React V1. Its native Button inspection is bounded evidence; Checkbox source observations do not establish native conversion. Neither qualifies a complete Web Components journey.

Preserve the current adapters, fixtures, tests, source captures and operation identities. Archive detailed working logs privately; keep reproducible checks and signed evidence intact. Resume framework-specific integration after the React V1 exits below, beginning with fresh source/dependency checks and a comparison against the then-current shared rules. Existing regression gates still run; pausing expansion does not waive them. V1.1 is a planned scope, not a release date or a support claim.

## Plan and measures of success

| Order | Milestone | Exit evidence | Status |
| --- | --- | --- | --- |
| 1 | Bound and verify React intake | Document supported React syntax and styling; pin source/dependencies; load original styles/fonts/assets; verify states and reject deliberately broken inputs. | Fixed styled cohort verified; general repository intake remains open. |
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
| React source intake, paused Lit workflow and reusable observation infrastructure | `source-reference/`, especially `source-reference/compile.ts` |
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
