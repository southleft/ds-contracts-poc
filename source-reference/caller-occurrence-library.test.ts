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


import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {canonicalJson} from '../core/contract-provenance.js';
import {ContractSchema} from '../scripts/contract-schema.js';

// Synthetic lowerer inputs only. This VM-local dependency double never issues
// or registers a real host proof; the real exported-entry refusal stays above.
function sourceModule(file:string,overrides:Record<string,unknown>={},append='') {
 const realRequire=createRequire(import.meta.url),context={exports:{} as any,structuredClone,require:(id:string)=>Object.hasOwn(overrides,id)?overrides[id]:realRequire(id)};
 const source=readFileSync(new URL(file,import.meta.url),'utf8');
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText+append,context);
 return context.exports;
}
function repeatedCallerFixture() {
 const identity=[[1,0,0],[0,1,0]],fileKey='synthetic-file';
 const frameValues={x:0,y:0,width:240,height:40,visible:true,opacity:1,relativeTransform:identity,targetAspectRatio:null,
  layoutMode:'VERTICAL',primaryAxisAlignItems:'MIN',counterAxisAlignItems:'MIN',primaryAxisSizingMode:'AUTO',counterAxisSizingMode:'FIXED',
  layoutSizingHorizontal:'FIXED',layoutSizingVertical:'HUG',layoutPositioning:'AUTO',layoutWrap:'NO_WRAP',clipsContent:false,
  itemSpacing:0,paddingTop:0,paddingRight:0,paddingBottom:0,paddingLeft:0,minWidth:null,minHeight:null,maxWidth:null,maxHeight:null,
  fills:[],strokes:[],effects:[],boundVariables:{},explicitVariableModes:{},componentPropertyReferences:null,reactions:[],
  topLeftRadius:0,topRightRadius:0,bottomRightRadius:0,bottomLeftRadius:0,cornerRadius:0,strokeAlign:'INSIDE',strokeCap:'NONE',
  strokeWeight:1,strokeTopWeight:1,strokeRightWeight:1,strokeBottomWeight:1,strokeLeftWeight:1};
 const text=(id:string,characters:string)=>{
  const fontName={family:'Inter',style:'Regular',variationSettings:{wght:400,slnt:0}},color={r:0,g:0,b:0};
  const appearance={characters,runs:[{start:0,end:characters.length,fontName,fontSize:14,fontWeight:400,
   lineHeight:{unit:'PIXELS',value:20},letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',
   fill:{variableId:'ink-id',paint:{color,opacity:1,blendMode:'NORMAL'}}}]};
  const node={nodeId:id,type:'TEXT',children:[],text:{characters,textAutoResize:'WIDTH_AND_HEIGHT',sourceAppearance:appearance},
   variableConsumers:{'ink-id':{name:'ink',value:{...color,a:1},selectedValue:{...color,a:1}},'size-id':{name:'size',value:14,selectedValue:14}}};
  const native={id,type:'TEXT',childIds:[],values:{visible:true,opacity:1,x:0,y:0,width:100,height:20,relativeTransform:identity,
   targetAspectRatio:null,layoutSizingHorizontal:'HUG',layoutSizingVertical:'HUG',layoutPositioning:'AUTO',minWidth:null,minHeight:null,maxWidth:null,maxHeight:null,
   fills:[{type:'SOLID',visible:true,color,opacity:1,blendMode:'NORMAL',boundVariables:{color:{type:'VARIABLE_ALIAS',id:'ink-id'}}}],
   strokes:[],strokeAlign:'OUTSIDE',strokeCap:'NONE',strokeWeight:1,effects:[],boundVariables:{fills:[{type:'VARIABLE_ALIAS',id:'ink-id'}],fontSize:[{type:'VARIABLE_ALIAS',id:'size-id'}]},
   explicitVariableModes:{},resolvedVariableModes:{},componentPropertyReferences:{},characters,fontName,fontSize:14,fontWeight:400,
   lineHeight:{unit:'PIXELS',value:20},textAlignHorizontal:'LEFT',letterSpacing:{unit:'PIXELS',value:0},textCase:'ORIGINAL',textDecoration:'NONE',textStyleId:'',reactions:[],textAutoResize:'WIDTH_AND_HEIGHT'}};
  return {node,native};
 };
 const first=text('first-text','First caller'),second=text('second-text','Second caller');
 const instance=(id:string,children:any[])=>({nodeId:id,type:'INSTANCE',children:[{nodeId:id+'-slot',type:'SLOT',children:[{nodeId:id+'-layout',type:'FRAME',children}]}],
  instanceSizing:{horizontal:'FILL',vertical:'HUG'},instanceSlotObservation:{componentProperties:{}}});
 const firstUse=instance('first',[first.node]),secondUse=instance('second',[second.node]),outer=instance('outer',[firstUse,secondUse]);
 const root={nodeId:'board',type:'FRAME',children:[outer]};
 const dump={_occurrences:{version:1,dependencyInventory:'complete',requested:['board'],roots:[{source:{fileKey,nodeId:'board'},root,requiredMains:[]}]},
  _variables:{ink:{type:'COLOR',value:'#000000'},size:{type:'FLOAT',value:14}},
  _degradations:Array.from({length:7},(_,i)=>({code:'synthetic-retained-degradation-'+i}))};
 const definition=(id:string,name:string)=>({contract:ContractSchema.parse({id,name,version:'0.1.0',status:'draft',description:'Synthetic lowerer definition',semantics:{element:'div'},props:[],states:[],
  anatomy:{root:{slot:{name:'children'},literals:{width:'100%',height:'fit-content'}}},bindings:{code:{anchors:{importPath:'synthetic/'+name,export:name}},figma:{anchors:{fileKey,componentSetKey:'owner-'+name,nodeId:'set-'+name}}}}),
  component:{rootSlot:{property:'Content'}},creation:{target:{id:'set-'+name,key:'owner-'+name},variants:[{id:'main-'+name,key:'key-'+name}]}});
 const family=[definition('synthetic.shell','Shell'),definition('synthetic.leaf','Leaf')];
 const assignment=(id:string,name:string,contentIds:string[])=>({instanceId:id,mainId:'main-'+name,mainKey:'key-'+name,ownerId:'set-'+name,ownerKey:'owner-'+name,
  propertyId:'Content#synthetic',slotId:id+'-slot',mainSlotId:'main-slot-'+name,targetId:id+'-layout',contentIds,allocationIds:contentIds.map(id=>'allocation-'+id)});
 const assignments=[assignment('outer','Shell',['first','second']),assignment('first','Leaf',['first-text']),assignment('second','Leaf',['second-text'])];
 const rows:any[]=[];const visit=(node:any)=>{rows.push({id:node.nodeId,type:node.type,childIds:node.children.map((n:any)=>n.nodeId),values:node.nodeId==='board'?frameValues:{}});node.children.forEach(visit);};visit(root);
 for(const value of [first.native,second.native])rows[rows.findIndex(n=>n.id===value.id)]=value;
 const proof={kind:'host-positive-filled-slot-inputs',canonicalSha256:'1'.repeat(64),assignments,pins:{synthetic:true}};
 const saved={dump,native:{fileKey,content:{nodes:rows}},proof,family,sourceTokens:[{}],icons:{},fieldWitness:null};
 return {saved,dump,first:firstUse,second:secondUse};
}
function syntheticLower(saved:ReturnType<typeof repeatedCallerFixture>['saved']) {
 const sentinel={},dump=saved.dump;
 const api=sourceModule('./caller-occurrence-library.ts',{'./caller-occurrence-assignment.js':{authenticatedCallerAssignment:(proof:unknown,given:unknown)=>{
  assert.equal(proof,sentinel,'only the test sentinel reaches this dependency double');
  assert.equal(canonicalJson(given),canonicalJson(dump));return structuredClone(saved);
 }}});
 return api.callerOccurrenceLibraryRequest(sentinel,dump);
}

test('synthetic lowerer preserves two uses of one main with distinct caller text and one dependency definition',()=>{
 const {saved}=repeatedCallerFixture(),before=canonicalJson(saved),out=syntheticLower(saved),again=syntheticLower(saved);
 assert.equal(canonicalJson(out),canonicalJson(again),'preparation is deterministic');assert.equal(canonicalJson(saved),before,'input is unchanged');
 assert.equal(out.request.contracts.filter((c:any)=>c.id==='synthetic.leaf').length,1);
 const entry=out.request.contracts.find((c:any)=>c.id===out.request.rootId),outer:any=Object.values(entry.anatomy.root.parts)[0];
 const uses:any[]=Object.values(outer.parts);assert.equal(uses.length,2);
 assert.deepEqual(uses.map(p=>p.component.id),['synthetic.leaf','synthetic.leaf']);
 const texts:any[]=uses.map(p=>Object.values(p.parts)[0]);
 assert.deepEqual(texts.map(p=>p.text),['First caller','Second caller']);
 assert.deepEqual(texts.map(p=>p.tokens),[{color:'{ink}','font-size':'{size}'},{color:'{ink}','font-size':'{size}'}]);
 assert.equal(new Set(uses.flatMap(p=>Object.keys(p.parts))).size,2,'each physical text has its own part key');
 assert.equal(out.source.assignments.length,3);assert.deepEqual(out.source.degradations,saved.dump._degradations);
 assert.equal(out.source.qualification,'unqualified');assert.equal(out.source.acceptedContract,null);
});

test('synthetic lowerer keeps occurrence coverage separate from unique family coverage',()=>{
 const changes:Array<[(saved:ReturnType<typeof repeatedCallerFixture>['saved'])=>void,RegExp]>=[
  [s=>{s.proof.assignments.push(structuredClone(s.proof.assignments[1]));},/assignment-census/],
  [s=>{s.proof.assignments.pop();},/assignment-census/],
  [s=>{s.proof.assignments[2].instanceId='foreign';},/assignment-census/],
  [s=>{s.proof.assignments[0].contentIds=['first'];},/assignment-census/],
  [s=>{s.proof.assignments[2].contentIds=['first-text'];},/part-key-reused|caller-root-reused/],
  [s=>{s.proof.assignments[2].mainKey='foreign';},/main-family-identity/],
  [s=>{s.family.pop();},/main-family-identity/],
  [s=>{const extra=structuredClone(s.family[1]);extra.contract.id='synthetic.unused';extra.contract.name='Unused';extra.creation.variants=[{id:'unused',key:'unused'}];s.family.push(extra);},/complete-family-required/],
 ];
 for(const[change,reason]of changes){const{saved}=repeatedCallerFixture();change(saved);assert.throws(()=>syntheticLower(saved),reason);}
});

test('required-main inventory deduplicates exact repeated identities and refuses incomplete or conflicting claims',()=>{
 // Expose only the private pure comparison in this VM; no production export or
 // host authentication bypass is added, and no operation/capture is issued.
 const assignmentSource=readFileSync(new URL('./caller-occurrence-assignment.ts',import.meta.url),'utf8');
 const unusedImports=Object.fromEntries(ts.preProcessFile(assignmentSource).importedFiles.map(row=>[row.fileName,{}]));
 const api=sourceModule('./caller-occurrence-assignment.ts',{...unusedImports,'../core/contract-provenance.js':{canonicalJson}},';exports.verifyInventory=verifyRequiredMainInventory;');
 const first={componentId:'one',componentKey:'key-one',ownerId:'set',ownerKey:'set-key',ownerType:'COMPONENT_SET'},second={...first,componentId:'two',componentKey:'key-two'};
 api.verifyInventory([second,first],[first,second,{...first}]);
 for(const required of [[first],[first,second,first],[first,second,{...second,componentId:'foreign'}],[{},first],null])assert.throws(()=>api.verifyInventory(required,[first,second,first]),/required-main-inventory/);
 for(const key of ['componentKey','ownerId','ownerKey','ownerType'])assert.throws(()=>api.verifyInventory([first],[first,{...first,[key]:'foreign'}]),/required-main-identity-conflict/);
});
