import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';
import {emitReact} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';
import {mountGenerated,generatedTypeErrors} from './react-test-runtime.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
export const fixture=()=>ContractSchema.parse({id:'test.text-ink',name:'TextInk',version:'1.0.0',status:'draft',description:'Owned text color input',semantics:{element:'div'},states:[],props:[{name:'ink',type:{enum:['#112233','#44556680']},bindings:{code:{prop:'labelInk'},figma:{kind:'NONE'}}}],anatomy:{root:{layout:{display:'flex',direction:'column'},parts:{label:{text:'Label',textColorOverrideProp:'ink',literals:{color:'#aa0000','font-size':'14px'}},other:{text:'Other',literals:{color:'#00aa00','font-size':'14px'}}}}},bindings:{code:{anchors:{importPath:'./TextInk',export:'TextInk'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
test('both generated surfaces scope optional ink to one text node and restore base paint on omission',async()=>{
 const c=fixture(),contracts=new Map([[c.id,c]]),icons=new Map(),browser=await chromium.launch();
 try{for(const surface of ['module','inline']){
  const code=surface==='module'?emitReact(c,{contracts,icons,tokens:new Set()}):{...emitReactInline(c,{contracts,icons,tokens}),css:''};assert.deepEqual(generatedTypeErrors(c.name,code.tsx),[]);
  const page=await browser.newPage();const render=await mountGenerated(page,c.name,code.tsx,code.css);
  for(const [value,color] of [[undefined,'rgb(170, 0, 0)'],['#112233','rgb(17, 34, 51)'],['#44556680','rgba(68, 85, 102, 0.5)'],[undefined,'rgb(170, 0, 0)']]){
   await render({labelInk:value});assert.equal(await page.getByText('Label',{exact:true}).evaluate(n=>getComputedStyle(n).color),color);assert.equal(await page.getByText('Other',{exact:true}).evaluate(n=>getComputedStyle(n).color),'rgb(0, 170, 0)');
  }await page.close();
 }}finally{await browser.close()}
});
test('native instances change only marked text, retaining sibling ink and the shared main',async()=>{
 const child=editableFixture(),parent=ContractSchema.parse({id:'test.ink-parent',name:'InkParent',version:'1.0.0',status:'draft',description:'Two independent callers',semantics:{element:'div'},states:[],props:[],anatomy:{root:{layout:{display:'flex'},parts:{plain:{component:{id:child.id}},painted:{component:{id:child.id,props:{ink:'#44556680',label:'Changed'}}}}}},bindings:{code:{anchors:{importPath:'./InkParent',export:'InkParent'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
 const contracts=new Map([[child.id,child],[parent.id,parent]]),engine=createFigmaEngine({tokens,icons:new Map()}),host=createFigmaMock(),ctx=vm.createContext({figma:host.figma,console:{log(){},warn(){},error(){}}});const run=(s:string)=>vm.runInContext(`(async()=>{${s}\n})()`,ctx);
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(child,contracts));await run(engine.buildComponentScript(parent,contracts));
 const main:any=host.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===child.id),owner:any=host.root.findOne((n:any)=>n.getSharedPluginData('ds_contracts','contractId')===parent.id);
 const label=(n:any)=>n.findOne((x:any)=>x.type==='TEXT'&&x.characters==='Label');
 const instances=owner.findAll((n:any)=>n.type==='INSTANCE');assert.equal(instances.length,2);
 assert.equal(label(main).fills[0].color.r,170/255);assert.equal(label(instances[0]).fills[0].color.r,170/255);
 const changed=instances[1].findOne((n:any)=>n.type==='TEXT'&&n.characters==='Changed');assert(changed);const actual=changed.fills[0];assert.equal(actual.color.r,68/255);assert.equal(actual.opacity,128/255);
 assert.equal(instances[1].findOne((n:any)=>n.type==='TEXT'&&n.characters==='Other').fills[0].color.g,170/255);
});
test('color inputs reject non-owned targets, defaults, duplicates and noncolor domains',()=>{
 for(const mutate of [(c:any)=>c.props[0].default='#112233',(c:any)=>c.props[0].type.enum=['red'],(c:any)=>c.anatomy.root.parts.other.textColorOverrideProp='ink',(c:any)=>c.anatomy.root.parts.label.component={id:'x'},(c:any)=>delete c.anatomy.root.parts.label.text]){const c=fixture();mutate(c);assert.equal(ContractSchema.safeParse(c).success,false);}
});

function editableFixture(){
 const c=fixture();delete c.anatomy.root.parts!.label.text;
 c.props.push({name:'label',type:'text',default:'Label',bindings:{code:{prop:'label'},figma:{kind:'TEXT',property:'Label'}}});
 c.anatomy.root.parts!.label.content={prop:'label'};return ContractSchema.parse(c);
}
test('editable text and scoped ink remain independent on both React surfaces',async()=>{
 const c=editableFixture(),contracts=new Map([[c.id,c]]),icons=new Map(),browser=await chromium.launch();
 try{for(const surface of ['module','inline']){
  const code=surface==='module'?emitReact(c,{contracts,icons,tokens:new Set()}):{...emitReactInline(c,{contracts,icons,tokens}),css:''};
  assert.deepEqual(generatedTypeErrors(c.name,code.tsx),[]);
  const page=await browser.newPage(),render=await mountGenerated(page,c.name,code.tsx,code.css);
  for(const [label,labelInk,color] of [['First','#112233','rgb(17, 34, 51)'],['Second',undefined,'rgb(170, 0, 0)'],['Third','#44556680','rgba(68, 85, 102, 0.5)']]){
   await render({label,labelInk});assert.equal(await page.getByText(label!,{exact:true}).evaluate(n=>getComputedStyle(n).color),color);
   assert.equal(await page.getByText('Other',{exact:true}).evaluate(n=>getComputedStyle(n).color),'rgb(0, 170, 0)');
  }await page.close();
 }}finally{await browser.close()}
});
test('editable ink targets require an explicit native text input with a string default',()=>{
 for(const mutate of [(c:any)=>c.props[1].type='boolean',(c:any)=>c.props[1].bindings.figma={kind:'NONE'},(c:any)=>delete c.props[1].default,(c:any)=>c.anatomy.root.parts.label.content.prop='unknown',(c:any)=>c.anatomy.root.parts.label.slot='body']){
  const c=editableFixture();mutate(c);assert.equal(ContractSchema.safeParse(c).success,false);
 }
});

test('parent interaction states address one child text control and restore the applied rest value',async()=>{
 const child=editableFixture();
 const parent=ContractSchema.parse({id:'test.state-parent',name:'StateParent',version:'1.0.0',status:'draft',description:'Identity-scoped child ink',semantics:{element:'button'},states:['hover'],props:[],
  anatomy:{root:{layout:{display:'flex'},parts:{child:{component:{id:child.id,props:{ink:'#112233',label:'Editable'}},states:{hover:{'text-color:ink':'{paint.hover}'}}}}}},
  bindings:{code:{anchors:{importPath:'./StateParent',export:'StateParent'},statePreviews:true},figma:{anchors:{fileKey:null,componentSetKey:null},statePreviews:true}}});
 const values={...tokens,primitives:{paint:{hover:{$type:'color',$value:'#44556680'}}}},contracts=new Map([[child.id,child],[parent.id,parent]]),icons=new Map();
 const cc=emitReact(child,{contracts,icons,tokens:new Set(['paint.hover'])}),pc=emitReact(parent,{contracts,icons,tokens:new Set(['paint.hover'])});
 const browser=await chromium.launch();try{
  const page=await browser.newPage(),render=await mountGenerated(page,parent.name,pc.tsx,pc.css,{[child.name]:{tsx:cc.tsx,css:cc.css}});
  await page.addStyleTag({content:':root { --paint-hover: #44556680; }'});
  const color=(text:string)=>page.getByText(text,{exact:true}).evaluate(n=>getComputedStyle(n).color);
  await page.mouse.move(1000,1000);assert.equal(await color('Editable'),'rgb(17, 34, 51)');
  await page.getByRole('button').hover();assert.equal(await color('Editable'),'rgba(68, 85, 102, 0.5)');assert.equal(await color('Other'),'rgb(0, 170, 0)');
  await page.mouse.move(1000,1000);assert.equal(await color('Editable'),'rgb(17, 34, 51)');
  await render({statePreview:'hover'});assert.equal(await color('Editable'),'rgba(68, 85, 102, 0.5)');
  await render({});assert.equal(await color('Editable'),'rgb(17, 34, 51)');
 }finally{await browser.close();}
 const data=createFigmaEngine({tokens:values,icons}).compileComponentData(parent,contracts);
 assert.deepEqual(data.stateVariants![0].spec.children![0].instanceTextColors,{[child.id+':ink']:'#44556680'});
 assert.deepEqual(data.variants[0].spec.children![0].instanceTextColors,{[child.id+':ink']:'#112233'});
 const bad=structuredClone(parent);bad.anatomy.root.parts!.child.states!.hover={'text-color:missing':'{paint.hover}'};
 assert.throws(()=>emitReact(bad,{contracts:new Map([[child.id,child],[bad.id,bad]]),icons,tokens:new Set(['paint.hover'])}),/state|channel/);
 const consumer=structuredClone(child);consumer.anatomy.root.parts!.slot={slot:{name:'children'}};
 assert.throws(()=>emitReact(parent,{contracts:new Map([[consumer.id,consumer],[parent.id,parent]]),icons,tokens:new Set(['paint.hover'])}),/state|channel/);
});
