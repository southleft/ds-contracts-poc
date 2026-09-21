import assert from 'node:assert/strict';
import test from 'node:test';
import { revisionOf } from './contract-provenance.js';
import { nativeTextGraphComponentFixture } from './native-text-template-test-fixture.js';
import { emitNativeContractReadbackScript, emitNativeTemplateSyncReadback, verifyNativeContractReadback,
  type NativeContractObservationInput } from './native-source-observation.js';
import { emitNativeTemplateValueWriteScript, prepareNativeTemplateComponentUpdate } from './native-template-value-writer.js';
import type { NativeRootTextTemplateGraphInput } from './native-root-text-template-graph.js';

async function fixture() {
  const h = await nativeTextGraphComponentFixture(2, 2), creation = await h.run(h.script());
  const draft = h.engine.compileNativeContractDraft(h.contract, h.byId, h.source);
  const before: NativeContractObservationInput = structuredClone({ operation: h.operation, planRevision: revisionOf('template writer fixture'),
    projection: draft.projection, component: draft.component, tokenInput: h.context.tokens.input,
    tokenIdentity: h.context.tokens.identity, creation, templateGraph: { input: h.input, identity: h.created.identity } });
  const baseline = await h.run(emitNativeContractReadbackScript(before));
  assert.equal(verifyNativeContractReadback(before, baseline).status, 'supported-structure-observed');
  h.tokens.size.v1.$value = '17.5px'; h.tokens.line.v1.$value = '27px';
  h.tokens.ink.v1.$value = '#abcdef'; h.tokens.weight.$value = 700;
  const desired: NativeRootTextTemplateGraphInput = structuredClone(h.compile());
  desired.renderScope = 'component'; desired.tokens.fileKey = before.operation.fileKey;
  desired.tokens.scopeId = before.tokenInput.scopeId; desired.tokens.source.revision = before.tokenInput.source.revision;
  h.figma.listAvailableFontsAsync = async () => ['Regular', 'Medium', 'Bold'].map(style => ({fontName:{family:'Inter',style}}));
  h.figma.getNodeById = (id: string) => h.figma.root.id === id ? h.figma.root : h.figma.root.findOne((n: any) => n.id === id);
  h.figma.variables.getVariableById = (id: string) => h.variables.find(v => v.id === id) ?? null;
  h.figma.variables.getVariableCollectionById = (id: string) => h.collections.find(c => c.id === id) ?? null;
  const input = { before, baseline, desired }, plan = prepareNativeTemplateComponentUpdate(input);
  const assignments: string[] = [];
  for (const v of h.variables) {
    const assign = v.setValueForMode.bind(v);
    v.setValueForMode = (mode: string, value: unknown) => { assignments.push(v.id); assign(mode, value); };
  }
  return { ...h, input, plan, assignments, write: (readOnly = false) => h.run(emitNativeTemplateValueWriteScript(input, readOnly)) };
}

test('final synchronous template read matches the independent asynchronous inventory without yielding', async () => {
  const h = await fixture(), script = emitNativeTemplateSyncReadback(h.input.before);
  assert.doesNotMatch(script, /\bawait\b/);
  assert.deepEqual(await h.run(script), h.input.baseline);
  const old = h.figma.variables.getVariableCollectionById;
  delete h.figma.variables.getVariableCollectionById;
  assert.equal((await h.run(script)).status, 'refused');
  h.figma.variables.getVariableCollectionById = old;
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
