/** Transfer only fixed observed external geometry to a parent component reference.
 * This never establishes responsive constraints or a component property API. */
import type {CapturedNode} from '../extract/computed/lib.js';
import {authoredLengthIsUsed} from './layout-unit.js';
import type {ReactStyleOrigin} from './react-style-origin.js';
import type {Part} from '../scripts/contract-schema.js';

export function observedComponentPlacement(node:CapturedNode,parent:CapturedNode|undefined,
  sizes:ReactStyleOrigin['roots'][number]['sizes']):Part['absolutePlacement'] {
 const s=node.style;
 if(!['absolute','fixed','sticky','relative'].includes(s.position)||s.position==='relative'&&
   ['left','right','top','bottom'].every(k=>!s[k]||s[k]==='auto'))return undefined;
 const refuse=()=>{throw Error('react-authored-tree-dependency-placement-unqualified');};
 const px=(v:string|undefined):number|undefined=>v&&/^-?(?:\d+(?:\.\d+)?|\.\d+)px$/.test(v)&&Number.isFinite(Number(v.slice(0,-2)))?Number(v.slice(0,-2)):undefined;
 const sameBox=s['box-sizing']==='border-box'||s['box-sizing']==='content-box'&&['top','right','bottom','left'].every(side=>px(s['padding-'+side])===0&&px(s['border-'+side+'-width'])===0);
 if(s.position!=='absolute'||!parent||!['relative','absolute'].includes(parent.style.position)||
    !['flex','inline-flex'].includes(parent.style.display)||!sameBox||
    !['left','top'].every(k=>px(s[k])!==undefined)||
    !['top','right','bottom','left'].every(k=>px(s['margin-'+k])===0)||
    !['width','height'].every(k=>Number(px(s[k]))>0&&sizes?.some(size=>size.channel===k&&size.status==='fixed'&&size.value&&authoredLengthIsUsed(size.value,s[k])))||
    [s,parent.style].some(style=>style['writing-mode']!=='horizontal-tb'||style.direction!=='ltr'||
      !['translate','rotate','scale','perspective'].every(k=>style[k]==='none'))||
    parent.style.transform!=='none'||s['z-index']!=='auto'||s.order!=='0')return refuse();
 const transform=s.transform;
 const match=/^matrix\(1, 0, 0, 1, (-?(?:\d+(?:\.\d+)?|\.\d+)), (-?(?:\d+(?:\.\d+)?|\.\d+))\)$/.exec(transform);
 if(transform!=='none'&&!match)return refuse();
 const left=px(s.left)!+(match?Number(match[1]):0),top=px(s.top)!+(match?Number(match[2]):0);
 if(!Number.isFinite(left)||!Number.isFinite(top))return refuse();
 return {left,top};
}

export function detachObservedPlacement(root:CapturedNode):void {
 root.style.position='relative';root.style.transform='none';
 for(const k of ['top','right','bottom','left'])root.style[k]='auto';
}
