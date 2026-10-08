import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
const contract=()=>ContractSchema.parse({id:'ds.ratio-probe',name:'RatioProbe',version:'0.1.0',status:'draft',description:'Responsive aspect ratio',semantics:{element:'div'},props:[],states:[],anatomy:{root:{layout:{display:'flex',direction:'column'},literals:{width:'240px'},parts:{spacer:{literals:{width:'240px'},declared:{'aspect-ratio':'6 / 7'}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./RatioProbe',export:'RatioProbe'}}}});
const engine=()=>createFigmaEngine({tokens:{primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}},icons:new Map()});
test('known-width ratio compiles a native lock and generated runtime verifies its readback',async()=>{
 const c=contract(),e=engine(),scope=new Map([[c.id,c]]),data=e.compileComponentData(c,scope),spec=data.variants[0].spec.children![0];
 assert.equal(spec.nativeAspectRatio,6/7);assert.equal(spec.lits!.height,280);
 const script=e.buildComponentScript(c,scope),host=createFigmaMock();
 await vm.runInNewContext(`(async()=>{${script}\n})()`,{figma:host.figma,console:{log(){},warn(){},error(){}}});
 const node=host.root.findOne(n=>n.name==='spacer'&&n.type==='FRAME')!;assert(node);
 assert.deepEqual(JSON.parse(JSON.stringify((node as any).targetAspectRatio)),{x:240,y:280});
 assert(!JSON.stringify(data).includes('ratio does not reach the canvas'));
});
test('explicit height keeps precedence and no ratio runtime is emitted without a lock',()=>{
 const c=contract();c.anatomy.root.parts!.spacer.literals!.height='90px';
 const e=engine(),scope=new Map([[c.id,c]]),spec=e.compileComponentData(c,scope).variants[0].spec.children![0];
 assert.equal(spec.nativeAspectRatio,undefined);assert.equal(spec.lits!.height,90);
 assert(!e.buildComponentScript(c,scope).includes('function applyNativeAspectRatio'));
});
test('a missing native ratio API refuses instead of silently freezing responsive behavior',async()=>{
 const c=contract(),e=engine(),host=createFigmaMock(),figma:any=host.figma,create=figma.createFrame.bind(figma);
 figma.createFrame=()=>{const n=create();n.lockAspectRatio=undefined;return n;};
 await assert.rejects(vm.runInNewContext(`(async()=>{${e.buildComponentScript(c,new Map([[c.id,c]]))}\n})()`,{figma,console:{log(){},warn(){},error(){}}}),/NATIVE_ASPECT_RATIO_UNAVAILABLE/);
});

test('malformed ratio API readback refuses instead of passing a NaN comparison',async()=>{
 const c=contract(),e=engine(),host=createFigmaMock(),figma:any=host.figma,create=figma.createFrame.bind(figma);
 figma.createFrame=()=>{const n=create();n.lockAspectRatio=()=>{n.targetAspectRatio={x:0,y:0};};return n;};
 await assert.rejects(vm.runInNewContext(`(async()=>{${e.buildComponentScript(c,new Map([[c.id,c]]))}\n})()`,{figma,console:{log(){},warn(){},error(){}}}),/NATIVE_ASPECT_RATIO_READBACK_MISMATCH/);
});
