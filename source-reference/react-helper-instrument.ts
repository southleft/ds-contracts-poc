import type {ReactConsumerLiteral} from './react-consumer-literals.js';
import type {ReactHookHelpers} from './react-hook-helpers.js';
import type {ReactCallbackFactories} from './react-callback-factories.js';
import {targetProjectionParts} from './react-target-projection.js';
import ts from "typescript";
import { createHash } from "node:crypto";
import type {
  HelperModelResult,
  ComponentModelResult,
  JsxModelResult,
  HelperSourcePoint,
} from "./react-helper-model.mjs";

type Model = Extract<
  HelperModelResult | ComponentModelResult,
  { status: "modeled" }
>;
export type ReactHelperInstrumentationPlan = {
  kind?: "helper";
  models: readonly Model[];
  call: HelperSourcePoint;
  helper: HelperSourcePoint;
  metadata: readonly HelperSourcePoint[];
  component?: HelperSourcePoint;
};
export interface ReactJsxHelperInstrumentationPlan {
  kind: "jsx-component";
  models: readonly Extract<JsxModelResult,{status:"modeled"}>[];
  component: HelperSourcePoint;
  targets: readonly import("./react-runtime-export.js").ReactRuntimeExportDefinition[];
  initializers?: readonly import("./react-target-initializer.js").ReactTargetInitializer[];
  targetEffects?: readonly import("./react-target-effects.js").ReactTargetEffects[];
  callbackPlans?: readonly import("./react-target-callback-plan.js").ReactTargetCallbackPlan[];
  callbackValues?: readonly import("./react-target-callback-values.js").ReactTargetCallbackValues[];
  contextCalls?: readonly import("./react-context-calls.js").ReactContextCall[];
  contextRests?: readonly import("./react-context-calls.js").ReactContextRest[];
  contextHelpers?: readonly import("./react-context-calls.js").ReactContextHelper[];
  contextConsumerCalls?: readonly import("./react-context-calls.js").ReactContextConsumerCall[];
  contextBindings?: import("./react-context-calls.js").ReactContextBindings;
  callbackFactories?:ReactCallbackFactories;
  hookHelpers?:ReactHookHelpers;
  consumerLiterals?:ReactConsumerLiteral[];
  effectHooks?: import("./react-effect-hooks.js").ReactEffectHook[];
  refHooks?: import("./react-ref-hooks.js").ReactRefHook[];
  callbackSources?: import("./react-callback-sources.js").ReactCallbackSources;
  contextTargets?: import("./react-context-calls.js").ReactContextTargets;
  contextFactories?: readonly import("./react-context-calls.js").ReactContextFactoryCall[];
}
export type ReactEffectInstrumentationPlan = ReactHelperInstrumentationPlan | ReactJsxHelperInstrumentationPlan;
export const helperPointKey = (p: HelperSourcePoint) =>
  JSON.stringify([p.file, p.sha256, p.start, p.end]);

/** Compiler-owned registration only; never edits installed source files.
 * The host must separately compare the complete original/instrumented render.
 * A plan or successful transform does not admit caller content. */
export function instrumentReactHelperSource(
  text: string,
  file: string,
  plan: ReactEffectInstrumentationPlan,
): string {
  const sha256 = createHash("sha256").update(text).digest("hex");
  const helper = plan.kind === "jsx-component" ? undefined : plan;
  const initializers=plan.kind==='jsx-component'?plan.initializers??[]:[];
  const projection=targetProjectionParts(plan.kind==='jsx-component'?plan.targetEffects??[]:[]);
  const callbackPlans=plan.kind==='jsx-component'?plan.callbackPlans??[]:[];
  const callbackSources=plan.kind==='jsx-component'?plan.callbackSources:undefined;
  const effectHooks=new Map((plan.kind==='jsx-component'?plan.effectHooks??[]:[]).map(p=>[helperPointKey(p.call),p]));
  const refHooks=new Map((plan.kind==='jsx-component'?plan.refHooks??[]:[]).map(p=>[helperPointKey(p.call),p]));
  const callbackSourceHooks=new Map((callbackSources?.hooks??[]).map(p=>[helperPointKey(p.call),p]));
  const callbackSourceFunctions=new Map((callbackSources?.functions??[]).map(p=>[helperPointKey(p.source),p]));
  const callbackSourceReturns=new Set([...callbackSourceFunctions.values()].flatMap(p=>p.returns.map(helperPointKey)));
  const callbackSourceCalls=new Map((callbackSources?.calls??[]).map(p=>[helperPointKey(p.call),p]));
  const callbackSourceLiterals=new Map((callbackSources?.callbacks??[]).map(p=>[helperPointKey(p.source),p]));
  const contextRests=new Map((plan.kind==='jsx-component'?plan.contextRests??[]:[]).map(p=>[helperPointKey(p.binding),p]));
  const contextRestStatements=new Map<ts.Node,Array<{key:string;name:string}>>();
  const contextCalls=new Map((plan.kind==='jsx-component'?plan.contextCalls??[]:[]).map(p=>[helperPointKey(p.call),p]));
  const contextHelpers=new Map((plan.kind==='jsx-component'?plan.contextHelpers??[]:[]).map(p=>[helperPointKey(p.source),p]));
  const contextHelperReads=new Map([...contextHelpers.values()].flatMap(h=>(h.closureReads??[]).map(r=>[helperPointKey(r.read),r] as const)));
  const contextReturns=new Set([...contextHelpers.values()].flatMap(p=>p.returns.map(helperPointKey)));
  const contextConsumers=new Map((plan.kind==='jsx-component'?plan.contextConsumerCalls??[]:[]).map(p=>[helperPointKey(p.call),p]));
  const contextBindingReads=new Map((plan.kind==='jsx-component'?plan.contextBindings?.reads??[]:[]).map(p=>[helperPointKey(p.read),p]));
  const contextBindingFunctions=new Map((plan.kind==='jsx-component'?plan.contextBindings?.functions??[]:[]).map(p=>[helperPointKey(p.source),p]));
  const contextTargetReads=new Map((plan.kind==='jsx-component'?plan.contextTargets?.reads??[]:[]).map(p=>[helperPointKey(p.read),p]));
  const contextObjects=new Set((plan.kind==='jsx-component'?plan.contextTargets?.objects??[]:[]).map(helperPointKey));
  const contextFactories=new Map((plan.kind==='jsx-component'?plan.contextFactories??[]:[]).map(p=>[helperPointKey(p.call),p]));
  const callbackBindings=new Map((plan.kind==='jsx-component'?plan.callbackValues??[]:[]).flatMap(p=>p.projection.jsxTargets.map(t=>[helperPointKey(t.binding),t.binding] as const)));
  const callbackDeclarations=new Map<ts.Node,Array<{key:string;name:string}>>();
  const callbackCalls=new Set(callbackPlans.map(p=>helperPointKey(p.call))),callbackObjects=new Set(callbackPlans.map(p=>helperPointKey(p.input))),callbackFactories=new Set(callbackPlans.flatMap(p=>p.factories.map(f=>helperPointKey(f.source))));
  const projectionCallbacks=new Map(projection.callbacks.map(c=>[helperPointKey(c.source),c]));
  const projectionBindings=new Set(projection.bindings.map(helperPointKey)),projectionCaptures=new Set(projection.captures.map(helperPointKey)),projectionFactories=new Set(projection.factories.map(helperPointKey));
  const projectionRests=new Map<ts.Node,Array<{name:string;key:string}>>();
  const consumerLiterals=new Map((plan.kind==='jsx-component'?plan.consumerLiterals??[]:[]).map(p=>[helperPointKey(p.source),p]));
  const helperPlans=plan.kind==='jsx-component'?plan.hookHelpers:undefined;
  const helperFunctions=new Map((helperPlans?.functions??[]).map(p=>[helperPointKey(p.source),p]));
  const helperReturns=new Map((helperPlans?.functions??[]).map(p=>[helperPointKey(p.returned),p]));
  const helperHooks=new Map((helperPlans?.functions??[]).flatMap(p=>p.hooks.map(h=>[helperPointKey(h.call),h] as const)));
  const factoryPlans=plan.kind==='jsx-component'?plan.callbackFactories:undefined;
  const factoryFunctions=new Map((factoryPlans?.functions??[]).map(p=>[helperPointKey(p.source),p]));
  const factoryCallbacks=new Map((factoryPlans?.functions??[]).map(p=>[helperPointKey(p.callback),p]));
  const factoryReturns=new Map((factoryPlans?.functions??[]).map(p=>[helperPointKey(p.returned),p]));
  const factoryArguments=new Map((factoryPlans?.literals??[]).map(p=>[helperPointKey(p.source),p]));
  const factoryNamers=new Map((factoryPlans?.functions??[]).flatMap(p=>p.naming?[[helperPointKey(p.naming.helper),p.naming] as const]:[]));
  const factoryNames=new Map((factoryPlans?.functions??[]).flatMap(p=>p.naming?[[helperPointKey(p.naming.call),p.naming] as const]:[]));
  const points = [
    ...[...consumerLiterals.values()].flatMap(p=>[p.source,p.consumer]),
    ...(helperPlans?.functions??[]).flatMap(p=>[p.source,p.returned,...p.parameters.map(p=>p.source),...p.hooks.flatMap(h=>[h.call,h.callee,...(h.callback?[h.callback]:[]),...(h.dependencies?[h.dependencies]:[])])]),
    ...(factoryPlans?.functions??[]).flatMap(p=>[p.source,p.returned,p.callback,...p.parameters.flatMap(p=>p.bindings.map(b=>b.source)),...(p.naming?[p.naming.call,p.naming.helper,p.naming.nativeAlias]:[])]),
    ...(factoryPlans?.literals??[]).map(p=>p.source),
    ...[...effectHooks.values()].flatMap(p=>[p.call,p.callee,p.consumer,p.callback,p.dependencies]),
    ...[...refHooks.values()].flatMap(p=>[p.call,p.callee,p.consumer]),
    ...[...callbackSourceHooks.values()].flatMap(p=>[p.call,p.callee]),
    ...[...callbackSourceFunctions.values()].flatMap(p=>[p.source,...p.parameters.map(p=>p.binding),...p.returns]),
    ...[...callbackSourceCalls.values()].flatMap(p=>[p.call,p.callee]),
    ...[...callbackSourceLiterals.values()].map(p=>p.source),
    ...(plan.kind==='jsx-component'?plan.contextTargets?.objects??[]:[]),
    ...[...contextTargetReads.values()].flatMap(r=>[r.read,r.object,r.consumer]),
    ...[...contextHelperReads.values()].map(r=>r.read),
    ...[...contextBindingReads.values()].flatMap(p=>[p.read,p.binding,p.consumer]),
    ...[...contextBindingFunctions.values()].map(p=>p.source),
    ...[...contextFactories.values()].flatMap(p=>[p.call,p.callee,p.consumer,...p.arguments]),
    ...[...contextConsumers.values()].flatMap(p=>[p.call,p.callee,p.consumer,...p.arguments]),
    ...[...contextHelpers.values()].flatMap(p=>[p.source,...p.returns]),
    ...[...contextRests.values()].map(p=>p.binding),
    ...[...contextCalls.values()].map(p=>p.call),
    ...callbackBindings.values(),
    ...callbackPlans.flatMap(p=>[p.call,p.input,...p.factories.map(f=>f.source)]),
    ...projection.callbacks.map(c=>c.source),...projection.bindings,...projection.captures,...projection.factories,
    ...(helper ? [helper.call, helper.helper, ...helper.metadata] : []),
    ...(plan.component ? [plan.component] : []),
    ...(plan.kind === "jsx-component" ? plan.models.flatMap(m=>m.jsxTargets.flatMap(t=>[t.site,t.read])) : []),
    ...initializers.flatMap(p=>[p.call,p.render,...(p.naming?[p.naming.call,p.naming.helper,p.naming.nativeAlias]:[])]),
    ...plan.models.flatMap((m) => [
      ...m.definitions,
      ...m.calls.flatMap((c) => (c.site ? [c.site] : [])),
      ...m.runtimeBindings.bindings.map((b) => b.binding),
    ]),
  ];
  const local = points.filter((p) => p.file === file);
  if (!local.length) return text;
  if (local.some((p) => p.sha256 !== sha256))
    throw Error("helper-instrument-source-changed");
  if (text.includes("__DSC_"))
    throw Error("helper-instrument-reserved-binding");
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    /\.[cm]?js$/.test(file)
      ? ts.ScriptKind.JS
      : file.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
  );
  const point = (n: ts.Node): HelperSourcePoint => ({
    file,
    sha256,
    start: n.getStart(sf),
    end: n.end,
  });
  const key = (n: ts.Node) => helperPointKey(point(n));
  const definitions = new Set(
    plan.models.flatMap((m) => m.definitions.map(helperPointKey)),
  );
  const calls = new Set(
    plan.models.flatMap((m) =>
      m.calls.flatMap((c) => (c.site ? [helperPointKey(c.site)] : [])),
    ),
  );
  const bindings = new Map(
    plan.models.flatMap((m) =>
      m.runtimeBindings.bindings.map(
        (b) => [helperPointKey(b.binding), b] as const,
      ),
    ),
  );
  const metadata = new Map((helper?.metadata ?? []).map((p, i) => [helperPointKey(p), i]));
  const targetSites = new Map(plan.kind === "jsx-component" ? plan.models.flatMap(m=>m.jsxTargets.map(t=>[helperPointKey(t.site),t] as const)) : []);
  const f = ts.factory;
  const api = (method: string, args: ts.Expression[]) =>
    f.createCallExpression(
      f.createPropertyAccessExpression(
        f.createPropertyAccessExpression(
          f.createIdentifier("globalThis"),
          "__DSC_RUNTIME_PROOF",
        ),
        method,
      ),
      undefined,
      args,
    );
  const literal = (value: string) => f.createStringLiteral(value);
  const arrow = (body: ts.Expression) =>
    f.createArrowFunction(
      undefined,
      undefined,
      [],
      undefined,
      f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      body,
    );
  const preludes = new Map<ts.Node, ts.Statement[]>(),
    found = new Set<string>();
  const prepend = (scope: ts.Node, expression: ts.Expression) => {
    if (!ts.isSourceFile(scope) && !ts.isBlock(scope))
      throw Error("helper-instrument-scope-unmodeled");
    const items = preludes.get(scope) ?? [];
    items.push(f.createExpressionStatement(expression));
    preludes.set(scope, items);
  };
  function inspect(n: ts.Node) {
    const k = key(n);
    if (local.some((p) => helperPointKey(p) === k)) found.add(k);
    const helperFunction=helperFunctions.get(k);
    if(helperFunction&&ts.isFunctionDeclaration(n)){if(!n.name||n.name.text!==helperFunction.name||!ts.isSourceFile(n.parent))throw Error('hook-helper-declaration-changed');prepend(n.parent,api('helperRegister',[literal(k),f.createIdentifier(n.name.text)]));}
    const factoryFunction=factoryFunctions.get(k);
    if(factoryFunction&&ts.isFunctionDeclaration(n)){if(!n.name||n.name.text!==factoryFunction.name||!ts.isSourceFile(n.parent))throw Error('factory-declaration-changed');prepend(n.parent,api('factoryRegister',[literal(k),f.createIdentifier(n.name.text)]));}
    const contextBindingFunction=contextBindingFunctions.get(k);
    if(contextBindingFunction){
      if(!ts.isFunctionDeclaration(n)||!n.name||n.name.text!==contextBindingFunction.name||!ts.isSourceFile(n.parent))throw Error('context-binding-function-changed');
      prepend(n.parent,api('contextBindingFunction',[literal(k),f.createIdentifier(n.name.text)]));
    }
    const callbackSourceFunction=callbackSourceFunctions.get(k);
    if(callbackSourceFunction){
      if(!ts.isFunctionDeclaration(n)||!n.name||n.name.text!==callbackSourceFunction.name||!n.body)throw Error('callback-source-declaration-changed');
      prepend(n.parent,api('callbackSourceRegister',[literal(k),f.createIdentifier(n.name.text)]));
    }
    const contextHelper=contextHelpers.get(k);
    if(contextHelper){
      if(!ts.isFunctionDeclaration(n)||!n.name||n.name.text!==contextHelper.name||!n.body)throw Error('context-helper-declaration-changed');
      prepend(n.parent,api('contextHelperRegister',[literal(k),f.createIdentifier(n.name.text)]));
    }
    const contextRest=contextRests.get(k);
    if(contextRest){
      if(!ts.isBindingElement(n)||!n.dotDotDotToken||!ts.isIdentifier(n.name)||n.name.text!==contextRest.name||!ts.isObjectBindingPattern(n.parent))throw Error('context-rest-binding-changed');
      const declaration=n.parent.parent,list=declaration.parent,statement=list.parent;
      if(!ts.isVariableDeclaration(declaration)||key(declaration)!==helperPointKey(contextRest.declaration)||!declaration.initializer||key(declaration.initializer)!==helperPointKey(contextRest.input)||!ts.isVariableDeclarationList(list)||!(list.flags&ts.NodeFlags.Const)||list.declarations.length!==1||!ts.isVariableStatement(statement))throw Error('context-rest-declaration-changed');
      contextRestStatements.set(statement,[{key:k,name:n.name.text}]);
    }
    if(callbackBindings.has(k)){
      if(!ts.isVariableDeclaration(n)||!ts.isIdentifier(n.name)||!ts.isVariableDeclarationList(n.parent)||!ts.isVariableStatement(n.parent.parent)||!ts.isSourceFile(n.parent.parent.parent))throw Error('target-callback-component-binding-unmodeled');
      const statement=n.parent.parent,rows=callbackDeclarations.get(statement)??[];rows.push({key:k,name:n.name.text});callbackDeclarations.set(statement,rows);
    }
    if(projectionBindings.has(k)){
      if(!ts.isFunctionDeclaration(n)||!n.name||!ts.isSourceFile(n.parent))throw Error('target-projection-binding-source-unmodeled');
      prepend(n.parent,api('targetProjectionBinding',[literal(k),f.createIdentifier(n.name.text),arrow(f.createIdentifier(n.name.text))]));
    }
    if(projectionCaptures.has(k)&&ts.isBindingElement(n)&&n.dotDotDotToken){
      const pattern=n.parent,declaration=pattern.parent;
      if(!ts.isObjectBindingPattern(pattern)||!ts.isIdentifier(n.name))throw Error('target-projection-rest-source-unmodeled');
      if(ts.isParameter(declaration)){
        const fn=declaration.parent;
        if(!(ts.isFunctionExpression(fn)||ts.isArrowFunction(fn))||declaration!==fn.parameters[0]||declaration.initializer||declaration.dotDotDotToken||!fn.body||!ts.isBlock(fn.body)||!initializers.some(p=>helperPointKey(p.render)===key(fn)))throw Error('target-projection-rest-parameter-unmodeled');
        prepend(fn.body,api('targetProjectionRest',[literal(k),f.createIdentifier(n.name.text)]));
      }else{
        const list=declaration.parent,statement=list.parent;
        if(!ts.isVariableDeclaration(declaration)||!ts.isVariableDeclarationList(list)||!(list.flags&ts.NodeFlags.Const)||!ts.isVariableStatement(statement))throw Error('target-projection-rest-source-unmodeled');
        const rows=projectionRests.get(statement)??[];rows.push({name:n.name.text,key:k});projectionRests.set(statement,rows);
      }
    }
    if (ts.isFunctionDeclaration(n) && definitions.has(k)) {
      if (!n.name) throw Error("helper-instrument-anonymous-declaration");
      prepend(
        n.parent,
        api("sourceFunction", [literal(k), f.createIdentifier(n.name.text)]),
      );
    }
    if (ts.isFunctionDeclaration(n) && helper && k === helperPointKey(helper.helper)) {
      if (!n.name) throw Error("helper-instrument-helper-unbound");
      prepend(
        n.parent,
        api("registerHelper", [f.createIdentifier(n.name.text)]),
      );
    }
    const b = bindings.get(k);
    if (b && ts.SyntaxKind[n.kind] === b.declarationKind) {
      let scope: ts.Node;
      if (ts.isFunctionDeclaration(n)) scope = n.parent;
      else if (ts.isImportClause(n) && ts.isImportDeclaration(n.parent))
        scope = n.parent.parent;
      else if (
        ts.isVariableDeclaration(n) &&
        ts.isVariableDeclarationList(n.parent) &&
        ts.isVariableStatement(n.parent.parent)
      )
        scope = n.parent.parent.parent;
      else if (
        ts.isParameter(n) &&
        (ts.isFunctionDeclaration(n.parent) ||
          ts.isFunctionExpression(n.parent) ||
          ts.isArrowFunction(n.parent)) &&
        n.parent.body &&
        ts.isBlock(n.parent.body)
      )
        scope = n.parent.body;
      else throw Error("helper-instrument-binding-unmodeled");
      prepend(
        scope,
        api("binding", [literal(k), arrow(f.createIdentifier(b.name))]),
      );
    }
    ts.forEachChild(n, inspect);
  }
  inspect(sf);
  if (local.some((p) => !found.has(helperPointKey(p))))
    throw Error("helper-instrument-point-missing");
  const result = ts.transform(sf, [
    (context) => {
      const visit:ts.Visitor=(n)=>{
        const value=transformNode(n),plan=consumerLiterals.get(key(n));if(!plan)return value;
        if(!value||Array.isArray(value)||!(ts.isObjectLiteralExpression(n)||ts.isArrayLiteralExpression(n)))throw Error('consumer-literal-site-changed');
        return api('consumerLiteral',[literal(key(n)),value as ts.Expression]);
      };
      const transformNode: ts.Visitor = (n) => {
        const k = key(n);
        // A shorthand key is grammar, not an expression position. Preserve its
        // spelling while observing only the original value read.
        if(ts.isShorthandPropertyAssignment(n)&&(contextBindingReads.has(key(n.name))||contextHelperReads.has(key(n.name)))){
          if(n.objectAssignmentInitializer)throw Error('context-binding-shorthand-initializer-unmodeled');
          return f.createPropertyAssignment(n.name,api(contextHelperReads.has(key(n.name))?'contextHelperRead':'contextBindingRead',[literal(key(n.name)),n.name]));
        }
        let updated = ts.visitEachChild(n, visit, context);
        if(contextBindingReads.has(k)||contextHelperReads.has(k)){
          if(!ts.isIdentifier(n)&&!ts.isTypeOfExpression(n))throw Error('context-binding-read-changed');
          return api(contextHelperReads.has(k)?'contextHelperRead':'contextBindingRead',[literal(k),updated as ts.Expression]);
        }
        if(factoryArguments.has(k))return api('factoryArgument',[literal(k),updated as ts.Expression]);
        if(factoryCallbacks.has(k)){if(!ts.isFunctionExpression(updated)&&!ts.isArrowFunction(updated))throw Error('factory-literal-changed');return api('factoryLiteral',[literal(k),updated]);}
        const factoryName=factoryNames.get(k);
        if(factoryName){if(!ts.isCallExpression(updated))throw Error('factory-name-changed');return api('factoryName',[literal(k),updated.expression,...updated.arguments]);}
        const factoryNamer=factoryNamers.get(k);
        if(factoryNamer){if(!ts.isArrowFunction(updated))throw Error('factory-naming-changed');const named=f.createElementAccessExpression(f.createParenthesizedExpression(f.createObjectLiteralExpression([f.createPropertyAssignment(literal(factoryNamer.helperName),updated)])),literal(factoryNamer.helperName));const registered=api('factoryNamingHelper',[literal(k),definitions.has(k)?api('sourceFunction',[literal(k),named]):named,arrow(f.createIdentifier(factoryNamer.nativeName))]);return initializers.some(p=>p.naming&&helperPointKey(p.naming.helper)===k)?api('targetNamingHelper',[literal(k),registered,arrow(f.createIdentifier(factoryNamer.nativeName))]):registered;}
        if(factoryReturns.has(k)){if(!ts.isReturnStatement(updated)||!updated.expression)throw Error('factory-return-changed');return f.updateReturnStatement(updated,api('factoryReturn',[f.createIdentifier('__DSC_FACTORY_FRAME'),updated.expression]));}
        const factoryFunction=factoryFunctions.get(k);
        if(factoryFunction&&ts.isFunctionDeclaration(n)){
          if(!ts.isFunctionDeclaration(updated)||!updated.name||!updated.body||callbackSourceFunctions.has(k)||contextHelpers.has(k))throw Error('factory-function-changed-or-overlapping');
          const frame=f.createIdentifier('__DSC_FACTORY_FRAME'),body=f.createBlock([
            f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(frame,undefined,undefined,api('factoryBegin',[literal(k),updated.name,f.createArrayLiteralExpression(factoryFunction.parameters.flatMap(p=>p.bindings.map(b=>f.createIdentifier(b.name))))]))],ts.NodeFlags.Const)),
            f.createTryStatement(updated.body,undefined,f.createBlock([f.createExpressionStatement(api('factoryEnd',[frame]))],true))],true);
          updated=f.updateFunctionDeclaration(updated,updated.modifiers,updated.asteriskToken,updated.name,updated.typeParameters,updated.parameters,updated.type,body);
        }
        const callbackSourceLiteral=callbackSourceLiterals.get(k);
        if(callbackSourceLiteral){
          if(!(ts.isArrowFunction(updated)||ts.isFunctionExpression(updated)))throw Error('callback-source-literal-changed');
          // A direct returned literal has no inferred name. Its identity and
          // original body survive this value registration unchanged.
          return api('callbackSourceLiteral',[literal(k),updated,f.createArrayLiteralExpression(callbackSourceLiteral.captures.map(c=>f.createIdentifier(c.name)))]);
        }
        if(callbackSourceReturns.has(k)){
          if(!ts.isReturnStatement(updated))throw Error('callback-source-return-changed');
          return f.updateReturnStatement(updated,api('callbackSourceReturn',[f.createIdentifier('__DSC_CALLBACK_SOURCE_FRAME'),literal(k),updated.expression??f.createVoidZero()]));
        }
        const callbackSourceFunction=callbackSourceFunctions.get(k);
        if(callbackSourceFunction){
          if(!ts.isFunctionDeclaration(updated)||!updated.name||!updated.body)throw Error('callback-source-function-changed');
          const frame=f.createIdentifier('__DSC_CALLBACK_SOURCE_FRAME'),statements=[...updated.body.statements];let directiveCount=0;
          while(directiveCount<statements.length&&ts.isExpressionStatement(statements[directiveCount])&&ts.isStringLiteral((statements[directiveCount] as ts.ExpressionStatement).expression))directiveCount++;
          const body=f.createBlock([...statements.slice(0,directiveCount),
            f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(frame,undefined,undefined,api('callbackSourceBegin',[literal(k),updated.name,f.createArrayLiteralExpression(callbackSourceFunction.parameters.map(p=>f.createIdentifier(p.name)))]))],ts.NodeFlags.Const)),
            f.createTryStatement(f.createBlock([...statements.slice(directiveCount),f.createExpressionStatement(api('callbackSourceReturn',[frame,f.createNull(),f.createVoidZero()]))],true),undefined,
              f.createBlock([f.createExpressionStatement(api('callbackSourceEnd',[frame]))],true))],true);
          updated=f.updateFunctionDeclaration(updated,updated.modifiers,updated.asteriskToken,updated.name,updated.typeParameters,updated.parameters,updated.type,body);
        }
        if(helperReturns.has(k)){
          if(!ts.isReturnStatement(updated))throw Error('hook-helper-return-changed');
          return f.updateReturnStatement(updated,api('helperReturn',[f.createIdentifier('__DSC_HOOK_HELPER_FRAME'),updated.expression??f.createVoidZero()]));
        }
        const helperFunction=helperFunctions.get(k);
        if(helperFunction&&ts.isFunctionDeclaration(n)){
          if(!ts.isFunctionDeclaration(updated)||!updated.name||!updated.body||factoryFunctions.has(k)||callbackSourceFunctions.has(k)||contextHelpers.has(k))throw Error('hook-helper-function-overlap');
          const frame=f.createIdentifier('__DSC_HOOK_HELPER_FRAME'),body=f.createBlock([
            f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(frame,undefined,undefined,api('helperBegin',[literal(k),updated.name,f.createArrayLiteralExpression(helperFunction.parameters.map(p=>f.createIdentifier(p.name)))]))],ts.NodeFlags.Const)),
            f.createTryStatement(updated.body,undefined,f.createBlock([f.createExpressionStatement(api('helperEnd',[frame]))],true))],true);
          updated=f.updateFunctionDeclaration(updated,updated.modifiers,updated.asteriskToken,updated.name,updated.typeParameters,updated.parameters,updated.type,body);
        }
        const helperHook=helperHooks.get(k);
        if(helperHook){
          if(!ts.isCallExpression(updated)||updated.questionDotToken||updated.arguments.some(ts.isSpreadElement))throw Error('helper-hook-call-changed');
          let callee:ts.Expression=updated.expression;while(ts.isParenthesizedExpression(callee))callee=callee.expression;
          let token:ts.Expression;
          if(helperHook.receiver==='bare'){
            if(!ts.isIdentifier(callee))throw Error('helper-hook-callee-changed');token=api('helperHookValue',[literal(k),callee]);
          }else{
            if(!ts.isPropertyAccessExpression(callee)||callee.questionDotToken||callee.name.text!==helperHook.hook||!ts.isIdentifier(callee.expression))throw Error('helper-hook-callee-changed');
            token=api('helperHookRead',[literal(k),callee.expression,f.createTrue()]);
          }
          const args=helperHook.kind==='state'?updated.arguments:[api('helperHookLiteral',[literal(k),updated.arguments[0]]),api('helperHookDependencies',[literal(k),updated.arguments[1]])];
          return api('helperHookCall',[literal(k),token,arrow(f.createArrayLiteralExpression(args))]);
        }
        const effectHook=effectHooks.get(k);
        if(effectHook){
          if(!ts.isCallExpression(updated)||updated.questionDotToken||updated.arguments.length!==2||updated.arguments.some(ts.isSpreadElement))throw Error('effect-source-hook-changed');
          let callee:ts.Expression=updated.expression;while(ts.isParenthesizedExpression(callee))callee=callee.expression;
          let token:ts.Expression;
          if(effectHook.receiver==='bare'){
            if(!ts.isIdentifier(callee))throw Error('effect-source-callee-changed');token=api('effectHookValue',[literal(k),callee]);
          }else{
            if(!ts.isPropertyAccessExpression(callee)||callee.questionDotToken||callee.name.text!==effectHook.hook||!ts.isIdentifier(callee.expression))throw Error('effect-source-callee-changed');
            token=api('effectHookRead',[literal(k),callee.expression,f.createTrue()]);
          }
          return api('effectHookCall',[literal(k),token,arrow(f.createArrayLiteralExpression([api('effectLiteral',[literal(k),updated.arguments[0]]),api('effectDependencies',[literal(k),updated.arguments[1]])]))]);
        }
        const refHook=refHooks.get(k);
        if(refHook){
          if(!ts.isCallExpression(updated)||updated.questionDotToken||updated.arguments.length!==1||updated.arguments.some(ts.isSpreadElement))throw Error('ref-source-hook-changed');
          let callee:ts.Expression=updated.expression;while(ts.isParenthesizedExpression(callee))callee=callee.expression;
          let token:ts.Expression;
          if(refHook.receiver==='bare'){
            if(!ts.isIdentifier(callee))throw Error('ref-source-callee-changed');token=api('refHookValue',[literal(k),callee]);
          }else{
            if(!ts.isPropertyAccessExpression(callee)||callee.questionDotToken||callee.name.text!=='useRef'||!ts.isIdentifier(callee.expression))throw Error('ref-source-callee-changed');
            token=api('refHookRead',[literal(k),callee.expression,f.createTrue()]);
          }
          return api('refHookCall',[literal(k),token,arrow(f.createArrayLiteralExpression(updated.arguments))]);
        }
        const callbackSourceHook=callbackSourceHooks.get(k);
        if(callbackSourceHook){
          if(!ts.isCallExpression(updated)||updated.questionDotToken||updated.arguments.length!==2||updated.arguments.some(ts.isSpreadElement))throw Error('callback-source-hook-changed');
          let callee:ts.Expression=updated.expression;while(ts.isParenthesizedExpression(callee))callee=callee.expression;
          let token:ts.Expression;
          if(callbackSourceHook.receiver==='bare'){
            if(!ts.isIdentifier(callee))throw Error('callback-source-hook-callee-changed');
            token=api('callbackSourceHookValue',[literal(k),callee]);
          }else{
            if(!ts.isPropertyAccessExpression(callee)||callee.questionDotToken||callee.name.text!=='useCallback'||!ts.isIdentifier(callee.expression))throw Error('callback-source-hook-callee-changed');
            token=api('callbackSourceHookRead',[literal(k),callee.expression,f.createTrue()]);
          }
          return api('callbackSourceHookCall',[literal(k),token,arrow(f.createArrayLiteralExpression(updated.arguments))]);
        }
        if(callbackSourceCalls.has(k)){
          if(!ts.isCallExpression(updated)||updated.questionDotToken||calls.has(k)||contextConsumers.has(k)||contextFactories.has(k))throw Error('callback-source-call-overlapping');
          let callee:ts.Expression=updated.expression;while(ts.isParenthesizedExpression(callee))callee=callee.expression;
          if(!ts.isIdentifier(callee))throw Error('callback-source-callee-changed');
          return api('callbackSourceCall',[literal(k),callee,arrow(f.createArrayLiteralExpression(updated.arguments))]);
        }
        if(contextReturns.has(k)){
          if(!ts.isReturnStatement(updated))throw Error('context-helper-return-changed');
          return f.updateReturnStatement(updated,api('contextHelperReturn',[f.createIdentifier('__DSC_CONTEXT_FRAME'),literal(k),updated.expression??f.createVoidZero()]));
        }
        if(contextHelpers.has(k)){
          if(!ts.isFunctionDeclaration(updated)||!updated.name||!updated.body)throw Error('context-helper-function-changed');
          const frame=f.createIdentifier('__DSC_CONTEXT_FRAME'),statements=[...updated.body.statements];let directiveCount=0;
          while(directiveCount<statements.length&&ts.isExpressionStatement(statements[directiveCount])&&ts.isStringLiteral((statements[directiveCount] as ts.ExpressionStatement).expression))directiveCount++;
          const body=f.createBlock([...statements.slice(0,directiveCount),
            f.createVariableStatement(undefined,f.createVariableDeclarationList([f.createVariableDeclaration(frame,undefined,undefined,api('contextHelperBegin',[literal(k),updated.name]))],ts.NodeFlags.Const)),
            f.createTryStatement(f.createBlock([...statements.slice(directiveCount),f.createExpressionStatement(api('contextHelperReturn',[frame,f.createNull(),f.createVoidZero()]))],true),undefined,
              f.createBlock([f.createExpressionStatement(api('contextHelperEnd',[frame]))],true))],true);
          updated=f.updateFunctionDeclaration(updated,updated.modifiers,updated.asteriskToken,updated.name,updated.typeParameters,updated.parameters,updated.type,body);
        }
        const postfix=[
          ...(callbackDeclarations.get(n)??[]).map(d=>f.createExpressionStatement(api('targetCallbackBinding',[literal(d.key),f.createIdentifier(d.name),arrow(f.createIdentifier(d.name))]))),
          ...(projectionRests.get(n)??[]).map(d=>f.createExpressionStatement(api('targetProjectionRest',[literal(d.key),f.createIdentifier(d.name)]))),
          ...(contextRestStatements.get(n)??[]).map(d=>f.createExpressionStatement(api('contextRest',[literal(d.key),f.createIdentifier(d.name)]))),
        ];
        if(postfix.length)return [updated,...postfix];
        const contextFactory=contextFactories.get(k);
        if(contextFactory){
          if(!ts.isCallExpression(updated)||updated.questionDotToken||updated.arguments.length!==contextFactory.arguments.length||updated.arguments.some(ts.isSpreadElement)||calls.has(k))throw Error('context-factory-call-unmodeled-or-overlapping');
          let callee:ts.Expression=updated.expression;while(ts.isParenthesizedExpression(callee))callee=callee.expression;
          if(!ts.isIdentifier(callee))throw Error('context-factory-callee-changed');
          // Capture the original callee before evaluating any argument. The
          // compiler-owned arrow retains lexical this/arguments and executes
          // each original expression once, including nested JSX calls.
          updated=api('contextFactoryCall',[literal(k),callee,arrow(f.createArrayLiteralExpression(updated.arguments.map((a,i)=>api('contextFactoryArgument',[literal(k),f.createNumericLiteral(i),a]))))]);
        }
        if(callbackCalls.has(k)){
          if(!ts.isCallExpression(updated)||!ts.isIdentifier(updated.expression)||updated.arguments.length!==1||updated.questionDotToken)throw Error('target-callback-instrument-call-unmodeled');
          return api('targetCallbackInvoke',[literal(k),updated.expression,updated.arguments[0]]);
        }
        if(callbackObjects.has(k)){
          if(!ts.isObjectLiteralExpression(updated))throw Error('target-callback-instrument-input-unmodeled');
          return api('targetCallbackObject',[literal(k),updated]);
        }
        if(callbackFactories.has(k)){
          if(!ts.isCallExpression(updated))throw Error('target-callback-instrument-factory-unmodeled');
          return api('targetCallbackFactory',[literal(k),updated]);
        }
        if(projectionFactories.has(k)){
          if(!ts.isCallExpression(updated))throw Error('target-projection-factory-source-unmodeled');
          return api('targetProjectionResult',[literal(k),updated]);
        }
        if(contextObjects.has(k)){
          if(!ts.isObjectLiteralExpression(updated))throw Error('context-target-object-changed');
          return api('contextObject',[literal(k),updated]);
        }
        const targetRead=contextTargetReads.get(k);
        if(targetRead){
          if(!(ts.isPropertyAccessExpression(updated)||ts.isElementAccessExpression(updated)))throw Error('context-target-read-changed');
          return api('contextTargetRead',[literal(k),updated.expression,literal(targetRead.property)]);
        }
        const projectionCallback=projectionCallbacks.get(k);
        if(projectionCallback){
          if(!(ts.isArrowFunction(updated)||ts.isFunctionExpression(updated)))throw Error('target-projection-callback-source-unmodeled');
          let value:ts.Expression=updated;
          if(!ts.isFunctionExpression(updated)||!updated.name){
            const parent=n.parent;
            let name:string|undefined;
            if(ts.isPropertyAssignment(parent)||ts.isVariableDeclaration(parent)){
              if(ts.isIdentifier(parent.name)||ts.isStringLiteral(parent.name)||ts.isNumericLiteral(parent.name))name=parent.name.text;
              else throw Error('target-projection-inferred-name-unmodeled');
            }
            if(name!==undefined)value=f.createElementAccessExpression(f.createParenthesizedExpression(f.createObjectLiteralExpression([f.createPropertyAssignment(literal(name),value)])),literal(name));
          }
          if(definitions.has(k))value=api('sourceFunction',[literal(k),value]);
          return api('targetProjectionCallback',[literal(k),value,arrow(f.createArrayLiteralExpression(projectionCallback.captures.map(c=>f.createIdentifier(c.name))))]);
        }
        const target = targetSites.get(k);
        if(target){
          if(!(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)))throw Error('jsx-target-site-unmodeled');
          const tag=ts.isJsxElement(n)?n.openingElement.tagName:n.tagName;
          if(key(tag)!==helperPointKey(target.read))throw Error('jsx-target-read-site-changed');
          // Erased after JSX lowering. The actual tag expression is wrapped at
          // its original argument position, before props and child evaluation.
          const marker=api('targetJsx',[literal(helperPointKey(target.read)),updated as ts.Expression]);
          return ts.isJsxElement(n.parent)||ts.isJsxFragment(n.parent)?f.createJsxExpression(undefined,marker):marker;
        }
        if (plan.component && k === helperPointKey(plan.component)) {
          if (
            !(
              ts.isFunctionDeclaration(updated) ||
              ts.isFunctionExpression(updated) ||
              ts.isArrowFunction(updated)
            ) ||
            !updated.body ||
            (!ts.isBlock(updated.body) && plan.kind !== "jsx-component") ||
            updated.parameters.some(
              (p) =>
                !ts.isIdentifier(p.name) || p.dotDotDotToken || p.initializer,
            )
          )
            throw Error("component-instrument-function-unmodeled");
          const body = ts.isBlock(updated.body) ? updated.body : f.createBlock([f.createReturnStatement(updated.body)],true);
          const wrapped = f.createBlock(
            [
              f.createReturnStatement(
                api("component", [
                  literal(k),
                  f.createIdentifier(
                    (updated.parameters[0].name as ts.Identifier).text,
                  ),
                  f.createArrayLiteralExpression(
                    updated.parameters
                      .slice(1)
                      .map((p) =>
                        f.createIdentifier((p.name as ts.Identifier).text),
                      ),
                  ),
                  f.createArrowFunction(
                    undefined,
                    undefined,
                    [],
                    undefined,
                    f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                    body,
                  ),
                ]),
              ),
            ],
            true,
          );
          if (ts.isFunctionDeclaration(updated))
            updated = f.updateFunctionDeclaration(
              updated,
              updated.modifiers,
              updated.asteriskToken,
              updated.name,
              updated.typeParameters,
              updated.parameters,
              updated.type,
              wrapped,
            );
          else if (ts.isFunctionExpression(updated))
            updated = f.updateFunctionExpression(
              updated,
              updated.modifiers,
              updated.asteriskToken,
              updated.name,
              updated.typeParameters,
              updated.parameters,
              updated.type,
              wrapped,
            );
          else
            updated = f.updateArrowFunction(
              updated,
              updated.modifiers,
              updated.typeParameters,
              updated.parameters,
              updated.type,
              updated.equalsGreaterThanToken,
              wrapped,
            );
        }
        if (ts.isCallExpression(updated) && ts.isCallExpression(n)) {
          const consumerCall=contextConsumers.get(k);
          if(consumerCall){
            let original:ts.Expression=n.expression;while(ts.isParenthesizedExpression(original))original=original.expression;
            const callee=updated.expression;
            if(!ts.isIdentifier(original)||updated.questionDotToken||updated.arguments.length!==consumerCall.arguments.length||updated.arguments.some(ts.isSpreadElement)||calls.has(k))throw Error('context-consumer-call-unmodeled-or-overlapping');
            const captured=f.createIdentifier('__DSC_CONTEXT_CALLEE');
            const invoke=f.createArrowFunction(undefined,undefined,[f.createParameterDeclaration(undefined,undefined,captured)],undefined,f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              f.createCallExpression(captured,updated.typeArguments,updated.arguments.map((a,i)=>api('contextConsumerArgument',[literal(k),f.createNumericLiteral(i),a]))));
            return api('contextConsumerCall',[literal(k),callee,invoke]);
          }
          const contextCall=contextCalls.get(k);
          if(contextCall){
            let original:ts.Expression=n.expression;while(ts.isParenthesizedExpression(original))original=original.expression;
            let callee:ts.Expression=updated.expression;while(ts.isParenthesizedExpression(callee))callee=callee.expression;
            if(updated.arguments.length!==1||updated.questionDotToken||ts.isSpreadElement(updated.arguments[0]))throw Error('context-call-instrument-unmodeled');
            if(contextCall.receiver==='bare'){
              if(!ts.isIdentifier(original))throw Error('context-call-instrument-callee-changed');
              return api('contextUse',[literal(k),f.createVoidZero(),api('contextHookValue',[literal(k),callee]),updated.arguments[0]]);
            }
            if(!ts.isPropertyAccessExpression(original)||!ts.isIdentifier(original.expression)||!ts.isPropertyAccessExpression(callee)||callee.questionDotToken||callee.name.text!=='useContext')throw Error('context-call-instrument-callee-changed');
            const receiver=f.createIdentifier('__DSC_CONTEXT_RECEIVER');
            return f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[f.createParameterDeclaration(undefined,undefined,receiver)],undefined,f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              api('contextUse',[literal(k),receiver,api('contextHookRead',[literal(k),receiver]),updated.arguments[0]]))),undefined,[callee.expression]);
          }
          const initializer=initializers.find(p=>helperPointKey(p.call)===k);
          if(initializer){
            const target=initializer.target,id=literal(helperPointKey({file:target.module,sha256:target.sourceSha256,...target.span}));
            if(ts.isPropertyAccessExpression(updated.expression)){
              const receiver=f.createIdentifier('__DSC_RECEIVER');
              return f.createCallExpression(f.createParenthesizedExpression(f.createArrowFunction(undefined,undefined,[f.createParameterDeclaration(undefined,undefined,receiver)],undefined,f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                api('targetForward',[id,receiver,f.createPropertyAccessExpression(receiver,updated.expression.name),updated.arguments[0]]))),undefined,[updated.expression.expression]);
            }
            return api('targetForward',[id,f.createVoidZero(),updated.expression,updated.arguments[0]]);
          }
          const naming=initializers.find(p=>p.naming&&helperPointKey(p.naming.call)===k)?.naming;
          if(naming)return api('targetName',[literal(k),updated.expression,...updated.arguments]);
          if (helper && k === helperPointKey(helper.call))
            return api("invoke", [
              updated.expression,
              f.createArrayLiteralExpression(updated.arguments),
            ]);
          if (calls.has(k)) {
            let callee: ts.Expression = n.expression;
            while (ts.isParenthesizedExpression(callee))
              callee = callee.expression;
            if (
              n.questionDotToken ||
              !(
                ts.isIdentifier(callee) ||
                ts.isFunctionExpression(callee) ||
                ts.isArrowFunction(callee)
              )
            )
              throw Error("helper-instrument-call-receiver-unmodeled");
            const captured = f.createIdentifier("__DSC_CALLEE");
            const invoke = f.createArrowFunction(
              undefined,
              undefined,
              [f.createParameterDeclaration(undefined, undefined, captured)],
              undefined,
              f.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              f.createCallExpression(
                captured,
                updated.typeArguments,
                updated.arguments,
              ),
            );
            return api("sourceCall", [literal(k), updated.expression, invoke]);
          }
        }
        const namer=initializers.find(p=>p.naming&&helperPointKey(p.naming.helper)===k)?.naming;
        if(namer){
          if(!ts.isArrowFunction(updated))throw Error('target-naming-function-changed');
          // A call wrapper otherwise removes the variable initializer's native
          // function-name inference. Preserve that name with NamedEvaluation.
          const named=f.createElementAccessExpression(f.createParenthesizedExpression(f.createObjectLiteralExpression([f.createPropertyAssignment(literal(namer.helperName),updated)])),literal(namer.helperName));
          return api('targetNamingHelper',[literal(k),definitions.has(k)?api('sourceFunction',[literal(k),named]):named,arrow(f.createIdentifier(namer.nativeName))]);
        }
        if (
          (ts.isArrowFunction(updated) || ts.isFunctionExpression(updated)) &&
          definitions.has(k)
        )
          updated = api("sourceFunction", [literal(k), updated]);
        if(initializers.some(p=>helperPointKey(p.render)===k))return api('targetRender',[literal(k),updated as ts.Expression]);
        if (ts.isVariableDeclaration(updated) && metadata.has(k)) {
          if (!updated.initializer)
            throw Error("helper-instrument-metadata-uninitialized");
          return f.updateVariableDeclaration(
            updated,
            updated.name,
            updated.exclamationToken,
            updated.type,
            api("definition", [
              f.createNumericLiteral(metadata.get(k)!),
              updated.initializer,
            ]),
          );
        }
        const prelude = preludes.get(n);
        if (prelude && (ts.isSourceFile(updated) || ts.isBlock(updated))) {
          const statements = [...updated.statements];
          let i = 0;
          while (
            i < statements.length &&
            ts.isExpressionStatement(statements[i]) &&
            ts.isStringLiteral(
              (statements[i] as ts.ExpressionStatement).expression,
            )
          )
            i++;
          statements.splice(i, 0, ...prelude);
          return ts.isSourceFile(updated)
            ? f.updateSourceFile(updated, statements)
            : f.updateBlock(updated, statements);
        }
        return updated;
      };
      return (node) => ts.visitNode(node, visit) as ts.SourceFile;
    },
  ]);
  try {
    return ts.createPrinter().printFile(result.transformed[0]);
  } finally {
    result.dispose();
  }
}
