import type { Page } from 'playwright-core';
import type { CapturedNode } from '../extract/computed/lib.js';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';

export interface SvgViewportEvidence {
  version: 1;
  treeRevision: string;
  status: 'observed' | 'refused';
  rows: Array<{ path: number[]; width: string; height: string; viewport: NonNullable<CapturedNode['svgViewport']> }>;
  problems: string[];
}
function svgNodes(tree: CapturedNode) {
  const rows: Array<{ path: number[]; node: CapturedNode }> = [];
  const walk = (node: CapturedNode, path: number[]) => {
    if (node.tag === 'svg') rows.push({ path, node });
    node.nodes.filter(c => c.t === 'el').forEach((c, i) => { if (c.t === 'el') walk(c.el, [...path, i]); });
  };
  walk(tree, []); return rows;
}
export async function observeSvgViewports(page: Page, selectors: string[], tree: CapturedNode): Promise<SvgViewportEvidence> {
  const result: SvgViewportEvidence = { version: 1, treeRevision: revisionOf(tree), status: 'refused', rows: [], problems: [] };
  try {
    for (const { path, node } of svgNodes(tree)) {
      const read = () => page.evaluate(({ selectors, path }) => {
        let scope: Document | ShadowRoot | null = document, element: Element | null = null;
        for (const selector of selectors) { element = scope?.querySelector(selector) ?? null; scope = element?.shadowRoot ?? null; }
        for (const i of path) element = element?.children[i] ?? null;
        if (!(element instanceof SVGSVGElement) || !element.hasAttribute('viewBox')) return null;
        const box = element.viewBox.baseVal, style = getComputedStyle(element);
        return { width: style.width, height: style.height, viewport: {
          viewBox: [box.x, box.y, box.width, box.height], preserveAspectRatio: element.getAttribute('preserveAspectRatio')?.trim() || 'xMidYMid meet',
        } };
      }, { selectors, path });
      const observed = await read();
      if (!observed || observed.width !== node.style.width || observed.height !== node.style.height || canonicalJson(observed) !== canonicalJson(await read()))
        throw Error('svg-viewport-source-unavailable-or-changed');
      const box = observed.viewport.viewBox;
      if (box.length !== 4 || box.some(n => !Number.isFinite(n) || Math.abs(n) > 1e6) || box[2] <= 0 || box[3] <= 0)
        throw Error('svg-viewport-invalid');
      result.rows.push({ path, width: observed.width, height: observed.height,
        viewport: { viewBox: box as [number, number, number, number], preserveAspectRatio: observed.viewport.preserveAspectRatio } });
    }
    result.status = 'observed';
  } catch (error) { result.problems.push(error instanceof Error ? error.message : 'svg-viewport-reader-failed'); }
  return result;
}
export function verifiedSvgViewports(tree: CapturedNode, evidence: SvgViewportEvidence): SvgViewportEvidence['rows'] {
  if (evidence.version !== 1 || evidence.status !== 'observed' || evidence.problems.length || evidence.treeRevision !== revisionOf(tree))
    throw Error('svg-viewport-evidence-changed');
  const nodes = svgNodes(tree);
  if (nodes.length !== evidence.rows.length) throw Error('svg-viewport-coverage-changed');
  nodes.forEach(({ path, node }, i) => {
    const row = evidence.rows[i], box = row.viewport.viewBox;
    if (canonicalJson(path) !== canonicalJson(row.path) || row.width !== node.style.width || row.height !== node.style.height ||
        box.length !== 4 || box.some(n => !Number.isFinite(n) || Math.abs(n) > 1e6) || box[2] <= 0 || box[3] <= 0)
      throw Error('svg-viewport-source-changed');
  });
  return structuredClone(evidence.rows);
}
