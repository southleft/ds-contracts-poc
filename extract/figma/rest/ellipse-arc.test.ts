import assert from 'node:assert/strict';
import test from 'node:test';
import {mapRestToDump,type RestNode} from './map.js';
import type {DumpSet} from '../types.js';
function capture(arcData?:RestNode['arcData'],strokeCap?:string) {
 const node:RestNode={id:'1:3',name:'Range',type:'ELLIPSE',arcData,strokeCap,absoluteBoundingBox:{x:0,y:0,width:12,height:12},size:{x:12,y:12},fills:[],strokes:[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}],strokeWeight:2,strokeAlign:'INSIDE'};
 const result=mapRestToDump({name:'Arc fixture',nodes:{'1:2':{document:{id:'1:2',name:'Only',type:'COMPONENT',children:[node]}}}} as never);
 return {shape:(result.dump.Only as DumpSet).variants[0].children![0].shape,report:result.report};
}
test('REST retains partial ellipse arc radians and hole fraction at source precision',()=>{
 const arc={startingAngle:0.123456789,endingAngle:3.769911289215088,innerRadius:1};
 assert.deepEqual(capture(arc).shape?.arc,{start:arc.startingAngle,end:arc.endingAngle,innerRadius:1});
 assert.deepEqual(capture({...arc,innerRadius:0.33333333}).shape?.arc,{start:arc.startingAngle,end:arc.endingAngle,innerRadius:0.33333333});
 assert.equal(capture().shape?.arc,undefined);
 assert.equal(capture({startingAngle:0,endingAngle:Math.PI*2,innerRadius:0}).shape?.arc,undefined);
});
test('reader preserves reversed and empty arcs for named proposal qualification, rejects corrupt facts',()=>{
 for(const endingAngle of [0,-1])assert.equal(capture({startingAngle:0,endingAngle,innerRadius:1}).shape?.arc?.end,endingAngle);
 for(const arc of [{startingAngle:NaN,endingAngle:1,innerRadius:1},{startingAngle:0,endingAngle:Infinity,innerRadius:1},{startingAngle:0,endingAngle:1,innerRadius:1.01}]){
  const result=capture(arc);assert.equal(result.shape,undefined);assert.match(JSON.stringify(result.report),/ellipse-arc-invalid/);
 }
});

test('REST preserves explicit standard arc caps without inventing missing cap evidence',()=>{
 for(const cap of ['NONE','ROUND','SQUARE'])assert.equal(capture({startingAngle:0,endingAngle:3,innerRadius:1},cap).shape?.arc?.cap,cap);
 assert.equal(capture({startingAngle:0,endingAngle:3,innerRadius:1}).shape?.arc?.cap,undefined);
});
