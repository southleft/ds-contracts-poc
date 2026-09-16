import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { nativeComparisonFixture } from '../core/native-contract-comparison-test-fixture.js';
import { revisionOf } from '../core/contract-provenance.js';
import { readReactSourceProgram } from './react-source-program.js';
import { compileObservedContent } from './observed-content.js';
import { matchReactComposition, type ReactCompositionMain } from './react-composition.js';
import type { ReactOwnership } from './react-ownership.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import type { TextFontEvidence } from './text-fonts.js';
import { isReactComparisonRequest, reactComparisonReservation } from './react-comparison-request.js';
import type { ReactNativeRequest } from './react-native-request.js';

async function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), 'react-composition-'));
  try {
    writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'preserve', strict: true, target: 'ES2022', skipLibCheck: true } }));
    writeFileSync(path.join(dir, 'components.tsx'), `
declare global { namespace JSX { interface Element {} interface IntrinsicElements { section: any; button: any } } }
export function Box(props: {children?: string}) { return <section {...props}/> }
export function Child(props: {children?: string; id?: string}) { return <button {...props}/> }
`);
    const program = readReactSourceProgram(dir, ['components.tsx']);
    assert.deepEqual(program.problems, []);
    const source = (name: string) => {
      const c = program.components.find(c => c.exportName === name)!;
      return { module: c.module, exportName: c.exportName, sourceSha256: c.sourceSha256, span: c.span };
    };
    const child: CapturedNode = { tag: 'button', classes: [], pseudo: {}, nodes: [{ t: 'text', v: 'Save' }], style: {
      display: 'inline-flex', 'flex-direction': 'row', 'background-color': 'rgb(18, 52, 86)', color: 'rgb(250, 250, 250)',
      'font-family': 'Inter', 'font-size': '14px', 'font-weight': '400', 'font-style': 'normal', 'line-height': '20px',
      'white-space-collapse': 'collapse',
    } };
    child.nodes = [{ t: 'el', el: { tag: 'span', classes: [], pseudo: {}, style: { ...child.style, display: 'inline' }, nodes: child.nodes } }];
    const tree: CapturedNode = { tag: 'section', classes: [], pseudo: {}, nodes: [{ t: 'el', el: child }],
      style: { display: 'flex', 'flex-direction': 'column' } };
    const ownership: ReactOwnership = { version: 1, rendererVersions: ['19.2.7'], problems: [], components: [
      { id: 'box', source: source('Box'), props: { children: { kind: 'object' } }, roots: [''] },
      { id: 'child', parent: 'box', source: source('Child'), props: { children: 'Save', id: 'save' }, roots: ['0'] },
    ], nodes: [{ path: '', tag: 'section', nearestComponent: 'box', createdBy: 'box' },
      { path: '0', tag: 'button', nearestComponent: 'child', createdBy: 'child' },
      { path: '0.0', tag: 'span', nearestComponent: 'child' }] };
    const fonts: TextFontEvidence = { version: 1, status: 'observed', treeRevision: revisionOf(tree), problems: [], rows: [
      { path: [0, 0], text: 'Save', cssFamily: 'Inter', cssWeight: '400', cssStyle: 'normal',
        fonts: [{ familyName: 'Inter', postScriptName: 'Inter-Regular', isCustomFont: true, glyphCount: 4 }] },
    ] };
    const content = compileObservedContent(tree, fonts, undefined, true);
    assert.equal(content.status, 'compiled-comparison-draft', content.problems.join(','));
    const native = await nativeComparisonFixture();
    const main: ReactCompositionMain = { source: source('Child'), contract: native.main, heldProps: { id: 'save' },
      styles: { Main: [child.style] }, input: native.comparison.parent, receipt: native.comparison.receipt };
    return { dir, program, tree, ownership, fonts, content, main };
  } catch (error) { rmSync(dir, { recursive: true, force: true }); throw error; }
}

test('source export and compiler correspondence select an independently observed child main', async () => {
  const f = await fixture();
  try {
    const legacy = compileObservedContent(f.tree, f.fonts);
    const { sourcePaths, ...unchanged } = f.content;
    assert.deepEqual(unchanged, legacy, 'opt-in correspondence must preserve historical compiler output');
    const result = matchReactComposition(f.program, f.ownership, f.tree, f.content, [f.main]);
    assert.equal(result.review.status, 'ready', JSON.stringify(result.review));
    assert.equal(result.review.denominator, 1);
    assert.equal(result.review.matched, 1);
    assert.equal(result.review.acceptedContract, null);
    assert.deepEqual(result.references[0].specPath, sourcePaths!.find(p => p.sourcePath === '0')!.specPath);
    assert.equal(result.references[0].parent.operation.id, f.main.input.operation.id);
    assert.deepEqual(result.references[0].slotSpecPath, [0]);
    assert.deepEqual(matchReactComposition(f.program, f.ownership, f.tree, f.content, [f.main]), result);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('unresolved children remain in coverage and cannot become a flattened successful comparison', async () => {
  const f = await fixture();
  try {
    const changes: Array<[string, (x: typeof f, mains: ReactCompositionMain[]) => void]> = [
      ['main-not-verified', (_x, mains) => { mains.length = 0; }],
      ['main-ambiguous', (_x, mains) => { mains.push(structuredClone(mains[0])); }],
      ['main-not-verified', (_x, mains) => { mains[0].source.sourceSha256 = 'f'.repeat(64); }],
      ['held-inputs-differ', (_x, mains) => { mains[0].heldProps.id = 'different'; }],
      ['observed-root-context-differs', (_x, mains) => { mains[0].styles.Main[0].color = 'rgb(0, 0, 0)'; }],
      ['main-readback-invalid', (_x, mains) => { mains[0].receipt.nodes = []; }],
      ['compiler-path-unavailable', (x) => { x.content.sourcePaths = []; }],
      ['runtime-or-multiple-root-unqualified', (x) => { delete x.ownership.nodes[1].createdBy; }],
    ];
    for (const [reason, change] of changes) {
      const copy = structuredClone(f), mains = [structuredClone(f.main)]; change(copy, mains);
      const result = matchReactComposition(copy.program, copy.ownership, copy.tree, copy.content, mains);
      assert.equal(result.review.status, 'incomplete', reason);
      assert.equal(result.review.denominator, 1, reason);
      assert.equal(result.review.matched, 0, reason);
      assert.equal(result.references.length, 0, reason);
      assert.ok(result.review.rows[0].problems.some(p => p.endsWith(reason)), JSON.stringify(result.review));
    }
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('composition request pins its revision while preserving v1 reservations and rejecting injected mappings', () => {
  const root: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId: 'a'.repeat(64),
    ownership: { id: '10000000-0000-4000-8000-000000000001', sha256: 'b'.repeat(64) },
    inventorySha256: 'c'.repeat(64), caseId: 'button-default', matrixRevision: revisionOf('matrix') };
  const legacy = { version: 1 as const, kind: 'react-content-comparison' as const,
    root, parentOperationId: '10000000-0000-4000-8000-000000000002',
    content: { id: '10000000-0000-4000-8000-000000000003', reportSha256: 'd'.repeat(64), inventorySha256: 'e'.repeat(64) } };
  assert.equal(isReactComparisonRequest(legacy), true);
  const selected = { ...legacy, version: 2 as const, composition: { revision: revisionOf('mapping') } };
  assert.equal(isReactComparisonRequest(selected), true);
  assert.notEqual(reactComparisonReservation(selected), reactComparisonReservation(legacy));
  assert.notEqual(reactComparisonReservation({ ...selected, composition: { revision: revisionOf('changed') } }), reactComparisonReservation(selected));
  for (const invalid of [{ ...selected, composition: {} }, { ...selected, composition: { revision: 'unsealed' } },
    { ...selected, composition: { ...selected.composition, nodeId: '1:2' } }, { ...selected, references: [] },
    { ...legacy, composition: selected.composition }, { ...selected, version: 3 }]) assert.equal(isReactComparisonRequest(invalid), false);
});

test('lost text-only boundaries and invalid ownership keep the child unresolved', async () => {
  const f = await fixture();
  try {
    const changedOwnership = structuredClone(f.ownership);
    changedOwnership.components[1].source.sourceSha256 = 'f'.repeat(64);
    const invalid = matchReactComposition(f.program, changedOwnership, f.tree, f.content, [f.main]);
    assert.equal(invalid.review.status, 'incomplete');
    assert.equal(invalid.review.denominator, 1);
    assert.equal(invalid.review.rows.length, 1);
    assert.equal(invalid.references.length, 0);
    const tree = structuredClone(f.tree);
    if (tree.nodes[0].t !== 'el') throw Error('fixture child missing');
    tree.nodes[0].el.nodes = [{ t: 'text', v: 'Save' }];
    const fonts = structuredClone(f.fonts); fonts.treeRevision = revisionOf(tree); fonts.rows[0].path = [0];
    const ownership = structuredClone(f.ownership); ownership.nodes.pop();
    const content = compileObservedContent(tree, fonts, undefined, true);
    assert.equal(content.status, 'compiled-comparison-draft');
    assert.equal(content.sourcePaths!.find(p => p.sourcePath === '0')!.type, 'text');
    const result = matchReactComposition(f.program, ownership, tree, content, [f.main]);
    assert.equal(result.review.status, 'incomplete');
    assert.equal(result.review.denominator, 1);
    assert.deepEqual(result.review.rows[0].problems, ['react-composition-compiler-path-unavailable']);
    assert.equal(result.references.length, 0);
    const preserved = compileObservedContent(tree, fonts, undefined, true, ['0']);
    assert.equal(preserved.status, 'compiled-comparison-draft', preserved.problems.join(','));
    const path = preserved.sourcePaths!.find(p => p.sourcePath === '0')!;
    assert.equal(path.type, 'frame');
    let spec = preserved.component!.variants[0].spec;
    for (const index of path.specPath) spec = spec.children![index];
    assert.equal(spec.children?.[0].characters, 'Save');
    assert.equal(spec.children?.[0].fontFamily, 'Inter');
    assert.equal(spec.children?.[0].fontSize, 14);
    assert.ok(spec.fill, 'the source box keeps its background');
    const matched = matchReactComposition(f.program, ownership, tree, preserved, [f.main]);
    assert.equal(matched.review.status, 'ready', JSON.stringify(matched.review));
    assert.equal(matched.review.matched, 1);
    assert.deepEqual(matched.references[0].specPath, path.specPath);
    const translucent = structuredClone(tree);
    if (translucent.nodes[0].t !== 'el') throw Error('missing child');
    translucent.nodes[0].el.style.opacity = '0.5';
    const translucentContent = compileObservedContent(translucent, { ...fonts, treeRevision: revisionOf(translucent) }, undefined, true, ['0']);
    assert.equal(translucentContent.status, 'compiled-comparison-draft');
    let translucentSpec = translucentContent.component!.variants[0].spec;
    for (const index of path.specPath) translucentSpec = translucentSpec.children![index];
    assert.equal(translucentSpec.opacity, 0.5);
    assert.ok(translucentSpec.children![0].opacity === undefined || translucentSpec.children![0].opacity === 1,
      'anonymous text must not multiply its parent opacity');
    assert.equal(translucentSpec.children![0].fill, undefined, 'box paint must not be repeated on the text');
    const unsupported = structuredClone(tree);
    if (unsupported.nodes[0].t !== 'el') throw Error('missing child');
    unsupported.nodes[0].el.style.display = 'block';
    const blockFonts = { ...fonts, treeRevision: revisionOf(unsupported) };
    const block = compileObservedContent(unsupported, blockFonts, undefined, true, ['0']);
    assert.equal(block.status, 'refused');
    assert.ok(block.problems.some(p => p.startsWith('ordered-text-flow-unqualified')));
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
