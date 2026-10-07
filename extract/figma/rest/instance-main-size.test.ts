import test from 'node:test';
import assert from 'node:assert/strict';
import {mapRestToDump} from './map.js';
function fixture(){
 const main:any={id:'main',name:'Main',type:'COMPONENT',size:{x:24,y:32},children:[]};
 const use:any={id:'use',name:'Use',type:'INSTANCE',componentId:'main',overrides:[],size:{x:24,y:32},relativeTransform:[[1,0,0],[0,1,0]],children:[]};
 const response:any={nodes:{main:{document:main},parent:{document:{id:'parent',name:'Parent',type:'COMPONENT',children:[use]},components:{main:{name:'Main',key:'main-key'}}}}};
 const read=()=>((mapRestToDump(response).dump as any).Parent.variants[0].children[0].instanceRootOverrides);
 return {main,use,response,read};
}
test('REST captures referenced main local dimensions independently of empty root overrides',()=>{
 const f=fixture();assert.deepEqual(f.read().mainSize,{width:24,height:32});assert.deepEqual(f.read().fields,[]);assert.equal(f.read().localSize,undefined);
});
test('missing local main dimensions and contradictory main records cannot supply defaults',()=>{
 const f=fixture();delete f.main.size;f.main.absoluteBoundingBox={x:0,y:0,width:24,height:32};assert.equal(f.read().mainSize,undefined);
 const g=fixture();g.response.nodes.duplicate={document:{...g.main,size:{x:25,y:32}}};assert.equal(g.read().mainSize,undefined);
 const h=fixture();delete h.use.overrides;assert.equal(h.read(),undefined);
});
