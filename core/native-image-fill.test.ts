import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {nativeImageFill} from './native-image-fill.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const url=`url('data:image/png;base64,${png}')`;
const declared={'background-repeat':'no-repeat','background-size':'cover','background-position':'50% 50%'};
const fixture=()=>ContractSchema.parse({id:'test.image-fill',name:'ImageFill',version:'0.1.0',status:'draft',description:'Original image fill fixture',semantics:{element:'div'},props:[],states:[],anatomy:{root:{literals:{width:'80px',height:'40px'},tokens:{'background-image':'{asset.image}'},declared}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./ImageFill',export:'ImageFill'}}}});
const tokens={primitives:{},semantic:{asset:{image:{$type:'string',$value:url}}},light:{},dark:{},brands:{default:{}}};
test('original image grammar preserves cover, contain and inverse source crop transforms',()=>{
 assert.deepEqual(nativeImageFill(url,declared),{base64:png,scaleMode:'FILL'});
 assert.equal(nativeImageFill(url,{...declared,'background-size':'contain'}).scaleMode,'FIT');
 assert.deepEqual(nativeImageFill(url,{...declared,'background-size':'200% 400%','background-position':'25% 75%'}).imageTransform,[[.5,0,.125],[0,.25,.5625]]);
 for(const [value,css]of [['url(https://example.com/a.png)',declared],[url,{...declared,'background-repeat':'repeat'}],[url,{...declared,'background-position':'left top'}],[url,{...declared,'background-size':'0% 100%'}],[url,{...declared,'background-size':'auto'}]] as const)assert.throws(()=>nativeImageFill(value,css),/native-image-fill-unqualified/);
 assert.throws(()=>nativeImageFill(`url('data:image/png;base64,${'iVBORw0KGgoA'+'A'.repeat(11184812)}')`,declared),/integrity-or-budget/);
});
for(const size of ['cover','contain','200% 400%']) test('production writer preserves original bytes and placement: '+size,async()=>{
 const c=fixture();c.anatomy.root.declared!['background-size']=size;const engine=createFigmaEngine({tokens,icons:new Map()}),scope=new Map([[c.id,c]]);
 const compiled=engine.compileComponentData(c,scope);assert.equal(compiled.variants[0].spec.imagePaint?.base64,png);
 assert(!compiled.codeOnlyFacts?.some(x=>x.kind==='gradient'||['background-size','background-position','background-repeat'].includes(x.channel)));
 const {figma}=createFigmaMock(),assets=new Map<string,Buffer>();
 Object.assign(figma,{base64Decode:(s:string)=>new Uint8Array(Buffer.from(s,'base64')),createImage:(bytes:Uint8Array)=>{const hash=createHash('sha1').update(bytes).digest('hex');assets.set(hash,Buffer.from(bytes));return{hash}}});
 const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 await vm.runInContext('(async()=>{'+engine.buildComponentScript(c,scope)+'})()',context);
 const node=figma.root.findOne(n=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===c.id)!;
 assert(node);const paint=(node as any).fills.find((p:any)=>p.type==='IMAGE');assert(paint);assert.equal(paint.scaleMode,size==='cover'?'FILL':size==='contain'?'FIT':'CROP');if(size==='200% 400%')assert.equal(JSON.stringify(paint.imageTransform),JSON.stringify([[.5,0,.25],[0,.25,.375]]));assert.deepEqual(assets.get(paint.imageHash),Buffer.from(png,'base64'));
});
test('unsupported image placement stays a named compile miss',()=>{
 const c=fixture();c.anatomy.root.declared!['background-repeat']='repeat';
 const d=createFigmaEngine({tokens,icons:new Map()}).compileComponentData(c,new Map([[c.id,c]]));assert.equal(d.variants[0].spec.imagePaint,undefined);assert(d.codeOnlyFacts?.some(x=>x.reason.includes('native-image-fill-unqualified')));
});
