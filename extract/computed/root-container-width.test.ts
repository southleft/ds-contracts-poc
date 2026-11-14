import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { alignSweep, styledChannels, uaStyles, type FusionEnv } from './fuse.js';
import { loadConfig, propSpaceFor, stageFor, type SweepResult } from './capture.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';

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

test('the measured container wins over the stage', () => {
  assert.equal(rootDoor('altitude.json', 'Heading'), 'block-root-width-admitted');
  assert.equal(rootDoor('altitude.json', 'Heading', 999), 'block-root-width-refused (shrink-to-fit)');
});
