import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
import {wrapNativeSourceWrite} from './native-source-write.js';
import {nativePreparedTargetRegistryRuntime} from './native-prepared-target-registry.js';
const operation='80000000-0000-4000-8000-000000000008';
const cid=(s:string)=>'source-native:'+operation+':'+s;
function host(ids=[cid('one')]) {
 let queries=0;
 const page:any={id:'page',type:'PAGE',children:[],findAllWithCriteria(){queries++;const out:any[]=[];const visit=(n:any)=>{if(['COMPONENT','COMPONENT_SET'].includes(n.type))out.push(n);for(const c of n.children||[])visit(c);};this.children.forEach(visit);return out;}};
 const owner='owner',owned=new Map(),retained:any[]=[];
 const context:any={figma:{root:{children:[page]}},NATIVE:{operation:{id:operation}},NATIVE_PAGE:page,nativeOwner:owner,nativeOwnedNodes:owned,nativeFileGuard(){},nativeRefuse(code:string){throw Error(code);}};
 const api=vm.runInNewContext(nativePreparedTargetRegistryRuntime(ids)+'\n({audit:nativePreparedAudit,register:nativePreparedRegister,resolve:nativePreparedResolve})',context);
 const add=(id:string,contractId:string,type='COMPONENT')=>{const metadata:any={contractId,nativeSourceOperation:owner,nativeSourceAllocation:id};const n:any={id,key:id+'-key',type,parent:page,removed:false,children:[],getSharedPluginData(_ns:string,k:string){return metadata[k]??'';},metadata};page.children.push(n);owned.set(id,n);retained.push({id,type});return n;};
 return {api,page,owned,retained,add,queries:()=>queries};
}
test('fresh preflight rejects an existing scoped target before any registration',()=>{
 const h=host();h.add('foreign',cid('one'));assert.throws(()=>h.api.audit(false),/prepared-target-collision/);
 const empty=host();empty.add('other','unrelated');assert.doesNotThrow(()=>empty.api.audit(false));
});
test('completed targets resolve without repeated global scans; final audit still scans',()=>{
 const h=host([cid('one'),cid('two')]);h.api.audit(false);const a=h.add('a',cid('one')),b=h.add('b',cid('two'),'COMPONENT_SET');
 h.api.register({contractId:cid('one'),isSet:false},a);h.api.register({contractId:cid('two'),isSet:true},b);
 for(let i=0;i<4000;i++)assert.strictEqual(h.api.resolve({contractId:cid(i%2?'one':'two')}),i%2?a:b);
 assert.equal(h.queries(),1);h.api.audit(true);assert.equal(h.queries(),2);
});
test('missing, out-of-scope and duplicate registrations refuse without modifying retained allocations',()=>{
 const h=host();h.api.audit(false);assert.throws(()=>h.api.resolve({contractId:cid('one')}),/unregistered/);
 const a=h.add('a',cid('one'));h.api.register({contractId:cid('one'),isSet:false},a);const before=JSON.stringify(h.retained);
 assert.throws(()=>h.api.register({contractId:cid('one'),isSet:false},a),/registration/);
 assert.throws(()=>h.api.register({contractId:cid('outside'),isSet:false},a),/registration/);assert.equal(JSON.stringify(h.retained),before);
});
test('each hit rechecks live identity, type, parent, key and ownership',()=>{
 const corruptions=[(h:any,n:any)=>n.removed=true,(h:any,n:any)=>n.id='changed',(h:any,n:any)=>n.type='FRAME',(h:any,n:any)=>n.parent={id:'foreign'},(h:any,n:any)=>n.key='changed',
 (h:any,n:any)=>n.metadata.contractId=cid('other'),(h:any,n:any)=>n.metadata.nativeSourceOperation='foreign',(h:any,n:any)=>n.metadata.nativeSourceAllocation='foreign',(h:any,n:any)=>h.owned.set(n.id,{...n})];
 for(const change of corruptions){const h=host();h.api.audit(false);const n=h.add('a',cid('one'));h.api.register({contractId:cid('one'),isSet:false},n);change(h,n);const before=JSON.stringify(h.retained);assert.throws(()=>h.api.resolve({contractId:cid('one')}),/prepared-target-changed/);assert.equal(JSON.stringify(h.retained),before);}
});
test('a concurrent foreign duplicate cannot escape final success audit',()=>{
 const h=host();h.api.audit(false);const a=h.add('a',cid('one'));h.api.register({contractId:cid('one'),isSet:false},a);
 h.add('foreign',cid('one'));assert.strictEqual(h.api.resolve({contractId:cid('one')}),a);const before=JSON.stringify(h.retained);assert.throws(()=>h.api.audit(true),/collision/);assert.equal(JSON.stringify(h.retained),before);
});
test('missing final target and incomplete graph refuse',()=>{
 const h=host();h.api.audit(false);assert.throws(()=>h.api.audit(true),/incomplete/);
 const a=h.add('a',cid('one'));h.api.register({contractId:cid('one'),isSet:false},a);h.page.children=[];assert.throws(()=>h.api.audit(true),/incomplete/);
});
test('generic identity resolver body stays unchanged, including duplicate and anchor/legacy refusals',()=>{
 const current=fs.readFileSync(new URL('./emit-figma-script.ts',import.meta.url),'utf8');
 const extract=(s:string)=>s.slice(s.indexOf('function isSyncTarget('),s.indexOf('function setInstanceProps('));
 const injected="${hasPreparedTargetRegistry ? '\\n  if (!NATIVE.recovery && nativePreparedExpectedIds.has(ref.contractId)) return nativePreparedResolve(ref);' : ''}";
 const generic=vm.runInNewContext('`'+extract(current)+'`',{hasPreparedTargetRegistry:false});
 assert(!generic.includes('nativePreparedResolve'));
 assert(current.includes(injected));
 const h=host();const resolve=vm.runInNewContext(generic+'\nresolveComponentIdentity', {figma:{root:{children:[h.page]}}});
 const a=h.add('a','generic');assert.equal(resolve({contractId:'generic',name:'Name'},'exact',false),a);
 h.add('b','generic');assert.throws(()=>resolve({contractId:'generic',name:'Name'},'duplicate',false),/duplicate ds_contracts/);h.page.children.pop();
 a.metadata.contractId='other';assert.throws(()=>resolve({contractId:'generic',name:'Name',anchorKey:a.key},'anchor',false),/contradictory/);
 a.metadata.contractId='';a.metadata.specHash='owned';a.name='Name';assert.equal(resolve({contractId:'generic',name:'Name'},'legacy',false),a);
 const b=h.add('b','');b.metadata.specHash='owned';b.name='Name';assert.throws(()=>resolve({contractId:'generic',name:'Name'},'legacy duplicate',false),/duplicate explicit legacy/);
});
test('registry identity inputs are bounded and operation scoped',()=>{
 assert.throws(()=>nativePreparedTargetRegistryRuntime([]),/IDS_INVALID/);assert.throws(()=>nativePreparedTargetRegistryRuntime([cid('one'),cid('one')]),/IDS_INVALID/);
 assert.throws(()=>host(['outside']).api.audit(false),/prepared-target-scope/);
});


test('standalone components and sets are targets; variant children never become competing targets',()=>{
 const h=host();const set=h.add('foreign-set','unrelated','COMPONENT_SET');
 const child=h.add('variant',cid('one'));h.page.children.pop();child.parent=set;set.children.push(child);
 assert.doesNotThrow(()=>h.api.audit(false));
 const main=h.add('main',cid('one'));h.api.register({contractId:cid('one'),isSet:false},main);assert.doesNotThrow(()=>h.api.audit(true));
 const other=host();other.api.audit(false);const wrong=other.add('wrong',cid('one'),'COMPONENT_SET');
 assert.throws(()=>other.api.register({contractId:cid('one'),isSet:false},wrong),/prepared-target-changed/);
});

test('the emitted recovery branch uses generic resolution and never consults the fresh registry',()=>{
 const source=fs.readFileSync(new URL('./emit-figma-script.ts',import.meta.url),'utf8');
 const part=source.slice(source.indexOf('function isSyncTarget('),source.indexOf('function setInstanceProps('));
 const generated=vm.runInNewContext('`'+part+'`',{hasPreparedTargetRegistry:true});
 const h=host(),main=h.add('old','recovery-exact');
 const resolve=vm.runInNewContext(generated+'\nresolveComponentIdentity',{figma:{root:{children:[h.page]}},NATIVE:{recovery:{}},nativePreparedExpectedIds:{has(){throw Error('fresh registry accessed during recovery');}},nativePreparedResolve(){throw Error('fresh registry resolved during recovery');}});
 assert.strictEqual(resolve({contractId:'recovery-exact',name:'old'},'recovery',false),main);
 const wrapper=fs.readFileSync(new URL('./native-source-write.ts',import.meta.url),'utf8');
 assert(wrapper.includes('const usePreparedRegistry = preparedGraphIds !== undefined && !prepared.descriptor.recovery;'));
 assert.equal((wrapper.match(/\$\{usePreparedRegistry \?/g)||[]).length,3);
});


test('invalid registry scope is a caught pre-allocation refusal in the full native wrapper',async()=>{
 let allocations=0;const empty=()=>{};const figma:any={fileKey:'FixtureFileKey',root:{children:[]},loadAllPagesAsync:async()=>{},setCurrentPageAsync:async()=>{},loadFontAsync:async()=>{},createPage(){allocations++;throw Error('unexpected allocation');},createComponent:empty,createFrame:empty,combineAsVariants:empty,variables:{getVariableCollectionByIdAsync:async()=>({id:'collection'}),getVariableByIdAsync:async()=>undefined}};
 const descriptor:any={operation:{id:operation,fileKey:figma.fileKey},identity:{collection:{id:'collection'},variables:[]},receipt:{collection:{id:'collection'},variables:[]},projection:{kind:'prepared-contract-library'},pageName:'new page',machineId:'machine'};
 const prepared:any={descriptor,readbackScript:'return {status:"readback-collected",receipt:NATIVE.receipt};'};
 const script=wrapNativeSourceWrite(prepared,'throw Error("renderer must not start");',[],false,['outside']);
 const result=await vm.runInNewContext('(async()=>{'+script+'})()',{figma});
 assert.equal(result.status,'refused');assert.equal(result.allocationAttempted,false);assert.equal(result.pageId,null);assert.equal(result.nodes.length,0);assert.match(result.problems[0],/prepared-target-scope/);assert.equal(allocations,0);
 const recovery=wrapNativeSourceWrite({...prepared,descriptor:{...descriptor,recovery:{creation:{pageId:'old-page',nodes:[]},observation:{},revision:'rev'}},recoveryReadbackScript:'return {};'},'',[],false,[cid('one')]);
 assert(!recovery.includes('const nativePreparedExpectedIds'));assert(!recovery.includes('nativePreparedAudit(false)'));
});
