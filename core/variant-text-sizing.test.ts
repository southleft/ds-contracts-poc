import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeFromDump} from './propose-figma.js';
import {mintedTokenCss} from './mint-tokens.js';
import {tokenCorpusFromJson} from './token-corpus.js';
import {ContractSchema,walkAnatomy} from '../scripts/contract-schema.js';
const corpus=tokenCorpusFromJson({primitives:{},semantic:{},light:{},brandDefault:{}});
function fixture(missing=false):any {
 return {setName:'Sizing',type:'COMPONENT_SET',propertyDefinitions:{Style:{type:'VARIANT',defaultValue:'Default',variantOptions:['Default','Inline']}},variants:['Default','Inline'].map(style=>({name:`Style=${style}`,variantProperties:{Style:style},type:'COMPONENT',layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0],primarySizing:'AUTO',counterSizing:'FIXED'},fixedSize:{width:50},children:[{name:'Helper',type:'TEXT',...(style==='Default'?{fillWidth:true}:{}),text:{characters:'A long helper message',fontSize:12,fontStyle:'Regular',fontFamily:'Arial',lineHeight:16,...(!missing||style==='Inline'?{textAutoResize:style==='Inline'?'WIDTH_AND_HEIGHT':'HEIGHT'}:{})}}]}))};
}
test('captured variant text sizing retains mutually exclusive intrinsic and wrapping parts',()=>{
 const set=fixture(),before=JSON.stringify(set);
 const r=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'});
 const c=ContractSchema.parse(r.contract),parts=walkAnatomy(c).filter(({part})=>part.text==='A long helper message');
 assert.equal(parts.length,2);
 const hug=parts.find(({part})=>part.textAutoResize==='WIDTH_AND_HEIGHT')!.part;
 const fill=parts.find(({part})=>!part.textAutoResize)!.part;
 assert.deepEqual(hug.visibleWhen,{prop:'style',equals:'inline'});
 assert.deepEqual(fill.visibleWhen,{prop:'style',equals:'default'});
 assert.equal(JSON.stringify(set),before);
});
test('missing resize evidence does not infer a branch or an intrinsic flag',()=>{
 const r=proposeFromDump(fixture(true),{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'});
 assert(!r.notes.some(x=>x.includes('source-text-sizing-partition')));
 assert(!walkAnatomy(ContractSchema.parse(r.contract)).some(({part})=>part.textAutoResize));
});
test('both React emitters switch between wrapped fill and intrinsic text without duplicate content',async t=>{
 const {chromium}=await import('playwright-core');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const r=proposeFromDump(fixture(),{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'});
 const c=ContractSchema.parse(r.contract),browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();
  const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents);
  await page.addStyleTag({content:mintedTokenCss(ctx.tokens.primitives)+"\n#root > * { width: 50px; }"});
  const sizes=[];
  for(const styleProp of ['default','inline','default']){
   await render({styleProp});
   sizes.push(await page.locator('#root').evaluate(root=>{
    const leaf=[...root.querySelectorAll('*')].filter(el=>el.childElementCount===0&&el.textContent==='A long helper message');
    const visible=leaf.filter(el=>el.getBoundingClientRect().width>0);if(visible.length!==1)throw Error('expected exactly one visible text part: '+visible.length);
    const box=visible[0].getBoundingClientRect();return {width:box.width,height:box.height};
   }));
  }
  assert(sizes[0].height>16,JSON.stringify(sizes));
  assert.equal(sizes[1].height,16);assert(sizes[1].width>50);
  assert.deepEqual(sizes[2],sizes[0]);await page.close();
 }
});
test('a shared text layer preserves different controls and an unbound literal across variants',async t=>{
 const set=fixture();
 set.propertyDefinitions={Mode:{type:'VARIANT',defaultValue:'Empty',variantOptions:['Empty','Filled','Read-only']},Placeholder:{type:'TEXT',defaultValue:'Placeholder'},Input:{type:'TEXT',defaultValue:'Input'}};
 const base=set.variants[0];
 set.variants=['Empty','Filled','Read-only'].map((mode,index)=>({...structuredClone(base),name:`Mode=${mode}`,variantProperties:{Mode:mode},children:[{name:'Shared layer',type:'TEXT',...(index<2?{propRefs:{characters:index===0?'Placeholder':'Input'}}:{}),text:{characters:['Placeholder','Input','No input text'][index],fontSize:12,fontStyle:'Regular',fontFamily:'Arial',lineHeight:16,textAutoResize:'WIDTH_AND_HEIGHT'}}]}));
 const before=JSON.stringify(set),r=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,contractIdByName:new Map(),drawnVariantSurface:'react-runtime'}),c=ContractSchema.parse(r.contract);
 assert.equal(JSON.stringify(set),before);
 const {chromium}=await import('playwright-core');const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');const {mountGenerated}=await import('./react-test-runtime.js');
 const browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();const render=await mountGenerated(page,c.name,files[0].contents,files.find(x=>x.path.endsWith('.css'))?.contents);
  for(const [mode,expected] of [['empty','Edited placeholder'],['filled','Edited input'],['readOnly','No input text'],['empty','Edited placeholder']]){
   await render({mode,placeholder:'Edited placeholder',input:'Edited input'});
   assert.equal(await page.locator('#root').innerText(),expected);
  }
  await page.close();
 }
});


test('fixed text boxes retain line breaks and captured height in both React emitters',async t=>{
 const {chromium}=await import('playwright-core');
 const {reactEmitter,reactInlineEmitter}=await import('./emitter.js');
 const {mountGenerated}=await import('./react-test-runtime.js');
 const set:any={setName:'FixedLines',type:'COMPONENT_SET',propertyDefinitions:{Size:{type:'VARIANT',defaultValue:'Short',variantOptions:['Short','Tall']}},variants:['Short','Tall'].map(size=>({name:`Size=${size}`,type:'COMPONENT',variantProperties:{Size:size},layout:{mode:'VERTICAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},children:[{name:'Text',type:'TEXT',fixedSize:{width:120,height:size==='Short'?20:60},text:{characters:'First\nSecond\nThird',fontFamily:'Arial',fontStyle:'Regular',fontWeight:400,fontSize:14,lineHeight:20,textAutoResize:'NONE'}}]}))};
 const r=proposeFromDump(set,{corpus,mintUnbound:true,contractIdByName:new Map()});
 const c=ContractSchema.parse(r.contract),browser=await chromium.launch();t.after(()=>browser.close());
 const ctx={contracts:new Map([[c.id,c]]),tokens:{primitives:r.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map<string,string>()};
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const native=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons}).compileComponentData(c,ctx.contracts);
 assert.deepEqual(native.variants.map(v=>v.spec.children![0].fixedHeight?.px),[20,60]);
 assert(native.variants.every(v=>v.spec.children![0].clipsContent===true&&v.spec.children![0].characters==='First\nSecond\nThird'));
 for(const emitter of [reactEmitter,reactInlineEmitter]){
  const files=emitter.emit(c,ctx),page=await browser.newPage();try{
   const render=await mountGenerated(page,c.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
   await page.addStyleTag({content:mintedTokenCss(ctx.tokens.primitives)});
   for(const size of ['short','tall','short']){
    await render({size});const actual=await page.locator('#root').evaluate(root=>{
     const node=[...root.querySelectorAll('*')].find(n=>n.childElementCount===0&&n.textContent==='First\nSecond\nThird')!;
     return {height:node.getBoundingClientRect().height,whitespace:getComputedStyle(node).whiteSpace,overflow:getComputedStyle(node).overflowY,scrollHeight:node.scrollHeight};
    });assert.deepEqual(actual,{height:size==='short'?20:60,whitespace:'pre-wrap',overflow:'hidden',scrollHeight:60});
   }
  }finally{await page.close();}
 }
});

test('partial text presence and independent Boolean visibility both survive runtime toggles',async t=>{
 const set:any={setName:'ConditionalPrefix',type:'COMPONENT_SET',boolDefaults:{'Show prefix':false},propertyDefinitions:{Mode:{type:'VARIANT',defaultValue:'Compact',variantOptions:['Compact','Expanded','Condensed']},'Show prefix':{type:'BOOLEAN',defaultValue:false}},variants:['Compact','Expanded','Condensed'].map(mode=>({name:`Mode=${mode}`,variantProperties:{Mode:mode},type:'COMPONENT',layout:{mode:'HORIZONTAL',primary:'MIN',counter:'MIN',spacing:0,padding:[0,0,0,0]},children:mode!=='Expanded'?[{name:'Prefix',type:'TEXT',hidden:true,...(mode==='Compact'?{propRefs:{visible:'Show prefix'}}:{}),text:{characters:'Prefix:',fontSize:14,fontFamily:'Arial',fontStyle:'Regular',textAutoResize:'WIDTH_AND_HEIGHT'}}]:[]}))};
 const result=proposeFromDump(set,{corpus,mintUnbound:true,hiddenCaptured:true,projectionMode:'exact',contractIdByName:new Map(),drawnVariantSurface:'react-runtime'}),contract=ContractSchema.parse(result.contract);
 const text=walkAnatomy(contract).find(p=>p.part.text==='Prefix:')!.part;
 assert(text.presenceByCombination);assert.deepEqual(text.visibleWhen,{prop:'showPrefix'});assert.equal(contract.props.find(p=>p.name==='showPrefix')?.default,false);
 const {chromium}=await import('playwright-core'),{reactEmitter,reactInlineEmitter}=await import('./emitter.js'),{mountGenerated}=await import('./react-test-runtime.js');
 const browser=await chromium.launch();t.after(()=>browser.close());const ctx={contracts:new Map([[contract.id,contract]]),icons:new Map<string,string>(),tokens:{primitives:result.mintedTokens?.tree??{},semantic:{},light:{},dark:{},brands:{default:{}}}};
 const {createFigmaEngine}=await import('./emit-figma-script.js');const native=createFigmaEngine({tokens:ctx.tokens,icons:ctx.icons}).compileComponentData(contract,ctx.contracts);assert.equal(native.variants.length,3);for(const v of native.variants)assert.equal(v.spec.children?.length??0,v.name==='Mode=Compact'?1:0,'native presence must exclude unbound hidden and absent planes');
 for(const emitter of [reactEmitter,reactInlineEmitter]){const files=emitter.emit(contract,ctx),page=await browser.newPage();try{const render=await mountGenerated(page,contract.name,files[0].contents,files.find(f=>f.path.endsWith('.css'))?.contents);
  for(const [mode,showPrefix,expected]of [['compact',undefined,false],['compact',true,true],['expanded',true,false],['condensed',true,false],['compact',false,false],['compact',true,true]] as const){await render({mode,...(showPrefix===undefined?{}:{showPrefix})});assert.equal((await page.locator('#root').innerText()).includes('Prefix:'),expected);}
 }finally{await page.close();}}
});
