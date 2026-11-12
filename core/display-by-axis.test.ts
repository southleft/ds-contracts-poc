import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { alignSweep, detectFolds, enrichLayout, prepareMint, styledChannels, uaStyles } from '../extract/computed/fuse.js';
import { loadConfig, propSpaceFor, stageFor, type SweepResult } from '../extract/computed/capture.js';
import { reconstructCaptures, type CapturedTruthFile } from '../extract/computed/replay.js';
import { promoteAnatomy } from '../extract/computed/anatomy.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';

/** A display that varies but factors on one enum axis rides per-value stylesWhen rules (fuse.display-by-axis-carried),
 *  and the writer lays out each variant by the display it draws: a block box stacks, another keeps the row default. */
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('fuse carries a display that varies on one enum axis as per-value rules (a committed capture)', () => {
  const cfg = loadConfig(repo, path.join(repo, 'extract/computed/configs/astryx.json'));
  const comp = cfg.components.find((c) => c.name === 'CheckboxInput')!;
  const truth = JSON.parse(readFileSync(path.join(repo, 'extract/computed/out/astryx/checkboxinput/captured-truth.json'), 'utf8')) as CapturedTruthFile;
  const space = propSpaceFor(repo, cfg, comp);
  const sweep = { captures: reconstructCaptures(truth).map((c) => ({ ...c, combo: `CheckboxInput:${c.combo}` })), controls: truth.controls,
    uaControls: truth.uaControls ?? {}, uaBaselineBrowser: String(truth._provenance.uaBaselineBrowser), allProps: truth._provenance.channels,
    stylesheetSkips: [], browserVersion: String(truth._provenance.browser), fontChecks: {}, pinnedAnimations: [], shadowHostTrails: {},
    textFillFolds: {}, closedShadowSuspects: {}, quarantined: [] } as SweepResult;
  const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix), promotion = promoteAnatomy(space, comp, aligned.union, 'checkboxinput');
  const styled = styledChannels(aligned, space, Object.fromEntries(Object.entries(truth.controls).map(([tag, n]) => [tag, n.style])), sweep.allProps, [],
    { viewport: cfg.browser.viewport, stage: stageFor(cfg, comp), portaled: false }, uaStyles(truth));
  const layout = enrichLayout(aligned, space, styled, promotion.contract);
  const prep = prepareMint(aligned, comp, space, styled, detectFolds(aligned, styled, []), layout.handled, promotion.contract,
    new Set([...promotion.consumed].map((i) => aligned.partNames[i])), new Set(promotion.partIndex.keys()), promotion.gridMintRefusals);
  assert.deepEqual(prep.declared.filter((d) => d.channel === 'display' && d.when).map((d) => `${d.part}=${d.value}@${d.when!.prop}=${d.when!.equals}`),
    ['icon=block@checked=checked', 'part-0-0-1-1=block@checked=indeterminate']);
});

test('the writer stacks a root in the variants whose display is block and keeps the row default in the others', () => {
  const contract = ContractSchema.parse({
    id: 'test.display-by-axis', name: 'DisplayByAxis', version: '0.1.0', status: 'draft', description: 'A root stacked or inline by one prop',
    states: [], semantics: { element: 'div' },
    props: [{ name: 'type', type: { enum: ['stacked', 'inline'] }, default: 'stacked',
      bindings: { code: { prop: 'type' }, figma: { kind: 'VARIANT', property: 'type', values: { stacked: 'stacked', inline: 'inline' } } } }],
    anatomy: { root: { stylesWhen: [{ prop: 'type', equals: 'stacked', styles: { display: 'block' } }],
      parts: { label: { text: 'Label' }, field: { text: 'Field' } } } },
    bindings: { code: { anchors: { importPath: 'test/DisplayByAxis', export: 'DisplayByAxis' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const variants = (engine.compileComponentData(contract, new Map([[contract.id, contract]])) as any).variants;
  assert.deepEqual(variants.map((v: any) => [v.name, v.spec.layout.mode, v.spec.layout.primary]),
    [['type=stacked', 'VERTICAL', 'MIN'], ['type=inline', 'HORIZONTAL', 'CENTER']]);
});
