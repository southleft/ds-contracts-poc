/** Source constraints for an observed child, never its measured pixel box. */
import { flatten, type CapturedNode } from '../extract/computed/lib.js';
import type { ReactStyleOrigin, ReactSizeOrigin } from './react-style-origin.js';
import { verifiedGridConstraints, type GridConstraintEvidence } from './grid-constraints.js';
import type { Contract } from '../scripts/contract-schema.js';

export interface ReactChildContext { gridConstraints: GridConstraintEvidence }

export function reactChildContextSizing(tree: CapturedNode, origin: ReactStyleOrigin,
  path: string, context: ReactChildContext): { width: '100%'; height: 'fit-content' } | undefined {
  const grids=verifiedGridConstraints(tree,context.gridConstraints);
  const nodes=new Map(flatten(tree).map(row=>[row.path,row.node]));
  const root=nodes.get(path);
  if(!root || !path) throw Error('react-child-context-root-missing');
  if(grids.some(row=>row.path===path)) reactChildContextGrid(tree, origin, path, context);
  const style=root.style, facts=origin.roots.find(row=>row.path===path)?.sizes;
  if(!facts || !['width','height'].every(channel=>facts.find(f=>f.channel===channel)?.status==='auto')) return;
  const parentPath=path.includes('.')?path.slice(0,path.lastIndexOf('.')):'';
  const parent=nodes.get(parentPath), parentOrigin=origin.roots.find(row=>row.path===parentPath);
  if(!parent || !parentOrigin) return;
  const width=parentOrigin.sizes?.find(f=>f.channel==='width');
  const parentGrid=parent.style.display==='grid' ? reactChildContextGrid(tree,origin,parentPath,context) : undefined;
  const inheritedGridWidth=parentGrid && parentPath && reactChildContextSizing(tree,origin,parentPath,context);
  if(!inheritedGridWidth && (width?.status!=='fixed' || width.value!==parent.style.width)) return;
  // A constrained parent block axis can shrink its children. Intrinsic height
  // must not be inferred from a single sample in that context.
  if (parentOrigin.sizes?.find(f => f.channel === 'height')?.status !== 'auto' || parent.style['max-height'] !== 'none') return;
  if(!parentGrid && (!['flex','inline-flex'].includes(parent.style.display) || parent.style['flex-direction']!=='column' ||
      !['normal','stretch'].includes(parent.style['align-items']) || !['auto','stretch'].includes(style['align-self']))) return;
  if(!['flex','inline-flex','grid','block'].includes(style.display) || !['static','relative'].includes(style.position) ||
      style['box-sizing']!=='border-box' || !['auto','0px'].includes(style['min-width']) || style['max-width']!=='none' ||
      !['auto','0px'].includes(style['min-height']) || style['max-height']!=='none' || style['aspect-ratio']!=='auto' ||
      ['margin-left','margin-right','margin-top','margin-bottom'].some(key=>style[key]!=='0px') ||
      style['flex-grow']!=='0' || !['auto','0%'].includes(style['flex-basis']) ||
      style.transform!=='none') throw Error('react-child-context-stretch-constraints-unqualified');
  return {width:'100%',height:'fit-content'};
}

/** Bounded row-flow lowering, not general auto/min-content equivalence.
 * In horizontal block flow the admitted items have equal intrinsic block
 * contributions. An auto-height container has no surplus height to stretch
 * auto rows. One implicit auto column stretches to the definite content width.
 * https://www.w3.org/TR/css-sizing-3/#intrinsic-sizes
 * https://www.w3.org/TR/css-grid-2/#track-sizing
 * Never derive declarations from the witness's `used` pixel tracks. */
export function reactChildContextGrid(tree: CapturedNode, origin: ReactStyleOrigin,
  path: string, context: ReactChildContext): RowFlowGrid | undefined {
  return rowFlowGrid(tree, origin, path, context.gridConstraints, ['width', 'height'], 'react-child-context-grid-constraints-unqualified');
}

/** The same lowering for the traced top-level root. No parent proves its width,
 * so the definite content width must be the component's OWN declaration, fixed
 * or exactly `100%`: a caller `style`/`className`, another percentage, calc()
 * or an automatic width stays a named refusal, and a measured pixel box is
 * never promoted. `width` is the root's sizing fact AFTER caller-input
 * ownership has been judged. */
export function reactRootGrid(tree: CapturedNode, origin: ReactStyleOrigin,
  evidence: GridConstraintEvidence, width: ReactSizeOrigin | undefined): RowFlowGrid | undefined {
  if (evidence.status !== 'observed') throw Error('react-root-grid-constraints-unobserved');
  const layout = rowFlowGrid(tree, origin, '', evidence, ['height'], 'react-root-grid-constraints-unqualified');
  // The child path gets these from its stretch proof: a block-axis floor, cap
  // or ratio would give the auto rows surplus height to stretch into.
  if (layout && (!['auto', '0px'].includes(tree.style['min-height']) || tree.style['max-height'] !== 'none' ||
      tree.style['aspect-ratio'] !== 'auto')) throw Error('react-root-grid-constraints-unqualified');
  // An own `width:100%` is the child path's stretch with the parent supplied
  // later by the caller: the column takes whatever definite width that parent
  // gives, under the same box constraints the stretch proof demands.
  const s = tree.style, fills = width?.status === 'fill' && width.value === '100%' &&
    ['static', 'relative'].includes(s.position) && s['box-sizing'] === 'border-box' &&
    ['auto', '0px'].includes(s['min-width']) && s['max-width'] === 'none' &&
    ['margin-left', 'margin-right'].every(key => s[key] === '0px') && s.transform === 'none';
  if (layout && (width?.channel !== 'width' || !(fills || width.status === 'fixed' && /^\d+(?:\.\d+)?px$/.test(width.value ?? ''))))
    throw Error('react-root-grid-width-unqualified');
  return layout;
}

type RowFlowGrid = NonNullable<Contract['anatomy']['root']['layout']>;
function rowFlowGrid(tree: CapturedNode, origin: ReactStyleOrigin, path: string, evidence: GridConstraintEvidence,
  ownAutomatic: Array<'width' | 'height'>, refusal: string): RowFlowGrid | undefined {
  const witness = verifiedGridConstraints(tree, evidence).find(row => row.path === path);
  if (!witness) return;
  const fail = (): never => { throw Error(refusal); };
  const node = flatten(tree).find(row => row.path === path)?.node;
  if (!node) return fail();
  const c = witness.computed, s = node.style;
  const rows = c['grid-template-rows'] === 'none' ? [] : c['grid-template-rows'].split(/\s+/);
  const intrinsic = (value: string) => ['auto', 'min-content'].includes(value);
  const automatic = (p: string, channels: Array<'width' | 'height'> = ['width', 'height']) => channels.every(channel =>
    origin.roots.find(row => row.path === p)?.sizes?.find(size => size.channel === channel)?.status === 'auto');
  if (s.display !== 'grid' || s['writing-mode'] !== 'horizontal-tb' || s.direction !== 'ltr' ||
      !automatic(path, ownAutomatic) || c['grid-template-columns'] !== 'none' || c['grid-auto-columns'] !== 'auto' ||
      c['grid-template-areas'] !== 'none' || c['grid-auto-flow'] !== 'row' ||
      !rows.every(intrinsic) || !intrinsic(c['grid-auto-rows']) ||
      !['normal', 'start'].includes(c['align-content']) ||
      !['normal', 'stretch'].includes(c['justify-content']) ||
      !['normal', 'stretch'].includes(c['justify-items']) ||
      !['normal', 'stretch', 'start', 'flex-start'].includes(c['align-items']) ||
      ['overflow-x', 'overflow-y'].some(key => s[key] !== 'visible')) return fail();
  let index = 0;
  for (const child of node.nodes) {
    if (child.t === 'text') { if (child.v.trim()) return fail(); continue; }
    const childPath = path ? `${path}.${index++}` : String(index++), style = child.el.style;
    // Other kinds of intrinsic block contribution require their own proof.
    if (['img', 'input', 'select', 'textarea', 'video', 'audio', 'canvas', 'svg', 'iframe', 'object', 'embed'].includes(child.el.tag) ||
        style.display !== 'block' || style['writing-mode'] !== 'horizontal-tb' || style.direction !== 'ltr' ||
        !automatic(childPath) || !['static', 'relative'].includes(style.position) ||
        style.order !== '0' || style['aspect-ratio'] !== 'auto' || style.transform !== 'none' ||
        !['auto', 'normal', 'stretch'].includes(style['justify-self']) ||
        !['auto', 'normal', 'start', 'flex-start', 'stretch'].includes(style['align-self']) ||
        ['grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end'].some(key => style[key] !== 'auto') ||
        ['margin-left', 'margin-right', 'margin-top', 'margin-bottom'].some(key => style[key] !== '0px') ||
        ['min-width', 'min-height'].some(key => !['auto', '0px'].includes(style[key])) ||
        ['max-width', 'max-height'].some(key => style[key] !== 'none') ||
        ['overflow-x', 'overflow-y'].some(key => style[key] !== 'visible')) return fail();
  }
  const gap = (value: string) => value === 'normal' ? 0 : /^\d+(?:\.\d+)?px$/.test(value) ? parseFloat(value) : fail();
  return { display: 'grid', columns: [{ fr: 1 }], flow: 'row', autoRows: { fit: true },
    ...(rows.length ? { rows: rows.map(() => ({ fit: true as const })) } : {}),
    gap: { row: gap(c['row-gap']), column: gap(c['column-gap']) } };
}
