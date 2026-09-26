/** Assemble a finite, authenticated authored composition. Every input plane
 * supplies its own render-origin capability; a baseline cannot authorize a
 * different render merely because its DOM or ownership census looks similar. */
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {createFigmaEngine,type ComponentData} from '../core/emit-figma-script.js';
import {codeValue} from '../core/code-values.js';
import {ContractSchema,walkAnatomy,type Contract} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import {enumerate,flatten,type CapturedNode} from '../extract/computed/lib.js';
import type {PropSpace,SweepResult} from '../extract/computed/capture.js';
import {verifiedReactAuthoredContent} from './react-authored-content.js';
import type {projectReactAuthoredTree} from './react-authored-tree.js';
import {compileObservedContentSweep,type PartSizing,prepareObservedContentTree} from './observed-content.js';
import {authoredLengthIsUsed} from './layout-unit.js';
import {observedComponentPlacement,detachObservedPlacement} from './observed-component-placement.js';
import {observeReactSourceBindings} from './react-source-bindings.js';
import {retainReactRootSourceBindings} from './react-root-sweep.js';
import {classifyReactProperty} from './react-program-proposal.js';
import type {ReactAuthoredNamespace} from './react-authored-namespace.js';

export type ReactAuthoredSweepPlane=Parameters<typeof projectReactAuthoredTree>[0];
export interface ReactAuthoredSweepDraft {
 version:1;qualification:'observed-authored-composition-sweep-draft';acceptedContract:null;
 status:'refused'|'native-compiled';nativeQualification:'unqualified';inputRevision:string;
 contract?:Contract;contracts?:Contract[];tokens?:Record<string,unknown>;assets?:Array<[string,string]>;components?:ComponentData[];
 boundaries:Array<{path:string;contractId:string;planes:Array<{key:string;instances:ReactAuthoredSweepPlane['ownership']['components']}>}>;
 problems:string[];limitations:string[];
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const contains=(parent:string,child:string)=>parent===''||parent===child||child.startsWith(parent+'.');
const relative=(parent:string,child:string)=>parent===''?child:child.slice(parent.length+1);
function fail(reason:string):never{throw Error('react-authored-sweep-'+reason);}

export function projectReactAuthoredSweep(space:PropSpace,inputs:ReadonlyMap<string,ReactAuthoredSweepPlane>,namespace?:ReactAuthoredNamespace):ReactAuthoredSweepDraft {
 const result:ReactAuthoredSweepDraft={version:1,qualification:'observed-authored-composition-sweep-draft',acceptedContract:null,
  status:'refused',nativeQualification:'unqualified',inputRevision:revisionOf({space,inputs:[...inputs],...(namespace?{namespace:[...namespace]}:{})}),boundaries:[],problems:[],limitations:[
   'observed-finite-inputs-only','fresh-mounts-do-not-prove-live-behavior','descendant-axes-represent-parent-context-not-child-public-apis',
   'source-variable-modes-and-aliases-not-assembled','component-roots-require-uniform-fixed-or-auto-sizing',
   'auto-sized-roots-use-content-layout-caller-allocation-not-qualified',
   'native-structure-and-fidelity-not-verified','updates-and-recovery-not-verified']};
 try{
  const seed=ContractSchema.parse(space.contract);
  if(!space.axes.length||space.presence.size||space.stateProps.length||space.heldFixed.length||seed.states.length||seed.events?.length||seed.selection||space.axes.length!==seed.props.length||
     new Set(space.axes.map(a=>a.prop)).size!==space.axes.length)fail('finite-domain-required');
  for(const axis of space.axes){
   const prop=seed.props.find(p=>p.name===axis.prop);
   if(!prop||prop.bindings.figma.kind!=='VARIANT'||prop.default!==undefined)fail('finite-domain-required');
   const values=prop.type==='boolean'?['false','true']:typeof prop.type==='object'&&'enum' in prop.type?prop.type.enum:[];
   if(!values.length||!same(axis.values,axis.unset===undefined?values:[axis.unset,...values])||
      (!!axis.unset)!==(!prop.required)||axis.unset!==undefined&&(values.includes(axis.unset)||prop.bindings.figma.unsetValue===undefined))fail('finite-domain-required');
  }
  const enumeration=enumerate(space.axes,[],64,space.baseAxisValues);
  if(enumeration.policy!=='full-cartesian'||!same(enumeration,space.enumeration)||inputs.size!==enumeration.combos.length||
     !enumeration.combos.some(c=>c.key===space.baseComboKey&&same(c.axisValues,space.baseAxisValues))||enumeration.combos.some(c=>!inputs.has(c.key)))fail('incomplete-domain');
  const facts=new Map([...inputs].map(([key,input])=>[key,verifiedReactAuthoredContent(input.content,input.program,input.ownership,input.tree)]));
  result.limitations=[...new Set([...result.limitations,...[...facts.values()].flatMap(f=>f.limitations)])];
  const base=inputs.get(space.baseComboKey)!,baseFact=facts.get(space.baseComboKey)!;
  const identity=(input:ReactAuthoredSweepPlane)=>({program:input.program,rendererVersions:input.ownership.rendererVersions,
   ancestors:input.ownership.ancestors,components:input.ownership.components.map(({props:_props,...identity})=>identity)});
  const boundaries=baseFact.boundaries.map(b=>({path:b.path,instances:b.instances.map(i=>i.id)}))
   .sort((a,b)=>b.path.split('.').length-a.path.split('.').length||b.path.length-a.path.length||a.path.localeCompare(b.path));
  if(namespace&&(namespace.size!==boundaries.length||boundaries.some(b=>!namespace.has(b.path))||
     new Set([...namespace.values()].map(n=>n.id)).size!==namespace.size||
     new Set([...namespace.values()].map(n=>n.name)).size!==namespace.size))fail('namespace-boundaries-mismatch');
  const sourcePaths=new Map<string,string>();
  for(const boundary of baseFact.boundaries)for(const instance of boundary.instances){
   const key=revisionOf(instance.source),previous=sourcePaths.get(key);
   if(previous!==undefined&&previous!==boundary.path)fail('repeated-source-boundary-context-unqualified');
   sourcePaths.set(key,boundary.path);
  }
  const census=(tree:CapturedNode)=>flatten(tree).map(({path,node})=>({path,tag:node.tag}));
  const baseRoot=base.ownership.components.find(c=>c.id===baseFact.instanceId)!;
  const held=(props:Record<string,unknown>)=>Object.fromEntries(Object.entries(props).filter(([name])=>!seed.props.some(p=>p.bindings.code.prop===name)));
  const source=base.program.components.find(c=>same({module:c.module,exportName:c.exportName,sourceSha256:c.sourceSha256,span:c.span},baseRoot.source));
  for(const prop of seed.props){
   const authored=source?.props.find(p=>p.name===prop.bindings.code.prop),classified=authored&&classifyReactProperty(authored.type);
   const expected=classified?.kind==='boolean'?[false,true]:classified?.kind==='enum'?classified.values!.map(v=>classified.codeValues&&Object.hasOwn(classified.codeValues,v)?classified.codeValues[v]:v):[];
   const actual=prop.type==='boolean'?[false,true]:typeof prop.type==='object'&&'enum' in prop.type?prop.type.enum.map(v=>codeValue(prop,v)):[];
   if(!authored||authored.optional===!!prop.required||!expected.length||!same(expected.map(v=>JSON.stringify(v)).sort(),actual.map(v=>JSON.stringify(v)).sort()))fail('source-input-domain-mismatch');
  }
  if(['style','className'].some(k=>baseRoot.props[k]!==undefined&&baseRoot.props[k]!==null&&baseRoot.props[k]!==''&&!same(baseRoot.props[k],{kind:'undefined'})))fail('caller-style-unqualified');
  for(const combo of enumeration.combos){
   const input=inputs.get(combo.key)!,fact=facts.get(combo.key)!;
   if(!same(identity(input),identity(base))||fact.instanceId!==baseFact.instanceId||
      !same(fact.boundaries.map(b=>({path:b.path,instances:b.instances.map(i=>i.id)})),baseFact.boundaries.map(b=>({path:b.path,instances:b.instances.map(i=>i.id)})))||
      !same(census(input.tree),census(base.tree)))fail('composition-identity-changed');
   const instance=input.ownership.components.find(c=>c.id===fact.instanceId)!;
   if(!same(held(instance.props),held(baseRoot.props)))fail('held-inputs-changed');
   for(const axis of space.axes){
    const prop=seed.props.find(p=>p.name===axis.prop)!,value=combo.axisValues[axis.prop];
    if(value===axis.unset?Object.hasOwn(instance.props,prop.bindings.code.prop):
       !Object.is(instance.props[prop.bindings.code.prop],prop.type==='boolean'?value==='true':codeValue(prop,value)))fail('input-assignment-mismatch');
   }
  }
  const prepared=new Map([...inputs].map(([key,input])=>[key,new Map(flatten(prepareObservedContentTree(input.tree,input.fonts,input.svg,input.pseudos)).map(n=>[n.path,n.node]))]));
  const contracts=new Map<string,Contract>(),byPath=new Map<string,Contract>(),tokens:Record<string,unknown>={},assets=new Map<string,string>();
  const merge=(target:Record<string,unknown>,source:Record<string,unknown>)=>{
   for(const [key,value] of Object.entries(source)){
    if(!Object.hasOwn(target,key)){target[key]=structuredClone(value);continue;}
    const old=target[key];if(same(old,value))continue;
    if(!old||!value||typeof old!=='object'||typeof value!=='object'||Array.isArray(old)||Array.isArray(value)||'$value' in old||'$value' in value)fail('token-conflict');
    merge(old as Record<string,unknown>,value as Record<string,unknown>);
   }
  };
  const placement=(key:string,path:string)=>{
   if(path==='')return undefined;
   const flat=prepared.get(key)!,node=flat.get(path);if(!node)fail('boundary-missing');
   const parent=path.includes('.')?path.slice(0,path.lastIndexOf('.')):'';
   return observedComponentPlacement(node,flat.get(parent),inputs.get(key)!.origin.roots.find(r=>r.path===path&&r.tag===node.tag)?.sizes);
  };
  for(const boundary of boundaries){
   const children=boundaries.filter(b=>b.path!==boundary.path&&contains(boundary.path,b.path)&&!boundaries.some(mid=>mid.path!==b.path&&mid.path!==boundary.path&&contains(boundary.path,mid.path)&&contains(mid.path,b.path)));
   const suffix=revisionOf({root:seed.id,path:boundary.path,sources:baseFact.boundaries.find(b=>b.path===boundary.path)!.instances.map(i=>i.source)}).slice(7,23);
   const contractSeed=structuredClone(seed);
   if(boundary.path!==''){
    contractSeed.id=seed.id+'-context-'+suffix;contractSeed.name=seed.name+'Context'+suffix;
    contractSeed.description='Component in the observed parent input domain; these context axes do not describe its independent public API.';
    contractSeed.bindings.code.anchors={importPath:'observed/'+suffix,export:contractSeed.name};
    contractSeed.bindings.figma.anchors={fileKey:null,componentSetKey:null};
   }
   const retained=namespace?.get(boundary.path);
   if(retained){
    contractSeed.id=retained.id;contractSeed.name=retained.name;
    contractSeed.bindings.code.anchors=structuredClone(retained.codeAnchors);
   }
   contractSeed.semantics=ContractSchema.shape.semantics.parse({element:prepared.get(space.baseComboKey)!.get(boundary.path)!.tag});
   contractSeed.anatomy={root:{}};
   const partSizing:PartSizing=new Map(),roots=new Map<string,CapturedNode>();
   const rootModes=new Map<string,Set<'fixed'|'auto'>>();
   for(const combo of enumeration.combos){
    const original=prepared.get(combo.key)!.get(boundary.path);if(!original)fail('boundary-missing');
    const root=structuredClone(original);if(placement(combo.key,boundary.path))detachObservedPlacement(root);
    const sizing=new Map<string,ReadonlySet<string>>();
    for(const {path:local,node} of flatten(root)){
     if(['flex','inline-flex'].includes(node.style.display))for(const gap of ['row-gap','column-gap'])if(node.style[gap]==='normal')node.style[gap]='0px';
     const absolute=[boundary.path,local].filter(Boolean).join('.');
     const record=inputs.get(combo.key)!.origin.roots.find(r=>r.path===absolute&&r.tag===node.tag);
     const channels=new Set<string>();
     for(const size of record?.sizes??[])if(size.status==='fixed'&&size.value&&authoredLengthIsUsed(size.value,node.style[size.channel]))channels.add(size.channel);
     sizing.set(local,channels);
    }
    // Carry a fixed dimension only when proved in EVERY plane. An observed
    // automatic dimension stays automatic: the shared content compiler sizes
    // it from its children, never from this sample's measured rectangle.
    // Mixing fixed/auto needs variant sizing semantics and remains refused.
    const origin=inputs.get(combo.key)!.origin.roots.find(r=>r.path===boundary.path&&r.tag===root.tag);
    for(const channel of ['width','height']){
     const auto=origin?.sizes?.find(s=>s.channel===channel)?.status==='auto';
     const mode=sizing.get('')?.has(channel)?'fixed':auto?'auto':undefined;
     if(!mode)fail('component-root-sizing-unqualified:'+boundary.path);
     (rootModes.get(channel)??rootModes.set(channel,new Set()).get(channel)!).add(mode);
    }
    partSizing.set(combo.key,sizing);roots.set(combo.key,root);
   }
   if([...rootModes.values()].some(m=>m.size!==1))fail('component-root-sizing-mixed:'+boundary.path);
   const rootSizing=[...rootModes].filter(([,m])=>m.has('fixed')).map(([channel])=>channel);
   const localSpace={...space,contract:contractSeed},name=contractSeed.name;
   const compiled=compileObservedContentSweep(localSpace,{name,importName:name,contract:'',sampleText:'',axes:space.axes.map(a=>a.prop)},
    {captures:enumeration.combos.map(c=>({combo:name+':'+c.key,interaction:'default',root:roots.get(c.key)!}))} as SweepResult,
    rootSizing,true,children.map(c=>relative(boundary.path,c.path)),partSizing);
   if(compiled.problems.length||!compiled.contract||!compiled.tokens||!compiled.sourcePaths||!compiled.component)fail('projection-unavailable:'+compiled.problems.join(','));
   const contract=compiled.contract,parts=new Map(walkAnatomy(contract).map(p=>[p.name,p.part]));
   for(const child of children){
    const matches=compiled.sourcePaths.filter(p=>p.sourcePath===relative(boundary.path,child.path)),dependency=byPath.get(child.path);
    if(matches.length!==1||!dependency)fail('dependency-correspondence-unavailable');
    const part=parts.get(matches[0].partName);if(!part||part===contract.anatomy.root)fail('dependency-part-unavailable');
    for(const variant of compiled.component.variants){
     let spec:typeof variant.spec|undefined=variant.spec;for(const index of matches[0].specPath)spec=spec?.children?.[index];
     if(!spec||spec.name!==matches[0].partName)fail('dependency-plane-correspondence-unavailable');
    }
    const placements=enumeration.combos.map(combo=>placement(combo.key,child.path));
    if(placements.some(Boolean)&&!placements.every(Boolean))fail('mixed-placement');
    const grid=part.placement,grow=part.layout?.grow;
    for(const key of Object.keys(part))delete(part as Record<string,unknown>)[key];
    part.component={id:dependency.id,props:Object.fromEntries(seed.props.map(p=>[p.name,'{'+p.name+'}']))};
    if(grid)part.placement=grid;if(grow&&!placements[0])part.layout={grow};
    if(placements[0]){
     if(placements.every(p=>same(p,placements[0])))part.absolutePlacement=placements[0];
     else part.absolutePlacementByCombination={props:space.axes.map(a=>a.prop),rows:enumeration.combos.map((combo,i)=>({
      values:space.axes.map(a=>combo.axisValues[a.prop]===a.unset?null:combo.axisValues[a.prop]),...placements[i]!}))};
    }
   }
   const projections=new Map(enumeration.combos.map(combo=>[combo.key,observeReactSourceBindings(roots.get(combo.key)!,contract.anatomy.root,compiled.tokens!,inputs.get(combo.key)!.origin,boundary.path,combo.axisValues)]));
   if([...projections.values()].some(p=>p.sourceBindings.some(b=>b.variable&&!b.tokenPath)))fail('source-binding-unresolved');
   retainReactRootSourceBindings(contract,compiled.tokens,space.axes,space.baseAxisValues,projections);
   contracts.set(contract.id,contract);byPath.set(boundary.path,contract);merge(tokens,compiled.tokens);
   for(const [id,value] of compiled.assets??[]){if(assets.has(id)&&assets.get(id)!==value)fail('asset-conflict');assets.set(id,value);}
   result.boundaries.push({path:boundary.path,contractId:contract.id,planes:enumeration.combos.map(combo=>({key:combo.key,instances:structuredClone(facts.get(combo.key)!.boundaries.find(b=>b.path===boundary.path)!.instances)}))});
  }
  const root=byPath.get('');if(!root)fail('root-unavailable');
  const errors:string[]=[];for(const contract of contracts.values())validateContract(contract,contracts,errors,assets);
  if(errors.length)fail('contract-invalid:'+errors.join(';'));
  const engine=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:assets});
  const components=[...contracts.values()].map(c=>engine.compileComponentData(c,contracts));
  for(const contract of contracts.values())engine.compileNativeContractDraft(contract,contracts,{revision:revisionOf([...inputs].map(([key,p])=>[key,p.tree])),programSha256:revisionOf(base.program).slice(7),evidenceRevision:result.inputRevision});
  result.contract=root;result.contracts=[...contracts.values()];result.tokens=tokens;result.assets=[...assets];result.components=components;result.status='native-compiled';
 }catch(error){result.problems.push(error instanceof Error?error.message:String(error));}
 return result;
}
