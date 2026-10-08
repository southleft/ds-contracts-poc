import {PLUGIN_DUMP_VERSION} from '../types.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';
import { mapRestToDump, type RestNode } from './map.js';
import type { DumpSet } from '../types.js';
import { chromium } from 'playwright-core';
import { proposeFromDump, ExactProjectionError } from '../../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../../core/token-corpus.js';
import { tokenInventoryFromJson } from '../../../core/tokens.js';
import { mintedTokenCss } from '../../../core/mint-tokens.js';
import { emitReact } from '../../../core/emit-react.js';
import { createFigmaEngine } from '../../../core/emit-figma-script.js';
import { emitReactInline } from '../../../core/emit-react-inline.js';
import { mountGenerated } from '../../../core/react-test-runtime.js';
import { ContractSchema, resolveLiterals } from '../../../scripts/contract-schema.js';
const box = { x: 100, y: 100, width: 18.125, height: 20.0625 };
const child = (extra: Partial<RestNode> = {}): RestNode => ({ id: '1:3', name: 'Indicator', type: 'FRAME', absoluteBoundingBox: box, size:{x:box.width,y:box.height}, layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED', ...extra });
function capture(node = child(), parent: Partial<RestNode> = {}, main?: RestNode) {
  const component = { id: '1:2', name: 'Only', type: 'COMPONENT', layoutMode: 'HORIZONTAL', children: [node], ...parent };
  const result = mapRestToDump({ name: 'fixture', nodes: { '1:2': { document: component }, ...(main ? { [main.id]: {document: main} } : {}) } } as never);
  const set = (result.dump as unknown as Record<string, DumpSet>).Only;
  return set.variants[0].children![0];
}
test('REST carries each explicit fixed in-flow manual-box dimension exactly', () => {
  assert.deepEqual(capture().fixedSize, { width: 18.125, height: 20.0625 });
  assert.deepEqual(capture(child({ layoutSizingVertical: 'HUG' })).fixedSize, { width: 18.125 });
  assert.deepEqual(capture(child({ layoutSizingHorizontal: 'FILL' })).fixedSize, { height: 20.0625 });
  assert.equal(capture(child({ layoutSizingHorizontal: undefined, layoutSizingVertical: undefined })).fixedSize, undefined);
});
test('fixedSize never duplicates another geometry class or infers a size from an unconstrained axis', () => {
  for (const extra of [{ type: 'TEXT' }, { type: 'INSTANCE' }, { type: 'COMPONENT' }, { layoutPositioning: 'ABSOLUTE' }, { absoluteBoundingBox: null }] as Partial<RestNode>[]) {
    assert.equal(capture(child(extra)).fixedSize, undefined, JSON.stringify(extra));
  }
  assert.equal(capture(child(), { layoutMode: 'NONE' }).fixedSize, undefined);
  assert.equal(capture(child({ layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' })).fixedSize, undefined);
});
test('a rotated manual box requires both fixed axes; a small nonzero rotation is not rounded away', () => {
  for (const rotation of [Math.PI / 2, 0.00000001]) {
    assert.deepEqual(capture(child({ rotation })).fixedSize, { width: 18.125, height: 20.0625 });
    assert.equal(capture(child({ rotation, layoutSizingVertical: 'HUG' })).fixedSize, undefined);
  }
});

function constrainedBoxes(mode: 'HORIZONTAL' | 'VERTICAL'): DumpSet {
  const row = mode === 'HORIZONTAL';
  const component: RestNode = {
    id: '8:1', name: 'ConstrainedBoxes', type: 'COMPONENT', layoutMode: mode,
    primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'FIXED',
    absoluteBoundingBox: { x: 0, y: 0, width: 80, height: 80 },
    children: ['First', 'Second'].map((name, i) => child({
      id: `8:${i + 2}`, name,
      absoluteBoundingBox: { x: row ? i * 60 : 0, y: row ? 0 : i * 60, width: 60, height: 60 },
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.4, a: 1 } }],
    })),
  };
  return (mapRestToDump({ name: 'fixture', nodes: { '8:1': { document: component } } }).dump as unknown as Record<string, DumpSet>).ConstrainedBoxes;
}
const proposeBoxes = (set: DumpSet) => proposeFromDump(set, {
  corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
  contractIdByName: new Map(), fileKey: null, projectionMode: 'reviewable-inversion', mintUnbound: true,
});

test('fixed children retain their drawn main-axis size in constrained rows and columns on both React surfaces', async () => {
  // Chakra Progress exposed this: once the parent width was carried, its fixed
  // stripe children shrank. This independent fixture overflows 80px with two
  // 60px boxes so preserving only the CSS width/height cannot pass the test.
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const mode of ['HORIZONTAL', 'VERTICAL'] as const) {
      const proposed = proposeBoxes(constrainedBoxes(mode));
      const contract = ContractSchema.parse(proposed.contract), tree = proposed.mintedTokens!.tree;
      const contracts = new Map([[contract.id, contract]]), icons = new Map<string, string>();
      const css = emitReact(contract, { contracts, icons, tokens: tokenInventoryFromJson([tree]) });
      const inline = emitReactInline(contract, { contracts, icons, tokens: { primitives: tree, semantic: {}, light: {}, dark: {}, brands: { default: {} } } });
      for (const output of [css, { ...inline, css: '' }]) {
        await mountGenerated(page, contract.name, output.tsx, mintedTokenCss(tree) + output.css);
        const boxes = await page.locator('#root > *').evaluate(root => ({
          parent: { width: root.getBoundingClientRect().width, height: root.getBoundingClientRect().height },
          children: Array.from(root.children, el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })),
        }));
        const axis = mode === 'HORIZONTAL' ? 'width' : 'height';
        assert.equal(boxes.parent[axis], 80, mode);
        assert.deepEqual(boxes.children.map(b => b[axis]), [60, 60], mode);
      }
    }
  } finally { await browser.close(); }
});

test('a fixed cross axis or a mixed main-axis sizing mode does not disable flex shrinking', () => {
  for (const mode of ['HORIZONTAL', 'VERTICAL'] as const) {
    const set = constrainedBoxes(mode), axis = mode === 'HORIZONTAL' ? 'width' : 'height';
    for (const node of set.variants[0].children!) delete node.fixedSize![axis];
    const contract = ContractSchema.parse(proposeBoxes(set).contract);
    for (const part of Object.values(contract.anatomy.root.parts!)) assert.equal(part.tokens?.['flex-shrink'], undefined);
  }
  const set = constrainedBoxes('HORIZONTAL');
  const second = structuredClone(set.variants[0]);
  set.propertyDefinitions = { Mode: { type: 'VARIANT', defaultValue: 'Fixed', variantOptions: ['Fixed', 'Flexible'] } };
  set.variants[0].name = 'Mode=Fixed'; second.name = 'Mode=Flexible';
  set.variants[0].variantProperties = { Mode: 'Fixed' }; second.variantProperties = { Mode: 'Flexible' };
  for (const node of second.children!) delete node.fixedSize!.width;
  set.variants.push(second);
  const contract = ContractSchema.parse(proposeBoxes(set).contract);
  for (const part of Object.values(contract.anatomy.root.parts!)) assert.equal(part.tokens?.['flex-shrink'], undefined);
});


test('plugin and REST fixed manual-box capture agree, including fractions, invalid dimensions and tiny rotations', async () => {
  const specs = [{}, {layoutSizingVertical:'HUG'}, {layoutSizingHorizontal:'FILL'},
    {rotation: 0.00000001, layoutSizingVertical:'HUG'}, {rotation:90},
    {absoluteBoundingBox:{...box,width:NaN}}, {absoluteBoundingBox:{...box,height:-1}},
    {layoutPositioning:'ABSOLUTE'}, {layoutMode:'HORIZONTAL'},
    {layoutMode:'VERTICAL',layoutSizingHorizontal:'FILL'},
    {layoutMode:'HORIZONTAL',layoutSizingVertical:'HUG'},
    {layoutMode:'VERTICAL',rotation:.00000001},
    {layoutSizingHorizontal:undefined,layoutSizingVertical:undefined}];
  const {figma: mockFigma} = createFigmaMock();
  const figma: any = mockFigma;
  const context = vm.createContext({figma, console:{log(){},warn(){},error(){}}});
  const run = (code:string) => vm.runInContext(`(async()=>{${code}})()`,context,{timeout:20000}) as Promise<any>;
  const variants = [];
  for (const [i, spec] of specs.entries()) {
    const c=figma.createComponent(); variants.push(c); c.name=`Case=${i}`; c.layoutMode='HORIZONTAL';
    const n=figma.createFrame(); n.name='Indicator'; n.layoutMode='NONE';
    const {id:_id,type:_type,absoluteBoundingBox,...values}=child(spec as Partial<RestNode>);
    Object.assign(n,values);
    if(values.size){n.width=values.size.x;n.height=values.size.y;}
    Object.defineProperty(n,'absoluteBoundingBox',{value:absoluteBoundingBox}); c.appendChild(n);
  }
  const set=figma.combineAsVariants(variants,figma.currentPage); set.name='MeasuredBox';
  const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ['MeasuredBox'];`);
  const dumps=await run(source);
  assert.equal(dumps._provenance.dumpVersion,PLUGIN_DUMP_VERSION);
  assert.deepEqual(Array.from(dumps.MeasuredBox.variants, (v:any)=>v.children[0].fixedSize && JSON.parse(JSON.stringify(v.children[0].fixedSize))),
    specs.map(spec=>capture(child(spec as Partial<RestNode>)).fixedSize));
});

test('fixed auto-layout extents reach contracts on both axes without freezing HUG/FILL or rotated boxes',()=>{
 for(const mode of ['HORIZONTAL','VERTICAL'] as const){
  const n=child({layoutMode:mode,primaryAxisSizingMode:'FIXED',counterAxisSizingMode:'FIXED'});
  const mapped=capture(n);assert.deepEqual(mapped.fixedSize,{width:18.125,height:20.0625});
  assert.deepEqual(capture({...n,layoutSizingHorizontal:'FILL',layoutSizingVertical:'HUG'}).fixedSize,undefined);
  assert.equal(capture({...n,rotation:.00000001}).fixedSize,undefined);
 }
});

test('explicit fixed auto-layout children preserve their own extent with siblings on both React surfaces',async()=>{
 const browser=await chromium.launch();
 try {const page=await browser.newPage();
  for(const mode of ['HORIZONTAL','VERTICAL'] as const){
   const nodes=['EmptySlot','ThumbContainer'].map((name,i)=>child({id:`9:${i+2}`,name,
    layoutMode:mode,primaryAxisSizingMode:'FIXED',counterAxisSizingMode:'FIXED',
    absoluteBoundingBox:{x:i*30,y:0,width:24,height:20},size:{x:24,y:20},
    children:i?[{id:'9:4',name:'Thumb',type:'RECTANGLE',layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',absoluteBoundingBox:{x:30,y:0,width:14,height:14},fills:[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}]}]:[]}));
   const component:RestNode={id:'9:1',name:'FixedAutoChildren',type:'COMPONENT',layoutMode:mode,
    primaryAxisSizingMode:'AUTO',counterAxisSizingMode:'AUTO',absoluteBoundingBox:{x:0,y:0,width:48,height:40},children:nodes};
   const set=(mapRestToDump({name:'fixture',nodes:{'9:1':{document:component}}}).dump as unknown as Record<string,DumpSet>).FixedAutoChildren;
   const proposed=proposeBoxes(set),contract=ContractSchema.parse(proposed.contract),tree=proposed.mintedTokens!.tree;
   const contracts=new Map([[contract.id,contract]]),icons=new Map<string,string>();
   const css=emitReact(contract,{contracts,icons,tokens:tokenInventoryFromJson([tree])});
   const inline=emitReactInline(contract,{contracts,icons,tokens:{primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}}});
   for(const output of [css,{...inline,css:''}]){
    await mountGenerated(page,contract.name,output.tsx,mintedTokenCss(tree)+output.css);
    const boxes=await page.locator('#root > *').evaluate(root=>Array.from(root.children,el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
    assert.deepEqual(boxes,[{width:24,height:20},{width:24,height:20}],mode);
   }
  }
 }finally{await browser.close();}
});

test('auto-layout capture uses local size, never transformed screen bounds',()=>{
 const n=child({layoutMode:'HORIZONTAL',absoluteBoundingBox:{x:0,y:0,width:90,height:100},size:{x:24,y:20}});
 assert.deepEqual(capture(n).fixedSize,{width:24,height:20});
 assert.equal(capture({...n,size:undefined}).fixedSize,undefined);
});

test('mixed fixed, hug and fill heights retain their own modes on both React surfaces',async()=>{
 const variants=['Fixed','Hug','Fill'].map((mode,i):RestNode=>({id:`11:${i+1}`,name:`Mode=${mode}`,type:'COMPONENT',
  layoutMode:'VERTICAL',primaryAxisSizingMode:'FIXED',counterAxisSizingMode:'FIXED',absoluteBoundingBox:{x:0,y:0,width:40,height:80},
  children:[{id:`12:${i+1}`,name:'Body',type:'FRAME',layoutMode:'VERTICAL',primaryAxisSizingMode:mode==='Hug'?'AUTO':'FIXED',counterAxisSizingMode:'AUTO',
   layoutSizingHorizontal:'HUG',layoutSizingVertical:mode==='Fixed'?'FIXED':mode==='Hug'?'HUG':'FILL',
   size:{x:14,y:mode==='Fixed'?20:mode==='Hug'?14:80},absoluteBoundingBox:{x:0,y:0,width:14,height:mode==='Fixed'?20:mode==='Hug'?14:80},
   children:[{id:`13:${i+1}`,name:'Thumb',type:'RECTANGLE',layoutSizingHorizontal:'FIXED',layoutSizingVertical:'FIXED',absoluteBoundingBox:{x:0,y:0,width:14,height:14},fills:[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}]}]}]}));
 const setNode:RestNode={id:'11:0',name:'MixedSizing',type:'COMPONENT_SET',componentPropertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Fixed',variantOptions:['Fixed','Hug','Fill']}},children:variants};
 const set=(mapRestToDump({name:'fixture',nodes:{'11:0':{document:setNode}}}).dump as unknown as Record<string,DumpSet>).MixedSizing;
 const proposed=proposeBoxes(set),contract=ContractSchema.parse(proposed.contract),tree=proposed.mintedTokens!.tree;
 const body=Object.values(contract.anatomy.root.parts??{}).find(part=>part.literalsByCombination?.some(t=>t.rows.some(r=>r.literals.height==='20px')));assert.ok(body,JSON.stringify(contract.anatomy));
 const contracts=new Map([[contract.id,contract]]),icons=new Map<string,string>();
 const css=emitReact(contract,{contracts,icons,tokens:tokenInventoryFromJson([tree])});
 const inline=emitReactInline(contract,{contracts,icons,tokens:{primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}}});
 const browser=await chromium.launch();
 try{const page=await browser.newPage();for(const output of [css,{...inline,css:''}])for(const [mode,height] of [['fixed',20],['hug',14],['fill',80]] as const){
  await mountGenerated(page,contract.name,output.tsx,mintedTokenCss(tree)+output.css);
  await page.evaluate(mode=>(window as any).renderSubject({mode}),mode);
  assert.equal(await page.locator('#root > * > *').evaluate(el=>el.getBoundingClientRect().height),height,mode);
 }}finally{await browser.close();}
});

// Two same-named instances reverse their tree order when selection changes.
// Explicit swap bindings, rather than ordinals, identify the usage wrappers.
function reorderedSwapFixture(): DumpSet {
  return {
    setName: 'ReorderedSwap', type: 'COMPONENT_SET', propertyDefinitions: {
      Selected: { type: 'VARIANT', defaultValue: 'False', variantOptions: ['False', 'True'] },
      Normal: { type: 'INSTANCE_SWAP', defaultValue: '20:1' },
      Chosen: { type: 'INSTANCE_SWAP', defaultValue: '20:2' },
    }, variants: ['False', 'True'].map(selected => {
      const instances = ['Normal', 'Chosen'].map(role => ({ name: 'Icon', type: 'INSTANCE' as const,
        instanceOf: role, propRefs: { mainComponent: role },
        opacity: (role === 'Chosen') === (selected === 'True') ? 1 : 0,
      }));
      return { name: `Selected=${selected}`, type: 'COMPONENT' as const, variantProperties: { Selected: selected },
        layout: { mode: 'HORIZONTAL' as const, padding: [0,0,0,0], primarySizing: 'AUTO' as const, counterSizing: 'AUTO' as const }, children: selected === 'True' ? instances.reverse() : instances };
    }),
  } as DumpSet;
}

test('reordered duplicate instances preserve distinct swap roles and both boolean opacity planes', () => {
  const set = reorderedSwapFixture();
  const result = proposeBoxes(set), contract = ContractSchema.parse(result.contract);
  const parts = Object.values(contract.anatomy.root.parts ?? {});
  assert.equal(parts.length, 2);
  const normal = parts.find(p => p.slot?.bindings?.figma?.property === 'Normal' || p.slot?.name === 'normal')!;
  const chosen = parts.find(p => p.slot?.name === 'chosen')!;
  assert(normal && chosen);
  assert.deepEqual(normal.stylesWhen, [{ prop: 'selected', styles: { opacity: '0' } }]);
  assert.deepEqual(chosen.literalsByCombination, [{ props: ['selected'], rows: [
    { values: ['false'], literals: { opacity: '0' } }, { values: ['true'], literals: { opacity: '1' } },
  ] }]);
  assert(contract.props.some(p => p.name === 'selected'));
  set.variants.reverse();
  const reordered = ContractSchema.parse(proposeBoxes(set).contract);
  for (const p of Object.values(reordered.anatomy.root.parts ?? {})) {
    const property = p.slot?.bindings?.figma?.property ?? (p.slot?.name === 'chosen' ? 'Chosen' : 'Normal');
    const original = property === 'Normal' ? normal : chosen;
    assert.deepEqual(p.stylesWhen, original.stylesWhen);
    assert.deepEqual(p.literalsByCombination, original.literalsByCombination);
  }
});


test('false-side opacity also survives on ordinary containers without slot inference', () => {
  const set = reorderedSwapFixture();
  for (const v of set.variants) {
    v.children = [];
    v.opacity = v.variantProperties!.Selected === 'True' ? 1 : 0.35;
  }
  delete set.propertyDefinitions!.Normal;
  delete set.propertyDefinitions!.Chosen;
  const contract = ContractSchema.parse(proposeBoxes(set).contract);
  assert.deepEqual(contract.anatomy.root.literalsByCombination, [{ props: ['selected'], rows: [
    { values: ['false'], literals: { opacity: '0.35' } },
    { values: ['true'], literals: { opacity: '1' } },
  ] }]);
  assert(contract.props.some(p => p.name === 'selected'));
});

test('mixed swap-slot placement carries exact absolute offsets without changing in-flow size', () => {
  const set = reorderedSwapFixture();
  for (const v of set.variants) for (const n of v.children!) {
    if ((n.propRefs!.mainComponent === 'Normal') === (v.variantProperties!.Selected === 'True'))
      n.abs = {x:7.25,y:8.125,right:24.75,bottom:23.875,width:8,height:8,
        constraints:{horizontal:'LEFT',vertical:'TOP'}};
  }
  const result = proposeBoxes(set), contract = ContractSchema.parse(result.contract);
  const parts = Object.values(contract.anatomy.root.parts!);
  assert.equal(parts.length,2);
  for (const p of parts) {
    assert(p.slot);
    assert.equal(p.declared?.position, undefined);
    assert.equal(p.tokens?.width,undefined);
    assert.equal(p.tokens?.height,undefined);
    assert(p.stylesWhen?.some(rule => rule.styles.position === 'absolute'));
    assert(p.tokens?.left || p.literals?.left || p.literalsByCombination?.some(t => t.rows.some(r => r.literals.left)));
  }
  assert(parts.some(p=>p.stylesWhen?.some(rule=>rule.equals==='false'&&rule.styles.position==='absolute')));
  assert(parts.some(p=>p.stylesWhen?.some(rule=>rule.equals==='true'&&rule.styles.position==='absolute')));
  assert(!result.notes.some(note=>note.includes('absolute placement captured')&&note.includes('NOT carried')));
});

test('mixed slot placement refuses tuple-dependent flow instead of freezing the first plane', () => {
  const set = reorderedSwapFixture();
  set.propertyDefinitions!.Tone = {type:'VARIANT',defaultValue:'A',variantOptions:['A','B']};
  set.variants = set.variants.flatMap(v => ['A','B'].map(tone => {
    const copy=structuredClone(v);copy.name+=`, Tone=${tone}`;copy.variantProperties!.Tone=tone;
    const normal=copy.children!.find(n=>n.propRefs!.mainComponent==='Normal')!;
    if((copy.variantProperties!.Selected==='True') === (tone==='B'))
      normal.abs={x:7,y:8,right:25,bottom:24,width:8,height:8,constraints:{horizontal:'LEFT',vertical:'TOP'}};
    return copy;
  }));
  const result=proposeBoxes(set),contract=ContractSchema.parse(result.contract);
  const parts=Object.values(contract.anatomy.root.parts!);
  assert(!parts.some(p=>p.stylesWhen?.some(rule=>rule.styles.position==='absolute')));
  assert(result.notes.some(n=>n.includes('absolute/in-flow slot usage is not a complete function of one declared axis')));
});

test('REST instance sizing records explicit modes and local fixed extents, never bbox sizes', () => {
  const node = child({type:'INSTANCE',size:{x:24.125,y:18.25},absoluteBoundingBox:{...box,width:99,height:101}});
  assert.deepEqual(capture(node).instanceSizing,{horizontal:'FIXED',vertical:'FIXED',width:24.125,height:18.25});
  assert.deepEqual(capture({...node,layoutSizingHorizontal:'HUG',layoutSizingVertical:'FILL'}).instanceSizing,{horizontal:'HUG',vertical:'FILL'});
  assert.deepEqual(capture({...node,size:undefined}).instanceSizing,{horizontal:'FIXED',vertical:'FIXED'});
  assert.equal(capture({...node,rotation:.00000001}).instanceSizing,undefined);
  assert.equal(capture(node,{layoutMode:'NONE'}).instanceSizing,undefined);
});

test('plugin and REST agree on instance local FIXED, HUG, FILL and uncaptured modes', async () => {
  const {figma:mockFigma}=createFigmaMock();const figma:any=mockFigma;
  const main=figma.createComponent();main.name='SizingChild';
  const modes=[['FIXED','FIXED'],['HUG','FILL'],['FILL','HUG'],[undefined,undefined]] as const;
  const variants=[];
  for(const [i,[horizontal,vertical]] of modes.entries()){
    const c=figma.createComponent();c.name=`Case=${i}`;c.layoutMode='HORIZONTAL';variants.push(c);
    const n=main.createInstance();n.name='Indicator';n.width=24.125;n.height=18.25;
    n.layoutSizingHorizontal=horizontal;n.layoutSizingVertical=vertical;c.appendChild(n);
  }
  const set=figma.combineAsVariants(variants,figma.currentPage);set.name='InstanceSizingProbe';
  const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['InstanceSizingProbe'];");
  const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
  const dumps:any=await vm.runInContext(`(async()=>{${source}})()`,context,{timeout:20000});
  const actual=Array.from(dumps.InstanceSizingProbe.variants,(v:any)=>v.children[0].instanceSizing&&JSON.parse(JSON.stringify(v.children[0].instanceSizing)));
  const expected=modes.map(([horizontal,vertical])=>capture(child({type:'INSTANCE',size:{x:24.125,y:18.25},layoutSizingHorizontal:horizontal,layoutSizingVertical:vertical})).instanceSizing);
  assert.deepEqual(actual,expected);
});

test('instance FIXED usage sizes the slot wrapper without freezing missing, HUG or FILL planes', () => {
  const make=()=>{const set=reorderedSwapFixture();for(const v of set.variants)for(const n of v.children!)n.instanceSizing={horizontal:'FIXED',vertical:'FIXED',width:24.125,height:18.25};return set;};
  const result=proposeBoxes(make()),contract=ContractSchema.parse(result.contract);
  for(const p of Object.values(contract.anatomy.root.parts!)){
    assert(p.tokens?.width&&p.tokens.height&&p.tokens['flex-shrink']);
  }
  for(const mode of ['HUG','FILL',undefined] as const){
    const set=make();
    for(const n of set.variants[1].children!){
      if(mode===undefined)delete n.instanceSizing;
      else n.instanceSizing={horizontal:mode,vertical:'FIXED',height:18.25};
    }
    const guarded=ContractSchema.parse(proposeBoxes(set).contract);
    for(const p of Object.values(guarded.anatomy.root.parts!)){
      assert.equal(p.tokens?.width,undefined);
      assert.equal(p.tokens?.['flex-shrink'],undefined);
    }
  }
});


function compoundFillFixture(): DumpSet {
  const set=reorderedSwapFixture();
  delete set.propertyDefinitions!.Normal;delete set.propertyDefinitions!.Chosen;
  set.propertyDefinitions!.Tone={type:'VARIANT',defaultValue:'A',variantOptions:['A','B']};
  set.variants=set.variants.flatMap(v=>['A','B'].map(tone=>{
    const selected=v.variantProperties!.Selected;
    const fills=!(selected==='False'&&tone==='A');
    return {...v,name:`Selected=${selected}, Tone=${tone}`,variantProperties:{Selected:selected,Tone:tone},
      bbox:{width:80,height:40},layout:{mode:'VERTICAL' as const,primarySizing:'FIXED' as const,counterSizing:'FIXED' as const,padding:[0,0,0,0] as [number,number,number,number]},
      children:[{name:'Filler',type:'FRAME' as const,fillWidth:fills,
        layout:{mode:'HORIZONTAL' as const,primarySizing:fills?'FIXED' as const:'AUTO' as const,counterSizing:'FIXED' as const,padding:[0,0,0,0] as [number,number,number,number]},
        fixedSize:{height:10},children:[{name:'Glyph',type:'RECTANGLE' as const,shape:{kind:'rect' as const,width:20,height:10}}]}]};
  }));
  return set;
}

test('compound FILL reaches literal rows and both browser surfaces without freezing HUG',async()=>{
  const result=proposeBoxes(compoundFillFixture()),contract=ContractSchema.parse(result.contract);
  const filler=Object.values(contract.anatomy.root.parts!)[0];
  for(const selected of ['false','true'])for(const tone of ['a','b'])
    assert.equal(resolveLiterals(filler,{selected,tone}).width,selected==='false'&&tone==='a'?undefined:'100%');
  const tree=result.mintedTokens!.tree,contracts=new Map([[contract.id,contract]]);
  const css=emitReact(contract,{contracts,icons:new Map(),tokens:tokenInventoryFromJson([tree])});
  const inline={...emitReactInline(contract,{contracts,icons:new Map(),tokens:{primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}}}),css:''};
  const browser=await chromium.launch();
  try{const page=await browser.newPage();
    for(const output of [css,inline]){
      const render=await mountGenerated(page,contract.name,output.tsx,mintedTokenCss(tree)+output.css);
      for(const selected of [false,true])for(const tone of ['a','b']){
        await render({selected,tone});
        const width=await page.locator('#root > *').evaluate(root=>root.children[0].getBoundingClientRect().width);
        assert.equal(width,!selected&&tone==='a'?20:80);
      }
    }
  }finally{await browser.close();}
});

test('compound FILL refuses conflicting tuples, missing axis values and indefinite parents',()=>{
 for(const mutation of ['conflict','missing','hug'] as const){
  const set=compoundFillFixture();
  if(mutation==='conflict'){const duplicate=structuredClone(set.variants[0]);duplicate.children![0].fillWidth=true;set.variants.push(duplicate);}
  if(mutation==='missing')delete set.variants[0].variantProperties!.Tone;
  if(mutation==='hug')for(const v of set.variants){v.layout!.counterSizing='AUTO';delete v.bbox;}
  if(mutation!=='hug'){assert.throws(()=>proposeBoxes(set),ExactProjectionError);continue;}
  const result=proposeBoxes(set),contract=ContractSchema.parse(result.contract);
  const filler=Object.values(contract.anatomy.root.parts!)[0];
  assert(!filler.literalsByCombination?.some(t=>t.rows.some(r=>r.literals.width==='100%')),mutation);
 }
});


test('compound FILL lowers to native FILL only on the exact observed tuples',()=>{
 const result=proposeBoxes(compoundFillFixture()),contract=ContractSchema.parse(result.contract),tree=result.mintedTokens!.tree;
 const engine=createFigmaEngine({tokens:{primitives:tree,semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
 const compiled=engine.compileComponentData(contract,new Map([[contract.id,contract]]));
 assert.equal(compiled.variants.length,4);
 const key=Object.keys(contract.anatomy.root.parts!)[0];
 for(const v of compiled.variants){
  const filler=v.spec.children!.find(n=>n.name===key)!;assert(filler);
  const hug=v.name.includes('Selected=False')&&v.name.includes('Tone=A');
  assert.equal(filler.widthFill===true,!hug);
  assert.equal(filler.fillW===true,!hug);
 }
});

test('explicit root overrides preserve local dimensions even under HUG without treating bbox as authority', () => {
 const node=child({type:'INSTANCE',componentId:'main:1',size:{x:24.125,y:18.25},layoutSizingHorizontal:'HUG',layoutSizingVertical:'HUG',
  overrides:[{id:'1:3',overriddenFields:['width','paddingLeft','height']}]});
 const before=JSON.stringify(node);
 assert.deepEqual(capture(node).instanceRootOverrides,{nodeId:'1:3',componentId:'main:1',fields:['height','paddingLeft','width'],localSize:{width:24.125,height:18.25}});
 assert.deepEqual(capture(node).instanceSizing,{horizontal:'HUG',vertical:'HUG'});
 assert.equal(JSON.stringify(node),before);
 assert.deepEqual(capture({...node,overrides:[]}).instanceRootOverrides,{nodeId:'1:3',componentId:'main:1',fields:[]});
 assert.equal(capture({...node,overrides:undefined}).instanceRootOverrides,undefined);
 assert.equal(capture({...node,componentId:undefined}).instanceRootOverrides,undefined);
 assert.deepEqual(capture({...node,overrides:[{id:'foreign',overriddenFields:['width']}]}).instanceRootOverrides,{nodeId:'1:3',componentId:'main:1',fields:[]});
 assert.equal(capture({...node,overrides:[{id:'1:3',overriddenFields:[]},...node.overrides!]}).instanceRootOverrides,undefined);
 assert.equal(capture({...node,overrides:[...node.overrides!,...node.overrides!]}).instanceRootOverrides,undefined);
 for(const size of [undefined,{x:NaN,y:-1}]) assert.equal(capture({...node,size}).instanceRootOverrides?.localSize,undefined);
 assert.deepEqual(capture({...node,overrides:[{id:'1:3',overriddenFields:['width']}]}).instanceRootOverrides?.localSize,{width:24.125});
});

test('plugin and REST root override witnesses agree and duplicate root rows fail closed', async () => {
 const {figma:mockFigma}=createFigmaMock();const figma:any=mockFigma;
 const main=figma.createComponent();main.name='RootOverrideChild';main.layoutMode='HORIZONTAL';main.paddingTop=2;main.paddingRight=3;main.paddingBottom=4;main.paddingLeft=5;const variants=[],expected=[];
 const cases=[{fields:['width','height','paddingLeft'],width:24.125,height:18.25},
  {fields:['width'],width:0,height:18.25},{fields:['height'],width:24,height:18.25},
  {fields:['paddingLeft'],width:24,height:18},{fields:['width','height'],width:24,height:18,duplicate:true},
  {fields:['width','height'],width:24,height:18,foreign:true},
  {fields:[],width:24,height:18},{fields:[],width:24,height:18,duplicate:true},
  {fields:[],width:24,height:18,empty:true},{fields:[],width:24,height:18,missing:true}];
 for(const [i,spec] of cases.entries()){
  const c=figma.createComponent();c.name=`Case=${i}`;c.layoutMode='HORIZONTAL';variants.push(c);
  const n=main.createInstance();n.name='Indicator';n.width=spec.width;n.height=spec.height;n.layoutSizingHorizontal='HUG';n.layoutSizingVertical='HUG';n.relativeTransform=[[1,0,0],[0,1,0]];
  n.overrides=[{id:spec.foreign?'foreign':n.id,overriddenFields:spec.fields}];if(spec.duplicate)n.overrides.push({...n.overrides[0]});if(spec.empty)n.overrides=[];if(spec.missing)delete n.overrides;c.appendChild(n);
  const witness=capture(child({id:n.id,type:'INSTANCE',componentId:main.id,size:{x:n.width,y:n.height},layoutSizingHorizontal:'HUG',layoutSizingVertical:'HUG',overrides:n.overrides}),{}, {id:main.id,name:main.name,type:'COMPONENT',layoutMode:'HORIZONTAL',paddingTop:2,paddingRight:3,paddingBottom:4,paddingLeft:5,size:{x:main.width,y:main.height}}).instanceRootOverrides;
  if(witness){witness.componentKey=main.key;witness.localTransform=JSON.parse(JSON.stringify(n.relativeTransform))}expected.push(witness);
 }
 const set=figma.combineAsVariants(variants,figma.currentPage);set.name='RootOverrideProbe';
 const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['RootOverrideProbe'];");
 const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const dumps:any=await vm.runInContext(`(async()=>{${source}})()`,context,{timeout:20000});
 const actual=Array.from(dumps.RootOverrideProbe.variants,(v:any)=>v.children[0].instanceRootOverrides&&JSON.parse(JSON.stringify(v.children[0].instanceRootOverrides)));
 assert.deepEqual(actual,expected);
});

test('REST fill absence is explicit only for a captured empty array',()=>{
 for(const fills of [undefined,[],[{type:'SOLID',visible:false,color:{r:0,g:0,b:0,a:1}}]]){
  const root:RestNode={id:'1:1',name:'Paint',type:'COMPONENT',fills: fills as any};
  const result=mapRestToDump({nodes:{root:{document:root}}});
  const n=(result.dump.Paint as DumpSet).variants[0];
  assert.equal(n.sourceEmptyFill,Array.isArray(fills)&&fills.length===0?true:undefined);
 }
});


test('REST inherited padding witness rejects incomplete and contradictory main captures',()=>{
 const node=child({type:'INSTANCE',componentId:'main:1',overrides:[]});
 const main:RestNode={id:'main:1',name:'Main',type:'COMPONENT',layoutMode:'HORIZONTAL',paddingTop:2,paddingRight:3,paddingBottom:4,paddingLeft:5};
 assert.deepEqual(capture(node,{},main).instanceRootOverrides?.mainPadding,[2,3,4,5]);
 for(const changed of [{paddingLeft:undefined},{paddingTop:NaN},{paddingBottom:-1},{layoutMode:'NONE'}])
  assert.equal(capture(node,{}, {...main,...changed} as RestNode).instanceRootOverrides?.mainPadding,undefined);
 const root:RestNode={id:'1:2',name:'Only',type:'COMPONENT',children:[node]};
 for(const changed of [{paddingLeft:6},{paddingLeft:undefined}]){
  const result=mapRestToDump({nodes:{root:{document:root},a:{document:main},b:{document:{...main,...changed}}}});
  assert.equal((result.dump.Only as DumpSet).variants[0].children![0].instanceRootOverrides?.mainPadding,undefined);
 }
});


test('fixed text boxes carry only explicit dimensions compatible with text resizing',()=>{
 const text=child({type:'TEXT',characters:'First\nSecond',style:{fontFamily:'Arial',fontSize:14,textAutoResize:'NONE'}});
 assert.deepEqual(capture(text).fixedSize,{width:box.width,height:box.height});
 assert.deepEqual(capture({...text,layoutSizingHorizontal:'FILL'}).fixedSize,{height:box.height});
 assert.deepEqual(capture({...text,style:{...text.style,textAutoResize:'HEIGHT'}}).fixedSize,{width:box.width});
 for(const mode of ['WIDTH_AND_HEIGHT','TRUNCATE'])assert.equal(capture({...text,style:{...text.style,textAutoResize:mode}}).fixedSize,undefined);
 assert.equal(capture({...text,rotation:.00000001}).fixedSize,undefined);
 assert.equal(capture({...text,layoutSizingHorizontal:'FILL',layoutSizingVertical:'FILL'}).fixedSize,undefined);
});

test('native and REST fixed text extents agree without assigning FILL dimensions',async()=>{
 const specs=[{mode:'NONE',horizontal:'FIXED',vertical:'FIXED'},{mode:'NONE',horizontal:'FILL',vertical:'FIXED'},{mode:'HEIGHT',horizontal:'FIXED',vertical:'HUG'},{mode:'WIDTH_AND_HEIGHT',horizontal:'HUG',vertical:'HUG'},{mode:'TRUNCATE',horizontal:'FIXED',vertical:'FIXED'}] as const;
 const {figma:mock}=createFigmaMock(),figma:any=mock,variants:any[]=[];
 for(const [i,s]of specs.entries()){
  const c=figma.createComponent();c.name=`Case=${i}`;c.layoutMode='HORIZONTAL';variants.push(c);
  const n=figma.createText();n.name='Indicator';n.characters='First\nSecond';n.textAutoResize=s.mode;n.layoutSizingHorizontal=s.horizontal;n.layoutSizingVertical=s.vertical;Object.defineProperty(n,'width',{value:box.width,configurable:true});Object.defineProperty(n,'height',{value:box.height,configurable:true});c.appendChild(n);
 }
 const set=figma.combineAsVariants(variants,figma.currentPage);set.name='FixedTextProbe';
 const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['FixedTextProbe'];");
 const dumps=await vm.runInContext(`(async()=>{${source}})()`,vm.createContext({figma,console:{log(){},warn(){},error(){}}}),{timeout:20000});
 assert.deepEqual(Array.from(dumps.FixedTextProbe.variants,(v:any)=>v.children[0].fixedSize&&JSON.parse(JSON.stringify(v.children[0].fixedSize))),specs.map(s=>capture(child({type:'TEXT',characters:'First\nSecond',style:{fontFamily:'Arial',fontSize:14,textAutoResize:s.mode},layoutSizingHorizontal:s.horizontal,layoutSizingVertical:s.vertical})).fixedSize));
});
