import test from "node:test";
import assert from "node:assert/strict";
import { ContractSchema } from "../scripts/contract-schema.js";
import type { ReactInitialInspection } from "./react-initial-inspection.js";
import type { ReactCallbackInspection } from "./react-callback-inspection.js";
import { projectReactBehaviorContract } from "./react-behavior-contract.js";
import { generatedTypeErrors } from "../core/react-test-runtime.js";
import { buildReactBehaviorPreview } from './react-behavior-preview.js';
import { reactReferenceHtml } from './react-reference.js';
import { chromium } from 'playwright-core';

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
test('the application preview runs emitted behavior with real consumer controls and exact callback values', async t => {
  const {initial,behavior}=observations();
  const draft=projectReactBehaviorContract(initial,behavior);
  await assert.rejects(buildReactBehaviorPreview(process.cwd(),{...draft,status:'refused'}),/draft-unavailable/);
  const output=await buildReactBehaviorPreview(process.cwd(),draft);
  const browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage();
  await page.setContent(reactReferenceHtml({id:'preview',files:{},...output}));
  const control=page.getByRole('region',{name:'Generated component'}).getByRole('checkbox');
  const value=page.getByLabel('Input value'),mode=page.getByLabel('State management');
  const remount=page.getByRole('button',{name:'Remount with current inputs'});
  const calls=page.getByLabel('Callback values');
  assert.equal(await control.getAttribute('aria-checked'),'false');
  await value.selectOption({label:'"indeterminate"'});
  assert.equal(await control.getAttribute('aria-checked'),'false','initial-only input updates do not overwrite mounted state');
  await remount.click();
  assert.equal(await control.getAttribute('aria-checked'),'mixed');
  await control.press('Space');
  assert.equal(await control.getAttribute('aria-checked'),'true');
  assert.equal(await calls.textContent(),'[true]');
  await mode.selectOption('hold');await remount.click();
  await control.click();
  assert.equal(await calls.textContent(),'[true]');
  assert.equal(await control.getAttribute('aria-checked'),'mixed','held controlled values do not follow the requested update');
  await mode.selectOption('accept');await remount.click();
  await control.press('Space');await control.click();
  assert.equal(await calls.textContent(),'[true,false]');
  assert.equal(await control.getAttribute('aria-checked'),'false');
  assert.match(await page.getByRole('region',{name:'React consumer controls'}).innerText(),/onValueChange/);
  assert.equal(await page.locator('style').textContent(),output.css,'source styles are not used to cover missing generated rules');
});
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
