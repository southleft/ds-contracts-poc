/** Combined finite style properties, assembled only from their full observed
 * cartesian product. This does not assemble caller children or runtime behavior. */
import {prepareReactRootSizing,type ReactSizingReport} from './react-root-sizing.js';
import {revisionOf} from '../core/contract-provenance.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import {createFigmaEngine} from '../core/emit-figma-script.js';
import {enumerate,comboKey,normalizeValue,type CapturedNode} from '../extract/computed/lib.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactOwnership} from './react-ownership.js';
import {planReactPropertyMatrix,type ReactPropertyMatrix} from './react-property-matrix.js';
import {classifyReactProperty} from './react-program-proposal.js';
import {linkReactSourceAnatomy} from './react-source-anatomy.js';
import {projectReactRootVisual,reactRootStyleExclusion} from './react-root-visual.js';
import {compileReactRootSweep,retainReactRootSourceBindings} from './react-root-sweep.js';
import type {ReactPropertySnapshot,ReactRootVariants} from './react-root-variants.js';
import {evidenceSha} from './react-validation-evidence.js';
export interface ReactRootMatrix {
 version:1;qualification:'combined-property-root-draft';acceptedContract:null;
 draft?:Omit<ReactRootVariants['drafts'][number],'property'>&{properties:string[];sizing?:ReactSizingReport[]};problems:string[];
}
export function assembleReactRootMatrix(program:ReactSourceProgram,ownership:ReactOwnership,tree:CapturedNode,
 matrix:ReactPropertyMatrix,snapshots:Record<string,ReactPropertySnapshot>):ReactRootMatrix{
 const out:ReactRootMatrix={version:1,qualification:'combined-property-root-draft',acceptedContract:null,problems:[]};
 try{
  const expected=planReactPropertyMatrix(program,ownership,tree,matrix.instanceId);
  if(matrix.version!==1||matrix.qualification!=='full-finite-style-matrix'||matrix.problems.length||
   JSON.stringify(expected.source)!==JSON.stringify(matrix.source)||JSON.stringify(expected.heldProps)!==JSON.stringify(matrix.heldProps)||JSON.stringify(expected.axes)!==JSON.stringify(matrix.axes)||
   expected.plan.length!==matrix.planned||expected.plan.length!==matrix.rows.length||matrix.rows.some((r,i)=>r.id!==String(i)||JSON.stringify(r.changes)!==JSON.stringify(expected.plan[i].changes)))throw Error('react-root-matrix-plan-mismatch');
  if(!expected.axes.length)return out;
  const result:NonNullable<ReactRootMatrix['draft']>={properties:expected.axes.map(a=>a.property),status:'refused',problems:[],observations:[],lowerings:[],limitations:[
   'observed-context-and-selected-finite-properties-only','boolean-and-runtime-state-apis-not-projected','descendant-effects-not-assembled','unresolved-sizing-and-responsive-constraints-not-projected','behavior-not-projected','native-fidelity-not-verified']};out.draft=result;
  try{
   const source=program.components.find(c=>c.module===matrix.source.module&&c.exportName===matrix.source.exportName&&c.sourceSha256===matrix.source.sourceSha256&&c.span.start===matrix.source.span.start&&c.span.end===matrix.source.span.end)!;
   const definitions=expected.axes.map(({property})=>{
    const prop=source.props.find(p=>p.name===property)!,classified=classifyReactProperty(prop.type);
    if(classified?.kind!=='enum'||!classified.values?.length)throw Error('react-root-matrix-enum-unqualified');
    const values=classified.values,codeValues=classified.codeValues??Object.fromEntries(values.map(v=>[v,v]));
    const defaultKey=Object.hasOwn(source.defaults,property)?values.find(v=>Object.is(codeValues[v],source.defaults[property])):undefined;
    if(Object.hasOwn(source.defaults,property)&&defaultKey===undefined)throw Error('react-root-matrix-default-unmapped');
    let unset='unset';while(values.includes(unset))unset+='-unset';
    const axis={prop:property,values:defaultKey===undefined&&prop.optional?[unset,...values]:values,...(defaultKey===undefined&&prop.optional?{unset}:{})};
    return {property,prop,classified,values,codeValues,defaultKey,unset,axis,baseValue:defaultKey??(prop.optional?unset:values[0])};
   });
   const axes=definitions.map(d=>d.axis),baseAxisValues=Object.fromEntries(definitions.map(d=>[d.property,d.baseValue]));
   const enumeration=enumerate(axes,[],256,baseAxisValues);if(enumeration.policy!=='full-cartesian')throw Error('react-root-matrix-incomplete-enumeration');
   const roots=new Map<string,CapturedNode>(),projections=new Map<string,ReturnType<typeof projectReactRootVisual>['roots'][number]>(),trees=new Map<string,string>();
   // Every observed row, including an omission that shares its default's key.
   const planes:Array<ReturnType<typeof projectReactRootVisual>['roots'][number]>=[];
   for(const row of matrix.rows){
    const snap=snapshots[row.id];if(row.status!=='observed'||!row.restored||!snap||snap.treeSha256!==row.treeSha256||snap.image!==row.image||evidenceSha(JSON.stringify(snap.tree))!==row.treeSha256)throw Error('react-root-matrix-observation-unverified');
    const instance=snap.ownership.components.find(i=>i.id===matrix.instanceId);if(!instance||JSON.stringify(instance.source)!==JSON.stringify(matrix.source))throw Error('react-root-matrix-source-changed');
    const held={...instance.props},original={...matrix.heldProps},assignment:Record<string,string>=Object.create(null);
    for(const definition of definitions){
     const {property,values,codeValues,defaultKey,unset}=definition,requested=row.changes[property];delete held[property];delete original[property];
     if(requested.kind==='omit'?Object.hasOwn(instance.props,property):!Object.is(instance.props[property],requested.value))throw Error('react-root-matrix-property-mismatch');
     const key=requested.kind==='omit'?(defaultKey??unset):values.find(v=>Object.is(codeValues[v],requested.value));if(key===undefined)throw Error('react-root-matrix-value-unmapped');assignment[property]=key;
    }
    if(JSON.stringify(held)!==JSON.stringify(original))throw Error('react-root-matrix-held-props-changed');
    const key=comboKey(axes,[],assignment,{});
    if(trees.has(key)&&trees.get(key)!==snap.treeSha256)throw Error('react-root-matrix-omission-or-default-changes-render');trees.set(key,snap.treeSha256);
    const linked=linkReactSourceAnatomy(program,snap.ownership,snap.tree).instances.find(i=>i.instanceId===matrix.instanceId);
    const projected=projectReactRootVisual(program,snap.ownership,snap.tree,snap.styleOrigin,undefined,undefined,snap.gridConstraints).roots.find(r=>r.instanceId===matrix.instanceId);
    if(!linked||linked.content!=='caller-slot'||linked.roots.length!==1||!projected?.contract)throw Error('react-root-matrix-content-unqualified');
    const prior=projections.get(key);
    if(prior&&(JSON.stringify(prior.sourceBindings)!==JSON.stringify(projected.sourceBindings)||JSON.stringify(prior.sourceSizing)!==JSON.stringify(projected.sourceSizing)))throw Error('react-root-matrix-default-provenance-differs');
    const root:CapturedNode={...structuredClone(linked.roots[0].observation),nodes:[],style:Object.fromEntries(Object.entries(linked.roots[0].observation.style).map(([k,v])=>[k,normalizeValue(v)]))};
    // Same bounded flex-gap lowering as the single-property adapter (CSS Align3 8.1).
    if(root.style.display==='flex'||root.style.display==='inline-flex')for(const channel of ['row-gap','column-gap'])if(root.style[channel]==='normal'){
     root.style[channel]='0px';if(!result.lowerings.some(l=>l.value===key&&l.channel===channel))result.lowerings.push({value:key,channel,from:'normal',to:'0px',reason:'flex-normal-gap-used-value'});
    }
    roots.set(key,root);projections.set(key,projected);planes.push(projected);result.observations.push(row.id);
   }
   if(roots.size!==enumeration.combos.length||enumeration.combos.some(c=>!roots.has(c.key)))throw Error('react-root-matrix-missing-combination');
   if(new Set([...roots.values()].map(r=>r.tag)).size!==1)throw Error('react-root-matrix-host-changed');
   const sizing=prepareReactRootSizing(axes,baseAxisValues,roots,projections);result.sizing=sizing.reports;
   // A grid root carries the bounded row-flow lowering only when EVERY observed
   // plane proved the same one. Flex layout is re-derived by the sweep below.
   let gridRefusal=planes.flatMap(p=>p.problems).find(p=>p.startsWith('react-root-grid-'));
   const grids=planes.map(p=>p.contract!.anatomy.root.layout?.display==='grid'?p.contract!.anatomy.root.layout:undefined);
   if(!gridRefusal&&grids.some(g=>JSON.stringify(g)!==JSON.stringify(grids[0])))throw Error('react-root-matrix-grid-layout-differs');
   // Planes that each qualify but do not share ONE width kind (fixed here, fill
   // there) refuse like any other unqualified width: prepared styles stay visible.
   if(!gridRefusal&&grids[0]&&!sizing.fill.has('width')&&!sizing.channels.has('width'))gridRefusal='react-root-grid-width-unqualified';
   const grid=gridRefusal?undefined:grids[0],fills=!!grid&&sizing.fill.has('width');
   if(fills)result.sizing=sizing.reports.map(r=>r.channel==='width'?{channel:'width',status:'fill'}:r);
   if(grid)result.limitations.push('intrinsic-row-lowering-observed-block-content-only','grid-tracks-observed-for-this-content-only');
   const suffix=revisionOf({sizing:[...projections].map(([key,p])=>[key,p.sourceSizing]),source:matrix.source,properties:result.properties,planes:[...roots].map(([value,root])=>({value,tag:root.tag,style:Object.fromEntries(Object.entries(root.style).filter(([channel])=>!reactRootStyleExclusion(channel)))}))}).slice(7,23),name=`RootMatrix${suffix}`;
   const contract=ContractSchema.parse({id:`observed.react-matrix-${suffix}`,name,version:'0.1.0',status:'draft',description:`Observed ${source.exportName} root style matrix; other APIs and composition remain unqualified.`,
    props:definitions.map(({property,prop,classified,values,defaultKey})=>({name:property,type:{enum:values},...(defaultKey===undefined?{}:{default:defaultKey}),...(!prop.optional?{required:true}:{}),bindings:{code:{prop:property,...(classified.codeValues?{values:classified.codeValues}:{})},figma:{kind:'VARIANT',property,values:Object.fromEntries(values.map(v=>[v,v])),...(defaultKey===undefined&&prop.optional?{unsetValue:'(unset)'}:{})}}})),
    states:[],semantics:{element:[...roots.values()][0].tag},anatomy:{root:{slot:{name:'children'},...(grid?{layout:grid,literals:{...(fills?{width:'100%'}:{}),height:'fit-content'}}:{})}},bindings:{code:{anchors:{importPath:`observed/${suffix}`,export:name}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
   const {enriched,tokens,residuals,overflow}=compileReactRootSweep(contract,axes,baseAxisValues,roots,sizing.channels);sizing.apply(enriched,tokens);retainReactRootSourceBindings(enriched,tokens,axes,baseAxisValues,projections);sizing.verify(enriched,tokens);
   if(enriched.anatomy.root.parts||enriched.anatomy.root.content||enriched.anatomy.root.slot?.name!=='children')throw Error('react-root-matrix-content-boundary-changed');
   const errors:string[]=[];validateContract(enriched,new Map([[enriched.id,enriched]]),errors,new Map());if(errors.length)throw Error('react-root-matrix-invalid:'+errors.join(';'));
   result.contract=enriched;result.tokens=tokens;result.residuals=residuals;result.status='style-prepared';
   if(overflow.length)throw Error('react-root-matrix-unprojected-bindings:'+overflow.map(r=>r.part+'.'+r.channel+(r.state?':'+r.state:'')).join(','));
   if(gridRefusal)throw Error(gridRefusal);
   result.native=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}).compileComponentData(enriched,new Map([[enriched.id,enriched]]));result.status='native-compiled';
  }catch(error){result.problems.push(error instanceof Error?error.message:String(error));}
 }catch(error){out.problems.push(error instanceof Error?error.message:String(error));}
 return out;
}
