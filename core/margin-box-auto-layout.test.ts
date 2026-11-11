import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { createFigmaEngine } from './emit-figma-script.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { classifyDump } from '../extract/figma/grammar.js';

/** A child's residual CSS margin is drawn as a "(margin box)" wrapper. With no negative side it is auto layout padded by
 *  the margin, so the dump shows no free-form frame and no placed child (React to Figma's set rule); a negative side
 *  still needs the fixed box and the placed child, so the child overhangs as in CSS. */
const dump = readFileSync(new URL('../extract/figma/dump.plugin.js', import.meta.url), 'utf8');

async function written(glyphTop: number) {
  const tokens = { primitives: { m: { $type: 'dimension', four: { $value: '4px' }, six: { $value: '6px' }, glyph: { $value: `${glyphTop}px` } } },
    semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const contract = ContractSchema.parse({
    id: 'test.margin-box', name: 'MarginBox', version: '0.1.0', status: 'draft', description: 'Residual child margins',
    states: [], semantics: { element: 'div' }, props: [],
    anatomy: { root: { layout: { display: 'flex', direction: 'column' }, parts: {
      label: { text: 'Label', tokens: { 'margin-top': '{m.four}', 'margin-left': '{m.six}' } },
      glyph: { text: 'Glyph', tokens: { 'margin-top': '{m.glyph}' } },
    } } },
    bindings: { code: { anchors: { importPath: 'test/MarginBox', export: 'MarginBox' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens, icons: new Map() }), { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (script: string) => vm.runInContext(`(async()=>{${script}\n})()`, context);
  await run(engine.buildTokensScript(null));
  await run(engine.buildComponentScript(contract, new Map([[contract.id, contract]])));
  const box = (name: string) => root.findOne((n: any) => n.name === `${name} (margin box)`) as any;
  const file = await run(dump);
  return { label: box('label'), glyph: box('glyph'), reasons: Object.values(classifyDump(file)).flatMap((v) => v.reasons) };
}

test('margins of zero or more become the auto-layout padding of a hugging margin box', async () => {
  const { label, glyph, reasons } = await written(0);
  assert.equal(glyph, null, 'an all-zero margin draws no box');
  assert.equal(label.layoutMode, 'HORIZONTAL');
  assert.deepEqual([label.paddingTop, label.paddingRight, label.paddingBottom, label.paddingLeft], [4, 0, 0, 6]);
  assert.deepEqual([label.primaryAxisSizingMode, label.counterAxisSizingMode], ['AUTO', 'AUTO']);
  const [child] = label.children;
  assert.deepEqual([label.width, label.height], [child.width + 6, child.height + 4]);
  assert.deepEqual(reasons.filter((r) => r === 'free-form-frame' || r === 'absolute-child'), []);
});

test('a negative margin keeps the fixed box with the child placed, so the child overhangs', async () => {
  const { label, glyph, reasons } = await written(-2);
  assert.equal(label.layoutMode, 'HORIZONTAL');
  assert.equal(glyph.layoutMode, 'NONE');
  const [child] = glyph.children;
  assert.deepEqual([child.x, child.y, glyph.width, glyph.height], [0, -2, child.width, child.height - 2]);
  assert.deepEqual(reasons.filter((r) => r === 'free-form-frame' || r === 'absolute-child').sort(), ['absolute-child', 'free-form-frame']);
});
