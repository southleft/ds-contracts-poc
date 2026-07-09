/**
 * Lazy Prism — syntax colors for the read-only output panes and the JSON
 * editor backdrop. The grammars ride ONE dynamic chunk (prism-bundle.ts),
 * fetched the first time anything wants colors; until it lands everything
 * renders plain and nothing blocks. No stock theme CSS ever loads — the
 * playground styles Prism's token class names itself, on its own variables,
 * so both themes work (see the `.code-hl` rules in styles.css).
 */

export type PrismApi = typeof import('prismjs');

/** Files at or over this size stay plain (with a one-line note) —
 *  highlighting is synchronous and jank is worse than monochrome. */
export const HIGHLIGHT_LIMIT = 200_000;

import { reportIfChunkError } from './chunk-guard';

let loaded: PrismApi | null = null;
let loading: Promise<PrismApi> | null = null;

/** The already-loaded Prism, or null — callers render plain now, colored
 *  on the state update the load resolves into. */
export const prismNow = (): PrismApi | null => loaded;

export function loadPrism(): Promise<PrismApi> {
  if (!loading) {
    // Core reads these flags off a pre-existing global — set them before
    // the import so the auto-highlighter never touches the document.
    const scope = window as {
      Prism?: { manual?: boolean; disableWorkerMessageHandler?: boolean };
    };
    scope.Prism = { ...scope.Prism, manual: true, disableWorkerMessageHandler: true };
    loading = import('./prism-bundle').then(
      (m) => {
        loaded = m.default;
        return m.default;
      },
      (e) => {
        // Chunk 404 after a redeploy → the global banner; code stays plain.
        reportIfChunkError(e);
        loading = null;
        throw e;
      },
    );
  }
  return loading;
}

/** Grammar name for an emitted file path, or null (no colors for it). */
export function languageForPath(path: string): string | null {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'tsx':
      return 'tsx';
    case 'ts':
      return 'typescript';
    case 'jsx':
      return 'jsx';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript'; // the Figma script speaks plain js
    case 'css':
      return 'css';
    case 'html':
      return 'markup';
    case 'json':
      return 'json';
    default:
      return null;
  }
}

/** Highlight `code` as `lang`, or null when the grammar is missing or the
 *  tokenizer throws — callers fall back to plain text, never crash. */
export function highlight(prism: PrismApi, code: string, lang: string): string | null {
  const grammar = prism.languages[lang];
  if (!grammar) return null;
  try {
    return prism.highlight(code, grammar, lang);
  } catch {
    return null;
  }
}
