/**
 * The diagnostic loop — three-way parity check.
 *
 * Diffs each live surface against the CONTRACT (never side-to-side):
 *   code   ⟷ contract   (React source parsed by parity/extract-code.ts)
 *   figma  ⟷ contract   (snapshots in parity/snapshots/, refreshed by running
 *                        parity/extract-figma.plugin.js in the Figma file)
 *   figma variables ⟷ tokens/ (the token half of the contract)
 *
 * Classification:
 *   *-ahead   — the surface has something the contract doesn't → PROPOSE a
 *               contract/token patch (the promotion flow; a human reviews it)
 *   *-behind  — the contract has something the surface doesn't → REGENERATE
 *               that surface (npm run generate / figma-sync scripts)
 *   mismatch  — both define it, values disagree → contract is canonical;
 *               adopt (patch contract) or enforce (regenerate surface)
 *
 * Exit code 1 when drift exists (CI-able). Full report at parity/report.json.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  componentRefsOf,
  slotFigmaProperty,
  slotVisibilityProperty,
  slotsOf,
  type Contract,
  type Prop,
} from '../scripts/contract-schema.js';
import { extractCode, type CodeExtract } from './extract-code.js';

const ROOT = process.cwd();

interface Finding {
  surface: 'code' | 'figma' | 'figma-tokens';
  classification: 'ahead' | 'behind' | 'mismatch';
  subject: string;
  detail: string;
  proposedPatch?: unknown;
  remedy: string;
}

const findings: Finding[] = [];
const add = (f: Finding) => findings.push(f);

const isEnum = (p: Prop): p is Prop & { type: { enum: string[] } } =>
  typeof p.type === 'object' && 'enum' in p.type;
const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Load inputs
// ---------------------------------------------------------------------------

const contracts: Contract[] = readdirSync(path.join(ROOT, 'contracts'))
  .filter((f) => f.endsWith('.contract.json'))
  .map((f) => ContractSchema.parse(JSON.parse(readFileSync(path.join(ROOT, 'contracts', f), 'utf8'))));

const code: CodeExtract[] = extractCode(ROOT);

interface FigmaPropertyDef {
  type: string;
  defaultValue: unknown;
  variantOptions: string[] | null;
  preferredValues?: Array<{ type: string; key: string }> | null;
}
interface FigmaSet {
  name: string;
  nodeId: string;
  key: string;
  variantCount: number;
  properties: Record<string, FigmaPropertyDef>;
  nestedInstances?: string[];
}
const figmaComponents: { sets: FigmaSet[] } = JSON.parse(
  readFileSync(path.join(ROOT, 'parity', 'snapshots', 'figma-components.json'), 'utf8'),
);
interface FigmaVariable {
  name: string;
  type: string;
  values: Record<string, unknown>;
}
const figmaTokens: { collections: Array<{ name: string; variables: FigmaVariable[] }> } =
  JSON.parse(readFileSync(path.join(ROOT, 'parity', 'snapshots', 'figma-tokens.json'), 'utf8'));

// ---------------------------------------------------------------------------
// 1 · code ⟷ contract
// ---------------------------------------------------------------------------

for (const contract of contracts) {
  const extracted = code.find((c) => c.component === contract.name);
  if (!extracted) {
    add({
      surface: 'code',
      classification: 'behind',
      subject: contract.name,
      detail: 'Component missing from src/components',
      remedy: 'npm run generate',
    });
    continue;
  }

  const contractCodeProps = contract.props.filter((p) => p.type !== 'text');

  // Named text props (title) and named slots (actions) must exist in code —
  // presence-only checks (their TS types are string / ReactNode).
  for (const expected of [
    ...contract.props
      .filter((p) => p.type === 'text' && p.bindings.code.prop !== 'children')
      .map((p) => ({ name: p.bindings.code.prop, kind: 'text prop' })),
    ...slotsOf(contract)
      .filter((s) => s.slot.name !== 'children')
      .map((s) => ({ name: s.slot.name, kind: 'slot prop' })),
    // v6: declared events are contract API — a missing callback is code BEHIND.
    ...(contract.events ?? []).map((e) => ({ name: e.bindings.code.prop, kind: 'event callback' })),
  ]) {
    if (!extracted.props.some((cp) => cp.name === expected.name)) {
      add({
        surface: 'code',
        classification: 'behind',
        subject: `${contract.name}.${expected.name}`,
        detail: `Contract ${expected.kind} "${expected.name}" missing from ${contract.name}Props`,
        remedy: 'npm run generate',
      });
    }
  }

  for (const p of contractCodeProps) {
    const codeName = p.bindings.code.prop;
    const found = extracted.props.find((cp) => cp.name === codeName);
    if (!found) {
      add({
        surface: 'code',
        classification: 'behind',
        subject: `${contract.name}.${codeName}`,
        detail: `Contract prop "${p.name}" missing from ${contract.name}Props`,
        remedy: 'npm run generate',
      });
      continue;
    }
    if (isEnum(p)) {
      const want = p.type.enum.join('|');
      const got = (found.values ?? []).join('|');
      if (want !== got) {
        add({
          surface: 'code',
          classification: 'mismatch',
          subject: `${contract.name}.${codeName}`,
          detail: `Enum values differ — contract: [${want}], code: [${got}]`,
          remedy: 'Adopt into contract (promotion) or npm run generate to enforce',
        });
      }
    }
    // Kind drift: a prop whose TYPE changed in code (enum→string,
    // boolean→enum) previously passed as long as the name existed.
    const expectedKind = isEnum(p) ? 'enum' : p.type === 'boolean' ? 'boolean' : null;
    if (expectedKind && found.kind !== expectedKind && found.kind !== 'other') {
      add({
        surface: 'code',
        classification: 'mismatch',
        subject: `${contract.name}.${codeName} (type)`,
        detail: `Prop type differs — contract: ${expectedKind}, code: ${found.kind}`,
        remedy: 'Adopt into contract (promotion) or npm run generate to enforce',
      });
    }
    // Default drift including ONE-SIDED deletion: a default removed from
    // code is drift (the generated classname silently loses its styling),
    // not a pass. Event-toggled props are exempt — their default lives in
    // the uncontrolled useState, which extraction cannot see.
    const isToggled = (contract.events ?? []).some((e) => e.toggles?.prop === p.name);
    if (!isToggled && String(p.default ?? '') !== String(found.default ?? '')) {
      add({
        surface: 'code',
        classification: 'mismatch',
        subject: `${contract.name}.${codeName} (default)`,
        detail: `Default differs — contract: ${JSON.stringify(p.default)}, code: ${JSON.stringify(found.default)}`,
        remedy: 'Adopt into contract (promotion) or npm run generate to enforce',
      });
    }
  }

  const contractPropNames = new Set([
    ...contractCodeProps.map((p) => p.bindings.code.prop),
    ...contract.props.filter((p) => p.type === 'text').map((p) => p.bindings.code.prop),
    ...slotsOf(contract).map((s) => s.slot.name),
    ...(contract.events ?? []).map((e) => e.bindings.code.prop),
  ]);
  for (const cp of extracted.props) {
    if (contractPropNames.has(cp.name)) continue;
    // Code declares a prop the contract doesn't know — code is AHEAD.
    const patch: Record<string, unknown> = {
      name: cp.name,
      type: cp.kind === 'enum' ? { enum: cp.values } : cp.kind,
      ...(cp.default !== undefined ? { default: cp.default } : {}),
      bindings: {
        figma: {
          kind: cp.kind === 'enum' ? 'VARIANT' : cp.kind === 'boolean' ? 'BOOLEAN' : 'TEXT',
          property: pascal(cp.name),
          ...(cp.kind === 'enum'
            ? { values: Object.fromEntries((cp.values ?? []).map((v) => [v, pascal(v)])) }
            : {}),
        },
        code: { prop: cp.name },
      },
    };
    add({
      surface: 'code',
      classification: 'ahead',
      subject: `${contract.name}.${cp.name}`,
      detail: `Code declares prop "${cp.name}" (${cp.kind}) that the contract does not define`,
      proposedPatch: patch,
      remedy: `Review + append to contracts/${contract.id.replace(/^[^.]+\./, '')}.contract.json props[], bump version, then npm run build && npm run figma:plan`,
    });
  }
}

// ---------------------------------------------------------------------------
// 2 · figma ⟷ contract
// ---------------------------------------------------------------------------

const normalizeFigmaProps = (set: FigmaSet) => {
  const map = new Map<string, FigmaPropertyDef>();
  for (const [key, def] of Object.entries(set.properties)) {
    map.set(key.split('#')[0], def);
  }
  return map;
};

for (const contract of contracts) {
  if (contract.figmaRepresentation === 'native') continue; // no Figma component expected
  const anchorKey = contract.anchors.figma.componentSetKey;
  const set =
    figmaComponents.sets.find((s) => anchorKey && s.key === anchorKey) ??
    figmaComponents.sets.find((s) => s.name === contract.name);
  if (!set) {
    add({
      surface: 'figma',
      classification: 'behind',
      subject: contract.name,
      detail: 'Component set missing from Figma file',
      remedy: 'Run figma-sync scripts (npm run figma:plan, execute in Figma)',
    });
    continue;
  }

  const figmaProps = normalizeFigmaProps(set);
  const expectedNames = new Set<string>();

  for (const p of contract.props) {
    const propertyName = p.bindings.figma.property;
    expectedNames.add(propertyName);
    const def = figmaProps.get(propertyName);
    if (!def) {
      add({
        surface: 'figma',
        classification: 'behind',
        subject: `${contract.name}.${propertyName}`,
        detail: `Contract prop "${p.name}" has no ${p.bindings.figma.kind} property on the Figma set`,
        remedy: 'Add the property to the existing set via a scripted edit — sync scripts are currently CREATE-only and skip existing components (see docs/internal/figma-sync.md)',
      });
      continue;
    }
    // Property KIND must match the binding (a designer converting a
    // boolean to a variant axis previously passed as "present").
    if (def.type !== p.bindings.figma.kind) {
      add({
        surface: 'figma',
        classification: 'mismatch',
        subject: `${contract.name}.${propertyName} (kind)`,
        detail: `Property kind differs — contract: ${p.bindings.figma.kind}, figma: ${def.type}`,
        remedy: 'Adopt into contract (promotion) or rebuild the property',
      });
    }
    // BOOLEAN/TEXT defaults were presence-only (red-team finding): flipping
    // every boolean default on the canvas passed "parity clean".
    if (!isEnum(p) && p.default !== undefined && def.defaultValue !== undefined) {
      const want = p.type === 'boolean' ? Boolean(p.default) : String(p.default);
      const got = p.type === 'boolean' ? Boolean(def.defaultValue) : String(def.defaultValue);
      if (want !== got) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${propertyName} (default)`,
          detail: `Default differs — contract: ${JSON.stringify(want)}, figma: ${JSON.stringify(got)}`,
          remedy: 'Adopt into contract (promotion) or reset the property default',
        });
      }
    }
    if (isEnum(p)) {
      const want = p.type.enum.map((v) => p.bindings.figma.values?.[v] ?? v);
      const got = def.variantOptions ?? [];
      // Order-insensitive: the canvas presents the default variant first;
      // option ORDER is presentation, not contract API.
      if ([...want].sort().join('|') !== [...got].sort().join('|')) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${propertyName}`,
          detail: `Variant options differ — contract: [${want.join(', ')}], figma: [${got.join(', ')}]`,
          remedy: 'Adopt into contract (promotion) or re-sync the set',
        });
      }
      const wantDefault =
        p.default !== undefined
          ? (p.bindings.figma.values?.[String(p.default)] ?? String(p.default))
          : undefined;
      if (wantDefault !== undefined && def.defaultValue !== wantDefault) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${propertyName} (default)`,
          detail: `Default variant differs — contract: ${wantDefault}, figma: ${String(def.defaultValue)} (Figma's default = first variant in the set)`,
          remedy: 'Reorder the set so the contract-default variant is first',
        });
      }
    }
  }

  // Slots: INSTANCE_SWAP property per slot; optional slots additionally get a
  // "Show X" BOOLEAN. `accepts` must round-trip as preferredValues whose keys
  // are the accepted contracts' componentSetKey anchors.
  const byIdAll = new Map(contracts.map((c) => [c.id, c]));
  for (const { slot, part } of slotsOf(contract)) {
    const propertyName = slotFigmaProperty(slot);
    // Multi-child slot (defaultContent > 1): inexpressible as INSTANCE_SWAP —
    // no property expected; instead the content components must exist as
    // nested instances. (Native SLOT property is the migration target.)
    if ((slot.defaultContent?.length ?? 0) > 1) {
      for (const id of new Set(slot.defaultContent!.map((i) => i.id))) {
        const dep = byIdAll.get(id)!;
        if (!(set.nestedInstances ?? []).includes(dep.name)) {
          add({
            surface: 'figma',
            classification: 'behind',
            subject: `${contract.name}.${dep.name}`,
            detail: `Multi-child slot "${slot.name}" declares ${id} default content but no ${dep.name} instance exists inside the Figma component`,
            remedy: 'Re-run the component sync script',
          });
        }
      }
      continue;
    }
    expectedNames.add(propertyName);
    const def = figmaProps.get(propertyName);
    if (!def) {
      add({
        surface: 'figma',
        classification: 'behind',
        subject: `${contract.name}.${propertyName}`,
        detail: `Contract slot "${slot.name}" has no INSTANCE_SWAP property on the Figma component`,
        remedy: 'Re-run the component sync script',
      });
    } else if (slot.accepts && slot.accepts.length > 0) {
      const expectedKeys = slot.accepts
        .map((id) => byIdAll.get(id)?.anchors.figma.componentSetKey)
        .filter((k): k is string => Boolean(k))
        .sort();
      const gotKeys = (def.preferredValues ?? []).map((p) => p.key).sort();
      if (expectedKeys.length > 0 && expectedKeys.join('|') !== gotKeys.join('|')) {
        add({
          surface: 'figma',
          classification: 'mismatch',
          subject: `${contract.name}.${propertyName} (accepts)`,
          detail: `Slot accepts [${slot.accepts.join(', ')}] but Figma preferredValues keys differ`,
          remedy: 'Adopt into contract (promotion) or re-sync preferredValues',
        });
      }
    }
    if (part.optional) {
      const visibilityName = slotVisibilityProperty(slot);
      expectedNames.add(visibilityName);
      if (!figmaProps.get(visibilityName)) {
        add({
          surface: 'figma',
          classification: 'behind',
          subject: `${contract.name}.${visibilityName}`,
          detail: `Optional slot "${slot.name}" has no visibility BOOLEAN on the Figma component`,
          remedy: 'Re-run the component sync script',
        });
      }
    }
  }

  // Nested component refs: the composing instance must exist in Figma.
  for (const { ref } of componentRefsOf(contract)) {
    const dep = byIdAll.get(ref.id)!;
    if (!(set.nestedInstances ?? []).includes(dep.name)) {
      add({
        surface: 'figma',
        classification: 'behind',
        subject: `${contract.name}.${dep.name}`,
        detail: `Contract composes ${ref.id} but no ${dep.name} instance exists inside the Figma component`,
        remedy: 'Re-run the component sync script',
      });
    }
  }

  for (const [name, def] of figmaProps) {
    if (expectedNames.has(name)) continue;
    add({
      surface: 'figma',
      classification: 'ahead',
      subject: `${contract.name}.${name}`,
      detail: `Figma set declares ${def.type} property "${name}" the contract does not define`,
      proposedPatch: {
        name: name.toLowerCase(),
        type: def.type === 'BOOLEAN' ? 'boolean' : def.type === 'TEXT' ? 'text' : { enum: def.variantOptions },
        bindings: { figma: { kind: def.type, property: name }, code: { prop: name.toLowerCase() } },
      },
      remedy: `Review + append to the contract props[], bump version, then npm run build`,
    });
  }
}

// ---------------------------------------------------------------------------
// 3 · figma variables ⟷ tokens/
// ---------------------------------------------------------------------------

type TokenLeaf = { value: unknown };
function flatten(tree: Record<string, unknown>, prefix: string[] = [], out = new Map<string, unknown>()) {
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      if ('$value' in value) out.set([...prefix, key].join('/'), (value as TokenLeaf & { $value: unknown }).$value);
      else flatten(value as Record<string, unknown>, [...prefix, key], out);
    }
  }
  return out;
}
const readTokens = (p: string) => flatten(JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')));

const primitives = readTokens('tokens/primitives.tokens.json');
const semantic = readTokens('tokens/semantic.tokens.json');
const light = readTokens('tokens/modes/semantic.light.tokens.json');
const dark = readTokens('tokens/modes/semantic.dark.tokens.json');

/** Normalize a token value for comparison against the Figma snapshot. */
function norm(v: unknown): string {
  if (typeof v === 'string') {
    const alias = v.match(/^\{([^}]+)\}$/);
    if (alias) return `{${alias[1].split('.').join('/')}}`; // dot → slash paths
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
    const px = v.match(/^(-?[\d.]+)px$/);
    if (px) return px[1];
    return v;
  }
  return String(v);
}

const figmaVarsByCollection = new Map<string, Map<string, FigmaVariable>>();
for (const col of figmaTokens.collections) {
  figmaVarsByCollection.set(col.name, new Map(col.variables.map((v) => [v.name, v])));
}

function checkTokens(
  collection: string,
  expected: Array<{ path: string; perMode: Record<string, unknown> }>,
) {
  const figmaVars = figmaVarsByCollection.get(collection) ?? new Map<string, FigmaVariable>();
  const expectedPaths = new Set<string>();
  for (const { path: tokenPath, perMode } of expected) {
    expectedPaths.add(tokenPath);
    const v = figmaVars.get(tokenPath);
    if (!v) {
      add({
        surface: 'figma-tokens',
        classification: 'behind',
        subject: `${collection}/${tokenPath}`,
        detail: 'Token exists in tokens/ but has no Figma variable',
        remedy: 'Re-run figma-sync token script (or figma_import_tokens ≥1.34 with creation support)',
      });
      continue;
    }
    for (const [mode, want] of Object.entries(perMode)) {
      const got = v.values[mode];
      if (norm(want) !== norm(got)) {
        add({
          surface: 'figma-tokens',
          classification: 'mismatch',
          subject: `${collection}/${tokenPath} [${mode}]`,
          detail: `tokens/ says ${norm(want)}, Figma says ${norm(got)}`,
          proposedPatch: { tokenPath: tokenPath.split('/').join('.'), mode, adoptFigmaValue: got },
          remedy: 'Adopt into tokens/ (promotion) then npm run tokens — or push tokens/ to Figma via figma_import_tokens',
        });
      }
    }
  }
  for (const name of figmaVars.keys()) {
    if (!expectedPaths.has(name)) {
      add({
        surface: 'figma-tokens',
        classification: 'ahead',
        subject: `${collection}/${name}`,
        detail: 'Figma variable has no counterpart in tokens/',
        remedy: 'Review + add to tokens/ (promotion) or delete the variable',
      });
    }
  }
}

checkTokens(
  'Primitives',
  [...primitives].map(([p, v]) => ({ path: p, perMode: { Value: v } })),
);
// Brand collection: one mode per tokens/modes/brand.*.tokens.json file.
const brandFiles = readdirSync(path.join(ROOT, 'tokens', 'modes'))
  .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
  .sort();
const brandModeMaps = brandFiles.map((f) => ({
  mode: f.replace(/^brand\.|\.tokens\.json$/g, '').replace(/^./, (c) => c.toUpperCase()),
  tokens: readTokens(`tokens/modes/${f}`),
}));
if (brandModeMaps.length > 0) {
  const first = brandModeMaps[0].tokens;
  checkTokens(
    'Brand',
    [...first.keys()].map((p) => ({
      path: p,
      perMode: Object.fromEntries(brandModeMaps.map(({ mode, tokens }) => [mode, tokens.get(p)])),
    })),
  );
}
checkTokens('Semantic', [
  ...[...semantic].map(([p, v]) => ({ path: p, perMode: { Light: v, Dark: v } })),
  ...[...light].map(([p, v]) => ({ path: p, perMode: { Light: v, Dark: dark.get(p) } })),
]);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

writeFileSync(
  path.join(ROOT, 'parity', 'report.json'),
  JSON.stringify({ findings, checkedContracts: contracts.map((c) => `${c.id}@${c.version}`) }, null, 2) + '\n',
);

if (findings.length === 0) {
  console.log('✔ Parity clean — code, Figma, and tokens all match the contract.');
  process.exit(0);
}

console.log(`✖ ${findings.length} drift finding(s):\n`);
for (const f of findings) {
  console.log(`  [${f.surface} ${f.classification.toUpperCase()}] ${f.subject}`);
  console.log(`    ${f.detail}`);
  if (f.proposedPatch) console.log(`    proposed patch: ${JSON.stringify(f.proposedPatch)}`);
  console.log(`    → ${f.remedy}\n`);
}
process.exit(1);
