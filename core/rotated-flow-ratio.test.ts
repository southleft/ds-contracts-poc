import test from 'node:test';
import assert from 'node:assert/strict';
import {rotatedFlowRatio} from './rotated-flow-ratio.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import type {DumpNode,DumpSet} from '../extract/figma/types.js';
const layout=(mode:'HORIZONTAL'|'VERTICAL')=>({mode,primary:'MIN' as const,counter:'MIN' as const,primarySizing:'AUTO' as const,counterSizing:'FIXED' as const,spacing:0,padding:[0,0,0,0] as [number,number,number,number]});
function fixture(cos=.5,id='root'):DumpNode {
 const sin=Math.sqrt(1-cos*cos),width=200,height=cos*width+sin*.0002;
 return {name:'arbitrary',nodeId:id,type:'COMPONENT',layout:layout('VERTICAL'),fixedSize:{width},children:[{
  name:'not a ratio label',nodeId:id+'child',type:'FRAME',sourceEmptyFill:true,fillWidth:true,layout:layout('HORIZONTAL'),children:[],
  nativeFlowGeometry:{nodeId:id+'child',parentId:id,localSize:{width:.0002,height:width},parentSize:{width,height},relativeTransform:[[cos,-sin,0],[sin,cos,0]],sizing:{horizontal:'FILL',vertical:'FIXED'},primarySizing:'AUTO',counterSizing:'FIXED',layoutGrow:0,layoutAlign:'STRETCH'}
 }]};
}
test('neutral rotated flow derives a ratio from allocation rather than names or bbox',()=>{
 const root=fixture(),before=JSON.stringify(root),p=rotatedFlowRatio(root)!;
 assert.equal(p.ratio,2);assert(p.residual<.001);assert.deepEqual(p.nodeIds,['rootchild']);assert.equal(JSON.stringify(root),before);
 root.children![0].layout!.spacing=10;assert.equal(rotatedFlowRatio(root)!.ratio,2);
 root.name='banana';root.bbox={width:999,height:999};assert.equal(rotatedFlowRatio(root)!.ratio,2);
});
test('paint, authored content, controls and inconsistent allocation preserve original anatomy',()=>{
 for(const fault of ['paint','text','visibility','fixed','padding','identity','matrix','size','content']){
  const root=fixture(),n:any=root.children![0],g=n.nativeFlowGeometry;
  if(fault==='paint')n.fill={literal:'#fff'};
  if(fault==='text')n.text={characters:'content'};
  if(fault==='visibility')n.propRefs={visible:'Show'};
  if(fault==='fixed')g.layoutAlign='INHERIT';
  if(fault==='padding')n.layout.padding[0]=2;
  if(fault==='identity')g.parentId='other';
  if(fault==='matrix')g.relativeTransform[0][0]=2;
  if(fault==='size')g.parentSize.height=44;
  if(fault==='content')n.children=[{type:'TEXT',name:'label'}];
  assert.equal(rotatedFlowRatio(root),undefined,fault);
 }
});
test('varying ratio helpers produce conditional ratio styles and no empty helper tree',()=>{
 const set:DumpSet={setName:'RatioSurface',type:'COMPONENT_SET',variants:[.5,.75].map((cos,i)=>({...fixture(cos,String(i)),name:`Format=${i?'Wide':'Narrow'}`}))};
 const p=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true,projectionMode:'reviewable-inversion'});
 const c=ContractSchema.parse(p.contract),root=c.anatomy.root;
 assert.equal(root.parts,undefined);assert.deepEqual(root.stylesWhen!.map(r=>r.styles['aspect-ratio']),['2',String(1/.75)]);
 // Known-width native contracts resolve the same enum branch as generated CSS.
 root.tokens={};root.literals={width:'200px'};
 const e=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const data=e.compileComponentData(c,new Map([[c.id,c]]));
 assert.deepEqual(data.variants.map(v=>v.spec.nativeAspectRatio),[2,1/.75]);
});
