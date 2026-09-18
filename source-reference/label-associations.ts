/** Native HTML associations are facts separate from computed appearance.
 * Observe them without changing the source. Only relationships wholly inside
 * the selected composition are admitted; external callers remain explicit. */
import type { Page } from 'playwright-core';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { flatten, type CapturedNode } from '../extract/computed/lib.js';

export interface LabelAssociationEvidence {
  version: 1;
  treeRevision: string;
  status: 'observed' | 'refused';
  rows: Array<{
    labelPath: string;
    controlPath: string;
    controlTag: string;
    mode: 'explicit' | 'implicit';
    sourceId: string;
    text: string;
  }>;
  problems: string[];
}

export async function observeLabelAssociations(page: Page, selectors: string[], tree: CapturedNode): Promise<LabelAssociationEvidence> {
  const out: LabelAssociationEvidence = { version: 1, treeRevision: revisionOf(tree), status: 'refused', rows: [], problems: [] };
  try {
    const nodes = flatten(tree).map(({ path, node }) => ({ path, tag: node.tag }));
    const observe = ({ selectors, nodes }: { selectors: string[]; nodes: Array<{ path: string; tag: string }> }) => {
      let scope: Document | ShadowRoot | null = document, root: Element | null = null;
      for (const selector of selectors) {
        if (!scope || scope.querySelectorAll(selector).length !== 1) throw Error('label-association-root-ambiguous');
        root = scope.querySelector(selector); scope = root?.shadowRoot ?? null;
      }
      if (!root) throw Error('label-association-root-missing');
      const elements = new Map<string, Element>(), paths = new Map<Element, string>();
      const walk = (element: Element, path: string) => {
        elements.set(path, element); paths.set(element, path);
        // Captured shadow/slot flattening needs its own relationship traversal.
        if (element.shadowRoot || element.localName === 'slot') throw Error('label-association-shadow-boundary-unsupported');
        [...element.children].forEach((child, i) => walk(child, path ? `${path}.${i}` : String(i)));
      };
      walk(root, '');
      if (elements.size !== nodes.length || nodes.some(node => elements.get(node.path)?.localName !== node.tag))
        throw Error('label-association-tree-changed');
      const rows: Array<{ labelPath: string; controlPath: string; controlTag: string; mode: 'explicit' | 'implicit'; sourceId: string; text: string }> = [];
      for (const [labelPath, element] of elements) {
        if (element instanceof HTMLLabelElement) {
          const control = element.control;
          if (!control) throw Error('label-association-control-missing');
          const controlPath = paths.get(control);
          if (controlPath === undefined) throw Error('label-association-control-outside-composition');
          const explicit = element.hasAttribute('for');
          if (explicit) {
            if (!element.htmlFor || element.htmlFor !== control.id) throw Error('label-association-id-mismatch');
            const ids = [...(control.getRootNode() as Document | ShadowRoot).querySelectorAll('[id]')].filter(node => node.id === control.id);
            if (ids.length !== 1 || ids[0] !== control) throw Error('label-association-id-ambiguous');
          } else if (!element.contains(control)) throw Error('label-association-implicit-containment-missing');
          rows.push({ labelPath, controlPath, controlTag: control.localName, mode: explicit ? 'explicit' : 'implicit',
            sourceId: explicit ? control.id : '', text: element.textContent ?? '' });
        }
        const labels = (element as Element & { labels?: NodeListOf<HTMLLabelElement> | null }).labels;
        if (labels && [...labels].some(label => !paths.has(label))) throw Error('label-association-label-outside-composition');
      }
      return rows;
    };
    // tsx may annotate nested function names. Keep its helper local to this
    // read expression; never install anything on the original page.
    const read = () => page.evaluate<LabelAssociationEvidence['rows']>(
      `(() => { const __name = value => value; return (${observe.toString()})(${JSON.stringify({ selectors, nodes })}); })()`,
    );
    const first = await read();
    if (canonicalJson(first) !== canonicalJson(await read())) throw Error('label-association-source-changed-during-read');
    out.rows = first; out.status = 'observed';
    verifiedLabelAssociations(tree, out);
  } catch (error) {
    out.status = 'refused'; out.rows = [];
    out.problems.push(error instanceof Error ? error.message : 'label-association-read-failed');
  }
  return out;
}

/** Authentication of the containing archive remains the host's responsibility.
 * The computed tree alone cannot prove a relationship that it never captured. */
export function verifiedLabelAssociations(tree: CapturedNode, evidence: LabelAssociationEvidence): LabelAssociationEvidence['rows'] {
  if (evidence.version !== 1 || evidence.status !== 'observed' || evidence.problems.length || evidence.treeRevision !== revisionOf(tree))
    throw Error('label-association-evidence-changed');
  const flat = flatten(tree), nodes = new Map(flat.map(({ path, node }) => [path, node]));
  const labels = flat.filter(({ node }) => node.tag === 'label');
  if (labels.length !== evidence.rows.length) throw Error('label-association-coverage-changed');
  const text = (node: CapturedNode): string => node.nodes.map(child => child.t === 'text' ? child.v : text(child.el)).join('');
  const ids = new Map<string, string>(), controls = new Map<string, string>();
  evidence.rows.forEach((row, i) => {
    const label = labels[i], control = nodes.get(row.controlPath);
    if (row.labelPath !== label.path || !control || row.controlTag !== control.tag ||
        !['button', 'input', 'meter', 'output', 'progress', 'select', 'textarea'].includes(control.tag) ||
        row.text !== text(label.node) || typeof row.sourceId !== 'string' ||
        (row.mode !== 'explicit' && row.mode !== 'implicit')) throw Error('label-association-source-changed');
    if (row.mode === 'explicit') {
      if (!row.sourceId || (ids.has(row.sourceId) && ids.get(row.sourceId) !== row.controlPath) ||
          (controls.has(row.controlPath) && controls.get(row.controlPath) !== row.sourceId))
        throw Error('label-association-id-ambiguous');
      ids.set(row.sourceId, row.controlPath); controls.set(row.controlPath, row.sourceId);
    } else if (row.sourceId || row.controlPath === row.labelPath ||
        (row.labelPath !== '' && !row.controlPath.startsWith(row.labelPath + '.')))
      throw Error('label-association-implicit-containment-missing');
  });
  return structuredClone(evidence.rows);
}
