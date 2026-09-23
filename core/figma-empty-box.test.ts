import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock, type MockNode } from '../scripts/plugin-engine-mock-figma.mjs';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';

const tokens = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
function fixture(id: string, root: Contract['anatomy']['root'], variants = false) {
  return ContractSchema.parse({ id: `test.empty-${id}`, name: `Empty${id}`, description: 'Empty intrinsic box regression',
    version: '0.1.0', status: 'draft', states: [], semantics: { element: 'div' },
    props: variants ? [{ name: 'size', type: { enum: ['small', 'large'] }, default: 'small',
      bindings: { code: { prop: 'size' }, figma: { kind: 'VARIANT', property: 'Size', values: { small: 'Small', large: 'Large' } } } }] : [],
    anatomy: { root }, bindings: { code: { anchors: { importPath: 'test/Empty', export: 'Empty' } },
      figma: { anchors: { fileKey: null, componentSetKey: null } } } });
}
const layout = { display: 'inline-flex' as const, direction: 'column' as const, align: 'start' as const };
const hug = { width: 'fit-content', height: 'fit-content' };
const padded = { ...hug, 'padding-left': '7px', 'padding-right': '11px', 'padding-top': '3px', 'padding-bottom': '5px' };
const quiet = { log() {}, warn() {}, error() {} };

test('mock retains the measured difference between the two resize APIs and padded HUG boxes', () => {
  const { figma } = createFigmaMock();
  for (const method of ['resize', 'resizeWithoutConstraints'] as const) {
    const frame = (figma.createFrame as () => MockNode & {
      resize(width: number, height: number): void;
      resizeWithoutConstraints(width: number, height: number): void;
    })();
    frame.layoutMode = 'VERTICAL'; frame[method](0, 0);
    frame.layoutSizingHorizontal = 'HUG'; frame.layoutSizingVertical = 'HUG';
    const expected = method === 'resize' ? Math.fround(0.0001) : 0;
    assert.deepEqual([frame.width, frame.height], [expected, expected]);
    frame.paddingLeft = 7; frame.paddingRight = 11; frame.paddingTop = 3; frame.paddingBottom = 5;
    assert.deepEqual([frame.width, frame.height], [18, 8]);
  }
});

test('generated single and variant components preserve exact empty, padded and declared sizes on create, amend and repeat', async () => {
  for (const variants of [false, true]) for (const [kind, literals, expected] of [
    ['zero', hug, [0, 0]], ['padding', padded, [18, 8]],
    ['declared', { width: '34px', height: '14px' }, [34, 14]],
    ['widthonly', { width: '47px' }, [47, 0]],
    ['heightonly', { height: '31px' }, [0, 31]],
  ] as const) {
    const mock = createFigmaMock(), engine = createFigmaEngine({ tokens, icons: new Map() });
    const contract = fixture(kind, { layout, literals }, variants), byId = new Map([[contract.id, contract]]);
    const context = vm.createContext({ figma: mock.figma, console: quiet });
    const run = () => vm.runInContext(`(async()=>{${engine.buildComponentScript(contract, byId)}\n})()`, context);
    const find = () => mock.root.findOne(n => n.getSharedPluginData('ds_contracts', 'contractId') === contract.id && n.parent?.type !== 'COMPONENT_SET')!;
    const boxes = () => { const main = find(); return main.type === 'COMPONENT_SET' ? main.children! : [main]; };
    await run(); const mainId = find().id, ids = boxes().map(n => n.id);
    assert.deepEqual(boxes().map(n => [n.width, n.height]), ids.map(() => [...expected]), `${kind}: create`);
    contract.version = '0.1.1'; await run();
    assert.equal(find().id, mainId);
    assert.deepEqual(boxes().map(n => [n.id, n.width, n.height]), ids.map(id => [id, ...expected]), `${kind}: amend retains mains and dimensions`);
    const before = boxes().map(n => [n.id, n.width, n.height]);
    const repeat = await run(); assert.equal(repeat.results[0].skipped, true);
    assert.deepEqual(boxes().map(n => [n.id, n.width, n.height]), before);
  }
});

test('generated native slots contribute no seed pixel and retain their property across an amendment', async () => {
  const mock = createFigmaMock(), engine = createFigmaEngine({ tokens, icons: new Map() });
  const contract = fixture('slot', { layout, literals: { width: '85px', height: 'fit-content' },
    parts: { body: { layout, literals: hug, slot: { name: 'children', bindings: { figma: { property: 'Content' } } } } } });
  const byId = new Map([[contract.id, contract]]), context = vm.createContext({ figma: mock.figma, console: quiet });
  const run = () => vm.runInContext(`(async()=>{${engine.buildComponentScript(contract, byId)}\n})()`, context);
  const find = () => mock.root.findOne(n => n.getSharedPluginData('ds_contracts', 'contractId') === contract.id)!;
  await run(); const main = find(), slot = main.findOne(n => n.type === 'SLOT')!;
  const prop = slot.componentPropertyReferences.slotContentId;
  assert.deepEqual([main.width, main.height, slot.width, slot.height], [85, 0, 0, 0]);
  contract.anatomy.root.parts!.body.literals = { ...padded }; contract.version = '0.1.1';
  await run(); const changed = find(), nextSlot = changed.findOne(n => n.type === 'SLOT')!;
  assert.equal(changed.id, main.id);
  assert.equal(nextSlot.componentPropertyReferences.slotContentId, prop);
  assert.deepEqual([changed.width, changed.height, nextSlot.width, nextSlot.height], [85, 8, 18, 8]);
  assert.equal((await run()).results[0].skipped, true);
});
