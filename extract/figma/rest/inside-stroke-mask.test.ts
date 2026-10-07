import assert from 'node:assert/strict';
import test from 'node:test';
import {mapRestToDump,type RestNode,type MapOptions} from './map.js';
const sample=():RestNode=>({id:'mask',name:'arbitrary label',type:'VECTOR',isMask:true,maskType:'ALPHA',size:{x:18,y:18},absoluteBoundingBox:{x:0,y:0,width:18,height:18},relativeTransform:[[1,0,0],[0,1,0]],constraints:{horizontal:'SCALE',vertical:'SCALE'},fills:[{type:'SOLID',visible:false,color:{r:0,g:0,b:1,a:1}}],strokes:[{type:'SOLID',color:{r:0.1,g:0.2,b:0.3,a:1},opacity:1,blendMode:'NORMAL'}],strokeWeight:5,strokeAlign:'INSIDE',strokeCap:'NONE',strokeJoin:'MITER',fillGeometry:[{path:'M0 18L9 0L18 18Z',windingRule:'NONZERO'}]});
const options=():MapOptions=>({fileKey:'owned-fixture',nativeMaskStrokeSources:{fileKey:'owned-fixture',version:'captured-version',miterLimitByNodeId:{mask:4}}});
function read(node=sample(),opts=options()){
 const root:RestNode={id:'root',name:'Aperture',type:'COMPONENT',absoluteBoundingBox:{x:0,y:0,width:18,height:18},children:[node]};
 const result=mapRestToDump({name:'fixture',version:'captured-version',nodes:{root:{document:root,components:{}}}},opts);
 return {node:(result.dump.Aperture as any).variants[0].children[0],report:result.report};
}
test('closed INSIDE stroke masks preserve literal native stroke and original path without painting hidden fill',()=>{
 const original=sample(),before=JSON.stringify(original),{node}=read(original);
 assert.deepEqual(node.mask,{type:'ALPHA',stroke:{align:'INSIDE',weight:5,color:{r:0.1,g:0.2,b:0.3},cap:'NONE',join:'MITER',miterLimit:4}});
 assert.equal(node.fill,undefined);assert.equal(node.shape.kind,'path');assert.equal(node.shape.paths[0].data,original.fillGeometry![0].path);assert.equal(JSON.stringify(original),before);
 original.name='Renamed';assert.deepEqual(read(original).node.mask,node.mask);
});
test('native miter evidence must identify the same file version and actual node',()=>{
 for(const change of [(o:MapOptions)=>{delete o.nativeMaskStrokeSources;},(o:MapOptions)=>{o.nativeMaskStrokeSources!.fileKey='different';},(o:MapOptions)=>{o.nativeMaskStrokeSources!.version='old';},(o:MapOptions)=>{o.nativeMaskStrokeSources!.miterLimitByNodeId={other:4};}]){
  const opts=options();change(opts);const {node}=read(sample(),opts);assert.equal(node.mask.stroke,undefined);assert.equal(node.shape,undefined);
 }
});
test('unqualified source paint, bindings and outlines cannot become the literal INSIDE stroke carrier',()=>{
 const changes:Array<(n:RestNode)=>void>=[n=>{n.fills![0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'hidden-color'}};},n=>{n.boundVariables={strokeWeight:{type:'VARIABLE_ALIAS',id:'weight'}};},n=>{n.strokes![0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'color'}};},n=>{n.strokes![0].opacity=0.5;},n=>{n.opacity=0.5;},n=>{n.strokes!.push(structuredClone(n.strokes![0]));},n=>{n.strokeAlign='CENTER';},n=>{n.strokeDashes=[2,2];},n=>{n.maskType='LUMINANCE';},n=>{n.fills![0].visible=true;},n=>{n.effects=[{type:'DROP_SHADOW',visible:true} as any];}];
 for(const change of changes){const n=sample();change(n);const out=read(n).node;assert.equal(out.mask.stroke,undefined,String(change));assert.equal(out.shape,undefined,String(change));}
 const open=sample();open.fillGeometry![0].path='M0 18L9 0L18 18';assert.equal(read(open).node.shape,undefined);
});


test('complete native plugin reader carries the mask path and stroke without scope or source mutation',async()=>{
 const vm=await import('node:vm'),{readFileSync}=await import('node:fs');
 const {createFigmaMock}=await import('../../../scripts/plugin-engine-mock-figma.mjs');
 const {figma:mock}=createFigmaMock(),figma:any=mock;
 const c=figma.createComponent();c.name='Default';c.resize(18,18);c.layoutMode='NONE';
 const native=sample(),mask=figma.createRectangle();mask.type='VECTOR';mask.name='arbitrary label';mask.resize(18,18);
 Object.assign(mask,{isMask:true,maskType:'ALPHA',fills:native.fills,strokes:native.strokes,strokeWeight:5,strokeAlign:'INSIDE',strokeCap:'NONE',strokeJoin:'MITER',strokeMiterLimit:4,dashPattern:[],relativeTransform:[[1,0,0],[0,1,0]],vectorPaths:[{data:native.fillGeometry![0].path,windingRule:'NONZERO'}],constraints:{horizontal:'SCALE',vertical:'SCALE'}});
 c.appendChild(mask);const paint=figma.createRectangle();paint.name='paint';paint.resize(18,18);c.appendChild(paint);
 const set=figma.combineAsVariants([c],figma.currentPage);set.name='Aperture';
 const source=readFileSync(new URL('../dump.plugin.js',import.meta.url),'utf8').replace(/^const TARGET_SETS = \[[^\n]*\];$/m,"const TARGET_SETS = ['Aperture'];");
 const run=async()=>JSON.parse(JSON.stringify(await vm.runInNewContext(`(async()=>{${source}})()`,{figma,console:{log(){},warn(){},error(){}}},{timeout:20000})));
 const before=JSON.stringify(mask.vectorPaths),dump=await run(),out=dump.Aperture.variants[0].children[0];
 assert.deepEqual(out.mask,read().node.mask);assert.deepEqual(out.shape.paths,[{data:native.fillGeometry![0].path,windingRule:'NONZERO'}]);assert.equal(JSON.stringify(mask.vectorPaths),before);assert.equal(out.fill,undefined);assert.equal(out.stroke,undefined);
 assert.equal(dump.Aperture.variants[0].children[1].name,'paint');
 assert(!dump._degradations.some((d:any)=>['vector-mask-unsupported','vector-geometry-unsupported'].includes(d.code)));
 mask.fills[0].boundVariables={color:{type:'VARIABLE_ALIAS',id:'hidden-color'}};
 const refused=await run();assert.equal(refused.Aperture.variants[0].children[0].mask.stroke,undefined);assert.equal(refused.Aperture.variants[0].children[0].shape,undefined);
});


test('native path witness is authoritative only for its unchanged REST node dimensions and response',()=>{
 const n=sample(),opts=options(),exact='M0 18L9.0000001 0L18 18Z';
 opts.nativeMaskStrokeSources!.pathWitnessByNodeId={mask:{width:18,height:18,restPaths:structuredClone(n.fillGeometry!),nativePaths:[{data:exact,windingRule:'NONZERO'}]}};
 const before=JSON.stringify(n);assert.equal(read(n,opts).node.shape.paths[0].data,exact);assert.equal(JSON.stringify(n),before);
 for(const mutate of [(v:any)=>v.size.x=19,(v:any)=>v.fillGeometry[0].path='M0 18L8 0L18 18Z']){const changed=structuredClone(n);mutate(changed);assert.equal(read(changed,opts).node.shape,undefined);}
 opts.nativeMaskStrokeSources!.pathWitnessByNodeId.mask.nativePaths[0].data='M0 0L18 18';assert.equal(read(n,opts).node.shape,undefined);
});

test('missing REST cap and join require exact native facts, and conflicting REST stroke refuses',()=>{
 const n=sample(),opts=options();opts.nativeMaskStrokeSources!.strokeByNodeId={mask:read().node.mask.stroke};delete n.strokeCap;delete n.strokeJoin;assert(read(n,opts).node.shape);n.strokeCap='ROUND';assert.equal(read(n,opts).node.shape,undefined);
});
