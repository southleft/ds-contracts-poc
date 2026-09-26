import type {ReactContextValueWitness as Witness} from './react-context-runtime.js';

export type ReactRenderGraphHost =
  | {status:'matched';factory:number;element:Witness;props:Witness;type:Witness}
  | {status:'refused';reason:string};
export type ReactRenderChildren = {status:'verified';value:Witness}|{status:'refused';reason:string};
export type ReactRenderMembership = {status:'verified';factories:number[];arrays:number[]}|{status:'refused';reason:string};
export interface ReactRenderGraphReport {
  qualification:'original-element-and-render-identity-only';effectsVerified:false;acceptedContract:null;
  factories:Array<{id:number;element:Witness;props:Witness;type:Witness;createdIn:number|null;current:boolean;children:ReactRenderChildren}>;
  arrays:Array<{id:number;value:Witness;items:Witness[];currentValuesVerified:boolean}>;
  renders:Array<{id:number;parent:number|null;callee:Witness;input:Witness;factoryProps:Witness|null;factory:number|null;
    completion:'returned'|'threw';output?:Witness;returnedFactory:number|null;
    sourceRender:number|null;componentModels:number[];membership:ReactRenderMembership}>;
}

/** Join only private factory identities and actual pinned renderer calls. An
 * observed call is not a body proof. Unknown objects are never reflected. */
export const reactRenderGraphRuntime=String.raw`((N,intrinsics,fail,witness,bridge)=>{
 const factories=[],renders=[],stack=[],arrays=[],byArray=new N.WeakMapCtor(),byProps=new N.WeakMapCtor(),byElement=new N.WeakMapCtor();
 const arrayPrototype=Array.prototype;let literalCount=0;
 const get=(map,value)=>N.apply(N.mapGet,map,[value]);
 function arrayState(value){
  if(N.prototype(value)!==arrayPrototype)return;
  const ds=N.descriptors(value),keys=N.keys(ds),length=ds.length;
  if(!length||!N.descriptor(length,'value')||!N.integer(length.value)||length.value<0||length.value>10000||keys.length!==length.value+1||keys.at(-1)!=='length'||length.enumerable||length.configurable)return;
  for(let i=0;i<length.value;i++){const d=ds[i];if(keys[i]!==N.string(i)||!d||!N.descriptor(d,'value')||!d.enumerable)return;}
  return {ds,keys};
 }
 function literal(value){
  // Called only for the original allocation of a compiler-marked literal.
  intrinsics();if(!N.array(value))return value;
  if(++literalCount>100000)fail('render-graph-array-limit');
  const state=arrayState(value);
  if(state&&N.extensible(value)&&state.keys.every(k=>state.ds[k].writable&&state.ds[k].configurable===(k!=='length'))){
   // Report only arrays reached by an actual renderer return. Binding checks
   // can allocate unrelated literals while reading evidence; those allocations
   // must not change the observed return graph or its report-local IDs.
   const record={id:null,value,state};N.apply(N.mapSet,byArray,[value,record]);
  }return value;
 }
 function arrayCurrent(record){
  const now=arrayState(record.value),before=record.state;
  // Value evidence survives freeze/seal; no mutation/effect semantics are inferred.
  return !!now&&now.keys.length===before.keys.length&&now.keys.every((k,i)=>k===before.keys[i]&&N.is(now.ds[k].value,before.ds[k].value));
 }
 function factory(value,origin){
  const old=get(byElement,value);if(old){if(old.origin.props!==origin.props)fail('render-graph-factory-props-changed');return;}
  if(factories.length>=100000)fail('render-graph-factory-limit');
  const record={id:factories.length,value,origin,createdIn:stack.at(-1)?.id??null};factories.push(record);
  const prior=get(byProps,origin.props)??[];N.apply(N.mapSet,byProps,[origin.props,[...prior,record]]);N.apply(N.mapSet,byElement,[value,record]);
 }
 function native(value,props,type){
  // value is allocated inside the exact pinned ReactElement function. props is
  // intentionally opaque: automatic JSX may reuse a caller-supplied config.
  intrinsics();const descriptors=N.descriptors(value);
  if(!N.is(descriptors.props?.value,props)||!N.is(descriptors.type?.value,type))fail('render-graph-native-element-mismatch');
  factory(value,{props,descriptors});return value;
 }
 function inputFactory(props){const candidates=props&&get(byProps,props);return candidates?.length===1?candidates[0].id:null;}
 function source(render){const frame=stack.at(-1);if(frame){if(frame.sourceRender!==null)fail('render-graph-source-repeated');frame.sourceRender=render;}}
 function component(index,input,output){const frame=stack.at(-1);if(frame&&N.is(frame.input,input))frame.componentModels.push({index,output});}
 function invoke(fn,input,call){
  intrinsics();if(renders.length>=100000||stack.length>=256)fail('render-graph-call-limit');
  const factoryProps=bridge.factoryProps(input),parent=stack.at(-1);
  const frame={id:renders.length,parent:parent?.id??null,fn,input,factoryProps,factory:inputFactory(factoryProps),returned:false,sourceRender:null,componentModels:[]};
  renders.push(frame);stack.push(frame);
  try{const output=call();frame.output=output;frame.returned=true;frame.membership=membership(output);return output;}
  finally{if(stack.at(-1)!==frame)fail('render-graph-stack');stack.pop();}
 }
 function current(record){return bridge.current(record.value,record.origin);}
 function membership(output){
  try{
   intrinsics();
   const root=get(byElement,output);if(!root)throw Error('return-unproved');
   const active=new Set(),visitedFactories=[],visitedArrays=[];let steps=0;
   function walk(value,depth){
    if(++steps>100000||depth>32)throw Error('traversal-limit');
    if(value===null||['undefined','string','number','boolean','bigint'].includes(typeof value))return;
    if(typeof value!=='object')throw Error('child-unproved');
    if(active.has(value))throw Error('cycle');active.add(value);
    try{
     const array=get(byArray,value);
     if(array){
      if(!arrayCurrent(array))throw Error('array-changed');
      if(array.id===null){array.id=arrays.length;arrays.push(array);}visitedArrays.push(array.id);
      for(let i=0;i<array.state.ds.length.value;i++)walk(array.state.ds[i].value,depth+1);return;
     }
     const element=get(byElement,value);if(!element||!current(element))throw Error('element-unproved');
     const child=bridge.children(value);if(child.status!=='verified')throw Error(child.reason);
     visitedFactories.push(element.id);walk(child.value,depth+1);
    }finally{active.delete(value);}
   }
   walk(output,0);return {status:'verified',factories:visitedFactories,arrays:visitedArrays};
  }catch(error){return {status:'refused',reason:error instanceof Error?error.message:'unproved'};}
 }
 function host(props,type,owner,alternate){
  intrinsics();const candidates=get(byProps,props),record=candidates?.length===1?candidates[0]:undefined;
  if(!record)return {status:'refused',reason:'render-graph-host-factory-unavailable'};
  const ds=record.origin.descriptors,creator=ds._owner?.value;
  if(typeof type!=='string'||!N.is(ds.type?.value,type)||!creator||(!N.is(creator,owner)&&!N.is(creator,alternate))||!current(record))
   return {status:'refused',reason:'render-graph-host-identity-mismatch'};
  return {status:'matched',factory:record.id,element:witness(record.value),props:witness(props),type:witness(type)};
 }
 function report(){
  intrinsics();if(stack.length)fail('render-graph-open-call');
  return {qualification:'original-element-and-render-identity-only',effectsVerified:false,acceptedContract:null,
   factories:factories.map(r=>{const child=bridge.children(r.value);return {id:r.id,element:witness(r.value),props:witness(r.origin.props),type:witness(r.origin.descriptors.type.value),createdIn:r.createdIn,current:current(r),children:child.status==='verified'?{status:'verified',value:witness(child.value)}:child};}),
   arrays:arrays.map(r=>({id:r.id,value:witness(r.value),items:Array.from({length:r.state.ds.length.value},(_,i)=>witness(r.state.ds[i].value)),currentValuesVerified:arrayCurrent(r)})),
   renders:renders.map(r=>({id:r.id,parent:r.parent,callee:witness(r.fn),input:witness(r.input),factoryProps:r.factoryProps?witness(r.factoryProps):null,factory:r.factory,completion:r.returned?'returned':'threw',...(r.returned?{output:witness(r.output)}:{}),returnedFactory:r.returned?get(byElement,r.output)?.id??null:null,sourceRender:r.sourceRender,componentModels:r.componentModels.filter(m=>r.returned&&N.is(m.output,r.output)).map(m=>m.index),membership:r.membership??{status:'refused',reason:'threw'}}))};
 }
 return {factory,native,literal,source,component,invoke,host,report};
})`;
