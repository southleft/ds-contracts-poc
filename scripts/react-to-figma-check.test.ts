/** The React to Figma set rule (docs/GOAL.md "How numbers are counted"): a written set counts only when it is a
 * real component set against the reader's references. Fixtures only: no Figma, no Storybook. */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { DumpFile } from '../extract/figma/types.js';
import { setRule } from './react-to-figma-check.js';
import type { StoryComponent } from './storybook-reader.js';

const run = (text: string, opacity = 1) => ({ text, color: 'rgb(0, 0, 0)', family: 'Arimo', weight: '400', opacity });
const component = (tones = ['success', 'error'], extra: Partial<StoryComponent['references'][number]> = {}): StoryComponent => ({
  title: 'Content/Badge', stories: tones.length, storyId: 'badge--success', grammar: { grammar: 'in', reasons: [] },
  matrix: { status: 'ok', axes: ['tone'], variants: tones.length }, ownRender: [], repeats: [], renderFailed: [], faces: [],
  references: tones.map((tone) => ({ storyId: `badge--${tone}`, args: {}, variant: { tone }, png: `${tone}.png`,
    content: { text: tone, graphics: [], runs: [run(tone), run('hidden', 0)] }, ...extra })),
});
const solid = (bound: boolean) => ({ index: 0, paint: { type: 'SOLID', visible: true, color: { r: 0, g: 0, b: 0 }, ...(bound ? { boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'v' } } } : {}) } });
const text = (characters: string) => ({ name: 'label', type: 'TEXT', text: { characters }, sourceFillStack: { version: 1, order: 'bottom-to-top', complete: true, paints: [solid(true)] } });
const icon = { name: 'icon', type: 'FRAME', children: [{ name: 'path', type: 'VECTOR' }] };
const variant = (tone: string, children: unknown[] = [text(tone), icon], layout: unknown = { mode: 'HORIZONTAL' }) => ({ name: `tone=${tone}`, type: 'COMPONENT',
  variantProperties: { tone }, layout, children, sourceFillStack: { version: 1, order: 'bottom-to-top', complete: true, paints: [solid(false)] } });
const dump = (variants: unknown[], options = ['success', 'error']) => ({ Badge: { setName: 'Badge', type: 'COMPONENT_SET',
  propertyDefinitions: { tone: { type: 'VARIANT', variantOptions: options } }, variants } } as unknown as DumpFile);

test('a written set counts when it is the story matrix exactly, in auto layout outside drawings, with every drawn text editable', () => {
  const rule = setRule(component(), dump([variant('success'), variant('error')]), 'Badge');
  assert.deepEqual(rule.problems, []);
  assert.equal(rule.counts, true);
  assert.deepEqual(rule.variants.map((v) => [v.key, v.verdict]), [['tone=success', 'pending'], ['tone=error', 'pending']]);
  // Each variant's own fill is unbound, its text fill bound: reported, never gating.
  assert.deepEqual(rule.boundColors, { solid: 4, bound: 2 });
});

test('a set that fails the rule counts every expected variant as failed, and each failure is named', () => {
  const outlined = setRule(component(), dump([variant('success', [{ name: 'label', type: 'VECTOR' }, icon]), variant('error')]), 'Badge');
  assert.deepEqual(outlined.problems, ['text-not-editable:tone=success:"success"']);
  assert.deepEqual(outlined.variants.map((v) => v.verdict), ['fail', 'fail']);
  const freeForm = setRule(component(), dump([variant('success', [text('success'), icon], null), variant('error')]), 'Badge');
  assert.deepEqual(freeForm.problems, ['layout:free-form-frame']);
  const absolute = setRule(component(), dump([variant('success', [{ ...text('success'), abs: { x: 0, y: 0 } }, icon]), variant('error')]), 'Badge');
  assert.deepEqual(absolute.problems, ['layout:absolute-child']);
  const short = setRule(component(), dump([variant('success')], ['success']), 'Badge');
  assert.deepEqual(short.problems, ['options-differ:tone', 'variant-missing:tone=error']);
  const plain = dump([variant('success'), variant('error')]);
  (plain.Badge as { type: string }).type = 'COMPONENT';
  assert.deepEqual(setRule(component(), plain, 'Badge').problems, ['not-a-component-set']);
  assert.deepEqual(setRule(component(), dump([]), 'Missing').problems, ['set-missing:Missing']);
});

test('a reference the rule cannot read leaves only its own variant unverified', () => {
  const unread = component(['success', 'error'], { content: undefined, contentProblem: 'reference-content-not-one-container' });
  unread.references[1] = { ...unread.references[1]!, content: { text: 'error', graphics: [], runs: [run('error')] }, contentProblem: undefined };
  const rule = setRule(unread, dump([variant('success'), variant('error')]), 'Badge');
  assert.equal(rule.counts, true);
  assert.deepEqual(rule.variants.map((v) => [v.verdict, v.reasons]), [['unverified', ['text-unverified:reference-content-not-one-container']], ['pending', []]]);
  // An unreadable reference never shrinks what is expected: its variant stays in the matrix and the total.
  const lacking = setRule(unread, dump([variant('error')]), 'Badge');
  assert.deepEqual(lacking.problems, ['variant-missing:tone=success']);
  assert.deepEqual(lacking.variants.map((v) => [v.key, v.verdict]), [['tone=success', 'unverified'], ['tone=error', 'fail']]);
  const refused = { ...component(), matrix: { status: 'refused' as const, reason: 'variant-matrix-over-cap:72>64' }, references: [] };
  assert.deepEqual(setRule(refused, dump([]), 'Badge').problems, ['story-matrix-refused:variant-matrix-over-cap:72>64']);
});

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import type { FigmaContentResult } from './design-consumer-content.js';
import { imageSha256 } from './design-consumer-framing-v2.js';
import { judgeVariants } from './react-to-figma-check.js';
const png = (rgb: number[]) => { const p = new PNG({ width: 20, height: 10 }); for (let i = 0; i < 200; i++) p.data.set([...rgb, 255], i * 4); return PNG.sync.write(p); };
const judge = (o: { figma?: number[]; graphics?: Array<{ tag: string; box: { x: number; y: number; width: number; height: number } }>; ink?: number; fonts?: string[]; content?: false } = {}) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'react-to-figma-')), ref = png([0, 0, 255]), drawn = png(o.figma ?? [0, 0, 255]), box = { x: 16, y: 16, width: 20, height: 10 };
  writeFileSync(path.join(dir, 'success.png'), ref);
  const c = component(['success'], { png: 'success.png', faces: [{ family: 'Arimo', weight: 400, style: 'normal' }],
    frame: { layout: box, capture: box, deviceScaleFactor: 1, pngSha256: imageSha256(ref), raster: { kind: 'browser-paint-extent-v1', paint: box } },
    content: { text: 'success', graphics: o.graphics ?? [], runs: [run('success')] } });
  const file = dump([{ ...variant('success'), nodeId: '1:2' }], ['success']);
  (file.Badge as { nodeId?: string }).nodeId = '1:1';
  const layout = { x: 100, y: 200, width: 20, height: 10 };
  const capture = { kind: 'ds-contracts-plugin-capture', version: 2, fileKey: 'f', set: 'Badge', nodeId: '1:1', figmaFonts: (o.fonts ?? ['Regular']).map((style) => ({ family: 'Arimo', style })),
    variants: [{ nodeId: '1:2', box: { bounds: layout, png: drawn.toString('base64') }, after: { layout, render: layout } }] };
  const content: FigmaContentResult = o.content === false ? { status: 'unavailable', reason: 'no token' } : { status: 'collected', version: null, responseSha256: 'x', byNodeId: { '1:2': {
    texts: ['success'], textStyles: [[{ start: 0, end: 7, color: { r: o.ink ?? 0, g: 0, b: 0, a: 1 }, family: 'Arimo', weight: 400 }]], parts: [] } } };
  const set = Object.values(file)[0] as Parameters<typeof judgeVariants>[2];
  return judgeVariants(c, setRule(c, file, 'Badge'), set, dir, capture, content, dir)[0]!;
};

test('each variant of a set that counts is judged by the Figma to React check\'s own code and limits, the reference as the rendered side', () => {
  assert.deepEqual([judge().verdict, judge().reasons, judge().image], ['pass', [], { white: 0, black: 0 }]);
  const recolored = judge({ figma: [255, 0, 0] });
  assert.equal(recolored.verdict, 'fail');
  assert.deepEqual(recolored.reasons.map((r) => r.split(':').slice(0, 2).join(':')), ['layout-image-difference-above-limit:tone=success', 'layout-image-difference-on-black-above-limit:tone=success']);
  // An icon the reference draws and the written variant lacks; a text drawn in another color.
  assert.deepEqual(judge({ graphics: [{ tag: 'svg', box: { x: 2, y: 1, width: 8, height: 8 } }] }).reasons, ['content-missing:tone=success:part:svg@2,1']);
  assert.match(judge({ ink: 1 }).reasons.join(), /^text-color-mismatch:tone=success:"success":figma #ff0000 vs rendered #000000/);
  // A face Figma cannot load is font-blocked, never a pass or a failure; content not read is unverified.
  assert.deepEqual([judge({ fonts: ['Bold'] }).verdict, judge({ content: false }).verdict], ['font-blocked', 'unverified']);
});
