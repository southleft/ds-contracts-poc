/** Property experiments run only in a disposable, host-authenticated React
 * source context. They never edit source files or infer behavior from pixels. */
import type {Page} from 'playwright-core';
import {reactCallbackCandidate} from './react-callback-candidates.js';
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

async function propertyInput(page:Page,selector:string,program:ReactSourceProgram,instanceId:string,changes:ReactPropertyChanges){
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
 return {baseline,instance,source};
}

/** The callback records the real render/DOM, so a successfully delivered prop
 * is never itself evidence that the component responds to it. A defaultChecked
 * update, for example, need not update an already-mounted uncontrolled input.
 * Restoration is checked separately and is not a business-state rollback. */
export async function probeReactProperties<T>(
 page:Page, selector:string, program:ReactSourceProgram, instanceId:string,
 changes:ReactPropertyChanges, observe:()=>Promise<T>,
):Promise<{before:T; changed:T; restored:T; ownershipRestored:boolean; changes:ReactPropertyChanges}> {
 const {baseline,instance}=await propertyInput(page,selector,program,instanceId,changes);
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

/** Initial-state observations remount the disposable reference. This deliberately
 * resets runtime state and never claims to preserve a user's interaction history.
 * The target must be an exact caller-owned element in the rendered root input;
 * children constructed inside another component require a different boundary. */
export interface ReactCallbackObservation {
 calls:Array<Array<string|number|boolean|null>>; problems:string[];
}
export async function probeReactInitialProperties<T>(page:Page,selector:string,program:ReactSourceProgram,instanceId:string,
 changes:ReactPropertyChanges,observe:(phase:'before'|'changed'|'restored',readCallback:()=>Promise<ReactCallbackObservation>)=>Promise<T>,callback?:string){
 const {baseline,instance,source}=await propertyInput(page,selector,program,instanceId,changes),token=randomUUID();
 if(callback){
  const prop=source.props.find(p=>p.name===callback);
  if(reserved.has(callback)||Object.hasOwn(changes,callback)||!prop||reactCallbackCandidate(source,prop).status!=='needs-observation')
   throw Error('react-initial-callback-unsupported');
 }
 const readCallback=()=>page.evaluate(key=>{
  const record=(window as any).__DSC_REACT_OWNERSHIP?.propertyProbes?.get(key);
  return record?.callback ?? {calls:[],problems:[]};
 },token) as Promise<ReactCallbackObservation>;
 const mutate=(restore:boolean)=>page.evaluate(`(()=>{
  const state=window.__DSC_REACT_OWNERSHIP,clone=window.__DSC_REACT_CLONE_ELEMENT;
  const roots=state&&[...state.roots.values()].filter(r=>r.root.current?.child);
  if(!roots||roots.length!==1||roots[0].didError||typeof clone!=='function')throw Error('react-initial-probe-root-unqualified');
  const root=roots[0],renderer=state.renderers.get(root.id),revision=root.revision;
  if(!['19.2.4','19.2.7'].includes(renderer?.version)||typeof renderer.scheduleRoot!=='function'||typeof revision!=='number')throw Error('react-initial-probe-renderer-unsupported');
  const key=${JSON.stringify(token)};state.propertyProbes??=new Map();
  if(${restore}){
   const saved=state.propertyProbes.get(key);if(!saved||saved.kind!=='initial')throw Error('react-initial-probe-restore-missing');
   renderer.scheduleRoot(root.root,saved.element);return revision;
  }
  if(state.propertyProbes.size)throw Error('react-property-probe-overlap');
  const values=new Map((window.__DSC_REACT_EXPORTS||[]).map(x=>[x.value,x.identity]));
  let sequence=0,target;
  const find=fiber=>{for(let n=fiber;n;n=n.sibling){const identity=values.get(n.elementType)||values.get(n.type);if(identity){if('instance-'+sequence++===${JSON.stringify(instanceId)})target={fiber:n,identity};}if(n.child)find(n.child);}};
  find(root.root.current);
  if(!target||JSON.stringify(target.identity)!==${JSON.stringify(JSON.stringify(instance.source))})throw Error('react-initial-probe-target-changed');
  const original=root.root.current.memoizedState.element,callback={calls:[],problems:[]};let matches=0;
  const rewrite=element=>{
   if(Array.isArray(element))return element.map(rewrite);
   if(!element||typeof element!=='object'||element.$$typeof!==Symbol.for('react.transitional.element'))return element;
   const props={...element.props};
   if(element.type===target.fiber.elementType&&element.props===target.fiber.memoizedProps){
    matches++;
    for(const [property,requested] of Object.entries(${JSON.stringify(changes)})){
     // cloneElement merges props, so omission uses a reconstructed props object
     // on its result. No key/ref/type or child ownership is replaced.
     if(requested.kind==='omit')delete props[property];else props[property]=requested.value;
    }
    const callbackName=${JSON.stringify(callback ?? null)};
    if(callbackName){
     const originalCallback=props[callbackName];
     if(originalCallback!==undefined&&typeof originalCallback!=='function')throw Error('react-initial-callback-not-callable');
     props[callbackName]=function(...args){
      if(callback.calls.length>=128){if(!callback.problems.includes('callback-observation-overflow'))callback.problems.push('callback-observation-overflow');}
      else if(args.some(value=>value!==null&&!['string','boolean','number'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value)))callback.problems.push('callback-nonscalar-argument');
      else callback.calls.push(args);
      // Observe only. Preserve the caller's receiver, return and exceptions.
      return originalCallback?.apply(this,args);
     };
    }
   }
   if(Object.hasOwn(props,'children'))props.children=rewrite(props.children);
   return {...clone(element),props};
  };
  const changed=rewrite(original);
  if(matches!==1||!changed||changed.$$typeof!==Symbol.for('react.transitional.element'))throw Error('react-initial-probe-caller-element-not-unique');
  state.propertyProbes.set(key,{kind:'initial',element:original,callback});
  renderer.scheduleRoot(root.root,clone(changed,{key:'dsc-initial-'+key}));return revision;
 })()`);
 const settle=async(revision:unknown)=>{
  if(typeof revision!=='number')throw Error('react-initial-probe-commit-observer-missing');
  await page.waitForFunction(before=>[...(window as any).__DSC_REACT_OWNERSHIP.roots.values()].some((r:any)=>r.revision>before),revision,{timeout:5000});
  const next=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
  if(next.problems.length)throw Error('react-initial-probe-render-unqualified:'+next.problems.join(','));
  return next;
 };
 const before=await observe('before',readCallback);let changed:T,callbackObservation:ReactCallbackObservation={calls:[],problems:[]};
 try{
  const next=await settle(await mutate(false)),observed=next.components.find(c=>c.id===instanceId);
  if(!observed||!sameSource(observed.source,instance.source)||Object.entries(changes).some(([p,v])=>v.kind==='omit'?Object.hasOwn(observed.props,p):!Object.is(observed.props[p],v.value)))
   throw Error('react-initial-probe-prop-not-applied');
  changed=await observe('changed',readCallback);callbackObservation=await readCallback();
 }finally{
  if(await page.evaluate(key=>(window as any).__DSC_REACT_OWNERSHIP?.propertyProbes?.has(key)===true,token)){
   await settle(await mutate(true));
   await page.evaluate(key=>(window as any).__DSC_REACT_OWNERSHIP.propertyProbes.delete(key),token);
  }
 }
 const restored=await observe('restored',readCallback),after=await page.evaluate(reactOwnershipRead(selector)) as ReactOwnership;
 return {before,changed:changed!,restored,ownershipRestored:JSON.stringify(after)===JSON.stringify(baseline),changes,callbackObservation};
}

/** Existing one-property callers use the same atomic patch and restoration. */
export async function probeReactProperty<T>(page:Page,selector:string,program:ReactSourceProgram,instanceId:string,
 property:string,requested:ReactPropertyValue,observe:()=>Promise<T>){
 const {changes:_,...result}=await probeReactProperties(page,selector,program,instanceId,{[property]:requested},observe);
 return {...result,requested};
}
