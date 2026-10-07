import test from 'node:test';
import {ContractSchema} from '../../scripts/contract-schema.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {proposeFromDump,proposeBatchFromDump} from '../../core/propose-figma.js';
import {tokenCorpusFromJson} from '../../core/token-corpus.js';
const reader=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8');
const start=reader.indexOf('function captureRemoteMainSnapshot('),end=reader.indexOf('\nfunction captureRemoteSetSnapshot(',start);
const qualify=new Function('return ('+reader.slice(start,end)+')')();
const key='e1885db60b7f415a03f9e935936bc6d8fb2183ba';
test('canonical reader distinguishes detached readable remote mains from partial variant domains',()=>{
 const main={type:'COMPONENT',remote:true,parent:null,key,id:'41080:384385',width:16,height:16,children:[],variantProperties:null};
 assert.deepEqual(qualify(main,'capture-file'),{kind:'remote-main-snapshot',captureFileKey:'capture-file',componentKey:key,nodeId:main.id});
 for(const patch of [{remote:false},{parent:{type:'COMPONENT_SET'}},{variantProperties:{Size:'Small'}},{type:'COMPONENT_SET'},{key:''},{children:undefined},{width:NaN}])assert.throws(()=>qualify({...main,...patch},'capture-file'),/REMOTE_SNAPSHOT_UNQUALIFIED/);
 assert.throws(()=>qualify(main,''),/REMOTE_SNAPSHOT_UNQUALIFIED/);
});
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/remote-main/checkmark.json',import.meta.url),'utf8'));
const opts={fileKey:'A451UfD58U7XU21FzaqfHL',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map<string,string>()};
test('actual remote snapshot proposes with explicit provenance and rejects wrong capture identity',()=>{
 const set=fixture(),before=JSON.stringify(set),r=proposeFromDump(set,opts);
 assert(r.notes.some(n=>n.includes('remote-main-snapshot:')&&n.includes('no original-library ownership')));
 assert.equal(JSON.stringify(set),before);
 for(const field of ['componentKey','nodeId','captureFileKey']){const bad=fixture();bad.remoteSnapshot[field]='wrong';assert.throws(()=>proposeFromDump(bad,opts),/remote-main-snapshot-identity-or-domain-unqualified/);}
 const variant=fixture();variant.variants[0].variantProperties={Size:'Small'};assert.throws(()=>proposeFromDump(variant,opts),/remote-main-snapshot-identity-or-domain-unqualified/);
});

import {validateRemoteSetSnapshot} from './remote-set-snapshot.js';
const setStart=reader.indexOf('function captureRemoteSetSnapshot('),setEnd=reader.indexOf('\nfunction observeInstanceGeometry(',setStart);
const qualifySet=new Function('return ('+reader.slice(setStart,setEnd)+')')();
function remoteSet(){
 const s:any={type:'COMPONENT_SET',remote:true,parent:null,id:'remote:set',key:'a'.repeat(40),componentPropertyDefinitions:{Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']},Style:{type:'VARIANT',defaultValue:'Plain',variantOptions:['Plain','Bold']}},children:[]};
 s.children=['Small','Large'].flatMap((Size,i)=>['Plain','Bold'].map((Style,j)=>({type:'COMPONENT',remote:true,parent:s,id:`remote:${i}${j}`,key:String(i*2+j+1).repeat(40),width:16,height:16,children:[],variantProperties:{Size,Style}})));
 return s;
}
function remoteDump(s:any):any{return {setName:'Remote',type:'COMPONENT_SET',nodeId:s.id,key:s.key,propertyDefinitions:s.componentPropertyDefinitions,remoteSnapshot:qualifySet(s,'capture-file'),variants:s.children.map((c:any)=>({name:`Size=${c.variantProperties.Size}, Style=${c.variantProperties.Style}`,type:'COMPONENT',nodeId:c.id,componentKey:c.key,variantProperties:c.variantProperties,children:[]}))};}
test('remote set snapshot requires every independently declared tuple and stable child identity',()=>{
 const s=remoteSet(),d=remoteDump(s);validateRemoteSetSnapshot(d,'capture-file');
 for(const mutate of [
  (s:any)=>s.children.pop(),(s:any)=>{s.children[1].variantProperties=s.children[0].variantProperties;},
  (s:any)=>{s.children[0].parent=null;},(s:any)=>{s.children[0].remote=false;},
  (s:any)=>{s.children[0].key=s.children[1].key;},(s:any)=>{s.componentPropertyDefinitions.Size.variantOptions.push('Huge');},
 ]){const bad=remoteSet();mutate(bad);assert.throws(()=>qualifySet(bad,'capture-file'),/REMOTE_SET_SNAPSHOT_UNQUALIFIED/);}
 for(const mutate of [
  (d:any)=>{d.remoteSnapshot.variants[0]=null;},(d:any)=>{delete d.nodeId;delete d.remoteSnapshot.nodeId;},
  (d:any)=>{d.remoteSnapshot.captureFileKey='other';},(d:any)=>{d.remoteSnapshot.componentKey='b'.repeat(40);},
  (d:any)=>{d.variants[0].componentKey='b'.repeat(40);},(d:any)=>d.variants.pop(),
  (d:any)=>{d.remoteSnapshot.variants[0].values.Size='Large';},
  (d:any)=>{d.propertyDefinitions.Size.variantOptions.push('Huge');},
 ]){const bad=structuredClone(d);mutate(bad);assert.throws(()=>validateRemoteSetSnapshot(bad,'capture-file'),/identity-or-domain-unqualified/);}
 const proposed=proposeFromDump(d,{...opts,fileKey:'capture-file'});
 assert(proposed.notes.some(n=>n.includes('remote-set-snapshot:')&&n.includes('no original-library ownership')));
});

test('live Atlassian domain projection corroborates all four captured remote variants',()=>{
 const d=JSON.parse(readFileSync(new URL('./fixtures/remote-main/atlassian-icon-domain.json',import.meta.url),'utf8'));
 validateRemoteSetSnapshot(d,'MfQWBskM44sS8VvL41eqPH');
 assert.equal(d.variants.length,4);
 for(const field of ['componentKey','nodeId']){const bad=structuredClone(d);bad.variants[0][field]='wrong';assert.throws(()=>validateRemoteSetSnapshot(bad,'MfQWBskM44sS8VvL41eqPH'),/identity-or-domain-unqualified/);}
});

test('remote set refusal identifies the failing dependency and domain counts',()=>{
 const s=remoteSet();s.name='SparseBadge';s.children.pop();
 assert.throws(()=>qualifySet(s,'capture-file'),/REMOTE_SET_SNAPSHOT_UNQUALIFIED: SparseBadge \(remote:set\): domain-cardinality — declared=4, observed=3/);
});


test('capture aliases preserve source identity and refuse corrupted alias witnesses',()=>{
 const source=fixture();
 const aliased=()=>({...structuredClone(source),setName:source.setName+' [captured '+source.nodeId+']',captureAlias:{sourceName:source.setName,nodeId:source.nodeId}});
 const result=proposeFromDump(aliased(),opts);
 assert.equal(ContractSchema.parse(result.contract).bindings.figma.anchors.nodeId,source.nodeId);
 for(const mutate of [
  (s:any)=>{s.captureAlias.nodeId='other';},
  (s:any)=>{s.captureAlias.sourceName='other';},
  (s:any)=>{s.setName='other';},
  (s:any)=>{delete s.remoteSnapshot;},
 ]){const bad=aliased();mutate(bad);assert.throws(()=>proposeFromDump(bad,opts),/remote-capture-alias-identity-unqualified/);}
});


test('batch keeps separate contract IDs for distinct same-key remote main snapshots',()=>{
 const one=fixture(),two=fixture();
 two.nodeId='other:main';two.remoteSnapshot.nodeId=two.nodeId;two.variants[0].nodeId=two.nodeId;
 for(const s of [one,two]){s.captureAlias={sourceName:s.setName,nodeId:s.nodeId};s.setName+=' [captured '+s.nodeId+']';}
 const batch=proposeBatchFromDump({[one.setName]:one,[two.setName]:two},opts);
 assert.deepEqual(batch.skipped,[]);
 assert.equal(batch.proposals.length,2);
 const contracts=batch.proposals.map(p=>ContractSchema.parse(p.contract));
 assert.equal(new Set(contracts.map(c=>c.id)).size,2);
 assert.deepEqual(new Set(contracts.map(c=>c.bindings.figma.anchors.nodeId)),new Set([one.nodeId,two.nodeId]));
});
