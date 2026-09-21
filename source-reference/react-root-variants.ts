import {compileReactRootSweep,retainReactRootSourceBindings} from './react-root-sweep.js';
/** Reusable one-property root drafts from authenticated source observations.
 * Other properties, descendant effects and native fidelity stay unqualified. */
import {revisionOf} from '../core/contract-provenance.js';
import {ContractSchema,type Contract} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import {createFigmaEngine,type ComponentData} from '../core/emit-figma-script.js';
import {enumerate,normalizeValue,type CapturedNode} from '../extract/computed/lib.js';
import type {prepareMint} from '../extract/computed/fuse.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactOwnership} from './react-ownership.js';
import type {ReactDescendantSizes,ReactStyleOrigin} from './react-style-origin.js';
import type {GridConstraintEvidence} from './grid-constraints.js';
import type {ReactPropertyEffects} from './react-property-effects.js';
import {classifyReactProperty} from './react-program-proposal.js';
import {planReactPropertyEffects} from './react-property-effects.js';
import {linkReactSourceAnatomy} from './react-source-anatomy.js';
import {projectReactRootVisual,reactRootStyleExclusion} from './react-root-visual.js';
import {evidenceSha} from './react-validation-evidence.js';

export interface ReactPropertySnapshot {
 tree:CapturedNode;treeSha256:string;image:string;ownership:ReactOwnership;styleOrigin:ReactStyleOrigin;
 /** Present only when this plane's tree holds a grid container; older archives never carry it. */
 gridConstraints?:GridConstraintEvidence;
 /** Initial-mount planes only, and only since descendants are sized: older archives never carry it. */
 descendantSizes?:ReactDescendantSizes;
}
export interface ReactRootVariants {
 version:1;qualification:'single-property-root-drafts';acceptedContract:null;
 drafts:Array<{property:string;status:'refused'|'style-prepared'|'native-compiled';
  contract?:Contract;tokens?:Record<string,unknown>;native?:ComponentData;
  residuals?:ReturnType<typeof prepareMint>['codeOnly'];
  problems:string[];limitations:string[];observations:string[];lowerings:Array<{value:string;channel:string;from:string;to:string;reason:string}>}>;
 problems:string[];
}

export function assembleReactRootVariants(program:ReactSourceProgram,ownership:ReactOwnership,tree:CapturedNode,
 effects:ReactPropertyEffects,snapshots:Record<string,ReactPropertySnapshot>):ReactRootVariants{
 const out:ReactRootVariants={version:1,qualification:'single-property-root-drafts',acceptedContract:null,drafts:[],problems:[]};
 try{
  const expected=planReactPropertyEffects(program,ownership,tree,effects.instanceId);
  if(effects.version!==1||effects.qualification!=='one-property-at-a-time'||effects.problems.length||
   JSON.stringify(expected.source)!==JSON.stringify(effects.source)||JSON.stringify(expected.heldProps)!==JSON.stringify(effects.heldProps)||
   expected.plan.length!==effects.planned||expected.plan.length!==effects.rows.length||
   effects.rows.some((r,i)=>r.id!==String(i)||r.property!==expected.plan[i].property||JSON.stringify(r.requested)!==JSON.stringify(expected.plan[i].requested)))
   throw Error('react-root-variants-plan-mismatch');
  const source=program.components.find(c=>c.module===effects.source.module&&c.exportName===effects.source.exportName&&c.sourceSha256===effects.source.sourceSha256&&c.span.start===effects.source.span.start&&c.span.end===effects.source.span.end)!;
  for(const property of new Set(expected.plan.map(p=>p.property))){
   const result:ReactRootVariants['drafts'][number]={property,status:'refused',problems:[],observations:[],lowerings:[],limitations:[
    'single-property-in-observed-context','other-property-combinations-not-observed','descendant-effects-not-assembled',
    'sample-dimensions-not-source-constraints','behavior-not-projected','native-fidelity-not-verified']};out.drafts.push(result);
   try{
    const prop=source.props.find(p=>p.name===property)!,classified=classifyReactProperty(prop.type);
    if(classified?.kind!=='enum'||!classified.values?.length)throw Error('react-root-variants-enum-unqualified');
    const values=classified.values,codeValues=classified.codeValues??Object.fromEntries(values.map(v=>[v,v]));
    const defaultKey=Object.hasOwn(source.defaults,property)?values.find(v=>Object.is(codeValues[v],source.defaults[property])):undefined;
    if(Object.hasOwn(source.defaults,property)&&defaultKey===undefined)throw Error('react-root-variants-default-unmapped');
    // The existing computed fusion has a distinct unset plane for defaultless APIs.
    let unset='unset';while(values.includes(unset))unset+='-unset';
    const axisValues=defaultKey===undefined&&prop.optional?[unset,...values]:values;
    const axis={prop:property,values:axisValues,...(defaultKey===undefined&&prop.optional?{unset}:{})};
    const baseValue=defaultKey??(prop.optional?unset:values[0]),baseAxisValues={[property]:baseValue};
    const enumeration=enumerate([axis],[],64,baseAxisValues);
    if(enumeration.policy!=='full-cartesian')throw Error('react-root-variants-incomplete-enumeration');
    const rows=effects.rows.filter(r=>r.property===property);
    const roots=new Map<string,CapturedNode>(),projections=new Map<string,ReturnType<typeof projectReactRootVisual>['roots'][number]>();
    let omitted:ReactPropertySnapshot|undefined,defaultSnapshot:ReactPropertySnapshot|undefined;
    for(const row of rows){
     const snap=snapshots[row.id];
     if(row.status!=='observed'||!row.restored||!snap||snap.treeSha256!==row.treeSha256||snap.image!==row.image||evidenceSha(JSON.stringify(snap.tree))!==row.treeSha256)
      throw Error('react-root-variants-observation-unverified');
     const instance=snap.ownership.components.find(i=>i.id===effects.instanceId);
     if(!instance||JSON.stringify(instance.source)!==JSON.stringify(effects.source))throw Error('react-root-variants-source-changed');
     const held={...instance.props},original={...effects.heldProps};delete held[property];delete original[property];
     if(JSON.stringify(held)!==JSON.stringify(original))throw Error('react-root-variants-held-props-changed');
     if(row.requested.kind==='omit'?Object.hasOwn(instance.props,property):!Object.is(instance.props[property],row.requested.value))throw Error('react-root-variants-property-mismatch');
     const key=row.requested.kind==='omit'?(defaultKey??unset):values.find(v=>Object.is(codeValues[v],row.requested.kind==='set'?row.requested.value:undefined));
     if(key===undefined)throw Error('react-root-variants-value-unmapped');
     const linked=linkReactSourceAnatomy(program,snap.ownership,snap.tree).instances.find(i=>i.instanceId===effects.instanceId);
     const projected=projectReactRootVisual(program,snap.ownership,snap.tree,snap.styleOrigin).roots.find(r=>r.instanceId===effects.instanceId);
     if(!linked||linked.content!=='caller-slot'||linked.roots.length!==1||!projected?.contract)throw Error('react-root-variants-content-unqualified');
     const root={...structuredClone(linked.roots[0].observation),nodes:[],style:Object.fromEntries(Object.entries(linked.roots[0].observation.style).map(([k,v])=>[k,normalizeValue(v)]))};
     // CSS Align 3 section 8.1: normal gap has a used value of zero in
     // flex layout (unlike multicol). Keep this lowering explicit; feeding
     // 'normal' into the numeric mint would drop the ENTIRE varying gap.
     // https://www.w3.org/TR/css-align-3/#column-row-gap
     if(root.style.display==='flex'||root.style.display==='inline-flex')for(const channel of ['row-gap','column-gap']){
      if(root.style[channel]==='normal'){
       root.style[channel]='0px';
       if(!result.lowerings.some(l=>l.value===key&&l.channel===channel))result.lowerings.push({value:key,channel,from:'normal',to:'0px',reason:'flex-normal-gap-used-value'});
      }
     }
     if(roots.has(key)&&JSON.stringify(roots.get(key))!==JSON.stringify(root))throw Error('react-root-variants-default-and-omission-differ');
     roots.set(key,root);projections.set(key,projected);result.observations.push(row.id);
     if(row.requested.kind==='omit')omitted=snap;
     else if(key===defaultKey)defaultSnapshot=snap;
    }
    if(defaultSnapshot&&omitted&&defaultSnapshot.treeSha256!==omitted.treeSha256)throw Error('react-root-variants-default-descendants-differ');
    if(roots.size!==axisValues.length||axisValues.some(v=>!roots.has(v)))throw Error('react-root-variants-missing-plane');
    if(new Set([...roots.values()].map(r=>r.tag)).size!==1)throw Error('react-root-variants-host-changed');
    const suffix=revisionOf({source:effects.source,property,planes:[...roots].map(([value,root])=>({value,tag:root.tag,style:Object.fromEntries(Object.entries(root.style).filter(([channel])=>!reactRootStyleExclusion(channel)))}))}).slice(7,23),name=`RootVariants${suffix}`;
    const contract=ContractSchema.parse({id:`observed.react-variants-${suffix}`,name,version:'0.1.0',status:'draft',
     description:`Observed ${source.exportName} root styling for ${property}; other properties and composition are unqualified.`,
     props:[{name:property,type:{enum:values},...(defaultKey===undefined?{}:{default:defaultKey}),...(!prop.optional?{required:true}:{}),
      bindings:{code:{prop:property,...(classified.codeValues?{values:classified.codeValues}:{})},figma:{kind:'VARIANT',property,values:Object.fromEntries(values.map(v=>[v,v])),...(defaultKey===undefined&&prop.optional?{unsetValue:'(unset)'}:{})}}}],
     states:[],semantics:{element:roots.get(baseValue)!.tag},anatomy:{root:{slot:{name:'children'}}},
     bindings:{code:{anchors:{importPath:`observed/${suffix}`,export:name}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
    const byCombo=new Map(enumeration.combos.map(c=>[c.key,roots.get(c.axisValues[property])!]));
    const {enriched,tokens,residuals,overflow}=compileReactRootSweep(contract,[axis],baseAxisValues,byCombo);
    retainReactRootSourceBindings(enriched,tokens,[axis],baseAxisValues,new Map(enumeration.combos.map(c=>[c.key,projections.get(c.axisValues[property])!])));
    if(enriched.anatomy.root.parts||enriched.anatomy.root.content||enriched.anatomy.root.slot?.name!=='children')throw Error('react-root-variants-content-boundary-changed');
    const errors:string[]=[];validateContract(enriched,new Map([[enriched.id,enriched]]),errors,new Map());if(errors.length)throw Error('react-root-variants-invalid:'+errors.join(';'));
    result.contract=enriched;result.tokens=tokens;result.residuals=residuals;result.status='style-prepared';
    if(overflow.length)throw Error('react-root-variants-unprojected-bindings:'+overflow.map(r=>r.part+'.'+r.channel+(r.state?':'+r.state:'')).join(','));
    const engine=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
    result.native=engine.compileComponentData(enriched,new Map([[enriched.id,enriched]]));result.status='native-compiled';
   }catch(error){result.problems.push(error instanceof Error?error.message:String(error));}
  }
 }catch(error){out.problems.push(error instanceof Error?error.message:String(error));}
 return out;
}
