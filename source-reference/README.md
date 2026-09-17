# React reference entry point

The local app's `/sources` page now starts with **React originals**. **Load React originals** bundles the original shadcn source sandbox, its prebuilt theme and declared Inter font. It does not invoke the contract emitter or change source files. The fixed cohort is recorded in [React V1 scope](../docs/REACT-V1-SCOPE.md).

Configure `DS_CONTRACTS_REACT_SOURCE_ROOT` on the dev-server process to point to an existing shadcn source sandbox with its installed dependencies. The local owner setup defaults to the original `ds-contracts-poc/examples/shadcn/.shadcn-sandbox` sibling checkout. Requests cannot choose a filesystem path or executable. This preset is not automatic onboarding for an arbitrary React repository.

The reference identity includes the fixture entry, package/lock/config files, exact loaded source/dependency bytes, CSS and font bytes, and emitted runtime assets. The reference runs in a sandbox without same-origin privileges or network access. Inputs are rechecked before serving; changing an input requires a new reference. Immutable private artifacts are stored under `private/react-source-references/<identity>/`. After a server restart, loading the same unchanged source reconstructs the same reference; older archived artifacts are not presented as fresh validation.

**Validate React sources** runs the existing source-readiness and measured-tree reader on all ten originals, archives the loaded resources, then replays them in a fresh browser context without network fallback. Original/replay screenshots and trees must match. Pinned source modules, theme rules and font metadata supply independent style/state/font witnesses. A textless Checkbox requires its uniquely associated visible label, not arbitrary adjacent text.

Button, Checkbox and composed Card representatives must each reject all five negative controls: missing CSS, theme, font, root and hidden root. Corruptions affect disposable pages only. The hidden-root check waits for the source's own visibility transition. The opaque sandbox itself forbids service workers; the runner verifies this restriction without Playwright's incompatible service-worker-block injection. Runtime errors remain failures.

Results are provisional until source-integrity and control-completeness checks finish. Private immutable records under `private/react-source-validations/<reference>/<run>/` include screenshots, HAR, measured trees, source/replay checks, engine/profile identities and evidence hashes. Modified or missing evidence invalidates the served result. A server restart retains the records but requires a new validation; persisted validation recovery is not implemented. Each retry gets a new run identity.

**Inspect React APIs** uses the installed TypeScript program and original JSX, without executing source modules. It records exported component definitions, inherited optional/union types, declaration locations, literal defaults, forwarded spreads, root branches and nested references. Diagnostics, unknown types, mutable aliases and ambiguous return control flow remain incomplete reads. Component modules are selected from the already recorded source bundle; requests cannot choose paths. Source and declaration bytes are rechecked before a hash-addressed private record is written under `private/react-source-programs/<reference>/`. The browser shows the snapshot as API facts, never as an accepted contract. The reader records its TypeScript version. With TypeScript 6 it acknowledges deprecated options using the documented `ignoreDeprecations: "6.0"` setting, retains those diagnostics as visible compatibility notes and leaves the source config unchanged; other diagnostics still refuse the read. This does not qualify the source project's own build. The action also passes installed API facts into the existing pure proposer and shows incomplete drafts alongside the original types. The opt-in source API policy preserves booleans, omission, requiredness and explicit defaults; it does not seed required text. Inherited platform forwarding is reported separately from the native API, with disabled/required/readOnly eligible as typed candidates. Finite mixed and nullable scalar domains retain exact typed values; unrepresentable domains and non-event functions remain named omissions. Drafts remain unaccepted: mounted-node correspondence, supported-domain completion, styling, content and native generation remain integration work. `react-program-proposal.test.ts` checks inherited declarations, exact defaults/omission, unsupported domains, changed/missing source, duplicate identities and compiler failures.

Callback facts include installed parameter types, optional/rest parameters, overloads, generics and whether the return is void. Only a checker-proven zero-argument void callback fits the existing source event proposal. Callbacks with arguments are retained as named omissions instead of silently changing their public API. `react-callback-candidates.ts` matches finite parameter domains against source properties without assuming a relationship from names. For example, `checked` and `defaultChecked` are both type-compatible candidates for `onCheckedChange`; observation must distinguish controlled updates from initial values. Required undefined, arbitrary strings, overloads and generic callbacks remain unsupported. Historical snapshots without signature facts are not reinterpreted or rewritten. The application shows the candidates alongside the incomplete proposal.

`react-callback-inspection.ts` exposes a targeted callback observation through the application, using an existing sealed ownership archive. It reads fresh checker metadata only when the source-file inventory and component identities match that archive. `react-callback-behavior.ts` exercises semantic checkbox controls with each finite candidate input, two label/Space activations, live input updates and callback payload observations. The observer delegates an existing caller callback with its receiver, return and exceptions intact. Each trial verifies restored structure and ownership, then replays the unchanged source page and requires its pixels to match the archive exactly. Same-mount pixel differences are retained separately; this is disposable reference isolation, not business-state rollback. Results and fresh checker facts are saved separately under ignored `private/react-callback-inspections`; original records remain intact. Controlled and initial-only relationships are observations for the tested values, not automatic contract acceptance or proof of arbitrary behavior. Disabled cases must suppress activation and cannot alone establish the enabled-state relationship.

Source readiness is separate from dependency-build reproducibility, Figma fidelity, editability, behavior and workflow completion. **Trace React structure** now feeds supported combined root drafts into **Inspect editable Figma roots** through the shared native operation journal. New observations seal their complete archive in `integrity.json`; preparation pins that seal, report and matrix, and every write reopens the unchanged source/evidence. Existing operations recover after restart when unchanged originals are loaded. The authorized React target is DS Contracts Evaluations; historical Scratch operations retain their original policy. Native root readback checks structure and exposes diagnostic exports; a separate live Button caller-text comparison also passed independent readback. A saved Checkbox initial-state draft also passed live native structural readback. Full content coverage, Checkbox interactions, the composed Card and visual qualification remain unfinished. The earlier Lit workflow below is parked for V1.1 and remains available under the collapsed archive section.

---

# Source validity before conversion fidelity

Outcome-first checkpoint 1. This module is connected to the local Playground's
**Source validation** screen (`/sources`), including measured trees and API/content
intake, not yet to mint. Source validity and semantic inventory are separate
statuses; neither establishes Figma fidelity, reusable output, or owner approval.

The initial cohort is **Altitude Button, Checkbox, Card**, from the actual
local Storybook at source revision `0639eccd15bfedc4fa9713d9545a64cef2c0f0a5`.
Button must include default/secondary/disabled and an icon state; Checkbox
default/checked/indeterminate/disabled; Card default and content composition.
All are retained in the denominator even when refused. This is NOT the older
`altitude-web-components@1.0.2` npm corpus or a claim that local code already
matches the Altitude Figma file. React wrappers share the Web Component engine;
an independent React implementation remains needed later.

The cohort runner retains all ten selected states, including source failures.
Source expectations cite the
library's styling and token files, not conversion output. The actual Storybook
theme is dark; changing the browser colorScheme is not a theme-provider change.

```sh
npm run source:reference:check
node --import tsx source-reference/run.ts \
  'http://127.0.0.1:6017/iframe.html?id=atoms-button--default&viewMode=story' \
  /Users/tjpitre/Sites/altitude private/source-reference-altitude-run1
node --import tsx source-reference/cohort-run.ts http://127.0.0.1:6017 \
  /Users/tjpitre/Sites/altitude private/source-reference-altitude-cohort1
```

Start Altitude's existing Storybook with Node 22, `npm run start -- --port 6017
--host 127.0.0.1 --ci --no-open`, in its `libs/al-web-components` directory.
Do not rebuild, reset or modify the owner's source checkout. The runner refuses
an existing output directory. Screenshots preserve the whole original story,
including its background. No conversion, custom visual masks, or score tuning.

The generic browser test proves missing component CSS, missing theme tokens,
missing font, hidden/empty content, and a failed asset are rejected. Font proof
uses Chromium's actual painted fonts: `document.fonts.ready` or `fonts.check`
alone can report success while fallback is used. The local-story runner also
removes theme/component CSS and blocks fonts in isolated browser pages; it does
not edit source files. A styling failure cannot become a reference success.

The runner now records the actual HTTP resources (including transformed source,
CSS and fonts) in a private HAR, closes the original context, and replays in a
fresh context with network fallback and WebSockets disabled. The replay must
pass the same source witnesses and match the original screenshot bytes. Each
capture must also have stable pixels and witnesses over a bounded quiet window.
This pins the bytes actually consumed, not an independent rebuild of the source
package. HAR files can contain local paths and must stay private unless reviewed
separately for sensitive information. Status-101 WebSocket handshake entries do
not have response bodies; WebSockets are disabled during replay.

The browser tests shut down their original server before replay, then remove a
stylesheet from a copied archive and prove failure. They are wired into the fast
CI lane through source:reference:check, alongside the module's typecheck.

Remaining before this checkpoint is complete: all cohort states, end-to-end
source/dependency lineage for the build (distinct from the recorded runtime
bytes), and integration into the application so no failed reference can reach
conversion. A bounded stable window does not promise absence of future changes.
No completed user journey is claimed.

## Cohort interpretation

The runner preserves the actual Storybook lifecycle, including its play functions;
it does not suppress interactions to get an easier screenshot. The indeterminate
Checkbox play function clicks the input and restores only the mixed CSS state,
so the final native checked value is true. It does not set native indeterminate.
That source behavior is documented, not an accessibility approval. Each row keeps
its exact profile and limitations. Render readiness and interaction correctness
remain separate axes.

Nested probes verify actual input state, icon presence/size, and Card image decode
and dimensions. Composed components use a separate painted-label font witness.
Full-page captures prevent a long Card from being silently cut off at the viewport.
Failed states remain in the denominator; nothing here repairs the owner's library.

## Application connection

Run `npm run playground` and use **Source validation** in the navigation. Enter
the running local Altitude Storybook origin and click **Connect and validate**.
The application invokes the same cohort runner without hand-editing capture
configs or measurement files. It displays all ten states, the original and
network-isolated replay, and independent (currently unmeasured) Figma/behavior/
workflow statuses. The source's own play functions remain part of the reference.

This dev-only API is loopback/same-origin restricted. Requests cannot choose a
checkout, script or output path. It serves only the two PNGs for known session
and story IDs, never HARs, raw logs or arbitrary files. Double submission shares
the active job. Failures can be retried into a new evidence directory. Source
rows remain provisional until final source integrity is known. Evidence stays
under `private/source-reference-app/`. Completed compatible cohorts survive
browser reloads and dev-server restarts. Recovery validates the fixed cohort,
source revision, original/replay identities and matching final/per-story records;
malformed, incomplete and symlinked records are not reopened as complete. The UI
labels recovery as recorded evidence, never a fresh check. Missing original start
times and origins are not invented. Stopping the server interrupts its owned
capture; restart does not silently resume, overwrite or approve that run.

The existing pre-pivot conversion screen is unchanged. This is a real source
connection step, not yet the complete autonomous code-to-Figma product journey.

## Measured compiler input

Valid stories also pass through the existing production computed-style reader,
on the same original page and a fresh archive replay. The reader's new optional
root path targets the exact validated element inside Storybook decorators; its
legacy stage-based entry point is unchanged. It walks shadow roots and assigned
slots, reads all enumerated longhands and pseudo-element planes, and preserves
CSS token candidates and unreadable-stylesheet boundaries. No remount or manual
role-map transcription is involved in this acquisition step.

`source-tree.json` and `replay-tree.json` retain the measured trees. They must
match byte-for-byte and remain paired with the validated source PNGs before the
application reports a verified capture. The application shows its element/text/
pseudo/token-candidate census. Invalid sources cannot furnish compiler input.
These are raw input facts, not Figma output, verified variable bindings, recipe
selection or behavior qualification. The reviewed recipe adapters still impose
manual mappings; removing that product limitation is unfinished work, not a
reason to fabricate review provenance or restamp signed fixtures.

## API and content evidence

React saved native operations expose `POST react/:reference/native-operation/:operation/content`. This accepts no body, resolves the operation's host-owned request, reopens its sealed source tree and performs a targeted unchanged-render check. Painted text fonts and actual SVG viewports are recorded separately; the property matrix is not rerun. `observed-content.ts` reuses the shared computed anatomy/layout/token compiler for comparison snapshots, preserving named refusals and unqualified status. The private `react-content-inspections` records are sealed and reopen after restart. `POST react/:reference/native-operation/:operation/comparison` prepares a separate immutable operation pinned to this evidence and the independently observed parent main. Its existing four-phase journal creates tokens and an instance with caller content, then collects independent readback and a native export. `GET react/:reference/native-operation/:operation/source.png` serves the hash-checked original for comparison. One live Button instance passed structure checks and read-only reinspection; reusable nested anatomy and visual fidelity remain unqualified.

`label-associations.ts` supplements computed appearance with browser-native `HTMLLabelElement.control` relationships. The targeted read records explicit IDs or implicit containment, exact element paths and text, and refuses external, missing or ambiguous targets. It seals the new witness separately, rechecks the unchanged source tree and image, and leaves historical inspections unmodified. The app exposes **Read source label relationships** for saved preparations lacking this witness. Reopening authenticates the archive and verifies coverage against its captured tree. These observations do not yet project reusable IDs, behavior or native property mappings.


The additive `readCemDeclarations()` reader preserves the exact declared public
properties, defaults as unevaluated source expressions, slots and event names.
It does not use the legacy CEM adapter's inferred callback names or defaults.
`semantics.ts` observes actual host values, assigned and fallback slot content,
nested native controls and reference attributes before the visual reader's
flattening can erase them. Each source/replay observation is retained separately.

Original pixels, repeated semantic observations and a continuous DOM mutation
watch bracket the reads. Screenshots retain initial caret styling rather than
temporarily restyling inputs. Wrong types, unreadable controls, getter side
effects, invalid provenance and replay differences refuse intake. This is a
bounded observation window, not a purity sandbox or proof of future behavior.
Closed nested shadow roots and event execution remain outside this inventory.

Random generated IDs remain exact in the evidence; they are not discarded to
make replay pass. Comparing their identity/reference graph requires a separately
specified and tested equivalence rule. Likewise, a declared conditional slot not
rendered in one state remains unresolved, not absent from the component.

These facts are inputs to the existing universal contract authority, not another
contract schema or generator. The next boundary must prove source-to-part joins,
typed bindings, legal omitted variants, editable content and event behavior
through the existing emitters before any generated cohort can be qualified.

## Component admission and missing-state capture

The application derives `contract-plan.ts` results from actual recorded bytes,
not just a stored green status. It checks manifest/declaration identity,
source/replay PNG and tree hashes, stored readiness witnesses and exact semantic
replay. Finite string enums retain omission as distinct from public values.
Coverage is per axis, not the cross-product of every prop, state and theme.
Slot assignments and fallbacks, host props, native state and ARIA remain separate;
equal strings are not proof of a causal content binding. This planner does not
produce an accepted Contract or infer missing behavior.

On **Source validation**, inspect the component work order below the original
cohort results. Click **Capture missing Button states** to observe the original
tertiary, bare and danger stories. This uses the existing capture/replay pipeline
in a new evidence directory, tied to the exact original measurement and source
file hashes. The original ten-state denominator and its refusals never change.
Supplemental results appear separately; a retry requires an explicit action and
preserves the earlier attempt. No Figma or source files are edited.

Restart recovery and live snapshots reject altered images and mismatched
parent/source records. Recorded-byte verification does not assert that the
current Storybook is freshly qualified. A missing/changed recorded manifest
prevents contract planning. Full API bindings, token meaning, reusable target
output and the autonomous apply/verify loop remain unfinished.

React comparisons expose **Measure original comparison frame**, backed by `POST react/:reference/native-operation/:rootOperation/source-frame`. It remeasures only the unchanged original in the isolated React runtime; before/after source tree and screenshot hashes must match the sealed capture. The shared immutable framing store crops original pixels without scaling or native-dependent alignment, and retains the full source image. `GET .../source-frame/:hash.png` reopens authenticated evidence and serves the derived crop. Saved metadata reopens without repeating capture; changed source, hidden output and substituted fonts refuse. Native image summaries expose independently read layout dimensions separately from PNG dimensions. These diagnostics do not qualify visual fidelity.

### React initial-state inspection

`react-initial-state.ts` plans finite caller-supplied inputs (at most 64 combinations) and uses fresh mounts through the version-bounded React adapter. Unlike a live prop update, this observes uncontrolled initial values. It resets disposable runtime state; it does not qualify interactions or business-state rollback. `react-initial-inspection.ts` authenticates the original ownership archive, stores observed trees/fonts/SVG viewports/source bounds and screenshots, and restores completed jobs after restart. The app currently selects that archive through an existing prepared React root operation. Preview crops retain original pixels; altered source or saved evidence refuses. The saved finite domain can now be prepared as a native initial-state operation; interaction behavior remains unqualified.

`react-initial-contract.ts` authenticates the full planned domain and assembles its conditional anatomy through the same computed compiler used by caller-content samples. It preserves typed enum values, variant booleans and explicit canvas omission options without manufacturing public defaults. Source-proven fixed root sizes are required. Shared source-binding rules retain directly observed root CSS-variable identities across the domain, including different variable names with equal colors; an unresolved declared variable relationship refuses compilation. Descendant token identities, aliases/modes, nested source identities, runtime interactions and visual fidelity remain unqualified. The app derives this draft from saved, integrity-checked snapshots without modifying their archive and displays the retained root variable names.

The shared native draft writer now admits bounded rectangle/ellipse geometry and SVG content. It records every allocated node, including imported SVG descendants before metadata writes can fail. Independent readback checks ownership, shape size/position and SVG paint bindings. Synthetic API execution verifies these checks and duplicate prevention; it does not qualify live Figma appearance, vector paths, pointer behavior, rollback or the app's stateful delivery workflow. Omission cannot satisfy an explicit visibility equality condition.

`POST react/:reference/native-initial/:case` pins a complete saved observation and prepares the existing four-phase native journal. The shared compiler writes editable state variants through the companion, and an independent reader checks the supported structure and exports images. Requests cannot supply programs or choose a target file. The reservation is stable across observations for the same source case, so a changed observation cannot silently allocate a replacement. Saved operations reopen against their exact archive, never a moving latest pointer. `GET react/:reference/native-operation/:operation/initial-source/:row.png` authenticates and serves that pinned original crop for the matching native state. One live Checkbox operation created 12 variants, then reopened after a server restart and completed a read-only repeat with the same owned nodes. Visual fidelity, transparent-box coordinate equivalence, interaction preservation, rollback and broader onboarding remain unqualified.

The shared computed channel map includes node opacity, so root projections and finite initial-state contracts preserve it independently of paint alpha. Native observation requires an opacity value when the compiled specification carries one; missing or different values refuse. Generated React inline and module consumers also retain the channel. The existing live Checkbox operation predates this correction and still has the disabled-opacity defect. Recompilation does not silently rewrite its pinned plan or create a replacement; applying the correction to existing nodes remains update-workflow work.

**Review compiler update** prepares a host-derived proposal through `POST react/:reference/native-operation/:operation/update-plan`. It authenticates the saved native journal and rederives the desired initial-state contract from pinned source evidence. The immutable proposal lists existing targets and before/after values. **Prepare reviewed correction** creates a child update journal, **Get update connection code** pairs the same companion transport, and **Apply and verify correction** delivers a fresh read-only preflight, guarded existing-node update and independent readback. **Inspect update again** reads the same nodes without repeating the write. Fresh exports are shown alongside pinned originals; creation evidence remains unchanged. The current bounded update engine admits node-opacity changes only, requires unchanged topology and existing token values, independently rereads before and after a write, supports no-op repeats and partial-state inspection, and restores attempted opacity changes on failure without overwriting unrelated edits. One live four-node opacity correction completed through the application, retained the existing 44 owned nodes, and passed an independent read-only repeat. The journal retains late acknowledgements even after source changes, refuses conflicting replay, and fails closed on missing write history. A received write with no saved result is never automatically replayed; full interruption recovery and the two-way repair journey remain unfinished.


`react-behavior-contract.ts` derives a separate React draft from authenticated callback and initial appearance records for the same case. It rechecks the finite action/state/payload rows and requires an omitted initializer to match exactly one explicit value across every other captured input context. It preserves the canonical appearance axis while binding the code side to separate controlled and initial-only public inputs, and emits the observed next-value callback. It does not rewrite the static/native contract or add a second canvas axis. The application shows this draft and its generated React code. Controlled-source appearance, associated label composition, clean-consumer delivery and native metadata preservation remain unqualified.

**Try generated React beside the original** runs that emitted draft in an isolated consumer beside the unchanged original case. The consumer can pass omitted or explicit values, remount with a new initializer, accept or hold controlled updates, disable supported controls, and display actual callback values. `GET react/:reference/behavior-preview/:case` bundles the authenticated host-derived code; it accepts no caller-supplied source or contract and blocks external network access and same-origin privileges. The preview uses emitted inline styles, with no source stylesheet to conceal missing rules. External fonts, caller label composition, clean-package installation and full visual equivalence remain outside this preview's qualification.

**Generate React composition** in caller-content preparation uses the sealed
ownership, content, label and compatible behavior observations to assemble
source-owned children. `GET react/:reference/native-operation/:id/caller-react`
returns the derived draft; `/preview` bundles its modules and a normal consumer.
Both accept no request body. The consumer supplies unique IDs with React useId,
edits caller text, and exercises two independent copies. `component.initialProps`
preserves mount-only child inputs instead of freezing them as controlled props.
Each inline module resolves its own authenticated token context. A text-free
control's differing font-size/line-height may be displayed as an explicit
preview discrepancy; other subtree differences refuse reuse. This grants no
native write or fidelity qualification. General layout/API coverage, shared
package token assembly, native mappings and clean installation remain open.
