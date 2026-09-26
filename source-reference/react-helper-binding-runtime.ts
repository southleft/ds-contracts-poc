/** Private observer bootstrap, evaluated in the same fresh realm as the native
 * guard and compiler-literal registry. No source/native admission is implied.
 * Models and callbacks are host/compiler inputs, never application props. */
export const reactHelperBindingGuard = String.raw`((models, assertNative, knownLiteral, recordFailure) => {
  const keys=Reflect.ownKeys, descriptors=Object.getOwnPropertyDescriptors;
  const descriptor=Object.getOwnPropertyDescriptor, prototype=Object.getPrototypeOf;
  const apply=Reflect.apply, same=Object.is, ErrorConstructor=Error;
  const objectPrototype=Object.prototype,arrayPrototype=Array.prototype,functionPrototype=Function.prototype;
  const functions=new WeakMap(),functionKeys=new Map(),bindings=new Map();let active=null,checkedCalls=0,activeTrace=null,traceCursor=0;
  const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
  const fail=reason=>{const message='helper-binding-'+reason;if(recordFailure)recordFailure(message);throw new ErrorConstructor(message);};
  const descriptorFields=['value','get','set','writable','enumerable','configurable'];
  function sameDescriptor(a,b){
    if(!a||!b)return false;
    for(let i=0;i<descriptorFields.length;i++){
      const left=descriptor(a,descriptorFields[i]),right=descriptor(b,descriptorFields[i]);
      if(!!left!==!!right||left&&!same(left.value,right.value))return false;
    }
    return true;
  }
  const nativeValues=new Map();
  for(let i=0;i<models.length;i++)for(let j=0;j<models[i].intrinsics.length;j++){
    const name=models[i].intrinsics[j],parts=name.split('.');let value=globalThis;
    for(let k=0;k<parts.length;k++){
      const d=descriptor(value,parts[k]);if(!d||!descriptor(d,'value'))fail('native-unavailable');value=d.value;
    }
    nativeValues.set(name,value);
  }
  function matcher(plan){
    const matched=new Map(),reverse=new WeakMap();
    function match(value,shape){
      if(shape.kind==='literal'){
        if(typeof value!==shape.type||!same(value,shape.type==='undefined'?undefined:shape.value))fail('value-changed');return;
      }
      if(shape.kind==='native'){
        if(!nativeValues.has(shape.name)||value!==nativeValues.get(shape.name))fail('native-changed');return;
      }
      const node=plan.nodes[shape.id];if(!node||node.id!==shape.id)fail('model-invalid');
      if(matched.has(node.id)){if(matched.get(node.id)!==value)fail('alias-changed');return;}
      let origin;
      if(node.kind==='function'){
        origin=functions.get(value);if(!origin||origin.key!==point(node.source))fail('function-unregistered-or-changed');
      }else if(!knownLiteral(value))fail('data-provenance-unproved');
      if(reverse.has(value)&&reverse.get(value)!==node.id)fail('alias-merged');
      matched.set(node.id,value);reverse.set(value,node.id);
      const p=node.kind==='function'?functionPrototype:node.kind==='array'?arrayPrototype:objectPrototype;
      if(prototype(value)!==p)fail('prototype-changed');
      const ds=descriptors(value),ks=keys(ds),expectedKeys=node.fields.map(f=>f[0]);
      if(origin){
        const baseKeys=keys(origin.descriptors);
        for(let i=0;i<baseKeys.length;i++){
          const key=baseKeys[i];if(expectedKeys.includes(key))fail('automatic-function-property-unmodeled');
          if(!sameDescriptor(origin.descriptors[key],ds[key]))fail('function-property-changed');
        }
        if(ks.length!==baseKeys.length+expectedKeys.length)fail('function-fields-changed');
      }else{
        if(ks.length!==expectedKeys.length+(node.kind==='array'?1:0))fail('fields-changed');
        for(let i=0;i<expectedKeys.length;i++)if(ks[i]!==expectedKeys[i])fail('field-order-changed');
      }
      for(let i=0;i<node.fields.length;i++){
        const [key,child]=node.fields[i],d=ds[key];
        if(!d||!descriptor(d,'value')||!d.enumerable||!d.writable||!d.configurable)fail('descriptor-changed');
        match(d.value,child);
      }
      if(node.kind==='array'){
        const d=ds.length;
        if(!d||d.value!==node.length||!d.writable||d.enumerable||d.configurable||ks[ks.length-1]!=='length')fail('array-length-changed');
      }
    }
    return match;
  }
  function sourceFunction(key,fn){
    assertNative();if(typeof fn!=='function'||functions.has(fn))fail('function-registration-invalid');
    if(!models.some(m=>m.definitions.some(p=>point(p)===key)))fail('function-outside-model');
    functions.set(fn,{key,descriptors:descriptors(fn)});functionKeys.set(key,functionKeys.has(key)?null:fn);return fn;
  }
  function binding(key,get){
    assertNative();if(bindings.has(key)||typeof get!=='function')fail('registration-ambiguous');
    if(!models.some(m=>m.runtimeBindings.bindings.some(b=>point(b.binding)===key)))fail('registration-outside-model');
    bindings.set(key,get);
  }
  function reactDisplayName(fn,name,invoke){
    assertNative();const origin=functions.get(fn);if(!origin)return invoke();
    if(typeof name!=='string')fail('react-display-name-unmodeled');
    const before=descriptors(fn),ks=keys(before),original=keys(origin.descriptors);
    if(ks.length!==original.length||ks.some((key,i)=>key!==original[i]||!sameDescriptor(before[key],origin.descriptors[key])))fail('function-before-react-metadata-changed');
    const rename=before.name?.value===''&&!before.displayName;
    const result=invoke();assertNative();const after=descriptors(fn),afterKeys=keys(after);
    if(afterKeys.length!==ks.length+(rename?1:0))fail('react-metadata-fields-changed');
    for(let i=0;i<ks.length;i++){
      const key=ks[i];if(afterKeys[i]!==key)fail('react-metadata-order-changed');
      const expected=rename&&key==='name'?{...before[key],value:name}:before[key];
      if(!sameDescriptor(expected,after[key]))fail('react-metadata-descriptor-changed');
    }
    if(rename&&(afterKeys[afterKeys.length-1]!=='displayName'||!sameDescriptor(after.displayName,{value:name,writable:true,enumerable:true,configurable:true})))fail('react-display-name-changed');
    origin.descriptors=after;return result;
  }
  function check(index){
    assertNative();const plan=models[index]?.runtimeBindings;if(!plan)fail('model-missing');
    const match=matcher(plan);
    for(let i=0;i<plan.bindings.length;i++){
      const b=plan.bindings[i],get=bindings.get(point(b.binding));if(!get)fail('registration-missing');
      // This getter is an injected lexical binding read, not a caller callback.
      // Default imports also require the pinned bundler and executable module
      // edge: declaration-file identity alone is insufficient.
      match(get(),b.value);
    }
  }
  function sourceCall(site,fn,invoke){
    assertNative();const registered=functions.get(fn);if(!registered)fail('call-function-unregistered');
    const candidates=active===null?models:[models[active]];let found=false;
    for(let i=0;i<candidates.length&&!found;i++){
      const m=candidates[i];
      if(!m.calls.some(c=>c.site&&point(c.site)===site&&point(c.source)===registered.key))continue;
      const plan=m.runtimeBindings;
      for(let j=0;j<plan.functions.length;j++){
        const id=plan.functions[j],node=plan.nodes[id];
        if(point(node.source)===registered.key){matcher(plan)(fn,{kind:'reference',id});found=true;break;}
      }
    }
    if(!found)fail('call-target-changed');
    if(activeTrace){
      // The original callee is captured before arguments, but its body runs
      // after argument expressions (which may call other modeled helpers).
      // This compiler-private callback preserves that evaluation order.
      return invoke((...args)=>{
        const expected=activeTrace[traceCursor++];
        if(!expected||point(expected.site)!==site||point(expected.source)!==registered.key)fail('call-trace-changed');
        check(active);checkedCalls++;const result=apply(fn,undefined,args);check(active);return result;
      });
    }
    checkedCalls++;return invoke(fn);
  }
  return {
    sourceFunction,binding,sourceCall,check,reactDisplayName,
    component(index,key,invoke,trace=false){
      if(active!==null)fail('reentrant-component');
      const model=models[index],fn=functionKeys.get(key);
      if(!model?.component||point(model.component)!==key||!fn)fail('component-unregistered-or-ambiguous');
      const id=model.runtimeBindings.functions.find(id=>point(model.runtimeBindings.nodes[id].source)===key);
      if(id===undefined)fail('component-function-missing');
      check(index);matcher(model.runtimeBindings)(fn,{kind:'reference',id});active=index;
      if(trace){activeTrace=model.calls.filter(c=>c.site&&c.phase!=='module-initialization');traceCursor=0;}
      try{const result=invoke();check(index);if(activeTrace&&traceCursor!==activeTrace.length)fail('call-trace-incomplete');return result;}
      finally{active=null;activeTrace=null;traceCursor=0;}
    },
    within(index,fn,args){if(active===null||!models[active].component)fail('component-invocation-missing');check(index);const result=apply(fn,undefined,args);check(index);return result;},
    run(index,fn,args){if(active!==null)fail('reentrant-helper');check(index);active=index;try{const result=apply(fn,undefined,args);check(index);return result;}finally{active=null;}},
    report(){assertNative();return {registeredBindings:bindings.size,checkedCalls};}
  };
})`;
