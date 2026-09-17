# Start with your library

Design System Contracts is being built for three starting points. Choose yours; the contract is the shared agreement between the code and design you already use.

**V1 focuses on React ↔ contracts ↔ Figma.** Lit and Web Components integration is paused for a planned V1.1 follow-up; existing work is preserved.

**Today:** you can inspect inputs, propose supported contracts and explore generated code in the engine. **Still in development:** a complete verified conversion delivered through the app, an installable design-only library, and automatic repair of an existing pair. The steps marked **planned** below describe the intended experience, not buttons that already work.

- [I have a Figma library](#designer-first)
- [I have a React library](#code-first)
- [I already have both](#both-libraries)
- [Install and try it today](#install)
- [What happens next in development?](#next-delivery)

<a id="designer-first"></a>
## Designer-first: approved Figma to reusable code

**The intended primary action: Generate for development.** A designer selects a component set or pastes its Figma link. The app should produce a reviewable component API and runnable code, with the contract saved alongside it.

An approved, linted set is a good input. Approval establishes design intent; the conversion still needs to check variants, variables, fonts, nested dependencies, content semantics and the selected code target. A label drawn on a canvas does not establish whether it is fixed copy, a text prop or caller-provided content.

| Step | What the user does | What the application should do |
| --- | --- | --- |
| 1 · Select | Paste a component-set link, or select the set in the companion plugin. | Read the actual set and revision. Show a preview, scope and any access problems. |
| 2 · Check readiness | Confirm the set and its dependencies. | Inventory variants, properties, token modes, content slots, instance swaps and nested components. Name unsupported or ambiguous facts. |
| 3 · Choose the destination | Select React, the package/component name and a new library or existing repository. | Apply the team's configured naming, styling and output conventions. No initial code library should be required for the new-library path. |
| 4 · Review the API | Resolve the specific questions that cannot be read from design: editable content, required slots, events and supported behavior. | Present plain-language properties and examples, backed by a contract diff. Advanced users can inspect the JSON. |
| 5 · Generate and verify | Choose **Generate for development**. | Compile the supported contract deterministically. Render the code and compare it with the actual source design; check structure, content APIs, tokens, accessibility and declared behavior separately. |
| 6 · Deliver | Download the library or review a repository change. | Include contracts, components, styles/tokens, exports, usage examples and the verification report. Verify installation in a clean consumer. |
| 7 · Update later | Re-run after an approved design change. | Compare against the stored baseline, show affected code and apply only authorized changes. Preserve hand-authored code outside the managed boundary. |

**Try today:** [open Figma import](https://ds-contracts-playground.pages.dev/playground?source=figma). Enter a component URL and your access token, then choose **Import**. The engine produces a proposal and named limitations. Inspect the contract, **Receipts** and **React** output; each emitted file has a copy action. Review unresolved dependencies and conflicts with the active token inventory before using the output. Without credentials, **Demo import (Badge fixture)** exercises the import with recorded data. That fixture is a way to learn the interface, not the product's scope or proof of a live import.

**Where this currently stops:** copying generated files is not a verified, installable library delivery. The full readiness/API review, target packaging, native comparison, repository update and repeat-update journey above remain to be integrated and qualified. Existing manual CLI/plugin workflows are available as [technical reference](https://ds-contracts-spec.pages.dev/operator-guide/).

### Example: a data table

The intended output should preserve a table's component relationships: header and body, rows, cells, selection controls, sort indicators, empty state and content slots. A row action may be a nested component; an icon choice may be an instance swap; cell content may be a slot. These are different APIs and should remain distinct.

Sorting, pagination, keyboard navigation and data fetching are not established by drawing their controls. The user must select declared, tested behavior or supply an explicit implementation. Unsupported behavior stays named and unresolved. The first table delivery must demonstrate reusable content and composition, not only a screenshot of fixed rows.

<a id="code-first"></a>
## Code-first: React components to editable Figma

**The intended primary action: Create design components.** The developer connects a local React repository or pinned React package, chooses components and an authorized Figma destination, then verifies the resulting native library.

| Step | What the user does | What the application should do |
| --- | --- | --- |
| 1 · Connect | Select the React repository/package and component entry points. | Record the revision, dependencies, framework, tokens and component manifest where available. Run source code in the configured local capture environment. |
| 2 · Choose coverage | Select components, states and themes, including nested dependencies. | Show original styled renders. Missing fonts, styles or required states block qualification. |
| 3 · Review the contract | Confirm extracted properties, tokens, slots, composition and code-only behavior. | Derive supported facts from the original. Keep behavior through a verified runtime or tested adapter; do not substitute a lookalike implementation. |
| 4 · Choose Figma | Select the destination file and operation scope. | Check access and plan exactly what will be created or changed. |
| 5 · Generate and verify | Choose **Create design components**. | Create native components, variants, variables and editable properties. Fill separate instances for comparison while keeping reusable main content empty where appropriate. |
| 6 · Use and maintain | Place instances, edit supported properties and run again after a source change. | Independently read back native structure and exported images. Verify that supported changes survive and an unchanged repeat makes no writes. |

**Inspect original React sources locally:** open `/sources`, choose **Load React originals**, then **Validate React sources** for the configured ten-case Button, Checkbox and composed Card cohort. **Inspect React APIs** reads its installed declarations and shows incomplete contract proposals. Source checks do not qualify Figma generation or behavior; unsupported APIs remain visible. This preset is not a general repository picker.

**Inspect a native root draft locally:** after **Trace React structure** completes, choose a supported Button or Card case and **Prepare … for Figma**. Open the companion plugin in the authorized file shown by the app, obtain the connection code, and use **Build → Connect the local source workflow → Connect / resume**. Then choose **Create and inspect native draft** in the app. This creates root variants and bound variables with empty editable content slots. Review the structural result and diagnostic exports. **Inspect native draft again** reads the same objects; it does not create replacements. After a server restart, reload unchanged originals to recover the saved operation. Checkbox and full composed-content conversion remain unfinished.

On a saved operation, **Prepare caller-content comparison** reads its original text, painted fonts and SVG viewports. The source must still match its recorded rendering. The app shows whether that content compiles and names unsupported facts. After successful preparation and root inspection, choose **Prepare native comparison operation**. Connect the companion to this separate operation and choose **Create and inspect native comparison**. It fills an instance of the saved main, independently reads it back, and displays original/native diagnostic images. Preparation and operations survive restart; reinspection retains the same native objects. The preselected Default, Secondary and Icon-with-text Button comparisons have passed independent structure readback and the existing image-difference limit; this is bounded case evidence. Choose **Measure original comparison frame** to compare cropped original pixels with the native export at their original scale and see both layout dimensions. The measurement rechecks the unchanged original and survives reload; the full source image remains available. Complete cohort fidelity, state behavior and content usability remain unfinished. The reusable main stays empty.

**Try today:** [open code import](https://ds-contracts-playground.pages.dev/playground?source=code) for a static TSX/CSS experiment. Use the local app's same code-import view when working from this checkout. Review the proposed contract and named limitations before inspecting generated output. The current reader recognizes bounded syntax and styling patterns; a successful API proposal alone does not prove rendered styling, behavior or native Figma fidelity.

**Where this currently stops:** connecting an arbitrary React repository, carrying its full component family through native generation, and qualifying the output are unfinished. The steps above describe the intended delivery. There is no claim that every React pattern, styling system or dependency is supported.

**Existing Lit experiments:** [open local source validation](http://localhost:5181/sources) and expand **Lit evaluation archive — parked for V1.1** to inspect the configured Altitude library and its saved work. That archive is the paused Web Components path. Its bounded native Button inspection demonstrated app/plugin transport and structural readback; visual fidelity and editability remain unqualified. Preserve recorded runs and operation identities when reopening work. Further Lit integration is planned after React V1.

<a id="both-libraries"></a>
When another selected case has the same observed family, the app offers **Compare … using existing main**. This prepares that case’s own content and source framing, then saves a separate comparison linked to the verified main. Connect its companion operation and choose **Create and inspect native comparison**. The host checks source identity, non-variant inputs and the entire root matrix before allowing reuse. Different behavior or styling is not inferred from similar appearance. Repeating preparation reopens the existing case operation.

## Both libraries: connect, compare and repair

**The intended primary action: Compare libraries.** Existing Figma and React libraries should be matched and reconciled before either is regenerated.

1. **Connect both sources.** Record the code revision, Figma file and relevant component scope.
2. **Match identities.** Propose correspondences between code exports and Figma components. Ask for a mapping only where identity is ambiguous; matching names alone is insufficient.
3. **Compare the current facts.** Show property, token, layout and composition differences. Separate missing evidence from actual disagreement.
4. **Establish the agreement.** Review the initial contract and decide which side owns which supported channels. For example, design may own a spacing token while code owns event behavior.
5. **Plan a repair.** Show the affected files and native nodes, conflicts and authority checks before writing. Only managed, supported changes may proceed automatically.
6. **Apply, reobserve and verify.** Preserve operation state, check the actual result on both sides, then advance the baseline. On failure, retain the known state and recover or roll back under checked preconditions.
7. **Repeat.** No changes means no writes. Concurrent incompatible changes produce a named conflict rather than a guessed winner.

**Try today:** the repository has diff and planning foundations. The [current status](https://ds-contracts-spec.pages.dev/system/) describes their boundaries. There is no complete **Compare libraries → repair both sides** application action yet. Starting from two existing libraries must not silently become “overwrite one with the other.”

<a id="install"></a>
## Install and try it today

### Explore without installing

Use the [hosted engine explorer](https://ds-contracts-playground.pages.dev/playground) for contract mechanics, fixture imports and generated output. It may be a different revision from this checkout. Source capture needs a local service; the hosted explorer cannot access your local repository.

### Run the current source locally

Requires Node.js 20 or later and npm:

```bash
git clone https://github.com/southleft/ds-contracts-poc.git
cd ds-contracts-poc
npm install
npm run prep:schema
npm run playground
```

Open [the local start guide](http://localhost:5181/start). The main branch contains merged work; an open PR is a separate revision. Start a React experiment from code import. The React `/sources` preset and archived Lit flow each require their configured source library; the React path does not depend on the Lit setup. Worker development has its own dependency install, documented in [CONTRIBUTING.md](../CONTRIBUTING.md).

For native Figma operations from this checkout, build the companion development plugin with `npm run plugin:zip` and import `figma-sync/plugin-dist/manifest.json` through **Plugins → Development → Import plugin from manifest** in Figma desktop. The local app must use port 5181 and the plugin must be open in the authorized target shown by the app. The React root-inspection flow uses **Prepare … for Figma**, **Get connection code**, then **Create and inspect native draft**. In the plugin use **Build → Connect the local source workflow → Connect / resume**. If an older development registration has the same plugin ID, remove that obsolete registration and import the current manifest; this does not delete source files or canvas content. This development flow is not a completed React component-family import. Keep it private; it grants delivery and result access for that operation.

**Recommended v1 onboarding, still planned:** one setup flow that connects the workspace, selects the code target, pairs the plugin when needed, and checks permissions/dependencies before the first import. A designer should not need to understand operation journals or assemble JSON by hand.

## How conversion works without AI

**React or Figma → shared contract → the other surface.** The contract records structure, layout, tokens, properties, content and nested component relationships. Readers extract supported facts; deterministic generators produce the target; independent checks compare the result with the original.

The rules must compose. A table can reuse rows, cells, selection controls and menus without a special converter for that particular table. V1 must demonstrate simple, stateful and substantial composed components, then repeat on independently chosen supported examples. Testing every possible arrangement is neither possible nor the plan.

A drawing cannot supply business logic, and arbitrary JavaScript cannot be reconstructed from a render. Existing code behavior needs a verified preservation boundary. Design-only behavior requires an explicit supported implementation. Missing information is reported for resolution; the converter does not guess it.

## Where AI fits

**AI is optional; it is not required for conversion.** AI can help a user find a source, explain refusals, propose mappings and draft missing declarations. It should invoke the same import, validation and generation operations as the interface. A prompt or Figma link does not authorize guessing component semantics or overwriting code.

The deterministic boundary starts with verified inputs and explicit decisions: the same accepted contract, dependencies and emitter version should generate the same output. AI suggestions remain reviewable inputs; AI is not the compiler or the final judge of equivalence. A single integrated AI-driven workflow is still planned.

## Is the playground still useful?

Yes: `/playground` runs the checked-out engine; `/sources` verifies a configured React cohort and preserves the paused Lit source-inspection archive; `/flow` demonstrates scoped engine steps using recorded inputs. These are useful development surfaces. They do not collectively prove the complete product journey.

The direction is to make this application the front door to connected library workflows. Engine tutorials remain available, while onboarding starts with the user's library and desired result. The documentation site explains setup and expectations; the application executes and reports the operation.

<a id="next-delivery"></a>
## Next delivery: one complete React-led journey

Development should produce a demonstrable user flow. Tests are acceptance checks for that delivery.

**Current checkpoint:** the app verifies ten configured original React cases and creates supported editable native drafts through the companion. Default, Secondary and Icon-with-text Button comparisons and both preselected composed Card arrangements have passed bounded native structure and image checks. Secondary and Icon-with-text reuse the existing Button family. Checkbox control-only initial-state exports also pass the image limit. These results do not establish complete content editability, label relationships, state behavior, general onboarding or the reverse clean-consumer journey. No complete React journey has met the V1 criteria.

| Checkpoint | User-visible result | Done when |
| --- | --- | --- |
| 1 · Import the React family | The app keeps supported components, their dependencies, properties and tokens together. | Supported syntax/styling boundaries are published; original styled states are verified; missing facts are named. |
| 2 · Generate editable Figma | The user creates native components from that imported family through the app. | Shared rules preserve layout, tokens, properties, slots and nested identities; independent visual and editability checks pass. |
| 3 · Exercise composition and repeat | The same workflow handles simple, stateful and composed components. | No component-specific conversion scripts; unchanged repeat makes no writes; interruption and unsupported cases stay visible. |

After that: complete design-only React library delivery in a clean consumer, connect safe two-way repair for an existing React/Figma pair, then run an independently selected supported cohort. Advanced composition remains a V1 requirement. Lit/Web Components integration resumes for planned V1.1 after these exits, reusing the shared rules.

**Timing:** there is no evidence-backed V1 date yet. Forecast from completed journeys and observed remaining blockers, not eval counts. The next deliverable is an imported React component family reaching verified, editable native Figma output. See the [status and milestone exits](https://ds-contracts-spec.pages.dev/system/).
