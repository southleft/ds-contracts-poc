import ts from 'typescript';
/** Additional observation in the already hash-pinned ReactDOM renderer. All
 * original initializer/updater/dispatch calls and tuple identities are retained. */
export function instrumentReactStateAdapter(text:string):string {
 const sf=ts.createSourceFile('pinned-state-runtime.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),G='globalThis.__DSC_RUNTIME_PROOF';
 const edits:Array<{start:number;end:number;text:string}>=[],functions=new Map<string,ts.FunctionDeclaration[]>(),dispatchers:ts.FunctionExpression[]=[];
 const scan=(n:ts.Node)=>{if(ts.isFunctionDeclaration(n)&&n.name){const a=functions.get(n.name.text)??[];a.push(n);functions.set(n.name.text,a);}if(ts.isPropertyAssignment(n)&&ts.isIdentifier(n.name)&&n.name.text==='useState'&&ts.isFunctionExpression(n.initializer))dispatchers.push(n.initializer);ts.forEachChild(n,scan);};scan(sf);
 const body=(name:string)=>{const a=functions.get(name);if(a?.length!==1||!a[0].body)throw Error('state-adapter-function:'+name);return a[0].body;};
 const normalize=(s:string)=>s.replace(/\s+/g,'');
 const init=body('mountStateImpl'),expected=`{var hook=mountWorkInProgressHook();if("function"===typeof initialState){var initialStateInitializer=initialState;initialState=initialStateInitializer();if(shouldDoubleInvokeUserFnsInHooksDEV){setIsStrictModeForDevtools(!0);try{initialStateInitializer();}finally{setIsStrictModeForDevtools(!1);}}}hook.memoizedState=hook.baseState=initialState;hook.queue={pending:null,lanes:0,dispatch:null,lastRenderedReducer:basicStateReducer,lastRenderedState:initialState};return hook;}`;
 if(normalize(init.getText(sf))!==normalize(expected))throw Error('state-adapter-initializer');
 let initializers=0,queues=0;
 const visitInit=(n:ts.Node)=>{
  if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='initialStateInitializer')edits.push({start:n.getStart(sf),end:n.end,text:G+'.stateInitialized(initialStateInitializer,'+n.getText(sf)+','+(initializers++)+')'});
  if(ts.isBinaryExpression(n)&&n.left.getText(sf)==='hook.queue'&&ts.isObjectLiteralExpression(n.right)){const o=n.right;edits.push({start:o.getStart(sf),end:o.end,text:G+'.stateQueue('+o.getText(sf)+',initialState,basicStateReducer)'});queues++;}
  ts.forEachChild(n,visitInit);
 };visitInit(init);if(initializers!==2||queues!==1)throw Error('state-adapter-initializer-coverage');
 for(const [name,phase,queue,expected] of [['mountState','mount','queue','[initialState.memoizedState, dispatch]'],['updateReducerImpl','update','queue','[hook.memoizedState, queue.dispatch]'],['rerenderReducer','rerender','queue','[newState, dispatch]']] as const){
  const b=body(name),last=b.statements[b.statements.length-1];
  if(!ts.isReturnStatement(last)||!last.expression||normalize(last.expression.getText(sf))!==normalize(expected))throw Error('state-adapter-tuple:'+name);
  if(name==='mountState'&&normalize(b.getText(sf))!==normalize('{initialState=mountStateImpl(initialState);var queue=initialState.queue,dispatch=dispatchSetState.bind(null,currentlyRenderingFiber,queue);queue.dispatch=dispatch;return [initialState.memoizedState,dispatch];}'))throw Error('state-adapter-mount');
  const e=last.expression;edits.push({start:e.getStart(sf),end:e.end,text:G+'.stateTuple('+JSON.stringify(phase)+','+queue+','+e.getText(sf)+','+(name==='mountState'?'basicStateReducer':'reducer')+')'});
 }
 const shapes:string[]=[];
 for(const fn of dispatchers){
  const b=fn.body,statements=[...b.statements],attempt=statements.pop();
  if(!attempt||!ts.isTryStatement(attempt)||attempt.catchClause||attempt.tryBlock.statements.length!==1||!attempt.finallyBlock||normalize(attempt.finallyBlock.getText(sf))!=='{ReactSharedInternals.H=prevDispatcher;}')throw Error('state-adapter-dispatch-try');
  const ret=attempt.tryBlock.statements[0];if(!ts.isReturnStatement(ret)||!ret.expression)throw Error('state-adapter-dispatch-return');
  const call=normalize(ret.expression.getText(sf)),phase=call==='mountState(initialState)'?'mount':call==='updateReducer(basicStateReducer)'?'update':call==='rerenderReducer(basicStateReducer)'?'rerender':null;
  if(!phase||fn.parameters.map(p=>p.getText(sf)).join(',')!==(phase==='mount'?'initialState':''))throw Error('state-adapter-dispatch-call');
  const prefix=statements.map(n=>normalize(n.getText(sf))),warn=prefix[1]==='warnInvalidHookAccess();';if(warn)prefix.splice(1,1);
  const hookTypes=prefix[1],dispatcher=prefix[3];
  if(prefix.length!==4||prefix[0]!=='currentHookNameInDev="useState";'||!['mountHookTypesDev();','updateHookTypesDev();'].includes(hookTypes)||prefix[2]!=='varprevDispatcher=ReactSharedInternals.H;'||!/^ReactSharedInternals.H=InvalidNestedHooksDispatcherOn(Mount|Update|Rerender)InDEV;$/.test(dispatcher))throw Error('state-adapter-dispatch-body');
  shapes.push([phase,warn,hookTypes,dispatcher].join('|'));
  const F='__DSC_STATE_CALL';edits.push({start:attempt.getStart(sf),end:attempt.end,text:`var ${F}=${G}.stateBegin(${JSON.stringify(phase)},${phase==='mount'?'initialState':'undefined'});try{return ${G}.stateReturn(${F},${ret.expression.getText(sf)});}catch(error){${G}.stateThrow(${F},error);throw error;}finally{${G}.stateEnd(${F});ReactSharedInternals.H=prevDispatcher;}`});
 }
 const expectedShapes=[['mount',false,'mount','Mount'],['mount',false,'update','Mount'],['update',false,'update','Update'],['rerender',false,'update','Rerender'],['mount',true,'mount','Mount'],['update',true,'update','Update'],['rerender',true,'update','Update']].map(([p,w,h,d])=>[p,w,h+'HookTypesDev();','ReactSharedInternals.H=InvalidNestedHooksDispatcherOn'+d+'InDEV;'].join('|'));
 if(JSON.stringify(shapes.sort())!==JSON.stringify(expectedShapes.sort()))throw Error('state-adapter-dispatch-coverage');
 for(const e of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,e.start)+e.text+text.slice(e.end);
 return text;
}
