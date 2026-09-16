import test from 'node:test';
import assert from 'node:assert/strict';
import { revisionOf } from '../core/contract-provenance.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import { compileObservedContent } from './observed-content.js';
import type { TextFontEvidence } from './text-fonts.js';
import type { NodeSpec } from '../core/emit-figma-script.js';

function fixture() {
  const tree: CapturedNode = { tag: 'button', classes: [], pseudo: {}, nodes: [{ t: 'text', v: 'Observed label' }], style: {
    display: 'inline-flex', 'white-space-collapse': 'collapse', 'font-family': '"CSS alias", sans-serif',
    'font-size': '14px', 'font-weight': '500', 'font-style': 'normal', 'line-height': '20px', color: 'rgb(250, 250, 250)',
    'background-color': 'rgb(23, 23, 23)', 'flex-direction': 'row', 'align-items': 'center', 'justify-content': 'center',
  } };
  const fonts: TextFontEvidence = { version: 1, status: 'observed', treeRevision: revisionOf(tree), problems: [], rows: [{
    path: [], text: 'Observed label', cssFamily: tree.style['font-family'], cssWeight: '500', cssStyle: 'normal',
    fonts: [{ familyName: 'Inter', postScriptName: 'InterVariable', isCustomFont: true, glyphCount: 14 }],
  }] };
  return { tree, fonts };
}

test('shared observed-content compilation carries text, painted font and styles without qualifying reusable output', () => {
  const f = fixture(), before = structuredClone(f), result = compileObservedContent(f.tree, f.fonts);
  assert.equal(result.status, 'compiled-comparison-draft', result.problems.join('\n'));
  assert.equal(result.acceptedContract, null);
  assert.equal(result.nativeQualification, 'unqualified');
  assert.ok(result.limitations.includes('nested-component-identity-not-projected'));
  assert.ok(result.limitations.includes('visual-fidelity-not-verified'));
  assert.deepEqual(result.contract?.props, []);
  const text = result.component?.variants[0].spec.children?.[0];
  assert.equal(text?.characters, 'Observed label');
  assert.equal(text?.fontFamily, 'Inter');
  assert.equal(text?.fontSize, 14);
  assert.equal(text?.fontStyle, 'Medium');
  assert.deepEqual(f, before);
  assert.deepEqual(compileObservedContent(f.tree, f.fonts), result);
});

test('stale or missing glyph evidence cannot become a native comparison draft', () => {
  for (const change of [
    (f: ReturnType<typeof fixture>) => { f.tree.nodes[0] = { t: 'text', v: 'Changed' }; },
    (f: ReturnType<typeof fixture>) => { f.fonts.rows = []; },
    (f: ReturnType<typeof fixture>) => { f.fonts.rows[0].fonts = []; },
    (f: ReturnType<typeof fixture>) => { f.fonts.status = 'refused'; f.fonts.problems = ['missing-font']; },
  ]) {
    const f = fixture(); change(f);
    const result = compileObservedContent(f.tree, f.fonts);
    assert.equal(result.status, 'refused');
    assert.ok(result.problems.length);
    assert.equal(result.component, undefined);
  }
});

test('reconstructed SVG viewports stay refused instead of becoming comparison write input', () => {
  const f = fixture();
  f.tree.style.fill = 'rgb(0, 0, 0)';
  const shape: CapturedNode = { tag: 'path', classes: [], nodes: [], pseudo: {}, style: { display: 'block', d: 'path("M 5 12 H 19")', fill: 'none', stroke: 'rgb(250, 250, 250)', 'stroke-width': '2px' } };
  f.tree.nodes.unshift({ t: 'el', el: { tag: 'svg', classes: [], pseudo: {}, nodes: [{ t: 'el', el: shape }], style: {
    display: 'block', width: '16px', height: '16px', fill: 'none', color: 'rgb(250, 250, 250)', stroke: 'rgb(250, 250, 250)',
  } } });
  f.fonts.treeRevision = revisionOf(f.tree);
  const result = compileObservedContent(f.tree, f.fonts);
  assert.equal(result.status, 'refused');
  assert.ok(result.problems.includes('observed-content-svg-authored-viewport-required'));
  assert.ok(result.receipts.some(r => r.startsWith('svg-viewbox-bumped:')));
  const withViewport = compileObservedContent(f.tree, f.fonts, { version: 1, status: 'observed', treeRevision: revisionOf(f.tree), problems: [], rows: [
    { path: [0], width: '16px', height: '16px', viewport: { viewBox: [0, 0, 24, 24], preserveAspectRatio: 'xMidYMid meet' } },
  ] });
  assert.equal(withViewport.status, 'compiled-comparison-draft', withViewport.problems.join('\n'));
  assert.ok(withViewport.receipts.some(r => r.startsWith('svg-viewbox-observed:')));
  const flatten = (spec: NodeSpec): NodeSpec[] => [spec, ...(spec.children ?? []).flatMap(flatten)];
  const icon = flatten(withViewport.component!.variants[0].spec).find(spec => spec.type === 'svg');
  assert.equal(icon?.type, 'svg');
  assert.match(icon?.svg ?? '', /viewBox="0 0 24 24"/);
  assert.match(icon?.svg ?? '', /stroke="#fafafa"/);
  assert.doesNotMatch(icon?.svg ?? '', /stroke="#000000"/);
  assert.ok(icon?.svgPaintVar?.endsWith('/color'), 'currentColor binds to color, independently of inherited SVG fill');
});
