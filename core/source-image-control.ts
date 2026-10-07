import type {DumpImageAsset, DumpNode, DumpSet} from '../extract/figma/types.js';
import {nativeImageProjection, projectNativeImagePaints} from './native-image-paint.js';

/** A direct instance owns this descendant image; no nested instance boundary
 * may be crossed. Paths are numeric source paths, never display-name identity. */
export interface SourceImageDemand {
  fileKey:string;
  setKey:string;
  componentId:string;
  instanceId:string;
  sourceNodeId:string;
  instanceNodeId:string;
  childPath:number[];
  imageHash:string;
  image:string;
  declared:Record<string,string>;
}

export function qualifySourceImageDemand(set:DumpSet, instance:DumpNode,
  childPath:readonly number[], fileKey:string,
  assets:Record<string,DumpImageAsset>):SourceImageDemand {
  const fail=(reason:string):never=>{throw Error('image-demand-'+reason);};
  const componentId=instance.instanceGeometry?.componentId;
  if(!fileKey || set.contractId || !set.key || set.key!==instance.instanceSetKey ||
    instance.type!=='INSTANCE' || !instance.nodeId || !componentId ||
    instance.instanceGeometry?.nodeId!==instance.nodeId || !instance.instanceContent?.root ||
    instance.instanceContent.root.nodeId!==instance.nodeId ||
    childPath.length===0 || !childPath.every(i=>Number.isInteger(i)&&i>=0)) fail('source-identity-unqualified');
  const variants=set.variants.filter(v=>v.nodeId===componentId);
  if(variants.length!==1) fail('main-ambiguous-or-missing');
  let main:DumpNode|undefined=variants[0], observed:DumpNode|undefined=instance.instanceContent!.root;
  for(const i of childPath){
    if(main?.type==='INSTANCE' || observed?.type==='INSTANCE')fail('crosses-instance-owner');
    main=main?.children?.[i];observed=observed?.children?.[i];
    if(!main?.nodeId || !observed?.nodeId || observed.nodeId!==`I${instance.nodeId};${main.nodeId}` || observed.type!==main.type)fail('source-target-unqualified');
  }
  if(!main || !observed || !['FRAME','RECTANGLE','ELLIPSE'].includes(main.type))fail('target-kind-unqualified');
  const imageHash=observed!.imagePaints?.[0]?.imageHash;
  if(typeof imageHash!=='string' || !imageHash || !main!.imagePaints?.length)fail('image-evidence-missing');
  const projected=projectNativeImagePaints({setName:set.setName,type:'COMPONENT_SET',variants:[observed!]},assets);
  const paint=nativeImageProjection(projected.set.variants[0]);
  if(!paint)fail('original-asset-unavailable');
  return {fileKey,setKey:set.key!,componentId:componentId!,instanceId:instance.nodeId!,
    sourceNodeId:main!.nodeId!,instanceNodeId:observed!.nodeId!,childPath:[...childPath],
    imageHash:imageHash as string,image:paint!.image,declared:{...paint!.declared}};
}

/** Revalidate demands against the exact main being proposed. */
export function demandedImageNodes(set:DumpSet,fileKey:string|null|undefined,demands:readonly SourceImageDemand[]):Map<string,SourceImageDemand[]> {
 const out=new Map<string,SourceImageDemand[]>();
 for(const demand of demands){
  const variants=set.variants.filter(v=>v.nodeId===demand.componentId);if(!variants.length)continue;
  if(variants.length!==1||set.contractId||!fileKey||fileKey!==demand.fileKey||set.key!==demand.setKey||!demand.childPath.length||!demand.childPath.every(i=>Number.isInteger(i)&&i>=0))throw Error('image-demand-main-identity-unqualified');
  let node:DumpNode|undefined=variants[0];for(const i of demand.childPath){if(node?.type==='INSTANCE')throw Error('image-demand-crosses-instance-owner');node=node?.children?.[i];}
  if(!node?.nodeId||node.nodeId!==demand.sourceNodeId||demand.instanceNodeId!==`I${demand.instanceId};${node.nodeId}`||!['FRAME','RECTANGLE','ELLIPSE'].includes(node.type)||!node.imagePaints?.length)throw Error('image-demand-main-target-unqualified');
  out.set(node.nodeId,[...out.get(node.nodeId)??[],demand]);
 }
 return out;
}

/** Discover differences in captured direct instances without inventing values
 * for missing captures. Unsupported targets remain explicit diagnostic notes. */
export function imageDemandsFromDumps(dump:Record<string,unknown>,fileKey:string,assets:Record<string,DumpImageAsset>={}) {
 const sets=Object.values(dump).filter((v):v is DumpSet=>!!v&&typeof v==='object'&&Array.isArray((v as DumpSet).variants));
 const demands:SourceImageDemand[]=[],notes:string[]=[];
 const visit=(instance:DumpNode)=>{
  if(instance.type==='INSTANCE'&&instance.instanceContent?.root){
   const mains=sets.filter(s=>!s.contractId&&s.key===instance.instanceSetKey&&s.variants.some(v=>v.nodeId===instance.instanceGeometry?.componentId));
   if(mains.length===1){
    const set=mains[0],main=set.variants.find(v=>v.nodeId===instance.instanceGeometry?.componentId)!;
    const scan=(source:DumpNode|undefined,observed:DumpNode,path:number[])=>{
     if(path.length&&(source?.type==='INSTANCE'||observed.type==='INSTANCE')){
      const hasImage=(n:DumpNode):boolean=>!!n.imagePaints?.length||!!n.children?.some(hasImage);
      if(hasImage(observed))notes.push(`${instance.nodeId}:${path.join('.')}: image-demand-crosses-instance-owner`);
      return;
     }
     if(path.length&&observed.imagePaints?.length&&source?.imagePaints?.length&&JSON.stringify(source.imagePaints)!==JSON.stringify(observed.imagePaints)){
      try{demands.push(qualifySourceImageDemand(set,instance,path,fileKey,assets));}
      catch(error){notes.push(`${instance.nodeId}:${path.join('.')}: ${error instanceof Error?error.message:String(error)}`);}
     }
     observed.children?.forEach((child,i)=>scan(source?.children?.[i],child,[...path,i]));
    };scan(main,instance.instanceContent.root,[]);
   }
  }
  instance.children?.forEach(visit);
 };
 sets.forEach(s=>s.variants.forEach(visit));return{demands,notes};
}
