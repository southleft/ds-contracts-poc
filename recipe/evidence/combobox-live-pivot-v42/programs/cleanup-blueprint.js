
const expectedPageId="__WRITER_PAGE_ID__",expectedCollectionIds=["__MUI_COLLECTION_ID__","__ANTD_COLLECTION_ID__"];
if(expectedPageId==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");

if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("COMBOBOX-V8-CLEANUP-WRONG-TARGET");
await figma.loadAllPagesAsync();
const CLEANUP_NS="ds.contracts.combobox.recipe.v1";
const CLEANUP_PAGE_NAME="Recipe Pivot / Combobox / 58ef8274-85b2f4a0-combobox-v1";
const CLEANUP_RUN_IDENTITY="58ef8274-85b2f4a0-combobox-v1";
const CLEANUP_PAGE_OWNER="recipe/combobox/58ef8274-85b2f4a0-combobox-v1";
const CLEANUP_COLLECTION_OWNER="recipe/combobox/58ef8274-85b2f4a0-combobox-v1/variable-collection";
const CLEANUP_ADAPTERS=new Set(["material-combobox-reviewed-v1","commerce-combobox-reviewed-v1"]);
const CLEANUP_COLLECTION_NAMES=new Set(["Recipe Combobox / 58ef8274-85b2f4a0-combobox-v1 / material-combobox-reviewed-v1","Recipe Combobox / 58ef8274-85b2f4a0-combobox-v1 / commerce-combobox-reviewed-v1"]);
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
if(JSON.stringify(requestedNodeIds)!==JSON.stringify([expectedPageId])||JSON.stringify([...requestedCollectionIds].sort())!==JSON.stringify([...expectedCollectionIds].sort()))throw new Error("COMBOBOX-V8-CLEANUP-EXACT-OWNERSHIP");return{requestedNodeIds,removedNodeIds,requestedCollectionIds,removedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:true};
