/**
 * Live preview = the `html` emitter as the preview engine. The contract is
 * emitted to static HTML+CSS (core/emit-html.ts) and rendered inside a
 * sandboxed iframe via srcdoc, with the repo's generated token stylesheets
 * injected so every var(--…) resolves. Theme is the iframe's [data-theme] —
 * the same switch src/styles/tokens.dark.css keys on. Zero runtime TSX
 * compilation; works for ANY schema-valid contract, including imported ones.
 */
import { emitHtml, type Contract } from '../../../core/index.js';
import { icons, tokenInventory, tokenStylesheets } from './data.js';

export type PreviewResult =
  | { ok: true; doc: string }
  | { ok: false; error: string };

const FRAME_BODY_CSS = `
  html { color-scheme: light; }
  html[data-theme="dark"] { color-scheme: dark; }
  body {
    margin: 0;
    padding: 20px;
    background: var(--color-surface-background);
    color: var(--color-surface-foreground);
    font-family: var(--font-family-sans, system-ui, sans-serif);
  }
`;

export function buildPreview(
  contract: Contract,
  contracts: Map<string, Contract>,
  theme: 'light' | 'dark',
): PreviewResult {
  let emitted: { html: string; css: string };
  try {
    emitted = emitHtml(contract, { tokens: tokenInventory, icons, contracts });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const doc = [
    '<!doctype html>',
    `<html${theme === 'dark' ? ' data-theme="dark"' : ''}>`,
    '<head><meta charset="utf-8">',
    `<style>${tokenStylesheets.base}\n${tokenStylesheets.dark}\n${tokenStylesheets.brands}</style>`,
    `<style>${FRAME_BODY_CSS}</style>`,
    `<style>${emitted.css}</style>`,
    '</head><body>',
    emitted.html,
    '</body></html>',
  ].join('\n');
  return { ok: true, doc };
}
