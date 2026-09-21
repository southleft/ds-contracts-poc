import assert from 'node:assert/strict';
import test from 'node:test';
import { revisionOf } from './contract-provenance.js';
import { nativeTextGraphComponentFixture, nativeTextNodeBindings, nativeNodePaintBindings } from './native-text-template-test-fixture.js';
import { emitNativeContractReadbackScript, emitNativeTemplateSyncReadback, verifyNativeContractReadback,
  type NativeContractObservationInput } from './native-source-observation.js';
import { emitNativeTemplateValueWriteScript, prepareNativeTemplateComponentUpdate } from './native-template-value-writer.js';
import type { NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';
import { prepareNativeContractComparison } from './native-contract-comparison.js';
import { emitNativeContractComparisonReadbackScript, emitNativeTemplateCallerContentReadback, verifyNativeContractComparisonReadback,
  type NativeContractComparisonObservationInput } from './native-contract-comparison-observation.js';
import { emitNativeTokenContextScript, emitNativeTokenContextReadbackScript } from './token-set.js';
import { verifyNativeTemplateConsumersAfter, type NativeTemplateConsumerInput } from './native-template-value-consumers.js';
import { emitNativeTemplateUpdateObservationScript, inspectNativeTemplateUpdateObservation } from './native-template-update-observation.js';
import { prepareNativeTemplateUpdateProposal, restoreNativeTemplateUpdateProposal } from './native-template-update-proposal.js';
import { matchNativeTemplateUpdateObservation } from './native-template-update-match.js';

import {nativeTemplateValueUpdateFixture as fixture} from './native-template-value-update-test-fixture.js';

test('completed template updates verify resolved paint and all retained caller facts, not only variable receipts', async () => {
  const h = await fixture(true, true);
  const initial = matchNativeTemplateUpdateObservation(h.input, await h.run(emitNativeTemplateUpdateObservationScript(h.input)));
  assert.equal(initial.untouched, true); assert.equal(initial.completed, false); assert.deepEqual(initial.problems, []);
  await h.write();
  const raw = await h.run(emitNativeTemplateUpdateObservationScript(h.input));
  const result = matchNativeTemplateUpdateObservation(h.input, raw);
  assert.equal(result.completed, true, JSON.stringify(result.problems));
  assert.equal(result.nativeQualification, 'unqualified');
  for (const corrupt of [
    (r: any) => { r.observation.nodes.find((n: any) => n.type === 'COMPONENT').values.x += 1; },
    (r: any) => { r.consumerObservations[0].nodes.find((n: any) => n.type === 'TEXT').values.width += 1; },
    (r: any) => { r.consumerObservations[0].nodes.find((n: any) => n.type === 'TEXT').values.fontName.family = 'different'; },
    (r: any) => { r.consumerObservations[0].nodes.find((n: any) => n.type === 'TEXT').values.characters = 'edited'; },
    (r: any) => { r.consumerObservations[0].nodes.find((n: any) => n.type === 'INSTANCE').values.opacity = 0.8; },
    (r: any) => { r.observation.nodes.find((n: any) => n.type === 'COMPONENT').values.fills[0].blendMode = 'MULTIPLY'; },
    (r: any) => { r.observation.nodes.find((n: any) => n.type === 'COMPONENT').values.strokes[0].visible = false; },
    (r: any) => { r.observation.nodes.find((n: any) => n.values.fills?.[0]?.opacity === 128 / 255).values.fills[0].color.extra = 1; },
    (r: any) => { r.consumerObservations[0].nodes[0].metadata.unrequested = 'edit'; },
  ]) {
    const broken = structuredClone(raw); corrupt(broken);
    assert.equal(matchNativeTemplateUpdateObservation(h.input, broken).completed, false);
  }
  // A value update cannot hide an unrelated paint change, including unchanged
  // variants whose leaf has the same old colour as the changed source leaf.
  for (const collection of [raw.observation.nodes, raw.consumerObservations[0].nodes]) {
    for (const node of collection) for (const field of ['fills', 'strokes']) {
      if (!node.values[field]?.[0]?.boundVariables?.color) continue;
      for (const mutate of [(p: any) => p.color.r = 0, (p: any) => p.opacity = 0.5]) {
        const broken = structuredClone(raw), rows = collection === raw.observation.nodes ? broken.observation.nodes : broken.consumerObservations[0].nodes;
        mutate(rows.find((n: any) => n.id === node.id).values[field][0]);
        assert.equal(matchNativeTemplateUpdateObservation(h.input, broken).completed, false, node.id + ':' + field);
      }
    }
  }
  const next = { before: h.plan.after, baseline: raw.observation, desired: h.input.desired, consumers: result.consumerStates };
  const repeat = await h.run(emitNativeTemplateUpdateObservationScript(next));
  assert.equal(matchNativeTemplateUpdateObservation(next, repeat).completed, true);
  assert.equal(matchNativeTemplateUpdateObservation(next, repeat).untouched, true);
  const reverse = { ...next, desired: h.input.before.templateGraph!.input };
  await h.run(emitNativeTemplateValueWriteScript(reverse));
  const reversed = await h.run(emitNativeTemplateUpdateObservationScript(reverse));
  assert.equal(matchNativeTemplateUpdateObservation(reverse, reversed).completed, true);
  assert.deepEqual(reversed.observation, h.input.baseline);
});

test('final synchronous template read matches the independent asynchronous inventory without yielding', async () => {
  const h = await fixture(), script = emitNativeTemplateSyncReadback(h.input.before);
  assert.doesNotMatch(script, /\bawait\b/);
  assert.deepEqual(await h.run(script), h.input.baseline);
  const old = h.figma.variables.getVariableCollectionById;
  delete h.figma.variables.getVariableCollectionById;
  assert.equal((await h.run(script)).status, 'refused');
  h.figma.variables.getVariableCollectionById = old;
});

test('typography transitions keep face axes exact and never discard changed computed geometry', async () => {
  const h = await fixture(true, 'weight');
  await h.write();
  const raw = await h.run(emitNativeTemplateUpdateObservationScript(h.input));
  const diagnostic = inspectNativeTemplateUpdateObservation(h.input, raw);
  assert.equal(diagnostic.supportedAfterStructure, true, JSON.stringify(diagnostic.problems));
  const matching = matchNativeTemplateUpdateObservation(h.input, raw);
  assert.equal(matching.completed, true, JSON.stringify(matching.problems));
  const main = raw.observation.nodes.find((n: any) => n.type === 'TEXT');
  assert.equal(main.values.fontName.variationSettings.wght, 700);
  for (const corrupt of [
    (r: any) => { r.observation.nodes.find((n: any) => n.id === main.id).values.fontName.variationSettings.wght = 400; },
    (r: any) => { r.observation.nodes.find((n: any) => n.id === main.id).values.fontName.variationSettings.slnt = 1; },
    (r: any) => { r.observation.nodes.find((n: any) => n.id === main.id).values.fontName.variationSettings.wdth = 80; },
    (r: any) => { r.consumerObservations[0].nodes.find((n: any) => n.type === 'TEXT').values.height += 4; },
    (r: any) => { r.consumerObservations[0].nodes.find((n: any) => n.type === 'TEXT').values.width += 4; },
    (r: any) => { r.consumerObservations[0].nodes.find((n: any) => n.type === 'INSTANCE').values.x += 4; },
  ]) {
    const changed = structuredClone(raw); corrupt(changed);
    const result = matchNativeTemplateUpdateObservation(h.input, changed);
    assert.equal(result.completed, false);
    assert.deepEqual(result.consumerStates, []);
  }
});

test('verified caller subtrees follow inherited values, preserve content and reverse with the original identities', async () => {
  const h = await fixture(true), caller = h.plan.consumers[0];
  const script = emitNativeTemplateCallerContentReadback(caller.input, true);
  assert.doesNotMatch(script, /\bawait\b/);
  const content = await h.run(script); delete content.images;
  assert.deepEqual(content, caller.baseline.content);
  const preflight = await h.write(true);
  assert.equal(preflight.status, 'preflight-observed', JSON.stringify(preflight.problems));
  assert.deepEqual(h.assignments, []);
  const result = await h.write();
  assert.equal(result.status, 'write-observed', JSON.stringify(result.problems));
  const exact = matchNativeTemplateUpdateObservation(h.input, await h.run(emitNativeTemplateUpdateObservationScript(h.input)));
  assert.equal(exact.completed, false);
  assert.ok(exact.problems.some(p => p.startsWith('native-template-update-computed-geometry-changed:')), JSON.stringify(exact.problems));
  const verified = verifyNativeTemplateConsumersAfter(h.plan.consumers, h.plan.after, result.observation, result.consumerObservations);
  assert.equal(verified.status, 'supported-consumer-structure-observed', JSON.stringify(verified.problems));
  for (const corrupt of [
    (rows: any[]) => { rows.pop(); },
    (rows: any[]) => { rows.push(structuredClone(rows[0])); },
    (rows: any[]) => { rows[0].nodes.find((n: any) => n.type === 'TEXT').values.characters = 'lost caller content'; },
    (rows: any[]) => { rows[0].nodes.find((n: any) => n.type === 'INSTANCE').mainId = 'foreign'; },
    (rows: any[]) => { rows[0].nodes.find((n: any) => n.type === 'TEXT').values.fontSize = 13; },
  ]) {
    const rows = structuredClone(result.consumerObservations); corrupt(rows);
    assert.equal(verifyNativeTemplateConsumersAfter(h.plan.consumers, h.plan.after, result.observation, rows).status, 'refused');
  }
  const text = result.consumerObservations[0].nodes.find((n: any) => n.type === 'TEXT');
  assert.equal(text.values.characters, 'Retained caller'); assert.equal(text.values.fontSize, 17.5);
  assert.equal(text.values.fontName.style, 'Bold'); assert.deepEqual(text.values.lineHeight, {unit:'PIXELS',value:27});
  const next = { before: h.plan.after, baseline: result.observation, desired: h.input.desired, consumers: verified.states };
  const repeat = await h.run(emitNativeTemplateValueWriteScript(next));
  assert.equal(repeat.status, 'no-op', JSON.stringify(repeat.problems));
  const reversed = { ...next, desired: h.input.before.templateGraph!.input }, reversePlan = prepareNativeTemplateComponentUpdate(reversed);
  const reverse = await h.run(emitNativeTemplateValueWriteScript(reversed));
  assert.equal(reverse.status, 'write-observed', JSON.stringify(reverse.problems));
  const back = verifyNativeTemplateConsumersAfter(reversePlan.consumers, reversePlan.after, reverse.observation, reverse.consumerObservations);
  assert.equal(back.status, 'supported-consumer-structure-observed', JSON.stringify(back.problems));
  assert.deepEqual(back.states[0].baseline, caller.baseline);
  assert.deepEqual(reverse.observation, h.input.baseline);
});

test('caller evidence cannot admit unknown instances, forged bindings, duplicate scope or intervening caller edits', async () => {
  const h = await fixture(true), consumer = h.input.consumers[0];
  for (const change of [
    (v: typeof h.input) => v.consumers.push(structuredClone(v.consumers[0])),
    (v: typeof h.input) => { v.consumers[0].baseline.content.nodes.find((n: any) => n.type === 'TEXT').values.characters = 'unobserved'; },
    (v: typeof h.input) => { v.consumers[0].baseline.content.nodes.find((n: any) => n.type === 'TEXT').values.boundVariables.fontSize = []; },
    (v: typeof h.input) => { v.consumers[0].input.comparison.parent.planRevision = revisionOf('foreign'); },
  ]) {
    const bad = structuredClone(h.input); change(bad);
    assert.throws(() => prepareNativeTemplateComponentUpdate(bad), /native-template-consumer/);
  }
  const missing = await h.run(emitNativeTemplateValueWriteScript({ ...h.input, consumers: [] }));
  assert.equal(missing.status, 'refused'); assert.match(missing.problems[0], /instance-consumer-unobserved/);
  const nodeId = consumer.baseline.content.nodes.find((n: any) => n.type === 'TEXT').id;
  const load = h.figma.variables.getLocalVariablesAsync.bind(h.figma.variables);
  h.figma.variables.getLocalVariablesAsync = async () => { h.figma.getNodeById(nodeId).characters = 'intervening edit'; return load(); };
  const result = await h.write();
  assert.equal(result.status, 'refused'); assert.match(result.problems[0], /consumer-live-conflict/);
  assert.deepEqual(h.assignments, []);
});

test('a late unregistered caller or a changed recorded caller layout refuses before delivery', async () => {
  for (const kind of ['new-caller', 'layout', 'mode']) {
    const h = await fixture(true), caller = h.plan.consumers[0];
    const load = h.figma.variables.getLocalVariablesAsync.bind(h.figma.variables);
    let injected = false;
    h.figma.variables.getLocalVariablesAsync = async () => {
      if (!injected) {
        injected = true;
        const instance = h.figma.getNodeById(caller.instanceId);
        if (kind === 'new-caller') {
          const page = h.figma.createPage(); page.appendChild(instance.mainComponent.createInstance());
        } else if (kind === 'layout') instance.paddingLeft += 1;
        else instance.explicitVariableModes = {};
      }
      return load();
    };
    const result = await h.write();
    assert.equal(result.status, 'refused', kind + ': ' + JSON.stringify(result.problems));
    assert.deepEqual(h.assignments, []);
  }
});

test('preflight writes nothing, delivery changes only planned values, fresh repeat writes nothing, and reverse restores all observations', async () => {
  const h = await fixture(), preflight = await h.write(true);
  assert.equal(preflight.status, 'preflight-observed', JSON.stringify(preflight.problems));
  assert.deepEqual(h.assignments, []);
  const result = await h.write();
  assert.equal(result.status, 'write-observed', JSON.stringify(result.problems));
  assert.deepEqual(h.assignments, h.plan.valuePlan.changes.map(c => c.variableId));
  assert.equal(verifyNativeContractReadback(h.plan.after, result.observation).status, 'supported-structure-observed');
  const oldPlanRetry = await h.write();
  assert.equal(oldPlanRetry.status, 'refused', 'delivery cannot be replayed against a changed baseline');
  const repeatInput = { before: h.plan.after, baseline: result.observation, desired: h.input.desired };
  const count = h.assignments.length, repeat = await h.run(emitNativeTemplateValueWriteScript(repeatInput));
  assert.equal(repeat.status, 'no-op'); assert.equal(h.assignments.length, count);
  const reverseInput = { ...repeatInput, desired: h.input.before.templateGraph!.input };
  const reverse = await h.run(emitNativeTemplateValueWriteScript(reverseInput));
  assert.equal(reverse.status, 'write-observed', JSON.stringify(reverse.problems));
  assert.deepEqual(reverse.observation, h.input.baseline);
  assert.equal(verifyNativeContractReadback(h.input.before, reverse.observation).status, 'supported-structure-observed');
});

test('whole-document scope refuses external aliases, bindings, text ranges, styles and inherited instance consumers before assignment', async () => {
  for (const kind of ['alias', 'node', 'range', 'style', 'instance', 'hidden', 'missing-style-api']) {
    const h = await fixture(), leaf = h.variables.find(v => v.id === h.plan.valuePlan.changes[0].variableId)!;
    const external = h.figma.createPage();
    if (kind === 'alias') {
      const collection = h.figma.variables.createVariableCollection('external');
      const alias = h.figma.variables.createVariable('external', collection, leaf.resolvedType);
      alias.setValueForMode(collection.modes[0].modeId, {type:'VARIABLE_ALIAS',id:leaf.id});
    }
    if (kind === 'node') { const rect = h.figma.createRectangle(); external.appendChild(rect); rect.boundVariables = {opacity:{type:'VARIABLE_ALIAS',id:leaf.id}}; }
    if (kind === 'range') { const text = h.figma.createText(); external.appendChild(text);
      text.getStyledTextSegments = () => [{boundVariables:{fontWeight:{type:'VARIABLE_ALIAS',id:leaf.id}}}]; }
    if (kind === 'style') h.figma.getLocalTextStyles = () => [{boundVariables:{fontWeight:{type:'VARIABLE_ALIAS',id:leaf.id}}}];
    if (kind === 'instance') { const main = await h.figma.getNodeByIdAsync(h.input.before.creation.variants[0].id); external.appendChild(main.createInstance()); }
    if (kind === 'hidden') h.figma.skipInvisibleInstanceChildren = true;
    if (kind === 'missing-style-api') delete h.figma.getLocalGridStyles;
    const assignments = h.assignments.length, result = await h.write();
    assert.equal(result.status, 'refused', kind+': '+JSON.stringify(result.problems));
    assert.equal(h.assignments.length, assignments, kind);
  }
});

test('edits during the final async registry load and font loads are observed before the first assignment', async () => {
  for (const kind of ['node', 'route', 'variable', 'external', 'font-load']) {
    const h = await fixture();
    const mutate = () => {
      if (kind === 'node' || kind === 'font-load') h.figma.getNodeById(h.input.before.creation.variants[0].id).opacity = .123;
      if (kind === 'route') { const r = h.variables.find(v => v.id === h.plan.before.templateGraph!.identity.routes[0].id)!;
        r.valuesByMode[Object.keys(r.valuesByMode)[0]] = {type:'VARIABLE_ALIAS',id:'unowned'}; }
      if (kind === 'variable') { const c = h.plan.valuePlan.changes[0]; h.variables.find(v => v.id === c.variableId)!.valuesByMode[c.modeId] = '#corrupt'; }
      if (kind === 'external') { const page = h.figma.createPage(), n = h.figma.createRectangle(); page.appendChild(n);
        n.boundVariables = {opacity:{type:'VARIABLE_ALIAS',id:h.plan.valuePlan.changes[0].variableId}}; }
    };
    if (kind === 'font-load') h.figma.loadFontAsync = async () => { mutate(); };
    else { const load = h.figma.variables.getLocalVariablesAsync.bind(h.figma.variables);
      h.figma.variables.getLocalVariablesAsync = async () => { mutate(); return load(); }; }
    const result = await h.write();
    assert.equal(result.status, 'refused', kind+': '+JSON.stringify(result.problems)); assert.deepEqual(h.assignments, []);
  }
});

test('an interrupted assignment remains explicit and a repeated old plan cannot silently resume it', async () => {
  const h = await fixture(), second = h.variables.find(v => v.id === h.plan.valuePlan.changes[1].variableId)!;
  second.setValueForMode = () => { throw Error('injected assignment failure'); };
  const result = await h.write();
  assert.equal(result.status, 'recovery-required');
  assert.equal(result.changedVariableIds.length, 1); assert.equal(result.attemptedVariableIds.length, 2);
  assert.equal(h.assignments.length, 1, 'no unverified automatic reversal');
  const repeated = await h.write(); assert.equal(repeated.status, 'refused'); assert.equal(h.assignments.length, 1);
});

test('a separate observation distinguishes unchanged and changed values without treating delivery as settlement', async () => {
  const h = await fixture(true), script = emitNativeTemplateUpdateObservationScript(h.input);
  assert.doesNotMatch(script, /setValueForMode|loadFontAsync|createVariable\(/);
  const first = await h.run(script), untouched = inspectNativeTemplateUpdateObservation(h.input, first);
  assert.equal(first.status, 'collected');
  assert.equal(untouched.valueState, 'untouched'); assert.equal(untouched.untouched, true);
  assert.equal(untouched.supportedAfterStructure, false); assert.deepEqual(h.assignments, []);
  const delivery = await h.write(); assert.equal(delivery.status, 'write-observed');
  assert.equal(inspectNativeTemplateUpdateObservation(h.input, delivery).untouched, false);
  assert.match(inspectNativeTemplateUpdateObservation(h.input, delivery).problems[0], /observation-envelope/);
  const after = await h.run(script), inspected = inspectNativeTemplateUpdateObservation(h.input, after);
  assert.equal(inspected.valueState, 'updated'); assert.equal(inspected.untouched, false);
  assert.equal(inspected.supportedAfterStructure, true, JSON.stringify(inspected.problems));
  assert.equal(inspected.consumerStates.length, 1);
  assert.equal(inspected.writeAuthority, 'none'); assert.equal(inspected.settlementAuthority, 'none');
  const next = { before: h.plan.after, baseline: after.observation, desired: h.input.desired, consumers: inspected.consumerStates };
  const noOp = inspectNativeTemplateUpdateObservation(next, await h.run(emitNativeTemplateUpdateObservationScript(next)));
  assert.equal(noOp.valueState, 'no-op'); assert.equal(noOp.untouched, true); assert.equal(noOp.supportedAfterStructure, true);
  for (const change of [
    (r: typeof after) => { r.planRevision = revisionOf('wrong plan'); },
    (r: typeof after) => { r.observation.templateGraph.graphRevision = revisionOf('wrong reader'); },
    (r: typeof after) => { r.observation.templateGraph.receipt.graphRevision = revisionOf('wrong allocation'); },
    (r: typeof after) => { r.consumerObservations = []; },
    (r: typeof after) => { r.consumerObservations.push(structuredClone(r.consumerObservations[0])); },
    (r: typeof after) => { r.consumerObservations[0].nodes.find((n: any) => n.type === 'TEXT').values.characters = 'lost text'; },
  ]) {
    const corrupted = structuredClone(after); change(corrupted);
    const result = inspectNativeTemplateUpdateObservation(h.input, corrupted);
    assert.equal(result.supportedAfterStructure, false); assert.equal(result.untouched, false);
    assert.ok(result.problems.length);
  }
});

test('independent reads retain partial assignments and reject changed callers even when no variable changed', async () => {
  const h = await fixture(true), script = emitNativeTemplateUpdateObservationScript(h.input);
  const callerText = h.figma.getNodeById(h.plan.consumers[0].baseline.content.nodes!.find((n: any) => n.type === 'TEXT')!.id);
  const original = callerText.characters; callerText.characters = 'design edit';
  const edited = inspectNativeTemplateUpdateObservation(h.input, await h.run(script));
  assert.equal(edited.valueState, 'untouched'); assert.equal(edited.untouched, false);
  assert.ok(edited.problems.includes('native-template-update-observation-baseline-conflict'));
  callerText.characters = original;
  const second = h.variables.find(v => v.id === h.plan.valuePlan.changes[1].variableId)!;
  second.setValueForMode = () => { throw Error('interrupted assignment'); };
  assert.equal((await h.write()).status, 'recovery-required');
  const observation = await h.run(script), partial = inspectNativeTemplateUpdateObservation(h.input, observation);
  assert.equal(observation.status, 'collected'); assert.equal(partial.valueState, 'partial');
  assert.equal(partial.untouched, false); assert.equal(partial.supportedAfterStructure, false);
  assert.equal(partial.settlementAuthority, 'none'); assert.deepEqual(partial.consumerStates, []);
  assert.equal((await h.write()).status, 'refused'); assert.equal(h.assignments.length, 1);
});

test('a main or caller edit during the second caller read refuses the entire independent observation', async () => {
  for (const target of ['main', 'caller']) {
    const h = await fixture(true), page = h.plan.consumers[0].input.creation.pageId;
    const get = h.figma.getNodeByIdAsync.bind(h.figma); let reads = 0;
    h.figma.getNodeByIdAsync = async (id: string) => {
      if (id === page && ++reads === 2) {
        const node = target === 'main' ? h.figma.getNodeById(h.input.before.creation.variants[0].id)
          : h.figma.getNodeById(h.plan.consumers[0].instanceId);
        node.opacity = .123;
      }
      return get(id);
    };
    const result = await h.run(emitNativeTemplateUpdateObservationScript(h.input));
    assert.equal(result.status, 'refused', target);
    assert.ok(result.problems.includes('native-template-update-observation-changed-during-read'), JSON.stringify(result.problems));
    assert.equal(inspectNativeTemplateUpdateObservation(h.input, result).untouched, false);
    assert.deepEqual(h.assignments, []);
  }
});

test('compact proposals restore identical guarded programs and reject competing parent copies or changed derived plans', async () => {
  const h = await fixture(true), proposal = prepareNativeTemplateUpdateProposal(h.input);
  const restored = restoreNativeTemplateUpdateProposal(proposal);
  assert.deepEqual(prepareNativeTemplateComponentUpdate(restored), h.plan);
  assert.equal(emitNativeTemplateValueWriteScript(restored), emitNativeTemplateValueWriteScript(h.input));
  assert.equal(emitNativeTemplateUpdateObservationScript(restored), emitNativeTemplateUpdateObservationScript(h.input));
  assert.ok(Buffer.byteLength(JSON.stringify(proposal)) < Buffer.byteLength(JSON.stringify(h.plan)) / 2);
  const resigned = (p: typeof proposal) => { const { revision: _revision, ...body } = p; p.revision = revisionOf(body); return p; };
  for (const mutate of [
    (p: typeof proposal) => { p.planRevision = revisionOf('forged writer'); },
    (p: typeof proposal) => { (p.input.consumers[0].input.comparison as any).parent = {}; },
    (p: typeof proposal) => { p.input.consumers[0].baseline.parent = {}; },
    (p: typeof proposal) => { p.input.consumers[0].input.creation.pageId = p.input.before.creation.pageId; },
    (p: typeof proposal) => { p.input.consumers[0].baseline.content = {}; },
  ]) {
    const bad = structuredClone(proposal); mutate(bad);
    assert.throws(() => restoreNativeTemplateUpdateProposal(resigned(bad)), /native-template/);
  }
  const changed = structuredClone(proposal); changed.input.desired.source.tokenRevision = revisionOf('unsealed edit');
  assert.throws(() => restoreNativeTemplateUpdateProposal(changed), /proposal-changed/);
});
