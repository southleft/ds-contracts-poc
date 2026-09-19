/** A value change to an owned, allocated, UNBOUND variable is carried: the
 * update writes the variable's value together with the literal channel changes,
 * under the same guards as every other update. Found live on 2026-09-19: a
 * number token that no node binds refused every source change to its value. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nativeUpdateFixture } from './native-contract-update-test-fixture.js';
import { prepareNativeContractUpdate, emitNativeContractUpdateScript, verifyNativeContractUpdate, nativeContractUpdateMatches,
  nativeContractUpdateUntouched, nativeContractUpdateAfter, type NativeOpacityUpdatePlan } from './native-contract-update.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback } from './native-source-observation.js';
import { prepareNativeTokenContext, verifyNativeTokenContextReceipt } from './native-token-context.js';
import { emitNativeTokenContextScript } from './token-set.js';
import { nativeDesignChanges } from './native-design-changes.js';
import { revisionOf } from './contract-provenance.js';
import { createNativeUpdatePlans } from '../source-reference/native-update-plans.js';
import { createNativeUpdateJobs } from '../source-reference/native-update-jobs.js';

/** The developer changed the value the unbound `opacity` token records. */
async function tokenFixture(value: unknown = 0.4, extraTokens: Record<string, unknown> = {}) {
  const f = await nativeUpdateFixture(extraTokens);
  const changed = { ...structuredClone(f.tokens), opacity: { $type: 'number', $value: value } };
  const input = { ...structuredClone(f.input), desired: f.desiredFor(changed) };
  const variableId = f.tokenIdentity.variables.find((v: any) => v.tokenPath === 'opacity').id as string;
  const modeId = f.tokenIdentity.modes[0].modeId as string;
  const variable = await f.figma.variables.getVariableByIdAsync(variableId);
  const prepare = () => prepareNativeContractUpdate(input).plan as NativeOpacityUpdatePlan;
  const read = (observed: any) => f.run(emitNativeContractReadbackScript(observed));
  return { ...f, input, changed, variableId, modeId, variable, prepare, read };
}
const refusal = (prepare: () => unknown) => { try { prepare(); } catch (error) { return (error as Error).message; } return 'prepared'; };

test('an unbound number token and the literals that show it are carried in one plan, verified, repeated and rolled back', async () => {
  const f = await tokenFixture(), plan = f.prepare(), ids = f.figma.root.findAll(() => true).map((n: any) => n.id);
  assert.equal(plan.kind, 'native-contract-opacity-update'); assert.equal(plan.version, 1);
  assert.deepEqual(plan.tokenChanges, [{ tokenPath: 'opacity', variableId: f.variableId, modeId: f.modeId, sourceMode: 'light', brand: 'default', before: 0.5, after: 0.4 }]);
  assert.equal(plan.changes.length, 2); assert.ok(plan.changes.every(c => c.before === 0.5 && c.after === 0.4));
  // The token input left behind carries the desired value and remembers the allocation.
  assert.equal((plan.after.tokenInput.modes[0].tokens as any).opacity.$value, 0.4);
  assert.deepEqual(plan.after.tokenInput.allocatedValues, [{ sourceMode: 'light', brand: 'default', tokenPath: 'opacity', value: 0.5 }]);
  assert.equal(prepareNativeTokenContext(plan.after.tokenInput).revision, f.tokenIdentity.preparationRevision, 'ownership stamps stay valid: no metadata is rewritten');
  assert.deepEqual(plan.after.tokenIdentity, plan.before.tokenIdentity);

  const script = emitNativeContractUpdateScript(plan);
  assert.ok(script.includes('variable.setValueForMode(change.modeId, target)') && script.includes("'native-update-token-value-conflict:'") &&
    script.includes('getVariableByIdAsync(change.variableId)') && !/getLocalVariables|\.find\(v => v\.name/.test(script), 'a guarded write by pinned id, never a name search');
  const writes = script.slice(script.indexOf("out.status = 'preflight-observed'"), script.indexOf('out.observation = await')).replace(/^\s*\/\/.*$/gm, '');
  assert.ok(writes.includes('setValueForMode') && writes.includes('node.opacity = target') && !/\bawait\b/.test(writes), 'no await between the final checks and the assignments');

  assert.ok(nativeContractUpdateMatches(plan, f.input.baseline) && nativeContractUpdateUntouched(plan, f.input.baseline));
  assert.equal(nativeContractUpdateMatches(plan, f.input.baseline, true), false);
  const preflight = await f.run(emitNativeContractUpdateScript(plan, 'apply', true));
  assert.equal(preflight.status, 'preflight-observed', JSON.stringify(preflight.problems));
  assert.deepEqual(preflight.tokenStates, [{ variableId: f.variableId, modeId: f.modeId, value: 0.5 }]);
  assert.equal(f.variable.valuesByMode[f.modeId], 0.5, 'a preflight writes nothing');

  const applied = await f.run(script);
  assert.equal(applied.status, 'updated', JSON.stringify(applied.problems));
  assert.deepEqual(applied.tokenChanges, [f.variableId]); assert.equal(applied.changes.length, 2);
  assert.equal(f.variable.valuesByMode[f.modeId], 0.4); assert.ok(f.nodes.every((n: any) => n.opacity === 0.4));
  assert.deepEqual(f.figma.root.findAll(() => true).map((n: any) => n.id), ids);
  assert.equal(verifyNativeContractUpdate(plan, applied.observation).status, 'supported-structure-observed');
  assert.equal(verifyNativeContractReadback(plan.after, applied.observation).status, 'supported-structure-observed');
  assert.equal(verifyNativeTokenContextReceipt({ input: plan.after.tokenInput, expectedIdentity: plan.after.tokenIdentity, receipt: applied.observation.tokens.receipt }).status, 'native-token-context-observed');
  assert.equal(verifyNativeContractReadback(plan.before, applied.observation).status, 'refused', 'the old expectation no longer describes the canvas');
  assert.ok(nativeContractUpdateMatches(plan, applied.observation, true) && nativeContractUpdateMatches(plan, applied.observation));
  assert.equal(nativeContractUpdateUntouched(plan, applied.observation), false);

  const repeat = await f.run(script);
  assert.equal(repeat.status, 'no-op'); assert.deepEqual([repeat.changes, repeat.tokenChanges], [[], []]);
  // The next review of the same source starts from the carried value and plans nothing.
  const next = prepareNativeContractUpdate({ ...f.input, before: nativeContractUpdateAfter(plan, applied.observation), baseline: applied.observation }).plan as NativeOpacityUpdatePlan;
  assert.equal(next.changes.length, 0); assert.equal('tokenChanges' in next, false);

  const rollback = await f.run(emitNativeContractUpdateScript(plan, 'rollback'));
  assert.equal(rollback.status, 'updated', JSON.stringify(rollback.problems));
  assert.equal(f.variable.valuesByMode[f.modeId], 0.5); assert.ok(f.nodes.every((n: any) => n.opacity === 0.5));
  assert.equal(verifyNativeContractUpdate(plan, rollback.observation, 'rollback').status, 'supported-structure-observed');
  assert.ok(nativeContractUpdateUntouched(plan, rollback.observation));
});

test('every partial state is recognised and finished; a foreign variable value is a named conflict and nothing is written', async () => {
  const f = await tokenFixture(), plan = f.prepare();
  // Only the variable landed.
  f.variable.setValueForMode(f.modeId, 0.4);
  const variableOnly = await f.read(plan.before);
  assert.ok(nativeContractUpdateMatches(plan, variableOnly));
  assert.equal(nativeContractUpdateMatches(plan, variableOnly, true), false, 'not complete');
  assert.equal(nativeContractUpdateUntouched(plan, variableOnly), false, 'and not untouched');
  const finished = await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(finished.status, 'updated', JSON.stringify(finished.problems));
  assert.deepEqual(finished.tokenChanges, []); assert.equal(finished.changes.length, 2);
  await f.run(emitNativeContractUpdateScript(plan, 'rollback'));
  // Only one literal landed; then only the literals.
  f.nodes[0].opacity = 0.4;
  const oneLiteral = await f.read(plan.before);
  assert.ok(nativeContractUpdateMatches(plan, oneLiteral) && !nativeContractUpdateMatches(plan, oneLiteral, true) && !nativeContractUpdateUntouched(plan, oneLiteral));
  f.nodes[1].opacity = 0.4;
  const literalsOnly = await f.read(plan.before);
  assert.ok(nativeContractUpdateMatches(plan, literalsOnly) && !nativeContractUpdateMatches(plan, literalsOnly, true) && !nativeContractUpdateUntouched(plan, literalsOnly));
  const resumed = await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(resumed.status, 'updated'); assert.deepEqual([resumed.tokenChanges, resumed.changes], [[f.variableId], []]);
  await f.run(emitNativeContractUpdateScript(plan, 'rollback'));
  // A designer's value is neither side of the change.
  f.variable.setValueForMode(f.modeId, 0.41);
  const foreign = await f.read(plan.before);
  assert.equal(nativeContractUpdateMatches(plan, foreign), false); assert.equal(nativeContractUpdateUntouched(plan, foreign), false);
  for (const readOnly of [true, false]) {
    const refused = await f.run(emitNativeContractUpdateScript(plan, 'apply', readOnly));
    assert.equal(refused.status, 'refused');
    assert.deepEqual(refused.problems, ['native-update-token-value-conflict:' + f.variableId]);
    assert.deepEqual([refused.changes, refused.tokenChanges], [[], []]);
  }
  assert.equal(f.variable.valuesByMode[f.modeId], 0.41); assert.ok(f.nodes.every((n: any) => n.opacity === 0.5));
});

test('a variable stored as float32 verifies as the image of the intended value, and as nothing wider', async () => {
  const f = await tokenFixture(), plan = f.prepare();
  const set = f.variable.setValueForMode.bind(f.variable);
  f.variable.setValueForMode = (mode: string, value: unknown) => set(mode, typeof value === 'number' ? Math.fround(value) : value);
  const applied = await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(applied.status, 'updated', JSON.stringify(applied.problems));
  assert.equal(f.variable.valuesByMode[f.modeId], 0.4000000059604645);
  assert.ok(nativeContractUpdateMatches(plan, applied.observation, true));
  assert.equal(verifyNativeContractUpdate(plan, applied.observation).status, 'supported-structure-observed');
  assert.equal((await f.run(emitNativeContractUpdateScript(plan))).status, 'no-op', 'the stored float32 value is already the target');
  const near = structuredClone(applied.observation);
  near.tokens.receipt.variables.find((v: any) => v.id === f.variableId).valuesByMode[f.modeId] = 0.41;
  assert.equal(nativeContractUpdateMatches(plan, near, true), false); assert.equal(nativeContractUpdateMatches(plan, near), false);
  assert.equal(verifyNativeContractUpdate(plan, near).status, 'refused');
  near.tokens.receipt.variables.find((v: any) => v.id === f.variableId).valuesByMode[f.modeId] = 0.40000001;
  assert.equal(nativeContractUpdateMatches(plan, near, true), false, 'no tolerance: exactly the value or its float32 image');
  // The chain continues from the stored image and returns to the allocation.
  const back = prepareNativeContractUpdate({ before: nativeContractUpdateAfter(plan, applied.observation), baseline: applied.observation,
    desired: f.desiredFor(structuredClone(f.tokens)) }).plan as NativeOpacityUpdatePlan;
  assert.deepEqual(back.tokenChanges?.map(c => [c.before, c.after]), [[0.4000000059604645, 0.5]]);
  assert.equal('allocatedValues' in back.after.tokenInput, false, 'a value that returns to its allocation forgets the succession');
  assert.deepEqual(back.after.tokenInput, f.input.before.tokenInput);
  const returned = await f.run(emitNativeContractUpdateScript(back));
  assert.equal(returned.status, 'updated', JSON.stringify(returned.problems));
  assert.ok(nativeContractUpdateMatches(back, returned.observation, true));
});

test('a failed assignment or postcondition restores the variable and the literals in reverse and names what it cannot restore', async () => {
  const f = await tokenFixture(), plan = f.prepare();
  let opacity = f.nodes[1].opacity;
  Object.defineProperty(f.nodes[1], 'opacity', { configurable: true, get: () => opacity, set: (next: number) => { if (next === 0.4) throw Error('native assignment failed'); opacity = next; } });
  const failed = await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(failed.status, 'rolled-back', JSON.stringify(failed)); assert.deepEqual(failed.unrestored, []);
  assert.equal(f.variable.valuesByMode[f.modeId], 0.5); assert.equal(f.nodes[0].opacity, 0.5);

  const g = await tokenFixture(), stuck = g.prepare(), set = g.variable.setValueForMode.bind(g.variable);
  let calls = 0;
  g.variable.setValueForMode = (mode: string, value: unknown) => { if (++calls > 1) throw Error('variable is locked'); set(mode, value); };
  Object.defineProperty(g.nodes[1], 'opacity', { configurable: true, get: () => 0.5, set: () => { throw Error('native assignment failed'); } });
  const unrestored = await g.run(emitNativeContractUpdateScript(stuck));
  assert.equal(unrestored.status, 'recovery-required'); assert.deepEqual(unrestored.unrestored, [g.variableId]);

  const h = await tokenFixture(), guarded = h.prepare(), original = h.variable.setValueForMode.bind(h.variable);
  // The postcondition fails because something else moved; an independent edit to the variable is then not overwritten.
  h.variable.setValueForMode = (mode: string, value: unknown) => { original(mode, value); h.nodes[1].width += 1; original(mode, 0.9); };
  const edited = await h.run(emitNativeContractUpdateScript(guarded));
  assert.equal(edited.status, 'recovery-required'); assert.deepEqual(edited.unrestored, [h.variableId]);
  assert.equal(h.variable.valuesByMode[h.modeId], 0.9);
});

test('the variable must still be this operation\'s own unbound number variable at write time', async () => {
  const f = await tokenFixture(), plan = f.prepare();
  // Another owned variable now aliases it: the baseline no longer holds, and the reason is named first.
  const size = await f.figma.variables.getVariableByIdAsync(f.tokenIdentity.variables.find((v: any) => v.tokenPath === 'size').id);
  const held = size.valuesByMode[f.modeId];
  size.setValueForMode(f.modeId, { type: 'VARIABLE_ALIAS', id: f.variableId });
  assert.deepEqual((await f.run(emitNativeContractUpdateScript(plan))).problems, ['native-update-token-bound:' + f.variableId]);
  size.setValueForMode(f.modeId, held);
  // A node bound to it after verification.
  f.nodes[0].boundVariables = { ...f.nodes[0].boundVariables, opacity: { type: 'VARIABLE_ALIAS', id: f.variableId } };
  const bound = await f.run(emitNativeContractUpdateScript(plan));
  assert.equal(bound.status, 'refused'); assert.deepEqual(bound.problems, ['native-update-token-bound:' + f.variableId]);
  assert.equal(f.variable.valuesByMode[f.modeId], 0.5);
  // The same state refuses a fresh plan with the historical, now truthful, name.
  const baseline = await f.read(f.input.before);
  assert.equal(refusal(() => prepareNativeContractUpdate({ ...f.input, baseline })), 'native-update-verified-baseline-required', 'an unexpected binding is not a verified baseline at all');
});

test('ineligible token changes are refused by name, with the token path', async () => {
  const f = await tokenFixture(0.4, { gap: { $type: 'dimension', $value: '4px' }, faded: { $type: 'number', $value: 0.3 } });
  const desired = (edit: (tokens: Record<string, any>, tokenInput: any) => void) => {
    const input = structuredClone(f.input), tokens = structuredClone(f.tokens);
    edit(tokens, input.desired.tokenInput);
    input.desired.tokenInput.modes[0].tokens = tokens;
    return refusal(() => prepareNativeContractUpdate(input));
  };
  // `size` is bound to width and height on the canvas: the historical name, now truthful.
  assert.equal(desired(t => { t.size.$value = '17px'; }), 'native-update-bound-token-change-unsupported:changed;size');
  assert.equal(desired(t => { delete t.faded; }), 'native-update-bound-token-change-unsupported:removed;faded');
  assert.equal(desired(t => { t.opacity.$value = '{faded}'; }), 'native-update-token-alias-change-unsupported:opacity');
  assert.equal(desired(t => { t.opacity = { $type: 'dimension', $value: '4px' }; }), 'native-update-token-type-change-unsupported:opacity');
  assert.equal(desired(t => { t.gap.$value = '6px'; }), 'native-update-token-type-unsupported:dimension;gap');
  assert.equal(desired(t => { t.opacity.$extensions = { note: 'changed' }; }), 'native-update-token-extensions-change-unsupported:opacity');
  assert.equal(desired(t => { t.opacity.$value = 'forty percent'; }).startsWith('native-update-token-values-unqualified:'), true);
  assert.equal(desired((_, input) => { input.tokenPaths = input.tokenPaths.filter((p: string) => p !== 'opacity'); }), 'native-update-token-allocation-change-unsupported:released;opacity');
  assert.equal(desired((_, input) => { input.modes.push({ ...input.modes[0], sourceMode: 'dark', nativeModeName: 'Dark' }); }), 'native-update-token-modes-unsupported');
  assert.equal(desired((_, input) => { input.modes[0].nativeModeName = 'Day'; }), 'native-update-token-mode-unsupported');
  // A node that names the variable in its recorded metadata resolves through it, bound or not.
  const named = structuredClone(f.input); named.baseline.nodes!.find((n: any) => n.type === 'COMPONENT')!.metadata.lineHeightVar = 'opacity';
  assert.equal(refusal(() => prepareNativeContractUpdate(named)), 'native-update-bound-token-change-unsupported:changed;opacity');
  // A pinned identity without the variable never reaches eligibility: the baseline itself is unverified.
  assert.equal(refusal(() => { const i = structuredClone(f.input); i.before.tokenIdentity.variables = i.before.tokenIdentity.variables.filter((v: any) => v.tokenPath !== 'opacity'); prepareNativeContractUpdate(i); }),
    'native-update-verified-baseline-required', 'an identity without the variable is not a verified baseline');
  // Two eligible values are carried together, in the pinned order of the token tree.
  const both = structuredClone(f.input); (both.desired.tokenInput.modes[0].tokens as any).faded.$value = 0.2;
  assert.deepEqual((prepareNativeContractUpdate(both).plan as NativeOpacityUpdatePlan).tokenChanges?.map(c => [c.tokenPath, c.before, c.after]), [['opacity', 0.5, 0.4], ['faded', 0.3, 0.2]]);
  // A different spelling of the same number changes the record, not the canvas.
  const respelled = structuredClone(f.input); respelled.desired = f.desiredFor({ ...structuredClone(f.tokens), faded: { $type: 'number', $value: '0.3' } });
  const quiet = prepareNativeContractUpdate(respelled).plan as NativeOpacityUpdatePlan;
  assert.equal('tokenChanges' in quiet, false); assert.equal((quiet.after.tokenInput.modes[0].tokens as any).faded.$value, '0.3');
  assert.equal(verifyNativeContractReadback(quiet.after, f.input.baseline).status, 'supported-structure-observed');
});

test('a sibling plan kind never carries a variable value it cannot verify: the mixed change is refused by name', async () => {
  const f = await tokenFixture(), input = structuredClone(f.input);
  for (const variant of input.desired.component.variants) variant.spec.effectStack = [{ x: 0, y: 1, radius: 2, color: { r: 0, g: 0, b: 0, a: 0.05 } }];
  assert.equal(refusal(() => prepareNativeContractUpdate(input)), 'native-update-token-value-mixed-channels-unqualified:opacity');
});

test('a value succession re-derives its allocation and refuses anything but a scalar value change', async () => {
  const f = await tokenFixture(), plan = f.prepare(), input = plan.after.tokenInput;
  const prepared = prepareNativeTokenContext(input);
  assert.equal(prepared.revision, f.tokenIdentity.preparationRevision);
  assert.equal(prepared.valuesRevision, revisionOf({ ...prepared, revision: undefined, valuesRevision: undefined }));
  assert.equal(prepared.variables.find(v => v.tokenPath === 'opacity')!.values[0].value, 0.4);
  const code = (edit: (next: any) => void) => { const next = structuredClone(input); edit(next); return refusal(() => prepareNativeTokenContext(next)); };
  assert.equal(code(n => { n.allocatedValues[0].value = 0.4; }), 'native-token-context-allocated-value-redundant');
  assert.equal(code(n => { n.allocatedValues[0].tokenPath = 'missing'; }), 'native-token-context-allocated-value-path');
  assert.equal(code(n => { n.allocatedValues[0].sourceMode = 'dark'; }), 'native-token-context-allocated-value-mode');
  assert.equal(code(n => { n.allocatedValues = []; }), 'native-token-context-allocated-value-invalid');
  assert.equal(code(n => { n.allocatedValues.push({ ...n.allocatedValues[0] }); }), 'native-token-context-allocated-value-ambiguous');
  assert.equal(code(n => { n.allocatedValues.unshift({ ...n.allocatedValues[0], tokenPath: 'size', value: '12px' }); }), 'native-token-context-allocated-value-order');
  assert.equal(code(n => { n.allocatedValues[0].value = '{size}'; }), 'native-token-context-alias-type-mismatch', 'an allocation that was an alias is not a value succession');
  // A wrong remembered value derives a different allocation: the canvas ownership then refuses it.
  const wrong = structuredClone(input); wrong.allocatedValues![0].value = 0.6;
  assert.notEqual(prepareNativeTokenContext(wrong).revision, f.tokenIdentity.preparationRevision);
  assert.equal(verifyNativeContractReadback({ ...plan.after, tokenInput: wrong }, f.input.baseline).status, 'refused');
  assert.throws(() => emitNativeTokenContextScript(input), /value-succession-not-creatable/);
});

test('the design read names a designer\'s edit to an unbound variable value', async () => {
  const f = await tokenFixture(), plan = f.prepare();
  const applied = await f.run(emitNativeContractUpdateScript(plan));
  assert.deepEqual(nativeDesignChanges(applied.observation, await f.read(plan.after)).changes, []);
  f.variable.setValueForMode(f.modeId, 0.6);
  assert.deepEqual(nativeDesignChanges(applied.observation, await f.read(plan.after)).changes,
    [{ nodeId: f.variableId, node: 'opacity', channel: 'variable:value:' + f.modeId, recorded: 0.4, observed: 0.6 }]);
  f.variable.setValueForMode(f.modeId, Math.fround(0.4));
  assert.deepEqual(nativeDesignChanges(applied.observation, await f.read(plan.after)).changes, [], 'the float32 image of the recorded value is not an edit');
});

test('an unknown write that changed only the variable, or only some literals, is neither untouched nor complete', async t => {
  for (const partial of ['variable', 'literal', 'landed', 'nothing'] as const) {
    const f = await tokenFixture(), repo = mkdtempSync(path.join(tmpdir(), 'native-token-update-outcome-'));
    t.after(() => rmSync(repo, { recursive: true, force: true }));
    const plans = createNativeUpdatePlans(repo, () => ({ parentJournalRevision: 'a'.repeat(64), input: f.input }), id => jobs.updateHistory(id));
    const jobs = createNativeUpdateJobs(repo, plans), parent = f.input.before.operation.id, proposal = plans.prepare(parent);
    assert.deepEqual(proposal.tokenChanges?.map(c => c.variableId), [f.variableId], 'the review names the variable write');
    const id = jobs.prepare(parent, proposal.id).id;
    const run = async (phase: 'update-preflight-readback' | 'update-apply' | 'update-readback') => { const c = jobs.dispatch(id, phase); return jobs.accept(id, { ...c, result: await f.run(c.script) }); };
    assert.equal((await run('update-preflight-readback')).phase, 'update-preflight-observed');
    const write = jobs.dispatch(id, 'update-apply'); // the result never arrives
    if (partial === 'variable') f.variable.setValueForMode(f.modeId, 0.4);
    if (partial === 'literal') f.nodes[0].opacity = 0.4;
    if (partial === 'landed') await f.run(write.script);
    const read = jobs.resolveWriteOutcome(id), settled = jobs.accept(id, { ...read, result: await f.run(read.script) });
    if (partial === 'landed') {
      assert.equal(settled.phase, 'update-applied');
      assert.equal((await run('update-readback')).phase, 'update-verified');
      const effective = jobs.verifiedForParent(parent)!;
      assert.equal((effective.input.tokenInput.modes[0].tokens as any).opacity.$value, 0.4);
      assert.equal(plans.prepare(parent).id, proposal.id, 'reviewing the same source again reopens the verified update');
    } else if (partial === 'nothing') assert.equal(settled.phase, 'update-write-untouched');
    else {
      assert.equal(settled.phase, 'update-recovery-required');
      assert.deepEqual(settled.problems, ['native-update-write-outcome-unresolved']);
      assert.throws(() => jobs.verifiedForParent(parent), /effective-observation-unavailable/);
    }
  }
});
