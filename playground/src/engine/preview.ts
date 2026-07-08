/**
 * Live preview = the `html` emitter as the preview engine. The contract is
 * emitted to static HTML+CSS (core/emit-html.ts) and rendered inside a
 * sandboxed iframe via srcdoc, with the repo's generated token stylesheets
 * injected so every var(--…) resolves. Theme is the iframe's [data-theme] —
 * the same switch src/styles/tokens.dark.css keys on. Zero runtime TSX
 * compilation; works for ANY schema-valid contract, including imported ones.
 */
import { emitHtml, type Contract } from '../../../core/index.js';
import { icons } from './data.js';
import { activeTokens } from './token-source.js';

export type PreviewResult =
  | { ok: true; doc: string }
  | { ok: false; error: string };

const FRAME_BODY_CSS = `
  html { color-scheme: light; }
  html[data-theme="dark"] { color-scheme: dark; }
  body {
    margin: 0;
    padding: 20px;
    background: var(--color-surface-background, Canvas);
    color: var(--color-surface-foreground, CanvasText);
    font-family: var(--font-family-sans, system-ui, sans-serif);
  }
`;

export function buildPreview(
  contract: Contract,
  contracts: Map<string, Contract>,
  theme: 'light' | 'dark',
): PreviewResult {
  // The ACTIVE token source: repo stylesheets by default; a pasted user tree
  // swaps in a stylesheet regenerated from the paste (token-source.ts).
  const { inventory, stylesheets } = activeTokens();
  let emitted: { html: string; css: string };
  try {
    emitted = emitHtml(contract, { tokens: inventory, icons, contracts });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const doc = [
    '<!doctype html>',
    `<html${theme === 'dark' ? ' data-theme="dark"' : ''}>`,
    '<head><meta charset="utf-8">',
    `<style>${stylesheets.base}\n${stylesheets.dark}\n${stylesheets.brands}</style>`,
    `<style>${FRAME_BODY_CSS}</style>`,
    `<style>${emitted.css}</style>`,
    '</head><body>',
    emitted.html,
    '</body></html>',
  ].join('\n');
  return { ok: true, doc };
}
