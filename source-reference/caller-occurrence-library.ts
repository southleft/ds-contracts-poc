/** Host-only occurrence lowering. The exported entry point requires the exact
 * opaque proof issued by the unchanged native/source authentication chain. */
import {createHash} from 'node:crypto';
import {canonicalJson} from '../core/contract-provenance.js';
import {ContractSchema,walkAnatomy,contractDependencyEdges,type Contract,type Part} from '../scripts/contract-schema.js';
import {capturedTokensFromDump,type CapturedTokenLayer} from '../core/captured-tokens.js';
import {TextAppearanceSchema} from '../packages/schema/src/text-appearance.js';
import {callerContentGroups} from '../packages/schema/src/contract-schema.js';
import {selectFigmaImportRoot} from '../core/figma-import-selection.js';
import {parseLibraryRequest} from '../playground/server/react-library-input.js';
import {authenticatedCallerAssignment,type CallerAssignmentProof} from './caller-occurrence-assignment.js';
type Row=Record<string,any>;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail:(code:string)=>never=(code)=>{throw Error('caller-occurrence-'+code);};
const identity=[[1,0,0],[0,1,0]];
/** Exact, bounded frame representation: fixed width / intrinsic vertical
 * flow, no paint, effect, clipping, positioning or authored interaction. */
export function qualifyNeutralOccurrenceFrame(node:Row):Part {
 const v=node.values;
 if(node.type!=='FRAME'||!v||v.x!==0||v.y!==0||!Number.isFinite(v.width)||v.width<=0||!Number.isFinite(v.height)||v.height<0)fail('frame-geometry');
 const required={visible:true,opacity:1,relativeTransform:identity,targetAspectRatio:null,layoutMode:'VERTICAL',primaryAxisAlignItems:'MIN',counterAxisAlignItems:'MIN',primaryAxisSizingMode:'AUTO',counterAxisSizingMode:'FIXED',layoutSizingHorizontal:'FIXED',layoutSizingVertical:'HUG',layoutPositioning:'AUTO',layoutWrap:'NO_WRAP',clipsContent:false,itemSpacing:0,paddingTop:0,paddingRight:0,paddingBottom:0,paddingLeft:0,minWidth:null,minHeight:null,maxWidth:null,maxHeight:null,fills:[],strokes:[],effects:[],boundVariables:{},explicitVariableModes:{},componentPropertyReferences:null,reactions:[]};
 for(const[k,value]of Object.entries(required))if(!same(v[k],value))fail('frame-field:'+k);
 // Stroke/radius fields are required even for an unpainted frame. They are
 // not dropped from source proof; non-neutral values are refused by name.
 for(const k of ['topLeftRadius','topRightRadius','bottomRightRadius','bottomLeftRadius','cornerRadius'])if(v[k]!==0)fail('frame-field:'+k);
 if(v.strokeAlign!=='INSIDE'||v.strokeCap!=='NONE'||['strokeWeight','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight'].some(k=>v[k]!==1))fail('frame-stroke-profile');
 const known=new Set([...Object.keys(required),'width','height','x','y','strokeAlign','strokeCap','strokeWeight','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight','topLeftRadius','topRightRadius','bottomRightRadius','bottomLeftRadius','cornerRadius','resolvedVariableModes']);
 for(const k of Object.keys(v))if(!known.has(k))fail('frame-field-unsupported:'+k);
 return {layout:{display:'flex',direction:'column',align:'start',justify:'start'},literals:{width:v.width+'px',height:'fit-content'},declared:{'box-sizing':'border-box'}};
}
/** Retain native range appearance; metadata alias names never establish a
 * binding. This bounded branch requires a single native variable-font run. */
export function qualifyCallerText(node:Row,native:Row,captured?:CapturedTokenLayer,supplement?:Row):Part {
 const appearance=TextAppearanceSchema.parse(node.text?.sourceAppearance),v={...native.values};
 if(supplement){if(supplement.id!==native.id||supplement.characters!==native.values.characters)fail('text-supplement-identity');for(const key of ['textAutoResize','fontWeight']){const field=supplement.fields[key];if(field?.present!==true||Object.hasOwn(v,key)&&!same(v[key],field.value))fail('text-supplement-field:'+key);v[key]=field.value;}}
 if(node.type!=='TEXT'||native.type!=='TEXT'||node.nodeId!==native.id||node.children?.length||native.childIds.length||appearance.runs.length!==1||node.text.characters!==appearance.characters||v.characters!==appearance.characters)fail('text-shape');
 const r=appearance.runs[0];
 if(!same(r.fontName,v.fontName)||r.fontName.variationSettings?.wght!==r.fontWeight||r.fontSize!==v.fontSize||!same(r.lineHeight,v.lineHeight)||!same(r.letterSpacing,v.letterSpacing)||r.textCase!==v.textCase||r.textDecoration!==v.textDecoration)fail('text-native-style');
 if(v.fills?.length!==1||v.fills[0].type!=='SOLID'||v.fills[0].visible!==true||!same(r.fill.paint,{color:v.fills[0].color,opacity:v.fills[0].opacity,blendMode:v.fills[0].blendMode})||r.fill.variableId!==v.fills[0].boundVariables?.color?.id)fail('text-native-paint');
 if(v.visible!==true||v.opacity!==1||!same(v.strokes,[])||!same(v.effects,[])||!same(v.reactions,[])||v.layoutPositioning!=='AUTO'||v.layoutSizingHorizontal!=='HUG'||v.layoutSizingVertical!=='HUG'||v.textAlignHorizontal!=='LEFT'||!same(v.relativeTransform,identity)||['minWidth','minHeight','maxWidth','maxHeight'].some(k=>v[k]!==null)||v.targetAspectRatio!==null||v.textStyleId!==''||Object.keys(v.componentPropertyReferences??{}).length)fail('text-native-layout');
 if(v.textAutoResize!=='WIDTH_AND_HEIGHT'||node.text.textAutoResize!==v.textAutoResize)fail('text-native-resize-unobserved');
 const known=new Set(['visible','opacity','x','y','width','height','relativeTransform','targetAspectRatio','layoutSizingHorizontal','layoutSizingVertical','layoutPositioning','minWidth','minHeight','maxWidth','maxHeight','fills','strokes','strokeAlign','strokeCap','strokeWeight','effects','boundVariables','explicitVariableModes','resolvedVariableModes','componentPropertyReferences','characters','fontName','fontSize','fontWeight','lineHeight','textAlignHorizontal','letterSpacing','textCase','textDecoration','textStyleId','reactions','textAutoResize']);
 for(const key of Object.keys(v))if(!known.has(key))fail('text-native-field-unsupported:'+key);
 if(v.strokeAlign!=='OUTSIDE'||v.strokeCap!=='NONE'||v.strokeWeight!==1||v.fontWeight!==undefined&&v.fontWeight!==r.fontWeight)fail('text-native-stroke-or-weight');
 const tokens:Record<string,string>={};
 const binding=(field:string,id:string|undefined,css:string,expected:unknown)=>{
  if(!id)return;
  const consumer=node.variableConsumers?.[id],token=consumer&&captured?.variablePaths.get(consumer.name),entry=captured?.entries.find(e=>e.path===token&&e.name===consumer?.name);
  if(!consumer||!token||!entry||!same(consumer.value,expected)||!same(consumer.selectedValue,expected))fail('text-variable-witness:'+field);
  if(entry.modes&&Object.values(entry.modes).some(value=>value!==entry.value))fail('text-variable-mode-unqualified:'+field);
  if(field==='fontSize'){
   if(entry.type!=='dimension'||!/^[-+]?\d+(?:\.\d+)?px$/.test(entry.value)||Number(entry.value.slice(0,-2))!==r.fontSize)fail('text-variable-value:'+field);
  }else{
   if(entry.type!=='color'||!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(entry.value))fail('text-variable-value:'+field);
   const hex=entry.value.slice(1),parts=[0,2,4,6].map((offset,index)=>index===3&&hex.length===6?1:Math.fround(parseInt(hex.slice(offset,offset+2),16)/255));
   if(!same({r:parts[0],g:parts[1],b:parts[2],a:parts[3]},expected))fail('text-variable-value:'+field);
  }
  tokens[css]='{'+token+'}';
 };
 const fillAliases=v.boundVariables?.fills;
 if(!same(fillAliases,[{type:'VARIABLE_ALIAS',id:r.fill.variableId}]))fail('text-fill-binding');
 binding('fills',r.fill.variableId,'color',{...r.fill.paint.color,a:r.fill.paint.opacity});
 const sizeAliases=v.boundVariables?.fontSize;
 if(sizeAliases!==undefined){if(!Array.isArray(sizeAliases)||sizeAliases.length!==1||sizeAliases[0].type!=='VARIABLE_ALIAS'||typeof sizeAliases[0].id!=='string'||!sizeAliases[0].id.length)fail('text-size-binding');binding('fontSize',sizeAliases[0].id,'font-size',r.fontSize);}
 for(const field of Object.keys(v.boundVariables??{}))if(!['fills','fontSize'].includes(field))fail('text-binding-unsupported:'+field);
 // The host has checked each native alias against its exact captured token.
 // Opt in explicitly; unmarked authored appearance keeps its existing fallback.
 const spacing=r.letterSpacing.unit==='PIXELS'?r.letterSpacing.value:r.letterSpacing.value===0?0:undefined;
 if(spacing===undefined)fail('text-auto-resize-percent-tracking-unsupported');
 return {text:appearance.characters,textAutoResize:'WIDTH_AND_HEIGHT',
  literals:{'letter-spacing':spacing+'px'},declared:{display:'block','white-space':'pre','text-align':'left'},
  tokens,textAppearanceTokenBindings:Object.keys(tokens) as Array<'color'|'font-size'>,
  textAppearanceByCombination:{props:[],rows:[{values:[],appearance}]}};
}
function mergeTrees(trees:Row[]):Row {
 const out:Row={};const merge=(a:Row,b:Row,path='')=>{for(const[k,value]of Object.entries(b)){if(['__proto__','constructor','prototype'].includes(k))fail('token-key');if(!(k in a))a[k]=structuredClone(value);else if(same(a[k],value))continue;else if(a[k]&&value&&typeof a[k]==='object'&&typeof value==='object'&&'$value'in value&&'$value'in a[k]&&same(a[k].$value,value.$value)&&a[k].$type===value.$type){for(const [key,item]of Object.entries(value))if(!(key in a[k]))a[k][key]=structuredClone(item);else if(!same(a[k][key],item))fail('token-metadata-collision:'+path+'.'+k+'.'+key);}else if(a[k]&&value&&typeof a[k]==='object'&&typeof value==='object'&&!Array.isArray(value)&&!('$value'in value)&&!('$value'in a[k]))merge(a[k],value,path+'.'+k);else fail('token-collision:'+path+'.'+k);}};
 for(const tree of trees)merge(out,tree);return out;
}
export function callerOccurrenceLibraryRequest(proof:CallerAssignmentProof,dump:unknown){
 const saved=authenticatedCallerAssignment(proof,dump),d=saved.dump as Row,channel=d._occurrences,root=channel.roots[0].root;
 const native=new Map<string,Row>(saved.native.content.nodes.map((n:Row)=>[n.id,n]));
 const nodes=new Map<string,Row>();const visit=(n:Row)=>{nodes.set(n.nodeId,n);for(const c of n.children??[])visit(c);};visit(root);
 const captured=capturedTokensFromDump(d);
 const assignments=new Map(saved.proof.assignments.map(a=>[a.instanceId,a]));
 const family=saved.family as Row[],contracts=family.map(f=>{const copy=structuredClone(f.contract);copy.bindings.figma.anchors={fileKey:saved.native.fileKey,componentSetKey:f.creation.target.key,nodeId:f.creation.target.id};return ContractSchema.parse(copy);});
 if(new Set(contracts.map(c=>c.id)).size!==contracts.length)fail('family-duplicate');
 const used=new Set<string>(),owned=new Set<string>(),partKeys=new Set<string>();
 const contentKey=(id:string)=>{const key='content'+createHash('sha256').update(id).digest('hex');if(partKeys.has(key))fail('part-key-reused');partKeys.add(key);return key;};
 function lower(id:string):Part {
  if(owned.has(id))fail('caller-root-reused');owned.add(id);
  const node=nodes.get(id),current=native.get(id);if(!node||!current)fail('node-missing');
  if(node.type==='TEXT')return qualifyCallerText(node,current,captured??undefined,saved.fieldWitness?.witness.before.texts.find((r:Row)=>r.id===id));
  if(node.type!=='INSTANCE')fail('caller-content-type:'+node.type);
  const a=assignments.get(id);if(!a||!a.contentIds.length)fail('positive-filled-assignment-required');
  const mains=family.filter(f=>f.creation.variants.some((v:Row)=>v.id===a.mainId&&v.key===a.mainKey));if(mains.length!==1)fail('main-family-identity');
  const f=mains[0],contract=contracts.find(c=>c.id===f.contract.id)!;
  const slots=walkAnatomy(contract).filter(r=>r.part.slot);if(slots.length!==1||!same(slots[0].path,['root'])||f.component.rootSlot?.property!==a.propertyId.replace(/#.*$/,''))fail('main-root-slot');
  if(contract.anatomy.root.literals?.width!=='100%'||contract.anatomy.root.literals?.height!=='fit-content'||node.instanceSizing?.horizontal!=='FILL'||node.instanceSizing?.vertical!=='HUG')fail('instance-sizing');
  const values=node.instanceSlotObservation.componentProperties,props:Record<string,string|boolean>={};
  for(const p of contract.props){const b=p.bindings.figma,raw=values[b.property??p.name];if(b.kind==='VARIANT'){
   if(!raw||raw.type!=='VARIANT')fail('variant-property');
   if(raw.value===b.unsetValue){if(p.required||p.default!==undefined)fail('variant-unset');continue;}
   const entries=Object.entries(b.values??{}).filter(([,v])=>v===raw.value);if(entries.length!==1)fail('variant-value');props[p.name]=entries[0][0];
  }else fail('component-property-unsupported:'+p.name);}
  const declared=new Set(contract.props.map(p=>p.bindings.figma.property??p.name));for(const[name,value]of Object.entries(values) as [string,Row][])if(value.type!=='SLOT'&&!declared.has(name))fail('unbound-component-property:'+name);
  const parts:Record<string,Part>={};a.contentIds.forEach(child=>{const key=contentKey(child);parts[key]=lower(child);});
  const part:Part={component:{id:contract.id,...(Object.keys(props).length?{props}:{}),contentSlots:{[slots[0].part.slot!.name]:Object.keys(parts)}},parts};
  // The existing disjoint/exhaustive slot referee owns the routing rule.
  callerContentGroups(part);used.add(contract.id);return part;
 }
 const wrapper=qualifyNeutralOccurrenceFrame(native.get(root.nodeId)!);if(root.children?.length!==1||root.children[0].type!=='INSTANCE')fail('root-content-shape');
 const entryId=root.children[0].nodeId;wrapper.parts={[contentKey(entryId)]:lower(entryId)};
 if(used.size!==family.length||assignments.size!==used.size)fail('complete-family-required');
 const suffix=createHash('sha256').update(saved.proof.canonicalSha256+'\0'+root.nodeId).digest('hex').slice(0,16),id='observed.occurrence-'+suffix,name='ObservedOccurrence'+suffix;
 const contract=ContractSchema.parse({id,name,version:'0.1.0',status:'draft',description:'Observed filled caller occurrence; retained source and native evidence remain unqualified.',semantics:{element:'div'},props:[],states:[],anatomy:{root:wrapper},bindings:{figma:{anchors:{fileKey:channel.roots[0].source.fileKey,componentSetKey:null,nodeId:root.nodeId}},code:{anchors:{importPath:'observed/'+suffix,export:name}}}});
 const all=[contract,...contracts],byId=new Map(all.map(c=>[c.id,c]));for(const c of all)for(const edge of contractDependencyEdges(c))if(!byId.has(edge.id))fail('family-missing:'+edge.id);
 for(const c of all)for(const {part}of walkAnatomy(c))if(part.icon&&!Object.hasOwn(saved.icons,part.icon.asset))fail('icon-evidence-missing:'+part.icon.asset);
 const request={rootId:id,contracts:all,tokens:{primitives:mergeTrees([...saved.sourceTokens,...(captured?[captured.tree]:[])]),semantic:{},light:{},dark:{},brands:{default:{}}},icons:Object.entries(saved.icons)};
 parseLibraryRequest(request);
 const selection=selectFigmaImportRoot(d,all,(given,nodeId)=>{authenticatedCallerAssignment(proof,given);if(nodeId!==root.nodeId)fail('selection-mismatch');return{contractId:id};});
 return {request,selection,source:{kind:'host-authenticated-caller-occurrence',pins:structuredClone(saved.proof.pins),assignments:structuredClone(saved.proof.assignments),degradations:structuredClone(d._degradations),capturedTokenSkips:structuredClone(captured?.skipped??[]),originalContracts:family.map(f=>({id:f.contract.id,sha256:createHash('sha256').update(canonicalJson(f.contract)).digest('hex')})),qualification:'unqualified',acceptedContract:null}};
}
