import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock, type MockNode } from '../scripts/plugin-engine-mock-figma.mjs';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createPluginEngine } from '../figma-sync/plugin/engine/entry.js';

const tokens = { primitives: { fade: { $type: 'number', $value: 0.5 } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const quiet = { log() {}, warn() {}, error() {} };
function fixture(variants: boolean) {
  return ContractSchema.parse({
    id: 'test.joint-properties', name: 'JointProperties', version: '0.1.0', status: 'draft',
    description: 'Editable text with an independent visibility property', states: [], semantics: { element: 'div' },
    props: [
      { name: 'label', type: 'text', default: 'Original label', bindings: { code: { prop: 'label' }, figma: { kind: 'TEXT', property: 'Label' } } },
      { name: 'shown', type: 'boolean', default: true, bindings: { code: { prop: 'shown' }, figma: { kind: 'BOOLEAN', property: 'Shown' } } },
      ...(variants ? [{ name: 'size', type: { enum: ['small', 'large'] }, default: 'small', bindings: {
        code: { prop: 'size' }, figma: { kind: 'VARIANT', property: 'Size', values: { small: 'Small', large: 'Large' } },
      } }] : []),
    ],
    anatomy: { root: { layout: { display: 'inline-flex' }, parts: {
      label: { content: { prop: 'label' }, visibleWhen: { prop: 'shown' } },
      body: { slot: { name: 'children', bindings: { figma: { property: 'Content' } } }, visibleWhen: { prop: 'shown' } },
    } } },
    bindings: { code: { anchors: { importPath: 'test/JointProperties', export: 'JointProperties' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
}

test('text and visibility controls both work after create, amend and repeat for standalone and variant components', async () => {
  for (const variants of [false, true]) for (const shown of [false, true]) for (const statePreviews of [false, true]) {
    const mock = createFigmaMock(), contract = fixture(variants);
    contract.props[1].default = shown;
    if (statePreviews) {
      contract.states = ['hover']; contract.bindings.figma.statePreviews = true;
      contract.anatomy.root.states = { hover: { opacity: '{fade}' } };
    }
    const engine = createFigmaEngine({ tokens, icons: new Map() });
    const context = vm.createContext({ figma: mock.figma, console: quiet });
    await vm.runInContext(`(async()=>{${engine.buildTokensScript(null)}\n})()`, context);
    const run = () => vm.runInContext(`(async()=>{${engine.buildComponentScript(contract, new Map([[contract.id, contract]]))}\n})()`, context);
    const target = () => mock.root.findOne(n => n.getSharedPluginData('ds_contracts', 'contractId') === contract.id && n.parent?.type !== 'COMPONENT_SET')!;
    let originalId: string | undefined, originalKeys: string[] | undefined;
    for (const phase of ['create', 'amend'] as const) {
      if (phase === 'amend') { contract.version = '0.1.1'; contract.props[0].default = 'Updated default'; }
      await run();
      const owner = target(), definitions = owner.componentPropertyDefinitions as Record<string, unknown>;
      const plugin = createPluginEngine({ tokens, contracts: [], icons: {} });
      assert.equal(owner.getSharedPluginData('ds_contracts', 'specHash'), plugin.specHashOf(contract),
        'the application preview and native repeat share the corrected runtime hash');
      const labelKey = Object.keys(definitions).find(k => k.startsWith('Label#'))!;
      const shownKey = Object.keys(definitions).find(k => k.startsWith('Shown#'))!;
      assert.ok(labelKey && shownKey);
      if (phase === 'create') { originalId = owner.id; originalKeys = [labelKey, shownKey]; }
      else { assert.equal(owner.id, originalId); assert.deepEqual([labelKey, shownKey], originalKeys); }
      const mains = owner.type === 'COMPONENT_SET' ? owner.children! : [owner];
      for (const main of mains) {
        const label = main.findOne(n => n.type === 'TEXT')!;
        assert.deepEqual({ ...label.componentPropertyReferences }, { characters: labelKey, visible: shownKey }, `${phase}: both references survive`);
        const slot = main.findOne(n => n.type === 'SLOT')!;
        assert.deepEqual({ ...slot.componentPropertyReferences }, {
          slotContentId: Object.keys(definitions).find(k => k.startsWith('Content#'))!, visible: shownKey,
        }, `${phase}: slot content and visibility references survive`);
        const instance = (main as MockNode & { createInstance(): MockNode & { setProperties(p: Record<string, string | boolean>): void; remove(): void } }).createInstance();
        const text = instance.findOne(n => n.type === 'TEXT')!;
        instance.setProperties({ [labelKey]: 'Caller label', [shownKey]: false });
        assert.equal(text.characters, 'Caller label'); assert.equal(text.visible, false);
        instance.setProperties({ [shownKey]: true });
        assert.equal(text.characters, 'Caller label'); assert.equal(text.visible, true);
        instance.remove();
      }
      const ids = mains.map(n => n.id);
      assert.equal((await run()).results[0].skipped, true);
      assert.deepEqual((target().type === 'COMPONENT_SET' ? target().children! : [target()]).map(n => n.id), ids);
    }
  }
});
