import test from 'node:test';import assert from 'node:assert/strict';
import {axisReflectedFilledPath} from '../packages/schema/src/axis-reflected-filled-path.js';
import {mapRestToDump} from '../extract/figma/rest/map.js';
import {projectNativeGroupPlanes} from './native-group-plane.js';
import {projectAffineFilledPath} from './affine-filled-path.js';
function fixture(){
 const vector:any={id:'v',name:'Paint',type:'VECTOR',size:{x:12,y:8},relativeTransform:[[1,1.2246468525851679e-16,4],[1.2246468525851679e-16,-1,16]],rotation:1.2246468525851679e-16,absoluteBoundingBox:{x:4,y:8,width:12,height:8},constraints:{horizontal:'SCALE',vertical:'SCALE'},fills:[{type:'SOLID',color:{r:.2,g:.3,b:.4,a:1}}],strokes:[],effects:[],fillGeometry:[{path:'M0 0L12 0L12 8L0 8Z',windingRule:'EVENODD'}]};
 const root:any={id:'root',name:'Reflected',type:'COMPONENT',key:'root-key',size:{x:24,y:24},absoluteBoundingBox:{x:0,y:0,width:24,height:24},fills:[],strokes:[],effects:[],children:[vector]};
 const run=()=>mapRestToDump({name:'probe',nodes:{root:{document:root}}});
 return{vector,root,run};
}
test('mapper preserves exact signed-axis paths before ordinary source-plane projection',()=>{
 const f=fixture(),before=JSON.stringify(f.root),mapped=f.run(),set=mapped.dump.Reflected as any,raw=set.variants[0].children[0];
 assert.deepEqual(raw.shape.paths,f.vector.fillGeometry.map((p:any)=>({data:p.path,windingRule:p.windingRule})));
 assert.deepEqual(raw.shape.affineTransform,f.vector.relativeTransform);assert.equal(raw.shape.rotation,undefined);
 assert.deepEqual(raw.localGeometry.transform,f.vector.relativeTransform);
 const copy=JSON.stringify(set),projected=projectNativeGroupPlanes(set),part=projected.set.variants[0].children![0];
 const want=projectAffineFilledPath({width:12,height:8,paths:raw.shape.paths,transform:f.vector.relativeTransform});
 assert.equal(part.shape?.affineTransform,undefined);assert.deepEqual(part.shape?.paths,want.paths);
 assert.equal(part.shape?.width,want.width);assert.equal(part.shape?.height,want.height);
 assert.equal(JSON.stringify(set),copy);assert.equal(JSON.stringify(f.root),before);
});
test('axis reflection capture refuses scale, shear, non-axis reflection, masks and conflicting rotation',()=>{
 for(const change of [
 (f:any)=>{f.vector.relativeTransform[0][0]=1.01;},(f:any)=>{f.vector.relativeTransform[0][1]=.01;},
 (f:any)=>{f.vector.relativeTransform=[[0,1,0],[1,0,0]];f.vector.rotation=Math.PI/2;},
 (f:any)=>{f.vector.isMask=true;},(f:any)=>{f.vector.rotation=.5;},
 (f:any)=>{f.vector.strokes=[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}];},
 ]){const f=fixture();change(f);const set=f.run().dump.Reflected as any;assert.equal(set.variants[0].children[0].shape,undefined);}
 for(const matrix of [null,[[1,0,0],[0,1,0]],[[2,0,0],[0,-1,0]],[[1,0.0001,0],[0,-1,0]]])assert(!axisReflectedFilledPath(matrix));
});
test('free reflected path refuses changed owner, matrix, paint and constraint facts',()=>{
 for(const change of [
 (n:any,p:any)=>{n.localGeometry.parentId='foreign';},(n:any,p:any)=>{n.shape.affineTransform[0][2]+=1;},
 (n:any,p:any)=>{n.mask={type:'ALPHA'};},(n:any,p:any)=>{n.stroke={hex:'123456'};},
 (n:any,p:any)=>{p.layout={mode:'HORIZONTAL'};},(n:any,p:any)=>{n.shape.constraints.vertical='TOP';},
 (n:any,p:any)=>{p.sourceFillStack={version:1,order:'bottom-to-top',complete:false,paints:[]};},
 ]){const set=fixture().run().dump.Reflected as any;change(set.variants[0].children[0],set.variants[0]);assert.throws(()=>projectNativeGroupPlanes(set),/native-group-plane-unqualified/);}
});
