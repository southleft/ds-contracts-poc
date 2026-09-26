import {planReactConsumerLiterals} from './react-consumer-literals.js';
import {planReactHookHelpers} from './react-hook-helpers.js';
import {planReactCallbackFactories} from './react-callback-factories.js';
import {planReactEffectHooks} from './react-effect-hooks.js';
import {planReactRefHooks} from './react-ref-hooks.js';
import {planReactCallbackSources} from './react-callback-sources.js';
import {replanReactTargetEffects} from './react-target-effects.js';
import {rebuildReactTargetCallbackPlan} from './react-target-callback-plan.js';
import {rebuildReactTargetCallbackValues} from './react-target-callback-values.js';
import {instrumentReactContextAdapter} from './react-context-adapter.js';
import {planReactContextCalls,planReactContextRests,planReactContextHelpers,planReactContextConsumerCalls,planReactContextFactoryCalls,planReactContextBindings,planReactContextTargets} from './react-context-calls.js';
import {readReactRuntimeExport} from './react-runtime-export.js';
import {readReactTargetInitializer} from './react-target-initializer.js';
import { createHash } from "node:crypto";
import path from "node:path";
import ts from "typescript";
import { transform, type Loader } from "esbuild";
import type { ReactReference } from "./react-reference.js";
import {
  instrumentReactHelperSource,
  helperPointKey,
  type ReactEffectInstrumentationPlan,
} from "./react-helper-instrument.js";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const G = "globalThis.__DSC_RUNTIME_PROOF";
// These adapters describe installed framework mechanics, never component names.
export const reactRuntimeAdapters = [
  {
    suffix: "/node_modules/react/cjs/react.development.js",
    hashes: [
      "aea3404ac4d87323ff72f8ee176454d94bcd13a4a4947c5288dca174dbbd17db",
      "a5a052eac47e030dc93231e9226defb5e44980eb014961a504c241285966910e",
    ],
    kind: "create-element",
  },
  {
    suffix: "/node_modules/react/cjs/react-jsx-runtime.development.js",
    hashes: [
      "dd50fd0db2fba44e0eee66243a45c81cfa3774cf41e4e6c0c080a601815c694d",
      "dd50fd0db2fba44e0eee66243a45c81cfa3774cf41e4e6c0c080a601815c694d",
    ],
    kind: "jsx",
  },
  {
    suffix: "/node_modules/react-dom/cjs/react-dom-client.development.js",
    hashes: [
      "2ab293af6af1c03e785d764ff70f0f9a851238c791b5adffd5ec183e85bb0796",
      "638fcb800207eaf4c5b2427f13fb82362b8e06df51e65d92fa350fbfeaa8fd89",
    ],
    kind: "forward-ref",
  },
] as const;
export const reactForwardCopyNeedle =
  "      prepareToReadContext(workInProgress);\n      nextProps = renderWithHooks(\n        current,\n        workInProgress,\n        Component,\n        propsWithoutRef,";
const displayNameNeedle = `          render.name ||
            render.displayName ||
            (Object.defineProperty(render, "name", { value: name }),
            (render.displayName = name));`;
const adapters = reactRuntimeAdapters;
const forwardNeedle = reactForwardCopyNeedle;

/** Transform an isolated observation build. Source bytes are pinned before every
 * transform; no installed module is written and no adapter is inferred by name. */
export function createReactHelperObserver(
  reference: ReactReference,
  plan: ReactEffectInstrumentationPlan,
) {
  const changes: Array<{
    file: string;
    kind: string;
    inputSha256: string;
    outputSha256: string;
  }> = [];
  const seen = new Set<string>();
  if(plan.kind==='jsx-component'&&plan.contextCalls&&JSON.stringify(planReactContextCalls(reference))!==JSON.stringify(plan.contextCalls))throw Error('context-call-plan-changed');
  if(plan.kind==='jsx-component'&&plan.contextRests&&JSON.stringify(planReactContextRests(reference,plan.contextCalls??[]))!==JSON.stringify(plan.contextRests))throw Error('context-rest-plan-changed');
  if(plan.kind==='jsx-component'&&plan.contextHelpers&&JSON.stringify(planReactContextHelpers(reference,plan.contextCalls??[]))!==JSON.stringify(plan.contextHelpers))throw Error('context-helper-plan-changed');
  if(plan.kind==='jsx-component'&&plan.contextConsumerCalls&&JSON.stringify(planReactContextConsumerCalls(reference,plan.initializers??[]))!==JSON.stringify(plan.contextConsumerCalls))throw Error('context-consumer-plan-changed');
  if(plan.kind==='jsx-component'&&plan.contextFactories&&JSON.stringify(planReactContextFactoryCalls(reference,plan.initializers??[]))!==JSON.stringify(plan.contextFactories))throw Error('context-factory-plan-changed');
  if(plan.kind==='jsx-component'&&plan.contextBindings&&JSON.stringify(planReactContextBindings(reference,plan.initializers??[]))!==JSON.stringify(plan.contextBindings))throw Error('context-binding-plan-changed');
  if(plan.kind==='jsx-component'&&plan.contextTargets&&JSON.stringify(planReactContextTargets(reference,plan.contextFactories??[]))!==JSON.stringify(plan.contextTargets))throw Error('context-target-plan-changed');
  if(plan.kind==='jsx-component'&&plan.consumerLiterals&&JSON.stringify(planReactConsumerLiterals(reference,plan.initializers??[]))!==JSON.stringify(plan.consumerLiterals))throw Error('consumer-literal-plan-changed');
  if(plan.kind==='jsx-component'&&plan.hookHelpers&&JSON.stringify(planReactHookHelpers(reference,plan.contextConsumerCalls??[]))!==JSON.stringify(plan.hookHelpers))throw Error('hook-helper-plan-changed');
  if(plan.kind==='jsx-component'&&plan.callbackFactories&&JSON.stringify(planReactCallbackFactories(reference,plan.contextConsumerCalls??[]))!==JSON.stringify(plan.callbackFactories))throw Error('callback-factory-plan-changed');
  if(plan.kind==='jsx-component'&&plan.effectHooks&&JSON.stringify(planReactEffectHooks(reference,plan.initializers??[]))!==JSON.stringify(plan.effectHooks))throw Error('effect-hook-plan-changed');
  if(plan.kind==='jsx-component'&&plan.refHooks&&JSON.stringify(planReactRefHooks(reference,plan.initializers??[]))!==JSON.stringify(plan.refHooks))throw Error('ref-hook-plan-changed');
  if(plan.kind==='jsx-component'&&plan.callbackSources&&JSON.stringify(planReactCallbackSources(reference,plan.contextConsumerCalls??[],plan.contextHelpers??[]))!==JSON.stringify(plan.callbackSources))throw Error('callback-source-plan-changed');
  const targetReads=new Set<string>(),expectedTargetReads=new Set(plan.kind==='jsx-component'?plan.models.flatMap(m=>m.jsxTargets.map(t=>helperPointKey(t.read))):[]);
  if(plan.kind==='jsx-component')for(const target of plan.targets){
    const current=readReactRuntimeExport(reference,target.module,[target.exportName]);
    if(current.status!=='resolved'||JSON.stringify(current.definition)!==JSON.stringify(target))throw Error('jsx-helper-target-source-changed');
  }
  if(plan.kind==='jsx-component'&&plan.initializers){
    const all=[...plan.targets,...(plan.callbackValues??[]).flatMap(p=>p.targets.map(t=>t.target))];
    const distinct=all.filter((t,i)=>all.findIndex(p=>p.module===t.module&&p.sourceSha256===t.sourceSha256&&p.span.start===t.span.start&&p.span.end===t.span.end)===i);
    const expected=distinct.map(target=>readReactTargetInitializer(reference,target));
    if(JSON.stringify(expected)!==JSON.stringify(plan.initializers))throw Error('target-initializer-plan-changed');
  }
  if(plan.kind==='jsx-component')for(const model of plan.targetEffects??[]){
    if(model.status!=='modeled')continue;
    const initializer=plan.initializers?.find(p=>helperPointKey(p.render)===helperPointKey(model.render));
    if(!initializer||JSON.stringify(replanReactTargetEffects(reference,initializer,model.input))!==JSON.stringify(model))throw Error('target-projection-model-changed');
  }
  if(plan.kind==='jsx-component')for(const callback of plan.callbackPlans??[]){
    if(JSON.stringify(rebuildReactTargetCallbackPlan(reference,plan.targetEffects??[],callback))!==JSON.stringify(callback))throw Error('target-callback-plan-changed');
  }
  if(plan.kind==='jsx-component')for(const value of plan.callbackValues??[]){
    if(!plan.callbackPlans?.some(p=>JSON.stringify(p)===JSON.stringify(value.boundary))||JSON.stringify(rebuildReactTargetCallbackValues(reference,plan.targetEffects??[],plan.initializers??[],value.boundary,value.input))!==JSON.stringify(value))throw Error('target-callback-value-plan-changed');
    for(const target of value.targets)if(!plan.initializers?.some(p=>helperPointKey(p.call)===helperPointKey(target.call)&&helperPointKey(p.render)===helperPointKey(target.render)))throw Error('target-callback-value-initializer-unavailable');
  }
  // 19.2.4 and 19.2.7: the three installed files differ only in version strings.
  // Require one complete combination; do not independently admit mixed versions.
  const version = [0, 1].find((index) =>
    adapters.every((adapter) => {
      const matches = Object.entries(reference.files).filter(([file]) =>
        file.endsWith(adapter.suffix),
      );
      return matches.length === 1 && matches[0][1] === adapter.hashes[index];
    }),
  );
  if (version === undefined) throw Error("helper-react-runtime-unsupported");
  return {
    changes,
    complete() {
      if (adapters.some((a) => !seen.has(a.kind)))
        throw Error("helper-react-runtime-registration-missing");
      if(expectedTargetReads.size!==targetReads.size||[...expectedTargetReads].some(k=>!targetReads.has(k)))throw Error('jsx-target-marker-missing');
    },
    async transform(
      text: string,
      file: string,
      loader: Loader,
    ): Promise<{ contents: string; loader: Loader }> {
      const entry = file === "react-reference.tsx",
        inputSha256 = sha(text);
      if (
        !entry &&
        (reference.files[file] !== inputSha256 || text.includes("__DSC_"))
      )
        throw Error("helper-transform-source-changed-or-reserved");
      const adapter = adapters.find((a) => file.endsWith(a.suffix));
      if (adapter) {
        if (inputSha256 !== adapter.hashes[version])
          throw Error("helper-react-runtime-changed");
        let contents: string;
        if (adapter.kind === "forward-ref") {
          if (text.split(forwardNeedle).length !== 2)
            throw Error("helper-forward-copy-site-unmatched");
          contents = text.replace(
            forwardNeedle,
            `      ${G}.forward(nextProps, propsWithoutRef);\n` + forwardNeedle,
          );
          const dispatch='      Component = Component.render;';
          if(contents.split(dispatch).length!==2)throw Error('target-forward-dispatch-site-unmatched');
          contents=contents.replace(dispatch,`      ${G}.targetDispatch(Component);\n`+dispatch);
          const invoke='            return Component(props, secondArg);';
          if(contents.split(invoke).length!==2)throw Error('target-render-invocation-site-unmatched');
          contents=contents.replace(invoke,`            return ${G}.targetInvoke(Component, props, secondArg, () => Component(props, secondArg));`);
        } else {
          let runtimeText = text;
          if (adapter.kind === "create-element") {
            if (text.split(displayNameNeedle).length !== 2)
              throw Error("helper-react-display-name-site-unmatched");
            runtimeText = text.replace(
              displayNameNeedle,
              `${G}.reactDisplayName(render,name,()=>{\n${displayNameNeedle}\n});`,
            );
          }
          contents =
            runtimeText +
            `\n${G}.registerRuntime(${adapter.kind === "jsx" ? "exports.jsx,exports.jsxs" : "exports.createElement"});\n${G}.registerFragment(exports.Fragment);\n`+
            (adapter.kind==='create-element'?`${G}.registerForwardRef(exports.forwardRef);\n`:'');
        }
        contents=instrumentReactContextAdapter(contents,adapter.kind);
        seen.add(adapter.kind);
        changes.push({
          file,
          kind: adapter.kind,
          inputSha256,
          outputSha256: sha(contents),
        });
        return { contents, loader };
      }
      const registered = instrumentReactHelperSource(
        text,
        entry ? file : path.relative(reference.sourceRoot, file),
        plan,
      );
      // Other JS dependencies may contain assignment patterns and custom factory
      // protocols. They have no modeled literal authority in this observer.
      if (loader === "js" && (registered === text || plan.kind==='jsx-component'&&(plan.consumerLiterals?.length||plan.hookHelpers?.functions.length||plan.callbackFactories?.functions.length||plan.effectHooks?.length||plan.refHooks?.length||plan.callbackSources?.functions.length||plan.contextCalls?.length||plan.contextRests?.length||plan.contextHelpers?.length||plan.contextConsumerCalls?.length||plan.contextFactories?.length||plan.contextBindings?.reads.length||plan.contextTargets?.reads.length)&&instrumentReactHelperSource(text,path.relative(reference.sourceRoot,file),{...plan,consumerLiterals:[],hookHelpers:undefined,callbackFactories:undefined,effectHooks:[],refHooks:[],callbackSources:{hooks:[],consumers:[],functions:[],calls:[],callbacks:[]},contextCalls:[],contextRests:[],contextHelpers:[],contextConsumerCalls:[],contextFactories:[],contextBindings:{reads:[],functions:[]},contextTargets:{reads:[],objects:[]}})===text)) {
        if(registered!==text)changes.push({file,kind:'context-source-calls',inputSha256,outputSha256:sha(registered)});
        return { contents: registered, loader };
      }
      const compiled = await transform(registered, {
        loader,
        jsx: "automatic",
        target: "es2022",
        sourcefile: file,
      });
      const js = ts.createSourceFile(
        file + ".js",
        compiled.code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS,
      );
      const jsxBindings = new Set<string>(),
        reactBindings = new Set<string>();
      for (const statement of js.statements)
        if (
          ts.isImportDeclaration(statement) &&
          ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          const mod = statement.moduleSpecifier.text,
            b = statement.importClause?.namedBindings;
          if (mod === "react/jsx-runtime" && b && ts.isNamedImports(b))
            for (const el of b.elements)
              if (
                ["jsx", "jsxs"].includes(el.propertyName?.text ?? el.name.text)
              )
                jsxBindings.add(el.name.text);
          if (mod === "react") {
            if (statement.importClause?.name)
              reactBindings.add(statement.importClause.name.text);
            if (b && ts.isNamespaceImport(b)) reactBindings.add(b.name.text);
          }
        }
      const pairs: Array<{
        pos: number;
        text: string;
        start?: boolean;
        begin?: number;
        endReplace?: number;
        priority?: number;
      }> = [];
      function visit(n: ts.Node) {
        if(ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.getText(js)===G+'.targetJsx'){
          const key=n.arguments[0];let factory=n.arguments[1];
          while(factory&&ts.isParenthesizedExpression(factory))factory=factory.expression;
          if(n.arguments.length!==2||!key||!ts.isStringLiteral(key)||!expectedTargetReads.has(key.text)||targetReads.has(key.text)||!factory||!ts.isCallExpression(factory)||!ts.isIdentifier(factory.expression)||!jsxBindings.has(factory.expression.text)||factory.arguments.length<2)throw Error('jsx-target-marker-unmatched');
          const tag=factory.arguments[0];targetReads.add(key.text);
          pairs.push({pos:n.getStart(js),endReplace:factory.getStart(js),text:''},{pos:factory.end,endReplace:n.end,text:''},
            {pos:tag.getStart(js),text:G+'.targetRead('+JSON.stringify(key.text)+',()=>(',start:true,priority:-1},{pos:tag.end,text:'))',begin:tag.getStart(js)});
        }
        if (ts.isObjectLiteralExpression(n) || ts.isArrayLiteralExpression(n)) {
          // An AST object/array may represent an assignment target, not a value.
          let child: ts.Node = n;
          for (
            let p = n.parent;
            p && !ts.isStatement(p);
            child = p, p = p.parent
          ) {
            if (
              (ts.isBinaryExpression(p) &&
                p.left === child &&
                p.operatorToken.kind === ts.SyntaxKind.EqualsToken) ||
              ((ts.isForOfStatement(p) || ts.isForInStatement(p)) &&
                p.initializer === child)
            )
              throw Error("helper-literal-assignment-unmodeled");
          }
          pairs.push(
            { pos: n.getStart(js), text: G + ".literal(", start: true },
            { pos: n.end, text: ")", begin: n.getStart(js) },
          );
        }
        if (ts.isCallExpression(n)) {
          const callee = n.expression;
          let method: string | undefined;
          if (ts.isIdentifier(callee) && jsxBindings.has(callee.text))
            method = "jsx";
          if (
            ts.isPropertyAccessExpression(callee) &&
            ts.isIdentifier(callee.expression) &&
            reactBindings.has(callee.expression.text) &&
            callee.name.text === "createElement"
          )
            method = "createElement";
          if (method) {
            pairs.push({
              pos: callee.getStart(js),
              endReplace: callee.end,
              text: G + "." + method,
            });
            pairs.push({
              pos: n.arguments.pos,
              text: callee.getText(js) + (n.arguments.length ? "," : ""),
            });
          }
        }
        ts.forEachChild(n, visit);
      }
      visit(js);
      let contents = compiled.code;
      pairs.sort(
        (a, b) =>
          b.pos - a.pos ||
          (a.priority??0)-(b.priority??0) ||
          Number(!!a.start) - Number(!!b.start) ||
          (a.begin ?? 0) - (b.begin ?? 0),
      );
      for (const p of pairs)
        contents =
          contents.slice(0, p.pos) +
          p.text +
          contents.slice(p.endReplace ?? p.pos);
      if(entry&&plan.kind==='jsx-component'){
        if(text.includes('__DSC_JSX_HELPER_TARGET_'))throw Error('jsx-helper-target-reserved-binding');
        contents+='\n'+plan.targets.map((target,index)=>{
          const key=JSON.stringify([target.module,target.sourceSha256,target.span.start,target.span.end]);
          return `import {${JSON.stringify(target.exportName)} as __DSC_JSX_HELPER_TARGET_${index}} from ${JSON.stringify('./'+target.module)};\n${G}.registerTarget(${JSON.stringify(key)},__DSC_JSX_HELPER_TARGET_${index},()=>__DSC_JSX_HELPER_TARGET_${index});`;
        }).join('\n');
      }
      changes.push({
        file,
        kind: "source-registrations-and-react-factories",
        inputSha256,
        outputSha256: sha(contents),
      });
      return { contents, loader: "js" };
    },
  };
}
