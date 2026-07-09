/**
 * "Remember on this device" — OPT-IN persistence for the two secrets the
 * playground can hold: the Figma personal access token and the Anthropic
 * API key.
 *
 * The DEFAULT is unchanged: session-only module memory, gone on reload.
 * Each field offers a checkbox (off by default); only when the visitor
 * checks it does the value land in THIS BROWSER's localStorage, under its
 * own key, until the visitor clears it (the field shows a visible
 * "using remembered token — Clear" affordance while a remembered value is
 * in play). Values are never logged and never leave the browser except to
 * their own API (api.figma.com / api.anthropic.com).
 *
 * localStorage can be unavailable (private windows, storage-blocked
 * embeds) — every access degrades silently to session-only behavior.
 */

export const FIGMA_TOKEN_STORAGE_KEY = 'ds-playground.remembered-figma-token';
export const ANTHROPIC_KEY_STORAGE_KEY = 'ds-playground.remembered-anthropic-key';

export function readRememberedToken(storageKey: string): string | null {
  try {
    const v = window.localStorage.getItem(storageKey);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function rememberToken(storageKey: string, value: string): void {
  try {
    if (value.trim()) window.localStorage.setItem(storageKey, value);
  } catch {
    /* storage unavailable — stays session-only */
  }
}

export function clearRememberedToken(storageKey: string): void {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    /* nothing to clear */
  }
}
