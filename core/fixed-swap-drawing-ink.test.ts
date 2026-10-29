import test from 'node:test';import assert from 'node:assert/strict';
import {selectedDrawingInkOverride} from './fixed-swap-drawing-ink.js';
const stack=()=>({version:1,order:'bottom-to-top',complete:true,paints:[]});
function fixture(){
 const main:any={name:'Any drawing',type:'COMPONENT',nodeId:'main',componentKey:'drawing-key',sourceEmptyFill:true,sourceFillStack:stack(),sourceStrokeStack:stack(),children:[{name:'Any vector',type:'VECTOR',nodeId:'vector',shape:{kind:'path',paths:[{data:'M0 0L1 0L1 1Z',windingRule:'NONZERO'}]}}]};
 const observed:any={nodeId:'Ihost;slot',componentId:'main',path:[0],selectedRoot:{kind:'selected-slot-root-v1',hostId:'host',parentId:'host',hostMainId:'host-main',componentKey:'drawing-key',fields:['fills']}};
 const target={nodeId:'Ihost;slot;vector',instanceId:'Ihost;slot',componentId:'main',instancePath:[0],childPath:[0]};
 const node:any={name:'Any host',type:'INSTANCE',nodeId:'host',instanceKey:'host-key',instanceGeometry:{nodeId:'host',componentId:'host-main'},instanceRootOverrides:{nodeId:'host',componentId:'host-main'},instanceVectorContent:{source:[{nodeId:'host',componentId:'host-main',key:'host-key'},{nodeId:'Ihost;slot',componentId:'main',key:'drawing-key'}],paint:{hex:'165dff'}},hostOverrides:[{path:'unimportant name',fields:['fills'],sourceFillStack:stack()},{path:'unimportant name/child',fields:['fills','inheritFillStyleId'],fill:{hex:'165dff'},solidFillTarget:target,emptyStrokeTarget:target}]};
 return{main,observed,node};
}
test('selected glyph ink uses typed ownership and complete neutral-root evidence without names',()=>{
 const f=fixture(),before=JSON.stringify(f),h=selectedDrawingInkOverride(f.node,f.observed,f.main,'drawing-key');
 assert.equal(h,f.node.hostOverrides[1]);assert.equal(h?.fill?.hex,'165dff');assert.equal(JSON.stringify(f),before);
 f.node.hostOverrides[0].path='renamed';f.node.hostOverrides[1].path='also renamed';assert(selectedDrawingInkOverride(f.node,f.observed,f.main,'drawing-key'));
});
test('selected glyph ink refuses ambiguous, painted or incomplete roots and mismatched owners',()=>{
 const mutations=[
 (f:any)=>{f.main.sourceFillStack.complete=false;},(f:any)=>{f.main.sourceFillStack.paints=[{}];},
 (f:any)=>{f.main.fill={hex:'abcdef'};},(f:any)=>{f.main.children.push(structuredClone(f.main.children[0]));},
 (f:any)=>{f.node.hostOverrides[0].sourceFillStack.paints=[{}];},(f:any)=>{f.node.hostOverrides[0].fields.push('opacity');},
 (f:any)=>{f.node.hostOverrides[0].opacity=.5;},(f:any)=>{f.node.instanceVectorContent.paint.hex='ffffff';},
 (f:any)=>{f.node.instanceVectorContent.source[1].key='other';},(f:any)=>{f.node.instanceVectorContent.source[1].nodeId='foreign';},
 (f:any)=>{f.observed.selectedRoot.parentId='foreign';},(f:any)=>{f.observed.selectedRoot.fields.push('opacity');},
 (f:any)=>{f.node.hostOverrides[1].solidFillTarget={...f.node.hostOverrides[1].solidFillTarget,childPath:[1]};},
 (f:any)=>{f.node.hostOverrides[1].solidFillTarget={...f.node.hostOverrides[1].solidFillTarget,nodeId:'foreign'};},
 (f:any)=>{f.node.hostOverrides.push(structuredClone(f.node.hostOverrides[0]));},
 ];for(const mutate of mutations){const f=fixture();mutate(f);assert.equal(selectedDrawingInkOverride(f.node,f.observed,f.main,'drawing-key'),undefined);}
});
