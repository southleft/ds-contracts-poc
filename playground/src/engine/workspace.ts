/**
 * Session workspace — every successful import collects here, so the design↔
 * code loop is inspectable after the fact: what came in, from where, with
 * which receipts. Same store pattern as token-source.ts (module-level state,
 * useSyncExternalStore, sessionStorage persistence — this tab only, gone on
 * close; nothing ever leaves the browser).
 *
 * Entries are capped at WORKSPACE_CAP: the oldest is evicted and NAMED in a
 * receipts line, never silently. A sessionStorage write the browser refuses
 * (quota) is also named — the workspace then lives in memory for the page.
 * Anchored Figma imports are identified by file and node (or set key).
 * Unanchored imports retain the (source, name) refresh rule.
 */
import { useSyncExternalStore } from 'react';
import type { ReceiptGroup, Receipts } from '../receipts.js';
import type { CapturedTokenLayer, MintedTokenLayer } from './token-source.js';

export type WorkspaceSource = 'figma' | 'code' | 'prompt' | 'json';

export interface WorkspaceEntry {
  id: string;
  /** Component/set display name (proposal setName, code component, contract name). */
  name: string;
  /** The contract's id at import time ('' when the text held none). */
  contractId: string;
  source: WorkspaceSource;
  /** The proposed contract text, verbatim as it landed in the editor. */
  contractText: string;
  /** The receipts that came WITH the import (notes/unbound/degradations), restored on load. */
  receipts: Receipts | null;
  /** Minted provisional token layer (degraded Figma imports) — re-registered
   *  on load so the entry's contract renders styled again. */
  mintedTokens?: MintedTokenLayer;
  /** Captured tokens (dump v1.4 `_variables` — the designer's real
   *  variables) — re-registered on load so real-name refs keep resolving. */
  capturedTokens?: CapturedTokenLayer;
  /** Auto-proposed child STUB contracts that rode the import (raw JSON,
   *  verbatim) — re-registered on load so composition refs keep resolving. */
  childStubs?: unknown[];
  /** Epoch ms. */
  importedAt: number;
}

export const WORKSPACE_CAP = 30;

const STORAGE_KEY = 'ds-playground.workspace';
const STORAGE_VERSION = 1;

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

const isSource = (v: unknown): v is WorkspaceSource =>
  v === 'figma' || v === 'code' || v === 'prompt' || v === 'json';

function loadStored(): WorkspaceEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { v?: unknown; entries?: unknown };
    if (parsed?.v !== STORAGE_VERSION || !Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter(
      (e): e is WorkspaceEntry =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as WorkspaceEntry).id === 'string' &&
        typeof (e as WorkspaceEntry).name === 'string' &&
        typeof (e as WorkspaceEntry).contractText === 'string' &&
        typeof (e as WorkspaceEntry).importedAt === 'number' &&
        isSource((e as WorkspaceEntry).source),
    );
  } catch {
    return []; // unreadable stored state is dropped, not guessed at
  }
}

let entries: WorkspaceEntry[] = loadStored();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => entries;

/** Imperative snapshot for non-React consumers (session-registry.ts). */
export const workspaceSnapshot = (): WorkspaceEntry[] => entries;

/** React binding — newest first. */
export function useWorkspace(): WorkspaceEntry[] {
  return useSyncExternalStore(subscribe, snapshot);
}

/** Persist; a refused write is NAMED to the caller, never swallowed. */
function persist(): string | null {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, entries }));
    return null;
  } catch (e) {
    return `workspace-storage-refused: sessionStorage rejected the write (${
      e instanceof Error ? e.message : String(e)
    }) — this session's workspace lives in memory only.`;
  }
}

export interface RecordImportInput {
  name: string;
  contractId: string;
  source: WorkspaceSource;
  contractText: string;
  receipts: Receipts | null;
  mintedTokens?: MintedTokenLayer;
  capturedTokens?: CapturedTokenLayer;
  childStubs?: unknown[];
}

export interface RecordImportResult {
  entry: WorkspaceEntry;
  /** The input receipts, plus a Workspace note group when the record had
   *  something to say (eviction, storage refusal). Show THESE. */
  receipts: Receipts | null;
}

/** Drawn identity survives display-name changes and different import doors.
 * Old stored entries need no migration: derive the key from their own contract. */
function importIdentity(input: Pick<RecordImportInput, 'source' | 'name' | 'contractText'>): string {
  if (input.source === 'figma' || input.source === 'json') {
    try {
      const anchor = JSON.parse(input.contractText)?.bindings?.figma?.anchors;
      if (typeof anchor?.fileKey === 'string' && anchor.fileKey) {
        if (typeof anchor.nodeId === 'string' && anchor.nodeId) return JSON.stringify(['figma-node', anchor.fileKey, anchor.nodeId]);
        if (typeof anchor.componentSetKey === 'string' && anchor.componentSetKey) return JSON.stringify(['figma-key', anchor.fileKey, anchor.componentSetKey]);
      }
    } catch { /* An unparseable entry is a display record, not an identity claim. */ }
  }
  return JSON.stringify([input.source, input.name]);
}

/** Record a complete import family atomically. Input order is retained, so
 * the entry component stays first. Refuse an oversized family before changing
 * the workspace rather than evicting one of its dependencies during import. */
export function recordImports(inputs: RecordImportInput[]): RecordImportResult[] {
  if (inputs.length > WORKSPACE_CAP) {
    throw new Error(`workspace-import-too-large: ${inputs.length} components exceed the session limit of ${WORKSPACE_CAP}; no components were imported.`);
  }
  const identities = new Set<string>();
  for (const input of inputs) {
    const identity = importIdentity(input);
    if (identities.has(identity)) throw new Error(`workspace-duplicate-import: ${input.name} (${input.source}); no components were imported.`);
    identities.add(identity);
  }
  if (inputs.length === 0) return [];
  const imported: WorkspaceEntry[] = inputs.map((input) => ({
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    contractId: input.contractId,
    source: input.source,
    contractText: input.contractText,
    receipts: input.receipts,
    ...(input.mintedTokens && input.mintedTokens.count > 0 ? { mintedTokens: input.mintedTokens } : {}),
    ...(input.capturedTokens && input.capturedTokens.count > 0 ? { capturedTokens: input.capturedTokens } : {}),
    ...(input.childStubs && input.childStubs.length > 0 ? { childStubs: input.childStubs } : {}),
    importedAt: Date.now(),
  }));
  const notes: string[] = [];
  const kept = entries.filter((e) => !identities.has(importIdentity(e)));
  const next = [...imported, ...kept];
  if (next.length > WORKSPACE_CAP) {
    for (const old of next.splice(WORKSPACE_CAP)) {
      notes.push(`workspace: evicted the oldest entry "${old.name}" (${old.source}) — the session keeps ${WORKSPACE_CAP}.`);
    }
  }
  entries = next;
  const storageNote = persist();
  if (storageNote) notes.push(storageNote);
  notify();
  const group: ReceiptGroup = {
    title: 'Workspace',
    kind: 'note',
    entries: notes.map((message) => ({ message })),
  };
  return imported.map((entry) => ({
    entry,
    receipts: notes.length === 0 ? entry.receipts : {
      source: entry.receipts?.source ?? 'workspace',
      groups: [...(entry.receipts?.groups ?? []), group],
    },
  }));
}

/** A single import uses the same atomic store path. */
export function recordImport(input: RecordImportInput): RecordImportResult {
  return recordImports([input])[0];
}

export function removeWorkspaceEntry(id: string): void {
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return;
  entries = next;
  persist();
  notify();
}

export function clearWorkspace(): void {
  entries = [];
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore — memory state is already cleared */
  }
  notify();
}
