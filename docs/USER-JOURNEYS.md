# Start with your library

Design System Contracts is being built for three starting points. Choose yours; the contract is the shared agreement between the code and design you already use.

**Today:** you can inspect inputs, propose supported contracts and explore generated code in the engine. **Still in development:** a complete verified conversion delivered through the app, an installable design-only library, and automatic repair of an existing pair. The steps marked **planned** below describe the intended experience, not buttons that already work.

- [I have a Figma library](#designer-first)
- [I have a code library](#code-first)
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
## Code-first: original components to editable Figma

**The intended primary action: Create design components.** The developer connects a local repository or pinned package, chooses components and an authorized Figma destination, then verifies the resulting native library.

| Step | What the user does | What the application should do |
| --- | --- | --- |
| 1 · Connect | Select the repository/package and component entry points. | Record the revision, dependencies, framework, tokens and component manifest where available. Run source code in the configured local capture environment. |
| 2 · Choose coverage | Select components, states and themes, including nested dependencies. | Show original styled renders. Missing fonts, styles or required states block qualification. |
| 3 · Review the contract | Confirm extracted properties, tokens, slots, composition and code-only behavior. | Derive supported facts from the original. Keep behavior through a verified runtime or tested adapter; do not substitute a lookalike implementation. |
| 4 · Choose Figma | Select the destination file and operation scope. | Check access and plan exactly what will be created or changed. |
| 5 · Generate and verify | Choose **Create design components**. | Create native components, variants, variables and editable properties. Fill separate instances for comparison while keeping reusable main content empty where appropriate. |
| 6 · Use and maintain | Place instances, edit supported properties and run again after a source change. | Independently read back native structure and exported images. Verify that supported changes survive and an unchanged repeat makes no writes. |

**Try today:** [open local source validation](http://localhost:5181/sources) after starting the app. This currently uses a configured local source library. It lets you inspect original evidence and prepare a source-bound candidate; it is not yet a general repository picker. For static TSX/CSS experiments, [open code import](https://ds-contracts-playground.pages.dev/playground?source=code). Static source intake alone does not prove original rendered styling or behavior.

**Development connection:** after deriving a measured candidate, choose **Prepare connection** in Sources. Run the current companion development plugin in the authorized Scratch file, open **Build → Connect the local source workflow**, paste the connection and choose **Connect / resume**. Return to Sources and choose **Create and inspect**. Keep the app and plugin open: the journal drives token creation/readback followed by component creation/readback. The plugin saves results so an interrupted acknowledgment can be resent without another allocation.

If a readback is interrupted or refuses the observed state, choose **Retry readback** after addressing the reported issue. The journal retires the old observation and creates a new read-only attempt; this never repeats component or token creation. **Prepare connection** remains available if the plugin needs to reconnect.

**Where this currently stops:** this connected path has API-mock and browser coverage; its actual Figma output is not yet qualified. The source candidate remains unaccepted. Native visual comparison, editability and a complete no-change repeat remain the next work. A lost creation response without a saved receipt is reported as unknown, never automatically repeated; complete interruption recovery is still unfinished.

<a id="both-libraries"></a>
## Both libraries: connect, compare and repair

**The intended primary action: Compare libraries.** Existing design and code should be matched and reconciled before either is regenerated.

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

Open [the local start guide](http://localhost:5181/start). The main branch contains merged work; an open PR is a separate revision. Additional source-library setup is required for `/sources`. Worker development has its own dependency install, documented in [CONTRIBUTING.md](../CONTRIBUTING.md).

For native Figma operations from this checkout, build the companion development plugin with `npm run plugin:zip` and import `figma-sync/plugin-dist/manifest.json` through **Plugins → Development → Import plugin from manifest** in Figma desktop. The source connection requires the local app on port 5181 and the authorized Scratch file. Pair it using the development steps above. Keep the connection private; it grants delivery and result access for that operation.

**Recommended v1 onboarding, still planned:** one setup flow that connects the workspace, selects the code target, pairs the plugin when needed, and checks permissions/dependencies before the first import. A designer should not need to understand operation journals or assemble JSON by hand.

## Where AI fits

AI can help a user find a source, explain refusals, propose mappings and draft missing declarations. It should invoke the same import, validation and generation operations as the interface. A prompt or Figma link does not authorize guessing component semantics or overwriting code.

The deterministic boundary starts with verified inputs and explicit decisions: the same accepted contract, dependencies and emitter version should generate the same output. AI suggestions remain reviewable inputs; AI is not the compiler or the final judge of equivalence. A single integrated AI-driven workflow is still planned.

## Is the playground still useful?

Yes: `/playground` runs the checked-out engine; `/sources` handles local source inspection and candidate preparation; `/flow` demonstrates scoped engine steps using recorded inputs. These are useful development surfaces. They do not collectively prove the complete product journey.

The direction is to make this application the front door to connected library workflows. Engine tutorials remain available, while onboarding starts with the user's library and desired result. The documentation site explains setup and expectations; the application executes and reports the operation.

<a id="next-delivery"></a>
## Next delivery: one complete code-led journey

Development should produce a demonstrable user flow. Tests are acceptance checks for that delivery.

**Current checkpoint:** observation and local app/plugin delivery are implemented and exercised in the API mock and browser. The next run must establish actual native behavior; the full exits below remain open until their Figma evidence exists.

| Checkpoint | User-visible result | Done when |
| --- | --- | --- |
| 1 · Connect native observation | The app can distinguish a creation acknowledgement from verified native structure. | Saved identities feed independent readback; a changed node or token is detected; retrying observation never repeats allocation. |
| 2 · Connect the app and plugin | The user starts generation from the app and sees a recoverable result. | Authenticated, revision-bound dispatch/result handling works without pasted scripts; interrupted responses preserve operation state. |
| 3 · Verify the original against Figma | The user sees actual source and native output with a clear comparison. | Appearance, properties, tokens, slots and supported edits pass independently; unchanged repeat makes no writes. |
| 4 · Expand the same journey | The same workflow handles simple, stateful and composed components. | No component-specific operator scripts; failed and unsupported cases remain visible in coverage. |

After that: complete design-only library delivery, connect safe two-way repair, then run an independently selected cohort. Those are the existing v1 criteria, not new goalposts.

**Timing:** there is no evidence-backed v1 date yet. The next useful forecasting point is checkpoint 3: a complete native round trip will reveal the remaining work in transport, source fidelity and recovery. Report completed checkpoints, observed blockers and the next deliverable at each integration PR. Do not substitute a larger eval count for progress on the journey. See the [status and milestone exits](https://ds-contracts-spec.pages.dev/system/).
