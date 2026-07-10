/**
 * Auto-proposed CHILD STUB contracts — an ADDITIONAL contract layer over the
 * repo's bundled set, exactly parallel to token-source.ts's minted layer.
 *
 * A design import whose nested instances reference components nobody has
 * imported ships STUB contracts alongside the proposal
 * (core/propose-figma.ts childStubs — field case: CBDS Button's ds.icon).
 * Without registration, every emitter refuses BY NAME ("ds.icon" … no
 * contract in scope) — the exact refusal the stub mechanism exists to
 * prevent. Registering the layer here rebinds validation and every preview
 * surface (validate.ts merges it into the contracts map), the layer is
 * per-loaded-contract (Playground calls setChildStubs on every load path),
 * and a workspace entry restores its own.
 *
 * Precedence is conservative: a stub NEVER overrides a repo contract or the
 * contract in the editor — it only fills ids that would otherwise refuse.
 */
import { useSyncExternalStore } from 'react';
import { ContractSchema, type Contract } from '../../../core/index.js';

export interface ChildStubLayer {
  /** Schema-parsed stubs, by id. */
  stubs: Map<string, Contract>;
  /** The raw JSON as it arrived (persisted verbatim in the workspace). */
  raw: unknown[];
}

let layer: ChildStubLayer | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const activeChildStubs = (): ChildStubLayer | null => layer;

export interface SetChildStubsResult {
  registered: Contract[];
  /** Refusals, named — a stub that fails the schema is dropped BY NAME. */
  refused: string[];
}

/** Register (or clear) the provisional child-stub layer. Playground calls
 *  this on every load path so the layer always belongs to the contract on
 *  screen. */
export function setChildStubs(raw: unknown[] | null): SetChildStubsResult {
  const registered: Contract[] = [];
  const refused: string[] = [];
  if (!raw || raw.length === 0) {
    if (layer !== null) {
      layer = null;
      notify();
    }
    return { registered, refused };
  }
  const stubs = new Map<string, Contract>();
  const kept: unknown[] = [];
  for (const item of raw) {
    const parsed = ContractSchema.safeParse(item);
    if (parsed.success) {
      stubs.set(parsed.data.id, parsed.data);
      registered.push(parsed.data);
      kept.push(item);
    } else {
      const id = (item as { id?: unknown })?.id;
      refused.push(
        `child stub ${typeof id === 'string' ? `"${id}"` : '(unnamed)'} failed the contract schema and was NOT registered: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      );
    }
  }
  layer = stubs.size > 0 ? { stubs, raw: kept } : null;
  notify();
  return { registered, refused };
}

export function subscribeChildStubs(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** React binding — consumers re-render when the layer changes. */
export function useChildStubs(): ChildStubLayer | null {
  return useSyncExternalStore(subscribeChildStubs, activeChildStubs);
}
