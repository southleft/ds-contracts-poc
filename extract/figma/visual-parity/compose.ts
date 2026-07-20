/**
 * Subject → renderable package: the contract, the contract scope, and the
 * COMPOSED stylesheet — the same layering the playground performs
 * (playground/src/engine/token-source.ts): repo tokens → captured Figma
 * variables (repo wins on name collision, shadowed names receipted) →
 * minted provisional tokens (imported.*, collision-free by namespace).
 *
 * dump subjects run the real import path (proposeFromDump with minting +
 * child stubs); contract subjects are the shipping catalog contracts over
 * repo tokens alone.
 *
 * SESSION SCOPE (dump v1.5): a dump subject may declare sibling dumps
 * (subject.scope) that are proposed FIRST and registered — contract, drawn
 * set name, componentSetKey, minted + captured token layers — before the
 * subject proposes. This is the parity mirror of importing components in
 * sequence in one playground session: the subject's nested instances LINK
 * to the session contracts (key first, name fallback) instead of stubbing.
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
} from '../../../core/index.js';
import { loadRepoData, readJson, REPO, type RepoData } from '../../fidelity-matrix/scripts/lib.js';
import { isDumpSet, type DumpFile, type DumpSet } from '../types.js';
import type { ParitySubject } from './subjects.js';

export interface RenderablePackage {
  subject: ParitySubject;
  contract: Contract;
  contracts: Map<string, Contract>;
  inventory: Set<string>;
  /** Full CSS bundle for the preview document: tokens.css + captured layer
   *  CSS + minted layer CSS (each labeled). */
  tokensCss: string;
  icons: Map<string, string>;
  receipts: {
    mintedCount: number;
    capturedCount: number;
    /** Captured variable names pruned because a repo token shadows them. */
    capturedShadowed: string[];
    childStubs: string[];
    /** Contracts proposed from session-scope sibling dumps (dump v1.5
     *  linking) and registered before the subject proposed. */
    sessionContracts: string[];
    proposalNotes: number;
  };
}

let repoData: RepoData | null = null;
export const data = (): RepoData => (repoData ??= loadRepoData());

/** token-source.ts composeCaptured, node-side: registrable captured entries
 *  join the inventory; names the base source already defines are pruned
 *  (repo value keeps winning) and returned by name. */
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

/** The dump's meta channels, excluded from set addressing BY NAME — a
 *  name-prefix convention is not a type test (live-gauntlet harness class ⑦:
 *  the owner legitimately names 30 sets "_Input label", "_Slot-Dialog",
 *  "_Tab-item", … and the old startsWith('_') guard made them unaddressable
 *  — 20 live composites' session scopes refused. The playground's own
 *  receive path checks the parsed shape; this now matches it). */
const META_CHANNELS = new Set(['_provenance', '_variables', '_degradations']);

function pickSet(dump: DumpFile, dumpPath: string, wanted: string | undefined, who: string): [string, DumpSet] {
  const sets = Object.entries(dump).filter(
    (e): e is [string, DumpSet] => !META_CHANNELS.has(e[0]) && isDumpSet(e[1]),
  );
  const picked = wanted ? sets.find(([name]) => name === wanted) : sets.length === 1 ? sets[0] : undefined;
  if (!picked) {
    throw new Error(
      `${who}: ${wanted ? `set "${wanted}" not in ${dumpPath}` : `${dumpPath} carries ${sets.length} sets — name one`}`,
    );
  }
  return picked;
}

export function composeSubject(subject: ParitySubject): RenderablePackage {
  const d = data();
  const baseCss = readFileSync(path.join(REPO, 'src', 'styles', 'tokens.css'), 'utf8');

  if (subject.kind === 'contract') {
    const contract = d.contracts.get(subject.contractId);
    if (!contract) throw new Error(`${subject.id}: contract "${subject.contractId}" not in contracts/`);
    return {
      subject,
      contract,
      contracts: d.contracts,
      inventory: d.inventory,
      tokensCss: baseCss,
      icons: d.icons,
      receipts: { mintedCount: 0, capturedCount: 0, capturedShadowed: [], childStubs: [], sessionContracts: [], proposalNotes: 0 },
    };
  }

  // Accumulating SESSION registries — repo contracts first, then each scope
  // proposal, then the subject (the playground's import-in-sequence shape).
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
    // Captured layer BEFORE the proposal registers minted refs (token-source
    // recompose order: repo → captured → minted; repo wins on collision, and
    // a captured name already registered by an earlier session dump is
    // shadowed the same way).
    const captured = capturedTokensFromDump(dump as Record<string, unknown>);
    const withCaptured = composeCaptured(inventory, captured);
    inventory = withCaptured.inventory;
    if (withCaptured.css) cssBlocks.push(withCaptured.css);
    receipts.capturedCount += withCaptured.count;
    receipts.capturedShadowed.push(...withCaptured.shadowed);

    const result = proposeFromDump(set, {
      corpus: d.corpus,
      // The SESSION registries — repo + every previously registered proposal:
      // nested instances LINK (componentSetKey first, drawn-name fallback)
      // instead of stubbing; unmappable applied props DROP with a named note
      // each (field failure: shoelace-button-group, 8 named violations, 36
      // variants undiffable, when foreign props rode a name-coincidence ref).
      contractIdByName,
      contractIdByKey,
      contractsById: contracts,
      fileKey: dump._provenance?.fileKey ?? subject.fileKey,
      mintUnbound: true,
      // Visible-in-default-variant boolean defaults are evidence only when
      // the dump's producer captures `hidden` (dump v1.1+ provenance).
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

    // Register: the contract under its id, its DRAWN set name AND its
    // contract name (a sanitized proposal name differs from the drawn set
    // name nested instances are spelled with), and its componentSetKey.
    contracts.set(contract.id, contract);
    contractIdByName.set(contract.name, contract.id);
    contractIdByName.set(setName, contract.id);
    const setKey = contract.anchors.figma.componentSetKey;
    if (setKey) contractIdByKey.set(setKey, contract.id);
    // Stubs never override a registered contract (playground precedence).
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

  // Registry/dump agreement (the original guard): the subject's set nodeId
  // must match the parity registry's.
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
