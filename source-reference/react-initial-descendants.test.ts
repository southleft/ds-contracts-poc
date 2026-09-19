import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { readReactSourceProgram } from './react-source-program.js';
import { planReactInitialStates } from './react-initial-state.js';
import { compileReactInitialContract } from './react-initial-contract.js';
import type { ReactOwnership } from './react-ownership.js';
import type { CapturedNode } from '../extract/computed/lib.js';
import { revisionOf } from '../core/contract-provenance.js';
import { evidenceSha } from './react-validation-evidence.js';
import { validateContract } from '../packages/core/src/validate.js';

// A track with one part below it: the part is sized by the component's own rule
// under an ancestor condition, and moves to the far end in one state.
const refusal = 'react-initial-contract-descendant-translate-unqualified:';
type Snapshots = Parameters<typeof compileReactInitialContract>[4];
type Size = NonNullable<NonNullable<Snapshots[string]['descendantSizes']>['nodes'][number]['sizes'][number]>;
const fixed = (channel: 'width' | 'height', value: string): Size => ({ channel, status: 'fixed', value, authoredValue: value, selectors: ['.group[data-size=default] .part'] });

function domain(t: { after(fn: () => void): void }, exportName: 'Track' | 'Required') {
  mkdirSync('private', { recursive: true });
  const dir = mkdtempSync(path.resolve('private/react-initial-descendants-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: true, jsx: 'react-jsx', moduleResolution: 'Bundler', module: 'ESNext' } }));
  writeFileSync(path.join(dir, 'track.tsx'), `import React from 'react';
    export function Track({on}:{on?:boolean}) { return <button className="group" data-on={on}><span className="part" /></button> }
    export function Required({on}:{on:boolean}) { return <button className="group" data-on={on}><span className="part" /></button> }`);
  const program = readReactSourceProgram(dir, ['track.tsx']); assert.deepEqual(program.problems, []);
  const source = program.components.find(c => c.exportName === exportName)!;
  const ownership: ReactOwnership = { version: 1, rendererVersions: ['19.2.4'], problems: [], components: [{ id: 'instance-0',
    source: { module: source.module, exportName: source.exportName, sourceSha256: source.sourceSha256, span: source.span },
    props: { on: false }, roots: [''] }], nodes: [{ path: '', tag: 'button', nearestComponent: 'instance-0', createdBy: 'instance-0' },
      { path: '0', tag: 'span', nearestComponent: 'instance-0', createdBy: 'instance-0' }] };
  const part = (translate: string): CapturedNode => ({ tag: 'span', classes: ['part'], pseudo: {}, nodes: [], style: { display: 'block', position: 'static',
    width: '16px', height: '16px', 'box-sizing': 'border-box', 'margin-left': '0px', 'margin-right': '0px', 'margin-top': '0px', 'margin-bottom': '0px',
    translate, transform: 'none', rotate: 'none', scale: 'none', 'background-color': 'rgb(255, 255, 255)' } });
  // 32 wide, 1px border each side: a 30px content box holds the 16px part with 14px to spare.
  const track = (translate: string): CapturedNode => ({ tag: 'button', classes: ['group'], pseudo: {}, nodes: [{ t: 'el', el: part(translate) }],
    style: { display: 'flex', 'flex-direction': 'row', 'flex-wrap': 'nowrap', 'align-items': 'center', 'justify-content': 'normal', direction: 'ltr', 'writing-mode': 'horizontal-tb',
      width: '32px', height: '18.3906px', 'box-sizing': 'border-box', 'padding-left': '0px', 'padding-right': '0px', 'padding-top': '0px', 'padding-bottom': '0px',
      'border-left-width': '1px', 'border-right-width': '1px', 'border-top-width': '1px', 'border-bottom-width': '1px', 'background-color': 'rgb(229, 229, 229)' } });
  const tree = track('0px');
  const { plan, ...facts } = planReactInitialStates(program, ownership, tree, 'instance-0');
  const build = (edit: (snapshot: Snapshots[string], on: boolean, id: string) => void = () => {}, evidence = true) => {
    const snapshots: Snapshots = {};
    const rows = plan.map((entry, i) => {
      const id = String(i), own = structuredClone(ownership), value = entry.changes.on, on = value.kind === 'set' && value.value === true;
      if (value.kind === 'omit') delete own.components[0].props.on; else own.components[0].props.on = value.value;
      const snapshot: Snapshots[string] = { tree: track(on ? 'calc(100% - 2px)' : '0px'), treeSha256: '', image: evidenceSha('fixture-image-' + id), ownership: own,
        styleOrigin: { version: 1, roots: [{ path: '', tag: 'button', channels: [], sizes: [fixed('width', '32px'), { ...fixed('height', '18.3906px'), authoredValue: '18.4px' }] }] },
        ...(evidence ? { descendantSizes: { version: 1 as const, nodes: [{ path: '0', tag: 'span', sizes: [fixed('width', '16px'), fixed('height', '16px')] }] } } : {}),
        fonts: { version: 1, status: 'observed', treeRevision: '', problems: [], rows: [] }, svg: { version: 1, status: 'observed', treeRevision: '', problems: [], rows: [] } };
      edit(snapshot, on, id);
      snapshot.treeSha256 = evidenceSha(JSON.stringify(snapshot.tree)); snapshot.fonts.treeRevision = snapshot.svg.treeRevision = revisionOf(snapshot.tree);
      snapshots[id] = snapshot;
      return { id, ...entry, status: 'observed' as const, restored: true, image: snapshot.image, treeSha256: snapshot.treeSha256 };
    });
    return compileReactInitialContract(program, ownership, tree, { version: 1 as const, qualification: 'finite-initial-mounts-only' as const, acceptedContract: null,
      instanceId: 'instance-0', ...facts, planned: plan.length, problems: [], rows }, snapshots);
  };
  const child = (s: Snapshots[string]) => (s.tree.nodes[0] as { el: CapturedNode }).el;
  return { build, child, plan };
}

test('a part below the root keeps its own fixed size, and a translation by exactly the free space is END alignment in those planes', t => {
  const { build, child, plan } = domain(t, 'Track');
  assert.equal(plan.length, 3, 'omitted, false and true');
  const result = build(); assert.equal(result.status, 'compiled-draft', result.problems.join('\n'));
  for (const variant of result.compiled!.component!.variants) {
    const part = variant.spec.children![0];
    assert.deepEqual([part.fixedWidth?.px, part.fixedHeight?.px], [16, 16], 'the own declared size reaches the native part');
    assert.equal(variant.spec.layout?.primary, variant.name === 'on=true' ? 'MAX' : 'MIN', variant.name);
    assert.ok(!JSON.stringify(variant.spec).includes('14'), 'no offset is minted: the alignment is the fact');
  }
  const root = result.compiled!.contract!.anatomy.root;
  assert.equal(root.layout?.justify, 'start'); assert.deepEqual(root.layoutByProp, { prop: 'on', map: { true: { justify: 'end' } } });
  assert.deepEqual(result.descendants!.alignments, [{ path: '0', axis: 'x', planes: { unset: 'start', false: 'start', true: 'end' } }]);
  assert.deepEqual(result.descendants!.sizes[0], { observation: '0', path: '0', channels: ['height', 'width'] });
  assert.deepEqual(build(), result, 'deterministic');

  // A column track moves along Y; the same rule, the other axis.
  const column = build((s, on) => { Object.assign(s.tree.style, { 'flex-direction': 'column', width: '18.3906px', height: '32px' });
    s.styleOrigin.roots[0].sizes = [fixed('width', '18.3906px'), fixed('height', '32px')]; if (on) child(s).style.translate = '0px calc(100% - 2px)'; });
  assert.equal(column.status, 'compiled-draft', column.problems.join('\n'));
  assert.deepEqual(column.descendants!.alignments[0].axis, 'y');
  // The legacy spelling is the same translation: Chromium computes translateX(14px) to this matrix.
  const matrix = build((s, on) => { child(s).style.translate = 'none'; if (on) child(s).style.transform = 'matrix(1, 0, 0, 1, 14, 0)'; });
  assert.equal(matrix.status, 'compiled-draft', matrix.problems.join('\n'));
  assert.equal(matrix.compiled!.component!.variants.find(v => v.name === 'on=true')!.spec.layout?.primary, 'MAX');

  // Sizes: only an OWN, USED, FIXED declaration is carried. Everything else stays unsized and unminted.
  const still = (edit: (s: Snapshots[string]) => void, evidence = true) => build((s, _on, _id) => { child(s).style.translate = 'none'; edit(s); }, evidence);
  for (const [name, edit] of [
    ['outer selector', (s: Snapshots[string]) => { s.descendantSizes!.nodes[0].sizes = (['width', 'height'] as const).map(channel => ({ channel, status: 'unresolved', authoredValue: '16px', selectors: ['#w > *'], reason: 'size-declared-by-outer-selector' })); }],
    ['percentage', (s: Snapshots[string]) => { s.descendantSizes!.nodes[0].sizes = (['width', 'height'] as const).map(channel => ({ channel, status: 'unresolved', authoredValue: '50%', selectors: ['.part'], reason: 'responsive-or-unsupported-size-expression' })); }],
    ['measured automatic box', (s: Snapshots[string]) => { s.descendantSizes!.nodes[0].sizes = (['width', 'height'] as const).map(channel => ({ channel, status: 'auto', value: 'auto', selectors: [] })); }],
    ['a declaration the box does not use', (s: Snapshots[string]) => { s.descendantSizes!.nodes[0].sizes = [fixed('width', '20px'), fixed('height', '20px')]; }],
  ] as const) {
    const unsized = still(edit); assert.equal(unsized.status, 'compiled-draft', name + ': ' + unsized.problems.join('\n'));
    for (const variant of unsized.compiled!.component!.variants)
      assert.deepEqual([variant.spec.children![0].fixedWidth, variant.spec.children![0].fixedHeight], [undefined, undefined], name);
  }
  const archived = still(() => {}, false);
  assert.equal(archived.status, 'compiled-draft'); assert.equal(archived.descendants, undefined, 'an archive older than the reader derives exactly as before');
  assert.equal(archived.compiled!.component!.variants[0].spec.children![0].fixedWidth, undefined);
  const lettered = still(s => { child(s).nodes = [{ t: 'text', v: 'On' }];
    Object.assign(child(s).style, { 'font-family': 'Inter', 'font-weight': '400', 'font-style': 'normal', 'font-size': '12px', 'line-height': '16px', color: 'rgb(0, 0, 0)' });
    s.fonts.rows = [{ path: [0], text: 'On', cssFamily: 'Inter', cssWeight: '400', cssStyle: 'normal', fonts: [{ familyName: 'Inter', postScriptName: 'Inter-Regular', isCustomFont: true, glyphCount: 2 }] }]; });
  assert.equal(lettered.status, 'compiled-draft', lettered.problems.join('\n'));
  assert.equal(lettered.descendants, undefined, 'a text box keeps its own font-dependent sizing path');
  assert.ok(still((s) => { if (s.ownership.components[0].props.on === true) s.descendantSizes!.nodes[0].sizes = []; }).problems.includes('observed-content-part-sizing-mixed:width'), 'own in some planes only');
  const census = still(s => { s.ownership.nodes.push({ path: '1', tag: 'title', nearestComponent: 'instance-0', createdBy: 'instance-0' }); });
  assert.deepEqual([census.status, census.descendants, census.limitations.at(-1)], ['compiled-draft', undefined, 'descendant-sizes-not-joined:census-differs-from-captured-tree'],
    'child indices join the captured tree only under a matching census; otherwise nothing is sized, by name');
  assert.ok(still(s => { s.descendantSizes!.nodes[0].tag = 'div'; }).problems.includes('react-initial-contract-descendant-evidence-mismatch'));
  assert.ok(still(s => { s.descendantSizes!.nodes = []; }).problems.includes('react-initial-contract-descendant-evidence-mismatch'));

  // Translation: every other form refuses by name. Nothing is approximated.
  const sibling = (): { t: 'el'; el: CapturedNode } => ({ t: 'el', el: { tag: 'i', classes: [], pseudo: {}, nodes: [], style: { display: 'block', position: 'static', width: '2px', height: '2px' } } });
  for (const [reason, edit, evidence] of [
    ['partial-free-space', (s: Snapshots[string], on: boolean) => { if (on) child(s).style.translate = '10px'; }],
    ['partial-free-space', (s: Snapshots[string], on: boolean) => { if (on) child(s).style.translate = '-14px'; }],
    ['partial-free-space', (s: Snapshots[string]) => { s.tree.style['padding-right'] = '1px'; }],
    ['cross-axis-translation', (s: Snapshots[string], on: boolean) => { if (on) child(s).style.translate = 'calc(100% - 2px) 1px'; }],
    ['rotation-or-scale-present', (s: Snapshots[string], on: boolean) => { if (on) child(s).style.rotate = '45deg'; }],
    ['rotation-or-scale-present', (s: Snapshots[string], on: boolean) => { if (on) child(s).style.transform = 'matrix(0.5, 0, 0, 0.5, 0, 0)'; }],
    ['translation-unresolved', (s: Snapshots[string], on: boolean) => { if (on) child(s).style.translate = 'calc(min(100%, 20px) - 2px)'; }],
    ['translation-unresolved', (s: Snapshots[string], on: boolean) => { if (on) child(s).style.translate = 'calc(100% - 2px) 0px 4px'; }],
    ['translation-unresolved', (s: Snapshots[string], on: boolean) => { if (on) child(s).style.transform = 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 14, 0, 0, 1)'; }],
    ['not-sole-in-flow-child', (s: Snapshots[string]) => { s.tree.nodes.push(sibling()); s.ownership.nodes.push({ path: '1', tag: 'i', nearestComponent: 'instance-0', createdBy: 'instance-0' }); s.descendantSizes!.nodes.push({ path: '1', tag: 'i', sizes: [] }); }],
    ['not-sole-in-flow-child', (s: Snapshots[string]) => { s.tree.pseudo['::before'] = { display: 'block', position: 'static', content: '""' }; }],
    ['rtl-or-vertical-writing', (s: Snapshots[string]) => { s.tree.style.direction = 'rtl'; }],
    ['rtl-or-vertical-writing', (s: Snapshots[string]) => { s.tree.style['writing-mode'] = 'vertical-rl'; }],
    ['parent-not-single-line-flex', (s: Snapshots[string]) => { s.tree.style['flex-direction'] = 'row-reverse'; }],
    ['parent-not-single-line-flex', (s: Snapshots[string]) => { s.tree.style.display = 'block'; }],
    ['parent-justification-not-start', (s: Snapshots[string]) => { s.tree.style['justify-content'] = 'center'; }],
    ['child-positioned', (s: Snapshots[string]) => { child(s).style.position = 'relative'; }],
    ['child-main-size-not-own-fixed', (s: Snapshots[string]) => { s.descendantSizes!.nodes[0].sizes = [{ channel: 'width', status: 'unresolved', authoredValue: '16px', selectors: ['#w > *'], reason: 'size-declared-by-outer-selector' }, fixed('height', '16px')]; }],
    ['child-main-size-not-own-fixed', () => {}, false],
    ['parent-not-observed-root', (s: Snapshots[string], on: boolean) => { const moved = child(s).style.translate; child(s).style.translate = 'none';
      child(s).nodes = [{ t: 'el', el: { tag: 'b', classes: [], pseudo: {}, nodes: [], style: { display: 'block', position: 'static', width: '4px', height: '4px', translate: on ? moved : '0px' } } }];
      s.ownership.nodes.push({ path: '0.0', tag: 'b', nearestComponent: 'instance-0', createdBy: 'instance-0' }); s.descendantSizes!.nodes.push({ path: '0.0', tag: 'b', sizes: [] }); }],
  ] as Array<[string, (s: Snapshots[string], on: boolean) => void, boolean?]>) {
    const refused = build(edit, evidence ?? true);
    assert.deepEqual([refused.status, refused.problems], ['refused', [refusal + reason]], reason);
  }
  // An absolutely placed decoration beside the part does not take flow space, so the part is still alone in flow.
  const decorated = build(s => { const extra = sibling(); extra.el.style.position = 'absolute'; s.tree.nodes.push(extra);
    s.ownership.nodes.push({ path: '1', tag: 'i', nearestComponent: 'instance-0', createdBy: 'instance-0' }); s.descendantSizes!.nodes.push({ path: '1', tag: 'i', sizes: [] }); });
  assert.equal(decorated.status, 'compiled-draft', decorated.problems.join('\n'));
  // A root that hugs has no declared free space to be at the end of.
  const hugging = build(s => { Object.assign(s.tree.style, { display: 'inline-flex', 'flex-grow': '0', 'flex-shrink': '0', 'flex-basis': 'auto', 'min-width': '0px', 'max-width': 'none', position: 'static' });
    s.styleOrigin.roots[0].sizes![0] = { channel: 'width', status: 'auto', value: 'auto', selectors: [] }; });
  assert.deepEqual(hugging.problems, [refusal + 'parent-main-size-not-fixed']);
});

test('a per-state alignment needs a drawn plane to ride: a required boolean has no omitted plane and refuses', t => {
  const required = domain(t, 'Required').build();
  assert.deepEqual([required.status, required.problems], ['refused', [refusal + 'alignment-not-carried']]);
  const lenient = domain(t, 'Track').build(), contract = structuredClone(lenient.compiled!.contract!), errors: string[] = [];
  validateContract(contract, new Map([[contract.id, contract]]), errors, new Map()); assert.deepEqual(errors, []);
  contract.anatomy.root.layoutByProp!.map = { maybe: { justify: 'end' } };
  const unknown: string[] = []; validateContract(contract, new Map([[contract.id, contract]]), unknown, new Map());
  assert.ok(unknown.some(e => e.includes('layoutByProp map key "maybe" is not a value of prop "on"')), unknown.join('\n'));
});
