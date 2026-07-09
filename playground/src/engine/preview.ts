/**
 * Live preview = the `html` emitter as the preview engine. The contract is
 * emitted to static HTML+CSS (core/emit-html.ts) and rendered inside a
 * sandboxed iframe via srcdoc, with the repo's generated token stylesheets
 * injected so every var(--…) resolves. The backdrop is a neutral canvas
 * SURFACE (PreviewSurface, Figma-style, independent of the app theme); the
 * 'dark' surface also sets the iframe's [data-theme] — the same switch
 * src/styles/tokens.dark.css keys on. Zero runtime TSX
 * compilation; works for ANY schema-valid contract, including imported ones.
 */
import { emitHtml, type Contract } from '../../../core/index.js';
import { icons } from './data.js';
import { activeTokens } from './token-source.js';

export type PreviewResult =
  | { ok: true; doc: string }
  | { ok: false; error: string };

/** Chosen prop values for the single-instance preview (canonical spellings). */
export type PreviewPropOverrides = Record<string, string | boolean | number>;

export type StatePreviewResult =
  | { ok: true; doc: string; instanceHtml: string | null }
  | { ok: false; error: string };

/**
 * The canvas SURFACE behind the rendered component — a neutral backdrop like
 * Figma's, deliberately independent of the app theme (a dark-styled import
 * must never vanish dark-on-dark just because the app chrome is dark).
 * 'dark' also flips the token mode ([data-theme="dark"]) so mode-aware
 * tokens render their dark values against the dark surface; 'checker' keeps
 * light tokens over a transparency checkerboard.
 */
export type PreviewSurface = 'light' | 'dark' | 'checker';

const SURFACE_CSS: Record<PreviewSurface, string> = {
  light: 'background: #f5f5f5; color: #1a1a1a;',
  dark: 'background: #2c2c2c; color: #e6e6e6;',
  checker: [
    'background-color: #ffffff;',
    'background-image: conic-gradient(#e4e4e4 0 25%, transparent 0 50%, #e4e4e4 0 75%, transparent 0);',
    'background-size: 16px 16px;',
    'color: #1a1a1a;',
  ].join(' '),
};

const frameBodyCss = (surface: PreviewSurface) => `
  html { color-scheme: light; }
  html[data-theme="dark"] { color-scheme: dark; }
  body {
    margin: 0;
    padding: 20px;
    ${SURFACE_CSS[surface]}
    font-family: var(--font-family-sans, system-ui, sans-serif);
  }
`;

function assembleDoc(
  emitted: { html: string; css: string },
  surface: PreviewSurface,
  extraCss = '',
): string {
  const { stylesheets } = activeTokens();
  return [
    '<!doctype html>',
    `<html${surface === 'dark' ? ' data-theme="dark"' : ''}>`,
    '<head><meta charset="utf-8">',
    `<style>${stylesheets.base}\n${stylesheets.dark}\n${stylesheets.brands}</style>`,
    `<style>${frameBodyCss(surface)}</style>`,
    `<style>${emitted.css}</style>`,
    ...(extraCss ? [`<style>${extraCss}</style>`] : []),
    '</head><body>',
    emitted.html,
    '</body></html>',
  ].join('\n');
}

export function buildPreview(
  contract: Contract,
  contracts: Map<string, Contract>,
  surface: PreviewSurface,
): PreviewResult {
  // The ACTIVE token source: repo stylesheets by default; a pasted user tree
  // swaps in a stylesheet regenerated from the paste (token-source.ts).
  const { inventory } = activeTokens();
  let emitted: { html: string; css: string };
  try {
    emitted = emitHtml(contract, { tokens: inventory, icons, contracts });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  return { ok: true, doc: assembleDoc(emitted, surface) };
}

// ---------------------------------------------------------------------------
// Single-instance preview at a chosen prop state
// ---------------------------------------------------------------------------

/** The chosen values written in as the CLONE's prop defaults — the emitter's
 *  own "default" showcase item then IS the requested state. The real emitter
 *  renders every state; core/ stays untouched. */
function withOverridesAsDefaults(contract: Contract, overrides: PreviewPropOverrides): Contract {
  const clone = structuredClone(contract);
  for (const prop of clone.props) {
    if (prop.name in overrides) prop.default = overrides[prop.name];
  }
  return clone;
}

/** CSS appended to the showcase doc so ONLY the first item (the chosen
 *  state) renders — the other items stay in the markup, just hidden. */
const SINGLE_ITEM_CSS = `
  .showcase > .showcase__item:nth-child(n + 2) { display: none; }
  .showcase__label { display: none; }
`;

/** The first showcase item's inner markup, label stripped — the comparison
 *  signature for "did this control change anything visible?". Markup is the
 *  whole story: the emitted CSS is state-independent (every enum value is
 *  compiled up front), so identical markup means an identical render. */
function instanceSignature(html: string): string | null {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const item = doc.querySelector('.showcase__item');
    if (!item) return null;
    item.querySelector('.showcase__label')?.remove();
    return item.innerHTML.trim();
  } catch {
    return null;
  }
}

/** Live preview of ONE instance at a chosen prop state. Same pipeline as
 *  buildPreview — emitHtml over the active tokens — with the chosen values
 *  substituted as defaults (see withOverridesAsDefaults) and the showcase
 *  narrowed to its first item by CSS. */
export function buildPreviewAtState(
  contract: Contract,
  contracts: Map<string, Contract>,
  surface: PreviewSurface,
  overrides: PreviewPropOverrides,
): StatePreviewResult {
  const { inventory } = activeTokens();
  let emitted: { html: string; css: string };
  try {
    emitted = emitHtml(withOverridesAsDefaults(contract, overrides), {
      tokens: inventory,
      icons,
      contracts,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  return {
    ok: true,
    doc: assembleDoc(emitted, surface, SINGLE_ITEM_CSS),
    instanceHtml: instanceSignature(emitted.html),
  };
}
