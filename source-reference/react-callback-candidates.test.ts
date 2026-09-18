import test from "node:test";
import { ContractSchema } from "../scripts/contract-schema.js";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readReactSourceProgram } from "./react-source-program.js";
import { proposeReactSourceProgram } from "./react-program-proposal.js";
import {
  callbackSignatureProblem,
  reactCallbackCandidate,
} from "./react-callback-candidates.js";

test("installed callback signatures retain ambiguity and reject unsupported behavior without interpreting printed types", () => {
  const root = mkdtempSync(path.join(tmpdir(), "react-callback-"));
  const source = `declare global {namespace JSX {interface IntrinsicElements {button:any}}}
    interface API {
      checked?:boolean|'indeterminate'; defaultChecked?:boolean|'indeterminate'; disabled?:boolean;
      onChanged?:(next:boolean|'indeterminate')=>void;
      onOptional?:(next?:boolean)=>void; onRest?:(...values:boolean[])=>void;
      onGeneric?:<T>(next:T)=>void; onResult?:(next:boolean)=>number;
      onOpen?:(next:string)=>void; onUnknown?:(next:any)=>void;
      onUndefined?:(next:boolean|undefined)=>void; requiredMaybe:boolean|undefined; onBoolean?:(next:boolean)=>void;
      onOverloaded?:{(next:boolean):void;(next:'indeterminate'):void};
      onActivate?:()=>void;
      unusual?:false|'false'|null; onUnusual?:(next:false|'false'|null)=>void;
    }
    export function Subject(props:API){return <button {...props}/>;}`;
  try {
    writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          skipLibCheck: true,
          jsx: "preserve",
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
        },
      }),
    );
    writeFileSync(path.join(root, "subject.tsx"), source);
    const program = readReactSourceProgram(root, ["subject.tsx"]);
    assert.deepEqual(program.problems, []);
    const component = program.components[0];
    const candidate = (name: string) =>
      reactCallbackCandidate(
        component,
        component.props.find((p) => p.name === name)!,
      );
    assert.deepEqual(candidate("onChanged").stateProperties, [
      "checked",
      "defaultChecked",
    ]);
    assert.equal(candidate("onChanged").status, "needs-observation");
    assert.deepEqual(
      candidate("onBoolean").stateProperties,
      ["disabled"],
      "required undefined is not optional omission",
    );
    assert.deepEqual(
      new Set(candidate("onUnusual").values),
      new Set([false, "false", null]),
    );
    assert.deepEqual(candidate("onUnusual").stateProperties, ["unusual"]);
    for (const [name, reason] of [
      ["onOptional", "callback-single-required-argument-needed"],
      ["onRest", "callback-single-required-argument-needed"],
      ["onGeneric", "callback-generic-unsupported"],
      ["onResult", "callback-return-value-unrepresented"],
      ["onOpen", "callback-finite-domain-required"],
      ["onUnknown", "callback-finite-domain-required"],
      ["onUndefined", "callback-finite-domain-required"],
      ["onOverloaded", "callback-overload-unsupported"],
    ]) {
      assert.equal(candidate(name).status, "unsupported", name);
      assert.equal(candidate(name).reason, reason, name);
    }
    assert.equal(
      callbackSignatureProblem(
        component.props.find((p) => p.name === "onActivate")!,
      ),
      undefined,
    );
    const proposal = proposeReactSourceProgram(program, [
      { sourcePath: "subject.tsx", source },
    ]);
    const contract = ContractSchema.parse(proposal.result.proposals[0].proposal.contract);
    assert.deepEqual(
      contract.events?.map((e) => e.bindings.code.prop),
      ["onActivate"],
    );
    assert.ok(
      proposal.components[0].unsupported.some(
        (p) =>
          p.name === "onChanged" &&
          p.reason === "callback-arguments-require-behavior-observation",
      ),
    );
    const historical = structuredClone(
      component.props.find((p) => p.name === "onActivate")!,
    );
    delete historical.callbackSignatures;
    assert.equal(
      callbackSignatureProblem(historical),
      "callback-signature-unverified",
      "printed () => void is not substitute checker evidence",
    );
    assert.deepEqual(
      proposeReactSourceProgram(program, [
        { sourcePath: "subject.tsx", source },
      ]),
      proposal,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
