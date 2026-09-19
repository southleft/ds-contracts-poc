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
  await page.setContent(reactReferenceHtml(output));
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
test("the generated root claims the role that was observed, never an assumed one", () => {
  const checkboxException = "Source root independently observed as a button-backed checkbox.";
  // Evidence sealed before roles were recorded could only have been a checkbox.
  const legacy = projectReactBehaviorContract(observations().initial, observations().behavior);
  assert.deepEqual([legacy.contract!.semantics.role, legacy.contract!.semantics.roleException], ["checkbox", checkboxException]);
  const recorded = observations();
  (recorded.behavior.observation as { role?: string }).role = "checkbox";
  const checkbox = projectReactBehaviorContract(recorded.initial, recorded.behavior);
  assert.deepEqual(checkbox.contract, legacy.contract, "recording the role changes nothing for a checkbox");
  assert.equal(checkbox.tsx, legacy.tsx);
  // A two-state switch: the same evidence without any mixed value.
  const twoState = () => {
    const value = observations();
    const prop = value.initial.draft!.compiled!.contract!.props[0] as any;
    prop.type = { enum: ["off", "on"] };
    delete prop.bindings.code.values.mixed;
    const observation = value.behavior.observation as any;
    observation.role = "switch";
    observation.rows = observation.rows.filter((row: any) => row.value !== "indeterminate");
    observation.candidates[0].values = observation.candidates[0].values.filter((v: unknown) => v !== "indeterminate");
    value.initial.observation!.rows = value.initial.observation!.rows.filter((row: any) =>
      Object.values(row.changes).every((change: any) => change.value !== "indeterminate")) as any;
    return value;
  };
  const switched = twoState();
  const draft = projectReactBehaviorContract(switched.initial, switched.behavior);
  assert.equal(draft.status, "generated-draft", draft.problems.join("\n"));
  assert.deepEqual([draft.contract!.semantics.role, draft.contract!.semantics.roleException],
    ["switch", "Source root independently observed as a button-backed switch."]);
  assert.match(draft.tsx!, /role="switch"/);
  assert.doesNotMatch(draft.tsx!, /role="checkbox"/);
  assert.deepEqual(generatedTypeErrors(draft.contract!.name, draft.tsx!), []);
  // Stored evidence is not trusted to have been refused by the observer.
  const mixedSwitch = observations();
  (mixedSwitch.behavior.observation as { role?: string }).role = "switch";
  const refused = projectReactBehaviorContract(mixedSwitch.initial, mixedSwitch.behavior);
  assert.equal(refused.status, "refused");
  assert.deepEqual(refused.problems, ["behavior-contract-state-unsupported-for-role"]);
  const unknown = observations();
  (unknown.behavior.observation as { role?: string }).role = "radio";
  assert.deepEqual(projectReactBehaviorContract(unknown.initial, unknown.behavior).problems, ["behavior-contract-role-unsupported"]);
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

test('nested appearance and callback evidence must identify the same source instance', () => {
  const { initial, behavior } = observations();
  initial.instanceId = behavior.instanceId = initial.observation!.instanceId = 'instance-4';
  const source = { module: '/fixture/control.tsx', exportName: 'Control', sourceSha256: 'a'.repeat(64), span: { start: 0, end: 20 } };
  initial.observation!.source = source;
  behavior.observation!.target = { instanceId: 'instance-4', source, rootPath: '1.0' };
  assert.equal(projectReactBehaviorContract(initial, behavior).status, 'generated-draft');
  for (const mutate of [
    (b: ReactCallbackInspection) => { delete b.instanceId; },
    (b: ReactCallbackInspection) => { delete b.observation!.target; },
    (b: ReactCallbackInspection) => { b.observation!.target!.instanceId = 'instance-5'; },
    (b: ReactCallbackInspection) => { b.observation!.target!.source.sourceSha256 = 'b'.repeat(64); },
  ]) {
    const changed = structuredClone(behavior); mutate(changed);
    assert.equal(projectReactBehaviorContract(initial, changed).status, 'refused');
  }
});
