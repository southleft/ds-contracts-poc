/** A host-held capability for one original, observed authored render tree.
 * It does not authorize source rewrites, unseen inputs or behavior claims. */
import {readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {revisionOf,canonicalJson} from '../core/contract-provenance.js';
import {flatten,type CapturedNode} from '../extract/computed/lib.js';
import {evidenceSha} from './react-validation-evidence.js';
import {reactOwnershipStructure,type ReactOwnership} from './react-ownership.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactJsxHelperObservation} from './react-jsx-helper-observation.js';
import type {ReactJsxHelperInstrumentationPlan} from './react-helper-instrument.js';
import type {ReactJsxEffects} from './react-jsx-effects.js';
import {verifyReactRenderGraph,type ReactRenderGraphVerification} from './react-render-graph.js';

export interface ReactAuthoredContent {readonly version:1;readonly revision:string}
export interface ReactAuthoredContentFact {
  qualification:'observed-authored-render-tree-only';effectsVerified:false;acceptedContract:null;
  instanceId:string;render:number;
  hosts:ReactRenderGraphVerification['rows'];
  boundaries:Array<{path:string;instances:Array<ReactOwnership['components'][number]>}>;
  limitations:string[];
}
type Proof={context:string;fact:ReactAuthoredContentFact;inputs:Record<string,string>;artifacts:Record<string,string>};
const authority=new WeakMap<ReactAuthoredContent,{proof:Proof;read:(name:string)=>Buffer}>();
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const context=(program:ReactSourceProgram,ownership:ReactOwnership,tree:CapturedNode)=>revisionOf({program,ownership,tree});
function require(value:unknown,reason:string):asserts value {if(!value)throw Error('react-authored-content-'+reason);}
function current(inputs:Record<string,string>){
  require(Object.keys(inputs).length,'inputs-unavailable');
  for(const [file,hash] of Object.entries(inputs))require(realpathSync(file)===file&&evidenceSha(readFileSync(file))===hash,'inputs-changed');
}

/** read and helper must originate from the host's fresh observer, or from an
 * archive already checked against its retained immutable inventory. A posted
 * report/hash pair is never a valid source for this API. */
export function readReactAuthoredContent(options:{referenceId:string;sourceRoot:string;program:ReactSourceProgram;
  ownership:ReactOwnership;tree:CapturedNode;helper:ReactJsxHelperObservation;read(name:string):Buffer}):ReactAuthoredContent {
  const {program,ownership,tree,helper,read}=options,e=helper.evidence;
  // A partial static program can retain exact export identities while refusing
  // body inference. This capability uses the separate original render proof;
  // it never changes that program's status or promotes its unresolved bodies.
  require(program.version===1&&!program.problems.length&&!ownership.problems.length,'source-unavailable');
  require(helper.status==='observed'&&e&&helper.inputs&&helper.runtime?.status==='observed'&&helper.lookup?.status==='verified','observation-unavailable');
  current(helper.inputs);
  const artifacts:Record<string,string>={};
  function bytes(name:string,hash?:string){const value=read(name),actual=evidenceSha(value);if(hash!==undefined)require(hash===actual,'artifact-changed:'+name);artifacts[name]=actual;return value;}
  function json<T>(name:string,hash?:string):T{return JSON.parse(bytes(name,hash).toString());}
  require(same(json('report.json'),helper),'report-mismatch');
  const model=json<ReactJsxEffects>('model.json',e.modelSha256),plan=json<ReactJsxHelperInstrumentationPlan>('plan.json',e.planSha256);
  const recorded=json<ReactOwnership>('ownership.json',e.ownershipSha256),paired=json<ReactOwnership>('paired-ownership.json',e.pairedOwnershipSha256);
  const build=json<{referenceId:string;guardedReferenceId:string;inputs:Record<string,string>;guardedJavascript:string}>('build.json',e.buildSha256);
  const captured=json<{status:string;problems:string[];tree:CapturedNode;treeSha256:string;sourcePngSha256:string}>('tree.json');
  require(same(json('runtime.json',e.runtimeSha256),helper.runtime)&&same(json('lookup.json'),helper.lookup),'runtime-mismatch');
  require(e.renderGraphSha256&&e.contextConsumersSha256&&helper.contextConsumers&&helper.renderGraph,'render-proof-unavailable');
  require(same(json('render-graph.json',e.renderGraphSha256),helper.renderGraph)&&same(json('context-consumers.json',e.contextConsumersSha256),helper.contextConsumers),'render-proof-mismatch');
  require(same(build.inputs,helper.inputs)&&build.referenceId===options.referenceId,'reference-mismatch');
  require(evidenceSha(bytes('guarded.js'))===helper.lookup.sourceJavascriptSha256&&evidenceSha(bytes('lookup-guarded.js'))===helper.lookup.javascriptSha256&&build.guardedJavascript===helper.lookup.javascriptSha256,'javascript-mismatch');
  require(same(paired,ownership)&&same(reactOwnershipStructure(recorded),reactOwnershipStructure(ownership)),'ownership-mismatch');
  require(captured.status==='captured'&&!captured.problems.length&&same(captured.tree,tree)&&captured.treeSha256===e.treeSha256&&evidenceSha(JSON.stringify(tree))===e.treeSha256&&captured.sourcePngSha256===e.pngSha256,'tree-mismatch');
  bytes('observed.png',e.pngSha256);
  require(model.status==='modeled'&&model.acceptedContract===null&&model.runtimeVerified===false&&plan.kind==='jsx-component'&&same(plan.models,[model])&&same(plan.component,model.component),'model-mismatch');
  const runtime=helper.runtime;
  const expectedCalls=model.calls.filter(c=>c.site&&c.phase!=='module-initialization').length;
  require(runtime.components?.length&&runtime.components.every(c=>c.context===0&&c.checkedCalls===expectedCalls&&c.targetReads===model.jsxTargets.length),'model-invocation-unverified');
  const candidates=ownership.components.filter(c=>c.source.module===model.component.file&&c.source.sourceSha256===model.component.sha256&&c.source.span.start<=model.component.start&&c.source.span.end>=model.component.end&&same(c.roots,['']));
  require(candidates.length===1,'root-instance-ambiguous');const root=candidates[0];
  require(program.components.some(c=>same({module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span},root.source)),'source-mismatch');
  const sourceFile=realpathSync(path.resolve(options.sourceRoot,root.source.module));
  require(program.files[sourceFile]===root.source.sourceSha256&&helper.inputs[sourceFile]===root.source.sourceSha256,'source-input-mismatch');
  const graph=verifyReactRenderGraph(recorded,runtime,helper.contextConsumers);
  require(same(graph,helper.renderGraph),'graph-mismatch');
  const nodes=flatten(tree);require(nodes.length===recorded.nodes.length&&nodes.every((n,i)=>n.path===recorded.nodes[i].path&&n.node.tag===recorded.nodes[i].tag),'host-coverage-mismatch');
  const origins=graph.rows.map(row=>{
    require(row.status==='linked','host-unlinked:'+row.path);
    const outer=row.steps.filter(s=>s.componentModels.includes(0));require(outer.length===1,'authored-origin-unproved:'+row.path);return outer[0].render;
  });
  require(origins.length>0&&new Set(origins).size===1,'authored-origin-ambiguous');
  const components=new Map(ownership.components.map(c=>[c.id,c]));require(components.size===ownership.components.length,'instance-duplicate');
  const descendant=(id:string,ancestor:string)=>{
    const seen=new Set<string>();let item=components.get(id);
    while(item){require(!seen.has(item.id),'instance-cycle');seen.add(item.id);if(item.id===ancestor)return true;item=item.parent?components.get(item.parent):undefined;}return false;
  };
  const groups=new Map<string,ReactOwnership['components']>();
  for(const c of ownership.components){
    require(descendant(c.id,root.id)&&c.roots.length===1&&nodes.some(n=>n.path===c.roots[0]),'boundary-unqualified');
    require(program.components.some(p=>same({module:p.module,exportName:p.exportName,sourceSha256:p.sourceSha256,span:p.span},c.source)),'boundary-source-mismatch');
    const source=realpathSync(path.resolve(options.sourceRoot,c.source.module));require(program.files[source]===c.source.sourceSha256&&helper.inputs[source]===c.source.sourceSha256,'boundary-input-mismatch');
    groups.set(c.roots[0],[...(groups.get(c.roots[0])??[]),c]);
  }
  for(const group of groups.values())for(const a of group)for(const b of group)
    require(descendant(a.id,b.id)||descendant(b.id,a.id),'shared-root-ambiguous');
  const fact:ReactAuthoredContentFact={qualification:'observed-authored-render-tree-only',effectsVerified:false,acceptedContract:null,
    instanceId:root.id,render:origins[0],hosts:graph.rows,boundaries:[...groups].map(([path,instances])=>({path,instances:structuredClone(instances)})),
    limitations:['observed-input-and-render-context-only',...(program.status==='refused'?['static-source-program-remains-partially-unresolved']:[]),'inner-body-and-provider-effects-not-qualified','behavior-and-updates-not-projected','unobserved-property-planes-not-qualified','native-structure-and-fidelity-not-verified']};
  const proof:Proof={context:context(program,ownership,tree),fact,inputs:{...helper.inputs},artifacts};
  const capability=Object.freeze({version:1 as const,revision:revisionOf(proof)});authority.set(capability,{proof,read});return capability;
}

export function verifiedReactAuthoredContent(capability:ReactAuthoredContent,program:ReactSourceProgram,ownership:ReactOwnership,tree:CapturedNode):ReactAuthoredContentFact {
  const entry=authority.get(capability);require(entry,'authority-unavailable');
  require(entry.proof.context===context(program,ownership,tree),'context-changed');current(entry.proof.inputs);
  for(const [name,hash] of Object.entries(entry.proof.artifacts))require(evidenceSha(entry.read(name))===hash,'artifact-changed:'+name);
  return structuredClone(entry.proof.fact);
}
