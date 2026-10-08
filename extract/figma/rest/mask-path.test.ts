import assert from 'node:assert/strict';
import test from 'node:test';
import {mapRestToDump,type RestNode} from './map.js';
const sample=():RestNode=>({id:'mask',name:'arbitrary label',type:'BOOLEAN_OPERATION',booleanOperation:'SUBTRACT',isMask:true,maskType:'ALPHA',size:{x:24,y:24},absoluteBoundingBox:{x:0,y:0,width:24,height:24},relativeTransform:[[1,0,0],[0,1,0]],constraints:{horizontal:'SCALE',vertical:'SCALE'},fills:[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}],fillGeometry:[{path:'M0 0L24 0L24 24L0 24ZM4 4L20 4L20 20L4 20Z',windingRule:'EVENODD'}],children:[{id:'operand',name:'operand',type:'ELLIPSE',absoluteBoundingBox:{x:0,y:0,width:24,height:24}}]});
function read(node=sample()){
 const root:RestNode={id:'root',name:'Aperture',type:'COMPONENT',absoluteBoundingBox:{x:0,y:0,width:24,height:24},children:[node]};
 const r=mapRestToDump({name:'fixture',nodes:{root:{document:root,components:{}}}});
 return (r.dump.Aperture as any).variants[0].children[0];
}
test('a typed boolean mask retains its exact observed combined paths and operand source facts',()=>{
 const node=sample(),before=JSON.stringify(node),out=read(node);assert.equal(out.shape.kind,'path');assert.deepEqual(out.shape.paths,node.fillGeometry!.map(p=>({data:p.path,windingRule:p.windingRule})));assert.deepEqual(out.mask,{type:'ALPHA'});assert.equal(out.children.length,1);assert.equal(JSON.stringify(node),before);
 node.name='Renamed';assert.deepEqual(read(node).shape,out.shape);
 node.type='VECTOR';delete node.booleanOperation;delete node.children;assert.deepEqual(read(node).shape,out.shape);
});
test('combined mask paths require explicit supported semantics, paint, geometry and transform',()=>{
 const changes:Array<(n:RestNode)=>void>=[n=>{delete n.booleanOperation;},n=>{n.booleanOperation='FUTURE';},n=>{delete n.maskType;},n=>{n.maskType='LUMINANCE';},n=>{n.isMask=false;},n=>{delete n.fillGeometry;},n=>{n.relativeTransform![0][0]=2;},n=>{n.fills!.push(structuredClone(n.fills![0]));},n=>{n.strokes=[{type:'SOLID',color:{r:0,g:0,b:0,a:1}}];},n=>{n.effects=[{type:'DROP_SHADOW',visible:true} as any];}];
 for(const change of changes){const node=sample();change(node);assert.equal(read(node).shape,undefined,String(change));}
});

test('FRAME masks retain observed local sizes and both affine bases without guessing from bounds',()=>{
 const node:RestNode={id:'mask-frame',name:'Frame mask',type:'FRAME',isMask:true,maskType:'ALPHA',size:{x:18,y:7},relativeTransform:[[1,0,2.125],[0,1,4.375]],absoluteBoundingBox:{x:100,y:200,width:19,height:9}};
 const root:RestNode={id:'root',name:'NativePlane',type:'COMPONENT',size:{x:40,y:30},relativeTransform:[[1,0,100],[0,1,200]],children:[node]};
 const run=()=>{const result=mapRestToDump({nodes:{root:{document:root}}});return (result.dump.NativePlane as any).variants[0].children[0];};
 const before=JSON.stringify(root),out=run();
 assert.deepEqual(out.maskFramePlane,{nodeId:'mask-frame',parentId:'root',size:{width:18,height:7},parentSize:{width:40,height:30},relativeTransform:node.relativeTransform,parentRelativeTransform:root.relativeTransform});
 assert.equal(JSON.stringify(root),before);
 node.relativeTransform![0][0]=.5;assert.equal(run().maskFramePlane.relativeTransform[0][0],.5,'capture preserves a nonidentity basis for downstream refusal');
 delete node.size;assert.equal(run().maskFramePlane,undefined,'bbox is not an intrinsic-size substitute');
 node.size={x:18,y:7};delete root.relativeTransform;assert.equal(run().maskFramePlane,undefined,'parent basis is required');
});

test('masked FRAME siblings capture their own affine evidence only after a native mask',()=>{
 const frame:RestNode={id:'paint',name:'Paint',type:'FRAME',size:{x:24,y:24},relativeTransform:[[1,0,.125],[0,1,.375]],absoluteBoundingBox:{x:100,y:200,width:24,height:24}};
 const root:RestNode={id:'root',name:'SiblingPlane',type:'COMPONENT',size:{x:24,y:24},relativeTransform:[[1,0,100],[0,1,200]],children:[sample(),frame]};
 const run=()=>{const r=mapRestToDump({nodes:{root:{document:root}}});return (r.dump.SiblingPlane as any).variants[0].children;};
 const before=JSON.stringify(root);assert.equal(run()[1].maskedFramePlane.nodeId,'paint');assert.equal(run()[1].maskedFramePlane.relativeTransform[0][2],.125);assert.equal(run()[1].maskFramePlane,undefined);assert.equal(JSON.stringify(root),before);
 root.children=[frame,sample()];assert.equal(run()[0].maskedFramePlane,undefined);
 root.children=[sample(),frame];delete frame.relativeTransform;assert.equal(run()[1].maskedFramePlane,undefined);
});
