import assert from 'node:assert/strict';
import test from 'node:test';
import { proposeBatchFromDump, proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { ContractSchema } from '../scripts/contract-schema.js';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
const opts = { corpus, contractIdByName: new Map(), mintUnbound: true, fileKey: 'fixture', projectionMode: 'reviewable-inversion' as const };
const text = {
  name: 'Label', type: 'TEXT',
  text: { characters: 'Badge', fontSize: 12, fontFamily: 'Inter', fontWeight: 600, lineHeight: 16, textAlign: 'LEFT', textAutoResize: 'WIDTH_AND_HEIGHT', letterSpacing: 0 },
  fill: { hex: 'ffffff' },
};
const hug = { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [2, 8, 2, 8], primarySizing: 'AUTO', counterSizing: 'AUTO' };

test('a focus instance keeps its linked main outside stroke outside the fill ring', () => {
  const ring = {
    setName: 'Ring', type: 'COMPONENT', key: 'ring-key',
    variants: [{
      name: 'Ring', type: 'COMPONENT', componentKey: 'ring-key', bbox: { width: 61, height: 24 },
      fill: { hex: '60a5fa' }, opacity: 0.5,
      children: [{ name: 'Ring', type: 'RECTANGLE', sourceEmptyFill: true, stroke: { hex: '2563eb' }, strokeAlign: 'OUTSIDE', strokeWeight: 1 }],
    }],
  };
  const ringNode = (fill: string, stroke?: string) => ({
    name: 'Ring', type: 'INSTANCE', instanceOf: 'Ring', instanceKey: 'ring-key', opacity: 0.5,
    fill: { hex: fill }, cornerRadius: 8,
    abs: { x: -1, y: -1, right: -1, bottom: -1, width: 55, height: 22, constraints: { horizontal: 'STRETCH', vertical: 'STRETCH' } },
    ...(stroke ? { hostOverrides: [{ path: 'Ring', fields: ['strokes', 'strokeWeight'], stroke: { hex: stroke }, strokeWeight: 1 }] } : {}),
  });
  const variant = (name: string, state: string, fill: string, children: unknown[]) => ({
    name, type: 'COMPONENT', variantProperties: { Variant: 'Default', State: state },
    bbox: { width: 53, height: 20 }, layout: hug, fill: { hex: fill }, children,
  });
  const badge = {
    setName: 'Chip', type: 'COMPONENT_SET',
    propertyDefinitions: {
      Variant: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default'] },
      State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Focus'] },
    },
    variants: [
      variant('Variant=Default, State=Default', 'Default', 'ff00aa', [text]),
      variant('Variant=Default, State=Focus', 'Focus', 'ff00aa', [ringNode('60a5fa'), text]),
    ],
  };
  const minted = JSON.stringify(proposeBatchFromDump({ Ring: ring, Chip: badge } as never, opts).proposals.find((row) => row.setName === 'Chip')?.mintedTokens?.tree ?? {});
  assert.equal(minted.includes('0px 0px 0px 1px #60a5fa80'), true);
  assert.equal(minted.includes('#2563eb80'), true);

  const swapped = {
    ...badge,
    variants: [
      variant('Variant=Default, State=Default', 'Default', 'be123c', [text]),
      variant('Variant=Default, State=Focus', 'Focus', 'be123c', [ringNode('2563eb', '60a5fa'), text]),
    ],
  };
  const swappedMint = JSON.stringify(proposeBatchFromDump({ Ring: ring, Chip: swapped } as never, opts).proposals.find((row) => row.setName === 'Chip')?.mintedTokens?.tree ?? {});
  assert.equal(swappedMint.includes('0px 0px 0px 1px #2563eb80'), true);
  assert.equal(swappedMint.includes('#60a5fa80'), true);
});

test('a focus state that hugs releases the resting fixed height', () => {
  const fixed = { ...hug, counterSizing: 'FIXED' };
  const variant = (name: string, values: Record<string, string>, height: number, layout: typeof hug) => ({
    name, type: 'COMPONENT', variantProperties: values, bbox: { width: 53, height }, layout, fill: { hex: 'f4f4f5' }, children: [text],
  });
  const result = proposeFromDump({
    setName: 'Chip', type: 'COMPONENT_SET',
    propertyDefinitions: {
      Variant: { type: 'VARIANT', defaultValue: 'Secondary', variantOptions: ['Secondary'] },
      State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Focus'] },
    },
    variants: [
      variant('Variant=Secondary, State=Default', { Variant: 'Secondary', State: 'Default' }, 17, fixed),
      variant('Variant=Secondary, State=Focus', { Variant: 'Secondary', State: 'Focus' }, 20, hug),
    ],
  } as never, opts);
  const minted = JSON.stringify(result.mintedTokens?.tree ?? {});
  assert.equal(minted.includes('"height"'), true);
  assert.equal(minted.includes('17px'), true);
  assert.equal(minted.includes('20px'), true);
  assert.ok(result.notes.some((note) => note.includes('releases a fixed height')));
});

test('a fixed focus width replaces the resting width', () => {
  const fixed = { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', spacing: 12, padding: [0, 0, 0, 0], primarySizing: 'FIXED', counterSizing: 'AUTO' };
  const variant = (placement: string, state: string, width: number, height: number) => ({
    name: `Control Placement=${placement}, State=${state}`, type: 'COMPONENT',
    variantProperties: { 'Control Placement': placement, State: state },
    bbox: { width, height }, layout: fixed, fill: { hex: '000000', alpha: 0 }, children: [text],
  });
  const result = proposeFromDump({
    setName: 'Radio', type: 'COMPONENT_SET',
    propertyDefinitions: {
      'Control Placement': { type: 'VARIANT', defaultValue: 'Start', variantOptions: ['Start', 'End'] },
      State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Focus'] },
    },
    variants: [
      variant('Start', 'Default', 202, 41),
      variant('End', 'Default', 193, 61),
      variant('Start', 'Focus', 197, 61),
      variant('End', 'Focus', 193, 61),
    ],
  } as never, opts);
  const width = (result.contract as { anatomy: { root: { states?: Record<string, Record<string, string>> } } }).anatomy.root.states?.['focus-visible']?.width;
  assert.equal(typeof width, 'string');
  const minted = JSON.stringify(result.mintedTokens?.tree ?? {});
  assert.equal(minted.includes('197px'), true);
  assert.equal(minted.includes('202px'), true);
  assert.ok(result.notes.some((note) => note.includes('carried as a state width')));
});

test('a square swap spun in place rotates on its variant axis', () => {
  const icon = (spin: string, transform: number[][]) => ({
    name: 'Icon', type: 'INSTANCE', propRefs: { mainComponent: 'Icon' }, instanceOf: 'Glyph', instanceKey: 'glyph-key',
    bbox: { width: 20, height: 20 },
    instanceGeometry: { nodeId: 'icon-' + spin, componentId: 'glyph', transform, localSize: { width: 20, height: 20 } },
  });
  const variant = (spin: string, transform: number[][]) => ({
    name: `Spin=${spin}`, type: 'COMPONENT', variantProperties: { Spin: spin },
    bbox: { width: 20, height: 20 },
    layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'FIXED', counterSizing: 'FIXED' },
    children: [icon(spin, transform)],
  });
  const result = proposeFromDump({
    setName: 'Spinner', type: 'COMPONENT_SET',
    propertyDefinitions: { Spin: { type: 'VARIANT', defaultValue: '0', variantOptions: ['0', '90'] } },
    variants: [
      variant('0', [[1, 0, 0], [0, 1, 0]]),
      variant('90', [[1.8144533638128743e-16, -1.0000001192092896, 20], [1.0000001192092896, 1.8144525697194862e-16, 0.00000506355627294397]]),
    ],
  } as never, opts);
  const part = Object.values((result.contract as { anatomy: { root: { parts: Record<string, { stylesWhen?: Array<{ prop: string; equals: string; styles: { transform: string } }> }> } } }).anatomy.root.parts)[0];
  assert.deepEqual(part.stylesWhen, [{ prop: 'spin', equals: '90', styles: { transform: 'rotate(90deg)' } }]);
});

test('centered glyphs in a filled text box keep that alignment', () => {
  const text = {
    characters: 'Head Text', fontSize: 14, lineHeight: 20, fontFamily: 'Inter', fontWeight: 500,
    textAlign: 'LEFT', verticalAlign: 'CENTER', textAutoResize: 'NONE',
  };
  const result = proposeFromDump({
    setName: 'Head', type: 'COMPONENT_SET',
    propertyDefinitions: { State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default'] } },
    variants: [{
      name: 'State=Default', type: 'COMPONENT', variantProperties: { State: 'Default' },
      bbox: { width: 185, height: 40 },
      layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 10, padding: [0, 8, 0, 8], primarySizing: 'FIXED', counterSizing: 'FIXED' },
      children: [
        { name: 'Mark', type: 'RECTANGLE', bbox: { width: 16, height: 16 }, fill: { hex: 'e4e4e7' } },
        { name: 'Label', type: 'TEXT', fillWidth: true, fillHeight: true, text },
      ],
    }],
  } as never, opts);
  const parts = (result.contract as { anatomy: { root: { parts: Record<string, { layout?: { align?: string } }> } } }).anatomy.root.parts;
  const label = Object.values(parts).find((part) => part.layout?.align);
  assert.equal(label?.layout?.align, 'center');
});

test('an underline that needs variant and size lands on that combination only', () => {
  const row = (variant: string, size: string, state: string, underline: boolean) => ({
    name: `Variant=${variant}, Size=${size}, State=${state}`, type: 'COMPONENT',
    variantProperties: { Variant: variant, Size: size, State: state },
    bbox: { width: 65, height: 28 },
    layout: { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [4, 8, 4, 8], primarySizing: 'AUTO', counterSizing: 'AUTO' },
    children: [{
      name: 'Label', type: 'TEXT', fill: { hex: '18181b' },
      text: { characters: 'Button', fontSize: 14, lineHeight: 20, fontFamily: 'Inter', fontWeight: 500, textAlign: 'LEFT', ...(underline ? { textDecoration: 'UNDERLINE' } : {}) },
    }],
  });
  const result = proposeFromDump({
    setName: 'LinkButton', type: 'COMPONENT_SET',
    propertyDefinitions: {
      Variant: { type: 'VARIANT', defaultValue: 'Link', variantOptions: ['Link', 'Ghost'] },
      Size: { type: 'VARIANT', defaultValue: 'sm', variantOptions: ['sm', 'xs'] },
      State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Loading'] },
    },
    variants: [
      row('Link', 'sm', 'Default', true), row('Link', 'xs', 'Default', false),
      row('Ghost', 'sm', 'Default', false), row('Ghost', 'xs', 'Default', false),
      row('Link', 'sm', 'Loading', false), row('Link', 'xs', 'Loading', false),
      row('Ghost', 'sm', 'Loading', false), row('Ghost', 'xs', 'Loading', false),
    ],
  } as never, opts);
  const parts = (result.contract as { anatomy: { root: { parts?: Record<string, { literalsByCombination?: Array<{ props: string[]; rows: Array<{ values: string[]; literals: Record<string, string> }> }> }> } } }).anatomy.root.parts ?? {};
  const tables = Object.values(parts).flatMap((part) => part.literalsByCombination ?? []);
  const rowMatch = tables.flatMap((table) => table.rows).find((entry) => entry.literals['text-decoration'] === 'underline');
  assert.ok(rowMatch);
  assert.ok(rowMatch.values.includes('link') && rowMatch.values.includes('sm') && rowMatch.values.includes('default'));
  assert.equal(rowMatch.literals['text-underline-position'], 'under');
});

test('a uniform hover underline joins a drawn hover state; a per-size one is named', () => {
  const row = (size: string, state: string, underline: boolean) => ({
    name: `Size=${size}, State=${state}`, type: 'COMPONENT',
    variantProperties: { Size: size, State: state },
    bbox: { width: 65, height: 28 },
    layout: { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [4, 8, 4, 8], primarySizing: 'AUTO', counterSizing: 'AUTO' },
    children: [{
      name: 'Label', type: 'TEXT', fill: { hex: '18181b' },
      text: { characters: 'Button', fontSize: 14, lineHeight: 20, fontFamily: 'Inter', fontWeight: 500, textAlign: 'LEFT', ...(underline ? { textDecoration: 'UNDERLINE' } : {}) },
    }],
  });
  const result = proposeFromDump({
    setName: 'LinkButton', type: 'COMPONENT_SET',
    propertyDefinitions: {
      Size: { type: 'VARIANT', defaultValue: 'sm', variantOptions: ['sm', 'xs'] },
      State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Hover'] },
    },
    variants: [row('sm', 'Default', false), row('xs', 'Default', false), row('sm', 'Hover', true), row('xs', 'Hover', false)],
  } as never, opts);
  const root = (result: { contract: unknown }) => (result.contract as { anatomy: { root: { states?: Record<string, Record<string, string>>; declaredStates?: Record<string, Record<string, string>> } } }).anatomy.root;
  assert.equal(root(result).states?.hover?.['text-decoration'], undefined);
  assert.equal(root(result).declaredStates?.hover?.['text-decoration-line'], undefined);
  assert.ok(result.notes.some((note) => /text decoration in state "hover" differs across variants .* NAMED, not proposed/.test(note)), result.notes.join('\n'));
  const uniform = proposeFromDump({
    setName: 'LinkButton', type: 'COMPONENT_SET',
    propertyDefinitions: {
      Size: { type: 'VARIANT', defaultValue: 'sm', variantOptions: ['sm', 'xs'] },
      State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Hover'] },
    },
    variants: [row('sm', 'Default', false), row('xs', 'Default', false), row('sm', 'Hover', true), row('xs', 'Hover', true)].map((variant) =>
      variant.variantProperties.State === 'Hover' ? { ...variant, fill: { hex: 'f4f4f5' } } : variant),
  } as never, opts);
  assert.equal(root(uniform).declaredStates?.hover?.['text-decoration-line'], 'underline');
  assert.equal(root(uniform).states?.hover?.['text-decoration'], undefined);
  ContractSchema.parse(uniform.contract);
});

test('a hover underline on some variants stays off the others', () => {
  const row = (variant: string, state: string, stroke: boolean) => ({
    name: `Variant=${variant}, State=${state}`, type: 'COMPONENT',
    variantProperties: { Variant: variant, State: state },
    bbox: { width: 80, height: 20 },
    layout: { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' },
    ...(stroke ? { stroke: { hex: 'ff00aa' }, strokeAlign: 'INSIDE', strokesIncludedInLayout: false, strokeWeights: { top: 0, right: 0, bottom: 1, left: 0 } } : {}),
    children: [{ name: 'Label', type: 'TEXT', fill: { hex: stroke ? 'ff00aa' : '71717a' }, text: { characters: 'Breadcrumb', fontSize: 14, lineHeight: 20, fontFamily: 'Inter', fontWeight: 400, textAlign: 'LEFT' } }],
  });
  const result = proposeFromDump({
    setName: 'Crumb', type: 'COMPONENT_SET',
    propertyDefinitions: {
      Variant: { type: 'VARIANT', defaultValue: 'Link', variantOptions: ['Link', 'Plain'] },
      State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Hover'] },
    },
    variants: [
      row('Link', 'Default', false), row('Plain', 'Default', false),
      row('Link', 'Hover', true), row('Plain', 'Hover', false),
    ],
  } as never, opts);
  const byProp = (result.contract as { anatomy: { root: { statesByProp?: Array<{ state: string; prop: string; map: Record<string, { 'box-shadow'?: string }> }> } } }).anatomy.root.statesByProp;
  const hover = byProp?.find((entry) => entry.state === 'hover' && entry.prop === 'variant');
  assert.match(hover?.map.link?.['box-shadow'] ?? '', /^\{imported\./);
  assert.equal(hover?.map.plain, undefined);
  assert.match(JSON.stringify(result.mintedTokens?.tree ?? {}), /inset 0px -1px 0px 0px #ff00aa/);
});
