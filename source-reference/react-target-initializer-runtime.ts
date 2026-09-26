/** Private bootstrap. All plans and callbacks originate in checked compiler
 * instrumentation; it never inspects an unknown caller object to infer origin. */
export const reactTargetInitializerRuntime=String.raw`((plans,N,intrinsics,sameDescriptor,fail,boundaries)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 const targetKey=p=>JSON.stringify([p.target.module,p.target.sourceSha256,p.target.span.start,p.target.span.end]);
 const renders=new Map(),namers=new Map(),created=new Map(),byValue=new N.WeakMapCtor(),byRender=new N.WeakMapCtor();let forwardFactory;
 const functionPrototype=Function.prototype,objectPrototype=Object.prototype,forwardType=Symbol.for('react.forward_ref');
 function descriptors(value,expected,reason){
  const actual=N.descriptors(value),keys=N.keys(actual),before=N.keys(expected);
  if(keys.length!==before.length)fail(reason);
  for(let i=0;i<keys.length;i++)if(keys[i]!==before[i]||!sameDescriptor(actual[keys[i]],expected[keys[i]]))fail(reason);
 }
 function render(key,fn){
  intrinsics();if(typeof fn!=='function'||N.prototype(fn)!==functionPrototype||renders.has(key)||!plans.some(p=>point(p.render)===key))fail('target-render-registration-invalid');
  const ds=N.descriptors(fn);for(const k of N.keys(ds))if(!N.descriptor(ds[k],'value'))fail('target-render-accessor-unmodeled');
  renders.set(key,{fn,descriptors:ds,named:false});return fn;
 }
 function namingHelper(key,fn,readNative){
  intrinsics();if(typeof fn!=='function'||typeof readNative!=='function'||namers.has(key)||!plans.some(p=>p.naming&&point(p.naming.helper)===key)||N.apply(readNative,undefined,[])!==N.define)fail('target-naming-helper-invalid');
  namers.set(key,{fn,readNative,descriptors:N.descriptors(fn)});return fn;
 }
 function name(key,fn,value,label){
  intrinsics();const plan=plans.find(p=>p.naming&&point(p.naming.call)===key),helper=plan&&namers.get(point(plan.naming.helper)),record=plan&&renders.get(point(plan.render));
  if(!helper||fn!==helper.fn||!record||value!==record.fn||record.named||label!==plan.naming.name||N.apply(helper.readNative,undefined,[])!==N.define)fail('target-naming-call-changed');
  descriptors(fn,helper.descriptors,'target-naming-helper-changed');descriptors(value,record.descriptors,'target-render-before-name-changed');
  const result=N.apply(fn,undefined,[value,label]);intrinsics();
  if(result!==value||N.apply(helper.readNative,undefined,[])!==N.define||N.prototype(value)!==functionPrototype)fail('target-naming-result-changed');
  const expected={...record.descriptors,name:{...record.descriptors.name,value:label,configurable:true}};
  descriptors(value,expected,'target-naming-effect-changed');descriptors(fn,helper.descriptors,'target-naming-helper-changed');record.descriptors=expected;record.named=true;return result;
 }
 function forward(key,receiver,factory,fn){
  intrinsics();const plan=plans.find(p=>targetKey(p)===key),record=plan&&renders.get(point(plan.render));
  if(!plan||created.has(key)||!forwardFactory||factory!==forwardFactory||!record||fn!==record.fn||!!plan.naming!==record.named)fail('target-forward-ref-call-changed');
  if(N.prototype(fn)!==functionPrototype)fail('target-render-prototype-changed');descriptors(fn,record.descriptors,'target-render-before-factory-changed');
  const value=N.apply(factory,receiver,[fn]);intrinsics();descriptors(fn,record.descriptors,'target-render-factory-mutated');
  const ds=N.descriptors(value),keys=N.keys(ds);
  if(N.prototype(value)!==objectPrototype||JSON.stringify(keys)!==JSON.stringify(['$$typeof','render','displayName'])||ds.$$typeof.value!==forwardType||ds.render.value!==fn||!N.descriptor(ds.render,'value')||typeof ds.displayName.get!=='function'||typeof ds.displayName.set!=='function')fail('target-forward-ref-result-changed');
  const item={plan,value,record,descriptors:ds,dispatches:0,invocations:[]};created.set(key,item);N.apply(N.mapSet,byValue,[value,item]);N.apply(N.mapSet,byRender,[fn,item]);return value;
 }
 function check(key,value){
  if(!plans.length)return;intrinsics();const item=created.get(key);
  if(!item||item.value!==value)fail('target-export-initializer-mismatch');
  if(N.prototype(value)!==objectPrototype||N.prototype(item.record.fn)!==functionPrototype)fail('target-initializer-prototype-changed');
  descriptors(value,item.descriptors,'target-initializer-object-changed');descriptors(item.record.fn,item.record.descriptors,'target-initializer-render-changed');
 }
 function displayName(fn,label,invoke){
  intrinsics();const record=[...renders.values()].find(r=>r.fn===fn);if(!record)return invoke();
  intrinsics();if(typeof label!=='string')fail('target-render-display-name-unmodeled');descriptors(fn,record.descriptors,'target-render-before-display-name-changed');
  const rename=record.descriptors.name?.value===''&&!record.descriptors.displayName;
  const result=invoke();intrinsics();
  const expected=rename?{...record.descriptors,name:{...record.descriptors.name,value:label},displayName:{value:label,writable:true,enumerable:true,configurable:true}}:record.descriptors;
  descriptors(fn,expected,'target-render-display-name-changed');record.descriptors=expected;return result;
 }
 function invoke(fn,input,ref,call){
  // Membership is checked before inspecting any unregistered function, props
  // or ref. The callback is emitted only at the pinned renderer's actual call.
  const item=N.apply(N.mapGet,byRender,[fn]);if(!item)return boundaries.other(fn,input,ref,call);
  intrinsics();check(targetKey(item.plan),item.value);
  if(!item.dispatches)fail('target-render-without-dispatch');
  const before=boundaries.input(input,ref,point(item.plan.render));
  try{
   const output=call();intrinsics();check(targetKey(item.plan),item.value);boundaries.checkInput(before);
   const returned=boundaries.output(output,before);
   item.invocations.push({before,returned});return output;
  }finally{boundaries.end(before);}
 }
 return {render,namingHelper,name,forward,check,displayName,invoke,
  registerForwardRef(fn){intrinsics();if(typeof fn!=='function'||forwardFactory&&forwardFactory!==fn)fail('target-forward-ref-factory-changed');forwardFactory=fn;},
  dispatch(value){const item=N.apply(N.mapGet,byValue,[value]);if(!item)return;check(targetKey(item.plan),value);item.dispatches++;},
  report(){for(const plan of plans){const item=created.get(targetKey(plan));if(!item)fail('target-initializer-unobserved');check(targetKey(plan),item.value);if(!item.dispatches)fail('target-render-dispatch-unobserved');if(!item.invocations.length)fail('target-render-invocation-unobserved');for(const invocation of item.invocations){boundaries.checkInput(invocation.before);boundaries.checkOutput(invocation.returned);}}
   return {qualification:'forward-ref-initializer-and-render-boundaries-only',effectsVerified:false,acceptedContract:null,targets:plans.map(plan=>({target:targetKey(plan),render:{...plan.render},naming:!!plan.naming,dispatches:created.get(targetKey(plan)).dispatches,invocations:created.get(targetKey(plan)).invocations.map(i=>({input:boundaries.describeInput(i.before),output:boundaries.describeOutput(i.returned)}))}))};}
 };
})`;
