# @ds-contracts/schema

> **Not the v1 proof surface.** This package is the universal-contract
> schema (spec v17). Recipe-IR is a separate envelope under `recipe/` and
> is not published here. Product v1 is incomplete (F1). See the repo
> README and `docs/32-recipe-ir-pivot.md`.

The ds-contracts component contract schema, as a package:

- **The Zod document** (`src/contract-schema.ts`) — the single live schema (spec v17) that validates every contract, types the generators, and emits the JSON Schema. The reference repo's `scripts/contract-schema.ts` is a re-export shim over this source, so repo and package cannot drift.
- **`contract.schema.json`** — the generated JSON Schema (draft-7), emitted from the same Zod document at build time; byte-identical to the repo's `contracts/contract.schema.json`.
- **`validateContract` / `validateContractSet`** — the schema-level referee: named Zod issues, duplicate id/name identity gates, and the composition graph (unknown refs, cycles). The *deep* referee — anatomy rules, token substitution, icon assets — needs the token inventory and icon set, so it lives with the emitters (`core/emit-react.ts`).

- **`migrateDocumentToV17`** — the v16 → v17 codemod (`figmaRepresentation` / `figmaStatePreviews` / `anchors.*` / `slot.figmaProperty` → `bindings.<surface>.*`), operating on any parsed JSON value that embeds contracts, in key order. The CLI's `ds-contracts migrate` is a file walker over it.

```ts
import { ContractSchema, validateContract, validateContractSet, migrateDocumentToV17 } from '@ds-contracts/schema';

const result = validateContract(JSON.parse(text));
if (!result.ok) console.error(result.errors.join('\n'));
// a v16 document is refused BY NAME ("figmaStatePreviews was renamed in schema 17 — spell it bindings.figma.statePreviews …");
const { doc, rewrites } = migrateDocumentToV17(JSON.parse(text));
```

Versioning: the package major tracks the spec version (`17.x.y` = spec v17). 17.0.0 is a BREAKING rename — see the CHANGELOG entry and docs/02 § Bindings.

## Release status

This source tree stages `@ds-contracts/schema@17.0.0-rc.1`. It is source-only
until a release owner publishes it. The npm registry check on 2026-08-04
reported `16.0.0` as `latest`; installing without an exact version therefore
installs `16.0.0`, not this RC.

After publication, test the prerelease with an exact version. The RC must be
published under the `next` tag so it does not move `latest`:

```sh
npm install @ds-contracts/schema@17.0.0-rc.1
```

See the repository [release process](../../docs/27-release-process.md) for
schema byte checks, pack verification, publication approvals, and rollback.
