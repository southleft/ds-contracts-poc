/**
 * Underscore-safe composeSubject for the LIVE GAUNTLET — a faithful clone of
 * extract/figma/visual-parity/compose.ts with ONE behavioral difference,
 * named as a harness finding in GAUNTLET.md:
 *
 *   compose.ts pickSet treats every dump key starting with "_" as a meta
 *   channel (_provenance/_variables/_degradations) and cannot address the
 *   owner's 30 legitimately underscore-NAMED sets (_Avatar Indicator,
 *   _Slot-Dialog, _Tab-item, _Error text, …) — 20 of the live composites'
 *   session SCOPES refused on it. The playground's own receive path
 *   (proposeBatchFromDump) accepts them; this clone matches the playground:
 *   a key is a SET when it parses as one (tiers.ts isDumpSetRecord), meta
 *   channels are excluded by NAME.
 *
 * Kept verbatim otherwise (session registries, captured-layer order, minted
 * CSS blocks, stub precedence, nodeId guard). Lives under gauntlet/live/
 * because the standing visual-parity harness is outside this run's write
 * scope — fold the pickSet fix upstream and delete this clone.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  capturedTokensFromDump,
  ContractSchema,
  dumpCapturesHidden,
  mintedTokenCss,
  proposeFromDump,
  tokenInventoryFromJson,
  type CapturedTokenLayer,
  type Contract,
} from '../../../../core/index.js';
import { loadRepoData, readJson, REPO, type RepoData } from '../../../fidelity-matrix/scripts/lib.js';
import type { DumpFile, DumpSet } from '../../types.js';
import type { ParitySubject } from '../../visual-parity/subjects.js';
import type { RenderablePackage } from '../../visual-parity/compose.js';
import { isDumpSetRecord } from './tiers.js';

let repoData: RepoData | null = null;
const data = (): RepoData => (repoData ??= loadRepoData());

function composeCaptured(
  baseInventory: Set<string>,
  captured: CapturedTokenLayer | null,
): { inventory: Set<string>; css: string; shadowed: string[]; count: number } {
  if (!captured || captured.count === 0) {
    return { inventory: baseInventory, css: '', shadowed: [], count: 0 };
  }
  const shadowed = captured.entries.filter((e) => baseInventory.has(e.path)).map((e) => e.name);
  const registered = captured.entries.filter((e) => !baseInventory.has(e.path));
  if (registered.length === 0) return { inventory: baseInventory, css: '', shadowed, count: 0 };
  const tree: Record<string, unknown> = {};
  for (const e of registered) {
    const segs = e.path.split('.');
    let node = tree;
    for (const seg of segs.slice(0, -1)) node = (node[seg] ??= {}) as Record<string, unknown>;
    node[segs[segs.length - 1]] = { $value: e.value, $type: e.type };
  }
  return {
    inventory: new Set([...baseInventory, ...registered.map((e) => e.path)]),
    css: `/* Captured tokens (designer's Figma variables) — ${registered.length} registered; repo tokens win on collision. */\n${mintedTokenCss(tree)}`,
    shadowed,
    count: registered.length,
  };
}

/** Underscore-safe set pick: a key is a set when it PARSES as one. */
function pickSet(dump: DumpFile, dumpPath: string, wanted: string | undefined, who: string): [string, DumpSet] {
  const sets = Object.entries(dump).filter((e): e is [string, DumpSet] => isDumpSetRecord(e[0], e[1]));
  const picked = wanted ? sets.find(([name]) => name === wanted) : sets.length === 1 ? sets[0] : undefined;
  if (!picked) {
    throw new Error(
      `${who}: ${wanted ? `set "${wanted}" not in ${dumpPath}` : `${dumpPath} carries ${sets.length} sets — name one`}`,
    );
  }
  return picked;
}

export function composeSubjectLive(subject: ParitySubject): RenderablePackage {
  if (subject.kind !== 'dump') throw new Error(`${subject.id}: live compose handles dump subjects only`);
  const d = data();
  const baseCss = readFileSync(path.join(REPO, 'src', 'styles', 'tokens.css'), 'utf8');

  const contracts = new Map(d.contracts);
  const contractIdByName = new Map(d.contractIdByName);
  const contractIdByKey = new Map(d.contractIdByKey);
  let inventory = d.inventory;
  const cssBlocks: string[] = [baseCss];
  const receipts: RenderablePackage['receipts'] = {
    mintedCount: 0,
    capturedCount: 0,
    capturedShadowed: [],
    childStubs: [],
    sessionContracts: [],
    proposalNotes: 0,
  };

  const proposeOne = (
    dumpPath: string,
    wantedSet: string | undefined,
    who: string,
  ): { contract: Contract; stubs: Contract[]; notes: number } => {
    const dump = readJson(path.join(REPO, dumpPath)) as DumpFile;
    const [setName, set] = pickSet(dump, dumpPath, wantedSet, who);
    const captured = capturedTokensFromDump(dump as Record<string, unknown>);
    const withCaptured = composeCaptured(inventory, captured);
    inventory = withCaptured.inventory;
    if (withCaptured.css) cssBlocks.push(withCaptured.css);
    receipts.capturedCount += withCaptured.count;
    receipts.capturedShadowed.push(...withCaptured.shadowed);

    const result = proposeFromDump(set, {
      corpus: d.corpus,
      contractIdByName,
      contractIdByKey,
      contractsById: contracts,
      fileKey: dump._provenance?.fileKey ?? subject.fileKey,
      mintUnbound: true,
      hiddenCaptured: dumpCapturesHidden(dump._provenance),
    });
    const contract = ContractSchema.parse(result.contract);
    const stubs = (result.childStubs ?? []).map((s) => ContractSchema.parse(s));

    if (result.mintedTokens) {
      inventory = new Set([...inventory, ...tokenInventoryFromJson([result.mintedTokens.tree])]);
      cssBlocks.push(
        `/* Minted provisional tokens (imported.*) — ${who}, literal fidelity. */\n${mintedTokenCss(result.mintedTokens.tree)}`,
      );
      receipts.mintedCount += result.mintedTokens.count;
    }

    contracts.set(contract.id, contract);
    contractIdByName.set(contract.name, contract.id);
    contractIdByName.set(setName, contract.id);
    const setKey = contract.anchors.figma.componentSetKey;
    if (setKey) contractIdByKey.set(setKey, contract.id);
    for (const stub of stubs) {
      if (!contracts.has(stub.id)) contracts.set(stub.id, stub);
    }
    return { contract, stubs, notes: result.notes.length };
  };

  for (const entry of subject.scope ?? []) {
    const scoped = proposeOne(entry.dumpPath, entry.set, `${subject.id} scope(${entry.dumpPath})`);
    receipts.sessionContracts.push(scoped.contract.id);
    receipts.proposalNotes += scoped.notes;
  }

  const own = proposeOne(subject.dumpPath, subject.set, subject.id);
  receipts.childStubs.push(...own.stubs.map((s) => s.id));
  receipts.proposalNotes += own.notes;

  const ownDump = readJson(path.join(REPO, subject.dumpPath)) as DumpFile;
  const [, ownSet] = pickSet(ownDump, subject.dumpPath, subject.set, subject.id);
  if (ownSet.nodeId && ownSet.nodeId !== subject.setNodeId) {
    throw new Error(`${subject.id}: dump set nodeId ${ownSet.nodeId} != registry setNodeId ${subject.setNodeId}`);
  }

  return {
    subject,
    contract: own.contract,
    contracts,
    inventory,
    tokensCss: cssBlocks.filter(Boolean).join('\n'),
    icons: d.icons,
    receipts,
  };
}
