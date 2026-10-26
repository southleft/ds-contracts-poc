import {ContractSchema,walkAnatomy,type Contract,type Part} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import type {DumpHostOverride,DumpNode,DumpSet,DumpText} from '../extract/figma/types.js';
import type {DumpBatchResult} from './propose-figma.js';
import {canonicalJson} from './contract-provenance.js';
import {fixedSwapOwnerRoots} from './fixed-swap-root-allocation.js';
import {isolateCaller,selectedCaller,sourceTextRoute} from './nested-property-inputs.js';

export type SourceTextPart={nodeId:string;partKey:string};
type Witness=NonNullable<DumpHostOverride['textSizeOverride']>;
type Proposal=DumpBatchResult['proposals'][number];
const nodes=(node:DumpNode):DumpNode[]=>[node,...(node.children??[]).flatMap(nodes)];
const scalar=(value:unknown,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=max;

/** Admit only the two measured scalar channels. All remaining text facts,
 * including family, face, weight, spacing, case and resizing, must agree. */
export function observedScalarTextSize(w:Witness,source:DumpNode):{'font-size':string;'line-height':string}|undefined{
 const t=w?.text,base=source.text,indices=w?.characterStyleOverrides,table=w?.styleOverrideTable;
 if(w?.kind!=='scalar-text-size-v1'||source.type!=='TEXT'||!base||!t||
    !Array.isArray(indices)||indices.length!==0&&indices.length!==t.characters?.length||
    Array.from({length:indices.length},(_,i)=>Object.hasOwn(indices,i)&&indices[i]===0).some(v=>!v)||
    !table||typeof table!=='object'||Array.isArray(table)||Reflect.ownKeys(table).length||
    typeof t.characters!=='string'||!t.characters.length||t.characters.length>4096||
    !scalar(t.fontSize,2048)||!scalar(t.lineHeight,8192)||t.lineHeightUnit!==undefined||w.lineHeightUnit!=='PIXELS'||
    !scalar(base.fontSize,2048)||!scalar(base.lineHeight,8192)||base.lineHeightUnit!==undefined||
    typeof base.fontFamily!=='string'||!base.fontFamily.trim()||typeof base.fontStyle!=='string'||!base.fontStyle.trim()||
    !scalar(base.fontWeight,1000)||typeof base.letterSpacing!=='number'||!Number.isFinite(base.letterSpacing)||
    !['WIDTH_AND_HEIGHT','HEIGHT','NONE','TRUNCATE'].includes(base.textAutoResize??'')||!['LEFT','CENTER','RIGHT','JUSTIFIED'].includes(base.textAlign??'')||
    t.fontSizeVar!==undefined||t.lineHeightVar!==undefined||base.fontSizeVar!==undefined||base.lineHeightVar!==undefined)return;
 const appearance=(text:DumpText)=>{
  const a=text.sourceAppearance;if(!a)return undefined;
  if('issue'in a)return a.issue==='text-appearance-range-incomplete'?a:undefined;
  if(a.runs.length!==1)return undefined;
  return {...a,runs:a.runs.map(({fontSize,lineHeight,...run})=>run)};
 };
 const observedAppearance=appearance(t),baseAppearance=appearance(base);
 if(!observedAppearance||!baseAppearance||canonicalJson(observedAppearance)!==canonicalJson(baseAppearance))return;
 const rest=(text:DumpText)=>Object.fromEntries(Object.entries(text).filter(([key])=>!['fontSize','lineHeight','style','styleKey','sourceAppearance'].includes(key)));
 if(canonicalJson(rest(t))!==canonicalJson(rest(base)))return;
 return {'font-size':`${t.fontSize}px`,'line-height':`${t.lineHeight}px`};
}

function ownedText(p:Proposal,c:Contract,nodeId:string):{key:string;part:Part}|undefined{
 const source=p.sourceTextParts?.filter(row=>row.nodeId===nodeId);
 if(source?.length!==1)return;
 const hits=walkAnatomy(c).filter(row=>row.name===source[0].partKey);
 if(hits.length!==1)return;
 const part=hits[0].part;
 if((typeof part.text!=='string'&&!part.content)||part.parts||part.component||part.slot||part.repeat||part.shape||part.icon||part.mask||
    part.textAppearanceOverride||part.textAppearanceByCombination||part.textColorOverrideProp||part.textByProp||part.textByCombination||
    part.states||part.statesByProp||part.stylesWhen||part.literalsByCombination||part.tokensByCombination||part.tokensByProp)return;
 return {key:hits[0].name,part};
}

/** A finite, optional caller input carries observed scalar typography. Shared
 * defaults stay intact. A selected slot is followed by source identity only;
 * invalid witnesses leave both caller and owner unchanged and name the limit. */
export function settleNestedTextSizes(dump:Record<string,unknown>,fileKey:string|undefined,proposals:Proposal[],protectedIds:ReadonlySet<string>):void{
 if(!fileKey)return;
 const byKey=new Map(proposals.map(p=>[ContractSchema.parse(p.contract).bindings.figma.anchors.componentSetKey,p]));
 const sets=Object.values(dump).filter((s):s is DumpSet=>!!s&&typeof s==='object'&&Array.isArray((s as DumpSet).variants));
 const roots=fixedSwapOwnerRoots(sets),controls=new Map<string,string>();
 for(const parentProposal of proposals){
  const source=dump[parentProposal.setName] as DumpSet;
  if(!source?.variants||source.contractId||protectedIds.has(String(parentProposal.contract.id)))continue;
  for(const usage of source.variants.flatMap(nodes)){
   const witnesses=(usage.hostOverrides?.flatMap(h=>h.textSizeOverride?[h.textSizeOverride]:[])??[]).sort((a,b)=>String(a.target?.nodeId).localeCompare(String(b.target?.nodeId)));
   if(!witnesses.length)continue;
   const fail=(why:string)=>parentProposal.notes.push(`${parentProposal.setName}: nested-text-size-not-carried — ${why}`);
   const wrapperProposal=byKey.get(usage.instanceSetKey??usage.instanceKey??null);
   if(!wrapperProposal||wrapperProposal===parentProposal||protectedIds.has(String(wrapperProposal.contract.id))){fail('owner unavailable or protected');continue;}
   const wrapperSource=dump[wrapperProposal.setName] as DumpSet;
   if(wrapperSource?.contractId){fail('owner is stamped');continue;}
   const parent=ContractSchema.parse(parentProposal.contract),wrapper=ContractSchema.parse(wrapperProposal.contract);
   if(parent.bindings.figma.anchors.fileKey!==fileKey||wrapper.bindings.figma.anchors.fileKey!==fileKey){fail('file identity differs');continue;}
   const isolated=usage.nodeId?isolateCaller(parentProposal,parent,source,usage):undefined,caller=isolated?.part;
   if(!caller?.component||caller.component.id!==wrapper.id){fail('complete caller occurrence is unavailable');continue;}
   const staged=new Map<string,{proposal:Proposal;contract:Contract}>([[wrapper.id,{proposal:wrapperProposal,contract:wrapper}]]);
   const pending=new Map<string,string>(),seen=new Set<string>();let valid=true,carried=0;
   for(const w of witnesses){
    if(!w?.target||seen.has(w.target.nodeId)){valid=false;break;}seen.add(w.target.nodeId);
    const route=sourceTextRoute(usage,w,roots),ownerProposal=route&&byKey.get(route.owner.setKey);
    if(!route||!ownerProposal||ownerProposal===parentProposal||protectedIds.has(String(ownerProposal.contract.id))||(dump[ownerProposal.setName] as DumpSet)?.contractId){valid=false;break;}
    let owner=staged.get(String(ownerProposal.contract.id))?.contract;
    if(!owner){owner=ContractSchema.parse(ownerProposal.contract);staged.set(owner.id,{proposal:ownerProposal,contract:owner});}
    const target=ownedText(ownerProposal,owner,route.node.nodeId!),value=observedScalarTextSize(w,route.node);
    const destination=selectedCaller(caller,wrapper,owner,route,roots,fileKey);
    if(!target||!value||!destination?.component||owner.bindings.figma.anchors.fileKey!==fileKey){valid=false;break;}
    if(w.text.fontSize===route.node.text!.fontSize&&w.text.lineHeight===route.node.text!.lineHeight)continue;
    const key=owner.id+'\0'+target.key;
    let prop=controls.get(key)??pending.get(key);
    if(!prop){
     // Existing conditional literals are not silently reordered or replaced.
     if(target.part.literalsByProp?.length){valid=false;break;}
     const taken=new Set(owner.props.map(p=>p.name)),stem='text'+target.key[0].toUpperCase()+target.key.slice(1)+'Size';prop=stem;let suffix=2;while(taken.has(prop))prop=stem+suffix++;
     owner.props.push({name:prop,type:{enum:[]},bindings:{code:{prop},figma:{kind:'NONE'}}});
     target.part.literalsByProp=[{prop,map:{}}];pending.set(key,prop);
    }
    const input=owner.props.find(p=>p.name===prop),entries=target.part.literalsByProp?.filter(row=>row.prop===prop);
    if(!input||typeof input.type!=='object'||!('enum'in input.type)||input.default!==undefined||input.required||input.bindings.figma.kind!=='NONE'||entries?.length!==1){valid=false;break;}
    const choice='size'+w.text.fontSize+'Line'+w.text.lineHeight;
    if(entries[0].map[choice]&&canonicalJson(entries[0].map[choice])!==canonicalJson(value)){valid=false;break;}
    if(!input.type.enum.includes(choice))input.type.enum.push(choice);input.type.enum.sort();
    entries[0].map[choice]=value;entries[0].map=Object.fromEntries(Object.entries(entries[0].map).sort(([a],[b])=>a.localeCompare(b)));
    if(Object.hasOwn(destination.component.props??{},prop)&&destination.component.props![prop]!==choice){valid=false;break;}
    destination.component.props={...destination.component.props,[prop]:choice};carried++;
   }
   if(!valid){fail('scalar facts, source identity, range uniformity or selected route are unqualified');continue;}
   if(!carried)continue;
   const changed=[parent,...[...staged.values()].map(row=>row.contract)];
   const invalid=changed.flatMap(c=>{const checked=ContractSchema.safeParse(c);return checked.success?[]:checked.error.issues.map(issue=>({id:c.id,path:issue.path,message:issue.message}));});
   if(invalid.length){fail('caller or owner schema refused: '+JSON.stringify(invalid));continue;}
   const scope=new Map(proposals.map(p=>{const c=ContractSchema.parse(p.contract);return[c.id,c]as const;})),before:string[]=[],after:string[]=[];
   for(const c of changed)validateContract(scope.get(c.id)!,scope,before,new Map());
   for(const c of changed)scope.set(c.id,c);
   for(const c of changed)validateContract(c,scope,after,new Map());
   if(after.some(error=>!before.includes(error))){fail('contract validation: '+after.filter(error=>!before.includes(error)).join('; '));continue;}
   parentProposal.contract=parent as unknown as Proposal['contract'];parentProposal.sourceInstanceParts=isolated!.sourceParts;
   for(const {proposal,contract}of staged.values())proposal.contract=contract as unknown as Proposal['contract'];
   for(const [key,prop]of pending)controls.set(key,prop);
   parentProposal.notes.push(`${parentProposal.setName}: ${carried} identity-qualified uniform text-size overrides carried through optional finite child inputs; shared typography defaults remain unchanged`);
  }
 }
}
