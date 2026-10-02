export type HorizontalConstraint = 'LEFT' | 'RIGHT' | 'CENTER' | 'STRETCH' | 'SCALE';
export type VerticalConstraint = 'TOP' | 'BOTTOM' | 'CENTER' | 'STRETCH' | 'SCALE';
export interface AbsoluteGeometryBox {
  x: number; y: number; width: number; height: number; right: number; bottom: number;
  constraints: { horizontal: HorizontalConstraint; vertical: VerticalConstraint };
}
export interface AbsoluteGeometryInput {
  box: AbsoluteGeometryBox;
  parent: { width: number; height: number };
  border?: { left: number; right: number; top: number; bottom: number };
  synthetic?: boolean;
  boundSize?: Partial<Record<'width' | 'height', boolean>>;
}

/** Shared geometry normalization. Source occurrence/binding qualification is a caller obligation.
 * Native rectangles use the parent's border edge. CSS positioned percentages
 * use its padding box. Preserve the measured constraint on each axis. */
export function normalizeAbsoluteGeometry({box,parent,border={left:0,right:0,top:0,bottom:0},synthetic=false,boundSize={}}: AbsoluteGeometryInput) {
 if(synthetic)throw Error('absolute-placement-synthetic-observation');
 for(const key of ['x','y','width','height','right','bottom'] as const)if(!Number.isFinite(box[key]))throw Error('absolute-placement-box-unqualified');
 for(const key of ['width','height'] as const)if(!Number.isFinite(parent[key])||parent[key]<=0)throw Error('absolute-placement-parent-unqualified');
 for(const key of ['left','right','top','bottom'] as const)if(!Number.isFinite(border[key])||border[key]<0)throw Error('absolute-placement-border-unqualified');
 if(box.width<0||box.height<0)throw Error('absolute-placement-negative-extent');
 if(Math.abs(box.x+box.width+box.right-parent.width)>.05||Math.abs(box.y+box.height+box.bottom-parent.height)>.05)throw Error('absolute-placement-parent-inconsistent');
 if(parent.width<=border.left+border.right||parent.height<=border.top+border.bottom)throw Error('absolute-placement-padding-box-unqualified');
 const css: Record<string, string> = {position:'absolute',boxSizing:'border-box',left:'auto',right:'auto',top:'auto',bottom:'auto',width:'auto',height:'auto'};
 const num=(n: number)=>String(Object.is(n,-0)?0:Number(n.toFixed(12)));
 const px=(n: number)=>num(n)+'px';
 const linear=(ratio: number,offset: number)=>Math.abs(offset)<1e-10?num(100*ratio)+'%':`calc(${num(100*ratio)}% ${offset<0?'-':'+'} ${num(Math.abs(offset))}px)`;
 const axis=(dim: 'width' | 'height',start: 'left' | 'top',end: 'right' | 'bottom',near: 'x' | 'y',far: 'right' | 'bottom',mode: string)=>{
  const extent=box[dim],size=parent[dim],insets=border[start]+border[end];
  if(boundSize[dim])throw Error('absolute-placement-bound-size-needs-owner');
  if(mode==='SCALE'){
   css[start]=linear(box[near]/size,box[near]/size*insets-border[start]);
   css[dim]=linear(extent/size,extent/size*insets);
  }else if(mode==='STRETCH'){
   css[start]=px(box[near]-border[start]);css[end]=px(box[far]-border[end]);
  }else if(mode==='CENTER'){
   const centerResidue=box[near]+extent/2-size/2;
   css[start]=linear(.5,centerResidue-extent/2+insets/2-border[start]);css[dim]=px(extent);
  }else if(mode===(dim==='width'?'LEFT':'TOP')){
   css[start]=px(box[near]-border[start]);css[dim]=px(extent);
  }else if(mode===(dim==='width'?'RIGHT':'BOTTOM')){
   css[end]=px(box[far]-border[end]);css[dim]=px(extent);
  }else throw Error('absolute-placement-constraint-unqualified');
 };
 axis('width','left','right','x','right',box.constraints?.horizontal);
 axis('height','top','bottom','y','bottom',box.constraints?.vertical);
 return{css,native:{x:box.x,y:box.y,width:box.width,height:box.height,constraints:{...box.constraints}},basis:{...parent},border:{...border}};
}

/** Native coordinates use the parent's border box. Re-evaluate after auto
 * layout settles; assigning constraints alone does not resize that child. */
export function resolveNativeAbsoluteGeometry(input: AbsoluteGeometryInput, parent: {width:number;height:number}) {
  if(input.synthetic)throw Error('absolute-placement-synthetic-observation');
  if(input.boundSize?.width || input.boundSize?.height)throw Error('absolute-placement-bound-size-needs-owner');
  if(!Number.isFinite(input.parent.width) || !Number.isFinite(input.parent.height) || input.parent.width<=0 || input.parent.height<=0)throw Error('absolute-placement-parent-unqualified');
  if (!Number.isFinite(parent.width) || !Number.isFinite(parent.height) || parent.width<=0 || parent.height<=0)
    throw Error('absolute-placement-native-parent-unqualified');
  const helpers={axis(start:number,extent:number,far:number,basis:number,size:number,mode:string){
    if(mode==='SCALE')return{start:start*size/basis,extent:extent*size/basis};
    if(mode==='STRETCH')return{start,extent:size-start-far};
    if(mode==='CENTER')return{start:start+(size-basis)/2,extent};
    if(mode==='RIGHT'||mode==='BOTTOM')return{start:size-far-extent,extent};
    if(mode==='LEFT'||mode==='TOP')return{start,extent};
    throw Error('absolute-placement-constraint-unqualified');
  },nativeMode(mode:string){return mode==='LEFT'||mode==='TOP'?'MIN':mode==='RIGHT'||mode==='BOTTOM'?'MAX':mode;}};
  const b=input.box,h=helpers.axis(b.x,b.width,b.right,input.parent.width,parent.width,b.constraints.horizontal),
    v=helpers.axis(b.y,b.height,b.bottom,input.parent.height,parent.height,b.constraints.vertical);
  if (![h.start,h.extent,v.start,v.extent].every(Number.isFinite) || h.extent<0 || v.extent<0)
    throw Error('absolute-placement-native-extent-unqualified');
  return{x:h.start,y:v.start,width:h.extent,height:v.extent,
    constraints:{horizontal:helpers.nativeMode(b.constraints.horizontal),vertical:helpers.nativeMode(b.constraints.vertical)}};
}
