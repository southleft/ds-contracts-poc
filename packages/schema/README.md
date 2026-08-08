# @ds-contracts/schema

The ds-contracts component contract schema, as a package:

- **The Zod document** (`src/contract-schema.ts`) — the single live schema (spec v16) that validates every contract, types the generators, and emits the JSON Schema. The reference repo's `scripts/contract-schema.ts` is a re-export shim over this source, so repo and package cannot drift.
- **`contract.schema.json`** — the generated JSON Schema (draft-7), emitted from the same Zod document at build time; byte-identical to the repo's `contracts/contract.schema.json`.
- **`validateContract` / `validateContractSet`** — the schema-level referee: named Zod issues, duplicate id/name identity gates, and the composition graph (unknown refs, cycles). The *deep* referee — anatomy rules, token substitution, icon assets — needs the token inventory and icon set, so it lives with the emitters (`core/emit-react.ts`).

```ts
import { ContractSchema, validateContract, validateContractSet } from '@ds-contracts/schema';

const result = validateContract(JSON.parse(text));
if (!result.ok) console.error(result.errors.join('\n'));
```

Versioning: the package major tracks the spec version (`16.x.y` = spec v16).

## Release status

This source tree stages `@ds-contracts/schema@16.1.0-rc.2`. It is source-only
until a release owner publishes it. The npm registry check on 2026-08-04
reported `16.0.0` as `latest`; installing without an exact version therefore
installs `16.0.0`, not this RC.

After publication, test the prerelease with an exact version. The RC must be
published under the `next` tag so it does not move `latest`:

```sh
npm install @ds-contracts/schema@16.1.0-rc.2
```

See the repository [release process](../../docs/27-release-process.md) for
schema byte checks, pack verification, publication approvals, and rollback.
