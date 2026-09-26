/** Pure assembly of sealed per-input original render proofs. */
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {enumerate,comboKey,type CapturedNode} from '../extract/computed/lib.js';
import type {PropSpace} from '../extract/computed/capture.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import type {ReactReference} from './react-reference.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactOwnership} from './react-ownership.js';
import type {observeReactInitialStates} from './react-initial-state.js';
import {reactAuthoredInitialDomain,readReactAuthoredInitial,type ReactAuthoredInitialOrigins} from './react-authored-initial.js';
import {classifyReactProperty} from './react-program-proposal.js';
import {projectReactAuthoredSweep,type ReactAuthoredSweepPlane} from './react-authored-sweep.js';
import type {ReactAuthoredNamespace} from './react-authored-namespace.js';
type Observation=Awaited<ReturnType<typeof observeReactInitialStates>>;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function fail(reason:string):never{throw Error('react-authored-initial-'+reason);}

/** Assemble only freshly reopened per-input capabilities from the sealed run. */
export function projectReactAuthoredInitial(options:{reference:ReactReference;program:ReactSourceProgram;ownership:ReactOwnership;tree:CapturedNode;
 observation:Observation;snapshots:Record<string,Parameters<typeof import('./react-initial-contract.js').reactInitialObservedRoot>[0]>;
 caseId:string;origins:ReactAuthoredInitialOrigins;read(rowId:string,name:string):Buffer;namespace?:ReactAuthoredNamespace
}){
 const {program,ownership,tree,observation,snapshots,origins}=options;
 const expected=reactAuthoredInitialDomain(program,ownership,tree,observation);
 if(origins.version!==1||origins.qualification!=='matched-initial-render-origins'||origins.rows.length!==observation.rows.length||
    origins.rows.some((row,i)=>row.id!==observation.rows[i].id||row.status!=='observed'))fail('origins-incomplete');
 const source=program.components.find(c=>same({module:c.module,exportName:c.exportName,span:c.span,sourceSha256:c.sourceSha256},expected.source))!;
 const definitions=expected.axes.map(({property})=>{
  const prop=source.props.find(p=>p.name===property)!,classified=classifyReactProperty(prop.type)!;
  const values=classified.kind==='boolean'?['false','true']:classified.values!;
  const codeValues:Record<string,string|number|boolean|null>=classified.kind==='boolean'?{false:false,true:true}:classified.codeValues??Object.fromEntries(values.map(v=>[v,v]));
  let unset='unset';while(values.includes(unset))unset+='-unset';
  return {property,prop,classified,values,codeValues,axis:{prop:property,values:prop.optional?[unset,...values]:values,...(prop.optional?{unset}:{})},base:prop.optional?unset:values[0]};
 });
 const axes=definitions.map(d=>d.axis),baseAxisValues=Object.fromEntries(definitions.map(d=>[d.property,d.base]));
 const enumeration=enumerate(axes,[],64,baseAxisValues),suffix=revisionOf({source:expected.source,axes,rows:observation.rows}).slice(7,23),name='AuthoredInitial'+suffix;
 const contract=ContractSchema.parse({id:'observed.react-authored-initial-'+suffix,name,version:'0.1.0',status:'draft',description:'Observed finite initial inputs with original authored component boundaries; native output and behavior remain unqualified.',
  props:definitions.map(d=>({name:d.property,type:d.classified.kind==='boolean'?'boolean':{enum:d.values},...(!d.prop.optional?{required:true}:{}),
   bindings:{code:{prop:d.property,...(d.classified.kind==='boolean'?{}:{values:d.codeValues})},figma:{kind:'VARIANT',property:d.property,values:Object.fromEntries(d.values.map(v=>[v,v])),...(d.prop.optional?{unsetValue:'(unset)'}:{})}}})),
  states:[],semantics:{element:tree.tag},anatomy:{root:{}},bindings:{code:{anchors:{importPath:'observed/'+suffix,export:name}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const space:PropSpace={contract,axes,presence:new Map(),stateProps:[],enumeration,baseAxisValues,baseComboKey:comboKey(axes,[],baseAxisValues,{}),heldFixed:[]};
 const inputs=new Map<string,ReactAuthoredSweepPlane>();
 const nativeVariants:Array<{observation:string;variant:string}>=[];
 for(const row of observation.rows){
  const snapshot=snapshots[row.id],origin=origins.rows.find(r=>r.id===row.id)!;
  const reopened=readReactAuthoredInitial({...options,source:observation.source,row,snapshot,origin,read:name=>options.read(row.id,name)});
  const assignment=Object.fromEntries(definitions.map(d=>{
   const value=row.changes[d.property],label=value.kind==='omit'?d.axis.unset:d.values.find(v=>Object.is(d.codeValues[v],value.value));
   if(label===undefined)fail('input-unmapped');return [d.property,label!];
  }));
  const key=comboKey(axes,[],assignment,{});if(inputs.has(key))fail('duplicate-input');
  nativeVariants.push({observation:row.id,variant:definitions.map(d=>d.property+'='+
   (assignment[d.property]===d.axis.unset?'(unset)':assignment[d.property])).join(', ')});
  inputs.set(key,{...reopened,program,tree:snapshot.tree,origin:snapshot.styleOrigin,fonts:snapshot.fonts,svg:snapshot.svg,pseudos:snapshot.pseudoBoxes});
 }
 const draft=projectReactAuthoredSweep(space,inputs,options.namespace);
 if(draft.status==='native-compiled'){
  const root=draft.components?.find(c=>c.contractId===draft.contract?.id);
  if(!root||root.variants.length!==nativeVariants.length||new Set(nativeVariants.map(v=>v.variant)).size!==nativeVariants.length||
     nativeVariants.some(v=>!root.variants.some(c=>c.name===v.variant)))fail('native-domain-mismatch');
 }
 return {...draft,nativeVariants};
}
