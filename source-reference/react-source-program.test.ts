import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import * as React from "react";
import ts from "typescript";
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
    ])
      assert.deepEqual(
        fact(name),
        { kind: "unresolved", reason: "children-alias-unresolved" },
        name,
      );
    for (const name of [
      "Unused",
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
