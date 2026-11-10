import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { projectAffineFilledPath } from './affine-filled-path.js';
import vm from 'node:vm';
import type { DumpSet } from '../extract/figma/types.js';
import { projectNativeGroupPlanes } from './native-group-plane.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { tokenInventoryFromJson } from './tokens.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { mountGenerated } from './react-test-runtime.js';

function capturedSet(root: any, sourceFile = '../extract/figma/dump.plugin.js'): DumpSet {
  const source = readFileSync(new URL(sourceFile, import.meta.url), 'utf8');
  const start = source.indexOf('function filledPathIssue(data)'), end = source.indexOf('const capturedVariables', start);
  const capture = vm.runInNewContext(`${source.slice(start, end)}; dumpShape`, {
    CONSTRAINT_H: { SCALE: 'SCALE' }, CONSTRAINT_V: { SCALE: 'SCALE' },
  });
  const [component, group, glyph] = root.facts;
  const shape = JSON.parse(JSON.stringify(capture(glyph, group)));
  const plane = (n: any) => ({ nodeId: n.id, parentId: n.parentId, containerId: component.id, containerType: 'COMPONENT',
    size: { width: n.width, height: n.height }, containerSize: { width: component.width, height: component.height },
    relativeTransform: n.relativeTransform, absoluteTransform: n.absoluteTransform, containerAbsoluteTransform: component.absoluteTransform,
    ...(n.type === 'VECTOR' ? { constraints: n.constraints } : {}) });
  return { setName: root.name, type: 'COMPONENT', variants: [{ name: root.name, type: 'COMPONENT', bbox: { width: 16, height: 16 },
    children: [{ name: group.name, type: 'GROUP', nativeContainerPlane: plane(group), children: [{ name: glyph.name, type: 'VECTOR',
      nativeContainerPlane: plane(glyph), shape, fill: { hex: '292a2e' } }] }] }] };
}
const nativeReferences = JSON.parse(readFileSync(new URL('../extract/figma/fixtures/native-affine-filled-path/native.json', import.meta.url), 'utf8'));

test('both canonical readers preserve raw affine paths; group projection rejects conflicting witnesses', () => {
  for (const root of nativeReferences.roots) {
    const source = capturedSet(root), before = JSON.stringify(source);
    assert.deepEqual(capturedSet(root, '../figma-sync/plugin/ui.html'), source);
    const glyph = source.variants[0].children![0].children![0];
    assert.deepEqual(glyph.shape!.paths, root.facts[2].vectorPaths);
    assert.deepEqual(glyph.shape!.affineTransform, root.facts[2].relativeTransform);
    const result = projectNativeGroupPlanes(source);
    assert.equal(result.set.variants[0].children![0].children![0].shape!.affineTransform, undefined);
    assert.equal(JSON.stringify(source), before);
    for (const fault of ['matrix', 'absolute', 'owner', 'missing-group', 'missing-shape', 'stroke']) {
      const bad = structuredClone(source), group = bad.variants[0].children![0], child = group.children![0];
      if (fault === 'matrix') child.shape!.affineTransform![0][0] = 2;
      if (fault === 'absolute') (child.nativeContainerPlane!.absoluteTransform as number[][])[0][0] = 2;
      if (fault === 'owner') child.nativeContainerPlane!.parentId = 'unrelated';
      if (fault === 'missing-group') delete group.nativeContainerPlane;
      if (fault === 'missing-shape') delete child.shape;
      if (fault === 'stroke') child.stroke = { hex: 'ff0000' };
      assert.throws(() => projectNativeGroupPlanes(bad), /native-group-plane-unqualified/, fault);
    }
  }
});

test('captured affine paths survive proposal and both React emitters against native pixels', async t => {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch(); t.after(() => browser.close());
  for (const root of nativeReferences.roots) {
    const proposal = proposeFromDump(capturedSet(root), { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }), mintUnbound: true, contractIdByName: new Map() });
    const contract = ContractSchema.parse(proposal.contract);
    const tokens = { primitives: proposal.mintedTokens!.tree, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
    const inventory = tokenInventoryFromJson([tokens.primitives]), values = tokenCorpusFromJson({ ...tokens, brandDefault: {} }), contracts = new Map([[contract.id, contract]]);
    for (const surface of ['module', 'inline']) {
      const output = surface === 'module' ? emitReact(contract, { tokens: inventory, tokenValues: tokens, icons: new Map(), contracts }) : { ...emitReactInline(contract, { tokens, icons: new Map(), contracts }), css: '' };
      const page = await browser.newPage({ viewport: { width: 16, height: 16 }, deviceScaleFactor: 4 });
      try {
        const render = await mountGenerated(page, contract.name, output.tsx, output.css);
        await page.addStyleTag({ content: 'body{margin:0;background:transparent}:root{' + [...inventory].map(path => '--' + path.replaceAll('.', '-') + ':' + values.resolveLiteral(path) + ';').join('') + '}' });
        await render({});
        const box = await page.locator('#root > *').first().boundingBox();
        assert.equal(box?.width, 16); assert.equal(box?.height, 16);
        const actual = PNG.sync.read(await page.screenshot({ omitBackground: true }));
        const expected = PNG.sync.read(readFileSync(new URL('../extract/figma/fixtures/native-affine-filled-path/' + root.screenshot.file, import.meta.url)));
        assert.equal(actual.width, expected.width); assert.equal(actual.height, expected.height);
        for (const bg of [0, 255]) {
          const flatten = (png: PNG) => {
            const data = Buffer.from(png.data);
            for (let i = 0; i < data.length; i += 4) { const a = data[i + 3] / 255; for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * a + bg * (1 - a)); data[i + 3] = 255; }
            return data;
          };
          const percent = pixelmatch(flatten(actual), flatten(expected), undefined, actual.width, actual.height, { threshold: 0.1 }) / (actual.width * actual.height) * 100;
          console.log(JSON.stringify({ surface, name: root.name, bg, percent }));
          assert(percent <= 5, `${surface} ${root.name} ${bg}: ${percent}%`);
        }
      } finally { await page.close(); }
    }
  }
});

const triangle = { width: 4, height: 3, paths: [{ data: 'M0 0L4 0 0 3Z', windingRule: 'NONZERO' as const }], transform: [[0, -1, 7], [-1, 0, 9]] };
test('affine path projection preserves input and maps every control point without flattening curves', () => {
  const before = JSON.stringify(triangle);
  assert.deepEqual(projectAffineFilledPath(triangle), { x: 4, y: 5, width: 3, height: 4, paths: [{ data: 'M 3 4 L 3 0 0 4 Z', windingRule: 'NONZERO' }] });
  assert.equal(JSON.stringify(triangle), before);
  const curve = projectAffineFilledPath({ ...triangle, paths: [{ data: 'M0 0C1 0 2 1 4 3Q2 2 0 0Z', windingRule: 'EVENODD' }], transform: [[2, 1, -5], [0, 3, 7]] });
  assert.equal(curve.paths[0].data, 'M 0 0 C 2 0 5 3 11 9 Q 6 6 0 0 Z');
  assert.equal(curve.paths[0].windingRule, 'EVENODD');
});
test('affine projection refuses malformed, singular and unsupported path evidence', () => {
  for (const patch of [{ width: 0 }, { transform: [[1, 0, 0], [0, 0, 0]] }, { transform: [[NaN, 0, 0], [0, 1, 0]] }, { transform: [[1, 0], [0, 1]] }, { paths: [{ data: 'M0 0A1 1 0 0 0 2 2Z', windingRule: 'NONZERO' }] }])
    assert.throws(() => projectAffineFilledPath({ ...triangle, ...patch } as typeof triangle), /affine-filled-path/);
});
test('projected rotated and reflected chevrons match original native pixels on white and black', async t => {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch(); t.after(() => browser.close());
  const dir = new URL('../extract/figma/fixtures/native-affine-filled-path/', import.meta.url);
  const source = JSON.parse(readFileSync(new URL('native.json', dir), 'utf8'));
  const flatten = (png: PNG, bg: number) => {
    const data = Buffer.from(png.data);
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * alpha + bg * (1 - alpha));
      data[i + 3] = 255;
    }
    return data;
  };
  for (const root of source.roots) {
    const component = root.facts[0], glyph = root.facts.find((n: any) => n.type === 'VECTOR');
    const shape = projectAffineFilledPath({ width: glyph.width, height: glyph.height, paths: glyph.vectorPaths, transform: glyph.relativeTransform });
    const color = glyph.fills[0].color;
    const page = await browser.newPage({ viewport: { width: 16, height: 16 }, deviceScaleFactor: 4 });
    try {
      assert.equal(component.width, 16); assert.equal(component.height, 16);
      await page.setContent(`<style>body{margin:0}</style><svg width="16" height="16" viewBox="0 0 16 16"><g transform="translate(${shape.x} ${shape.y})" fill="rgb(${color.r * 255},${color.g * 255},${color.b * 255})">${shape.paths.map(p => `<path d="${p.data}" fill-rule="${p.windingRule === 'EVENODD' ? 'evenodd' : 'nonzero'}"/>`).join('')}</g></svg>`);
      const actual = PNG.sync.read(await page.screenshot({ omitBackground: true }));
      const expected = PNG.sync.read(readFileSync(new URL(root.screenshot.file, dir)));
      assert.equal(actual.width, expected.width); assert.equal(actual.height, expected.height);
      for (const background of [0, 255]) {
        const differences = pixelmatch(flatten(actual, background), flatten(expected, background), undefined, actual.width, actual.height, { threshold: 0.1 });
        const percent = differences / (actual.width * actual.height) * 100;
        console.log(JSON.stringify({ name: root.name, background, percent }));
        assert(percent <= 5, `${root.name}: native image difference ${percent}%`);
      }
    } finally { await page.close(); }
  }
});
