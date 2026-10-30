import assert from 'node:assert/strict';
import test from 'node:test';
import { proposeBatchFromDump, proposeFromDump, restoreSemanticsOrigins, semanticsOriginSnapshot, settleInteractiveContent } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { ContractSchema } from '../scripts/contract-schema.js';

test('a re-rooted switch stays in the tab order so its focus ring can be reached', () => {
  const text = {
    name: 'Label', type: 'TEXT',
    text: { characters: 'Switch Text', fontSize: 14, fontFamily: 'Inter', fontWeight: 400, lineHeight: 20, textAlign: 'LEFT', textAutoResize: 'WIDTH_AND_HEIGHT', letterSpacing: 0 },
    fill: { hex: '27272a' },
  };
  const variant = (state: string) => ({
    name: `State=${state}`, type: 'COMPONENT', variantProperties: { State: state },
    bbox: { width: 120, height: 24 },
    layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 8, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' },
    children: [text, { name: 'Track', type: 'FRAME', fill: { hex: 'e4e4e7' }, fixedSize: { width: 36, height: 20 } }],
  });
  const result = proposeFromDump({
    setName: 'Switch', type: 'COMPONENT_SET',
    propertyDefinitions: { State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Focus'] } },
    variants: [variant('Default'), variant('Focus')],
  } as never, {
    corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    mintUnbound: true, contractIdByName: new Map(), projectionMode: 'reviewable-inversion',
  });
  const contract = ContractSchema.parse(result.contract);
  assert.equal(contract.semantics.element, 'div');
  assert.equal(contract.anatomy.root.attrs?.role, undefined);
  assert.equal(contract.anatomy.root.attrs?.tabIndex, '0');
});

test('a withheld button stays in the tab order when it draws a focus ring', () => {
  const button = {
    setName: 'Button', type: 'COMPONENT', nodeId: '2:1', key: 'button-key',
    variants: [{
      name: 'Button', type: 'COMPONENT', nodeId: '2:1', bbox: { width: 40, height: 20 },
      layout: { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [4, 8, 4, 8], primarySizing: 'AUTO', counterSizing: 'AUTO' },
      children: [{ name: 'Label', type: 'TEXT', text: { characters: 'Go', fontSize: 14, fontFamily: 'Inter', fontWeight: 500, lineHeight: 20, textAlign: 'CENTER' }, fill: { hex: 'ffffff' } }],
    }],
  };
  const row = (state: string, fill: string) => ({
    name: `State=${state}`, type: 'COMPONENT', variantProperties: { State: state },
    bbox: { width: 80, height: 32 }, fill: { hex: fill },
    layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 8, padding: [4, 8, 4, 8], primarySizing: 'AUTO', counterSizing: 'AUTO' },
    children: [{ name: 'Button', type: 'INSTANCE', instanceOf: 'Button', instanceSetKey: 'button-key', bbox: { width: 40, height: 20 } }],
  });
  const batch = proposeBatchFromDump({
    Button: button,
    'Panel Trigger': {
      setName: 'Panel Trigger', type: 'COMPONENT_SET', nodeId: '3:1', key: 'panel-key',
      propertyDefinitions: { State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Focus'] } },
      variants: [row('Default', 'ffffff'), row('Focus', 'eff6ff')],
    },
  }, {
    corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    mintUnbound: true, contractIdByName: new Map(), projectionMode: 'reviewable-inversion',
  });
  const proposal = batch.proposals.find((item) => item.setName === 'Panel Trigger');
  assert.ok(proposal, batch.skipped.map((item) => item.reason).join('\n'));
  const contract = ContractSchema.parse(proposal.contract);
  assert.equal(contract.semantics.element, 'div');
  assert.equal(contract.anatomy.root.attrs?.tabIndex, '0');
});

test('a replaced contract still withholds a button that contains a button', () => {
  const opts = {
    corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    mintUnbound: true, contractIdByName: new Map(), projectionMode: 'reviewable-inversion' as const, fileKey: 'fixture',
  };
  const button = proposeFromDump({
    setName: 'Button', type: 'COMPONENT', nodeId: '2:1', key: 'button-key',
    variants: [{
      name: 'Button', type: 'COMPONENT', nodeId: '2:1', bbox: { width: 40, height: 20 },
      layout: { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [4, 8, 4, 8], primarySizing: 'AUTO', counterSizing: 'AUTO' },
      children: [{ name: 'Label', type: 'TEXT', text: { characters: 'Go', fontSize: 14, fontFamily: 'Inter', fontWeight: 500, lineHeight: 20, textAlign: 'CENTER' }, fill: { hex: 'ffffff' } }],
    }],
  } as never, opts);
  const row = (state: string, fill: string) => ({
    name: `State=${state}`, type: 'COMPONENT', variantProperties: { State: state },
    bbox: { width: 80, height: 32 }, fill: { hex: fill },
    layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 8, padding: [4, 8, 4, 8], primarySizing: 'AUTO', counterSizing: 'AUTO' },
    children: [{ name: 'Button', type: 'INSTANCE', instanceOf: 'Button', instanceSetKey: 'button-key', bbox: { width: 40, height: 20 } }],
  });
  const parent = proposeFromDump({
    setName: 'Panel Trigger', type: 'COMPONENT_SET', nodeId: '3:1', key: 'panel-key',
    propertyDefinitions: { State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Focus'] } },
    variants: [row('Default', 'ffffff'), row('Focus', 'eff6ff')],
  } as never, {
    ...opts,
    contractIdByName: new Map([['Button', button.contract.id as string]]),
    contractIdByKey: new Map([['button-key', button.contract.id as string]]),
    contractsById: new Map([[button.contract.id, button.contract]]) as never,
  });
  assert.equal((parent.contract as {semantics: {element: string}}).semantics.element, 'button');
  const saved = semanticsOriginSnapshot([parent]);
  parent.contract = ContractSchema.parse(parent.contract);
  restoreSemanticsOrigins([parent], saved);
  settleInteractiveContent(
    [parent, button] as never,
    new Map<string, unknown>([[button.contract.id as string, button.contract], [parent.contract.id as string, parent.contract]]),
  );
  assert.equal((parent.contract as {semantics: {element: string}}).semantics.element, 'div');
});

test('a button that contains a focusable div is proposed as a div', () => {
  const box = {
    setName: 'Switch', type: 'COMPONENT_SET', nodeId: '4:1', key: 'switch-key',
    propertyDefinitions: { State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Focus'] } },
    variants: ['Default', 'Focus'].map((state) => ({
      name: `State=${state}`, type: 'COMPONENT', variantProperties: { State: state },
      bbox: { width: 36, height: 20 },
      layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'FIXED', counterSizing: 'FIXED' },
      children: [{ name: 'Track', type: 'FRAME', fill: { hex: 'e4e4e7' }, fixedSize: { width: 36, height: 20 } }],
    })),
  };
  const row = (state: string) => ({
    name: `State=${state}`, type: 'COMPONENT', variantProperties: { State: state },
    bbox: { width: 160, height: 32 },
    layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 8, padding: [4, 8, 4, 8], primarySizing: 'AUTO', counterSizing: 'AUTO' },
    children: [
      { name: 'Switch', type: 'INSTANCE', instanceOf: 'Switch', instanceSetKey: 'switch-key', bbox: { width: 36, height: 20 } },
      { name: 'Label', type: 'TEXT', text: { characters: 'Item', fontSize: 14, fontFamily: 'Inter', fontWeight: 400, lineHeight: 20, textAlign: 'LEFT' }, fill: { hex: '18181b' } },
    ],
  });
  const batch = proposeBatchFromDump({
    Switch: box,
    'Menu Item': {
      setName: 'Menu Item', type: 'COMPONENT_SET', nodeId: '5:1', key: 'item-key',
      propertyDefinitions: { State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Hover'] } },
      variants: [row('Default'), row('Hover')],
    },
  }, {
    corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    mintUnbound: true, contractIdByName: new Map(), projectionMode: 'reviewable-inversion',
  });
  const boxProposal = batch.proposals.find((item) => item.setName === 'Switch');
  const item = batch.proposals.find((entry) => entry.setName === 'Menu Item');
  assert.ok(boxProposal && item, batch.skipped.map((entry) => entry.reason).join('\n'));
  assert.equal(ContractSchema.parse(boxProposal.contract).anatomy.root.attrs?.tabIndex, '0');
  assert.equal(ContractSchema.parse(item.contract).semantics.element, 'div');
});
