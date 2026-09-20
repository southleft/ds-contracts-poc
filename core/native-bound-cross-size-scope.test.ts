import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { emitNativeBoundCrossSizeScope, type NativeBoundCrossSizeScope } from './native-bound-cross-size-scope.js';

function fixture() {
  const alias = { type: 'VARIABLE_ALIAS', id: 'height' };
  const scope: NativeBoundCrossSizeScope = { variableId: 'height', collectionId: 'collection', modeId: 'light', channel: 'height', nodeIds: ['a', 'b'] };
  const page: any = { id: 'page', type: 'PAGE', children: [] };
  const set: any = { id: 'set', type: 'COMPONENT_SET', parent: page, children: [], componentPropertyDefinitions: {} };
  page.children.push(set);
  const roots = ['a', 'b'].map(id => ({ id, type: 'COMPONENT', parent: set, boundVariables: { height: alias },
    resolvedVariableModes: { collection: 'light' }, fills: [], children: [] }));
  set.children.push(...roots);
  // A variant cannot expose definitions itself; the scope must read its owner.
  for (const root of roots) Object.defineProperty(root, 'componentPropertyDefinitions', { get() { throw Error('variant definitions read'); } });
  const text: any = { id: 'text', type: 'TEXT', parent: page, boundVariables: {}, getStyledTextSegments: () => [] };
  const otherPage: any = { id: 'other-page', type: 'PAGE', children: [text] }; text.parent = otherPage;
  const variables: any[] = [{ id: 'height', variableCollectionId: 'collection', resolvedType: 'FLOAT', valuesByMode: { light: 18.390625 } }];
  const styles: any[] = [];
  const figma: any = { fileKey: 'writable', skipInvisibleInstanceChildren: false,
    root: { children: [page, otherPage] }, variables: { getLocalVariablesAsync: async () => variables, getLocalVariables: () => variables },
    getLocalPaintStyles: () => styles, getLocalTextStyles: () => [], getLocalEffectStyles: () => [], getLocalGridStyles: () => [] };
  const run = () => vm.runInNewContext(`(async()=>{const plan={before:{operation:{fileKey:'writable'},creation:{pageId:'page'}}},out={};
    ${emitNativeBoundCrossSizeScope(scope)}
    return out;})()`, { figma }, { timeout: 2000 });
  return { alias, scope, page, set, roots, text, otherPage, variables, styles, figma, run };
}
test('the scope permits exactly the pinned main-component cross-axis consumers in one mode', async () => {
  const f = fixture(), result = JSON.parse(JSON.stringify(await f.run()));
  assert.deepEqual(result.boundCrossSizeScope, { version: 1, variableId: 'height', channel: 'height', consumers: ['a', 'b'] });
  assert.deepEqual(result.bindingScope, { version: 'document-v1', pages: 2, nodes: 6 });
  assert.equal(f.variables[0].valuesByMode.light, 18.390625);
});
test('foreign consumers, modes, aliases, incomplete scope and late additions refuse', async () => {
  const corruptions: Array<(f: ReturnType<typeof fixture>) => void> = [
    f => { f.otherPage.boundVariables = { height: f.alias }; },
    f => { (f.roots[0].boundVariables as any).width = f.alias; },
    f => { f.roots[0].resolvedVariableModes.collection = 'dark'; },
    f => { f.variables.push({ id: 'alias', valuesByMode: { light: f.alias } }); },
    f => { f.variables[0].valuesByMode.dark = f.alias; },
    f => { f.styles.push({ paints: [{ boundVariables: { color: f.alias } }] }); },
    f => { f.text.getStyledTextSegments = () => [{ boundVariables: { fontSize: f.alias } }]; },
    f => { delete f.text.getStyledTextSegments; },
    f => { f.text.effects = [{ boundVariables: { radius: f.alias } }]; },
    f => { f.text.type = 'INSTANCE'; f.text.componentProperties = { value: f.alias }; },
    f => { f.text.type = 'VECTOR'; f.text.vectorNetwork = { bindings: [f.alias] }; },
    f => { f.set.componentPropertyDefinitions = { prop: { value: f.alias } }; },
    f => { f.set.children.pop(); },
    f => { f.variables[0].resolvedType = 'COLOR'; },
    f => { f.variables[0].variableCollectionId = 'different'; },
    f => { f.variables[0].valuesByMode.light = NaN; },
    f => { f.variables.push(structuredClone(f.variables[0])); },
    f => { delete f.figma.getLocalPaintStyles; },
    f => { delete f.figma.variables.getLocalVariables; },
    f => { f.figma.skipInvisibleInstanceChildren = true; },
    f => { f.figma.variables.getLocalVariablesAsync = async () => { f.otherPage.boundVariables = { height: f.alias }; return f.variables; }; },
  ];
  for (const [i, corrupt] of corruptions.entries()) {
    const f = fixture(); corrupt(f);
    await assert.rejects(f.run, /native-(?:bound-cross-size|update)-/, String(i));
  }
});
test('only the registry warmup may await; ambiguous scope declarations refuse before emission', () => {
  const f = fixture(), source = emitNativeBoundCrossSizeScope(f.scope);
  assert.equal((source.match(/\bawait\b/g) ?? []).length, 1);
  assert.ok(source.includes('getLocalVariablesAsync'));
  for (const scope of [{ ...f.scope, nodeIds: [] }, { ...f.scope, nodeIds: ['a', 'a'] },
    { ...f.scope, modeId: '' }, { ...f.scope, channel: 'opacity' }])
    assert.throws(() => emitNativeBoundCrossSizeScope(scope as NativeBoundCrossSizeScope), /scope-invalid/);
});

test('overridden instances of changed mains refuse, including invisible nested and late consumers', async () => {
  for (const position of ['other-page', 'invisible-nested', 'late'] as const) {
    const f = fixture();
    const instance: any = { id: 'instance', type: 'INSTANCE', boundVariables: {},
      componentProperties: {}, mainComponent: f.roots[0], children: [] };
    const add = () => {
      const parent = position === 'invisible-nested'
        ? { id: 'hidden', type: 'FRAME', visible: false, children: [] as any[] }
        : f.otherPage;
      parent.children.push(instance); instance.parent = parent;
      if (parent !== f.otherPage) f.otherPage.children.push(parent);
    };
    if (position === 'late') f.figma.variables.getLocalVariablesAsync = async () => { add(); return f.variables; };
    else add();
    await assert.rejects(f.run, /native-bound-cross-size-instance-consumer/, position);
  }
});

test('unrelated resolved instances are allowed but incomplete main-component evidence refuses', async () => {
  const f = fixture();
  f.text.type = 'INSTANCE'; f.text.componentProperties = {};
  f.text.mainComponent = { id: 'unrelated', type: 'COMPONENT' };
  assert.equal((await f.run()).boundCrossSizeScope.consumers.length, 2);
  for (const value of [undefined, null, {}, { id: '', type: 'COMPONENT' }, { id: 'a', type: 'FRAME' }]) {
    f.text.mainComponent = value;
    await assert.rejects(f.run, /native-bound-cross-size-instance-scope-unavailable/);
  }
  Object.defineProperty(f.text, 'mainComponent', { get() { throw Error('dynamic access or inaccessible main'); } });
  await assert.rejects(f.run, /native-bound-cross-size-instance-scope-unavailable/);
});
