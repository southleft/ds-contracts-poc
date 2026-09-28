import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeUpdateFixture as fixture } from './native-contract-update-test-fixture.js';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript, verifyNativeContractUpdate, nativeContractUpdateMatches,
  nativeContractUpdateUntouched } from './native-contract-update.js';
import { prepareNativeTokenContext } from './native-token-context.js';
import { verifyNativeContractReadback } from './native-source-observation.js';
import type { NativeShadowUpdatePlan } from './native-contract-shadow-update.js';

// Tailwind's shadow-xs and shadow-sm as Chromium serializes them (§D.176).
const XS = 'rgba(0, 0, 0, 0.05) 0px 1px 2px 0px';
const SM = 'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px, rgba(0, 0, 0, 0.1) 0px 1px 2px -1px';
const STACK: Record<string, Array<{ x: number; y: number; radius: number; spread?: number; color: { r: number; g: number; b: number; a: number } }>> = {
  [XS]: [{ x: 0, y: 1, radius: 2, color: { r: 0, g: 0, b: 0, a: 0.05 } }],
  [SM]: [{ x: 0, y: 1, radius: 3, color: { r: 0, g: 0, b: 0, a: 0.1 } }, { x: 0, y: 1, radius: 2, spread: -1, color: { r: 0, g: 0, b: 0, a: 0.1 } }],
};
const refusal = (fn: () => unknown) => { try { fn(); return 'none'; } catch (error) { return (error as Error).message; } };

async function shadowTokenFixture(extra: Record<string, unknown> = {}) {
  const f = await fixture({ shadow: { $type: 'shadow', $value: XS }, ...extra });
  const desiredFor = (css: string, edit: (tokens: Record<string, any>) => void = () => {}) => {
    const tokens = { ...structuredClone(f.tokens), shadow: { $type: 'shadow', $value: css } };
    edit(tokens);
    const desired = f.desiredFor(tokens);
    for (const variant of desired.component.variants) variant.spec.effectStack = structuredClone(STACK[css]);
    return desired;
  };
  const input = { ...structuredClone(f.input), desired: desiredFor(SM) };
  const variableId = f.tokenIdentity.variables.find((v: any) => v.tokenPath === 'shadow')!.id;
  const variable = await f.figma.variables.getVariableByIdAsync(variableId);
  const modeId = f.tokenIdentity.modes[0].modeId;
  return { ...f, input, desiredFor, variable, modeId, plan: prepareNativeContractUpdate(input).plan as NativeShadowUpdatePlan };
}

test('a root shadow and its own recorded shadow value are carried in one plan, verified, repeated and rolled back', async () => {
  const f = await shadowTokenFixture(), ids = f.figma.root.findAll(() => true).map((n: any) => n.id);
  assert.equal(f.plan.kind, 'native-contract-shadow-update');
  assert.deepEqual(f.plan.tokenChanges?.map(c => [c.tokenPath, c.resolvedType, c.before, c.after]), [['shadow', 'STRING', XS, SM]]);
  assert.equal(f.plan.tokenBindingScope, 'document-v1');
  assert.equal(f.plan.after.tokenInput.allocatedValueProtocol, 'shadow-values-v1');
  assert.deepEqual(f.plan.after.tokenInput.allocatedValues?.map(r => [r.tokenPath, r.value]), [['shadow', XS]]);
  assert.equal(prepareNativeTokenContext(f.plan.after.tokenInput).revision, f.tokenIdentity.preparationRevision, 'the allocation re-derives');
  const script = emitNativeContractUpdateScript(f.plan);
  const writes = script.slice(script.indexOf('Variable values first'), script.indexOf('out.observation = await'));
  assert.ok(writes.includes('setValueForMode') && writes.includes('node[field] = copy(target)') && !/\bawait\b/.test(writes),
    'no await between the final checks and the assignments');
  assert.ok(script.includes('await figma.loadAllPagesAsync()') && script.includes("version: 'document-v1'"), 'the whole document is scanned for bindings');

  const preflight = await f.run(emitNativeContractUpdateScript(f.plan, 'apply', true));
  assert.equal(preflight.status, 'preflight-observed', JSON.stringify(preflight.problems));
  const applied = await f.run(script);
  assert.equal(applied.status, 'updated', JSON.stringify(applied.problems));
  assert.deepEqual(applied.tokenChanges, [f.variable.id]);
  assert.equal(applied.changes.length, 2);
  assert.equal(f.variable.valuesByMode[f.modeId], SM);
  assert.ok(f.nodes.every((n: any) => n.effects.length === 2 && n.effects[1].spread === -1));
  assert.equal(verifyNativeContractUpdate(f.plan, applied.observation).status, 'supported-structure-observed');
  assert.ok(nativeContractUpdateMatches(f.plan, applied.observation, true));
  assert.equal(nativeContractUpdateUntouched(f.plan, applied.observation), false);
  assert.deepEqual(f.figma.root.findAll(() => true).map((n: any) => n.id), ids);

  const repeat = await f.run(script);
  assert.equal(repeat.status, 'no-op', JSON.stringify(repeat.problems));
  const rollback = await f.run(emitNativeContractUpdateScript(f.plan, 'rollback'));
  assert.equal(rollback.status, 'updated', JSON.stringify(rollback.problems));
  assert.equal(f.variable.valuesByMode[f.modeId], XS);
  assert.ok(nativeContractUpdateMatches(f.plan, rollback.observation));
  assert.ok(nativeContractUpdateUntouched(f.plan, rollback.observation));
});

test('a partial application is finished and a completed record without its effects is not complete', async () => {
  const f = await shadowTokenFixture();
  f.variable.setValueForMode(f.modeId, SM);
  const partial = await f.run(emitNativeContractUpdateScript(f.plan, 'apply', true));
  assert.equal(partial.status, 'preflight-observed', JSON.stringify(partial.problems));
  assert.equal(nativeContractUpdateMatches(f.plan, partial.observation), true, 'one side of each pinned transition');
  assert.equal(nativeContractUpdateMatches(f.plan, partial.observation, true), false, 'the effects are not yet written');
  assert.equal(nativeContractUpdateUntouched(f.plan, partial.observation), false);
  const finished = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(finished.status, 'updated', JSON.stringify(finished.problems));
  assert.deepEqual(finished.tokenChanges, [], 'the recorded value was already written');
  assert.ok(nativeContractUpdateMatches(f.plan, finished.observation, true));
});

test('a foreign shadow value, or a binding to the record, refuses before any write', async () => {
  const f = await shadowTokenFixture();
  f.variable.setValueForMode(f.modeId, 'rgba(255, 0, 0, 1) 0px 0px 4px 0px');
  const foreign = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(foreign.status, 'refused');
  assert.match(foreign.problems[0], /native-update-token-value-conflict/);
  assert.ok(f.nodes.every((n: any) => n.effects.length === 0), 'no effect written');
  f.variable.setValueForMode(f.modeId, XS);
  // A text binding on another page: STRING records can be read by any text.
  const page = f.figma.createPage(); page.name = 'Designer page';
  const rect = f.figma.createRectangle(); page.appendChild(rect);
  rect.boundVariables = { visible: { type: 'VARIABLE_ALIAS', id: f.variable.id } };
  const bound = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(bound.status, 'refused');
  assert.deepEqual(bound.problems, ['native-update-token-bound:' + f.variable.id]);
  assert.equal(f.variable.valuesByMode[f.modeId], XS);
  assert.ok(f.nodes.every((n: any) => n.effects.length === 0));
});

test('a failed effects assignment restores the record and the effects in reverse', async () => {
  const f = await shadowTokenFixture();
  let effects = f.nodes[1].effects;
  Object.defineProperty(f.nodes[1], 'effects', { configurable: true, get: () => effects, set: (next: any[]) => {
    if (next.length) throw Error('effect assignment failed'); effects = next;
  } });
  const result = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(result.status, 'rolled-back', JSON.stringify(result.problems));
  assert.equal(f.variable.valuesByMode[f.modeId], XS, 'the record is restored');
  assert.ok(f.nodes.every((n: any) => n.effects.length === 0), 'the first effects write is restored');
});

test('only a shadow record rides with the effects: every other variable value refuses by name', async () => {
  const f = await shadowTokenFixture({ spare: { $type: 'number', $value: 1 }, family: { $type: 'fontFamily', $value: 'Inter' } });
  const mixed = { ...structuredClone(f.input), desired: f.desiredFor(SM, t => { t.spare.$value = 0.5; }) };
  assert.equal(refusal(() => prepareNativeContractUpdate(mixed)), 'native-update-token-value-mixed-channels-unqualified:spare');
  // A shadow record that changes while no effect does is not a shadow update.
  const alone = { ...structuredClone(f.input), desired: f.desiredFor(SM) };
  for (const variant of alone.desired.component.variants) delete variant.spec.effectStack;
  assert.equal(refusal(() => prepareNativeContractUpdate(alone)), 'native-update-token-type-unsupported:shadow;shadow');
  // The same effects with an unchanged record carry no variable value at all.
  const quiet = { ...structuredClone(f.input), desired: f.desiredFor(XS) };
  for (const variant of quiet.desired.component.variants) variant.spec.effectStack = structuredClone(STACK[SM]);
  const plan = prepareNativeContractUpdate(quiet).plan as NativeShadowUpdatePlan;
  assert.equal(plan.kind, 'native-contract-shadow-update');
  assert.equal('tokenChanges' in plan, false, 'a shadow plan without a record change keeps its historical program');
});

test('returning to the allocated shadow value forgets the record and its protocol', async () => {
  const f = await shadowTokenFixture();
  const applied = await f.run(emitNativeContractUpdateScript(f.plan));
  assert.equal(applied.status, 'updated', JSON.stringify(applied.problems));
  const baseline = structuredClone(applied.observation); delete baseline.images;
  const back = prepareNativeContractUpdate({ before: f.plan.after, baseline, desired: f.desiredFor(XS) }).plan as NativeShadowUpdatePlan;
  assert.equal(back.kind, 'native-contract-shadow-update');
  assert.deepEqual(back.tokenChanges?.map(c => [c.before, c.after]), [[SM, XS]]);
  assert.equal(back.after.tokenInput.allocatedValues, undefined);
  assert.equal(back.after.tokenInput.allocatedValueProtocol, undefined);
  const returned = await f.run(emitNativeContractUpdateScript(back));
  assert.equal(returned.status, 'updated', JSON.stringify(returned.problems));
  assert.equal(f.variable.valuesByMode[f.modeId], XS);
  assert.equal(verifyNativeContractReadback(back.after, returned.observation).status, 'supported-structure-observed');
});

test('shadow-values-v1 remembers only string shadow leaves beside numbers, and names every other shape', async () => {
  const f = await shadowTokenFixture({ spare: { $type: 'number', $value: 1 } });
  const input = f.plan.after.tokenInput;
  const code = (edit: (next: any) => void) => { const next = structuredClone(input); edit(next); return refusal(() => prepareNativeTokenContext(next)); };
  assert.equal(code(() => {}), 'none');
  assert.equal(code(n => { delete n.allocatedValueProtocol; }), 'native-token-context-allocated-value-type', 'a remembered shadow names its protocol');
  assert.equal(code(n => { n.allocatedValueProtocol = 'px-dimension-v1'; }), 'native-token-context-allocated-value-type');
  assert.equal(code(n => { n.allocatedValues[0].value = { color: '#000' }; }), 'native-token-context-allocated-value-string');
  assert.equal(code(n => { n.allocatedValues[0].value = SM; }), 'native-token-context-allocated-value-redundant');
  assert.equal(code(n => { n.allocatedValues = [{ sourceMode: 'light', brand: 'default', tokenPath: 'spare', value: 0.5 }]; }),
    'native-token-context-allocated-value-protocol-empty', 'numbers alone keep the historical form');
});
