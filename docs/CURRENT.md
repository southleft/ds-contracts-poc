# Code ↔ contracts ↔ canvas

**Active product direction · adopted 2026-09-15 · v1 is not complete.**

Design System Contracts is being built to couple an organization's design and code through a versioned, machine-readable agreement. Code-led teams should get editable design components; design-led teams should get usable coded components; teams with both should detect and repair drift under an explicit ownership policy. No model decides what a component means or which conflicting change wins.

This is the current architecture and outcome-first work order. It supersedes earlier plans for product sequencing and release criteria, not their historical measurements. It is rendered from this same file in the playground and documentation site. It is a plan plus an implementation inventory—not a claim that the entire loop already works.

## The whole loop

![Target architecture: code and Figma observations become a validated contract proposal; policy accepts it; deterministic emitters update code and canvas; independent observations verify both before advancing the shared baseline.](assets/product-loop.svg)

The arrows describe the target integration. Existing readers, emitters and diff functions implement pieces of it. The durable apply-and-reobserve coordinator is unfinished.

1. **Observe real inputs.** Identify the repository revision or Figma file version, component identity, states, themes, fonts, assets and dependency versions. Validate the original styled render before using it as an answer key. An unloaded stylesheet is invalid evidence, even if its screenshot is reproducible.
2. **Propose a contract.** Deterministic, versioned adapters extract supported component APIs, slots, anatomy, token bindings, variants and behavioral declarations. Preserve source identity and provenance. Missing or ambiguous semantics are named blockers, not guessed defaults.
3. **Validate and authorize.** Compare the proposal with the last mutually verified baseline and both fresh observations. A recorded organization policy decides which channels may change autonomously. Conflicting edits, unknown ownership and stale inputs stop affected writes. A policy decision is not an AI judgment or a release grade.
4. **Compile and apply.** One accepted contract feeds code emitters and a canonical canvas representation. The Figma writer lowers that representation to native editable nodes, properties and variables. Transport merely executes a precomputed, scoped operation with revision preconditions.
5. **Reobserve and verify.** Independently render the emitted code with Playwright, export the actual Figma nodes, and read both structures back. Check appearance, semantics, editability and supported behavior separately. Only successful verification advances the baseline. A repeat run must make no changes.

## What works today—and what does not

| Surface | Present implementation | Not yet demonstrated as a complete product outcome |
| --- | --- | --- |
| Source validation | The local app's `/sources` flow captures styled Altitude stories and checks source provenance, font/style readiness and negative controls. | General library onboarding; complete state/theme coverage; automatic qualification of arbitrary libraries. |
| API and content intake | Exact CEM declarations, runtime property values, slot assignments/fallbacks and native control states accompany the original/replay evidence in `/sources`. Source mutations and semantic replay differences cause named refusals. | An accepted semantic contract, prop-to-part bindings, event behavior, and equivalence of generated IDs across independent renders. An observed inventory is not approval to generate. |
| Source candidate preparation | The `/sources` workflow prepares the verified original runtime, then derives a measured visual candidate with recorded source-token references and conditional-wrapper snapshot checks. Versioned attempts preserve previous reports and reopen after validation; failures and interruptions require explicit retry. | An accepted Contract, generated native source components, or verified conversion. Measured values and finite wrapper snapshots do not prove arbitrary dynamic behavior. |
| Contract playground | The checked-out `core/` engine proposes universal contracts and emits React, HTML and Figma scripts. | Its HTML canvas preview is **not** a live Figma export. Its example tours are not the autonomous product workflow. |
| Retained source runtime | The existing React emitter can reference a host-verified original custom element, preserving its implementation and typed interface. | Automatic admission of a source-bound Contract, qualified editable canvas channels, distributable host packaging and native-canvas round-trip verification. |
| Code → canvas | Recipe compilation and the shared Figma writer have live-mint evidence. A new bounded rendered-tree compiler produces explicitly unqualified drafts. | Automatic contract onboarding, semantic properties/token bindings, and verified useful component cohorts through the app without hand-authored role maps or pasted scripts. |
| Canvas → code | REST/plugin observations can propose contracts; deterministic emitters produce code. Designer-file exams record accounting and named refusals. | An installable, reusable library with usable content slots, variants, accessibility and behavior. Accounting-clean output is not proof of these properties. |
| Drift and repair | Typed channel diffs, three-way merge rules, observations, a ledger and a proposal planner exist. | Durable policy-authorized apply → reobserve → verify → baseline advancement, including interruption recovery and conflict-safe retry. The sync spine currently plans; it does not apply. |

### Altitude: current source versus historical fixtures

The local source-validation adapter uses sibling `../altitude`, not the older captured npm corpus. On 2026-09-15, local `feature/v2` and fetched `origin/feature/v2` both resolved to `0639eccd15bfedc4fa9713d9545a64cef2c0f0a5`. This is an observation, not a permanent “latest” guarantee. Each new run must record and recheck the actual source identity, including relevant working-tree changes, build outputs and dependencies. Do not overwrite owner changes to update the source.

Historical Altitude captures remain valid only for their recorded versions. A new source revision invalidates a claim of current-source parity; it does not silently refresh those old receipts.

## Which Figma connection does what?

| Connection | Role in this repository | Product boundary |
| --- | --- | --- |
| Figma REST API | File/node observations, imports and drift inputs. | Not the repository's arbitrary canvas-node renderer. A failed or stale read means unknown state, not “in sync.” |
| Companion Figma plugin | A real execution host for the bundled contract engine and native Plugin API operations; also supports observations. | Keep a thin adapter. Its manual paste workflow is a legacy operator path, not the desired user journey. |
| Figma Console MCP / Desktop Bridge | Engineering automation for running writer scripts in the connected file and obtaining native screenshots/readback. | Live engineering access does not mean the application has this connection. It must execute the same deterministic plan, never synthesize a separate design. |
| Figma native MCP | Figma's official MCP includes a write-to-canvas tool. It is available as another possible execution adapter. | It is not currently the application's integrated conversion engine. Switching MCP servers does not close semantic or orchestration gaps. |
| Repository CLI | Runs capture, proposal, compilation, checks and sync planning. | An invocation surface over engine functions—not a second source of truth. |

Figma's [Plugin API](https://developers.figma.com/docs/plugins/) provides native editor operations. Its [REST file endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/) expose file observations. The official MCP's [write-to-canvas capability](https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/) can also operate on the canvas. These capabilities do not themselves define our conversion semantics.

There are also **two different bridges** in the code/history: the playground's worker-based pairing/dump relay and Console MCP's Desktop Bridge. They are not interchangeable connections, and the old pairing relay must not be presented as a working application write channel without a live test.

For current engineering work, Scratch is the only writable Figma file. Altitude and CBDS are reference-only. Preserve Scratch history and signed lineages. Production permissions must likewise be explicit, per file and operation.

## One contract authority, not competing conversion paths

The universal contract envelope, recipe instances and canonical Figma IR are distinct artifacts today. The rendered-tree draft is a diagnostic bridge, not a substitute contract. Their integration is an open architectural deliverable.

The target is one versioned semantic contract boundary with explicit lowering into target capabilities. Do not force every concern into a pixel tree, or create another independent component generator. Reuse and reconcile the existing engine and recipe writer through tested adapters. A rendering IR is a projection of the accepted contract, not an independent authority.

Contracts must account for identity, token references and modes, editable content/slots, legal states and variants, layout constraints, code API and declared behavior. The exact schema extension must be proved with real fixtures before wiring it into the app. Preserve original source provenance separately from normalized meaning.

Round-trip equivalence means preservation of the **declared supported semantics**, not byte-for-byte recreation of arbitrary JSX or reconstruction of business logic from a picture. Unknown interactions or missing component semantics must be supplied by explicit source metadata or a versioned, tested adapter—or refused. Lowering a token binding into an unexplained literal is not successful semantic preservation, even when pixels match.

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

Drift is a difference between a fresh code observation, a fresh canvas observation and the last mutually verified contract baseline. It is not just a screenshot difference, a node timestamp or an installed fingerprint stamp.

- **Neither side changed:** verify freshness and report no-op; do not rewrite either surface.
- **One side changed:** propose its supported changes; apply only if the recorded policy grants authority for those channels.
- **Both changed independently:** deterministically compose only compatible changes. Same-channel collisions need an explicit existing policy or a named unresolved conflict, never a model-selected winner.
- **Input changed during the run:** reject stale preconditions, reobserve and replan. Do not overwrite a newer edit.
- **Apply failed or was interrupted:** retain an operation journal and original target identity. Resume idempotently or roll back only owned changes under checked preconditions. Do not advance the baseline on partial success.
- **Source, font, asset or bridge unavailable:** report the missing prerequisite. Do not compare against a fallback render or classify unavailable evidence as clean.

The existing merge and ledger functions are foundations for this behavior. They do not yet prove the full repair loop.

## Outcome-first work order

The next integration milestone is a **shared contract-boundary conformance slice**, not another isolated component mint. It belongs inside the code-led journey below: take a validated original through a contract, existing emitters, actual Figma readback and independent comparison; inject a broken source and a semantic mismatch to prove rejection. Keep the orchestration interface reusable by the other journeys.

The existing React emitters now have mounted-browser conformance checks for omitted scalar values, native boolean attributes and optional boolean styling (`npm run react:conformance:check`). An omitted enum is distinct from a declared option literally named `"undefined"`; absent values must not invent defaults or select that option. The Figma emitter and reader have a separate bounded conformance suite (`npm run figma:unset:check`): an explicit `bindings.figma.unsetValue` draws the omitted base without adding a public code option or default. Readback must corroborate its metadata against actual properties and rows; unsafe API aliases and unsupported projections refuse. Removing that plane in place also refuses, preserving retained canvas history.

These are engine checks, not proof of Altitude conversion or Figma fidelity. Mock execution is not native Figma evidence. Source slot/event semantics, automatic contract intake and the application journey remain unfinished. HTML/Web Component targets are not qualified by the React-only checks.

The local **Source validation** screen now derives a component-admission work order from recorded originals, replay images, trees and exact declarations. It names missing enum states (including omission), unproven content/attribute bindings and unsupported behavior. Matching visible text and an accessible-label prop does not prove they are the same API channel. No contract is accepted by this planner.

**Trace the actual source** adds hash-checked local source and Lit-template syntax to that work order. It shows authored root branches, slots, attribute/property/event channels, and class members in the local import graph. It does not execute source code or claim that imported directive names authenticate their runtime implementations. Changed source files refuse the new inventory without deleting historical measurements. Local stylesheet dependencies, inherited behavior, source-to-render identity and target preservation remain explicit boundaries.

**Trace rendered bindings** is now a separate action in that same screen. It joins exact source syntax to fresh, network-isolated replays of the recorded Button DOM, slots and captured geometry. The four baseline states and any three-state supplement remain in the denominator, including invalid originals. Three finite experiments on the default Button change its accessible label, visible slot text, and ARIA-disabled property independently. The app shows actual before/after browser images and separately reports structural matches and observed dependencies. Saved counts are re-derived from source, topology, semantic records and image bytes; interrupted or altered evidence cannot become a completed pass. These are source-binding checks, not Figma fidelity, full behavior qualification or permission to accept a contract. Opaque helper behavior remains unproven.

This distinction matters for the actual Altitude Button: its accessible label and visible slot are separate channels; its `isDisabled` sets ARIA state, not native disabling; its link and button branches attach different attributes and listeners. The current schema cannot carry all of its conditional rendering, lifecycle and form-controller behavior. A faithful code-led implementation must preserve a verified runtime dependency or add tested declarative carriers shared by the existing emitters. It cannot substitute a similar-looking button and call it equivalent. Design-only input likewise cannot reveal undeclared event or form behavior. The Figma compiler now explicitly refuses nonboolean truthy visibility conditions instead of silently drawing those parts unconditionally; the existing boolean and enum-equality projections remain supported.

The first retained-runtime lowering now extends the **existing React emitter**,
not a second component generator. A Contract may carry three immutable runtime,
interface and projection identities. A trusted local preparer builds the pinned
Altitude source with its recorded dependencies; canvas data supplies no executable
paths. The React adapter keeps original typed properties, lifecycle, shadow DOM,
slots and refs. Targeted tests cover original-property timing and value removal,
and require actual token values as well as Contract hashes. Native reconstruction
targets refuse this reference until qualified; arbitrary design changes cannot
silently leave code unchanged. Source stories, host packaging, editable canvas
lowering and the application-to-Figma journey are still unfinished. This is a
bounded engine step, not a converted cohort or a release-readiness claim.

A version-2 **projection binding** now qualifies one bounded editable channel:
the root's `padding-block` and `padding-inline` pair can reach the original
runtime's authenticated CSS custom property through the existing React emitter.
The host pins the source-input cases, observed numeric pairs, mode and brand;
all other Contract fields and the entire token tree remain checked. Missing
pairs, unmeasured values, conflicting caller overrides and unrelated edits
refuse. Reset is an explicit pair, not deletion. Literal values and selection
of existing dimension tokens share this lowering. This does not qualify
arbitrary source props, caller styles, slot content, or native Figma output;
the application still has no accepted source-bound Contract. The current
Altitude evidence is dark-themed, not a light-mode default.

The Figma compiler now accepts an explicit host-selected mode and brand for
compile-time token values, including numeric typography. This does not yet
select or verify native variable modes. Source-candidate derivation keeps the
actual defaultless variant, original typed API and source-identified slots;
accessible labels do not become visible sample text. Its evidence selector
rechecks the latest attempt and refuses stale or failed evidence instead of
falling back to an older success. These are inputs to candidate assembly, not
an accepted or emitted source component.

**Prepare source candidate** now runs inside `/sources`, using that verified
binding trace and its exact baseline and supplement. A fixed local worker
prepares the pinned original runtime privately and derives the source semantic
inventory. Reopening an attempt revalidates its source, dependencies, artifact,
report and derived counts; it does not rebuild or recapture evidence. Failed,
interrupted or changed evidence cannot silently reuse an older success. An
explicit retry creates a new attempt and preserves the previous history.
Public job snapshots omit private source and module paths, and preparation
changes neither the source library nor Figma. The result is **source/runtime
prepared**, not a visual Contract, native canvas output or conversion acceptance.
Matched source spans remain structural evidence, not proof of every dynamic
binding or behavior.

An internal assembly stage now derives a **measured visual candidate** from
those original observations. Exact source identities preserve wrappers and
terminal slots; assigned content stays in separate comparison-sample records.
The existing layout and token fusion carries observed styling without guessing
public props or sample defaults. Every appearance must be observed before a
styled candidate is returned. The next version projects exact recorded source
token names into specific root token references, preserving different names even
when their current values match. Other references remain provisional. In
`/sources`, choose **Derive measured
visual candidate** after preparing the source. This separate attempt reuses the
saved runtime and original observations without rebuilding or recapturing them.
The application shows the case coverage, excluded style channels and exact
recorded source-token correspondences alongside named limitations. A bounded
source AST reducer derives conditional-wrapper predicates without executing the
source. It checks light-DOM descendants separately from slot assignment, joins
the selected branch, and compares each predicate result with observed wrapper
presence. Those finite snapshots retain original-dispatch and stable-query
assumptions; they do not qualify arbitrary composition or lifecycle behavior.
It retains the preparation and older visual reports unchanged and validates
the complete derived report on reopen. A repeated successful derivation reuses
the same supported-version attempt; an explicit version upgrade creates a new one.
A failed or changed latest preparation cannot fall back to an older success;
retry creates a separate attempt. Both native and React emission remain blocked
by the candidate's unqualified runtime binding.

A native Scratch probe also confirmed that empty Figma slots do not reproduce
Altitude's absent conditional wrappers: even zero-sized slots retain layout
gaps. That behavior must be represented and verified explicitly. Empty main
slots and populated comparison instances are different evidence; inserting
sample text into a main component would hide this gap, not solve it. A separate
two-variant native fixture confirmed that hiding the whole wrapper removes its
spacing and that slot content survives visibility changes and a variant switch.
The full slot property identity survived; child node IDs changed. This is a
native capability check with empty main slots, not a source-component fidelity
result. The source-qualified lowering and automatic reevaluation remain unfinished.

`npm run runtime:check` checks the strict reference schema, verified artifact
inputs, React lowering and refusal boundaries. Canvas markers remain untrusted
identity claims: preservation requires a matching canonical base and trusted
journal, and does not prove that the canvas matches either. The source app now
produces a verified runtime and derived inventory alongside its admission work
order, not an accepted Contract. Its visual derivation now exposes the source-bound
candidate; the next boundary is pinning native variable identities and modes,
lowering the qualified source structure and comparison samples through the
existing writer, then verifying the actual native canvas through the app.
Editable-channel qualification remains separate from
retaining the original runtime; neither a matching hash nor an available MCP
connection completes that application journey.

After the original Altitude cohort finishes, **Capture missing Button states** observes its original tertiary, bare and danger stories in a separate source-bound run. The baseline and its failures are preserved, not remeasured or replaced. Completed evidence can be reopened after restart; changed parent records, image bytes or source-file hashes invalidate supplemental use. A failed supplemental attempt can be explicitly retried into a new directory. This is targeted evidence acquisition, not a Figma mint or completion of the code-led journey. `npm run source:reference:check` covers the admission and supplemental-service boundaries with real recorded inputs and negative controls.

| Order | User-visible outcome | Required evidence before moving on |
| --- | --- | --- |
| 1 · Valid originals | A user selects a real library and sees exactly which styled source/state/theme is being used. | Pinned source and dependencies; loaded fonts/assets/styles; stable original renders; deliberately broken CSS/font/source cases rejected. |
| 2 · Code-led journey | From that source, the app creates useful editable Figma components without manual role maps, scripts or receipt assembly. | A simple, a stateful and a composed component; original and native Figma screenshots plus structural/token/property checks; repeat generation is a no-op. |
| 3 · Design-led journey | A user with only a design library gets installable, reusable React components. | Read-only original observations; editable content/variants/tokens; independent browser renders, accessibility and declared behavior checks; no initial code repository required. |
| 4 · Brownfield repair | A team with both libraries sees drift and authorized repairs execute in both directions. | Real mutations on each side; compatible and conflicting edits; policy enforcement; fresh post-apply checks; retry/interruption/rollback; second run is a no-op. |
| 5 · Release qualification | Another supported cohort completes the same journeys without component-specific operator intervention. | All claims re-derived on one candidate commit, documented unsupported cases, reproducible evidence and owner-only grade/signature left to the owner. |

Automation should eliminate routine translation labor, not erase missing requirements. Onboarding establishes scope, identity and authority once; subsequent supported changes follow that policy without repeated human adjudication. An unresolved conflict is a safe product result, not permission to guess.

### Evidence that counts

Show the original render, actual target render, exact node/component identity, structured comparison and named limits together. Do not use an HTML imitation of Figma as canvas evidence. Do not tune alignment, thresholds or source styling to make a failing candidate pass. A pixel score and a deterministic fixed point are useful checks, but neither independently proves product usefulness.

The previously measured calendar is historical evidence of conversion against its captured reference, **not qualification of the reference as a styled design-system component**. Preserve its receipts; do not spend another cycle improving that answer key as the next product milestone. Owner grades and signatures remain untouched.

## Start here when resuming development

1. Read this page, [repository instructions](../AGENTS.md) and [contribution gates](../CONTRIBUTING.md). Verify the working directory, live git/PR state and source revisions before acting.
2. Treat numbered architecture docs, handoffs and receipt narratives as scoped historical evidence unless this page explicitly delegates authority to them. Preserve them; do not bulk-delete history to simplify onboarding.
3. Keep this page current when the architecture or accepted work order changes. Both application and site consume it directly; the README links here. Update claims and tests with each completed outcome, not merely with the number of passing internal checks.
4. Report which user outcome actually improved, what was tested, what remains incomplete and the next bounded experiment. Stop repeating an experiment after two attempts without new evidence and diagnose the boundary instead.

This page changes neither signed evidence nor release authorization. No v1 tag, publication, deployment, owner grade or signoff is implied by this plan.

### Checking these pages

`npm run test:playground` includes the canonical-document integration tests;
`npm run docs:check` validates the repository's gated numeric claims and links.
Build the site with `npm run site:build`. With the local playground on port 5181
and the built site served on port 5182, `npm run test:product-overview:browser`
checks desktop/mobile rendering, navigation and exact schematic bytes. These
checks validate the documentation surfaces, not the conversion journeys above.
