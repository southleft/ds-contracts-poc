# Design System Contracts — Spec draft v0.1

> **Current state (2026-08-30).** This directory is the **universal-contract**
> spec draft (schema 17, conformance kit). The v1 proof surface is
> recipe-IR in the reference repo (`docs/32-recipe-ir-pivot.md`); product
> v1 is incomplete (F1). This draft is not rewritten as recipe-IR.

**Status:** Draft (Phase 3 groundwork). Not yet a multi-vendor standard.  
**Implements against:** this repository's tooling and `@ds-contracts/schema`.  
**Normative companion:** [docs/02-contract-spec.md](../docs/02-contract-spec.md) (working prose) + emitted JSON Schema via `npm run schema`.

This directory separates the **format** from the **implementation** enough that a second party could begin an independent implementation. It is not yet the Phase 3 exit criterion (a foreign implementation passing the conformance kit).

## Documents

| File | Role |
|---|---|
| [README.md](./README.md) | This index + graduation path |
| [normative.md](./normative.md) | MUST/SHOULD rules for contracts, dispositions, and compatibility |
| [CHANNEL-TABLE.md](./CHANNEL-TABLE.md) + [channel-table.json](./channel-table.json) | Every CSS computed property classified once (CARRIED/LEDGERED/REFUSED/INERT); held by `npm run channel-table:check` |
| [conformance/README.md](./conformance/README.md) | How to run the conformance kit against *any* implementation |
| [conformance/subset-v0.1.json](./conformance/subset-v0.1.json) | **Frozen** minimal rule + fixture subset (Wave 11-A) |
| [conformance/harness.md](./conformance/harness.md) | Foreign-runner report shape (Wave 11-B) |
| [GRAMMAR-COVERAGE.md](./GRAMMAR-COVERAGE.md) | Every construct the **capture-config grammar** supports, and every construct a real library needs that it does not — with the library that proves each gap |
| [grammar-coverage.json](./grammar-coverage.json) | Machine-readable companion, held to the committed configs by `npm run grammar-coverage:check` |
| [DOOR-REGISTER.md](./DOOR-REGISTER.md) | Every subtractive/admitting capture heuristic — its premise, what it drops, and whether it leaves a receipt |
| [door-register.json](./door-register.json) | The same register, machine-readable and gated by `npm run door-register:check` |
| [LOWERING.md](./LOWERING.md) | Every CSS→Figma **lowering**: what shape a carried fact takes on the canvas, in what context, what the inverse returns, and the canonical form the two directions must agree on — including the `emit` stage the door register does not cover |
| [lowering.json](./lowering.json) | The same register, machine-readable and gated by `npm run lowering:check` |

## How a claim graduates (draft → normative)

| Stage | Meaning | Gate |
|---|---|---|
| **Draft** | Rules and fixtures exist in this tree | `npx tsx spec/conformance/check-subset.ts` |
| **Candidate** | A second implementation reports against `harness.md` (even partially) | Wave 11-C report under `.agents/runs/.../wave11/` |
| **Normative (1.0)** | Two independent implementations pass the frozen subset; silent-skip forbidden | Spec minor → 1.0.0; subset id bumps only for intentional expands |

Claims MUST NOT jump from Draft to Normative without a Candidate report that names gaps. Expanding `subset-v0.1.json` is a draft bump, not a silent widen of what “conforming” means.

## Non-goals (v0.1)

- Claiming pixel identity or lossless CSS↔canvas round trips
- Requiring adoption of this repository's CLI
- Normative Figma plugin distribution (desktop development plugin is an implementation choice)
- Inventing an in-tree second implementation as a rubber stamp

## Versioning

Spec draft versions are independent of CLI/schema package versions. Breaking normative changes bump the draft minor until 1.0.0; package schema versions continue to follow their own semver.
