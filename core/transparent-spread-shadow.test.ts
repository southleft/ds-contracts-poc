import assert from 'node:assert/strict';
import test from 'node:test';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
const text = {
  name: 'Label', type: 'TEXT',
  text: { characters: '1', fontSize: 14, fontFamily: 'Inter', fontWeight: 400, lineHeight: 20, textAlign: 'LEFT', textAutoResize: 'WIDTH_AND_HEIGHT', letterSpacing: 0 },
  fill: { hex: '27272a' },
};
const layout = { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'FIXED', counterSizing: 'FIXED' };
const hard = { type: 'DROP_SHADOW', color: { hex: '2563eb', alpha: 0.5 }, offset: { x: 0, y: 0 }, radius: 0, spread: 3 };
const blur = { type: 'DROP_SHADOW', color: { hex: '000000', alpha: 0.05 }, offset: { x: 0, y: 1 }, radius: 2 };

function propose(fill: { hex: string; alpha?: number }) {
  const variant = (name: string, state: string, effects: unknown[]) => ({
    name, type: 'COMPONENT', variantProperties: { State: state }, bbox: { width: 36, height: 36 }, layout, fill, effects, children: [text],
  });
  return proposeFromDump({
    setName: 'PageItem', type: 'COMPONENT_SET',
    propertyDefinitions: { State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Focus', 'Active'] } },
    variants: [
      variant('State=Default', 'Default', []),
      variant('State=Focus', 'Focus', [hard]),
      variant('State=Active', 'Active', [blur]),
    ],
  } as never, { corpus, contractIdByName: new Map(), mintUnbound: true, fileKey: 'fixture', projectionMode: 'reviewable-inversion' });
}

test('a zero-blur spread on a transparent fill is not a box-shadow ring, and a blurred shadow still is', () => {
  const transparent = propose({ hex: 'ffffff', alpha: 0 });
  const minted = JSON.stringify(transparent.mintedTokens?.tree ?? {});
  assert.equal(minted.includes('0px 0px 0px 3px'), false);
  assert.equal(minted.includes('0px 1px 2px'), true);
  assert.ok(transparent.notes.some(note => note.includes('zero-blur spread shadow on a transparent fill')));

  const opaque = JSON.stringify(propose({ hex: 'e4e4e7' }).mintedTokens?.tree ?? {});
  assert.equal(opaque.includes('0px 0px 0px 3px'), true);
});
