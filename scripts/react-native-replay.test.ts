import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePlan, planHash } from './react-native-replay.js';

test('plan normalization drops only run-derived values', () => {
  const plan = (op: string, run: string, color: string) => ({
    operation: { id: op }, componentRevision: 'sha256:' + run, requestRevision: 'sha256:' + run,
    tokenInput: { scopeId: 'source-' + op, source: { sourceProgramSha256: run } },
    component: { setName: 'Root', fill: color, nativeContractDraft: { revision: 'sha256:' + run, acceptedContract: null }, owner: 'observed ' + op },
  });
  const a = plan('11111111-1111-4111-8111-111111111111', 'a', '#fff'), b = plan('22222222-2222-4222-8222-222222222222', 'b', '#fff');
  assert.equal(planHash(a), planHash(b), 'operation ids, run revisions and path-derived hashes do not count');
  assert.notEqual(planHash(a), planHash(plan('11111111-1111-4111-8111-111111111111', 'a', '#000')), 'a compiled value does');
  assert.match(normalizePlan(a), /observed <id>/);
});

test('an observation-named draft replays equal across platforms; its content still counts', () => {
  const plan = (suffix: string, width: number, second = suffix) => ({
    draftRevision: 'sha256:' + suffix, projection: { contractRevision: 'sha256:' + suffix, tokenRevision: 'sha256:' + suffix },
    component: { contractId: `observed.react-initial-${suffix}`, setName: `InitialStates${suffix}StateApi`,
      variants: [{ spec: { fixedWidth: { varName: `imported/initial-states${suffix}/root/width` }, width } }],
      other: `observed.react-initial-${second}` },
    tokenInput: { modes: [{ tokenTreeRevision: 'sha256:' + suffix, tokens: { imported: { [`initial-states${suffix}`]: { w: { $value: `${width}px` } } } } }] },
  });
  // Measured: Linux and macOS name the same Switch draft from different raster digests.
  assert.equal(planHash(plan('2b72f17fbaa2049c', 44)), planHash(plan('3c02f9a3c2c5077f', 44)));
  assert.notEqual(planHash(plan('2b72f17fbaa2049c', 44)), planHash(plan('3c02f9a3c2c5077f', 45)), 'a compiled value still counts');
  // Two different observed names stay distinguishable from one name used twice.
  assert.notEqual(planHash(plan('2b72f17fbaa2049c', 44, '1111111111111111')), planHash(plan('2b72f17fbaa2049c', 44)));
  assert.match(normalizePlan(plan('2b72f17fbaa2049c', 44)), /InitialStates<observed-0>StateApi/);
});

test('a state-API repeat that refuses or adds an operation fails its cell', async () => {
  const { judgeReact } = await import('./benchmark-react-native.js');
  const cell = { id: 'c', row: 'Switch', criterion: 'C3', kind: 'react-to-native' as const, workspace: 'w', caseId: 'state-api:s', children: false, expect: 'pass' as const };
  const pin = { id: 'c', version: 1 as const, kind: 'react-to-native' as const, referenceId: 'r', root: 'h', children: {}, recordedOn: 'x', fidelity: null };
  const judged = (repeat?: { status: number; newOperations: number; refusal?: string }) =>
    judgeReact(cell, pin, { referenceId: 'r', result: { caseId: 'state-api:s', root: { kind: 'k', planSha256: 'h' }, children: [], ...(repeat ? { repeat } : {}) } });
  assert.equal(judged({ status: 200, newOperations: 0 }).status, 'stale');
  assert.match(judged({ status: 200, newOperations: 0 }).reason, /repeat after another root joined returned the prepared operation/);
  assert.equal(judged().status, 'stale');
  assert.match(judged({ status: 200, newOperations: 1 }).reason, /created 1 more operation/);
  assert.equal(judged({ status: 409, newOperations: 0, refusal: 'state-api-native-observation-required' }).status, 'red');
});

test('refused nested child plans are named in the verdict', async () => {
  const { judgeReact } = await import('./benchmark-react-native.js');
  const cell = { id: 'c', row: 'Card', criterion: 'C3', kind: 'react-to-native' as const, workspace: 'w', caseId: 'card', children: true, expect: 'pass' as const };
  const children = { 'instance-1': { exportName: 'CardHeader', planSha256: 'a' }, 'instance-2': { exportName: 'Checkbox', planSha256: null, refusal: 'react-child-root-preparation-unavailable' } };
  const pin = { id: 'c', version: 1 as const, kind: 'react-to-native' as const, referenceId: 'r', root: 'h', children, recordedOn: 'x', fidelity: null };
  const v = judgeReact(cell, pin, { referenceId: 'r', result: { caseId: 'card', root: { kind: 'k', planSha256: 'h' },
    children: [{ instanceId: 'instance-1', exportName: 'CardHeader', planSha256: 'a' }, { instanceId: 'instance-2', exportName: 'Checkbox', refusal: 'react-child-root-preparation-unavailable' }] } });
  assert.equal(v.status, 'stale');
  assert.match(v.reason, /1 nested child plan\(s\) refuse \(react-child-root-preparation-unavailable: Checkbox\)/);
});

test('a text-only overage is a partial, never a pass; anything else over the limit fails', async () => {
  const { attachReact, judgeReact } = await import('./benchmark-react-native.js');
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const cell = { id: 'b', row: 'Badge', criterion: 'C3', kind: 'react-to-native' as const, workspace: 'w', caseId: 'badge', children: false, expect: 'pass' as const };
  const attach = (scores: object[], sizeDifferenceFromText?: boolean) => {
    const root = mkdtempSync(path.join(tmpdir(), 'text-residual-'));
    const plan = { component: { setName: 'Root', fill: '#171717' } };
    mkdirSync(path.join(root, 'ops', 'op'), { recursive: true });
    writeFileSync(path.join(root, 'ops', 'op', 'plan.json'), JSON.stringify({ plan }));
    mkdirSync(path.join(root, 'benchmark', 'pins'), { recursive: true });
    writeFileSync(path.join(root, 'benchmark', 'pins', 'b.json'), JSON.stringify({ id: 'b', version: 1, kind: 'react-to-native', referenceId: 'r', root: planHash(plan), children: {}, recordedOn: 'x', fidelity: null }));
    writeFileSync(path.join(root, 'comparison.json'), JSON.stringify({ limitPercent: 5, sourceSize: [43.875, 20], nativeSize: [44, 20], layoutExact: false,
      ...(sizeDifferenceFromText === undefined ? {} : { text: { sizeDifferenceFromText } }), scores, pass: scores.every((s: any) => s.withinLimit) }));
    attachReact(root, cell, path.join(root, 'comparison.json'), { root: 'op' }, path.join(root, 'ops'), 'darwin-arm64', '2026-09-27');
    const pin = JSON.parse(readFileSync(path.join(root, 'benchmark', 'pins', 'b.json'), 'utf8'));
    return { pin, verdict: judgeReact(cell, pin, { referenceId: 'r', result: { caseId: 'badge', root: { kind: 'k', planSha256: pin.root }, children: [] } }) };
  };
  const over = (background: string, residual?: string) => ({ background, mismatchPercent: 6.25, withinLimit: false, ...(residual ? { residual } : {}) });
  const within = (background: string) => ({ background, mismatchPercent: 2.614, withinLimit: true });
  // Measured: shadcn Badge "New" — Figma sets the label 26 px wide, the browser 25.875 px, so the roots are 44 and 43.875.
  const text = attach([over('white', 'text-only'), over('black', 'text-only')], true);
  assert.equal(text.pin.fidelity.pass, false);
  assert.equal(text.pin.fidelity.residual, 'text-only');
  assert.equal(text.verdict.status, 'partial');
  assert.match(text.verdict.reason, /size differs.*over the limit only inside the text boxes/);
  assert.equal(attach([within('white'), within('black')], true).verdict.status, 'partial', 'within the limit, size differing only by the text: partial');
  assert.equal(attach([within('white'), within('black')], false).verdict.status, 'red', 'a size difference the texts do not account for fails');
  assert.equal(attach([within('white'), within('black')]).verdict.status, 'red', 'no measured texts: unattributed');
  assert.equal(attach([over('white', 'text-only'), over('black', 'beyond-text')], true).verdict.status, 'red', 'every over-limit score must be text-only');
  assert.equal(attach([over('white'), over('black')], true).verdict.status, 'red', 'no text boxes recorded: unclassified');
});
