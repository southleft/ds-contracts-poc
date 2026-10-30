import assert from 'node:assert/strict';
import test from 'node:test';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { ContractSchema, walkAnatomy } from '../scripts/contract-schema.js';

test('a column fill still gets width 100% when another variant of the parent is a row', () => {
  const child = (fill: boolean) => ({
    name: 'Bars', type: 'FRAME', ...(fill ? { fillWidth: true } : {}),
    layout: { mode: 'VERTICAL', primary: 'MIN', counter: 'MIN', spacing: 8, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' },
    children: [{ name: 'Line', type: 'FRAME', fill: { hex: 'f4f0fa' }, fixedSize: { width: 150, height: 16 } }],
  });
  const variant = (state: string, mode: 'HORIZONTAL' | 'VERTICAL') => ({
    name: `Variant=${state}`, type: 'COMPONENT', variantProperties: { Variant: state },
    bbox: { width: mode === 'VERTICAL' ? 334 : 206, height: mode === 'VERTICAL' ? 398 : 40 },
    layout: {
      mode, primary: 'MIN', counter: 'MIN', spacing: 8, padding: [0, 0, 0, 0],
      primarySizing: 'AUTO', counterSizing: mode === 'VERTICAL' ? 'FIXED' : 'AUTO',
    },
    children: [child(mode === 'VERTICAL')],
  });
  const result = proposeFromDump({
    setName: 'Skeleton', type: 'COMPONENT_SET',
    propertyDefinitions: { Variant: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Card'] } },
    variants: [variant('Default', 'HORIZONTAL'), variant('Card', 'VERTICAL')],
  } as never, {
    corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    mintUnbound: true, contractIdByName: new Map(), projectionMode: 'reviewable-inversion',
  });
  const contract = ContractSchema.parse(result.contract);
  const bars = walkAnatomy(contract).find((row) => row.name === 'Bars')!.part;
  const align = bars.layoutByProp?.map.card?.alignSelf;
  assert.equal(align, 'stretch');
  assert.equal(bars.layoutByProp?.map.default?.alignSelf, 'auto');
});

test('a centered column keeps that alignment when a fixed sibling sits beside a filling frame', () => {
  const result = proposeFromDump({
    setName: 'Drop', type: 'COMPONENT',
    variants: [{
      name: 'Drop', type: 'COMPONENT', bbox: { width: 320, height: 160 },
      layout: { mode: 'VERTICAL', primary: 'MIN', counter: 'CENTER', spacing: 16, padding: [16, 16, 16, 16], primarySizing: 'AUTO', counterSizing: 'FIXED' },
      children: [
        { name: 'Mark', type: 'RECTANGLE', fill: { hex: 'dddddd' }, fixedSize: { width: 32, height: 32 } },
        {
          name: 'Copy', type: 'FRAME', fillWidth: true,
          layout: { mode: 'VERTICAL', primary: 'MIN', counter: 'CENTER', spacing: 4, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'FIXED' },
          children: [{ name: 'Title', type: 'TEXT', fill: { hex: '111111' }, text: { characters: 'Upload', fontSize: 16, lineHeight: 24, fontFamily: 'Inter', fontWeight: 500, textAlign: 'CENTER' } }],
        },
      ],
    }],
  } as never, {
    corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    mintUnbound: true, contractIdByName: new Map(), projectionMode: 'reviewable-inversion',
  });
  const contract = ContractSchema.parse(result.contract);
  assert.equal(contract.anatomy.root.layout?.align, 'center');
  const copy = walkAnatomy(contract).find((row) => row.name === 'Copy')!.part;
  assert.equal(copy.layout?.alignSelf, 'stretch');
});
