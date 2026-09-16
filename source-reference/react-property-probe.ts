/** Property experiments run only in a disposable, host-authenticated React
 * source context. They never edit source files or infer behavior from pixels. */
import type {Page} from 'playwright-core';
import {randomUUID} from 'node:crypto';
import {reactOwnershipRead, type ReactOwnership} from './react-ownership.js';
import type {ReactSourceProgram, ReactTypeFact} from './react-source-program.js';

export type ReactPropertyValue = {kind:'set'; value:string|number|boolean|null} | {kind:'omit'};
export type ReactPropertyChanges = Record<string,ReactPropertyValue>;
const reserved = new Set(['children','className','style','ref','key','id','__proto__','constructor','prototype']);
const admits = (type:ReactTypeFact,value:unknown):boolean => type.kind==='union'
  ? type.members.some(member=>admits(member,value))
  : type.kind==='literal' ? Object.is(type.value,value)
  : type.kind==='null' ? value===null
  : ['boolean','string','number'].includes(type.kind) && typeof value===type.kind && (typeof value!=='number'||Number.isFinite(value));
const sameSource=(a:ReactOwnership['components'][number]['source'],b:ReactOwnership['components'][number]['source'])=>
  a.module===b.module&&a.exportName===b.exportName&&a.sourceSha256===b.sourceSha256&&a.span.start===b.span.start&&a.span.end===b.span.end;

/** The callback records the real render/DOM, so a successfully delivered prop
 * is never itself evidence that the component responds to it. A defaultChecked
 * update, for example, need not update an already-mounted uncontrolled input.
 * Restoration is checked separately and is not a business-state rollback. */
export async function probeReactProperties<T>(
 page:Page, selector:string, program:ReactSourceProgram, instanceId:string,
 changes:ReactPropertyChanges, observe:()=>Promise<T>,
):Promise<{before:T; changed:T; restored:T; ownershipRestored:boolean; changes:ReactPropertyChanges}> {
 if(program.problems.length||!Object.keys(changes).length||Object.keys(changes).some(property=>reserved.has(property))) throw Error('react-property-probe-input-unsupported');
 const baseline=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
 if(baseline.problems.length) throw Error('react-property-probe-ownership-unqualified');
 const instance=baseline.components.find(c=>c.id===instanceId);
 const source=instance&&program.components.find(c=>sameSource(c,instance.source));
 if(!instance||!source) throw Error('react-property-probe-source-or-prop-missing');
 for(const [property,requested] of Object.entries(changes)){
  const prop=source.props.find(p=>p.name===property);
  if(!prop)throw Error('react-property-probe-source-or-prop-missing');
  if(requested.kind==='omit' ? !prop.optional : !admits(prop.type,requested.value))
   throw Error('react-property-probe-value-outside-source-api');
 }
 const token=randomUUID();
 const mutate=(restore:boolean)=>page.evaluate(`(()=>{
  const state=window.__DSC_REACT_OWNERSHIP;
  const roots=state&&[...state.roots.values()].filter(r=>r.root.current?.child);
  if(!roots||roots.length!==1||roots[0].didError)throw Error('react-property-probe-root-unqualified');
  const root=roots[0],revision=root.revision;if(typeof root.revision!=='number')throw Error('react-property-probe-commit-observer-missing');const renderer=state.renderers.get(root.id);
  if(!['19.2.4','19.2.7'].includes(renderer?.version)||typeof renderer.overrideProps!=='function'||typeof renderer.overridePropsDeletePath!=='function')throw Error('react-property-probe-renderer-unsupported');
  const registry=window.__DSC_REACT_EXPORTS||[],values=new Map(registry.map(x=>[x.value,x.identity]));
  let sequence=0,target;
  const walk=fiber=>{for(let n=fiber;n;n=n.sibling){const identity=values.get(n.elementType)||values.get(n.type);if(identity){const id='instance-'+sequence++;if(id===${JSON.stringify(instanceId)})target={fiber:n,identity};}if(n.child)walk(n.child);}};walk(root.root.current);
  if(!target||JSON.stringify(target.identity)!==${JSON.stringify(JSON.stringify(instance.source))})throw Error('react-property-probe-target-changed');
  const key=${JSON.stringify(token)};state.propertyProbes??=new Map();
  if(${restore}){
   const prior=state.propertyProbes.get(key);if(!prior)throw Error('react-property-probe-restore-missing');
   renderer.overrideProps(target.fiber,[],prior);
  }else{
   if(state.propertyProbes.size)throw Error('react-property-probe-overlap');
   state.propertyProbes.set(key,target.fiber.memoizedProps);
   // All requested inputs change in ONE renderer update. Sequential calls
   // would read the same memoizedProps and can overwrite earlier patches.
   const next={...target.fiber.memoizedProps};
   for(const [property,requested] of Object.entries(${JSON.stringify(changes)})){
    if(requested.kind==='omit')delete next[property];else next[property]=requested.value;
   }
   renderer.overrideProps(target.fiber,[],next);
  }
  return revision;
 })()`);
 const settle=async(revision:unknown)=>{
  if(typeof revision!=='number')throw Error('react-property-probe-commit-observer-missing');
  await page.waitForFunction(before=>[...(window as any).__DSC_REACT_OWNERSHIP.roots.values()].some((r:any)=>r.revision>before),revision,{timeout:5000});
  const next=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
  if(next.problems.length) throw Error('react-property-probe-render-unqualified:'+next.problems.join(','));
  return next;
 };
 const before=await observe();
 let changed:T;
 try{
  const revision=await mutate(false);
  const next=await settle(revision),observed=next.components.find(c=>c.id===instanceId);
  if(!observed||!sameSource(observed.source,instance.source)||
   Object.entries(changes).some(([property,requested])=>requested.kind==='omit'?Object.hasOwn(observed.props,property):!Object.is(observed.props[property],requested.value)))
   throw Error('react-property-probe-prop-not-applied');
  changed=await observe();
 }finally{
  // A renderer may schedule the update and then throw. The saved props,
  // rather than a successful return from mutate(), determine restoration.
  const pending=await page.evaluate(key=>(window as any).__DSC_REACT_OWNERSHIP?.propertyProbes?.has(key)===true,token);
  if(pending){
   const revision=await mutate(true);await settle(revision);
   await page.evaluate(key=>(window as any).__DSC_REACT_OWNERSHIP.propertyProbes.delete(key),token);
  }
 }
 const restored=await observe(),after=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
 return {before,changed:changed!,restored,ownershipRestored:JSON.stringify(after)===JSON.stringify(baseline),changes};
}

/** Existing one-property callers use the same atomic patch and restoration. */
export async function probeReactProperty<T>(page:Page,selector:string,program:ReactSourceProgram,instanceId:string,
 property:string,requested:ReactPropertyValue,observe:()=>Promise<T>){
 const {changes:_,...result}=await probeReactProperties(page,selector,program,instanceId,{[property]:requested},observe);
 return {...result,requested};
}
