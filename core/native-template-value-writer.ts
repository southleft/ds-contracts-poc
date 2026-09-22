import type { NativeTemplateCallerIdentity } from './native-template-caller-identity.js';
/** Guarded engineering transport for an authenticated template value plan.
 * Application admission and interrupted-write settlement remain separate. */
import { canonicalJson, revisionOf } from './contract-provenance.js';
import { emitNativeContractReadbackScript, emitNativeTemplateSyncReadback,
  type NativeContractObservationInput, type NativeSourceReadback } from './native-source-observation.js';
import { planNativeTemplateValueUpdate, resolveNativeTemplateContractValueState } from './native-root-text-template-value-update.js';
import { emitNativeTokenBindingScope } from './native-token-binding-scope.js';
import type { NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';
import type { NodeSpec } from './emit-figma-script.js';
import { emitNativeTemplateCallerContentReadback } from './native-contract-comparison-observation.js';
import { prepareNativeTemplateConsumers, type NativeTemplateConsumerInput } from './native-template-value-consumers.js';

export interface NativeTemplateComponentUpdateInput {
  before: NativeContractObservationInput;
  baseline: NativeSourceReadback;
  desired: NativeRootTextTemplateGraphInput;
  consumers?: NativeTemplateConsumerInput[];
  callerIdentity?: NativeTemplateCallerIdentity;
}
export function prepareNativeTemplateComponentUpdate(input: NativeTemplateComponentUpdateInput) {
  if (input.callerIdentity !== undefined && input.callerIdentity !== 'sdk-slot-alias-v1') throw Error('native-template-caller-identity-invalid');
  const after = resolveNativeTemplateContractValueState(input);
  const valuePlan = planNativeTemplateValueUpdate({ before: input.before.templateGraph!.input,
    desired: input.desired, identity: input.before.templateGraph!.identity, baseline: input.baseline.templateGraph!.receipt });
  const baseline = structuredClone(input.baseline); delete baseline.images;
  const consumers = prepareNativeTemplateConsumers(input.before, baseline, input.consumers, input.callerIdentity);
  const plan = { version: 1 as const, kind: 'native-template-component-update-candidate' as const,
    before: structuredClone(input.before), baseline, after, valuePlan, consumers,
    ...(input.callerIdentity ? {callerIdentity: input.callerIdentity} : {}),
    acceptedContract: null, nativeQualification: 'unqualified' as const };
  return { ...plan, revision: revisionOf(plan) };
}
export type NativeTemplateComponentUpdatePlan = ReturnType<typeof prepareNativeTemplateComponentUpdate>;

/** Input is the authenticated compiler/baseline evidence, never a self-signed
 * write plan. The native program allocates nothing and changes no metadata.
 * A partial/uncertain attempt stops for independent settlement; it never
 * silently resumes or overwrites intervening design edits. */
export function emitNativeTemplateValueWriteScript(input: NativeTemplateComponentUpdateInput, readOnly = false): string {
  const plan = prepareNativeTemplateComponentUpdate(input);
  const identity = plan.before.templateGraph!.identity;
  const allocated = [...identity.source.variables.map(v => v.id), ...identity.routes.map(v => v.id)];
  const owned = [...plan.before.creation.nodes.map((n: { id: string }) => n.id), ...plan.consumers.flatMap(c => c.nodeIds)];
  const mainIds = plan.before.creation.variants.map((n: { id: string }) => n.id);
  if (new Set(owned).size !== owned.length || !owned.length) throw Error('native-template-write-node-identity');
  const baseline = canonicalJson(plan.baseline);
  const fonts = new Map<string, { family: string; style: string }>();
  const visit = (spec: NodeSpec) => {
    if (spec.type === 'text') {
      const font = { family: spec.fontFamily!, style: spec.fontStyle! };
      fonts.set(canonicalJson(font), font);
    }
    spec.children?.forEach(visit);
  };
  for (const component of [plan.before.component, plan.after.component]) component.variants.forEach(v => visit(v.spec));
  // Runtime carries only facts it reads. Full authenticated inputs remain in
  // the host plan; embedding that plan duplicates large component snapshots.
  const runtimePlan = { revision: plan.revision,
    before: { operation: plan.before.operation, creation: { pageId: plan.before.creation.pageId } },
    valuePlan: { changes: plan.valuePlan.changes } };
  return `const plan=${JSON.stringify(runtimePlan)},readOnly=${readOnly};
const out={version:1,kind:'native-template-value-write-result',planRevision:plan.revision,status:'refused',changedVariableIds:[],attemptedVariableIds:[],problems:[],acceptedContract:null,nativeQualification:'unqualified'};
const canonical=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return v;})(value));
const clean=value=>{const v=JSON.parse(JSON.stringify(value));delete v.images;return v;};
const stored=(actual,expected)=>canonical(actual)===canonical(expected)||typeof expected==='number'&&actual===Math.fround(expected)||
 expected&&typeof expected==='object'&&!Array.isArray(expected)&&actual&&typeof actual==='object'&&
 canonical(Object.keys(actual).sort())===canonical(Object.keys(expected).sort())&&Object.entries(expected).every(([key,value])=>stored(actual[key],value));
const expectedBaseline=${JSON.stringify(baseline)};
const sameBaseline=value=>canonical(clean(value))===expectedBaseline;
${plan.consumers.length ? `${plan.callerIdentity ? "const cleanCaller=value=>{const v=clean(value);delete v.slotIdentityAliases;return v;};\n" : ""}const consumerBaselines=${JSON.stringify(plan.consumers.map(c => c.baseline.content))};
const readConsumers=[${plan.consumers.map(c => `async()=>{${emitNativeTemplateCallerContentReadback(c.input,false,false,plan.callerIdentity)}}`).join(',')}];
const readConsumersSync=[${plan.consumers.map(c => `()=>{${emitNativeTemplateCallerContentReadback(c.input,true,false,plan.callerIdentity)}}`).join(',')}];
const sameConsumers=values=>values.length===consumerBaselines.length&&values.every((v,i)=>canonical(${plan.callerIdentity ? "cleanCaller" : "clean"}(v))===canonical(consumerBaselines[i]));
const collectConsumers=async()=>{const values=[];for(const read of readConsumers)values.push(await read());return values;};` : ''}
try{
 if(figma.fileKey!==plan.before.operation.fileKey)throw Error('native-update-file-mismatch');
 const readBefore=async()=>{${emitNativeContractReadbackScript(plan.before)}};
 const initial=await readBefore();
 if(!sameBaseline(initial))throw Error('native-template-write-baseline-conflict');
 ${plan.consumers.length ? "const consumersInitial=await collectConsumers();if(!sameConsumers(consumersInitial)||!sameBaseline(await readBefore()))throw Error('native-template-write-consumer-baseline-conflict');out.consumerObservations=consumersInitial;" : ''}
 if(!plan.valuePlan.changes.length){out.status=readOnly?'preflight-observed':'no-op';out.observation=initial;return out;}
 if(typeof figma.loadFontAsync!=='function'||typeof figma.listAvailableFontsAsync!=='function')throw Error('native-template-write-font-api');
 const available=await figma.listAvailableFontsAsync(), fonts=new Map();
 const request=font=>{const matches=available.filter(f=>f.fontName.family===font.family&&f.fontName.style.replaceAll(' ','')===font.style.replaceAll(' ',''));
  if(matches.length!==1)throw Error('native-template-write-font-unavailable');const name=matches[0].fontName;fonts.set(canonical(name),name);};
 for(const font of ${JSON.stringify([...fonts.values()])})request(font);
 for(const font of fonts.values())await figma.loadFontAsync(font);
 await figma.loadAllPagesAsync();await figma.variables.getLocalVariableCollectionsAsync();
 ${emitNativeTokenBindingScope()}
 // The scope scan and final complete read are synchronous through assignment.
 const allocated=new Set(${JSON.stringify(allocated)}),owned=new Set(${JSON.stringify(owned)}),mainIds=new Set(${JSON.stringify(mainIds)});
${plan.callerIdentity && plan.consumers.length ? `const scopedCallers=readConsumersSync.map(read=>read());
 if(!sameConsumers(scopedCallers))throw Error('native-template-write-consumer-live-conflict');
 for(const content of scopedCallers)for(const alias of content.slotIdentityAliases)owned.add(alias.liveId);\n` : ''} const affected=new Set(plan.valuePlan.changes.map(c=>c.variableId));
 const refs=value=>Array.isArray(value)?value.flatMap(refs):value&&typeof value==='object'?
  value.type==='VARIABLE_ALIAS'?[value.id]:Object.values(value).flatMap(refs):[];
 if(locals.length>10000)throw Error('native-template-write-variable-scope-too-large');
 let expanded=true;
 while(expanded){expanded=false;for(const variable of locals)if(!affected.has(variable.id)&&refs(variable.valuesByMode).some(id=>affected.has(id))){
   if(!allocated.has(variable.id))throw Error('native-template-write-external-alias:'+variable.id);affected.add(variable.id);expanded=true;
 }}
 const touches=value=>refs(value).some(id=>affected.has(id));
 if(styleBindings.some(touches))throw Error('native-template-write-style-consumer');
 const consumers=[];
 for(const node of liveNodes){
  if(node.type==='INSTANCE'){
   const main=node.mainComponent;
   if(!main||main.type!=='COMPONENT'||!main.id)throw Error('native-template-write-instance-scope-unavailable');
   if(mainIds.has(main.id)&&!owned.has(node.id))throw Error('native-template-write-instance-consumer-unobserved:'+node.id);
  }
  const fields=['boundVariables','fills','strokes','effects','layoutGrids','backgrounds',
    ...(node.type==='VECTOR'?['vectorNetwork']:[]),...(node.type==='INSTANCE'?['componentProperties']:[]),
    ...(node.type==='COMPONENT_SET'||node.type==='COMPONENT'&&node.parent?.type!=='COMPONENT_SET'?['componentPropertyDefinitions']:[])];
  const values=fields.filter(f=>f in node).map(f=>node[f]);
  if(node.type==='TEXT')values.push(node.getStyledTextSegments(['boundVariables','fills']));
  if(values.some(touches)){if(!owned.has(node.id))throw Error('native-template-write-external-node-consumer:'+node.id);consumers.push(node.id);}
 }
 const current=(()=>{${emitNativeTemplateSyncReadback(plan.before)}})();
 if(!sameBaseline(current))throw Error('native-template-write-live-conflict');
 ${plan.consumers.length ? "const consumerCurrent=readConsumersSync.map(read=>read());if(!sameConsumers(consumerCurrent))throw Error('native-template-write-consumer-live-conflict');" + (plan.callerIdentity ? "if(canonical(consumerCurrent)!==canonical(scopedCallers))throw Error('native-template-write-consumer-alias-changed');" : '') : ''}
 const assignments=plan.valuePlan.changes.map(change=>{const variable=figma.variables.getVariableById(change.variableId);
  if(!variable||variable.key!==change.variableKey||typeof variable.setValueForMode!=='function')throw Error('native-template-write-variable-api');return{change,variable};})
  .filter(({change,variable})=>!stored(variable.valuesByMode[change.modeId],change.after));
 out.consumerScope={affectedVariableIds:[...affected].sort(),nodeIds:consumers.sort()};
 if(readOnly){out.status='preflight-observed';out.observation=current;${plan.consumers.length ? 'out.consumerObservations=consumerCurrent;' : ''}return out;}
 for(const {change,variable} of assignments){
  out.attemptedVariableIds.push(change.variableId);
  variable.setValueForMode(change.modeId,change.after);
  out.changedVariableIds.push(change.variableId);
 }
 const readAfter=async()=>{${emitNativeContractReadbackScript(plan.after)}};
 out.observation=await readAfter();
 if(out.observation.status!=='native-readback-collected')throw Error('native-template-write-post-read-refused');
 ${plan.consumers.length ? `const consumersFirst=await collectConsumers();out.consumerObservations=await collectConsumers();
 if(out.consumerObservations.some(v=>v.status!=='native-readback-collected')||canonical(consumersFirst)!==canonical(out.consumerObservations)||
  canonical(out.observation)!==canonical(await readAfter()))throw Error('native-template-write-post-consumers-changed');` : ''}
 // The host must verify this independently against plan.after. This response
 // is an attempted delivery, never a qualification or recovery permission.
 out.status=assignments.length?'write-observed':'no-op';
}catch(error){out.problems.push(error&&error.message?error.message:String(error));
 if(out.attemptedVariableIds.length)out.status='recovery-required';
}
return out;`;
}
