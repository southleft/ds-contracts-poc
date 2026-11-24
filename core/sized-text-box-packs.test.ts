import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';

/** Convention sized-text-box-packs-by-text-align: a bare text part with a fixed width and no layout of its own is wrapped
 *  in a box at run time; the box packs the line as CSS text-align places it (start → MIN, center → CENTER, right →
 *  MAX), not centered as a drawn chip's glyph is. A part with a layout, or a fill, keeps the old packing. */
async function packs(conventions: string[], given?: Record<string, object>): Promise<{ wraps: Record<string, string>; script: string }> {
  const tokens = { primitives: { s: { $type: 'dimension', w: { $value: '300px' }, c: { $value: '#ffcc00', $type: 'color' } } }, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const text = (extra: object) => ({ tokens: { width: '{s.w}' }, text: 'Item', ...extra });
  const contract = ContractSchema.parse({
    id: 'test.list', name: 'List', version: '0.1.0', status: 'draft', description: 'A list of sized lines',
    states: [], semantics: { element: 'ul' }, props: [],
    anatomy: { root: { layout: { display: 'flex', direction: 'column' }, parts: given ?? {
      start: text({}),
      middle: text({ declared: { 'text-align': 'center' } }),
      end: text({ declared: { 'text-align': 'right' } }),
      chip: text({ tokens: { width: '{s.w}', 'background-color': '{s.c}' } }),
    } } },
    bindings: { code: { anchors: { importPath: 'test/List', export: 'List' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens, icons: new Map(), conventions: new Set(conventions) });
  const { figma, root } = createFigmaMock(), context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context, { timeout: 20000 });
  const script = engine.buildComponentScript(contract, new Map([[contract.id, contract]]));
  await run(engine.buildTokensScript(null)); await run(script);
  const comp = root.findOne((n: any) => n.type === 'COMPONENT') as any;
  const wraps: Record<string, string> = {};
  for (const name of given ? Object.keys(given) : ['start', 'middle', 'end', 'chip']) wraps[name] = comp.findOne((n: any) => n.name === name && n.type === 'FRAME').primaryAxisAlignItems;
  return { wraps, script };
}

test('on: a sized text box with no layout packs its line by text-align; a drawn chip keeps its centered glyph', async () => {
  assert.deepEqual((await packs(['sized-text-box-packs-by-text-align'])).wraps, { start: 'MIN', middle: 'CENTER', end: 'MAX', chip: 'CENTER' });
});

test('off: every sized text box centers its line, and the script carries no packing field', async () => {
  const off = await packs([]);
  assert.deepEqual(off.wraps, { start: 'CENTER', middle: 'CENTER', end: 'CENTER', chip: 'CENTER' });
  assert.equal(off.script.includes('textBoxPack'), false);
});

/** Convention flex-text-box-packs-by-justify: a sized text that is itself a one-line flex row packs its line where
 *  justify-content puts the row's only item; a column, a painted box or the convention off keeps the centered box. */
test('flex-text-box-packs-by-justify: a sized flex-row text packs by justify-content; a column or a fill keeps the centered box', async () => {
  const row = (layout: object, extra: object = {}) => ({ tokens: { width: '{s.w}' }, text: 'Label', layout: { display: 'flex', ...layout }, ...extra });
  const given = { start: row({}), center: row({ justify: 'center' }), end: row({ justify: 'end' }), column: row({ direction: 'column' }),
    chip: row({}, { tokens: { width: '{s.w}', 'background-color': '{s.c}' } }) };
  assert.deepEqual((await packs(['flex-text-box-packs-by-justify'], given)).wraps, { start: 'MIN', center: 'CENTER', end: 'MAX', column: 'CENTER', chip: 'CENTER' });
  const off = await packs([], given);
  assert.deepEqual(off.wraps, { start: 'CENTER', center: 'CENTER', end: 'CENTER', column: 'CENTER', chip: 'CENTER' });
  assert.equal(off.script.includes('textBoxPack'), false);
});
