import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { alignSweep, centeredTextParts, styledChannels, uaStyles, type FusionEnv } from './fuse.js';
import { loadConfig, propSpaceFor, stageFor, type SweepResult } from './capture.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';
import { parentFillContainer } from '../../scripts/storybook-contracts.js';

/** FusionEnv.container (the Storybook route's convention stage-from-story-container): when the harness measured the
 *  content width of the container the root was rendered in, the block-root width doors compare the root against it
 *  instead of the stage. Absent, nothing changes. Replayed on committed captures. */
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function rootDoor(config: string, name: string, container?: number): string {
  const cfg = loadConfig(repo, path.join(repo, 'extract/computed/configs', config));
  const comp = cfg.components.find((c) => c.name === name)!;
  const truth = JSON.parse(readFileSync(path.join(repo, 'extract/computed/out', config.replace('.json', ''), name.toLowerCase(), 'captured-truth.json'), 'utf8')) as CapturedTruthFile;
  const space = propSpaceFor(repo, cfg, comp);
  const sweep = { captures: reconstructCaptures(truth).map((c) => ({ ...c, combo: `${name}:${c.combo}` })), controls: truth.controls,
    uaControls: truth.uaControls ?? {}, uaBaselineBrowser: '', allProps: truth._provenance.channels, stylesheetSkips: [], browserVersion: '',
    fontChecks: {}, pinnedAnimations: [], shadowHostTrails: {}, textFillFolds: {}, closedShadowSuspects: {}, quarantined: [] } as unknown as SweepResult;
  const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix), receipts: string[] = [];
  const env: FusionEnv = { viewport: cfg.browser.viewport, stage: stageFor(cfg, comp), portaled: false, ...(container !== undefined ? { container } : {}) };
  styledChannels(aligned, space, Object.fromEntries(Object.entries(truth.controls).map(([tag, n]) => [tag, n.style])), sweep.allProps, receipts, env, uaStyles(truth));
  return receipts.find((r) => r.startsWith('block-root-width-'))!.replace(/:.*/, '');
}

test('a block root that fills the measured container is admitted; absent, the stage decides as before', () => {
  assert.equal(rootDoor('altitude.json', 'IconClose'), 'block-root-width-refused (shrink-to-fit)');
  assert.equal(rootDoor('altitude.json', 'IconClose', 16), 'block-root-width-admitted');
});

test('block-root-fills-its-parent: a block root filling its parent content box is measured against it; a wider parent or an absolute root keeps the named refusal', () => {
  const fill = (parentContent: number, position = 'static') => parentFillContainer([{ display: 'block', position, float: 'none', width: 16, parentDisplay: 'block', parentContent }]);
  assert.equal(rootDoor('altitude.json', 'IconClose', fill(16)), 'block-root-width-admitted');
  assert.equal(rootDoor('altitude.json', 'IconClose'), 'block-root-width-refused (shrink-to-fit)'); // off: the stage decides
  assert.deepEqual([fill(20), fill(16, 'absolute')], [undefined, undefined]);
  assert.equal(rootDoor('altitude.json', 'IconClose', fill(20)), 'block-root-width-refused (shrink-to-fit)');
});

test('the measured container wins over the stage', () => {
  assert.equal(rootDoor('altitude.json', 'Heading'), 'block-root-width-admitted');
  assert.equal(rootDoor('altitude.json', 'Heading', 999), 'block-root-width-refused (shrink-to-fit)');
});

test('centered-text-keeps-drawn-width: a text part its flex row centers keeps its width; a packed, growing or textless one does not', () => {
  const el = (path: string, style: Record<string, string>, text = '') => ({ path, sig: '', partName: '', node: { style, nodes: text ? [{ t: 'text', v: text }] : [] } });
  const row = { display: 'flex', 'justify-content': 'center' };
  const flat = [el('', {}), el('0', row), el('0.0', { 'flex-grow': '0' }, 'AI'), el('0.1', { 'flex-grow': '1' }, 'x'), el('0.2', {}),
    el('1', { ...row, 'flex-direction': 'column' }), el('1.0', {}, 'y'), el('2', { display: 'flex', 'justify-content': 'flex-start' }), el('2.0', {}, 'z')];
  const space = { enumeration: { combos: [{ key: 'a', stateFlags: {} }, { key: 'b', stateFlags: { hover: true } }] } };
  const parts = (rows: Record<string, typeof flat>) => [...centeredTextParts({ baseFlat: flat, getAligned: (k: string) => rows[k.replace('__default', '')] ?? [] } as any, space as any)];
  assert.deepEqual(parts({ a: flat }), [2]);
  // Every enabled combo must center it; a state combo is not read.
  const packed = flat.map((f) => f.path === '0' ? el('0', { display: 'flex', 'justify-content': 'space-between' }) : f);
  assert.deepEqual(parts({ a: flat, b: packed }), [2]);
  assert.deepEqual(parts({ a: packed }), []);
});
