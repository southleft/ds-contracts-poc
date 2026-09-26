/** Preserve declared component boundaries in one authenticated authored tree.
 * Each main retains its exact observed inputs; no state/property API is guessed. */
import {revisionOf,canonicalJson} from '../core/contract-provenance.js';
import {createFigmaEngine,type ComponentData} from '../core/emit-figma-script.js';
import {ContractSchema,walkAnatomy,type Contract} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import {flatten,enumerate,type CapturedNode} from '../extract/computed/lib.js';
import type {PropSpace,SweepResult} from '../extract/computed/capture.js';
import {verifiedReactAuthoredContent,type ReactAuthoredContent,type ReactAuthoredContentFact} from './react-authored-content.js';
import {compileObservedContentSweep,prepareObservedContentTree,type PartSizing} from './observed-content.js';
import {authoredLengthIsUsed} from './layout-unit.js';
import {observedComponentPlacement,detachObservedPlacement} from './observed-component-placement.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactOwnership} from './react-ownership.js';
import type {ReactStyleOrigin} from './react-style-origin.js';
import type {TextFontEvidence} from './text-fonts.js';
import type {SvgViewportEvidence} from './svg-viewports.js';
import type {PseudoBoxEvidence} from './pseudo-boxes.js';

export interface ReactAuthoredTreeDraft {
 version:1;qualification:'observed-authored-composition-draft';acceptedContract:null;
 status:'refused'|'style-prepared'|'native-compiled';inputRevision:string;contentRevision:string;
 fact?:ReactAuthoredContentFact;contract?:Contract;contracts?:Contract[];tokens?:Record<string,unknown>;assets?:Array<[string,string]>;
 components?:ComponentData[];
 boundaries:Array<{path:string;contractId:string;instances:ReactOwnership['components']}>;
 problems:string[];limitations:string[];
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const contains=(parent:string,child:string)=>parent===''||parent===child||child.startsWith(parent+'.');
const relative=(parent:string,child:string)=>parent===''?child:child.slice(parent.length+1);

export function projectReactAuthoredTree(input:{content:ReactAuthoredContent;program:ReactSourceProgram;ownership:ReactOwnership;
 tree:CapturedNode;origin:ReactStyleOrigin;fonts:TextFontEvidence;svg?:SvgViewportEvidence;pseudos?:PseudoBoxEvidence}):ReactAuthoredTreeDraft {
 const {content,program,ownership,tree,origin,fonts,svg,pseudos}=input;
 const result:ReactAuthoredTreeDraft={version:1,qualification:'observed-authored-composition-draft',acceptedContract:null,status:'refused',
  inputRevision:revisionOf(input),contentRevision:content.revision,boundaries:[],problems:[],limitations:[]};
 try{
  const fact=verifiedReactAuthoredContent(content,program,ownership,tree);result.fact=fact;result.limitations=[...fact.limitations,'component-inputs-held-at-observed-values','source-variable-bindings-not-assembled'];
  const outer=ownership.components.find(c=>c.id===fact.instanceId)!;
  if(['style','className'].some(k=>outer.props[k]!==undefined&&outer.props[k]!==null&&outer.props[k]!==''&&!same(outer.props[k],{kind:'undefined'})))throw Error('react-authored-tree-caller-style-unqualified');
  const prepared=prepareObservedContentTree(tree,fonts,svg,pseudos),flat=new Map(flatten(prepared).map(n=>[n.path,n.node]));
  const boundaries=[...fact.boundaries].sort((a,b)=>b.path.split('.').length-a.path.split('.').length||b.path.length-a.path.length||a.path.localeCompare(b.path));
  const contracts=new Map<string,Contract>(),byPath=new Map<string,Contract>(),tokens:Record<string,unknown>={},assets=new Map<string,string>();
  function merge(target:Record<string,unknown>,source:Record<string,unknown>){
   for(const [key,value] of Object.entries(source)){
    if(!Object.hasOwn(target,key)){target[key]=structuredClone(value);continue;}
    const old=target[key];if(same(old,value))continue;
    if(!old||!value||typeof old!=='object'||typeof value!=='object'||Array.isArray(old)||Array.isArray(value)||'$value' in old||'$value' in value)throw Error('react-authored-tree-token-conflict');
    merge(old as Record<string,unknown>,value as Record<string,unknown>);
   }
  }
  for(const boundary of boundaries){
   const original=flat.get(boundary.path);if(!original)throw Error('react-authored-tree-boundary-missing');
   let externalPlacement;
   if(boundary.path!==''){
    const parentPath=boundary.path.includes('.')?boundary.path.slice(0,boundary.path.lastIndexOf('.')):'';
    try {externalPlacement=observedComponentPlacement(original,flat.get(parentPath),origin.roots.find(r=>r.path===boundary.path&&r.tag===original.tag)?.sizes);}
    catch(error){throw Error((error instanceof Error?error.message:String(error))+':'+boundary.path);}
   }
   const root=structuredClone(original);if(externalPlacement)detachObservedPlacement(root);
   const suffix=revisionOf({source:boundary.instances.map(i=>i.source),inputs:boundary.instances.map(i=>i.props),root}).slice(7,23),name='Authored'+suffix;
   const seed=ContractSchema.parse({id:'observed.react-authored-'+suffix,name,version:'0.1.0',status:'draft',props:[],states:[],semantics:{element:root.tag},anatomy:{root:{}},
    description:'Original authored composition at these observed inputs; behavior, other input planes and native fidelity remain unqualified.',
    bindings:{code:{anchors:{importPath:'observed/'+suffix,export:name}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
   const enumeration=enumerate([],[],1,{}),key=enumeration.combos[0].key;
   const space:PropSpace={contract:seed,axes:[],presence:new Map(),stateProps:[],enumeration,baseComboKey:key,baseAxisValues:{},heldFixed:[]};
   const sizing=new Map<string,ReadonlySet<string>>();
   for(const {path:local,node} of flatten(root)){
    if(['flex','inline-flex'].includes(node.style.display))for(const gap of ['row-gap','column-gap'])if(node.style[gap]==='normal')node.style[gap]='0px';
    const absolute=[boundary.path,local].filter(Boolean).join('.'),record=origin.roots.find(r=>r.path===absolute&&r.tag===node.tag);
    const channels=new Set<string>();
    for(const size of record?.sizes??[])if(size.status==='fixed'&&size.value&&authoredLengthIsUsed(size.value,node.style[size.channel]))channels.add(size.channel);
    sizing.set(local,channels);
   }
   const children=boundaries.filter(b=>b.path!==boundary.path&&contains(boundary.path,b.path)&&!boundaries.some(mid=>mid.path!==b.path&&mid.path!==boundary.path&&contains(boundary.path,mid.path)&&contains(mid.path,b.path)));
   const childPaths=children.map(c=>relative(boundary.path,c.path));
   const partSizing:PartSizing=new Map([[key,sizing]]);
   const compiled=compileObservedContentSweep(space,{name,importName:name,contract:'',sampleText:'',axes:[]},
    {captures:[{combo:name+':'+key,interaction:'default',root}]} as SweepResult,[...(sizing.get('')??[])],true,childPaths,partSizing);
   if(compiled.problems.length||!compiled.contract||!compiled.tokens||!compiled.component||!compiled.sourcePaths)throw Error('react-authored-tree-projection-unavailable:'+compiled.problems.join(','));
   const contract=compiled.contract,parts=new Map(walkAnatomy(contract).map(p=>[p.name,p.part]));
   for(const child of children){
    const local=relative(boundary.path,child.path),matches=compiled.sourcePaths.filter(p=>p.sourcePath===local),dependency=byPath.get(child.path);
    if(matches.length!==1||!dependency)throw Error('react-authored-tree-dependency-correspondence-unavailable');
    const part=parts.get(matches[0].partName);if(!part||part===contract.anatomy.root)throw Error('react-authored-tree-dependency-part-unavailable');
    const placed=flat.get(child.path)!;
    const parentPath=child.path.includes('.')?child.path.slice(0,child.path.lastIndexOf('.')):'';
    const absolutePlacement=observedComponentPlacement(placed,flat.get(parentPath),origin.roots.find(r=>r.path===child.path&&r.tag===placed.tag)?.sizes);
    const {placement}=part,grow=part.layout?.grow;
    for(const k of Object.keys(part))delete (part as Record<string,unknown>)[k];
    part.component={id:dependency.id,props:{}};if(placement)part.placement=placement;if(grow&&!absolutePlacement)part.layout={grow};if(absolutePlacement)part.absolutePlacement=absolutePlacement;
   }
   contracts.set(contract.id,contract);byPath.set(boundary.path,contract);merge(tokens,compiled.tokens);
   for(const [id,value] of compiled.assets??[]){if(assets.has(id)&&assets.get(id)!==value)throw Error('react-authored-tree-asset-conflict');assets.set(id,value);}
   result.boundaries.push({path:boundary.path,contractId:contract.id,instances:structuredClone(boundary.instances)});
  }
  const root=byPath.get('');if(!root)throw Error('react-authored-tree-root-unavailable');
  const errors:string[]=[];for(const c of contracts.values())validateContract(c,contracts,errors,assets);if(errors.length)throw Error('react-authored-tree-contract-invalid:'+errors.join(';'));
  result.contract=root;result.contracts=[...contracts.values()];result.tokens=tokens;result.assets=[...assets];result.status='style-prepared';
  const engine=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:assets});
  result.components=[...contracts.values()].map(c=>engine.compileComponentData(c,contracts));
  for(const c of contracts.values())engine.compileNativeContractDraft(c,contracts,{revision:revisionOf(tree),programSha256:revisionOf(program).slice(7),evidenceRevision:result.inputRevision});
  result.status='native-compiled';
 }catch(error){result.problems.push(error instanceof Error?error.message:String(error));}
 return result;
}
