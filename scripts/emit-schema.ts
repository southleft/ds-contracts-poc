/**
 * Emits contracts/contract.schema.json from the Zod schema so editors
 * validate contract files inline (via each contract's "$schema" field)
 * and non-TS tooling can consume the schema.
 */
import { writeFileSync } from 'node:fs';
import * as z from 'zod';
import { ContractSchema } from './contract-schema.js';

const jsonSchema = z.toJSONSchema(ContractSchema, { target: 'draft-7', io: 'input' });

writeFileSync('contracts/contract.schema.json', JSON.stringify(jsonSchema, null, 2) + '\n');
console.log('✔ contracts/contract.schema.json emitted from Zod schema');
