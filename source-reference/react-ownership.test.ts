import { startReactOwnership } from "./react-ownership-run.js";
import { createReactHelperObserver } from "./react-helper-transform.js";
import { reactHelperRuntimeHook, reactHelperRuntimeRead, type ReactHelperRuntimeReport } from "./react-helper-runtime.js";
import { reactReferenceHtml } from "./react-reference.js";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readReactSourceProgram } from "./react-source-program.js";
import { readReactHelperEffects, readReactComponentEffects } from "./react-helper-effects.js";
import { reactHelperIntrinsicGuard } from "./react-helper-intrinsics.js";
import { reactHelperBindingGuard } from "./react-helper-binding-runtime.js";
import { instrumentReactHelperSource, helperPointKey } from "./react-helper-instrument.js";
import { linkReactSourceAnatomy } from "./react-source-anatomy.js";
import {readReactContextualContent,verifiedReactContextualContent} from './react-contextual-content.js';
import {selectReactNativeRequest,readReactNativeEvidence} from './react-native-evidence.js';
import { captureJs } from "../extract/computed/capture.js";
import type { CapturedNode } from "../extract/computed/lib.js";
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright-core";
import { buildReactReference, reactReferenceUnchanged } from './react-reference.js';
import { builtinReactCohort } from './react-cohort.js';
import {
  buildReactOwnershipReference,
  outermostRootOwners,
  reactOwnershipHook,
  reactOwnershipRead,
  reactOwnershipMatchesTree,
  type ReactOwnership,
} from "./react-ownership.js";

test('helper native guard refuses substituted globals, method objects and iterator prototypes before execution', async () => {
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    const report=await page.evaluate<{rows:Array<{label:string;reason:string}>;executed:number;sideEffects:number}>(`(() => {
      const guard=${reactHelperIntrinsicGuard};
      const realm=globalThis, define=Object.defineProperty, descriptor=Object.getOwnPropertyDescriptor;
      const remove=Reflect.deleteProperty, setPrototype=Object.setPrototypeOf, getPrototype=Object.getPrototypeOf;
      const rows=[];let executed=0,sideEffects=0;
      const attack=()=>{sideEffects++;throw Error('untrusted code executed');};
      const helper=()=>{guard();executed++;return 'caller';};
      if(helper()!=='caller')throw Error('baseline failed');
      function check(label,target,key,value,accessor=false) {
        const before=descriptor(target,key),calls=executed;let reason;
        try {
          define(target,key,accessor?{get:attack,configurable:true}:{value,writable:true,configurable:true});
          try {helper();}catch(error){reason=error.message;}
        }finally{if(before)define(target,key,before);else remove(target,key);}
        guard();
        if(!reason?.startsWith('helper-native-')||executed!==calls||sideEffects)throw Error('control failed:'+label);
        rows[rows.length]={label,reason};
      }
      check('global Object proxy',realm,'Object',new Proxy(Object,{get:attack,ownKeys:attack,getPrototypeOf:attack,getOwnPropertyDescriptor:attack}));
      check('global Array replacement',realm,'Array',function Replacement(){});
      check('global Set replacement',realm,'Set',function Replacement(){});
      check('global JSON replacement',realm,'JSON',{});
      check('identity serializer replacement',JSON,'stringify',attack);
      check('global accessor',realm,'Object',null,true);
      check('globalThis replacement',realm,'globalThis',{});
      check('reflection replacement',Reflect,'ownKeys',attack);
      check('descriptor reader replacement',Object,'getOwnPropertyDescriptor',attack);
      check('native function own call',Object.prototype.hasOwnProperty,'call',attack);
      check('native function own getter',Object.prototype.hasOwnProperty,'call',null,true);
      check('array iterator next',getPrototype([][Symbol.iterator]()),'next',attack);
      check('shared iterator override',getPrototype(getPrototype([][Symbol.iterator]())) ,Symbol.iterator,attack);
      check('prototype field',Object.prototype,'unknownField','changed');
      const p=getPrototype(Array.prototype),calls=executed;let reason;
      try{setPrototype(Array.prototype,{});try{helper();}catch(error){reason=error.message;}}
      finally{setPrototype(Array.prototype,p);}
      guard();if(!reason?.startsWith('helper-native-')||executed!==calls)throw Error('prototype control failed');
      rows[rows.length]={label:'prototype replaced',reason};
      if(helper()!=='caller'||executed!==2||sideEffects)throw Error('restoration failed');
      return {rows,executed,sideEffects};
    })()`);
    assert.equal(report.rows.length,15);
    assert.equal(report.executed,2);
    assert.equal(report.sideEffects,0);
  } finally {await browser.close();}
});

test('helper modeling follows the original bundler runtime edge rather than a package declaration', async () => {
  const dir=realpathSync(mkdtempSync(path.join(tmpdir(),'react-helper-runtime-edge-')));
  try {
    mkdirSync(path.join(dir,'node_modules','formatter'),{recursive:true});
    for(const name of ['react','react-dom','scheduler'])symlinkSync(path.resolve('node_modules',name),path.join(dir,'node_modules',name),'dir');
    writeFileSync(path.join(dir,'package.json'),'{"type":"module"}');
    writeFileSync(path.join(dir,'package-lock.json'),'{}');
    writeFileSync(path.join(dir,'style.css'),'button {color: black}');
    writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,jsx:'react',target:'ES2022',module:'ESNext',moduleResolution:'Bundler',skipLibCheck:true,paths:{react:[path.resolve('node_modules/@types/react/index.d.ts')]}}}));
    writeFileSync(path.join(dir,'node_modules/formatter/package.json'),JSON.stringify({name:'formatter',exports:{'.':{types:'./index.d.ts',default:'./index.cjs'}}}));
    writeFileSync(path.join(dir,'node_modules/formatter/index.d.ts'),'export default function format(input:{className?:string}):string;');
    const runtime=path.join(dir,'node_modules/formatter/index.cjs');
    writeFileSync(runtime,`(function(){
var prefix='base';
function inner(input){return prefix+(input.className||'');}
function format(input){return inner(input);}
format.swap=function(next){var previous=inner;inner=next;return previous;};
format.setPrefix=function(next){prefix=next;};
module.exports=format;
}());`);
    writeFileSync(path.join(dir,'control.tsx'),`import React from 'react';import format from 'formatter';
type Input={children?:React.ReactNode;className?:string};
function normalize(input:Input){const output={...input};output.className=format(input);return output;}
export function Control(props:Input){const {children,...rest}=normalize(props);return <button {...rest}>{children}</button>;}`);
    const cohort={...builtinReactCohort,declared:true,witnessFiles:{},cases:[],negativeCaseIds:[],entry:`import './style.css';import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './control';createRoot(document.getElementById('mount')).render(<Control>Original</Control>);`};
    const reference=await buildReactReference(dir,cohort);
    const source=readReactSourceProgram(dir,['control.tsx']);
    const candidate=source.components[0].helperCandidates![0];
    assert.ok(reference.runtimeImports?.some(edge=>edge.importer===path.join(dir,'control.tsx')&&edge.specifier==='formatter'&&edge.file===runtime));
    const result=readReactHelperEffects(reference,'control.tsx',candidate,{children:'Original',className:'caller'});
    assert.equal(result.status,'modeled',JSON.stringify(result));
    assert.equal(result.runtimeVerified,false);
    assert.equal(result.sourceFiles[runtime],reference.files[runtime]);
    assert.equal(source.components[0].children.kind,'unresolved');
    if(result.status!=='modeled'||!result.callSite)throw Error('missing helper model');
    const helper=result.calls.find(c=>c.site&&helperPointKey(c.site)===helperPointKey(result.callSite!))!.source;
    const plan={models:[result],call:result.callSite,helper,metadata:[]};
    const inner=result.runtimeBindings.bindings.find(b=>b.name==='inner')!;
    const prefix=result.runtimeBindings.bindings.find(b=>b.name==='prefix')!;
    const imported=result.runtimeBindings.bindings.find(b=>b.declarationKind==='ImportClause')!;
    assert.ok(inner&&prefix&&imported,'manifest includes the executable default import and CJS closed state');
    assert.throws(()=>instrumentReactHelperSource(readFileSync(runtime,'utf8')+'\n','node_modules/formatter/index.cjs',plan),/source-changed/);
    const bundled=await build({stdin:{contents:`import {Control} from './control';import format from 'formatter';
globalThis.fixtureRun=()=>Control({children:'Original',className:'caller'});
globalThis.fixtureSwap=next=>format.swap(next);globalThis.fixturePrefix=next=>format.setPrefix(next);`,loader:'tsx',resolveDir:dir},
      bundle:true,write:false,format:'iife',jsx:'transform',define:{'process.env.NODE_ENV':'"development"'},
      plugins:[{name:'registered-helper-bindings',setup(builder){builder.onLoad({filter:/\.(tsx|cjs)$/},args=>({
        contents:instrumentReactHelperSource(readFileSync(args.path,'utf8'),path.relative(dir,args.path),plan),
        loader:args.path.endsWith('.tsx')?'tsx':'js',resolveDir:path.dirname(args.path),
      }));}}]});
    const browser=await chromium.launch();
    try {
      for(const missingKey of [null,helperPointKey(inner.binding),helperPointKey(imported.binding)]){
        const page=await browser.newPage();
        try {
          await page.evaluate(`(() => {
            const guard=(${reactHelperBindingGuard})(${JSON.stringify([result])},${reactHelperIntrinsicGuard},()=>false);
            const missing=${JSON.stringify(missingKey)};globalThis.helperExecutions=0;
            globalThis.__DSC_RUNTIME_PROOF={sourceFunction:guard.sourceFunction,sourceCall:guard.sourceCall,
              binding:(key,get)=>{if(key!==missing)guard.binding(key,get);},registerHelper:()=>{}};
            globalThis.__DSC_RUNTIME_PROOF.invoke=(fn,args)=>{guard.check(0);globalThis.helperExecutions++;return guard.run(0,fn,args);};
          })()`);
          await page.addScriptTag({content:bundled.outputFiles[0].text});
          if(missingKey){
            const refusal=await page.evaluate(`(() => {try{fixtureRun();}catch(error){return {reason:error.message,calls:helperExecutions};}return null;})()`);
            assert.deepEqual(refusal,{reason:'helper-binding-registration-missing',calls:0});
          }else{
            const report=await page.evaluate<{rows:string[];calls:number;replacementCalls:number;proxyTraps:number}>(`(() => {
              const rows=[];let replacementCalls=0,proxyTraps=0;
              if(fixtureRun().props.children!=='Original')throw Error('initial content changed');
              function refused(action,restore){const before=helperExecutions;let reason;try{action();try{fixtureRun();}catch(error){reason=error.message;}}finally{restore();}
                if(!reason?.startsWith('helper-binding-')||helperExecutions!==before)throw Error('helper ran with changed dependency');rows.push(reason);}
              refused(()=>fixturePrefix('changed'),()=>fixturePrefix('base'));
              let original;
              refused(()=>{original=fixtureSwap(()=>{replacementCalls++;return 'changed';});},()=>fixtureSwap(original));
              refused(()=>fixtureSwap(new Proxy(original,{apply(){proxyTraps++;throw Error('trap');},getOwnPropertyDescriptor(){proxyTraps++;throw Error('trap');}})),()=>fixtureSwap(original));
              if(fixtureRun().props.children!=='Original')throw Error('restoration changed content');
              return {rows,calls:helperExecutions,replacementCalls,proxyTraps};
            })()`);
            assert.equal(report.rows.length,3);assert.equal(report.calls,2);
            assert.equal(report.replacementCalls,0);assert.equal(report.proxyTraps,0);
          }
        }finally{await page.close();}
      }
    }finally{await browser.close();}
    const missing=readReactHelperEffects({...reference,runtimeImports:[]},'control.tsx',candidate,{children:'Original'});
    assert.equal(missing.status,'refused');
    if(missing.status==='refused')assert.equal(missing.reason,'executable-import-unresolved');
    writeFileSync(runtime,'module.exports=function format(input){input.children="Changed";return "base";};');
    const stale=readReactHelperEffects(reference,'control.tsx',candidate,{children:'Original'});
    assert.equal(stale.status,'refused');
    const changed=await buildReactReference(dir,cohort);
    const harmful=readReactHelperEffects(changed,'control.tsx',candidate,{children:'Original'});
    assert.equal(harmful.status,'refused');
    if(harmful.status==='refused')assert.equal(harmful.reason,'external-data-write');
  } finally {rmSync(dir,{recursive:true,force:true});}
});

for (const bindings of ['direct', 'local-const'] as const)
test(`dependency registration preserves ${bindings} delegated content and caller updates while refusing unpinned source and runtime aliases`, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'react-dependency-owners-'));
  const browser = await chromium.launch();
  try {
    mkdirSync(path.join(dir,'node_modules'));
    for (const name of ['react','react-dom','scheduler']) symlinkSync(path.resolve('node_modules',name),path.join(dir,'node_modules',name),'dir');
    writeFileSync(path.join(dir,'package.json'),'{"type":"module"}');
    writeFileSync(path.join(dir,'package-lock.json'),'{}');
    writeFileSync(path.join(dir,'style.css'),'button { color: rgb(30, 40, 60); padding: 8px 14px; }');
    writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,jsx:'react',target:'ES2022',module:'ESNext',moduleResolution:'Bundler',skipLibCheck:true,
      paths:{react:[path.resolve('node_modules/@types/react/index.d.ts')]}}}));
    const surface=`import React from 'react';import {Delegated as Frame} from './barrel';
export function Surface(props:{children?:React.ReactNode}) {${bindings === 'local-const' ? 'const alias=props; const {children,...rest}=alias; return <Frame {...rest}>{children}</Frame>;' : 'return <Frame {...props}/>;'}}`;
    const leaf=`import React from 'react';export function Control(props:{children?:React.ReactNode}) {${bindings === 'local-const' ? 'const {children,...rest}=props; const content=children; return <button {...rest}>{content}</button>;' : 'return <button {...props}/>;'}}`;
    writeFileSync(path.join(dir,'surface.tsx'),surface);
    writeFileSync(path.join(dir,'barrel.ts'),"export {Frame as Delegated} from './frame';");
    writeFileSync(path.join(dir,'frame.tsx'),`import React from 'react';import {Control} from './leaf';
export function Frame(props:{children?:React.ReactNode}) {return <Control {...props}/>;} export const Unused=7;`);
    writeFileSync(path.join(dir,'leaf.tsx'),leaf);
    const cohort={...builtinReactCohort,declared:true,witnessFiles:{},cases:[],negativeCaseIds:[],entry:`import './style.css';import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {Surface} from './surface';
const root=createRoot(document.getElementById('mount'));window.renderCaller=(text)=>flushSync(()=>root.render(<Surface>{text}</Surface>));window.renderCaller('First caller');`};
    const original=await buildReactReference(dir,cohort);
    const program=readReactSourceProgram(dir,['surface.tsx'],{includeJsxDependencies:true});
    assert.deepEqual(program.problems,[]);
    assert.deepEqual(program.components.map(c=>c.exportName),['Surface','Frame','Control']);
    const observed=await buildReactOwnershipReference(original.sourceRoot,original,program);
    assert.deepEqual(observed.files,original.files);
    const screenshots:Buffer[]=[];
    for(const instrumented of [false,true]){
      const context=await browser.newContext();
      try {
        if(instrumented) await context.addInitScript(reactOwnershipHook);
        const page=await context.newPage();
        await page.setContent('<div id="mount"></div>');
        await page.addStyleTag({content:original.css});
        await page.addScriptTag({content:(instrumented?observed:original).javascript});
        screenshots.push(await page.screenshot());
        if(!instrumented) continue;
        await page.evaluate("window.__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort()");
        const ownership=await page.evaluate(reactOwnershipRead('#mount > button')) as ReactOwnership;
        const tree=await page.evaluate(captureJs('#mount',undefined,'--',['#mount > button'])) as CapturedNode;
        assert.deepEqual(ownership.problems,[]);
        assert.deepEqual(ownership.components.map(c=>[c.source.exportName,c.parent,c.roots]),[
          ['Surface',undefined,['']],['Frame','instance-0',['']],['Control','instance-1',['']]]);
        assert.equal(ownership.nodes[0].createdBy,'instance-2');
        const anatomy=linkReactSourceAnatomy(program,ownership,tree);
        assert.equal(anatomy.status,'linked');
        assert.equal(anatomy.instances[0].roots[0].correspondence,'delegated-host');
        assert.deepEqual(anatomy.instances[0].rootDelegation,{instanceIds:['instance-0','instance-1','instance-2'],hostOwner:'instance-2',forwardsChildren:true});
        assert.equal(anatomy.instances[0].content,'caller-slot');
        assert.equal(anatomy.instances[2].roots[0].correspondence,'source-host');
        assert.equal(anatomy.instances[2].content,'caller-slot');
        await page.evaluate("window.renderCaller('Changed caller')");
        assert.equal(await page.locator('button').textContent(),'Changed caller');
        const changed=await page.evaluate(reactOwnershipRead('#mount > button')) as ReactOwnership;
        assert.deepEqual(changed.components.map(c=>c.source),ownership.components.map(c=>c.source));
        const changedTree=await page.evaluate(captureJs('#mount',undefined,'--',['#mount > button'])) as CapturedNode;
        const changedAnatomy=linkReactSourceAnatomy(program,changed,changedTree);
        assert.deepEqual(changedAnatomy.instances[0].rootDelegation,anatomy.instances[0].rootDelegation);
        assert.equal(changedAnatomy.instances[0].content,'caller-slot');
        assert.deepEqual(changed.components.map(c=>c.props.children),['Changed caller','Changed caller','Changed caller']);
        await page.evaluate("window.renderCaller('First caller')");
        assert.deepEqual(await page.screenshot(),screenshots[1]);
        await page.evaluate("window.__DSC_REACT_EXPORTS.push({...window.__DSC_REACT_EXPORTS[2],identity:{...window.__DSC_REACT_EXPORTS[2].identity,exportName:'Counterfeit'}})");
        assert.deepEqual((await page.evaluate(reactOwnershipRead('#mount > button')) as ReactOwnership).problems,['react-ownership-export-alias-ambiguous']);
      }finally{await context.close();}
    }
    assert.deepEqual(screenshots[1],screenshots[0],'the registered dependency graph preserves original pixels');
    assert.ok(reactReferenceUnchanged(original));
    const unpinned=structuredClone(program);
    unpinned.components[2].sourceSha256='0'.repeat(64);
    await assert.rejects(buildReactOwnershipReference(original.sourceRoot,original,unpinned),/react-ownership-source-not-in-reference/);
    writeFileSync(path.join(dir,'leaf.tsx'),leaf+'\n// changed');
    await assert.rejects(buildReactOwnershipReference(original.sourceRoot,original,program),/react-ownership-source-changed-or-unreadable/);
    assert.equal(readFileSync(path.join(dir,'surface.tsx'),'utf8'),surface);
  }finally{await browser.close();rmSync(dir,{recursive:true,force:true});}
});

async function mount(browser: Browser, source: string) {
  const context = await browser.newContext();
  await context.addInitScript(reactOwnershipHook);
  const page = await context.newPage();
  await page.setContent('<div id="mount"></div><div id="portal"></div>');
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync,createPortal} from 'react-dom';
 const identity=(exportName)=>({module:'components.tsx',exportName,sourceSha256:'a'.repeat(64),span:{start:0,end:10}});
 ${source}`,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  return {
    context,
    page,
    read: (selector = "#mount > :first-child") =>
      page.evaluate(reactOwnershipRead(selector)) as Promise<ReactOwnership>,
  };
}
const fixture = `
 const First=React.memo(function SameName(props){return <section>{props.children}</section>});
 const Second=React.forwardRef(function SameName(props,ref){return <button ref={ref}>{String(props.checked)}</button>});
 window.__DSC_REACT_EXPORTS=[{identity:identity('First'),value:First},{identity:identity('Second'),value:Second}];
 flushSync(()=>createRoot(document.getElementById('mount')).render(<First><Second checked={false}/><Second checked={null}/></First>));`;

test("nested slot paths match real React ownership with repeated, empty and text callers", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "react-nested-owners-"));
  const browser = await chromium.launch();
  try {
    writeFileSync(
      path.join(dir, "components.tsx"),
      `import React from 'react';
export function Outer({children}:{children?:React.ReactNode}) {return <section>Heading<aside>Fixed</aside><div><div>{children}</div></div><footer/></section>}
export function Inner({children}:{children?:React.ReactNode}) {return <article><div>{children}</div></article>}`,
    );
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          jsx: "react",
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          skipLibCheck: true,
          paths: {
            react: [path.resolve("node_modules/@types/react/index.d.ts")],
          },
        },
      }),
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    assert.ok(
      program.components.every((c) => c.children.kind === "nested-forwarded"),
    );
    const entries = program.components.map((c) => ({
      module: c.module,
      exportName: c.exportName,
      sourceSha256: c.sourceSha256,
      span: c.span,
    }));
    const bundle = await build({
      stdin: {
        contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {Outer,Inner} from ${JSON.stringify(path.join(dir, "components.tsx"))};
window.__DSC_REACT_EXPORTS=${JSON.stringify(entries)}.map((identity,i)=>({identity,value:[Outer,Inner][i]}));
const root=createRoot(document.getElementById('mount'));
window.renderCaller=(kind)=>flushSync(()=>root.render(<Outer>{kind==='empty'?null:kind==='text'?'Plain caller':[<Inner key="one"><span>First</span></Inner>,<Inner key="two"><span>Second</span></Inner>]}</Outer>));
window.renderCaller('composed');`,
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      bundle: true,
      write: false,
      format: "iife",
      nodePaths: [path.resolve("node_modules")],
    });
    const context = await browser.newContext();
    try {
      await context.addInitScript(reactOwnershipHook);
      const page = await context.newPage();
      await page.setContent('<div id="mount"></div>');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate(
        "window.__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort()",
      );
      for (const mode of ["composed", "text", "empty", "composed"]) {
        await page.evaluate(`window.renderCaller(${JSON.stringify(mode)})`);
        const before = await page.screenshot();
        const ownership = (await page.evaluate(
          reactOwnershipRead("#mount > section"),
        )) as ReactOwnership;
        const tree = (await page.evaluate(
          captureJs("#mount", undefined, "--", ["#mount > section"]),
        )) as CapturedNode;
        assert.deepEqual(ownership.problems, []);
        const linked = linkReactSourceAnatomy(program, ownership, tree);
        assert.equal(linked.status, "linked", JSON.stringify(linked.problems));
        const outer = linked.instances[0];
        assert.equal(outer.content, "nested-caller-slot");
        assert.equal(outer.callerSlotPath, "1.0");
        assert.deepEqual(outer.sourceOwnedPaths, ["", "0", "1", "1.0", "2"]);
        assert.equal(outer.dependencies.length, mode === "composed" ? 2 : 0);
        if (mode === "composed")
          assert.deepEqual(
            linked.instances.slice(1).map((i) => i.callerSlotPath),
            ["1.0.0.0", "1.0.1.0"],
          );
        else assert.deepEqual(outer.callerContentPaths, []);
        assert.deepEqual(
          await page.screenshot(),
          before,
          "tracing must not change the original render",
        );
      }
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a child state update retains source owners when React switches ancestor fiber buffers", async () => {
  const browser = await chromium.launch();
  try {
    const { context, page, read } = await mount(
      browser,
      `
      function Parent({children}) { return <section>{children}</section> }
      function Child() { const [count,setCount]=React.useState(0); return <button onClick={()=>setCount(count+1)}>{count}</button> }
      window.__DSC_REACT_EXPORTS=[{identity:identity('Parent'),value:Parent},{identity:identity('Child'),value:Child}];
      flushSync(()=>createRoot(document.getElementById('mount')).render(<Parent><Child/></Parent>));`,
    );
    try {
      const original = await read();
      assert.equal(original.nodes[0].createdBy, "instance-0");
      assert.equal(original.nodes[1].createdBy, "instance-1");
      for (let count = 1; count <= 3; count++) {
        await page.getByRole("button").click();
        assert.equal(
          await page.getByRole("button").textContent(),
          String(count),
        );
        assert.deepEqual(
          await read(),
          original,
          "runtime state changes do not change the source that creates a host node",
        );
      }
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test("real renderer matches export objects through memo and forwardRef, keeping repeated instances and typed props", async () => {
  const browser = await chromium.launch();
  try {
    const { context, page, read } = await mount(browser, fixture);
    try {
      const before = await page.screenshot(),
        html = await page.locator("#mount").innerHTML(),
        result = await read();
      assert.deepEqual(result.problems, []);
      assert.deepEqual(
        result.components.map((c) => [c.source.exportName, c.parent, c.roots]),
        [
          ["First", undefined, [""]],
          ["Second", "instance-0", ["0"]],
          ["Second", "instance-0", ["1"]],
        ],
      );
      assert.equal(result.components[1].props.checked, false);
      assert.equal(result.components[2].props.checked, null);
      assert.deepEqual(await read(), result);
      assert.equal(await page.locator("#mount").innerHTML(), html);
      assert.deepEqual(await page.screenshot(), before);
      // A caller-shaped element with the same text/classes is not adopted.
      await page
        .locator("section")
        .evaluate((e) => e.appendChild(document.createElement("button")));
      assert.ok(
        (await read()).problems.some((p) =>
          p.startsWith("react-ownership-dom-without-fiber"),
        ),
      );
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
});

test("missing instrumentation, unsupported renderer, alias ambiguity and portals do not produce an accepted correspondence", async () => {
  const browser = await chromium.launch();
  try {
    const first = await mount(browser, fixture);
    try {
      await first.page.evaluate(
        "window.__DSC_REACT_EXPORTS.push(window.__DSC_REACT_EXPORTS[0])",
      );
      assert.deepEqual((await first.read()).problems, [
        "react-ownership-export-alias-ambiguous",
      ]);
      await first.page.evaluate(
        "window.__DSC_REACT_EXPORTS.pop();[...window.__DSC_REACT_OWNERSHIP.renderers.values()][0].version='999.0.0'",
      );
      assert.deepEqual((await first.read()).problems, [
        "react-ownership-renderer-unsupported",
      ]);
      await first.page.evaluate("delete window.__DSC_REACT_EXPORTS");
      assert.deepEqual((await first.read()).problems, [
        "react-ownership-instrumentation-missing",
      ]);
    } finally {
      await first.context.close();
    }
    const portal = await mount(
      browser,
      `
   function Panel(){return <section>Local{createPortal(<button>Elsewhere</button>,document.getElementById('portal'))}</section>}
   window.__DSC_REACT_EXPORTS=[{identity:identity('Panel'),value:Panel}];
   flushSync(()=>createRoot(document.getElementById('mount')).render(<Panel/>));`,
    );
    try {
      assert.ok(
        (await portal.read()).problems.some((p) =>
          p.startsWith("react-ownership-host-outside-selection"),
        ),
      );
    } finally {
      await portal.context.close();
    }
  } finally {
    await browser.close();
  }
});

test("compiler correspondence refuses shifted paths caused by non-painting SVG metadata", async () => {
  const browser = await chromium.launch();
  try {
    const instance = await mount(
      browser,
      `
   function Icon(){return <svg><title>Accessible name</title><path d="M0 0 L10 10"/></svg>}
   window.__DSC_REACT_EXPORTS=[{identity:identity('Icon'),value:Icon}];
   flushSync(()=>createRoot(document.getElementById('mount')).render(<Icon/>));`,
    );
    try {
      await instance.page.evaluate(
        "window.__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort()",
      );
      const tree = (await instance.page.evaluate(
        captureJs("#mount", undefined, "--", ["#mount > svg"]),
      )) as CapturedNode;
      const ownership = await instance.read();
      assert.deepEqual(ownership.problems, []);
      assert.equal(
        reactOwnershipMatchesTree(ownership, tree),
        false,
        "a title omitted by capture must not shift a path onto a different element",
      );
    } finally {
      await instance.context.close();
    }
  } finally {
    await browser.close();
  }
});

test("a parsed forwardRef export joins its real renderer-owned host without treating caller text as authored structure", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "react-wrapper-owner-"));
  const browser = await chromium.launch();
  try {
    const source = `import * as React from 'react';
export const Panel=React.forwardRef<HTMLDivElement,{children?:React.ReactNode}>((props,ref)=><div {...props} ref={ref}/>);`;
    writeFileSync(path.join(dir, "components.tsx"), source);
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          jsx: "react",
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          skipLibCheck: true,
          paths: {
            react: [path.resolve("node_modules/@types/react/index.d.ts")],
          },
        },
      }),
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    const component = program.components[0];
    const identity = {
      module: component.module,
      exportName: component.exportName,
      sourceSha256: component.sourceSha256,
      span: component.span,
    };
    const bundle = await build({
      stdin: {
        contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import {Panel} from ${JSON.stringify(path.join(dir, "components.tsx"))};
      const ref=React.createRef();window.__fixtureRef=ref;
      window.__DSC_REACT_EXPORTS=[{identity:${JSON.stringify(identity)},value:Panel}];
      flushSync(()=>createRoot(document.getElementById('mount')).render(<Panel ref={ref}><span>Caller content</span></Panel>));`,
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      bundle: true,
      write: false,
      format: "iife",
      nodePaths: [path.resolve("node_modules")],
    });
    const context = await browser.newContext();
    await context.addInitScript(reactOwnershipHook);
    const page = await context.newPage();
    await page.setContent('<div id="mount"></div>');
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const before = await page.screenshot();
    await page.evaluate(
      "window.__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort()",
    );
    const tree = (await page.evaluate(
      captureJs("#mount", undefined, "--", ["#mount > div"]),
    )) as CapturedNode;
    const ownership = (await page.evaluate(
      reactOwnershipRead("#mount > div"),
    )) as ReactOwnership;
    assert.deepEqual(ownership.problems, []);
    assert.equal(
      await page.evaluate(
        'window.__fixtureRef.current === document.querySelector("#mount > div")',
      ),
      true,
    );
    const linked = linkReactSourceAnatomy(program, ownership, tree);
    assert.equal(linked.status, "linked", JSON.stringify(linked.problems));
    assert.equal(linked.instances[0].roots[0].correspondence, "source-host");
    assert.equal(linked.instances[0].content, "caller-slot");
    assert.deepEqual(linked.instances[0].sourceOwnedPaths, [""]);
    assert.deepEqual(linked.instances[0].callerContentPaths, ["0"]);
    assert.deepEqual(
      await page.screenshot(),
      before,
      "source tracing does not alter the render",
    );
    await context.close();
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("default exports in separate modules retain distinct source owners and reject runtime aliases", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "react-default-owners-"));
  const browser = await chromium.launch();
  try {
    for (const [file, tag] of [
      ["outer.tsx", "section"],
      ["inner.tsx", "div"],
    ]) {
      writeFileSync(
        path.join(dir, file),
        `import React from 'react';
const Panel=({children}:{children?:React.ReactNode})=><${tag}>{children}</${tag}>;
export default Panel;`,
      );
    }
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          jsx: "react",
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          skipLibCheck: true,
          paths: {
            react: [path.resolve("node_modules/@types/react/index.d.ts")],
          },
        },
      }),
    );
    const program = readReactSourceProgram(dir, ["outer.tsx", "inner.tsx"]);
    assert.equal(program.status, "observed", JSON.stringify(program.problems));
    assert.equal(program.components.length, 2);
    assert.ok(
      program.components.every(
        (c) => c.name === "Panel" && c.exportName === "default",
      ),
    );
    const entries = program.components.map((c) => ({
      module: c.module,
      exportName: c.exportName,
      sourceSha256: c.sourceSha256,
      span: c.span,
    }));
    const bundle = await build({
      stdin: {
        contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
${entries.map((c, i) => `import * as Module${i} from ${JSON.stringify(path.join(dir, c.module))};`).join("\n")}
const values=[${entries.map((_, i) => `Module${i}.default`).join(",")}];
window.__DSC_REACT_EXPORTS=${JSON.stringify(entries)}.map((identity,i)=>({identity,value:values[i]}));
const Outer=values[0],Inner=values[1];
flushSync(()=>createRoot(document.getElementById('mount')).render(<Outer><Inner><span>Caller</span></Inner></Outer>));`,
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      bundle: true,
      write: false,
      format: "iife",
      nodePaths: [path.resolve("node_modules")],
    });
    const context = await browser.newContext();
    try {
      await context.addInitScript(reactOwnershipHook);
      const page = await context.newPage();
      await page.setContent('<div id="mount"></div>');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.evaluate(
        "window.__ALL_PROPS=[...getComputedStyle(document.documentElement)].sort()",
      );
      const tree = (await page.evaluate(
        captureJs("#mount", undefined, "--", ["#mount > :first-child"]),
      )) as CapturedNode;
      const ownership = (await page.evaluate(
        reactOwnershipRead("#mount > :first-child"),
      )) as ReactOwnership;
      assert.deepEqual(ownership.problems, []);
      assert.deepEqual(
        ownership.components.map((c) => [
          c.source.module,
          c.source.exportName,
          c.roots,
        ]),
        [
          [entries[0].module, "default", [""]],
          [entries[1].module, "default", ["0"]],
        ],
      );
      const linked = linkReactSourceAnatomy(program, ownership, tree);
      assert.equal(linked.status, "linked", JSON.stringify(linked.problems));
      assert.ok(
        linked.instances.every(
          (i) =>
            i.content === "caller-slot" &&
            i.roots[0].correspondence === "source-host",
        ),
      );
      const impostor = structuredClone(ownership);
      impostor.components[1].source.module = entries[0].module;
      assert.deepEqual(
        linkReactSourceAnatomy(program, impostor, tree).problems,
        ["react-anatomy-source-identity-mismatch"],
      );
      await page.evaluate(
        `window.__DSC_REACT_EXPORTS.push({identity:{...window.__DSC_REACT_EXPORTS[0].identity,exportName:'NamedAlias'},value:window.__DSC_REACT_EXPORTS[0].value})`,
      );
      assert.deepEqual(
        (
          (await page.evaluate(
            reactOwnershipRead("#mount > :first-child"),
          )) as ReactOwnership
        ).problems,
        ["react-ownership-export-alias-ambiguous"],
      );
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
    rmSync(dir, { recursive: true, force: true });
  }
});


test("selected components retain enclosing source ancestors, caller ownership and context updates", async () => {
  const browser = await chromium.launch();
  try {
    const app = await mount(browser, `
      const Context=React.createContext('warm');
      function Frame({children}){return <section><aside>Outside selection</aside><div>{children}</div></section>}
      function Panel({choice,children}){const tone=React.useContext(Context);return <button data-choice={choice}><b>{tone}</b>{children}</button>}
      function Outer({tone}){return <main><Context.Provider value={tone}><Frame><Panel choice="selected"><em>Caller</em></Panel><Panel choice="sibling"/></Frame></Context.Provider></main>}
      window.__DSC_REACT_EXPORTS=[{identity:identity('Outer'),value:Outer},{identity:identity('Frame'),value:Frame},{identity:identity('Panel'),value:Panel}];
      const root=createRoot(document.getElementById('mount'));
      window.renderTone=tone=>flushSync(()=>root.render(<Outer tone={tone}/>));
      window.renderTone('warm');`);
    try {
      const before = await app.page.screenshot();
      const read = () => app.read('[data-choice="selected"]');
      const first = await read();
      assert.deepEqual(first.problems, []);
      assert.deepEqual(first.components.map(c => [c.id,c.source.exportName,c.parent,c.roots]), [
        ['instance-2','Panel','instance-1',['']],
      ]);
      assert.deepEqual(first.ancestors?.map(c => [c.id,c.source.exportName,c.parent,c.hostAncestor]), [
        ['instance-0','Outer',undefined,{tag:'main',distance:3}],
        ['instance-1','Frame','instance-0',{tag:'section',distance:2}],
      ]);
      assert.equal(first.nodes.find(n => n.tag==='em')?.createdBy,'instance-0','caller content retains its outside creator');
      assert.equal(first.nodes.find(n => n.tag==='b')?.createdBy,'instance-2');
      assert.equal(first.ancestors?.[0].props.tone,'warm');
      assert.deepEqual(await read(),first);
      assert.deepEqual(await app.page.screenshot(),before,'read-only boundary observation cannot alter the render');
      await app.page.evaluate("window.renderTone('cool')");
      assert.equal(await app.page.locator('[data-choice="selected"] b').textContent(),'cool');
      assert.equal((await read()).ancestors?.[0].props.tone,'cool','surrounding input changes remain in the observation');
      await app.page.evaluate("window.renderTone('warm')");
      assert.deepEqual(await read(),first);
      assert.deepEqual(await app.page.screenshot(),before);
    } finally { await app.context.close(); }
  } finally { await browser.close(); }
});

test("enclosing-context recognition does not admit fragments, portals, reparenting or partial selections", async () => {
  const browser=await chromium.launch();
  try {
    for(const [outer,panel,selector,move,reason] of [
      ['<><main><Panel/></main><footer/></>','<button>Selected</button>','#mount button',false,'parent-outside-selection'],
      ['<main><Panel/>{createPortal(<aside>External</aside>,document.getElementById("portal"))}</main>','<button>Selected</button>','#mount button',false,'ancestor-host-outside-container'],
      ['<main>{createPortal(<Panel/>,document.getElementById("portal"))}</main>','<button>Selected</button>','#portal button',false,'parent-outside-selection'],
      ['<main><Panel/></main>','<><button>Selected</button>{createPortal(<aside>External</aside>,document.getElementById("portal"))}</>','#mount button',false,'host-outside-selection'],
      ['<Panel/>','<><button>Selected</button>{createPortal(<Extra/>,document.getElementById("portal"))}</>','#mount button',false,'host-outside-selection'],
      ['<main><Panel/></main>','<button>Selected</button>','#portal button',true,'parent-outside-selection'],
      ['<main><Panel/></main>','<button><span>Partial</span></button>','#mount span',false,'partial'],
    ] as const){
      const app=await mount(browser,`function Extra(){return <aside>Registered outside child</aside>}function Panel(){return ${panel}}function Outer(){return ${outer}}
        window.__DSC_REACT_EXPORTS=[{identity:identity('Outer'),value:Outer},{identity:identity('Panel'),value:Panel},{identity:identity('Extra'),value:Extra}];
        flushSync(()=>createRoot(document.getElementById('mount')).render(<Outer/>));`);
      try {
        if(move)await app.page.evaluate("document.getElementById('portal').appendChild(document.querySelector('#mount button'))");
        const result=await app.read(selector);
        if(reason==='partial')assert.equal(result.components.length,0,'a descendant crop cannot establish a component root');
        else assert.ok(result.problems.some(p=>p.includes(reason)),JSON.stringify({outer,panel,result}));
      }finally{await app.context.close();}
    }
  }finally{await browser.close();}
});


test('helper observations preserve the paired render, refuse missing registrations and invalidate changed inputs or evidence', async () => {
  const dir=realpathSync(mkdtempSync(path.join(tmpdir(),'react-helper-observation-')));
  let job:ReturnType<typeof startReactOwnership>|undefined;
  try {
    mkdirSync(path.join(dir,'node_modules'),{recursive:true});mkdirSync(path.join(dir,'src'));
    for(const name of ['react','react-dom','scheduler'])symlinkSync(path.resolve('node_modules',name),path.join(dir,'node_modules',name),'dir');
    writeFileSync(path.join(dir,'package.json'),'{}');writeFileSync(path.join(dir,'package-lock.json'),'{}');
    writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,jsx:'react-jsx',target:'ES2022',module:'ESNext',moduleResolution:'Bundler',skipLibCheck:true,paths:{react:[path.resolve('node_modules/@types/react/index.d.ts')],'react/jsx-runtime':[path.resolve('node_modules/@types/react/jsx-runtime.d.ts')]}}}));
    writeFileSync(path.join(dir,'style.css'),':root{--sample-color:rgb(0, 0, 0)} button{display:inline-flex;width:80px;height:32px;color:var(--sample-color)}');
    const source=`import React from 'react';type Input={children?:React.ReactNode;title?:string};
const settings={title:'Example'};
function normalize(input:Input,config:{title:string}){const output={...input,title:config.title};return output;}
export const Control=React.forwardRef<HTMLButtonElement,Input>((props,ref)=>{const {children,...rest}=normalize(props,settings);return <button ref={ref} {...rest}>{children}</button>;});
Control.displayName='Control';`;
    writeFileSync(path.join(dir,'src/control.tsx'),source);
    const cohort={...builtinReactCohort,declared:true,witnessFiles:{},cases:[{id:'control',subject:'Control',label:'Control'}],negativeCaseIds:[],
      profile:()=>({id:'control',provenance:'authored unit fixture',path:['button'],fontFamily:'Arial',textContent:'absent' as const,requiredTokens:{'--sample-color':'rgb(0, 0, 0)'},requiredStyles:{display:'inline-flex',width:'80px',height:'32px'}}),
      entry:`import './style.css';import React from 'react';import {createRoot} from 'react-dom/client';import {Control} from './src/control';createRoot(document.getElementById('root')).render(<Control title='Caller' ref={null}>{''}</Control>);`};
    const reference=await buildReactReference(dir,cohort);
    assert.deepEqual(readReactSourceProgram(dir,['src/control.tsx']).problems,[]);
    job=startReactOwnership(reference,dir,path.join(dir,'private/react-source-ownership'));await job.promise;
    const report=job.report();assert.equal(report.state,'complete',JSON.stringify(report));assert.equal(report.matched,1,JSON.stringify(report));
    const helper=report.rows[0].helperObservations![0];assert.equal(helper.status,'observed',JSON.stringify({status:helper.status,reason:helper.reason}));
    assert.equal(helper.containingContentQualified,false);assert.equal(helper.acceptedContract,null);
    assert.equal(helper.containingFlow?.status,'observed',JSON.stringify(helper));
    assert.equal(helper.containingFlow?.content,'forwarded');
    assert.equal(helper.runtime?.status,'observed');
    if(helper.runtime?.status==='observed'){
      assert.equal(helper.runtime.helperCalls,1);assert.equal(helper.runtime.events[0].origin,'forward-ref-copy');
      assert.equal(Object.hasOwn(helper.runtime.events[0],'child'),false);
    }
    const program=readReactSourceProgram(dir,['src/control.tsx']);
    assert.equal(program.components[0].children.kind,'unresolved');
    const observedProgram=JSON.parse(readFileSync(path.join(job.dir,'program.json'),'utf8')) as typeof program;
    const captured=JSON.parse(readFileSync(path.join(job.dir,'control/source-tree.json'),'utf8'));
    const args={referenceId:reference.id,sourceRoot:dir,program:observedProgram,ownership:report.rows[0].ownership!,tree:captured.tree,
      helpers:report.rows[0].helperObservations!,read:(id:string,name:string)=>readFileSync(path.join(job!.dir,'control/helpers',id,name))};
    const capability=readReactContextualContent(args);
    assert(helper.evidence?.pairedOwnershipSha256);
    assert(args.ownership.nodes[0].creationSite?.transformed);
    assert.deepEqual(JSON.parse(args.read(helper.id,'paired-ownership.json').toString()),args.ownership);
    assert.equal(JSON.parse(args.read(helper.id,'ownership.json').toString()).nodes[0].creationSite,undefined);
    assert.equal(linkReactSourceAnatomy(observedProgram,args.ownership,args.tree).instances[0].content,'unresolved');
    assert.equal(linkReactSourceAnatomy(observedProgram,args.ownership,args.tree,capability).instances[0].content,'caller-slot');
    assert.equal(report.rows[0].anatomy?.instances[0].contentContext?.revision,capability.revision);
    assert.equal(linkReactSourceAnatomy(observedProgram,args.ownership,args.tree,{...capability}).status,'refused','a copied JSON flag has no host authority');
    for(const mutate of [
      (a:typeof args)=>{a.ownership.components[0].props.title='Different';},
      (a:typeof args)=>{a.ownership.components[0].id='other-instance';},
      (a:typeof args)=>{a.ownership.nodes[0].tag='span';},
      (a:typeof args)=>{a.ownership.nodes[0].path='0';},
      (a:typeof args)=>{a.ownership.nodes[0].creationSite!.sourceSha256='f'.repeat(64);},
      (a:typeof args)=>{a.tree.style.width='81px';},
      (a:typeof args)=>{a.program.components[0].sourceSha256='f'.repeat(64);},
    ]){
      const changed={...args,ownership:structuredClone(args.ownership),tree:structuredClone(args.tree),program:structuredClone(args.program)};mutate(changed);
      assert.throws(()=>verifiedReactContextualContent(capability,changed.program,changed.ownership,changed.tree),/context-changed/);
      assert.throws(()=>readReactContextualContent(changed),/react-contextual-content-/);
    }
    for(const name of ['model.json','component-model.json','runtime.json','plan.json','build.json','ownership.json','paired-ownership.json','tree.json','observed.png','report.json']){
      assert.throws(()=>readReactContextualContent({...args,read:(id,file)=>file===name?Buffer.from('{}'):args.read(id,file)}),/react-contextual-content-/,name);
    }
    const incomplete=structuredClone(helper);delete incomplete.evidence!.runtimeSha256;
    assert.throws(()=>readReactContextualContent({...args,helpers:[incomplete]}),/proof-incomplete/);
    assert.throws(()=>readReactContextualContent({...args,helpers:[helper,helper]}),/ambiguous-observation/);
    assert.equal(report.rows[0].rootMatrix?.draft?.status,'native-compiled',JSON.stringify(report.rows[0].rootMatrix));
    const nativeRequest=selectReactNativeRequest(dir,report,'control');
    assert.deepEqual(readReactNativeEvidence(dir,reference,nativeRequest).matrix,JSON.parse(JSON.stringify(report.rows[0].rootMatrix)));
    const model=readReactHelperEffects(reference,'src/control.tsx',program.components[0].helperCandidates![0],{title:'Caller',children:''});
    assert.equal(model.status,'modeled');if(model.status!=='modeled')throw Error('fixture not modeled');
    assert.ok(model.instrumentation&&model.callSite);
    const plan={models:[model],call:model.callSite,...model.instrumentation};
    const containing=readReactComponentEffects(reference,'src/control.tsx',program.components[0].helperCandidates![0],{title:'Caller',children:''});
    assert.equal(containing.status,'modeled');if(containing.status!=='modeled')throw Error('containing fixture not modeled');
    const containingPlan={...plan,models:[model,containing],component:containing.component};
    const browser=await chromium.launch();
    try {
      for(const control of ['missing-helper','missing-metadata','missing-runtime','read-native-substitution'] as const){
        const observer=createReactHelperObserver(reference,plan);
        const altered=await buildReactOwnershipReference(dir,reference,program,{transform:async(text,file,loader)=>{
          const transformed=await observer.transform(text,file,loader);
          if(control==='missing-helper')transformed.contents=transformed.contents.replaceAll('globalThis.__DSC_RUNTIME_PROOF.registerHelper','(()=>{})');
          if(control==='missing-metadata')transformed.contents=transformed.contents.replaceAll('globalThis.__DSC_RUNTIME_PROOF.definition','((index,value)=>value)');
          return transformed;
        }});observer.complete();
        const context=await browser.newContext();
        try{
          await context.addInitScript(reactOwnershipHook+(control==='missing-runtime'?'':'\n'+reactHelperRuntimeHook(plan.models)));
          const page=await context.newPage();await page.setContent(reactReferenceHtml(altered));
          if(control==='read-native-substitution'){
            await page.locator('button').waitFor();
            await page.evaluate(`globalThis.untrustedCalls=0;Object.getOwnPropertyDescriptor=()=>{untrustedCalls++;throw Error('untrusted');}`);
          }
          const result=await page.evaluate(reactHelperRuntimeRead) as ReactHelperRuntimeReport;
          assert.equal(result.status,'refused',control+':'+JSON.stringify(result));
          if(control==='read-native-substitution')assert.equal(await page.evaluate('untrustedCalls'),0);
          else assert.equal(await page.locator('button').count(),0);
        }finally{await context.close();}
      }
      for(const control of ['original','missing-component-registration','missing-component-boundary','unregistered-return','changed-host','changed-secondary-parameter','unregistered-input','missing-component-model','before-react-metadata','after-react-metadata','reordered-input-context'] as const){
        const observer=createReactHelperObserver(reference,containingPlan),api='globalThis.__DSC_RUNTIME_PROOF';
        const altered=await buildReactOwnershipReference(dir,reference,program,{transform:async(text,file,loader)=>{
          const transformed=await observer.transform(text,file,loader);
          if(control==='missing-component-registration')transformed.contents=transformed.contents.replaceAll(api+'.sourceFunction',`((key,fn)=>key===${JSON.stringify(helperPointKey(containing.component))}?fn:${api}.sourceFunction(key,fn))`);
          if(control==='missing-component-boundary')transformed.contents=transformed.contents.replaceAll(api+'.component','((key,input,secondary,body)=>body())');
          if(control==='unregistered-return')transformed.contents=transformed.contents.replaceAll(api+'.component',`((key,input,secondary,body)=>${api}.component(key,input,secondary,()=>({...body()})))`);
          if(control==='changed-host')transformed.contents=transformed.contents.replaceAll(api+'.jsx',`((fn,tag,...args)=>${api}.jsx(fn,tag==='button'?'div':tag,...args))`);
          if(control==='changed-secondary-parameter')transformed.contents=transformed.contents.replaceAll(api+'.component',`((key,input,secondary,body)=>${api}.component(key,input,[{}],body))`);
          if(control==='unregistered-input')transformed.contents=transformed.contents.replaceAll(api+'.component',`((key,input,secondary,body)=>${api}.component(key,{...input},secondary,body))`);
          if(control==='before-react-metadata')transformed.contents=transformed.contents.replaceAll(api+'.reactDisplayName',`((fn,name,body)=>{fn.unexpected=true;return ${api}.reactDisplayName(fn,name,body);})`);
          if(control==='after-react-metadata')transformed.contents=transformed.contents.replaceAll(api+'.reactDisplayName',`((fn,name,body)=>{const result=${api}.reactDisplayName(fn,name,body);fn.unexpected=true;return result;})`);
          return transformed;
        }});observer.complete();
        const context=await browser.newContext();
        try{
          const runtimeModel:Extract<ReturnType<typeof readReactHelperEffects>,{status:'modeled'}>=structuredClone(model);
          const runtimeContaining:Extract<ReturnType<typeof readReactComponentEffects>,{status:'modeled'}>=structuredClone(containing);
          if(control==='reordered-input-context'){
            assert.equal(runtimeModel.input.kind,'record');assert.equal(runtimeContaining.input.kind,'record');
            if(runtimeModel.input.kind==='record')runtimeModel.input.fields.reverse();
            if(runtimeContaining.input.kind==='record')runtimeContaining.input.fields.reverse();
          }
          await context.addInitScript(reactOwnershipHook+'\n'+reactHelperRuntimeHook([runtimeModel],control==='missing-component-model'?[]:[runtimeContaining]));
          const page=await context.newPage();await page.setContent(reactReferenceHtml(altered));
          if(control==='original')await page.locator('button').waitFor();
          const result=await page.evaluate(reactHelperRuntimeRead) as ReactHelperRuntimeReport;
          assert.equal(result.status,control==='original'?'observed':'refused',control+':'+JSON.stringify(result));
          if(result.status==='observed')assert.deepEqual(result.components,[{context:0,helperCalls:1,content:'forwarded'}]);
          else assert.equal(await page.locator('button,div[title="Example"]').count(),0,control);
        }finally{await context.close();}
      }
    }finally{await browser.close();}
    assert.ok(Array.isArray(job.report().rows[0].authoredTrees));
    writeFileSync(path.join(dir,'src/control.tsx'),source+'\n');
    assert.throws(()=>verifiedReactContextualContent(capability,observedProgram,args.ownership,args.tree),/inputs-changed/);
    assert.throws(()=>readReactNativeEvidence(dir,reference,nativeRequest));
    assert.equal(job.report().matched,0);assert.equal(job.report().rows[0].helperObservations,undefined);assert.equal(job.report().rows[0].authoredTrees,undefined);
    writeFileSync(path.join(dir,'src/control.tsx'),source);
    assert.equal(job.report().matched,1);
    writeFileSync(path.join(job.dir,'control/helpers/helper-0/runtime.json'),'{}');
    assert.throws(()=>verifiedReactContextualContent(capability,observedProgram,args.ownership,args.tree),/artifact-changed/);
    assert.throws(()=>readReactNativeEvidence(dir,reference,nativeRequest));
    assert.equal(job.report().problem,'react-ownership-evidence-changed');assert.equal(job.report().matched,0);
    assert.equal(job.report().rows[0].helperObservations,undefined);assert.equal(job.report().rows[0].authoredTrees,undefined);
  }finally{job?.close();rmSync(dir,{recursive:true,force:true});}
});

test('the case subject is the outermost root owner; unrelated owners stay ambiguous', () => {
  // Live family Switch (2026-09-26): Radix Switch.Root shares the root with the
  // workspace Switch that renders it, and Thumb owns a descendant.
  const switchOwners = [
    { id: 'instance-0', parent: null, roots: [''] },
    { id: 'instance-1', parent: 'instance-0', roots: [''] },
    { id: 'instance-2', parent: 'instance-1', roots: ['0'] },
  ];
  assert.deepEqual(outermostRootOwners(switchOwners).map(c => c.id), ['instance-0']);
  assert.deepEqual(outermostRootOwners([{ id: 'a', parent: null, roots: [''] }, { id: 'b', parent: null, roots: [''] }]).map(c => c.id), ['a', 'b'],
    'two unrelated root owners are both returned so the caller refuses');
  assert.deepEqual(outermostRootOwners([{ id: 'c', parent: null, roots: ['0'] }]), [], 'no root owner, nothing selected');
});
