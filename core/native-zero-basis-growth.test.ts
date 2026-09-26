import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {reactEmitter} from './emitter.js';
import {mountGenerated} from './react-test-runtime.js';
import {revisionOf} from './contract-provenance.js';

const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(direction:'row'|'column'='row', definite=false) {
  return ContractSchema.parse({id:'test.equal-allocation',name:'EqualAllocation',version:'0.1.0',status:'draft',
    description:'Unequal intrinsic content with explicit zero-basis allocation',semantics:{element:'div'},props:[],states:[],
    anatomy:{root:{layout:{display:'inline-flex',direction,align:'start'},
      literals:{width:direction==='row'&&definite?'200px':'fit-content',height:direction==='column'&&definite?'200px':'fit-content'},
      parts:Object.fromEntries([30,90].map((size,i)=>['item'+i,{layout:{display:'flex',grow:true,growBasis:'zero'},
        parts:{['mark'+i]:{shape:{kind:'rect',width:direction==='row'?size:10,height:direction==='column'?size:10}}}}]))}},
    bindings:{code:{anchors:{importPath:'test/EqualAllocation',export:'EqualAllocation'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
}

test('intrinsic zero-basis allocation renders in React but cannot silently become native Hug',async t=>{
  const contract=fixture(),contracts=new Map([[contract.id,contract]]);
  const files=reactEmitter.emit(contract,{contracts,tokens,icons:new Map(),mode:'light'});
  const browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage();
  const render=await mountGenerated(page,contract.name,files.find(f=>f.path.endsWith('.tsx'))!.contents,files.find(f=>f.path.endsWith('.css'))!.contents);
  await render({});
  const widths=await page.locator('#root > *').evaluate(root=>({root:root.getBoundingClientRect().width,
    items:[...root.children].map(child=>child.getBoundingClientRect().width)}));
  assert.deepEqual(widths,{root:120,items:[60,60]},'CSS distributes the intrinsic 120px allocation equally');
  const engine=createFigmaEngine({tokens,icons:new Map()});
  const before=JSON.stringify(contract);
  assert.throws(()=>engine.compileComponentData(contract,contracts),/FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED.*test.equal-allocation.*item0.*width allocation/);
  assert.throws(()=>engine.buildComponentScript(contract,contracts),/FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED/);
  const source={kind:'prepared-contract-library' as const,revision:'sha256:'+'a'.repeat(64),artifactId:'a'.repeat(64),
    inputSha256:'b'.repeat(64),tarballSha256:'c'.repeat(64),tokensSha256:revisionOf(tokens).slice(7)};
  assert.throws(()=>engine.compileNativePreparedLibrary(contract,contracts,source,'70000000-0000-4000-8000-000000000003'),/FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED/);
  assert.equal(JSON.stringify(contract),before,'refusal preserves authored growth and source facts');
});

test('definite allocation survives on either axis and compile-only facts never enter a plan',()=>{
  for(const direction of ['row','column'] as const){
    const engine=createFigmaEngine({tokens,icons:new Map()});
    const unsupported=fixture(direction);
    assert.throws(()=>engine.compileComponentData(unsupported,new Map([[unsupported.id,unsupported]])),/FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED/);
    const contract=fixture(direction,true),contracts=new Map([[contract.id,contract]]);
    const data=engine.compileComponentData(contract,contracts);
    for(const item of data.variants[0].spec.children!){
      assert.equal(direction==='row'?item.fillW:item.fillH,true);
      assert.equal(direction==='row'?item.fillH:item.fillW,undefined);
    }
    assert.equal(JSON.stringify(data).includes('growBasis'),false);
    assert.equal(engine.buildComponentScript(contract,contracts),engine.buildComponentScript(contract,contracts));
  }
});

test('legacy content growth and disabled growth retain their previous compiled meaning',()=>{
  for(const kind of ['legacy','disabled'] as const){
    const contract=fixture();
    for(const part of Object.values(contract.anatomy.root.parts!)){
      if(kind==='legacy')delete part.layout!.growBasis;
      else part.layout!.grow=false;
    }
    const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(contract,new Map([[contract.id,contract]]));
    assert.equal(JSON.stringify(data).includes('growBasis'),false);
    for(const item of data.variants[0].spec.children!){assert.equal(item.fillW,undefined);assert.equal(item.fillH,undefined);}
  }
});

test('a competing declared width cannot excuse dropping an explicit zero basis',()=>{
  const contract=fixture('row',true);contract.anatomy.root.parts!.item0.literals={width:'30px'};
  assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(contract,new Map([[contract.id,contract]])),
    /FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED.*item0.*width allocation/);
});

test('explicit zero-basis text retains equal allocation despite alignment-safe glyphs',async t=>{
  const contract=fixture('row',true);
  contract.anatomy.root.parts=Object.fromEntries(['Short','A much longer label'].map((text,i)=>['item'+i,{
    text,layout:{grow:true,growBasis:'zero' as const},declared:{'text-align':'left' as const},
  }]));
  const contracts=new Map([[contract.id,contract]]),engine=createFigmaEngine({tokens,icons:new Map()});
  const data=engine.compileComponentData(contract,contracts);
  for(const text of data.variants[0].spec.children!){
    assert.equal(text.type,'text'); assert.equal(text.fillW,true); assert.equal(text.fillText,true);
  }
  const files=reactEmitter.emit(contract,{contracts,tokens,icons:new Map(),mode:'light'});
  const browser=await chromium.launch();t.after(()=>browser.close());
  const page=await browser.newPage();
  const render=await mountGenerated(page,contract.name,files.find(f=>f.path.endsWith('.tsx'))!.contents,files.find(f=>f.path.endsWith('.css'))!.contents);
  await render({});
  assert.deepEqual(await page.locator('#root > *').evaluate(root=>[...root.children].map(child=>child.getBoundingClientRect().width)),[100,100]);
  const intrinsic=structuredClone(contract);intrinsic.anatomy.root.literals!.width='fit-content';
  assert.throws(()=>engine.compileComponentData(intrinsic,new Map([[intrinsic.id,intrinsic]])),/FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED/);
  const fixedChild=structuredClone(contract);fixedChild.anatomy.root.parts!.item0.literals={width:'30px'};
  assert.throws(()=>engine.compileComponentData(fixedChild,new Map([[fixedChild.id,fixedChild]])),/FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED/);
  const legacy=structuredClone(contract);
  for(const part of Object.values(legacy.anatomy.root.parts!))delete part.layout!.growBasis;
  for(const text of engine.compileComponentData(legacy,new Map([[legacy.id,legacy]])).variants[0].spec.children!)
    assert.equal(text.fillW,undefined,'legacy content-based text retains its previous Hug behavior');
});
