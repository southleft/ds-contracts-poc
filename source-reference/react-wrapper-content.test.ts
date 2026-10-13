import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {evidenceSha} from './react-validation-evidence.js';
import {readReactWrapperContent} from './react-wrapper-content.js';
import {readReactContextualContent,verifiedReactContextualContent} from './react-contextual-content.js';
import {linkReactSourceAnatomy} from './react-source-anatomy.js';

type FixtureArguments = Parameters<typeof readReactContextualContent>[0] & Pick<Parameters<typeof readReactWrapperContent>[0], 'wrappers'>;

/** Host-owned unit receipts, not a substitute for a fresh source observation. */
function fixture(){
 const dir=realpathSync(mkdtempSync(path.join(tmpdir(),'react-wrapper-content-')));
 const file=path.join(dir,'control.js');writeFileSync(file,'export const Control = null;');
 const sha=evidenceSha(Buffer.from('export const Control = null;')),inputs={[file]:sha};
 const source={module:'control.js',exportName:'Control',sourceSha256:sha,span:{start:0,end:28}};
 const render={file:'control.js',sha256:sha,start:1,end:27},output={file:'control.js',sha256:sha,start:10,end:26};
 const tree={tag:'span',classes:['source-class'],nodes:[{t:'text',v:'Caller'}],style:{display:'inline-flex'},pseudo:{}};
 const ownership={version:1,rendererVersions:['19.2.7'],components:[{id:'control',source,props:{children:'Caller'},roots:['']}],nodes:[{path:'',tag:'span',nearestComponent:'control',createdBy:'control',creationSite:{module:'control.js',sourceSha256:sha,span:{start:10,end:26},functionSpan:{start:1,end:27},factory:'createElement'}}],problems:[]};
 const program={version:1,status:'observed',acceptedContract:null,files:inputs,components:[{...source,implementation:'source-checked',wrappers:['forwardRef'],root:{kind:'conditional',whenTrue:{kind:'host',name:'section'},whenFalse:{kind:'host',name:'span'}},children:{kind:'unresolved',reason:'runtime-export-body-unmodeled'},problems:[],helperCandidates:[{call:{start:2,end:8}}]}],problems:[]};
 const input={kind:'record',fields:[['children',{kind:'opaque'}]]};
 const model={status:'modeled',acceptedContract:null,runtimeVerified:false,content:'forwarded',input,component:render,output:{kind:'jsx',tag:{kind:'host',name:'span'},source:output,props:{kind:'record',fields:[['children',{kind:'opaque'}],['className',{kind:'literal',type:'string',value:'source-class'}]]}}};
 const containing=structuredClone(model);
 const child={kind:'string',value:'Caller'};
 const boundary={input:{render:0,fields:[['children',child]]},output:{type:{kind:'string',value:'span'},fields:[['children',child],['className',{kind:'string',value:'source-class'}]]}};
 const runtime={status:'observed',targetInitializers:{targets:[{render,invocations:[boundary]}]}};
 const verified={rows:[{source:render,render:0,status:'verified',consumerBodyVerified:true}]};
 const plan={boundaryOnly:true,models:[],bodyModels:[model],initializers:[{target:source,render}],targets:[source],contextExportReads:[]};
 const helperModel={status:'modeled',acceptedContract:null,runtimeVerified:false,input,callSite:{start:2,end:8},instrumentation:{helper:{},metadata:{}}};
 const helperRuntime={status:'observed',helperCalls:1,components:[{context:0,content:'forwarded',helperCalls:1}],events:[{context:0,inputKeys:['children']}]};
 const helperPlan={models:[helperModel,containing],component:render,call:helperModel.callSite,helper:{},metadata:{}};
 const png=Buffer.from('unit-png-bytes');
 function seal(){
  const blobs=new Map<string,Buffer>();
  const save=(id:string,name:string,value:unknown)=>{const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));blobs.set(id+'/'+name,bytes);return evidenceSha(bytes);};
  const capture={status:'captured',problems:[],tree,treeSha256:evidenceSha(JSON.stringify(tree)),sourcePngSha256:evidenceSha(png)};
  const shared=(id:string)=>({treeSha256:capture.treeSha256,pngSha256:save(id,'observed.png',png),ownershipSha256:save(id,'ownership.json',ownership),pairedOwnershipSha256:save(id,'paired-ownership.json',ownership)});
  const wrapper={version:1,acceptedContract:null,effectsVerified:false,status:'observed',qualification:'original-call-wrapper-state-only',inputs,runtime,contextConsumers:verified,evidence:{...shared('wrapper-0'),modelSha256:save('wrapper-0','model.json',model),planSha256:save('wrapper-0','plan.json',plan),runtimeSha256:save('wrapper-0','runtime.json',runtime),contextConsumersSha256:save('wrapper-0','context-consumers.json',verified),buildSha256:save('wrapper-0','build.json',{referenceId:'reference',inputs})}};
  save('wrapper-0','tree.json',capture);save('wrapper-0','report.json',wrapper);
  const helper={version:1,id:'helper-0',instanceId:'control',status:'observed',containingContentQualified:false,containingFlow:{status:'observed',content:'forwarded',modelSha256:save('helper-0','component-model.json',containing)},inputs,runtime:helperRuntime,evidence:{...shared('helper-0'),modelSha256:save('helper-0','model.json',helperModel),planSha256:save('helper-0','plan.json',helperPlan),runtimeSha256:save('helper-0','runtime.json',helperRuntime),buildSha256:save('helper-0','build.json',{originalReferenceId:'reference',guardedReferenceId:'guarded',inputs}),referenceId:'guarded'}};
  save('helper-0','tree.json',capture);save('helper-0','report.json',helper);
  const args={referenceId:'reference',sourceRoot:dir,program,ownership,tree,helpers:[helper],wrappers:[{path:'',result:wrapper}],read:(id:string,name:string)=>{const bytes=blobs.get(id+'/'+name);assert(bytes,'missing fixture artifact '+id+'/'+name);return bytes;}};
  return {args:args as unknown as FixtureArguments,blobs};
 }
 return {dir,source,program,ownership,tree,model,containing,runtime,verified,plan,boundary,seal,dispose:()=>rmSync(dir,{recursive:true,force:true})};
}

test('original wrapper authenticates a selected intrinsic host and coalesces the independent helper proof',()=>{
 const f=fixture();try{
  const {args,blobs}=f.seal();
  for(const [helpers,wrappers] of [[args.helpers,[]],[[],args.wrappers],[args.helpers,args.wrappers]] as const){
   const options={...args,helpers,wrappers};const capability=readReactContextualContent(options);
   const facts=verifiedReactContextualContent(capability,args.program,args.ownership,args.tree);
   assert.equal(facts.length,1);assert.equal(facts[0].instanceId,'control');assert.equal(facts[0].tag,'span');
   assert.equal(facts[0].delegatedTarget,undefined);assert.equal(facts[0].delegatedClassName,undefined);
   const anatomy=linkReactSourceAnatomy(args.program,args.ownership,args.tree,capability);
   assert.equal(anatomy.status,'linked',JSON.stringify(anatomy.problems));assert.equal(anatomy.instances[0].content,'caller-slot');
  }
  const capability=readReactContextualContent(args);
  const original=blobs.get('wrapper-0/runtime.json')!;blobs.set('wrapper-0/runtime.json',Buffer.from('{}'));
  assert.throws(()=>verifiedReactContextualContent(capability,args.program,args.ownership,args.tree),/artifact-changed/,'coalescing retains the wrapper proof');blobs.set('wrapper-0/runtime.json',original);
  blobs.set('helper-0/runtime.json',Buffer.from('{}'));
  assert.throws(()=>verifiedReactContextualContent(capability,args.program,args.ownership,args.tree),/artifact-changed/,'coalescing retains the helper proof');
 }finally{f.dispose();}
 const conflict=fixture();try{
  conflict.containing.output.tag.name='section';const {args}=conflict.seal();
  assert.throws(()=>readReactContextualContent(args),/ambiguous-observation/,'different authenticated host facts cannot coalesce');
 }finally{conflict.dispose();}
});

test('intrinsic host wrapper refuses changed root, ownership, source, children and body authority',()=>{
 const cases:Array<[string,(f:ReturnType<typeof fixture>)=>void,RegExp]>=[
  ['wrong captured host',f=>{f.tree.tag='section';},/host-root-mismatch/],
  ['wrong observed host',f=>{f.ownership.nodes[0].tag='section';},/host-root-mismatch/],
  ['wrong owner',f=>{f.ownership.nodes[0].createdBy='other';},/host-root-mismatch/],
  ['wrong nearest instance',f=>{f.ownership.nodes[0].nearestComponent='other';},/host-root-mismatch/],
  ['wrong path',f=>{f.ownership.nodes[0].path='0';},/host-root-mismatch/],
  ['duplicate root',f=>{f.ownership.nodes.push(structuredClone(f.ownership.nodes[0]));},/host-root-mismatch/],
  ['extra owned descendant',f=>{f.ownership.nodes.push({...structuredClone(f.ownership.nodes[0]),path:'0'});},/host-root-mismatch/],
  ['unproved host branch',f=>{f.program.components[0].root.whenFalse.name='div';},/source-root-unqualified/],
  ['unproved source',f=>{f.program.components[0].implementation='unresolved';},/source-root-unqualified/],
  ['unresolved control flow',f=>{(f.program.components[0].problems as string[]).push('component-return-control-flow-unresolved');},/source-root-unqualified/],
  ['missing return site',f=>{delete (f.ownership.nodes[0] as {creationSite?:unknown}).creationSite;},/host-output-mismatch/],
  ['changed return module',f=>{f.ownership.nodes[0].creationSite.module='other.js';},/host-output-mismatch/],
  ['changed return hash',f=>{f.ownership.nodes[0].creationSite.sourceSha256='0'.repeat(64);},/host-output-mismatch/],
  ['changed render span',f=>{f.ownership.nodes[0].creationSite.functionSpan.end--;},/host-output-mismatch/],
  ['changed return site',f=>{f.ownership.nodes[0].creationSite.span.end--;},/host-output-mismatch/],
  ['changed runtime host',f=>{f.boundary.output.type.value='section';},/host-output-mismatch/],
  ['changed children',f=>{f.boundary.output.fields[0][1]={kind:'string',value:'Replacement'};},/children-changed/],
  ['missing body proof',f=>{f.verified.rows[0].consumerBodyVerified=false;},/body-unverified/],
  ['missing render',f=>{f.runtime.targetInitializers.targets[0].invocations=[];},/render-ambiguous/],
  ['duplicate render',f=>{f.runtime.targetInitializers.targets[0].invocations.push(structuredClone(f.boundary));},/render-ambiguous/],
  ['missing runtime',f=>{f.runtime.status='refused';},/forwarding-unverified/],
 ];
 for(const [name,mutate,reason] of cases){const f=fixture();try{mutate(f);const {args}=f.seal();assert.throws(()=>readReactWrapperContent(args),reason,name);}finally{f.dispose();}}
 const f=fixture();try{
  const {args}=f.seal();assert.throws(()=>readReactContextualContent({...args,wrappers:[...args.wrappers!,...args.wrappers!],read:(id,name)=>args.read(id==='wrapper-1'?'wrapper-0':id,name)}),/ambiguous-observation/,'duplicate wrapper claims do not coalesce');
 }finally{f.dispose();}
});

test('delegated wrapper retains its exact target and source-class proof',()=>{
 const f=fixture();try{
  const {args,blobs}=f.seal(),row=args.wrappers![0].result;
  const model=JSON.parse(blobs.get('wrapper-0/model.json')!.toString());
  const plan=JSON.parse(blobs.get('wrapper-0/plan.json')!.toString());
  const target={module:'leaf.js',exportName:'Leaf',sourceSha256:'1'.repeat(64),span:{start:0,end:30}};
  const read={file:'control.js',sha256:f.source.sourceSha256,start:8,end:9};
  model.output.tag={kind:'source-read',source:read};plan.bodyModels=[model];
  plan.contextExportReads=[{consumer:plan.initializers[0].render,read,target}];
  args.program.components[0].root={kind:'component',definition:target};
  args.ownership.components.push({id:'leaf',parent:'control',source:target,props:{children:'Caller',className:'source-class'},roots:['']});
  args.ownership.nodes[0].createdBy='leaf';args.ownership.nodes[0].nearestComponent='leaf';
  const save=(name:string,value:unknown)=>{const bytes=Buffer.from(JSON.stringify(value));blobs.set('wrapper-0/'+name,bytes);return evidenceSha(bytes);};
  row.evidence!.modelSha256=save('model.json',model);row.evidence!.planSha256=save('plan.json',plan);
  row.evidence!.ownershipSha256=save('ownership.json',args.ownership);row.evidence!.pairedOwnershipSha256=save('paired-ownership.json',args.ownership);
  save('report.json',row);
  const proof=readReactWrapperContent(args);
  assert.deepEqual(proof.facts,[{delegatedClassName:{instanceId:'leaf',value:'source-class'},instanceId:'control',tag:'span',helperId:'wrapper-0',modelSha256:row.evidence!.modelSha256,delegatedTarget:target}]);
  plan.contextExportReads[0].target={...target,sourceSha256:'2'.repeat(64)};
  row.evidence!.planSha256=save('plan.json',plan);save('report.json',row);
  assert.throws(()=>readReactWrapperContent(args),/delegated-target-mismatch/);
 }finally{f.dispose();}
});
