import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readReactSourceProgram } from "./react-source-program.js";
import { proposeReactSourceProgram } from "./react-program-proposal.js";
import { proposeFromCode } from "../core/propose-code.js";
import { ContractSchema } from "../scripts/contract-schema.js";

function fixture(fn: (root: string, source: string) => void) {
  const root = mkdtempSync(path.join(tmpdir(), "react-proposal-"));
  const source = `import type {InputAPI} from './types';
export function Toggle({active=false,...props}:InputAPI){return <button {...props}/>;}
export function Box({tone='quiet',...props}:{tone?:'quiet'|'loud';label:string;selected?:boolean}){return <div {...props}/>;}`;
  try {
    writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          jsx: "preserve",
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          skipLibCheck: true,
        },
      }),
    );
    writeFileSync(
      path.join(root, "types.ts"),
      `declare global{namespace JSX{interface Element{} interface IntrinsicElements{button:any;div:any}}}
export interface InputAPI{active?:boolean;checked?:boolean;requiredFlag:boolean;disabled?:boolean;mixed?:boolean|'indeterminate';nullable?:'one'|'two'|null;literal?:true;callback?:(v:boolean)=>void;onChange?:(v:boolean)=>void;}`,
    );
    writeFileSync(path.join(root, "components.tsx"), source);
    fn(root, source);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("installed API proposals preserve booleans, omission and declared defaults while naming unrepresentable domains", () =>
  fixture((root, source) => {
    const program = readReactSourceProgram(root, ["components.tsx"]);
    assert.deepEqual(program.problems, []);
    const inputs = [{ sourcePath: "components.tsx", source, css: "" }];
    const proposal = proposeReactSourceProgram(program, inputs);
    assert.equal(proposal.acceptedContract, null);
    assert.equal(proposal.status, "incomplete");
    assert.equal(proposal.result.proposals.length, 2);
    const toggle = ContractSchema.parse(
      proposal.result.proposals.find((p) => p.name === "Toggle")!.proposal
        .contract,
    );
    const checked = toggle.props.find((p) => p.name === "checked")!;
    assert.equal(checked.type, "boolean");
    assert.equal(Object.hasOwn(checked, "default"), false);
    assert.equal(checked.bindings.figma.unsetValue, "(unset)");
    assert.equal(toggle.props.find((p) => p.name === "active")!.default, false);
    assert.equal(
      toggle.props.find((p) => p.name === "active")!.bindings.figma.unsetValue,
      undefined,
    );
    assert.equal(
      toggle.props.find((p) => p.name === "requiredFlag")!.required,
      true,
    );
    assert.equal(
      toggle.props.find((p) => p.name === "requiredFlag")!.bindings.figma
        .unsetValue,
      undefined,
    );
    for (const [name, expected] of [
      ["mixed", [false, true, "indeterminate"]],
      ["nullable", [null, "one", "two"]],
      ["literal", [true]],
    ] as const) {
      const prop = toggle.props.find((p) => p.name === name)!;
      assert.ok(prop);
      assert.deepEqual(
        new Set(Object.values(prop.bindings.code.values!)),
        new Set<string | number | boolean | null>(expected),
      );
      assert.equal(prop.bindings.figma.unsetValue, "(unset)");
      assert.equal(Object.hasOwn(prop, "default"), false);
    }
    assert.deepEqual(
      proposal.components[0].unsupported.map((p) => p.name),
      ["callback"],
    );
    assert.ok(toggle.events?.some((e) => e.bindings.code.prop === "onChange"));
    const box = ContractSchema.parse(
      proposal.result.proposals.find((p) => p.name === "Box")!.proposal
        .contract,
    );
    assert.equal(box.props.find((p) => p.name === "tone")!.default, "quiet");
    assert.equal(
      Object.hasOwn(
        box.props.find((p) => p.name === "label")!,
        "default",
      ),
      false,
      "do not invent a required-text default",
    );
    assert.equal(box.props.find((p) => p.name === "label")!.required, true);
    assert.deepEqual(
      proposeReactSourceProgram(program, inputs),
      proposal,
      "repeat is deterministic",
    );
    const legacy = proposeFromCode(inputs, { tokens: [] });
    assert.ok(
      legacy.skipped.some((c) => c.name === "Toggle"),
      "syntax-only entry point still names unread inherited APIs",
    );
  }));

test("changed source, missing modules, duplicate names and compiler failures cannot generate drafts", () =>
  fixture((root, source) => {
    const program = readReactSourceProgram(root, ["components.tsx"]);
    const input = { sourcePath: "components.tsx", source };
    for (const [p, inputs, reason] of [
      [
        program,
        [{ ...input, source: source + "\n// changed" }],
        "source-module-changed",
      ],
      [program, [], "source-module-missing"],
      [program, [input, input], "duplicate-component-name"],
      [{ ...program, problems: ["TS2307"] }, [input], "TS2307"],
    ] as const) {
      const proposal = proposeReactSourceProgram(
        { ...p, problems: [...p.problems] },
        [...inputs],
      );
      assert.equal(proposal.result.proposals.length, 0);
      assert.ok(proposal.problems.some((p) => p.includes(reason)));
    }
  }));
