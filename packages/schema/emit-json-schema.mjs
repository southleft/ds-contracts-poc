/**
 * Emits contract.schema.json for the PACKAGE from the built Zod document —
 * the same derivation as the repo's scripts/emit-schema.ts (target draft-7,
 * io input), so the package copy and contracts/contract.schema.json are the
 * same bytes whenever both are freshly emitted from the same schema.
 */
import { writeFileSync } from 'node:fs';
import * as z from 'zod';
import { ContractSchema } from './dist/contract-schema.js';

const jsonSchema = z.toJSONSchema(ContractSchema, { target: 'draft-7', io: 'input' });
writeFileSync(
  new URL('./contract.schema.json', import.meta.url),
  JSON.stringify(jsonSchema, null, 2) + '\n',
);
console.log('✔ packages/schema/contract.schema.json emitted from the built Zod schema');
