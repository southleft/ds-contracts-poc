import {readFileSync,realpathSync} from 'node:fs';
import {evidenceSha} from './react-validation-evidence.js';
import {reactOwnershipStructure,type ReactOwnership} from './react-ownership.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {CapturedNode} from '../extract/computed/lib.js';
import type {ReactJsxHelperObservation} from './react-jsx-helper-observation.js';
import type {ReactContextualContentFact} from './react-contextual-content.js';
import type {ReactContextConsumerEffects} from './react-target-effects.js';
import type {ReactJsxHelperInstrumentationPlan} from './react-helper-instrument.js';
import type {ReactHelperRuntimeReport} from './react-helper-runtime.js';
import type {ReactContextConsumerVerification} from './react-context-verification.js';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const identity=(d:{module:string;exportName:string;sourceSha256:string;span:{start:number;end:number}})=>JSON.stringify([d.module,d.exportName,d.sourceSha256,d.span]);
function need(v:unknown,why:string):asserts v{if(!v)throw Error('react-wrapper-content-'+why);}
/** Called by the host capability constructor for observations held by the
 * current runner or independently sealed journal. No serialized forwarding flag
 * alone grants root/content authority. */
export function readReactWrapperContent(options:{referenceId:string;program:ReactSourceProgram;ownership:ReactOwnership;tree:CapturedNode;wrappers:readonly {path:string;result:ReactJsxHelperObservation}[];read(id:string,name:string):Buffer}){
 const {program,ownership,tree}=options,facts:ReactContextualContentFact[]=[],inputs:Record<string,string>={},artifacts:Array<{helperId:string;name:string;sha256:string}>=[];
 for(const [index,item] of options.wrappers.entries()){
  const row=item.result;if(row.status!=='observed'||row.qualification!=='original-call-wrapper-state-only')continue;
  const id='wrapper-'+index,e=row.evidence;need(e&&row.inputs&&row.runtime&&row.contextConsumers,'evidence-incomplete');
  for(const [file,hash]of Object.entries(row.inputs)){need(realpathSync(file)===file&&evidenceSha(readFileSync(file))===hash,'inputs-changed');need(!inputs[file]||inputs[file]===hash,'input-conflict');inputs[file]=hash;}
  const bytes=(name:string)=>{const b=options.read(id,name);artifacts.push({helperId:id,name,sha256:evidenceSha(b)});return b;};
  const json=<T>(name:string,hash?:string):T=>{const b=bytes(name);need(hash&&evidenceSha(b)===hash,'artifact-changed:'+name);return JSON.parse(b.toString()) as T;};
  need(same(JSON.parse(bytes('report.json').toString()),row),'report-changed');
  const model=json<ReactContextConsumerEffects>('model.json',e.modelSha256),plan=json<ReactJsxHelperInstrumentationPlan>('plan.json',e.planSha256),runtime=json<ReactHelperRuntimeReport>('runtime.json',e.runtimeSha256),verified=json<ReactContextConsumerVerification>('context-consumers.json',e.contextConsumersSha256);
  const build=json<{referenceId:string;inputs:Record<string,string>}>('build.json',e.buildSha256),paired=json<ReactOwnership>('paired-ownership.json',e.pairedOwnershipSha256),actual=json<ReactOwnership>('ownership.json',e.ownershipSha256),capture=JSON.parse(bytes('tree.json').toString());
  need(build.referenceId===options.referenceId&&same(build.inputs,row.inputs)&&same(paired,ownership)&&same(reactOwnershipStructure(actual),reactOwnershipStructure(ownership)),'observation-mismatch');
  need(capture.status==='captured'&&!capture.problems.length&&same(capture.tree,tree)&&capture.treeSha256===e.treeSha256&&e.treeSha256===evidenceSha(JSON.stringify(tree))&&capture.sourcePngSha256===e.pngSha256&&evidenceSha(bytes('observed.png'))===e.pngSha256,'capture-mismatch');
  need(same(runtime,row.runtime)&&same(verified,row.contextConsumers)&&runtime.status==='observed'&&model.status==='modeled'&&model.content==='forwarded'&&model.output.kind==='jsx'&&model.output.tag.kind==='source-read'&&model.output.props.fields.find(([k])=>k==='children')?.[1].kind==='opaque','forwarding-unverified');
  need(plan.boundaryOnly&&plan.models.length===0&&plan.bodyModels?.length===1&&same(plan.bodyModels[0],model)&&plan.initializers?.length===1&&plan.targets.length===1,'plan-mismatch');
  const initializer=plan.initializers[0],target=plan.targets[0],instances=ownership.components.filter(i=>identity(i.source)===identity(target)&&i.roots.length===1&&i.roots[0]===item.path);
  need(instances.length===1,'instance-ambiguous');const instance=instances[0],source=program.components.find(c=>identity(c)===identity(instance.source));need(source&&source.implementation==='source-checked'&&source.root.kind==='component'&&source.root.definition,'source-root-unqualified');
  need(same(initializer.render,model.component)&&identity(initializer.target)===identity(target)&&initializer.render.file===source.module&&initializer.render.sha256===source.sourceSha256&&initializer.render.start>=source.span.start&&initializer.render.end<=source.span.end,'source-render-mismatch');
  const fields=Object.entries(instance.props).filter(([k])=>!(k==='ref'&&source.wrappers?.includes('forwardRef'))).map(([k,v])=>[k,k==='children'?{kind:'opaque'}:same(v,{kind:'undefined'})?{kind:'literal',type:'undefined'}:{kind:'literal',type:typeof v,value:v}]);need(same(model.input,{kind:'record',fields}),'input-context-mismatch');
  const rows=verified.rows.filter(r=>same(r.source,initializer.render));need(rows.length===1&&rows[0].status==='verified'&&rows[0].consumerBodyVerified,'body-unverified');
  const boundaries=runtime.targetInitializers?.targets.filter(t=>same(t.render,initializer.render)).flatMap(t=>t.invocations).filter(i=>i.input.render===rows[0].render)??[];need(boundaries.length===1,'render-ambiguous');
  const boundary=boundaries[0],childIn=boundary.input.fields.find(([k])=>k==='children')?.[1],childOut=boundary.output.fields.find(([k])=>k==='children')?.[1];need(childIn&&same(childIn,childOut),'children-changed');
  const exports=plan.contextExportReads?.filter(r=>same(r.consumer,initializer.render)&&same(r.read,model.output.tag.kind==='source-read'?model.output.tag.source:null))??[];need(exports.length===1&&identity(exports[0].target)===identity(source.root.definition),'delegated-target-mismatch');
  const child=ownership.components.filter(c=>c.parent===instance.id&&identity(c.source)===identity(exports[0].target)&&c.roots.length===1&&c.roots[0]===item.path);need(child.length===1,'child-observation-mismatch');
  const node=ownership.nodes.find(n=>n.path===item.path);need(node,'root-node-missing');
  const classOut=model.output.props.fields.find(([k])=>k==='className')?.[1];
  const classWitness=boundary.output.fields.find(([k])=>k==='className')?.[1];
  const parentClass=instance.props.className;
  const noCallerClass=!Object.hasOwn(instance.props,'className')||parentClass===null||parentClass===''||same(parentClass,{kind:'undefined'});
  const delegatedClassName=noCallerClass&&classOut?.kind==='literal'&&classOut.type==='string'&&typeof classOut.value==='string'&&classWitness?.kind==='string'&&classWitness.value===classOut.value&&child[0].props.className===classOut.value?{instanceId:child[0].id,value:classOut.value}:undefined;
  facts.push({...(delegatedClassName?{delegatedClassName}:{}),instanceId:instance.id,tag:node.tag,helperId:id,modelSha256:e.modelSha256,delegatedTarget:source.root.definition});
 }
 return {facts,inputs,artifacts};
}
