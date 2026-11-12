import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { classifyDump } from '../extract/figma/grammar.js';

/** Convention negative-sibling-margin-as-gap: every in-flow sibling after the first pulled up by the same negative
 *  margin (rows that overlap their neighbor's 1px border) is the column's negative itemSpacing, so no margin box is
 *  placed and the set stays in auto layout. Off, each such sibling keeps its fixed margin box with the child placed. */
const dump = readFileSync(new URL('../extract/figma/dump.plugin.js', import.meta.url), 'utf8');

async function written(conventions: string[], third = '{m.neg}') {
  const tokens = { primitives: { m: { $type: 'dimension', neg: { $value: '-1px' }, two: { $value: '-2px' } } },
    semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const contract = ContractSchema.parse({
    id: 'test.overlap', name: 'Overlap', version: '0.1.0', status: 'draft', description: 'Rows pulled up over a border',
    states: [], semantics: { element: 'ul' }, props: [],
    anatomy: { root: { layout: { display: 'flex', direction: 'column' }, parts: {
      first: { text: 'First' },
      second: { text: 'Second', tokens: { 'margin-top': '{m.neg}' } },
      third: { text: 'Third', tokens: { 'margin-top': third } },
    } } },
    bindings: { code: { anchors: { importPath: 'test/Overlap', export: 'Overlap' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens, icons: new Map(), conventions: new Set(conventions) }), { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(contract, new Map([[contract.id, contract]])));
  const comp = root.findOne((n: any) => n.type === 'COMPONENT') as any;
  const boxes = root.findAll((n: any) => / \(margin box\)$/.test(n.name)).map((n: any) => n.name);
  const file = await run(dump);
  return { comp, boxes, reasons: Object.values(classifyDump(file)).flatMap((v) => v.reasons).filter((r) => r === 'free-form-frame' || r === 'absolute-child').sort() };
}

test('on: a uniform negative leading margin on every later sibling is the negative itemSpacing', async () => {
  const { comp, boxes, reasons } = await written(['negative-sibling-margin-as-gap']);
  assert.equal(comp.itemSpacing, -1);
  assert.deepEqual(boxes, []);
  assert.deepEqual(reasons, []);
});

test('on: unequal negative margins keep their placed margin boxes', async () => {
  const { comp, boxes, reasons } = await written(['negative-sibling-margin-as-gap'], '{m.two}');
  assert.equal(comp.itemSpacing, 0);
  assert.deepEqual(boxes.sort(), ['second (margin box)', 'third (margin box)']);
  assert.deepEqual(reasons, ['absolute-child', 'free-form-frame']);
});

test('off: each pulled-up sibling keeps its fixed margin box with the child placed', async () => {
  const { comp, boxes, reasons } = await written([]);
  assert.equal(comp.itemSpacing, 0);
  assert.deepEqual(boxes.sort(), ['second (margin box)', 'third (margin box)']);
  assert.deepEqual(reasons, ['absolute-child', 'free-form-frame']);
});
