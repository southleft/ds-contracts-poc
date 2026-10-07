import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import type {DumpSet} from './types.js';
import {observeLocalGeometry} from './local-geometry.js';
import {mapRestToDump} from './rest/map.js';
import {createFigmaMock} from '../../scripts/plugin-engine-mock-figma.mjs';
const source=readFileSync(new URL('./dump.plugin.js',import.meta.url),'utf8');
const end=source.indexOf('\n}\n',source.indexOf('function observeLocalGeometry('))+3;
const plugin=vm.runInNewContext(source.slice(0,end)+';observeLocalGeometry');
const plain=(v:unknown)=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const observed=JSON.parse(readFileSync(new URL('../../core/fixtures/rotated-spinner-local-plane-966.json',import.meta.url),'utf8'));
function fixture(){
 const [root,,frame,ink]=observed;
 const rest=(n:any)=>({id:n.id,name:n.name,type:n.type,size:{x:n.width,y:n.height},relativeTransform:n.relativeTransform,absoluteBoundingBox:n.bounds,rotation:-n.rotation*Math.PI/180});
 const child={...rest(ink),children:[]},owner={...rest(frame),children:[child]},document={...rest(root),name:'LocalGeometryProbe',children:[owner]};
 const response:any={nodes:{[root.id]:{document}}};
 return{child,owner,document,response,read:()=>(mapRestToDump(response).dump.LocalGeometryProbe as DumpSet).variants[0].children![0]};
}
test('REST keeps rotated frame and descendant local coordinates independently of world bounds',()=>{
 const f=fixture(),before=JSON.stringify(f.response),n=f.read(),child=n.children![0];
 assert.deepEqual(n.localGeometry!.localSize,{width:1.5,height:12});
 assert.deepEqual(child.localGeometry!.localSize,{width:1.5,height:4});
 assert.deepEqual(child.localGeometry!.transform,[[1,0,0],[0,1,0]]);
 assert.equal(child.localGeometry!.parentId,n.nodeId);
 assert.deepEqual(n.localGeometry,plain(plugin(f.owner.id,f.document.id,f.owner.relativeTransform,1.5,12,12,12)));
 assert.equal(JSON.stringify(f.response),before);
 n.localGeometry!.transform[0][0]=9;assert.notEqual(f.owner.relativeTransform[0][0],9);
 // Captured geometry has not yet repaired rotation lowering; keep the warning.
 assert(mapRestToDump(f.response).report.degradations.some(d=>d.code==='rotation-unsupported'));
});
test('bounds cannot stand in for missing local dimensions, parent authority or affine records',()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{delete (f.owner as any).size;},
  (f:ReturnType<typeof fixture>)=>{delete (f.document as any).size;},
  (f:ReturnType<typeof fixture>)=>{f.owner.relativeTransform=[[1,0,Infinity],[0,1,0]];},
 ]){const f=fixture();mutate(f);assert.equal(f.read().localGeometry,undefined);}
 for(const matrix of [[[2,.2,4],[0,1,3]],[[-1,0,5],[0,1,0]]]){
  assert.deepEqual(observeLocalGeometry('child','parent',matrix,1.5,12,12,12)?.transform,matrix);
  assert.deepEqual(plain(plugin('child','parent',matrix,1.5,12,12,12)),observeLocalGeometry('child','parent',matrix,1.5,12,12,12));
 }
});
test('full plugin dump retains the rotated frame and ink parent chain',async()=>{
 const {figma:mock}=createFigmaMock(),figma:any=mock,root=figma.createComponent();root.name='LocalGeometryProbe';figma.currentPage.appendChild(root);root.resize(12,12);
 const frame=figma.createFrame();root.appendChild(frame);frame.name='rotated';frame.resize(1.5,12);frame.relativeTransform=observed[2].relativeTransform;frame.rotation=-45;
 const ink=figma.createRectangle();frame.appendChild(ink);ink.resize(1.5,4);ink.relativeTransform=[[1,0,0],[0,1,0]];
 const script=source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['LocalGeometryProbe'];");
 const context=vm.createContext({figma,console:{log(){},warn(){},error(){}}});
 const dump:any=await vm.runInContext(`(async()=>{${script}})()`,context,{timeout:20000});
 const n=dump.LocalGeometryProbe.variants[0].children[0];
 assert.deepEqual(plain(n.localGeometry),observeLocalGeometry(frame.id,root.id,frame.relativeTransform,1.5,12,12,12));
 assert.deepEqual(plain(n.children[0].localGeometry),observeLocalGeometry(ink.id,frame.id,ink.relativeTransform,1.5,4,1.5,12));
});
