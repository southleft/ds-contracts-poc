import assert from 'node:assert/strict';
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

export async function nativeTemplateValueUpdateFixture(withCaller = false, colorsOnly: boolean | 'weight' = false) {
  const h = await nativeTextGraphComponentFixture(2, 2), creation = await h.run(h.script());
  for (const born of creation.nodes) {
    const node = await h.figma.getNodeByIdAsync(born.id);
    nativeNodePaintBindings(node, id => h.variables.find(v => v.id === id));
    if (node.type === 'TEXT') node.fontName = { ...node.fontName, variationSettings: { slnt: 0, wght: node.fontWeight } };
  }
  const draft = h.engine.compileNativeContractDraft(h.contract, h.byId, h.source);
  const before: NativeContractObservationInput = structuredClone({ operation: h.operation, planRevision: revisionOf('template writer fixture'),
    projection: draft.projection, component: draft.component, tokenInput: h.context.tokens.input,
    tokenIdentity: h.context.tokens.identity, creation, templateGraph: { input: h.input, identity: h.created.identity } });
  const baseline = await h.run(emitNativeContractReadbackScript(before));
  assert.equal(baseline.status, 'native-readback-collected', JSON.stringify(baseline.problems));
  assert.equal(verifyNativeContractReadback(before, baseline).status, 'supported-structure-observed', JSON.stringify(verifyNativeContractReadback(before, baseline).problems));
  const consumers: NativeTemplateConsumerInput[] = [];
  if (withCaller) {
    const content = structuredClone(h.contract); content.id = 'test.update-caller'; content.props = [];
    delete content.anatomy.root.slot;
    for (const [key, value] of Object.entries(content.anatomy.root.tokens!))
      content.anatomy.root.tokens![key] = value.replace('{size}', 'v1').replace('{ink}', 'v1');
    content.anatomy.root.parts = { label: { text: 'Retained caller' } };
    const variantName = before.component.variants.find(v => v.name.includes('Size=v1') && v.name.includes('Ink=v1'))!.name;
    const comparison = { parent: before, receipt: baseline, caseId: 'retained-caller', variantName, slotSpecPath: [0],
      rootText: { version: 1 as const, kind: 'direct-root-text' as const, characters: 'Retained caller',
        contractRevision: revisionOf(content), treeRevision: revisionOf('direct source text') } };
    const byId = new Map([[content.id, content]]), compiled = h.engine.compileComponentData(content, byId);
    const prepared = prepareNativeContractComparison(content, compiled, h.source, revisionOf(h.tokens),
      { mode: 'light', brand: 'default' }, comparison, h.tokens);
    const operation = { id: '10000000-0000-4000-8000-000000000098', fileKey: h.figma.fileKey };
    const tokenInput = structuredClone(h.context.tokens.input); tokenInput.scopeId = 'source-' + operation.id;
    const tokensCreated = await h.run(emitNativeTokenContextScript(tokenInput).script);
    const tokenRead = await h.run(emitNativeTokenContextReadbackScript(tokenInput, tokensCreated.creationIdentity));
    const context = { operation, tokens: { input: tokenInput, identity: tokensCreated.creationIdentity, receipt: tokenRead.receipt } };
    const created = await h.run(h.engine.buildNativeContractComparisonScript(content, byId, h.source, context, comparison));
    assert.equal(created.status, 'created-candidate', JSON.stringify(created));
    for (const born of created.nodes.filter((n: any) => n.type === 'TEXT'))
      nativeTextNodeBindings(await h.figma.getNodeByIdAsync(born.id), id => h.variables.find(v => v.id === id));
    for (const born of created.nodes) nativeNodePaintBindings(await h.figma.getNodeByIdAsync(born.id), id => h.variables.find(v => v.id === id));
    const input: NativeContractComparisonObservationInput = { operation, planRevision: revisionOf('caller update observation'),
      comparison: prepared, tokenInput, tokenIdentity: context.tokens.identity, creation: created };
    const observed = await h.run(emitNativeContractComparisonReadbackScript(input));
    assert.equal(verifyNativeContractComparisonReadback(input, observed).status, 'supported-comparison-structure-observed');
    consumers.push({ input, baseline: observed });
  }
  if (!colorsOnly) {
    h.tokens.size.v1.$value = '17.5px'; h.tokens.line.v1.$value = '27px'; h.tokens.weight.$value = 700;
  }
  if (colorsOnly === 'weight') h.tokens.weight.$value = 700;
  h.tokens.ink.v1.$value = colorsOnly === true ? '#abcdef80' : '#abcdef';
  const desired: NativeRootTextTemplateGraphInput = structuredClone(h.compile());
  desired.renderScope = 'component'; desired.tokens.fileKey = before.operation.fileKey;
  desired.tokens.scopeId = before.tokenInput.scopeId; desired.tokens.source.revision = before.tokenInput.source.revision;
  h.figma.listAvailableFontsAsync = async () => ['Regular', 'Medium', 'Bold'].map(style => ({fontName:{family:'Inter',style}}));
  h.figma.getNodeById = (id: string) => h.figma.root.id === id ? h.figma.root : h.figma.root.findOne((n: any) => n.id === id);
  h.figma.variables.getVariableById = (id: string) => h.variables.find(v => v.id === id) ?? null;
  h.figma.variables.getVariableCollectionById = (id: string) => h.collections.find(c => c.id === id) ?? null;
  Object.defineProperty(Object.getPrototypeOf(h.figma.currentPage), 'mainComponent', {
    configurable: true, get() { return this._mainComponent ?? null; },
  });
  const input = { before, baseline, desired, consumers }, plan = prepareNativeTemplateComponentUpdate(input);
  const assignments: string[] = [];
  for (const v of h.variables) {
    const assign = v.setValueForMode.bind(v);
    v.setValueForMode = (mode: string, value: unknown) => { assignments.push(v.id); assign(mode, value); };
  }
  return { ...h, input, plan, assignments, write: (readOnly = false) => h.run(emitNativeTemplateValueWriteScript(input, readOnly)) };
}

