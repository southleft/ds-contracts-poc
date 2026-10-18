import assert from 'node:assert/strict';import test from 'node:test';
import {ContractSchema} from '../../scripts/contract-schema.js';
import {REACT_LIBRARY_COMPONENT_LIMIT} from '../react-library-limits.js';
import {parseLibraryRequest,MAX_BYTES} from './react-library-input.js';
import {reactLibraryFamily} from '../src/engine/react-library.js';
import {clearWorkspace,recordImports,workspaceSnapshot,WORKSPACE_CAP} from '../src/engine/workspace.js';
const make=(count:number)=>Array.from({length:count},(_,i)=>ContractSchema.parse({id:`capacity.c${i}`,name:`C${i}`,version:'0.1.0',status:'draft',description:'Bounded family capacity test',semantics:{element:'div'},props:[],states:[],anatomy:{root:i+1<count?{parts:{next:{component:{id:`capacity.c${i+1}`}}}}:{text:'Last'}},bindings:{figma:{anchors:{fileKey:'capacity',componentSetKey:`key${i}`,nodeId:`node${i}`}},code:{anchors:{importPath:`./C${i}`,export:`C${i}`}}}}));
const request=(contracts:ReturnType<typeof make>)=>({rootId:contracts[0].id,contracts,tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:[]});
const inputs=(contracts:ReturnType<typeof make>)=>contracts.map(c=>({name:c.name,contractId:c.id,source:'figma' as const,contractText:JSON.stringify(c),receipts:null}));
test('ordinary 57-contract family preserves every identity and order through all shared capacity doors',()=>{
 clearWorkspace();assert.equal(WORKSPACE_CAP,64);assert.equal(REACT_LIBRARY_COMPONENT_LIMIT,WORKSPACE_CAP);assert.equal(MAX_BYTES,5*1024*1024);
 const c=make(57),family=reactLibraryFamily(c[0],new Map(c.map(v=>[v.id,v])));assert.deepEqual(family.map(v=>v.id),c.map(v=>v.id));
 assert.deepEqual(parseLibraryRequest(request(family)).contracts.map(v=>v.id),c.map(v=>v.id));const added=recordImports(inputs(c));assert.equal(added.length,57);assert.deepEqual(workspaceSnapshot().map(v=>v.contractId),c.map(v=>v.id));clearWorkspace();
 const boundary=make(64);assert.equal(parseLibraryRequest(request(reactLibraryFamily(boundary[0],new Map(boundary.map(v=>[v.id,v]))))).contracts.length,64);assert.equal(recordImports(inputs(boundary)).length,64);assert.equal(workspaceSnapshot().length,64);clearWorkspace();
});
test('65-contract family refuses atomically while duplicates remain a separate refusal',()=>{
 clearWorkspace();recordImports(inputs(make(1)));const before=JSON.stringify(workspaceSnapshot()),c=make(65);
 assert.throws(()=>reactLibraryFamily(c[0],new Map(c.map(v=>[v.id,v]))),/family-limit/);assert.throws(()=>parseLibraryRequest(request(c)),/family-limit/);assert.throws(()=>recordImports(inputs(c)),/workspace-import-too-large/);assert.equal(JSON.stringify(workspaceSnapshot()),before);
 assert.throws(()=>recordImports([...inputs(make(1)),...inputs(make(1))]),/workspace-duplicate-import/);assert.equal(JSON.stringify(workspaceSnapshot()),before);clearWorkspace();
});
test('quota refusal remains named while the complete accepted family stays in memory',()=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{throw Error('quota')},removeItem:()=>{}}});
 try{clearWorkspace();const result=recordImports(inputs(make(52)));assert.equal(workspaceSnapshot().length,52);assert(result.every(r=>JSON.stringify(r.receipts).includes('workspace-storage-refused')));}finally{clearWorkspace();if(prior)Object.defineProperty(globalThis,'sessionStorage',prior);else delete (globalThis as any).sessionStorage;}
});
