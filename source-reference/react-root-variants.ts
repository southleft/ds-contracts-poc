/** Reusable one-property root drafts from authenticated source observations.
 * Other properties, descendant effects and native fidelity stay unqualified. */
import {revisionOf} from '../core/contract-provenance.js';
import {ContractSchema,resolveTokens,tokensByPropEntries,type Contract} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import {createFigmaEngine,type ComponentData} from '../core/emit-figma-script.js';
import {mintTokens} from '../core/mint-tokens.js';
import {enumerate,normalizeValue,type Capture,type CapturedNode,type FlatEl} from '../extract/computed/lib.js';
import {enrichLayout,prepareMint,applyMintToContract,type AlignedSweep} from '../extract/computed/fuse.js';
import type {PropSpace} from '../extract/computed/capture.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactOwnership} from './react-ownership.js';
import type {ReactStyleOrigin} from './react-style-origin.js';
import type {ReactPropertyEffects} from './react-property-effects.js';
import {classifyReactProperty} from './react-program-proposal.js';
import {planReactPropertyEffects} from './react-property-effects.js';
import {linkReactSourceAnatomy} from './react-source-anatomy.js';
import {projectReactRootVisual,reactRootStyleExclusion} from './react-root-visual.js';
import {evidenceSha} from './react-validation-evidence.js';

export interface ReactPropertySnapshot {
 tree:CapturedNode;treeSha256:string;image:string;ownership:ReactOwnership;styleOrigin:ReactStyleOrigin;
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
    const captures:Capture[]=enumeration.combos.map(c=>({combo:c.key,interaction:'default',root:roots.get(c.axisValues[property])!}));
    const byKey=new Map(captures.map(c=>[c.combo+'__default',c])),alignedByKey=new Map(captures.map(c=>[c.combo+'__default',[{path:'',sig:'root',partName:'root',node:c.root}] as FlatEl[]]));
    const baseCombo=enumeration.combos.find(c=>c.axisValues[property]===baseValue)!,base=byKey.get(baseCombo.key+'__default')!,baseFlat=alignedByKey.get(baseCombo.key+'__default')!;
    const aligned:AlignedSweep={captures,byKey,base,baseFlat,inBase:[true],partNames:['root'],union:{entries:[{id:0,sig:'root',rep:base.root,repPath:'',repKey:baseCombo.key,inBase:true,parent:null,children:[],partName:'root'}],alignedByKey,receipts:[]},getAligned:key=>alignedByKey.get(key)??[null],structureReceipts:[],anatomyJoin:[{part:'root',join:'matched'}],staticOnlyParts:[]};
    const space:PropSpace={contract,axes:[axis],presence:new Map(),stateProps:[],enumeration,baseComboKey:baseCombo.key,baseAxisValues,heldFixed:[]};
    const channels=new Set([...roots.values()].flatMap(r=>Object.keys(r.style)).filter(c=>!reactRootStyleExclusion(c))),styled=new Map([['root',channels]]);
    const layout=enrichLayout(aligned,space,styled,contract);if(layout.contradictions.length)throw Error('react-root-variants-layout-contradiction');
    const prep=prepareMint(aligned,{name,importName:name,contract:'',sampleText:'',axes:[property]},space,styled,[],layout.handled,contract);
    const minted=mintTokens(name,prep.baseObs,prep.axes,{nestedPairs:true}),states=mintTokens(name,prep.stateObs,prep.axes,{nestedPairs:true});
    const applied=applyMintToContract(contract,space,minted,prep.baseObs,states,prep.stateObs,layout.enriched,prep.declared,prep.declaredStates,prep.setPlaneLiterals,{only:prep.inheritanceOnly,stateDeltas:prep.inheritanceStateDeltas},prep.stateCodeOnly);
    const enriched=ContractSchema.parse(applied.enriched),tokens=structuredClone(minted.tree);
    const named:Record<string,any>=Object.create(null),bindingMaps:Record<string,Record<string,string>>=Object.create(null);
    const boundChannels=new Set([...projections.values()].flatMap(p=>(p.sourceBindings??[]).filter(b=>b.tokenPath).map(b=>b.channel)));
    for(const channel of boundChannels){
     for(const value of axisValues){
      const projection=projections.get(value)!,binding=projection.sourceBindings?.find(b=>b.channel===channel&&b.tokenPath);
      let ref=resolveTokens(enriched.anatomy.root,{[property]:value})[channel]?.replaceAll('{'+property+'}',value);
      if(binding?.tokenPath){
       const key=binding.tokenPath.split('.').at(-1)!,leaf=(projection.tokens?.source as any)?.css?.[key];
       if(!leaf)throw Error('react-root-variants-source-token-missing');
       if(named[key]&&(named[key].$type!==leaf.$type||JSON.stringify(named[key].$value)!==JSON.stringify(leaf.$value)))throw Error('react-root-variants-source-variable-scope-conflict');
       if(!named[key])named[key]=structuredClone(leaf);
       else{const a=named[key].$extensions['dev.ds-contracts.css-source'],b=leaf.$extensions['dev.ds-contracts.css-source'];a.selectors=[...new Set([...a.selectors,...b.selectors])].sort();}
       ref='{'+binding.tokenPath+'}';
      }
      if(!ref)throw Error('react-root-variants-binding-channel-missing');
      if(value===unset&&defaultKey===undefined){enriched.anatomy.root.tokens??={};enriched.anatomy.root.tokens[channel]=ref;}
      else (bindingMaps[value]??={})[channel]=ref;
     }
    }
    if(Object.keys(named).length)tokens.source={css:named};
    if(Object.keys(bindingMaps).length){
     // Replace this axis's binding for the affected channels, preserving other
     // channels. A channel/prop pair may occur only once in the shared schema.
     const entries=tokensByPropEntries(enriched.anatomy.root).map(e=>({...e,map:Object.fromEntries(Object.entries(e.map).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).filter(([c])=>e.prop!==property||!boundChannels.has(c)))]))}));
     enriched.anatomy.root.tokensByProp=[...entries,{prop:property,map:bindingMaps}];
    }
    if(enriched.anatomy.root.parts||enriched.anatomy.root.content||enriched.anatomy.root.slot?.name!=='children')throw Error('react-root-variants-content-boundary-changed');
    const errors:string[]=[];validateContract(enriched,new Map([[enriched.id,enriched]]),errors,new Map());if(errors.length)throw Error('react-root-variants-invalid:'+errors.join(';'));
    result.contract=enriched;result.tokens=tokens;result.residuals=[...prep.codeOnly,...prep.stateCodeOnly];result.status='style-prepared';
    const engine=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
    result.native=engine.compileComponentData(enriched,new Map([[enriched.id,enriched]]));result.status='native-compiled';
   }catch(error){result.problems.push(error instanceof Error?error.message:String(error));}
  }
 }catch(error){out.problems.push(error instanceof Error?error.message:String(error));}
 return out;
}
