/**
 * Catalog emitter — `npm run catalog`.
 *
 * Compiles the contract set + tokens + org rules into ONE machine-readable
 * catalog (catalog/catalog.json): the artifact a generating surface reads
 * BEFORE it produces anything, and the artifact the adherence judge enforces
 * AGAINST. This is the A2UI/json-render move — catalog as generation
 * constraint — emitted from the same source of truth that generates both
 * component surfaces. Versioned by package version + git commit.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  slotsOf,
  sortByDependencies,
  type Contract,
  type Prop,
} from './contract-schema.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

// --- tokens: every legal CSS custom property, semantic set highlighted ---
function collectTokens(tree: Record<string, unknown>, prefix: string[] = [], out: string[] = []) {
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      if ('$value' in value) out.push([...prefix, key].join('-'));
      else collectTokens(value as Record<string, unknown>, [...prefix, key], out);
    }
  }
  return out;
}
const primitiveVars = collectTokens(read('tokens/primitives.tokens.json')).map((n) => `--${n}`);
const semanticVars = [
  ...collectTokens(read('tokens/semantic.tokens.json')),
  ...collectTokens(read('tokens/modes/semantic.light.tokens.json')),
].map((n) => `--${n}`);

// --- contracts ---
const contracts = sortByDependencies(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => ContractSchema.parse(read(path.join('contracts', f)))),
);
const byId = new Map(contracts.map((c) => [c.id, c]));

const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;

function catalogProps(contract: Contract) {
  return contract.props
    .filter((p) => p.bindings.code.prop !== 'children')
    .map((p) => ({
      name: p.bindings.code.prop,
      type: isEnum(p) ? p.type.enum : p.type === 'boolean' ? 'boolean' : 'string',
      ...(p.default !== undefined ? { default: p.default } : {}),
      ...(p.required ? { required: true } : {}),
      ...(p.description ? { description: p.description } : {}),
    }));
}

function catalogChildren(contract: Contract) {
  const textChildren = contract.props.find(
    (p) => p.type === 'text' && p.bindings.code.prop === 'children',
  );
  if (textChildren) {
    return { kind: 'text', description: textChildren.description ?? 'Text content.' };
  }
  const defaultSlot = slotsOf(contract).find((s) => s.slot.name === 'children');
  if (defaultSlot) {
    return {
      kind: 'slot',
      accepts: (defaultSlot.slot.accepts ?? []).map((id) => byId.get(id)!.name),
      acceptsMode: defaultSlot.slot.acceptsMode ?? (defaultSlot.slot.accepts?.length ? 'prefer' : 'open'),
      ...(defaultSlot.part.description ? { description: defaultSlot.part.description } : {}),
    };
  }
  // Layout primitives etc.: no declared children handling → open slot.
  const hasParts = Boolean(contract.anatomy.root.parts);
  return hasParts
    ? { kind: 'none' }
    : { kind: 'slot', accepts: [], acceptsMode: 'open', description: 'Any catalog content.' };
}

function catalogNamedSlots(contract: Contract) {
  return slotsOf(contract)
    .filter((s) => s.slot.name !== 'children')
    .map((s) => ({
      prop: s.slot.name,
      accepts: (s.slot.accepts ?? []).map((id) => byId.get(id)!.name),
      acceptsMode: s.slot.acceptsMode ?? (s.slot.accepts?.length ? 'prefer' : 'open'),
      optional: Boolean(s.part.optional),
      ...(s.part.description ? { description: s.part.description } : {}),
    }));
}

const gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
const pkg = read('package.json');
const rules = read('context/rules.json');

const catalog = {
  system: {
    name: 'DS Contracts POC',
    catalogVersion: pkg.version,
    gitCommit,
    source: 'Compiled from contracts/*.contract.json + tokens/ + context/rules.json — do not edit.',
  },
  package: {
    name: pkg.name,
    usage: `import { Button, Card, Table } from '${pkg.name}'; import '${pkg.name}/styles.css';`,
    stylesheet: `${pkg.name}/styles.css`,
  },
  rules: rules.rules,
  tokens: {
    guidance: 'Screens should not need tokens directly — styling flows through components. Where a token is unavoidable, use var(--…) with a name from this list, preferring semantic names.',
    semanticCssVariables: semanticVars,
    allCssVariables: [...primitiveVars, ...semanticVars],
  },
  components: contracts.map((c) => ({
    id: c.id,
    name: c.name,
    version: c.version,
    status: c.status,
    description: c.description,
    figma: c.figmaRepresentation === 'native'
      ? { representation: 'native' }
      : { representation: 'component', componentSetKey: c.anchors.figma.componentSetKey },
    props: catalogProps(c),
    children: catalogChildren(c),
    slots: catalogNamedSlots(c),
  })),
};

mkdirSync(path.join(ROOT, 'catalog'), { recursive: true });
writeFileSync(path.join(ROOT, 'catalog', 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(
  `✔ Catalog emitted: ${catalog.components.length} components, ${catalog.tokens.allCssVariables.length} tokens, ${catalog.rules.length} rules (v${pkg.version} @ ${gitCommit})`,
);
