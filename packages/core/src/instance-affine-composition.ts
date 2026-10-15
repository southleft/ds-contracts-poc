import {type Contract,type Part} from '@ds-contracts/schema';

export type AffineInstanceComposition={width:string;height:string;color?:string};

/** Explicit local-box inputs can compose with an affine allocation. This is
 * structural eligibility only; every token scope and observed row must still
 * prove that these effective dimensions equal the captured local dimensions. */
export function affineInstanceComposition(child:Contract,part:Part):AffineInstanceComposition|undefined {
 const root=child.anatomy.root,ref=part.component;
 if(!root||!ref||Object.keys(child.anatomy).length!==1||!['div','span'].includes(child.semantics.element)||
    child.bindings.code.runtime||child.props.length||child.states.length||child.a11y?.minHitArea)return;
 const semantic=ref.overrides??{},explicit=ref.rootOverrides??{},keys=Object.keys(semantic),dimensions=Object.keys(explicit);
 if(!keys.length&&!dimensions.length)return;
 if(keys.some(key=>!['size','color'].includes(key)||!root.overridable?.includes(key as 'size'|'color'))||
    dimensions.some(key=>!['width','height'].includes(key)||!root.instanceRootInputs?.includes(key as 'width'|'height'))||
    semantic.size&&dimensions.length||dimensions.length!==0&&dimensions.length!==2||ref.rootFill?.length)return;
 const allowed=new Set(['tokens','literals','declared','parts','overridable','instanceRootInputs']);
 if(Object.keys(root).some(key=>!allowed.has(key)))return;
 for(const holder of [root.tokens,root.literals])if(Object.keys(holder??{}).some(key=>!['width','height','color','background-color','opacity'].includes(key)))return;
 if(Object.entries(root.declared??{}).some(([key,value])=>key==='position'?value!=='relative':!['overflow-x','overflow-y'].includes(key)||value!=='hidden'))return;
 if(['width','height'].some(axis=>root.tokens?.[axis]!==undefined&&root.literals?.[axis]!==undefined))return;
 if(semantic.size||semantic.color){
  // These are the same filled-path size/ink capabilities used by the native
  // instance writer. Other semantic paint/geometry is deliberately excluded.
  const paths=Object.values(root.parts??{}),path=paths[0];
  if(paths.length!==1||!path||path.shape?.kind!=='path'||!path.shape.parentViewport||path.shape.rotation||path.shape.pathsByProp||
     Object.keys(path).some(key=>!['shape','literals','declared','tokens'].includes(key))||Object.keys(path.tokens??{}).length||
     Object.keys(path.literals??{}).some(key=>key!=='background-color')||path.literals?.['background-color']!=='currentColor'||
     Object.entries(path.declared??{}).some(([key,value])=>key!=='position'||value!=='absolute'))return;
 }
 const width=semantic.size??explicit.width??root.tokens?.width??root.literals?.width;
 const height=semantic.size??explicit.height??root.tokens?.height??root.literals?.height;
 if(typeof width!=='string'||typeof height!=='string')return;
 return {width,height,...(semantic.color?{color:semantic.color}:{})};
}
