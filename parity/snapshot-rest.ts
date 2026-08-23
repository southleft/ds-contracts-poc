/**
 * REST RE-SNAPSHOT of the first-party catalog — the read-only twin of
 * parity/extract-figma.plugin.js for the SET-LEVEL facts the differ and the
 * brownfield referee read: set identity (name / nodeId / key / description),
 * variant count, every component property definition, nested instances, and
 * the `ds_contracts/contractId` stamp.
 *
 *   npm run parity:snapshot:rest                    # re-snapshot the file the committed snapshot names
 *   npm run parity:snapshot:rest -- <fileKey>       # another file
 *   npm run parity:snapshot:rest -- --check         # fetch + compare, write nothing (exit 1 if the canvas moved)
 *
 * Why it exists (docs/23 §D.32): `npm run diagnose` refuses a design snapshot
 * older than MAX_SNAPSHOT_AGE_DAYS (14), and the only documented refresh was a
 * human pasting the plugin script into the live file. That is not a verb CI or
 * an acceptance row can run. This is: one GET on the Figma REST API with the
 * FIGMA_TOKEN from .env.local (never printed, never written into the output).
 *
 * WHAT IT DOES NOT CARRY — named, not implied:
 *   · variant fingerprints (`variants[].fingerprint / live / liveSnapshot`)
 *     and the set-level `setFingerprint…` transport. Those are RECOMPUTED by
 *     the plugin from the live node tree with the plugin API's variable-name
 *     map; the REST tree is a different shape and a recomputation here would
 *     be a private twin of core/canvas-fingerprint.ts. The output therefore
 *     has NO `snapshotVersion` and NO `variants` — parity/snapshot-schema.ts
 *     parses it as the legacy-unversioned shape, and parity/diff.ts reports
 *     the variant surface NOT EXTRACTED exactly as it did for the plugin
 *     snapshot this replaces (whose variants were unstamped too).
 *   · `slotContent` — native-slot children; plugin-only walk. Absent means
 *     NOT CAPTURED, never "no violation".
 *   · `collections` (figma-tokens.json) — the variables endpoint is an
 *     Enterprise-plan surface this token cannot read (extract/figma/rest/
 *     fetch.ts classifies the refusal). Tokens stay a plugin snapshot.
 *
 * Every set it writes is compared against the committed snapshot first and
 * what moved is printed BY NAME (identity, counts, property definitions), so
 * a refresh that silently swaps a canvas under the contracts cannot happen.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { figmaToken } from '../extract/fidelity-matrix/scripts/env.js';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const SNAPSHOT = path.join(ROOT, 'parity', 'snapshots', 'figma-components.json');
const API = 'https://api.figma.com';

interface RestDef {
  type: string;
  defaultValue: unknown;
  variantOptions?: string[];
  preferredValues?: Array<{ type: string; key: string }>;
}
interface RestNode {
  id: string;
  name: string;
  type: string;
  children?: RestNode[];
  componentId?: string;
  componentPropertyDefinitions?: Record<string, RestDef>;
  sharedPluginData?: Record<string, Record<string, string>>;
}
interface RestFile {
  name: string;
  lastModified: string;
  version: string;
  document: RestNode;
  components: Record<string, { key: string; name: string; description: string; componentSetId?: string }>;
  componentSets: Record<string, { key: string; name: string; description: string }>;
}
interface SnapshotSet {
  name: string;
  nodeId: string;
  key: string;
  description: string;
  variantCount: number;
  properties: Record<
    string,
    { type: string; defaultValue: unknown; variantOptions: string[] | null; preferredValues: Array<{ type: string; key: string }> | null }
  >;
  nestedInstances: string[];
  contractId: string | null;
}
interface Snapshot {
  fileName: string;
  fileKey: string | null;
  sets: SnapshotSet[];
  extractedAt: number;
  extractedBy?: string;
  fileLastModified?: string;
  fileVersion?: string;
}

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const positional = args.filter((a) => !a.startsWith('--'));

const committed: Snapshot | null = existsSync(SNAPSHOT) ? (JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Snapshot) : null;
const fileKey = positional[0] ?? committed?.fileKey ?? null;
if (!fileKey) {
  console.error('no file key: pass one, or commit a snapshot that names its fileKey');
  process.exit(2);
}

/** The plugin's set discovery, over the REST tree: every COMPONENT_SET, every
 *  COMPONENT that is not a variant of one, never the `Slot` utility. */
function collectSets(doc: RestNode): RestNode[] {
  const out: RestNode[] = [];
  const walk = (n: RestNode, inSet: boolean): void => {
    if (n.type === 'COMPONENT_SET' || (n.type === 'COMPONENT' && !inSet)) {
      if (n.name !== 'Slot') out.push(n);
    }
    for (const c of n.children ?? []) walk(c, inSet || n.type === 'COMPONENT_SET');
  };
  walk(doc, false);
  return out;
}

function toSet(file: RestFile, node: RestNode): SnapshotSet {
  const meta = file.componentSets[node.id] ?? file.components[node.id];
  if (!meta) throw new Error(`${node.name} (${node.id}): no components/componentSets metadata in the REST response — cannot write a set without its key`);
  const properties: SnapshotSet['properties'] = {};
  for (const [key, def] of Object.entries(node.componentPropertyDefinitions ?? {})) {
    properties[key] = {
      type: def.type,
      defaultValue: def.defaultValue,
      variantOptions: def.variantOptions ?? null,
      preferredValues: def.preferredValues ?? null,
    };
  }
  // Nested instances: every variant's subtree, deduplicated by OWNER (the set
  // a nested main component belongs to, else the component itself) — the v4
  // rule the plugin applies.
  const probes = node.type === 'COMPONENT_SET' ? (node.children ?? []) : [node];
  const nestedInstances: string[] = [];
  const visit = (n: RestNode): void => {
    if (n.type === 'INSTANCE' && n.componentId) {
      const main = file.components[n.componentId];
      if (main) {
        const owner = main.componentSetId ? (file.componentSets[main.componentSetId]?.name ?? main.name) : main.name;
        if (!nestedInstances.includes(owner)) nestedInstances.push(owner);
      }
    }
    for (const c of n.children ?? []) visit(c);
  };
  for (const p of probes) for (const c of p.children ?? []) visit(c);
  return {
    name: node.name,
    nodeId: node.id,
    key: meta.key,
    description: meta.description ?? '',
    variantCount: node.type === 'COMPONENT_SET' ? (node.children ?? []).length : 1,
    properties,
    nestedInstances,
    contractId: node.sharedPluginData?.ds_contracts?.contractId || null,
  };
}

/** What moved between the committed snapshot and the live file, by name. */
function compare(prev: Snapshot, next: Snapshot): string[] {
  const moved: string[] = [];
  const prevBy = new Map(prev.sets.map((s) => [s.name, s]));
  const nextBy = new Map(next.sets.map((s) => [s.name, s]));
  for (const s of next.sets) {
    const o = prevBy.get(s.name);
    if (!o) {
      moved.push(`${s.name}: NEW on the canvas (${s.variantCount} variants)`);
      continue;
    }
    if (o.key !== s.key) moved.push(`${s.name}: key ${o.key} → ${s.key}`);
    if (o.nodeId !== s.nodeId) moved.push(`${s.name}: nodeId ${o.nodeId} → ${s.nodeId}`);
    if ((o.description ?? '') !== s.description) moved.push(`${s.name}: description changed`);
    if (o.variantCount !== s.variantCount) moved.push(`${s.name}: variantCount ${o.variantCount} → ${s.variantCount}`);
    const ok = Object.keys(o.properties).sort();
    const nk = Object.keys(s.properties).sort();
    if (ok.join('|') !== nk.join('|')) {
      moved.push(`${s.name}: properties [${ok.join(', ')}] → [${nk.join(', ')}]`);
    } else {
      for (const k of ok) {
        const a = o.properties[k];
        const b = s.properties[k];
        if (a.type !== b.type) moved.push(`${s.name}.${k}: type ${a.type} → ${b.type}`);
        if (String(a.defaultValue) !== String(b.defaultValue)) moved.push(`${s.name}.${k}: default ${String(a.defaultValue)} → ${String(b.defaultValue)}`);
        if (JSON.stringify(a.variantOptions) !== JSON.stringify(b.variantOptions)) {
          moved.push(`${s.name}.${k}: options ${JSON.stringify(a.variantOptions)} → ${JSON.stringify(b.variantOptions)}`);
        }
      }
    }
    const on = [...(o.nestedInstances ?? [])].sort().join('|');
    const nn = [...s.nestedInstances].sort().join('|');
    if (on !== nn) moved.push(`${s.name}: nestedInstances [${on.replaceAll('|', ', ')}] → [${nn.replaceAll('|', ', ')}]`);
  }
  for (const o of prev.sets) if (!nextBy.has(o.name)) moved.push(`${o.name}: GONE from the canvas`);
  return moved;
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const res = await fetch(`${API}/v1/files/${fileKey}?plugin_data=shared`, { headers: { 'X-Figma-Token': figmaToken() } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Figma API ${res.status} on /v1/files/${fileKey}${body ? ` — ${body.slice(0, 200)}` : ''}`);
  }
  const file = (await res.json()) as RestFile;
  const sets = collectSets(file.document).map((n) => toSet(file, n));
  const next: Snapshot = {
    fileName: file.name,
    fileKey: fileKey!,
    sets,
    extractedAt: Date.now(),
    extractedBy:
      'parity/snapshot-rest.ts — Figma REST (read-only). Set identity, property definitions, nested instances and the contractId stamp are carried; variant fingerprints, slot content and variable collections are plugin-only and NOT carried (the differ reports them NOT EXTRACTED).',
    fileLastModified: file.lastModified,
    fileVersion: file.version,
  };
  console.log(`ℹ ${file.name} (${fileKey}): ${sets.length} set(s), last modified ${file.lastModified}, fetched in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const moved = committed && committed.fileKey === fileKey ? compare(committed, next) : null;
  if (moved === null) {
    console.log(`ℹ no committed snapshot of this file to compare against${committed ? ` (committed names ${committed.fileKey})` : ''}`);
  } else if (moved.length === 0) {
    console.log(`✔ canvas unchanged on every set-level fact the differ reads (${sets.length} sets) — only extractedAt moves`);
  } else {
    console.log(`⚠ canvas moved since the committed snapshot — ${moved.length} change(s):`);
    for (const m of moved) console.log(`  - ${m}`);
  }
  if (CHECK) {
    process.exit(moved && moved.length > 0 ? 1 : 0);
  }
  writeFileSync(SNAPSHOT, JSON.stringify(next, null, 2) + '\n');
  console.log(`✔ wrote ${path.relative(ROOT, SNAPSHOT)} (extractedAt ${new Date(next.extractedAt).toISOString()})`);
}

await main();
