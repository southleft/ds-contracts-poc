import assert from 'node:assert/strict';
import test from 'node:test';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import {asMinimalChildContract,proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {observeFillStack} from '../extract/figma/fill-stack-observation.js';
import type {DumpSet,DumpNode} from '../extract/figma/types.js';
function fixture(){
 const child=ContractSchema.parse({id:'test.child',name:'Child',version:'1.0.0',status:'draft',description:'Source-owned native root',props:[],states:[],semantics:{element:'div'},anatomy:{root:{instanceRootInputs:['border-color','border-width'],literals:{width:'24px',height:'24px'}}},bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:'child-set-key'}},code:{anchors:{importPath:'./Child',export:'Child'}}}});
 const transform:[[number,number,number],[number,number,number]]=[[1,0,0],[0,1,0]],nodeId='use-1',componentId='main-1';
 const node:DumpNode={nodeId,type:'INSTANCE',name:'Child',instanceOf:'Child',instanceKey:'child-key',instanceSetKey:'child-set-key',bbox:{width:24,height:24},strokeAlign:'INSIDE',strokeWeight:2,strokesIncludedInLayout:false,stroke:{hex:'cc8844',alpha:.5},sourceStrokeStack:observeFillStack([{type:'SOLID',visible:true,blendMode:'NORMAL',color:{r:.8,g:136/255,b:68/255},opacity:.5,boundVariables:{color:{type:'VARIABLE_ALIAS',id:'original-alias'}}}]),sourceStrokePattern:{version:1,complete:true,dashes:[]},instanceGeometry:{nodeId,componentId,transform,localSize:{width:24,height:24}},instanceRootOverrides:{nodeId,componentId,componentKey:'child-key',componentSetKey:'child-set-key',fields:['strokes','strokeWeight'],mainSize:{width:24,height:24},localSize:{width:24,height:24},localTransform:transform}};
 const set:DumpSet={setName:'Parent',type:'COMPONENT_SET',key:'parent-key',propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default']}},variants:[{name:'Mode=Default',variantProperties:{Mode:'Default'},type:'COMPONENT',bbox:{width:24,height:24},children:[node]}]};
 const run=()=>{const before=JSON.stringify(set),result=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),fileKey:'fixture',mintUnbound:true,contractIdByName:new Map([['Child',child.id]]),contractIdByKey:new Map([['child-set-key',child.id],['child-key',child.id]]),contractsById:new Map([[child.id,asMinimalChildContract(child)]])});assert.equal(JSON.stringify(set),before);return{result,parts:walkAnatomy(ContractSchema.parse(result.contract)).filter(p=>p.part.component?.id===child.id)};};
 return{node,run};
}
test('positive original identity and unfiltered paint witness carries a pair without native alias invention',()=>{
 const {run}=fixture(),out=run();assert.equal(out.parts.length,1);assert.deepEqual(Object.keys(out.parts[0].part.component!.rootOverrides!).sort(),['border-color','border-width']);assert(out.result.notes.some(n=>n.includes('source alias identities remain unqualified')));assert(out.result.mintedTokens!.entries.some(e=>e.value==='rgba(204,136,68,0.5)'),JSON.stringify(out.result.mintedTokens));assert(out.result.mintedTokens!.entries.some(e=>e.value==='2px'),JSON.stringify(out.result.mintedTokens));
});
test('missing pattern/paint witness and independent instance/main mismatches refuse the pair by name',()=>{
 for(const change of [(n:DumpNode)=>delete n.sourceStrokeStack,(n:DumpNode)=>delete n.sourceStrokePattern,(n:DumpNode)=>n.sourceStrokePattern!.dashes.push(2),(n:DumpNode)=>{n.instanceGeometry!.nodeId='foreign'},(n:DumpNode)=>{n.instanceGeometry!.componentId='foreign'},(n:DumpNode)=>{n.instanceRootOverrides!.componentId='foreign'},(n:DumpNode)=>{n.instanceRootOverrides!.fields=['strokes']},(n:DumpNode)=>{n.sourceStrokeStack!.paints.push({...n.sourceStrokeStack!.paints[0],index:1})}]){const f=fixture();change(f.node);const out=f.run();assert(out.parts.every(p=>!p.part.component!.rootOverrides?.['border-color']),String(change));assert(out.result.notes.some(n=>n.includes('instance-inside-stroke-not-carried')),String(change));}
});
