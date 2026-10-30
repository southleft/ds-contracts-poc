import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {mapRestToDump, type RestNode} from './map.js';
import {filledPathRigidRotation} from '../../../packages/schema/src/rigid-filled-path.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/arco-menu-rotated-filled-paths.json', import.meta.url),'utf8'));
function capture(parent: RestNode) {
  // Only this outer component is synthetic. Each complete source parent and
  // its children are cloned verbatim from the original frozen REST response.
  return mapRestToDump({name:'probe',nodes:{root:{document:{id:'root',name:'RotationProbe',type:'COMPONENT_SET',children:[{
    id:'case',name:'Case=Original',type:'COMPONENT',size:{x:40,y:40},
    absoluteBoundingBox:{x:0,y:0,width:40,height:40},children:[parent],
  }]}}}});
}
const drawing = (result: ReturnType<typeof capture>, id: string): any => {
  let found:any;
  const visit=(value:any)=>{if(value?.nodeId===id)found=value;for(const child of value?.children??[])visit(child);};
  visit((result.dump.RotationProbe as any).variants[0]);return found;
};
const first = () => structuredClone(fixture.parents[0]);

test('all 20 original Arco arrows retain exact paths, local size and center-origin rotation',()=>{
  assert.equal(fixture.parents.length,20);
  for(const row of fixture.parents){
    const parent:RestNode=structuredClone(row.parent), before=structuredClone(parent);
    const arrow=parent.children!.find(n=>n.id===row.arrowId)!;
    const result=capture(parent), actual=drawing(result,arrow.id), shape=actual.shape;
    assert.ok(shape,arrow.id);assert.equal(shape.kind,'path');
    assert.deepEqual(shape.paths,arrow.fillGeometry!.map(p=>({data:p.path,windingRule:p.windingRule})));
    assert.equal(shape.width,arrow.size!.x);assert.equal(shape.height,arrow.size!.y);
    const [[a,c,tx],[b,d,ty]]=arrow.relativeTransform!;
    assert.equal(shape.rotation,Math.atan2(b,a)*180/Math.PI);
    assert.notEqual(shape.rotation,90,'do not round the source angle');
    assert.equal(shape.x,tx+a*shape.width/2+c*shape.height/2-shape.width/2);
    assert.equal(shape.y,ty+b*shape.width/2+d*shape.height/2-shape.height/2);
    assert.equal(shape.right,parent.size!.x-shape.x-shape.width);
    assert.equal(shape.bottom,parent.size!.y-shape.y-shape.height);
    assert.deepEqual(actual.localGeometry.transform,arrow.relativeTransform);
    assert.deepEqual(actual.localGeometry.localSize,{width:arrow.size!.x,height:arrow.size!.y});
    assert.deepEqual(actual.localGeometry.parentSize,{width:8,height:40});
    assert.deepEqual(shape.constraints,{horizontal:'CENTER',vertical:'CENTER'});
    assert.ok(!result.report.degradations.some(v=>v.nodePath.endsWith('/arrow') &&
      ['vector-geometry-unsupported','rotation-unsupported'].includes(v.code)),JSON.stringify(result.report.degradations));
    const angle=shape.rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    for(const [x,y] of [[0,0],[shape.width,0],[0,shape.height],[shape.width,shape.height]]){
      const cssX=shape.x+shape.width/2+cos*(x-shape.width/2)-sin*(y-shape.height/2);
      const cssY=shape.y+shape.height/2+sin*(x-shape.width/2)+cos*(y-shape.height/2);
      assert.ok(Math.abs(cssX-(a*x+c*y+tx))<1e-11,'x origin/sign');
      assert.ok(Math.abs(cssY-(b*x+d*y+ty))<1e-11,'y origin/sign');
    }
    assert.deepEqual(parent,before,'mapping must not rewrite captured input');
  }
});

test('scale, shear, reflection, malformed matrices and conflicting rotation remain refused',()=>{
  const changes:Array<(n:RestNode)=>void>=[
    n=>{n.relativeTransform![0][0]+=0.1;},n=>{n.relativeTransform![0][1]=-2;},
    n=>{n.relativeTransform![1][0]=-1;},n=>{n.relativeTransform![0][2]=NaN;},
    n=>{n.relativeTransform=[[0,-1],[1,0]];},n=>{n.rotation=0;},
    n=>{n.rotation=90;},n=>{n.relativeTransform![0][1]-=1e-10;},
  ];
  for(const change of changes){const row=first(),n=row.parent.children[0];change(n);
    const result=capture(row.parent);assert.equal(drawing(result,n.id).shape,undefined);
    assert.ok(result.report.degradations.some(d=>d.code==='vector-geometry-unsupported'));
  }
});

test('rotation does not admit masks, extra paints, strokes, effects or unsupported path syntax',()=>{
  const changes:Array<(n:RestNode)=>void>=[
    n=>{n.isMask=true;n.maskType='ALPHA';},n=>{n.isMask=true;n.maskType='VECTOR';},
    n=>{n.fills!.push(structuredClone(n.fills![0]));},n=>{n.fills![0].type='GRADIENT_LINEAR';},
    n=>{n.strokes=[structuredClone(n.fills![0])];},n=>{n.effects=[{type:'DROP_SHADOW'}];},
    n=>{n.blendMode='MULTIPLY';},n=>{n.cornerRadius=1;},
    n=>{n.fillGeometry![0].path='M0 0A1 1 0 0 0 1 1Z';},
    n=>{n.fillGeometry!.push({path:'M0 0Z',windingRule:'NONZERO'});},
    n=>{n.children=[{id:'extra',name:'extra',type:'RECTANGLE'}];},
  ];
  for(const change of changes){const row=first(),n=row.parent.children[0];change(n);
    assert.equal(drawing(capture(row.parent),n.id).shape,undefined);
  }
});

test('local parent size is required; world bounds are not geometry or allocation evidence',()=>{
  for(const change of [(p:any)=>{delete p.size;},(p:any)=>{p.size.x=0;},(p:any)=>{p.type='GROUP';}]){
    const row=first();change(row.parent);assert.equal(drawing(capture(row.parent),row.arrowId).shape,undefined);
  }
  const row=first(),expected=drawing(capture(row.parent),row.arrowId).shape;
  delete row.parent.absoluteBoundingBox;delete row.parent.children[0].absoluteBoundingBox;
  const shape=drawing(capture(row.parent),row.arrowId).shape;
  assert.ok(shape);assert.deepEqual(shape,expected);
});

test('in-flow rotation is refused while an explicit absolute allocation remains representable',()=>{
  const row=first();row.parent.layoutMode='HORIZONTAL';
  assert.equal(drawing(capture(row.parent),row.arrowId).shape,undefined);
  row.parent.children[0].layoutPositioning='ABSOLUTE';
  assert.ok(drawing(capture(row.parent),row.arrowId).shape);
});

test('rigid rotation qualification is general, bounded and does not quantize angles',()=>{
  for(const degrees of [-135,-90,-30,17.123456789,90,180]){
    const rad=degrees*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),m=[[c,-s,2.125],[s,c,-7.25]];
    assert.equal(filledPathRigidRotation(m,rad),Math.atan2(s,c)*180/Math.PI);
  }
  for(const m of [null,[[1,0,0],[0,1,Infinity]],[[1.000001,0,0],[0,1,0]],[[1,0.001,0],[0,1,0]],[[1,0,0],[0,-1,0]]])
    assert.equal(filledPathRigidRotation(m),undefined);
});

test('the existing identity-path representation remains byte-for-value unchanged',()=>{
  const row=first(),n=row.parent.children[0];n.relativeTransform=[[1,0,2.742499828338623],[0,1,4.242500305175781]];n.rotation=0;
  const s=drawing(capture(row.parent),row.arrowId).shape;
  assert.equal(s.rotation,undefined);assert.equal(s.x,2.742499828338623);assert.equal(s.y,4.242500305175781);
  assert.equal(s.right,row.parent.absoluteBoundingBox.width-s.x-s.width);
  assert.equal(s.bottom,row.parent.absoluteBoundingBox.height-s.y-s.height);
});
