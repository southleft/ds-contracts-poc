// A ROOT AXIS DRAWN FIXED WITH NO CAPTURED BOX IS NAMED, NEVER GUESSED (docs/23 §D.163).
//
// invertRootFixedSize carries a FIXED root axis from the dump's bbox. A dump
// that predates v1.5 (the CBDS Alert gauntlet fixture, v14, 2026-07-10) says
// counterSizing FIXED and carries no box at all; the function returned early
// with no note, so the root silently sized to content and the Figma emitter
// later refused a zero-basis Fill child (D.138) with nothing upstream saying
// why no width existed. The loss is now a proposal note, and nothing is minted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import type { DumpNode, DumpSet } from '../extract/figma/types.js';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
const propose = (set: DumpSet) =>
  proposeFromDump(set, { corpus, contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
const variant = (name: string, extra: Partial<DumpNode>): DumpNode =>
  ({ name, type: 'COMPONENT', layout: { mode: 'VERTICAL', primary: 'MIN', counter: 'MIN', spacing: 4, padding: [16, 16, 16, 16], primarySizing: 'AUTO', counterSizing: 'FIXED' }, children: [], ...extra }) as DumpNode;
const set = (...variants: DumpNode[]): DumpSet => ({ setName: 'Panel', type: 'COMPONENT_SET', variants }) as unknown as DumpSet;
const rootOf = (contract: Record<string, unknown>) => (contract as { anatomy: { root: Record<string, unknown> } }).anatomy.root;
const noBox = (notes: string[]) => notes.filter((n) => n.includes('drawn FIXED with no captured box'));

test('a VERTICAL root drawn counterSizing FIXED with no box names the width loss and mints nothing', () => {
  const result = propose(set(variant('Tone=A', {}), variant('Tone=B', {})));
  assert.deepEqual(noBox(result.notes), [
    'Panel:root: width drawn FIXED with no captured box (FIXED in 2/2 variant occurrence(s)) — size not carried (re-capture with a current dump to carry it)',
  ]);
  const root = rootOf(result.contract);
  assert.equal(JSON.stringify(root.tokens ?? {}).includes('width'), false, 'no width is minted');
  assert.equal((root.literals as Record<string, string> | undefined)?.width, undefined, 'no width literal is guessed');
});

test('primarySizing FIXED names the height; a partially FIXED axis says on how many variants', () => {
  const fixedHeight = { mode: 'VERTICAL', primary: 'MIN', counter: 'MIN', primarySizing: 'FIXED', counterSizing: 'AUTO' };
  const result = propose(set(variant('Tone=A', { layout: fixedHeight } as never), variant('Tone=B', { layout: { ...fixedHeight, primarySizing: 'AUTO' } } as never)));
  assert.deepEqual(noBox(result.notes), [
    'Panel:root: height drawn FIXED with no captured box (FIXED in 1/2 variant occurrence(s)) — size not carried (re-capture with a current dump to carry it)',
  ]);
});

test('a captured box, a hug axis, a FILL axis and a bound dimension are not named as lost', () => {
  const boxed = propose(set(variant('Tone=A', { bbox: { width: 320, height: 80 } }), variant('Tone=B', { bbox: { width: 320, height: 80 } })));
  assert.deepEqual(noBox(boxed.notes), [], 'the bbox carries it');
  const hug = propose(set(variant('Tone=A', { layout: { mode: 'VERTICAL', primarySizing: 'AUTO', counterSizing: 'AUTO' } } as never)));
  assert.deepEqual(noBox(hug.notes), []);
  const fill = propose(set(variant('Tone=A', { fillWidth: true })));
  assert.deepEqual(noBox(fill.notes), [], 'FILL is spelled FIXED by the mode but is the container measure');
  const bound = propose(set(variant('Tone=A', { bound: { width: 'size/panel' } } as never)));
  assert.deepEqual(noBox(bound.notes), [], 'a bound width is carried by its variable');
});

test('the CBDS Alert v14 gauntlet fixture that exposed the loss now names its root width', () => {
  const dump = JSON.parse(readFileSync(new URL('../extract/figma/gauntlet/fixtures/visiblewhen-value-outside-prop-enum-alert.dump.json', import.meta.url), 'utf8'));
  const alert = dump.Alert as DumpSet;
  assert.equal(alert.variants.some((v) => (v as DumpNode).bbox !== undefined), false, 'the fixture carries no root box');
  const notes = noBox(propose(alert).notes);
  assert.equal(notes.length, 1);
  assert.match(notes[0], /^Alert:root: width drawn FIXED with no captured box \(FIXED in \d+\/\d+ variant occurrence\(s\)\) — size not carried/);
});
