import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// The script exactly as the plugin runs it: an async body with `figma` in scope.
const source = readFileSync(new URL('./capture.plugin.js', import.meta.url), 'utf8');
const run = (setName: string, figma: unknown) =>
  new Function('figma', 'return (async () => {\n' + source.replace("const CAPTURE_SET = '';", `const CAPTURE_SET = ${JSON.stringify(setName)};`) + '\n})()')(figma);

const text = (family: string, style: string, weight: number, visible = true) =>
  ({type: 'TEXT', name: 't', visible, getStyledTextSegments: () => [{fontName: {family, style}, fontWeight: weight}]});
const variant = (id: string, name: string, layout: object, render: object, children: object[]) => ({
  type: 'COMPONENT', id, name, absoluteBoundingBox: layout, absoluteRenderBounds: render, children,
  exportAsync: async (o: {useAbsoluteBounds?: boolean}) => new TextEncoder().encode(`${id}:${o.useAbsoluteBounds ? 'box' : 'paint'}`),
});
function fakeFigma() {
  const set = {type: 'COMPONENT_SET', id: '1:1', name: 'Badge', children: [] as object[]};
  set.children = [
    variant('1:2', 'Tone=a', {x: 0, y: 0, width: 48, height: 17}, {x: 0, y: 0, width: 48, height: 17}, [text('Inter', 'Medium', 500)]),
    variant('1:3', 'Tone=b', {x: 60.5, y: 0, width: 48, height: 17}, {x: 59.5, y: -1, width: 50, height: 19},
      [text('Inter', 'Medium', 500), text('Circular20', 'Book', 450, false)]),
  ].map(v => ({...v, parent: set}));
  const nested = {...(set.children[0] as object), name: 'Badge', parent: set};
  return {
    fileKey: 'draft', loadAllPagesAsync: async () => {}, base64Encode: (b: Uint8Array) => Buffer.from(b).toString('base64'),
    listAvailableFontsAsync: async () => [{fontName: {family: 'Inter', style: 'Medium'}}],
    root: {findAllWithCriteria: () => [set, nested]},
  };
}
const decode = (b64: string) => Buffer.from(b64, 'base64').toString();

test('each variant gets its layout-box PNG, a painted-extent PNG only when paint reaches past the box, and the fonts it draws', async () => {
  const cap = await run('Badge', fakeFigma());
  assert.deepEqual([cap.kind, cap.version], ['ds-contracts-plugin-capture', 2]);
  assert.deepEqual([cap.set, cap.nodeId, cap.fileKey], ['Badge', '1:1', 'draft']);
  const [a, b] = cap.variants;
  assert.deepEqual([a.box.wholePixel, decode(a.box.png), a.paint], [true, '1:2:box', undefined]);
  assert.deepEqual([b.box.wholePixel, decode(b.box.png)], [false, '1:3:box']);
  assert.deepEqual([b.paint.offset, decode(b.paint.png)], [{x: -1, y: -1}, '1:3:paint']);
  // Both boxes are read again after the exports, for the check's moved-during-export refusal.
  assert.deepEqual(b.after, {layout: b.box.bounds, render: b.paint.bounds});
  // Hidden text is listed too (a true/false property can show it), sorted by family.
  assert.deepEqual(cap.fonts, [
    {family: 'Circular20', style: 'Book', weight: 450, available: false},
    {family: 'Inter', style: 'Medium', weight: 500, available: true},
  ]);
});

test('a missing, unknown or ambiguous set name is refused by name', async () => {
  await assert.rejects(run('', fakeFigma()), /CAPTURE_SET_MISSING/);
  await assert.rejects(run('Chip', fakeFigma()), /CAPTURE_SET_NOT_FOUND: "Chip" matches 0 set\(s\)/);
  const figma = fakeFigma();
  const twice = figma.root.findAllWithCriteria();
  figma.root.findAllWithCriteria = () => [...twice, {type: 'COMPONENT_SET', id: '9:9', name: 'Badge', children: []}];
  await assert.rejects(run('Badge', figma), /CAPTURE_SET_AMBIGUOUS/);
});
