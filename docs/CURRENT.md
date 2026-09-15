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
| Contract playground | The checked-out `core/` engine proposes universal contracts and emits React, HTML and Figma scripts. | Its HTML canvas preview is **not** a live Figma export. Its example tours are not the autonomous product workflow. |
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
