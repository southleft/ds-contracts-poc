/**
 * Caption-vs-contract consistency receipt — `tsx playground/scripts/caption-check.ts`.
 *
 * The Examples gallery captions state FACTS about their contracts, and one
 * shipped wrong (the Badge card said "four variant classes" over a
 * five-variant contract). Countable claims are now DERIVED in
 * playground/src/engine/examples.ts; this check pins the derivation sites
 * against the real contracts and refuses reintroduced hardcoded counts:
 *
 *   1. every `contractId` names a contract that exists in contracts/
 *   2. every `enumValuesOf('<id>', '<prop>')` derivation resolves to a
 *      non-empty enum on that contract (a renamed prop would otherwise
 *      silently render "zero variant classes")
 *   3. every `contractsById.get('<id>')?.states` derivation resolves to a
 *      non-empty states list
 *   4. no caption/blurb hardcodes a count word in front of the countable
 *      nouns again ("five variants" belongs to the contract, not the copy)
 *
 * The module itself is vite-only at runtime (?raw imports) — this receipt
 * reads the source as text, same discipline as canvas-box-check.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EXAMPLES = path.join(ROOT, 'playground', 'src', 'engine', 'examples.ts');
const CONTRACTS_DIR = path.join(ROOT, 'contracts');

interface ContractFacts {
  id: string;
  enums: Map<string, string[]>;
  states: string[];
}

const contracts = new Map<string, ContractFacts>();
for (const file of readdirSync(CONTRACTS_DIR)) {
  if (!file.endsWith('.contract.json')) continue;
  const raw = JSON.parse(readFileSync(path.join(CONTRACTS_DIR, file), 'utf8')) as {
    id?: string;
    props?: Array<{ name: string; type?: unknown }>;
    states?: string[];
  };
  if (typeof raw.id !== 'string') continue;
  const enums = new Map<string, string[]>();
  for (const prop of raw.props ?? []) {
    const type = prop.type as { enum?: string[] } | string | undefined;
    if (type && typeof type === 'object' && Array.isArray(type.enum)) enums.set(prop.name, type.enum);
  }
  contracts.set(raw.id, { id: raw.id, enums, states: raw.states ?? [] });
}

const source = readFileSync(EXAMPLES, 'utf8');
const failures: string[] = [];
const receipts: string[] = [];

// 1. contractId existence
const idRefs = [...source.matchAll(/contractId: '([^']+)'/g)].map((m) => m[1]);
for (const id of idRefs) {
  if (!contracts.has(id)) failures.push(`caption references contract "${id}" which does not exist in contracts/`);
}
receipts.push(`✔ ${idRefs.length} contractId references all resolve to shipping contracts`);

// 2. enum derivation sites
const enumRefs = [...source.matchAll(/enumValuesOf\('([^']+)', '([^']+)'\)/g)];
for (const [, id, prop] of enumRefs) {
  const facts = contracts.get(id);
  const values = facts?.enums.get(prop);
  if (!values || values.length === 0) {
    failures.push(
      `enumValuesOf('${id}', '${prop}') resolves to nothing — the derived caption would silently read "zero"`,
    );
  }
}
receipts.push(`✔ ${enumRefs.length} enum-derivation sites resolve to non-empty enums`);

// 3. states derivation sites
const stateRefs = [...source.matchAll(/contractsById\.get\('([^']+)'\)\?\.states/g)];
for (const [, id] of stateRefs) {
  const facts = contracts.get(id);
  if (!facts || facts.states.length === 0) {
    failures.push(`states derivation for "${id}" resolves to an empty list — the caption would name no states`);
  }
}
receipts.push(`✔ ${stateRefs.length} states-derivation sites resolve to non-empty state lists`);

// 4. no reintroduced hardcoded counts before countable nouns — scanned over
//    the caption/blurb STRING LITERALS only (comments may quote history)
const copyLiterals = [...source.matchAll(/(?:caption|blurb): (['"`])((?:\\.|(?!\1).)*)\1/g)].map(
  (m) => m[2],
);
let hardcodedCount = 0;
for (const literal of copyLiterals) {
  for (const m of literal.matchAll(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\b (variant|Figma variant|glyph|state preview)/gi,
  )) {
    hardcodedCount += 1;
    failures.push(`hardcoded count "${m[0]}" in a caption/blurb — derive it from the contract instead`);
  }
}
if (hardcodedCount === 0) {
  receipts.push(
    `✔ ${copyLiterals.length} caption/blurb literals carry no hardcoded count words before variant/glyph/state-preview claims`,
  );
}

for (const line of receipts) console.log(line);
if (failures.length > 0) {
  for (const f of failures) console.error(`✘ ${f}`);
  process.exit(1);
}
console.log('caption-consistency: all claims hold');
