import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const candidate=readFileSync(new URL('./native-source-write.ts',import.meta.url),'utf8');

function runtime(source){
  const start=source.indexOf('const nativeOwnedNodes = new Map();');
  const end=source.indexOf('function nativeInit(node, spec)',start);
  assert.ok(start>=0&&end>start);
  const emitted=source.slice(start,end);assert.ok(!emitted.includes('${'),'runtime slice has no unresolved interpolation');
  const recovery=source.match(/for \(const identity of NATIVE\.recovery\.creation\.nodes\) [^\n`]+/)[0];
  return vm.runInNewContext(`const NATIVE={operation:{id:'test'},sourceContractId:'test.root',sourceContractRevision:'rev',tokenPreparationRevision:'tokens'}; const NATIVE_RESULT={nodes:[]};\n${emitted}\n({retain:nativeRetain,own:nativeOwn,rows:NATIVE_RESULT.nodes,owned:nativeOwnedNodes,seed:function(rows){NATIVE.recovery={creation:{nodes:rows}};${recovery}}})`);
}
const plain=rows=>JSON.parse(JSON.stringify(rows));
function handle(id,{type='FRAME',key='',failMetadata=0,failKey=false,failType=false,onId=()=>{}}={}){
 let writes=0;
 return {get id(){onId();return id;},get type(){if(failType)throw Error('type unavailable');return type;},get key(){if(failKey)throw Error('key unavailable');return key;},setSharedPluginData(){writes++;if(writes===failMetadata)throw Error('metadata unavailable');}};
}
function initLikeProduction(api,node){api.retain(node);api.own(node);}

test('native ID getter reads are linear for the actual retain-then-own allocation sequence',()=>{
 const measure=(source,n)=>{const api=runtime(source);let reads=0;for(let i=0;i<n;i++)initLikeProduction(api,handle('node:'+i,{onId:()=>reads++}));assert.equal(api.rows.length,n);return reads;};
 assert.equal(measure(candidate,1000),4000);
 assert.equal(measure(candidate,5000),20000);
 assert.equal(measure(candidate,120),480);
});

test('duplicate live handles and repeated IDs preserve first identity and insertion order',()=>{
 const api=runtime(candidate);const first=handle('z',{type:'COMPONENT',key:'first-key'});
 api.retain(first);api.retain(handle('a'));api.retain(first);
 api.retain(handle('z',{type:'TEXT',key:'later-key'}));api.retain(handle('b'));api.retain(handle('a'));
 assert.deepEqual(plain(api.rows),[{id:'z',type:'COMPONENT',key:'first-key'},{id:'a',type:'FRAME'},{id:'b',type:'FRAME'}]);
});

test('first or second metadata failure leaves the handle in the partial allocation receipt',()=>{
 for(const failMetadata of [1,2]){
  const api=runtime(candidate),node=handle('retained',{failMetadata});
  assert.throws(()=>api.own(node),/metadata unavailable/);
  assert.deepEqual(plain(api.rows),[{id:'retained',type:'FRAME'}]);
  api.retain(handle('retained',{type:'TEXT'}));
  assert.equal(api.rows.length,1);
  assert.equal(api.owned.has('retained'),false,'ownership is not claimed after metadata failure');
 }
});

test('type and key getter failures preserve the original retention timing',()=>{
 const exercise=source=>{const api=runtime(source);
  assert.throws(()=>api.retain(handle('type',{failType:true})),/type unavailable/);
  assert.equal(api.rows.length,0);
  api.retain(handle('type'));
  assert.throws(()=>api.retain(handle('key',{failKey:true})),/key unavailable/);
  api.retain(handle('key',{type:'TEXT',key:'cannot replace first record'}));
  return plain(api.rows);
 };
 assert.deepEqual(exercise(candidate),[{id:'type',type:'FRAME'},{id:'key',type:'FRAME'}]);
});

test('receipt state and duplicate suppression are isolated between operations',()=>{
 const a=runtime(candidate),b=runtime(candidate);a.own(handle('same'));b.own(handle('same'));
 assert.deepEqual(plain(a.rows),plain(b.rows));assert.notStrictEqual(a.rows,b.rows);
 a.retain(handle('only-a'));assert.equal(a.rows.length,2);assert.equal(b.rows.length,1);
});


test('recovery preload retains original identity records without duplicating the reused page',()=>{
 const exercise=source=>{const api=runtime(source);const page={id:'page',type:'PAGE',key:'saved-page-key'};
  api.seed([page,{id:'prior',type:'FRAME',key:'saved-frame-key'}]);
  api.own(handle('page',{type:'PAGE',key:'new-key'}));
  assert.strictEqual(api.rows[0],page,'saved identity object and its fields remain the receipt entry');
  api.retain(handle('prior',{type:'TEXT'}));api.own(handle('fresh'));
  return plain(api.rows);
 };
 assert.deepEqual(exercise(candidate),[{id:'page',type:'PAGE',key:'saved-page-key'},{id:'prior',type:'FRAME',key:'saved-frame-key'},{id:'fresh',type:'FRAME'}]);
});
