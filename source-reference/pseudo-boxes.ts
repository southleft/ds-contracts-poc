/** Independent geometry for observed empty absolute pseudo-elements.
 * The host must authenticate this evidence with the surrounding source archive.
 * Measured boxes establish neither authored sizing nor responsive ownership. */
import type { Page } from 'playwright-core';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { normalizeValue, type CapturedNode } from '../extract/computed/lib.js';
import { unpaintedPseudoBox } from '../extract/computed/unpainted-pseudo.js';
import { cssBoxFromNative } from '../core/absolute-box.js';

type Box = { x: number; y: number; width: number; height: number };
type Pseudo = '::before' | '::after';
export interface PseudoBoxEvidence {
  version: 1;
  treeRevision: string;
  status: 'observed' | 'refused';
  rows: Array<{
    path: number[];
    pseudo: Pseudo;
    styleRevision: string;
    host: { width: number; height: number };
    /** Both boxes use the host's outer border origin. */
    padding: Box;
    box: Box;
  }>;
  problems: string[];
}

function candidates(tree: CapturedNode) {
  const rows: Array<{ path: number[]; node: CapturedNode; pseudo: Pseudo }> = [];
  let count = 0;
  const walk = (node: CapturedNode, path: number[]) => {
    if (++count > 10_000) throw Error('pseudo-box-scope-too-large');
    for (const pseudo of ['::before', '::after'] as const)
      if (unpaintedPseudoBox(node.style, node.pseudo[pseudo])) rows.push({ path, node, pseudo });
    node.nodes.filter(c => c.t === 'el').forEach((c, i) => walk(c.el, [...path, i]));
  };
  walk(tree, []);
  if (rows.length > 1_000) throw Error('pseudo-box-scope-too-large');
  return rows;
}
export const hasUnpaintedPseudoBoxes = (tree: CapturedNode) => candidates(tree).length > 0;

/** Fixed observed geometry in the existing CSS contract vocabulary. This is
 * not an authored inset/stretch rule and must not become one on a size edit. */
export function observedPseudoGeometry(row: PseudoBoxEvidence['rows'][number]) {
  const { host, padding, box } = row;
  const css = cssBoxFromNative({ ...box, right: host.width - box.x - box.width,
    bottom: host.height - box.y - box.height }, { left: padding.x, top: padding.y,
    right: host.width - padding.x - padding.width, bottom: host.height - padding.y - padding.height });
  return { width: css.width, height: css.height, left: css.x, top: css.y };
}
const normalized = (style: Record<string, string>) => Object.fromEntries(Object.entries(style).map(([k, v]) => [k, normalizeValue(v)]));
const styleRevision = (node: CapturedNode, pseudo: Pseudo) => revisionOf({ host: normalized(node.style), pseudo: normalized(node.pseudo[pseudo]!) });
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e6;
function quadBox(q: number[]): Box {
  if (q.length !== 8 || !q.every(finite) || q[0] !== q[6] || q[2] !== q[4] || q[1] !== q[3] || q[5] !== q[7] ||
      q[2] <= q[0] || q[5] <= q[1]) throw Error('pseudo-box-coordinate-space-unqualified');
  return { x: q[0], y: q[1], width: q[2] - q[0], height: q[5] - q[1] };
}
const relative = (box: Box, host: Box): Box => ({ ...box, x: box.x - host.x, y: box.y - host.y });
const validBox = (box: Box) => !!box && [box.x, box.y, box.width, box.height].every(finite) && box.width > 0 && box.height > 0;

/** Light DOM only. Protocol pseudo IDs prove which host owns the measured
 * box; quads preserve fractions which getBoxModel's scalar sizes discard. */
export async function observePseudoBoxes(page: Page, selectors: string[], tree: CapturedNode): Promise<PseudoBoxEvidence> {
  const result: PseudoBoxEvidence = { version: 1, treeRevision: revisionOf(tree), status: 'refused', rows: [], problems: [] };
  const session = await page.context().newCDPSession(page);
  try {
    const rows = candidates(tree);
    if (selectors.length !== 1 || !selectors[0]) throw Error('pseudo-box-light-dom-required');
    await session.send('DOM.enable');
    await session.send('DOM.getDocument');
    for (const { path, node, pseudo } of rows) {
      const locate = `const roots=document.querySelectorAll(${JSON.stringify(selectors[0])}); let element=roots.length===1?roots[0]:null;
        for(const index of ${JSON.stringify(path)}) element=element?.children[index];`;
      const read = async () => {
        const rootObject = await session.send('Runtime.evaluate', { expression: `(() => {
          const roots=document.querySelectorAll(${JSON.stringify(selectors[0])});return roots.length===1?roots[0]:null;
        })()`, objectGroup: 'dsc-pseudo-boxes' });
        if (!rootObject.result.objectId) throw Error('pseudo-box-node-unavailable');
        const rootDescription = await session.send('DOM.describeNode', { objectId: rootObject.result.objectId, depth: -1, pierce: true });
        const object = await session.send('Runtime.evaluate', { expression: `(() => {${locate}return element;})()`, objectGroup: 'dsc-pseudo-boxes' });
        if (!object.result.objectId) throw Error('pseudo-box-node-unavailable');
        const described = await session.send('DOM.describeNode', { objectId: object.result.objectId, depth: 0, pierce: true });
        // Capture can flatten shadow distribution. Checking only the final
        // host misses a closed shadow ancestor that redistributes light DOM.
        const pending = [rootDescription.node]; let count = 0;
        while (pending.length) {
          const n = pending.pop()!;
          if (++count > 10_000) throw Error('pseudo-box-scope-too-large');
          if (n.shadowRoots?.length || n.contentDocument || n.nodeName === 'SLOT') throw Error('pseudo-box-light-dom-required');
          pending.push(...n.children ?? []);
        }
        let captured = tree, protocol = rootDescription.node;
        for (let depth = 0; depth <= path.length; depth++) {
          const children = captured.nodes.filter(c => c.t === 'el'), observed = (protocol.children ?? []).filter(n => n.nodeType === 1);
          if (protocol.localName !== captured.tag || canonicalJson(observed.map(n => n.localName)) !== canonicalJson(children.map(c => c.el.tag)))
            throw Error('pseudo-box-source-path-changed');
          if (depth < path.length) { captured = children[path[depth]].el; protocol = observed[path[depth]]; }
        }
        if (protocol.backendNodeId !== described.node.backendNodeId) throw Error('pseudo-box-source-path-changed');
        const pseudos = (described.node.pseudoElements ?? []).filter(n => n.pseudoType === pseudo.slice(2));
        if (pseudos.length !== 1) throw Error('pseudo-box-node-unavailable');
        const checked = await session.send('Runtime.callFunctionOn', { objectId: object.result.objectId, returnByValue: true,
          functionDeclaration: `function() {
            if(!this.isConnected || this.shadowRoot || this.localName==='slot') return null;
            if(window.visualViewport && window.visualViewport.scale!==1) return null;
            for(let n=this;n;n=n.parentElement) {
              const s=getComputedStyle(n);
              if(s.transform!=='none'||s.translate!=='none'||s.rotate!=='none'||s.scale!=='none'||s.perspective!=='none'||s.zoom!=='1'||n.scrollLeft||n.scrollTop) return null;
            }
            const read=(s,keys)=>Object.fromEntries(keys.map(k=>[k,s.getPropertyValue(k).trim()]));
            return {tag:this.localName,childTags:[...this.children].map(n=>n.localName),
              host:read(getComputedStyle(this),${JSON.stringify(Object.keys(node.style))}),
              pseudo:read(getComputedStyle(this,${JSON.stringify(pseudo)}),${JSON.stringify(Object.keys(node.pseudo[pseudo]!))})};
          }` });
        const witness = checked.result.value;
        if (!witness) throw Error('pseudo-box-coordinate-space-unqualified');
        if (witness.tag !== node.tag || canonicalJson(witness.childTags) !== canonicalJson(node.nodes.flatMap(c => c.t === 'el' ? [c.el.tag] : [])) ||
            canonicalJson(normalized(witness.host)) !== canonicalJson(normalized(node.style)) ||
            canonicalJson(normalized(witness.pseudo)) !== canonicalJson(normalized(node.pseudo[pseudo]!)))
          throw Error('pseudo-box-source-node-changed');
        const host = await session.send('DOM.getBoxModel', { backendNodeId: described.node.backendNodeId });
        const shape = await session.send('DOM.getBoxModel', { backendNodeId: pseudos[0].backendNodeId });
        return { rootId: rootDescription.node.backendNodeId, hostId: described.node.backendNodeId, pseudoId: pseudos[0].backendNodeId, witness,
          host: quadBox(host.model.border), padding: quadBox(host.model.padding), box: quadBox(shape.model.border) };
      };
      const first = await read(), second = await read();
      if (canonicalJson(first) !== canonicalJson(second)) throw Error('pseudo-box-source-unstable');
      result.rows.push({ path, pseudo, styleRevision: styleRevision(node, pseudo),
        host: { width: first.host.width, height: first.host.height }, padding: relative(first.padding, first.host), box: relative(first.box, first.host) });
    }
    verifiedPseudoBoxes(tree, { ...result, status: 'observed' });
    result.status = 'observed';
  } catch (error) { result.problems.push(error instanceof Error && error.message.startsWith('pseudo-box-') ? error.message : 'pseudo-box-reader-failed'); }
  finally {
    await session.send('Runtime.releaseObjectGroup', { objectGroup: 'dsc-pseudo-boxes' }).catch(() => {});
    await session.detach();
  }
  return result;
}

/** This checks structure and source correspondence. Archive authentication is
 * still required: a caller-provided numeric box is never write authority. */
export function verifiedPseudoBoxes(tree: CapturedNode, evidence: PseudoBoxEvidence): PseudoBoxEvidence['rows'] {
  if (!evidence || evidence.version !== 1 || evidence.status !== 'observed' || evidence.problems.length || evidence.treeRevision !== revisionOf(tree))
    throw Error('pseudo-box-evidence-changed');
  const rows = candidates(tree);
  if (rows.length !== evidence.rows.length) throw Error('pseudo-box-coverage-changed');
  rows.forEach(({ path, node, pseudo }, i) => {
    const row = evidence.rows[i];
    if (canonicalJson(row.path) !== canonicalJson(path) || row.pseudo !== pseudo || row.styleRevision !== styleRevision(node, pseudo) ||
        !validBox(row.box) || !validBox(row.padding) || !finite(row.host.width) || !finite(row.host.height) || row.host.width <= 0 || row.host.height <= 0 ||
        row.padding.x < 0 || row.padding.y < 0 || row.padding.x + row.padding.width > row.host.width || row.padding.y + row.padding.height > row.host.height)
      throw Error('pseudo-box-source-changed');
  });
  return structuredClone(evidence.rows);
}
