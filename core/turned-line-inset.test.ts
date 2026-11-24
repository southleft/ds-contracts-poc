import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ContractSchema, nativeLineIssue} from '../scripts/contract-schema.js';
import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {emitReact, validateContract} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {mountGenerated} from './react-test-runtime.js';
import {tokenInventoryFromJson} from './tokens.js';
import {mintedTokenCss} from './mint-tokens.js';

const tokens = {primitives: {}, semantic: {}, light: {}, dark: {}, brands: {default: {}}};

test('nativeLineIssue: a vertical fill line keeps any stored alignment and every other refusal', () => {
  const fill = (over: Record<string, unknown> = {}) => ({length: 16, fillHeight: true as const, transform: [[0, -1, 0], [1, 0, 0]] as [[number, number, number], [number, number, number]],
    cap: 'NONE' as const, align: 'CENTER' as const, ...over}) as Parameters<typeof nativeLineIssue>[0];
  for (const align of ['INSIDE', 'OUTSIDE', 'CENTER']) assert.equal(nativeLineIssue(fill({align})), undefined, align);
  assert.equal(nativeLineIssue(fill({align: 'MIDDLE'})), 'native-line-alignment-invalid');
  for (const over of [{cap: 'ROUND'}, {fillWidth: true}, {transform: [[1, 0, 0], [0, 1, 0]]}, {transform: [[0, -1, 2], [1, 0, 0]]}, {transform: [[0, 1, 0], [-1, 0, 0]]}])
    assert.equal(nativeLineIssue(fill(over)), 'native-line-fill-basis-unsupported', JSON.stringify(over));
  // The horizontal fill line is unchanged: it still needs CENTER.
  assert.equal(nativeLineIssue({...fill({align: 'INSIDE', transform: [[1, 0, 0], [0, 1, 0]]}), fillHeight: undefined, fillWidth: true}), 'native-line-fill-basis-unsupported');
});

// A divider turned a quarter turn in a row: 16 px long and inset 16 px in the 48 px row, 12 px long and inset 10 px in the
// 32 px row. Its length differs by Size, which refuses one native line.
const make = (): any => ({setName: 'Divided', type: 'COMPONENT_SET', propertyDefinitions: {Size: {type: 'VARIANT', defaultValue: 'Large', variantOptions: ['Large', 'Small']}},
  variants: [[48, 16, 16], [32, 12, 10]].map(([height, length, top], i) => ({name: 'Size=' + ['Large', 'Small'][i], variantProperties: {Size: ['Large', 'Small'][i]}, type: 'COMPONENT', nodeId: 'p' + i,
    bbox: {width: 60, height}, layout: {mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'FIXED'}, children: [
      {name: 'Body', type: 'FRAME', nodeId: 'a' + i, fixedSize: {width: 30, height}},
      {name: 'Divider', type: 'LINE', nodeId: 'n' + i, stroke: {hex: 'da1e28'}, strokeWeight: 1, strokeAlign: 'INSIDE', shape: {kind: 'line', width: length, height: 0, constraints: {horizontal: 'LEFT', vertical: 'TOP'},
        line: {length, transform: [[-4.371137762859689e-8, -1, 30], [1, -4.371137762859689e-8, top]], cap: 'NONE', align: 'INSIDE', source: {nodeId: 'n' + i, parentId: 'p' + i}}}},
      {name: 'Tail', type: 'FRAME', nodeId: 'b' + i, fixedSize: {width: 30, height}}]}))});
const read = (conventions: string[]) => {
  const p = proposeFromDump(make(), {corpus: tokenCorpusFromJson({...tokens, brandDefault: {}}), mintUnbound: true, contractIdByName: new Map(), conventions});
  return {p, c: ContractSchema.parse(p.contract)};
};

test('profile convention turned-line-inset-in-row: a turned line of varying length is a stretched line inset per variant', async () => {
  const off = read([]);
  assert.equal(off.c.anatomy.root.parts!.Divider.shape, undefined);
  assert(off.p.notes.some(n => n.includes('Divider: native-line-incomplete-or-varying-geometry')), JSON.stringify(off.p.notes));
  const {p, c} = read(['turned-line-inset-in-row']), shape = c.anatomy.root.parts!.Divider.shape;
  assert(shape?.kind === 'line' && shape.line.fillHeight === true && shape.line.align === 'INSIDE', JSON.stringify(shape));
  assert(p.notes.some(n => n.includes('(profile convention turned-line-inset-in-row)')));
  const contracts = new Map([[c.id, c]]), errors: string[] = [];
  validateContract(c, contracts, errors, new Map());
  assert.deepEqual(errors, []);
  // A line stretched over its row is left to the stretched-line conventions.
  const stretched = make();
  for (const v of stretched.variants) { const n = v.children[1]; n.shape.constraints.vertical = 'STRETCH'; }
  assert.equal(ContractSchema.parse(proposeFromDump(stretched, {corpus: tokenCorpusFromJson({...tokens, brandDefault: {}}), mintUnbound: true, contractIdByName: new Map(), conventions: ['turned-line-inset-in-row']}).contract).anatomy.root.parts!.Divider.shape, undefined);
  // The React to Figma writer still refuses a fill line by name, INSIDE as well as CENTER.
  assert.throws(() => createFigmaEngine({tokens: {...tokens, primitives: p.mintedTokens!.tree}, icons: new Map()}).buildComponentScript(c, contracts), /native-vertical-fill-line-unqualified/);
  // Each variant draws its own length at its own inset, painting x in [0, 1] beside the line (Figma's x 30 to 31).
  const tree = p.mintedTokens!.tree, browser = await chromium.launch();
  try {
    for (const inline of [false, true]) {
      const out = inline ? {...emitReactInline(c, {contracts, icons: new Map(), tokens: {...tokens, primitives: tree}}), css: ''}
        : emitReact(c, {contracts, icons: new Map(), tokens: tokenInventoryFromJson([tree])});
      const page = await browser.newPage(), render = await mountGenerated(page, c.name, out.tsx, mintedTokenCss(tree) + out.css);
      for (const [size, top, length] of [['large', 16, 16], ['small', 10, 12]] as const) {
        await render({size});
        assert.deepEqual(await page.evaluate(() => {
          const root = document.querySelector('#root > *')!.getBoundingClientRect(), line = document.querySelector('line')!.getBoundingClientRect();
          return [line.y - root.y, line.height, line.x - root.x];
        }), [top, length, 30.5], JSON.stringify({size, inline}));
      }
    }
  } finally { await browser.close(); }
});
