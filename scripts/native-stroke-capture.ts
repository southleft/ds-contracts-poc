/** Bounded read-only bridge to the canonical plugin stroke reader. */
export function buildNativeStrokeCapture(plugin: string, fileKey: string, nodeIds: string[]): string {
  if (!/^[A-Za-z0-9]+$/.test(fileKey) || !nodeIds.length || nodeIds.length > 128 ||
      new Set(nodeIds).size !== nodeIds.length || nodeIds.some(id => !/^\d+:\d+$/.test(id)))
    throw Error('native-stroke-capture-input-invalid');
  const start=plugin.indexOf('function strokedPathIssue('),end=plugin.indexOf('\nfunction nativeLineIssue(',start);
  if(start<0 || end<start || !plugin.slice(start,end).includes('function dumpStrokedPath('))
    throw Error('native-stroke-capture-reader-missing');
  const code=plugin.slice(start,end)+`\nif(figma.fileKey!==${JSON.stringify(fileKey)})throw Error('native-stroke-capture-file-mismatch');
const records=[];
for(const id of ${JSON.stringify(nodeIds)}){
 const node=await figma.getNodeByIdAsync(id);
 if(!node||node.type!=='VECTOR')throw Error('native-stroke-capture-vector-missing:'+id);
 const parent=node.parent,shape=dumpStrokedPath(node,parent);
 records.push({nodeId:id,parentId:parent.id,localGeometry:{transform:node.relativeTransform,localSize:{width:node.width,height:node.height},parentSize:{width:parent.width,height:parent.height}},strokeWeight:node.strokeWeight,strokeAlign:node.strokeAlign,strokes:node.strokes,shape,issue:shape?null:'native-stroke-capture-context-unqualified'});
}
return {version:1,kind:'native-stroke-capture',fileKey:figma.fileKey,records};`;
  if(code.length>50000)throw Error('native-stroke-capture-bridge-budget-exceeded');
  return code;
}

import {createHash} from 'node:crypto';
import {strokedPathGeometryIssue} from '../packages/schema/src/stroked-path.js';

/** Apply only identity- and geometry-matched observations; never mutate the input. */
export function applyNativeStrokeCapture(input: any, receipt: any): any {
  const fail=(why:string):never=>{throw Error('native-stroke-supplement-'+why);};
  if(receipt?.version!==1 || receipt.kind!=='native-stroke-capture' || !receipt.fileKey ||
      receipt.fileKey!==input?._provenance?.fileKey || !Array.isArray(receipt.records) ||
      !receipt.records.length || receipt.records.length>128)fail('receipt-invalid');
  const output=structuredClone(input),nodes=new Map<string,any[]>();
  const walk=(node:any)=>{if(!node||typeof node!=='object')return;if(typeof node.nodeId==='string')nodes.set(node.nodeId,[...(nodes.get(node.nodeId)??[]),node]);for(const child of node.children??[])walk(child);};
  for(const [key,set] of Object.entries(output))if(!key.startsWith('_'))for(const variant of (set as any)?.variants??[])walk(variant);
  const seen=new Set<string>();
  for(const row of receipt.records){
    if(!row||typeof row.nodeId!=='string'||seen.has(row.nodeId))fail('duplicate-or-invalid-node');seen.add(row.nodeId);
    const matches=nodes.get(row.nodeId);if(matches?.length!==1)fail('source-node-not-unique');
    const node=matches[0],g=node.localGeometry,s=row.shape;
    if(node.type!=='VECTOR'||!g||row.issue!==null||!s||s.kind!=='stroked-path'||strokedPathGeometryIssue(s))fail('geometry-unqualified');
    if(Object.keys(s).some(k=>!['kind','width','height','strokePath'].includes(k)))fail('shape-fields-unqualified');
    const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
    if(g.parentId!==row.parentId || !same(g.transform,row.localGeometry?.transform) ||
        !same(g.localSize,row.localGeometry?.localSize)||!same(g.parentSize,row.localGeometry?.parentSize)||
        s.width!==g.localSize.width||s.height!==g.localSize.height||s.strokePath.viewport.x!==g.transform[0][2]||
        s.strokePath.viewport.y!==g.transform[1][2]||s.strokePath.viewport.width!==g.parentSize.width||
        s.strokePath.viewport.height!==g.parentSize.height)fail('source-geometry-changed');
    const paint=row.strokes?.filter((p:any)=>p.visible!==false),color=paint?.[0]?.color;
    if(paint?.length!==1||paint[0].type!=='SOLID'||(paint[0].opacity??1)!==1||paint[0].blendMode!=='NORMAL'||
        !color||!['r','g','b'].every(k=>Number.isFinite(color[k])&&color[k]>=0&&color[k]<=1)||
        node.strokeWeight!==row.strokeWeight||node.strokeAlign!==row.strokeAlign)fail('source-stroke-changed');
    const hex=['r','g','b'].map(k=>Math.round(color[k]*255).toString(16).padStart(2,'0')).join('');
    if(node.stroke?.hex?.replace(/^#/,'').toLowerCase()!==hex || node.stroke.opacity!==undefined&&node.stroke.opacity!==1)fail('source-paint-changed');
    if(node.shape&&!same(node.shape,s))fail('existing-shape-conflict');
    node.shape=structuredClone(s);
  }
  output._provenance.nativeStrokeSupplement={kind:'native-stroke-capture',nodeIds:[...seen],receiptSha256:createHash('sha256').update(JSON.stringify(receipt)).digest('hex')};
  return output;
}
