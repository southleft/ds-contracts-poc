import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';import {emitReactInline} from './emit-react-inline.js';import {reactEmitter} from './emitter.js';import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
const base={id:'test.overlap',name:'Overlap',version:'1.0.0',status:'draft',description:'Native negative spacing',semantics:{element:'div'},props:[],states:[],bindings:{code:{anchors:{importPath:'./Overlap',export:'Overlap'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}};
const native=JSON.parse(readFileSync(new URL('./fixtures/native-overlap-369.json',import.meta.url),'utf8'));
test('both generated React surfaces match twelve native row/column negative-spacing observations',async t=>{
 const b=await chromium.launch();t.after(()=>b.close());
 for(const [index,row] of native.cases.entries()){
  const c=ContractSchema.parse({...base,anatomy:{root:{layout:{display:'flex',direction:row.name.startsWith('HORIZONTAL')?'row':'column',align:'start',overlap:true},literals:{width:'fit-content',height:'fit-content'},tokens:{gap:'{space.overlap}'},parts:Object.fromEntries(row.children.map((n:any,i:number)=>['item'+i,{literals:{width:n.width+'px',height:n.height+'px'}}]))}}});
  const tokens={primitives:{space:{overlap:{$type:'dimension',$value:row.gap+'px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};const ctx={tokens,contracts:new Map([[c.id,c]]),icons:new Map(),mode:'light' as const};const files=reactEmitter.emit(c,ctx);
  for(const output of [{name:'inline',tsx:emitReactInline(c,ctx).tsx,css:''},{name:'modules',tsx:files.find(f=>f.path.endsWith('.tsx'))!.contents,css:files.find(f=>f.path.endsWith('.css'))!.contents}]){
   if(index===0)assert.deepEqual(generatedTypeErrors(c.name,output.tsx),[]);
   const p=await b.newPage();await mountGenerated(p,c.name,output.tsx,output.css);await p.addStyleTag({content:`:root{--space-overlap:${row.gap}px}`});await p.waitForTimeout(30);
   const actual=await p.locator('#root > :first-child').evaluate(n=>{const r=n.getBoundingClientRect();return{width:r.width,height:r.height,children:[...n.children].map(c=>{const a=c.getBoundingClientRect();return{x:a.x-r.x,y:a.y-r.y,width:a.width,height:a.height}})}});
   assert.deepEqual(actual,{width:row.width,height:row.height,children:row.children},row.name+' '+output.name);
   if(index===0){ await p.evaluate('window.renderSubject({ref: node => { window.overlapRef = node; }})');assert.equal(await p.evaluate(()=>(window as any).overlapRef===document.querySelector('#root > :first-child')),true);await p.evaluate(()=>(window as any).renderSubject({}));assert.equal(await p.evaluate(()=>(window as any).overlapRef),null); }
   await p.close();
  }
 }
});
test('nested overlap follows caller text, exact visibility, gap variants and font resizing without extra DOM',async t=>{
 const c=ContractSchema.parse({...base,props:[{name:'label',type:'text',default:'Link',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}},{name:'show',type:'boolean',default:true,bindings:{code:{prop:'show'},figma:{kind:'BOOLEAN',property:'Show'}}},{name:'spacing',type:{enum:['stack','apart']},default:'stack',bindings:{code:{prop:'spacing'},figma:{kind:'VARIANT',property:'Spacing',values:{stack:'Stack',apart:'Apart'}}}}],anatomy:{root:{layout:{display:'flex',direction:'row',align:'start'},literals:{width:'fit-content',height:'fit-content'},parts:{words:{layout:{display:'flex',direction:'row',align:'start',overlap:true},tokens:{gap:'{space.{spacing}}'},literals:{width:'fit-content',height:'fit-content'},parts:{first:{content:{prop:'label'},declared:{'white-space':'nowrap'}},second:{content:{prop:'label'},visibleWhen:{prop:'show'},declared:{'white-space':'nowrap'}}}}}}}});
 const tokens={primitives:{space:{stack:{$type:'dimension',$value:'-1000000px'},apart:{$type:'dimension',$value:'-2px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};const ctx={tokens,contracts:new Map([[c.id,c]]),icons:new Map(),mode:'light' as const};const files=reactEmitter.emit(c,ctx);const b=await chromium.launch();t.after(()=>b.close());
 for(const output of [{tsx:emitReactInline(c,ctx).tsx,css:''},{tsx:files.find(f=>f.path.endsWith('.tsx'))!.contents,css:files.find(f=>f.path.endsWith('.css'))!.contents}]){
  assert.deepEqual(generatedTypeErrors(c.name,output.tsx),[]);const p=await b.newPage();const render=await mountGenerated(p,c.name,output.tsx,output.css);await p.addStyleTag({content:':root{--space-stack:-1000000px;--space-apart:-2px}'});
  for(const label of ['Link','Learn more about the design system',''])for(const show of [true,false])for(const spacing of ['stack','apart']){
   await render({label,show,spacing});await p.waitForTimeout(25);
   const actual=await p.locator('#root > :first-child').evaluate(n=>{const host=n.firstElementChild!,a=host.firstElementChild!.getBoundingClientRect(),b=host.children[1]?.getBoundingClientRect();return {rootChildren:n.children.length,count:host.children.length,first:a.width,offset:b?b.x-a.x:null}});
   assert.equal(actual.rootChildren,1);assert.equal(actual.count,show?2:1);if(show)assert.ok(Math.abs(actual.offset!-(spacing==='stack'?0:Math.max(0,actual.first-2)))<0.02,JSON.stringify(actual));
  }
  await render({label:'Wider label',show:true,spacing:'stack'});await p.locator('#root').evaluate(n=>(n as HTMLElement).style.fontSize='30px');await p.waitForTimeout(40);assert.equal(await p.locator('#root > * > *').evaluate(n=>n.children[1].getBoundingClientRect().x-n.children[0].getBoundingClientRect().x),0);
  await p.close();
 }
});
