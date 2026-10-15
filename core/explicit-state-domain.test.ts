import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeFromDump,proposeDeclaredDrawnCandidate} from './propose-figma.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,resolveLayout} from '../scripts/contract-schema.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture():any{return {setName:'Drawn State',type:'COMPONENT_SET',propertyDefinitions:{State:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Hover','Focus']}},variants:['Default','Hover','Focus'].map(state=>({name:`State=${state}`,type:'COMPONENT',variantProperties:{State:state},layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},children:[{name:'Label',type:'TEXT',text:{characters:'Same captured drawing',fontSize:12,fontFamily:'Arial',fontStyle:'Regular',lineHeight:16}}]}))};}
const opts={corpus,mintUnbound:true,stampsObservable:true,contractIdByName:new Map<string,string>()};
test('uncarried interaction drawings remain explicit finite states only on the qualified runtime route',()=>{
 const set=fixture(),before=JSON.stringify(set);
 assert.throws(()=>proposeFromDump(set,opts),/state-axis-state-not-carried/);
 const r=proposeFromDump(set,{...opts,drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(r.contract);
 assert.equal(c.bindings.figma.drawnVariants?.length,3);
 const state=c.props.find(p=>p.bindings.figma.property==='State');assert(state);assert.deepEqual(state.type,{enum:['default','hover','focus']});
 assert.deepEqual(c.states,[]);assert.equal(JSON.stringify(set),before);
 assert(r.notes.some(n=>n.includes('interaction behavior and visual fidelity are not inferred')));
 assert.throws(()=>proposeFromDump(set,{...opts,stampsObservable:false,drawnVariantSurface:'react-runtime'}));
});
test('both React renderers preserve distinct drawn state content through switches',async t=>{
 const set=fixture();for(const v of set.variants)v.children[0].text.characters=v.variantProperties.State+' drawing';
 const r=proposeFromDump(set,{...opts,drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(r.contract);
 const {chromium}=await import('playwright-core');const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');const {mountGenerated}=await import('./react-test-runtime.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents);
  for(const [state,expected] of [['default','Default drawing'],['hover','Hover drawing'],['focus','Focus drawing'],['default','Default drawing']]){
   await render({state});assert.equal(await page.locator('#root').innerText(),expected);
  }
  await page.evaluate(()=>window.addEventListener('error',event=>{(window as any).__drawnError=event.error}));
  const error=page.waitForEvent('pageerror');await render({state:'unknown'});await error;
  assert.equal(await page.evaluate(()=>(window as any).__drawnError?.code),'DRAWN_VARIANT_UNDECLARED');
  await page.close();
 }
});


function sparseUnicodeFixture():any {
 const definitions={
  '替换文本#15:1':{type:'TEXT',defaultValue:'Original label'},
  '⬑展开':{type:'VARIANT',defaultValue:'false',variantOptions:['false','true']},
  '悬停':{type:'VARIANT',defaultValue:'false',variantOptions:['false','true']},
  '分组':{type:'VARIANT',defaultValue:'false',variantOptions:['false','true']},
 };
 return {setName:'SparseUnicode',type:'COMPONENT_SET',propertyDefinitions:definitions,
  variants:[[false,false,false],[true,false,false],[true,true,true]].map(([expanded,hovered,grouped])=>({
   name:`⬑展开=${expanded}, 悬停=${hovered}, 分组=${grouped}`,type:'COMPONENT',
   variantProperties:{'⬑展开':String(expanded),'悬停':String(hovered),'分组':String(grouped)},
   layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},
   children:[{name:'Caption',type:'TEXT',propRefs:{characters:'替换文本'},text:{characters:'Original label',fontSize:12,fontFamily:'Arial',fontStyle:'Regular',lineHeight:16}}],
  }))};
}
test('declared sparse non-Latin property names use the same collision-free namespace as normal proposals',()=>{
 const byProperty=[];
 for(const reverse of [false,true]){
  const set=sparseUnicodeFixture();if(reverse){set.variants.reverse();set.propertyDefinitions=Object.fromEntries(Object.entries(set.propertyDefinitions).reverse());}
  const before=JSON.stringify(set),result=proposeFromDump(set,{...opts,drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(result.contract);
  assert.equal(JSON.stringify(set),before);assert.equal(c.props.length,4);assert.equal(new Set(c.props.map(p=>p.name)).size,4);
  assert(c.props.every(p=>/^p[1-4]$/.test(p.name)));assert.equal(c.props.find(p=>p.bindings.figma.property==='替换文本')?.default,'Original label');
  const names=Object.fromEntries(c.props.map(p=>[p.bindings.figma.property!,p.name]));byProperty.push(names);
  const expected=set.variants.map((v:any)=>JSON.stringify(v.variantProperties)).sort();
  const observed=c.bindings.figma.drawnVariants!.map(row=>JSON.stringify(Object.fromEntries(Object.entries(set.propertyDefinitions).filter(([,d]:any)=>d.type==='VARIANT').map(([label])=>[label,String(row[names[label]])])))).sort();
  // Compare tuple objects independent of property definition insertion order.
  const stable=(rows:string[])=>rows.map(r=>JSON.stringify(Object.entries(JSON.parse(r)).sort())).sort();
  assert.deepEqual(stable(observed),stable(expected));assert.equal(c.bindings.figma.drawnVariants!.length,3);
  for(const p of c.props.filter(p=>p.type==='boolean'))assert.deepEqual(p.bindings.figma.values,{'false':'false','true':'true'});
 }
 assert.deepEqual(byProperty[0],byProperty[1]);
});
test('allocated sparse names do not weaken original declaration and tuple validation',()=>{
 const source=sparseUnicodeFixture(),declaration=source.variants.map((v:any)=>v.variantProperties);
 for(const kind of ['invalid','missing-field','missing-row','duplicate-row'] as const){
  const set=structuredClone(source);
  if(kind==='invalid')set.variants[0].variantProperties['悬停']='unknown';
  else if(kind==='missing-field')delete set.variants[0].variantProperties['分组'];
  else if(kind==='missing-row')set.variants.pop();
  else set.variants.push(structuredClone(set.variants[0]));
  assert.throws(()=>proposeDeclaredDrawnCandidate(set,opts,declaration),error=>
   typeof (error as {code?:unknown}).code==='string' && (error as {code:string}).code.startsWith('EXACT_'),kind);
 }
});


function ambiguousPaintFixture():any {
 return {setName:'AmbiguousPaint',type:'COMPONENT_SET',propertyDefinitions:{
  Type:{type:'VARIANT',defaultValue:'Range',variantOptions:['Range','Single']},
  Multiple:{type:'VARIANT',defaultValue:'false',variantOptions:['false','true']},
 },variants:[['Range','false'],['Single','true']].map(([type,multiple])=>({
  name:`Type=${type}, Multiple=${multiple}`,type:'COMPONENT',variantProperties:{Type:type,Multiple:multiple},
  layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'AUTO'},
  children:[{name:'Paint',type:'FRAME',fixedSize:{width:type==='Range'?36:32,height:24},
   fill:type==='Range'?{hex:'eaf5ff'}:{hex:'000000',alpha:0},cornerRadius:type==='Range'?0:3,
   layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:type==='Range'?[0,0,0,0]:[0,2,0,2],primarySizing:'FIXED',counterSizing:'FIXED'},
   children:[{name:'Caption',type:'TEXT',text:{characters:'Day',fontSize:12,fontFamily:'Arial',fontStyle:'Regular',lineHeight:16}}]}],
 }))};
}
test('ambiguous sparse paints stay refused without an authenticated opt-in drawn domain',()=>{
 const set=ambiguousPaintFixture();
 assert.throws(()=>proposeFromDump(set,opts),error=>(error as {code?:string}).code==='sparse-matrix-inference-ambiguous');
 assert.throws(()=>proposeFromDump(set,{...opts,stampsObservable:false,drawnVariantSurface:'react-runtime'}),/drawn-domain-source-observation-unqualified/);
 const stamped={...set,contractId:'authored.keep'};
 assert.throws(()=>proposeFromDump(stamped,{...opts,drawnVariantSurface:'react-runtime'}),/drawn-domain-source-marked/);
});
test('authenticated sparse paint domain retains every drawn style and rejects every undrawn tuple in both React surfaces',async t=>{
 const {chromium}=await import('playwright-core');const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');const {mintedTokenCss}=await import('./mint-tokens.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const reverse of [false,true]){
  const set=ambiguousPaintFixture();if(reverse)set.variants.reverse();const before=JSON.stringify(set);
  const result=proposeFromDump(set,{...opts,drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(result.contract);
  assert.equal(JSON.stringify(set),before);assert.equal(result.projection.status,'verified-exact');
  assert.deepEqual(c.props.map(p=>p.bindings.figma.property).sort(),['Multiple','Type']);
  assert.deepEqual(c.bindings.figma.drawnVariants,[{type:'range',multiple:false},{type:'single',multiple:true}]);
  assert.equal(c.bindings.figma.absentVariants,undefined);
  const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
  for(const emitter of [reactEmitter,reactInlineEmitter]){
   const files=emitter.emit(c,ctx);assert.deepEqual(generatedTypeErrors(c.name,files[0].contents),[]);
   const page=await browser.newPage();try{
    const render=await mountGenerated(page,c.name,files[0].contents,(files.find(f=>f.path.endsWith('.css'))?.contents??'')+mintedTokenCss(ctx.tokens.primitives));
    for(const [type,multiple,color,radius,width,padding] of [['range',false,'rgb(234, 245, 255)','0px','36px','0px'],['single',true,'rgba(0, 0, 0, 0)','3px','32px','2px']] as const){
     await render({type,multiple});const actual=await page.locator('#root > :first-child > :first-child').evaluate(el=>{const s=getComputedStyle(el);return {color:s.backgroundColor,radius:s.borderRadius,width:s.width,padding:s.paddingInline};});
     assert.deepEqual(actual,{color,radius,width,padding});assert.equal(await page.locator('#root').textContent(),'Day');
    }
    await page.evaluate(()=>window.addEventListener('error',event=>{(window as any).__drawnError=event.error}));
    for(const [type,multiple] of [['range',true],['single',false]] as const){
     const failure=page.waitForEvent('pageerror');await render({type,multiple});await failure;
     assert.equal(await page.evaluate(()=>(window as any).__drawnError?.code),'DRAWN_VARIANT_UNDECLARED');assert.equal(await page.locator('#root').textContent(),'');
    }
   }finally{await page.close();}
  }
 }
});


function paintedAxisFixture(varying: boolean): any {
 const set=ambiguousPaintFixture();
 for(let i=0;i<7;i++)set.propertyDefinitions['Extra'+i]={type:'VARIANT',defaultValue:'Off',variantOptions:varying?['Off','On']:['Off']};
 for(const row of set.variants){
  for(let i=0;i<7;i++)row.variantProperties['Extra'+i]=varying && row.variantProperties.Multiple==='true'?'On':'Off';
  row.name=Object.entries(row.variantProperties).map(([key,value])=>`${key}=${value}`).join(', ');
  row.itemReverseZIndex=row.variantProperties.Multiple==='true';
 }
 return set;
}
test('only globally constant drawn axes leave conditional layout keys; full props and runtime domain remain',async t=>{
 const {chromium}=await import('playwright-core');const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');const {mountGenerated,generatedTypeErrors}=await import('./react-test-runtime.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const reverse of [false,true]){
  const source=paintedAxisFixture(false);if(reverse)source.variants.reverse();const before=JSON.stringify(source);
  const result=proposeFromDump(source,{...opts,drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(result.contract);
  assert.equal(JSON.stringify(source),before);assert.equal(c.props.length,9);assert.equal(c.bindings.figma.drawnVariants!.length,2);
  assert(c.bindings.figma.drawnVariants!.every(row=>Object.keys(row).length===9));
  for(let i=0;i<7;i++)assert.equal(c.props.find(p=>p.name==='extra'+i)?.default,'off');
  assert.deepEqual(c.anatomy.root.layoutByCombination?.props,['type','multiple']);
  const ordinary=ambiguousPaintFixture();for(const row of ordinary.variants)row.itemReverseZIndex=row.variantProperties.Multiple==='true';
  const control=ContractSchema.parse(proposeFromDump(ordinary,{...opts,drawnVariantSurface:'react-runtime'}).contract);
  for(const row of c.bindings.figma.drawnVariants!){const selection=Object.fromEntries(Object.entries(row).map(([key,value])=>[key,String(value)]));assert.deepEqual(resolveLayout(c.anatomy.root,selection),resolveLayout(control.anatomy.root,selection));}
  const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
  for(const emitter of [reactEmitter,reactInlineEmitter]){
   const files=emitter.emit(c,ctx);assert.deepEqual(generatedTypeErrors(c.name,files[0].contents),[]);
   const page=await browser.newPage();try{
    const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
    for(const row of c.bindings.figma.drawnVariants!){await render(row);assert.equal(await page.locator('#root').textContent(),'Day');}
    await page.evaluate(()=>window.addEventListener('error',event=>{(window as any).__drawnError=event.error}));
    for(const row of [{type:'range',multiple:true},{type:'single',multiple:false},{type:'range',multiple:false,extra0:'on'}]){
     const failure=page.waitForEvent('pageerror');await render(row);await failure;
     assert.equal(await page.evaluate(()=>(window as any).__drawnError?.code),'DRAWN_VARIANT_UNDECLARED');assert.equal(await page.locator('#root').textContent(),'');
    }
   }finally{await page.close();}
  }
 }
});
test('nine genuinely varying conditional-layout axes retain the existing schema limit',()=>{
 const source=paintedAxisFixture(true),before=JSON.stringify(source);
 assert.throws(()=>proposeFromDump(source,{...opts,drawnVariantSurface:'react-runtime'}),error=>
  Array.isArray((error as any).issues) && (error as any).issues.some((issue:any)=>issue.path.join('.')==='anatomy.root.layoutByCombination.props' && issue.maximum===8));
 assert.equal(JSON.stringify(source),before);
});
