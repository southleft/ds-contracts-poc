/** A comparison may retain an explicit caller width without changing the API
 * or sizing of the reusable component. Automatic measured sizes are not rules. */
import {normalizeValue, type CapturedNode} from '../extract/computed/lib.js';
import type {ReactStyleOrigin} from './react-style-origin.js';

/** A fill-width root has no width of its own; its comparison needs the caller's
 * place. The sealed `fill` fact already witnessed, in the browser, that this
 * border box IS its definite containing block's content width, so the root's
 * used width is that width. A measured fact about this usage only: it sizes
 * the app-owned comparison frame, never the main, its contract or a token. */
export function reactComparisonContainerWidth(tree:CapturedNode, origin:ReactStyleOrigin):number|undefined {
  const roots=origin.roots.filter(r=>r.path==='' && r.tag===tree.tag);
  if(roots.length!==1) throw Error('react-comparison-width-origin-ambiguous');
  const widths=roots[0].sizes?.filter(s=>s.channel==='width')??[];
  if(widths.length>1) throw Error('react-comparison-width-origin-ambiguous');
  if(widths[0]?.status!=='fill') return;
  const value=normalizeValue(tree.style.width??''), pixels=parseFloat(value);
  if(widths[0].value!=='100%' || !/^\d+(?:\.\d+)?px$/.test(value) || !Number.isFinite(pixels) || pixels<=0 || pixels>100000 ||
      tree.style['box-sizing']!=='border-box' || tree.style['max-width']!=='none' || !['0px','auto'].includes(tree.style['min-width']) ||
      tree.style.transform!=='none' || tree.style['writing-mode']!=='horizontal-tb' || !['static','relative'].includes(tree.style.position) ||
      ['margin-left','margin-right'].some(key=>tree.style[key]!=='0px'))
    throw Error('react-comparison-containing-width-unqualified');
  return pixels;
}

export function reactComparisonInstanceWidth(tree:CapturedNode, origin:ReactStyleOrigin):number|undefined {
  const roots=origin.roots.filter(r=>r.path==='' && r.tag===tree.tag);
  if(roots.length!==1) throw Error('react-comparison-width-origin-ambiguous');
  const widths=roots[0].sizes?.filter(s=>s.channel==='width')??[];
  if(widths.length>1) throw Error('react-comparison-width-origin-ambiguous');
  const width=widths[0];
  // Other source sizing remains the reusable main's responsibility.
  if(width?.status!=='fixed' || !width.selectors.includes('<inline>')) return;
  const value=normalizeValue(width.value??'');
  if(!/^\d+(?:\.\d+)?px$/.test(value) || value!==tree.style.width ||
      tree.style['box-sizing']!=='border-box' ||
      ![undefined,'none'].includes(tree.style['max-width']) ||
      ![undefined,'0px','auto'].includes(tree.style['min-width']))
    throw Error('react-comparison-caller-width-unqualified');
  const pixels=parseFloat(value);
  if(!Number.isFinite(pixels) || pixels<=0 || pixels>100000) throw Error('react-comparison-caller-width-unqualified');
  return pixels;
}
