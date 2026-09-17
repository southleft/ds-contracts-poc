import test from "node:test";
import assert from "node:assert/strict";
import { ContractSchema } from "../scripts/contract-schema.js";
import type { ReactInitialInspection } from "./react-initial-inspection.js";
import type { ReactCallbackInspection } from "./react-callback-inspection.js";
import { projectReactBehaviorContract } from "./react-behavior-contract.js";
import { generatedTypeErrors } from "../core/react-test-runtime.js";

function observations() {
  const contract = ContractSchema.parse({
    id: "observed.selection",
    name: "Selection",
    version: "1.0.0",
    status: "draft",
    description: "Observed appearance fixture.",
    semantics: { element: "button" },
    props: [
      {
        name: "seed",
        type: { enum: ["off", "on", "mixed"] },
        bindings: {
          code: {
            prop: "seed",
            values: { off: false, on: true, mixed: "indeterminate" },
          },
          figma: { kind: "VARIANT", property: "State", unsetValue: "(unset)" },
        },
      },
    ],
    states: [],
    anatomy: { root: { text: "Select" } },
    bindings: {
      code: { anchors: { importPath: "./Selection", export: "Selection" } },
      figma: { anchors: { fileKey: null, componentSetKey: null } },
    },
  });
  const values = [false, true, "indeterminate"] as const;
  const state = (value: unknown) =>
    value === "indeterminate" ? "mixed" : String(value);
  const rows = values.flatMap((value) =>
    ["value", "seed"].flatMap((property) =>
      ["space", "associated-label"].map((action) => {
        const initial = { checked: state(value), disabled: false };
        const first = value === true ? false : true,
          second = property === "value" ? first : !first;
        return {
          callback: "onValueChange",
          property,
          value,
          action,
          initial,
          live: {
            checked: property === "value" ? state(value) : "false",
            disabled: false,
          },
          restored: true,
          steps: [first, second].map((next, index) => ({
            control: {
              checked: property === "value" ? state(value) : String(next),
              disabled: false,
            },
            callback: {
              calls: index === 0 ? [[first]] : [[first], [second]],
              problems: [],
            },
          })),
        };
      }),
    ),
  );
  const initial = {
    id: "initial",
    caseId: "source",
    phase: "complete",
    sourceUnchanged: true,
    problems: [],
    draft: {
      status: "compiled-draft",
      compiled: { contract, tokens: {}, assets: [] },
    },
    observation: {
      rows: [
        {
          id: "0",
          changes: { seed: { kind: "omit" } },
          status: "observed",
          restored: true,
          image: "same",
          treeSha256: "same",
        },
        {
          id: "1",
          changes: { seed: { kind: "set", value: false } },
          status: "observed",
          restored: true,
          image: "same",
          treeSha256: "same",
        },
      ],
    },
  } as unknown as ReactInitialInspection;
  const behavior = {
    id: "behavior",
    caseId: "source",
    phase: "complete",
    sourceUnchanged: true,
    problems: [],
    observation: {
      qualification: "observed-source-checkbox-behavior-only",
      rows,
      problems: [],
      candidates: [
        {
          callback: "onValueChange",
          signature: "(value:boolean|indeterminate)=>void",
          values: [...values],
          stateProperties: ["value", "seed"],
          status: "needs-observation",
          reason: "matched domain",
        },
      ],
      relationships: [
        {
          callback: "onValueChange",
          property: "value",
          status: "controlled-observed",
          reason: "observed",
        },
        {
          callback: "onValueChange",
          property: "seed",
          status: "initial-only-observed",
          reason: "observed",
        },
      ],
    },
  } as ReactCallbackInspection;
  return { initial, behavior };
}
test("observed relationships produce a typed React draft while retaining the original appearance contract", () => {
  const { initial, behavior } = observations(),
    before = structuredClone(initial);
  const draft = projectReactBehaviorContract(initial, behavior);
  assert.equal(draft.status, "generated-draft", draft.problems.join("\n"));
  assert.deepEqual(draft.contract!.props[0].bindings.code, {
    prop: "value",
    values: { off: false, on: true, mixed: "indeterminate" },
    initial: { prop: "seed", default: "off" },
  });
  assert.equal(draft.contract!.events![0].bindings.code.prop, "onValueChange");
  assert.deepEqual(generatedTypeErrors(draft.contract!.name, draft.tsx!), []);
  assert.deepEqual(initial, before);
  assert(
    draft.limitations.includes("controlled-source-appearance-not-compared"),
  );
});
test("summary labels alone cannot admit changed, ambiguous or incomplete callback/default evidence", () => {
  const mutations = [
    ({ behavior }: ReturnType<typeof observations>) => {
      behavior.sourceUnchanged = false;
    },
    ({ behavior }: ReturnType<typeof observations>) => {
      behavior.observation!.rows[0].steps[0].callback.calls = [[false]];
    },
    ({ behavior }: ReturnType<typeof observations>) => {
      behavior.observation!.rows.pop();
    },
    ({ behavior }: ReturnType<typeof observations>) => {
      behavior.observation!.rows[0].action = "associated-label";
    },
    ({ initial }: ReturnType<typeof observations>) => {
      initial.observation!.rows[1].image = "different";
    },
    ({ initial }: ReturnType<typeof observations>) => {
      initial.caseId = "different";
    },
    ({ behavior }: ReturnType<typeof observations>) => {
      behavior.observation!.relationships[0].status = "unresolved";
    },
  ];
  for (const mutate of mutations) {
    const input = observations();
    mutate(input);
    const draft = projectReactBehaviorContract(input.initial, input.behavior);
    assert.equal(draft.status, "refused");
    assert.equal(draft.tsx, undefined);
    assert(draft.problems.length);
  }
});
