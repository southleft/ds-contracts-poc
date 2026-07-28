<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
  <img alt="" src="docs/assets/logo-light.svg" width="96" height="58">
</picture>

# Design System Contracts

**A design system's source of truth should be neither the design file nor the code — but a machine-readable *contract* that sits between them and generates both.**

This repository is the working proof, and the candidate reference implementation for a vendor-neutral component contract specification. 51 component contracts and 282 DTCG tokens generate two surfaces — a typed React library and a native design-tool library — that are continuously proven to match the contracts by a three-way differ. Nothing is hand-maintained twice, and nothing pretends to be in sync when it isn't.

**→ The spec site: [ds-contracts-spec.pages.dev](https://ds-contracts-spec.pages.dev)** · **The playground: [ds-contracts-playground.pages.dev](https://ds-contracts-playground.pages.dev)** · **New here? [Which journey are you on?](#which-journey-are-you-on)**

---

## What a contract is

One JSON file per component. It is the file a human edits — the React component and the Figma component set are both generated from it — and it is what design and engineering agree to:

| The contract records | It does **not** record |
|---|---|
| **props** and their legal values | hooks, handlers, business logic |
| **anatomy** — the parts, and how they're laid out | data fetching, side effects |
| **token bindings** — which token paints which channel | anything that only exists at runtime |
| **states** — hover, active, focus-visible, disabled, checked | |
| **semantics** — role, ARIA, declared events | |

The cut is deliberate and permanent: a contract carries only **canvas-expressible facts**, because that is the largest surface on which a deterministic round trip is possible. Your code stays as rich as you like — the contract just never claims to describe that part ([the sync boundary](docs/16-sync-boundary.md)).

```jsonc
// contracts/banner.contract.json (excerpt)
{
  "id": "ds.banner",
  "props": [{
    "name": "status",
    "type": { "enum": ["info", "success", "warning", "error"] },
    "default": "info",
    "bindings": {
      "figma": { "kind": "VARIANT", "property": "Status" },   // → a 4-option variant axis
      "code":  { "prop": "status" }                            // → a typed union prop
    }
  }],
  "anatomy": {
    "root": {
      "tokens": { "background-color": "{color.feedback.{status}.background}" }
      //           → one CSS class per value     → one bound variable per variant
    }
  }
}
```

That one file produces a typed React component **and** a real Figma component set with a Status variant axis whose fills are bound to variables — and a differ can mechanically prove both still match it. Composition (slots with `accepts` constraints, nested component refs), conditional parts (`visibleWhen`), declared events, icon assets, ARIA-by-prop, prop-driven elements and layout, and canvas state previews are all expressed the same way. Full field reference: [the contract specification](docs/02-contract-spec.md).

---

## Which journey are you on?

Three situations bring people here. They are genuinely different amounts of work, so find yours first.

| | Your situation | What you actually run | Ends with |
|---|---|---|---|
| **A** | *"I have components in code. I want them in Figma."* | [Journey A](#journey-a--i-have-components-in-code-i-want-them-in-figma) — a config, a real-browser capture, a bundle, a publish | A designer clicks **Check for updates** and your components appear on their canvas, token-bound |
| **B** | *"I have a component on the canvas. I want code."* | [Journey B](#journey-b--i-have-a-component-on-the-canvas-i-want-code) — the plugin's **Send** tab, then `generate` | A typed React component + CSS Modules + Storybook stories in your repo |
| **C** | *"I already have a mature Figma library **and** a mature codebase."* | [Journey C](#journey-c--i-already-have-both) — scan, reconcile, referee | A property-by-property disagreement report, and a CI gate that keeps it from getting worse |

One rule spans all three: **the surfaces never sync side-to-side.** A designer's change and an engineer's change both travel *through the contract*, as a reviewable diff. Nothing writes to your repo without a pull request, and nothing writes to the canvas without a human clicking Apply.

---

## Journey A — "I have components in code; I want them in Figma"

The goal: your real Button, with its real padding, its real colors, and its real variants, as a native Figma component set — built by a machine, not redrawn by a person.

**There is no copy-paste step and no manual redraw.** There is also, for most libraries, no shortcut: the tool has to *run* your components in a browser to learn what they look like (see [the hard limit](#the-hard-limit-you-cannot-point-this-at-a-github-url), below).

*The one exception:* if your library is React with co-located `*.module.css` files, static extraction can read anatomy and token bindings straight from the stylesheets, and you can go from `extract` to `figma bundle` without a browser at all. Try it first — it costs a minute. If the proposals come back saying *"API surface only"*, you need the capture.

### The path

```bash
npm i -g @ds-contracts/cli

# 1. Point it at your repo. --detect prefills adapter, root, tokens and styling
#    hints from what it finds — marked "detected", never "confirmed".
ds-contracts init --detect

#    It prints every prefill with the reason it chose that value and writes them
#    into a "$detected" block. Confirm each one, then DELETE that block.

# 2. Read your components' source: props, defaults, events → proposed contracts,
#    plus a DRAFT capture config with "__review:*" markers on every field the
#    tool could not infer.
ds-contracts extract --draft-capture-config
```

Now **review the draft.** This is the one irreducibly human step. The draft marks four things it cannot guess — `classAllow`, `varPrefix`, `mount`, `fixedProps` — and you answer them by reading your own library. If you skip it, the next command refuses:

```
REFUSED: extract/computed/configs/acme.json is an UNREVIEWED DRAFT capture config
(top-level "__unreviewed-draft" marker). A draft never captures: review every
"__review:*" field (classAllow, varPrefix, mount, stateProps, fixedProps, …),
then delete the marker to approve it.
```

That refusal is the design. A wrong `classAllow` fails *silently* — you get a contract that looks fine and describes the wrong box — so the tool would rather stop.

```bash
# 3. The capture. This launches a real Chromium, mounts every prop combination
#    of your real component, and reads the browser's computed styles. It runs
#    the whole sweep TWICE and refuses if the two runs disagree.
ds-contracts extract --computed --config extract/computed/configs/acme.json \
  --harness examples/acme/.acme-sandbox --out extract/computed/out/acme
```

`--harness` is a directory with your library actually installed at a pinned version. That is why this step needs a sandbox: the capture renders your package, it does not read your package's source.

If there is no browser on the machine, this verb — and only this verb — degrades with a named message and **exit code 3**, telling you to `npm i playwright-core && npx playwright-core install chromium` (or point `PLAYWRIGHT_CHROMIUM_PATH` at a Chromium you already have). Every other verb keeps working without a browser.

**4. Promote.** Fusing captured truth into the seed contracts is a per-library script you copy and retarget — `examples/carbon/scripts/promote-floor.mjs` is the worked example. It is *not* a CLI verb yet, and saying otherwise would be a lie; [docs/21 §2.6](docs/21-bring-your-own-design-system.md) walks it.

```bash
# 5. One file, containing everything: contracts + your token set + icons.
ds-contracts figma bundle examples/acme/contracts --out acme.bundle.json \
  --tokens examples/acme/tokens/acme.dtcg.json,examples/acme/tokens/acme-minted.dtcg.json \
  --modes light.json,dark.json --name Acme

# 6. Mint the standing channel ONCE. It prints two keys: a write key (a CI
#    secret — it publishes) and a read key (sha256 of it — the half you send
#    the designer; it can never publish).
ds-contracts figma claim-channel

# 7. Publish. CI runs this whenever; nobody has to be online.
ds-contracts figma publish acme.bundle.json
```

**8. The designer opens the plugin's *Changes* tab and clicks "Check for updates".** They see what changed in plain words, tick the rows they want, and click **Apply selected**. Applying is in-place: same node ids, same component keys, so instances placed around the file keep their component-property overrides. New components land as new sets. A row whose set has been edited on canvas warns that applying would overwrite that edit, and starts unchecked.

### Getting the plugin

The Sync Runner plugin is **not on the Figma Community**, and that is a decision rather than a pending task. Distribution is the manifest-upload developer-plugin path: `npm run plugin:zip` in this repo refreshes `figma-sync/plugin-dist/`, and in the **Figma desktop app** you use **Plugins → Development → Import plugin from manifest…** and pick `figma-sync/plugin-dist/manifest.json`. Import from that folder — never from `figma-sync/plugin/`, which is a stub with no engine. Development plugins only load in the desktop app, not on figma.com; any plan works and no admin approval is needed. The consequence, stated as a property of the model rather than a task: someone with repo access does this once per file owner.

### Two other ways to deliver the same bundle

- **Ad-hoc (both people online).** `ds-contracts figma push acme.bundle.json --code <CODE>` — the designer reads the 6-character code from *Other ways to receive* in the plugin's **Build** tab. Deliver-once, 15-minute TTL, and it carries no ordering, so an out-of-order delivery gets no freshness warning. Use it for a one-off from a laptop.
- **No CLI at all.** The bundle is plain JSON. Send it however you send files; the designer pastes it into the box on the plugin's **Build** tab and clicks *Generate in this file*. This is the whole reason the bundle exists — **JSON is the only thing anyone pastes**, and there is no script step.

### The hard limit: you cannot point this at a GitHub URL

**You cannot give the Figma plugin a repository URL or an npm package name and get components.** Not a missing feature — a structural one:

- The capture must **run** your components in a real browser to read their computed styles. That is what makes the result true instead of guessed.
- A Figma plugin is a sandboxed iframe. No Node, no npm, no bundler, no browser engine of its own. It cannot install your package, and it cannot render it.

So the browser step happens on a machine you control — your laptop or your CI — and what travels to Figma is the finished bundle.

### What the static path does and does not give you

`ds-contracts extract` with no `--computed` runs anywhere, needs no browser, and takes seconds. It reads your source and always proposes schema-valid contracts carrying your **API surface** — props, enums, defaults, events. Whether it also gives you **anatomy** (the parts, their layout, and which token paints each channel) depends entirely on how your library is styled:

| Your library | What static extraction produces |
|---|---|
| React + co-located `<Component>.module.css` | **API surface *and* anatomy** — parts, token bindings, layout, states, read from the stylesheet. Best-effort, not guaranteed: Polaris's whole library yielded anatomy for 109 of 182 components; the rest came back as stubs. |
| React + StyleX | API surface and **structure only** — parts, no styling. Styling is marked as a review item. |
| React + Tailwind, Emotion, styled-components, or any runtime styling | **API surface only.** Anatomy comes back as the stub `{"root": {}}`. |
| Web Components via a Custom Elements Manifest (`cem`) | **API surface only.** A manifest has no styling channel. |

The proposal text tells you which you got, per component: *"API surface AND anatomy … read from source"* versus *"API surface only; anatomy, tokens, and design bindings await reconciliation and human review."*

**Read that last row carefully, because the failure is quiet.** A stub anatomy is schema-valid, so nothing refuses it — and the Figma emitter will happily build the component set anyway. What lands on the canvas is a correctly *named* component with the right variant axes and **blank frames inside**: no fills, no padding, no bound variables. That is not the tool lying to you; it is the tool faithfully rendering a contract that says nothing about what the component looks like. If your canvas sets come out empty, this is why, and the fix is the computed capture.

The static path is still worth running first for any library: it is the seed the capture enumerates against, and it is enough for `ds-contracts diff` to referee your API in CI on day one.

---

## Journey B — "I have a component on the canvas; I want code"

The goal: a designer has a component set in Figma; you want a real, typed React component in your repo.

1. **In the plugin, open the *Send* tab.** Select the set (or find it with *Scan this file*), leave the base-contract box empty if this tool did not build it, and click **Read the set & diff**. The engine reads the live set and proposes a contract from what is actually drawn — variants become props, layers become anatomy, bound variables become token refs.
2. **Get that contract into the repo.** Three doors, all reviewable:
   - **GitHub PR** — fill in `owner/repo` and a fine-grained token (session-only, never stored; leave *Dry run* ticked to see the exact plan first).
   - **Send to repo** — the developer runs `ds-contracts figma receive --out contracts` on their machine, which prints a 6-character code; the designer types it in. The CLI **writes nothing without `--apply`**.
   - **Copy the JSON out** and commit it yourself.
3. **Generate the component.**

```bash
ds-contracts generate contracts/button.contract.json --out src/generated \
  --target react --tokens tokens/captured.dtcg.json --stories
```

`--target` accepts `react` (typed TSX + CSS Modules + stories), `html`, `react-inline`, `figma-script`, or any emitter you register with `--emitter`. An unknown target is refused with the list of registered names.

Generation is **fully deterministic**: the same contract produces byte-identical output, every time, on any machine. No model is in the path.

### The honest asymmetry

For a set **this tool generated**, Journey B is a true round trip — the proposal is measured against the contract that built it, and this repo's own components re-extract to zero mismatches in both directions.

For a **hand-built** set, it is not a reproduction. The proposal is an inversion of what can be read off the canvas: real structure, real variants, real bound variables — but a canvas cannot tell you about a `useEffect`, a keyboard handler, or why a value is what it is. **Treat the generated component as a strong, correct-by-construction starting point, not as your finished component.**

---

## Journey C — "I already have both"

Brownfield: a mature Figma library your team drew by hand, and a mature codebase, and no idea how far apart they are.

- **Look at the Figma side first.** The plugin's **Send → Scan this file** does a read-only pass over every local component set — *including ones this tool never made* — and tells you what is there and which sets could come under contract. Nothing is changed.
- **Get the disagreement report.** `ds-contracts extract --reconcile` compares your code-side contracts against a Figma dump and classifies every property: *agree*, *options-differ*, *code-only*, *design-only*. This is the artifact that ends the "which one is right" argument, because it is per-property and mechanical.
- **Then hold the line.** `ds-contracts diff` is the referee — exit `0` clean, `1` drift (findings named), `2` config error. Wire it into CI and the gap stops growing while you close it.

**What is not supported yet, stated plainly:** *adopting* an existing set — stamping a hand-built Figma component as contract-backed so future syncs amend it in place — is **not a verb this tool has**. Coexistence inside a foreign kit is proven, and amending a set *this tool created* inside a foreign kit is proven; amending a hand-built set is not. See the non-destructive-sync row in [What this proves](#what-this-proves).

---

## What can I expect?

The two numbers that matter pull in opposite directions, and both are true:

**Fidelity per captured component is high.** What lands on the canvas is the browser's own computed truth for your real component — not an approximation, not a screenshot, not a guess. The capture runs twice and refuses if the runs disagree, which catches uncontrolled state, random ids and animation sampling before any of it reaches a contract.

**Coverage per library is partial, and a first pass will not be your whole library.** Each foreign-library round in this repo committed a dozen or so components out of a library of one to two hundred — the measured per-library coverage runs from about 4% to about 12%. The measured, per-library table with its denominators is [docs/22 §8.3](docs/22-generality.md). Budget hours per library for the recon and the config, then machine time for the capture.

Beyond that, four properties you can rely on:

- **It refuses rather than guesses.** A token ref outside the inventory, an illegal contract, an unreviewed draft config, a state preview that would render identically to Default — each stops with a message that names the thing. A plausible substituted value is treated as worse than a crash.
- **Everything it cannot carry, it names.** Every extraction writes a `*.extension.json` sidecar listing each captured fact the vocabulary refuses, with the reason. Nothing is dropped on the floor.
- **Re-running is always safe.** Same input, same bytes. Applying an update to a live canvas preserves node ids, component keys and component-property overrides on placed instances.
- **The known gaps are written down, not discovered.** Three you will meet soon enough: **overlay components** (Dialog, Menu, Tooltip) have no hover/focus/active planes in the captured truth, so those contracts declare `states: []` by design; **text wrapping is not implemented**, so a hugging text node inside a narrower fixed-width ancestor clips; **the harness loads no webfonts**, so absolute text widths are fallback-font widths. The full ledger, including where the generality claim leaks, is [docs/22 §8](docs/22-generality.md).

---

## Try it without cloning

**→ [ds-contracts-playground.pages.dev](https://ds-contracts-playground.pages.dev)**

**Start here if you want to understand the idea before installing anything.** The playground runs the repository's actual engine (`core/`) in your browser — no backend, no accounts, no analytics; credentials are session-only and never leave the browser. Ten minutes there teaches the model faster than any page of prose.

*Try first:* open **Examples**, pick the Badge, then break its contract on purpose — delete a required field, or point a token binding at a name that doesn't exist. The refusal appears on screen, named. That refusal is the whole product.

What is in there:

- a gallery of live-emitted examples from the shipping contracts
- a governed contract editor — schema violations and generator refusals shown on screen, by name
- import a component from a **figma.com URL** (your token), with an honest degradation ladder when your plan gates the variables endpoint
- import code from a **public GitHub file URL**, or paste TSX + a CSS Module — the stylesheet unlocks anatomy, every failure named
- paste a **plugin dump** (`extract/figma/dump.plugin.js`) into the **JSON** tab for native variable names on any Figma plan
- paste **your own DTCG tokens** and watch every consumer rebind to them
- describe a component in a sentence and let Claude (your key) propose a contract the schema can refuse
- share any contract as a ~1 KB permalink

**One route is off, and the playground says so on the button:** live relay from the Figma plugin. The plugin's *Send to Playground* tab was removed when its seven tabs were re-housed into Build / Changes / Send, so nothing can answer a pairing code today. Use the figma.com URL route, or paste a dump into the JSON tab. Both credential-gated paths — Figma URL import and prompt-to-contract — are live-verified against real endpoints ([MILESTONES.md](MILESTONES.md)).

Prefer a terminal? The engine also ships as npm packages — `npm exec @ds-contracts/cli` scaffolds a working config in one command (`@ds-contracts/schema` 15.0.0 · `@ds-contracts/cli` 0.2.0, every CLI verb eval-pinned by a consumer-style smoke test).

## The model

A growing category of tools speaks this vocabulary; this project holds four positions that, together, none of them do. **Bidirectional:** the contract generates *both* the code and the design canvas, and imports from both — round-trips are proven, not promised. **Deterministic:** every artifact is computed from file data and byte-pinned; no LLM guesses in the pipeline (AI is available as an assistant, never as an authority). **Receipted:** anything the pipeline cannot carry is named on screen — a gap is reported, never papered over with a plausible value. **Open:** the schema, the engine, and every instrument that verifies them are in this repository under one permissive license, with no gated tier — because a spec the community can't fully use isn't a spec.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/contract-flow-dark.svg">
  <img alt="Workflow diagram: the contract sits between the design surface and the code surface. Generation flows outward from the contract to both surfaces; changes on either surface flow back into the contract as promotions, and the contract regenerates the other side. A three-way differ verifies all of it continuously. Surfaces never sync side-to-side." src="docs/assets/contract-flow-light.svg" width="920">
</picture>

Every organization that takes design systems seriously eventually splits into two camps. Some come in from the **code side**: the system is an npm package, and the design files are an aging picture of it. Others come in from the **design side**: the system is a canvas library, and the code is an approximation of the pictures. Both camps are answering the same question — *where does the truth live?* — and both answers fail the same way: whichever surface is declared canonical, the other becomes a hand-maintained copy. Copies drift. Drift erodes trust. Eroded trust is why design reviews turn into arguments about which surface is "right."

This project takes a third position: **the source of truth is neither surface.** Each component is defined once, in a small versioned JSON contract capturing everything design and engineering must agree on — props and their legal values, anatomy, token bindings, slot constraints, accessibility semantics, declared events. Both libraries are *renderers* of that contract: generated from it on the first pass, validated against it forever after.

The rule that makes it work: **surfaces never sync side-to-side.** An engineer's new prop and a designer's color change take the same path — flagged by the differ, promoted into the contract as a reviewable diff, then regenerated out to the other surface. One arbiter, version-controlled, no arbitration meetings. It's the governance model that made Git work for code and the DTCG token format work for design tokens, run one level up — at the component-API layer.

There's a second reason, and it's becoming the bigger one: **AI generation.** In this repo's A/B evaluation, an ungoverned agent building screens scored **69/100 adherence with 90 violations** — invented props, hard-coded colors, restyled components. The same model constrained by the compiled contract catalog scored **100/100 with zero violations**, and when it hit a real gap in the system, it *reported the gap* instead of faking around it. The gap became a contract proposal, the proposal became a version bump, and the score went back to 100. The contract isn't just how design and code stay aligned — it's how generation stays honest.

## What this proves

Every capability claim in this repository is backed by an executable check or a committed receipt — that's the house rule ([no capability claim without an eval behind it](CONTRIBUTING.md)). The dated log of what has been proven, in order, is **[MILESTONES.md](MILESTONES.md)**; release history is **[CHANGELOG.md](CHANGELOG.md)**. The standing claims and their mechanisms:

| Claim | Mechanism | Receipt |
|---|---|---|
| **Deterministic generation** | golden-output manifests, byte-compare — determinism proven against recorded output, not just against itself | `evals/golden.json` |
| **Refusal** | illegal contracts fail by name at build time, on both surfaces | C2 eval family |
| **Drift detection** | every claimed drift class has a failing test | C3 eval family |
| **Convergence** | promotion round-trips instead of ping-ponging | C4 eval family |
| **Honest AI generation** | catalog-governed 100/100 vs ungoverned 69/100, scored by a deterministic judge | [docs/10](docs/10-honest-generation.md) |
| **Round-trip identity** | this repo's own generated components re-extracted — code→contract and design→contract — match their shipping contracts with **zero mismatches**, both directions, red-tested | [`extract/ROUNDTRIP-CODE.md`](extract/ROUNDTRIP-CODE.md) · [`extract/figma/ROUNDTRIP.md`](extract/figma/ROUNDTRIP.md) · [`extract/figma/rest/ROUNDTRIP-REST.md`](extract/figma/rest/ROUNDTRIP-REST.md) |
| **Brownfield** | four unrelated design systems — Shoelace, Mantine, Eventz, CBDS — extracted and diagnosed, drift catalogued from real files | [`extract/pilots/`](extract/pilots/) |
| **Enterprise scale** | Carbon, Fluent 2, Spectrum, and Polaris run through the unmodified code-extraction pipeline at pinned SHAs — scores, silent-loss classes found and eliminated, every workaround named | [`extract/pilots/ENTERPRISE-GAUNTLET.md`](extract/pilots/ENTERPRISE-GAUNTLET.md) |
| **Whole-kit census** | every component set in a live enterprise Figma kit (1,618 sets, 76 variant composites) replayed through the full import pipeline — 100.0% clean, facts-carried and degradations counted per set | [`extract/figma/gauntlet/CENSUS.md`](extract/figma/gauntlet/CENSUS.md) · `npm run extract:figma:gauntlet` |
| **Visual parity** | emitted previews perceptually diffed against Figma's own renders (pixelmatch, text-masked score) — a standing worst-first fix queue, cross-renderer deltas named | [`extract/figma/visual-parity/REPORT.md`](extract/figma/visual-parity/REPORT.md) |
| **Non-destructive sync** | in-place amend of live component sets: set key, variant node IDs and property IDs survive repeated passes, so placed instances keep their **component-property** overrides (text, variant, boolean). Two limits, stated: the amend **rebuilds every variant's interior** (`core/emit-figma-script.ts:3958`), so overrides applied to *interior nodes* do not survive — and the only set ever amended inside a foreign kit was one this tool created (`Badge (ds.badge)`); the kit's own hand-built Badge was correctly invisible to the identity gate. **Coexistence in a foreign kit is proven; amending a hand-built set is not** | CBDS pilot forensics ([`extract/pilots/cbds/`](extract/pilots/cbds/)) · [docs/07](docs/07-validation.md) |
| **Theming** | a brand is a token-layer dimension, nothing else — adding one leaves every component byte-identical | `brand-added-token-layer-only` eval |
| **Engine as library** | the whole pipeline is browser-safe pure functions; CLI output golden-guarded through the refactor | `npm run core:browser-check` · [docs/15](docs/15-engine-as-library.md) |
| **Advanced composition, live** | the multi-root composite Modal — a composed Card instance, a repeated Badge collection, real Button instances with applied labels, an inset backdrop — builds correctly on a **real Figma canvas** from one pasted contract (2026-07-22), deterministically, no AI in the conversion; both journey directions gated headless, and both real-Figma quirks found en route (auto-layout hug↔fill collapse, instance property-exposure lag) are modeled in the mock so they fail in Node forever | `npm run plugin:check` (composite pins) · [`docs/handoff/08`](docs/handoff/08-status-what-doesnt-work.md) · `npx tsx scripts/deterministic-roundtrip.mjs` |

All of it is gated by **173 executable checks** (`npm run eval`) that run the real pipeline in a scratch copy — not mocks.

## What's actually here

| Path | What it is | Edit by hand? |
|---|---|---|
| `contracts/` | **The source of truth.** 51 component contracts — buttons through banners, form fields, chat messages, navigation, progress meters, switches. APIs mirror a shipping industry component library ([coverage map](docs/research/astryx-coverage.md)) on this system's own tokens. | ✅ This is where changes happen |
| `tokens/` | 282 DTCG design tokens: primitives → **brand modes** (accent ramp + control radius per brand) → semantic aliases → light/dark mode files. One pipeline compiles them to CSS custom properties *and* design-tool variable collections. Adding a brand touches ONLY this directory — eval-proven. | ✅ |
| `core/` | **The engine as a library** — schema, token corpus, both extraction proposers, and four emitters (`react`, `html`, `react-inline`, `figma-script`) behind a pluggable `Emitter` interface. Browser-importable, zero node globals; the CLI scripts are thin shells over it. | ✅ |
| `src/components/` | The generated React library — typed, accessible, CSF3 stories, publishable package build. | ❌ Generated, never edited |
| `figma-sync/` | Generated, transport-agnostic scripts that build the canvas library — plus the **Sync Runner** dev plugin (`plugin/`) that executes them from disk. A from-blank rebuild of the entire library ran this way and verified clean. | ❌ Generated (`plugin/`, `arrange.js` hand-maintained) |
| `parity/` | The three-way differ: classifies every difference between contract, code, and canvas as *ahead*, *behind*, or *mismatched* — with a proposed remedy. Plus the adherence judge and the brownfield `diagnose` referee. | ✅ |
| `extract/` | Brownfield extraction: code→contract (React/TSX, CSS Modules, Custom Elements Manifest) and design→contract (plugin dump + Figma REST) adapters, plus `computed/` — the real-browser capture floor. The static adapters always propose the API surface, and anatomy + token bindings when the styling method exposes them ([which is which](#what-the-static-path-does-and-does-not-give-you)); the computed floor is what produces browser-observed styling truth. Also the four pilot write-ups and the round-trip receipts. | ✅ |
| `catalog/` + `context/` | The compiled generation constraint (every API + every token + the governance rules) that an AI agent — or a human — can be held to, sharded to fit an agent's context window at any component count, plus the org rules and memory that feed it. | catalog ❌ · rules ✅ |
| `evals/` | 173 deterministic checks on the machinery itself: byte-identical regeneration against golden manifests, refusal of illegal contracts, detection of every claimed drift class, convergence after promotion, extraction round-trips. | ✅ |
| `conformance/` | The **CSS/DOM conformance fixture** — a synthetic library of labelled CSS constructs, mounted through the unmodified capture pipeline, whose expected disposition is declared IN ADVANCE. Every other instrument here derives its denominator from the same filter that decides carriage, so a channel the filter never opened scores 100%; this one does not, which is what makes the frontier *predictable* instead of discovered one library at a time. Generated matrix: [`conformance/EXPECTATIONS.md`](conformance/EXPECTATIONS.md). | ✅ |
| `playground/` | The public browser playground ([live](https://ds-contracts-playground.pages.dev)) — a Vite app importing `core/` unmodified. | ✅ |
| `dashboard/` | The **Contract Hub** — a local app visualizing the whole system: live component previews, per-prop binding maps across all three surfaces, token provenance, one-click parity runs, contract editing with regeneration, and the full docs. | ✅ |
| `docs/` | The working documents — start at [Getting Started](docs/00-getting-started.md). | ✅ |

## Working in this repository

*This section is for people who want to run or extend the reference implementation. To use the tool on your own library you do not need to clone anything — see [the journeys](#which-journey-are-you-on) above; they run on the published `@ds-contracts/cli`.*

Requires Node ≥ 20. (Two checks drive a real Chromium — one eval and the visual-parity instrument; if none is found on your machine, the error names the fix: `npx playwright install chromium`, or point `PLAYWRIGHT_CHROMIUM_PATH` at any Chrome/Chromium binary.)

```bash
npm install
npm run build        # tokens → schema → all 51 components, validated against the contracts
npm run dashboard    # the Contract Hub → http://localhost:5180
npm run storybook    # the generated component library
```

Prove the loop to yourself in two minutes:

```bash
npm run parity   # ① clean — code, canvas, and tokens all match the contracts
# ② edit any contract in contracts/ — add an enum value, change a token binding
npm run build && npm run parity
#    ③ the differ reports exactly what is now behind, and how to fix it
npm run eval     # ④ 173 checks that detection, refusal, and convergence still hold
npm run docs:check # ⑤ every number these docs quote, re-derived from the repo (seconds, no browser)
```

That honest red state in step ③ is the product. Most design-system tooling shows you the happy path; this one is built to tell you precisely when and where the surfaces have stopped agreeing. (Point a token binding at a token that doesn't exist and the *build itself* fails — the contract↔token integrity gate.)

## Bring your own design system

The model isn't specific to these components, React, or any tool — and you can test that claim on **your** library.

**Seven distinct libraries across eight rounds have now gone through this pipeline, and none of them was special-cased in the engine**: this repo's own CSS Modules library, Polaris (CSS Modules), Astryx (StyleX), MUI (Emotion runtime), Flowbite (Tailwind v4 utilities), Carbon (precompiled CSS with theme *class scopes*), and Altitude (Lit web components, **shadow DOM**) — five distinct styling methods. Carbon, the seventh round, was run deliberately as a **control case** for the generality claim: predict "config-only, zero engine changes," then count what it actually cost. The count was **one expression** in `extract/computed/capture.ts`, and it turned out to be a universal bug the other six had tolerated by accident, not a Carbon accommodation ([`examples/carbon/PROVENANCE.md`](examples/carbon/PROVENANCE.md)). Altitude, the eighth, is the honest counterexample: a shadow-DOM library **could not** be a config-only round, and what it cost was one engine file of *general* open-shadow-DOM reader rules — per-root CSSOM collection, host descent, `<slot>` splicing, shadow-walking state drivers — every one of them a no-op where there are no shadow roots, with byte-identity for the other seven proven by re-capture ([`examples/altitude/PROVENANCE.md`](examples/altitude/PROVENANCE.md)).

**→ [docs/21 — Bring Your Own Design System](docs/21-bring-your-own-design-system.md)** is the recipe those seven followed: the nine steps with real commands, the full capture-config reference, and — the honest core — the decision guide for the three things that still take craft (`classAllow`, `varPrefix`, axis-vs-state), each of which fails *silently* when answered wrong. It ends with a section naming where the recipe is genuinely harder than a guide can make it.

No clone required for the static path: the published CLI runs the same extraction in your own repo (`npx @ds-contracts/cli init`, then `npx @ds-contracts/cli extract`) — the [two journeys on the spec site](https://ds-contracts-spec.pages.dev/get-started/) walk both directions, and [`examples/ci/`](examples/ci/) carries the executed-verbatim CI recipes. From this repository, the same code path is:

```bash
npm run extract:code   # your components → schema-valid PROPOSED contracts (API surface always;
                       #   anatomy + token bindings when the styling method allows — see the table above)
npm run reconcile      # → the disagreement report: where your code and design libraries diverge
```

Code-side adapters ship for `react-tsx` (function components, forwardRef/memo, any props-type convention, defaults, `on*` events) with CSS Modules anatomy extraction, and `cem` (**any** library publishing a Custom Elements Manifest: Web Components, Lit, Shoelace-style systems — API surface only, since a manifest carries no styling). Design-side, a component imports from a figma.com URL (`npm run extract:figma:rest`) or a plugin dump. Adapters normalize into one shape, so everything downstream is framework-blind.

Field-tested against four systems this project doesn't own: **Shoelace** (58/58 components, reconciled against its community Figma kit — real kit rot found mechanically), **Mantine** (245 components, 1,691 props, <1s), **Eventz** (a complete brownfield pair: one team's real code library ⇄ its own hand-built design library), and **CBDS** (coexistence and in-place amend inside a foreign enterprise kit) — receipts in [`extract/pilots/`](extract/pilots/). The same unmodified pipeline was then run against **Carbon, Fluent 2, Spectrum, and Polaris** at pinned SHAs — the enterprise gauntlet ([`extract/pilots/ENTERPRISE-GAUNTLET.md`](extract/pilots/ENTERPRISE-GAUNTLET.md)) — which surfaced and then eliminated two silent-loss classes the pilots never hit. Extraction proposes and reports; unbound or raw values are always reported with nearest-token candidates, never invented. Full walkthrough: [docs/13 — Try It With Your Own System](docs/13-try-it-with-your-system.md).

## Toward a specification

The end state this project points at is a vendor-neutral, independently implementable **component contract specification** — doing for the component-API layer what the DTCG spec did for tokens — with this repository as its reference implementation and conformance suite.

That is a claim about the future, so it's held to the same standard as everything else: the **[roadmap](ROADMAP.md)** ([full version](docs/12-roadmap.md)) runs in four phases, each with a **falsifiable exit criterion** — from hardening the loop, through brownfield adoption, to a normative spec draft with a conformance kit, ending at the line that separates a format from a spec: *an implementation this repo's authors didn't write passes the conformance kit.* The schema groundwork — the concrete decisions weighed against A2UI, json-render, CEM, and native design-tool slot semantics, and the normative compatibility rules — is in [docs/08 — Composition & the Road to a Contributable Spec](docs/08-composition-and-spec.md).

## Documentation

**If you are new, read these three in this order:** [Getting Started](docs/00-getting-started.md) (the five-minute orientation) → [User Flows](docs/18-user-flows.md) (the loop as two people actually live it, every step tagged built or missing) → [Bring Your Own Design System](docs/21-bring-your-own-design-system.md) (the recipe, when you're ready to run it on your library).

1. [Getting Started — What, Why, and How](docs/00-getting-started.md) · the five-minute orientation, per-persona usage, and the workflow schematic
2. [The Bridge — Why This Exists](docs/00-the-bridge.md) · the narrative case
3. [Architecture & the Contract Model](docs/01-architecture.md) · generative-first, diagnostic-forever
4. [Contract Specification](docs/02-contract-spec.md) · every field, with examples
5. [Token Pipeline](docs/03-token-pipeline.md) · DTCG dialect, modes, zero-dependency build
6. [Code Generation](docs/04-code-generation.md) · what gets emitted, and how to add a component
7. [The Parity Loop](docs/06-parity-loop.md) · drift detection and the executed both-directions demo
8. [Validation — Claims, Evals, Evidence](docs/07-validation.md) · what's proven and how
9. [Composition & the Road to a Contributable Spec](docs/08-composition-and-spec.md)
10. [Advanced Components — the DataTable Round](docs/09-advanced-components.md) · compound, data-shaped components and the npm package build
11. [Honest Generation](docs/10-honest-generation.md) · the catalog, the deterministic judge, and the 100-vs-69 A/B result
12. [Brownfield Adoption](docs/11-brownfield-adoption.md) · connecting pre-existing design + code libraries — extraction, reconciliation, diagnostic-first
13. [Roadmap](docs/12-roadmap.md) · four phases toward a component contract spec, each with a falsifiable exit criterion
14. [Try It With Your Own System](docs/13-try-it-with-your-system.md) · extraction adapters, the design dump, and the disagreement report
15. [Questions & Objections](docs/14-questions-and-objections.md) · every hard question, asked the skeptic's way, answered with receipts
16. [The Engine Is a Library](docs/15-engine-as-library.md) · pure-function core, pluggable emitters, browser receipts
17. [The Sync Boundary](docs/16-sync-boundary.md) · what a contract carries, what it never will — deterministic core, bounded assist, named gaps
18. [Run the Gauntlet](docs/17-run-the-gauntlet.md) · the to-and-from sequence packaged for an outside tester — commands, expected outcomes, honest gaps
19. [User Flows](docs/18-user-flows.md) · the two disciplines' first hour and daily loop, every step tagged built-or-missing, plus the ranked gap list that drives the build order
20. [Bring Your Own Design System](docs/21-bring-your-own-design-system.md) · the nine-step recipe eight library rounds actually followed, the full capture-config reference, the decision guide for the parts that are still craft, and a troubleshooting table built from real failures
20. [Generality — general engine, or just these libraries?](docs/22-generality.md) · the evidence behind the recipe: the styling-architecture matrix, the cross-library fix record (a defect found via one library repairing another's bytes in the same commit), the adversarial engine audit, and the honest ledger of where the claim leaks
21. [Astryx Coverage Map](docs/research/astryx-coverage.md) · every component in a 93-component industry library: mirrored, gap-blocked, or behavior-bounded

## Honesty as a design principle

Not everything is expressible yet, and nothing here pretends otherwise:

- **Behavior is a declared boundary — drawn precisely.** Contracts own API, anatomy, tokens, semantics, and the *interaction surface*: declared events like `onToggle`, whose toggle + ARIA state are generated into code and whose presence the differ verifies. The canvas reflects events as description text — it cannot run behavior, and the docs say so. Everything richer (drag, typeahead, focus trapping) stays a hand-written layer by design, not omission.
- **Every absent component is attributed.** The coverage map accounts for an entire 93-component industry library: mirrored, blocked by a *named* schema gap, or behavior-bounded. Coverage has scaled with schema capability, not hand effort — each new schema feature has unlocked a cluster of components mechanically.
- **Degradation is named, never silent.** Canvas surfaces can't run CSS animations or bind SVG paint to variables, so generated canvas states document their limits; a Figma import on a plan without the variables API reports every unresolved binding by name with nearest-token candidates. Nothing is ever fabricated to look complete.

## Status

The model is validated end-to-end and running in public: generation into both surfaces, the parity loop executed in both directions with receipts, 173/173 evals, the schema and CLI published to the public npm registry (`@ds-contracts/schema`, `@ds-contracts/cli` — stranger-verified from a clean directory), a measured 100-vs-69 governed-generation result, bidirectional anatomy extraction with zero-mismatch round-trip receipts, four brownfield pilots plus an enterprise code gauntlet (Carbon, Fluent 2, Spectrum, Polaris) on systems this project doesn't own, a live enterprise Figma kit censused to 100.0% clean (1,618 sets), a standing pixel-level visual-parity instrument, in-place amend proven forensically on live files, and a launched browser playground running the same engine — with a companion Figma plugin bridging live selections into it. The reference design-tool integration lives behind a transport-agnostic script boundary (`docs/internal/`) — the contract format itself is tool-agnostic.

- **What has been proven, dated, with receipts:** [MILESTONES.md](MILESTONES.md)
- **Release history:** [CHANGELOG.md](CHANGELOG.md)
- **Where this goes next:** [ROADMAP.md](ROADMAP.md)

## Contributing & license

MIT-licensed ([LICENSE](LICENSE)). Contributions follow one norm above all: [no capability claim without an eval behind it](CONTRIBUTING.md). Skeptical? Good — start with [Questions & Objections](docs/14-questions-and-objections.md).
