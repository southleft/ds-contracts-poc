/** Source constraints for an observed child, never its measured pixel box. */
import { flatten, type CapturedNode } from '../extract/computed/lib.js';
import type { ReactStyleOrigin } from './react-style-origin.js';
import { verifiedGridConstraints, type GridConstraintEvidence } from './grid-constraints.js';

export interface ReactChildContext { gridConstraints: GridConstraintEvidence }

export function reactChildContextSizing(tree: CapturedNode, origin: ReactStyleOrigin,
  path: string, context: ReactChildContext): { width: '100%'; height: 'fit-content' } | undefined {
  const grids=verifiedGridConstraints(tree,context.gridConstraints);
  const nodes=new Map(flatten(tree).map(row=>[row.path,row.node]));
  const root=nodes.get(path);
  if(!root || !path) throw Error('react-child-context-root-missing');
  // Used track widths do not encode an implicit-column or intrinsic-row rule.
  // Keep this refusal until the grid grammar preserves that exact constraint.
  if(grids.some(row=>row.path===path)) throw Error('react-child-context-grid-constraints-unqualified');
  const style=root.style, facts=origin.roots.find(row=>row.path===path)?.sizes;
  if(!facts || !['width','height'].every(channel=>facts.find(f=>f.channel===channel)?.status==='auto')) return;
  const parentPath=path.includes('.')?path.slice(0,path.lastIndexOf('.')):'';
  const parent=nodes.get(parentPath), parentOrigin=origin.roots.find(row=>row.path===parentPath);
  if(!parent || !parentOrigin) return;
  const width=parentOrigin.sizes?.find(f=>f.channel==='width');
  if(width?.status!=='fixed' || width.value!==parent.style.width) return;
  if(!['flex','inline-flex'].includes(parent.style.display) || parent.style['flex-direction']!=='column' ||
      !['normal','stretch'].includes(parent.style['align-items']) || !['auto','stretch'].includes(style['align-self'])) return;
  if(!['flex','inline-flex'].includes(style.display) || !['static','relative'].includes(style.position) ||
      style['box-sizing']!=='border-box' || !['auto','0px'].includes(style['min-width']) || style['max-width']!=='none' ||
      !['auto','0px'].includes(style['min-height']) || style['max-height']!=='none' || style['aspect-ratio']!=='auto' ||
      ['margin-left','margin-right','margin-top','margin-bottom'].some(key=>style[key]!=='0px') ||
      style['flex-grow']!=='0' || !['auto','0%'].includes(style['flex-basis']) ||
      style.transform!=='none') throw Error('react-child-context-stretch-constraints-unqualified');
  return {width:'100%',height:'fit-content'};
}
