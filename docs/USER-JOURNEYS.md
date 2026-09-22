# Start with your library

Design System Contracts is being built for three starting points. Choose yours; the contract is the shared agreement between the code and design you already use.

**V1 focuses on React ↔ contracts ↔ Figma.** Lit and Web Components integration is paused for a planned V1.1 follow-up; existing work is preserved.

**Today:** the local app imports supported Figma families and downloads React packages, observes configured React workspaces, and creates editable native Figma drafts through the companion. Bounded updates, conflicts and interrupted-write recovery have been demonstrated. **Still in development:** qualification of the complete families, general repository onboarding and automatic repair of an existing pair. The workflow tables below describe the intended end-to-end experience; the **Try today** instructions identify available actions. [Current acceptance evidence](CURRENT.md#v1-acceptance-evidence) records the measured scope and failures.

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

**Install from the local app.** In the React output, choose **Prepare React library**, then the download link. The local development server generates the selected component and its complete dependency graph, packages JavaScript, CSS Modules, tokens and TypeScript declarations into a `.tgz`, and exposes a download link for the archive. Links last until the local server restarts or ten newer libraries are prepared; prepare again if a link expires. Install the file with `npm install ./path/to/the-downloaded-file.tgz`, then import the component from the package name in its `package.json`. The archive includes a README. Use React 18 or later and a bundler with CSS Modules support; supply the fonts declared by the design. The hosted static Playground has no packaging server, so this button is available only in local development. Missing dependencies, invalid contracts, undefined tokens or more than 30 components refuse the whole download. Packaging does not qualify fidelity or accessibility.

**Clean consumer check (from this checkout):** `npm run design:consumer:check -- --dump <rest-dump.json> --contract <proposed contract> --generated <generated dir> --component <Name> --out <new evidence dir>` packages generated output, installs it into a temporary Vite consumer with no path back to this repository, mounts source variants, exercises supported text, content, variant and state behavior, and compares against Figma exports. Use a new output directory to retain earlier measurements. Read the receipt's framing and capture metadata as well as its scores: historical independent ink crops and opaque browser captures are not interchangeable with a current full-bounds comparison. Text-masked scores are diagnostic and never replace the unmasked limit. See [the measurement decisions](23-known-limitations.md#d51-comparable-node-alpha-and-contrasting-background-measurement) and current acceptance evidence.

**Pin the consumer fonts.** Add `--fonts ./fonts.json` to the clean-consumer command when you have the design's font files. The manifest below names local files relative to itself (absolute local paths also work). Replace the hash with the file's SHA-256, for example from `shasum -a 256 ./fonts/ExampleSans.woff2`.

```json
{
  "version": 1,
  "fonts": [
    {
      "family": "Example Sans",
      "weight": "400",
      "style": "normal",
      "file": "./fonts/ExampleSans.woff2",
      "sha256": "<64 lowercase hexadecimal characters>"
    }
  ]
}
```

Use the exact CSS family declared by the component. `weight` is a string containing one weight from 1 to 1000, or an increasing variable-weight range such as `"100 900"`; `style` is `"normal"` or `"italic"`. TTF, OTF, WOFF and WOFF2 are supported. Overlapping faces for the same family/style, a wrong hash, extra manifest fields or a browser font-loading failure refuse the check. The checker copies the authenticated files into the isolated consumer and `inputs/fonts/`, emits only `@font-face` rules, and records loaded faces in `receipt.json`. It does not install fonts, download replacements or alter component styles. Omit `--fonts` to use the environment's fonts. These inputs pin the consumer's assets; they do not prove which font bytes Figma used or prevent fallback for missing glyphs. The image comparison remains required.

**Measured delivery.** App-prepared archives were installed in isolated consumers and inspected in the browser. Current comparisons require the unchanged 5% limit on **both white and black**, with authenticated layout origins and a shared crop: Altitude Badge passes 10/10, Altitude Checkbox Group 12/12 and Altitude Checkbox 26/26 with explicitly supplied, hashed Public Sans. CBDS Badge passes 72/72 with explicitly supplied, hashed Inter and the owned-text rule in D.90. Its earlier 66/72 result remains preserved; broader family qualification remains open. The pinned consumer font does not authenticate Figma font bytes. These pixel results do not establish keyboard behavior, accessibility or instance swaps. The latest Checkbox browser download event timed out; the exact displayed archive endpoint was retrieved and matched the installed bytes. [CURRENT.md](CURRENT.md#v1-acceptance-evidence) records the evidence and remaining gaps.

**Repeat imports.** Figma captures with file/node anchors refresh the same workspace entry across JSON and URL imports. Same-name components from different files remain separate. Their allocated contract ids survive set renames and removal of an earlier name collision. Unanchored inputs still refresh by source and display name; old entries already replaced before this correction must be imported again.

**The REST import brings the children (docs/23 §D.43).** The app’s URL import follows the same-file dependency walk. It saves the parent and child proposals together, with their token layers, and opens the requested parent by its Figma node id. In **JSON**, choose a REST dump file (or paste its contents), review it, and choose **Load**. A dump carrying closure provenance uses the same family retention. A family larger than the workspace’s 30-component limit refuses before changing the workspace; a refused requested parent also refuses the import, while a refused dependency stays a named provisional stub. Repeated Altitude and CBDS imports were shown live on 2026-09-19 with stable, distinct identities and retained dependencies; see the acceptance ledger for the delivered consumers.

**From the command line:** `npm run extract:figma:rest -- "<figma url>?node-id=<set id>" --out <work>/set.rest-dump.json` now also fetches every same-file component set the set's instances reference (transitively, at most 64 of them) into the same dump, so `npm run extract:figma` proposes each child as a real contract instead of an empty stub, and `ds-contracts generate <work>/propose/*.contract.proposed.json …` generates them all. Nothing extra is typed. A remote (library) component, a child that refuses to propose (`closure-child-refused:<set>:<reason>`) or one past the cap stays a stub and is named on stderr and in `figma-proposals.md`. `--no-closure` imports the one set, as before. Dependency closure alone does not qualify child content or behavior. The current Altitude Tabs archive preserves its observed body content, active styling and Stretch allocation; its two measured appearances pass both backgrounds with explicitly supplied fonts. Keyboard navigation and panel switching remain unimplemented in that archive, and the consumer fonts do not authenticate Figma font bytes. The historical near-white comparison was insufficient; current comparisons retain both backgrounds (see [CURRENT](./CURRENT.md) row 2).

**Before you run it:** the check drives Chromium through `playwright-core`. Without the browser revision `playwright-core` pins, the receipt records `check-failed: browserType.launch: Executable doesn't exist …` and the command exits non-zero; `npx playwright-core install chromium` installs it. Image scoring needs a Figma personal access token, passed as `--token` or in the `FIGMA_TOKEN` environment variable. Without one the packaging, mount and behavior steps still run, the receipt names `figma-images-unavailable` as a problem and the command exits non-zero; it never reports a pass. Runnable inputs for both sets are committed under `recipe/evidence/design-led-consumer/<set>/inputs/`: `rest-dump.json`, the proposed contract and `generated/`. Pass that committed `generated/` directory as `--generated`. Running `ds-contracts generate` on the proposed contract alone refuses it by name, because the `imported.*` tokens the contract references are not in the token set it is given. Point `--out` at a scratch directory unless you mean to replace the committed receipt. [What needs a Figma token](#figma-token) lists the other commands that read one.

**Where this currently stops:** the app retains supported same-file dependencies and delivers their package, but full-family fidelity, instance swaps, accessibility and wider behavior remain unqualified. General API review, repository updates and design-to-code repair of hand-authored React remain unfinished. Existing manual CLI/plugin workflows are available as [technical reference](https://ds-contracts-spec.pages.dev/operator-guide/). The hosted site is deployed separately and may lag this repository; on 2026-09-18 that address answered 404. To read the same page from a checkout, run `npm run site:build` and open `site/dist/operator-guide/index.html`; its source is `site/src/pages/operator-guide.ts`.

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

**What the `/sources` steps need first:** configure an existing React workspace with installed dependencies and the source/capture files described in [source-reference/README.md](../source-reference/README.md). Set `DS_CONTRACTS_REACT_SOURCE_ROOT` on the `npm run playground` process to that workspace. An optional `ds-contracts.react.json` declares its own cases and source-authored witnesses. Without a declaration, the built-in ten-case shadcn preset expects the prepared sandbox; that sandbox is not committed. Its manual recreation recipe is [examples/shadcn/RECON.md](../examples/shadcn/RECON.md), including the registry reproducibility limit. If the configured source is unavailable or changed, **Load React originals** refuses and names the configuration problem. Static code import and **Demo import (Badge fixture)** remain available without a source workspace or credentials.

**Inspect original React sources locally:** open `/sources`, choose **Load React originals**, then **Validate React sources** for the configured workspace cases (the built-in preset contains ten Button, Checkbox and composed Card cases). **Inspect React APIs** reads its installed declarations and shows incomplete contract proposals. Expand **Original Checkbox interactions** in the validation results to review label activation and Space-key transitions for the four original Checkbox states. Each probe starts from a fresh mount and checks restoration afterward. These source checks do not qualify generated Figma or React behavior; unsupported APIs remain visible. This preset is not a general repository picker. A source workspace can declare its own cases in an optional `ds-contracts.react.json` at the configured source root instead of using the built-in cohort; the format, its limits and every named refusal are described in [the React reference README](../source-reference/README.md#declaring-a-workspaces-own-cases). Workspace-declared cases have been demonstrated through the app: the separate Badge/Alert/Switch workspace validates 7/7 originals, and Radix Themes validates 4/4. Radix native drafts still refuse content ownership; successful source validation alone does not authorize conversion.

**Inspect a native root draft locally:** after **Trace React structure** completes, choose a supported Button or Card case and **Prepare … for Figma**. Open the companion plugin in the authorized file shown by the app, obtain the connection code, and use **Build → Connect the local source workflow → Connect / resume**. Then choose **Create and inspect native draft** in the app. This creates root variants and bound variables with empty editable content slots. Review the structural result and diagnostic exports. **Inspect native draft again** reads the same objects; it does not create replacements. After a server restart, reload unchanged originals to recover the saved operation. Initial-state and composed-graph operations use the separate flows below; their scope and visual gaps remain recorded in the acceptance ledger.

On a saved operation, **Prepare caller-content comparison** reads its original text, painted fonts and SVG viewports. The source must still match its recorded rendering. The app shows whether that content compiles and names unsupported facts. After successful preparation and root inspection, choose **Prepare native comparison operation**. Connect the companion to this separate operation and choose **Create and inspect native comparison**. It fills an instance of the saved main, independently reads it back, and displays original/native diagnostic images. Preparation and operations survive restart; reinspection retains the same native objects. The preselected Default, Secondary and Icon-with-text Button comparisons have passed independent structure readback and the existing image-difference limit; this is bounded case evidence. Choose **Measure original comparison frame** to compare cropped original pixels with the native export at their original scale and see both layout dimensions. The measurement rechecks the unchanged original and survives reload; the full source image remains available. Complete cohort fidelity, state behavior and content usability remain unfinished. The reusable main stays empty.

**Review a recorded matching-frame measurement.** Where evidence is available, the native review shows original, native and difference images on white and black, with source identity, operation identity and exact dimensions checked before scoring. The nine-state Switch and composed Alert have this review. Preparing their transparent source frames and native comparison exports was an operator step; the app authenticates and recomputes the recorded measurements. This is not automatic capture or qualification of every family member. Badge still refuses the exact-dimension comparison (43.875px in React versus 44px in native Figma).

**Try today:** [open code import](https://ds-contracts-playground.pages.dev/playground?source=code) for a static TSX/CSS experiment. Use the local app's same code-import view when working from this checkout. Review the proposed contract and named limitations before inspecting generated output. The current reader recognizes bounded syntax and styling patterns; a successful API proposal alone does not prove rendered styling, behavior or native Figma fidelity.

**Inspect initial states:** after preparing a supported root, select a case and choose **Inspect … initial states**. This varies finite caller inputs on fresh mounts and restores the original rendering. Supported saved observations enable **Prepare initial states for Figma**, followed by the same companion connection and creation flow. Recorded Button and Checkbox initial states have native readbacks; the nine-state independent Switch also has an authenticated matching-frame review. Full-family fidelity remains unqualified. When the app marks an observation as made by an older reader, **Observe again with the current observer** records a new observation while preserving earlier operations and their pinned evidence. Initial-state observations do not establish live updates, keyboard interactions or an editable content API.

**Return a supported state API through Figma:** after inspecting initial states and callback behavior, use **Check … state inputs together**. A complete bounded experiment enables **Prepare … state API for Figma**. Connect that separate operation and use **Create and inspect native draft**. Its editable variants retain the observed controlled input, initializer, disabled input and callback declarations; the native canvas does not execute those callbacks. Capture the set with the canonical plugin dump, load it through the Playground's **JSON** tab, then choose **React → Prepare React library** and install the downloaded archive. The independent Switch has measured installed behavior and initial-image evidence in [D.71](23-known-limitations.md#d71-a-separate-app-operation-preserves-the-observed-state-api-through-native-return). Other inputs and all-state visuals remain unqualified. Repeating preparation reopens the same operation.

**Update that existing state-API set:** after a source or observer change, reload the source and refresh its initial-state and simultaneous-input observations. If those checks are disabled, follow the current source with a supported existing root first. Choose **Follow the current source with the existing … state API**, then **Review compiler update**, **Prepare reviewed correction**, connect the companion using that correction's code, and **Apply and verify correction**. A running or failed experiment cannot authorize an update. A conflicting canvas value is named and left intact; after resolving it, **Inspect update again** runs a fresh preflight on the same proposal. The independent Switch opacity update, conflict, repeat and exact rollback are demonstrated in [D.73](23-known-limitations.md#d73-state-api-operations-follow-fresh-source-evidence-without-replacing-their-native-set). Bound-height and API changes remain refused. Earlier exports remain visible as historical evidence and are not paired with the current source.

**Apply a reviewed design change to the original source (under qualification):**
for an existing verified update, choose **Read design changes from the canvas**
and **Prepare source repair preview**. This currently supports the bounded
root-opacity edit described in [D.108](23-known-limitations.md#d108-source-application-requires-fresh-canvas-reads-and-verified-recovery).
Review the module, generated CSS, state images and all configured caller
examples, then choose **Apply reviewed change to original source**. Keep the
same Sync Runner operation connected while the app checks the canvas, writes
the reviewed files, validates all examples and checks the canvas again.

Progress and recovery appear under **Source changes and recovery**, including
after a page reload. Choose **Prepare Sync Runner connection**, then **Copy Sync
Runner connection** (or select and copy the masked field) to copy the operation's
connection for reconnection. **Apply / resume reviewed change** retries with a
new canvas read. **Restore original source and CSS** restores those files and
validates them; it leaves the Figma edit in place. After completion, **Load
verified source** opens the resulting source reference. Unexpected source edits
are preserved and refuse. The bounded opacity Apply, interruption before the
write, completed-repeat behavior, exact source restoration and intervening
source/canvas conflict refusals are demonstrated. A real failure after installing
the module but before installing CSS also resumes through these controls. The
completed module is retained; verification must still finish before the app
claims success. Source restoration and the four temporary canvas edits were
then independently verified back to the pre-test state. This is an IO-failure
probe; process termination during file replacement remains unmeasured.
To continue using an existing
native set, trace the verified source, follow its saved root observation, inspect
the required initial states, then choose **Follow the current source with the
existing … states** and **Review compiler update**. This flow retains the same
component operation and nodes; any remaining variable correction still requires
preflight and independent readback. The bounded opacity journey demonstrates
that succession and an unchanged repeat. Broader recovery and two-way acceptance
remain under qualification. A preview alone never means the original files
were updated.

**Inspect a stateful child in its composition:** for the configured composed Card, open its saved caller-content review:

1. Choose **Generate React composition** to review the nested component identities and any source-context differences.
2. Choose **Inspect Checkbox states in composition**, then **Inspect Checkbox behavior in composition**. The app observes the child inside its original Card, including inherited styles and its associated label, and verifies restoration of the full original after each trial.
3. Choose **Generate React composition** again to use the contextual evidence. **Try generated composition** opens two independent copies with editable content and state controls.
4. Choose **Check native composition** to compile the same parent and dependencies for Figma. This is a compilation review that creates no Figma objects.
5. Choose **Prepare native graph operation**, connect the companion in the authorized file, then **Create and inspect native graph**. The app creates the dependency mains and parent variants in one operation, reads the parent structure back independently, and shows the unchanged React source beside the native default variant at original pixel scale. Dependency internals are verified by identity only. Six recorded Card parent variants and two retained frames pass their historical image check; wider composition and interaction coverage remains unqualified.

Completed state and behavior observations reopen on a repeat action. Failed attempts remain recorded. A standalone component observation cannot establish that it behaves or renders identically inside another component.

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

**Bounded updates available locally.** On a verified native operation, use **Review compiler update**, **Prepare reviewed correction**, connect the companion, then **Apply and verify correction**. The app uses fresh preflight and independent readback, preserves creation records, refuses conflicting values and retains uncertain write outcomes for recovery. Supported channels include opacity, literal dimensions on empty flex roots, root shadows, simple SVG strokes, supported background layers and guarded allocated number values. A bound cross-axis size can update only after **Inspect sizing details** provides fresh facts and the guarded writer verifies the supported layout transition and every binding consumer; other bound dimension changes refuse by name. See [D.87](23-known-limitations.md#d87-pixel-dimension-value-history-does-not-authorize-a-bound-size-write). **Read design changes from the canvas** reports supported design edits; the developer changes the original React and the app verifies agreement. It does not write that React code. Live Checkbox and Switch proofs, interruption recovery and duplicate-free repeats are recorded in [CURRENT.md](CURRENT.md#v1-acceptance-evidence).

**For two previously unrelated libraries:** the repository has diff and planning foundations. The [current status](https://ds-contracts-spec.pages.dev/system/) describes their boundaries. The hosted copy may lag this repository (on 2026-09-18 it answered 404); the same document is [docs/CURRENT.md](../docs/CURRENT.md), and the local app serves it at `/system`. There is no complete **Compare libraries → repair both sides** application action yet. Starting from two existing libraries must not silently become “overwrite one with the other.”

<a id="install"></a>
## Install and try it today

### Explore without installing

Use the [hosted engine explorer](https://ds-contracts-playground.pages.dev/playground) for contract mechanics, fixture imports and generated output. It may be a different revision from this checkout. Source capture needs a local service; the hosted explorer cannot access your local repository.

### Run the current source locally

Requires npm and Node.js 20.19 or later on the 20.x line, or 22.12 or later: the range Vite 8.3.0 declares (`^20.19.0 || >=22.12.0`). CI runs 20.19.4, and `.nvmrc` pins the same version.

```bash
git clone https://github.com/southleft/ds-contracts-poc.git
cd ds-contracts-poc
npm ci
npm run prep:schema
npm run playground
```

Use `npm ci`, as CI does: it installs exactly what `package-lock.json` records. `npm install` under npm 10.8.2 rewrites that tracked lockfile (it drops the `libc` fields); `git restore package-lock.json` discards the change.

The app must run on port 5181: the port is strict, and the companion plugin's local connection is fixed to `http://localhost:5181`. If the port is busy, stop the other process. `npm run playground -- --port <n>` starts the app on another port for browsing, but the plugin will not reach it.

Open [the local start guide](http://localhost:5181/start). The main branch contains merged work; an open PR is a separate revision. Start a React experiment from code import. The React `/sources` preset and archived Lit flow each require their configured source library; the React path does not depend on the Lit setup. The code-first section above states what the React `/sources` steps need first. `npm run test:worker` and `npm run typecheck:worker` run from the root install. Only the Worker's `wrangler` dev server and deploy need `npm --prefix workers/assist install`; see [CONTRIBUTING.md](../CONTRIBUTING.md).

For native Figma operations from this checkout, build the companion development plugin with `npm run plugin:zip` and import `figma-sync/plugin-dist/manifest.json` through **Plugins → Development → Import plugin from manifest** in Figma desktop. The local app must use port 5181 and the plugin must be open in the authorized target shown by the app. The React root-inspection flow uses **Prepare … for Figma**, **Get connection code**, then **Create and inspect native draft**. In the plugin use **Build → Connect the local source workflow → Connect / resume**. If an older development registration has the same plugin ID, remove that obsolete registration and import the current manifest; this does not delete source files or canvas content. Keep the connection code private; it grants delivery and result access for that operation. The development flow has measured supported cases and named limits; it is not general component-family qualification.

<a id="figma-token"></a>
### What needs a Figma token

Nothing in the install steps above does. `npm ci`, `npm run prep:schema`, `npm run playground`, the static code import and **Demo import (Badge fixture)** run without credentials, and `npm run eval` and `npm run docs:check` do not read one.

Reading a real Figma file needs a Figma personal access token:

- **Figma import in the app:** enter the token in the import form, next to the component URL.
- **`npm run design:consumer:check`:** `--token` or the `FIGMA_TOKEN` environment variable, for the image comparison only.
- **`npm run extract:figma:rest`:** `--token` or `FIGMA_TOKEN` (read-only; with the default closure it makes one more `/nodes` request per round of child sets).
- **Live `sync` observe and pull** (`sync/cli.ts`): `FIGMA_TOKEN`; their `--fixture` path runs offline.
- **The visual-parity, visual-truth and Figma export scripts** under `scripts/` and `extract/figma/`: `FIGMA_TOKEN` from the environment, or from a git-ignored `.env.local` in the checkout (`extract/figma/visual-parity/env.ts`).

Keep the token out of committed files.

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

**Timing:** there is no evidence-backed V1 date yet. Forecast from completed journeys and observed remaining blockers, not eval counts. The next deliverable is an imported React component family reaching verified, editable native Figma output. See the [status and milestone exits](https://ds-contracts-spec.pages.dev/system/), or [docs/CURRENT.md](../docs/CURRENT.md) when the hosted copy is unavailable.
