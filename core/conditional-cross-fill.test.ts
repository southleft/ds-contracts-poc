import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { ContractSchema } from '../scripts/contract-schema.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { reactEmitter, reactInlineEmitter } from './emitter.js';
import { mountGenerated } from './react-test-runtime.js';
import { createFigmaEngine } from './emit-figma-script.js';
import type { DumpNode, DumpSet } from '../extract/figma/types.js';

const corpus = tokenCorpusFromJson({primitives:{}, semantic:{}, light:{}, brandDefault:{}});
const layout = (mode: 'HORIZONTAL' | 'VERTICAL'): DumpNode['layout'] => ({
  mode, primary:'MIN', counter:'MIN', spacing:4, padding:[0,0,0,0], primarySizing:'AUTO', counterSizing:'AUTO',
});
const text = (name: string, characters: string): DumpNode => ({
  name, type:'TEXT', text:{characters,fontFamily:'Inter',fontStyle:'Regular',fontSize:16,lineHeight:20},
});
function input(conditional=true, columnFirst=false): DumpSet {
  const names = columnFirst ? ['Details','Default'] : ['Default','Details'];
  return {
    setName:'Notice', type:'COMPONENT_SET',
    propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Details']}},
    variants:names.map(mode=>({
      name:`Mode=${mode}`, type:'COMPONENT', variantProperties:{Mode:mode},
      layout:layout(!conditional||mode==='Details'?'VERTICAL':'HORIZONTAL'),
      children:[
        {name:'summary',type:'FRAME',layout:layout('HORIZONTAL'),children:[text('title','A longer heading')]},
        ...(!conditional||mode==='Details' ? [{name:'detail',type:'FRAME' as const,layout:layout('HORIZONTAL'),fillWidth:true,children:[text('message','Detail')]}] : []),
      ],
    })),
  };
}
function proposed(dump=input()) {
  const result=proposeFromDump(dump,{corpus,mintUnbound:true,contractIdByName:new Map()});
  const contract=ContractSchema.parse(result.contract);
  const ctx={contracts:new Map([[contract.id,contract]]),tokens:{primitives:{},semantic:result.mintedTokens?.tree??{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>(),mode:'light' as const};
  return {...result,contract,ctx};
}

test('conditional cross-axis fill uses only parent modes where the child exists',()=>{
  for(const columnFirst of [false,true]) {
    const {contract}=proposed(input(true,columnFirst));
    const detail=contract.anatomy.root.parts!.detail;
    assert.deepEqual(detail.literals,{width:'100%'});
    assert.equal(detail.layout?.grow,undefined);
    assert.deepEqual(detail.visibleWhen,{prop:'mode',equals:'details'});
    assert.equal(contract.anatomy.root.parts!.summary.literals?.width,undefined);
  }
});

test('uniform and conditional columns use the same child-only width relation',()=>{
  for(const conditional of [false,true]) {
    const {contract,ctx}=proposed(input(conditional));
    assert.equal(contract.anatomy.root.parts!.detail.literals?.width,'100%');
    const data=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons}).compileComponentData(contract,ctx.contracts);
    for(const variant of data.variants) {
      const detail=variant.spec.children?.find(child=>child.name==='detail');
      const summary=variant.spec.children?.find(child=>child.name==='summary');
      if(conditional&&variant.name==='Mode=Default') {assert.equal(detail,undefined);continue;}
      assert.equal(detail?.widthFill,true);
      assert.equal(detail?.fillW,true);
      assert.equal(detail?.grow,undefined);
      assert.equal(summary?.fillW,undefined);
    }
  }
});

test('a bound child width retains its existing carrier',()=>{
  const dump=input();
  dump.variants[1].children![1].bound={width:'dimension.detail'};
  const {contract}=proposed(dump);
  assert.notEqual(contract.anatomy.root.parts!.detail.literals?.width,'100%');
});

test('both React emitters fill the conditional row while preserving its HUG sibling and repeat',async t=>{
  const browser=await chromium.launch(); t.after(()=>browser.close());
  const {contract,ctx}=proposed();
  for(const emitter of [reactEmitter,reactInlineEmitter]) {
    const files=emitter.emit(contract,ctx);
    const page=await browser.newPage();
    try {
      const render=await mountGenerated(page,contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
      const measure=()=>page.locator('#root > *').evaluate(root=>({
        width:root.getBoundingClientRect().width,
        height:root.getBoundingClientRect().height,
        children:[...root.children].map(child=>({width:child.getBoundingClientRect().width,height:child.getBoundingClientRect().height})),
      }));
      await render({mode:'default'});
      const before=await measure();assert.equal(before.children.length,1);
      await render({mode:'details'});
      const intrinsic=await measure();assert.equal(intrinsic.children.length,2);
      assert.equal(intrinsic.children[1].width,intrinsic.width);
      await render({mode:'details',style:{width:420}});
      const wide=await measure();assert.equal(wide.width,420);assert.equal(wide.children[1].width,420);
      assert.deepEqual(wide.children[0],intrinsic.children[0]);
      assert.equal(wide.children[1].height,intrinsic.children[1].height);
      await render({mode:'default'});assert.deepEqual(await measure(),before);
      await render({mode:'details'});assert.deepEqual(await measure(),intrinsic);
    } finally {await page.close();}
  }
});
