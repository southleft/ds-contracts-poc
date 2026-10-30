/** A source-selected opaque interior can establish exact correspondence at the
 * recorded offset when export surfaces composite their edges differently. This
 * is origin evidence only: the entire original render still enters scoring. */
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {PNG} from 'pngjs';
import {imageSha256, type FrameBox} from './design-consumer-framing-v2.js';
import {qualifyRenderBoundsExport, type RenderExportProof} from './design-consumer-render-export.js';

export interface SourceRenderRequest {
  fileKey:string; version:string; nodeIds:string[];
  format:'png'; scale:1; contentsOnly:true; useAbsoluteBounds:boolean;
}
export interface SourceRenderRequests {layout:SourceRenderRequest;render:SourceRenderRequest}
interface Anchor {
  ownerNodeId:string; ownerBox:FrameBox; cornerRadius:number;
  selectionRule:'opaque-round-rect-closed-cells-v1'; coordinateSha256:string;
  pixels:number; rgbaSha256:string; horizontalChanges:number; verticalChanges:number;
}
export interface NativeAnchorProof {
  kind:'figma-rest-source-opaque-anchor-v1'; fileKey:string; nodeId:string; version:string;
  layout:FrameBox; render:FrameBox; layoutInRender:{x:number;y:number};
  layoutSha256:string; renderSha256:string;
  layoutSpan:{width:number;height:number}; renderSpan:{width:number;height:number};
  requests:SourceRenderRequests; sourceDocument:any;
  sourceBeforeNodeSha256:string; sourceAfterNodeSha256:string;
  wholeOverlapRefusal:'render-export-overlap-mismatch';
  evidence:'producer-verified-exact-rgba-at-metadata-offset'; anchor:Anchor;
}
export interface RootNativeAnchorProof extends Omit<NativeAnchorProof,'kind'|'anchor'> {
  kind:'figma-rest-source-root-opaque-anchor-v1';
  coordinateBasis:{kind:'exact-layout-origin-v1';x:number;y:number};
  anchor:Omit<Anchor,'selectionRule'>&{selectionRule:'root-opaque-round-rect-closed-cells-v1'};
}
export type SourceAnchorProof=NativeAnchorProof|RootNativeAnchorProof;
export const isSourceAnchorKind=(kind:unknown):kind is SourceAnchorProof['kind']=>
  kind==='figma-rest-source-opaque-anchor-v1'||kind==='figma-rest-source-root-opaque-anchor-v1';
interface Row {y:number;x0:number;x1:number}
interface Selection {owner:any;radius:number;rows:Row[];pixels:number;coordinateSha256:string}
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const box=(b:any):b is FrameBox=>!!b&&[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0;
const sameBox=(a:FrameBox,b:FrameBox)=>['x','y','width','height'].every(k=>a[k as keyof FrameBox]===b[k as keyof FrameBox]);
const visible=(n:any)=>n.visible!==false;
const optional=(n:any,key:string,valid:(value:any)=>boolean)=>!Object.hasOwn(n,key)||valid(n[key]);
const boolean=(v:any)=>typeof v==='boolean';
const unit=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
const nonnegative=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const blend=(v:any)=>typeof v==='string'&&v.length>0;
// Missing optional REST fields have defaults; explicit null/wrong types do not.
const paintContext=(p:any)=>!!p&&typeof p==='object'&&!Array.isArray(p)&&
  optional(p,'visible',boolean)&&optional(p,'opacity',unit)&&optional(p,'blendMode',blend)&&
  optional(p,'color',c=>!!c&&typeof c==='object'&&!Array.isArray(c)&&optional(c,'a',unit));
const effects=(n:any):any[]|null=>!Object.hasOwn(n,'effects')?[]:Array.isArray(n.effects)&&
  n.effects.every(paintContext)?n.effects.filter((e:any)=>e.visible!==false):null;
const ordinary=(n:any)=>['NORMAL','PASS_THROUGH'].includes(n.blendMode??'NORMAL');
const alpha=(p:any)=>(p.opacity??1)*(p.color?.a??1);
const painted=(ps:any)=>Array.isArray(ps)&&ps.some((p:any)=>p.visible!==false&&alpha(p)!==0);
const q=(v:number)=>Number.isSafeInteger(v*64)?BigInt(v*64):null;
const gridBox=(b:FrameBox)=>[b.x,b.y,b.width,b.height,b.x+b.width,b.y+b.height].every(v=>q(v)!==null);

function context(n:any,parent?:any):boolean {
  if(!n||typeof n.id!=='string'||!box(n.absoluteBoundingBox)||!ordinary(n)||
     !optional(n,'visible',boolean)||!optional(n,'opacity',unit)||!optional(n,'blendMode',blend)||
     !optional(n,'clipsContent',boolean)||!optional(n,'isMask',boolean)||
     !optional(n,'rotation',v=>typeof v==='number'&&v===0)||
     !optional(n,'cornerRadius',nonnegative)||!optional(n,'cornerSmoothing',unit)||
     n.isMask===true||n.maskType!==undefined)return false;
  for(const key of ['absoluteTransform','relativeTransform'])if(n[key]!==undefined){
    const m=n[key];
    if(!Array.isArray(m)||m.length!==2||m.some((r:any)=>!Array.isArray(r)||r.length!==3)||
       m[0][0]!==1||m[0][1]!==0||m[1][0]!==0||m[1][1]!==1||
       !Number.isFinite(m[0][2])||!Number.isFinite(m[1][2]))return false;
    const origin=key==='relativeTransform'?parent?.absoluteBoundingBox:{x:0,y:0};
    if(!origin||origin.x+m[0][2]!==n.absoluteBoundingBox.x||origin.y+m[1][2]!==n.absoluteBoundingBox.y)return false;
  }
  for(const ps of [n.fills,n.strokes,n.background]){
    if(ps!==undefined&&!Array.isArray(ps))return false;
    if(Array.isArray(ps)&&ps.some((p:any)=>!paintContext(p)||p.visible!==false&&(p.blendMode??'NORMAL')!=='NORMAL'))return false;
  }
  return true;
}
function radius(n:any):number|null {
  const r=n.cornerRadius??0,b=n.absoluteBoundingBox;
  if(!Number.isFinite(r)||r<0||q(r)===null||!gridBox(b)||r>Math.min(b.width,b.height)/2||
     (n.cornerSmoothing??0)!==0)return null;
  if(n.rectangleCornerRadii!==undefined&&(!Array.isArray(n.rectangleCornerRadii)||
    n.rectangleCornerRadii.length!==4||n.rectangleCornerRadii.some((v:any)=>v!==r)))return null;
  return r;
}
/** All arithmetic at the curved boundary is exact on the admitted 1/64 grid.
 * Strict containment excludes boundary AA cells without choosing a padding. */
interface Shape {l:bigint;t:bigint;right:bigint;bottom:bigint;rr:bigint}
const shape=(b:FrameBox,r:number):Shape=>({l:q(b.x)!,t:q(b.y)!,right:q(b.x+b.width)!,bottom:q(b.y+b.height)!,rr:q(r)!});
function inside({l,t,right,bottom,rr}:Shape,x:bigint,y:bigint):boolean {
  if(x<=l||x>=right||y<=t||y>=bottom)return false;
  const cx=x<l+rr?l+rr:x>right-rr?right-rr:null;
  const cy=y<t+rr?t+rr:y>bottom-rr?bottom-rr:null;
  return cx===null||cy===null||(x-cx)*(x-cx)+(y-cy)*(y-cy)<rr*rr;
}
function requestsMatch(rs:SourceRenderRequests,nodeId:string,version:string,fileKey?:string):boolean {
  if(!rs?.layout||!rs.render)return false;
  const a=rs.layout,b=rs.render;
  return [a,b].every(r=>typeof r.fileKey==='string'&&!!r.fileKey&&r.fileKey===(fileKey??a.fileKey)&&
    r.version===version&&Array.isArray(r.nodeIds)&&r.nodeIds.includes(nodeId)&&
    new Set(r.nodeIds).size===r.nodeIds.length&&r.nodeIds.every(id=>typeof id==='string'&&!!id)&&
    r.format==='png'&&r.scale===1&&r.contentsOnly===true)&&a.useAbsoluteBounds===true&&b.useAbsoluteBounds===false;
}
function select(document:any,layout:FrameBox,render:FrameBox):Selection|null {
  try { return selectSource(document,layout,render); }
  catch(error) { if(error instanceof TypeError||error instanceof RangeError)return null;throw error; }
}
function selectSource(document:any,layout:FrameBox,render:FrameBox):Selection|null {
  if(!context(document)||!Array.isArray(document.children)||!visible(document)||(document.opacity??1)!==1||
     painted(document.fills)||painted(document.background)||painted(document.strokes)||
     !effects(document)||effects(document)!.length||!gridBox(layout)||!gridBox(render))return null;
  const direct=document.children.filter(visible);
  if(!direct.length||direct.some((n:any)=>!box(n.absoluteRenderBounds)))return null;
  const left=Math.min(...direct.map((n:any)=>n.absoluteRenderBounds.x)),top=Math.min(...direct.map((n:any)=>n.absoluteRenderBounds.y));
  const union={x:left,y:top,width:Math.max(...direct.map((n:any)=>n.absoluteRenderBounds.x+n.absoluteRenderBounds.width))-left,
    height:Math.max(...direct.map((n:any)=>n.absoluteRenderBounds.y+n.absoluteRenderBounds.height))-top};
  if(!sameBox(union,render))return null;
  const ids=new Set<string>(),entries:{node:any;chain:any[];order:number}[]=[];
  let valid=true;
  function visit(n:any,chain:any[],effectiveVisible:boolean){
    if(!n||typeof n.id!=='string'||ids.has(n.id)){valid=false;return;} ids.add(n.id);
    const showing=effectiveVisible&&visible(n),parent=chain.at(-1);
    if(showing&&!context(n,parent))valid=false;
    if(showing)entries.push({node:n,chain,order:entries.length});
    if(n.children!==undefined&&!Array.isArray(n.children)){valid=false;return;}
    if(['FRAME','COMPONENT','INSTANCE','GROUP','SECTION'].includes(n.type)&&!Array.isArray(n.children)){valid=false;return;}
    for(const child of n.children??[])visit(child,[...chain,n],showing);
  }
  visit(document,[],true);if(!valid)return null;
  const candidates:{entry:typeof entries[number];rows:Row[];pixels:number;radius:number}[]=[];
  for(const entry of entries){
    const n=entry.node,r=radius(n);
    if(n===document||!['FRAME','COMPONENT'].includes(n.type)||r===null||n.clipsContent!==true||
       (n.opacity??1)!==1||!Array.isArray(n.fills)||
       n.fills.filter((p:any)=>p.visible!==false).length!==1||painted(n.strokes))continue;
    const fill=n.fills.find((p:any)=>p.visible!==false);
    if(fill.type!=='SOLID'||(fill.opacity??1)!==1||(fill.color?.a??1)!==1||alpha(fill)!==1||(fill.blendMode??'NORMAL')!=='NORMAL'||
       !fill.color||['r','g','b'].some(k=>!Number.isFinite(fill.color[k])||fill.color[k]<0||fill.color[k]>1))continue;
    const es=effects(n);
    if(!es||es.some((e:any)=>e.type!=='DROP_SHADOW'||(e.blendMode??'NORMAL')!=='NORMAL'||
       !Number.isFinite(e.radius)||e.radius<0||!Number.isFinite(e.offset?.x)||!Number.isFinite(e.offset?.y)))continue;
    const clips:{b:FrameBox;r:number}[]=[{b:n.absoluteBoundingBox,r}];let supported=true;
    for(let i=0;i<entry.chain.length;i++){
      const ancestor=entry.chain[i];
      if(!visible(ancestor)||(ancestor.opacity??1)!==1||!effects(ancestor)||effects(ancestor)!.length){supported=false;break;}
      if(ancestor.clipsContent===true){const ar=radius(ancestor);if(ar===null){supported=false;break;}clips.push({b:ancestor.absoluteBoundingBox,r:ar});}
      const child=entry.chain[i+1]??n,index=ancestor.children.indexOf(child);
      for(const later of ancestor.children.slice(index+1).filter(visible)){
        const b=later.absoluteRenderBounds,o=n.absoluteBoundingBox;
        if(!box(b)||b.x<o.x+o.width&&b.x+b.width>o.x&&b.y<o.y+o.height&&b.y+b.height>o.y){supported=false;break;}
      }
    }
    // External shadows belong only to the opaque owner. Effects on descendants
    // could feed its interior from elsewhere and have no proof in this route.
    for(const other of entries)if(other.chain.includes(n)&&(!effects(other.node)||effects(other.node)!.length))supported=false;
    if(!supported)continue;
    const o=n.absoluteBoundingBox,rows:Row[]=[];
    const x0=Math.max(0,Math.ceil(o.x-layout.x),Math.ceil(render.x-layout.x));
    const y0=Math.max(0,Math.ceil(o.y-layout.y),Math.ceil(render.y-layout.y));
    const x1=Math.floor(Math.min(o.x+o.width,layout.x+layout.width,render.x+render.width)-layout.x);
    const y1=Math.floor(Math.min(o.y+o.height,layout.y+layout.height,render.y+render.height)-layout.y);
    const shapes=clips.map(c=>shape(c.b,c.r)),lx=q(layout.x)!,ly=q(layout.y)!;
    let pixels=0;
    for(let y=y0;y<y1;y++){
      let start=-1,end=-1;
      for(let x=x0;x<x1;x++){
        const px=lx+BigInt(x)*64n,py=ly+BigInt(y)*64n;
        const contained=shapes.every(c=>inside(c,px,py)&&inside(c,px+64n,py)&&inside(c,px,py+64n)&&inside(c,px+64n,py+64n));
        if(contained){if(start<0)start=x;end=x+1;}
      }
      if(start>=0){rows.push({y,x0:start,x1:end});pixels+=end-start;}
    }
    if(pixels)candidates.push({entry,rows,pixels,radius:r});
  }
  candidates.sort((a,b)=>b.pixels-a.pixels||a.entry.order-b.entry.order||a.entry.node.id.localeCompare(b.entry.node.id));
  const picked=candidates[0];if(!picked)return null;
  const coordinates=createHash('sha256'),word=Buffer.alloc(8);
  for(const row of picked.rows)for(let x=row.x0;x<row.x1;x++){word.writeUInt32BE(x,0);word.writeUInt32BE(row.y,4);coordinates.update(word);}
  return {owner:picked.entry.node,radius:picked.radius,rows:picked.rows,pixels:picked.pixels,coordinateSha256:coordinates.digest('hex')};
}
/** A separately versioned root-owned route. All coordinates are translated by
 * the recorded layout origin exactly; neither the source nor its PNGs are
 * rounded. The opaque clipped root, rather than a union of child paint, owns
 * the render bounds and its supported external shadows. */
function selectRoot(document:any,layout:FrameBox,render:FrameBox):Selection|null {
  try { return selectRootSource(document,layout,render); }
  catch(error) { if(error instanceof TypeError||error instanceof RangeError)return null;throw error; }
}
function selectRootSource(document:any,layout:FrameBox,render:FrameBox):Selection|null {
  if(!context(document)||!['FRAME','COMPONENT'].includes(document.type)||!visible(document)||
     (document.opacity??1)!==1||document.clipsContent!==true||!Array.isArray(document.children)||
     !sameBox(document.absoluteBoundingBox,layout)||!sameBox(document.absoluteRenderBounds,render)||
     !Array.isArray(document.fills)||document.fills.filter((p:any)=>p.visible!==false).length!==1||
     painted(document.strokes)||painted(document.background)&&!isDeepStrictEqual(document.background,document.fills))return null;
  const fill=document.fills.find((p:any)=>p.visible!==false);
  if(fill.type!=='SOLID'||(fill.opacity??1)!==1||(fill.color?.a??1)!==1||
     (fill.blendMode??'NORMAL')!=='NORMAL'||!fill.color||
     ['r','g','b'].some(k=>!unit(fill.color[k])))return null;
  const es=effects(document);
  if(!es||es.some((e:any)=>e.type!=='DROP_SHADOW'||(e.blendMode??'NORMAL')!=='NORMAL'||
     !nonnegative(e.radius)||!Number.isFinite(e.offset?.x)||!Number.isFinite(e.offset?.y)||
     !optional(e,'spread',v=>typeof v==='number'&&Number.isFinite(v))||
     !optional(e,'showShadowBehindNode',boolean)))return null;
  const origin={x:layout.x,y:layout.y};
  const translate=(b:FrameBox):FrameBox|null=>{
    if(!box(b))return null;
    const x=b.x-origin.x,y=b.y-origin.y;
    // Preserve both endpoints, not just a rounded local width or origin.
    if(origin.x+x!==b.x||origin.y+y!==b.y||
       b.x+b.width-origin.x!==x+b.width||b.y+b.height-origin.y!==y+b.height||
       origin.x+(x+b.width)!==b.x+b.width||origin.y+(y+b.height)!==b.y+b.height)return null;
    return {x,y,width:b.width,height:b.height};
  };
  const localLayout=translate(layout),localRender=translate(render);
  if(!localLayout||!localRender||!gridBox(localLayout)||!gridBox(localRender)||
     localRender.x>0||localRender.y>0||localRender.x+localRender.width<layout.width||
     localRender.y+localRender.height<layout.height)return null;
  const ids=new Set<string>();let valid=true;
  const visit=(n:any,parent?:any,showing=true):any=>{
    if(!n||typeof n.id!=='string'||ids.has(n.id)){valid=false;return null;}ids.add(n.id);
    showing=showing&&visible(n);
    if(n.children!==undefined&&!Array.isArray(n.children)){valid=false;return null;}
    if(['FRAME','COMPONENT','INSTANCE','GROUP','SECTION'].includes(n.type)&&!Array.isArray(n.children)){valid=false;return null;}
    if(!showing){for(const child of n.children??[])visit(child,n,false);return n;}
    if(!context(n,parent)||n!==document&&(!effects(n)||effects(n)!.length)){valid=false;return null;}
    const b=translate(n.absoluteBoundingBox);if(!b){valid=false;return null;}
    const clone={...n,absoluteBoundingBox:b};
    if(n.absoluteRenderBounds!==undefined){
      const rb=translate(n.absoluteRenderBounds);if(!rb){valid=false;return null;}clone.absoluteRenderBounds=rb;
    }
    if(n.absoluteTransform!==undefined){
      const m=n.absoluteTransform,x=m[0][2]-origin.x,y=m[1][2]-origin.y;
      if(origin.x+x!==m[0][2]||origin.y+y!==m[1][2]){valid=false;return null;}
      clone.absoluteTransform=[[...m[0]],[...m[1]]];clone.absoluteTransform[0][2]=x;clone.absoluteTransform[1][2]=y;
    }
    if(n.children!==undefined)clone.children=n.children.map((child:any)=>visit(child,n,showing));
    return clone;
  };
  const local=visit(document);if(!valid||!local)return null;
  // Recheck transform/box correlation in the new basis without relaxing it.
  const checkLocal=(n:any,parent?:any,showing=true)=>{
    showing=showing&&visible(n);if(!showing)return;
    if(!context(n,parent))valid=false;
    for(const c of n.children??[])checkLocal(c,n,showing);
  };
  checkLocal(local);if(!valid)return null;
  const direct=local.children.filter(visible);
  if(direct.some((n:any)=>!box(n.absoluteRenderBounds)||n.absoluteRenderBounds.x<localRender.x||
     n.absoluteRenderBounds.y<localRender.y||n.absoluteRenderBounds.x+n.absoluteRenderBounds.width>localRender.x+localRender.width||
     n.absoluteRenderBounds.y+n.absoluteRenderBounds.height>localRender.y+localRender.height))return null;
  const r=radius(local);if(r===null)return null;
  const boundary=shape(localLayout,r),rows:Row[]=[];let pixels=0;
  for(let y=0;y<Math.floor(localLayout.height);y++){
    let start=-1,end=-1;
    for(let x=0;x<Math.floor(localLayout.width);x++){
      const px=BigInt(x)*64n,py=BigInt(y)*64n;
      if(inside(boundary,px,py)&&inside(boundary,px+64n,py)&&
         inside(boundary,px,py+64n)&&inside(boundary,px+64n,py+64n)){
        if(start<0)start=x;end=x+1;
      }
    }
    if(start>=0){rows.push({y,x0:start,x1:end});pixels+=end-start;}
  }
  if(!pixels)return null;
  const coordinates=createHash('sha256'),word=Buffer.alloc(8);
  for(const row of rows)for(let x=row.x0;x<row.x1;x++){word.writeUInt32BE(x,0);word.writeUInt32BE(row.y,4);coordinates.update(word);}
  return {owner:document,radius:r,rows,pixels,coordinateSha256:coordinates.digest('hex')};
}
function observe(png:PNG,selection:Selection,offset:{x:number;y:number}) {
  const rgba=createHash('sha256');let horizontalChanges=0,verticalChanges=0,prior:Row|undefined;
  const equal=(a:number,b:number)=>[0,1,2,3].every(c=>png.data[a+c]===png.data[b+c]);
  for(const row of selection.rows){
    if(row.x0+offset.x<0||row.x1+offset.x>png.width||row.y+offset.y<0||row.y+offset.y>=png.height)return null;
    for(let x=row.x0;x<row.x1;x++){
      const at=((row.y+offset.y)*png.width+x+offset.x)*4;
      if(png.data[at+3]!==255)return null;
      rgba.update(png.data.subarray(at,at+4));
      if(x>row.x0&&!equal(at,at-4))horizontalChanges++;
      if(prior?.y===row.y-1&&x>=prior.x0&&x<prior.x1&&!equal(at,at-png.width*4))verticalChanges++;
    }
    prior=row;
  }
  return {rgbaSha256:rgba.digest('hex'),horizontalChanges,verticalChanges};
}

export function qualifySourceRenderBoundsExport(before:any,after:any,nodeId:string,layoutBytes:Buffer,renderBytes:Buffer,requests:SourceRenderRequests):
 {proof:RenderExportProof|SourceAnchorProof}|{refused:string} {
  const old=qualifyRenderBoundsExport(before,after,nodeId,layoutBytes,renderBytes);
  if(!('refused'in old)||old.refused!=='render-export-overlap-mismatch')return old;
  if(!requestsMatch(requests,nodeId,before.version))return {refused:'render-anchor-request-mismatch'};
  const document=before.nodes[nodeId].document,layout=document.absoluteBoundingBox,render=document.absoluteRenderBounds;
  const legacy=select(document,layout,render),selection=legacy??selectRoot(document,layout,render);
  if(!selection)return {refused:'render-anchor-source-unsupported'};
  // The choice above sees metadata only. There is no retry with another owner.
  const a=PNG.sync.read(layoutBytes),b=PNG.sync.read(renderBytes),offset={x:layout.x-render.x,y:layout.y-render.y};
  const aa=observe(a,selection,{x:0,y:0}),bb=observe(b,selection,offset);
  if(!aa||!bb)return {refused:'render-anchor-not-opaque'};
  for(const row of selection.rows)for(let x=row.x0;x<row.x1;x++){
    const ai=(row.y*a.width+x)*4,bi=((row.y+offset.y)*b.width+x+offset.x)*4;
    if([0,1,2,3].some(c=>a.data[ai+c]!==b.data[bi+c]))return {refused:'render-anchor-pixel-mismatch'};
  }
  if(!aa.horizontalChanges||!aa.verticalChanges)return {refused:'render-anchor-origin-unobservable'};
  return {proof:{...(legacy?{kind:'figma-rest-source-opaque-anchor-v1' as const}:{kind:'figma-rest-source-root-opaque-anchor-v1' as const,coordinateBasis:{kind:'exact-layout-origin-v1' as const,x:layout.x,y:layout.y}}),fileKey:requests.layout.fileKey,nodeId,version:before.version,
    layout:{...layout},render:{...render},layoutInRender:offset,layoutSha256:imageSha256(layoutBytes),renderSha256:imageSha256(renderBytes),
    layoutSpan:{width:a.width,height:a.height},renderSpan:{width:b.width,height:b.height},requests:structuredClone(requests),
    sourceDocument:structuredClone(document),sourceBeforeNodeSha256:sha(document),sourceAfterNodeSha256:sha(after.nodes[nodeId].document),
    wholeOverlapRefusal:old.refused,evidence:'producer-verified-exact-rgba-at-metadata-offset',
    anchor:{ownerNodeId:selection.owner.id,ownerBox:{...selection.owner.absoluteBoundingBox},cornerRadius:selection.radius,
      selectionRule:legacy?'opaque-round-rect-closed-cells-v1':'root-opaque-round-rect-closed-cells-v1',coordinateSha256:selection.coordinateSha256,pixels:selection.pixels,...aa} } as SourceAnchorProof};
}

/** Replays source geometry and render evidence. Equality to the absent original
 * layout PNG is explicitly the producer's attestation, like the old pair proof;
 * this validator does not claim a new read or comparison of those absent bytes. */
export function validateNativeAnchorProof(p:any,renderBytes:Buffer,layout:FrameBox,render:FrameBox):boolean {
  try {
    if(!p||!isSourceAnchorKind(p.kind)||typeof p.fileKey!=='string'||!p.fileKey||typeof p.version!=='string'||!p.version||
       typeof p.nodeId!=='string'||!p.nodeId||!box(p.layout)||!box(p.render)||!sameBox(p.layout,layout)||!sameBox(p.render,render)||
       p.wholeOverlapRefusal!=='render-export-overlap-mismatch'||p.evidence!=='producer-verified-exact-rgba-at-metadata-offset'||
       !requestsMatch(p.requests,p.nodeId,p.version,p.fileKey)||!hash(p.layoutSha256)||p.renderSha256!==imageSha256(renderBytes)||
       p.sourceDocument?.id!==p.nodeId||!sameBox(p.sourceDocument.absoluteBoundingBox,layout)||!sameBox(p.sourceDocument.absoluteRenderBounds,render)||
       sha(p.sourceDocument)!==p.sourceBeforeNodeSha256||p.sourceBeforeNodeSha256!==p.sourceAfterNodeSha256||
       !p.layoutInRender||p.layoutInRender.x!==layout.x-render.x||p.layoutInRender.y!==layout.y-render.y||
       !Number.isInteger(p.layoutInRender.x)||!Number.isInteger(p.layoutInRender.y))return false;
    const png=PNG.sync.read(renderBytes),span=(s:any,b:FrameBox)=>s&&s.width===Math.ceil(b.width)&&s.height===Math.ceil(b.height);
    if(!span(p.layoutSpan,layout)||!span(p.renderSpan,render)||png.width!==p.renderSpan.width||png.height!==p.renderSpan.height)return false;
    const root=p.kind==='figma-rest-source-root-opaque-anchor-v1';
    if(root&&(!p.coordinateBasis||p.coordinateBasis.kind!=='exact-layout-origin-v1'||
       p.coordinateBasis.x!==layout.x||p.coordinateBasis.y!==layout.y||select(p.sourceDocument,layout,render)))return false;
    if(!root&&p.coordinateBasis!==undefined)return false;
    const s=root?selectRoot(p.sourceDocument,layout,render):select(p.sourceDocument,layout,render),a=p.anchor;
    if(!s||!a||a.selectionRule!==(root?'root-opaque-round-rect-closed-cells-v1':'opaque-round-rect-closed-cells-v1')||a.ownerNodeId!==s.owner.id||
       !sameBox(a.ownerBox,s.owner.absoluteBoundingBox)||a.cornerRadius!==s.radius||a.coordinateSha256!==s.coordinateSha256||a.pixels!==s.pixels||
       !hash(a.rgbaSha256)||!Number.isSafeInteger(a.horizontalChanges)||a.horizontalChanges<=0||!Number.isSafeInteger(a.verticalChanges)||a.verticalChanges<=0)return false;
    const observed=observe(png,s,p.layoutInRender);
    return !!observed&&isDeepStrictEqual(observed,{rgbaSha256:a.rgbaSha256,horizontalChanges:a.horizontalChanges,verticalChanges:a.verticalChanges});
  } catch { return false; }
}
