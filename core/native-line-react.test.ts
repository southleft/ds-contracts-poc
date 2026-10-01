import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {ContractSchema,nativeLineFootprint} from '../scripts/contract-schema.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {emitHtml} from './emit-html.js';
import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
import {readPng,alignPair,diffPair,writeTriptych} from '../extract/figma/visual-parity/img.js';
const observed=JSON.parse(readFileSync(new URL('../extract/figma/fixtures/native-line/caps-write.json',import.meta.url),'utf8')).write.rows;
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function contract(){
 const parts=Object.fromEntries(observed.map((row:any,index:number)=>{
  const line={length:row.width,transform:row.relativeTransform,cap:row.strokeCap,align:row.strokeAlign},box=nativeLineFootprint(line);
  return ['mark'+index,{shape:{kind:'line',width:row.width,height:0,line},declared:{position:'absolute'},literals:{left:(line.transform[0][2]-box.originX)+'px',top:(line.transform[1][2]-box.originY)+'px','border-width':'7px','border-color':'#333333'},literalsByProp:[{prop:'weight',map:{thin:{'border-width':'3px'}}}]}];
 }));
 return ContractSchema.parse({id:'probe.native-lines',name:'NativeLines',version:'1.0.0',description:'Native line cap and alignment observations.',archetype:'none',semantics:{element:'div'},states:[],
  props:[{name:'weight',type:{enum:['base','thin']},default:'base',bindings:{code:{prop:'weight'},figma:{kind:'VARIANT',property:'Weight',values:{base:'Base',thin:'Thin'}}}}],
  anatomy:{root:{declared:{position:'relative'},literals:{width:'300px',height:'230px','background-color':'#ffffff'},parts}},
  bindings:{code:{anchors:{importPath:'./NativeLines',export:'NativeLines'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
}
test('both actual generated React surfaces preserve native line cap paint and independent weight updates',async()=>{
 const out=mkdtempSync(path.join(tmpdir(),'ds-contracts-native-line-react-'));
 const browser=await chromium.launch();const scores=[];
 try{
  for(const surface of ['module','inline']){
   const c=contract(),contracts=new Map([[c.id,c]]),icons=new Map<string,string>();
   const code=surface==='module'?emitReact(c,{contracts,icons,tokens:new Set()}):{...emitReactInline(c,{contracts,icons,tokens}),css:''};
   assert.deepEqual(generatedTypeErrors(c.name,code.tsx),[]);
   writeFileSync(out+'/'+surface+'.tsx',code.tsx);writeFileSync(out+'/'+surface+'.css',code.css);
   const page=await browser.newPage({viewport:{width:300,height:230},deviceScaleFactor:1});
   const render=await mountGenerated(page,c.name,code.tsx,code.css);await page.addStyleTag({content:'body{margin:0}'});await render({weight:'base'});
   assert.equal(await page.locator('line').count(),9);
   const screenshot=await page.screenshot(),source=readFileSync(new URL('../extract/figma/fixtures/native-line/base.png',import.meta.url));
   const aligned=alignPair(readPng(screenshot),readPng(source));assert.equal(aligned.width,300);assert.equal(aligned.height,230);
   const diff=diffPair(aligned,[]);writeTriptych(out+'/'+surface+'-comparison.png',aligned,diff.diff);writeFileSync(out+'/'+surface+'.png',screenshot);
   scores.push({surface,mismatchPercent:diff.unmaskedPct});assert.equal(diff.unmaskedPct,0);
   await render({weight:'thin'});
   const widths=await page.locator('line').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).strokeWidth));assert.deepEqual(widths,Array(9).fill('3px'));
   const thinScreenshot=await page.screenshot();writeFileSync(out+'/'+surface+'-thin.png',thinScreenshot);const thinDiff=diffPair(alignPair(readPng(thinScreenshot),readPng(readFileSync(new URL('../extract/figma/fixtures/native-line/thin.png',import.meta.url)))),[]);assert.equal(thinDiff.unmaskedPct,0);scores.push({surface:surface+'-thin',mismatchPercent:thinDiff.unmaskedPct});await page.close();
  }
  writeFileSync(out+'/SUMMARY.json',JSON.stringify({scores,source:'Independent native LINE writer base/thin fixtures; all nine cap/alignment combinations',dynamicWeight:'Both generated consumers update 7px to3px and match both independent native exports exactly',qualification:'Generated primitive contract only; original-kit and native-writer qualification incomplete'},null,2)+'\n');
 }finally{await browser.close();}
});

test('static HTML preserves the same native LINE paint in both weight variants',async()=>{
 const c=contract(),result=emitHtml(c,{contracts:new Map([[c.id,c]]),icons:new Map(),tokens:new Set()});
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:400,height:600},deviceScaleFactor:1});
  await page.setContent('<style>body{margin:0}'+result.css+'</style>'+result.html);
  const roots=page.locator('.native-lines');assert.equal(await roots.count(),2);
  for(const [index,weight] of ['base','thin'].entries()){
   assert.equal(await roots.nth(index).locator('line').count(),9);
   const screenshot=await roots.nth(index).screenshot();const expected=readFileSync(new URL('../extract/figma/fixtures/native-line/'+weight+'.png',import.meta.url));
   assert.equal(diffPair(alignPair(readPng(screenshot),readPng(expected)),[]).unmaskedPct,0);
  }
 }finally{await browser.close();}
});
