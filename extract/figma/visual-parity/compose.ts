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
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  capturedTokensFromDump,
  ContractSchema,
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
      receipts: { mintedCount: 0, capturedCount: 0, capturedShadowed: [], childStubs: [], proposalNotes: 0 },
    };
  }

  const dump = readJson(path.join(REPO, subject.dumpPath)) as DumpFile;
  const sets = Object.entries(dump).filter(
    (e): e is [string, DumpSet] => !e[0].startsWith('_') && isDumpSet(e[1]),
  );
  const picked = subject.set ? sets.find(([name]) => name === subject.set) : sets.length === 1 ? sets[0] : undefined;
  if (!picked) {
    throw new Error(
      `${subject.id}: ${subject.set ? `set "${subject.set}" not in dump` : `dump carries ${sets.length} sets — name one via subject.set`}`,
    );
  }
  if (picked[1].nodeId && picked[1].nodeId !== subject.setNodeId) {
    throw new Error(`${subject.id}: dump set nodeId ${picked[1].nodeId} != registry setNodeId ${subject.setNodeId}`);
  }

  const result = proposeFromDump(picked[1], {
    corpus: d.corpus,
    contractIdByName: d.contractIdByName,
    // Without the contracts themselves, canonicalizeInstanceProps falls back
    // to spelling passthrough — a name-coincidence child ("Button" in the
    // Shoelace kit → repo ds.button) then carries foreign props the referee
    // refuses (field failure: shoelace-button-group, 8 named violations, 36
    // variants undiffable). With the contracts in scope, unmappable applied
    // props DROP with a named note each and the composite renders.
    contractsById: d.contracts,
    fileKey: dump._provenance?.fileKey ?? subject.fileKey,
    mintUnbound: true,
  });
  const contract = ContractSchema.parse(result.contract);
  const childStubs = (result.childStubs ?? []).map((s) => ContractSchema.parse(s));

  // Layer order (token-source.ts recompose): repo → captured → minted.
  const captured = capturedTokensFromDump(dump as Record<string, unknown>);
  const withCaptured = composeCaptured(d.inventory, captured);
  const minted = result.mintedTokens;
  const inventory = minted
    ? new Set([...withCaptured.inventory, ...tokenInventoryFromJson([minted.tree])])
    : withCaptured.inventory;
  const mintedCssBlock = minted
    ? `/* Minted provisional tokens (imported.*) — literal fidelity. */\n${mintedTokenCss(minted.tree)}`
    : '';

  const contracts = new Map(d.contracts);
  contracts.set(contract.id, contract);
  for (const stub of childStubs) contracts.set(stub.id, stub);

  return {
    subject,
    contract,
    contracts,
    inventory,
    tokensCss: [baseCss, withCaptured.css, mintedCssBlock].filter(Boolean).join('\n'),
    icons: d.icons,
    receipts: {
      mintedCount: minted?.count ?? 0,
      capturedCount: withCaptured.count,
      capturedShadowed: withCaptured.shadowed,
      childStubs: childStubs.map((s) => s.id),
      proposalNotes: result.notes.length,
    },
  };
}
