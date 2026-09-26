import ts from 'typescript';
import {createHash} from 'node:crypto';
import {helperPointKey,type ReactJsxHelperInstrumentationPlan} from './react-helper-instrument.js';

export interface ReactJsxLookupProof {
  version:1;acceptedContract:null;effectsVerified:false;
  qualification:'bundled-esm-binding-reads-only';
  status:'verified';sourceJavascriptSha256:string;javascriptSha256:string;namespaces:number;
  contextTargets?:{reads:number};
  /** Calls whose emitted callee is a resolved lexical read, optionally inside
   * its independently planned module-binding witness. Other callees stay open. */
  contextConsumerCallees?:string[];
  callbackHookReads?:string[];
  refHookReads?:string[];
  effectHookReads?:string[];
  helperHookReads?:string[];
  contextImports?:{kernel:'esbuild-commonjs-interop';wrappers:number;bareHookReads:number};
  reads:Array<{read:string;binding:string;span:{start:number;end:number};bindingSpan:{start:number;end:number}}>;
}

/** Check the executable bundle, not a pre-bundle property access or a function's
 * toString result. Trusted compiler registrations originate in resolved static
 * ESM imports. A callback may only read that same lexical binding; getters,
 * proxies, calls and shadowed names cannot stand in for it. Initializer effects
 * and imported component behavior are separate, unproved requirements. */
export function prepareReactJsxLookupBundle(javascript:string,plan:ReactJsxHelperInstrumentationPlan):{javascript:string;proof:ReactJsxLookupProof} {
  const fail=(reason:string):never=>{throw Error('jsx-lookup-'+reason);};
  const file='/__dsc_jsx_lookup_bundle.js',sf=ts.createSourceFile(file,javascript,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if((sf as ts.SourceFile & {parseDiagnostics:readonly ts.Diagnostic[]}).parseDiagnostics.length)fail('bundle-syntax');
  const host:ts.CompilerHost={getSourceFile:f=>f===file?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=> '/',getDirectories:()=>[],fileExists:f=>f===file,readFile:f=>f===file?javascript:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const program=ts.createProgram([file],{allowJs:true,noLib:true,noResolve:true},host),checker=program.getTypeChecker();
  const unwrap=(node:ts.Node):ts.Node=>{while(ts.isParenthesizedExpression(node))node=node.expression;return node;};
  const binding=(node:ts.Node|undefined)=>{
    if(!node)fail('binding-missing');node=unwrap(node!);
    if(!ts.isIdentifier(node))return fail('nonlexical-read');
    const symbol=checker.getSymbolAtLocation(node),declarations=symbol?.declarations;
    if(!symbol||declarations?.length!==1||!(ts.isVariableDeclaration(declarations[0])||ts.isFunctionDeclaration(declarations[0])||ts.isBindingElement(declarations[0])))return fail('binding-unresolved-or-ambiguous');
    return {symbol,declaration:declarations[0]};
  };
  const callbackNode=(node:ts.Node|undefined)=>{
    if(!node)return fail('callback-missing');node=unwrap(node);
    if(!ts.isArrowFunction(node)||node.parameters.length||node.modifiers?.length||node.typeParameters?.length||ts.isBlock(node.body))return fail('callback-unmodeled');
    return unwrap(node.body);
  };
  const callback=(node:ts.Node|undefined)=>binding(callbackNode(node));
  const edits:Array<{start:number;end:number;text:string}>=[],namespaces=new Map<ts.Symbol,Map<string,ReturnType<typeof binding>>>();
  const namespace=(base:ts.Identifier)=>{
    const value=binding(base),prior=namespaces.get(value.symbol);if(prior)return prior;
    const declaration=value.declaration;
    if(!ts.isVariableDeclaration(declaration)||!declaration.initializer||!ts.isObjectLiteralExpression(declaration.initializer)||declaration.initializer.properties.length||!ts.isVariableDeclarationList(declaration.parent)||declaration.parent.declarations.length!==1||!ts.isVariableStatement(declaration.parent.parent))return fail('namespace-origin-unproved');
    const statement=declaration.parent.parent,scope=statement.parent;if(!ts.isBlock(scope)&&!ts.isSourceFile(scope))return fail('namespace-scope-unmodeled');
    const next=scope.statements[scope.statements.indexOf(statement)+1];
    const call=next&&ts.isExpressionStatement(next)&&ts.isCallExpression(next.expression)?next.expression:undefined;
    if(!call||call.questionDotToken||call.arguments.length!==2||binding(call.arguments[0]).symbol!==value.symbol||!ts.isIdentifier(call.expression))return fail('namespace-initializer-unmodeled');
    const emit=binding(call.expression).declaration;
    if(!ts.isVariableDeclaration(emit)||!emit.initializer||!ts.isArrowFunction(emit.initializer)||emit.initializer.parameters.length!==2||!ts.isBlock(emit.initializer.body))return fail('namespace-emitter-unmodeled');
    // Namespace installation is checked again against the actual getter
    // identities before granting any runtime read authority.
    const map=call.arguments[1];if(!ts.isObjectLiteralExpression(map))return fail('namespace-exports-unmodeled');
    const entries=new Map<string,ReturnType<typeof binding>>();
    for(const field of map.properties){
      if(!ts.isPropertyAssignment(field)||!(ts.isIdentifier(field.name)||ts.isStringLiteral(field.name)))return fail('namespace-export-unmodeled');
      const key=field.name.text;if(key==='__proto__')fail('namespace-export-prototype');if(entries.has(key))return fail('namespace-export-duplicate');entries.set(key,callback(field.initializer));
    }
    namespaces.set(value.symbol,entries);
    edits.push({start:call.getStart(sf),end:call.end,text:'globalThis.__DSC_RUNTIME_PROOF.namespaceExport('+call.expression.getText(sf)+','+call.arguments.map(a=>a.getText(sf)).join(',')+')'});
    return entries;
  };
  const lookup=(node:ts.Node|undefined)=>{
    const body=callbackNode(node);
    if(ts.isIdentifier(body))return binding(body);
    if(!ts.isPropertyAccessExpression(body)||body.questionDotToken||!ts.isIdentifier(body.expression))return fail('nonlexical-read');
    const resolved=namespace(body.expression).get(body.name.text);if(!resolved)return fail('namespace-export-missing');
    edits.push({start:body.getStart(sf),end:body.end,text:'globalThis.__DSC_RUNTIME_PROOF.namespaceRead('+body.expression.getText(sf)+','+JSON.stringify(body.name.text)+')'});
    return resolved;
  };
  let contextImports:ReactJsxLookupProof['contextImports'];
  const callbackHookReads:string[]=[],callbackHooks=new Map((plan.callbackSources?.hooks??[]).map(h=>[helperPointKey(h.call),h]));
  const refHookReads:string[]=[],refHooks=new Map((plan.refHooks??[]).map(h=>[helperPointKey(h.call),h]));
  const helperHookReads:string[]=[],helperHooks=new Map((plan.hookHelpers?.functions??[]).flatMap(f=>f.hooks.map(h=>[helperPointKey(h.call),h] as const)));
  const effectHookReads:string[]=[],effectHooks=new Map((plan.effectHooks??[]).map(h=>[helperPointKey(h.call),h]));
  if(plan.contextCalls?.length||callbackHooks.size||refHooks.size||effectHooks.size||helperHooks.size){
    // Authenticate compiler-generated getter bodies before permitting runtime
    // reflection of their freshly allocated wrapper. Names here identify the
    // pinned bundler kernel, never a source library or component.
    const printer=ts.createPrinter({removeComments:true});
    const printed=(n:ts.Node,f=sf)=>printer.printNode(ts.EmitHint.Unspecified,n,f).replace(/\s+/g,'');
    const expression=(text:string)=>{const f=ts.createSourceFile('/kernel.js','const x='+text+';',ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);return printed((f.statements[0] as ts.VariableStatement).declarationList.declarations[0].initializer!,f);};
    const variables:ts.VariableDeclaration[]=[];
    const collect=(n:ts.Node)=>{if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))variables.push(n);ts.forEachChild(n,collect);};collect(sf);
    const to=variables.find(n=>ts.isIdentifier(n.name)&&n.name.text==='__toESM');
    if(!to?.initializer)return fail('context-interop-kernel-missing');
    const scope=to.parent.parent.parent;
    const needed=new Map<string,ts.VariableDeclaration>();
    const kernels:Record<string,string>={
      __create:'Object.create',__defProp:'Object.defineProperty',__getOwnPropDesc:'Object.getOwnPropertyDescriptor',__getOwnPropNames:'Object.getOwnPropertyNames',__getProtoOf:'Object.getPrototypeOf',__hasOwnProp:'Object.prototype.hasOwnProperty',
      __copyProps:`(to, from, except, desc) => { if (from && typeof from === "object" || typeof from === "function") { for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable }); } return to; }`,
      __toESM:`(mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod))`,
    };
    for(const [name,expected] of Object.entries(kernels)){
      const matches=variables.filter(n=>ts.isIdentifier(n.name)&&n.name.text===name&&n.parent.parent.parent===scope);
      if(matches.length!==1||!matches[0].initializer||printed(matches[0].initializer)!==expression(expected))return fail('context-interop-kernel-changed:'+name);
      needed.set(name,matches[0]);
    }
    const symbols=new Set([...needed.values()].map(n=>checker.getSymbolAtLocation(n.name)));
    const check=(n:ts.Node)=>{
      if(ts.isIdentifier(n)){
        const symbol=checker.getSymbolAtLocation(n);
        if(symbols.has(symbol)){
          const declaration=symbol?.valueDeclaration;
          if(!declaration||!ts.isVariableDeclaration(declaration)||n!==declaration.name){
            const inside=[needed.get('__copyProps')!,needed.get('__toESM')!].some(d=>n.pos>=d.pos&&n.end<=d.end);
            if(!inside&&!(ts.isCallExpression(n.parent)&&n.parent.expression===n))fail('context-interop-binding-used-indirectly');
          }
        }
        if(n.text==='Object'&&[...needed.values()].some(d=>n.pos>=d.pos&&n.end<=d.end)&&symbol?.declarations?.length)fail('context-interop-intrinsic-shadowed');
        const expected=needed.get(n.text);
        if(expected&&[needed.get('__copyProps')!,needed.get('__toESM')!].some(d=>n.pos>=d.initializer!.pos&&n.end<=d.end)&&symbol!==checker.getSymbolAtLocation(expected.name))fail('context-interop-kernel-binding-differs');
      }
      ts.forEachChild(n,check);
    };check(sf);
    edits.push({start:to.parent.parent.end,end:to.parent.parent.end,text:'\nglobalThis.__DSC_RUNTIME_PROOF.contextInteropKernel(__toESM,()=>['+[...needed.keys()].join(',')+']);\n'});
    const toSymbol=checker.getSymbolAtLocation(to.name),calls=new Map((plan.contextCalls??[]).map(c=>[helperPointKey(c.call),c]));let wrappers=0,bareHookReads=0;
    const add=(n:ts.Node,text:string)=>edits.push({start:n.getStart(sf),end:n.end,text});
    const instrument=(n:ts.Node)=>{
      if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&checker.getSymbolAtLocation(n.expression)===toSymbol){
        if(n.questionDotToken||n.arguments.some(ts.isSpreadElement)||n.arguments.length<1||n.arguments.length>2)fail('context-interop-call-unmodeled');
        add(n,'globalThis.__DSC_RUNTIME_PROOF.contextInterop('+n.expression.getText(sf)+','+n.arguments.map(a=>a.getText(sf)).join(',')+')');wrappers++;
      }
      if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='contextHookValue'){
        const owner=n.expression.expression;
        if(ts.isPropertyAccessExpression(owner)&&owner.name.text==='__DSC_RUNTIME_PROOF'&&ts.isIdentifier(owner.expression)&&owner.expression.text==='globalThis'){
          const key=n.arguments[0],read=n.arguments[1];
          if(n.arguments.length!==2||!ts.isStringLiteral(key)||calls.get(key.text)?.receiver!=='bare'||n.questionDotToken)fail('context-hook-value-unplanned');
          if(ts.isPropertyAccessExpression(read)&&!read.questionDotToken&&ts.isIdentifier(read.expression)&&read.name.text==='useContext'){
            add(n,'globalThis.__DSC_RUNTIME_PROOF.contextHookRead('+key.getText(sf)+','+read.expression.getText(sf)+')');
          }else if(!ts.isIdentifier(read))fail('context-hook-value-nonlexical');else binding(read);
          bareHookReads++;
        }
      }
      if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&['callbackSourceHookValue','callbackSourceHookRead'].includes(n.expression.name.text)){
        const owner=n.expression.expression;
        if(ts.isPropertyAccessExpression(owner)&&owner.name.text==='__DSC_RUNTIME_PROOF'&&ts.isIdentifier(owner.expression)&&owner.expression.text==='globalThis'){
          const key=n.arguments[0],read=n.arguments[1],bare=n.expression.name.text==='callbackSourceHookValue';
          if(!ts.isStringLiteral(key))return fail('callback-hook-key-unplanned');
          const site=callbackHooks.get(key.text);if(!site)return fail('callback-hook-read-unplanned');
          if(n.questionDotToken||n.arguments.length!==(bare?2:3)||bare!==(site.receiver==='bare')||!bare&&n.arguments[2].kind!==ts.SyntaxKind.TrueKeyword)return fail('callback-hook-read-unplanned');
          if(bare){
            if(ts.isPropertyAccessExpression(read)&&!read.questionDotToken&&ts.isIdentifier(read.expression)&&read.name.text==='useCallback'){
              binding(read.expression);add(n,'globalThis.__DSC_RUNTIME_PROOF.callbackSourceHookRead('+key.getText(sf)+','+read.expression.getText(sf)+',false)');
            }else if(ts.isIdentifier(read))binding(read);else fail('callback-hook-read-nonlexical');
          }else if(site.receiver==='default'){
            if(!ts.isPropertyAccessExpression(read)||read.questionDotToken||!ts.isIdentifier(read.expression)||read.name.text!=='default')return fail('callback-hook-default-read-unmodeled');
            binding(read.expression);add(n,'globalThis.__DSC_RUNTIME_PROOF.callbackSourceHookDefault('+key.getText(sf)+','+read.expression.getText(sf)+')');
          }else {if(!ts.isIdentifier(read))return fail('callback-hook-namespace-read-nonlexical');binding(read);}
          if(callbackHookReads.includes(key.text))fail('callback-hook-read-duplicate');callbackHookReads.push(key.text);
        }
      }
      if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&['refHookValue','refHookRead'].includes(n.expression.name.text)){
        const owner=n.expression.expression;
        if(ts.isPropertyAccessExpression(owner)&&owner.name.text==='__DSC_RUNTIME_PROOF'&&ts.isIdentifier(owner.expression)&&owner.expression.text==='globalThis'){
          const key=n.arguments[0],read=n.arguments[1],bare=n.expression.name.text==='refHookValue';
          if(!ts.isStringLiteral(key))return fail('ref-hook-key-unplanned');
          const site=refHooks.get(key.text);if(!site)return fail('ref-hook-read-unplanned');
          if(n.questionDotToken||n.arguments.length!==(bare?2:3)||bare!==(site.receiver==='bare')||!bare&&n.arguments[2].kind!==ts.SyntaxKind.TrueKeyword)return fail('ref-hook-read-unplanned');
          if(bare){
            if(ts.isPropertyAccessExpression(read)&&!read.questionDotToken&&ts.isIdentifier(read.expression)&&read.name.text==='useRef'){
              binding(read.expression);add(n,'globalThis.__DSC_RUNTIME_PROOF.refHookRead('+key.getText(sf)+','+read.expression.getText(sf)+',false)');
            }else if(ts.isIdentifier(read))binding(read);else fail('ref-hook-read-nonlexical');
          }else if(site.receiver==='default'){
            if(!ts.isPropertyAccessExpression(read)||read.questionDotToken||!ts.isIdentifier(read.expression)||read.name.text!=='default')return fail('ref-hook-default-read-unmodeled');
            binding(read.expression);add(n,'globalThis.__DSC_RUNTIME_PROOF.refHookDefault('+key.getText(sf)+','+read.expression.getText(sf)+')');
          }else {if(!ts.isIdentifier(read))return fail('ref-hook-namespace-read-nonlexical');binding(read);}
          if(refHookReads.includes(key.text))fail('ref-hook-read-duplicate');refHookReads.push(key.text);
        }
      }
      if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&['effectHookValue','effectHookRead'].includes(n.expression.name.text)){
        const owner=n.expression.expression;
        if(ts.isPropertyAccessExpression(owner)&&owner.name.text==='__DSC_RUNTIME_PROOF'&&ts.isIdentifier(owner.expression)&&owner.expression.text==='globalThis'){
          const key=n.arguments[0],read=n.arguments[1],bare=n.expression.name.text==='effectHookValue';
          if(!ts.isStringLiteral(key))return fail('effect-hook-key-unplanned');
          const site=effectHooks.get(key.text);if(!site)return fail('effect-hook-read-unplanned');
          if(n.questionDotToken||n.arguments.length!==(bare?2:3)||bare!==(site.receiver==='bare')||!bare&&n.arguments[2].kind!==ts.SyntaxKind.TrueKeyword)return fail('effect-hook-read-unplanned');
          if(bare){
            if(ts.isPropertyAccessExpression(read)&&!read.questionDotToken&&ts.isIdentifier(read.expression)&&read.name.text===site.hook){
              binding(read.expression);add(n,'globalThis.__DSC_RUNTIME_PROOF.effectHookRead('+key.getText(sf)+','+read.expression.getText(sf)+',false)');
            }else if(ts.isIdentifier(read))binding(read);else fail('effect-hook-read-nonlexical');
          }else if(site.receiver==='default'){
            if(!ts.isPropertyAccessExpression(read)||read.questionDotToken||!ts.isIdentifier(read.expression)||read.name.text!=='default')return fail('effect-hook-default-read-unmodeled');
            binding(read.expression);add(n,'globalThis.__DSC_RUNTIME_PROOF.effectHookDefault('+key.getText(sf)+','+read.expression.getText(sf)+')');
          }else {if(!ts.isIdentifier(read))return fail('effect-hook-namespace-read-nonlexical');binding(read);}
          if(effectHookReads.includes(key.text))fail('effect-hook-read-duplicate');effectHookReads.push(key.text);
        }
      }
      if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&['helperHookValue','helperHookRead'].includes(n.expression.name.text)){
        const owner=n.expression.expression;
        if(ts.isPropertyAccessExpression(owner)&&owner.name.text==='__DSC_RUNTIME_PROOF'&&ts.isIdentifier(owner.expression)&&owner.expression.text==='globalThis'){
          const key=n.arguments[0],read=n.arguments[1],bare=n.expression.name.text==='helperHookValue';
          if(!ts.isStringLiteral(key))return fail('helper-hook-key-unplanned');
          const site=helperHooks.get(key.text);if(!site)return fail('helper-hook-read-unplanned');
          if(n.questionDotToken||n.arguments.length!==(bare?2:3)||bare!==(site.receiver==='bare')||!bare&&n.arguments[2].kind!==ts.SyntaxKind.TrueKeyword)return fail('helper-hook-read-unplanned');
          if(bare){
            if(ts.isPropertyAccessExpression(read)&&!read.questionDotToken&&ts.isIdentifier(read.expression)&&read.name.text===site.hook){
              binding(read.expression);add(n,'globalThis.__DSC_RUNTIME_PROOF.helperHookRead('+key.getText(sf)+','+read.expression.getText(sf)+',false)');
            }else if(ts.isIdentifier(read))binding(read);else fail('helper-hook-read-nonlexical');
          }else if(site.receiver==='default'){
            if(!ts.isPropertyAccessExpression(read)||read.questionDotToken||!ts.isIdentifier(read.expression)||read.name.text!=='default')return fail('helper-hook-default-read-unmodeled');
            binding(read.expression);add(n,'globalThis.__DSC_RUNTIME_PROOF.helperHookDefault('+key.getText(sf)+','+read.expression.getText(sf)+')');
          }else {if(!ts.isIdentifier(read))return fail('helper-hook-namespace-read-nonlexical');binding(read);}
          if(helperHookReads.includes(key.text))fail('helper-hook-read-duplicate');helperHookReads.push(key.text);
        }
      }
      ts.forEachChild(n,instrument);
    };instrument(sf);
    contextImports={kernel:'esbuild-commonjs-interop',wrappers,bareHookReads};
  }
  let contextTargets:ReactJsxLookupProof['contextTargets'];
  if(plan.contextTargets?.reads.length){
    const expected=new Map(plan.contextTargets.reads.map(r=>[helperPointKey(r.read),r])),seen=new Set<string>();
    const inspect=(n:ts.Node)=>{
      if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='contextTargetRead'){
        const owner=n.expression.expression;
        if(ts.isPropertyAccessExpression(owner)&&owner.name.text==='__DSC_RUNTIME_PROOF'&&ts.isIdentifier(owner.expression)&&owner.expression.text==='globalThis'){
          const [key,value,property]=n.arguments;
          if(n.questionDotToken||n.arguments.length!==3||!ts.isStringLiteral(key)||!ts.isStringLiteral(property)||!expected.has(key.text)||expected.get(key.text)!.property!==property.text||seen.has(key.text))fail('context-target-read-unplanned');
          // A property-producing import wrapper would add another lookup. Only
          // the actual resolved lexical read is covered by this proof.
          if(!ts.isIdentifier(value))fail('context-target-object-binding-nonlexical');
          binding(value);seen.add((key as ts.StringLiteral).text);
        }
      }
      ts.forEachChild(n,inspect);
    };inspect(sf);
    if(seen.size!==expected.size)fail('context-target-coverage-incomplete');
    contextTargets={reads:seen.size};
  }
  const contextConsumerCallees:string[]=[];
  if(plan.contextConsumerCalls?.length){
    const expected=new Map(plan.contextConsumerCalls.map(p=>[helperPointKey(p.call),p])),seen=new Set<string>();
    const marker=(n:ts.Node,name:string):n is ts.CallExpression=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text===name&&ts.isPropertyAccessExpression(n.expression.expression)&&n.expression.expression.name.text==='__DSC_RUNTIME_PROOF'&&ts.isIdentifier(n.expression.expression.expression)&&n.expression.expression.expression.text==='globalThis';
    const inspect=(n:ts.Node)=>{
      if(marker(n,'contextConsumerCall')){
        const [site,callee]=n.arguments;
        if(n.questionDotToken||n.arguments.length!==3||!ts.isStringLiteral(site)||!expected.has(site.text)||seen.has(site.text))return fail('context-consumer-call-unplanned');
        seen.add(site.text);let value=unwrap(callee);
        if(marker(value,'contextBindingRead')){
          const [read,actual]=value.arguments;
          if(value.arguments.length===2&&ts.isStringLiteral(read)&&plan.contextBindings?.reads.some(p=>helperPointKey(p.read)===read.text&&helperPointKey(p.read)===helperPointKey(expected.get(site.text)!.callee)))value=unwrap(actual);
        }
        if(ts.isIdentifier(value)){binding(value);contextConsumerCallees.push(site.text);}
      }
      ts.forEachChild(n,inspect);
    };inspect(sf);
    if(seen.size!==expected.size)fail('context-consumer-coverage-incomplete');
  }
  const expected=new Map<string,string>();
  for(const model of plan.models)for(const target of model.jsxTargets){
    const key=helperPointKey(target.read),value=helperPointKey(target.binding);
    if(expected.has(key)&&expected.get(key)!==value)fail('read-binding-ambiguous');expected.set(key,value);
  }
  const targetKeys=new Set(plan.targets.map(d=>helperPointKey({file:d.module,sha256:d.sourceSha256,...d.span})));
  const registered=new Map<string,ReturnType<typeof binding>>(),reads=new Map<string,{binding:ReturnType<typeof binding>;node:ts.CallExpression}>();
  const walk=(node:ts.Node)=>{
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
      const method=node.expression,owner=method.expression;
      if(ts.isPropertyAccessExpression(owner)&&owner.name.text==='__DSC_RUNTIME_PROOF'&&ts.isIdentifier(owner.expression)&&owner.expression.text==='globalThis'){
        if(method.name.text==='targetJsx')fail('marker-not-erased');
        if(['registerTarget','targetRead'].includes(method.name.text)){
          const shadow=checker.getSymbolAtLocation(owner.expression);
          if(shadow?.declarations?.some(d=>!(ts.isIdentifier(d)&&(ts.isPropertyAccessExpression(d.parent)||ts.isElementAccessExpression(d.parent))&&d.parent.expression===d)))fail('global-shadowed');
          const key=node.arguments[0];if(!key||!ts.isStringLiteral(key)||node.questionDotToken||method.questionDotToken||owner.questionDotToken)fail('call-unmodeled');
          const id=(key as ts.StringLiteral).text;
          if(method.name.text==='registerTarget'){
            if(node.arguments.length!==3||!targetKeys.has(id)||registered.has(id))fail('registration-unplanned-or-duplicate');
            const value=binding(node.arguments[1]),read=callback(node.arguments[2]);if(value.symbol!==read.symbol)fail('registration-binding-differs');registered.set(id,read);
          }else{
            if(node.arguments.length!==2||!expected.has(id)||reads.has(id))fail('read-unplanned-or-duplicate');
            reads.set(id,{binding:lookup(node.arguments[1]),node});
          }
        }
      }
    }
    ts.forEachChild(node,walk);
  };walk(sf);
  if(registered.size!==targetKeys.size||reads.size!==expected.size)fail('coverage-incomplete');
  const result:ReactJsxLookupProof['reads']=[];
  for(const [read,key] of expected){
    const actual=reads.get(read),target=registered.get(key);if(!actual||!target||actual.binding.symbol!==target.symbol)fail('read-binding-differs');
    result.push({read,binding:key,span:{start:actual!.node.getStart(sf),end:actual!.node.end},bindingSpan:{start:target!.declaration.getStart(sf),end:target!.declaration.end}});
  }
  let output=javascript;edits.sort((a,b)=>b.start-a.start);let last=javascript.length;for(const edit of edits){if(edit.end>last)fail('instrumentation-overlap');output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);last=edit.start;}
  const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
  return {javascript:output,proof:{version:1,acceptedContract:null,effectsVerified:false,qualification:'bundled-esm-binding-reads-only',status:'verified',sourceJavascriptSha256:sha(javascript),javascriptSha256:sha(output),namespaces:namespaces.size,reads:result,...(contextImports?{contextImports}:{}),...(callbackHooks.size?{callbackHookReads}:{}),...(refHooks.size?{refHookReads}:{}),...(effectHooks.size?{effectHookReads}:{}),...(helperHooks.size?{helperHookReads}:{}),...(contextTargets?{contextTargets}:{}),...(plan.contextConsumerCalls?.length?{contextConsumerCallees}:{})}};
}
