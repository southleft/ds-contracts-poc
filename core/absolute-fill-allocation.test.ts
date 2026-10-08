import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {ContractSchema} from '../scripts/contract-schema.js';
import {createFigmaEngine} from './emit-figma-script.js';
import {createFigmaMock} from '../scripts/plugin-engine-mock-figma.mjs';
const tokens={primitives:{},semantic:{},light:{},dark:{},brands:{default:{}}};
function fixture(vertical=false,definite=true){
 const base={version:'1.0.0',status:'draft',description:'Absolute allocation regression',props:[],states:[],semantics:{element:'div'},bindings:{code:{anchors:{importPath:'./Track',export:'Track'}},figma:{anchors:{fileKey:null,componentSetKey:null}}}};
 const child=ContractSchema.parse({...base,id:'test.track',name:'Track',anatomy:{root:{layout:{display:'flex'},literals:{width:'40px',height:'12px'}}}});
 const layout={display:'flex',direction:vertical?'column':'row'};
 const parent=ContractSchema.parse({...base,id:'test.track-host',name:'TrackHost',anatomy:{root:{layout,literals:definite?{width:'404px',height:'80px'}:undefined,parts:{carrier:{layout:{...layout,grow:true},parts:{pinned:{layout,declared:{position:'absolute'},literals:vertical?{top:'0px',bottom:'0px',left:'0px',width:'12px'}:{left:'0px',right:'0px',top:'0px',height:'12px'},parts:{track:{component:{id:child.id},layout:{grow:true}}}}}}}}}});
 return {parent,child,contracts:new Map([[child.id,child],[parent.id,parent]])};
}
for(const vertical of [false,true])test(`edge-pinned ${vertical?'height':'width'} allocation reaches nested instances`,async()=>{
 const {parent,child,contracts}=fixture(vertical),engine=createFigmaEngine({tokens,icons:new Map()});
 const data=engine.compileComponentData(parent,contracts),pinned=data.variants[0].spec.children![0].children![0],instance=pinned.children![0];
 assert.equal(vertical?instance.fillH:instance.fillW,true);
 const {figma,root}=createFigmaMock(),context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const run=(script:string)=>vm.runInContext(`(async()=>{${script}\n})()`,context,{timeout:20000});
 await run(engine.buildTokensScript(null));await run(engine.buildComponentScript(child,contracts));await run(engine.buildComponentScript(parent,contracts));
 const actual:any=root.findOne((n:any)=>n.type==='COMPONENT'&&n.getSharedPluginData('ds_contracts','contractId')===parent.id);
 const wrapper=actual.children[0].children[0],nested=wrapper.children[0];
 assert.equal(wrapper.primaryAxisSizingMode,'FIXED');
 assert.equal(vertical?nested.layoutSizingVertical:nested.layoutSizingHorizontal,'FILL');
 assert.equal(vertical?nested.height:nested.width,vertical?80:404);
});
test('absolute pins under an indefinite parent do not authorize descendant fill',()=>{
 for(const vertical of [false,true]){const {parent,contracts}=fixture(vertical,false),engine=createFigmaEngine({tokens,icons:new Map()});
 const child=engine.compileComponentData(parent,contracts).variants[0].spec.children![0].children![0].children![0];
 assert.equal(vertical?child.fillH:child.fillW,undefined);
 }
});
