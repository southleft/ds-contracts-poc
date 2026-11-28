import assert from 'node:assert/strict';
import test from 'node:test';
import {nativeInspectionDisplayName,proposeFromDump,proposeBatchFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
import type {DumpSet} from '../extract/figma/types.js';
const operation='12345678-1234-4234-8234-123456789abc';
const stamp=(id='test.widget')=>`source-native:${operation}:${id}`;
function fixture(name='Widget',marker: string|undefined=stamp(),nodeId='10:1'):DumpSet {
 return {setName:marker?`${name} (${marker})`:name,contractId:marker,type:'COMPONENT_SET',nodeId,key:'key-'+nodeId,
  semantics:{element:'div'},propertyDefinitions:{Color:{type:'VARIANT',defaultValue:'Info',variantOptions:['Info']}},
  variants:[{name:'Color=Info',type:'COMPONENT',nodeId:nodeId+'1',componentKey:'variant-'+nodeId,variantProperties:{Color:'Info'}}]};
}
const options=()=>({corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),
 contractIdByName:new Map<string,string>(),fileKey:'test-file',projectionMode:'exact' as const,mintUnbound:true,
 conventions:['native-operation-public-names']});
const propose=(set:DumpSet,extra={})=>ContractSchema.parse(proposeFromDump(set,{...options(),...extra}).contract);
const batch=(sets:DumpSet[],extra={})=>proposeBatchFromDump(Object.fromEntries(sets.map(s=>[s.setName,s])),{...options(),...extra});

test('without the profile convention, full drawn exports and ordinary alias behavior remain unchanged',()=>{
 const set=fixture(),legacy=propose(set,{conventions:undefined});
 assert.notEqual(legacy.name,'Widget');
 assert.deepEqual(legacy,propose({...set,contractId:undefined},{conventions:[]}));
 const normal={...fixture(),setName:'Widget',contractId:undefined,nodeId:'20:1',key:'key-20:1'};
 const result=batch([set,normal],{conventions:[]});assert.equal(result.skipped.length,0);
 assert.deepEqual(result.proposals.map(p=>p.contract.name).sort(),[legacy.name,'Widget'].sort());
});

test('inspection suffix restores exports while preserving provisional ids, anchors and component data',()=>{
 const set=fixture(),before=structuredClone(set),ordinary=propose({...set,contractId:undefined}),recovered=propose(set);
 assert.equal(recovered.name,'Widget');assert.equal(recovered.bindings.code.anchors.export,'Widget');
 assert.equal(recovered.id,ordinary.id);assert.notEqual(recovered.id,'test.widget');
 assert.deepEqual(recovered.bindings.figma,ordinary.bindings.figma);
 assert.deepEqual(recovered.props,ordinary.props);assert.deepEqual(recovered.semantics,ordinary.semantics);assert.deepEqual(recovered.anatomy,ordinary.anatomy);
 assert.deepEqual(set,before);assert.deepEqual(propose(set),recovered);
 const another=fixture('Widget',stamp().replace(operation,'ffffffff-ffff-4fff-8fff-ffffffffffff'));
 assert.equal(propose(another).name,recovered.name);assert.notEqual(propose(another).id,recovered.id);
 const accepted=propose(fixture('Widget','test.widget'));assert.equal(accepted.id,'test.widget');assert.equal(accepted.name,'Widget');
});

test('absent, malformed and mismatched inspection markers retain their complete drawn names',()=>{
 const set=fixture();
 for(const marker of [undefined,stamp().replace(operation,'invalid'),stamp().replace('test.widget','INVALID.ID'),stamp().replace(operation,'ffffffff-ffff-4fff-8fff-ffffffffffff'),stamp()+':extra']){
  const input={...set,contractId:marker};assert.equal(nativeInspectionDisplayName(input),null);assert.notEqual(propose(input).name,'Widget');
 }
 assert.equal(nativeInspectionDisplayName({...set,setName:'Different suffix'}),null);
 assert.equal(nativeInspectionDisplayName({...set,contractId:' '+stamp()+' '}),'Widget');
});

test('recovered names refuse family collisions in either arrival order before mutating caller indexes',()=>{
 const native=fixture(),normal=fixture('Widget',undefined,'20:1');normal.setName='Widget';delete normal.contractId;
 for(const other of [normal,{...normal,setName:'widget'},fixture('Widget',stamp('test.other'),'30:1')])for(const sets of [[native,other],[other,native]]){
  const names=new Map([['Unrelated','test.unrelated']]),contracts=new Map(),before=[...names];
  assert.throws(()=>batch(sets,{contractIdByName:names,contractsById:contracts}),/NATIVE_PUBLIC_NAME_COLLISION/);
  assert.deepEqual([...names],before);assert.equal(contracts.size,0);
 }
 assert.equal(batch([normal]).skipped.length,0);
});

test('alias-only and contract-only conflicts refuse, while the same anchored identity can be reopened',()=>{
 const set=fixture(),existing=propose(set);
 for(const extra of [
  {contractIdByName:new Map([['Widget','test.unrelated']])},
  {contractIdByName:new Map([['widget','test.unrelated']])},
  {contractIdByName:new Map([[set.setName,'test.unrelated']])},
  {contractsById:new Map([['test.unrelated',{...existing,id:'test.unrelated'}]])},
 ])assert.throws(()=>batch([set],extra),/NATIVE_PUBLIC_NAME_COLLISION/);
 assert.throws(()=>propose(set,{contractsById:new Map([['test.unrelated',{...existing,id:'test.unrelated'}]])}),/NATIVE_PUBLIC_NAME_COLLISION/);
 const result=batch([set],{contractIdByName:new Map([['Widget',existing.id]]),contractsById:new Map([[existing.id,existing]]),sessionClaimedIds:new Set([existing.id])});
 assert.equal(result.skipped.length,0);assert.equal(result.proposals[0].contract.id,existing.id);assert.equal(result.proposals[0].contract.name,'Widget');
});

test('public recovery preserves a prior anchored id, but refuses wrong-key and wrong-file aliases',()=>{
 const set=fixture(),adopted={...propose(set),id:'author.widget'};
 const indexed=(contract:typeof adopted)=>({contractIdByName:new Map([['Widget',adopted.id]]),
  contractsById:new Map([[adopted.id,contract]]),sessionClaimedIds:new Set([adopted.id])});
 const result=batch([set],indexed(adopted));assert.equal(result.skipped.length,0);
 assert.equal(result.proposals[0].contract.id,adopted.id);assert.equal(result.proposals[0].contract.name,'Widget');
 assert(!result.proposals[0].notes.some(n=>n.includes('already claimed by a distinct session contract')));
 for(const changed of [{componentSetKey:'wrong-key'},{fileKey:'wrong-file'}]){
  const wrong=structuredClone(adopted);Object.assign(wrong.bindings.figma.anchors,changed);
  const indexes=indexed(wrong),before=structuredClone(indexes);
  assert.throws(()=>batch([set],indexes),/NATIVE_PUBLIC_NAME_COLLISION/);assert.deepEqual(indexes,before);
 }
});

test('recovered child export keeps keyed and keyless dependency resolution',()=>{
 for(const keyed of [true,false]){
  const child=fixture('Mark',stamp('test.mark')),parent=fixture('Control',undefined,'20:1');parent.setName='Control';delete parent.contractId;
  parent.variants[0].children=[{name:'mark',type:'INSTANCE',instanceOf:'Mark',
   ...(keyed?{instanceSetKey:child.key,instanceKey:child.variants[0].componentKey}:{})}];
  const result=batch([child,parent]);assert.equal(result.skipped.length,0,JSON.stringify(result.skipped));
  const c=ContractSchema.parse(result.proposals.find(p=>p.contract.name==='Mark')!.contract),p=ContractSchema.parse(result.proposals.find(p=>p.contract.name==='Control')!.contract);
  const refs=[...walkAnatomy(p)].flatMap(({part})=>part.component?[part.component.id]:[]);
  assert(refs.includes(c.id),JSON.stringify({keyed,refs,child:c.id}));assert.equal(c.bindings.code.anchors.export,'Mark');
 }
});
