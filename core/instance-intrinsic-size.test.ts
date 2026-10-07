import test from 'node:test';import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ContractSchema} from '../scripts/contract-schema.js';
import {instanceIntrinsicSizePlan} from '../packages/core/src/instance-intrinsic-size.js';
import {emitReact} from './emit-react.js';import {emitReactInline} from './emit-react-inline.js';
import {createFigmaEngine} from './emit-figma-script.js';import {mountGenerated} from './react-test-runtime.js';
const base={version:'1.0.0',description:'Intrinsic shape allocation',semantics:{element:'div'},props:[],states:[],bindings:{code:{anchors:{importPath:'./Intrinsic',export:'Intrinsic'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}};
function fixture(){
 const child=ContractSchema.parse({...base,id:'proof.child',name:'Intrinsic',props:[{name:'size',type:{enum:['large','small']},default:'large',bindings:{code:{prop:'size'},figma:{kind:'VARIANT',property:'Size',values:{large:'Large',small:'Small'}}}}],anatomy:{root:{layout:{display:'flex',direction:'column',align:'center'},literals:{width:'fit-content',height:'fit-content'},tokens:{'padding-inline':'{space.inset}'},parts:{ink:{shape:{kind:'path',width:12,height:6,paths:[{data:'M 0 0 L 6 6 L 12 0 Z',windingRule:'NONZERO'}],pathsByProp:{prop:'size',map:{large:{width:12,height:6,paths:[{data:'M 0 0 L 6 6 L 12 0 Z',windingRule:'NONZERO'}]},small:{width:8,height:4,paths:[{data:'M 0 0 L 4 4 L 8 0 Z',windingRule:'NONZERO'}]}}}},literals:{'background-color':'#336699'}}}}}});
 const parent=ContractSchema.parse({...base,id:'proof.parent',name:'Host',anatomy:{root:{layout:{display:'flex',align:'start'},parts:{ref:{component:{id:child.id,props:{size:'small'}},instanceAffine:{localSize:{width:40,height:4},transform:[[0,-1,4],[1,0,0]]}}}}}});
 const values={primitives:{space:{inset:{$type:'dimension',$value:'16px'}}},semantic:{},light:{},dark:{},brands:{default:{}}};
 return {parent,child,values};
}
test('selected HUG path geometry derives local size without replacing child dimensions',async t=>{
 const {parent,child,values}=fixture(),part=parent.anatomy.root.parts!.ref;
 assert.deepEqual(instanceIntrinsicSizePlan(child,part)!(path=>path==='space.inset'?'16px':undefined),{width:40,height:4});
 const contracts=new Map([[parent.id,parent],[child.id,child]]),icons=new Map<string,string>();
 const browser=await chromium.launch();t.after(()=>browser.close());
 for(const inline of [false,true]){
  const emit=(c:typeof child)=>inline?{...emitReactInline(c,{contracts,icons,tokens:values}),css:''}:emitReact(c,{contracts,icons,tokens:new Set(['space.inset']),tokenValues:values});
  const out=emit(parent),dep=emit(child),page=await browser.newPage();await mountGenerated(page,parent.name,out.tsx,out.css,{Intrinsic:dep});
  await page.addStyleTag({content:':root{--space-inset:16px}'});
  assert.deepEqual(await page.locator('#root > * > :first-child').evaluate(host=>{const child=host.children[0].children[0] as HTMLElement;const h=host.getBoundingClientRect(),c=child.getBoundingClientRect();return [h.width,h.height,c.width,c.height,child.offsetWidth,child.offsetHeight];}),[4,40,4,40,40,4]);
  await page.close();
 }
 const spec=createFigmaEngine({tokens:values,icons}).compileComponentData(parent,contracts).variants[0].spec.children![0];
 assert.deepEqual(spec.lits,{width:4,height:40});assert.deepEqual(spec.children![0].instanceAffineAllocation!.localSize,{width:40,height:4});
 assert.equal(child.anatomy.root.literals!.width,'fit-content');
 const bad={...values,dark:{space:{inset:{$type:'dimension',$value:'17px'}}}};
 assert.throws(()=>emitReactInline(parent,{contracts,icons,tokens:bad}),/intrinsic-size-unproven/);
 assert.throws(()=>emitReact(parent,{contracts,icons,tokens:new Set(['space.inset']),tokenValues:bad}),/intrinsic-size-unproven/);
 assert.throws(()=>createFigmaEngine({tokens:bad,icons}).buildComponentScript(parent,contracts),/intrinsic-size-unproven/);
});
test('intrinsic proof refuses unmodeled layout, caller-selected size, and conflicting dimensions',()=>{
 for(const mutate of [(c:any,p:any)=>p.component.props.size='{size}',(c:any)=>c.anatomy.root.layout.wrap=true,(c:any)=>c.anatomy.root.states={hover:{width:'30px'}},(c:any)=>c.anatomy.root.parts.ink.literals.margin='2px',(c:any)=>c.anatomy.root.parts.ink.shape.rotation=90,(c:any)=>c.semantics.element='button']){
  const {parent,child}=fixture(),part=parent.anatomy.root.parts!.ref;mutate(child,part);assert.equal(instanceIntrinsicSizePlan(child,part),undefined);
 }
 for(const mutate of [(c:any)=>c.anatomy.root.literals['padding-left']='2px',(c:any)=>c.anatomy.root.parts.ink.literals.width='9px']){
  const {parent,child}=fixture(),part=parent.anatomy.root.parts!.ref;mutate(child);assert.equal(instanceIntrinsicSizePlan(child,part)!(()=>'16px'),undefined);
 }
});

test('declared caller dimensions must equal independently derived HUG dimensions in every mode',async t=>{
 const {parent,child,values}=fixture(),part=parent.anatomy.root.parts!.ref;
 child.anatomy.root.instanceRootInputs=['width','height'];
 part.component!.rootOverrides={width:'{caller.width}',height:'{caller.height}'};
 const tokens={...values,primitives:{...values.primitives,caller:{width:{$type:'dimension',$value:'40px'},height:{$type:'dimension',$value:'4px'}}}};
 const resolve=(path:string)=>({'space.inset':'16px','caller.width':'40px','caller.height':'4px'}[path]);
 assert.deepEqual(instanceIntrinsicSizePlan(child,part)!(resolve),{width:40,height:4});
 const contracts=new Map([[parent.id,parent],[child.id,child]]),icons=new Map<string,string>(),browser=await chromium.launch();t.after(()=>browser.close());
 for(const inline of [false,true]){
  const emit=(c:typeof child)=>inline?{...emitReactInline(c,{contracts,icons,tokens}),css:''}:emitReact(c,{contracts,icons,tokens:new Set(['space.inset','caller.width','caller.height']),tokenValues:tokens});
  const out=emit(parent),dep=emit(child),page=await browser.newPage();await mountGenerated(page,parent.name,out.tsx,out.css,{Intrinsic:dep});
  await page.addStyleTag({content:':root{--space-inset:16px;--caller-width:40px;--caller-height:4px}'});
  assert.deepEqual(await page.locator('#root > * > :first-child').evaluate(host=>{const child=host.children[0].children[0] as HTMLElement;const h=host.getBoundingClientRect();return[h.width,h.height,child.offsetWidth,child.offsetHeight];}),[4,40,40,4]);await page.close();
 }
 const bad={...tokens,dark:{caller:{width:{$type:'dimension',$value:'41px'}}}};
 assert.throws(()=>emitReactInline(parent,{contracts,icons,tokens:bad}),/intrinsic-size-unproven/);
 assert.throws(()=>emitReact(parent,{contracts,icons,tokens:new Set(['space.inset','caller.width','caller.height']),tokenValues:bad}),/intrinsic-size-unproven/);
 assert.throws(()=>createFigmaEngine({tokens:bad,icons}).buildComponentScript(parent,contracts),/intrinsic-size-unproven/);
 const allowed=createFigmaEngine({tokens,icons}).compileComponentData(parent,contracts).variants[0].spec.children![0];
 assert.deepEqual(allowed.lits,{width:4,height:40});
 for(const change of [(p:any)=>p.component.rootOverrides.opacity='{opacity}',(p:any)=>p.component.rootOverrides.width='40px']){
  const other=structuredClone(part);change(other);
  const plan=instanceIntrinsicSizePlan(child,other);
  if(other.component!.rootOverrides!.opacity)assert.equal(plan,undefined);
  else assert.deepEqual(plan!(resolve),{width:40,height:4});
 }
 const noCapability=structuredClone(child);delete noCapability.anatomy.root.instanceRootInputs;
 assert.equal(instanceIntrinsicSizePlan(noCapability,part),undefined);
 assert.equal(child.anatomy.root.literals!.width,'fit-content');
});
