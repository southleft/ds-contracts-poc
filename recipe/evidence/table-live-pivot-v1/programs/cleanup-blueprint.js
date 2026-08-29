
const expectedPageId="__WRITER_PAGE_ID__",expectedCollectionIds=["__FP_COLLECTION_ID__","__MUI_COLLECTION_ID__"];
if(expectedPageId==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(expectedPageId==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");

if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("TABLE-V1-CLEANUP-WRONG-TARGET");
await figma.loadAllPagesAsync();
const CLEANUP_NS="ds.contracts.table.recipe.v1";
const CLEANUP_PAGE_NAME="Recipe Pivot / Table / 83a27edf-82d19508-table-v1";
const CLEANUP_RUN_IDENTITY="83a27edf-82d19508-table-v1";
const CLEANUP_PAGE_OWNER="recipe/table/83a27edf-82d19508-table-v1";
const CLEANUP_COLLECTION_OWNER="recipe/table/83a27edf-82d19508-table-v1/variable-collection";
const CLEANUP_ADAPTERS=new Set(["first-party-table-reviewed-v1","material-table-reviewed-v1"]);
const CLEANUP_COLLECTION_NAMES=new Set(["Recipe Table / 83a27edf-82d19508-table-v1 / first-party-table-reviewed-v1","Recipe Table / 83a27edf-82d19508-table-v1 / material-table-reviewed-v1"]);
const FORBIDDEN_INPUT_PAGE="115:295378";
const FORBIDDEN_COMBOBOX_PAGE="163:35981";
const cleanupGet=(target,key)=>{try{return target.getSharedPluginData(CLEANUP_NS,key);}catch{return"";}};
const cleanupPages=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY);
if(cleanupPages.some(page=>page.id===FORBIDDEN_INPUT_PAGE))throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(cleanupPages.some(page=>page.id===FORBIDDEN_COMBOBOX_PAGE))throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
const cleanupAllCollections=await figma.variables.getLocalVariableCollectionsAsync();
const cleanupOwnedCollections=cleanupAllCollections.filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY);
const cleanupUnexpectedCollections=cleanupOwnedCollections.filter(collection=>!CLEANUP_ADAPTERS.has(cleanupGet(collection,"adapterIdentity"))||!CLEANUP_COLLECTION_NAMES.has(collection.name));
if(cleanupUnexpectedCollections.length>0)throw new Error("TABLE-V1-CLEANUP-OWNED-COLLECTION-UNEXPECTED:"+cleanupUnexpectedCollections.map(collection=>collection.id).join(","));
const cleanupCollections=cleanupOwnedCollections;
if(cleanupPages.length>1)throw new Error("TABLE-V1-CLEANUP-PAGE-DENOMINATOR:"+cleanupPages.map(page=>page.id).join(","));
if(cleanupPages.some(page=>page.name!==CLEANUP_PAGE_NAME))throw new Error("TABLE-V1-CLEANUP-OWNED-PAGE-UNEXPECTED:"+cleanupPages.map(page=>page.id).join(","));
if(new Set(cleanupCollections.map(collection=>cleanupGet(collection,"adapterIdentity"))).size!==cleanupCollections.length)throw new Error("TABLE-V1-CLEANUP-COLLECTION-DENOMINATOR");
const requestedNodeIds=cleanupPages.map(page=>page.id),requestedCollectionIds=cleanupCollections.map(collection=>collection.id);
if(cleanupPages.includes(figma.currentPage)){
  const safePage=figma.root.children.find(page=>!cleanupPages.includes(page)&&page.id!==FORBIDDEN_INPUT_PAGE&&page.id!==FORBIDDEN_COMBOBOX_PAGE)||figma.root.children.find(page=>!cleanupPages.includes(page));
  if(!safePage)throw new Error("TABLE-V1-CLEANUP-SAFE-PAGE-ABSENT");
  if(typeof figma.setCurrentPageAsync!=="function")throw new Error("TABLE-V1-CLEANUP-PAGE-SWITCH-API-ABSENT");
  await figma.setCurrentPageAsync(safePage);
  if(figma.currentPage!==safePage)throw new Error("TABLE-V1-CLEANUP-PAGE-SWITCH-FAILED");
}
const removedNodeIds=[],removedCollectionIds=[];
for(const page of cleanupPages){
  if(page.id===FORBIDDEN_INPUT_PAGE)throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
  if(page.id===FORBIDDEN_COMBOBOX_PAGE)throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
  try{page.remove();}catch(error){if(figma.root.children.some(candidate=>candidate.id===page.id))throw error;}
  if(!figma.root.children.some(candidate=>candidate.id===page.id))removedNodeIds.push(page.id);
}
for(const collection of cleanupCollections){
  try{collection.remove();}catch(error){if((await figma.variables.getLocalVariableCollectionsAsync()).some(candidate=>candidate.id===collection.id))throw error;}
  if(!(await figma.variables.getLocalVariableCollectionsAsync()).some(candidate=>candidate.id===collection.id))removedCollectionIds.push(collection.id);
}
const remainingOwnedNodes=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
const remainingOwnedCollections=(await figma.variables.getLocalVariableCollectionsAsync()).filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
if(remainingOwnedNodes!==0||remainingOwnedCollections!==0)throw new Error("TABLE-V1-CLEANUP-OWNED-LEFTOVERS:"+remainingOwnedNodes+":"+remainingOwnedCollections);
if(!figma.root.children.some(page=>page.id===FORBIDDEN_INPUT_PAGE))throw new Error("TABLE-V1-CLEANUP-INPUT-PAGE-MISSING");
if(!figma.root.children.some(page=>page.id===FORBIDDEN_COMBOBOX_PAGE))throw new Error("TABLE-V1-CLEANUP-COMBOBOX-PAGE-MISSING");
if(JSON.stringify(requestedNodeIds)!==JSON.stringify([expectedPageId])||JSON.stringify([...requestedCollectionIds].sort())!==JSON.stringify([...expectedCollectionIds].sort()))throw new Error("TABLE-V1-CLEANUP-EXACT-OWNERSHIP");return{requestedNodeIds,removedNodeIds,requestedCollectionIds,removedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:true};
