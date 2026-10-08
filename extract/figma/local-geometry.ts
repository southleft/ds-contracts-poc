import type {DumpNode} from './types.js';

/** Raw node-to-parent coordinates, independent of post-transform bounds.
 * Capture is not permission to render arbitrary scale, skew or reflection. */
export function observeLocalGeometry(nodeId:unknown,parentId:unknown,transform:unknown,width:unknown,height:unknown,parentWidth:unknown,parentHeight:unknown):DumpNode['localGeometry'] {
 if(typeof nodeId!=='string'||!nodeId||typeof parentId!=='string'||!parentId||nodeId===parentId||
    !Array.isArray(transform)||transform.length!==2||!transform.every(row=>Array.isArray(row)&&row.length===3&&row.every(n=>typeof n==='number'&&Number.isFinite(n)))||
    ![width,height,parentWidth,parentHeight].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0))return undefined;
 return {nodeId,parentId,transform:transform.map(row=>[...row]) as [[number,number,number],[number,number,number]],
  localSize:{width:width as number,height:height as number},parentSize:{width:parentWidth as number,height:parentHeight as number}};
}
