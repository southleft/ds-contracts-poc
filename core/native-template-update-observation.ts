/** Read-only evidence for settling a template delivery. An acknowledgement is
 * never an observation, and supported structure is not full update exactness. */
import { canonicalJson } from './contract-provenance.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback, type NativeSourceReadback } from './native-source-observation.js';
import { emitNativeTemplateCallerContentReadback } from './native-contract-comparison-observation.js';
import { observeNativeTemplateValueUpdate } from './native-root-text-template-value-update.js';
import { planNativeRootTextTemplateGraph } from './native-root-text-template-graph.js';
import { prepareNativeTemplateComponentUpdate, type NativeTemplateComponentUpdateInput } from './native-template-value-writer.js';
import { verifyNativeTemplateConsumersAfter } from './native-template-value-consumers.js';

export interface NativeTemplateUpdateObservation {
  version: 1;
  kind: 'independent-native-template-update-observation';
  planRevision: string;
  status: 'collected' | 'refused';
  observation?: NativeSourceReadback;
  consumerObservations?: NativeSourceReadback[];
  problems: string[];
  acceptedContract: null;
  nativeQualification: 'unqualified';
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const clean = (raw: NativeSourceReadback) => { const r = structuredClone(raw); delete r.images; return r; };

/** A fresh read command contains no write program or delivery result. Repeated
 * complete reads bracket one another; a changed main or caller refuses. This
 * can observe partial native values without asking them to satisfy the desired
 * component, which is essential after an interrupted assignment. */
export function emitNativeTemplateUpdateObservationScript(input: NativeTemplateComponentUpdateInput, captureImages = false): string {
  const plan = prepareNativeTemplateComponentUpdate(input);
  if(captureImages)return `// GENERATED independent template observation with bracketed exports. READ ONLY.
const observe=async()=>{${emitNativeTemplateUpdateObservationScript(input)}};
const canonical=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return v;})(value));
const clean=value=>{const copy=JSON.parse(JSON.stringify(value));delete copy.images;return copy;};
const before=await observe();if(before.status!=='collected')return before;
try{
 const main=await(async()=>{${emitNativeContractReadbackScript(plan.after,true,true)}})();
 const callerExports=[];
 for(const read of [${plan.consumers.map(c=>`async()=>{${emitNativeTemplateCallerContentReadback(c.input,false,true)}}`).join(',')}])callerExports.push(await read());
 const after=await observe();
 if(after.status!=='collected'||canonical(before)!==canonical(after)||canonical(clean(main))!==canonical(clean(after.observation))||
   callerExports.some((r,i)=>canonical(clean(r))!==canonical(clean(after.consumerObservations[i]))))throw Error('native-template-update-export-observation-changed');
 after.observation.images=main.images;
 after.consumerObservations.forEach((r,i)=>{r.images=callerExports[i].images;});
 return after;
}catch(error){return {...before,status:'refused',problems:[error&&error.message?error.message:String(error)]};}`;
  return `// GENERATED independent template update observation. READ ONLY.
const out={version:1,kind:'independent-native-template-update-observation',planRevision:${JSON.stringify(plan.revision)},
 status:'refused',problems:[],acceptedContract:null,nativeQualification:'unqualified'};
const canonical=value=>JSON.stringify((function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,sort(v[k])]));return v;})(value));
const readMain=async()=>{${emitNativeContractReadbackScript(plan.after)}};
const readers=[${plan.consumers.map(c => `async()=>{${emitNativeTemplateCallerContentReadback(c.input)}}`).join(',')}];
const readCallers=async()=>{const rows=[];for(const reader of readers)rows.push(await reader());return rows;};
try{
 const firstMain=await readMain(),firstCallers=await readCallers();
 const secondMain=await readMain(),secondCallers=await readCallers();
 const finalMain=await readMain();
 out.observation=finalMain;out.consumerObservations=secondCallers;
 if([firstMain,secondMain,finalMain,...firstCallers,...secondCallers].some(r=>r.status!=='native-readback-collected'))
  throw Error('native-template-update-observation-incomplete');
 if(canonical(firstMain)!==canonical(secondMain)||canonical(secondMain)!==canonical(finalMain)||canonical(firstCallers)!==canonical(secondCallers))
  throw Error('native-template-update-observation-changed-during-read');
 out.status='collected';
}catch(error){out.problems.push(error&&error.message?error.message:String(error));}
return out;`;
}

/** Diagnose a separately collected result without granting retry, reversal or
 * journal settlement. A truly untouched result matches every saved field of
 * the main and all callers. Updated values and supported structure are reported
 * separately: changed computed geometry and exact paint propagation still
 * need the application update matcher before any completed-update claim. */
export function inspectNativeTemplateUpdateObservation(input: NativeTemplateComponentUpdateInput, raw: unknown) {
  const problems: string[] = [];
  let valueState: 'untouched' | 'updated' | 'partial' | 'no-op' | 'conflict' = 'conflict';
  let untouched = false, supportedAfterStructure = false;
  let states: ReturnType<typeof verifyNativeTemplateConsumersAfter>['states'] = [];
  try {
    const plan = prepareNativeTemplateComponentUpdate(input), r = raw as NativeTemplateUpdateObservation;
    if (!r || r.version !== 1 || r.kind !== 'independent-native-template-update-observation' || r.planRevision !== plan.revision ||
        r.status !== 'collected' || !Array.isArray(r.problems) || r.problems.length || r.acceptedContract !== null ||
        r.nativeQualification !== 'unqualified' || !r.observation || !Array.isArray(r.consumerObservations) ||
        r.consumerObservations.length !== plan.consumers.length)
      throw Error('native-template-update-observation-envelope');
    const main = clean(r.observation), contents = r.consumerObservations.map(clean);
    // This outer revision describes the HOST reader context, not a canvas
    // allocation. The receipt inside it retains the original allocation hash.
    // Validate the exact emitted context before comparing an untouched canvas
    // with a baseline collected by the preceding reader context.
    if (main.templateGraph?.graphRevision !== planNativeRootTextTemplateGraph(plan.after.templateGraph!.input).revision)
      throw Error('native-template-update-observation-reader-context');
    const values = observeNativeTemplateValueUpdate(plan.valuePlan, main.templateGraph?.receipt);
    valueState = values.status; problems.push(...values.problems);
    const originalContext = structuredClone(main);
    originalContext.templateGraph!.graphRevision = plan.baseline.templateGraph!.graphRevision;
    untouched = ['untouched', 'no-op'].includes(valueState) && same(originalContext, plan.baseline) &&
      contents.every((content, i) => same(content, plan.consumers[i].baseline.content));
    if (['updated', 'no-op'].includes(valueState)) {
      const mainResult = verifyNativeContractReadback(plan.after, main);
      const consumers = verifyNativeTemplateConsumersAfter(plan.consumers, plan.after, main, contents);
      problems.push(...mainResult.problems, ...consumers.problems);
      supportedAfterStructure = mainResult.status === 'supported-structure-observed' && consumers.status === 'supported-consumer-structure-observed';
      if (supportedAfterStructure) states = consumers.states;
    }
    if (valueState === 'untouched' && !untouched) problems.push('native-template-update-observation-baseline-conflict');
  } catch (error) { problems.push(error instanceof Error ? error.message : 'native-template-update-observation-invalid'); }
  return { version: 1 as const, valueState, untouched, supportedAfterStructure, consumerStates: states,
    problems: [...new Set(problems)], writeAuthority: 'none' as const, settlementAuthority: 'none' as const,
    acceptedContract: null, nativeQualification: 'unqualified' as const,
    limitations: ['native-update-exactness-unverified', 'native-computed-geometry-unverified', 'native-visual-fidelity-unverified'] };
}
