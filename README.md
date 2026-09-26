<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
  <img alt="" src="docs/assets/logo-light.svg" width="96" height="58">
</picture>

# Design System Contracts

**Connect your component library in code and your design library in Figma through a shared, machine-readable contract.**

Start with a React library or a Figma library. Read its supported structure, properties, tokens and composition into a contract, then generate the other surface. When both exist, compare changes against their shared baseline and repair differences under your team's ownership policy.

**V1 focuses on React ↔ contracts ↔ Figma.** Lit and Web Components integration is paused for a planned V1.1 follow-up. The shared contract remains framework-neutral; advanced composition remains in the V1 scope.

**In active development; v1 is not complete.** The engines and local inspection tools can be evaluated today. The complete application journeys below are still being integrated and verified. [Current status, plan and success criteria →](docs/CURRENT.md)

![V1 workflows: React to contract to editable Figma; Figma to contract to reusable React; changes on either side through comparison, authorized repair and independent verification.](docs/assets/product-loop.svg)

**New here? [Start with your library: installation and the three user journeys](docs/USER-JOURNEYS.md).**

## What you should be able to do

| Start with | Intended workflow | Result to verify |
| --- | --- | --- |
| **A React library** | Observe the original components and their states → derive a contract → generate native Figma component sets. | Editable variants, properties, token bindings and composition that preserve the supported source semantics. |
| **A Figma library** | Read component sets, properties, variables and nested instances → derive a contract → generate a reusable code library. | Installable React components with usable content APIs, variants, tokens and explicitly supported behavior. |
| **Both libraries** | Compare fresh observations with the shared contract → resolve changes under an ownership policy → apply and verify repairs. | Supported changes carried in either direction; conflicts reported; repeating a verified operation makes no changes. |

These are the product's success criteria. Current coverage and unfinished work are listed in the [status report](docs/CURRENT.md#where-we-are).

## How it works without AI

**Read → describe → generate → verify.** Readers extract supported facts from source code or native Figma data. The contract records what each component means: its parts, layout, tokens, properties, content and references to other components. Deterministic generators use that contract to produce React code or editable Figma nodes. Independent checks then compare the actual result with the original.

The approach is a compiler built from reusable rules. A table can combine rows, cells, selection controls and menus through the same layout, property and composition rules used elsewhere. We test those rules, their interactions and previously unseen supported compositions; we cannot enumerate every possible component arrangement.

There are limits to what either input says. Arbitrary React logic cannot be recovered from a screenshot, and a drawn sort indicator does not specify a sorting algorithm. Existing code behavior must be preserved within a verified boundary; design-only behavior needs an explicit, supported implementation. Missing or unsupported information must be reported, never guessed. React-first does not mean every React syntax or styling system is supported.

AI may help explain a refusal or draft a proposal, but it is optional. **No AI is required in the conversion path.** The same accepted inputs and generator version must produce the same output. These are the architecture and acceptance rules; the complete application journeys remain unfinished.

## Built around composition

The scope includes **data tables, forms, menus, dialogs and other composed component sets**, alongside foundational controls. Small components are useful integration tests; the product's goal includes substantial design systems.

Contracts can describe nested component references, content slots and allowed children, variants, conditional parts and token bindings. The Figma integration must preserve the distinction between **content slots**, **instance-swap properties** and **nested component instances**. Each needs its own editable behavior and verification.

There is existing table and other composed-component implementation evidence in the repository. That does **not** establish automatic conversion of arbitrary tables or libraries. A complete composed-component journey is a required milestone before v1 qualification. See the [contract specification](docs/02-contract-spec.md) and [composition model](docs/08-composition-and-spec.md) for the existing vocabulary.

## What you can use today

- **Explore contracts and deterministic generation.** The local playground runs the checked-out engine. Supported contracts can produce code and native Figma writer programs.
- **Try React source import.** The code-import view accepts static TSX/CSS experiments and reports supported facts and limitations. It is not yet a general repository import or a verified React-to-Figma journey.
- **Inspect original React sources.** The local `/sources` workflow validates original styling and states, reads installed API facts, and delivers supported root or composed graphs to an authorized Figma file through the companion. Configure an existing workspace with installed dependencies through `DS_CONTRACTS_REACT_SOURCE_ROOT`; its optional `ds-contracts.react.json` declares cases and witnesses. The built-in shadcn preset still requires its separate, uncommitted sandbox. This is configured workspace intake, with named syntax, ownership and visual limits. The [source setup guide](source-reference/README.md) and [measured acceptance ledger](docs/CURRENT.md#v1-acceptance-evidence) describe what is required and demonstrated. Earlier Lit work remains in a collapsed V1.1 archive.
- **Download generated React from Figma imports.** The local app retains supported dependencies and offers **Prepare React library**. Its archive installs in a clean consumer; supply React, CSS Modules support and the design fonts. Packaging and fidelity are separate results, and some measured families still fail the visual limit.
- **Evaluate existing import and generation paths.** CLI and plugin workflows expose proposals and named limitations. They require setup and review; they do not yet deliver the full automatic journeys above.

**Still unfinished:** complete-family visual qualification, general repository onboarding and repair of arbitrary existing pairs. The app has recorded native comparisons and bounded update/recovery proofs; these do not qualify every component or channel. A matching screenshot, passing engine test or historical component demo does not establish those outcomes.

### Run locally

Requires npm and Node.js 20.19 or later on the 20.x line, or 22.12 or later. That is the range Vite 8.3.0 declares (`^20.19.0 || >=22.12.0`); earlier Node 20 releases are outside it and untested here. CI runs 20.19.4, and `.nvmrc` pins the same version.

```bash
npm ci
npm run prep:core
npx playwright-core install chromium
npm run playground
```

Use `npm ci`, as CI does: it installs exactly what `package-lock.json` records. `npm install` under npm 10.8.2 rewrites that tracked lockfile (it drops the `libc` fields); `git restore package-lock.json` discards the change.

`npm run prep:core` builds schema and core in the order required by the local server. The schema build alone is insufficient on a fresh clone: startup cannot resolve `@ds-contracts/core` until core is built.

Chromium is required for source validation, structure tracing and browser comparisons. The install command downloads the browser revision pinned by this checkout; static code import and contract exploration do not need it.

The app must run on port 5181: the port is strict, and the companion plugin's local connection is fixed to `http://localhost:5181`. If the port is busy, stop the other process. `npm run playground -- --port <n>` starts the app on another port for browsing, but the plugin will not reach it.

Open [the local start guide](http://localhost:5181/start), then choose code import for a React experiment. Read `/system` for the current plan. The `/sources` presets require their configured local source libraries and dependencies; they do not yet provide an arbitrary repository picker. None of the steps above needs a Figma token. A live Figma import, the image comparison of the clean consumer check and the REST-based scripts do; see [what needs a Figma token](docs/USER-JOURNEYS.md#figma-token).

For other development commands, the cold-tree build step, worker setup and validation gates, see [CONTRIBUTING.md](CONTRIBUTING.md). For the existing contract-first walkthrough, see [Getting Started](docs/00-getting-started.md).

The [hosted playground](https://ds-contracts-playground.pages.dev) and [documentation site](https://ds-contracts-spec.pages.dev) may run a different revision. Published packages, the checked-out source and deployed demos have separate release lifecycles.

## How we measure progress

We measure completed user journeys, coverage and remaining refusals—not the number of tests or components minted during development.

Each milestone requires identifiable original inputs, actual target output, independent structural and visual checks, and explicit limits. Composition and editability matter alongside appearance. Supported behavior must be declared and tested; arbitrary application logic cannot be recovered from a picture.

The [public status report](docs/CURRENT.md) names the current milestone, what is demonstrated, what remains, and the evidence required to finish. Pull requests report the change in usability and update that report when the state changes. Detailed experiment logs and working notes stay out of this overview; reproducible fixtures and verification evidence remain with the code.

## Learn more

- [Current status, milestones and architecture](docs/CURRENT.md)
- [Contract specification](docs/02-contract-spec.md)
- [Composition and specification goals](docs/08-composition-and-spec.md)
- [Sync boundary](docs/16-sync-boundary.md)
- [Known limitations](docs/23-known-limitations.md) — scoped technical inventory; dated measurements are not overall product readiness.
- [Contributing](CONTRIBUTING.md)

## Open source

MIT-licensed, community-supported and intended as a vendor-neutral specification with a reference implementation. No proprietary tier. See [LICENSE](LICENSE).
