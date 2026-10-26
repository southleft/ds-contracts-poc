import assert from 'node:assert/strict';
import test from 'node:test';
import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import {ContractSchema,FillStackSchema,type Contract} from '../scripts/contract-schema.js';
import {revisionOf} from './contract-provenance.js';
import {emitReact} from './emit-react.js';
import {emitReactInline} from './emit-react-inline.js';
import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
import {insideRootStrokeObservation} from '../extract/figma/root-stroke-observation.js';
import {observeFillStack} from '../extract/figma/fill-stack-observation.js';
import {receivedFillContextProof} from './react-fill-stack-context.js';

const tokens={primitives:{usage:{ink:{$type:'color',$value:'#22dd55'},width:{$type:'dimension',$value:'3px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
const base=(name:string):Contract=>ContractSchema.parse({id:'test.'+name.toLowerCase(),name,version:'1.0.0',status:'draft',description:'Inside root stroke test',props:[],states:[],semantics:{element:'div'},anatomy:{root:{literals:{width:'24px',height:'24px','border-radius':'12px'}}},bindings:{figma:{anchors:{fileKey:'source',componentSetKey:name+'-key'}},code:{anchors:{importPath:'./'+name,export:name}}}});
function fixture(){
 const child=base('InsideChild');child.anatomy.root.instanceRootInputs=['border-color','border-width'];child.anatomy.root.declared={position:'relative'};
 const parent=base('InsideParent');parent.anatomy.root.layout={display:'flex',direction:'row'};parent.anatomy.root.literals={width:'48px',height:'24px'};
 const stack=FillStackSchema.parse({version:1,order:'bottom-to-top',paints:[{index:0,type:'SOLID',color:{r:1,g:0,b:0},opacity:1,visible:true,blendMode:'NORMAL'},{index:1,type:'SOLID',color:{r:0,g:0,b:1},opacity:1,visible:true,blendMode:'NORMAL'}]});
 parent.anatomy.root.parts={Usage:{component:{id:child.id,rootOverrides:{'border-color':'{usage.ink}','border-width':'{usage.width}'}},fillStack:stack,fillStackSource:{fileKey:'source',setKey:'InsideChild-key',contractRevision:revisionOf(child)}},Omitted:{component:{id:child.id}}};
 return{parent,child,scope:new Map([[parent.id,parent],[child.id,child]])};
}
const emit=(kind:string,c:Contract,scope:Map<string,Contract>)=>{const out=kind==='module'?emitReact(c,{tokens:new Set(['usage.ink','usage.width']),tokenValues:tokens,contracts:scope,icons:new Map()}):emitReactInline(c,{tokens,contracts:scope,icons:new Map()});return {...out,css:'css'in out?String(out.css):''};};

test('complete original stroke entry qualifies exact floats and alias; incomplete/hidden/multiple/effect evidence refuses',()=>{
 const paint={type:'SOLID',blendMode:'NORMAL',color:{r:.123,g:.456,b:.789,a:.5},opacity:.5,boundVariables:{color:{type:'VARIABLE_ALIAS',id:'original-alias'}}};
 const source:any={type:'INSTANCE',name:'arbitrary',strokeAlign:'INSIDE',strokeWeight:3.5,strokesIncludedInLayout:false,sourceStrokeStack:observeFillStack([paint]),sourceStrokePattern:{version:1,complete:true,dashes:[]}};
 const before=JSON.stringify(source),p=insideRootStrokeObservation(source);assert.deepEqual(p,{color:'rgba(31.365,116.28,201.19500000000002,0.25)',weight:3.5,variableId:'original-alias'});assert.equal(JSON.stringify(source),before);
 for(const mutate of [(n:any)=>delete n.sourceStrokePattern,(n:any)=>n.sourceStrokePattern.dashes=[2,2],(n:any)=>delete n.sourceStrokeStack,(n:any)=>n.sourceStrokeStack.paints.push(n.sourceStrokeStack.paints[0]),(n:any)=>n.sourceStrokeStack.paints[0].paint.visible=false,(n:any)=>n.sourceStrokeStack.paints[0].paint.blendMode='MULTIPLY',(n:any)=>n.sourceStrokeStack.paints[0].paint.type='IMAGE',(n:any)=>n.sourceStrokeStack.paints[0].paint.filters={},(n:any)=>n.strokeAlign='OUTSIDE',(n:any)=>n.strokesIncludedInLayout=true,(n:any)=>n.strokeWeights={top:1,right:2,bottom:1,left:2},(n:any)=>n.strokeWeight=NaN]){const n=structuredClone(source);mutate(n);assert.equal(insideRootStrokeObservation(n),undefined,String(mutate));}
});

test('both React surfaces compose paired stroke above paint planes without changing geometry or omitted host',async()=>{
 const f=fixture(),browser=await chromium.launch();try{
  for(const kind of ['module','inline']){
   const child=emit(kind,f.child,f.scope),parent=emit(kind,f.parent,f.scope);assert.deepEqual(generatedTypeErrors(f.parent.name,parent.tsx,{[f.child.name]:child.tsx}),[]);
   const page=await browser.newPage();try{
    const render=await mountGenerated(page,f.parent.name,parent.tsx,parent.css,{[f.child.name]:{tsx:child.tsx,css:child.css}});await page.addStyleTag({content:':root{--usage-ink:#22dd55;--usage-width:3px}'});await render({});
    assert.equal(await page.locator('[data-dsc-inside-stroke]').count(),1);assert.equal(await page.locator('[data-dsc-paint-layer]').count(),2);
    const roots=page.locator('#root > * > *');assert.equal(await roots.count(),2);
    const facts=await roots.evaluateAll(ns=>ns.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height,style:n.getAttribute('style'),isolation:getComputedStyle(n).isolation,position:getComputedStyle(n).position})));
    assert.deepEqual(facts.map(n=>[n.w,n.h]),[[24,24],[24,24]]);assert.equal(facts[1].isolation,'auto');assert(!facts[1].style?.includes('isolation'));
    const png=PNG.sync.read(await roots.first().screenshot({omitBackground:true}));const pixel=(x:number,y:number)=>[...png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+4)];assert.deepEqual(pixel(12,1),[34,221,85,255]);assert.deepEqual(pixel(12,12),[0,0,255,255]);
   }finally{await page.close();}
  }
 }finally{await browser.close();}
});

test('paired context retains strict root override/transport/default boundaries',()=>{
 const f=fixture();assert(receivedFillContextProof(f.child,f.scope,tokens,'inline',true));
 for(const mutate of [(f:ReturnType<typeof fixture>)=>delete f.parent.anatomy.root.parts!.Usage.component!.rootOverrides!['border-width'],(f:ReturnType<typeof fixture>)=>{f.parent.anatomy.root.parts!.Usage.component!.rootOverrides!.opacity='{usage.width}';},(f:ReturnType<typeof fixture>)=>{f.child.anatomy.root.literals!.position='static';},(f:ReturnType<typeof fixture>)=>{f.child.anatomy.root.parts={Behind:{literals:{'z-index':'-2'}}};f.parent.anatomy.root.parts!.Usage.fillStackSource!.contractRevision=revisionOf(f.child);}]){
  const x=fixture();mutate(x);assert.throws(()=>emit('inline',x.parent,x.scope));
 }
 const varying=structuredClone(tokens);varying.dark={usage:{ink:{$type:'color',$value:'#ff0000'}}}as any;assert.throws(()=>receivedFillContextProof(f.child,f.scope,varying,'inline',true),/mode-unqualified/);
});

test('standalone paired receiver preserves omitted host and rejects supplied values without a source edge',async()=>{
 const {child}=fixture(),scope=new Map([[child.id,child]]),browser=await chromium.launch();try{
  for(const kind of ['module','inline']){
   const out=emit(kind,child,scope);assert.deepEqual(generatedTypeErrors(child.name,out.tsx),[]);
   const page=await browser.newPage();try{
    const render=await mountGenerated(page,child.name,out.tsx,out.css);await render({});
    assert.equal(await page.locator('[data-dsc-inside-stroke]').count(),0);
    assert.equal(await page.locator('#root > *').evaluate(n=>getComputedStyle(n).isolation),'auto');
    const failure=page.waitForEvent('pageerror');await render({style:kind==='module'?{'--_stroke-width':'3px','--_stroke-color':'#22dd55'}:{borderWidth:'3px',borderColor:'#22dd55'}}).catch(()=>{});assert.match((await failure).message,/instance-inside-stroke-caller-unqualified/);
   }finally{await page.close();}
  }
 }finally{await browser.close();}
});

test('foreground ring bounds all active generated descendant ranks on both React surfaces',async()=>{
 const f=fixture();delete f.parent.anatomy.root.parts!.Usage.fillStack;delete f.parent.anatomy.root.parts!.Usage.fillStackSource;
 f.child.anatomy.root.parts={Group:{layout:{display:'flex',direction:'row',reversePaint:false},literals:{width:'24px',height:'24px'},parts:Object.fromEntries(Array.from({length:7},(_,i)=>['child'+i,{literals:{width:'1px',height:'1px','background-color':'#0000ff'}}]))}};
 const proof=receivedFillContextProof(f.child,f.scope,tokens,'inline',true);assert.equal(proof?.foregroundLayer,8);
 const browser=await chromium.launch();try{for(const kind of ['module','inline']){
  const out=emit(kind,f.parent,f.scope),dep=emit(kind,f.child,f.scope);assert.deepEqual(generatedTypeErrors(f.parent.name,out.tsx,{[f.child.name]:dep.tsx}),[]);
  const page=await browser.newPage();try{await mountGenerated(page,f.parent.name,out.tsx,out.css,{[f.child.name]:{tsx:dep.tsx,css:dep.css}});await page.addStyleTag({content:':root{--usage-ink:#22dd55;--usage-width:3px}'});
   assert.equal(await page.locator('[data-dsc-inside-stroke]').evaluate(n=>getComputedStyle(n).zIndex),'8');
   assert.equal(await page.locator('[data-dsc-inside-stroke]').count(),1);
  }finally{await page.close();}
 }}finally{await browser.close();}
});
