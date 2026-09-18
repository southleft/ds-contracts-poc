/** Painted font evidence for observed light-DOM text. CSS family names may be
 * aliases; only the browser's actual glyph font can select a native family.
 * The host must authenticate the surrounding source capture and resource bytes.
 */
import type { Page } from 'playwright-core';
import type { CapturedNode } from '../extract/computed/lib.js';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';

export interface TextFontEvidence {
  version: 1;
  treeRevision: string;
  status: 'observed' | 'refused';
  rows: Array<{
    path: number[];
    text: string;
    cssFamily: string;
    cssWeight: string;
    cssStyle: string;
    fonts: Array<{ familyName: string; postScriptName: string; isCustomFont: boolean; glyphCount: number }>;
  }>;
  problems: string[];
}

function textNodes(tree: CapturedNode) {
  const rows: Array<{ path: number[]; node: CapturedNode }> = [];
  function walk(node: CapturedNode, path: number[]) {
    if (node.nodes.some(c => c.t === 'text' && /[^\t\n\f\r ]/.test(c.v))) rows.push({ path, node });
    node.nodes.filter(c => c.t === 'el').forEach((c, i) => { if (c.t === 'el') walk(c.el, [...path, i]); });
  }
  walk(tree, []);
  return rows;
}

/** No style changes, font replacement, synthetic glyph probes or source edits.
 * Shadow-distributed/flattened trees refuse unless their DOM correspondence is
 * explicitly available; this reader currently admits ordinary React DOM trees.
 */
export async function observeTextFonts(page: Page, selectors: string[], tree: CapturedNode): Promise<TextFontEvidence> {
  const result: TextFontEvidence = { version: 1, treeRevision: revisionOf(tree), status: 'refused', rows: [], problems: [] };
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    await session.send('DOM.getDocument');
    const locate = (path: number[]) => `let scope = document, element = null;
      for (const selector of ${JSON.stringify(selectors)}) { element = scope?.querySelector(selector); scope = element?.shadowRoot; }
      for (const index of ${JSON.stringify(path)}) element = element?.children[index];`;
    const totals = new Map<string, TextFontEvidence['rows'][number]['fonts']>();
    const readTotals = async (path: number[]) => {
      const key = canonicalJson(path), cached = totals.get(key);
      if (cached) return cached;
      const object = await session.send('Runtime.evaluate', { expression: `(() => { ${locate(path)} return element; })()`, objectGroup: 'dsc-text-fonts' });
      if (!object.result.objectId) throw Error('text-font-node-unavailable');
      const { nodeId } = await session.send('DOM.requestNode', { objectId: object.result.objectId });
      const read = async () => (await session.send('CSS.getPlatformFontsForNode', { nodeId })).fonts
        .filter(f => f.glyphCount > 0).map(({ familyName, postScriptName, isCustomFont, glyphCount }) => ({ familyName, postScriptName, isCustomFont, glyphCount }))
        .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
      const fonts = await read();
      if (canonicalJson(fonts) !== canonicalJson(await read())) throw Error('text-font-paint-unavailable-or-unstable');
      totals.set(key, fonts);
      return fonts;
    };
    for (const { path, node } of textNodes(tree)) {
      const expected = { tag: node.tag, text: node.nodes.filter(c => c.t === 'text').map(c => c.v).join(''),
        cssFamily: node.style['font-family'], cssWeight: node.style['font-weight'], cssStyle: node.style['font-style'],
        childTags: node.nodes.flatMap(c => c.t === 'el' ? [c.el.tag] : []) };
      const checked = await session.send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
        ${locate(path)}
        if (!element || element.shadowRoot || element.localName === 'slot') return null;
        const style = getComputedStyle(element);
        return { tag: element.localName, text: [...element.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join(''),
          cssFamily: style.fontFamily, cssWeight: style.fontWeight, cssStyle: style.fontStyle,
          childTags: [...element.children].map(c => c.localName) };
      })()` });
      if (canonicalJson(checked.result.value) !== canonicalJson(expected)) throw Error('text-font-source-node-changed');
      // Chromium includes descendant glyphs in this census. Subtract each
      // immediate element's full census so its face cannot contaminate the
      // direct text's mapping. Keep faces distinct by their actual identity.
      const fontKey = (f: TextFontEvidence['rows'][number]['fonts'][number]) => canonicalJson([f.familyName, f.postScriptName, f.isCustomFont]);
      const own = new Map((await readTotals(path)).map(f => [fontKey(f), { ...f }]));
      for (let i = 0; i < expected.childTags.length; i++) for (const child of await readTotals([...path, i])) {
        const parent = own.get(fontKey(child));
        if (!parent || parent.glyphCount < child.glyphCount) throw Error('text-font-descendant-census-inconsistent');
        parent.glyphCount -= child.glyphCount;
      }
      const fonts = [...own.values()].filter(f => f.glyphCount > 0);
      if (!fonts.length) throw Error('text-font-paint-unavailable-or-unstable');
      result.rows.push({ path, text: expected.text, cssFamily: expected.cssFamily, cssWeight: expected.cssWeight, cssStyle: expected.cssStyle, fonts });
    }
    result.status = 'observed';
  } catch (error) {
    result.problems.push(error instanceof Error && error.message.startsWith('text-font-') ? error.message : 'text-font-reader-failed');
  } finally {
    await session.send('Runtime.releaseObjectGroup', { objectGroup: 'dsc-text-fonts' }).catch(() => {});
    await session.detach();
  }
  return result;
}

/** Resolve only text-bearing nodes, leaving the archived source untouched.
 * Mixed glyph families need per-run ranges; choosing one would erase fallback
 * content. This mapping does not certify native font metrics or visual fidelity.
 */
export function withPaintedTextFonts(tree: CapturedNode, evidence: TextFontEvidence): CapturedNode {
  if (!evidence || evidence.version !== 1 || evidence.status !== 'observed' || evidence.problems.length ||
      evidence.treeRevision !== revisionOf(tree)) throw Error('text-font-evidence-changed');
  const output = structuredClone(tree), nodes = textNodes(output);
  if (nodes.length !== evidence.rows.length) throw Error('text-font-coverage-changed');
  nodes.forEach(({ path, node }, i) => {
    const row = evidence.rows[i];
    if (canonicalJson(row.path) !== canonicalJson(path) ||
        row.text !== node.nodes.filter(c => c.t === 'text').map(c => c.v).join('') ||
        row.cssFamily !== node.style['font-family'] || row.cssWeight !== node.style['font-weight'] || row.cssStyle !== node.style['font-style'])
      throw Error('text-font-source-node-changed');
    const families = [...new Set(row.fonts.filter(f => Number.isInteger(f.glyphCount) && f.glyphCount > 0).map(f => f.familyName))];
    if (families.length !== 1 || !/^[\w -]+$/.test(families[0]) || row.fonts.some(f => !Number.isInteger(f.glyphCount) || f.glyphCount <= 0))
      throw Error('text-font-mixed-or-unreadable-family');
    node.style['font-family'] = JSON.stringify(families[0]);
  });
  return output;
}
