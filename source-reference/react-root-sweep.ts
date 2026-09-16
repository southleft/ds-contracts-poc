/** Shared fusion for an explicitly complete finite root-style matrix. */
import {ContractSchema,resolveTokens,tokensByPropEntries,type Contract} from '../scripts/contract-schema.js';
import {enumerate,type EnumAxisSpec,type Capture,type CapturedNode,type FlatEl} from '../extract/computed/lib.js';
import {enrichLayout,prepareMint,applyMintToContract,type AlignedSweep} from '../extract/computed/fuse.js';
import type {PropSpace} from '../extract/computed/capture.js';
import {mintTokens} from '../core/mint-tokens.js';
import {reactRootStyleExclusion,type ReactRootVisual} from './react-root-visual.js';

export function compileReactRootSweep(contract:Contract,axes:EnumAxisSpec[],baseAxisValues:Record<string,string>,roots:Map<string,CapturedNode>,sizingChannels:Set<string>=new Set()){
 const enumeration=enumerate(axes,[],256,baseAxisValues);
 if(enumeration.policy!=='full-cartesian'||roots.size!==enumeration.combos.length||enumeration.combos.some(c=>!roots.has(c.key)))throw Error('react-root-sweep-incomplete');
 const captures:Capture[]=enumeration.combos.map(c=>({combo:c.key,interaction:'default',root:roots.get(c.key)!}));
 const byKey=new Map(captures.map(c=>[c.combo+'__default',c])),alignedByKey=new Map(captures.map(c=>[c.combo+'__default',[{path:'',sig:'root',partName:'root',node:c.root}] as FlatEl[]]));
 const baseCombo=enumeration.combos.find(c=>axes.every(a=>c.axisValues[a.prop]===baseAxisValues[a.prop]));if(!baseCombo)throw Error('react-root-sweep-base-missing');
 const base=byKey.get(baseCombo.key+'__default')!,baseFlat=alignedByKey.get(baseCombo.key+'__default')!;
 const aligned:AlignedSweep={captures,byKey,base,baseFlat,inBase:[true],partNames:['root'],union:{entries:[{id:0,sig:'root',rep:base.root,repPath:'',repKey:baseCombo.key,inBase:true,parent:null,children:[],partName:'root'}],alignedByKey,receipts:[]},getAligned:key=>alignedByKey.get(key)??[null],structureReceipts:[],anatomyJoin:[{part:'root',join:'matched'}],staticOnlyParts:[]};
 const space:PropSpace={contract,axes,presence:new Map(),stateProps:[],enumeration,baseComboKey:baseCombo.key,baseAxisValues,heldFixed:[]};
 const channels=new Set([...roots.values()].flatMap(r=>Object.keys(r.style)).filter(c=>!reactRootStyleExclusion(c)||sizingChannels.has(c))),styled=new Map([['root',channels]]);
 const layout=enrichLayout(aligned,space,styled,contract);if(layout.contradictions.length)throw Error('react-root-sweep-layout-contradiction');
 const name=contract.name,prep=prepareMint(aligned,{name,importName:name,contract:'',sampleText:'',axes:axes.map(a=>a.prop)},space,styled,[],layout.handled,contract);
 const minted=mintTokens(name,prep.baseObs,prep.axes,{nestedPairs:true}),states=mintTokens(name,prep.stateObs,prep.axes,{nestedPairs:true});
 const applied=applyMintToContract(contract,space,minted,prep.baseObs,states,prep.stateObs,layout.enriched,prep.declared,prep.declaredStates,prep.setPlaneLiterals,{only:prep.inheritanceOnly,stateDeltas:prep.inheritanceStateDeltas},prep.stateCodeOnly);
 return {enriched:ContractSchema.parse(applied.enriched),tokens:structuredClone(minted.tree),residuals:[...prep.codeOnly,...prep.stateCodeOnly]};
}

/** Carry source identities only when their conditional mapping is proved
 * over every observed combination. Cross-axis identities that the contract's
 * per-property binding grammar cannot express refuse, never become guessed names. */
export function retainReactRootSourceBindings(enriched:Contract,tokens:Record<string,unknown>,axes:EnumAxisSpec[],baseAxisValues:Record<string,string>,projections:Map<string,Pick<ReactRootVisual['roots'][number],'sourceBindings'|'tokens'>>){
 const enumeration=enumerate(axes,[],256,baseAxisValues);
 if(enumeration.policy!=='full-cartesian'||projections.size!==enumeration.combos.length)throw Error('react-root-bindings-incomplete');
 const boundChannels=new Set([...projections.values()].flatMap(p=>(p.sourceBindings??[]).filter(b=>b.tokenPath).map(b=>b.channel)));
 const named:Record<string,any>=Object.create(null),maps=new Map<string,Record<string,Record<string,string>>>();
 for(const channel of boundChannels){
  const refs=new Map<string,string>();
  for(const combo of enumeration.combos){
   const projection=projections.get(combo.key);if(!projection)throw Error('react-root-bindings-plane-missing');
   const binding=projection.sourceBindings?.find(b=>b.channel===channel&&b.tokenPath);
   let ref=resolveTokens(enriched.anatomy.root,combo.axisValues)[channel];
   for(const [property,value] of Object.entries(combo.axisValues))ref=ref?.replaceAll('{'+property+'}',value);
   if(binding?.tokenPath){
    const key=binding.tokenPath.split('.').at(-1)!,leaf=(projection.tokens?.source as any)?.css?.[key];
    if(!leaf)throw Error('react-root-bindings-source-token-missing');
    if(named[key]&&(named[key].$type!==leaf.$type||JSON.stringify(named[key].$value)!==JSON.stringify(leaf.$value)))throw Error('react-root-bindings-source-variable-scope-conflict');
    if(!named[key])named[key]=structuredClone(leaf);
    else{const a=named[key].$extensions['dev.ds-contracts.css-source'],b=leaf.$extensions['dev.ds-contracts.css-source'];a.selectors=[...new Set([...a.selectors,...b.selectors])].sort();}
    ref='{'+binding.tokenPath+'}';
   }
   if(!ref)throw Error('react-root-bindings-channel-missing');refs.set(combo.key,ref);
  }
  if(new Set(refs.values()).size===1){enriched.anatomy.root.tokens??={};enriched.anatomy.root.tokens[channel]=[...refs.values()][0];continue;}
  const axis=axes.find(axis=>axis.values.every(value=>new Set(enumeration.combos.filter(c=>c.axisValues[axis.prop]===value).map(c=>refs.get(c.key))).size===1));
  if(!axis)throw Error('react-root-bindings-joint-source-identity-unrepresentable:'+channel);
  const map=maps.get(axis.prop)??Object.create(null);maps.set(axis.prop,map);
  for(const value of axis.values){
   const ref=refs.get(enumeration.combos.find(c=>c.axisValues[axis.prop]===value)!.key)!;
   if(value===axis.unset){enriched.anatomy.root.tokens??={};enriched.anatomy.root.tokens[channel]=ref;}
   else (map[value]??=Object.create(null))[channel]=ref;
  }
 }
 if(Object.keys(named).length)tokens.source={css:named};
 if(boundChannels.size){
  const entries=tokensByPropEntries(enriched.anatomy.root).map(e=>({...e,map:Object.fromEntries(Object.entries(e.map).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).filter(([c])=>!boundChannels.has(c)))]))})).filter(e=>Object.values(e.map).some(v=>Object.keys(v).length));
  const all=[...entries,...[...maps].map(([prop,map])=>({prop,map}))];
  if(all.length)enriched.anatomy.root.tokensByProp=all;else delete enriched.anatomy.root.tokensByProp;
 }
}
