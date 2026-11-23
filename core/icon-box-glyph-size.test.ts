import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';

/** Profile convention icon-box-keeps-glyph-size: an icon part whose box is larger than its glyph (a wrapper element
 *  folded into its icon part, pinned on all four sides) is a box: the glyph keeps its own size, laid out as the part
 *  declares, instead of being stretched to the box. Off, or with a box the glyph's own size, the part stays a bare svg. */
const icons = new Map([['chev', '<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 6 8 11 13 6"/></svg>']]);

async function written(box: number, conventions = new Set(['icon-box-keeps-glyph-size'])) {
  const px = (n: number) => ({ $value: `${n}px` }), v = (40 - box) / 2; // a 120×40 root; the box pinned 8px from its right
  const tokens = { primitives: { s: { $type: 'dimension', box: px(box), row: px(40), wide: px(120), top: px(v), right: px(8), bottom: px(v), left: px(112 - box) } },
    semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const contract = ContractSchema.parse({
    id: 'test.icon-box', name: 'IconBox', version: '0.1.0', status: 'draft', description: 'A glyph inside a pinned box',
    states: [], semantics: { element: 'div' }, props: [],
    anatomy: { root: { layout: { display: 'flex' }, tokens: { width: '{s.wide}', height: '{s.row}' }, parts: {
      menu: { icon: { asset: 'chev', size: 16 }, declared: { position: 'absolute' }, layout: { display: 'flex', align: 'center', justify: 'center' },
        tokens: { width: '{s.box}', height: '{s.box}', top: '{s.top}', right: '{s.right}', bottom: '{s.bottom}', left: '{s.left}' } },
    } } },
    bindings: { code: { anchors: { importPath: 'test/IconBox', export: 'IconBox' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens, icons, conventions }), byId = new Map([[contract.id, contract]]);
  const spec = (engine.compileComponentData(contract, byId) as any).variants[0].spec.children.find((c: any) => c.name === 'menu');
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(contract, byId));
  return { spec, node: root.findOne((n: any) => n.name === 'menu') as any };
}

test('an icon part whose box is larger than its glyph draws the glyph at its own size inside the box', async () => {
  const { spec, node } = await written(24);
  assert.equal(spec.type, 'frame');
  assert.equal(spec.insetOverlay, true);
  assert.deepEqual([spec.layout.primary, spec.layout.counter], ['CENTER', 'CENTER']);
  assert.deepEqual(spec.children.map((c: any) => [c.type, c.iconSize]), [['svg', 16]]);
  assert.deepEqual([node.width, node.height, node.layoutPositioning, node.layoutMode], [24, 24, 'ABSOLUTE', 'HORIZONTAL']);
  assert.deepEqual(node.children.map((c: any) => [c.name, c.width, c.height]), [['menu-icon', 16, 16]]);
});

test('an icon part whose box is its glyph, or any icon part with the convention off, stays a bare svg', async () => {
  for (const [box, conventions, size] of [[16, undefined, 16], [24, new Set<string>(), 24]] as const) {
    const { spec, node } = await written(box, conventions);
    assert.deepEqual([spec.type, spec.iconSize, spec.insetOverlay], ['svg', 16, true]);
    assert.deepEqual([node.type, node.width, node.height, node.layoutPositioning], ['FRAME', size, size, 'ABSOLUTE']);
  }
});

/** Profile convention bare-icon-keeps-its-margins: a bare glyph keeps its declared margins in flow (none negative). */
async function marginIcon(conventions: Set<string>) {
  const px = (n: number) => ({ $value: `${n}px` });
  const tokens = { primitives: { s: { $type: 'dimension', glyph: px(16), ten: px(10), eight: px(8), wide: px(128), row: px(28) } },
    semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const contract = ContractSchema.parse({
    id: 'test.step', name: 'Step', version: '0.1.0', status: 'draft', description: 'A glyph beside its label',
    states: [], semantics: { element: 'button' }, props: [],
    anatomy: { root: { layout: { display: 'flex' }, tokens: { width: '{s.wide}', height: '{s.row}' }, parts: {
      glyph: { icon: { asset: 'chev', size: 16 }, tokens: { width: '{s.glyph}', height: '{s.glyph}', 'margin-top': '{s.ten}', 'margin-right': '{s.eight}' } },
      label: { text: 'First step' },
    } } },
    bindings: { code: { anchors: { importPath: 'test/Step', export: 'Step' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens, icons, conventions }), byId = new Map([[contract.id, contract]]);
  const spec = (engine.compileComponentData(contract, byId) as any).variants[0].spec;
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(contract, byId));
  const node = root.findOne((n: any) => n.name === 'glyph') as any;
  return { spec, node, box: node.parent, row: node.parent.name === 'glyph (margin box)' ? node.parent.parent : node.parent };
}

test('bare-icon-keeps-its-margins on: the gap is the row\'s spacing, the top margin a hugging margin box\'s padding', async () => {
  const { spec, box, row } = await marginIcon(new Set(['bare-icon-keeps-its-margins']));
  assert.deepEqual(spec.children.map((c: any) => [c.name, c.type, c.margins]), [['glyph', 'svg', { top: 10 }], ['label', 'text', undefined]]);
  assert.equal(spec.lits?.itemSpacing ?? spec.bindings?.itemSpacing, 's/eight');
  assert.deepEqual([box.name, box.layoutMode, box.primaryAxisSizingMode, box.counterAxisSizingMode, box.paddingTop, box.paddingLeft],
    ['glyph (margin box)', 'HORIZONTAL', 'AUTO', 'AUTO', 10, 0]);
  assert.deepEqual(row.children.map((c: any) => c.name), ['glyph (margin box)', 'label']);
});

test('bare-icon-keeps-its-margins off: the bare glyph draws with no margins, as before', async () => {
  const { spec, box } = await marginIcon(new Set());
  assert.deepEqual(spec.children.map((c: any) => [c.name, c.margins]), [['glyph', undefined], ['label', undefined]]);
  assert.equal(spec.lits?.itemSpacing ?? spec.bindings?.itemSpacing, undefined);
  assert.notEqual(box.name, 'glyph (margin box)');
});
