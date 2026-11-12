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

/** Replay a committed captured truth through fuse; the per-axis facts it carries on `channel`. */
function byAxis(config: string, name: string, out: string, channel: string): string[] {
  const cfg = loadConfig(repo, path.join(repo, 'extract/computed/configs', config));
  const comp = cfg.components.find((c) => c.name === name)!;
  const truth = JSON.parse(readFileSync(path.join(repo, 'extract/computed/out', out, 'captured-truth.json'), 'utf8')) as CapturedTruthFile;
  const space = propSpaceFor(repo, cfg, comp);
  const sweep = { captures: reconstructCaptures(truth).map((c) => ({ ...c, combo: `${name}:${c.combo}` })), controls: truth.controls,
    uaControls: truth.uaControls ?? {}, uaBaselineBrowser: String(truth._provenance.uaBaselineBrowser), allProps: truth._provenance.channels,
    stylesheetSkips: [], browserVersion: String(truth._provenance.browser), fontChecks: {}, pinnedAnimations: [], shadowHostTrails: {},
    textFillFolds: {}, closedShadowSuspects: {}, quarantined: [] } as SweepResult;
  const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix), promotion = promoteAnatomy(space, comp, aligned.union, name.toLowerCase());
  const styled = styledChannels(aligned, space, Object.fromEntries(Object.entries(truth.controls).map(([tag, n]) => [tag, n.style])), sweep.allProps, [],
    { viewport: cfg.browser.viewport, stage: stageFor(cfg, comp), portaled: false }, uaStyles(truth));
  const layout = enrichLayout(aligned, space, styled, promotion.contract);
  const prep = prepareMint(aligned, comp, space, styled, detectFolds(aligned, styled, []), layout.handled, promotion.contract,
    new Set([...promotion.consumed].map((i) => aligned.partNames[i])), new Set(promotion.partIndex.keys()), promotion.gridMintRefusals);
  return prep.declared.filter((d) => d.channel === channel && d.when).map((d) => `${d.part}=${d.value}@${d.when!.prop}=${d.when!.equals}`);
}

test('fuse carries a display or position that varies on one enum axis as per-value rules (committed captures)', () => {
  // display none included: each glyph is hidden in the states it does not draw (the check, the indeterminate dash).
  assert.deepEqual(byAxis('astryx.json', 'CheckboxInput', 'astryx/checkboxinput', 'display'), ['icon=none@checked=unchecked', 'icon=block@checked=checked',
    'icon=none@checked=indeterminate', 'part-0-0-1-1=none@checked=unchecked', 'part-0-0-1-1=none@checked=checked', 'part-0-0-1-1=block@checked=indeterminate']);
  assert.deepEqual(byAxis('astryx.json', 'Switch', 'astryx/switch', 'position'),
    ['part-0-0=static@labelPosition=start', 'part-0-0=relative@labelPosition=end', 'part-0-1=relative@labelPosition=start', 'part-0-1=static@labelPosition=end']);
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

test('a part absolutely placed in one enum value takes no row space there and stays in flow in the others', () => {
  const contract = ContractSchema.parse({
    id: 'test.position-by-axis', name: 'PositionByAxis', version: '0.1.0', status: 'draft', description: 'A glyph placed by one prop',
    states: [], semantics: { element: 'button' },
    props: [{ name: 'kind', type: { enum: ['primary', 'ghost'] }, default: 'primary',
      bindings: { code: { prop: 'kind' }, figma: { kind: 'VARIANT', property: 'kind', values: { primary: 'primary', ghost: 'ghost' } } } }],
    anatomy: { root: { layout: { display: 'flex' }, parts: { label: { text: 'Add' },
      glyph: { literals: { width: '16px', height: '16px', top: '11px', right: '16px', 'background-color': '#000000' },
        stylesWhen: [{ prop: 'kind', equals: 'primary', styles: { position: 'absolute' } }] } } } },
    bindings: { code: { anchors: { importPath: 'test/PositionByAxis', export: 'PositionByAxis' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
  const variants = (engine.compileComponentData(contract, new Map([[contract.id, contract]])) as any).variants;
  const glyph = (name: string) => variants.find((v: any) => v.name === name).spec.children.find((c: any) => c.name === 'glyph');
  assert.ok(glyph('kind=primary').absolute, 'primary: placed out of flow');
  assert.equal(glyph('kind=ghost').absolute, undefined, 'ghost: in flow');
});
