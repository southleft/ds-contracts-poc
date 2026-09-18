// Letter spacing is CARRIED by both Figma readers (dump v1.33). Found by the
// design-led clean-consumer check: a designer's "Badge" label rendered 53 px
// wide against Figma's 57 px with the right font at the right size, because
// both readers named the 1 px tracking a loss while the proposer, the
// `letter-spacing` literal channel and the CSS emitter already carried it.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';
import { mapRestToDump } from './rest/map.js';
import { proposeFromDump } from '../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import type { DumpSet } from './types.js';

const restText = (id: string, style: Record<string, unknown>) => ({ id, name: 'Label', type: 'TEXT', characters: 'Badge',
  style: { fontFamily: 'Public Sans', fontWeight: 600, fontSize: 12, lineHeightPx: 20, lineHeightUnit: 'PIXELS', ...style },
  fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }] });
const restSet = (styles: Array<Record<string, unknown>>) => ({ id: '1:1', name: 'Badge', type: 'COMPONENT_SET',
  children: styles.map((style, i) => ({ id: `1:${i + 2}`, name: `Tone=${'ABC'[i]}`, type: 'COMPONENT', layoutMode: 'HORIZONTAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 57, height: 20 }, children: [restText(`1:${i + 2}9`, style)] })) });
const mapped = (styles: Array<Record<string, unknown>>) => {
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:1': { document: restSet(styles) } } } as never);
  const set = (result.dump as unknown as Record<string, DumpSet>).Badge;
  return { set, texts: set.variants.map(v => v.children![0].text!), receipts: result.report.degradations.filter(d => d.code === 'text-channel-unsupported') };
};

test('the REST reader carries pixel letter spacing and names nothing for it; zero and absent stay absent', () => {
  const tracked = mapped([{ letterSpacing: 1 }, { letterSpacing: -0.5 }]);
  assert.deepEqual(tracked.texts.map(t => t.letterSpacing), [1, -0.5]);
  assert.deepEqual(tracked.receipts, []);
  const none = mapped([{ letterSpacing: 0 }, {}]);
  assert.deepEqual(none.texts.map(t => 'letterSpacing' in t), [false, false], 'absent means not captured, never zero');
  // Channels that still have no projection keep their receipt.
  const other = mapped([{ letterSpacing: 1, textDecoration: 'UNDERLINE' }, { letterSpacing: 1 }]);
  assert.equal(other.receipts.length, 1);
  assert.match(other.receipts[0].message, /textDecoration UNDERLINE/);
  assert.doesNotMatch(other.receipts[0].message, /letterSpacing/);
});

test('a designer-authored label reaches the contract as a letter-spacing literal through the REST reader', () => {
  const { set } = mapped([{ letterSpacing: 1 }, { letterSpacing: 1 }]);
  const result = proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: { paint: { a: { $type: 'color', $value: '#ffffff' } } }, semantic: {}, light: {}, brandDefault: {} }), contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true });
  assert.match(JSON.stringify(result.contract.anatomy), /"letter-spacing":"1px"/);
});

test('the plugin reader resolves PIXELS and PERCENT to pixels and keeps a receipt only when there is no single value', async () => {
  const { figma, root } = createFigmaMock();
  const context = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const run = (code: string) => vm.runInContext(`(async () => {\n${code}\n})()`, context, { timeout: 20_000 }) as Promise<unknown>;
  await run(`
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
    const make = (name, spacing, fontSize) => { const c = figma.createComponent(); c.name = name; c.layoutMode = 'HORIZONTAL';
      const t = figma.createText(); t.name = 'Label'; t.characters = 'Badge'; if (fontSize !== undefined) t.fontSize = fontSize; t.letterSpacing = spacing; c.appendChild(t); return c; };
    const set = figma.combineAsVariants([make('Tone=A', { unit: 'PIXELS', value: 1 }, 12), make('Tone=B', { unit: 'PERCENT', value: 10 }, 20), make('Tone=C', figma.mixed, 12)], figma.currentPage);
    set.name = 'TrackedBadge';`);
  assert.ok(root.findOne((n: { name: string }) => n.name === 'TrackedBadge'));
  const source = readFileSync(new URL('./dump.plugin.js', import.meta.url), 'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(['TrackedBadge'])};`);
  const dumps = await run(source) as Record<string, DumpSet> & { _provenance: { dumpVersion: string } };
  assert.equal(dumps._provenance.dumpVersion, '1.33');
  const texts = dumps.TrackedBadge.variants.map(v => v.children![0].text!);
  // The dump was built in the VM's realm; copy the values into this one.
  assert.deepEqual(Array.from(texts, t => t.letterSpacing), [1, 2, undefined], '10 % of a 20 px font is 2 px; a mixed value has no single pixel value');
});
