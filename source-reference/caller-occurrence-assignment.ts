/** Host-only positive caller assignment authentication. No latest pointers,
 * writes, source-name matching, public qualification or empty-slot inference. */
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {canonicalJson,revisionOf} from '../core/contract-provenance.js';
import {resolveNativeSlotIdentities} from '../core/native-slot-identity.js';
import {verifyNativeContractReadback} from '../core/native-source-observation.js';
import {emitNativeContractComparisonReadbackScript,verifyNativeContractComparisonReadback} from '../core/native-contract-comparison-observation.js';
import {authenticateMatchedOperation,type MatchedSpec} from '../scripts/react-native-matched-record.js';
import {loadReactCohort} from './react-cohort.js';
import {reactReferenceHtml,reactReferenceUnchanged,type ReactReference} from './react-reference.js';
import {readReactNativeEvidence} from './react-native-evidence.js';
import {prepareReactNativePlan,prepareReactNativeFreshPlan,buildReactNativeComponentWrite,buildReactNativeFreshComponentWrite} from './react-native-plan.js';
import {readReactCompositionEvidence} from './react-composition-evidence.js';
import {readReactComparisonEvidence} from './react-comparison-evidence.js';
import {prepareReactComparisonPlan,buildReactComparisonWrite} from './react-comparison-plan.js';
import {readCallerFieldWitness,type CallerFieldWitnessSelection} from './caller-field-witness.js';
type Row=Record<string,any>;
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail:(code:string)=>never=(code)=>{throw Error('caller-assignment-'+code);};
const json=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
const nativeResponse=(bytes:Buffer)=>{const response=JSON.parse(bytes.toString());if(response.content?.length!==1||response.content[0].type!=='text')fail('response-envelope');const value=JSON.parse(response.content[0].text);if(value.success!==true||!value.result)fail('response-refused');return value;};
/** Restore the retained build's identity from its exact bundle, without build
 * or execution. Current original source hashes and cohort remain mandatory. */
export function readRetainedReactReference(repo:string,id:string):ReactReference {
 if(!/^[a-f0-9]{64}$/.test(id))fail('reference-id');
 const dir=path.join(repo,'private/react-source-references',id),p=json(path.join(dir,'provenance.json'));
 if(p.version!==1||p.id!==id||p.qualification!=='unqualified'||p.witnessSuccession!==undefined)fail('reference-provenance');
 const cohort=loadReactCohort(p.sourceRoot),html=readFileSync(path.join(dir,'reference.html'),'utf8');
 if(hash(cohort.entry)!==p.entrySha256||!same(cohort.cases,p.cases))fail('reference-cohort-changed');
 const match=html.match(/^<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>([\s\S]*)<\/style><\/head><body style="padding:32px"><div id="root"><\/div><script>([\s\S]*)<\/script><\/body><\/html>$/);
 if(!match)fail('reference-html');
 // Escaped source literals can predate HTML embedding. Accept only an exact
 // retained build identity; ambiguous/unhandled mixtures refuse.
 const choices=(raw:string,decoded:string)=>[...new Set([raw,decoded])];
 const matches:ReactReference[]=[];
 for(const css of choices(match[1],match[1].replace(/<\\\/style/gi,'</style')))for(const javascript of choices(match[2],match[2].replace(/<\\\/script/gi,'</script').replace(/\\x3C!--/g,'<!--'))){
  const reference={id,files:p.files,sourceRoot:p.sourceRoot,cohort,css,javascript};
  const identity={version:1,entry:hash(cohort.entry),files:Object.entries(p.files).map(([f,h])=>[path.relative(p.sourceRoot,f),h]).sort(),javascript:hash(javascript),css:hash(css)};
  if(hash(JSON.stringify(identity))===id&&reactReferenceHtml(reference)===html&&reactReferenceUnchanged(reference))matches.push(reference);
 }
 if(matches.length!==1)fail('reference-source-changed');return matches[0];
}
/** Bounded journal reader: only plain creation/readback operations. Repairs,
 * retries or source successions need the existing operation service instead. */
function readCreationJournal(repo:string,id:string,eventName?:string) {
 if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id))fail('operation-id');
 const dir=path.join(repo,'private/source-native-app/operations',id),headerBytes=readFileSync(path.join(dir,'operation.json')),header=JSON.parse(headerBytes.toString()),planBytes=readFileSync(path.join(dir,'plan.json')),plan=JSON.parse(planBytes.toString());
 if(header.id!==id||hash(planBytes)!==header.planSha256||hash(readFileSync(path.join(dir,'token-create.js')))!==header.tokenScriptSha256||plan.revision!==header.planRevision||revisionOf(plan.plan)!==plan.revision)fail('journal-plan');
 let previous=hash(headerBytes);const commands=new Map<string,Row>(),results=new Map<string,Row>(),events:Row[]=[];let selected:Row|undefined;
 for(const [sequence,name]of readdirSync(path.join(dir,'events')).sort().entries()){
  const bytes=readFileSync(path.join(dir,'events',name)),e=JSON.parse(bytes.toString());
  if(name!==String(sequence).padStart(8,'0')+'.json'||e.sequence!==sequence||e.previousSha256!==previous)fail('journal-chain');
  if(e.kind==='dispatch'){
   const c=e.command;if(!['token-create','token-readback','component-create','component-readback'].includes(c.phase)||c.operationId!==id||c.fileKey!==header.policy.fileKey||c.planRevision!==header.planRevision||hash(c.script)!==c.scriptSha256||commands.has(c.attemptId)||events.some(x=>x.kind==='dispatch'&&x.command.phase===c.phase&&c.phase!=='component-readback')||c.readOnly!==c.phase.endsWith('-readback'))fail('journal-command');
   commands.set(c.attemptId,c);
  }else if(e.kind==='result'){
   const v=e.envelope,c=commands.get(v.attemptId);if(!c||results.has(v.attemptId)||['phase','nonce','scriptSha256','operationId','planRevision','fileKey'].some(k=>v[k]!==c[k])||v.result?.problems?.length||v.result?.acceptedContract!==null||v.result?.nativeQualification!=='unqualified')fail('journal-result');
   results.set(v.attemptId,v);if(v.phase==='component-readback'&&(!eventName||eventName===name))selected={...v,eventName:name,eventSha256:hash(bytes)};
  }else fail('journal-kind');events.push(e);previous=hash(bytes);
 }
 if(commands.size!==results.size||!selected)fail('journal-unsettled');
 const phase=(name:string)=>{const found=[...results.values()].filter(e=>e.phase===name);if(found.length!==1)fail('journal-phase');return found[0];};
 return {header,plan,creation:phase('component-create').result,token:phase('token-create').result.creationIdentity,tokenReadback:phase('token-readback').result,selected,commands,events,headSha256:previous,headerSha256:hash(headerBytes),planSha256:hash(planBytes)};
}
function readMain(repo:string,reference:ReactReference,id:string){
 const journal=readCreationJournal(repo,id),request=journal.header.request,original=readReactNativeEvidence(repo,reference,request),input={operation:journal.plan.plan.operation,...original};
 const planned=request.compilation==='current'?prepareReactNativeFreshPlan(input):prepareReactNativePlan(input);
 if(!same(planned,journal.plan))fail('main-source-plan-changed');
 const tokens={input:planned.plan.tokenInput,identity:journal.token,receipt:journal.tokenReadback.receipt};
 const write=request.compilation==='current'?buildReactNativeFreshComponentWrite({...input,expectedPlanRevision:planned.revision,tokens}):buildReactNativeComponentWrite({...input,expectedPlanRevision:planned.revision,tokens});
 const command=[...journal.commands.values()].find(c=>c.phase==='component-create');if(write.script!==command?.script)fail('main-script-changed');
 const observation={operation:planned.plan.operation,planRevision:planned.revision,component:planned.plan.component,projection:planned.plan.projection,tokenInput:planned.plan.tokenInput,tokenIdentity:journal.token,creation:journal.creation};
 const receipt=structuredClone(journal.selected.result);delete receipt.images;
 const result=verifyNativeContractReadback(observation,receipt);if(result.status!=='supported-structure-observed'||result.problems.length)fail('main-readback-refused:'+result.problems.join(','));
 return {input:observation,receipt,request,journal,original};
}
/** Compare a current reader result with a retained capture without rewriting
 * either receipt. Only newly absent optional fields whose omission is selected
 * by the authenticated main's field profile may differ. */
export function verifyCallerReadbackContinuity(input:Row,historical:Row,current:Row) {
 const before=historical.content?.nodes,after=current.content?.nodes;
 if(!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length)fail('current-capture-census');
 const exceptNodes=(r:Row)=>({...r,content:{...r.content,nodes:undefined}});
 if(!same(exceptNodes(historical),exceptNodes(current)))fail('current-capture-envelope');
 const resolved=resolveNativeSlotIdentities(input.creation,after,after);
 if(!resolved)fail('current-capture-allocation');
 const aliases=new Map<string,string>(resolved.map((r:Row,i:number)=>[r.id,after[i].id]));
 const profiles=new Map<string,Set<string>>();
 const references=[input.comparison,...(input.comparison.instances??[])];
 const records=[input.creation.comparisons[0],...(input.creation.comparisons[0].nested??[])];
 for(const [index,reference]of references.entries()){
  const record=index===0?records[0]:records.slice(1).find((r:Row)=>r.index===index-1);
  if(!record)fail('current-capture-profile-record');
  const mains=new Map<string,Row>(reference.receipt.nodes.map((n:Row)=>[n.id,n]));
  for(const part of record.sourceParts??[]){
   let main=mains.get(reference.mainId);for(const child of part.specPath)main=main&&mains.get(main.childIds[child]);
   const id=aliases.get(part.nodeId);
   if(!main||!id||profiles.has(id))fail('current-capture-profile-identity');
   profiles.set(id,new Set(['arcData','strokeCap'].filter(field=>Object.hasOwn(main!.values,field))));
  }
 }
 const prior=new Map<string,Row>(before.map((n:Row)=>[n.id,n]));
 if(prior.size!==before.length||new Set(after.map((n:Row)=>n.id)).size!==after.length)fail('current-capture-census');
 const coverage:Row[]=[];
 for(const n of after){const old=prior.get(n.id);if(!old||!same({...old,values:undefined},{...n,values:undefined}))fail('current-capture-topology');
  for(const field of new Set([...Object.keys(old.values),...Object.keys(n.values)])){
   const was=Object.hasOwn(old.values,field),now=Object.hasOwn(n.values,field);
   if(was&&now&&same(old.values[field],n.values[field]))continue;
   if(was&&!now&&['arcData','strokeCap'].includes(field)&&profiles.has(n.id)&&!profiles.get(n.id)!.has(field)){
    coverage.push({nodeId:n.id,field,historicalValue:old.values[field],current:'unobserved-by-authenticated-main-profile'});continue;
   }
   fail('current-capture-field:'+n.id+':'+field);
  }
 }
 return coverage;
}
/** Validate the exact issued reader, never a caller-supplied success flag. */
export function verifyCallerReadbackCommand(input:Parameters<typeof emitNativeContractComparisonReadbackScript>[0],command:Row|undefined) {
 const expectedReader=emitNativeContractComparisonReadbackScript(input,true),expectedSha256=hash(expectedReader);
 if(!command||command.phase!=='component-readback'||command.readOnly!==true||command.script!==expectedReader||command.scriptSha256!==expectedSha256)fail('current-reader-script-changed');
 return expectedSha256;
}
export interface CallerCaptureSelection {
 /** Retained journal event guarded by the original canonical capture. Host-selected. */
 captureEvent:string;
 canonical:string;captureResponse:string;beforeResponse:string;afterResponse:string;script:string;
 pins:{canonical:string;captureResponse:string;beforeResponse:string;afterResponse:string;script:string};
 fieldWitness?:CallerFieldWitnessSelection;
}
export interface FilledAssignment {
 instanceId:string;mainId:string;mainKey:string;ownerId:string;ownerKey:string;propertyId:string;
 slotId:string;mainSlotId:string;targetId:string;contentIds:string[];allocationIds:string[];
}
export interface CallerAssignmentProof { readonly kind:'host-positive-filled-slot-inputs';readonly canonicalSha256:string;readonly assignments:readonly FilledAssignment[];readonly pins:Readonly<Record<string,unknown>>; }
const deepFreeze=<T>(value:T):Readonly<T>=>{if(value&&typeof value==='object'){for(const child of Object.values(value as object))deepFreeze(child);Object.freeze(value);}return value;};
const issued=new WeakMap<object,{dump:Row;native:Row;proof:CallerAssignmentProof;family:Row[];sourceTokens:Row[];icons:Record<string,string>;fieldWitness:Row|null}>();
export function authenticatedCallerAssignment(proof:CallerAssignmentProof,dump:unknown) {
 const saved=issued.get(proof);if(!saved||!same(saved.dump,dump))fail('host-proof-required');return deepFreeze(structuredClone(saved));
}
/** All paths and pins are selected by the host from retained actual receipts.
 * An HTTP caller may select an occurrence; it cannot supply these authorities. */
export function authenticateCallerSlotInputs(repo:string,spec:MatchedSpec,selection:CallerCaptureSelection):CallerAssignmentProof {
 if(spec.source.kind!=='comparison')fail('positive-comparison-required');
 const matched=authenticateMatchedOperation(path.join(repo,'private'),spec),journal=readCreationJournal(repo,spec.operation,spec.event),request=journal.header.request,reference=readRetainedReactReference(repo,request.root.referenceId);
 if(matched.native.journalEventSha256!==journal.selected.eventSha256||matched.native.journalHeadSha256!==journal.headSha256||matched.native.journalEventsVerified!==journal.events.length||matched.native.planRevision!==journal.plan.revision||!same(matched.readback,journal.selected.result))fail('journal-changed-during-authentication');
 const parentIds=[journal.plan.plan.comparison.parent.operation.id,...(journal.plan.plan.comparison.instances??[]).map((r:Row)=>r.parent.operation.id)];
 const mains=new Map([...new Set<string>(parentIds)].map(id=>[id,readMain(repo,reference,id)]));
 const parent=mains.get(request.parentOperationId);if(!parent||!same(parent.request,request.root))fail('parent-source-changed');
 const jobs={listReact:()=>[...mains].map(([id,m])=>({kind:m.request.version===1?'root':'nested',operation:{id,phase:'component-structure-observed'},ownershipId:m.request.ownership.id,caseId:m.request.caseId})),verifiedReactObservation:(id:string)=>{const main=mains.get(id);if(!main)fail('main-not-selected');return main;},verifiedReactInitialObservation:()=>fail('initial-main-unsupported')};
 const composition=readReactCompositionEvidence(repo,reference,request.root,request.parentOperationId,jobs as any,request.content);
 const evidence=readReactComparisonEvidence(repo,reference,request,parent,composition),planned=prepareReactComparisonPlan({operation:journal.plan.plan.operation,...evidence});
 if(!same(planned,journal.plan))fail('comparison-source-plan-changed');
 const write=buildReactComparisonWrite({operation:planned.plan.operation,...evidence,expectedPlanRevision:planned.revision,tokens:{input:planned.plan.tokenInput,identity:journal.token,receipt:journal.tokenReadback.receipt}}),command=[...journal.commands.values()].find(c=>c.phase==='component-create');
 if(write.script!==command?.script)fail('comparison-script-changed');
 const native=journal.selected.result;
 // The original occurrence capture retains its own historical guard. Selecting
 // a newer readback must never rewrite that receipt or its field profile.
 if(!/^\d{8}\.json$/.test(selection.captureEvent)||selection.captureEvent>spec.event)fail('capture-event-selection');
 const captureEvent=journal.events[Number(selection.captureEvent.slice(0,8))];
 const captureEnvelope=captureEvent?.kind==='result'?captureEvent.envelope:undefined;
 const captureCommand=captureEnvelope&&journal.commands.get(captureEnvelope.attemptId);
 if(!captureEnvelope||captureEnvelope.phase!=='component-readback'||captureCommand?.readOnly!==true)fail('capture-event-required');
 const historical=captureEnvelope.result;
 const observationInput={operation:planned.plan.operation,planRevision:planned.revision,comparison:planned.plan.comparison,tokenInput:planned.plan.tokenInput,tokenIdentity:journal.token,creation:journal.creation};
 const verified=verifyNativeContractComparisonReadback(observationInput,native);
 const captured=Object.fromEntries(Object.entries(selection.pins).map(([key,pin])=>{const bytes=readFileSync(selection[key as keyof CallerCaptureSelection['pins']]);if(hash(bytes)!==pin)fail('capture-bytes-changed:'+key);return[key,bytes];})) as Record<string,Buffer>;
 const dump=JSON.parse(captured.canonical.toString()),response=nativeResponse(captured.captureResponse),before=nativeResponse(captured.beforeResponse),after=nativeResponse(captured.afterResponse);
 if(!same(response.result.canonical,dump)||!same(before.result,historical)||!same(after.result,historical)||response.fileContext?.fileKey!==native.fileKey||response.result.execution?.traversalFlagRestored!==true||response.result.execution?.fileKey!==native.fileKey||!same(response.result.execution?.targetOccurrences,[journal.creation.comparisonBoardId])||response.result.execution?.qualification!=='unqualified')fail('actual-capture-join');
 const channel=dump._occurrences;if(channel?.version!==1||channel.dependencyInventory!=='complete'||channel.roots?.length!==1||channel.requested?.length!==1||channel.requested[0]!==journal.creation.comparisonBoardId||channel.roots[0].source.fileKey!==native.fileKey||channel.roots[0].source.nodeId!==channel.requested[0])fail('occurrence-source');
 const physical=new Map<string,Row>(),parents=new Map<string,string>();
 const walk=(n:Row,parent?:string)=>{if(!n.nodeId||physical.has(n.nodeId))fail('occurrence-node-identity');physical.set(n.nodeId,n);if(parent)parents.set(n.nodeId,parent);for(const c of n.children??[])walk(c,n.nodeId);};walk(channel.roots[0].root);
 const raw=native.content.nodes,resolved=resolveNativeSlotIdentities(journal.creation,raw,raw);if(!resolved)fail('allocation-topology');
 const aliases=new Map<string,string>(resolved.map((r:Row,i:number)=>[r.id,raw[i].id]));
 const nativeById=new Map<string,Row>(raw.map((n:Row)=>[n.id,n])),selectedRoot=channel.requested[0];
 const board=nativeById.get(selectedRoot),page=nativeById.get(journal.creation.pageId);
 if(!board||!page||page.type!=='PAGE'||page.parentId!=='0:0'||board.parentId!==page.id||!same(page.childIds,[board.id])||raw.length!==physical.size+1)fail('canonical-native-parent');
 const nativeSubtree=new Set<string>();
 const descend=(id:string,parentId:string)=>{const n=nativeById.get(id);if(!n||n.parentId!==parentId||nativeSubtree.has(id))fail('canonical-native-subtree');nativeSubtree.add(id);for(const child of n.childIds)descend(child,id);};descend(selectedRoot,page.id);
 if(nativeSubtree.size!==physical.size||[...nativeSubtree].some(id=>{const n=nativeById.get(id)!,p=physical.get(id);return !p||p.type!==n.type||parents.has(id)&&parents.get(id)!==n.parentId||!same((p.children??[]).map((c:Row)=>c.nodeId),n.childIds);}))fail('canonical-physical-topology');
 const records=[journal.creation.comparisons[0],...(journal.creation.comparisons[0].nested??[])],references=[planned.plan.comparison,...(planned.plan.comparison.instances??[])];
 if(records.length!==references.length)fail('comparison-family');
 const assignments:FilledAssignment[]=[];
 for(const [i,record]of records.entries()){
  const ref=references[i],instanceId=aliases.get(record.instanceId),node=instanceId?physical.get(instanceId):undefined,observation=node?.instanceSlotObservation;
  if(!node||node.type!=='INSTANCE'||!observation||observation.mainComponentId!==record.mainId||record.mainId!==ref.mainId||record.slots?.length!==1)fail('instance-main');
  const main=mains.get(ref.parent.operation.id),variant=main?.input.creation.variants.find((v:Row)=>v.id===record.mainId),owner=main?.input.creation.target;
  if(!variant||!owner||observation.mainComponentKey!==variant.key||observation.ownerId!==owner.id||observation.ownerKey!==owner.key||observation.ownerType!==owner.type)fail('main-owner-identity');
  const saved=record.slots[0],slotId=aliases.get(saved.nodeId),slot=observation.slots.find((s:Row)=>s.propertyId===saved.propertyKey);
  if(!slotId||!slot||slot.occurrenceSlotNodeId!==slotId||saved.contentNodeIds?.length<1||(!same(slot.mainLimitViolations,[])||!same(slot.occurrenceLimitViolations,[]))||slot.assignmentDisposition?.status!=='unsupported')fail('positive-filled-slot-required');
  const targetPath=ref.contentSpecPath??ref.slotSpecPath,target=record.sourceParts.find((p:Row)=>same(p.specPath,targetPath)),targetId=target&&aliases.get(target.nodeId),targetNode=targetId&&physical.get(targetId),contentIds=saved.contentNodeIds.map((id:string)=>aliases.get(id));
  if(!targetNode||contentIds.some((id:unknown)=>typeof id!=='string')||!same(targetNode.children.map((n:Row)=>n.nodeId),contentIds)||contentIds.includes(targetId)||contentIds.includes(slotId))fail('assigned-content-roots');
  // Physical main/SLOT and owner key membership came from the complete reader
  // inventory. Keep the target carrier separate from positively appended roots.
  assignments.push({instanceId:instanceId!,mainId:observation.mainComponentId,mainKey:observation.mainComponentKey,ownerId:observation.ownerId,ownerKey:observation.ownerKey,propertyId:saved.propertyKey,slotId,mainSlotId:slot.mainSlotNodeId,targetId:targetId!,contentIds,allocationIds:[...saved.contentNodeIds]});
 }
 if(assignments.length!==[...physical.values()].filter(n=>n.type==='INSTANCE').length)fail('assignment-census');
 const inventory=assignments.map(a=>({componentId:a.mainId,componentKey:a.mainKey,ownerId:a.ownerId,ownerKey:a.ownerKey,ownerType:mains.get(references[assignments.indexOf(a)].parent.operation.id)!.input.creation.target.type}));
 const sort=(rows:Row[])=>[...rows].sort((a,b)=>a.componentId.localeCompare(b.componentId));
 if(!same(sort(channel.roots[0].requiredMains??[]),sort(inventory)))fail('required-main-inventory');
 const captureCoverage=verifyCallerReadbackContinuity(observationInput,historical,native);
 const fieldWitness=selection.fieldWitness?readCallerFieldWitness(selection.fieldWitness,historical,aliases,[...mains.values()].flatMap(m=>m.receipt.nodes),native):null;
 if(verified.status!=='supported-comparison-structure-observed'||verified.problems.length){const error=Error('caller-assignment-comparison-readback-refused:'+verified.problems.join(','));Object.assign(error,{diagnostic:{status:'refused',assignments,captureCoverage,problems:verified.problems,limitations:verified.limitations,fieldWitness:fieldWitness?{pins:fieldWitness.pins,coverageDifferences:fieldWitness.coverageDifferences}:null,canonicalSha256:selection.pins.canonical,authorityPins:{native:matched.native,source:matched.source,capture:{event:selection.captureEvent,eventSha256:hash(readFileSync(path.join(repo,'private/source-native-app/operations',spec.operation,'events',selection.captureEvent)))},content:request.content,composition:request.composition,scriptSha256:command!.scriptSha256},acceptedContract:null,qualification:'unqualified',hostProofIssued:false}});throw error;}
 // A collected result may not be promoted under a stale or substituted reader.
 // The entire emitted body, journal SHA and result correlation must agree.
 const currentCommand=journal.commands.get(journal.selected.attemptId);
 const readerSha256=verifyCallerReadbackCommand(observationInput,currentCommand);
 // A concurrent appended command, source edit or changed capture cannot
 // turn an earlier successful read into current positive authority.
 for(const [id,prior]of [[spec.operation,journal],...[...mains].map(([id,main])=>[id,main.journal])] as [string,ReturnType<typeof readCreationJournal>][]){
  const current=readCreationJournal(repo,id,id===spec.operation?spec.event:undefined);
  if(current.headSha256!==prior.headSha256||current.headerSha256!==prior.headerSha256||current.planSha256!==prior.planSha256)fail('journal-changed-during-authentication');
 }
 if(!reactReferenceUnchanged(reference))fail('source-changed-during-authentication');
 for(const[key,pin]of Object.entries(selection.pins))if(hash(readFileSync(selection[key as keyof CallerCaptureSelection['pins']]))!==pin)fail('capture-changed-during-authentication');
 if(selection.fieldWitness)for(const[key,pin]of Object.entries(selection.fieldWitness.pins))if(hash(readFileSync(selection.fieldWitness[key as keyof CallerFieldWitnessSelection['pins']]))!==pin)fail('field-witness-changed-during-authentication');
 const proof:CallerAssignmentProof=deepFreeze({kind:'host-positive-filled-slot-inputs',canonicalSha256:selection.pins.canonical,assignments,pins:{capture:selection.pins,captureEvent:selection.captureEvent,captureEventSha256:hash(readFileSync(path.join(repo,'private/source-native-app/operations',spec.operation,'events',selection.captureEvent))),readerSha256,captureCoverage,native:matched.native,source:matched.source,content:request.content,composition:request.composition,scriptSha256:command!.scriptSha256,fieldWitness:fieldWitness?.pins??null,limitations:verified.limitations,qualification:'unqualified'}});
  const family=[...mains.values()].map(main=>({operationId:main.input.operation.id,contract:main.original.matrix.draft!.contract!,tokens:main.original.matrix.draft!.tokens!,component:main.input.component,creation:main.input.creation}));
 if(!composition.content.tokens||[...mains.values()].some(m=>!m.original.matrix.draft?.contract||!m.original.matrix.draft?.tokens))fail('source-draft-required');
 const icons=Object.fromEntries([...(composition.content.assets??new Map())]);
 issued.set(proof,deepFreeze({dump:structuredClone(dump),native:structuredClone(native),proof:structuredClone(proof),family:structuredClone(family),sourceTokens:[...[...mains.values()].map(main=>structuredClone(main.original.matrix.draft!.tokens!)),structuredClone(composition.content.tokens!)],icons,fieldWitness}));return proof;
}
