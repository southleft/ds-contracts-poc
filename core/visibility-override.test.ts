import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {createRequire} from 'node:module';import * as React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {transformSync} from 'esbuild';
import {ContractSchema,type Contract} from '../scripts/contract-schema.js';import {emitReact} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';import {createFigmaEngine} from './emit-figma-script.js';import {generatedTypeErrors} from './react-test-runtime.js';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
export function visibilityFixture():Contract{return ContractSchema.parse({id:'test.visibility-override',name:'VisibilityOverride',version:'1.0.0',status:'draft',description:'Optional child-owned visibility retains selected variant defaults',semantics:{element:'div'},states:[],props:[
 {name:'type',type:{enum:['plain','decorated']},default:'plain',bindings:{code:{prop:'appearance'},figma:{kind:'VARIANT',property:'Type',values:{plain:'Plain',decorated:'Decorated'}}}},
 {name:'inkVisible',type:'boolean',bindings:{code:{prop:'showInk'},figma:{kind:'NONE'}}},
 ],anatomy:{root:{literals:{width:'80px',height:'40px'},parts:{ink:{text:'Ink',literals:{'font-size':'14px',color:'#ff0000'},presenceByCombination:{props:['type'],rows:[{values:['plain'],present:false},{values:['decorated'],present:true}]},visibilityOverrideProp:'inkVisible'}}}},bindings:{code:{anchors:{importPath:'./VisibilityOverride',export:'VisibilityOverride'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});}
const load=(tsx:string)=>{const module={exports:{} as any},req=createRequire(import.meta.url);vm.runInNewContext(transformSync(tsx,{loader:'tsx',format:'cjs',jsx:'automatic'}).code,{module,exports:module.exports,require:(p:string)=>p.endsWith('.css')?{default:new Proxy({},{get:(_,k)=>String(k)})}:req(p)});return module.exports.VisibilityOverride;};
test('both React surfaces preserve variant default on omission and honor explicit true and false through public aliases',()=>{
 const c=visibilityFixture(),contracts=new Map([[c.id,c]]);
 for(const tsx of [emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx,emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx]){
  assert.deepEqual(generatedTypeErrors(c.name,tsx),[]);const C=load(tsx);
  for(const appearance of ['plain','decorated'])for(const showInk of [undefined,false,true]){
   const html=renderToStaticMarkup(React.createElement(C,{appearance,showInk}));assert.equal(html.includes('Ink'),showInk??appearance==='decorated');
  }
 }
});
test('native compiler retains editable ink in both variants with distinct visibility defaults and a child-owned identity marker',()=>{
 const c=visibilityFixture(),data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));
 assert.equal(data.boolProps.length,0);assert.equal(data.variants.length,2);for(const v of data.variants){const ink=v.spec.children!.find(n=>n.name==='ink')!;assert(ink);assert.equal(ink.visibleProp,undefined);assert.equal(ink.visibilityTarget?.key,c.id+':inkVisible');assert.equal(ink.visibilityTarget?.visible,v.name==='Type=Decorated');}
});
test('visibility override authority must be owned, optional, defaultless, and a node control',()=>{
 for(const change of [(c:any)=>c.anatomy.root.parts.ink.declared={display:'none'},(c:any)=>c.props[1].default=true,(c:any)=>c.props[1].required=true,(c:any)=>c.props[1].type='text',(c:any)=>c.anatomy.root.visibilityOverrideProp='inkVisible',(c:any)=>c.anatomy.root.parts.ink.visibilityOverrideProp='missing',(c:any)=>c.anatomy.root.parts.ink.slot='content']){const c=visibilityFixture();change(c);assert.equal(ContractSchema.safeParse(c).success,false);}
});
test('a live native base Boolean cannot be silently replaced by a node override',()=>{
 const c=visibilityFixture();c.props.push({name:'gate',type:'boolean',default:false,bindings:{code:{prop:'gate'},figma:{kind:'BOOLEAN',property:'Gate'}}});c.anatomy.root.parts!.ink.visibleWhen={prop:'gate'};
 assert.equal(ContractSchema.safeParse(c).success,false);
});
export function visibilityParentFixture():Contract {
 const child=visibilityFixture();return ContractSchema.parse({id:'test.visibility-parent',name:'VisibilityParent',version:'1.0.0',status:'draft',description:'Child-authorized direct visibility',semantics:{element:'div'},states:[],props:[{name:'shown',type:'boolean',default:false,bindings:{code:{prop:'shown'},figma:{kind:'VARIANT',property:'Shown',values:{true:'True',false:'False'}}}}],anatomy:{root:{layout:{display:'flex',direction:'row'},parts:{ref:{component:{id:child.id,props:{type:'plain',inkVisible:'{shown}'}}}}}},bindings:{code:{anchors:{importPath:'./VisibilityParent',export:'VisibilityParent'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}});
}
test('parent selected values become explicit identity-keyed instance overrides, not shared component properties',()=>{
 const child=visibilityFixture(),parent=visibilityParentFixture(),byId=new Map([[child.id,child],[parent.id,parent]]);const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parent,byId);
 for(const v of data.variants){const ref=v.spec.children![0];assert.deepEqual(ref.instanceVisibility,{[child.id+':inkVisible']:v.name==='Shown=True'});assert.equal(Object.hasOwn(ref.depProps!,'Show ink'),false);}
 parent.props[0].bindings.figma={kind:'BOOLEAN',property:'Shown'};
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parent,byId),/visibility-override-live-parent-link-unqualified/);
});
import {chromium} from 'playwright-core';import {mountGenerated} from './react-test-runtime.js';
test('actual composed React applies the parent value through the child public code alias on both surfaces',async t=>{
 const child=visibilityFixture(),parent=visibilityParentFixture(),contracts=new Map([[child.id,child],[parent.id,parent]]);const b=await chromium.launch();t.after(()=>b.close());
 for(const inline of [false,true]){const emit=(c:Contract)=>inline?emitReactInline(c,{tokens,contracts,icons:new Map()}):emitReact(c,{tokens:new Set(),contracts,icons:new Map()});const a=emit(parent),d=emit(child),page=await b.newPage();const render=await mountGenerated(page,parent.name,a.tsx,'css'in a?String(a.css):'',{[child.name]:{tsx:d.tsx,css:'css'in d?String(d.css):''}});for(const shown of [true,false,true]){await render({shown});assert.equal((await page.locator('#root').innerText()).includes('Ink'),shown);}await page.close();}
});
import {emitHtml} from './emit-html.js';import {emitWebComponent} from '../packages/emitter-web-components/src/emit-wc.js';
test('unqualified surfaces refuse node visibility controls and duplicate target authority is rejected',()=>{
 const c=visibilityFixture();delete c.anatomy.root.parts!.ink.presenceByCombination;const contracts=new Map([[c.id,c]]);
 assert.throws(()=>emitHtml(c,{tokens:new Set(),icons:new Map(),contracts}),/HTML_VISIBILITY_OVERRIDE_UNSUPPORTED/);
 assert.throws(()=>emitWebComponent(c,{tokens:new Set(),icons:new Map(),contracts}),/WEB_COMPONENT_VISIBILITY_OVERRIDE_UNSUPPORTED/);
 c.anatomy.root.parts!.other=structuredClone(c.anatomy.root.parts!.ink);assert.equal(ContractSchema.safeParse(c).success,false);
});

test('two-axis Boolean arguments preserve true, false and omission on both React surfaces and native specs',async t=>{
 const child=visibilityFixture(),parent=visibilityParentFixture();
 parent.props.push({name:'side',type:{enum:['left','right']},default:'left',bindings:{code:{prop:'placement'},figma:{kind:'VARIANT',property:'Side',values:{left:'Left',right:'Right'}}}});
 const ref=parent.anatomy.root.parts!.ref.component!;ref.props={type:'plain'};
 ref.booleanPropsByCombination={inkVisible:{props:['shown','side'],rows:[
  {values:['false','left'],value:null},{values:['false','right'],value:true},
  {values:['true','left'],value:false},{values:['true','right'],value:true},
 ]}};
 ContractSchema.parse(parent);
 const contracts=new Map([[child.id,child],[parent.id,parent]]),browser=await chromium.launch();t.after(()=>browser.close());
 for(const type of ['plain','decorated']){
  ref.props.type=type;
  for(const inline of [false,true]){
   const emit=(c:Contract)=>inline?emitReactInline(c,{tokens,contracts,icons:new Map()}):emitReact(c,{tokens:new Set(),contracts,icons:new Map()});
   const a=emit(parent),d=emit(child);assert.deepEqual(generatedTypeErrors(parent.name,a.tsx,{[child.name]:d.tsx}),[]);
   const page=await browser.newPage(),render=await mountGenerated(page,parent.name,a.tsx,'css'in a?String(a.css):'',{[child.name]:{tsx:d.tsx,css:'css'in d?String(d.css):''}});
   for(const shown of [true,false])for(const placement of ['right','left']){
    await render({shown,placement});const argument:boolean|null=ref.booleanPropsByCombination.inkVisible.rows.find(r=>r.values[0]===String(shown)&&r.values[1]===placement)!.value;
    assert.equal((await page.locator('body').innerText()).includes('Ink'),argument??type==='decorated');
   }
   await page.close();
  }
  const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(parent,contracts);
  for(const v of data.variants){const shown=v.name.includes('Shown=True'),side=v.name.includes('Side=Right')?'right':'left',value:boolean|null=ref.booleanPropsByCombination.inkVisible.rows.find(r=>r.values[0]===String(shown)&&r.values[1]===side)!.value;
   assert.deepEqual(v.spec.children![0].instanceVisibility,value===null?undefined:{[child.id+':inkVisible']:value});
  }
 }
 for(const mutate of [(p:any)=>p.anatomy.root.parts.ref.component.booleanPropsByCombination.inkVisible.rows.pop(),(p:any)=>p.anatomy.root.parts.ref.component.props.inkVisible=true,(p:any)=>p.anatomy.root.parts.ref.component.booleanPropsByCombination.inkVisible.props[0]='missing']){
  const bad=structuredClone(parent);mutate(bad);assert.equal(ContractSchema.safeParse(bad).success,false);
 }
 assert.throws(()=>emitHtml(parent,{tokens:new Set(),icons:new Map(),contracts}),/HTML_COMPONENT_BOOLEAN_ARGUMENTS_UNSUPPORTED/);
 assert.throws(()=>emitWebComponent(parent,{tokens:new Set(),icons:new Map(),contracts}),/WEB_COMPONENT_BOOLEAN_ARGUMENTS_UNSUPPORTED/);
 const bad=structuredClone(parent);bad.anatomy.root.parts!.ref.component!.booleanPropsByCombination={type:ref.booleanPropsByCombination.inkVisible};
 assert.throws(()=>emitReact(bad,{tokens:new Set(),contracts,icons:new Map()}),/child-must-be-boolean/);
 assert.throws(()=>createFigmaEngine({tokens,icons:new Map()}).compileComponentData(bad,contracts),/child-must-be-boolean/);
});


test('captured constant hidden default survives omission in both React emitters and native main',()=>{
 const c=visibilityFixture(),part=c.anatomy.root.parts!.ink;delete part.presenceByCombination;part.visibilityOverrideDefault=false;assert(ContractSchema.safeParse(c).success);const contracts=new Map([[c.id,c]]);
 for(const tsx of [emitReact(c,{tokens:new Set(),icons:new Map(),contracts}).tsx,emitReactInline(c,{tokens,icons:new Map(),contracts}).tsx]){
  assert.deepEqual(generatedTypeErrors(c.name,tsx),[]);const C=load(tsx);
  for(const showInk of [undefined,true,false,undefined])assert.equal(renderToStaticMarkup(React.createElement(C,{showInk})).includes('Ink'),showInk===true);
 }
 const data=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,contracts);assert(data.variants.every(v=>v.spec.children!.find(n=>n.name==='ink')!.visibilityTarget?.visible===false));
 const bad=structuredClone(c);delete bad.anatomy.root.parts!.ink.visibilityOverrideProp;assert.equal(ContractSchema.safeParse(bad).success,false);
});
