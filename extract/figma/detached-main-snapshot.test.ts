import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {proposeFromDump} from '../../core/propose-figma.js';
import {tokenCorpusFromJson} from '../../core/token-corpus.js';
const reader=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8');
const start=reader.indexOf('async function captureDetachedMainSnapshot('),end=reader.indexOf('\n// A readable detached remote main',start);
const capture=new Function('return ('+reader.slice(start,end)+')')();
const key='dfa671797be29953acf7e71ee8900e8a1a749af2';
const main=()=>({type:'COMPONENT',remote:false,removed:false,parent:null,id:'2464:17121',key,children:[],width:161,height:64,variantProperties:null});
test('detached non-remote main requires matching independent readable lookup',async()=>{
 const n=main();let seen='';
 const result=await capture(n,'capture-file',async(id:string)=>{seen=id;return {...n};});
 assert.equal(seen,n.id);
 assert.deepEqual(result,{kind:'detached-main-snapshot',captureFileKey:'capture-file',componentKey:key,nodeId:n.id,lookup:{nodeId:n.id,componentKey:key}});
 for(const patch of [{remote:true},{removed:true},{parent:{type:'PAGE'}},{type:'COMPONENT_SET'},{variantProperties:{Size:'Small'}},{key:''},{children:undefined},{width:NaN}]){
  await assert.rejects(capture({...n,...patch},'capture-file',async()=>n),/DETACHED_SNAPSHOT_UNQUALIFIED/);
  await assert.rejects(capture(n,'capture-file',async()=>({...n,...patch})),/DETACHED_SNAPSHOT_LOOKUP_MISMATCH/);
 }
 for(const value of [null,{...n,id:'other'},{...n,key:'b'.repeat(40)}])await assert.rejects(capture(n,'capture-file',async()=>value),/LOOKUP_MISMATCH/);
 await assert.rejects(capture(n,'',async()=>n),/UNQUALIFIED/);
});
test('proposal keeps detached provenance and rejects contradictory identity or expanded domain',()=>{
 const fixture=()=>{
  const d=JSON.parse(readFileSync(new URL('./fixtures/remote-main/checkmark.json',import.meta.url),'utf8'));
  const s=d.remoteSnapshot;delete d.remoteSnapshot;
  d.detachedSnapshot={...s,kind:'detached-main-snapshot',lookup:{nodeId:s.nodeId,componentKey:s.componentKey}};return d;
 };
 const opts={fileKey:'A451UfD58U7XU21FzaqfHL',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map<string,string>()};
 const d=fixture(),before=JSON.stringify(d),r=proposeFromDump(d,opts);
 assert(r.notes.some(n=>n.includes('detached-main-snapshot:')&&n.includes('no original-library ownership')));
 assert.equal(JSON.stringify(d),before);
 for(const mutate of [
  (d:any)=>{d.detachedSnapshot.captureFileKey='other';},
  (d:any)=>{d.detachedSnapshot.lookup.nodeId='other';},
  (d:any)=>{d.detachedSnapshot.lookup.componentKey='b'.repeat(40);},
  (d:any)=>{delete d.detachedSnapshot.lookup;},
  (d:any)=>{d.variants[0].nodeId='other';},
  (d:any)=>{d.variants[0].variantProperties={Size:'Small'};},
  (d:any)=>{d.variants.push(d.variants[0]);},
  (d:any)=>{d.remoteSnapshot={...d.detachedSnapshot,kind:'remote-main-snapshot'};},
 ]){const bad=fixture();mutate(bad);assert.throws(()=>proposeFromDump(bad,opts),/detached-main-snapshot-identity-or-domain-unqualified/);}
});
test('live Carbon detached skeleton proposes with captured identity and no library ownership claim',()=>{
 const d=JSON.parse(readFileSync(new URL('./fixtures/remote-main/carbon-detached-skeleton.json',import.meta.url),'utf8'));
 assert.equal(d.detachedSnapshot.nodeId,'2464:17121');
 assert.equal(d.detachedSnapshot.componentKey,key);
 const r=proposeFromDump(d,{fileKey:'A451UfD58U7XU21FzaqfHL',corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map<string,string>()});
 assert(r.notes.some(n=>n.includes('detached-main-snapshot:')&&n.includes('no original-library ownership')));
});
