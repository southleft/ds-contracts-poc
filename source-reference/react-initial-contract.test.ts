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
  writeFileSync(path.join(dir, 'surface.tsx'), `import React from 'react'; export function Surface({value}:{value?:false|true|'mixed'}) { return <div>{value && <span />}</div> }`);
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
  const prop = result.compiled!.contract!.props[0];
  assert.equal(prop.default, undefined); assert.equal(prop.bindings.figma.unsetValue, '(unset)');
  assert.deepEqual(prop.bindings.code.values, { 'boolean-false': false, 'boolean-true': true, mixed: 'mixed' });
  assert.deepEqual(prop.type, { enum: ['boolean-false', 'boolean-true', 'mixed'] });
  assert.ok(result.compiled!.receipts.some(r => r.startsWith('optional-adornment-omission-preserved:')));
  assert.deepEqual(run(), result);
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
});
