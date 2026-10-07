import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {ContractSchema} from '../scripts/contract-schema.js';
import {mapNativeImageArguments,NATIVE_IMAGE_CONTROL_RUNTIME} from './native-image-control.js';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const choice={image:`url('data:image/png;base64,${png}')`,size:'200% 400%',position:'25% 75%'};
const contract=()=>ContractSchema.parse({id:'test.image',name:'Image',version:'0.1.0',status:'draft',description:'Finite image',semantics:{element:'div'},props:[{name:'photo',type:{enum:['crop']},bindings:{code:{prop:'photo'},figma:{kind:'NONE'}}}],states:[],anatomy:{root:{parts:{photo:{imageOverride:{prop:'photo',choices:{crop:choice}}}}}},bindings:{figma:{anchors:{fileKey:null,componentSetKey:null}},code:{anchors:{importPath:'./Image',export:'Image'}}}});
const solid={type:'SOLID',color:{r:1,g:0,b:0}};
function layer(key='test.image:photo',type='FRAME',children:any[]=[]):any{return{type,children,fills:[solid,{type:'IMAGE',imageHash:'original',scaleMode:'FILL'}],getSharedPluginData:()=>key};}
function execute(node:any,spec:any,failAsset=false){
 const assets=new Map<string,Buffer>(),figma={skipInvisibleInstanceChildren:true,base64Decode:(s:string)=>Buffer.from(s,'base64'),createImage:(bytes:Uint8Array)=>{if(failAsset)throw Error('asset failed');const hash=createHash('sha1').update(bytes).digest('hex');assets.set(hash,Buffer.from(bytes));return{hash};}};
 const run=()=>vm.runInNewContext(NATIVE_IMAGE_CONTROL_RUNTIME,{node,spec,figma});return{run,figma,assets};
}
test('native image arguments resolve literals, parent references and finite maps without defaulting',()=>{
 const c=contract(),expected=mapNativeImageArguments(c,{photo:'crop'},{});
 assert.deepEqual(expected?.['test.image:photo'].imageTransform,[[.5,0,.125],[0,.25,.5625]]);
 assert.deepEqual(mapNativeImageArguments(c,{photo:'{selection}'},{selection:'crop'}),expected);
 assert.deepEqual(mapNativeImageArguments(c,{photo:{prop:'selection',map:{yes:'crop'}}},{selection:'yes'}),expected);
 assert.equal(mapNativeImageArguments(c,{},{}),undefined);
 assert.equal(mapNativeImageArguments(c,{photo:'{selection}'},{}),undefined);
 assert.throws(()=>mapNativeImageArguments(c,{photo:'url(https://example.com)'},{}),/value-unqualified/);
});
test('native instance writer preserves underlying paint, crop and original bytes without changing the main',()=>{
 const main=layer(),target=structuredClone({type:main.type,children:[],fills:main.fills});Object.assign(target,{getSharedPluginData:()=> 'test.image:photo'});
 const {run,figma,assets}=execute({children:[target]},{instanceImages:mapNativeImageArguments(contract(),{photo:'crop'}, {})});run();
 assert.equal(figma.skipInvisibleInstanceChildren,true);assert.deepEqual(target.fills[0],solid);
 assert.equal(main.fills[1].imageHash,'original');assert.equal(target.fills[1].scaleMode,'CROP');
 assert.equal(JSON.stringify(target.fills[1].imageTransform),'[[0.5,0,0.125],[0,0.25,0.5625]]');
 assert.deepEqual(assets.get(target.fills[1].imageHash),Buffer.from(png,'base64'));
 const before=JSON.stringify(target.fills);execute({children:[target]},{}).run();assert.equal(JSON.stringify(target.fills),before);
});
test('native instance writer rejects missing, duplicate, cross-instance and wrong-type targets before paint changes',()=>{
 const image=mapNativeImageArguments(contract(),{photo:'crop'}, {})!;
 for(const children of [[],[layer(),layer()],[layer('','INSTANCE',[layer()])],[layer('test.image:photo','TEXT')],[layer('test.image:photo','INSTANCE')]]){
  const before=JSON.stringify(children),execution=execute({children},{instanceImages:image});
  assert.throws(execution.run,/target-unqualified/);assert.equal(JSON.stringify(children),before);assert.equal(execution.figma.skipInvisibleInstanceChildren,true);
 }
 const first=layer(),before=JSON.stringify(first.fills),execution=execute({children:[first]},{instanceImages:{...image,missing:image['test.image:photo']}});
 assert.throws(execution.run,/target-unqualified/);assert.equal(JSON.stringify(first.fills),before);
});
test('native instance writer refuses missing or ambiguous original image paint and restores skip flag on failure',()=>{
 for(const fills of [[solid],[{type:'IMAGE'}, {type:'IMAGE'}],[{type:'IMAGE',opacity:.5}],[{type:'IMAGE',visible:false}]]){
  const target=layer();target.fills=fills;const e=execute({children:[target]},{instanceImages:mapNativeImageArguments(contract(),{photo:'crop'}, {})});assert.throws(e.run,/original-paint-unqualified/);assert.equal(e.figma.skipInvisibleInstanceChildren,true);
 }
 const target=layer(),before=JSON.stringify(target.fills),e=execute({children:[target]},{instanceImages:mapNativeImageArguments(contract(),{photo:'crop'}, {})},true);
 assert.throws(e.run,/asset failed/);assert.equal(JSON.stringify(target.fills),before);assert.equal(e.figma.skipInvisibleInstanceChildren,true);
});

test('production component script routes finite image choice to the linked instance only',async()=>{
 const {createFigmaEngine}=await import('./emit-figma-script.js');
 const {createFigmaMock}=await import('../scripts/plugin-engine-mock-figma.mjs');
 const c=contract();c.anatomy.root.layout={display:'flex',direction:'row'};
 const photo=c.anatomy.root.parts!.photo;
 photo.literals={width:'16px',height:'16px'};photo.tokens={'background-image':'{asset.image}'};photo.declared={'background-size':'cover','background-position':'50% 50%','background-repeat':'no-repeat'};
 const parent=ContractSchema.parse({...c,id:'test.image-parent',name:'ImageParent',props:[],anatomy:{root:{layout:{display:'flex',direction:'row'},parts:{original:{component:{id:c.id}},changed:{component:{id:c.id,props:{photo:'crop'}}}}}}});
 const tokens={primitives:{},semantic:{asset:{image:{$type:'string',$value:choice.image}}},light:{},dark:{},brands:{default:{}}};
 const engine=createFigmaEngine({tokens,icons:new Map()}),byId=new Map([[c.id,c],[parent.id,parent]]),data=engine.compileComponentData(parent,byId);
 assert.deepEqual(data.variants[0].spec.children?.[1].instanceImages?.['test.image:photo'].imageTransform,[[.5,0,.125],[0,.25,.5625]]);

 const {figma}=createFigmaMock(),assets=new Map<string,Buffer>();
 Object.assign(figma,{base64Decode:(s:string)=>new Uint8Array(Buffer.from(s,'base64')),createImage:(bytes:Uint8Array)=>{const hash=createHash('sha1').update(bytes).digest('hex');assets.set(hash,Buffer.from(bytes));return{hash};}});
 await vm.runInNewContext('(async()=>{'+engine.buildComponentScript(c,byId)+'})()',{figma,console:{log(){},warn(){},error(){}}});
 await vm.runInNewContext('(async()=>{'+engine.buildComponentScript(parent,byId)+'})()',{figma,console:{log(){},warn(){},error(){}}});
 const main=figma.root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id) as any;
 assert(main);const instances=main.children.filter((n:any)=>n.type==='INSTANCE');assert.equal(instances.length,2);
 const [original,changed]=instances.map((n:any)=>n.children[0].fills.find((p:any)=>p.type==='IMAGE'));
 assert.equal(original.scaleMode,'FILL');assert.equal(changed.scaleMode,'CROP');
 assert.equal(JSON.stringify(changed.imageTransform),'[[0.5,0,0.125],[0,0.25,0.5625]]');assert.deepEqual(assets.get(changed.imageHash),Buffer.from(png,'base64'));
});
