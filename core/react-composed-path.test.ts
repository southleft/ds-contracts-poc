import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { ContractSchema } from '../scripts/contract-schema.js';
import { emitReact } from './emit-react.js';
import { emitReactInline } from './emit-react-inline.js';
import { reactComposedPath } from './react-composed-path.js';
import { mountGenerated, generatedTypeErrors } from './react-test-runtime.js';

const path = {data:'M0 0L8 0L8 8L0 8Z',windingRule:'NONZERO'};
function fixture() {
 const geometry={width:8,height:8,parentViewport:{width:12,height:12,x:2,y:2},paths:[path]};
 const ink={declared:{position:'absolute'},tokens:{'background-color':'{ink}'},shape:{kind:'path',...geometry}};
 const first={tokens:{left:'{offset.{piece}}',top:'{zero}',width:'{plane}',height:'{plane}'},declared:{position:'absolute'},parts:{ink:{...ink,shape:{...ink.shape,pathsByProp:{prop:'piece',map:{one:geometry,two:{...geometry,paths:[{...path,data:'M0 0L4 0L4 8L0 8Z'}]}}}}}}};
 const second={visibleWhen:{prop:'piece',equals:'two'},tokens:{left:'{second}',top:'{zero}',width:'{plane}',height:'{plane}'},declared:{position:'absolute'},parts:{ink2:{...ink,shape:{...ink.shape,width:20,paths:[{...path,data:'M0 0L20 0L20 8L0 8Z'}]}}}};
 const plane=(parts:unknown)=>({tokens:{width:'{plane}',height:'{plane}'},declared:{position:'relative'},parts});
 const firstFrame={...first,parts:{firstPlane:plane(first.parts)}};
 const secondFrame={...second,parts:{secondPlane:plane(second.parts)}};
 return ContractSchema.parse({
  id:'probe.composed-path',name:'ComposedPath',version:'1.0.0',archetype:'none',description:'Shared path graphic',semantics:{element:'div'},states:[],
  props:[{name:'piece',type:{enum:['one','two']},default:'one',bindings:{code:{prop:'piece'},figma:{kind:'VARIANT',property:'Piece',values:{one:'One',two:'Two'}}}}],
  anatomy:{root:{tokens:{width:'{size}',height:'{size}'},declared:{position:'relative'},parts:{first:firstFrame,second:secondFrame}}},
  bindings:{code:{anchors:{importPath:'./ComposedPath',export:'ComposedPath'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}
 });
}
const primitives={size:{$type:'dimension',$value:'32px'},zero:{$type:'dimension',$value:'0px'},plane:{$type:'dimension',$value:'12px'},second:{$type:'dimension',$value:'16px'},offset:{one:{$type:'dimension',$value:'-2px'},two:{$type:'dimension',$value:'2px'}}};
const tokens={primitives,semantic:{},light:{ink:{$type:'color',$value:'#ff0000'}},dark:{ink:{$type:'color',$value:'#0000ff'},plane:{$type:'dimension',$value:'24px'}},brands:{default:{}}};
const names=new Set(['size','zero','plane','second','offset.one','offset.two','ink']);

test('unhandled behavior and layout keep the existing DOM projection',()=>{
 const c=fixture(); assert(reactComposedPath(c,n=>n,undefined,tokens));
 for(const patch of [{layout:{display:'flex'}},{attrs:{'aria-label':'named'}},{content:{literal:'Text'}}]){
  const clone=structuredClone(c);Object.assign(clone.anatomy.root.parts!.first,patch);
  assert.equal(reactComposedPath(clone,n=>n,undefined,tokens),undefined);
 }
 const percent=structuredClone(tokens); percent.dark.plane.$value='50%' as never;
 assert.equal(reactComposedPath(c,n=>n,undefined,percent),undefined);
 assert.equal(reactComposedPath(c,n=>n),undefined);
});

test('both emitters preserve pixels, path variants, token modes and caller resizing',async()=>{
 const browser=await chromium.launch();
 try{
 for(const surface of ['module','inline'])for(const mode of ['light','dark'] as const){
  const c=fixture(), oracle=structuredClone(c); oracle.anatomy.root.attrs={};
  const emit=(contract:typeof c)=>surface==='module'?emitReact(contract,{contracts:new Map([[c.id,contract]]),icons:new Map(),tokens:names,tokenValues:tokens}):{...emitReactInline(contract,{contracts:new Map([[c.id,contract]]),icons:new Map(),tokens,mode}),css:''};
  const current=emit(c),previous=emit(oracle);
  assert.match(current.tsx,/<path d=/); assert.deepEqual(generatedTypeErrors(c.name,current.tsx),[]);
  const a=await browser.newPage(),b=await browser.newPage();
  const render=await mountGenerated(a,c.name,current.tsx,current.css),baseline=await mountGenerated(b,c.name,previous.tsx,previous.css);
  const sheet=`:root{--size:32px;--zero:0px;--plane:${mode==='dark'?24:12}px;--second:16px;--offset-one:-2px;--offset-two:2px;--ink:${mode==='dark'?'#0000ff':'#ff0000'}}`;
  await a.addStyleTag({content:sheet});await b.addStyleTag({content:sheet});
  for(const piece of ['one','two'])for(const width of [32,64]){
   const props={piece,style:{width,height:32,opacity:0.6}};await render(props);await baseline(props);
   const actual=PNG.sync.read(await a.locator('#root > *').screenshot({omitBackground:true})),expected=PNG.sync.read(await b.locator('#root > *').screenshot({omitBackground:true}));
   assert.deepEqual(actual.data,expected.data,`${surface} ${mode} ${piece} ${width}`);
   const bounds=await a.locator('#root > * > svg').evaluate(n=>{const b=n.getBoundingClientRect();return[b.width,b.height]});
   assert.deepEqual(bounds,[width,32]);
  }
  if(surface==='module'){
   const update=':root{--plane:18px;--ink:#00ff00}';
   await a.addStyleTag({content:update});await b.addStyleTag({content:update});
   const actual=PNG.sync.read(await a.locator('#root > *').screenshot({omitBackground:true}));
   const expected=PNG.sync.read(await b.locator('#root > *').screenshot({omitBackground:true}));
   assert.deepEqual(actual.data,expected.data,'live token update without rerender');
  }
  await a.close();await b.close();
 }
 }finally{await browser.close()}
});


test('the package generator forwards token values to the composed graphic projection',async t=>{
 const {mkdtempSync,writeFileSync,readFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const path=await import('node:path');
 const {generateComponents}=await import('../scripts/generate-components.js');
 const dir=mkdtempSync(path.join(tmpdir(),'composed-path-route-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const c=fixture(),contractFile=path.join(dir,'subject.contract.json');writeFileSync(contractFile,JSON.stringify(c));
 const tokenFiles=(['primitives','semantic','light','dark'] as const).map(slot=>{
  const file=path.join(dir,slot+'.tokens.json');writeFileSync(file,JSON.stringify(tokens[slot]));return slot+'='+file;
 });
 const out=path.join(dir,'out');
 const result=await generateComponents({contractFiles:[contractFile],tokenFiles,iconsDir:path.join(dir,'icons'),outDir:out,stories:false});
 assert.deepEqual(result.refused,[]);
 const tsx=readFileSync(path.join(out,c.name,c.name+'.tsx'),'utf8');
 assert.match(tsx,/<path/);assert.match(tsx,/var\(--ink\)/);
 assert.deepEqual(generatedTypeErrors(c.name,tsx),[]);
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();const css=readFileSync(path.join(out,c.name,c.name+'.module.css'),'utf8');
  const render=await mountGenerated(page,c.name,tsx,css);await page.addStyleTag({content:readFileSync(path.join(out,'tokens.css'),'utf8')});
  await render({piece:'two'});
  assert.equal(await page.locator('#root > * > svg path').count(),2);
  assert.deepEqual(await page.locator('#root > * > svg').evaluate(n=>{const r=n.getBoundingClientRect();return[r.width,r.height]}),[32,32]);
 }finally{await browser.close()}
});
