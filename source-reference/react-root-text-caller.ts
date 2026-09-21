import { revisionOf } from '../core/contract-provenance.js';
import type { NativeRootTextCallerEvidence } from '../core/native-root-text-caller.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import type { ObservedContentDraft } from './observed-content.js';

/** Call only after the archive reader authenticates the DOM/font inventory and
 * recompileSavedObservedContent matches the saved caller. A direct DOM text
 * run has no descendant element that could own independent typography. */
export function reactRootTextCallerEvidence(tree: CapturedNode, content: ObservedContentDraft): NativeRootTextCallerEvidence {
  const fail = (): never => { throw Error('react-comparison-direct-root-text-unqualified'); };
  if (content.status !== 'compiled-comparison-draft' || content.problems.length || !content.contract || !content.component ||
      content.treeRevision !== revisionOf(tree) || !tree.nodes.length || Object.keys(tree.pseudo).length ||
      tree.nodes.some(node => node.t !== 'text' || typeof node.v !== 'string') ||
      !['flex','inline-flex'].includes(tree.style.display) ||
      !(tree.style['white-space-collapse'] === 'collapse' || ['normal','nowrap'].includes(tree.style['white-space'])) ||
      tree.style['white-space'] && !['normal','nowrap'].includes(tree.style['white-space']) ||
      tree.style['white-space-collapse'] && tree.style['white-space-collapse'] !== 'collapse') fail();
  const characters = tree.nodes.map(node => node.t === 'text' ? node.v : '').join('')
    .replace(/[\t\n\f\r ]+/g, ' ').replace(/^ | $/g, '');
  const children = content.component!.variants[0]?.spec.children?.filter(child => !child.backgroundPaint);
  if (!characters || content.component!.variants.length !== 1 || children?.length !== 1 ||
      children[0].type !== 'text' || children[0].characters !== characters) fail();
  return { version: 1, kind: 'direct-root-text', treeRevision: revisionOf(tree),
    contractRevision: revisionOf(content.contract), characters };
}
