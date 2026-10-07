import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { proposeFromDump } from '../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';
import { flattenTokens, tokenInventoryFromJson } from '../../core/tokens.js';
import { ContractSchema } from '../../scripts/contract-schema.js';
import { emitReact } from '../../core/emit-react.js';
import { mountGenerated } from '../../core/react-test-runtime.js';
import type { DumpNode, DumpSet } from './types.js';

const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });
function fixture(paint: Partial<DumpNode>): DumpSet {
  const caption: DumpNode = { name: 'Caption', type: 'TEXT', text: { characters: 'One caption', fontSize: 14, fontStyle: 'Regular' } };
  return { setName: 'Notice', type: 'COMPONENT_SET', propertyDefinitions: { Treatment: { type: 'VARIANT', defaultValue: 'Plain', variantOptions: ['Plain', 'Ring'] } }, variants: [
    { name: 'Treatment=Plain', variantProperties: { Treatment: 'Plain' }, type: 'COMPONENT', children: [structuredClone(caption)] },
    { name: 'Treatment=Ring', variantProperties: { Treatment: 'Ring' }, type: 'COMPONENT', children: [{ name: 'Ring', type: 'FRAME', ...paint, children: [structuredClone(caption)] }] },
  ] };
}
const propose = (input: DumpSet) => proposeFromDump(input, { corpus, contractIdByName: new Map(), mintUnbound: true });

test('a painted wrapper remains variant-local instead of decorating the flat variant', async () => {
  const result = propose(fixture({ stroke: { hex: '2244ee' }, strokeWeight: 2 }));
  const contract = ContractSchema.parse(result.contract);
  assert.deepEqual(contract.anatomy.root.parts?.Ring.visibleWhen, { prop: 'treatment', equals: 'ring' });
  const flatCaption = Object.values(contract.anatomy.root.parts ?? {}).find(part => part.text === 'One caption');
  assert.deepEqual(flatCaption?.visibleWhen, { prop: 'treatment', equals: 'plain' });
  const output = emitReact(contract, { contracts: new Map([[contract.id, contract]]), icons: new Map(), tokens: tokenInventoryFromJson([result.mintedTokens?.tree ?? {}]) });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const render = await mountGenerated(page, contract.name, output.tsx, output.css);
    await render({ treatment: 'plain' });
    assert.equal(await page.locator('.Notice_Ring').count(), 0);
    assert.equal(await page.locator('#root').innerText(), 'One caption');
    await render({ treatment: 'ring' });
    assert.equal(await page.locator('.Notice_Ring').count(), 1, await page.locator('#root').innerHTML());
    assert.equal(await page.locator('#root').innerText(), 'One caption');
    await render({ treatment: 'plain' });
    assert.equal(await page.locator('.Notice_Ring').count(), 0);
  } finally { await browser.close(); }
});

test('fill and opacity cannot be cloned into absent wrapper variants; an unpainted structural wrapper still folds', () => {
  for (const paint of [{ fill: { hex: 'ff0000' } }, { opacity: 0.5 }]) {
    const result = propose(fixture(paint));
    assert.deepEqual(ContractSchema.parse(result.contract).anatomy.root.parts?.Ring.visibleWhen, { prop: 'treatment', equals: 'ring' });
    assert.ok(result.notes.some(note => note.includes('painted wrapper')));
  }
  const structural = propose(fixture({}));
  assert.equal(ContractSchema.parse(structural.contract).anatomy.root.parts?.Ring.visibleWhen, undefined);
  assert.ok(structural.notes.some(note => note.includes('wrapper-union identity')));
});

import {emitReactInline} from '../../core/emit-react-inline.js';
test('a positioned member keeps its real wrapper plane rather than acquiring a synthetic parent',async()=>{
 const set=fixture({fixedSize:{width:50,height:30}});
 for(const v of set.variants)v.fixedSize={width:100,height:50};
 const caption=set.variants[1].children![0].children![0];
 caption.abs={x:7,y:9,width:20,height:10,right:23,bottom:11,constraints:{horizontal:'LEFT',vertical:'TOP'}};
 const result=propose(set),contract=ContractSchema.parse(result.contract),contracts=new Map([[contract.id,contract]]);
 assert.deepEqual(contract.anatomy.root.parts?.Ring.visibleWhen,{prop:'treatment',equals:'ring'});
 assert(result.notes.some(n=>n.includes('retain observed nested and flat hierarchies')));
 const outputs=[emitReact(contract,{contracts,icons:new Map(),tokens:tokenInventoryFromJson([result.mintedTokens?.tree??{}])}),
 {...emitReactInline(contract,{contracts,icons:new Map(),tokens:{primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}}}),css:''}];
 const browser=await chromium.launch();
 try{for(const output of outputs){const page=await browser.newPage();try{
  const render=await mountGenerated(page,contract.name,output.tsx,output.css);
  await page.addStyleTag({content:':root{'+[...flattenTokens(result.mintedTokens?.tree??{})].map(([path,v])=>'--'+path.replaceAll('.','-')+':'+v.value+';').join('')+'}'});
  await render({treatment:'plain'});assert.equal(await page.locator('#root').innerText(),'One caption');
  await render({treatment:'ring'});assert.equal(await page.locator('#root').innerText(),'One caption');
  const delta=await page.locator('#root').evaluate(root=>{const leaf=[...root.querySelectorAll('*')].find(n=>n.childElementCount===0&&n.textContent==='One caption')!;const a=leaf.getBoundingClientRect(),b=leaf.parentElement!.getBoundingClientRect();return{x:a.x-b.x,y:a.y-b.y};});
  assert.deepEqual(delta,{x:7,y:9},await page.locator('#root').innerHTML());
 }finally{await page.close();}}}finally{await browser.close();}
});
