import {reactTargetCallbackRuntime} from './react-target-callback-runtime.js';

/** Private same-invocation value checks. These do not prove callback bodies,
 * helper effects, provider/context/state behavior or native fidelity. */
export const reactTargetProjectionRuntime=String.raw`((models,N,intrinsics,sameDescriptor,fail,knownLiteral,props,elements,callbackPlans,callbackValues,checkInitializer)=>{
 const point=p=>JSON.stringify([p.file,p.sha256,p.start,p.end]);
 const objectPrototype=Object.prototype,arrayPrototype=Array.prototype,functionPrototype=Function.prototype;
 const bindings=new Map(),callbacks=new N.WeakMapCtor(),results=new N.WeakMapCtor(),rests=new N.WeakMapCtor(),stack=[],events=[];
 const modeled=models.filter(m=>m.status==='modeled');
 const providerInputs=new N.WeakMapCtor();
 const deferred=(${reactTargetCallbackRuntime})(callbackPlans,N,intrinsics,sameDescriptor,fail,knownLiteral,{
  checkInitializer,matchRoot:(value,shape,frame)=>match(value,shape,frame),
  callback:value=>N.apply(N.mapGet,callbacks,[value]),element:value=>N.apply(N.mapGet,elements,[value]),
  provider(fn,input,plans){
   const binding=[...bindings].find(([key,b])=>b.value===fn&&plans.some(p=>point(p.provider)===key));if(!binding)return null;
   const owner=N.apply(N.mapGet,providerInputs,[input]);if(!owner||owner.key!==binding[0])fail('target-callback-provider-input-unproved');return owner;
  },
  checkProvider(owner){bindingCheck(bindings.get(owner.key));stable(owner.value,owner.origin.descriptors,objectPrototype,'target-callback-provider-props-mutated');
   stable(owner.frame.input,owner.frame.before,objectPrototype,'target-callback-owner-input-mutated');
   if(!match(owner.frame.output,owner.frame.model.output,owner.frame))fail('target-callback-owner-return-changed');},
  checkCallback(record){const shape=callbackShapes(record.frame.model.output).find(s=>point(s.source)===record.key);if(!shape||!match(record.value,shape,record.frame))fail('target-callback-captures-changed');},
  checkElement(value,origin){stable(value,origin.descriptors,objectPrototype,'target-callback-element-changed');stable(origin.props,origin.origin.descriptors,objectPrototype,'target-callback-element-props-changed');}
 },callbackValues);
 function stable(value,before,prototype,reason){
  if(N.prototype(value)!==prototype)fail(reason);const ds=N.descriptors(value),ks=N.keys(ds),old=N.keys(before);
  if(ks.length!==old.length)fail(reason);for(let i=0;i<ks.length;i++)if(ks[i]!==old[i]||!sameDescriptor(ds[ks[i]],before[ks[i]]))fail(reason);
 }
 function bindingCheck(record){
  if(N.apply(record.read,undefined,[])!==record.value)fail('target-projection-binding-changed');
  stable(record.value,record.descriptors,functionPrototype,'target-projection-binding-metadata-changed');
 }
 function callbackShapes(shape,out=[]){
  if(shape.kind==='callback'){out.push(shape);for(const c of shape.captures)callbackShapes(c.value,out);}
  else if(shape.kind==='record')for(const [,value] of shape.fields)callbackShapes(value,out);
  else if(shape.kind==='array')for(const value of shape.items)callbackShapes(value,out);
  else if(shape.kind==='jsx')callbackShapes(shape.props,out);
  return out;
 }
 function captures(record){
  stable(record.value,record.descriptors,functionPrototype,'target-projection-callback-changed');
  const values=N.apply(record.read,undefined,[]);intrinsics();
  if(record.values){if(values.length!==record.values.length||values.some((v,i)=>!N.is(v,record.values[i])))fail('target-projection-capture-binding-changed');}
  else record.values=values;
  return values;
 }
 function recordMatch(value,shape,frame,reactProps=false,keyWarning=false){
  if(!reactProps&&value!==frame.input&&!knownLiteral(value)&&N.apply(N.mapGet,rests,[value])!==frame)return false;
  const array=shape.kind==='array';if(N.prototype(value)!==(array?arrayPrototype:objectPrototype))return false;
  const ds=N.descriptors(value),all=N.keys(ds),fields=array?shape.items.map((v,i)=>[String(i),v]):shape.fields;
  const warning=reactProps&&keyWarning&&ds.key&&!N.descriptor(ds.key,'value')&&!ds.key.enumerable;
  const keys=warning?all.filter(k=>k!=='key'):all;
  if(!fields||keys.length!==fields.length+(array?1:0))return false;
  for(let i=0;i<fields.length;i++){
   const [key,child]=fields[i],d=ds[key];if(keys[i]!==key||!d||!N.descriptor(d,'value')||!d.enumerable||!match(d.value,child,frame))return false;
  }
  return !array||keys[keys.length-1]==='length'&&ds.length.value===shape.items.length;
 }
 function match(value,shape,frame){
  if(shape.kind==='literal')return typeof value===shape.type&&N.is(value,shape.type==='undefined'?undefined:shape.value);
  if(shape.kind==='opaque')return N.is(value,frame.before.children?.value);
  if(shape.kind==='input'){const d=frame.before[shape.key];return !!d&&N.is(value,d.value);}
  if(shape.kind==='parameter')return shape.index===1&&N.is(value,frame.ref);
  if(shape.kind==='callback'){
   const record=N.apply(N.mapGet,callbacks,[value]);if(!record||record.frame!==frame||record.key!==point(shape.source))return false;
   const values=captures(record);if(values.length!==shape.captures.length)return false;
   for(let i=0;i<values.length;i++)if(!match(values[i],shape.captures[i].value,frame))return false;
   frame.matchedCallbacks.add(record);return true;
  }
  if(shape.kind==='jsx'){
   const origin=N.apply(N.mapGet,elements,[value]),created=N.apply(N.mapGet,results,[value]);
   if(!origin||!created||created.frame!==frame||created.key!==point(shape.source))return false;
   stable(value,origin.descriptors,objectPrototype,'target-projection-element-changed');
   stable(origin.props,origin.origin.descriptors,objectPrototype,'target-projection-props-changed');
   const ds=N.descriptors(value);if(ds.key?.value!==shape.key)return false;
   let expected;
   if(shape.tag.kind==='host')expected=shape.tag.name;
   else if(shape.tag.kind==='fragment')expected=Symbol.for('react.fragment');
   else{const binding=bindings.get(point(shape.tag.source));if(!binding)return false;bindingCheck(binding);expected=binding.value;}
   return N.is(ds.type?.value,expected)&&recordMatch(origin.props,shape.props,frame,true,shape.key!==null);
  }
  return recordMatch(value,shape,frame);
 }
 function begin(key,input,ref){
  intrinsics();
  const candidates=modeled.filter(m=>point(m.render)===key);if(!candidates.length)return null;
  const origin=N.apply(N.mapGet,props,[input]);if(!origin)fail('target-projection-input-unregistered');
  const frame={input,ref,before:N.descriptors(input),matchedCallbacks:new Set(),key};
  const selected=candidates.filter(m=>recordMatch(input,m.input,frame,true,!!origin.keyWarning));
  if(selected.length!==1)fail('target-projection-input-context-unmodeled');frame.model=selected[0];stack.push(frame);return frame;
 }
 function finish(frame,output){
  if(!frame)return;intrinsics();if(stack[stack.length-1]!==frame)fail('target-projection-frame-mismatch');
  if(!match(output,frame.model.output,frame))fail('target-projection-return-mismatch');
  frame.output=output;linkProviders(output,frame.model.output,frame);events.push(frame);
 }
 function linkProviders(value,shape,frame){
  if(shape.kind==='jsx'){
   const origin=N.apply(N.mapGet,elements,[value]);
   if(shape.tag.kind==='source-binding')N.apply(N.mapSet,providerInputs,[origin.props,{key:point(shape.tag.source),frame,value:origin.props,origin:origin.origin}]);
   linkProviders(origin.props,shape.props,frame);
  }else if(shape.kind==='record')for(const [k,s] of shape.fields)linkProviders(N.descriptor(value,k).value,s,frame);
  else if(shape.kind==='array')for(let i=0;i<shape.items.length;i++)linkProviders(N.descriptor(value,String(i)).value,shape.items[i],frame);
 }
 function end(frame){if(!frame)return;intrinsics();if(stack[stack.length-1]!==frame)fail('target-projection-frame-mismatch');stack.pop();}
 function callback(key,value,read){
  intrinsics();const frame=stack[stack.length-1];
  if(!frame||typeof value!=='function'||typeof read!=='function'||!callbackShapes(frame.model.output).some(s=>point(s.source)===key))fail('target-projection-callback-unplanned');
  if(N.apply(N.mapGet,callbacks,[value]))fail('target-projection-callback-reused');
  N.apply(N.mapSet,callbacks,[value,{frame,key,value,read,descriptors:N.descriptors(value)}]);return value;
 }
 function rest(key,value){
  intrinsics();const frame=stack[stack.length-1];
  if(!frame||!callbackShapes(frame.model.output).some(s=>s.captures.some(c=>point(c.binding)===key)))fail('target-projection-rest-unplanned');
  // The compiler emits this only for a const object-rest BindingElement. Its
  // allocation is language-owned; no shape-based caller/proxy admission occurs.
  N.apply(N.mapSet,rests,[value,frame]);return value;
 }
 function result(key,value){
  intrinsics();const frame=stack[stack.length-1];
  if(!frame||!frame.model.targetFactories.some(f=>point(f.source)===key)||!N.apply(N.mapGet,elements,[value]))fail('target-projection-factory-unplanned');
  N.apply(N.mapSet,results,[value,{key,frame}]);return value;
 }
 function binding(key,value,read){
  intrinsics();if(bindings.has(key)||typeof value!=='function'||typeof read!=='function'||!modeled.some(m=>m.jsxTargets.some(t=>point(t.binding)===key)))fail('target-projection-binding-unplanned');
  const record={value,read,descriptors:N.descriptors(value)};bindingCheck(record);bindings.set(key,record);
 }
 function report(){
  intrinsics();if(stack.length)fail('target-projection-invocation-open');
  for(const model of modeled)if(!events.some(e=>e.model===model))fail('target-projection-model-unobserved');
  for(const frame of events)if(!match(frame.output,frame.model.output,frame))fail('target-projection-retained-return-changed');
  return {qualification:'target-return-and-callback-values-only',effectsVerified:false,acceptedContract:null,models:modeled.length,
   invocations:events.map(frame=>({render:{...frame.model.render},callbacks:frame.matchedCallbacks.size,captures:[...frame.matchedCallbacks].reduce((n,c)=>n+c.values.length,0)}))};
 }
 return {begin,finish,end,callback,rest,result,binding,report,deferred};
})`;
