/** scripts/profile-draft.ts, on a made-up grammar reading only (reviewer, 2026-11-14: never a real system's Storybook):
 *  the draft passes the reader's schema, carries the inferred axes, leaves refused titles out by name, and never counts:
 *  the scored runner and the reading refuse it by name. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentName, draftProfile } from './profile-draft.js';
import { assertReviewed, DRAFTED, SystemProfile } from './storybook-reader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const grammar = {
  index: { sha256: 'a1b2c3d4e5f6a7b8' },
  stories: [{ id: 'forms-date-picker--default', title: 'Forms/Date picker' }, { id: 'forms-date-picker--small', title: 'Forms/Date picker' },
    { id: 'layout-grid--default', title: 'Layout/Grid' }, { id: 'legacy-date-picker--default', title: 'Legacy/Date Picker' }, { id: 'docs--intro', title: 'Docs/***' }],
  components: [
    { title: 'Forms/Date picker', matrix: { status: 'ok' as const, axes: ['size'] } },
    { title: 'Layout/Grid', matrix: { status: 'refused' as const, reason: 'variant-matrix-option-axes-differ' } },
    { title: 'Legacy/Date Picker', matrix: { status: 'ok' as const, axes: [] } },
    { title: 'Docs/***', matrix: { status: 'ok' as const, axes: [] } }],
};

test('a title\'s last segment becomes the component name', () => {
  assert.equal(componentName('Forms/date picker'), 'DatePicker');
  assert.equal(componentName('Components/Button'), 'Button');
  assert.equal(componentName('Icon-button 2'), 'IconButton2');
  assert.equal(componentName('Docs/***'), '');
});

test('the draft carries each title\'s stories and inferred axes, passes the schema, and names every title it left out', () => {
  const { profile, refused } = draftProfile({ name: '@acme/ui', version: '3.1.0' }, grammar);
  assert.deepEqual(profile.components, [{ name: 'DatePicker', stories: ['forms-date-picker--default', 'forms-date-picker--small'], axes: ['size'] }]);
  assert.deepEqual(refused, [{ title: 'Layout/Grid', reason: 'variant-matrix-option-axes-differ' },
    { title: 'Legacy/Date Picker', reason: 'name-taken:DatePicker (by Forms/Date picker)' }, { title: 'Docs/***', reason: 'title-gives-no-name' }]);
  assert.equal(profile.provenance, 'drafted by ds-contracts init from Storybook index a1b2c3d4e5f6; not reviewed');
  assert.match(profile.provenance, DRAFTED);
  assert.deepEqual(profile.pins.package, { name: '@acme/ui', version: '3.1.0' });
  assert.deepEqual(draftProfile({ name: '@acme/ui', version: '3.1.0' }, grammar), { profile, refused }, 'the same reading gives the same draft');
  assert.throws(() => draftProfile({ version: '1.0.0' }, grammar), /^Error: profile-draft-package-unnamed: /);
});

test('the schema takes a reviewed or a drafted provenance and nothing else; a drafted one is refused wherever it would count', () => {
  const { profile } = draftProfile({ name: '@acme/ui', version: '3.1.0' }, grammar);
  assert.throws(() => assertReviewed(profile), /^Error: profile-drafted-not-reviewed: /);
  const reviewed = { ...profile, provenance: 'AI-drafted by the working session; approved by the reviewer session (2026-11-14)' };
  assert.doesNotThrow(() => assertReviewed(SystemProfile.parse(reviewed)));
  assert.throws(() => SystemProfile.parse({ ...profile, provenance: 'hand written' }), /profile-provenance/);
  assert.throws(() => SystemProfile.parse({ ...profile, provenance: 'drafted by ds-contracts init from Storybook index x' }), /profile-provenance/);
});

test('the reading and the scored runner refuse a drafted profile by name before reading anything else', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'profile-draft-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'profile.json'), run = path.join(root, 'profile-draft-test-run-never-made');
  writeFileSync(file, JSON.stringify(draftProfile({ name: '@acme/ui', version: '3.1.0' }, grammar).profile));
  const node = (script: string, args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', path.join(root, 'scripts', script), ...args], { cwd: root, encoding: 'utf8' });
  const reading = node('reading.ts', ['--f2r', path.join(dir, 'cells.json'), '--profile', file]);
  assert.equal(reading.status, 2, reading.stderr);
  assert.match(reading.stderr, /✖ profile-drafted-not-reviewed: /);
  const runner = node('react-to-figma-run.ts', ['--run', run, '--tag', 't1', '--file-key', 'KEY1', '--only', path.join(dir, 'only.json'), '--profile', file]);
  assert.equal(runner.status, 2, runner.stderr);
  assert.match(runner.stderr, /✖ refused before any write: profile-drafted-not-reviewed: /);
  assert.equal(existsSync(run), false);
});
