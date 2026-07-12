/**
 * SESSION CONTRACT REGISTRY (dump v1.5 linking) — the workspace's imports as
 * a LIVE contract scope, so a composite imported later LINKS to components
 * imported earlier instead of stubbing them (field case: import Button-Brand
 * Primary, then import Dialog — the Dialog's ↪️action-1 ref must resolve to
 * ds.button-brand-primary).
 *
 * Everything here is derived, on demand, from the workspace store
 * (workspace.ts): each entry's contract text is schema-parsed (unparseable
 * text simply doesn't join scope — the entry is a display log first), its
 * child stubs ride along at LOWER precedence, and its minted token tree is
 * exposed so a linked child's imported.* bindings still resolve when a
 * DIFFERENT contract is on screen (token-source's single minted layer only
 * carries the on-screen contract's).
 *
 * Index shapes match core/propose-figma.ts resolveChildContract:
 *   idByKey   anchors.figma.componentSetKey → id  (checked FIRST)
 *   idByName  entry display name (the DRAWN set name) AND contract.name → id
 */
import { ContractSchema, type Contract } from '../../../core/index.js';
import { workspaceSnapshot, type WorkspaceEntry } from './workspace.js';

export interface SessionRegistry {
  /** Parsed contracts of every workspace entry, by id (newest entry wins on
   *  an id collision — the same re-import refresh rule the workspace uses). */
  contracts: Map<string, Contract>;
  /** Child STUBS that rode the entries — registered only where no real
   *  contract holds the id (playground stub precedence). */
  stubs: Map<string, Contract>;
  idByName: Map<string, string>;
  idByKey: Map<string, string>;
  /** Minted DTCG trees, oldest first (imported.* namespaces are per
   *  component — collisions only between re-imports of the same name, where
   *  the newest wins by ORDER of application). */
  mintedTrees: Array<Record<string, unknown>>;
}

/** Parse cache — workspace entries are immutable by id. */
const parsed = new Map<string, { contract: Contract | null; stubs: Contract[] }>();

function parseEntry(entry: WorkspaceEntry): { contract: Contract | null; stubs: Contract[] } {
  const cached = parsed.get(entry.id);
  if (cached) return cached;
  let contract: Contract | null = null;
  try {
    const result = ContractSchema.safeParse(JSON.parse(entry.contractText));
    contract = result.success ? result.data : null;
  } catch {
    contract = null;
  }
  const stubs: Contract[] = [];
  for (const raw of entry.childStubs ?? []) {
    const result = ContractSchema.safeParse(raw);
    if (result.success) stubs.push(result.data);
  }
  const value = { contract, stubs };
  parsed.set(entry.id, value);
  return value;
}

/** Build the registry from workspace entries (oldest → newest so the newest
 *  import wins every index on collision). */
export function buildSessionRegistry(entries: WorkspaceEntry[]): SessionRegistry {
  const registry: SessionRegistry = {
    contracts: new Map(),
    stubs: new Map(),
    idByName: new Map(),
    idByKey: new Map(),
    mintedTrees: [],
  };
  for (const entry of [...entries].reverse()) {
    const { contract, stubs } = parseEntry(entry);
    for (const stub of stubs) registry.stubs.set(stub.id, stub);
    if (entry.mintedTokens && entry.mintedTokens.count > 0) {
      registry.mintedTrees.push(entry.mintedTokens.tree);
    }
    if (!contract) continue;
    registry.contracts.set(contract.id, contract);
    // BOTH spellings index the id: the workspace entry's display name is the
    // DRAWN set name ("Button-Brand Primary"), the parsed contract's name is
    // the sanitized export ("ButtonBrandPrimary") — nested instances are
    // spelled with the former.
    registry.idByName.set(contract.name, contract.id);
    if (entry.name) registry.idByName.set(entry.name, contract.id);
    const key = contract.anchors.figma.componentSetKey;
    if (key) registry.idByKey.set(key, contract.id);
  }
  return registry;
}

/** The registry over the CURRENT workspace snapshot — call at use time
 *  (imports, validation, preview assembly all run imperatively). */
export function sessionRegistry(): SessionRegistry {
  return buildSessionRegistry(workspaceSnapshot());
}
