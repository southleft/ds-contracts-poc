/**
 * WAVE B.2 — scale(0) hide + orthonormal rotate carriage.
 *
 *   npm run extract:computed:pseudo-decor-rotate:check
 *
 * Offline. Re-promotes Carbon Checkbox captured truth and pins:
 *
 *   1. `checkbox-label::after` is CARRIED (not refused as outside-grammar
 *      for scale(0) / rotate(−45°)).
 *   2. Carriage receipt mentions rotation / Wave B.2.
 *   3. Carbon Toggle ::before still carries (no regression).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, propSpaceFor, type ComponentConfig, type SweepResult } from './capture.js';
import { alignSweep } from './fuse.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';
import { promoteAnatomy } from './anatomy.js';
import { kebab } from '../types.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');

const failures: string[] = [];
const bad = (m: string) => failures.push(m);
const ok = (m: string) => console.log(`  ✔ ${m}`);

function promoteFromTruth(configRel: string, outRel: string, componentName: string) {
  const cfg = loadConfig(REPO, path.join(REPO, configRel));
  const comp = (cfg.components as ComponentConfig[]).find((c) => c.name === componentName);
  if (!comp) throw new Error(`component ${componentName} not in ${configRel}`);
  const truthPath = path.join(REPO, outRel, 'captured-truth.json');
  if (!existsSync(truthPath)) throw new Error(`missing ${truthPath}`);
  const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as CapturedTruthFile;
  const space = propSpaceFor(REPO, cfg, comp);
  const captures = reconstructCaptures(truth).map((c) => ({ ...c, combo: `${comp.name}:${c.combo}` }));
  const sweep = {
    captures,
    controls: truth.controls,
    allProps: truth._provenance.channels,
    stylesheetSkips: [],
    browserVersion: String(truth._provenance.browser ?? 'committed'),
    fontChecks: {},
    pinnedAnimations: [],
    shadowHostTrails: {},
    textFillFolds: {},
    closedShadowSuspects: {},
  } as unknown as SweepResult;
  const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix);
  return promoteAnatomy(space, comp, aligned.union, kebab(space.contract.name));
}

console.log('\n1. Carbon Checkbox — ::after check/minus is carried');
{
  const promotion = promoteFromTruth(
    'extract/computed/configs/carbon.json',
    'extract/computed/out/carbon/checkbox',
    'Checkbox',
  );
  const afterRefuse = promotion.refusals.filter(
    (r) => r.includes('checkbox-label::after') && r.includes('outside-grammar'),
  );
  if (afterRefuse.length > 0) {
    bad(`still refused ::after outside-grammar:\n    ${afterRefuse.join('\n    ')}`);
  } else {
    ok('no checkbox-label::after outside-grammar refusal');
  }
  const carried = promotion.receipts.filter(
    (r) => r.includes('pseudo-decor-carried:') && r.includes('checkbox-label::after'),
  );
  if (carried.length === 0) {
    bad(
      `::after not carried. refusals:\n    ${
        promotion.refusals.filter((r) => r.includes('::after')).join('\n    ') || '(none)'
      }`,
    );
  } else {
    ok(carried[0].slice(0, 200) + '…');
    if (/rotation|Wave B\.2|-45|45/.test(carried[0])) {
      ok('carriage receipt mentions rotation / Wave B.2');
    } else {
      bad(`carriage receipt missing rotation note: ${carried[0].slice(0, 240)}`);
    }
  }
}

console.log('\n2. Carbon Toggle — knob still carries (no regression)');
{
  const promotion = promoteFromTruth(
    'extract/computed/configs/carbon.json',
    'extract/computed/out/carbon/toggle',
    'Toggle',
  );
  const carried = promotion.receipts.filter((r) => r.includes('pseudo-decor-carried:'));
  if (carried.length === 0) {
    bad('Carbon Toggle decor no longer carried');
  } else {
    ok(`Carbon Toggle still carries decor (${carried.length} receipt(s))`);
  }
  const rotRefuse = promotion.refusals.filter((r) => r.includes('rotation-multiaxis'));
  if (rotRefuse.length > 0) {
    bad(`unexpected rotation refusal on Toggle:\n    ${rotRefuse.join('\n    ')}`);
  }
}

if (failures.length > 0) {
  console.error('\nFAIL:\n' + failures.map((f) => `  ✖ ${f}`).join('\n'));
  process.exit(1);
}
console.log('\nAll pseudo-decor rotate checks passed.');
