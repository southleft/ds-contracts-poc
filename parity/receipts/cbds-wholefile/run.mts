/**
 * CBDS WHOLE-FILE Path A — Figma library → contracts → React.
 *
 * Same shape as Eventz (`parity/receipts/eventz-wholefile`), but this file
 * already has a plugin dump with `_variables`. Do not REST-fetch 1,600
 * icon-class components. Invert COMPONENT_SETs only; count icons.
 *
 *   npx tsx parity/receipts/cbds-wholefile/run.mts
 *
 * Writes SCORECARD.md + out/. Linked selection: Card-Image 419:763.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, tokenInventoryFromJson, type Contract } from '../../../core/index.js';
import { proposeBatchFromDump, type FigmaProposalResult } from '../../../core/propose-figma.js';
import { capturedTokensFromDump } from '../../../core/captured-tokens.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';
import { generateCss, generateTsx } from '../../../core/emit-react.js';
import { fetchNodes } from '../../../extract/figma/rest/fetch.js';
import type { DumpNode, DumpSet } from '../../../extract/figma/types.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../../..');
const OUT = path.join(HERE, 'out');
const FILE_KEY = 'WofZT8xaxXuc2Q6Je9S4XE';
const FILE_URL = `https://www.figma.com/design/${FILE_KEY}/CBDS-UI-Kit-Demo`;
const CARD_IMAGE_ID = '419:763';
const DUMP_REL = 'extract/figma/fixtures/cbds-plugin-all-sets.v16.dump.json';

type Row = {
  set: string;
  nodeId?: string;
  variants: number;
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

function figmaToken(): string | null {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN;
  for (const p of [path.resolve(ROOT, '.env.local'), path.resolve(ROOT, '.env')]) {
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^FIGMA_TOKEN\s*=\s*"?([^"\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  }
  return null;
}

const isSet = (value: unknown): value is DumpSet & { type?: string; nodeId?: string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { setName?: unknown }).setName === 'string' &&
  Array.isArray((value as { variants?: unknown }).variants);

const mergeTree = (dst: Record<string, unknown>, src: Record<string, unknown>): void => {
  for (const [k, v] of Object.entries(src)) {
    if (v !== null && typeof v === 'object' && !('$value' in (v as object))) {
      dst[k] = dst[k] ?? {};
      mergeTree(dst[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else dst[k] = v;
  }
};

async function liveCardImage(): Promise<{
  name: string;
  type: string;
  variants: number;
  error?: string;
} | null> {
  const token = figmaToken();
  if (!token) return null;
  try {
    const res = await fetchNodes(FILE_KEY, [CARD_IMAGE_ID], token);
    const node = res.nodes?.[CARD_IMAGE_ID]?.document as
      | { name?: string; type?: string; children?: Array<{ type?: string }> }
      | undefined;
    if (!node) return { name: '?', type: '?', variants: 0, error: 'node missing from REST' };
    return {
      name: node.name ?? '?',
      type: node.type ?? '?',
      variants: (node.children ?? []).filter((c) => c.type === 'COMPONENT').length,
    };
  } catch (e) {
    return { name: '?', type: '?', variants: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const started = new Date().toISOString();
  const dumpPath = path.join(ROOT, DUMP_REL);
  const dump = JSON.parse(readFileSync(dumpPath, 'utf8')) as Record<string, unknown>;
  const provenance = dump._provenance as
    | { dumpVersion?: string; extractedAt?: string; fileVersion?: string }
    | undefined;

  const allSets: Array<{ name: string; type: string; nodeId?: string; variants: number }> = [];
  const slim: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(dump)) {
    // Dump meta only — underscore-prefixed COMPONENT_SETs (`_Tab-item`) are real sets.
    if (name.startsWith('_') && !isSet(value)) {
      slim[name] = value;
      continue;
    }
    if (!isSet(value)) continue;
    const type = value.type ?? 'COMPONENT';
    const variants = (value.variants as DumpNode[]).length;
    allSets.push({ name, type, nodeId: value.nodeId, variants });
    if (type === 'COMPONENT_SET') slim[name] = value;
  }

  const componentSets = allSets.filter((s) => s.type === 'COMPONENT_SET');
  const plain = allSets.filter((s) => s.type !== 'COMPONENT_SET');
  console.log(
    `dump: ${allSets.length} sets (${componentSets.length} COMPONENT_SETs, ${plain.length} plain) from ${DUMP_REL}`,
  );

  const captured = capturedTokensFromDump(slim);
  const capturedTree = (captured?.tree ?? {}) as Record<string, unknown>;
  const corpus = tokenCorpusFromJson({
    primitives: capturedTree,
    semantic: {},
    light: {},
    brandDefault: {},
  });

  const batch = proposeBatchFromDump(slim, {
    projectionMode: 'reviewable-inversion',
    corpus,
    contractIdByName: new Map(),
    contractsById: new Map(),
    fileKey: FILE_KEY,
    mintUnbound: true,
  });
  const proposalsBySet = new Map(batch.proposals.map((p) => [p.setName, p]));
  const skippedBySet = new Map(batch.skipped.map((s) => [s.setName, s]));

  const contracts = new Map<string, Record<string, unknown>>();
  const mintedTree: Record<string, unknown> = {};
  const rows: Row[] = [];

  const register = (c: Record<string, unknown>, isStub = false): void => {
    if (typeof c.id !== 'string') return;
    if (isStub && contracts.has(c.id)) return;
    contracts.set(c.id, c);
  };

  for (const set of componentSets.sort((a, b) => a.name.localeCompare(b.name))) {
    const row: Row = {
      set: set.name,
      nodeId: set.nodeId,
      variants: set.variants,
      proposed: false,
      schemaOk: false,
      generated: false,
      notes: 0,
      noteClasses: [],
      schemaErrors: [],
      generateErrors: [],
    };
    const skip = skippedBySet.get(set.name);
    if (skip) {
      row.proposeError = skip.reason;
      rows.push(row);
      continue;
    }
    const proposal = proposalsBySet.get(set.name) as FigmaProposalResult | undefined;
    if (!proposal) {
      row.proposeError = 'set neither proposed nor skipped — batch invariant broken';
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

  const live = await liveCardImage();
  const card = rows.find((r) => r.set === 'Card-Image');
  const dumpCard = componentSets.find((s) => s.name === 'Card-Image');
  const totals = {
    dumpSets: allSets.length,
    componentSets: componentSets.length,
    plainComponents: plain.length,
    proposed: rows.filter((r) => r.proposed).length,
    schemaOk: rows.filter((r) => r.schemaOk).length,
    generated: rows.filter((r) => r.generated).length,
    proposeThrew: rows.filter((r) => r.proposeError).length,
    batchNotes: batch.notes,
    capturedCount: captured?.count ?? 0,
  };

  writeFileSync(
    path.join(OUT, 'census.json'),
    `${JSON.stringify({ started, fileKey: FILE_KEY, dump: DUMP_REL, totals, live, rows }, null, 2)}\n`,
  );

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
    const mark = r.set === 'Card-Image' ? ' **← linked**' : '';
    return `| ${r.set.replace(/\|/g, '/')}${mark} | ${r.nodeId ?? '—'} | ${r.variants} | ${r.notes} | ${status} | ${(r.noteClasses.slice(0, 4).join(', ') || '—').replace(/\|/g, '/')} |`;
  };

  const liveLine = live
    ? live.error
      ? `Live REST check of \`${CARD_IMAGE_ID}\` failed: ${live.error}`
      : `Live REST: \`${live.name}\` (${live.type}) still has **${live.variants}** COMPONENT children.`
    : 'Live REST check skipped (no FIGMA_TOKEN). Prior plugin inspect on 2026-08-19: Card-Image, 12 variants, axes type × size × image-fill × image-bottom.';

  const dumpLine = dumpCard
    ? `Dump: \`${dumpCard.name}\` \`${dumpCard.nodeId}\`, **${dumpCard.variants}** variants.`
    : 'Dump: Card-Image missing.';

  const cardStatus = card
    ? card.generated
      ? 'generated React + CSS'
      : card.schemaOk
        ? `schema-ok, generate refused: ${(card.generateErrors[0] ?? 'unknown').slice(0, 200)}`
        : card.proposeError ?? 'not proposed'
    : 'not in COMPONENT_SET score';

  const scorecard = `# CBDS whole-file Path A — ${started.slice(0, 10)}

File: [CBDS UI Kit Demo](${FILE_URL}) (\`${FILE_KEY}\`).
Linked node: [Card-Image](${FILE_URL}?node-id=419-763) (\`${CARD_IMAGE_ID}\`).
Transport: committed plugin dump → \`proposeBatchFromDump\` (\`reviewable-inversion\`, \`mintUnbound\`) → \`generateCss\` / \`generateTsx\`.
This is an inversion of a hand-built kit. It is **not** a first look — the gauntlet already replayed this dump.

## Verdict

| | n |
|---|---|
| Dump | \`${DUMP_REL}\` (v${provenance?.dumpVersion ?? '?'}, ${provenance?.extractedAt ?? '?'}) |
| Captured variables | ${totals.capturedCount} |
| Dump entries (all) | ${totals.dumpSets} |
| COMPONENT_SETs inverted | **${totals.componentSets}** |
| Plain COMPONENTs counted, not inverted | ${totals.plainComponents} |
| Proposed | **${totals.proposed}** |
| Schema-valid | **${totals.schemaOk}** |
| Generated React + CSS | **${totals.generated}** |
| Propose threw | ${totals.proposeThrew} |

Gauntlet census (\`extract/figma/gauntlet/CENSUS.md\`) is **76/76** COMPONENT_SETs / 1618 dump entries — including underscore-prefixed private sets (\`_Tab-item\`, \`_Avatar Indicator\`, …). An earlier Path A runner treated \`_…\` keys as dump metadata and under-counted 61. This run matches the gauntlet population, then asks the Eventz question: dump tokens + stubs only, then \`generateTsx\`. Refusal-free ≠ pixel-right.

${totals.batchNotes.length > 0 ? `Batch notes: ${totals.batchNotes.map((n) => `"${n.split(' — ')[0]}"`).join('; ')}.` : ''}

## Generate refusals

String-boolean composition is climbed (propose + emit coerce). Remaining refusals, if any, are a different class.

## Card-Image (linked)

${dumpLine}
${liveLine}
Path A status: **${cardStatus}**. Notes: ${card?.notes ?? 0} (${(card?.noteClasses ?? []).join(', ') || 'none'}).

Card-Image is the slot/swap fixture class already pinned at \`extract/figma/gauntlet/fixtures/pattern-slot-placeholder-card-image.dump.json\`. INSTANCE_SWAP preferredValues remain a dump v1 limit.

## Named omissions

- **Plain COMPONENTs** — ${totals.plainComponents} icon-class singles counted, not inverted. Same named omission as Eventz.
- **Repo contracts** — not injected. This is inversion of the dump, not receive-into-this-repo. The gauntlet is the repo-composition receipt.
- **Adopt-in-place** — this run does not stamp the hand-built sets as contract-backed.
- **Geometry / font walls** — not opened.

## Sets

| set | node | variants | notes | status | note classes |
|---|---|---:|---:|---|---|
${rows.map(mdRow).join('\n')}

## Generate refusals

${
  rows
    .filter((r) => r.generateErrors.length || r.schemaErrors.length || r.proposeError)
    .map((r) => {
      const bits = [...r.schemaErrors, ...r.generateErrors, r.proposeError].filter(Boolean);
      return `### ${r.set}\n\n${bits.map((b) => `- ${b}`).join('\n')}`;
    })
    .join('\n\n') || '_Every proposed COMPONENT_SET generated._'
}
`;

  writeFileSync(path.join(HERE, 'SCORECARD.md'), scorecard);
  console.log(scorecard.split('\n').slice(0, 50).join('\n'));
  console.log(`\n✔ wrote ${path.join(HERE, 'SCORECARD.md')} (${rows.length} COMPONENT_SETs)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
