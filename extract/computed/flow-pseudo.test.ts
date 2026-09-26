import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium,type Page} from 'playwright-core';
import {captureJs} from './capture.js';
import type {CapturedNode,Combo} from './lib.js';
import {observedFlowPseudo,observedFlowPseudoDomain} from './flow-pseudo.js';
import {compileObservedContent,compileObservedContentSweep} from '../../source-reference/observed-content.js';
import {enumerate} from './lib.js';
import type {PropSpace,SweepResult} from './capture.js';
import {reactEmitter,reactInlineEmitter} from '../../core/emitter.js';
import {mountGenerated} from '../../core/react-test-runtime.js';
import {emitTokensCss} from '../../packages/core/src/emit-tokens-css.js';
import {revisionOf} from '../../core/contract-provenance.js';
import {validateContract} from '../../packages/core/src/validate.js';
import {ContractSchema,literalValueOk} from '../../scripts/contract-schema.js';
import {createFigmaEngine} from '../../core/emit-figma-script.js';
import {createFigmaMock} from '../../scripts/plugin-engine-mock-figma.mjs';
import vm from 'node:vm';

async function capture(page:Page){
 await page.evaluate(()=>{(window as any).__ALL_PROPS=[...getComputedStyle(document.documentElement)];});
 return await page.evaluate(captureJs('#stage',undefined,'',['#source'])) as CapturedNode;
}
const html=(pseudo='before',direction='right',position='0% 0%',size='120px 100%',extra='')=>`<style>
body{margin:0}#source{position:relative;display:flex;box-sizing:border-box;width:40px;height:24px;flex-wrap:nowrap;align-items:center}
#source::${pseudo}{content:"";display:block;box-sizing:border-box;width:40px;height:24px;border-radius:9999px;
background-color:rgba(12,24,36,.2);background-image:linear-gradient(to ${direction},rgb(20,100,180) 40%,rgba(0,0,0,0) 60%);
background-size:${size};background-position:${position};background-repeat:no-repeat;box-shadow:rgba(0,0,0,.3) 0 0 0 1px inset;${extra}}
#source>i{position:absolute;left:3px;top:3px;width:10px;height:10px;background:rgb(255,0,0)}
</style><div id="stage"><div id="source"><i></i></div></div>`;
const fonts=(tree:CapturedNode)=>({version:1 as const,status:'observed' as const,treeRevision:revisionOf(tree),problems:[],rows:[]});

test('in-flow pseudo paint has exact browser A/B images, source order and native paint fields',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage();
 for(const pseudo of ['before','after'] as const)for(const [direction,position,size] of [
  ['right','0% 0%','120px 100%'],['right','100% 0%','120px 100%'],
  ['left','0% 0%','120px 100%'],['left','100% 0%','120px 100%'],
  ['bottom','0% 0%','100% 80px'],['top','0% 100%','100% 80px'],
 ]){
  await page.setContent(html(pseudo,direction,position,size));
  const tree=await capture(page),before=structuredClone(tree),r=observedFlowPseudo(tree,'::'+pseudo as '::before'|'::after');
  assert('part' in r,JSON.stringify(r));if(!('part' in r))continue;
  assert.equal(r.part.shape!.kind,'rect');assert.equal(r.part.literals!['border-radius'],'12px');assert(r.window);
  const draft=compileObservedContent(tree,fonts(tree),undefined,true);assert.deepEqual(draft.problems,[]);
  const errors:string[]=[];validateContract(draft.contract!,new Map([[draft.contract!.id,draft.contract!]]),errors,new Map(draft.assets));assert.deepEqual(errors,[]);
  const children=draft.component!.variants[0].spec.children!,decor=children.find(n=>n.name==='root-'+pseudo)!;
  assert(decor);assert.equal(decor.absolute,undefined);assert.equal(decor.shape!.width,40);assert.equal(decor.shape!.height,24);
  assert.equal(decor.lits!.radius,12);assert.equal(decor.effectStack![0].inner,true);
  const names=Object.keys(draft.contract!.anatomy.root.parts!);
  assert.equal(names.indexOf('root-'+pseudo),pseudo==='before'?0:names.length-1);
  // Native compilation paints positioned auto-z siblings after flow items.
  assert.equal(children.indexOf(decor),0);
  assert.equal(draft.sourcePaths!.find(p=>p.sourcePath==='0')!.partName,children.find(n=>n.name!=='root-'+pseudo)!.name);
  for(const surface of ['white','black']){
   await page.evaluate(surface=>document.body.style.background=surface,surface);
   const source=await page.locator('#source').screenshot();
   await page.evaluate(({pseudo,part})=>{
    const rule=document.createElement('style');rule.id='lowering';rule.textContent='#source::'+pseudo+'{content:none}';document.head.append(rule);
    const el=document.createElement('b');el.id='decor';Object.assign(el.style,{display:'block',boxSizing:'border-box',flexShrink:'0',width:part.shape!.width+'px',height:part.shape!.height+'px'});
    for(const [key,value] of Object.entries(part.literals!))el.style.setProperty(key,value);
    const root=document.querySelector('#source')!;root.prepend(el);
   },{pseudo,part:r.part});
   assert.deepEqual(await page.locator('#source').screenshot(),source,`${pseudo}/${direction}/${position}/${surface}`);
   await page.evaluate(()=>{document.querySelector('#decor')!.remove();document.querySelector('#lowering')!.remove();});
  }
  assert.deepEqual(tree,before);assert.deepEqual(observedFlowPseudo(tree,'::'+pseudo as '::before'|'::after'),r);
 }
});

test('unknown paint, geometry, interpolation and competing layout refuse without mutating input',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());const page=await browser.newPage();await page.setContent(html());
 const tree=await capture(page),p='::before';
 const changes:Array<[string,(n:CapturedNode)=>void]>=[
  ['interpolation',n=>n.pseudo[p]!['background-position']='50% 0%'],
  ['edge',n=>{n.pseudo[p]!['background-size']='100px 100%';n.pseudo[p]!['background-position']='0% 0%';}],
  ['gap',n=>n.pseudo[p]!['background-size']='20px 100%'],
  ['multiple layers',n=>n.pseudo[p]!['background-image']+=', linear-gradient(to right, rgb(0, 0, 0) 0%, rgb(255, 255, 255) 100%)'],
  ['partial alpha',n=>n.pseudo[p]!['background-image']='linear-gradient(to right, rgba(20, 100, 180, 0.5) 40%, rgba(0, 0, 0, 0) 60%)'],
  ['unknown stop',n=>n.pseudo[p]!['background-image']='linear-gradient(to right, red 40%, blue 60%)'],
  ['non-monotonic stops',n=>n.pseudo[p]!['background-image']='linear-gradient(to right, rgb(0, 0, 0) 60%, rgb(255, 255, 255) 40%)'],
  ['missing geometry',n=>delete n.pseudo[p]!['background-position']],
  ['rotation',n=>n.pseudo[p]!.transform='matrix(0, 1, -1, 0, 0, 0)'],
  ['mask',n=>n.pseudo[p]!['mask-image']='linear-gradient(black,transparent)'],
  ['outline',n=>n.pseudo[p]!['outline-style']='solid'],
  ['inset',n=>n.pseudo[p]!.left='1px'],
  ['padding',n=>n.pseudo[p]!['padding-left']='1px'],
  ['border',n=>n.pseudo[p]!['border-top-width']='1px'],
  ['radius',n=>n.pseudo[p]!['border-top-right-radius']='0px'],
  ['grow',n=>n.pseudo[p]!['flex-grow']='1'],
  ['fractional used size',n=>n.pseudo[p]!.width='39.9999px'],
  ['relative host child',n=>{if(n.nodes[0].t==='el')n.nodes[0].el.style.position='relative';}],
  ['stacking child',n=>{if(n.nodes[0].t==='el')n.nodes[0].el.style['z-index']='1';}],
  ['text',n=>n.nodes.push({t:'text',v:'label'})],
  ['other pseudo',n=>n.pseudo['::after']=structuredClone(n.pseudo[p])],
  ['reverse',n=>n.style['flex-direction']='row-reverse'],
  ['wrap',n=>n.style['flex-wrap']='wrap'],
  ['host border',n=>n.style['border-left-width']='1px'],
 ];
 for(const [label,mutate] of changes){const changed=structuredClone(tree);mutate(changed);const before=structuredClone(changed),r=observedFlowPseudo(changed,p);assert('problem' in r,label);assert.deepEqual(changed,before);}
 const solid=structuredClone(tree);solid.pseudo[p]!['background-image']='none';assert('part' in observedFlowPseudo(solid,p));
});

test('finite flow paint preserves omission and both React emitters over white and black',async t=>{
 const browser=await chromium.launch();t.after(()=>browser.close());const oracle=await browser.newPage();
 const contract=ContractSchema.parse({id:'fixture.flow-paint',name:'FlowPaint',version:'0.1.0',status:'draft',description:'Finite in-flow paint fixture',
  props:[{name:'active',type:'boolean',bindings:{code:{prop:'active'},figma:{kind:'VARIANT',property:'Active',values:{false:'Off',true:'On'},unsetValue:'(unset)'}}}],
  states:[],semantics:{element:'div'},anatomy:{root:{}},bindings:{code:{anchors:{importPath:'./FlowPaint',export:'FlowPaint'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const axes=[{prop:'active',values:['unset','false','true'],unset:'unset'}],baseAxisValues={active:'unset'},enumeration=enumerate(axes,[],64,baseAxisValues);
 const space:PropSpace={contract,axes,presence:new Map(),stateProps:[],enumeration,baseAxisValues,baseComboKey:enumeration.combos[0].key,heldFixed:[]};
 const markup=(value:string)=>html('before','right',value==='true'?'0% 0%':'100% 0%','120px 100%',
  value==='unset'?'background-image:none;background-color:rgb(130,50,80)':'').replace('<i></i>','');
 const rows:Array<{combo:Combo;node:CapturedNode}>=[];
 for(const combo of enumeration.combos){await oracle.setContent(markup(combo.axisValues.active));rows.push({combo,node:await capture(oracle)});}
 const before=structuredClone(rows),result=observedFlowPseudoDomain([...rows].reverse(),'::before',axes);
 assert('part' in result);if(!('part' in result))return;
 assert.equal(result.part.literals!['background-image'],'none');assert.equal(result.part.literalsByProp![0].map.unset,undefined);
 const draft=compileObservedContentSweep(space,{name:contract.name,importName:contract.name,contract:'',sampleText:'',axes:['active']},
  {captures:rows.map(({combo,node})=>({combo:contract.name+':'+combo.key,interaction:'default',root:node}))} as SweepResult,['width','height']);
 assert.deepEqual(draft.problems,[]);assert.equal(draft.component!.variants.length,3);
 const errors:string[]=[];validateContract(draft.contract!,new Map([[contract.id,draft.contract!]]),errors,new Map(draft.assets));assert.deepEqual(errors,[]);
 const ctx={contracts:new Map([[contract.id,draft.contract!]]),icons:new Map(draft.assets),tokens:{primitives:draft.tokens!,semantic:{},light:{},dark:{},brands:{default:{}}}};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(draft.contract!,ctx),page=await browser.newPage();
  await mountGenerated(page,contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:emitTokensCss([{name:'default',selector:':root',parts:[{slot:'observed',tree:draft.tokens!}]}]).css+'\nbody{margin:0}'});
  for(const surface of ['white','black'])for(const value of ['unset','false','true','false','unset']){
   await oracle.setContent(markup(value));await oracle.evaluate(surface=>document.body.style.background=surface,surface);
   await page.evaluate(({value,surface})=>{document.body.style.background=surface;(window as any).renderSubject(value==='unset'?{}:{active:value==='true'});},{value,surface});
   assert.deepEqual(await page.locator('#root > *').screenshot(),await oracle.locator('#source').screenshot(),emitter.name+'/'+surface+'/'+value);
  }
  await page.close();
 }
 assert.deepEqual(rows,before);
 const varying=structuredClone(rows);varying[1].node.style.width='41px';varying[1].node.pseudo['::before']!.width='41px';
 assert.deepEqual(observedFlowPseudoDomain(varying,'::before',axes),{problem:'flow-pseudo-geometry-varies'});
 const jointAxes=[{prop:'a',values:['x','y']},{prop:'b',values:['x','y']}],joint=enumerate(jointAxes,[],64,{a:'x',b:'x'}).combos.map(combo=>({
  combo,node:structuredClone(rows[combo.axisValues.a===combo.axisValues.b?0:1].node)}));
 assert.deepEqual(observedFlowPseudoDomain(joint,'::before',jointAxes),{problem:'flow-pseudo-paint-multiaxis'});
 assert.deepEqual(observedFlowPseudoDomain(rows,'::before',[]),{problem:'flow-pseudo-paint-multiaxis'});
});

test('literal gradients retain separate native paint layers, token priority and unchanged repeat',async()=>{
 const image='linear-gradient(to right, rgb(20, 100, 180) 0%, rgb(20, 100, 180) 100%)';
 assert(literalValueOk('background-image',image));assert(literalValueOk('background-image','none'));
 for(const channel of ['color','width','box-shadow'])assert(!literalValueOk(channel,image));
 for(const value of ['url(https://invalid.test/image.png)','linear-gradient(red, blue)','linear-gradient(to right, #000 80%, #fff 20%)',
  'linear-gradient(to right, #000 -1%, #fff 101%)',image+', '+image,'12px','none; color:red'])assert(!literalValueOk('background-image',value),value);
 const c=ContractSchema.parse({id:'check.gradient-literal',name:'GradientLiteral',description:'Literal paint layer regression fixture',version:'0.1.0',status:'draft',props:[],states:[],semantics:{element:'div'},
  anatomy:{root:{layout:{display:'flex'},literals:{width:'48px',height:'24px','background-color':'rgba(12, 24, 36, 0.2)','background-image':image}}},
  bindings:{code:{anchors:{importPath:'./GradientLiteral',export:'GradientLiteral'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const tokens={primitives:{gradient:{$type:'gradient',$value:'linear-gradient(to bottom, #000000 0%, #ffffff 100%)'}},semantic:{},light:{},dark:{},brands:{default:{}}};
 const engine=createFigmaEngine({tokens,icons:new Map()}),byId=new Map([[c.id,c]]),before=structuredClone(c),data=engine.compileComponentData(c,byId);
 assert.equal(data.variants[0].spec.gradient!.angle,90);assert.equal(data.variants[0].spec.lits!.fillColor!.a,0.2);
 const overridden=structuredClone(c);overridden.anatomy.root.tokens={'background-image':'{gradient}'};
 assert.equal(engine.compileComponentData(overridden,new Map([[c.id,overridden]])).variants[0].spec.gradient!.angle,180);
 overridden.anatomy.root.literals!['background-image']='none';
 assert.equal(engine.compileComponentData(overridden,new Map([[c.id,overridden]])).variants[0].spec.gradient!.angle,180);
 const empty=structuredClone(c);empty.anatomy.root.literals!['background-image']='none';assert.equal(engine.compileComponentData(empty,new Map([[c.id,empty]])).variants[0].spec.gradient,undefined);
 const {figma,root}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context,{timeout:20000});
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(c,byId));
 const component=root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id);assert(component);
 const paints=JSON.parse(JSON.stringify(component.fills));assert.deepEqual(paints.map((p:any)=>p.type),['SOLID','GRADIENT_LINEAR']);
 assert.equal(paints[0].opacity,0.2);assert.equal(paints[1].gradientStops.length,2);
 const id=component.id;await run(engine.buildComponentScript(c,byId));
 assert.equal(root.findAll((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id).length,1);
 assert.equal(component.id,id);assert.deepEqual(JSON.parse(JSON.stringify(component.fills)),paints);assert.deepEqual(c,before);
});
