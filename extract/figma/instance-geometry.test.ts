import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {observeInstanceGeometry} from './instance-geometry.js';
import {mapRestToDump} from './rest/map.js';
import {createFigmaMock} from '../../scripts/plugin-engine-mock-figma.mjs';
const source=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8');
const end=source.indexOf('\n}\n',source.indexOf('function observeInstanceGeometry('))+3;
const plugin=vm.runInNewContext(source.slice(0,end)+';observeInstanceGeometry');
const plain=(value:unknown)=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const rows=JSON.parse(readFileSync(new URL('./fixtures/instance-transform.json',import.meta.url),'utf8')).rows;
test('actual instance matrices survive REST capture with no root override authority',()=>{
 for(const row of rows){for(const overrides of [undefined,[],[{id:row.id,overriddenFields:['name']}], [{id:row.id,overriddenFields:['width']},{id:row.id,overriddenFields:['height']}]] ){
  const node={id:row.id,name:row.name,type:'INSTANCE',componentId:row.componentId,relativeTransform:row.matrix,size:row.size,overrides};
  const before=JSON.stringify(node);const result:any=mapRestToDump({nodes:{'parent:1':{document:{id:'parent:1',name:'Probe',type:'COMPONENT',children:[node]}}}} as never);
  const geometry=result.dump.Probe.variants[0].children[0].instanceGeometry;
  assert.deepEqual(geometry,{nodeId:row.id,componentId:row.componentId,transform:row.matrix,localSize:{width:40,height:12}});
  assert.deepEqual(geometry,plain(plugin(row.id,row.componentId,row.matrix,40,12)));
  assert.equal(JSON.stringify(node),before);
 }}
});
test('plugin and REST observe geometry independently of the override list',async()=>{
 const {figma:mock}=createFigmaMock();const figma:any=mock;
 const main=figma.createComponent();const c=figma.createComponent();c.name='GeometryProbe';figma.currentPage.appendChild(main);figma.currentPage.appendChild(c);
 const n=main.createInstance();n.name='Rotated';n.width=40;n.height=12;n.relativeTransform=[[-1,0,40],[0,-1,12]];n.overrides=[];n.rotation=180;c.appendChild(n);
 const script=source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['GeometryProbe'];");
 const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const dump:any=await vm.runInContext(`(async()=>{${script}})()`,context,{timeout:20000});
 assert.deepEqual(plain(dump.GeometryProbe.variants[0].children[0].instanceGeometry),observeInstanceGeometry(n.id,main.id,n.relativeTransform,40,12));
 assert(!dump._degradations?.some((d:any)=>d.code==='rotation-unsupported'));
});
test('invalid observations refuse; valid affine facts are copied without pretending they are rotations',()=>{
 const valid:any[]=['n','c',[[-1,0,40],[0,-1,12]],40,12];
 for(const [index,value] of [[0,''],[1,undefined],[2,[[1,0],[0,1]]],[2,[[1,0,Infinity],[0,1,0]]],[2,[[1,'0',0],[0,1,0]]],[3,0],[4,-1],[4,NaN]] as Array<[number,unknown]>){
  const args=[...valid];args[index]=value;
  assert.equal(observeInstanceGeometry(...args as [unknown,unknown,unknown,unknown,unknown]),undefined);
  assert.equal(plugin(...args),undefined);
 }
 for(const matrix of [[[0,-1,12],[1,0,0]],[[1,0,0],[0,-1,12]],[[2,.25,3],[0,1,4]]]){
  const got=observeInstanceGeometry('n','c',matrix,40,12)!;assert.deepEqual(got.transform,matrix);assert.notEqual(got.transform,matrix);assert.deepEqual(got,plain(plugin('n','c',matrix,40,12)));
 }
});

test('rotation loss receipts remain only when instance geometry could not be observed',()=>{
 for(const captured of [true,false]){
  const node={id:'n',name:'Rotated',type:'INSTANCE',componentId:'main',rotation:Math.PI,
   relativeTransform:[[-1,0,40],[0,-1,12]],...(captured?{size:{x:40,y:12}}:{})};
  const result=mapRestToDump({nodes:{parent:{document:{id:'parent',name:'Probe',type:'COMPONENT',children:[node]}}}} as never);
  assert.equal(result.report.degradations.some(d=>d.code==='rotation-unsupported'),!captured);
 }
});
