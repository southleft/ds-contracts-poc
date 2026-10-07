import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8');
const text=source.slice(source.indexOf('function dumpNativeFlowGeometry('),source.indexOf('function dumpNativeContainerPlane('));
const capture=new Function(text+'return dumpNativeFlowGeometry;')();
const fixture=()=>({id:'child',type:'FRAME',layoutMode:'HORIZONTAL',width:0.00019999999494757503,height:239.9999542236328,
 relativeTransform:[[0.5973453521728516,-0.8019843697547913,216.23805236816406],[0.8019843697547913,0.5973453521728516,0]],
 parent:{id:'parent',layoutMode:'VERTICAL',width:240,height:143.36302185058594},layoutSizingHorizontal:'FILL',layoutSizingVertical:'FIXED',
 primaryAxisSizingMode:'AUTO',counterAxisSizingMode:'FIXED',layoutGrow:0,layoutAlign:'STRETCH'});
test('rotated flow capture preserves local precision, sizing authority and parent basis without freezing FILL',()=>{
 const n=fixture(),before=JSON.stringify(n),r=capture(n);assert.equal(r.localSize.width,n.width);assert.equal(r.localSize.height,n.height);
 assert.deepEqual(r.relativeTransform,n.relativeTransform);assert.notEqual(r.relativeTransform,n.relativeTransform);assert.equal(r.sizing.horizontal,'FILL');
 assert.equal(r.primarySizing,'AUTO');assert.deepEqual(r.parentSize,{width:240,height:143.36302185058594});assert.equal(JSON.stringify(n),before);
 const extent=Math.abs(r.relativeTransform[1][0])*r.localSize.width+Math.abs(r.relativeTransform[1][1])*r.localSize.height;
 assert(Math.abs(extent-r.parentSize.height)<0.001,'local rotated height explains the parent HUG extent');
});
test('ordinary, absolute, malformed and unrelated boxes do not acquire rotated flow authority',()=>{
 for(const patch of [{type:'INSTANCE'},{layoutMode:'NONE'},{parent:null},{layoutPositioning:'ABSOLUTE'},{width:NaN},{layoutSizingHorizontal:'UNKNOWN'},{primaryAxisSizingMode:undefined},{layoutGrow:NaN},{relativeTransform:[[1,0,0],[0,1,0]]},{relativeTransform:[[1,0,0],[NaN,1,0]]}])assert.equal(capture({...fixture(),...patch}),undefined);
});
