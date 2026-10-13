import {assertOutsideEvidenceSnapshot} from './evidence-read-snapshot.js';
/** A bounded family of already-observed source callers, not an inferred API. */
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {validateContract} from '../packages/core/src/validate.js';
import {createFigmaEngine} from '../core/emit-figma-script.js';
import {normalizeValue,type CapturedNode} from '../extract/computed/lib.js';
import {readReactDeclaredCaseMount,type ReactCaseElement} from './react-cohort.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {reactReferenceUnchanged,type ReactReference} from './react-reference.js';
import {readReactObservedFamilyPlane,selectReactNativeRequest} from './react-native-evidence.js';
import type {ReactNativeRequest} from './react-native-request.js';
import type {ReactOwnershipReport} from './react-ownership-run.js';
import {linkReactSourceAnatomy} from './react-source-anatomy.js';
import {projectReactRootVisual} from './react-root-visual.js';
import {reactPropertyPaintedRoot} from './react-property-fonts.js';
import {prepareReactRootSizing} from './react-root-sizing.js';
import {compileReactRootSweep,retainReactRootSourceBindings} from './react-root-sweep.js';
import {prepareReactRootTextTemplate,type ReactRootTextPlane} from './react-root-text-template.js';
import type {ReactRootMatrix} from './react-root-matrix.js';

export interface ObservedFamilySelection {
  version:1;kind:'react-observed-one-axis-family';axis:string;baseCaseId:string;caseIds:string[];
}
export interface ObservedFamilyPin {id:string;recordSha256:string;inventorySha256:string}
interface Member {caseId:string;value:string;rootRequest:ReactNativeRequest;sourceTreeSha256:string;planeId:string;variantName:string}
export interface ObservedFamilyRecord {
  version:1;kind:'react-observed-one-axis-family';qualification:'selected-observed-values-only';acceptedContract:null;
  referenceId:string;ownership:{id:string;sha256:string};inventorySha256:string;programSha256:string;
  selection:ObservedFamilySelection;axis:{prop:string;values:string[];baseValue:string};
  sourceIdentity:{module:string;exportName:string;sourceSha256:string;span:{start:number;end:number}};
  surroundingMountRevision:string;members:Member[];sourceFactsRevision:string;
}
export interface ObservedFamilyMatrix {
  version:1;qualification:'observed-selected-family-root-draft';acceptedContract:null;problems:string[];
  draft:NonNullable<ReactRootMatrix['draft']>;
}
type Plane=ReturnType<typeof readReactObservedFamilyPlane>;
const verified=new WeakMap<object,{record:ObservedFamilyRecord;planes:Plane[];pin:ObservedFamilyPin}>();
export interface VerifiedObservedFamily {record:ObservedFamilyRecord;pin:ObservedFamilyPin;planes:Plane[]}
const hash=(x:string|Buffer)=>createHash('sha256').update(x).digest('hex');
const sha=/^[a-f0-9]{64}$/,caseId=/^[a-z][a-z-]{0,79}$/;
const reserved=new Set(['children','className','style','ref','key','id','__proto__','constructor','prototype','dangerouslySetInnerHTML']);
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function fail(why:string):never { throw Error('react-family-'+why); }
const equal=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const exact=(v:unknown,keys:string[]):v is Record<string,any>=>object(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export function isObservedFamilySelection(v:unknown):v is ObservedFamilySelection {
  return exact(v,['version','kind','axis','baseCaseId','caseIds'])&&v.version===1&&v.kind==='react-observed-one-axis-family'&&
    typeof v.axis==='string'&&/^[A-Za-z][A-Za-z0-9]{0,79}$/.test(v.axis)&&!reserved.has(v.axis)&&
    typeof v.baseCaseId==='string'&&caseId.test(v.baseCaseId)&&Array.isArray(v.caseIds)&&v.caseIds.length>=2&&v.caseIds.length<=32&&
    v.caseIds.every((x:unknown)=>typeof x==='string'&&caseId.test(x))&&new Set(v.caseIds).size===v.caseIds.length&&v.caseIds.includes(v.baseCaseId);
}
export function isObservedFamilyPin(v:unknown):v is ObservedFamilyPin {
  return exact(v,['id','recordSha256','inventorySha256'])&&[v.id,v.recordSha256,v.inventorySha256].every(x=>typeof x==='string'&&sha.test(x));
}
/** Pure membership guard is also used before exposing a family in the UI. */
export function observedFamilyInputs(axis:string,rows:Array<{caseId:string;props:Record<string,unknown>;mount:unknown}>,baseCaseId:string) {
  if(!isObservedFamilySelection({version:1,kind:'react-observed-one-axis-family',axis,baseCaseId,caseIds:rows.map(r=>r.caseId)})||new Set(rows.map(r=>r.caseId)).size!==rows.length||!rows.some(r=>r.caseId===baseCaseId))fail('membership-invalid');
  let held:string|undefined,mount:string|undefined;
  const members=rows.map(row=>{
    if(!Object.hasOwn(row.props,axis)||typeof row.props[axis]!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(row.props[axis] as string))fail('explicit-string-value-required');
    const rest={...row.props};delete rest[axis];
    const h=canonicalJson(rest),m=canonicalJson(row.mount);
    if(held!==undefined&&held!==h)fail('held-inputs-differ');
    if(mount!==undefined&&mount!==m)fail('surrounding-mount-differs');
    held=h;mount=m;return {caseId:row.caseId,value:row.props[axis] as string};
  }).sort((a,b)=>a.value<b.value?-1:a.value>b.value?1:0);
  if(new Set(members.map(m=>m.value)).size!==members.length)fail('duplicate-value');
  return {members,baseValue:members.find(m=>m.caseId===baseCaseId)!.value,surroundingMountRevision:revisionOf(rows[0].mount)};
}
function sourceMount(reference:ReactReference,id:string,target:ObservedFamilyRecord['sourceIdentity'],axis:string){
  const mount=readReactDeclaredCaseMount(reference.cohort,id),found:ReactCaseElement[]=[];
  const walk=(node:ReactCaseElement)=>{
    if('module' in node){
      const edges=(reference.runtimeEntryImports??[]).filter(e=>e.specifier===node.module);
      const files=[...new Set(edges.map(e=>e.file))];
      if(files.length!==1)fail('mount-runtime-route-unavailable');
      const resolved=readReactRuntimeExport(reference,path.relative(reference.sourceRoot,files[0]),node.export.split('.'));
      if(resolved.status!=='resolved')fail('mount-runtime-export-unavailable');
      if(equal({module:resolved.definition.module,exportName:resolved.definition.exportName,sourceSha256:resolved.definition.sourceSha256,span:resolved.definition.span},target))found.push(node);
    }
    node.children?.forEach(child=>{if(typeof child!=='string')walk(child);});
  };walk(mount);
  if(found.length!==1)fail('mount-ambiguous');
  const selected=found[0],props=selected.props??{};
  if(!Object.hasOwn(props,axis)||typeof props[axis]!=='string')fail('mount-explicit-string-value-required');
  const value=props[axis];selected.props={...props};delete selected.props[axis];
  return {mount,value};
}
function derive(repo:string,reference:ReactReference,report:ReactOwnershipReport,selection:ObservedFamilySelection){
  if(!isObservedFamilySelection(selection)||!reactReferenceUnchanged(reference)||reference.id!==report.referenceId)fail('selection-invalid');
  const requests=selection.caseIds.map(id=>selectReactNativeRequest(repo,report,id));
  const planes=requests.map(request=>readReactObservedFamilyPlane(repo,reference,request));
  const identity=planes[0].matrix.source;
  const entries=planes.map((p,i)=>{
    if(!equal(p.matrix.source,identity)||p.source.programSha256!==planes[0].source.programSha256)fail('source-identity-differs');
    const instance=p.row.ownership!.components.find(c=>c.id===p.matrix.instanceId);
    if(!instance||instance.roots.length!==1||instance.roots[0]!==''||!equal(instance.source,identity))fail('single-root-required');
    const mount=sourceMount(reference,requests[i].caseId,identity,selection.axis);
    if(!Object.hasOwn(instance.props,selection.axis)||instance.props[selection.axis]!==mount.value)fail('mount-runtime-value-differs');
    return {caseId:requests[i].caseId,props:instance.props,mount:mount.mount};
  });
  const inputs=observedFamilyInputs(selection.axis,entries,selection.baseCaseId);
  const members:Member[]=inputs.members.map(m=>{
    const i=requests.findIndex(r=>r.caseId===m.caseId),p=planes[i];
    return {...m,rootRequest:requests[i],sourceTreeSha256:p.captured.treeSha256,planeId:p.plane.id,variantName:selection.axis+'='+m.value};
  });
  const facts={version:1 as const,kind:'react-observed-one-axis-family' as const,qualification:'selected-observed-values-only' as const,acceptedContract:null,
    referenceId:reference.id,ownership:requests[0].ownership,inventorySha256:requests[0].inventorySha256,programSha256:planes[0].source.programSha256,
    selection:{...selection,caseIds:members.map(m=>m.caseId)},axis:{prop:selection.axis,values:members.map(m=>m.value),baseValue:inputs.baseValue},
    sourceIdentity:identity,surroundingMountRevision:inputs.surroundingMountRevision,members};
  const record:ObservedFamilyRecord={...facts,sourceFactsRevision:revisionOf(facts)};
  return {record,planes:members.map(m=>planes[requests.findIndex(r=>r.caseId===m.caseId)])};
}
function familyDir(repo:string,id:string,create=false){
  if(!sha.test(id))fail('identity-invalid');
  for(const relative of ['private','private/react-observed-families',`private/react-observed-families/${id}`]){
    const file=path.join(repo,relative);if(create&&!existsSync(file))mkdirSync(file,{mode:0o700});
    const stat=lstatSync(file);if(!stat.isDirectory()||stat.isSymbolicLink())fail('directory-invalid');
  }
  return path.join(repo,'private/react-observed-families',id);
}
export function selectObservedFamily(repo:string,reference:ReactReference,report:ReactOwnershipReport,selection:ObservedFamilySelection):ObservedFamilyPin {
  assertOutsideEvidenceSnapshot();
  const {record}=derive(repo,reference,report,selection),bytes=JSON.stringify(record,null,2)+'\n',id=hash(canonicalJson(record)),dir=familyDir(repo,id,true);
  const files={'record.json':hash(bytes)},inventory=JSON.stringify({version:1,files},null,2)+'\n';
  for(const [name,data] of [['record.json',bytes],['integrity.json',inventory]]){
    const file=path.join(dir,name);if(existsSync(file)){const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||readFileSync(file,'utf8')!==data)fail('existing-record-changed');}
    else writeFileSync(file,data,{flag:'wx',mode:0o600});
  }
  return {id,recordSha256:hash(bytes),inventorySha256:hash(inventory)};
}
export function readObservedFamilyEvidence(repo:string,reference:ReactReference,pin:ObservedFamilyPin):VerifiedObservedFamily {
  if(!isObservedFamilyPin(pin))fail('pin-invalid');const dir=familyDir(repo,pin.id);
  const read=(name:string)=>{const f=path.join(dir,name),s=lstatSync(f);if(!s.isFile()||s.isSymbolicLink()||s.size>1_000_000)fail('record-invalid');return readFileSync(f);};
  const bytes=read('record.json'),inventory=read('integrity.json');
  if(hash(bytes)!==pin.recordSha256||hash(inventory)!==pin.inventorySha256)fail('record-changed');
  const record=JSON.parse(bytes.toString()) as ObservedFamilyRecord;
  if(!object(record)||record.referenceId!==reference.id||!object(record.ownership)||typeof record.ownership.id!=='string'||! /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(record.ownership.id))fail('record-identity-invalid');
  if(hash(canonicalJson(record))!==pin.id||!equal(JSON.parse(inventory.toString()),{version:1,files:{'record.json':pin.recordSha256}})||!record.members?.length)fail('record-invalid');
  const report=JSON.parse(readFileSync(path.join(repo,'private/react-source-ownership',record.referenceId,record.ownership.id,'report.json'),'utf8')) as ReactOwnershipReport;
  const current=derive(repo,reference,report,record.selection);if(!equal(current.record,record))fail('source-facts-changed');
  const result={...current,pin};
  // Clone mutable source data, but retain the existing frozen contextual
  // capability: serializing that object would erase its private authority.
  const planes=current.planes.map(({contentContext,...plane})=>({...structuredClone(plane),...(contentContext?{contentContext}:{})}));
  verified.set(result,{record:structuredClone(current.record),pin:structuredClone(pin),planes});return result;
}
export function assembleObservedFamily(family:VerifiedObservedFamily):{matrix:ObservedFamilyMatrix;source:{revision:string;programSha256:string;evidenceRevision:string}}{
  const canonical=verified.get(family);if(!canonical)fail('verified-evidence-required');
  const {record,planes}=canonical,axes=[{prop:record.axis.prop,values:record.axis.values}],baseAxisValues={[record.axis.prop]:record.axis.baseValue};
  const roots=new Map<string,CapturedNode>(),projections=new Map<string,ReturnType<typeof projectReactRootVisual>['roots'][number]>(),textPlanes:ReactRootTextPlane[]=[];
  for(const p of planes){
    const member=record.members.find(m=>m.caseId===p.row.id)!;
    const linked=linkReactSourceAnatomy(p.program,p.row.ownership!,p.captured.tree,p.contentContext).instances.find(i=>i.instanceId===p.matrix.instanceId);
    const projected=projectReactRootVisual(p.program,p.row.ownership!,p.captured.tree,p.snapshot.styleOrigin,undefined,undefined,p.snapshot.gridConstraints,p.contentContext).roots.find(r=>r.instanceId===p.matrix.instanceId);
    if(!linked||linked.content!=='caller-slot'||linked.roots.length!==1||!projected?.contract)fail('root-content-unqualified');
    if(projected.contract.anatomy.root.layout?.display==='grid')fail('grid-family-unqualified');
    const painted=reactPropertyPaintedRoot(p.snapshot,p.plane,linked.roots[0].path);
    const root:CapturedNode={...painted,nodes:[],style:Object.fromEntries(Object.entries(painted.style).map(([k,v])=>[k,normalizeValue(v)]))};
    if(root.style.display==='flex'||root.style.display==='inline-flex')for(const channel of ['row-gap','column-gap'])if(root.style[channel]==='normal')root.style[channel]='0px';
    roots.set(member.value,root);projections.set(member.value,projected);
    textPlanes.push({snapshot:p.snapshot,row:p.plane,rootPath:linked.roots[0].path,caller:p.matrix.heldProps.children,actualProps:p.matrix.heldProps});
  }
  if(new Set([...roots.values()].map(r=>r.tag)).size!==1)fail('host-differs');
  const suffix=canonical.pin.id.slice(0,16),contract=ContractSchema.parse({id:'observed.react-family-'+suffix,name:'ObservedFamily'+suffix,version:'0.1.0',status:'draft',
    description:'Selected observed values of one source input; other values, props, contexts and behavior remain unqualified.',
    props:[{name:record.axis.prop,type:{enum:record.axis.values},default:record.axis.baseValue,bindings:{code:{prop:record.axis.prop},figma:{kind:'VARIANT',property:record.axis.prop,values:Object.fromEntries(record.axis.values.map(v=>[v,v]))}}}],
    states:[],semantics:{element:[...roots.values()][0].tag},anatomy:{root:{slot:{name:'children'}}},
    bindings:{code:{anchors:{importPath:'observed/'+suffix,export:'ObservedFamily'+suffix}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
  const sizing=prepareReactRootSizing(axes,baseAxisValues,roots,projections);
  let {enriched,tokens,residuals,overflow}=compileReactRootSweep(contract,axes,baseAxisValues,roots,sizing.channels);
  sizing.apply(enriched,tokens);retainReactRootSourceBindings(enriched,tokens,axes,baseAxisValues,projections);sizing.verify(enriched,tokens);
  if(overflow.length)fail('unprojected-bindings');
  const text=prepareReactRootTextTemplate(enriched,tokens,textPlanes);if(!text.admitted)fail('direct-text-template-required');enriched=text.contract;
  const errors:string[]=[];validateContract(enriched,new Map([[enriched.id,enriched]]),errors,new Map());if(errors.length)fail('contract-invalid:'+errors.join(';'));
  const native=createFigmaEngine({tokens:{primitives:tokens,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()}).compileComponentData(enriched,new Map([[enriched.id,enriched]]));
  if(!equal(native.variants.map(v=>v.name).sort(),record.members.map(m=>m.variantName).sort()))fail('compiled-membership-changed');
  return {matrix:{version:1,qualification:'observed-selected-family-root-draft',acceptedContract:null,problems:[],draft:{status:'native-compiled',problems:[],properties:[record.axis.prop],observations:record.members.map(m=>m.caseId),lowerings:[],limitations:['selected-observed-values-only','other-contexts-and-inputs-unqualified','native-fidelity-not-verified'],contract:enriched,tokens,residuals,sizing:sizing.reports,native}},
    source:{revision:'sha256:'+record.referenceId,programSha256:record.programSha256,evidenceRevision:record.sourceFactsRevision}};
}
export function observedFamilyMember(family:VerifiedObservedFamily,request:ReactNativeRequest){
  if(!verified.has(family))fail('verified-evidence-required');
  const member=verified.get(family)!.record.members.find(m=>m.caseId===request.caseId);if(!member||!equal(member.rootRequest,request))fail('member-request-changed');return structuredClone(member);
}

export function observedFamilyFacts(family:VerifiedObservedFamily):ObservedFamilyRecord {
  const value=verified.get(family);if(!value)fail('verified-evidence-required');return structuredClone(value.record);
}

export function observedFamilyAuthority(family:VerifiedObservedFamily) {
  const value=verified.get(family);if(!value)fail('verified-evidence-required');return {record:structuredClone(value.record),pin:structuredClone(value.pin)};
}
