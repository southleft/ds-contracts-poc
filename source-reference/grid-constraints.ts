/** Current browser-resolved grid constraints, distinct from used pixel tracks.
 * This observes one source context; it does not infer responsive rules, source
 * ownership or native support from a visually equivalent declaration. */
import type { Page } from 'playwright-core';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { flatten, type CapturedNode } from '../extract/computed/lib.js';

export const gridConstraintChannels = [
  'grid-template-columns', 'grid-template-rows', 'grid-template-areas',
  'grid-auto-columns', 'grid-auto-rows', 'grid-auto-flow',
  'justify-content', 'align-content', 'justify-items', 'align-items',
  'row-gap', 'column-gap',
] as const;
type GridValues = Record<typeof gridConstraintChannels[number], string>;
export interface GridConstraintEvidence {
  version: 1;
  treeRevision: string;
  status: 'observed' | 'refused';
  rows: Array<{ path: string; tag: string; computed: GridValues; used: GridValues }>;
  problems: string[];
}
const gridNodes = (tree: CapturedNode) => flatten(tree).filter(({ node }) =>
  ['grid', 'inline-grid'].includes(node.style.display));

/** CSS Typed OM returns computed tracks before layout turns them into pixels.
 * Read both planes twice and require correspondence with the captured tree.
 * No fallback to used pixels: missing Typed OM stays a named failure. */
export async function observeGridConstraints(page: Page, selectors: string[], tree: CapturedNode): Promise<GridConstraintEvidence> {
  const out: GridConstraintEvidence = { version: 1, treeRevision: revisionOf(tree), status: 'refused', rows: [], problems: [] };
  try {
    const nodes = gridNodes(tree);
    const read = () => page.evaluate(({ selectors, nodes, channels }) => {
      let scope: Document | ShadowRoot | null = document, root: Element | null = null;
      for (const selector of selectors) { root = scope?.querySelector(selector) ?? null; scope = root?.shadowRoot ?? null; }
      if (!root) throw Error('grid-constraints-root-missing');
      return nodes.map(({ path, tag, display }) => {
        let element: Element | null = root;
        for (const index of path === '' ? [] : path.split('.').map(Number)) element = element?.children[index] ?? null;
        if (!element || element.localName !== tag) throw Error('grid-constraints-path-changed');
        const style = getComputedStyle(element);
        if (style.display !== display) throw Error('grid-constraints-display-changed');
        if (element.getAnimations().length) throw Error('grid-constraints-animated-source');
        // Keep the type local: TS DOM declarations do not expose Typed OM on
        // every Element, while Chromium does. Feature absence must refuse.
        const typed = (element as Element & { computedStyleMap?: () => { get(name: string): { toString(): string } | undefined } }).computedStyleMap?.();
        if (!typed) throw Error('grid-constraints-typed-om-unavailable');
        const computed = Object.fromEntries(channels.map(channel => [channel, typed.get(channel)?.toString().trim() ?? '']));
        if (Object.values(computed).some(value => !value)) throw Error('grid-constraints-computed-value-missing');
        const used = Object.fromEntries(channels.map(channel => [channel, style.getPropertyValue(channel).trim()]));
        return { path, tag, computed, used };
      });
    }, { selectors, nodes: nodes.map(({ path, node }) => ({ path, tag: node.tag, display: node.style.display })), channels: [...gridConstraintChannels] });
    const first = await read();
    if (canonicalJson(first) !== canonicalJson(await read())) throw Error('grid-constraints-source-changed-during-read');
    out.rows = first as GridConstraintEvidence['rows'];
    out.status = 'observed';
    verifiedGridConstraints(tree, out);
  } catch (error) {
    out.status = 'refused'; out.rows = [];
    out.problems.push(error instanceof Error ? error.message : 'grid-constraints-read-failed');
  }
  return out;
}

/** The caller must authenticate the saved inspection's inventory as well.
 * These checks establish coverage and correspondence, not CSS provenance. */
export function verifiedGridConstraints(tree: CapturedNode, evidence: GridConstraintEvidence): GridConstraintEvidence['rows'] {
  if (evidence.version !== 1 || evidence.status !== 'observed' || evidence.problems.length || evidence.treeRevision !== revisionOf(tree))
    throw Error('grid-constraints-evidence-changed');
  const nodes = gridNodes(tree), keys = [...gridConstraintChannels].sort().join(',');
  if (nodes.length !== evidence.rows.length) throw Error('grid-constraints-coverage-changed');
  nodes.forEach(({ path, node }, i) => {
    const row = evidence.rows[i];
    if (row.path !== path || row.tag !== node.tag || !row.computed || !row.used ||
        Object.keys(row.computed).sort().join(',') !== keys || Object.keys(row.used).sort().join(',') !== keys ||
        gridConstraintChannels.some(channel => typeof row.computed[channel] !== 'string' || !row.computed[channel].trim() ||
          row.used[channel] !== node.style[channel])) throw Error('grid-constraints-source-changed');
  });
  return structuredClone(evidence.rows);
}
