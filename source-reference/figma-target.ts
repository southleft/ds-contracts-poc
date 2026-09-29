/** The Figma file the React journey writes to (Beta 1, docs/GOAL.md).
 *
 * A user starts the local app with DS_CONTRACTS_FIGMA_FILE set to a Figma
 * design link or file key, and new React operations target that file. Without
 * it, new operations target the owner's evaluation file, as before. Each
 * operation records its file when it is created and keeps it: changing the
 * setting later never moves an existing operation to another file. */

/** Owner-supplied evaluation file: the default when no file is configured. */
export const DEFAULT_REACT_FIGMA_FILE_KEY = 'T56aKuRnoay1L7CKAjSWRO';

const KEY = /^[A-Za-z0-9]{10,64}$/;
/** figma.com/design/<key>/…, /file/<key>/…, /proto/<key>/… or a bare key. */
export function parseFigmaFileKey(value: string): string {
  const text = value.trim();
  if (KEY.test(text)) return text;
  let url: URL;
  try { url = new URL(text); } catch { throw Error('figma-target-file-invalid'); }
  if (!/(^|\.)figma\.com$/.test(url.hostname)) throw Error('figma-target-file-invalid');
  const match = /^\/(?:design|file|proto|board)\/([A-Za-z0-9]{10,64})(?:\/|$)/.exec(url.pathname);
  if (!match) throw Error('figma-target-file-invalid');
  return match[1];
}

/** A recorded operation's file key is well formed. Which file a new
 * operation targets is decided only by reactFigmaFileKey(), never by a request. */
export const validFigmaFileKey = (key: unknown): key is string => typeof key === 'string' && KEY.test(key);

export function reactFigmaFileKey(env: Record<string, string | undefined> = process.env): string {
  const configured = env.DS_CONTRACTS_FIGMA_FILE;
  return configured && configured.trim() ? parseFigmaFileKey(configured) : DEFAULT_REACT_FIGMA_FILE_KEY;
}
