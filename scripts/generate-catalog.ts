/**
 * Catalog emitter — `npm run catalog`.
 *
 * Compiles the contract set + tokens + org rules into a machine-readable
 * catalog: the artifact a generating surface reads BEFORE it produces
 * anything, and the artifact the adherence judge enforces AGAINST. This is
 * the A2UI/json-render move — catalog as generation constraint — emitted
 * from the same source of truth that generates both component surfaces.
 * Versioned by package version + git commit.
 *
 * Emits two equivalent forms:
 *   catalog/catalog.json          — the monolithic catalog (existing consumers:
 *                                   judge, dashboard). Unchanged shape.
 *   catalog/index.json            — compact retrieval index (self-describing
 *                                   via its `_protocol` field)
 *   catalog/components/<id>.json  — one full catalog entry per component
 *   catalog/tokens.json           — the token section alone
 * The sharded form keeps the catalog inside an agent's context window at any
 * component count: load the index, then fetch only the shards you use.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

// Top-level token group names (e.g. color, space, font) — enough for the
// routing index; full variable lists live in catalog/tokens.json.
const tokenGroups = [
  ...new Set(
    [
      'tokens/primitives.tokens.json',
      'tokens/semantic.tokens.json',
      'tokens/modes/semantic.light.tokens.json',
    ].flatMap((f) => Object.keys(read(f)).filter((k) => !k.startsWith('$'))),
  ),
].sort();

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

// Context beyond the rules: standing memory + reference files an agent may
// consult for judgment calls the deterministic rules don't cover.
let memory: string | null = null;
try {
  memory = readFileSync(path.join(ROOT, 'context', 'memory.md'), 'utf8');
} catch {
  /* optional */
}
let references: string[] = [];
try {
  references = readdirSync(path.join(ROOT, 'context', 'references')).filter((f) => !f.startsWith('.'));
} catch {
  /* optional */
}

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
  context: {
    memory,
    references,
    guidance:
      'Memory is standing intent; rules are the constitution (judge-enforced where deterministic); references are consultable files for judgment calls. Deterministic checks always win over interpretation.',
  },
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
    ...(c.events && c.events.length > 0
      ? {
          events: c.events.map((e) => ({
            prop: e.bindings.code.prop,
            type: '() => void',
            ...(e.description ? { description: e.description } : {}),
          })),
        }
      : {}),
    children: catalogChildren(c),
    slots: catalogNamedSlots(c),
  })),
};

// --- sharded (retrievable) form ---------------------------------------------
// The monolith stops fitting in an agent's context window as the system
// scales (~106K LLM tokens at 250 components). The sharded form keeps the
// always-loaded surface small: a routing index plus per-component shards
// fetched on demand.

/** Shard filename for a component id: namespace stripped, kebab-case. */
const shardName = (id: string) =>
  id.replace(/^[^.]+\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

const firstSentence = (text: string) => {
  const match = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (match ? match[0] : text).trim();
};

const index = {
  _protocol:
    'Retrieval protocol: load index.json always; fetch catalog/components/<x>.json (x = component id without the namespace prefix, e.g. ds.button → button.json) for each component you intend to use; fetch tokens.json when styling. catalog/catalog.json is the equivalent monolithic form — do not load it when the sharded form is available.',
  system: catalog.system,
  package: catalog.package,
  rules: catalog.rules,
  tokenGroups,
  components: catalog.components.map((c) => ({
    id: c.id,
    name: c.name,
    version: c.version,
    status: c.status,
    propNames: c.props.map((p) => p.name),
    summary: firstSentence(c.description),
  })),
};

const shardNames = catalog.components.map((c) => shardName(c.id));
if (new Set(shardNames).size !== shardNames.length) {
  throw new Error('Shard filename collision: two component ids map to the same shard file.');
}

const write = (rel: string, data: unknown) =>
  writeFileSync(path.join(ROOT, 'catalog', rel), JSON.stringify(data, null, 2) + '\n');

mkdirSync(path.join(ROOT, 'catalog'), { recursive: true });
// Rebuild the shard directory from scratch so removed components leave no stale shards.
rmSync(path.join(ROOT, 'catalog', 'components'), { recursive: true, force: true });
mkdirSync(path.join(ROOT, 'catalog', 'components'), { recursive: true });

write('catalog.json', catalog);
write('index.json', index);
write('tokens.json', catalog.tokens);
for (const c of catalog.components) write(path.join('components', `${shardName(c.id)}.json`), c);

console.log(
  `✔ Catalog emitted: ${catalog.components.length} components, ${catalog.tokens.allCssVariables.length} tokens, ${catalog.rules.length} rules (v${pkg.version} @ ${gitCommit})`,
);
console.log(
  `✔ Shards emitted: catalog/index.json + ${catalog.components.length} component shards + catalog/tokens.json`,
);
