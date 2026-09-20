import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { proposeFromDump } from '../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import { tokenInventoryFromJson } from '../../core/tokens.js';
import { mintedTokenCss, mintTokens, type MintObservation } from '../../core/mint-tokens.js';
import { ContractSchema } from '../../scripts/contract-schema.js';
import { emitReact } from '../../core/emit-react.js';
import { mountGenerated } from '../../core/react-test-runtime.js';
import type { DumpNode, DumpSet } from './types.js';
const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
function fixture(): DumpSet {
  return { setName: 'Signal', type: 'COMPONENT_SET', propertyDefinitions: {
    Treatment: { type: 'VARIANT', defaultValue: 'Plain', variantOptions: ['Plain', 'Muted', 'Ring'] },
    Tone: { type: 'VARIANT', defaultValue: 'A', variantOptions: ['A', 'B'] },
  }, variants: ['Plain', 'Muted', 'Ring'].flatMap(Treatment => ['A','B'].map(Tone => {
    const color = Treatment === 'Plain' ? (Tone === 'A' ? 'ee2211' : '11aa44') : (Tone === 'A' ? '2222ee' : 'eeaa11');
    const indicator: DumpNode = { name: 'Indicator', type: 'FRAME', fixedSize: { width: 18, height: 18 }, stroke: { hex: color }, strokeWeight: 2 };
    return { type: 'COMPONENT', name: `Treatment=${Treatment}, Tone=${Tone}`, variantProperties: { Treatment, Tone }, children: Treatment === 'Ring' ? [{ name: 'Ring', type: 'FRAME', fill: { hex: 'abcdef' }, children: [indicator] }] : [indicator] };
  })) };
}
test('a visible part retains two-axis paint when the missing plane is proven absent', async () => {
  const result = proposeFromDump(fixture(), { corpus, contractIdByName: new Map(), mintUnbound: true });
  const contract = ContractSchema.parse(result.contract);
  const flat = Object.values(contract.anatomy.root.parts ?? {}).find(p => p.visibleWhen?.equals instanceof Array);
  assert.ok(flat?.tokens?.['border-color'], result.notes.join('\n'));
  const output = emitReact(contract, { contracts: new Map([[contract.id, contract]]), icons: new Map(), tokens: tokenInventoryFromJson([result.mintedTokens!.tree]) });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const render = await mountGenerated(page, contract.name, output.tsx, output.css);
    await page.addStyleTag({ content: mintedTokenCss(result.mintedTokens!.tree) });
    for (const [treatment, tone, color] of [['plain','a','rgb(238, 34, 17)'],['plain','b','rgb(17, 170, 68)'],['muted','a','rgb(34, 34, 238)'],['muted','b','rgb(238, 170, 17)']]) {
      await render({ treatment, tone });
      assert.equal(await page.locator('#root > * > *').count(), 1);
      assert.equal(await page.locator('#root > * > *').evaluate(el => getComputedStyle(el).borderTopColor), color);
    }
  } finally { await browser.close(); }
});

test('pair coverage cannot invent a visible or only partially described missing cell', () => {
  const axes = [{ propName:'a', values:['x','y','z'] }, { propName:'b', values:['one','two'] }];
  const combos = axes[0].values.flatMap(a => axes[1].values.map(b => ({a,b})));
  const occurrences = combos.filter(c => c.a !== 'z').map((axisValues,i) => ({ variant:String(i), axisValues, value:['#ff0000','#00ff00','#0000ff','#ffff00'][i] }));
  const run = (absent?: Record<string,string>[]) => mintTokens('probe', [{ nodePath:'root/ink', part:'ink', kind:'color', cssProperty:'border-color', occurrences, ...(absent ? {partAbsentCombos:absent}: {}) } as MintObservation], axes, {nestedPairs:true,realizedCombos:combos});
  assert.equal(run().bindings[0].ref,null);
  assert.equal(run([{a:'z'}]).bindings[0].ref,null, 'a partial tuple is not proof for either missing pair cell');
  assert.equal(run([{a:'z',b:'one'}]).bindings[0].ref,null, 'one visible missing cell keeps the refusal');
  assert.notEqual(run(combos.filter(c=>c.a==='z')).bindings[0].ref,null);
});

test('absence evidence cannot cover another axis plane or contradict an observed tuple', () => {
  const axes = [{ propName: 'a', values: ['x', 'y', 'z'] }, { propName: 'b', values: ['one', 'two'] }, { propName: 'c', values: ['front', 'back'] }];
  const combos = axes[0].values.flatMap(a => axes[1].values.flatMap(b => axes[2].values.map(c => ({ a, b, c }))));
  const occurrences = combos.filter(c => c.a !== 'z').map(axisValues => ({ variant: JSON.stringify(axisValues), axisValues, value: `${axisValues.a}-${axisValues.b}` }));
  const absent = combos.filter(c => c.a === 'z');
  const observation = { nodePath: 'root/ink', part: 'ink', kind: 'color' as const, cssProperty: 'border-color', occurrences, partAbsentCombos: absent };
  const run = (obs = observation) => mintTokens('probe', [obs], axes, { nestedPairs: true, realizedCombos: combos });
  assert.notEqual(run().bindings[0].ref, null);
  assert.match(run().bindings[0].caveat ?? '', /PRESENCE-RAGGED/);
  assert.deepEqual(run().tree, run({ ...observation, occurrences: [...occurrences].reverse(), partAbsentCombos: [...absent].reverse() }).tree);
  assert.equal(run({ ...observation, partAbsentCombos: absent.filter(c => c.c === 'front') }).bindings[0].ref, null);
  assert.equal(run({ ...observation, occurrences: occurrences.slice(1) }).bindings[0].ref, null, 'an uncaptured visible tuple must not pass merely because another tuple has the same pair');
  assert.equal(run({ ...observation, occurrences: [...occurrences, { variant: 'contradiction', axisValues: absent[0], value: 'conflict' }] }).bindings[0].ref, null);
});

test('single-axis absence requires the complete missing plane', () => {
  const axes = [{ propName: 'a', values: ['x', 'y', 'z'] }, { propName: 'b', values: ['one', 'two'] }];
  const combos = axes[0].values.flatMap(a => axes[1].values.map(b => ({ a, b })));
  const occurrences = combos.filter(c => c.a !== 'z').map(axisValues => ({ variant: JSON.stringify(axisValues), axisValues, value: axisValues.a === 'x' ? 0.5 : 1 }));
  const run = (absent: Record<string, string>[], realized = true) => mintTokens('probe', [{ nodePath: 'root/ink', part: 'ink', kind: 'number', cssProperty: 'opacity', occurrences, partAbsentCombos: absent }], axes, { nestedPairs: true, ...(realized ? { realizedCombos: combos } : {}) });
  for (const realized of [true, false]) {
    assert.equal(run([{ a: 'z' }], realized).bindings[0].ref, null);
    assert.equal(run([{ a: 'z', b: 'one' }], realized).bindings[0].ref, null);
    assert.notEqual(run(combos.filter(c => c.a === 'z'), realized).bindings[0].ref, null);
  }
});
