import { COMBOBOX_FIGMA_NAMESPACE } from "./combobox-figma-writer.js";

export interface ComboboxLiveV21CleanupPlan {
  fileKey: string;
  fileName: string;
  editorType: string;
  namespace: string;
  pageName: string;
  runIdentity: string;
  adapterIdentities: readonly string[];
}

export function buildComboboxLiveV21CleanupRuntime(
  plan: ComboboxLiveV21CleanupPlan,
): string {
  const pageOwner = `recipe/combobox/${plan.runIdentity}`;
  const collectionOwner = `${pageOwner}/variable-collection`;
  const collectionNames = plan.adapterIdentities.map(
    (adapterIdentity) =>
      `Recipe Combobox / ${plan.runIdentity} / ${adapterIdentity}`,
  );
  return String.raw`
if(figma.fileKey!==${JSON.stringify(plan.fileKey)}||figma.root.name!==${JSON.stringify(plan.fileName)}||figma.editorType!==${JSON.stringify(plan.editorType)})throw new Error("COMBOBOX-V8-CLEANUP-WRONG-TARGET");
await figma.loadAllPagesAsync();
const CLEANUP_NS=${JSON.stringify(plan.namespace || COMBOBOX_FIGMA_NAMESPACE)};
const CLEANUP_PAGE_NAME=${JSON.stringify(plan.pageName)};
const CLEANUP_RUN_IDENTITY=${JSON.stringify(plan.runIdentity)};
const CLEANUP_PAGE_OWNER=${JSON.stringify(pageOwner)};
const CLEANUP_COLLECTION_OWNER=${JSON.stringify(collectionOwner)};
const CLEANUP_ADAPTERS=new Set(${JSON.stringify(plan.adapterIdentities)});
const CLEANUP_COLLECTION_NAMES=new Set(${JSON.stringify(collectionNames)});
const FORBIDDEN_INPUT_PAGE="115:295378";
const cleanupGet=(target,key)=>{try{return target.getSharedPluginData(CLEANUP_NS,key);}catch{return"";}};
const cleanupPages=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY);
if(cleanupPages.some(page=>page.id===FORBIDDEN_INPUT_PAGE))throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
const cleanupAllCollections=await figma.variables.getLocalVariableCollectionsAsync();
const cleanupOwnedCollections=cleanupAllCollections.filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY);
const cleanupUnexpectedCollections=cleanupOwnedCollections.filter(collection=>!CLEANUP_ADAPTERS.has(cleanupGet(collection,"adapterIdentity"))||!CLEANUP_COLLECTION_NAMES.has(collection.name));
if(cleanupUnexpectedCollections.length>0)throw new Error("COMBOBOX-V8-CLEANUP-OWNED-COLLECTION-UNEXPECTED:"+cleanupUnexpectedCollections.map(collection=>collection.id).join(","));
const cleanupCollections=cleanupOwnedCollections;
if(cleanupPages.length>1)throw new Error("COMBOBOX-V8-CLEANUP-PAGE-DENOMINATOR:"+cleanupPages.map(page=>page.id).join(","));
if(cleanupPages.some(page=>page.name!==CLEANUP_PAGE_NAME))throw new Error("COMBOBOX-V8-CLEANUP-OWNED-PAGE-UNEXPECTED:"+cleanupPages.map(page=>page.id).join(","));
if(new Set(cleanupCollections.map(collection=>cleanupGet(collection,"adapterIdentity"))).size!==cleanupCollections.length)throw new Error("COMBOBOX-V8-CLEANUP-COLLECTION-DENOMINATOR");
const requestedNodeIds=cleanupPages.map(page=>page.id),requestedCollectionIds=cleanupCollections.map(collection=>collection.id);
if(cleanupPages.includes(figma.currentPage)){
  const safePage=figma.root.children.find(page=>!cleanupPages.includes(page)&&page.id!==FORBIDDEN_INPUT_PAGE)||figma.root.children.find(page=>!cleanupPages.includes(page));
  if(!safePage)throw new Error("COMBOBOX-V8-CLEANUP-SAFE-PAGE-ABSENT");
  if(typeof figma.setCurrentPageAsync!=="function")throw new Error("COMBOBOX-V8-CLEANUP-PAGE-SWITCH-API-ABSENT");
  await figma.setCurrentPageAsync(safePage);
  if(figma.currentPage!==safePage)throw new Error("COMBOBOX-V8-CLEANUP-PAGE-SWITCH-FAILED");
}
const removedNodeIds=[],removedCollectionIds=[];
for(const page of cleanupPages){
  if(page.id===FORBIDDEN_INPUT_PAGE)throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
  try{page.remove();}catch(error){if(figma.root.children.some(candidate=>candidate.id===page.id))throw error;}
  if(!figma.root.children.some(candidate=>candidate.id===page.id))removedNodeIds.push(page.id);
}
for(const collection of cleanupCollections){
  try{collection.remove();}catch(error){if((await figma.variables.getLocalVariableCollectionsAsync()).some(candidate=>candidate.id===collection.id))throw error;}
  if(!(await figma.variables.getLocalVariableCollectionsAsync()).some(candidate=>candidate.id===collection.id))removedCollectionIds.push(collection.id);
}
const remainingOwnedNodes=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
const remainingOwnedCollections=(await figma.variables.getLocalVariableCollectionsAsync()).filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
if(remainingOwnedNodes!==0||remainingOwnedCollections!==0)throw new Error("COMBOBOX-V8-CLEANUP-OWNED-LEFTOVERS:"+remainingOwnedNodes+":"+remainingOwnedCollections);
if(!figma.root.children.some(page=>page.id===FORBIDDEN_INPUT_PAGE))throw new Error("COMBOBOX-V8-CLEANUP-INPUT-PAGE-MISSING");
return{requestedNodeIds,removedNodeIds,requestedCollectionIds,removedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:true};`;
}
