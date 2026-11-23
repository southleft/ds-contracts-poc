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

test('normal-letter-spacing-is-zero and text-decoration-line-by-axis-drawn: a spacing and an underline that vary on one axis are carried', () => {
  // Carbon's Link, replayed on Polaris Tag's committed capture: the root is spaced 0.32px and underlined in the large
  // size, and computes `normal` and `none` in the other.
  const cfg = loadConfig(repo, path.join(repo, 'extract/computed/configs/polaris.json')), comp = cfg.components.find((c) => c.name === 'Tag')!;
  const truth = JSON.parse(readFileSync(path.join(repo, 'extract/computed/out/tag/captured-truth.json'), 'utf8')) as CapturedTruthFile;
  const space = propSpaceFor(repo, cfg, comp), captures = reconstructCaptures(truth).map((c) => ({ ...c, combo: `Tag:${c.combo}` }));
  for (const c of captures) c.root = { ...c.root, style: { ...c.root.style, ...(c.combo.startsWith('Tag:large.')
    ? { 'letter-spacing': '0.32px', 'text-decoration-line': 'underline' } : { 'letter-spacing': 'normal', 'text-decoration-line': 'none' }) } };
  const sweep = { captures, controls: truth.controls, uaControls: truth.uaControls ?? {}, uaBaselineBrowser: String(truth._provenance.uaBaselineBrowser),
    allProps: truth._provenance.channels, stylesheetSkips: [], browserVersion: String(truth._provenance.browser), fontChecks: {}, pinnedAnimations: [],
    shadowHostTrails: {}, textFillFolds: {}, closedShadowSuspects: {}, quarantined: [] } as SweepResult;
  const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix), promotion = promoteAnatomy(space, comp, aligned.union, 'tag');
  const styled = styledChannels(aligned, space, Object.fromEntries(Object.entries(truth.controls).map(([tag, n]) => [tag, n.style])), sweep.allProps, [],
    { viewport: cfg.browser.viewport, stage: stageFor(cfg, comp), portaled: false }, uaStyles(truth));
  const layout = enrichLayout(aligned, space, styled, promotion.contract);
  const prep = (on: boolean) => prepareMint(aligned, comp, space, styled, detectFolds(aligned, styled, []), layout.handled, promotion.contract,
    new Set([...promotion.consumed].map((i) => aligned.partNames[i])), new Set(promotion.partIndex.keys()), promotion.gridMintRefusals, false,
    { normalLetterSpacingZero: on, textDecorationByAxis: on });
  const facts = (p: ReturnType<typeof prep>) => ({
    spacing: p.baseObs.filter((o) => o.part === '' && o.cssProperty === 'letter-spacing').map((o) => [...new Set(o.occurrences.map((x) => `${x.axisValues.size}=${x.value}`))].sort()),
    underline: p.declared.filter((d) => d.part === 'root' && d.channel === 'text-decoration').map((d) => `${d.value}@${d.when?.prop}=${d.when?.equals}`),
    codeOnly: p.codeOnly.filter((c) => ['', 'root'].includes(c.part) && /^(letter-spacing|text-decoration-line)$/.test(c.channel)).map((c) => c.channel).sort() });
  // On: the spacing mints per size, normal as 0; the underline rides one rule for the size that draws it.
  assert.deepEqual(facts(prep(true)), { spacing: [['large=0.32', 'none=0']], underline: ['underline@size=large'], codeOnly: [] });
  // Off: both are code-only.
  assert.deepEqual(facts(prep(false)), { spacing: [], underline: [], codeOnly: ['letter-spacing', 'text-decoration-line'] });
});

test('text-decoration-line-by-axis-drawn: the writer draws a per-value underline in that value only', () => {
  const contract = ContractSchema.parse({
    id: 'test.underline-by-axis', name: 'UnderlineByAxis', version: '0.1.0', status: 'draft', description: 'A link underlined by one prop',
    states: [], semantics: { element: 'a' },
    props: [{ name: 'size', type: { enum: ['sm', 'inline'] }, default: 'sm',
      bindings: { code: { prop: 'size' }, figma: { kind: 'VARIANT', property: 'size', values: { sm: 'sm', inline: 'inline' } } } }],
    anatomy: { root: { text: 'Link', stylesWhen: [{ prop: 'size', equals: 'inline', styles: { 'text-decoration': 'underline' } }] } },
    bindings: { code: { anchors: { importPath: 'test/UnderlineByAxis', export: 'UnderlineByAxis' } }, figma: { anchors: { fileKey: null, componentSetKey: null } } },
  });
  const drawn = (conventions: string[]) => {
    const engine = createFigmaEngine({ tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map(), conventions: new Set(conventions) as never });
    const find = (s: any): any => s.type === 'text' ? s : (s.children ?? []).map(find).find(Boolean);
    return (engine.compileComponentData(contract, new Map([[contract.id, contract]])) as any).variants.map((v: any) => [v.name, find(v.spec)?.textDecoration ?? null]);
  };
  assert.deepEqual(drawn(['text-decoration-line-by-axis-drawn']), [['size=sm', null], ['size=inline', 'UNDERLINE']]);
  assert.deepEqual(drawn([]), [['size=sm', null], ['size=inline', null]]);
});
