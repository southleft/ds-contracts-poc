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
    listAvailableFontsAsync: async () => [{fontName: {family: 'Inter', style: 'Medium'}}, {fontName: {family: 'Arimo', style: 'Bold'}}, {fontName: {family: 'Inter', style: 'Medium'}}],
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
  // Every face this Figma can load, once each and sorted, for the React to Figma font preflight.
  assert.deepEqual(cap.figmaFonts, [{family: 'Arimo', style: 'Bold'}, {family: 'Inter', style: 'Medium'}]);
});

test('a missing, unknown or ambiguous set name is refused by name', async () => {
  await assert.rejects(run('', fakeFigma()), /CAPTURE_SET_MISSING/);
  await assert.rejects(run('Chip', fakeFigma()), /CAPTURE_SET_NOT_FOUND: "Chip" matches 0 set\(s\)/);
  const figma = fakeFigma();
  const twice = figma.root.findAllWithCriteria();
  figma.root.findAllWithCriteria = () => [...twice, {type: 'COMPONENT_SET', id: '9:9', name: 'Badge', children: []}];
  await assert.rejects(run('Badge', figma), /CAPTURE_SET_AMBIGUOUS/);
});

// A drawing: an icon instance (built once, from its main component), a hidden plain drawing (skipped), and a refusal.
const at = (x: number, y: number) => [[1, 0, x], [0, 1, y]];
const solid = (r: number, g: number, b: number, opacity?: number) => ({type: 'SOLID', visible: true, color: {r, g, b}, ...(opacity === undefined ? {} : {opacity})});
const node = (type: string, id: string, over: object = {}) => ({type, id, name: id, visible: true, opacity: 1, effects: [], blendMode: 'PASS_THROUGH', fills: [], strokes: [],
  fillGeometry: [], strokeGeometry: [], absoluteTransform: at(0, 0), absoluteBoundingBox: {x: 0, y: 0, width: 20, height: 20}, absoluteRenderBounds: {x: 0, y: 0, width: 20, height: 20}, ...over});
function drawingFigma() {
  const icon = node('COMPONENT', '9:1', {name: 'close', width: 20, height: 20, clipsContent: true, absoluteTransform: at(100, 200),
    children: [node('VECTOR', '9:2', {absoluteTransform: at(102, 203), fills: [solid(1, 0, 0)], fillGeometry: [{data: 'M 0 0 L 4 0 L 4 4 Z', windingRule: 'NONZERO'}],
      strokes: [solid(0, 0, 1, 0.5)], strokeGeometry: [{data: 'M 0 0 L 1 1', windingRule: 'EVENODD'}]})]});
  const instance = (id: string) => node('INSTANCE', id, {getMainComponentAsync: async () => icon, children: [node('VECTOR', id + '-v')]});
  const hidden = node('FRAME', '1:9', {visible: false, children: [node('VECTOR', '1:10', {fills: [solid(0, 0, 0)], fillGeometry: [{data: 'M 0 0', windingRule: 'NONZERO'}]})]});
  const gradient = node('VECTOR', '1:11', {fills: [{type: 'GRADIENT_LINEAR', visible: true}], fillGeometry: [{data: 'M 0 0', windingRule: 'NONZERO'}]});
  const figma = fakeFigma();
  const [set] = figma.root.findAllWithCriteria() as Array<{children: Array<{children: object[]}>}>;
  set!.children[0]!.children.push(instance('1:5'), hidden);
  set!.children[1]!.children.push(instance('1:6'), gradient);
  return figma;
}

test('a drawing is built as SVG from its geometry, once per main component, in the drawing\'s coordinates; what it cannot express is refused by name', async () => {
  const cap = await run('Badge', drawingFigma());
  assert.deepEqual(cap.variants.map((v: {drawings: unknown}) => v.drawings),
    [[{nodeId: '1:5', svg: 'main:9:1'}], [{nodeId: '1:6', svg: 'main:9:1'}, {nodeId: '1:11', svg: 'node:1:11'}]]);
  assert.deepEqual(cap.svgs, [
    {key: 'main:9:1', nodeId: '9:1', name: 'close', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">' +
      '<g transform="matrix(1 0 0 1 2 3)"><path d="M 0 0 L 4 0 L 4 4 Z" fill="#ff0000" fill-rule="nonzero"/>' +
      '<path d="M 0 0 L 1 1" fill="#0000ff" fill-opacity="0.5" fill-rule="evenodd"/></g></svg>'},
    {key: 'node:1:11', nodeId: '1:11', name: '1:11', refused: 'svg-gradient'},
  ]);
});

