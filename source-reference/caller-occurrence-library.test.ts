import {test} from 'node:test';import assert from 'node:assert/strict';
import {authenticatedCallerAssignment,type CallerAssignmentProof} from './caller-occurrence-assignment.js';
import {callerOccurrenceLibraryRequest} from './caller-occurrence-library.js';
// These are adversarial API values, not capture or positive-authority fixtures.
test('structurally copied or JSON supplied authority cannot prepare a library',()=>{
 for(const proof of [{},{kind:'host-positive-filled-slot-inputs',canonicalSha256:'0'.repeat(64),assignments:[],pins:{}},JSON.parse('{"kind":"host-positive-filled-slot-inputs"}')]){
  assert.throws(()=>authenticatedCallerAssignment(proof as CallerAssignmentProof,{}),/host-proof-required/);
  assert.throws(()=>callerOccurrenceLibraryRequest(proof as CallerAssignmentProof,{}),/host-proof-required/);
 }
});

import {verifyCallerReadbackContinuity} from './caller-occurrence-assignment.js';
import {verifyCallerFieldWitnessCurrent} from './caller-field-witness.js';
test('current observation cannot change a retained envelope or node census',()=>{
 const historical={operationId:'original',content:{nodes:[{id:'node'}]}};
 assert.throws(()=>verifyCallerReadbackContinuity({},historical,{operationId:'other',content:{nodes:[{id:'node'}]}}),/current-capture-envelope/);
 assert.throws(()=>verifyCallerReadbackContinuity({},historical,{operationId:'original',content:{nodes:[]}}),/current-capture-census/);
});
test('unfiltered current text fields stay binding when a matching profile gains fields',()=>{
 // An adversarial API fixture is not a native capture or positive authority.
 const witness={before:{rows:[],texts:[{id:'text',characters:'Hello',fields:{fontWeight:{present:true,value:500},textAutoResize:{present:true,value:'WIDTH_AND_HEIGHT'}}}]}};
 const native={content:{nodes:[{id:'text',type:'TEXT',metadata:{},values:{characters:'Hello',fontWeight:600}}]}};
 assert.throws(()=>verifyCallerFieldWitnessCurrent(witness,native),/current-text-field:fontWeight/);
 native.content.nodes[0].values={characters:'Hello',fontWeight:500,textAutoResize:'NONE'} as any;
 assert.throws(()=>verifyCallerFieldWitnessCurrent(witness,native),/current-text-field:textAutoResize/);
});
