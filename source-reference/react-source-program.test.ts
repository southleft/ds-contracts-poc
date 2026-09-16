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

test('an explicitly any-typed inherited property is retained by name beside usable typed facts',()=>fixture(dir=>{
 writeFileSync(path.join(dir,'primitive.ts'),declarations.replace('checked?:Checked','inlist?:any;checked?:Checked'));
 const result=readReactSourceProgram(dir,['components.tsx']);assert.equal(result.status,'refused');
 const toggle=result.components.find(c=>c.name==='Toggle')!;assert.equal(toggle.props.find(p=>p.name==='inlist')!.type.kind,'any');
 assert.ok(toggle.problems.includes('unresolved-prop-type:inlist'));assert.equal(toggle.props.find(p=>p.name==='checked')!.type.kind,'union');
}));
