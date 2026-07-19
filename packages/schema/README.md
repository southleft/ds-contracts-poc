# @ds-contracts/schema

The ds-contracts component contract schema, as a package:

- **The Zod document** (`src/contract-schema.ts`) — the single live schema (spec v15) that validates every contract, types the generators, and emits the JSON Schema. The reference repo's `scripts/contract-schema.ts` is a re-export shim over this source, so repo and package cannot drift.
- **`contract.schema.json`** — the generated JSON Schema (draft-7), emitted from the same Zod document at build time; byte-identical to the repo's `contracts/contract.schema.json`.
- **`validateContract` / `validateContractSet`** — the schema-level referee: named Zod issues, duplicate id/name identity gates, and the composition graph (unknown refs, cycles). The *deep* referee — anatomy rules, token substitution, icon assets — needs the token inventory and icon set, so it lives with the emitters (`core/emit-react.ts`).

```ts
import { ContractSchema, validateContract, validateContractSet } from '@ds-contracts/schema';

const result = validateContract(JSON.parse(text));
if (!result.ok) console.error(result.errors.join('\n'));
```

Versioning: the package major tracks the spec version (`15.x.y` = spec v15).

Not yet published to npm — the `ds-contracts` org registration is pending.
