import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {mapRestToDump,type RestNode} from './map.js';
import {MaskSchema} from '../../../packages/schema/src/contract-schema.js';
import {reactMaskChildren} from '../../../core/react-mask-scopes.js';
const source=()=>JSON.parse(readFileSync(new URL('./painted-stroke-mask.fixture.json',import.meta.url),'utf8'));
function read(n=source()){
 const root:RestNode={id:'root',name:'Mask carrier',type:'COMPONENT',size:{x:18,y:18},absoluteBoundingBox:{x:0,y:0,width:18,height:18},relativeTransform:[[1,0,0],[0,1,0]],children:[n]};
 return (mapRestToDump({name:'source',version:'exact',nodes:{root:{document:root,components:{}}}},{fileKey:'source'}).dump['Mask carrier'] as any).variants[0].children[0];
}
test('original painted stroke and interior paths carry without guessed native stroke metadata',()=>{
 const n=source(),before=JSON.stringify(n),out=read(n);
 assert.equal(out.mask.stroke,undefined);assert.deepEqual(out.mask.paintedStroke.paths,n.strokeGeometry.map((p:any)=>({data:p.path,windingRule:p.windingRule})));
 assert.deepEqual(out.shape.paths,n.fillGeometry.map((p:any)=>({data:p.path,windingRule:p.windingRule})));
 assert.equal(JSON.stringify(n),before);assert(MaskSchema.safeParse(out.mask).success);
});
test('invalid or uncarried source paint cannot become a painted stroke mask',()=>{
 const changes=[(n:any)=>n.strokes[0].opacity=.5,(n:any)=>n.opacity=.5,(n:any)=>n.strokes.push(n.strokes[0]),(n:any)=>n.fills[0].visible=true,(n:any)=>n.strokes[0].boundVariables={color:{id:'foreign'}},(n:any)=>n.boundVariables={strokeWeight:{id:'foreign'}},(n:any)=>n.strokeAlign='CENTER',(n:any)=>n.strokeGeometry[0].path='M0 0L18 18',(n:any)=>n.strokeGeometry[0].windingRule='NONE',(n:any)=>n.maskType='LUMINANCE'];
 for(const change of changes){const n=source();change(n);assert.equal(read(n).mask.paintedStroke,undefined,String(change));}
 const mask=read().mask;assert(!MaskSchema.safeParse({...mask,type:'VECTOR'}).success);
 assert(!MaskSchema.safeParse({...mask,stroke:{align:'INSIDE',weight:5,color:{r:0,g:0,b:0},cap:'NONE',join:'MITER',miterLimit:4}}).success);
});
test('React mask scope intersects observed stroke ink with its exact interior and owns following siblings',()=>{
 const out=read(),geometry={box:{x:0,y:0,width:18,height:18,right:0,bottom:0,constraints:{horizontal:'SCALE' as const,vertical:'SCALE' as const}},parent:{width:18,height:18},border:{left:0,right:0,top:0,bottom:0}};
 const result=reactMaskChildren({aperture:{mask:out.mask,shape:out.shape,absoluteGeometry:geometry},paint:{absoluteGeometry:geometry}},name=>`<div>${name}</div>`).join('');
 assert(result.includes('data-ds-mask-scope="aperture"'));assert(result.includes('<div>paint</div>'));
 const decoded=decodeURIComponent(result.match(/data:image\/svg\+xml,([^"]+)/)![1]!);assert(decoded.includes('<clipPath'));assert(decoded.includes('clip-path'));assert(decoded.includes(out.mask.paintedStroke.paths[0].data));assert(!decoded.includes('stroke-miterlimit'));
});
