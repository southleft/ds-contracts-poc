import test from 'node:test';
import assert from 'node:assert/strict';
import {halfTurnScaledPath} from './scalable-path-source-plane.js';
import {projectAffineFilledPath} from './affine-filled-path.js';
const fixture=()=>{
 const parent:any={name:'Source',type:'COMPONENT',nodeId:'p',bbox:{width:48,height:48}};
 const transform=[[-1,1.2246468525851679e-16,42],[-1.2246468525851679e-16,-1,39]];
 const node:any={name:'Ink',type:'VECTOR',nodeId:'v',localGeometry:{nodeId:'v',parentId:'p',transform,localSize:{width:36,height:30},parentSize:{width:48,height:48}},shape:{kind:'path',width:36,height:30,x:6.0000000000000036,y:9,rotation:-180,constraints:{horizontal:'SCALE',vertical:'SCALE'},paths:[{data:'M0 4L36 4L36 0L0 0Z M0 17C1 17 3 14 20 13Q20 15 0 17Z',windingRule:'EVENODD'}]}};
 parent.children=[node];
 return{node,parent};
};
test('half turn retains exact source matrix projection on the scalable parent plane',()=>{
 const {node,parent}=fixture(),before=JSON.stringify({node,parent}),result=halfTurnScaledPath(node,parent)!;
 assert(result);assert.equal(result.rotation,undefined);
 const expected=projectAffineFilledPath({width:36,height:30,paths:node.shape.paths,transform:node.localGeometry.transform});
 for(const key of ['x','y','width','height','paths'] as const)assert.deepEqual(result[key],expected[key]);
 assert.equal(result.paths!.length,node.shape.paths.length);assert.equal(result.paths![0].windingRule,'EVENODD');
 assert.equal(JSON.stringify({node,parent}),before);
});
test('half turn refuses missing or inconsistent source identity, dimensions, placement and arbitrary affine',()=>{
 const changes=[
 (x:any)=>{delete x.node.localGeometry;},(x:any)=>{x.node.localGeometry.nodeId='other';},
 (x:any)=>{x.node.localGeometry.parentId='other';},(x:any)=>{x.node.localGeometry.parentSize.width=47;},
 (x:any)=>{x.node.localGeometry.localSize.height=29;},(x:any)=>{x.node.shape.x=7;},
 (x:any)=>{x.node.shape.rotation=0;},(x:any)=>{x.node.shape.rotation=90;},
 (x:any)=>{x.node.localGeometry.transform[0][0]=-2;},(x:any)=>{x.node.localGeometry.transform[0][1]=.1;},
 (x:any)=>{x.node.shape.constraints.vertical='TOP';},(x:any)=>{x.parent.layout={};},
 (x:any)=>{x.parent.sourceFillStack={version:1,order:'bottom-to-top',complete:false,paints:[]};},
 (x:any)=>{x.parent.sourceStrokeStack={version:1,order:'bottom-to-top',complete:true,paints:[{}]};},
 (x:any)=>{x.parent.fixedSize={width:49,height:48};},(x:any)=>{x.parent.targetAspectRatio={x:2,y:1};},
 (x:any)=>{x.parent.bbox.width=0;},(x:any)=>{x.parent.unknown=true;},(x:any)=>{x.node.shape.paths[0].data='M0 0A1 1 0 0 0 2 2Z';},
 ];for(const change of changes){const x=fixture();change(x);assert.equal(halfTurnScaledPath(x.node,x.parent),undefined);}
});
