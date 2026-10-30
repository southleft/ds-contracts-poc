import {axisReflectedFilledPath} from '../packages/schema/src/axis-reflected-filled-path.js';
import type {DumpNode} from '../extract/figma/types.js';
import {filledPathRigidRotation} from '../packages/schema/src/rigid-filled-path.js';
import {canonicalJson} from './contract-provenance.js';
import {projectAffineFilledPath} from './affine-filled-path.js';

/** The existing SCALE parent proof, shared before any derived path rewrite. */
export function freePathViewport(parent:DumpNode|undefined):DumpNode['bbox']|undefined {
 const box=parent?.bbox;
 const keys=new Set(['name','type','nodeId','componentKey','bbox','children','hidden','clipsContent','fixedSize','targetAspectRatio','sourceEmptyFill','fill','sourceFillComposition','sourceNormalFillComposition','variableConsumers','sourceFillStack','sourceStrokeStack','sourceStrokePattern']);
 const empty={version:1,order:'bottom-to-top',complete:true,paints:[]};
 if(!parent||!box||!Number.isFinite(box.width)||!Number.isFinite(box.height)||box.width<=0||box.height<=0||
    Object.keys(parent).some(key=>!keys.has(key))||
    (parent.sourceFillStack!==undefined&&canonicalJson(parent.sourceFillStack)!==canonicalJson(empty))||
    (parent.sourceStrokeStack!==undefined&&canonicalJson(parent.sourceStrokeStack)!==canonicalJson(empty))||
    (parent.sourceStrokePattern!==undefined&&canonicalJson(parent.sourceStrokePattern)!==canonicalJson({version:1,complete:true,dashes:[],defaulted:true}))||
    (parent.fixedSize!==undefined&&(parent.fixedSize.width!==box.width||parent.fixedSize.height!==box.height))||
    (parent.sourceEmptyFill!==undefined&&(parent.sourceEmptyFill!==true||!!parent.fill||!!parent.sourceNormalFillComposition||!!parent.sourceFillComposition))||
    (parent.targetAspectRatio!==undefined&&(!Number.isFinite(parent.targetAspectRatio.x)||!Number.isFinite(parent.targetAspectRatio.y)||parent.targetAspectRatio.x<=0||parent.targetAspectRatio.y<=0||Math.abs(parent.targetAspectRatio.x/parent.targetAspectRatio.y-box.width/box.height)>1e-6))||
    (parent.clipsContent!==undefined&&typeof parent.clipsContent!=='boolean')||
    !parent.children?.length||parent.children.some(child=>child.shape?.kind!=='path'||child.shape.constraints?.horizontal!=='SCALE'||child.shape.constraints?.vertical!=='SCALE'))return;
 return box;
}

/** A half turn commutes with the separately captured horizontal/vertical
 * SCALE constraints. Lower the exact recorded matrix into derived path data;
 * the caller keeps the original dump, path bytes, and matrix untouched.
 * Other rotations retain their existing explicit refusal. */
export function halfTurnScaledPath(node:DumpNode,parent:DumpNode|undefined):DumpNode['shape']|undefined {
 const sh=node.shape,g=node.localGeometry,box=freePathViewport(parent);
 if(!parent?.nodeId||!node.nodeId||!sh||sh.kind!=='path'||!sh.paths?.length||!g||!box||
    sh.constraints?.horizontal!=='SCALE'||sh.constraints?.vertical!=='SCALE'||
    sh.affineTransform||sh.rotation===undefined||Math.abs(sh.rotation)!==180||
    g.nodeId!==node.nodeId||g.parentId!==parent.nodeId||
    g.localSize.width!==sh.width||g.localSize.height!==sh.height||
    g.parentSize.width!==box.width||g.parentSize.height!==box.height||
    filledPathRigidRotation(g.transform)!==sh.rotation)return undefined;
 const m=g.transform;
 if(Math.abs(m[0][0]+1)>1e-12||Math.abs(m[1][1]+1)>1e-12||Math.abs(m[0][1])>1e-12||Math.abs(m[1][0])>1e-12)return undefined;
 const x=m[0][2]+m[0][0]*sh.width/2+m[0][1]*sh.height/2-sh.width/2;
 const y=m[1][2]+m[1][0]*sh.width/2+m[1][1]*sh.height/2-sh.height/2;
 const near=(a:number|undefined,b:number)=>typeof a==='number'&&Number.isFinite(a)&&Math.abs(a-b)<=1e-9;
 if(!near(sh.x,x)||!near(sh.y,y))return undefined;
 try {
  const projected=projectAffineFilledPath({width:sh.width,height:sh.height,paths:sh.paths,transform:m});
  const {rotation:ignored,...result}=sh;
  return {...result,...projected,right:box.width-projected.x-projected.width,bottom:box.height-projected.y-projected.height};
 }catch{return undefined;}
}

/** Consume only a source-captured signed-axis reflection in a free SCALE
 * parent. The separate affine fact must equal the retained localGeometry. */
export function reflectedScaledPath(node:DumpNode,parent:DumpNode|undefined):DumpNode['shape']|undefined {
 const sh=node.shape,g=node.localGeometry,box=freePathViewport(parent);
 if(!box||!parent?.nodeId||!node.nodeId||!sh||sh.kind!=='path'||!sh.paths?.length||sh.rotation||!g||
    node.mask||node.stroke||node.gradient||node.imageFill||node.imagePaints?.length||node.effects?.length||
    !axisReflectedFilledPath(sh.affineTransform)||canonicalJson(sh.affineTransform)!==canonicalJson(g.transform)||
    g.nodeId!==node.nodeId||g.parentId!==parent.nodeId||g.localSize.width!==sh.width||g.localSize.height!==sh.height||
    g.parentSize.width!==box.width||g.parentSize.height!==box.height)return;
 const m=g.transform,x=m[0][2]+m[0][0]*sh.width/2+m[0][1]*sh.height/2-sh.width/2,
 y=m[1][2]+m[1][0]*sh.width/2+m[1][1]*sh.height/2-sh.height/2;
 if(typeof sh.x!=='number'||typeof sh.y!=='number'||Math.abs(sh.x-x)>1e-9||Math.abs(sh.y-y)>1e-9)return;
 try{const projected=projectAffineFilledPath({width:sh.width,height:sh.height,paths:sh.paths,transform:m});
  const {affineTransform:ignored,...result}=sh;return{...result,...projected,right:box.width-projected.x-projected.width,bottom:box.height-projected.y-projected.height};
 }catch{return;}
}
