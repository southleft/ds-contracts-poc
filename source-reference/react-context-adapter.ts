import ts from 'typescript';
import {instrumentReactStateAdapter} from './react-state-adapter.js';

/** Called only after a complete supported React/ReactDOM hash combination has
 * been checked. Function objects and native execution order stay unchanged. */
export function instrumentReactContextAdapter(text:string,kind:'create-element'|'jsx'|'forward-ref'):string {
  if(kind==='forward-ref')text=instrumentReactStateAdapter(text);
  const G='globalThis.__DSC_RUNTIME_PROOF',sf=ts.createSourceFile('pinned-runtime.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const edits:Array<{start:number;end:number;text:string}>=[];
  const declarations=new Map<string,ts.FunctionDeclaration[]>(),exports=new Map<string,ts.FunctionExpression[]>();
  const scan=(n:ts.Node)=>{
    if(ts.isFunctionDeclaration(n)&&n.name){const list=declarations.get(n.name.text)??[];list.push(n);declarations.set(n.name.text,list);}
    if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(n.left)&&ts.isIdentifier(n.left.expression)&&n.left.expression.text==='exports'&&ts.isFunctionExpression(n.right)){
      const list=exports.get(n.left.name.text)??[];list.push(n.right);exports.set(n.left.name.text,list);
    }
    ts.forEachChild(n,scan);
  };scan(sf);
  const body=(name:string,exported=false)=>{
    const list=exported?exports.get(name):declarations.get(name);
    if(list?.length!==1||!list[0].body)throw Error('context-adapter-function-unmatched:'+name);
    return list[0].body;
  };
  const prepend=(name:string,code:string,exported=false)=>{const b=body(name,exported);edits.push({start:b.getStart(sf)+1,end:b.getStart(sf)+1,text:'\n'+code+'\n'});};
  const returned=(name:string,expected:string,replacement:string,exported=false)=>{
    const b=body(name,exported),returns=b.statements.filter(ts.isReturnStatement);
    if(returns.length!==1||returns[0]!==b.statements[b.statements.length-1]||returns[0].expression?.getText(sf)!==expected)throw Error('context-adapter-return-unmatched:'+name);
    const e=returns[0].expression!;edits.push({start:e.getStart(sf),end:e.end,text:replacement});
  };
  if(kind==='forward-ref'){
    const callbackBody=(name:string,expected:string,replacement:string)=>{
      const b=body(name),normalize=(s:string)=>s.replace(/\s+/g,'');
      if(normalize(b.getText(sf))!==normalize(expected))throw Error('callback-adapter-body-unmatched:'+name);
      edits.push({start:b.getStart(sf),end:b.end,text:replacement});
    };
    const effectRecord=body('pushSimpleEffect').statements[0];
    if(effectRecord.getText(sf)!=='tag = { tag: tag, create: create, deps: deps, inst: inst, next: null };')throw Error('effect-adapter-record-unmatched');
    if(!ts.isExpressionStatement(effectRecord)||!ts.isBinaryExpression(effectRecord.expression))throw Error('effect-adapter-record-form');
    const allocation=effectRecord.expression.right;edits.push({start:allocation.getStart(sf),end:allocation.end,text:G+'.effectRecord('+allocation.getText(sf)+')'});
    const effectHelpers=new Map<string,ts.FunctionExpression>();
    const findEffectHelpers=(n:ts.Node)=>{
      if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&['callCreate','callDestroy'].includes(n.name.text)&&n.initializer&&ts.isObjectLiteralExpression(n.initializer)){
        const fields=n.initializer.properties;
        if(fields.length!==1||!ts.isPropertyAssignment(fields[0])||!ts.isIdentifier(fields[0].name)||fields[0].name.text!=='react_stack_bottom_frame'||!ts.isFunctionExpression(fields[0].initializer))throw Error('effect-adapter-helper-form');
        if(effectHelpers.has(n.name.text))throw Error('effect-adapter-helper-duplicate');effectHelpers.set(n.name.text,fields[0].initializer);
      }ts.forEachChild(n,findEffectHelpers);
    };findEffectHelpers(sf);
    const effectBody=(name:string,expected:string,replacement:string)=>{
      const fn=effectHelpers.get(name);if(!fn||fn.body.getText(sf).replace(/\s+/g,'')!==expected.replace(/\s+/g,''))throw Error('effect-adapter-body-unmatched:'+name);
      edits.push({start:fn.body.getStart(sf),end:fn.body.end,text:replacement});
    };
    effectBody('callCreate',`{var create=effect.create;effect=effect.inst;create=create();return(effect.destroy=create);}`,`{
      var __DSC_EFFECT_RUN=${G}.effectCreateBegin(effect);
      try {var create=effect.create;effect=effect.inst;create=create();return(effect.destroy=${G}.effectRunReturn(__DSC_EFFECT_RUN,create));}
      catch(error){${G}.effectRunThrow(__DSC_EFFECT_RUN,error);throw error;}
      finally{${G}.effectRunEnd(__DSC_EFFECT_RUN);}
    }`);
    effectBody('callDestroy',`{try{destroy();}catch(error){captureCommitPhaseError(current,nearestMountedAncestor,error);}}`,`{
      var __DSC_EFFECT_RUN=${G}.effectCleanupBegin(destroy);
      try{destroy();${G}.effectRunReturn(__DSC_EFFECT_RUN,undefined);}
      catch(error){${G}.effectRunThrow(__DSC_EFFECT_RUN,error);captureCommitPhaseError(current,nearestMountedAncestor,error);}
      finally{${G}.effectRunEnd(__DSC_EFFECT_RUN);}
    }`);
    let cleanupSites=0;const cleanupArgs=(n:ts.Node)=>{
      if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='runWithFiberInDEV'&&n.arguments[1]?.getText(sf)==='callDestroyInDEV'){
        if(n.arguments.map(a=>a.getText(sf)).join('|')!=='lastEffect|callDestroyInDEV|lastEffect|nearestMountedAncestor|destroy')throw Error('effect-adapter-cleanup-call');
        const arg=n.arguments[4];edits.push({start:arg.getStart(sf),end:arg.end,text:G+'.effectCleanupValue(updateQueue,inst,destroy)'});cleanupSites++;
      }ts.forEachChild(n,cleanupArgs);
    };cleanupArgs(body('commitHookEffectListUnmount'));if(cleanupSites!==1)throw Error('effect-adapter-cleanup-coverage');
    callbackBody('mountRef',`{
      var hook = mountWorkInProgressHook();initialValue = { current: initialValue };return (hook.memoizedState = initialValue);
    }`,`{
      var hook = mountWorkInProgressHook();initialValue = ${G}.refState({current:initialValue});return ${G}.refMount(hook.memoizedState = initialValue);
    }`);
    let refUpdates=0;
    const updateRefs=(n:ts.Node)=>{
      if(ts.isPropertyAssignment(n)&&ts.isIdentifier(n.name)&&n.name.text==='useRef'&&ts.isFunctionExpression(n.initializer)&&n.initializer.parameters.length===0){
        const b=n.initializer.body,last=b.statements[b.statements.length-1];
        if(!ts.isReturnStatement(last)||last.expression?.getText(sf)!=='updateWorkInProgressHook().memoizedState')throw Error('ref-adapter-update-unmatched');
        const e=last.expression;edits.push({start:e.getStart(sf),end:e.end,text:G+'.refUpdate('+e.getText(sf)+')'});refUpdates++;
      }
      ts.forEachChild(n,updateRefs);
    };updateRefs(sf);if(refUpdates!==4)throw Error('ref-adapter-update-coverage');
    callbackBody('mountCallback',`{
      mountWorkInProgressHook().memoizedState = [callback,void 0 === deps ? null : deps];return callback;
    }`,`{
      var hook = mountWorkInProgressHook();
      hook.memoizedState = ${G}.callbackState([callback,void 0 === deps ? null : deps]);
      return ${G}.callbackMount(hook.memoizedState,callback,deps);
    }`);
    callbackBody('updateCallback',`{
      var hook = updateWorkInProgressHook();deps = void 0 === deps ? null : deps;var prevState = hook.memoizedState;
      if(null !== deps && areHookInputsEqual(deps,prevState[1]))return prevState[0];
      hook.memoizedState = [callback,deps];return callback;
    }`,`{
      var hook = updateWorkInProgressHook();deps = void 0 === deps ? null : deps;var prevState = hook.memoizedState;
      var __DSC_callbackFrame = ${G}.callbackBegin(callback,deps,prevState);
      try {
        if(null !== deps && ${G}.callbackCompare(__DSC_callbackFrame,areHookInputsEqual(deps,prevState[1])))
          return ${G}.callbackReturn(__DSC_callbackFrame,prevState[0],hook.memoizedState,true);
        hook.memoizedState = ${G}.callbackState([callback,deps]);
        return ${G}.callbackReturn(__DSC_callbackFrame,callback,hook.memoizedState,false);
      } finally {${G}.callbackEnd(__DSC_callbackFrame);}
    }`);
    prepend('pushProvider',G+'.contextPush(context,nextValue,providerFiber.pendingProps,providerFiber);');
    prepend('popProvider',G+'.contextPop(context,providerFiber);');
    const b=body('readContextForConsumer'),first=b.statements[0];
    if(first.getText(sf)!=='var value = context._currentValue;')throw Error('context-adapter-read-unmatched');
    edits.push({start:first.getStart(sf),end:first.getStart(sf),text:G+'.contextBeforeRead(context);\n'});
    edits.push({start:first.end,end:first.end,text:'\n'+G+'.contextRead(context,value);'});
  }else{
    returned('ReactElement','type',G+'.contextElement(type.type,type.props,type)');
    if(kind==='create-element'){
      returned('createContext','defaultValue',G+'.contextCreated(defaultValue)',true);
      prepend('useContext',G+'.contextAccess(Context);',true);
      edits.push({start:text.length,end:text.length,text:'\n'+G+'.contextHook(exports.useContext,exports);\n'});
    }
  }
  for(const e of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,e.start)+e.text+text.slice(e.end);
  return text;
}
