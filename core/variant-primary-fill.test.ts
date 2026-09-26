import test from 'node:test';
import ts from 'typescript';
import {extractAnatomy,tokenIndexFromJson} from './extract-css-module.js';
import {chromium} from 'playwright-core';
import {generatedTypeErrors, mountGenerated} from './react-test-runtime.js';
import assert from 'node:assert/strict';
import {ContractSchema, walkAnatomy, resolveLayout, type Contract} from '../scripts/contract-schema.js';
import {asMinimalChildContract, proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {textBoxConflicts} from '../packages/core/src/anatomy.js';
import {validateContract} from '../packages/core/src/validate.js';
import {reactEmitter, htmlEmitter, reactInlineEmitter} from './emitter.js';
import {createFigmaEngine, type NodeSpec} from './emit-figma-script.js';
import type {DumpSet, DumpNode} from '../extract/figma/types.js';

const entry=ContractSchema.parse({id:'ds.entry',name:'Entry',version:'0.1.0',status:'draft',description:'Generic collection item',
  semantics:{element:'span'},props:[{name:'text',type:'text',default:'Item',bindings:{figma:{kind:'TEXT',property:'Text'},code:{prop:'children'}}}],
  states:[],anatomy:{root:{layout:{display:'inline-flex',direction:'row',justify:'center'},parts:{label:{content:{prop:'children'}}}}},
  bindings:{figma:{anchors:{fileKey:'fixture',componentSetKey:'entry-key'}},code:{anchors:{importPath:'./Entry',export:'Entry'}}}});
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
const layout:DumpNode['layout']={mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'};
function source(defaultWide=false):DumpSet {
  return {setName:'Menu',type:'COMPONENT_SET',propertyDefinitions:{Density:{type:'VARIANT',defaultValue:defaultWide?'Wide':'Compact',variantOptions:['Compact','Wide']}},
    variants:['Compact','Wide'].map(value=>({name:`Density=${value}`,type:'COMPONENT',layout,
      variantProperties:{Density:value},children:[{name:'list',type:'FRAME',layout,fillWidth:value==='Wide',children:
        ['One','Two','Three'].map(text=>({type:'INSTANCE',name:'entry',instanceOf:'Entry',instanceSetKey:'entry-key',fillWidth:value==='Wide',componentProperties:{'Text#1:0':text}}))}]}))};
}
function propose(input=source()) {
  const result=proposeFromDump(input,{corpus,mintUnbound:true,contractIdByName:new Map([['Entry',entry.id]]),contractIdByKey:new Map([['entry-key',entry.id]]),contractsById:new Map([[entry.id,asMinimalChildContract(entry)]])});
  const contract=ContractSchema.parse(result.contract);
  const ctx={contracts:new Map([[entry.id,entry],[contract.id,contract]]),tokens:{primitives:{},semantic:result.mintedTokens?.tree??{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>(),mode:'light' as const};
  return {...result,contract,ctx};
}
const errors=(contract:Contract,child=entry)=>{const out:string[]=[];validateContract(contract,new Map([[contract.id,contract],[child.id,child]]),out,new Map());return out;};
const nodes=(root:NodeSpec):NodeSpec[]=>[root,...(root.children??[]).flatMap(nodes)];

test('variant fill reaches ordinary frames, repeated child roots and native instance specs',()=>{
  const {contract,ctx}=propose();
  assert.deepEqual(errors(contract),[]);
  const list=contract.anatomy.root.parts!.list;
  const item=walkAnatomy(contract).find(row=>row.part.repeat)!.part;
  for(const part of [list,item]){
    assert.deepEqual(part.layoutByProp,{prop:'density',map:{wide:{grow:true,growBasis:'zero'}}});
    assert.equal(resolveLayout(part,{density:'compact'})?.grow,undefined);
    assert.equal(resolveLayout(part,{density:'wide'})?.grow,true);
  }
  const react=reactEmitter.emit(contract,ctx);
  assert.match(react.find(file=>file.path.endsWith('.tsx'))!.contents,/<Entry key=\{index\} className=\{styles.entry\}/);
  assert.match(react.find(file=>file.path.endsWith('.css'))!.contents,/\.density-wide \.entry \{\s*flex: 1 1 0px;/);
  const html=htmlEmitter.emit(contract,ctx);
  assert.match(html.find(file=>file.path.endsWith('.html'))!.contents,/class="entry menu__entry/);
  assert.match(html.find(file=>file.path.endsWith('.css'))!.contents,/\.menu--density-wide \.menu__entry \{\s*flex: 1 1 0px;/);
  assert.match(reactInlineEmitter.emit(contract,ctx).find(file=>file.path.endsWith('.tsx'))!.contents,/<Entry[^>]* style=/);
  const engine=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons});
  assert.throws(()=>engine.compileComponentData(contract,ctx.contracts),/FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED.*Density=Wide/,
    'intrinsic row growth cannot silently become native Hug');
  const bounded=structuredClone(contract);bounded.anatomy.root.literals={width:'600px'};
  const data=engine.compileComponentData(bounded,new Map([...ctx.contracts,[bounded.id,bounded]]));
  for(const variant of data.variants){
    const instances=nodes(variant.spec).filter(node=>node.type==='instance');
    assert.equal(instances.length,3);
    const wide=variant.name.includes('Wide');
    assert.equal(nodes(variant.spec).find(node=>node.name==='list')!.grow,wide?true:undefined);
    for(const instance of instances)assert.equal(instance.grow,wide?true:undefined);
  }
});

test('a filling default remains an explicit variant rule, with no unconditional grow',()=>{
  const {contract}=propose(source(true));
  assert.equal(contract.props.find(prop=>prop.name==='density')!.default,'wide');
  for(const part of [contract.anatomy.root.parts!.list,walkAnatomy(contract).find(row=>row.part.repeat)!.part]){
    assert.equal(part.layout?.grow,undefined);
    assert.equal(resolveLayout(part,{density:'wide'})?.grow,true);
    assert.equal(resolveLayout(part,{density:'compact'})?.grow,undefined);
  }
});

test('different per-item placement retains individual instances instead of copying the first item',()=>{
  const input=source();input.variants[1].children![0].children![1].fillWidth=false;
  const {contract,notes}=propose(input);
  assert.equal(walkAnatomy(contract).filter(row=>row.part.repeat).length,0);
  const items=walkAnatomy(contract).filter(row=>row.part.component);
  assert.equal(items.length,3);
  assert.deepEqual(items.map(row=>resolveLayout(row.part,{density:'wide'})?.grow),[true,undefined,true]);
  assert.ok(notes.some(note=>note.includes('repeat-placement-not-uniform')));
  assert.deepEqual(errors(contract),[]);
});

test('unknown flex-parent observations keep a named refusal',()=>{
  const input=source();delete input.variants[0].children![0].layout;
  const {contract,notes}=propose(input);
  const item=walkAnatomy(contract).find(row=>row.part.repeat)!.part;
  assert.equal(item.layoutByProp,undefined);
  assert.ok(notes.some(note=>note.includes('primary-axis-fill-not-carried')));
});

test('parent grow never authorizes child internal layout or an unproven host',()=>{
  const {contract}=propose();
  const tampered=structuredClone(contract);
  const item=walkAnatomy(tampered).find(row=>row.part.repeat)!.part;
  item.layoutByProp!.map.wide.direction='column';
  assert.ok(errors(tampered).some(error=>error.includes('cannot restyle')));
  const custom=structuredClone(entry);custom.props[0].bindings.code.prop='style';
  assert.ok(errors(contract,custom).some(error=>error.includes('component-grow-host-unproven')));
});


test('variant placement fills rows and columns in both React targets and returns to intrinsic size', async t => {
  const browser = await chromium.launch(); t.after(() => browser.close());
  for (const dimension of ['width','height'] as const) {
  const input=structuredClone(source());
  if(dimension==='height') for(const variant of input.variants) {
    variant.layout!.mode='VERTICAL';
    const list=variant.children![0];list.layout!.mode='VERTICAL';
    for(const item of [list,...list.children!]) {item.fillHeight=item.fillWidth;delete item.fillWidth;}
  }
  const {contract,ctx} = propose(input);
  const axisCode=contract.props.find(prop=>prop.name==='density')!.bindings.code.prop;
  const repeat=walkAnatomy(contract).find(row=>row.part.repeat)!.part.repeat!;
  const itemsCode=contract.props.find(prop=>prop.name===repeat.itemsProp)!.bindings.code.prop;
  for (const emitter of [reactEmitter,reactInlineEmitter]) {
    const files=emitter.emit(contract,ctx), childFiles=emitter.emit(entry,ctx);
    assert.deepEqual(generatedTypeErrors(contract.name,files[0].contents,{Entry:childFiles[0].contents}),[]);
    const page=await browser.newPage();
    try {
      const render=await mountGenerated(page,contract.name,files[0].contents,files.find(file=>file.path.endsWith('.css'))?.contents,
        {Entry:{tsx:childFiles[0].contents,css:childFiles.find(file=>file.path.endsWith('.css'))?.contents}});
      const measure=()=>page.locator('#root > *').evaluate((root,dimension)=>{
        const list=root.firstElementChild!;
        return {root:root.getBoundingClientRect()[dimension],list:list.getBoundingClientRect()[dimension],
          items:[...list.children].map(item=>({width:item.getBoundingClientRect()[dimension],grow:getComputedStyle(item).flexGrow}))};
      },dimension);
      await render({[axisCode]:'compact',[itemsCode]:repeat.sample,style:{width:600,height:600}});
      const before=await measure();
      assert.ok(before.list<before.root);
      assert.deepEqual(before.items.map(item=>item.grow),['0','0','0'], await page.locator('#root').innerHTML());
      await render({[axisCode]:'wide',[itemsCode]:repeat.sample,style:{width:600,height:600}});
      const wide=await measure();
      assert.equal(wide.list,600);
      assert.deepEqual(wide.items.map(item=>item.width),[200,200,200]);
      assert.deepEqual(wide.items.map(item=>item.grow),['1','1','1']);
      assert.ok(wide.items.every((item,index)=>item.width>before.items[index].width));
      await render({[axisCode]:'compact',[itemsCode]:repeat.sample,style:{width:600,height:600}});
      assert.deepEqual(await measure(),before);
    } finally { await page.close(); }
  }
  }
});

test('optional boolean selectors carry component placement on HTML as well as React',()=>{
  const {contract,ctx}=propose();
  contract.props=contract.props.filter(prop=>prop.name!=='density');
  contract.props.push({name:'expanded',type:'boolean',bindings:{code:{prop:'expanded'},figma:{kind:'VARIANT',property:'Expanded',unsetValue:'Unset',values:{true:'Yes',false:'No'}}}});
  for(const {part} of walkAnatomy(contract)) if(part.layoutByProp) part.layoutByProp={prop:'expanded',map:{true:{grow:true,growBasis:'zero'},false:{grow:false}}};
  assert.deepEqual(errors(contract),[]);
  const html=htmlEmitter.emit(contract,ctx).find(file=>file.path.endsWith('.css'))!.contents;
  assert.match(html,/\.menu\[data-expanded\] \.menu__entry \{\s*flex: 1 1 0px;/);
  assert.match(html,/\.menu:not\(\[data-expanded\]\) \.menu__entry \{\s*flex: 0 1 auto;/);
});

test('variant grow preserves overlay and text-box conflict refusals',()=>{
  const {contract}=propose();
  const list=contract.anatomy.root.parts!.list;
  list.overlay={placement:'top'};
  assert.ok(errors(contract).some(error=>error.includes('cannot also grow')));
  delete list.overlay;
  // The shared text-box referee must see per-variant grow just as base grow.
  assert.ok(textBoxConflicts(list).includes('layoutByProp.grow'));
});


test('zero-basis fill refuses competing minimum-size and flex constraints',()=>{
  const {contract}=propose();
  const child=structuredClone(entry);child.anatomy.root.literals={'min-width':'10px'};
  assert.ok(errors(contract,child).some(error=>error.includes('growth-constraint-unproven')));
  const list=contract.anatomy.root.parts!.list;
  list.literals={'flex-basis':'20px'};
  assert.ok(errors(contract).some(error=>error.includes('growth-constraint-unproven')));
});


test('CSS intake distinguishes explicit zero basis from legacy content growth',()=>{
  const src="import styles from './Probe.module.css'; export function Probe() {return <div className={styles.root}><span className={styles.item}>Content</span></div>}";
  for(const basis of ['auto','0px','0']) {
    const back=extractAnatomy({sf:ts.createSourceFile('Probe.tsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),src,componentName:'Probe',props:[],tokens:tokenIndexFromJson([]),css:`.root {display:flex} .item {flex:1 1 ${basis};min-width:0;${basis==='auto'?'':'min-height:0;' }}`});
    assert.equal(back?.root.parts?.item.layout?.grow,true);
    assert.equal(back?.root.parts?.item.layout?.growBasis,basis==='auto'?undefined:'zero');
    assert.equal(back?.root.parts?.item.literals?.['min-height'],undefined);
  }
});


test('a later missing parent observation never borrows the first variant direction',()=>{
  const input=structuredClone(source());delete input.variants[1].children![0].layout;
  const {contract,notes}=propose(input);
  const item=walkAnatomy(contract).find(row=>row.part.repeat)!.part;
  assert.equal(item.layoutByProp,undefined);
  assert.ok(notes.some(note=>note.includes('primary-axis-fill-not-carried')));
});


test('native primary growth follows the parent axis on creation, amendment and repeat', async () => {
  const vm = await import('node:vm');
  const {createFigmaMock} = await import('../scripts/plugin-engine-mock-figma.mjs');
  for (const direction of ['row', 'column'] as const) for (const variants of [false, true]) {
    const contract=ContractSchema.parse({id:`test.growth-${direction}-${variants}`,name:`Growth${direction}${variants}`,version:'0.1.0',description:'Parent-axis growth regression',status:'draft',semantics:{element:'div'},
      props:variants?[{name:'size',type:{enum:['small','large']},default:'small',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{small:'Small',large:'Large'}}}}]:[],states:[],
      anatomy:{root:{layout:{display:'flex',direction,align:'start'},literals:{width:direction==='row'?'300px':'120px',height:direction==='row'?'120px':'300px'},
        parts:Object.fromEntries(['a','b','c'].map((name,i)=>[name,{layout:{display:'flex',direction:'column',grow:true,growBasis:'zero'},literals:{[direction==='row'?'height':'width']:'40px'},parts:{['mark'+i]:{shape:{kind:'rect',width:10,height:10}}}}]))}},
      bindings:{code:{anchors:{importPath:'test/Growth',export:'Growth'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
    const mock=createFigmaMock(),engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
    const context=vm.createContext({figma:mock.figma,console:{log(){},warn(){},error(){}}}),byId=new Map([[contract.id,contract]]);
    const run=()=>vm.runInContext(`(async()=>{${engine.buildComponentScript(contract,byId)}\n})()`,context);
    const owner=()=>mock.root.findOne(n=>n.getSharedPluginData('ds_contracts','contractId')===contract.id&&n.parent?.type!=='COMPONENT_SET')!;
    const mains=()=>owner().type==='COMPONENT_SET'?owner().children!:[owner()];
    let ids:string[]=[];
    for(const phase of ['create','amend'] as const){
      if(phase==='amend'){contract.version='0.1.1';contract.anatomy.root.literals![direction==='row'?'width':'height']='240px';}
      await run();
      if(phase==='create')ids=mains().map(n=>n.id);else assert.deepEqual(mains().map(n=>n.id),ids);
      for(const main of mains())for(const child of main.children!){
        assert.equal(direction==='row'?child.layoutSizingHorizontal:child.layoutSizingVertical,'FILL',`${direction} ${phase}: grow must fill the main axis`);
        // The mock does not distribute equal FILL siblings; exact allocation is a desktop check.
        assert.equal(direction==='row'?child.height:child.width,40,`${direction} ${phase}: retain the declared cross size`);
        assert.deepEqual([child.children![0].width,child.children![0].height],[10,10],`${direction} ${phase}: fixed geometry cannot inherit stretch`);
      }
    }
    assert.equal((await run()).results[0].skipped,true);assert.deepEqual(mains().map(n=>n.id),ids);
  }
});


test('native height allocation propagates only through a definite column chain',()=>{
  const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  for(const definite of [false,true]) {
    const contract=ContractSchema.parse({id:'test.nested-column',name:'NestedColumn',version:'0.1.0',status:'draft',description:'Definite height propagation',semantics:{element:'div'},props:[],states:[],
      anatomy:{root:{layout:{display:'flex',direction:'column',align:'start'},literals:{width:'120px',...(definite?{height:'300px'}:{})},parts:{
        stack:{layout:{display:'flex',direction:'column',align:'start',grow:true,growBasis:'zero'},literals:{width:'40px'},parts:{
          item:{layout:{display:'flex',grow:true,growBasis:'zero'},parts:{mark:{shape:{kind:'rect',width:10,height:10}}}},
        }},
        sibling:{shape:{kind:'rect',width:10,height:10}},
      }}},bindings:{code:{anchors:{importPath:'test/NestedColumn',export:'NestedColumn'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
    if(!definite){
      assert.throws(()=>engine.compileComponentData(contract,new Map([[contract.id,contract]])),/FIGMA_ZERO_BASIS_GROWTH_UNSUPPORTED.*height allocation/);
      continue;
    }
    const compiled=engine.compileComponentData(contract,new Map([[contract.id,contract]]));
    const all=nodes(compiled.variants[0].spec);
    for(const name of ['stack','item']) {
      assert.equal(all.find(n=>n.name===name)!.fillH,definite?true:undefined,`${name}: an intrinsic sibling cannot create definite height`);
      assert.equal(all.find(n=>n.name===name)!.fillW,undefined,`${name}: column grow cannot create horizontal fill`);
    }
  }
});

test('literal full width stays horizontal under either flex direction without implying grow',()=>{
  const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  for(const direction of ['row','column'] as const) {
    const contract=ContractSchema.parse({id:'test.percent-width',name:'PercentWidth',version:'0.1.0',status:'draft',description:'Percent width is independent of the main axis',semantics:{element:'div'},props:[],states:[],
      anatomy:{root:{layout:{display:'flex',direction,align:'start'},literals:{width:'120px',height:'300px'},parts:{
        item:{layout:{display:'flex'},literals:{width:'100%'},parts:{mark:{shape:{kind:'rect',width:10,height:10}}}},
      }}},bindings:{code:{anchors:{importPath:'test/PercentWidth',export:'PercentWidth'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
    const compiled=engine.compileComponentData(contract,new Map([[contract.id,contract]]));
    const item=nodes(compiled.variants[0].spec).find(n=>n.name==='item')!;
    assert.equal(item.fillW,true);assert.equal(item.fillH,undefined);assert.equal(item.grow,undefined);
    const react=reactEmitter.emit(contract,{contracts:new Map([[contract.id,contract]]),tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map(),mode:'light'});
    assert.match(react.find(f=>f.path.endsWith('.css'))!.contents,/width: 100%/);
    assert.doesNotMatch(react.find(f=>f.path.endsWith('.css'))!.contents,/flex: 1/);
  }
});


test('fixed shapes retain declared geometry while percentage width and explicit growth remain independent',async()=>{
  const vm=await import('node:vm');const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
  const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  for(const kind of ['rect','ellipse'] as const)for(const direction of ['row','column'] as const)for(const mode of ['shape','literal','percent','grow'] as const){
    const contract=ContractSchema.parse({id:'test.shape-placement',name:'ShapePlacement',version:'0.1.0',status:'draft',description:'Fixed geometry and explicit placement',semantics:{element:'div'},props:[],states:[],
      anatomy:{root:{layout:{display:'flex',direction,align:'stretch'},literals:{width:'40px',height:'50px'},parts:{
        mark:{shape:{kind,width:10,height:12},...(mode==='literal'?{literals:{width:'15px'}}:mode==='percent'?{literals:{width:'100%'}}:mode==='grow'?{layout:{grow:true,growBasis:'zero'}}:{})},
      }}},bindings:{code:{anchors:{importPath:'test/ShapePlacement',export:'ShapePlacement'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
    const byId=new Map([[contract.id,contract]]),host=createFigmaMock();
    await vm.runInNewContext('(async()=>{'+engine.buildComponentScript(contract,byId)+'\n})()',{figma:host.figma,console:{log(){},warn(){},error(){}}});
    const main=host.root.findOne(n=>n.getSharedPluginData('ds_contracts','contractId')===contract.id)!;const shape=main.children![0];
    if(mode==='grow'){
      assert.equal(direction==='row'?shape.layoutSizingHorizontal:shape.layoutSizingVertical,'FILL');
      assert.equal(direction==='row'?shape.height:shape.width,direction==='row'?12:10);
    }else{
      assert.deepEqual([shape.width,shape.height],[mode==='percent'?40:mode==='literal'?15:10,12],`${kind} ${direction} ${mode}`);
    }
  }
});
