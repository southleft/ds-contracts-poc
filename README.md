<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
  <img alt="" src="docs/assets/logo-light.svg" width="96" height="58">
</picture>

# Design System Contracts

**Connect your component library in code and your design library in Figma through a shared, machine-readable contract.**

Start with either library. Describe its supported structure, properties, tokens and composition in a contract, then generate the other surface. When both exist, compare changes against their shared baseline and repair differences under your team's ownership policy.

**In active development; v1 is not complete.** The engines and local inspection tools can be evaluated today. The complete application journeys below are still being integrated and verified. [Current status, plan and success criteria →](docs/CURRENT.md)

![Three intended workflows: code to contract to editable Figma; Figma to contract to reusable code; changes on either side through comparison, authorized repair and independent verification.](docs/assets/product-loop.svg)

## What you should be able to do

| Start with | Intended workflow | Result to verify |
| --- | --- | --- |
| **A code library** | Observe the original components and their states → derive a contract → generate native Figma component sets. | Editable variants, properties, token bindings and composition that preserve the supported source semantics. |
| **A Figma library** | Read component sets, properties, variables and nested instances → derive a contract → generate a reusable code library. | Installable React components with usable content APIs, variants, tokens and explicitly supported behavior. |
| **Both libraries** | Compare fresh observations with the shared contract → resolve changes under an ownership policy → apply and verify repairs. | Supported changes carried in either direction; conflicts reported; repeating a verified operation makes no changes. |

These are the product's success criteria. Current coverage and unfinished work are listed in the [status report](docs/CURRENT.md#where-we-are).

## Built around composition

The scope includes **data tables, forms, menus, dialogs and other composed component sets**, alongside foundational controls. Small components are useful integration tests; the product's goal includes substantial design systems.

Contracts can describe nested component references, content slots and allowed children, variants, conditional parts and token bindings. The Figma integration must preserve the distinction between **content slots**, **instance-swap properties** and **nested component instances**. Each needs its own editable behavior and verification.

There is existing table and other composed-component implementation evidence in the repository. That does **not** establish automatic conversion of arbitrary tables or libraries. A complete composed-component journey is a required milestone before v1 qualification. See the [contract specification](docs/02-contract-spec.md) and [composition model](docs/08-composition-and-spec.md) for the existing vocabulary.

## What you can use today

- **Explore contracts and deterministic generation.** The local playground runs the checked-out engine. Supported contracts can produce code and native Figma writer programs.
- **Inspect original source evidence.** The local `/sources` workflow captures and checks a configured source library, including styling, source identity and bounded API/content observations. Its current source candidate remains unaccepted.
- **Evaluate existing import and generation paths.** CLI and plugin workflows expose proposals and named limitations. They require setup and review; they do not yet deliver the full automatic journeys above.

**Still unfinished:** application-driven code-to-Figma conversion with independent native verification, a qualified design-only reusable-library journey, and reliable two-way repair with recovery and rollback. A matching screenshot, passing engine test or historical component demo does not establish those outcomes.

### Run locally

Requires Node.js 20 or later and npm.

```bash
npm install
npm run prep:schema
npm run playground
```

Open [the local playground](http://localhost:5181). Read `/system` for the current plan; `/sources` requires the configured local source library and its dependencies. Source capture is a local workflow.

For other development commands, worker setup and validation gates, see [CONTRIBUTING.md](CONTRIBUTING.md). For the existing contract-first walkthrough, see [Getting Started](docs/00-getting-started.md).

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
