import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';import {emitReact} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';import {emitTokensCss,tokensCssLayers} from '../packages/core/src/emit-tokens-css.js';import {tokenInventoryFromJson} from './tokens.js';
const tokens={primitives:{edge:{$type:'dimension',$value:'2px'},ink:{$type:'color',$value:'#2563eb'}},semantic:{},light:{},dark:{},brands:{default:{}}};
const contract=ContractSchema.parse({"id": "test.arc", "name": "ArcFixture", "version": "0.1.0", "status": "draft", "description": "Arc cap runtime conformance", "semantics": {"element": "div"}, "props": [], "states": [], "anatomy": {"root": {"layout": {"display": "flex"}, "parts": {"ring": {"shape": {"kind": "ellipse", "width": 20, "height": 20, "arc": {"start": 0, "end": 3.769911289215088, "innerRadius": 1, "cap": "SQUARE"}}, "tokens": {"border-color": "{ink}", "border-width": "{edge}"}}}}}, "bindings": {"code": {"anchors": {"importPath": "./ArcFixture", "export": "ArcFixture"}}, "figma": {"anchors": {"fileKey": null, "componentSetKey": null}}}});
const ctx={tokens:tokenInventoryFromJson([tokens.primitives]),tokenValues:tokens,icons:new Map(),contracts:new Map([[contract.id,contract]])};
test('both generated React arc surfaces typecheck, resize, recolor and clean up their paint',async t=>{
 const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
 for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(contract,ctx):emitReactInline(contract,{...ctx,tokens});assert.deepEqual(generatedTypeErrors(contract.name,out.tsx),[]);
  const page=await browser.newPage();const render=await mountGenerated(page,contract.name,out.tsx,'css'in out?String(out.css):'');await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});await render({});
  const svg=page.locator('[data-dsc-arc]');assert.equal(await svg.count(),1);assert.equal(await svg.locator('path').getAttribute('stroke-linecap'),'square');
  await svg.evaluate(el=>{const p=el.parentElement!;p.style.width='32px';p.style.height='32px';p.style.borderWidth='3px';p.style.borderColor='rgb(255, 0, 0)';});
  await page.waitForFunction(()=>document.querySelector('[data-dsc-arc]')?.getAttribute('viewBox')==='0 0 32 32');
  assert.equal(await svg.locator('path').getAttribute('stroke-width'),'3');assert.equal(await svg.locator('path').getAttribute('stroke'),'rgb(255, 0, 0)');
  assert.match((await svg.locator('path').getAttribute('d'))!,/^M 30\.5 16 A 14\.5 14\.5 0 1 1 /);
  await render({});assert.equal(await svg.count(),1);await page.close();
 }
});
test('cap-bearing arcs refuse unsupported filled/donut compositions',()=>{
 const c=structuredClone(contract);c.anatomy.root.parts!.ring.shape!.arc!.innerRadius=.5;
 assert.throws(()=>emitReact(c,{...ctx,contracts:new Map([[c.id,c]])}),/ellipse-arc-cap-composition-unqualified/);
});

import {createFigmaEngine} from './emit-figma-script.js';
import {validateContract} from '../packages/core/src/validate.js';
import {PNG} from 'pngjs';
function donutFixture() {
 const c=structuredClone(contract);c.id='test.filled-arc';c.name='FilledArc';
 c.props=[{name:'sweep',type:{enum:['full','half']},default:'full',bindings:{code:{prop:'sweep'},figma:{kind:'VARIANT',property:'Sweep'}}},
  {name:'hole',type:{enum:['thin','thick']},default:'thin',bindings:{code:{prop:'hole'},figma:{kind:'VARIANT',property:'Hole'}}}];
 c.anatomy.root.literals={width:'40px',height:'20px'};
 c.anatomy.root.parts!.ring={shape:{kind:'ellipse',width:40,height:20,arc:{start:0,end:Math.PI*2,innerRadius:.75},arcByCombination:{props:['sweep','hole'],rows:['full','half'].flatMap(sweep=>['thin','thick'].map(hole=>({values:[sweep,hole],arc:{start:0,end:sweep==='full'?Math.PI*2:Math.PI,innerRadius:hole==='thin'?.75:.25}})))}},tokens:{'background-color':'{ink}'}};
 return c;
}
test('filled ellipse combinations preserve transparent holes and sweep on both React surfaces',async t=>{
 const c=donutFixture(),browser=await chromium.launch();t.after(()=>browser.close());
 const context={...ctx,contracts:new Map([[c.id,c]])};
 for(const surface of ['module','inline']) {
  const out=surface==='module'?emitReact(c,context):emitReactInline(c,{...context,tokens});assert.deepEqual(generatedTypeErrors(c.name,out.tsx),[]);
  const page=await browser.newPage();const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');
  await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
  for(const sweep of ['full','half','full'])for(const hole of ['thin','thick']){
   await render({sweep,hole});
   const png=PNG.sync.read(await page.locator('#root > *').screenshot({omitBackground:true}));
   const alpha=(x:number,y:number)=>png.data[(y*png.width+x)*4+3];
   assert.equal(alpha(20,10),0,`${surface}:${sweep}:${hole}:center`);
   assert(alpha(20,18)>240,`${surface}:${sweep}:${hole}:bottom`);
   assert.equal(alpha(20,1)>240,sweep==='full',`${surface}:${sweep}:${hole}:top`);
   assert.equal(alpha(20,14)>240,hole==='thick',`${surface}:${sweep}:${hole}:hole fraction`);
  }
  await page.close();
 }
});
test('native filled ellipse combinations retain exact arcData and reject ambiguous tables',()=>{
 const c=donutFixture(),scope=new Map([[c.id,c]]);
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,scope);
 assert.equal(native.variants.length,4);
 for(const v of native.variants){
  const serialized=JSON.stringify(v.spec),sweep=v.name.includes('Sweep=full')?'full':'half',hole=v.name.includes('Hole=thin')?'thin':'thick';
  const row=c.anatomy.root.parts!.ring.shape!.arcByCombination!.rows.find(r=>r.values.join() === [sweep,hole].join())!;
  assert(serialized.includes(JSON.stringify(row.arc)),v.name);
  assert(!serialized.includes('arcByCombination'));
 }
 for(const change of [(x:typeof c)=>x.anatomy.root.parts!.ring.shape!.arcByCombination!.rows.pop(),
  (x:typeof c)=>x.anatomy.root.parts!.ring.shape!.arcByCombination!.rows.push(x.anatomy.root.parts!.ring.shape!.arcByCombination!.rows[0]),
  (x:typeof c)=>{x.anatomy.root.parts!.ring.shape!.arcByCombination!.props[0]='unknown'},
  (x:typeof c)=>{x.anatomy.root.parts!.ring.tokens!['border-width']='{edge}'}]){
  const bad=structuredClone(c);change(bad);const errors:string[]=[];validateContract(bad,new Map([[bad.id,bad]]),errors,new Map());assert(errors.some(x=>x.includes('filled-ellipse')),errors.join('\n'));
 }
});

import {proposeFromDump} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import type {DumpSet} from '../extract/figma/types.js';
test('importer carries full and partial filled ellipse holes over independent axes',()=>{
 const set:DumpSet={setName:'ObservedRing',type:'COMPONENT_SET',propertyDefinitions:{Sweep:{type:'VARIANT',defaultValue:'Full',variantOptions:['Full','Partial']},Hole:{type:'VARIANT',defaultValue:'Thin',variantOptions:['Thin','Thick']}},variants:['Full','Partial'].flatMap(sweep=>['Thin','Thick'].map(hole=>({
  name:`Sweep=${sweep}, Hole=${hole}`,variantProperties:{Sweep:sweep,Hole:hole},type:'COMPONENT' as const,bbox:{width:40,height:40},children:[{name:'Ring',type:'ELLIPSE' as const,fill:{hex:'2563eb'},shape:{kind:'ellipse' as const,width:40,height:40,x:0,y:0,arc:{start:0,end:sweep==='Full'?6.2831854820251465:Math.PI,innerRadius:hole==='Thin'?.75:.25}}}]
 })))};
 const before=JSON.stringify(set),proposal=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 const c=ContractSchema.parse(proposal.contract),shape=c.anatomy.root.parts!.Ring.shape!;
 assert.equal(shape.arc!.innerRadius,.75);
 assert.equal(shape.arcByCombination!.rows.length,4);
 for(const v of set.variants){const source=v.children![0].shape!.arc!;assert(shape.arcByCombination!.rows.some(row=>JSON.stringify(row.arc)===JSON.stringify(source)),v.name)}
 assert.equal(JSON.stringify(set),before);
});

test('stroked ellipse rows update sweep and cap on both React surfaces and native output',async t=>{
 const c=structuredClone(contract);c.props=[{name:'sweep',type:{enum:['short','long']},default:'short',bindings:{code:{prop:'sweep'},figma:{kind:'VARIANT',property:'Sweep'}}}];
 const ring=c.anatomy.root.parts!.ring;
 ring.shape!.arc={start:0,end:Math.PI/2,innerRadius:1,cap:'NONE',align:'INSIDE'};
 ring.shape!.arcByCombination={props:['sweep'],rows:[
  {values:['short'],arc:{start:0,end:Math.PI/2,innerRadius:1,cap:'NONE',align:'INSIDE'}},
  {values:['long'],arc:{start:0,end:Math.PI,innerRadius:1,cap:'ROUND',align:'INSIDE'}},
 ]};
 const scope=new Map([[c.id,c]]),context={...ctx,contracts:scope},browser=await chromium.launch();t.after(()=>browser.close());
 for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(c,context):emitReactInline(c,{...context,tokens});
  assert.deepEqual(generatedTypeErrors(c.name,out.tsx),[]);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
   for(const sweep of ['short','long','short']){
    await render({sweep});const svg=page.locator('[data-dsc-arc]');assert.equal(await svg.count(),1);
    const path=svg.locator('path');assert.equal(await path.getAttribute('stroke-linecap'),sweep==='short'?'butt':'round');
    const d=(await path.getAttribute('d'))!;assert.match(d,/^M 19 10 A 9 9 0 0 1 /);assert(d.endsWith(sweep==='short'?'10 19':'1 10.000000000000002'),d);
   }
  }finally{await page.close();}
 }
 const native=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,scope);
 for(const v of native.variants){const matchedArc:{start:number;end:number;innerRadius:number;cap?:string}=ring.shape!.arcByCombination!.rows.find(candidate=>v.name.includes(candidate.values[0]))!.arc;assert(JSON.stringify(v.spec).includes(JSON.stringify(matchedArc)));}
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
 const {default:vm}=await import('node:vm');
 const host=createFigmaMock(),f={figma:host.figma,run:(script:string)=>vm.runInNewContext(`(async()=>{${script}\n})()`,{figma:host.figma,console})};
 const engine=createFigmaEngine({tokens,icons:new Map()});
 await f.run(engine.buildTokensScript(null));await f.run(engine.buildComponentScript(c,scope));
 const root=f.figma.root.findAll((n:any)=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===c.id)[0];
 for(const variant of root.children!){
  const ellipse=variant.findOne((n:any)=>n.type==='ELLIPSE');assert(ellipse);
  const source:{start:number;end:number;innerRadius:number;cap?:string}=ring.shape!.arcByCombination!.rows.find(candidate=>variant.name.includes(candidate.values[0]))!.arc;
  assert.deepEqual(JSON.parse(JSON.stringify(ellipse.arcData)),{startingAngle:source.start,endingAngle:source.end,innerRadius:1});
  assert.equal(ellipse.strokeCap,'cap' in source?source.cap:undefined);
 }
 const bad=structuredClone(c);bad.anatomy.root.parts!.ring.shape!.arcByCombination!.rows.pop();
 assert.throws(()=>emitReact(bad,{...context,contracts:new Map([[bad.id,bad]])}),/coverage-incomplete/);
});

test('captured stroked keyframes retain complete geometry without a first-frame fallback',()=>{
 const set:DumpSet={setName:'ObservedSpinner',type:'COMPONENT_SET',propertyDefinitions:{Frame:{type:'VARIANT',defaultValue:'Short',variantOptions:['Short','Long']},Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']}},variants:['Short','Long'].flatMap(frame=>['Small','Large'].map(size=>({name:`Frame=${frame}, Size=${size}`,variantProperties:{Frame:frame,Size:size},type:'COMPONENT',bbox:{width:size==='Small'?20:32,height:size==='Small'?20:32},children:[{name:'Ring',type:'ELLIPSE',stroke:{hex:'2563eb'},strokeWeight:2,shape:{kind:'ellipse',width:size==='Small'?20:32,height:size==='Small'?20:32,arc:{start:0,end:frame==='Short'?Math.PI/2:Math.PI,innerRadius:1,cap:'NONE'}}}]})))};
 for(const variant of set.variants)variant.children![0].strokeAlign='CENTER';
 const before=JSON.stringify(set),options={corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map<string,string>(),mintUnbound:true};
 const proposal=proposeFromDump(set,options),c=ContractSchema.parse(proposal.contract),shape=c.anatomy.root.parts!.Ring.shape!;
 assert.equal(shape.arcByCombination!.rows.length,4);assert.equal(JSON.stringify(set),before);
 for(const v of set.variants)assert(shape.arcByCombination!.rows.some(row=>JSON.stringify(row.arc)===JSON.stringify({...v.children![0].shape!.arc,align:'CENTER'})));
 const bad=structuredClone(set);delete bad.variants[0].children![0].shape!.arc!.cap;
 assert.throws(()=>proposeFromDump(bad,options),/ellipse-arc-cap-varying-sweep-unqualified/);
});

test('explicit stroke alignment preserves the captured centerline instead of shrinking every arc inward',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const align of ['INSIDE','CENTER','OUTSIDE'] as const){
  const c=structuredClone(contract);c.anatomy.root.parts!.ring.shape!.arc!.align=align;
  const context={...ctx,contracts:new Map([[c.id,c]])};
  for(const surface of ['module','inline']){
   const out=surface==='module'?emitReact(c,context):emitReactInline(c,{...context,tokens});
   const page=await browser.newPage();try{
    await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokens)).css});
    await page.waitForFunction(()=>document.querySelector('[data-dsc-arc] path')?.getAttribute('d'));
    const d=await page.locator('[data-dsc-arc] path').getAttribute('d');
    const radius=align==='INSIDE'?9:align==='CENTER'?10:11;assert(d!.startsWith(`M ${10+radius} 10 A ${radius} ${radius} `),`${align}:${d}`);
    assert.equal(await page.locator('[data-dsc-arc]').evaluate(n=>n.parentElement!.getBoundingClientRect().width),20);
   }finally{await page.close();}
  }
 }
});

test('independent size and rotation preserve arc centers on both React surfaces and native creation',async t=>{
 const set:DumpSet={setName:'RotatingArc',type:'COMPONENT_SET',propertyDefinitions:{Frame:{type:'VARIANT',defaultValue:'Zero',variantOptions:['Zero','Quarter']},Size:{type:'VARIANT',defaultValue:'Small',variantOptions:['Small','Large']}},variants:['Zero','Quarter'].flatMap(frame=>['Small','Large'].map(size=>{
  const extent=size==='Small'?24:48,w=extent*2/3,h=extent/2;
  return {name:`Frame=${frame}, Size=${size}`,variantProperties:{Frame:frame,Size:size},type:'COMPONENT',bbox:{width:extent,height:extent},fixedSize:{width:extent,height:extent},children:[{name:'Ring',type:'ELLIPSE',stroke:{hex:'2563eb'},strokeWeight:2,strokeAlign:'CENTER',shape:{kind:'ellipse',width:w,height:h,x:extent/6,y:extent/4,right:extent/6,bottom:extent/4,constraints:{horizontal:'SCALE',vertical:'CENTER'},rotation:frame==='Zero'?0:-90,arc:{start:0,end:Math.PI/2,innerRadius:1,cap:'NONE'}}}]};
 }))};
 const before=JSON.stringify(set),proposal=proposeFromDump(set,{corpus:tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}}),contractIdByName:new Map(),mintUnbound:true});
 const c=ContractSchema.parse(proposal.contract),ring=c.anatomy.root.parts!.Ring;
 assert.equal(JSON.stringify(set),before);assert.equal(ring.absoluteGeometryByCombination!.rows.length,4);
 assert.equal(ring.stylesWhen!.length,2);
 const tokenInput={primitives:proposal.mintedTokens!.tree,semantic:{},light:{},dark:{},brands:{default:{}}},scope=new Map([[c.id,c]]),context={tokens:tokenInventoryFromJson([tokenInput.primitives]),tokenValues:tokenInput,icons:new Map(),contracts:scope};
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(c,context):emitReactInline(c,{...context,tokens:tokenInput});
  assert.deepEqual(generatedTypeErrors(c.name,out.tsx),[]);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokenInput)).css});
   for(const frame of ['Zero','Quarter','Zero'])for(const size of ['Small','Large']){
    await render({frame:frame.toLowerCase(),size:size.toLowerCase()});
    const result=await page.locator('[data-dsc-arc]').evaluate(el=>{const n=el.parentElement!,p=n.parentElement!,a=n.getBoundingClientRect(),b=p.getBoundingClientRect();return{width:a.width,height:a.height,cx:a.x+a.width/2-b.x,cy:a.y+a.height/2-b.y,transform:getComputedStyle(n).transform};});
    const extent=size==='Small'?24:48;
    assert(Math.abs(result.cx-extent/2)<.02,JSON.stringify({surface,frame,size,result}));assert(Math.abs(result.cy-extent/2)<.02);
    assert.equal(result.width,extent*(frame==='Zero'?2/3:1/2));assert.equal(result.height,extent*(frame==='Zero'?1/2:2/3));
   }
  }finally{await page.close();}
 }
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs'),{default:vm}=await import('node:vm');
 const host=createFigmaMock(),run=(script:string)=>vm.runInNewContext(`(async()=>{${script}\n})()`,{figma:host.figma,console}),engine=createFigmaEngine({tokens:tokenInput,icons:new Map()});
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(c,scope));
 const root=host.figma.root.findAll((n:any)=>n.type==='COMPONENT_SET'&&n.getSharedPluginData('ds_contracts','contractId')===c.id)[0];
 for(const variant of root.children!){
  const n=variant.findOne((node:any)=>node.type==='ELLIPSE'),extent=variant.name.toLowerCase().includes('large')?48:24,quarter=variant.name.toLowerCase().includes('quarter');
  assert(n);assert.equal(n.rotation,quarter?90:0);
  // A -90 degree CSS turn maps local origin to (cx-h/2, cy+w/2).
  assert(Math.abs(n.x-(quarter?extent/4:extent/6))<1e-9);assert(Math.abs(n.y-(quarter?extent*5/6:extent/4))<1e-9);
 }
 for(const transform of ['translateX(2px)','rotate(90deg) scale(2)','rotate(NaNdeg)']){
  const bad=structuredClone(c);bad.anatomy.root.parts!.Ring.stylesWhen![0].styles.transform=transform;
  assert.throws(()=>emitReact(bad,{...context,contracts:new Map([[bad.id,bad]])}),/absolute-geometry-competing-channel/);
 }
});

test('fractional arc paint survives CSS border snapping, token updates and variant overrides',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());
 const c=structuredClone(contract);c.props=[{name:'thick',type:'boolean',default:false,bindings:{code:{prop:'thick'},figma:{kind:'VARIANT',property:'Thick'}}}];
 c.anatomy.root.parts!.ring.tokensByProp=[{prop:'thick',map:{false:{'border-width':'{edge}'},true:{'border-width':'{wide}'}}}];
 const tokenInput={...structuredClone(tokens),primitives:{...structuredClone(tokens.primitives),wide:{$type:'dimension',$value:'2.24px'}}};tokenInput.primitives.edge.$value='1.493333339691162px';
 const context={...ctx,tokens:tokenInventoryFromJson([tokenInput.primitives]),tokenValues:tokenInput,contracts:new Map([[c.id,c]])};
 for(const surface of ['module','inline']){
  const out=surface==='module'?emitReact(c,context):emitReactInline(c,{...context,tokens:tokenInput});
  assert.deepEqual(generatedTypeErrors(c.name,out.tsx),[]);
  const page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,out.tsx,'css'in out?String(out.css):'');await page.addStyleTag({content:emitTokensCss(tokensCssLayers(tokenInput)).css});
   for(const thick of [false,true,false]){
    await render({thick});
    const expected=thick?2.24:1.493333339691162;
    await page.waitForFunction(e=>Math.abs(Number(document.querySelector('[data-dsc-arc] path')?.getAttribute('stroke-width'))-e)<.0001,expected);
    const observed=await page.locator('[data-dsc-arc]').evaluate(el=>({border:getComputedStyle(el.parentElement!).borderTopWidth,stroke:el.querySelector('path')!.getAttribute('stroke-width')}));
    assert.equal(observed.border,thick?'2px':'1px');assert(Math.abs(Number(observed.stroke)-expected)<.0001);
   }
   // The module surface consumes CSS variables live; inline resolves tokens
   // into its generated styles, where changing the inline width is live.
   await page.locator('[data-dsc-arc]').evaluate((el,surface)=>{
    if(surface==='module')document.documentElement.style.setProperty('--edge','1.75px');
    else el.parentElement!.style.borderWidth='1.75px';
   },surface);
   await page.waitForFunction(()=>document.querySelector('[data-dsc-arc] path')?.getAttribute('stroke-width')==='1.75');
  }finally{await page.close();}
 }
});
