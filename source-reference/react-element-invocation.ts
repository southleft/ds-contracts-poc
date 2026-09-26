import ts from 'typescript';
import type {ReactElementCreationSite} from './react-element-creation.js';
import {readReactElementClosures,type ReactElementBindingRead,type ReactElementEffectSite} from './react-element-closure.js';
import {readReactElementOperations,reactElementEffectRuntime,type ReactElementOperation,type ReactElementEffect,type ReactElementGlobalRead} from './react-element-effects.js';
import type {ReactElementProvenance} from './react-element-provenance.js';
import {reactElementCallbackProperty,reactElementSourceCallRuntime,type ReactElementSourceCall,type ReactElementSourceCalls,type ReactElementSourcePoint} from './react-element-source-call.js';
import type {ReactOriginalJsxSite,ReactJsxMarker} from './react-jsx-invocation.js';

export interface ReactElementInvocationPlan {
  module:string;
  sourceSha256:string;
  span:{start:number;end:number};
  observation?:'original-function-invocation-only';
  parameters:Array<{name:string;start:number;end:number}>;
  /** Keep destructuring in the original parameter list. Recover raw arguments
   * from a pinned React call or an observed call of the exact source callback. */
  argumentSource?:'react-call'|'source-call';
  identityName?:string;
  identityProperty?:{key:string;objectSpan:{start:number;end:number}};
  bindingReads?:ReactElementBindingRead[];
  /** Syntactic candidates in all branches, including calls and writes. */
  effectSites?:ReactElementEffectSite[];
  operations?:ReactElementOperation[];
}
export type ReactElementObservedValue={kind:string;value?:string|number|boolean|null;representation?:'negative-zero'|'nan'|'positive-infinity'|'negative-infinity'};
export type ReactElementInvocation = {
  version:1;
  acceptedContract:null;
  effectsVerified:false;
  function:ReactElementInvocationPlan;
} & ({status:'observed';invocation:number;input:Array<[string,ReactElementObservedValue]>;
  reactCall?:number;
  sourceCall?:ReactElementSourceCall;
  childrenIdentity:'same-value'|'both-absent'|'changed';secondaryKinds:string[];
  closureReads:Array<{read:number;value:ReactElementObservedValue}>;
  globalReads:ReactElementGlobalRead[];effects:ReactElementEffect[];
  inputProvenance:ReactElementProvenance;outputProvenance:ReactElementProvenance}
  |{status:'refused';reason:string});

/** Do not replace a function value: preserve its inferred name, identity, length,
 * lexical this and closure. Only bounded synchronous bodies can be bracketed.
 * Named destructured functions use a pinned React call; anonymous property
 * callbacks use a registered source call. Neither rewrites parameters. Unknown,
 * default, top-level rest and generator inputs remain location-only. */
export function readReactElementInvocationPlans(sf:ts.SourceFile,sites:readonly ReactElementCreationSite[]):ReactElementInvocationPlan[]{
  const points=new Map(sites.filter(s=>s.functionSpan).map(s=>[JSON.stringify(s.functionSpan),s]));
  const plans:ReactElementInvocationPlan[]=[];
  const closures=readReactElementClosures(sf);
  const scan=(node:ts.Node)=>{
    const site=points.get(JSON.stringify({start:node.getStart(sf),end:node.end}));
    if(site&&(ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node))&&node.body&&
      !node.asteriskToken&&!node.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)&&node.parameters.length>0&&node.parameters.length<=8&&
      node.parameters.every(p=>!p.initializer&&!p.dotDotDotToken)){
      const direct=node.parameters.every(p=>ts.isIdentifier(p.name));
      const flat=!direct&&ts.isObjectBindingPattern(node.parameters[0].name)&&
        node.parameters[0].name.elements.every(e=>ts.isIdentifier(e.name)&&!e.initializer&&
          (!e.propertyName||ts.isIdentifier(e.propertyName)||ts.isStringLiteral(e.propertyName)||ts.isNumericLiteral(e.propertyName)));
      const fromReact=flat&&(ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node))&&node.name&&node.parameters.length<=2&&
        node.parameters.slice(1).every(p=>ts.isIdentifier(p.name));
      const property=flat&&node.parameters.length===1?reactElementCallbackProperty(node,sf):undefined;
      if(!direct&&!fromReact&&!property){ts.forEachChild(node,scan);return;}
      let unmodeled=false;
      const check=(n:ts.Node)=>{
        // A nested function declaration can change hoisting in a new try block.
        // Direct eval and arguments can expose instrumentation or aliases.
        if(ts.isFunctionDeclaration(n)||ts.isWithStatement(n)||ts.isIdentifier(n)&&['eval','arguments'].includes(n.text))unmodeled=true;
        ts.forEachChild(n,check);
      };check(node.body);
      if(fromReact){
        const identity=node.name!.text;
        const shadow=(n:ts.Node)=>{
          if(ts.isIdentifier(n)&&n.text===identity&&
            (ts.isVariableDeclaration(n.parent)||ts.isBindingElement(n.parent)||ts.isParameter(n.parent)||ts.isClassDeclaration(n.parent)||ts.isClassExpression(n.parent))&&n.parent.name===n)unmodeled=true;
          ts.forEachChild(n,shadow);
        };
        node.parameters.forEach(shadow);shadow(node.body);
      }
      if(!unmodeled){
        const {reads,effects}=closures(node);
        if(reads.length>10000||effects.length>10000)throw Error('element-closure-site-limit');
        plans.push({module:site.module,sourceSha256:site.sourceSha256,span:site.functionSpan!,parameters:node.parameters.map(p=>({name:ts.isIdentifier(p.name)?p.name.text:p.name.getText(sf),start:p.getStart(sf),end:p.end})),
          ...(fromReact?{argumentSource:'react-call' as const,identityName:node.name!.text}:property?{argumentSource:'source-call' as const,identityProperty:property}:{}),bindingReads:reads,effectSites:effects,operations:readReactElementOperations(node,sf,reads)});
      }
    }
    ts.forEachChild(node,scan);
  };scan(sf);return plans;
}

/** Apply alongside factory-call observation, using original AST positions. */
export function transformReactElementSource(sf:ts.SourceFile,sites:readonly (ReactElementCreationSite&{index:number;receiver?:string})[],plans:readonly (ReactElementInvocationPlan&{index:number})[],sources:{objects:Array<ReactElementSourcePoint&{index:number}>;calls:Array<ReactElementSourceCalls['calls'][number]&{index:number}>;arrays?:Array<ReactElementSourcePoint&{index:number}>}={objects:[],calls:[]},jsx:{sites?:readonly ReactOriginalJsxSite[];markers?:readonly ReactJsxMarker[]}={}):string{
  const f=ts.factory,api=(name:string,args:ts.Expression[])=>f.createCallExpression(f.createPropertyAccessExpression(f.createPropertyAccessExpression(f.createIdentifier('globalThis'),'__DSC_ELEMENT_CREATION'),name),undefined,args);
  const frame=f.createIdentifier('__DSC_INVOCATION');
  const binding=(active:typeof plans[number],read:number,value:ts.Expression)=>{
    const site=active.bindingReads![read];
    return !site.declaration&&['window','globalThis','Symbol'].includes(site.name)
      ?api('globalRead',[frame,f.createNumericLiteral(read),f.createStringLiteral(site.name),f.createArrowFunction(undefined,undefined,[],undefined,f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),value)])
      :api('binding',[frame,f.createNumericLiteral(read),value]);
  };
  const result=ts.transform(sf,[context=>{
    const visit=(node:ts.Node,active:typeof plans[number]|undefined):ts.VisitResult<ts.Node>=>{
      const functionNode=ts.isFunctionDeclaration(node)||ts.isFunctionExpression(node)||ts.isArrowFunction(node);
      const plan=functionNode?plans.find(p=>p.span.start===node.getStart(sf)&&p.span.end===node.end):undefined;
      const inside=ts.isFunctionLike(node)?plan:active;
      let updated=ts.visitEachChild(node,n=>visit(n,inside),context);
      // A shorthand key keeps its spelling while its value is observed. Do not
      // emit an arbitrary CallExpression in the name slot of a shorthand node.
      if(ts.isShorthandPropertyAssignment(node)&&ts.isShorthandPropertyAssignment(updated)&&active){
        const read=active.bindingReads?.findIndex(r=>r.span.start===node.name.getStart(sf)&&r.span.end===node.name.end)??-1;
        if(read>=0)updated=f.createPropertyAssignment(node.name,binding(active,read,node.name));
      }else if(active&&(ts.isIdentifier(node)||ts.isTypeOfExpression(node))&&!(ts.isIdentifier(node)&&ts.isShorthandPropertyAssignment(node.parent))){
        const read=active.bindingReads?.findIndex(r=>r.span.start===node.getStart(sf)&&r.span.end===node.end)??-1;
        if(read>=0)updated=binding(active,read,updated as ts.Expression);
      }
      const operation=active?.operations?.findIndex(op=>op.span.start===node.getStart(sf)&&op.span.end===node.end)??-1;
      if(operation>=0&&active){
        const op=active.operations![operation];
        const member=ts.isCallExpression(updated)?updated.expression:ts.isBinaryExpression(updated)?updated.left:undefined;
        if(member&&(ts.isPropertyAccessExpression(member)||ts.isElementAccessExpression(member))){
          const key=ts.isPropertyAccessExpression(member)?f.createStringLiteral(member.name.text):member.argumentExpression;
          const prepare=api(op.kind==='member-call'?'member':'write',[frame,f.createNumericLiteral(operation),member.expression,key]);
          if(op.kind==='member-call'&&ts.isCallExpression(updated))updated=f.createCallExpression(prepare,undefined,updated.arguments);
          if(op.kind==='write'&&ts.isBinaryExpression(updated))updated=f.createCallExpression(prepare,undefined,[updated.right]);
        }
      }
      if(ts.isArrayLiteralExpression(node)&&ts.isArrayLiteralExpression(updated)&&ts.isPropertyAssignment(node.parent)){
        const property=node.parent,object=property.parent,call=object.parent;
        const name=ts.isIdentifier(property.name)||ts.isStringLiteral(property.name)?property.name.text:undefined;
        // Automatic JSX creates this array after the original-source literal
        // pass. Register only the literal at an authenticated original JSX
        // factory's children property; never inspect an arbitrary array value.
        if(name==='children'&&ts.isObjectLiteralExpression(object)&&ts.isCallExpression(call)&&call.arguments[1]===object&&
          sites.some(site=>site.originalJsx&&site.span.start===call.getStart(sf)&&site.span.end===call.end))
          updated=api('literal',[updated]);
      }
      if(ts.isCallExpression(node)&&ts.isCallExpression(updated)){
        const site=sites.find(s=>s.span.start===node.getStart(sf)&&s.span.end===node.end);
        if(site){
          const args=[...updated.arguments];
          // This records only a freshly evaluated object expression. A variable,
          // proxy or merely similar descriptor shape cannot get this identity.
          let config=node.arguments[1];while(config&&ts.isParenthesizedExpression(config))config=config.expression;
          if(config&&ts.isObjectLiteralExpression(config))args[1]=api('literal',[args[1]]);
          updated=api('call',[f.createNumericLiteral(site.index),updated.expression,site.receiver?f.createIdentifier(site.receiver):f.createVoidZero(),f.createArrayLiteralExpression(args)]);
        }else{
          const call=sources.calls.find(s=>s.span.start===node.getStart(sf)&&s.span.end===node.end);
          if(call)updated=api('sourceCall',[f.createNumericLiteral(call.index),updated.expression,f.createArrayLiteralExpression(updated.arguments)]);
        }
      }
      if(ts.isObjectLiteralExpression(node)){
        const registrations=plans.filter(p=>p.identityProperty?.objectSpan.start===node.getStart(sf)&&p.identityProperty.objectSpan.end===node.end);
        if(registrations.length)updated=api('callbackObject',[f.createArrayLiteralExpression(registrations.map(p=>f.createNumericLiteral(p.index))),updated as ts.Expression]);
        const object=sources.objects.find(s=>s.span.start===node.getStart(sf)&&s.span.end===node.end);
        if(object)updated=api('sourceObject',[f.createNumericLiteral(object.index),updated as ts.Expression]);
      }
      if(ts.isArrayLiteralExpression(node)){
        const array=sources.arrays?.find(s=>s.span.start===node.getStart(sf)&&s.span.end===node.end);
        if(array)updated=api('sourceArray',[f.createNumericLiteral(array.index),updated as ts.Expression]);
      }
      if(ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node)||ts.isJsxFragment(node)){
        const index=jsx.sites?.findIndex(site=>site.span.start===node.getStart(sf)&&site.span.end===node.end)??-1;
        if(index>=0){
          const call=api('originalJsx',[f.createNumericLiteral(index),updated as ts.Expression]);
          const parent=node.parent;
          // A direct JSX child or attribute initializer needs an expression
          // container. Elsewhere the JSX already occupies an expression slot.
          updated=(ts.isJsxElement(parent)||ts.isJsxFragment(parent))&&parent.children.includes(node)||
            ts.isJsxAttribute(parent)&&parent.initializer===node?f.createJsxExpression(undefined,call):call;
        }
      }
      if(ts.isCallExpression(node)&&ts.isCallExpression(updated)){
        const marker=jsx.markers?.find(point=>point.span.start===node.getStart(sf)&&point.span.end===node.end);
        if(marker){
          const callee=node.expression,index=node.arguments[0];
          if(!ts.isPropertyAccessExpression(callee)||callee.name.text!=='originalJsx'||!index||!ts.isNumericLiteral(index)||Number(index.text)!==marker.index||updated.arguments.length!==2)throw Error('jsx-original-marker-changed');
          updated=updated.arguments[1];
        }
      }
      if(ts.isReturnStatement(updated)&&active)
        updated=f.updateReturnStatement(updated,api('returned',[frame,updated.expression??f.createVoidZero()]));
      if(plan&&(ts.isFunctionDeclaration(updated)||ts.isFunctionExpression(updated)||ts.isArrowFunction(updated))&&updated.body){
        const statements=ts.isBlock(updated.body)?[...updated.body.statements]:[f.createReturnStatement(api('returned',[frame,updated.body]))];
        let directives=0;while(directives<statements.length&&ts.isExpressionStatement(statements[directives])&&ts.isStringLiteral((statements[directives] as ts.ExpressionStatement).expression))directives++;
        const entry=plan.argumentSource==='react-call'
          ?api('enterReact',[f.createNumericLiteral(plan.index),f.createIdentifier(plan.identityName!)])
          :plan.argumentSource==='source-call'?api('enterSource',[f.createNumericLiteral(plan.index)])
          :api('enter',[f.createNumericLiteral(plan.index),f.createArrayLiteralExpression(plan.parameters.map(p=>f.createIdentifier(p.name)))]);
        const declaration=f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(frame,undefined,undefined,entry)],ts.NodeFlags.Const));
        const error=f.createIdentifier('__DSC_THROWN');
        const guarded=f.createTryStatement(f.createBlock(statements.slice(directives),true),f.createCatchClause(f.createVariableDeclaration(error),f.createBlock([f.createExpressionStatement(api('thrown',[frame])),f.createThrowStatement(error)],true)),f.createBlock([f.createExpressionStatement(api('leave',[frame]))],true));
        const body=f.createBlock([...statements.slice(0,directives),declaration,guarded],true);
        if(ts.isFunctionDeclaration(updated))updated=f.updateFunctionDeclaration(updated,updated.modifiers,updated.asteriskToken,updated.name,updated.typeParameters,updated.parameters,updated.type,body);
        else if(ts.isFunctionExpression(updated))updated=f.updateFunctionExpression(updated,updated.modifiers,updated.asteriskToken,updated.name,updated.typeParameters,updated.parameters,updated.type,body);
        else updated=f.updateArrowFunction(updated,updated.modifiers,updated.typeParameters,updated.parameters,updated.type,updated.equalsGreaterThanToken,body);
      }
      return updated;
    };return node=>ts.visitNode(node,n=>visit(n,undefined)) as ts.SourceFile;
  }]);
  try{return ts.createPrinter().printFile(result.transformed[0]);}finally{result.dispose();}
}

/** Private records only. A successful join proves an invocation observation,
 * not absence of deep child mutation, unmodeled effects or caller-slot safety. */
export const reactElementInvocationRuntime=`(plans,provenance,sources)=>{
 const N={keys:Reflect.ownKeys,descriptors:Object.getOwnPropertyDescriptors,descriptor:Object.getOwnPropertyDescriptor,prototype:Object.getPrototypeOf,is:Object.is,hasOwn:Object.prototype.hasOwnProperty,apply:Reflect.apply,finite:Number.isFinite,nan:Number.isNaN};
 const objectPrototype=Object.prototype,stack=[],reactStack=[];let serial=0,readCount=0,reactSerial=0;
 const has=(o,k)=>N.apply(N.hasOwn,o,[k]);
 const data=value=>{
  if(!value||typeof value!=='object'||N.prototype(value)!==objectPrototype)return null;
  const ds=N.descriptors(value);for(const k of N.keys(ds))if(typeof k!=='string'||!has(ds[k],'value'))return null;
  return ds;
 };
 const same=(input,ds)=>{
  if(!ds)return false;
  const current=data(input);if(!current)return false;
  const keys=N.keys(ds),now=N.keys(current);if(keys.length!==now.length)return false;
  for(let i=0;i<keys.length;i++){
   if(keys[i]!==now[i])return false;
   const a=ds[keys[i]],b=current[keys[i]];
   if(!N.is(a.value,b.value)||a.writable!==b.writable||a.enumerable!==b.enumerable||a.configurable!==b.configurable)return false;
  }return true;
 };
 const kind=value=>value===null?'null':typeof value;
 const shape=value=>{
  if(value===null)return {kind:'null',value:null};
  if(typeof value==='number')return N.is(value,-0)?{kind:'number',representation:'negative-zero'}:N.finite(value)?{kind:'number',value}:{kind:'number',representation:N.nan(value)?'nan':value>0?'positive-infinity':'negative-infinity'};
  return ['string','boolean'].includes(typeof value)?{kind:typeof value,value}:{kind:kind(value)};
 };
 const top=frame=>{if(stack[stack.length-1]!==frame)throw Error('element-invocation-stack-mismatch');};
 const effects=(${reactElementEffectRuntime})(top,shape);
 const sourceCalls=(${reactElementSourceCallRuntime})(plans,sources,data,same,site=>api.current(site));
 const api={
  sourceObject:sourceCalls.object,callbackObject:sourceCalls.callbacks,sourceCall:sourceCalls.call,
  sourceCaller(frame){return sourceCalls.caller(frame.sourceCall);},
  enterSource(index){
   const plan=plans[index];if(plan?.argumentSource!=='source-call')throw Error('element-source-plan-mismatch');
   const call=sourceCalls.claim(index),frame=api.enter(index,call?call.args:plan.parameters.map(()=>undefined),call);
   if(call)frame.sourceCall=call;else frame.sourceRefusal='element-source-invocation-unproved';return frame;
  },
  reactCall(fn,input,secondary){
   if(reactStack.length>=256||++reactSerial>100000)throw Error('element-react-call-limit');
   const origin=provenance.input(input,[]);
   // Unknown props may be proxies: identity provenance precedes reflection.
   const call={id:reactSerial,fn,args:[input,secondary],before:origin.failure?null:data(input),origin,claimed:false,finished:false,threw:false};
   reactStack.push(call);
   try{const value=N.apply(fn,undefined,call.args);call.result=value;return value;}
   catch(error){call.threw=true;throw error;}
   finally{call.finished=true;reactStack.pop();}
  },
  enterReact(index,fn){
   const plan=plans[index];if(!plan||plan.argumentSource!=='react-call')throw Error('element-react-plan-mismatch');
   // Flat parameter bindings over known plain React props cannot invoke a user
   // getter/default/computed key before the body claims this call. Unknown
   // inputs and more complex patterns therefore cannot borrow an outer call.
   const call=reactStack[reactStack.length-1],valid=call&&call.fn===fn&&!call.claimed&&call.before;
   const args=valid?call.args.slice(0,plan.parameters.length):plan.parameters.map(()=>undefined);
   const frame=api.enter(index,args,valid?call:undefined);
   if(valid){call.claimed=true;frame.react=call;frame.before=call.before;}
   else frame.reactRefusal='element-react-invocation-unproved';
   return frame;
  },
  enter(index,args,react){
   const plan=plans[index];if(!plan||plan.parameters.length!==args.length)throw Error('element-invocation-plan-mismatch');
   if(stack.length>=256||++serial>100000)throw Error('element-invocation-limit');
   const origin=provenance.input(args[0],args.slice(1));
   // Neither compiled JS nor original JSX permits reflection on an unknown
   // object. Known syntax-created configs may be observed without claiming
   // React props provenance; claimed source/React calls carry their own guard.
   const before=react?react.before:origin.failure&&!provenance.isLiteral(args[0])?null:data(args[0]);
   const frame={plan,id:serial,input:args[0],before,secondary:args.slice(1),origin,reads:[],values:[],globalReads:[],effects:[],finished:false,threw:false,returned:false};stack.push(frame);return frame;
  },
  binding(frame,index,value){
   top(frame);if(!frame.plan.bindingReads?.[index])throw Error('element-closure-read-unplanned');
   if(frame.reads.length>=10000||++readCount>100000)throw Error('element-closure-read-limit');
   frame.reads.push({read:index,value:shape(value)});frame.values.push(value);return value;
  },
  globalRead(frame,index,name,lookup){return effects.globalRead(frame,index,name,lookup,api.binding);},
  member:effects.member,write:effects.write,
  returned(frame,value){top(frame);frame.result=value;frame.returned=true;return value;},
  thrown(frame){top(frame);frame.threw=true;},
  leave(frame){top(frame);frame.unchanged=same(frame.input,frame.before);frame.finished=true;stack.pop();},
  current(site){const frame=stack[stack.length-1],span=site.transformed?site.originalFunction?.span:site.functionSpan;return frame&&(!site.transformed||plans[site.originalFunction?.plan]===frame.plan)&&frame.plan.module===site.module&&frame.plan.sourceSha256===site.sourceSha256&&frame.plan.span.start===span?.start&&frame.plan.span.end===span?.end?frame:undefined;},
  read(record){
   const frame=record.frame;if(!frame)return;
   const common={version:1,acceptedContract:null,effectsVerified:false,function:frame.plan};
   const fail=reason=>({...common,status:'refused',reason});
   if(frame.sourceRefusal)return fail(frame.sourceRefusal);
   const sourceCall=frame.sourceCall&&sourceCalls.describe(frame.sourceCall);
   if(frame.sourceCall&&(!sourceCall||frame.sourceCall.result!==record.element))return fail('element-source-result-not-returned');
   if(frame.reactRefusal)return fail(frame.reactRefusal);
   if(frame.react&&(!frame.react.finished||frame.react.threw||frame.react.result!==record.element))return fail('element-react-result-not-returned');
   if(!frame.finished||frame.threw||!frame.returned||frame.result!==record.element)return fail('element-invocation-result-not-returned');
   if(!frame.before)return fail('element-invocation-input-not-data');
   if(!frame.unchanged||!same(frame.input,frame.before))return fail('element-invocation-input-changed');
   const child=N.descriptor(frame.before,'children')?.value,out=N.descriptor(record.props,'children');
   if(out&&!has(out,'value'))return fail('element-invocation-output-accessor');
   const childrenIdentity=!child&&!out?'both-absent':child&&out&&N.is(child.value,out.value)?'same-value':'changed';
   return {...common,status:'observed',invocation:frame.id,...(frame.react?{reactCall:frame.react.id}:{}),...(sourceCall?{sourceCall}:{}),input:N.keys(frame.before).map(k=>[k,shape(frame.before[k].value)]),childrenIdentity,secondaryKinds:frame.secondary.map(kind),closureReads:frame.reads.map(r=>({...r,value:{...r.value}})),globalReads:frame.globalReads.map(r=>({...r})),effects:frame.effects.map(e=>({...e,...(e.value?{value:{...e.value}}:{})})),inputProvenance:provenance.readInput(frame.origin),outputProvenance:provenance.readOutput(record.element)};
  }
 };return api;
}`;
