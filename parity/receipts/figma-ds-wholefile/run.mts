/**
 * FIGMA DESIGN SYSTEM whole-file Path A — Figma library → contracts → React.
 *
 *   npx tsx parity/receipts/figma-ds-wholefile/run.mts
 *
 * Needs FIGMA_TOKEN. Writes SCORECARD.md + out/.
 * Icons counted, not inverted. Cover / docs / studio / harness out of scope.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, tokenInventoryFromJson, type Contract } from '../../../core/index.js';
import {
  asMinimalChildContract,
  proposeFromDump,
  type FigmaProposalResult,
  type MinimalChildContract,
} from '../../../core/propose-figma.js';
import { capturedTokensFromDump } from '../../../core/captured-tokens.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';
import { generateCss, generateTsx } from '../../../core/emit-react.js';
import { fetchNodes, fetchVariables } from '../../../extract/figma/rest/fetch.js';
import { mapRestToDump, type RestNode, type RestNodesResponse } from '../../../extract/figma/rest/map.js';
import type { DumpFile, DumpSet } from '../../../extract/figma/types.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(HERE, 'out');
const FILE_KEY = 'aekVseUceg35tVn62knRrj';
const FILE_URL = `https://www.figma.com/design/${FILE_KEY}/Figma-Design-System`;

type Tier = 'atom' | 'molecule' | 'layout' | 'organism' | 'template' | 'icon';

const PAGES: Array<{ id: string; name: string; tier: Tier }> = [
  { id: '91:4852', name: 'Badge', tier: 'atom' },
  { id: '53:2584', name: 'Button', tier: 'atom' },
  { id: '53:4126', name: 'Chip', tier: 'atom' },
  { id: '53:4128', name: 'Dek', tier: 'atom' },
  { id: '53:4127', name: 'Heading', tier: 'atom' },
  { id: '53:4604', name: 'Image', tier: 'atom' },
  { id: '53:4129', name: 'Kicker', tier: 'atom' },
  { id: '53:2549', name: 'Button Group', tier: 'molecule' },
  { id: '53:4692', name: 'Section Header', tier: 'molecule' },
  { id: '53:4964', name: 'Section Footer', tier: 'molecule' },
  { id: '86:1894', name: 'Toast', tier: 'molecule' },
  { id: '53:1365', name: 'Card', tier: 'layout' },
  { id: '53:403', name: 'Section', tier: 'layout' },
  { id: '54:5882', name: 'Card Grid', tier: 'organism' },
  { id: '94:5288', name: 'Toast Group', tier: 'organism' },
  { id: '71:11827', name: 'Frontpage', tier: 'template' },
  { id: '53:3352', name: 'Icons', tier: 'icon' },
];

type Row = {
  set: string;
  tier: Tier;
  page: string;
  proposed: boolean;
  schemaOk: boolean;
  generated: boolean;
  notes: number;
  noteClasses: string[];
  schemaErrors: string[];
  generateErrors: string[];
  proposeError?: string;
  contractId?: string;
};

function figmaToken(): string {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  for (const p of [path.resolve(ROOT, '.env.local'), path.resolve(ROOT, '.env')]) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^FIGMA_TOKEN\s*=\s*"?([^"\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  }
  throw new Error('FIGMA_TOKEN not found (.env / .env.local / env)');
}

const noteClass = (note: string): string => {
  const m = note.match(/^([A-Z][A-Z0-9_-]{2,})/);
  if (m) return m[1];
  if (/MINTED/i.test(note)) return 'MINTED';
  if (/stub/i.test(note)) return 'STUB';
  if (/inconsistent/i.test(note)) return 'INCONSISTENT-BINDING';
  if (/refused/i.test(note)) return 'REFUSED';
  if (/not a token/i.test(note)) return 'UNBOUND-LITERAL';
  if (/defaulted/i.test(note)) return 'DEFAULTED';
  return 'NOTE';
};

const walk = (
  node: RestNode | undefined,
  parentType: string | undefined,
  into: {
    sets: Array<{ id: string; name: string; variants: number }>;
    standalone: number;
    setNodes: RestNode[];
    standaloneNodes: RestNode[];
  },
): void => {
  if (!node) return;
  if (node.type === 'COMPONENT_SET') {
    into.sets.push({
      id: node.id,
      name: node.name,
      variants: (node.children ?? []).filter((c) => c.type === 'COMPONENT').length,
    });
    into.setNodes.push(node);
    return;
  }
  if (node.type === 'COMPONENT' && parentType !== 'COMPONENT_SET') {
    into.standalone += 1;
    into.standaloneNodes.push(node);
  }
  for (const child of node.children ?? []) walk(child, node.type, into);
};

const chunk = <T,>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

const mergeTree = (dst: Record<string, unknown>, src: Record<string, unknown>): void => {
  for (const [k, v] of Object.entries(src)) {
    if (v !== null && typeof v === 'object' && !('$value' in (v as object))) {
      dst[k] = dst[k] ?? {};
      mergeTree(dst[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else dst[k] = v;
  }
};

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const token = figmaToken();
  const started = new Date().toISOString();

  let variables: Awaited<ReturnType<typeof fetchVariables>> = undefined;
  try {
    variables = await fetchVariables(FILE_KEY, token);
  } catch (e) {
    console.error(`variables: ${e instanceof Error ? e.message : e}`);
  }

  const census: Array<{
    page: string;
    tier: Tier;
    sets: Array<{ id: string; name: string; variants: number }>;
    standalone: number;
    fetchError?: string;
  }> = [];
  const mergedDump: DumpFile = {
    _provenance: {
      fileKey: FILE_KEY,
      extractedAt: started,
      note: 'Whole-file REST dump of library pages. Icon glyphs counted, not inverted.',
    },
  };
  const degradations: string[] = [];
  const pageBySet = new Map<string, { page: string; tier: Tier }>();
  const dumpCache = path.join(OUT, 'merged-dump.json');
  const censusCache = path.join(OUT, 'census.json');

  if (existsSync(dumpCache) && existsSync(censusCache)) {
    console.log('reusing out/merged-dump.json (delete to refetch)');
    const cached = JSON.parse(readFileSync(dumpCache, 'utf8')) as DumpFile;
    Object.assign(mergedDump, cached);
    const cachedCensus = JSON.parse(readFileSync(censusCache, 'utf8')) as { census: typeof census };
    if (Array.isArray(cachedCensus.census)) census.push(...cachedCensus.census);
    for (const c of census) {
      for (const s of c.sets) pageBySet.set(s.name, { page: c.page, tier: c.tier });
    }
  } else {
    for (const batch of chunk(PAGES, 2)) {
      const ids = batch.map((p) => p.id);
      console.log(`fetch ${ids.length} pages: ${batch.map((p) => p.name).join(', ')}`);
      let nodes: RestNodesResponse;
      try {
        nodes = await fetchNodes(FILE_KEY, ids, token);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        for (const p of batch) census.push({ page: p.name, tier: p.tier, sets: [], standalone: 0, fetchError: msg });
        continue;
      }
      for (const p of batch) {
        const entry = nodes.nodes?.[p.id];
        const found = {
          sets: [] as Array<{ id: string; name: string; variants: number }>,
          standalone: 0,
          setNodes: [] as RestNode[],
          standaloneNodes: [] as RestNode[],
        };
        walk(entry?.document, undefined, found);
        for (const s of found.sets) pageBySet.set(s.name, { page: p.name, tier: p.tier });
        census.push({
          page: p.name,
          tier: p.tier,
          sets: found.sets,
          standalone: found.standalone,
        });
        const invert = p.tier === 'icon' ? found.setNodes : [...found.setNodes, ...found.standaloneNodes];
        if (invert.length === 0) continue;
        const synthesized: RestNodesResponse = {
          name: nodes.name,
          nodes: Object.fromEntries(
            invert.map((s) => [
              s.id,
              {
                document: s,
                components: entry?.components,
                componentSets: entry?.componentSets,
                styles: entry?.styles,
              },
            ]),
          ),
        };
        const mapped = mapRestToDump(synthesized, {
          fileKey: FILE_KEY,
          ...(variables ? { variables } : {}),
        });
        for (const d of mapped.report.degradations) {
          degradations.push(`[${d.code}] ${d.nodePath}${d.field ? ` ${d.field}` : ''}: ${d.message}`);
        }
        for (const [name, set] of Object.entries(mapped.dump)) {
          if (name.startsWith('_')) continue;
          mergedDump[name] = set;
          if (!pageBySet.has(name)) pageBySet.set(name, { page: p.name, tier: p.tier });
        }
      }
    }
    writeFileSync(dumpCache, `${JSON.stringify(mergedDump)}\n`);
  }

  const setNames = Object.keys(mergedDump).filter((k) => !k.startsWith('_'));
  console.log(`dump sets: ${setNames.length}`);

  let capturedTree: Record<string, unknown> = {};
  try {
    const captured = capturedTokensFromDump(mergedDump as unknown as Record<string, unknown>);
    capturedTree = (captured?.tree ?? {}) as Record<string, unknown>;
  } catch (e) {
    console.error(`capturedTokensFromDump failed: ${e instanceof Error ? e.message : e}`);
  }
  let corpus;
  try {
    corpus = tokenCorpusFromJson({
      primitives: capturedTree,
      semantic: {},
      light: {},
      brandDefault: {},
    });
  } catch (e) {
    console.error(`tokenCorpusFromJson failed: ${e instanceof Error ? e.message : e}`);
    corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
  }

  const contracts = new Map<string, Record<string, unknown>>();
  const contractIdByName = new Map<string, string>();
  const contractIdByKey = new Map<string, string>();
  const contractsById = new Map<string, MinimalChildContract>();
  const sessionClaimedIds = new Set<string>();
  const mintedTree: Record<string, unknown> = {};
  const rows: Row[] = [];

  const register = (c: Record<string, unknown>, isStub = false): void => {
    if (typeof c.id !== 'string' || typeof c.name !== 'string') return;
    if (isStub && contracts.has(c.id)) return;
    contractIdByName.set(c.name, c.id);
    contractsById.set(c.id, asMinimalChildContract(c));
    const key = (c.bindings as { figma?: { anchors?: { componentSetKey?: string } } } | undefined)?.figma?.anchors?.componentSetKey;
    if (typeof key === 'string' && key.length > 0) contractIdByKey.set(key, c.id);
    sessionClaimedIds.add(c.id);
    contracts.set(c.id, c);
  };

  const order = [...setNames].sort((a, b) => {
    const ta = pageBySet.get(a)?.tier ?? 'organism';
    const tb = pageBySet.get(b)?.tier ?? 'organism';
    const rank: Record<Tier, number> = { icon: 0, atom: 1, molecule: 2, layout: 3, organism: 4, template: 5 };
    return (rank[ta] ?? 9) - (rank[tb] ?? 9) || a.localeCompare(b);
  });

  const proposeOne = (setName: string): { proposal?: FigmaProposalResult; error?: string } => {
    try {
      return {
        proposal: proposeFromDump(mergedDump[setName] as DumpSet, {
          projectionMode: 'reviewable-inversion',
          corpus,
          contractIdByName,
          contractIdByKey,
          contractsById,
          sessionClaimedIds: new Set(sessionClaimedIds),
          fileKey: FILE_KEY,
          mintUnbound: true,
        }),
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  };

  // Pass 1 — register every set so pass 2 parents see sibling APIs.
  for (const setName of order) {
    const loc = pageBySet.get(setName) ?? { page: 'unknown', tier: 'organism' as Tier };
    if (loc.tier === 'icon') continue;
    const first = proposeOne(setName);
    if (first.proposal) {
      register(first.proposal.contract as Record<string, unknown>);
      for (const stub of first.proposal.childStubs ?? []) register(stub as Record<string, unknown>, true);
      if (first.proposal.mintedTokens) {
        mergeTree(mintedTree, first.proposal.mintedTokens.tree as Record<string, unknown>);
      }
    }
  }

  for (const setName of order) {
    const loc = pageBySet.get(setName) ?? { page: 'unknown', tier: 'organism' as Tier };
    if (loc.tier === 'icon') continue;
    const row: Row = {
      set: setName,
      tier: loc.tier,
      page: loc.page,
      proposed: false,
      schemaOk: false,
      generated: false,
      notes: 0,
      noteClasses: [],
      schemaErrors: [],
      generateErrors: [],
    };
    const { proposal, error } = proposeOne(setName);
    if (!proposal) {
      row.proposeError = error;
      rows.push(row);
      continue;
    }
    row.proposed = true;
    row.notes = (proposal.notes ?? []).length;
    row.noteClasses = [...new Set((proposal.notes ?? []).map(noteClass))];
    register(proposal.contract as Record<string, unknown>);
    for (const stub of proposal.childStubs ?? []) register(stub as Record<string, unknown>, true);
    const selfId = String((proposal.contract as { id?: unknown }).id ?? '');
    row.contractId = selfId;
    contracts.set(selfId, proposal.contract as Record<string, unknown>);
    if (proposal.mintedTokens) mergeTree(mintedTree, proposal.mintedTokens.tree as Record<string, unknown>);
    rows.push(row);
  }

  const inventory = tokenInventoryFromJson([capturedTree, mintedTree]);
  const byId = new Map<string, Contract>();
  for (const raw of contracts.values()) {
    const parsedOne = ContractSchema.safeParse(raw);
    if (parsedOne.success) byId.set(parsedOne.data.id, parsedOne.data);
  }
  for (const row of rows) {
    if (!row.contractId) continue;
    const raw = contracts.get(row.contractId);
    if (!raw) continue;
    const parsedOne = ContractSchema.safeParse(raw);
    if (!parsedOne.success) {
      row.schemaErrors = parsedOne.error.issues.slice(0, 8).map((i) => `${i.path.join('.')}: ${i.message}`);
      continue;
    }
    row.schemaOk = true;
  }
  const icons = new Map<string, string>();
  for (const row of rows) {
    if (!row.schemaOk || !row.contractId) continue;
    const contract = byId.get(row.contractId);
    if (!contract) continue;
    const cssErrors: string[] = [];
    try {
      const css = generateCss(contract, inventory, cssErrors);
      generateTsx(contract, byId, icons, css);
      row.generateErrors = cssErrors;
      row.generated = cssErrors.length === 0;
    } catch (e) {
      row.generateErrors = [e instanceof Error ? e.message : String(e)];
    }
  }

  const iconPage = census.find((c) => c.tier === 'icon');
  const totals = {
    pagesFetched: census.filter((c) => !c.fetchError).length,
    pagesFailed: census.filter((c) => c.fetchError).length,
    componentSets: census.reduce((n, c) => n + (c.tier === 'icon' ? 0 : c.sets.length), 0),
    iconGlyphs: iconPage?.standalone ?? 0,
    iconSets: iconPage?.sets.length ?? 0,
    proposed: rows.filter((r) => r.proposed).length,
    schemaOk: rows.filter((r) => r.schemaOk).length,
    generated: rows.filter((r) => r.generated).length,
    proposeThrew: rows.filter((r) => r.proposeError).length,
  };

  writeFileSync(
    path.join(OUT, 'census.json'),
    `${JSON.stringify({ started, fileKey: FILE_KEY, totals, census, rows }, null, 2)}\n`,
  );
  writeFileSync(path.join(OUT, 'degradations.json'), `${JSON.stringify(degradations, null, 2)}\n`);

  const byTier = (t: Tier) => rows.filter((r) => r.tier === t);
  const mdRow = (r: Row): string => {
    const status = r.generated
      ? 'generated'
      : r.schemaOk
        ? 'schema-ok, generate refused'
        : r.proposed
          ? 'proposed, schema refused'
          : r.proposeError
            ? 'propose threw'
            : 'not proposed';
    return `| ${r.set.replace(/\|/g, '/')} | ${r.tier} | ${r.notes} | ${status} | ${(r.noteClasses.slice(0, 4).join(', ') || '—').replace(/\|/g, '/')} |`;
  };

  const failedPages = census.filter((c) => c.fetchError);
  const scorecard = `# Figma Design System whole-file Path A — ${started.slice(0, 10)}

File: [Figma Design System](${FILE_URL}) (\`${FILE_KEY}\`).
Transport: Figma REST → dump → \`proposeFromDump\` two-pass (\`reviewable-inversion\`, \`mintUnbound\`) → \`generateCss\` / \`generateTsx\`.
This is an inversion of a hand-built kit, not a round trip of sets this tool drew.

## Verdict

| | n |
|---|---|
| Library pages fetched | ${totals.pagesFetched} (${totals.pagesFailed} failed) |
| COMPONENT_SETs on those pages (icons excluded) | **${totals.componentSets}** |
| Icon glyphs counted, not inverted | ${totals.iconGlyphs} standalone + ${totals.iconSets} sets |
| Proposed | **${totals.proposed}** |
| Schema-valid | **${totals.schemaOk}** |
| Generated React + CSS | **${totals.generated}** |
| Propose threw | ${totals.proposeThrew} |

## By tier

| tier | proposed | schema-ok | generated |
|---|---:|---:|---:|
| atom | ${byTier('atom').filter((r) => r.proposed).length} | ${byTier('atom').filter((r) => r.schemaOk).length} | ${byTier('atom').filter((r) => r.generated).length} |
| molecule | ${byTier('molecule').filter((r) => r.proposed).length} | ${byTier('molecule').filter((r) => r.schemaOk).length} | ${byTier('molecule').filter((r) => r.generated).length} |
| layout | ${byTier('layout').filter((r) => r.proposed).length} | ${byTier('layout').filter((r) => r.schemaOk).length} | ${byTier('layout').filter((r) => r.generated).length} |
| organism | ${byTier('organism').filter((r) => r.proposed).length} | ${byTier('organism').filter((r) => r.schemaOk).length} | ${byTier('organism').filter((r) => r.generated).length} |
| template | ${byTier('template').filter((r) => r.proposed).length} | ${byTier('template').filter((r) => r.schemaOk).length} | ${byTier('template').filter((r) => r.generated).length} |

## Named omissions

- **Icons page** — counted, not inverted.
- **Cover / Documentation / Token System / Studio / Deliverables / Branding / harness** — out of scope.
- **Adopt-in-place** — this run does not stamp the hand-built sets as contract-backed.
- **Geometry / font walls** — not opened.

${
  failedPages.length
    ? `## Fetch failures\n\n${failedPages.map((p) => `- ${p.page}: ${p.fetchError}`).join('\n')}\n`
    : ''
}

## Hills climbed on this run

- **grid-hug-flex-axis** — Section Header / Footer hug + \`{fr}\` no longer aborts the whole set. Hug is dropped with a named note; the fraction stands.
- **string-boolean-coercion** — leftover \`"true"\`/\`"false"\` spellings coerce at propose and at emit.

## REST degradations

${degradations.length} named mapping notes (see \`out/degradations.json\`). First fetch of this file named **1300** \`variable-unresolved\` notes (PAT cannot read \`/variables/local\`). Cached re-runs do not re-count them. First 12:

${degradations.slice(0, 12).map((d) => `- ${d}`).join('\n') || '- none'}

## Sets

| set | tier | notes | status | note classes |
|---|---|---:|---|---|
${rows.map(mdRow).join('\n')}

## Generate refusals

${
  rows
    .filter((r) => r.generateErrors.length || r.schemaErrors.length || r.proposeError)
    .map((r) => {
      const bits = [...r.schemaErrors, ...r.generateErrors, r.proposeError].filter(Boolean);
      return `### ${r.set}\n\n${bits.map((b) => `- ${b}`).join('\n')}`;
    })
    .join('\n\n') || '_Every proposed set generated._'
}
`;

  writeFileSync(path.join(HERE, 'SCORECARD.md'), scorecard);
  console.log(scorecard.split('\n').slice(0, 45).join('\n'));
  console.log(`\n✔ wrote ${path.join(HERE, 'SCORECARD.md')} (${rows.length} sets)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
