/** A comparison may retain an explicit caller width without changing the API
 * or sizing of the reusable component. Automatic measured sizes are not rules. */
import {normalizeValue, type CapturedNode} from '../extract/computed/lib.js';
import type {ReactStyleOrigin} from './react-style-origin.js';

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
