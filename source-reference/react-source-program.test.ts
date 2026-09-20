import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
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
