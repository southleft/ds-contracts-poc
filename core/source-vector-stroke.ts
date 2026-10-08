import {canonicalJson,revisionOf,sourceBytesRevisionOf} from './contract-provenance.js';
import {VectorStrokeSchema,type VectorStroke,type Contract} from '../scripts/contract-schema.js';
import type {DumpNode,DumpSet} from '../extract/figma/types.js';

/** Explicit normative adapter input, never loaded by filename. Raw source
 * files remain unchanged; canonical source and capture revisions are checked
 * again by the normal proposer. The acquisition layer pins raw byte hashes. */
export type NativeVectorStrokeCapture={
  kind:'native-vector-stroke-capture';version:1;
  source:{fileKey:string;fileVersion:string;dumpRevision:string;rawDumpSha256:string;rawDumpText:string;referenceRevision:string};
  reference:{version:string;nodes:Record<string,{document:any}>};
  mains:Array<{setKey:string;componentKey:string;componentId:string;childPath:number[];nodeId:string;native:any}>;
  occurrences:Array<{rootId:string;hostId:string;leafId:string;main:{id:string;key:string;componentSetKey:string};host:any;leaf:any;hostTransform:number[][];hostBox:any;leafBox:any;paintBox:any}>;
  captureRevision:string;
};
type Owner={setKey:string;componentKey:string;componentId:string;nodeId:string;childPath:number[];stroke:VectorStroke|null;refusal?:'vector-stroke-dashed-unqualified'|'vector-stroke-vertical-unqualified'};
type Usage={instanceId:string;componentId:string;nodeId:string;setKey:string;childPath:number[];stroke:VectorStroke};
export type QualifiedVectorStrokeCapture={owners:Map<string,Owner>;usages:Map<string,Usage>;source:NativeVectorStrokeCapture['source']};
export type VectorStrokeBinding={setKey:string;prop:string;contractRevision:string;choices:Record<string,VectorStroke>;owners:Owner[]};
function refuse(reason:string):never{throw Error('vector-stroke-capture-unqualified:'+reason);}
const qualified=new WeakMap<QualifiedVectorStrokeCapture,string>();
const qualificationRevision=(q:QualifiedVectorStrokeCapture)=>revisionOf({owners:[...q.owners],usages:[...q.usages],source:q.source});
export function assertQualifiedVectorStrokeCapture(q:QualifiedVectorStrokeCapture|undefined):void {if(q&&(qualified.get(q)!==qualificationRevision(q)))refuse('unvalidated-or-changed-qualified-input');}
function ownedJson(v:unknown):boolean {if(v===null||typeof v==='string'||typeof v==='boolean')return true;if(typeof v==='number')return Number.isFinite(v);if(Array.isArray(v))return dense(v)&&v.every(ownedJson);if(v&&typeof v==='object')return Object.getPrototypeOf(v)===Object.prototype&&Object.values(v).every(ownedJson);return false;}
const dense=(v:unknown):v is any[]=>Array.isArray(v)&&Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
function identity(t:unknown):boolean{return dense(t)&&t.length===2&&t.every(row=>dense(row)&&row.length===3&&row.every(Number.isFinite))&&t[0][0]===1&&t[0][1]===0&&t[1][0]===0&&t[1][1]===1;}
function nodes(root:DumpNode):DumpNode[]{return [root,...(root.children??[]).flatMap(nodes)];}
function child(root:any,path:number[]):any{let n=root;for(const i of path){if(n?.type==='INSTANCE')refuse('cross-instance-owner');n=n?.children?.[i];}return n;}
function nativeStroke(n:any):VectorStroke{
  if(!n||n.type!=='VECTOR'||n.height!==0||!Number.isFinite(n.width)||n.width<=0||n.visible!==true||n.opacity!==1||n.blendMode!=='PASS_THROUGH'||!identity(n.relativeTransform)||n.relativeTransform[0][2]!==0||!dense(n.fills)||n.fills.length||!dense(n.effects)||n.effects.length||!dense(n.dashPattern)||n.dashPattern.length||n.strokeAlign!=='CENTER'||n.strokeCap!=='NONE'||n.strokeJoin!=='MITER'||!dense(n.strokes)||n.strokes.length!==1||!dense(n.vectorPaths)||n.vectorPaths.length!==1||n.vectorPaths[0].windingRule!=='NONE')refuse('native-segment-context');
  const p=n.strokes[0],net=n.vectorNetwork;
  if(p.type!=='SOLID'||p.visible!==true||p.blendMode!=='NORMAL'||!Number.isFinite(p.opacity)||!p.color||p.boundVariables===undefined||Object.keys(p.boundVariables).length||!net||!dense(net.vertices)||net.vertices.length!==2||!dense(net.segments)||net.segments.length!==1||!dense(net.regions)||net.regions.length)refuse('native-segment-paint-or-network');
  const v=net.vertices,s=net.segments[0],data=n.vectorPaths[0].data;
  if(v[0].x!==0||v[0].y!==0||v[1].y!==0||v.some((p:any)=>p.strokeCap!=='NONE'||p.strokeJoin!=='MITER'||p.cornerRadius!==0)||s.start!==0||s.end!==1||s.tangentStart?.x!==0||s.tangentStart?.y!==0||s.tangentEnd?.x!==0||s.tangentEnd?.y!==0||data!==`M 0 0 L ${v[1].x} 0`)refuse('native-path-network-disagreement');
  const parsed=VectorStrokeSchema.safeParse({data,width:n.width,height:0,cap:n.strokeCap,join:n.strokeJoin,miterLimit:n.strokeMiterLimit,weight:n.strokeWeight,color:p.color,opacity:p.opacity});
  if(!parsed.success)refuse('native-segment-fields');return parsed.data;
}

export function qualifyNativeVectorStrokeCapture(dump:Record<string,unknown>,capture:NativeVectorStrokeCapture,fileKey:string|null|undefined):QualifiedVectorStrokeCapture{
  if(capture?.kind!=='native-vector-stroke-capture'||capture.version!==1||!capture.source||!fileKey||fileKey!==capture.source.fileKey||!/^[a-f0-9]{64}$/.test(capture.source.rawDumpSha256))refuse('source-header');
  const {_nativeVectorStrokeCapture:ignored,...source}=dump;
  if(!ownedJson(source)||!ownedJson(capture)||typeof capture.source.rawDumpText!=='string'||sourceBytesRevisionOf(capture.source.rawDumpText)!=='sha256:'+capture.source.rawDumpSha256)refuse('raw-source-bytes');
  let rawSource:unknown;try{rawSource=JSON.parse(capture.source.rawDumpText);}catch{refuse('raw-source-json');}
  if(canonicalJson(rawSource)!==canonicalJson(source))refuse('raw-source-object-disagreement');
  if(capture.source.dumpRevision!==revisionOf(source)||capture.source.referenceRevision!==revisionOf(capture.reference)||capture.reference.version!==capture.source.fileVersion)refuse('source-revision');
  const provenance=source._provenance as any;
  if(provenance?.fileKey!==fileKey||provenance.strokeSvgCapture?.sources?.version!==capture.source.fileVersion)refuse('source-version');
  const {captureRevision,...payload}=capture;if(captureRevision!==revisionOf(payload))refuse('capture-revision');
  if(!dense(capture.mains)||!capture.mains.length||!dense(capture.occurrences)||!capture.occurrences.length)refuse('missing-records');
  const sets=Object.values(source).filter((v):v is DumpSet=>!!v&&typeof v==='object'&&Array.isArray((v as DumpSet).variants));
  const owners=new Map<string,Owner>();
  for(const record of capture.mains){
    if(!dense(record.childPath)||record.childPath.length!==1||record.childPath[0]!==0)refuse('direct-path');
    const set=sets.find(s=>s.key===record.setKey),main=set?.variants.find(v=>v.nodeId===record.componentId),leaf=main&&child(main,record.childPath);
    const n=record.native;
    if(!set||!main||main.componentKey!==record.componentKey||!leaf||leaf.type!=='VECTOR'||leaf.nodeId!==record.nodeId||n.nodeId!==record.nodeId||n.parent?.nodeId!==main.nodeId||leaf.children?.length||leaf.shape||leaf.hidden||leaf.fill||leaf.sourceEmptyFill!==true||!identity(n.relativeTransform)||n.relativeTransform[0][2]!==0||n.relativeTransform[1][2]!==0||main.bbox?.width!==n.width||main.bbox?.height!==n.height)refuse('main-ownership');
    let stroke:VectorStroke|null=null,refusal:Owner['refusal'];
    if(n.height===0&&n.width>0&&dense(n.dashPattern)&&n.dashPattern.length===0){
      if(!leaf.fillWidth||leaf.fixedSize?.height!==0||main.layout?.mode!=='VERTICAL'||main.layout.counterSizing!=='FIXED'||!dense(main.layout.padding)||main.layout.padding.length!==4||main.layout.padding.some(v=>v!==0))refuse('main-allocation');
      stroke=nativeStroke(n);
    }else {
      if(n.strokeCap!=='NONE'||n.strokeJoin!=='MITER'||!dense(n.dashPattern)||!n.dashPattern.every((v:any)=>Number.isFinite(v)&&v>0)||n.type!=='VECTOR'||n.visible!==true||n.opacity!==1||n.blendMode!=='PASS_THROUGH'||!dense(n.fills)||n.fills.length||!dense(n.effects)||n.effects.length||!dense(n.strokes)||n.strokes.length!==1||!dense(n.vectorPaths)||n.vectorPaths.length!==1)refuse('unsupported-main-fields');
      if(n.width===0&&Number.isFinite(n.height)&&n.height>0&&leaf.fillHeight&&leaf.fixedSize?.width===0)refusal='vector-stroke-vertical-unqualified';
      else if(n.height===0&&Number.isFinite(n.width)&&n.width>0&&n.dashPattern.length&&leaf.fillWidth&&leaf.fixedSize?.height===0)refusal='vector-stroke-dashed-unqualified';
      else refuse('unsupported-main-geometry');
    }
    const p=n.strokes[0],legacy=leaf.stroke;
    if(p.type!=='SOLID'||p.visible!==true||p.blendMode!=='NORMAL'||!Number.isFinite(p.opacity)||!p.color||!['r','g','b'].every(k=>Number.isFinite(p.color[k])&&p.color[k]>=0&&p.color[k]<=1)||!legacy||legacy.hex.toLowerCase()!==[p.color.r,p.color.g,p.color.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')||(legacy.alpha??1)!==p.opacity||leaf.strokeWeight!==n.strokeWeight||leaf.strokeAlign!==n.strokeAlign||n.strokeAlign!=='CENTER')refuse('main-paint-or-allocation');
    if(owners.has(record.nodeId))refuse('main-duplicate');owners.set(record.nodeId,{setKey:record.setKey,componentKey:record.componentKey,componentId:record.componentId,nodeId:record.nodeId,childPath:record.childPath,stroke,...(refusal?{refusal}:{})});
  }
  const roots=new Map(sets.flatMap(s=>s.variants).map(v=>[v.nodeId!,v]));
  const usages=new Map<string,Usage>(),seen=new Set<string>();
  for(const row of capture.occurrences){
    if(!row||typeof row!=='object'||!row.main||!row.host||!row.leaf||!row.hostBox||!row.leafBox||!row.paintBox)refuse('missing-occurrence-record');
    const root=roots.get(row.rootId),raw=capture.reference.nodes[row.rootId]?.document;
    if(!root||!raw||raw.id!==root.nodeId||!identity(row.hostTransform)||seen.has(row.hostId))refuse('occurrence-root-or-transform');seen.add(row.hostId);
    const nativeMain=row.main,owner=[...owners.values()].find(o=>o.componentId===nativeMain.id&&o.componentKey===nativeMain.key&&o.setKey===nativeMain.componentSetKey);
    if(!owner||!owner.stroke)refuse('occurrence-main');
    const rawHost=nodes(raw).find((n:any)=>n.id===row.hostId) as any,rawLeaf=rawHost?.children?.[0];
    if(!rawHost||rawHost.componentId!==owner.componentId||rawHost.children.length!==1||rawLeaf?.id!==row.leafId||row.leafId!==row.hostId+';'+owner.nodeId||rawLeaf.type!=='VECTOR'||rawHost.visible===false||rawLeaf.visible===false||canonicalJson(rawHost.absoluteBoundingBox)!==canonicalJson(row.hostBox)||canonicalJson(rawLeaf.absoluteBoundingBox)!==canonicalJson(row.leafBox)||canonicalJson(rawLeaf.absoluteRenderBounds)!==canonicalJson(row.paintBox))refuse('occurrence-raw-source');
    const stroke=nativeStroke(row.leaf),host=row.host;
    if(host.type!=='INSTANCE'||host.visible!==true||host.opacity!==1||host.blendMode!=='PASS_THROUGH'||host.layoutMode!=='VERTICAL'||host.layoutPositioning!=='AUTO'||row.leaf.layoutPositioning!=='AUTO'||host.primaryAxisSizingMode!=='FIXED'||host.counterAxisSizingMode!=='FIXED'||host.primaryAxisAlignItems!=='CENTER'||host.counterAxisAlignItems!=='CENTER'||['paddingTop','paddingRight','paddingBottom','paddingLeft'].some(k=>host[k]!==0)||!dense(host.fills)||host.fills.length||!dense(host.strokes)||host.strokes.length||!dense(host.effects)||host.effects.length||!['FIXED','FILL'].includes(host.layoutSizingHorizontal)||host.layoutSizingVertical!=='FIXED'||host.width!==stroke.width||host.height!==stroke.weight||row.leaf.layoutAlign!=='STRETCH'||row.leaf.layoutSizingHorizontal!=='FILL'||row.leaf.layoutSizingVertical!=='FIXED'||row.leaf.relativeTransform[1][2]!==host.height/2)refuse('occurrence-allocation');
    const paint=rawLeaf.strokes?.[0];if(rawLeaf.strokes?.length!==1||paint.type!=='SOLID'||paint.blendMode!=='NORMAL'||['r','g','b'].some(k=>paint.color[k]!==stroke.color[k as 'r'|'g'|'b'])||(paint.opacity??1)!==stroke.opacity||(paint.color.a??1)!==1||rawLeaf.strokeWeight!==stroke.weight||rawLeaf.strokeAlign!=='CENTER'||rawLeaf.layoutAlign!=='STRETCH'||rawLeaf.layoutSizingHorizontal!=='FILL'||rawLeaf.layoutSizingVertical!=='FIXED'||row.leafBox.width!==stroke.width||row.leafBox.height!==0||row.paintBox.width!==stroke.width||row.paintBox.height!==stroke.weight||row.leafBox.y!==row.hostBox.y+host.height/2)refuse('occurrence-paint');
    const parts=row.hostId.split(';');if(parts.length!==2||!parts[0].startsWith('I'))refuse('occurrence-nested-ownership');
    const parentInstance=nodes(root).find(n=>n.nodeId===parts[0].slice(1)),parentMain=parentInstance&&roots.get(parentInstance.instanceGeometry?.componentId??'');
    const sourceInstance=parentMain&&nodes(parentMain).find(n=>n.nodeId===parts[1]);
    if(!sourceInstance||sourceInstance.type!=='INSTANCE'||sourceInstance.instanceGeometry?.componentId!==owner.componentId||sourceInstance.instanceSetKey!==owner.setKey||sourceInstance.instanceKey!==owner.componentKey||!identity(sourceInstance.instanceGeometry.transform)||sourceInstance.instanceGeometry.localSize.width!==host.width||sourceInstance.instanceGeometry.localSize.height!==host.height||canonicalJson(sourceInstance.componentProperties)!==canonicalJson(Object.fromEntries(Object.entries(rawHost.componentProperties??{}).map(([k,v]:[string,any])=>[k,v.value]))))refuse('occurrence-mapped-ownership');
    const h=sourceInstance.hostOverrides?.find(h=>h.solidStrokeTarget?.componentId===owner.componentId&&h.solidStrokeTarget.instanceId===sourceInstance.nodeId&&canonicalJson(h.solidStrokeTarget.childPath)===canonicalJson(owner.childPath)&&!h.solidStrokeTarget.instancePath.length);
    if(!h||!h.fields.includes('strokes')||h.fields.some(f=>!['strokes','visible'].includes(f))||h.stroke?.hex?.toLowerCase()!==[stroke.color.r,stroke.color.g,stroke.color.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join(''))refuse('occurrence-stroke-target');
    const use={instanceId:sourceInstance.nodeId!,componentId:owner.componentId,nodeId:owner.nodeId,setKey:owner.setKey,childPath:owner.childPath,stroke},prior=usages.get(use.instanceId);
    if(prior&&canonicalJson(prior)!==canonicalJson(use))refuse('usage-conflict');usages.set(use.instanceId,use);
  }
  const wanted=new Set<string>();
  for(const [rootId,value] of Object.entries(capture.reference.nodes)){
    const root=roots.get(rootId);if(!root||value.document.id!==root.nodeId)refuse('reference-root');
    for(const node of nodes(value.document) as any[])if(node.type==='INSTANCE'&&[...owners.values()].some(o=>o.componentId===node.componentId))wanted.add(node.id);
  }
  if(wanted.size!==seen.size||[...wanted].some(id=>!seen.has(id)))refuse('occurrence-coverage');
  const result={owners,usages,source:capture.source};qualified.set(result,qualificationRevision(result));return result;
}

export function vectorStrokeChoice(stroke:VectorStroke):string{return 'stroke-'+revisionOf(stroke).slice(7,23);}
export function vectorStrokeBindingMatches(binding:VectorStrokeBinding,child:Contract):boolean{return binding.setKey===child.bindings.figma.anchors.componentSetKey&&binding.contractRevision===revisionOf(child);}
