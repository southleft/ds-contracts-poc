/**
 * EVENTZ WHOLE-FILE Path A — Figma library → contracts → React.
 *
 * Not the 7-set eventz-vars slice. Every COMPONENT_SET on the library and
 * section pages of DEMO Eventz Design System (E7oXr98i91HYQGZxA2USOQ).
 *
 *   npx tsx parity/receipts/eventz-wholefile/run.mts
 *
 * Needs FIGMA_TOKEN (.env or .env.local). Writes SCORECARD.md + out/.
 * Icon glyphs are COUNTED, not inverted — same named omission as the 2026
 * Eventz pilot. Eval/template/cover pages are counted as out-of-scope.
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
const OUT = path.join(HERE, 'out');
const FILE_KEY = 'E7oXr98i91HYQGZxA2USOQ';
const FILE_URL = `https://www.figma.com/design/${FILE_KEY}/DEMO-Eventz-Design-System`;

type Tier = 'atom' | 'molecule' | 'organism' | 'section' | 'icon';

const PAGES: Array<{ id: string; name: string; tier: Tier }> = [
  { id: '2600:6239', name: 'Badge', tier: 'atom' },
  { id: '6543:36648', name: 'Button', tier: 'atom' },
  { id: '2323:134', name: 'Checkbox', tier: 'atom' },
  { id: '2438:845', name: 'Date picker', tier: 'atom' },
  { id: '2342:33', name: 'Input', tier: 'atom' },
  { id: '2323:779', name: 'Radio button', tier: 'atom' },
  { id: '2369:2897', name: 'Tag', tier: 'atom' },
  { id: '2369:1064', name: 'Textarea', tier: 'atom' },
  { id: '2403:998', name: 'Accordion', tier: 'molecule' },
  { id: '2440:2136', name: 'Alert', tier: 'molecule' },
  { id: '2600:6338', name: 'Avatar group', tier: 'molecule' },
  { id: '2369:3021', name: 'Breadcrumbs', tier: 'molecule' },
  { id: '2404:1139', name: 'Combobox', tier: 'molecule' },
  { id: '2413:779', name: 'Dialog', tier: 'molecule' },
  { id: '2617:33764', name: 'Dropdown', tier: 'molecule' },
  { id: '2396:176', name: 'File uploader', tier: 'molecule' },
  { id: '2403:759', name: 'Interactive list item', tier: 'molecule' },
  { id: '2408:495', name: 'Menu item', tier: 'molecule' },
  { id: '2440:1420', name: 'Search', tier: 'molecule' },
  { id: '2403:1304', name: 'Select', tier: 'molecule' },
  { id: '2339:107', name: 'Tabs', tier: 'molecule' },
  { id: '2426:1721', name: 'Toggle group', tier: 'molecule' },
  { id: '2392:197', name: 'Ad Placeholder', tier: 'organism' },
  { id: '2384:109', name: 'Card', tier: 'organism' },
  { id: '2460:250', name: 'Carousel', tier: 'organism' },
  { id: '2380:1294', name: 'Countdown', tier: 'organism' },
  { id: '2458:420', name: 'Footer', tier: 'organism' },
  { id: '2465:286', name: 'Map', tier: 'organism' },
  { id: '2409:452', name: 'Media player', tier: 'organism' },
  { id: '2417:1276', name: 'Navigation', tier: 'organism' },
  { id: '2460:167', name: 'Selection card', tier: 'organism' },
  { id: '2372:40', name: 'Stepper', tier: 'organism' },
  { id: '2401:1644', name: 'Sticky nav', tier: 'organism' },
  { id: '2428:867', name: 'Subscription card', tier: 'organism' },
  { id: '2404:1138', name: 'Utilities', tier: 'organism' },
  { id: '2735:30854', name: 'Calendar section', tier: 'section' },
  { id: '2735:30860', name: 'Connect to spotify', tier: 'section' },
  { id: '2735:30856', name: 'Expandable content', tier: 'section' },
  { id: '2735:28971', name: 'Hero', tier: 'section' },
  { id: '2735:30851', name: 'Icon list', tier: 'section' },
  { id: '2735:30849', name: 'Listing', tier: 'section' },
  { id: '2735:28972', name: 'Location', tier: 'section' },
  { id: '2735:30850', name: 'Marquee', tier: 'section' },
  { id: '2735:30858', name: 'Merchant', tier: 'section' },
  { id: '2735:30853', name: 'Page filter', tier: 'section' },
  { id: '2735:30859', name: 'Section title', tier: 'section' },
  { id: '2735:30855', name: 'Tickets', tier: 'section' },
  { id: '2735:30852', name: 'Quick links', tier: 'section' },
  { id: '2735:30857', name: 'Venue', tier: 'section' },
  { id: '6594:47638', name: 'Icons', tier: 'icon' },
];

function figmaToken(): string {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  for (const p of [path.resolve('.env.local'), path.resolve('.env')]) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^FIGMA_TOKEN\s*=\s*"?([^"\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  }
  throw new Error('FIGMA_TOKEN not found (.env / .env.local / env)');
}

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
  stub?: boolean;
};

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

const chunk = <T,>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
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
      note: 'Whole-file REST dump of library + section pages. Icon glyphs counted, not inverted.',
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
    const cachedCensus = JSON.parse(readFileSync(censusCache, 'utf8')) as {
      census: typeof census;
      setNames?: string[];
    };
    if (Array.isArray(cachedCensus.census)) census.push(...cachedCensus.census);
    for (const c of census) {
      for (const s of c.sets) pageBySet.set(s.name, { page: c.page, tier: c.tier });
    }
  }

  if (Object.keys(mergedDump).filter((k) => !k.startsWith('_')).length === 0) {
  for (const batch of chunk(PAGES, 6)) {
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
  writeFileSync(
    path.join(OUT, 'census.json'),
    `${JSON.stringify({ started, fileKey: FILE_KEY, setNames, census }, null, 2)}\n`,
  );
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

  const mergeTree = (dst: Record<string, unknown>, src: Record<string, unknown>): void => {
    for (const [k, v] of Object.entries(src)) {
      if (v !== null && typeof v === 'object' && !('$value' in (v as object))) {
        dst[k] = dst[k] ?? {};
        mergeTree(dst[k] as Record<string, unknown>, v as Record<string, unknown>);
      } else dst[k] = v;
    }
  };
  const register = (c: Record<string, unknown>): void => {
    if (typeof c.id !== 'string' || typeof c.name !== 'string') return;
    contractIdByName.set(c.name, c.id);
    contractsById.set(c.id, asMinimalChildContract(c));
    const key = (c.anchors as { figma?: { componentSetKey?: string } } | undefined)?.figma?.componentSetKey;
    if (typeof key === 'string' && key.length > 0) contractIdByKey.set(key, c.id);
    sessionClaimedIds.add(c.id);
    if (!contracts.has(c.id)) contracts.set(c.id, c);
  };

  const order = [...setNames].sort((a, b) => {
    const ta = pageBySet.get(a)?.tier ?? 'organism';
    const tb = pageBySet.get(b)?.tier ?? 'organism';
    const rank = { icon: 0, atom: 1, molecule: 2, organism: 3, section: 4 };
    return (rank[ta] ?? 9) - (rank[tb] ?? 9) || a.localeCompare(b);
  });

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
    let proposal: FigmaProposalResult;
    try {
      proposal = proposeFromDump(mergedDump[setName] as DumpSet, {
        projectionMode: 'reviewable-inversion',
        corpus,
        contractIdByName,
        contractIdByKey,
        contractsById,
        sessionClaimedIds: new Set(sessionClaimedIds),
        fileKey: FILE_KEY,
        mintUnbound: true,
      });
    } catch (e) {
      row.proposeError = e instanceof Error ? e.message : String(e);
      rows.push(row);
      continue;
    }
    row.proposed = true;
    row.notes = (proposal.notes ?? []).length;
    row.noteClasses = [...new Set((proposal.notes ?? []).map(noteClass))];
    register(proposal.contract as Record<string, unknown>);
    for (const stub of proposal.childStubs ?? []) register(stub as Record<string, unknown>);
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

  writeFileSync(path.join(OUT, 'census.json'), `${JSON.stringify({ started, fileKey: FILE_KEY, totals, census, rows }, null, 2)}\n`);
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

  const scorecard = `# Eventz whole-file Path A — ${started.slice(0, 10)}

File: [DEMO Eventz Design System](${FILE_URL}) (\`${FILE_KEY}\`).
Transport: Figma REST → dump → \`proposeFromDump\` (\`reviewable-inversion\`, \`mintUnbound\`) → \`generateCss\` / \`generateTsx\`.
This is an inversion of a hand-built kit, not a round trip of sets this tool drew.

## Verdict

| | n |
|---|---|
| Library + section pages fetched | ${totals.pagesFetched} (${totals.pagesFailed} failed) |
| COMPONENT_SETs on those pages (icons excluded) | **${totals.componentSets}** |
| Icon glyphs counted, not inverted | ${totals.iconGlyphs} standalone + ${totals.iconSets} sets |
| Proposed | **${totals.proposed}** |
| Schema-valid | **${totals.schemaOk}** |
| Generated React + CSS | **${totals.generated}** |
| Propose threw | ${totals.proposeThrew} |

Prior receipts on this same file: Eventz pilot dumped **68** library components (API only, icons/templates omitted); \`examples/eventz-vars\` inverted **7** sets. This run is the file-scale Path A test.

## By tier

| tier | proposed | schema-ok | generated |
|---|---:|---:|---:|
| atom | ${byTier('atom').filter((r) => r.proposed).length} | ${byTier('atom').filter((r) => r.schemaOk).length} | ${byTier('atom').filter((r) => r.generated).length} |
| molecule | ${byTier('molecule').filter((r) => r.proposed).length} | ${byTier('molecule').filter((r) => r.schemaOk).length} | ${byTier('molecule').filter((r) => r.generated).length} |
| organism | ${byTier('organism').filter((r) => r.proposed).length} | ${byTier('organism').filter((r) => r.schemaOk).length} | ${byTier('organism').filter((r) => r.generated).length} |
| section | ${byTier('section').filter((r) => r.proposed).length} | ${byTier('section').filter((r) => r.schemaOk).length} | ${byTier('section').filter((r) => r.generated).length} |

## Named omissions

- **Icons page** — counted, not inverted. Same decision as the 2026 Eventz pilot.
- **Cover / foundations / templates / eval / shader / motion pages** — out of scope. They are documentation and test debris, not the library.
- **Adopt-in-place** — this run does not stamp the hand-built sets as contract-backed. Generated React is a starting point.
- **Geometry / font walls** — not opened. REST already degrades variable names when the token lacks \`file_variables:read\`.

## REST degradations

${degradations.length} named mapping notes (see \`out/degradations.json\`). First 12:

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
  console.log(scorecard.split('\n').slice(0, 40).join('\n'));
  console.log(`\n✔ wrote ${path.join(HERE, 'SCORECARD.md')} (${rows.length} sets)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
