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

test('complete typed initial domains preserve omission and conditional anatomy; incomplete or altered evidence refuses', t => {
  mkdirSync('private', { recursive: true });
  const dir = mkdtempSync(path.resolve('private/react-initial-contract-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, skipLibCheck: true, jsx: 'react-jsx', moduleResolution: 'Bundler', module: 'ESNext' } }));
  writeFileSync(path.join(dir, 'surface.tsx'), `import React from 'react'; export function Surface({value}:{value?:false|true|'mixed'}) { return <div><React.Fragment>{value && <span />}</React.Fragment></div> }
    export function Wrapper({children}:{children?:React.ReactNode}) { return <section>{children}</section> }`);
  const program = readReactSourceProgram(dir, ['surface.tsx']); assert.deepEqual(program.problems, []);
  const source = program.components[0];
  const ownership: ReactOwnership = { version: 1, rendererVersions: ['19.2.4'], problems: [], components: [{ id: 'instance-0',
    source: { module: source.module, exportName: source.exportName, sourceSha256: source.sourceSha256, span: source.span },
    props: { value: false }, roots: [''] }], nodes: [{ path: '', tag: 'div', nearestComponent: 'instance-0', createdBy: 'instance-0' }] };
  const tree: CapturedNode = { tag: 'div', classes: [], pseudo: {}, nodes: [], style: { display: 'flex', 'flex-direction': 'row',
    'align-items': 'center', 'justify-content': 'center', width: '16px', height: '16px', 'box-sizing': 'border-box', 'background-color': 'rgb(255, 255, 255)' } };
  const { plan, ...facts } = planReactInitialStates(program, ownership, tree, 'instance-0');
  const snapshots: Parameters<typeof compileReactInitialContract>[4] = {};
  const rows = plan.map((entry, i) => {
    const id = String(i), changed = structuredClone(tree), own = structuredClone(ownership), value = entry.changes.value;
    if (value.kind === 'omit') delete own.components[0].props.value;
    else own.components[0].props.value = value.value;
    changed.style.opacity = value.kind === 'set' ? value.value === true ? '0.5' : value.value === 'mixed' ? '0' : '1' : '1';
    if (value.kind === 'set' && value.value) {
      changed.nodes = [{ t: 'el', el: { tag: 'span', classes: ['mark'], pseudo: {}, nodes: [], style: { display: 'block', width: '8px', height: '8px', 'background-color': value.value === true ? 'rgb(0, 0, 0)' : 'rgb(255, 0, 0)' } } }];
      own.nodes.push({ path: '0', tag: 'span', nearestComponent: 'instance-0', createdBy: 'instance-0' });
    }
    const treeSha256 = evidenceSha(JSON.stringify(changed)), image = evidenceSha('fixture-image-' + id);
    snapshots[id] = { tree: changed, treeSha256, image, ownership: own,
      styleOrigin: { version: 1, roots: [{ path: '', tag: 'div', channels: [], sizes: ['width', 'height'].map(channel => ({ channel: channel as 'width' | 'height', status: 'fixed', value: '16px', selectors: ['.surface'] })) }] },
      fonts: { version: 1, status: 'observed', treeRevision: revisionOf(changed), problems: [], rows: [] },
      svg: { version: 1, status: 'observed', treeRevision: revisionOf(changed), problems: [], rows: [] } };
    return { id, ...entry, status: 'observed' as const, restored: true, image, treeSha256 };
  });
  const observation = { version: 1 as const, qualification: 'finite-initial-mounts-only' as const, acceptedContract: null,
    instanceId: 'instance-0', ...facts, planned: plan.length, problems: [], rows };
  const run = (o = observation, s = snapshots) => compileReactInitialContract(program, ownership, tree, o, s);
  const result = run(); assert.equal(result.status, 'compiled-draft', result.problems.join('\n'));
  assert.equal(result.compiled!.component!.variants.length, 4);
  for (const variant of result.compiled!.component!.variants)
    assert.equal(variant.spec.opacity, variant.name.includes('boolean-true') ? 0.5 : variant.name.includes('mixed') ? 0 : 1, 'observed node opacity, including zero, survives the conditional token compiler');
  const prop = result.compiled!.contract!.props[0];
  assert.equal(prop.default, undefined); assert.equal(prop.bindings.figma.unsetValue, '(unset)');
  assert.deepEqual(prop.bindings.code.values, { 'boolean-false': false, 'boolean-true': true, mixed: 'mixed' });
  assert.deepEqual(prop.type, { enum: ['boolean-false', 'boolean-true', 'mixed'] });
  assert.ok(result.compiled!.receipts.some(r => r.startsWith('optional-adornment-omission-preserved:')));
  assert.deepEqual(run(), result);
  // Keep the full parent observation authenticated while compiling only the
  // selected child's states. The parent must not become part of its anatomy.
  const wrapper = program.components.find(c => c.exportName === 'Wrapper')!;
  const wrapOwnership = (own: ReactOwnership): ReactOwnership => ({ ...own,
    components: [
      { id: 'instance-1', source: { module: wrapper.module, exportName: wrapper.exportName, sourceSha256: wrapper.sourceSha256, span: wrapper.span }, props: {}, roots: [''] },
      ...own.components.map(c => ({ ...c, parent: 'instance-1', roots: c.roots.map(p => p ? '0.' + p : '0') })),
    ],
    nodes: [{ path: '', tag: 'section', nearestComponent: 'instance-1', createdBy: 'instance-1' },
      ...own.nodes.map(n => ({ ...n, path: n.path ? '0.' + n.path : '0' }))],
  });
  const wrapTree = (child: CapturedNode): CapturedNode => ({ tag: 'section', classes: [], pseudo: {},
    style: { display: 'flex', width: '360px', height: '200px', 'font-size': '14px', 'line-height': '20px' }, nodes: [{ t: 'el', el: child }] });
  const nestedSnapshots = structuredClone(snapshots);
  for (const snapshot of Object.values(nestedSnapshots)) {
    snapshot.tree = wrapTree(snapshot.tree);
    snapshot.ownership = wrapOwnership(snapshot.ownership);
    snapshot.styleOrigin.roots.forEach(r => { r.path = r.path ? '0.' + r.path : '0'; });
    snapshot.treeSha256 = evidenceSha(JSON.stringify(snapshot.tree));
    snapshot.fonts.treeRevision = snapshot.svg.treeRevision = revisionOf(snapshot.tree);
  }
  const nestedObservation = { ...observation, rows: rows.map(r => ({ ...r, treeSha256: nestedSnapshots[r.id].treeSha256 })) };
  const nestedRun = (samples = nestedSnapshots) => compileReactInitialContract(program, wrapOwnership(ownership), wrapTree(tree), nestedObservation, samples);
  const nested = nestedRun();
  assert.equal(nested.status, 'compiled-draft', nested.problems.join('\n'));
  assert.equal(nested.compiled!.component!.variants.length, 4);
  for (const variant of nested.compiled!.component!.variants) {
    assert.equal(variant.spec.fixedWidth?.px, 16, 'the parent width must not become the child width');
    assert.equal(variant.spec.fixedHeight?.px, 16, 'the parent height must not become the child height');
    const originalVariant = result.compiled!.component!.variants.find(v => v.name === variant.name)!;
    assert.deepEqual(variant.spec.layout, originalVariant.spec.layout);
    assert.equal(variant.spec.opacity, originalVariant.spec.opacity);
    assert.equal(variant.spec.children?.length, originalVariant.spec.children?.length);
  }
  for (const mutate of [
    (s: typeof nestedSnapshots) => { s['0'].ownership.components[1].parent = 'missing-parent'; },
    (s: typeof nestedSnapshots) => { s['0'].ownership.components[1].roots = ['']; },
    (s: typeof nestedSnapshots) => { s['0'].ownership.components[1].source.sourceSha256 = '0'.repeat(64); },
    (s: typeof nestedSnapshots) => { s['0'].tree.style.width = '999px'; },
  ]) {
    const changed = structuredClone(nestedSnapshots); mutate(changed);
    assert.equal(nestedRun(changed).status, 'refused', 'changed identity or whole-parent evidence cannot qualify child states');
  }
  const bound = structuredClone(snapshots);
  for (const snapshot of Object.values(bound)) {
    const variable = snapshot.ownership.components[0].props.value === true ? '--Accent' : '--accent';
    snapshot.tree.style[variable] = 'rgb(255, 255, 255)';
    snapshot.treeSha256 = evidenceSha(JSON.stringify(snapshot.tree));
    snapshot.fonts.treeRevision = snapshot.svg.treeRevision = revisionOf(snapshot.tree);
    snapshot.styleOrigin.roots[0].channels = [{ channel: 'background-color', status: 'direct-variable', variable,
      rawValue: 'rgb(255, 255, 255)', computedValue: 'rgb(255, 255, 255)', selectors: ['.surface'] }];
  }
  const boundObservation = { ...observation, rows: rows.map(row => ({ ...row, treeSha256: bound[row.id].treeSha256 })) };
  const identities = run(boundObservation, bound);
  assert.equal(identities.status, 'compiled-draft', identities.problems.join('\n'));
  const upper = 'source/css/v' + Buffer.from('--Accent').toString('hex'), lower = 'source/css/v' + Buffer.from('--accent').toString('hex');
  assert.notEqual(upper, lower);
  for (const variant of identities.compiled!.component!.variants)
    assert.equal(variant.spec.fill, variant.name.includes('boolean-true') ? upper : lower, 'equal colors retain distinct, case-sensitive source identities');
  const mismatchedBinding = structuredClone(bound);
  mismatchedBinding['0'].styleOrigin.roots[0].channels[0].rawValue = 'rgb(0, 0, 0)';
  assert.equal(run(boundObservation, mismatchedBinding).status, 'refused');
  assert.equal(run({ ...observation, rows: rows.slice(1) }).status, 'refused');
  for (const mutate of [
    (s: typeof snapshots) => { s['0'].tree.style.width = '18px'; },
    (s: typeof snapshots) => { s['0'].ownership.components[0].props.value = true; },
    (s: typeof snapshots) => { s['0'].ownership.components[0].props.other = 'new'; },
    (s: typeof snapshots) => { s['0'].styleOrigin.roots[0].sizes![0].status = 'unresolved'; },
    (s: typeof snapshots) => { s['0'].fonts.treeRevision = revisionOf({ changed: true }); },
  ]) {
    const changed = structuredClone(snapshots); mutate(changed);
    assert.equal(run(observation, changed).status, 'refused');
  }

  const intrinsic = structuredClone(snapshots);
  for (const [id, snapshot] of Object.entries(intrinsic)) {
    Object.assign(snapshot.tree.style, { display: 'inline-flex', 'flex-direction': 'row', 'flex-wrap': 'nowrap',
      'flex-grow': '0', 'flex-shrink': '0', 'flex-basis': 'auto', 'min-width': '0px', 'max-width': 'none',
      'writing-mode': 'horizontal-tb', position: 'static', width: `${80 + Number(id) * 20}px` });
    snapshot.styleOrigin.roots[0].sizes![0] = { channel: 'width', status: 'auto', value: 'auto', selectors: [] };
  }
  const intrinsicRun = (samples = intrinsic) => {
    const sealed = structuredClone(samples);
    for (const snapshot of Object.values(sealed)) {
      snapshot.treeSha256 = evidenceSha(JSON.stringify(snapshot.tree));
      snapshot.fonts.treeRevision = snapshot.svg.treeRevision = revisionOf(snapshot.tree);
    }
    return run({ ...observation, rows: rows.map(row => ({ ...row, treeSha256: sealed[row.id].treeSha256 })) }, sealed);
  };
  const hugging = intrinsicRun();
  assert.equal(hugging.status, 'compiled-draft', hugging.problems.join('\n'));
  for (const variant of hugging.compiled!.component!.variants) {
    assert.equal(variant.spec.layout?.mode, 'HORIZONTAL');
    assert.equal(variant.spec.fixedWidth, undefined, 'sample content width must not become a native fixed size');
    assert.equal(variant.spec.lits?.width, undefined);
    assert.equal(variant.spec.fixedHeight?.px, 16, 'the independently fixed axis remains fixed');
  }
  for (const styles of [
    { display: 'flex' }, { 'flex-wrap': 'wrap' }, { 'flex-grow': '1' }, { 'flex-shrink': '1' },
    { 'flex-basis': '100px' }, { 'min-width': '100px' }, { 'max-width': '200px' },
    { 'writing-mode': 'vertical-rl' }, { position: 'absolute' }, { 'flex-direction': 'column' },
  ]) {
    const changed = structuredClone(intrinsic); Object.assign(changed['0'].tree.style, styles);
    assert.ok(intrinsicRun(changed).problems.includes('react-initial-contract-root-sizing-unqualified:width'));
  }
  const mixed = structuredClone(intrinsic);
  mixed['0'].styleOrigin.roots[0].sizes![0] = { channel: 'width', status: 'fixed', value: mixed['0'].tree.style.width, selectors: ['.surface'] };
  assert.ok(intrinsicRun(mixed).problems.includes('react-initial-contract-root-sizing-mixed:width'));
});
