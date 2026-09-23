/** Full cartesian observation of the admitted finite source style properties.
 * Boolean/state APIs and runtime-owned content remain explicitly outside this
 * style matrix. Never use a one-axis sample as evidence of joint coverage. */
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {planReactPropertyEffects,observeReactPropertyPlan,type ReactPropertyObservationArgs,type ReactPropertyObservation} from './react-property-effects.js';
import type {ReactPropertyChanges,ReactPropertyValue} from './react-property-probe.js';
import type {ReactSourceProgram} from './react-source-program.js';
import type {ReactOwnership} from './react-ownership.js';
import type {CapturedNode} from '../extract/computed/lib.js';
export interface ReactPropertyMatrix {
 version:1;qualification:'full-finite-style-matrix';instanceId:string;
 source:ReactOwnership['components'][number]['source'];heldProps:ReactOwnership['components'][number]['props'];
 axes:Array<{property:string;values:ReactPropertyValue[]}>;
 planned:number;skipped:Array<{property:string;reason:string}>;
 rows:Array<ReactPropertyObservation&{changes:ReactPropertyChanges;baseline?:true}>;problems:string[];
}
export function planReactPropertyMatrix(program:ReactSourceProgram,ownership:ReactOwnership,tree:CapturedNode,instanceId:string){
 const single=planReactPropertyEffects(program,ownership,tree,instanceId);
 const axes=[...new Set(single.plan.map(p=>p.property))].map(property=>({property,values:single.plan.filter(p=>p.property===property).map(p=>p.requested)}));
 const total=axes.length?axes.reduce((n,a)=>n*a.values.length,1):0;
 if(total>256)throw Error('react-property-matrix-cartesian-limit');
 const plan:Array<{changes:ReactPropertyChanges;baseline?:true}>=[];
 const visit=(i:number,changes:ReactPropertyChanges)=>{
  if(i===axes.length){plan.push({changes});return;}
  const axis=axes[i];for(const value of axis.values)visit(i+1,{...changes,[axis.property]:value});
 };
 if(total)visit(0,{});
 else plan.push({changes:{},baseline:true});
 return {source:single.source,heldProps:single.heldProps,skipped:single.skipped,axes,plan};
}
export async function observeReactPropertyMatrix(args:ReactPropertyObservationArgs):Promise<ReactPropertyMatrix>{
 const {plan,...facts}=planReactPropertyMatrix(args.program,args.ownership,args.tree,args.instanceId);
 const observed=await observeReactPropertyPlan(args,plan);
 const result:ReactPropertyMatrix={version:1,qualification:'full-finite-style-matrix',instanceId:args.instanceId,...facts,planned:plan.length,...observed};
 mkdirSync(args.dir,{recursive:true});writeFileSync(path.join(args.dir,'report.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}
