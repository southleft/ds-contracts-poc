import {test} from 'node:test';import assert from 'node:assert/strict';
import {ContractSchema} from '../scripts/contract-schema.js';
import {selectFigmaImportRoot} from './figma-import-selection.js';
const contract=(id:string,nodeId:string)=>ContractSchema.parse({id:'example.'+id,name:'Example'+id,version:'0.1.0',status:'draft',description:'Selection control fixture',semantics:{element:'div'},props:[],states:[],anatomy:{root:{}},bindings:{figma:{anchors:{fileKey:'file',componentSetKey:null,nodeId}},code:{anchors:{importPath:'example',export:'Example'+id}}}});
const occurrence=()=>({_occurrences:{version:1,dependencyInventory:'complete',requested:['board'],roots:[{source:{fileKey:'file',nodeId:'board'},root:{nodeId:'board'}}]}});
const closure=()=>({_provenance:{closure:{rule:'follow-instances',cap:64,requested:[{nodeId:'two',name:'Two',type:'COMPONENT_SET'}],pulled:[],unresolved:[],cycles:[]}}});
test('ordinary occurrence selection requires an in-process host resolver',()=>{
 assert.throws(()=>selectFigmaImportRoot(occurrence(),[contract('one','main')]),/host-proof-required/);
 const bad=occurrence();bad._occurrences.requested.push('other');assert.throws(()=>selectFigmaImportRoot(bad,[]),/selection-unqualified/);
 const foreign=occurrence();foreign._occurrences.roots[0].source.nodeId='foreign';assert.throws(()=>selectFigmaImportRoot(foreign,[]),/source-mismatch/);
});
test('host resolver still needs unique physical root and file anchors',()=>{
 assert.throws(()=>selectFigmaImportRoot(occurrence(),[contract('one','main')],()=>({contractId:'example.one'})),/proposal-mismatch/);
 assert.throws(()=>selectFigmaImportRoot(occurrence(),[contract('one','board'),contract('one','board')],()=>({contractId:'example.one'})),/proposal-mismatch/);
 const selected=selectFigmaImportRoot(occurrence(),[contract('one','board')],()=>({contractId:'example.one'}));
 assert.equal(selected.kind,'occurrence');assert.equal(selected.nodeId,'board');
});
test('existing declaration selection keeps explicit anchors and refusal behavior',()=>{
 const one=contract('one','one'),two=contract('two','two');
 assert.equal(selectFigmaImportRoot({},[one,two]).contractId,one.id);
 assert.equal(selectFigmaImportRoot(closure(),[one,two]).contractId,two.id);
 assert.throws(()=>selectFigmaImportRoot(closure(),[one]),/requested-contract-not-found/);
 assert.throws(()=>selectFigmaImportRoot(closure(),[two,contract('one','two')]),/requested-contract-ambiguous/);
 assert.throws(()=>selectFigmaImportRoot({},[]),/no-proposals/);
 const empty=closure();empty._provenance.closure.requested=[];assert.throws(()=>selectFigmaImportRoot(empty,[one]),/requested-set-missing/);
});
