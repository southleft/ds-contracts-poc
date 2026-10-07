import type {ReactContextRuntimeReport,ReactContextValueWitness} from './react-context-runtime.js';
import type {ReactTargetRenderOutputWitness} from './react-helper-runtime.js';
type Factory=ReactContextRuntimeReport['factories']['invocations'][number];
const same=(a:ReactContextValueWitness|undefined,b:ReactContextValueWitness|undefined):boolean=>{
 if(!a||!b||a.kind!==b.kind||a.representation||b.representation)return false;
 return ['object','function','symbol','bigint'].includes(a.kind)?Number.isSafeInteger(a.identity)&&a.identity!>=0&&a.identity===b.identity:Object.is(a.value,b.value);
};
const requireProof=(value:unknown,reason:string):void=>{if(!value)throw Error('context-factory-props-'+reason);};
/** Joins observations inside the unchanged guarded run. This verifies the
 * native factory transport only, never source effects or component behavior. */
export function verifyReactFactoryProps(factory:Factory,output:ReactTargetRenderOutputWitness){
 requireProof(factory.completion==='returned'&&same(factory.value,output.value)&&same(factory.arguments[0],output.type),'return-link');
 if(factory.factory!=='createElement'){
  requireProof(same(factory.arguments[1],output.props),'jsx-identity');
  return {factory:factory.id,kind:'jsx-identity' as const,fields:output.fields.length};
 }
 const r=factory.propsReceipt;
 requireProof(r&&r.qualification==='native-factory-config-props-observation-only'&&r.effectsVerified===false,'receipt-missing');
 if(!r)throw Error('context-factory-props-receipt-missing');
 requireProof(same(r.config,factory.arguments[1])&&same(r.props,output.props),'receipt-identity');
 const unique=(fields:Array<[string,ReactContextValueWitness]>)=>fields.every(([k])=>typeof k==='string')&&new Set(fields.map(([k])=>k)).size===fields.length;
 requireProof(unique(r.configFields)&&unique(r.propsFields)&&unique(output.fields),'duplicate-fields');
 requireProof(r.propsFields.length===output.fields.length&&r.propsFields.every(([k,v],i)=>k===output.fields[i][0]&&same(v,output.fields[i][1])),'returned-fields');
 requireProof(r.positionalChildren.length===Math.max(0,factory.arguments.length-2)&&r.positionalChildren.every((v,i)=>same(v,factory.arguments[i+2])),'children-arguments');
 // Multiple children require the native array allocation's element witnesses.
 // An opaque array identity is insufficient to assert their contents.
 requireProof(r.positionalChildren.length<=1,'children-array-unqualified');
 const expected=new Map(r.configFields.filter(([k])=>!['key','__self','__source'].includes(k)));
 if(r.positionalChildren.length===1)expected.set('children',r.positionalChildren[0]);
 requireProof(expected.size===r.propsFields.length&&r.propsFields.every(([k,v])=>expected.has(k)&&same(v,expected.get(k))),'copy-mismatch-or-defaults');
 return {factory:factory.id,kind:'create-element-copy' as const,fields:r.propsFields.length};
}
