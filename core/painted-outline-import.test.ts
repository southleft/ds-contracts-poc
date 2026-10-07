import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {mapPaintedOutline} from '../extract/figma/rest/painted-outline.js';
import {mapRestToDump, type RestNode} from '../extract/figma/rest/map.js';
import type {DumpNode} from '../extract/figma/types.js';
const rows=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/painted-stroke-source.json',import.meta.url),'utf8')).rows;
function source(row:any){
 const o=row.observed;
 const parent={id:'parent',name:'parent',type:'COMPONENT',size:{x:40,y:12},relativeTransform:[[1,0,0],[0,1,0]]} as RestNode;
 const node={id:o.nodeId,name:'Ink',type:'VECTOR',size:{x:o.width,y:o.height},relativeTransform:[[1,0,0],[0,1,0]],constraints:{horizontal:'LEFT',vertical:'TOP'},strokeWeight:4,strokeAlign:'CENTER',cornerRadius:24,fills:[],strokeGeometry:o.paths,strokes:[{type:'SOLID',color:{r:103/255,g:80/255,b:164/255,a:1},boundVariables:{color:{type:'VARIABLE_ALIAS',id:'ink-id'}}}],boundVariables:{strokes:[{type:'VARIABLE_ALIAS',id:'ink-id'}]}} as RestNode;
 const mapped:DumpNode={name:'Ink',type:'VECTOR',stroke:{hex:'6750a4',var:'palette.ink'},strokeWeight:4,strokeAlign:'CENTER',cornerRadius:24,abs:{x:0,y:0,width:o.width,height:o.height,right:40-o.width,bottom:12-o.height}};
 return {node,parent,mapped};
}
test('outline candidate retains logical placement, mapped variable paint and original path bytes',()=>{
 for(const row of rows){const {node,parent,mapped}=source(row),out=mapPaintedOutline(node,parent,row.svg,mapped)!;
 assert(out);assert.deepEqual(out.abs,mapped.abs);assert.equal(out.stroke,undefined);assert.equal(out.cornerRadius,undefined);
 assert.deepEqual(out.paintedStrokeSource,{nodeId:node.id,strokeWeight:4,representation:'fixed-outline'});
 const ink=out.children![0]!.children![0]!.children![0]!;
 assert.deepEqual(ink.fill,mapped.stroke);assert.deepEqual(ink.shape!.paths,row.observed.paths.map((p:any)=>({data:p.path,windingRule:p.windingRule})));
 assert.notEqual(ink.fill,mapped.stroke);assert.equal(mapped.strokeWeight,4);
 }
});
test('outline candidate refuses dynamic stroke width, unsupported paints, transforms and mismatched exports',()=>{
 const row=rows[0];
 const mutations:Array<(n:any)=>void>=[n=>n.boundVariables.strokeWeight={type:'VARIABLE_ALIAS',id:'weight'},n=>n.constraints.horizontal='SCALE',n=>n.relativeTransform[0][1]=1,n=>n.isMask=true,n=>n.opacity=.5,n=>n.fills=[{type:'SOLID',color:{r:1,g:0,b:0}}],n=>n.effects=[{type:'DROP_SHADOW'}],n=>n.strokes[0].opacity=.5,n=>n.strokes.push(n.strokes[0]),n=>n.componentPropertyReferences={visible:'Toggle'},n=>n.strokeGeometry[0].path='M0 0L1 0L1 1Z'];
 for(const mutate of mutations){const {node,parent,mapped}=source(structuredClone(row));mutate(node);assert.equal(mapPaintedOutline(node,parent,row.svg,mapped),undefined);}
 const {node,parent,mapped}=source(row);assert.equal(mapPaintedOutline(node,parent,row.svg.replace(node.id,'wrong'),mapped),undefined);
});
test('ordinary capture stays unchanged; inspection requires a matching source version',()=>{
 const row=rows[0],{node,parent}=source(row);
 node.absoluteBoundingBox={x:0,y:0,width:40,height:12};
 parent.absoluteBoundingBox={x:0,y:0,width:40,height:12};parent.children=[node];
 const response={name:'probe',version:'pinned',nodes:{set:{document:{id:'set',name:'Outline',type:'COMPONENT_SET',children:[parent]}}}};
 const options={fileKey:'file',strokeSvgSources:{fileKey:'file',version:'pinned',svgByNodeId:{[node.id]:row.svg}}};
 const count=(o:any)=>mapRestToDump(response as never,o).report.degradations.filter(d=>d.code==='stroke-expanded-outline').length;
 assert.equal(count(options),0);
 assert.equal(count({...options,inspectPaintedStrokeOutlines:true}),1);
 assert.equal(count({...options,inspectPaintedStrokeOutlines:true,strokeSvgSources:{...options.strokeSvgSources,version:'wrong'}}),0);
});
