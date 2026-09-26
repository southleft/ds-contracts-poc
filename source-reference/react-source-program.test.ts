import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import * as React from "react";
import ts from "typescript";
import { readReactHelperEffects, readReactComponentEffects, reactHelperCandidates } from "./react-helper-effects.js";
import {
  readReactSourceProgram,
  reactSourceProgramUnchanged,
} from "./react-source-program.js";
const declarations = `
declare global { namespace JSX { interface Element {} interface IntrinsicElements {button:any;div:any} } }
export type Checked = boolean | 'indeterminate';
export function Root(props:{checked?:Checked;disabled?:boolean;onChange?:(value:Checked)=>void}):JSX.Element{return {} as JSX.Element;}
`;
const source = `import * as Primitive from './primitive';
export function Toggle(props:Parameters<typeof Primitive.Root>[0]) {return <Primitive.Root data-slot="toggle" {...props}/>;}
export function Action({asChild=false,...props}:{asChild?:boolean;disabled?:boolean}) {const Comp=asChild?Primitive.Root:'button';return <Comp data-slot="action" {...props}/>;}
export function Box(props:{children?:string}) {const div='button';return <div {...props}><Action/></div>;}
`;

test('helper candidates remain unresolved source facts while contextual effects retain opaque content', () => fixture(dir => {
  const code = `import './primitive';
type Input={children?:unknown;className?:string};
const definition={prefix:'base '};
function normalize(input:Input,metadata:typeof definition){const output={...input};output.className=metadata.prefix+(input.className??'');return output;}
export function Control(props:Input){const {children,...rest}=normalize(props,definition);return <button {...rest}>{children}</button>;}`;
  writeFileSync(path.join(dir,'components.tsx'),code);
  const program=readReactSourceProgram(dir,['components.tsx']);
  assert.deepEqual(program.problems,[]);
  const component=program.components.find(c=>c.exportName==='Control')!;
  assert.equal(component.children.kind,'unresolved');
  assert.equal(component.helperCandidates?.length,1);
  const candidate=component.helperCandidates![0];
  const reference={sourceRoot:dir,files:program.files};
  let childReads=0;
  const child={get nested(){childReads++;throw Error('opaque child inspected');}};
  const effects=readReactHelperEffects(reference,'components.tsx',candidate,{children:child,className:'caller'});
  assert.equal(effects.status,'modeled');
  assert.equal(effects.runtimeVerified,false);
  assert.equal(effects.acceptedContract,null);
  assert.equal(childReads,0);
  assert.equal(component.children.kind,'unresolved','a conditional model never promotes the shared source fact');
  assert.deepEqual(effects.output,{kind:'record',fields:[['children',{kind:'opaque'}],['className',{kind:'literal',type:'string',value:'base caller'}]]});
  assert.ok(effects.runtimeRequirements.includes('registered-React-props-and-unchanged-descriptors'));
  assert.ok(effects.calls.length>0);
  assert.ok(Object.keys(effects.sourceFiles).includes(realpathSync(path.join(dir,'components.tsx'))));
  const sibling=readReactHelperEffects(reference,'components.tsx',candidate,{children:child,className:child});
  assert.equal(sibling.status,'refused');
  if(sibling.status==='refused')assert.equal(sibling.reason,'helper-input-domain-unproved');
  const getter=readReactHelperEffects(reference,'components.tsx',candidate,{children:'value',get className(){throw Error('input getter executed');}});
  assert.equal(getter.status,'refused');
  if(getter.status==='refused')assert.equal(getter.reason,'helper-input-not-data');
  const forged=readReactHelperEffects(reference,'components.tsx',{...candidate,parameter:{start:0,end:1}},{children:'value'});
  assert.equal(forged.status,'refused');
  const unwitnessed=readReactHelperEffects({...reference,files:{}},'components.tsx',candidate,{children:'value'});
  assert.equal(unwitnessed.status,'refused');
  writeFileSync(path.join(dir,'components.tsx'),code+'\n// changed original');
  const stale=readReactHelperEffects(reference,'components.tsx',candidate,{children:'value'});
  assert.equal(stale.status,'refused');
  if(stale.status==='refused')assert.equal(stale.reason,'helper-reference-changed');
}));

test('helper effects refuse content inspection, replacement, external writes and unknown callbacks', () => fixture(dir => {
  for(const [body,reason] of [
    ['input.children="Changed";return {...input};','external-data-write'],
    ['return {...input,children:"Changed"};','helper-content-not-preserved'],
    ['const kind=typeof input.children;return {...input,className:kind};','opaque-content-inspected'],
    ['return {...input,className:String(input.children)};','binding-without-source:String'],
    ['metadata.prefix="Changed";return {...input};','external-data-write'],
    ['throw Error("unknown source behavior");','statement-unmodeled:ThrowStatement'],
    ['const items:unknown[]=[false,false];if(items.some(value=>{items[1]=input.children;return value;}))return {...input,children:"Changed"};return {...input};','iteration-receiver-write-unmodeled'],
    ['const items:unknown[]=[false,false];const values=items.map(value=>{items[1]=input.children;return typeof value;});return {...input,className:values.join()};','iteration-receiver-write-unmodeled'],
    ['const items:unknown[]=[];items[1000000000]=input.children;return {...input};','array-sparse-write-unmodeled'],
    ['if(!["a"].includes("a",1))return {...input,children:"Changed"};return {...input};','helper-content-not-preserved'],
    ['if(!"a".startsWith("a",1))return {...input,children:"Changed"};return {...input};','helper-content-not-preserved'],
    ['if(!"a".includes("a",1))return {...input,children:"Changed"};return {...input};','helper-content-not-preserved'],
    ['if([].hasOwnProperty("length"))return {...input,children:"Changed"};return {...input};','helper-content-not-preserved'],
    ['if(typeof {}.valueOf==="function")return {...input,children:"Changed"};return {...input};','inherited-property-unmodeled:valueOf'],
    ['if("valueOf" in {})return {...input,children:"Changed"};return {...input};','helper-content-not-preserved'],
    ['if("size" in new Set([]))return {...input,children:"Changed"};return {...input};','in-prototype-unmodeled'],
    ['const {children="fallback"}=input;return {...input,children};','opaque-content-inspected'],
    ['const defaulted=(children:unknown="fallback")=>children;return {...input,children:defaulted(input.children)};','opaque-content-inspected'],
    ['const lower=async()=>({children:input.children});return lower();','function-kind-unmodeled'],
    ['function* lower(){return {children:input.children};}return lower();','function-kind-unmodeled'],
    ['const callbacks:Array<()=>number>=[];for(let i=0;i<2;i++){callbacks.push(()=>i);}if(callbacks[0]()===0)return {...input,children:"Changed"};return {...input};','loop-lexical-capture-unmodeled'],
  ]) {
    // These cases previously could appear content-preserving in an incomplete
    // model. Run the small source fixture independently to show the actual
    // replacement that the abstract result must never approve.
    if (reason === 'helper-content-not-preserved' ||
        reason === 'inherited-property-unmodeled:valueOf' ||
        reason === 'in-prototype-unmodeled' ||
        reason === 'loop-lexical-capture-unmodeled' || body.includes('"fallback"')) {
      const input = {children: body.includes('"fallback"') ? undefined : 'original'};
      const javascript = ts.transpileModule(`function normalize(input:any,metadata:any){${body}} normalize(input,metadata);`,
        {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
      const actual = runInNewContext(javascript,{input,metadata:{prefix:'base'}});
      assert.notEqual(actual.children,input.children,body);
    }
    writeFileSync(path.join(dir,'components.tsx'),`import './primitive';
type Input={children?:unknown;className?:string};const definition={prefix:'base'};
function normalize(input:Input,metadata:typeof definition){${body}}
export function Control(props:Input){const {children,...rest}=normalize(props,definition);return <button {...rest}>{children}</button>;}`);
    const program=readReactSourceProgram(dir,['components.tsx']);
    const candidate=program.components.find(c=>c.exportName==='Control')!.helperCandidates![0];
    const result=readReactHelperEffects({sourceRoot:dir,files:program.files},'components.tsx',candidate,{children:'original'});
    assert.equal(result.status,'refused',body);
    if(result.status==='refused')assert.equal(result.reason,reason,body);
  }
}));

test('JSX dependency observation follows source symbols through aliases and barrels, with a finite export closure', () => fixture(dir => {
  writeFileSync(path.join(dir, 'barrel.ts'), "export {Shell as Forwarded} from './shell.js';");
  writeFileSync(path.join(dir, 'shell.tsx'), `import './primitive';import * as Parts from './leaf.js';
export function Shell(props:{children?:string}) {return <Parts.lower {...props}/>;}
export const Unrelated=7;`);
  writeFileSync(path.join(dir, 'leaf.tsx'), `import './primitive';import {Shell} from './shell.js';
export function lower(props:{children?:string;again?:boolean}) {return <button>{props.again?<Shell/>:props.children}</button>;}`);
  const entry = `import './primitive';import {Forwarded as Inner} from './barrel.js';
export function Outer(props:{children?:string}) {return <Inner {...props}/>;}`;
  writeFileSync(path.join(dir, 'components.tsx'), entry);
  const plain = readReactSourceProgram(dir, ['components.tsx']);
  assert.deepEqual(plain.components.map(c => c.exportName), ['Outer']);
  const observed = readReactSourceProgram(dir, ['components.tsx'], {includeJsxDependencies:true});
  assert.deepEqual(observed.problems, []);
  assert.deepEqual(observed.components.map(c => [c.module,c.exportName]), [['components.tsx','Outer'],['shell.tsx','Shell'],['leaf.tsx','lower']]);
  assert.deepEqual(observed.files, plain.files, 'discovery uses files already read by the installed checker');
  assert.deepEqual(observed.readerOptions.jsxDependencyEntries, ['components.tsx']);
  const shell = observed.components[1];
  assert.deepEqual(observed.components[0].root.definition, {module:shell.module,exportName:shell.exportName,sourceSha256:shell.sourceSha256,span:shell.span});
  assert.equal(shell.root.definition?.exportName, 'lower');
  assert.equal(observed.components[2].componentReferences[0].target.definition?.exportName, 'Shell');
  assert.deepEqual(readReactSourceProgram(dir, observed.readerOptions.jsxDependencyEntries!, {includeJsxDependencies:true}), observed);
  assert.equal(readFileSync(path.join(dir,'components.tsx'),'utf8'),entry);
  writeFileSync(path.join(dir,'leaf.tsx'), readFileSync(path.join(dir,'leaf.tsx'),'utf8')+'\n// changed dependency');
  assert.equal(reactSourceProgramUnchanged(observed), false);
}));

test('declarations and private implementations cannot become guessed dependency exports', () => fixture(dir => {
  writeFileSync(path.join(dir,'external.d.ts'), 'import "./primitive";export declare function External(props:{children?:string}):JSX.Element;');
  writeFileSync(path.join(dir,'components.tsx'), `import './primitive';import {External} from './external';
const Private=(props:{children?:string})=><button {...props}/>;
export function Outer(props:{children?:string}) {return <External><Private {...props}/></External>;}`);
  const program=readReactSourceProgram(dir,['components.tsx'],{includeJsxDependencies:true});
  assert.deepEqual(program.problems,[]);
  assert.deepEqual(program.components.map(c=>c.exportName),['Outer']);
  assert.equal(program.components[0].root.dependencyProblem,'implementation-unavailable');
  assert.equal(program.components[0].componentReferences[1].target.dependencyProblem,'runtime-export-unavailable');
  assert.equal(program.status,'refused');
  assert.ok(program.components[0].problems.includes('jsx-dependency-implementation-unavailable:External'));
}));

test('dependency value aliases retain their executable export identity with unresolved implementation and content', () => fixture(dir => {
  writeFileSync(path.join(dir,'aliases.ts'), `import {Root} from './primitive';export const Alias=Root;export const Unused={};`);
  writeFileSync(path.join(dir,'components.tsx'), `import {Alias} from './aliases';export function Outer(props:{disabled?:boolean}) {return <Alias {...props}/>;}`);
  const program=readReactSourceProgram(dir,['components.tsx'],{includeJsxDependencies:true});
  assert.deepEqual(program.problems,[]);
  assert.deepEqual(program.components.map(c=>c.exportName),['Outer','Alias']);
  assert.equal(program.status,'refused');
  assert.deepEqual(program.components[1].problems,['component-function-unresolved']);
  assert.equal(program.components[1].children.kind,'unresolved');
  assert.equal(program.components[1].root.kind,'unresolved');
  assert.ok(readReactSourceProgram(dir,['aliases.ts']).problems.includes('Alias:component-function-unresolved'),'explicit entry rules are unchanged');
}));

test('ambiguous exports, shadowed imports and source-root escapes never register a guessed implementation', () => fixture(dir => {
  writeFileSync(path.join(dir,'ambiguous.tsx'),`import './primitive';const Hidden=(props:{children?:string})=><button {...props}/>;export {Hidden as First,Hidden as Second};`);
  writeFileSync(path.join(dir,'components.tsx'),`import './primitive';import {First} from './ambiguous';
export function Outer(props:{children?:string}) {return <First {...props}/>;}
export function Shadow(First:(props:{children?:string})=>JSX.Element) {return <First/>;}`);
  const ambiguous=readReactSourceProgram(dir,['components.tsx'],{includeJsxDependencies:true});
  assert.deepEqual(ambiguous.problems,[]);
  assert.deepEqual(ambiguous.components.map(c=>c.exportName),['Outer','Shadow']);
  assert.equal(ambiguous.components[0].root.dependencyProblem,'export-ambiguous');
  assert.equal(ambiguous.components[1].root.dependencyProblem,'runtime-export-unavailable');
  assert.equal(ambiguous.components[1].root.definition,undefined);
  const external=mkdtempSync(path.join(tmpdir(),'react-external-dependency-'));
  try {
    writeFileSync(path.join(external,'outside.tsx'),'export function Outside(props:{children?:string}) {return <button {...props}/>;}');
    symlinkSync(path.join(external,'outside.tsx'),path.join(dir,'outside.tsx'));
    writeFileSync(path.join(dir,'components.tsx'),`import './primitive';import {Outside} from './outside';export function Outer(props:{children?:string}) {return <Outside {...props}/>;}`);
    const escaped=readReactSourceProgram(dir,['components.tsx'],{includeJsxDependencies:true});
    assert.deepEqual(escaped.problems,[]);
    assert.deepEqual(escaped.components.map(c=>c.exportName),['Outer']);
    assert.equal(escaped.components[0].root.dependencyProblem,'outside-source-root');
    assert.equal(escaped.components[0].root.definition,undefined);
  } finally {rmSync(external,{recursive:true,force:true});}
}));

test('reassigned or escaped dependency implementations retain identity without qualifying their old JSX body', () => fixture(dir => {
  for(const [declaration, mutation, entryExtra] of [
    ['export let Control=(props:{children?:string})=><button {...props}/>;', '', ''],
    ['export function Control(props:{children?:string}) {return <button {...props}/>;}', '// @ts-expect-error deliberate runtime replacement\nControl=()=> <div/>;', ''],
    ['export const Control=(props:{children?:string})=><button {...props}/>;', 'const escaped=Control;Object.assign(escaped,{render:()=> <div/>});', ''],
    ['export const Control=(props:{children?:string})=><button {...props}/>;', '', 'Object.assign(Control,{render:()=> <div/>});'],
    ['export const Control=(props:{children?:string})=><button {...props}/>;', "eval('Control.render=()=>null');", ''],
    ['export const Control=(props:{children?:string})=><button {...props}/>;', '', "import * as Namespace from './leaf';const mutate=(value:any)=>{value.Control.render=()=>null};mutate(Namespace);"],
    ['export const Control=(props:{children?:string})=><button {...props}/>;', '', "const Namespace=await import('./leaf');const mutate=(value:any)=>{value.Control.render=()=>null};mutate(Namespace);"],
  ]) {
    writeFileSync(path.join(dir,'leaf.tsx'),`import './primitive';${declaration}${mutation}`);
    writeFileSync(path.join(dir,'components.tsx'),`import './primitive';import {Control} from './leaf';${entryExtra}export function Outer(props:{children?:string}) {return <Control {...props}/>;}`);
    const program=readReactSourceProgram(dir,['components.tsx'],{includeJsxDependencies:true});
    assert.deepEqual(program.problems,[]);
    const control=program.components.find(c=>c.exportName==='Control')!;
    assert.equal(control.root.kind,'unresolved',JSON.stringify({declaration,mutation,entryExtra}));
    assert.equal(control.children.kind,'unresolved');
    assert.ok(control.problems.includes('dependency-implementation-mutation-or-escape'));
  }
}));

test('source-proven React contexts are retained separately from component functions',()=>fixture(dir=>{
  writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,jsx:'react',target:'ES2022',module:'ESNext',moduleResolution:'Bundler',skipLibCheck:true,
    paths:{react:[path.resolve('node_modules/@types/react/index.d.ts')]}}}));
  for(const [imports,factory,hook] of [
    ["import * as React from 'react';",'React.createContext','React.useContext'],
    ["import React from 'react';",'React.createContext','React.useContext'],
    ["import {default as React} from 'react';",'React.createContext','React.useContext'],
    ["import * as React from 'react'; import {createContext as make,useContext as read} from 'react';",'make','read'],
  ]){
    const text=`${imports}
const Settings=${factory}<string>('default');
Settings.displayName='Preferences';
export {Settings as Preferences};
export function Panel(props:{children?:string}){const value=${hook}(Settings);return <Settings.Provider value={value}><div>{props.children}</div></Settings.Provider>}
throw Error('reader-must-not-execute');`;
    writeFileSync(path.join(dir,'components.tsx'),text);
    const program=readReactSourceProgram(dir,['components.tsx']);
    assert.deepEqual(program.problems,[]);
    assert.deepEqual(program.components.map(c=>c.exportName),['Panel']);
    assert.deepEqual(program.contextExports?.map(c=>[c.module,c.exportName]),[['components.tsx','Preferences']]);
    const context=program.contextExports![0];
    assert.equal(context.sourceSha256,program.components[0].sourceSha256);
    assert.equal(text.slice(context.span.start,context.span.end),`Settings=${factory}<string>('default')`);
    assert.equal(program.components[0].children.kind,'unresolved','a context classification cannot qualify provider content');
    assert.ok(reactSourceProgramUnchanged(program));
    assert.equal(readFileSync(path.join(dir,'components.tsx'),'utf8'),text);
  }
}));

test('context lookalikes, factory substitutions and context value escapes retain named refusals',()=>fixture(dir=>{
  writeFileSync(path.join(dir,'tsconfig.json'),JSON.stringify({compilerOptions:{strict:true,jsx:'react',target:'ES2022',module:'ESNext',moduleResolution:'Bundler',skipLibCheck:true,
    paths:{react:[path.resolve('node_modules/@types/react/index.d.ts')]}}}));
  writeFileSync(path.join(dir,'fake.ts'),"export function createContext(value:string){return {value}}");
  for(const body of [
    "export let Preferences=React.createContext('x');",
    "export const Preferences=React['createContext']('x');",
    "const make=React.createContext;export const Preferences=make('x');",
    "import {createContext} from './fake';export const Preferences=createContext('x');",
    "export const Preferences={Provider:()=>null};",
    "export const Preferences=React.createContext('x');(Preferences as any).$$typeof=Symbol.for('react.forward_ref');",
    "export const Preferences=React.createContext('x');Object.assign(Preferences,{render:()=>null});",
    "export const Preferences=React.createContext('x');const alias=Preferences;(alias as any).Provider=()=>null;",
    "export const Preferences=React.createContext('x');(Preferences as any).displayName=(()=> 'Changed')();",
    "export const Preferences=React.createContext('x');(React as any).createContext=()=>()=>null;",
    "export const Preferences=React.createContext('x');(React as any).useContext=(context:any)=>Object.assign(context,{render:()=>null});",
    "export const Preferences=React.createContext('x');import OtherReact from 'react';Object.assign(OtherReact,{createContext:()=>null});",
    "export const Preferences=React.createContext('x');import {useContext as read} from 'react';const escaped=read;",
    "export const Preferences=React.createContext('x');eval('Preferences.render=()=>null');",
    "export const Preferences=React.createContext('x');(eval)('Preferences.render=()=>null');",
    "export const Preferences=React.createContext('x');import {default as OtherReact} from 'react';Object.assign(OtherReact,{createContext:()=>null});",
    "export const Preferences=React.createContext('x');import OtherReact = require('react');Object.assign(OtherReact,{createContext:()=>null});",
  ]){
    writeFileSync(path.join(dir,'components.tsx'),`import * as React from 'react';${body}\nexport function Panel(props:{children?:string}){return <div {...props}/>}`);
    const program=readReactSourceProgram(dir,['components.tsx']);
    assert.equal(program.contextExports,undefined,body);
    assert.ok(program.problems.includes('Preferences:component-function-unresolved'),JSON.stringify({body,problems:program.problems}));
  }
}));

test("nested unchanged children retain a host path instead of becoming a root slot", () =>
  fixture((dir) => {
    writeFileSync(
      path.join(dir, "components.tsx"),
      `import './primitive';
type API = {children?: string[]; mirror?: string[]; visible?: boolean};
function External(props: API) {return <div {...props}/>}
export function Deep({children}: API) {return <div><div><button>{children}</button></div></div>}
export function Siblings({children}: API) {return <div>Heading<div/><div><button/>{/* comment */}<div>{children}</div></div><button/></div>}
export function Attribute({children}: API) {return <div><button children={children}/></div>}
export function Spread(props: API) {return <div><button {...props}/></div>}
export function Duplicate({children}: API) {return <div><div>{children}</div><button>{children}</button></div>}
export function Fragment({children}: API) {return <div><><button>{children}</button></></div>}
export function Component({children}: API) {return <div><External>{children}</External></div>}
export function Dynamic({children,visible}: API) {return <div>{visible && <button/>}<div>{children}</div></div>}
export function Mixed({children}: API) {return <div><div>{children} extra</div></div>}
export function Changed({children}: API) {children?.push('changed');return <div><div>{children}</div></div>}
export function Aliased({children,mirror}: API) {mirror?.push('changed');return <div><div>{children}</div></div>}
export function EscapedAttribute({children}: API) {return <div onClick={() => <button>{children}</button>}><div>{children}</div></div>}
export function Transformed({children}: API) {return <div><div>{children?.join(',')}</div></div>}
export function Defaulted({children=[]}: API) {return <div><div>{children}</div></div>}
`,
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    const fact = (name: string) =>
      program.components.find((c) => c.name === name)!.children;
    for (const [name, slotPath, hosts] of [
      [
        "Deep",
        "0.0",
        [
          ["", "div"],
          ["0", "div"],
          ["0.0", "button"],
        ],
      ],
      [
        "Siblings",
        "1.1",
        [
          ["", "div"],
          ["0", "div"],
          ["1", "div"],
          ["1.0", "button"],
          ["1.1", "div"],
          ["2", "button"],
        ],
      ],
      [
        "Attribute",
        "0",
        [
          ["", "div"],
          ["0", "button"],
        ],
      ],
      [
        "Spread",
        "0",
        [
          ["", "div"],
          ["0", "button"],
        ],
      ],
    ] as const) {
      const result = fact(name);
      assert.equal(result.kind, "nested-forwarded", name);
      assert.deepEqual(
        result.nestedSlot,
        { path: slotPath, hosts: hosts.map(([path, tag]) => ({ path, tag })) },
        name,
      );
      assert.ok(result.span && result.span.end > result.span.start);
    }
    for (const name of [
      "Duplicate",
      "Fragment",
      "Component",
      "Dynamic",
      "Mixed",
      "Changed",
      "Aliased",
      "EscapedAttribute",
      "Transformed",
      "Defaulted",
    ]) {
      assert.notEqual(fact(name).kind, "forwarded", name);
      assert.notEqual(fact(name).kind, "nested-forwarded", name);
      assert.equal(fact(name).nestedSlot, undefined, name);
    }
    assert.equal(fact("Changed").reason, "children-input-escape-or-mutation");
    assert.equal(fact("Aliased").reason, "children-alias-unresolved");
    assert.equal(
      fact("EscapedAttribute").reason,
      "children-input-escape-or-mutation",
    );
    assert.deepEqual(readReactSourceProgram(dir, ["components.tsx"]), program);
  }));
function fixture(fn: (dir: string) => void) {
  const dir = mkdtempSync(path.join(tmpdir(), "react-program-"));
  try {
    writeFileSync(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          jsx: "preserve",
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          skipLibCheck: true,
          noEmit: true,
        },
      }),
    );
    writeFileSync(path.join(dir, "primitive.ts"), declarations);
    writeFileSync(path.join(dir, "components.tsx"), source);
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("local const aliases retain unchanged root and nested caller slots", () =>
  fixture((dir) => {
    const input = `import './primitive';
type API={children?:string[];mirror?:string[];disabled?:boolean};
export function Direct(props:API) {const content=props.children;const label=content;return <button>{label}</button>}
export function Destructured(props:API) {const copied=props;const {children:content,...rest}=copied;return <button {...rest}>{content}</button>}
export function Rest(props:API) {const {disabled,...rest}=props;const next=rest;return <button {...next}/>}
export function Nested(props:API) {const {children}=props;const content=children;return <div><button>{content}</button></div>}
`;
    writeFileSync(path.join(dir, "components.tsx"), input);
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    const fact = (name: string) => program.components.find((c) => c.name === name)!.children;
    for (const name of ["Direct", "Destructured", "Rest"])
      assert.equal(fact(name).kind, "forwarded", name);
    assert.equal(fact("Nested").kind, "nested-forwarded");
    assert.deepEqual(fact("Nested").nestedSlot, {
      path: "0", hosts: [{path:"",tag:"div"},{path:"0",tag:"button"}],
    });
    assert.deepEqual(readReactSourceProgram(dir, ["components.tsx"]), program);
    assert.equal(readFileSync(path.join(dir, "components.tsx"), "utf8"), input);
  }));

test("local content aliases retain mutation, sibling-alias, helper and control-flow refusals", () =>
  fixture((dir) => {
    writeFileSync(path.join(dir, "components.tsx"), `import './primitive';
type API={children?:string[];mirror?:string[];visible?:boolean};
function helper(props:API):API {const out={...props};out.mirror?.push('changed');return out;}
export function LocalMutation(props:API) {const content=props.children;content?.push('changed');return <button>{content}</button>}
export function ContainerMutation(props:API) {const alias=props;alias.children=['changed'];return <button>{alias.children}</button>}
export function SiblingMutation(props:API) {const {children,mirror}=props;mirror?.push('changed');return <button>{children}</button>}
export function RestMutation(props:API) {const {children,...rest}=props;rest.mirror?.push('changed');return <button>{children}</button>}
export function AliasedSibling(props:API) {const {children,mirror}=props;const again=mirror;again?.push('changed');return <button>{children}</button>}
export function Escaped(props:API) {const alias=props;helper(alias);return <button>{alias.children}</button>}
export function HelperResult(props:API) {const {children}=helper(props);return <button>{children}</button>}
export function Defaulted(props:API) {const {children=[]}=props;return <button>{children}</button>}
export function SiblingDefault(props:API) {const {children,mirror=(props.children?.push('changed'),[])}=props;return <button>{children}</button>}
export function Computed(props:API) {const {['children']:children}=props;return <button>{children}</button>}
export function Mutable(props:API) {let content=props.children;content=['changed'];return <button>{content}</button>}
export function Excluded(props:API) {const {children,...rest}=props;const {children:missing}=rest as API;return <button>{missing}</button>}
export function Branch(props:API) {let content; if(props.visible) {const alias=props.children;content=alias;}return <button>{content}</button>}
export function LateMutation(props:API) {const content=props.children;return <button onClick={()=>content?.push('changed')}>{content}</button>}
`);
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    for (const component of program.components) {
      assert.equal(component.children.kind, "unresolved", component.name);
      assert.equal(component.children.nestedSlot, undefined, component.name);
    }
    assert.equal(program.components.find((c) => c.name === "SiblingMutation")!.children.reason, "children-alias-unresolved");
    assert.equal(program.components.find((c) => c.name === "ContainerMutation")!.children.reason, "children-input-escape-or-mutation");
    assert.equal(program.components.find((c) => c.name === "HelperResult")!.children.reason, "children-expression-unresolved");
  }));

test("installed generic props and conditional JSX roots retain typed identities without executing modules", () =>
  fixture((dir) => {
    writeFileSync(
      path.join(dir, "primitive.ts"),
      declarations + "\nthrow Error('must not execute');",
    );
    const r = readReactSourceProgram(dir, ["components.tsx"]);
    assert.equal(r.status, "observed", JSON.stringify(r.problems));
    assert.equal(r.components.length, 3);
    const toggle = r.components.find((c) => c.name === "Toggle")!;
    const checked = toggle.props.find((p) => p.name === "checked")!;
    assert.equal(checked.optional, true);
    assert.equal(checked.type.kind, "union");
    if (checked.type.kind === "union")
      assert.deepEqual(
        checked.type.members
          .map((t) => (t.kind === "literal" ? t.value : t.kind))
          .sort(),
        [false, true, "indeterminate", "undefined"].sort(),
      );
    assert.ok(checked.declaredIn.some((d) => d.file === "primitive.ts"));
    const signature = toggle.props.find(
      (p) => p.name === "onChange",
    )!.callbackSignatures!;
    assert.equal(signature.length, 1);
    assert.equal(signature[0].returnsVoid, true);
    assert.equal(signature[0].typeParameters, 0);
    assert.equal(signature[0].parameters[0].name, "value");
    assert.equal(signature[0].parameters[0].optional, false);
    assert.equal(signature[0].parameters[0].rest, false);
    const parameterType = signature[0].parameters[0].type;
    assert.equal(parameterType.kind, "union");
    if (parameterType.kind === "union")
      assert.deepEqual(
        parameterType.members
          .map((t) => (t.kind === "literal" ? t.value : t.kind))
          .sort(),
        [false, true, "indeterminate"].sort(),
      );
    assert.deepEqual(toggle.root, {
      kind: "component",
      name: "Primitive.Root",
      module: "./primitive",
      export: "Root",
    });
    assert.equal(
      toggle.props.find((p) => p.name === "onChange")!.type.kind,
      "union",
    );
    const action = r.components.find((c) => c.name === "Action")!;
    assert.equal(action.defaults.asChild, false);
    assert.deepEqual(action.root, {
      kind: "conditional",
      condition: "asChild",
      whenTrue: toggle.root,
      whenFalse: { kind: "host", name: "button" },
    });
    assert.deepEqual(action.forwardedProps, ["props"]);
    assert.deepEqual(action.markers, [{ name: "data-slot", value: "action" }]);
    assert.deepEqual(r.components.find((c) => c.name === "Box")!.root, {
      kind: "host",
      name: "div",
    });
    assert.equal(
      r.components.find((c) => c.name === "Box")!.componentReferences[0].target
        .export,
      "Action",
    );
    assert.equal(reactSourceProgramUnchanged(r), true);
    writeFileSync(
      path.join(dir, "primitive.ts"),
      declarations.replace("boolean | 'indeterminate'", "boolean"),
    );
    assert.equal(reactSourceProgramUnchanged(r), false);
    const changed = readReactSourceProgram(dir, ["components.tsx"]);
    const type = changed.components[0].props.find(
      (p) => p.name === "checked",
    )!.type;
    assert.ok(!JSON.stringify(type).includes("indeterminate"));
  }));
test("unresolved imports, mutable root aliases and ambiguous return paths remain named", () =>
  fixture((dir) => {
    writeFileSync(
      path.join(dir, "components.tsx"),
      source.replace("const Comp=", "let Comp="),
    );
    const mutable = readReactSourceProgram(dir, ["components.tsx"]);
    assert.equal(
      mutable.components.find((c) => c.name === "Action")!.root.kind,
      "unresolved",
    );
    writeFileSync(
      path.join(dir, "components.tsx"),
      source.replace("'./primitive'", "'./missing'"),
    );
    const missing = readReactSourceProgram(dir, ["components.tsx"]);
    assert.equal(missing.status, "refused");
    assert.ok(missing.problems.some((p) => p.includes("TS2307")));
    writeFileSync(
      path.join(dir, "components.tsx"),
      source.replace(
        "return <Comp",
        "if (asChild) return <button/>;return <Comp",
      ),
    );
    const ambiguous = readReactSourceProgram(dir, ["components.tsx"]);
    assert.ok(
      ambiguous.components
        .find((c) => c.name === "Action")!
        .problems.includes("component-return-control-flow-unresolved"),
    );
  }));

test("legacy compiler options are acknowledged for reading without hiding type errors or editing config", () =>
  fixture((dir) => {
    const config = JSON.stringify({
      compilerOptions: {
        strict: true,
        jsx: "preserve",
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        baseUrl: ".",
        skipLibCheck: true,
        noEmit: true,
      },
    });
    writeFileSync(path.join(dir, "tsconfig.json"), config);
    const read = readReactSourceProgram(dir, ["components.tsx"]);
    assert.equal(read.status, "observed", JSON.stringify(read.problems));
    assert.equal(read.readerOptions.ignoreDeprecations, "6.0");
    assert.ok(read.compatibilityNotes.some((n) => n.includes("baseUrl")));
    assert.equal(readFileSync(path.join(dir, "tsconfig.json"), "utf8"), config);
    writeFileSync(
      path.join(dir, "components.tsx"),
      source.replace("'./primitive'", "'./missing'"),
    );
    const broken = readReactSourceProgram(dir, ["components.tsx"]);
    assert.equal(broken.status, "refused");
    assert.ok(broken.problems.some((p) => p.includes("TS2307")));
  }));

test("an explicitly any-typed inherited property is retained by name beside usable typed facts", () =>
  fixture((dir) => {
    writeFileSync(
      path.join(dir, "primitive.ts"),
      declarations.replace("checked?:Checked", "inlist?:any;checked?:Checked"),
    );
    const result = readReactSourceProgram(dir, ["components.tsx"]);
    assert.equal(result.status, "refused");
    const toggle = result.components.find((c) => c.name === "Toggle")!;
    assert.equal(
      toggle.props.find((p) => p.name === "inlist")!.type.kind,
      "any",
    );
    assert.ok(toggle.problems.includes("unresolved-prop-type:inlist"));
    assert.equal(
      toggle.props.find((p) => p.name === "checked")!.type.kind,
      "union",
    );
  }));

test("children flow respects input identity, JSX precedence, exclusion, defaults and mutation", () =>
  fixture((dir) => {
    const body = `type API={children?:string;className?:string};
export function Spread(props:API){return <div {...props}/>;}
export function Rest({className,...rest}:API){return <div className={className} {...rest}/>;}
export function Renamed({children:body,...rest}:API){return <div {...rest}>{body}</div>;}
export function Member(props:API){return <div>{props.children}</div>;}
export function Index(props:API){return <div children={props['children']}/>;}
export function ExplicitLast(props:API){return <div {...props} children="fixed"/>;}
export function SpreadLast(props:API){return <div children="fixed" {...props}/>;}
export function NestedWins(props:API){return <div {...props}>fixed</div>;}
export function Newline(props:API){return <div {...props}>\n   </div>;}
export function Space(props:API){return <div {...props}> </div>;}
export function Comment(props:API){return <div {...props}>{/* no override */}</div>;}
export function Removed({children,...rest}:API){return <div {...rest}/>;}
export function Defaulted({children='fallback'}:API){return <div>{children}</div>;}
export function Changed(props:API){props.children='changed';return <div {...props}/>;}
export function Escaped(props:API){Object.assign(props,{children:'changed'});return <div {...props}/>;}
export function Transformed({children}:API){return <div>{children?.toUpperCase()}</div>;}
export function Composed({children}:API){return <div>prefix{children}</div>;}
export function UnknownLast(props:API){const other={};return <div {...props} {...other}/>;}
export function ExplicitWins(props:API){const other={};return <div {...other} children={props.children}/>;}
export function Primitive(props:API){return <div {...props}/>;}
export function Imported(props:API){return <Primitive {...props}/>;}
export function Shadowed(props:API){const identity=(props:API)=>props.children;return <div {...props}/>;}
export function FalseMatch(props:API){const children='fixed';return <div>{children}</div>;}
export function Early(props:API){if(props.children)return <div/>;return <div {...props}/>;}
export function Arguments(props:API){arguments[0].children='changed';return <div {...props}/>;}
export function Evaluated(props:API){eval("props.children='changed'");return <div {...props}/>;}
export function Loop(props:API){while(Math.random()>0.5){return <div/>;}return <div {...props}/>;}
export function SiblingDefault({children,x=(children='replaced')}:{children?:string;x?:string}){return <div>{children}</div>;}
`;
    writeFileSync(
      path.join(dir, "components.tsx"),
      "import './primitive';\n" + body,
    );
    const p = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(p.problems, []);
    const fact = (name: string) =>
      p.components.find((c) => c.name === name)!.children;
    for (const name of [
      "Spread",
      "Rest",
      "Renamed",
      "Member",
      "Index",
      "SpreadLast",
      "Newline",
      "Comment",
      "ExplicitWins",
      "Imported",
      "Shadowed",
    ])
      assert.equal(
        fact(name).kind,
        "forwarded",
        `${name}: ${JSON.stringify(fact(name))}`,
      );
    for (const name of ["ExplicitLast", "NestedWins", "Space"])
      assert.equal(fact(name).kind, "replaced", name);
    assert.equal(fact("Removed").kind, "absent");
    for (const name of [
      "Defaulted",
      "Changed",
      "Escaped",
      "Transformed",
      "Composed",
      "UnknownLast",
      "FalseMatch",
      "Early",
      "Loop",
      "Arguments",
      "Evaluated",
      "SiblingDefault",
    ])
      assert.equal(
        fact(name).kind,
        "unresolved",
        `${name}: ${JSON.stringify(fact(name))}`,
      );
    assert.equal(fact("Changed").reason, "children-input-escape-or-mutation");
    assert.equal(fact("Early").reason, "children-control-flow-unresolved");
  }));

test("children proof refuses mutable aliases through siblings and other parameters", () =>
  fixture((dir) => {
    const body = `
type API={children:string[];mirror:string[]};
export function Changed({children,mirror}:API){mirror[0]='changed';return <div>{children}</div>;}
export function Renamed({children,mirror:other}:API){other.pop();return <div>{children}</div>;}
export function Escaped({children,mirror}:API){const replace=(v:string[])=>v.splice(0,1,'changed');replace(mirror);return <div>{children}</div>;}
export function Captured({children,mirror}:API){const mutate=()=>mirror.pop();mutate();return <div>{children}</div>;}
export function Defaulted({children,mirror,x=mirror.pop()}:API&{x?:string}){return <div>{children}</div>;}
export function Unknown({children,mirror}:{children:string[];mirror:unknown}){(mirror as string[]).pop();return <div>{children}</div>;}
export function Any({children,mirror}:{children:string[];mirror:any}){mirror.pop();return <div>{children}</div>;}
export function Readonly({children,mirror}:{children:readonly string[];mirror:string[]}){mirror.pop();return <div>{children}</div>;}
export function Union({children,mirror}:{children:string|string[];mirror:string[]|undefined}){mirror?.pop();return <div>{children}</div>;}
export function RestAliased({mirror,...rest}:API){mirror.pop();return <div {...rest}/>;}
export function RestDefaulted({mirror,x=mirror.pop(),...rest}:API&{x?:string}){return <div {...rest}/>;}
export function RestUnused({mirror,...rest}:API){return <div {...rest}/>;}
export function RestPrimitive({mirror,...rest}:{children:string;mirror:string[]}){mirror.pop();return <div {...rest}/>;}
export function SpreadStyle({children,style}:{children:string[];style:{width?:number}}){return <div style={{...style}}>{children}</div>;}
export function Unused({children,mirror}:API){return <div>{children}</div>;}
export function PrimitiveChild({children,mirror}:{children:string;mirror:string[]}){mirror.pop();return <div>{children}</div>;}
export function PrimitiveSibling({children,label,count,enabled}:{children:string[];label:string|null;count?:number;enabled:boolean}){const text=label?.toUpperCase()+String(count)+String(enabled);return <div title={text}>{children}</div>;}
export function Shadowed({children,mirror}:API){const local=(mirror:string[])=>mirror.pop();local(['unrelated']);return <div>{children}</div>;}
`;
    writeFileSync(
      path.join(dir, "components.tsx"),
      "import './primitive';\n" + body,
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    const fact = (name: string) =>
      program.components.find((c) => c.name === name)!.children;
    for (const name of [
      "Changed",
      "Renamed",
      "Escaped",
      "Captured",
      "Defaulted",
      "Unknown",
      "Any",
      "Readonly",
      "Union",
      "RestAliased",
      "RestDefaulted",
      "SpreadStyle",
    ])
      assert.deepEqual(
        fact(name),
        { kind: "unresolved", reason: "children-alias-unresolved" },
        name,
      );
    for (const name of [
      "Unused",
      "RestUnused",
      "RestPrimitive",
      "PrimitiveChild",
      "PrimitiveSibling",
      "Shadowed",
    ])
      assert.equal(fact(name).kind, "forwarded", name);

    // The returned reference stays identical, but the actual React children
    // have changed. This is the false proof the source reader must reject.
    const exports: Record<
      string,
      (props: unknown) => React.ReactElement<{ children: string[] }>
    > = {};
    runInNewContext(
      ts.transpileModule(body, {
        compilerOptions: {
          jsx: ts.JsxEmit.React,
          module: ts.ModuleKind.CommonJS,
        },
      }).outputText,
      { exports, React },
    );
    const children = ["original"];
    const element = exports.Changed({ children, mirror: children });
    assert.equal(element.props.children, children);
    assert.deepEqual(element.props.children, ["changed"]);
    const styleChildren = ["original"];
    let reads = 0;
    const style = Object.defineProperty({}, "width", {
      enumerable: true,
      get() {
        reads++;
        styleChildren[0] = "changed by getter";
        return 320;
      },
    });
    const styled = exports.SpreadStyle({ children: styleChildren, style });
    assert.equal(reads, 1);
    assert.equal(styled.props.children, styleChildren);
    assert.deepEqual(styled.props.children, ["changed by getter"]);
  }));

test("forwardRef callbacks cannot mutate children through the ref parameter", () =>
  fixture((dir) => {
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
    writeFileSync(
      path.join(dir, "components.tsx"),
      `
import * as React from 'react';
export const Aliased = React.forwardRef<string[],{children:string[]}>(({children},ref)=>{(ref as React.MutableRefObject<string[]>).current.pop();return <div>{children}</div>;});
export const Container = React.forwardRef<{children:string},{children:string}>((props,ref)=>{(ref as React.MutableRefObject<{children:string}>).current.children='changed';return <div {...props}/>;});
export const Invoked = React.forwardRef<HTMLDivElement,{children:string[]}>(({children},ref)=>{(ref as React.RefCallback<HTMLDivElement>)(null);return <div ref={ref}>{children}</div>;});
export const Passed = React.forwardRef<HTMLDivElement,{children:string[]}>(({children},ref)=><div ref={ref}>{children}</div>);
`,
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    for (const name of ["Aliased", "Container", "Invoked"])
      assert.deepEqual(
        program.components.find((c) => c.name === name)!.children,
        { kind: "unresolved", reason: "children-alias-unresolved" },
        name,
      );
    assert.equal(
      program.components.find((c) => c.name === "Passed")!.children.kind,
      "forwarded",
    );
  }));

test("React forwardRef callbacks retain source, public props and children facts without executing wrappers", () =>
  fixture((dir) => {
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
    writeFileSync(
      path.join(dir, "components.tsx"),
      `
import * as React from 'react';
import { forwardRef as wrap } from 'react';
export const Panel = React.forwardRef<HTMLDivElement, {children?:React.ReactNode; tone?:'quiet'|'loud'}>(
  function PanelBody({tone='quiet', children}, ref) { return <div ref={ref} data-tone={tone}>{children}</div>; });
export const Action = wrap<HTMLButtonElement, {children?:React.ReactNode; disabled?:boolean}>(
  (props, ref) => <button {...props} ref={ref}/>);
throw Error('static-reader-must-not-execute');
`,
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    assert.deepEqual(
      program.components.map((c) => c.exportName),
      ["Panel", "Action"],
    );
    for (const component of program.components) {
      assert.deepEqual(component.wrappers, ["forwardRef"]);
      assert.equal(component.children.kind, "forwarded");
      assert.ok(component.props.some((p) => p.name === "children"));
      assert.ok(
        component.props.some((p) => p.name === "ref"),
        "public wrapper signature includes ref",
      );
      assert.equal(component.root.kind, "host");
      assert.ok(component.span.end > component.span.start);
    }
    assert.deepEqual(program.components[0].defaults, { tone: "quiet" });
    assert.ok(reactSourceProgramUnchanged(program));
  }));

test("local const default components retain their real export identity without executing source", () =>
  fixture((dir) => {
    for (const declaration of [
      "export default Panel;",
      "export { Panel as default };",
    ]) {
      const contents = `import './primitive';
const Panel=({children}:{children?:string})=><div>{children}</div>;
${declaration}
throw Error('static-reader-must-not-execute');`;
      writeFileSync(path.join(dir, "components.tsx"), contents);
      const program = readReactSourceProgram(dir, ["components.tsx"]);
      assert.equal(
        program.status,
        "observed",
        JSON.stringify(program.problems),
      );
      assert.equal(program.components.length, 1);
      const component = program.components[0];
      assert.equal(component.name, "Panel");
      assert.equal(component.exportName, "default");
      assert.equal(component.module, "components.tsx");
      assert.equal(component.children.kind, "forwarded");
      assert.deepEqual(component.root, { kind: "host", name: "div" });
      assert.equal(
        contents.slice(component.span.start, component.span.end),
        "Panel=({children}:{children?:string})=><div>{children}</div>",
      );
      assert.equal(
        readFileSync(path.join(dir, "components.tsx"), "utf8"),
        contents,
      );
      assert.ok(reactSourceProgramUnchanged(program));
    }
  }));

test("default component intake refuses mutable, anonymous, transformed and external definitions", () =>
  fixture((dir) => {
    for (const [declaration, reason] of [
      [
        "let Panel=(props:{children?:string})=><div {...props}/>; export default Panel;",
        "default:component-binding-not-immutable",
      ],
      [
        "export default function Panel(props:{children?:string}) { return <div {...props}/>; }",
        "default:component-binding-not-immutable",
      ],
      [
        "export default (props:{children?:string})=><div {...props}/>;",
        "default:component-binding-not-immutable",
      ],
      [
        "const Panel=(props:{children?:string})=><div {...props}/>; const Alias=Panel; export default Alias;",
        "default:component-function-unresolved",
      ],
      [
        "const wrap=(x:any)=>x; const Panel=wrap((props:{children?:string})=><div {...props}/>); export default Panel;",
        "default:component-function-unresolved",
      ],
      [
        'export {Root as default} from "./primitive";',
        "default:component-definition-outside-module",
      ],
    ]) {
      writeFileSync(
        path.join(dir, "components.tsx"),
        `import './primitive';\n${declaration}`,
      );
      const program = readReactSourceProgram(dir, ["components.tsx"]);
      assert.equal(program.status, "refused", declaration);
      assert.deepEqual(program.components, [], declaration);
      assert.ok(
        program.problems.includes(reason),
        JSON.stringify(program.problems),
      );
    }
  }));

test("an original default-exported forwardRef keeps the wrapper signature and callback span", () =>
  fixture((dir) => {
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
    writeFileSync(
      path.join(dir, "components.tsx"),
      `
import React, {forwardRef} from 'react';
const Panel=forwardRef<HTMLDivElement,{children?:React.ReactNode; tone?:'quiet'|'loud'}>(
  ({children,tone='quiet',...props},ref)=><div {...props} ref={ref} data-tone={tone}>{children}</div>);
Panel.displayName='Public label is not the export identity';
export default Panel;
throw Error('must not execute');`,
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.equal(program.status, "observed", JSON.stringify(program.problems));
    assert.equal(program.components.length, 1);
    const component = program.components[0];
    assert.equal(component.exportName, "default");
    assert.equal(component.name, "Panel");
    assert.deepEqual(component.wrappers, ["forwardRef"]);
    assert.equal(component.children.kind, "forwarded");
    assert.deepEqual(component.defaults, { tone: "quiet" });
    assert.ok(component.props.some((prop) => prop.name === "ref"));
    assert.ok(reactSourceProgramUnchanged(program));
  }));

test("const default wrappers refuse implementation mutations and value escapes", () =>
  fixture((dir) => {
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
    const prefix = `import React,{forwardRef} from 'react';
const Panel=forwardRef<HTMLDivElement,{children?:React.ReactNode}>(({children},ref)=><div ref={ref}>{children}</div>);`;
    for (const mutation of [
      "Object.assign(Panel,{render:()=> <div>Replacement content</div>});",
      "(Panel as any).render=()=> <div>Replacement content</div>;",
      "Object.defineProperty(Panel,'render',{value:()=> <div/>});",
      "const Alias=Panel; Object.assign(Alias,{render:()=> <div/>});",
      "const replace=(value:object)=>Object.assign(value,{render:()=> <div/>}); replace(Panel);",
      "Panel.displayName=String(Math.random());",
      "const element=<Panel/>; Object.assign(element.type,{render:()=> <div/>});",
      "const make=()=> <Panel/>; Object.assign(make().type,{render:()=> <div/>});",
      "const make=()=> <Panel/>;",
      'eval("Panel.render=()=>null");',
      '(eval)("Panel.render=()=>null");',
    ]) {
      writeFileSync(
        path.join(dir, "components.tsx"),
        `${prefix}\n${mutation}\nexport default Panel;`,
      );
      const program = readReactSourceProgram(dir, ["components.tsx"]);
      assert.equal(program.status, "refused", mutation);
      assert.deepEqual(program.components, [], mutation);
      assert.ok(
        program.problems.includes("default:component-value-mutation-or-escape"),
        JSON.stringify(program.problems),
      );
    }
    writeFileSync(
      path.join(dir, "components.tsx"),
      `${prefix}
Panel.displayName='Panel';
type ComponentValue=typeof Panel;
export {Panel as default};`,
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.equal(program.status, "observed", JSON.stringify(program.problems));
    assert.equal(program.components[0].children.kind, "forwarded");
  }));

test("JSX reflection and dynamic evaluation cannot authenticate a replaced default render", () =>
  fixture((dir) => {
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
    for (const mutation of [
      "",
      "const element=<Panel/>; Object.assign(element.type,{render:()=> <div>Replaced</div>});",
      "const make=()=> <Panel/>; Object.assign(make().type,{render:()=> <div>Replaced</div>});",
      `eval("Panel.render=()=>React.createElement('div',null,'Replaced')");`,
    ]) {
      const source = `import * as React from 'react';
const Panel=React.forwardRef<HTMLDivElement,{children?:React.ReactNode}>(({children},ref)=><div ref={ref}>{children}</div>);
${mutation}
export default Panel;`;
      writeFileSync(path.join(dir, "components.tsx"), source);
      // Execute only this controlled test fixture to prove that the alias
      // changes actual React output. The product reader never executes it.
      const compiled = ts.transpileModule(source, {
        compilerOptions: {
          jsx: ts.JsxEmit.React,
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText;
      const exports: {
        default?: {
          render: (
            props: { children: string },
            ref: null,
          ) => React.ReactElement<{ children: string }>;
        };
      } = {};
      runInNewContext(compiled, {
        exports,
        require: (id: string) => {
          assert.equal(id, "react");
          return React;
        },
      });
      assert.equal(
        exports.default!.render({ children: "Caller" }, null).props.children,
        mutation ? "Replaced" : "Caller",
      );
      const program = readReactSourceProgram(dir, ["components.tsx"]);
      assert.equal(program.status, mutation ? "refused" : "observed", mutation);
      if (mutation) {
        assert.deepEqual(program.components, []);
        assert.ok(
          program.problems.includes(
            "default:component-value-mutation-or-escape",
          ),
        );
      } else assert.equal(program.components[0].children.kind, "forwarded");
    }
  }));

test("lookalike, computed, mutable and indirect wrapper factories do not acquire React source proof", () =>
  fixture((dir) => {
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
    writeFileSync(
      path.join(dir, "fake.ts"),
      `export function forwardRef(fn:(props:{children?:string})=>unknown){return fn}`,
    );
    writeFileSync(
      path.join(dir, "components.tsx"),
      `
import * as React from 'react';
import { forwardRef } from './fake';
export const Imposter = forwardRef(props => <div>{props.children}</div>);
export const Computed = React['forwardRef']<HTMLDivElement,{}>(() => <div/>);
const indirect = React.forwardRef;
export const Alias = indirect<HTMLDivElement,{}>(() => <div/>);
const body = () => <div/>;
export const Callback = React.forwardRef<HTMLDivElement,{}>(body);
export let Mutable = React.forwardRef<HTMLDivElement,{}>(() => <div/>);
`,
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    for (const name of ["Imposter", "Computed", "Alias", "Callback", "Mutable"])
      assert.ok(
        program.problems.includes(name + ":component-function-unresolved"),
        program.problems.join("\n"),
      );
    assert.deepEqual(program.components, []);
  }));

test("escaped or reassigned React factories cannot establish the wrapper relation", () =>
  fixture((dir) => {
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
    for (const escape of [
      `(React as any).forwardRef = (fn:unknown) => fn;`,
      `Object.assign(React, {forwardRef: (fn:unknown) => fn});`,
      `const escaped = React.forwardRef;`,
      `import Alias from 'react'; Object.assign(Alias, {forwardRef: (fn:unknown) => fn});`,
      `import {forwardRef as otherFactory} from 'react'; const escaped = otherFactory;`,
    ]) {
      writeFileSync(
        path.join(dir, "components.tsx"),
        `import * as React from 'react';
${escape}
export const Panel=React.forwardRef<HTMLDivElement,{children?:React.ReactNode}>((props, ref)=><div {...props} ref={ref}/>);`,
      );
      const program = readReactSourceProgram(dir, ["components.tsx"]);
      assert.ok(
        program.problems.includes("Panel:component-function-unresolved"),
        escape,
      );
      assert.equal(program.components.length, 0);
    }
  }));

test("type-only exports are not runtime components; unresolved value exports still refuse", () =>
  fixture((dir) => {
    writeFileSync(
      path.join(dir, "components.tsx"),
      `import './primitive';
export interface PublicProps {children?:string}
export type Callback = (value:string)=>void;
export type {Root as RootType} from './primitive';
export {type Root as InlineType} from './primitive';
export {Root as ExternalValue} from './primitive';
export enum RuntimeFlags { Enabled }
export const Panel=(props:PublicProps)=><div {...props}/>;
`,
    );
    const program = readReactSourceProgram(dir, ["components.tsx"]);
    assert.deepEqual(
      program.components.map((c) => c.exportName),
      ["Panel"],
    );
    assert.deepEqual(
      program.problems.sort(),
      [
        "ExternalValue:component-definition-outside-module",
        "RuntimeFlags:component-function-unresolved",
      ].sort(),
    );
  }));


test('containing component models follow defaults and conditional JSX without turning the result into an unconditional children fact', () => fixture(dir => {
  const cases:Array<{name:string;body:string;props?:Record<string,unknown>;content?:string;reason?:string}>=[
    {name:'default and inactive branch',body:`const {children,disabled=props.loading,...rest}=normalize(props);const Comp=props.alternate?'div':'button';return <Comp {...rest} disabled={disabled}>{props.loading?'Loading':children}</Comp>;`,content:'forwarded'},
    {name:'active branch replaces content',body:`const {children,...rest}=normalize(props);return <button {...rest}>{props.loading?'Loading':children}</button>;`,props:{loading:true},content:'not-directly-forwarded'},
    {name:'late spread replaces children',body:`const {children,...rest}=normalize(props);return <button children={children} {...{children:'Replacement'}}/>;`,content:'not-directly-forwarded'},
    {name:'explicit JSX children win',body:`const {children}=normalize(props);return <button {...{children:'Replacement'}}>{children}</button>;`,content:'forwarded'},
    {name:'nested source host',body:`const {children}=normalize(props);return <button><div>{children}</div></button>;`,content:'not-directly-forwarded'},
    {name:'multiline text and nested JSX',body:`const {children}=normalize(props);return <button>Hello\n  world <div/> {children}</button>;`,content:'not-directly-forwarded'},
    {name:'if branch',body:`const {children}=normalize(props);if(props.loading)return <button>Loading</button>;return <button>{children}</button>;`,content:'forwarded'},
    {name:'fragment',body:`const {children}=normalize(props);return <>{children}</>;`,content:'forwarded'},
    {name:'key coercion',body:`const {children}=normalize(props);return <button key={0}>{children}</button>;`,content:'forwarded'},
    {name:'secondary parameter only forwarded',body:`const {children}=normalize(props);return <button ref={ref}>{children}</button>;`,content:'forwarded'},
    {name:'caller default is not proved',body:`const {children:original}=normalize(props);const {children='fallback'}={children:original};return <button>{children}</button>;`,reason:'opaque-content-inspected'},
    {name:'opaque conditional refuses',body:`const {children}=normalize(props);return <button>{children?'Changed':children}</button>;`,reason:'opaque-content-inspected'},
    {name:'post-helper input mutation refuses',body:`const {children}=normalize(props);props.children='Changed';return <button>{children}</button>;`,reason:'external-data-write'},
    {name:'ref inspection refuses',body:`const {children}=normalize(props);const value=ref.current;return <button>{children}</button>;`,reason:'opaque-parameter-inspected'},
    {name:'invocation argument reflection refuses',body:`const {children}=normalize(props);return <button title={arguments.length}>{children}</button>;`,reason:'component-arguments-unmodeled'},
    {name:'effect in an evaluated JSX attribute refuses',body:`const {children}=normalize(props);return <button title={(props.children='Changed')}>{children}</button>;`,reason:'external-data-write'},
    {name:'children cannot escape into DOM attributes',body:`const {children}=normalize(props);return <button title={children}>{children}</button>;`,reason:'jsx-content-escape'},
    {name:'children cannot escape into a style object',body:`const {children}=normalize(props);return <button style={{color:children}}>{children}</button>;`,reason:'jsx-content-escape'},
    {name:'secondary parameter cannot escape into children',body:`const {children}=normalize(props);return <button>{[children,ref]}</button>;`,reason:'jsx-parameter-escape'},
    {name:'effectful object key cannot be coerced',body:`const {children}=normalize(props);return <button key={{toString:()=>props.children='Changed'}}>{children}</button>;`,reason:'object-coercion-unproved'},
  ];
  for(const item of cases){
    const code=`import './primitive';type Input={children?:any;loading?:boolean;alternate?:boolean};
function normalize(input:Input){return {...input};}
export function Control(props:Input,ref?:any){${item.body}}`;
    writeFileSync(path.join(dir,'components.tsx'),code);
    const program=readReactSourceProgram(dir,['components.tsx']),component=program.components.find(c=>c.exportName==='Control')!;
    // The broader source-program reader deliberately refuses two-parameter and
    // fragment roots. Exercise the effects reader against its own authenticated
    // candidate scanner without changing those public admission rules.
    const ast=ts.createProgram([path.join(dir,'components.tsx')],{jsx:ts.JsxEmit.Preserve});
    const fn=ast.getSourceFile(path.join(dir,'components.tsx'))!.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='Control') as ts.FunctionDeclaration;
    const candidates=reactHelperCandidates(fn,ast.getTypeChecker());
    assert.ok(candidates.length,item.name+': helper boundary missing');
    const props={children:'caller',...item.props};
    const result=readReactComponentEffects({sourceRoot:dir,files:program.files},'components.tsx',candidates[0],props);
    assert.equal(result.runtimeVerified,false);assert.equal(result.acceptedContract,null);
    assert.equal(component.children.kind,'unresolved');
    if(item.reason){assert.equal(result.status,'refused',item.name);if(result.status==='refused')assert.equal(result.reason,item.reason,item.name);continue;}
    assert.equal(result.status,'modeled',item.name+':'+JSON.stringify(result));if(result.status!=='modeled')continue;
    assert.equal(result.content,item.content,item.name);
    const child=React.createElement('strong',null,'Caller'),ref={current:null};
    const javascript=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
    const context={exports:{} as Record<string,Function>,require:()=>({}),React};runInNewContext(javascript,context);
    const actual=context.exports.Control({...props,children:child},ref);
    function check(shape:any,value:any):void {
      if(shape.kind==='opaque'){assert.equal(value,child,item.name);return;}
      if(shape.kind==='parameter'){assert.equal(shape.index,1);assert.equal(value,ref);return;}
      if(shape.kind==='literal'){assert.equal(typeof value,shape.type);assert.equal(value,shape.type==='undefined'?undefined:shape.value);return;}
      if(shape.kind==='array'){assert.equal(value.length,shape.items.length);shape.items.forEach((v:any,i:number)=>check(v,value[i]));return;}
      if(shape.kind==='record'){assert.deepEqual(Object.keys(value),shape.fields.map((f:any)=>f[0]));for(const [key,v] of shape.fields)check(v,value[key]);return;}
      assert.equal(shape.kind,'jsx');assert.equal(value.type,shape.tag.kind==='fragment'?React.Fragment:shape.tag.name);assert.equal(value.key,shape.key);check(shape.props,value.props);
    }
    check(result.output,actual);
  }
}));
