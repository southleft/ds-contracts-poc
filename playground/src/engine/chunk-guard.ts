/**
 * Chunk-failure recovery. The playground lazy-loads its heavy chunks (the
 * TypeScript compiler, prettier, Prism, demo fixtures); a redeploy between
 * page load and first use makes those hashed chunk URLs 404, and the raw
 * failure ("Failed to fetch dynamically imported module …") is developer
 * noise, not information. This store turns that one condition into one calm
 * banner: "the playground was updated — reload".
 *
 * Two feeds, same store:
 *   · Vite's `vite:preloadError` window event (preloaded deps of a chunk),
 *   · `reportIfChunkError(e)` in every `await import()` catch site — returns
 *     true when the error was a chunk-load failure so the caller can skip its
 *     own inline error (the banner is the message; no raw red text).
 */
import { useSyncExternalStore } from 'react';

let failed = false;
const listeners = new Set<() => void>();

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function reportChunkFailure(): void {
  if (failed) return;
  failed = true;
  listeners.forEach((fn) => fn());
}

/** True when the error is a dynamic-import/chunk-load failure (the wording
 *  varies per browser — all of these are the same stale-deploy condition). */
export function isChunkLoadError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to load module script|ChunkLoadError|Unable to preload CSS/i.test(
    message,
  );
}

/** Report iff the error is a chunk-load failure; returns whether it was —
 *  callers suppress their own raw error display when true. */
export function reportIfChunkError(e: unknown): boolean {
  if (!isChunkLoadError(e)) return false;
  reportChunkFailure();
  return true;
}

/** React binding for the banner. */
export function useChunkFailure(): boolean {
  return useSyncExternalStore(subscribe, () => failed);
}

// Vite fires this when a dynamic import's preloaded dependencies fail
// (typically after a redeploy). preventDefault stops Vite from throwing —
// the banner is the handling.
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reportChunkFailure();
  });
}
