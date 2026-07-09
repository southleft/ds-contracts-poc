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
 * One entry per (source, name): re-importing the same component refreshes
 * its entry instead of stacking duplicates.
 */
import { useSyncExternalStore } from 'react';
import type { ReceiptGroup, Receipts } from '../receipts.js';
import type { MintedTokenLayer } from './token-source.js';

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
}

export interface RecordImportResult {
  entry: WorkspaceEntry;
  /** The input receipts, plus a Workspace note group when the record had
   *  something to say (eviction, storage refusal). Show THESE. */
  receipts: Receipts | null;
}

/** A successful import lands in the workspace. Newest first, capped. */
export function recordImport(input: RecordImportInput): RecordImportResult {
  const entry: WorkspaceEntry = {
    id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name,
    contractId: input.contractId,
    source: input.source,
    contractText: input.contractText,
    receipts: input.receipts,
    ...(input.mintedTokens && input.mintedTokens.count > 0 ? { mintedTokens: input.mintedTokens } : {}),
    importedAt: Date.now(),
  };
  const notes: string[] = [];
  const kept = entries.filter((e) => !(e.source === input.source && e.name === input.name));
  const next = [entry, ...kept];
  if (next.length > WORKSPACE_CAP) {
    const evicted = next.splice(WORKSPACE_CAP);
    for (const old of evicted) {
      notes.push(
        `workspace: evicted the oldest entry "${old.name}" (${old.source}) — the session keeps ${WORKSPACE_CAP}.`,
      );
    }
  }
  entries = next;
  const storageNote = persist();
  if (storageNote) notes.push(storageNote);
  notify();

  if (notes.length === 0) return { entry, receipts: input.receipts };
  const group: ReceiptGroup = {
    title: 'Workspace',
    kind: 'note',
    entries: notes.map((message) => ({ message })),
  };
  return {
    entry,
    receipts: input.receipts
      ? { ...input.receipts, groups: [...input.receipts.groups, group] }
      : { source: 'workspace', groups: [group] },
  };
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
