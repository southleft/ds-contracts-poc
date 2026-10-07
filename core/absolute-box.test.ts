import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { nativeComparisonFixture } from './native-contract-comparison-test-fixture.js';
import { emitNativeContractReadbackScript, verifyNativeContractReadback } from './native-source-observation.js';
import { revisionOf } from './contract-provenance.js';
import { proposeFromDump } from './propose-figma.js';
import { tokenCorpusFromJson } from './token-corpus.js';
import { ContractSchema } from '../scripts/contract-schema.js';
import { createFigmaEngine } from './emit-figma-script.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { mountGenerated } from './react-test-runtime.js';
import { flattenTokens } from './tokens.js';
import { emitTokensCss } from '../packages/core/src/emit-tokens-css.js';
import type { DumpSet } from '../extract/figma/types.js';

test('native creation and independent verification use the CSS padding origin, including asymmetric and bound borders', async () => {
  const f = await nativeComparisonFixture();
  for (const [i, border] of [{ 'border-width': '1px' }, { 'border-top-width': '1px', 'border-right-width': '2px',
    'border-bottom-width': '3px', 'border-left-width': '4px' }].entries()) {
    const c = f.contract('fixture.absolute-' + i, { root: { layout: { display: 'flex' }, declared: { position: 'relative' },
      literals: { width: '32px', height: '18.390625px', ...border, 'border-color': 'transparent' }, parts: {
        box: { shape: { kind: 'rect', width: 54, height: 32.390625 }, declared: { position: 'absolute' },
          literals: { left: '-12.015625px', top: '-8px', 'background-color': 'transparent' } },
      } } });
    const byId = new Map([[c.id, c]]), compiled = f.engine.compileNativeContractDraft(c, byId, f.source);
    const shape = compiled.component.variants[0].spec.children![0];
    assert.deepEqual(shape.absolute, { h: 'MIN', v: 'MIN', left: i ? -8.015625 : -11.015625, top: -7 });
    const context = await f.context(`10000000-0000-4000-8000-00000000001${i}`);
    const creation = await f.run(f.engine.buildNativeContractDraftScript(c, byId, f.source, context));
    assert.equal(creation.status, 'created-candidate', JSON.stringify(creation));
    const input = { operation: context.operation, planRevision: revisionOf(c), projection: compiled.projection,
      component: compiled.component, tokenInput: context.tokens.input, tokenIdentity: context.tokens.identity, creation };
    const receipt = await f.run(emitNativeContractReadbackScript(input));
    assert.equal(verifyNativeContractReadback(input, receipt).status, 'supported-structure-observed');
    const actual = receipt.nodes.find((n: any) => n.type === 'RECTANGLE');
    assert.equal(actual.values.x, shape.absolute!.left); assert.equal(actual.values.y, -7);
    assert.equal(actual.values.height, 32.390625);
    const bad = structuredClone(receipt); bad.nodes.find((n: any) => n.type === 'RECTANGLE').values.x = -12.015625;
    assert.equal(verifyNativeContractReadback(input, bad).status, 'refused');
    c.anatomy.root.literals!.width = '64px'; c.anatomy.root.literals!.height = '48px';
    c.anatomy.root.tokens = { 'border-width': '{size}' }; delete c.anatomy.root.literals!['border-width'];
    if (!i) assert.equal(f.engine.compileComponentData(c, byId).variants[0].spec.children![0].absolute!.left, 1.984375);
  }
});

test('native shape positions survive proposal, emitted browser layout and native recompilation without decimal rounding', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const kind of ['rect', 'ellipse'] as const) for (const mode of ['inside', 'asymmetric', 'outside', 'ring'] as const)
      for (const [horizontal, vertical] of [['LEFT', 'TOP'], ['RIGHT', 'BOTTOM'], ['CENTER', 'CENTER']] as const) {
      const base = { w: { $type: 'dimension', $value: '64.375px' }, h: { $type: 'dimension', $value: '48.390625px' } };
      const set: DumpSet = { setName: 'AbsoluteProbe', type: 'COMPONENT', variants: [{ name: 'AbsoluteProbe', type: 'COMPONENT',
        layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', primarySizing: 'FIXED', counterSizing: 'FIXED', padding: [0, 0, 0, 0] }, bound: { width: 'w', height: 'h' },
        stroke: { hex: '334455' }, strokeAlign: mode === 'outside' ? 'OUTSIDE' : 'INSIDE',
        ...(mode === 'asymmetric' ? { strokeWeights: { top: 1, right: 2, bottom: 3, left: 4 } } : { strokeWeight: 1 }),
        strokesIncludedInLayout: mode !== 'ring', children: [{ name: 'Mark', type: kind === 'rect' ? 'RECTANGLE' : 'ELLIPSE',
          fill: { hex: 'abcdef' }, shape: { kind, width: 12.390625, height: 9.125, x: -7.015625, y: -2.125,
            right: 59, bottom: 41.390625, constraints: { horizontal, vertical } } }],
      }] };
      const proposal = proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: base, semantic: {}, light: {}, brandDefault: {} }),
        contractIdByName: new Map(), projectionMode: 'reviewable-inversion', mintUnbound: true });
      const c = ContractSchema.parse(proposal.contract), tokens = { ...base, ...proposal.mintedTokens?.tree }, byId = new Map([[c.id, c]]);
      const engine = createFigmaEngine({ tokens: { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } }, icons: new Map() });
      const compiled = engine.compileComponentData(c, byId), child = compiled.variants[0].spec.children![0];
      assert.equal(child.absolute!.left ?? 64.375-child.absolute!.right!-12.390625, -7.015625, kind + ':' + mode);
      assert.equal(child.absolute!.top ?? 48.390625-child.absolute!.bottom!-9.125, -2.125);
      for (const surface of ['module', 'inline']) {
        const tokenInput = { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
        const out = surface === 'module'
          ? emitReact(c, { contracts: byId, icons: new Map(), tokens: new Set(flattenTokens(tokens).keys()), tokenValues: tokenInput })
          : { ...emitReactInline(c, { contracts: byId, icons: new Map(), tokens: tokenInput }), css: '' };
        await mountGenerated(page, c.name, out.tsx, out.css);
        const css = emitTokensCss([{ name: 'default', selector: ':root', parts: [{ slot: 'observed', tree: tokens }] }]);
        await page.addStyleTag({ content: css.css });
        const observed = await page.locator('#root > *').evaluate(root => {
          const r = root.getBoundingClientRect(), b = root.children[0].getBoundingClientRect();
          return { x: b.x - r.x, y: b.y - r.y, width: b.width, height: b.height };
        });
        assert.deepEqual(observed, { x: -7.015625, y: -2.125, width: 12.390625, height: 9.125 }, kind + ':' + mode + ':' + surface + ':' + horizontal);
      }
    }
  } finally { await browser.close(); }
});

test('state-varying border sides retain the observed absolute box in both React surfaces', async () => {
  const base = { w: { $type: 'dimension', $value: '64px' }, h: { $type: 'dimension', $value: '48px' } };
  const set: DumpSet = { setName: 'StateBorder', type: 'COMPONENT_SET', variants: ['Tone=A', 'Tone=B'].map((name, index) => ({ name, type: 'COMPONENT',
    layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', primarySizing: 'FIXED', counterSizing: 'FIXED', padding: [0, 0, 0, 0] }, bound: { width: 'w', height: 'h' },
    stroke: { hex: '123456' }, strokeAlign: 'INSIDE', strokesIncludedInLayout: true,
    strokeWeights: { top: 1 + index, right: 2 + index, bottom: 3 + index, left: 4 + index },
    children: [{ name: 'Box', type: 'RECTANGLE', fill: { hex: 'abcdef' },
      shape: { kind: 'rect', width: 12, height: 10, x: -3.015625, y: -4.125, right: 55.015625, bottom: 42.125,
        constraints: { horizontal: 'LEFT', vertical: 'TOP' } } }],
  })) };
  const proposal = proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: base, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map(), projectionMode: 'reviewable-inversion', mintUnbound: true });
  const c = ContractSchema.parse(proposal.contract), tokens = { ...base, ...proposal.mintedTokens?.tree }, byId = new Map([[c.id, c]]);
  const tokenInput = { primitives: tokens, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const surface of ['module', 'inline']) for (const tone of ['a', 'b']) {
      const out = surface === 'module'
        ? emitReact(c, { contracts: byId, icons: new Map(), tokens: new Set(flattenTokens(tokens).keys()), tokenValues: tokenInput })
        : { ...emitReactInline(c, { contracts: byId, icons: new Map(), tokens: tokenInput }), css: '' };
      await mountGenerated(page, c.name, out.tsx, out.css);
      await page.evaluate(tone => (window as any).renderSubject({ tone }), tone);
      await page.addStyleTag({ content: emitTokensCss([{ name: 'default', selector: ':root', parts: [{ slot: 'observed', tree: tokens }] }]).css });
      const box = await page.locator('#root > *').evaluate(root => {
        const r = root.getBoundingClientRect(), b = root.children[0].getBoundingClientRect();
        return { x: b.x-r.x, y: b.y-r.y, border: getComputedStyle(root).borderLeftWidth };
      });
      assert.deepEqual(box, { x: -3.015625, y: -4.125, border: tone === 'a' ? '4px' : '5px' });
    }
  } finally { await browser.close(); }
});

test('unknown, invalid and contradictory parent coordinate bases refuse without rewriting the native dump', () => {
  const fixture = (): DumpSet => ({ setName: 'BorderBasis', type: 'COMPONENT_SET', variants: ['Tone=A', 'Tone=B'].map(name => ({ name, type: 'COMPONENT',
    layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'MIN', primarySizing: 'FIXED', counterSizing: 'FIXED', padding: [0, 0, 0, 0] }, stroke: { hex: '112233' }, strokeWeight: 1,
    strokeAlign: 'INSIDE', strokesIncludedInLayout: true, children: [{ name: 'Box', type: 'RECTANGLE',
      shape: { kind: 'rect', width: 12, height: 10, x: -3, y: -4, right: 21, bottom: 22,
        constraints: { horizontal: 'LEFT', vertical: 'TOP' } } }],
  })) });
  const propose = (set: DumpSet) => proposeFromDump(set, { corpus: tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} }),
    contractIdByName: new Map(), projectionMode: 'reviewable-inversion', mintUnbound: true });
  for (const change of [
    (s: DumpSet) => { s.variants[0].strokeAlign = 'OUTSIDE'; },
    (s: DumpSet) => { s.variants[0].strokesIncludedInLayout = false; },
    (s: DumpSet) => { s.variants[0].strokesIncludedInLayout = false; delete s.variants[1].strokesIncludedInLayout; },
    (s: DumpSet) => { s.variants[0].strokeWeight = -1; },
    (s: DumpSet) => { s.variants[0].bound = { strokeWeight: 'missing' }; },
    (s: DumpSet) => { s.variants[0].strokeWeights = { top: 1, right: NaN, bottom: 1, left: 1 }; },
    (s: DumpSet) => { s.variants[0].strokeWeights = { top: 1, right: 2, bottom: 3, left: 4 }; s.variants[0].bound = { strokeTopWeight: 'missing' }; },
  ]) {
    const set = fixture(); change(set); const before = structuredClone(set);
    assert.throws(() => propose(set), /absolute-box-/, JSON.stringify(set.variants.map(v=>({align:v.strokeAlign,layout:v.strokesIncludedInLayout,weight:v.strokeWeight,weights:v.strokeWeights,bound:v.bound})))); assert.deepEqual(set, before);
  }
});


test('a four-inset content overlay uses the CSS padding edge in browser and native output', async () => {
 const f=await nativeComparisonFixture();
 const c=f.contract('fixture.inset-content',{root:{layout:{display:'flex'},declared:{position:'relative'},
  literals:{width:'180px',height:'28px','border-width':'1px','border-color':'transparent'},parts:{
   content:{layout:{display:'flex',direction:'column'},declared:{position:'absolute'},
    literals:{top:'34px',right:'-1px',bottom:'-40px',left:'0px',width:'100px',height:'32px','background-color':'#ff0000'}}}}});
 const byId=new Map([[c.id,c]]),compiled=f.engine.compileComponentData(c,byId),spec=compiled.variants[0].spec.children![0];
 assert.deepEqual(spec.insetOffsets,{top:35,right:0,bottom:-39,left:1});
 await f.run(`await(async()=>{${f.engine.buildComponentScript(c,byId)}})();return {ok:true};`);
 const native=f.figma.root.findAll((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id)[0];
 assert.equal(native.children[0].x,1);assert.equal(native.children[0].y,35);
 const browser=await chromium.launch();
 try {const page=await browser.newPage();
  const out=emitReact(c,{contracts:byId,icons:new Map(),tokens:new Set()});await mountGenerated(page,c.name,out.tsx,out.css);
  assert.deepEqual(await page.locator('#root > *').evaluate(root=>{const r=root.getBoundingClientRect(),b=root.children[0].getBoundingClientRect();return {x:b.x-r.x,y:b.y-r.y};}),{x:1,y:35});
 } finally {await browser.close();}
});

test('explicit false-side placement agrees in both React surfaces and native variants', async () => {
  const contract = ContractSchema.parse({id:'check.false-placement',name:'FalsePlacement',version:'0.1.0',status:'draft',
    description:'False-side placement probe',semantics:{element:'div'},states:[],
    props:[{name:'selected',type:'boolean',default:false,bindings:{code:{prop:'selected'},figma:{kind:'VARIANT',property:'Selected',values:{false:'False',true:'True'}}}}],
    anatomy:{root:{layout:{display:'flex'},declared:{position:'relative'},literals:{width:'40px',height:'40px'},parts:{
      floating:{attrs:{'data-probe':'floating'},text:'X',literals:{width:'8px',height:'8px',left:'7.25px',top:'8.125px'},
        stylesWhen:[{prop:'selected',equals:'false',styles:{position:'absolute'}}]},
    }}},bindings:{code:{anchors:{importPath:'./FalsePlacement',export:'FalsePlacement'}},figma:{anchors:{fileKey:'fixture',componentSetKey:'false-placement'}}}});
  const scope=new Map([[contract.id,contract]]);
  const engine=createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
  const compiled=engine.compileComponentData(contract,scope);
  for(const variant of compiled.variants){
    const floating=variant.spec.children!.find(n=>n.name==='floating')!;
    assert(floating);
    if(variant.name==='Selected=False')assert.deepEqual(floating.absolute,{h:'MIN',v:'MIN',left:7.25,top:8.125});
    else assert.equal(floating.absolute,undefined);
  }
  for (const defaultValue of [false,true,undefined]) {
    const nativeBoolean = structuredClone(contract);
    nativeBoolean.props[0].bindings.figma = {kind:'BOOLEAN',property:'Selected'};
    if(defaultValue === undefined) delete nativeBoolean.props[0].default;
    else nativeBoolean.props[0].default = defaultValue;
    const variant = engine.compileComponentData(nativeBoolean,new Map([[nativeBoolean.id,nativeBoolean]])).variants[0];
    const floating = variant.spec.children!.find(n=>n.name==='floating')!;
    assert.equal(floating.absolute !== undefined,defaultValue === false,'native BOOLEAN default plane');
  }
  const browser=await chromium.launch();
  try{
    for(const emitter of [emitReact,emitReactInline]){
      const page=await browser.newPage();
      try{
        const generated = emitter === emitReact ? emitReact(contract,{contracts:scope,icons:new Map(),tokens:new Set()})
          : {...emitReactInline(contract,{contracts:scope,icons:new Map(),tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}}}),css:''};
        await mountGenerated(page,contract.name,generated.tsx,generated.css);
        const render = (props: Record<string,boolean>) => page.evaluate(props => (window as any).renderSubject(props), props);
        for(const selected of [false,true,false]){
          await render({selected});
          assert.equal(await page.locator('[data-probe="floating"]').evaluate(el=>getComputedStyle(el).position),selected?'static':'absolute',emitter.name);
        }
        // An optional boolean's absence is distinct from explicit false.
        const optional=structuredClone(contract);delete optional.props[0].default;
        const optionalScope = new Map([[optional.id,optional]]);
        const optionalGenerated = emitter === emitReact ? emitReact(optional,{contracts:optionalScope,icons:new Map(),tokens:new Set()})
          : {...emitReactInline(optional,{contracts:optionalScope,icons:new Map(),tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}}}),css:''};
        await mountGenerated(page,optional.name,optionalGenerated.tsx,optionalGenerated.css);
        const renderOptional = (props: Record<string,boolean>) => page.evaluate(props => (window as any).renderSubject(props), props);
        await renderOptional({});
        assert.equal(await page.locator('[data-probe="floating"]').evaluate(el=>getComputedStyle(el).position),'static');
        await renderOptional({selected:false});
        assert.equal(await page.locator('[data-probe="floating"]').evaluate(el=>getComputedStyle(el).position),'absolute');
      }finally{await page.close();}
    }
  }finally{await browser.close();}
});

test('qualified component roots retain stretch and center geometry on both React surfaces and native creation',async()=>{
 const f=await nativeComparisonFixture();
 const child=f.contract('fixture.outline',{root:{instanceRootInputs:['width','height'],layout:{display:'flex'},literals:{width:'fit-content',height:'fit-content'}}});
 child.name='Outline';child.semantics={element:'div'};
 const parent=f.contract('fixture.positioned',{root:{declared:{position:'relative'},literals:{width:'68px',height:'32px'},parts:{ring:{component:{id:child.id},absoluteGeometry:{box:{x:-2,y:-2,width:72,height:36,right:-2,bottom:-2,constraints:{horizontal:'STRETCH',vertical:'CENTER'}},parent:{width:68,height:32},border:{top:0,right:0,bottom:0,left:0}}}}}});
 parent.name='Positioned';parent.semantics={element:'div'};
 const scope=new Map([[child.id,child],[parent.id,parent]]),tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();
 try{for(const surface of ['module','inline']){
  const emit=(c:typeof parent)=>surface==='module'?emitReact(c,{contracts:scope,icons:new Map(),tokens:new Set(),tokenValues:tokens}):{...emitReactInline(c,{contracts:scope,icons:new Map(),tokens}),css:''};
  const p=emit(parent),c=emit(child),page=await browser.newPage();
  try{
   await mountGenerated(page,parent.name,p.tsx,p.css,{Outline:{tsx:c.tsx,css:c.css}});
   const render=(props:Record<string,unknown>)=>page.evaluate(props=>(window as any).renderSubject(props),props);
   for(const [width,height] of [[68,32],[108,52]]){
    await render({style:{width,height}});
    const box=await page.locator('#root > *').evaluate(root=>{const a=root.getBoundingClientRect(),b=root.children[0].getBoundingClientRect();return {x:b.x-a.x,y:b.y-a.y,width:b.width,height:b.height};});
    assert.deepEqual(box,{x:-2,y:(height-32)/2-2,width:width+4,height:36},surface);
   }
  }finally{await page.close();}
 }}finally{await browser.close();}
 await f.run(f.engine.buildComponentScript(child,scope));
 for(const [width,height] of [[68,32],[108,52]]){
  const c=structuredClone(parent);c.id+='-'+width;c.anatomy.root.literals={width:width+'px',height:height+'px'};
  const byId=new Map(scope);byId.set(c.id,c);
  await f.run(f.engine.buildComponentScript(c,byId));
  const root=f.figma.root.findAll((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id)[0];
  const instance=root.children.find((n:any)=>n.type==='INSTANCE');assert(instance);
  assert.deepEqual({x:instance.x,y:instance.y,width:instance.width,height:instance.height},{x:-2,y:(height-32)/2-2,width:width+4,height:36});
 }
 const invalid=structuredClone(child);delete invalid.anatomy.root.instanceRootInputs;
 assert.throws(()=>emitReact(parent,{contracts:new Map([[parent.id,parent],[invalid.id,invalid]]),icons:new Map(),tokens:new Set(),tokenValues:tokens}),/absolute-geometry-host-unproven/);
});

test('independent native readback rejects lost rotation and shifted centers on captured ellipse geometry', async () => {
 const f=await nativeComparisonFixture();
 const c=f.contract('fixture.rotated-geometry',{root:{declared:{position:'relative'},literals:{width:'24px',height:'24px'},parts:{ring:{shape:{kind:'ellipse',width:16,height:12,rotation:-90},tokens:{'background-color':'{surface}'},absoluteGeometry:{box:{x:4,y:6,width:16,height:12,right:4,bottom:6,constraints:{horizontal:'SCALE',vertical:'CENTER'}},parent:{width:24,height:24},border:{left:0,right:0,top:0,bottom:0}}}}}});
 const scope=new Map([[c.id,c]]),compiled=f.engine.compileNativeContractDraft(c,scope,f.source),context=await f.context('10000000-0000-4000-8000-000000000913');
 const creation=await f.run(f.engine.buildNativeContractDraftScript(c,scope,f.source,context));
 assert.equal(creation.status,'created-candidate',JSON.stringify(creation));
 const input={operation:context.operation,planRevision:revisionOf(c),projection:compiled.projection,component:compiled.component,tokenInput:context.tokens.input,tokenIdentity:context.tokens.identity,creation};
 const receipt=await f.run(emitNativeContractReadbackScript(input));
 const checked=verifyNativeContractReadback(input,receipt);assert.equal(checked.status,'supported-structure-observed',JSON.stringify(checked));
 const n=receipt.nodes.find((node:any)=>node.type==='ELLIPSE');assert(n);assert.equal(n.values.rotation,90);assert(Math.abs(n.values.x-6)<1e-9);assert.equal(n.values.y,20);
 for(const [key,value] of [['rotation',0],['x',4],['y',6]] as const){const bad=structuredClone(receipt);bad.nodes.find((node:any)=>node.type==='ELLIPSE').values[key]=value;assert.equal(verifyNativeContractReadback(input,bad).status,'refused');}
});

test('direct instance geometry and paint overrides share the child root without a shrinking wrapper',async()=>{
 const f=await nativeComparisonFixture();
 const child=f.contract('fixture.painted-child',{root:{instanceRootInputs:['width','height'],overridable:['color'],tokens:{color:'{ink}'},literals:{width:'24px',height:'24px'},parts:{label:{text:'X'}}}});child.name='PaintedChild';child.semantics={element:'div'};
 const parent=f.contract('fixture.paint-host',{root:{declared:{position:'relative'},literals:{width:'24px',height:'24px'},parts:{glyph:{component:{id:child.id,overrides:{color:'{ink}'}},absoluteGeometry:{box:{x:6,y:6,width:12,height:12,right:6,bottom:6,constraints:{horizontal:'LEFT',vertical:'TOP'}},parent:{width:24,height:24},border:{top:0,right:0,bottom:0,left:0}}}}}});parent.name='PaintHost';parent.semantics={element:'div'};
 const contracts=new Map([[child.id,child],[parent.id,parent]]),tokens={primitives:{ink:{$type:'color',$value:'#123456'}},semantic:{},light:{},dark:{},brands:{default:{}}};
 const browser=await chromium.launch();try{for(const inline of [false,true]){
  const emit=(c:typeof child)=>inline?{...emitReactInline(c,{tokens,contracts,icons:new Map()}),css:''}:emitReact(c,{tokens:new Set(['ink']),tokenValues:tokens,contracts,icons:new Map()});
  const a=emit(parent),b=emit(child),page=await browser.newPage();try{
   await mountGenerated(page,parent.name,a.tsx,a.css,{PaintedChild:{tsx:b.tsx,css:b.css}});await page.addStyleTag({content:':root{--ink:#123456}'});
   const box=await page.locator('#root > *').evaluate(root=>{const host=root.getBoundingClientRect(),child=root.children[0],b=child.getBoundingClientRect();return {tag:child.tagName,x:b.x-host.x,y:b.y-host.y,width:b.width,height:b.height,color:getComputedStyle(child).color};});
   assert.deepEqual(box,{tag:'DIV',x:6,y:6,width:12,height:12,color:'rgb(18, 52, 86)'});
  }finally{await page.close();}
 }}finally{await browser.close();}
});
