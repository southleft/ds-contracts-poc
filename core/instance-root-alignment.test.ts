// Profile convention instance-root-alignment-carried (core/profile-conventions.ts). A bar stretches a hugging child
// instance to a fixed width and overrides its main's primary-axis alignment to MAX, so the child's content sits at the end
// of the stretched box. Off, the override is named as not modeled by root inputs and the content sits at the start; on,
// the usage carries rootAlignment { justify: end }, and the React root style places the content at the end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeBatchFromDump } from './propose-figma.js';
import { reactInstanceRootStyle } from './react-instance-root.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { walkAnatomy, ContractSchema } from '../scripts/contract-schema.js';

const row = (primary: string, primarySizing: string, padding: number) => ({ mode: 'HORIZONTAL', primary, counter: 'CENTER', spacing: 0, padding: [padding, padding, padding, padding], primarySizing, counterSizing: 'AUTO' });
const child = { setName: 'Finder', type: 'COMPONENT', key: 'finder-key', nodeId: '10:1', variants: [{ name: 'Finder', type: 'COMPONENT', nodeId: '10:1',
  bbox: { width: 48, height: 48 }, layout: row('MIN', 'AUTO', 16), fill: { hex: '112233' },
  children: [{ name: 'Dot', type: 'RECTANGLE', nodeId: '10:2', bbox: { width: 16, height: 16 }, fill: { hex: '445566' } }] }] };
const parent = { setName: 'Bar', type: 'COMPONENT_SET', key: 'bar-key', nodeId: '20:0',
  propertyDefinitions: { Size: { type: 'VARIANT', defaultValue: 'small', variantOptions: ['small', 'large'] } },
  variants: [120, 140].map((width, i) => ({ name: `Size=${['small', 'large'][i]}`, type: 'COMPONENT', nodeId: `20:${i}`, variantProperties: { Size: ['small', 'large'][i] },
    bbox: { width: 200, height: 48 }, layout: row('MIN', 'FIXED', 0), sourceEmptyFill: true,
    children: [{ name: 'Finder', type: 'INSTANCE', nodeId: `30:${i}`, instanceOf: 'Finder', instanceKey: 'finder-key', bbox: { width, height: 48 }, fill: { hex: '112233' },
      layout: row('MAX', 'FIXED', 16), instanceGeometry: { nodeId: `30:${i}`, componentId: '10:1', transform: [[1, 0, 0], [0, 1, 0]], localSize: { width, height: 48 } },
      instanceRootOverrides: { nodeId: `30:${i}`, componentId: '10:1', componentKey: 'finder-key', fields: ['width', 'primaryAxisAlignItems', 'primaryAxisSizingMode'],
        mainSize: { width: 48, height: 48 }, localSize: { width, height: 48 }, localTransform: [[1, 0, 0], [0, 1, 0]] } }] })) };
const propose = (conventions: string[]) => {
  const batch = proposeBatchFromDump({ Finder: child, Bar: parent } as never, { fileKey: 'file', stampsObservable: true, hiddenCaptured: true, mintUnbound: true,
    contractIdByName: new Map(), corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }), conventions });
  assert.deepEqual(batch.skipped, []);
  const result = batch.proposals.find(p => p.setName === 'Bar')!, contract = ContractSchema.parse(result.contract);
  return { result, contract, ref: walkAnatomy(contract).find(w => w.part.component)!.part };
};

test('off: the alignment override is named, and the usage carries no rootAlignment', () => {
  const { result, ref } = propose([]);
  assert.equal(ref.component!.rootAlignment, undefined);
  assert.ok(result.notes.some(n => /instance root override fields not modeled by root inputs: primaryAxisAlignItems/.test(n)), JSON.stringify(result.notes.filter(n => /root/.test(n))));
});

test('on: the usage carries rootAlignment { justify: end }, applied as the child root justify-content', () => {
  const { result, contract, ref } = propose(['instance-root-alignment-carried']);
  assert.deepEqual(ref.component!.rootAlignment, { justify: 'end' });
  assert.ok(result.notes.some(n => /instance root alignment \{"justify":"end"\} carried as rootAlignment/.test(n)));
  assert.equal(result.notes.some(n => /not modeled by root inputs: [^;]*primaryAxisAlignItems/.test(n)), false);
  assert.match(reactInstanceRootStyle(contract, ref, path => `var(--${path})`, name => name), /^"justifyContent": "flex-end"/);
});
