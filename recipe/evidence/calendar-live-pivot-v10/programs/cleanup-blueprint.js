
const expectedPageId="__WRITER_PAGE_ID__",expectedCollectionIds=["__ASTRYX_COLLECTION_ID__"];
if(expectedPageId==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(expectedPageId==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");

if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("CALENDAR-V5-CLEANUP-WRONG-TARGET");
await figma.loadAllPagesAsync();
const CLEANUP_NS="ds.contracts.calendar.recipe.v1";
const CLEANUP_PAGE_NAME="Recipe Pivot / Calendar / 19be1c96-calendar-v10";
const CLEANUP_RUN_IDENTITY="19be1c96-calendar-v10";
const CLEANUP_PAGE_OWNER="recipe/calendar/19be1c96-calendar-v10";
const CLEANUP_COLLECTION_OWNER="recipe/calendar/19be1c96-calendar-v10/variable-collection";
const CLEANUP_ADAPTERS=new Set(["astryx-calendar-reviewed-v1"]);
const CLEANUP_COLLECTION_NAMES=new Set(["Recipe Calendar / 19be1c96-calendar-v10 / astryx-calendar-reviewed-v1"]);
const FORBIDDEN_INPUT_PAGE="115:295378";
const FORBIDDEN_COMBOBOX_PAGE="163:35981";
const FORBIDDEN_BUTTON_PAGE="85:6781";
const FORBIDDEN_TABLE_PAGE="173:48924";
const cleanupGet=(target,key)=>{try{return target.getSharedPluginData(CLEANUP_NS,key);}catch{return"";}};
const cleanupPages=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY);
if(cleanupPages.some(page=>page.id===FORBIDDEN_INPUT_PAGE))throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(cleanupPages.some(page=>page.id===FORBIDDEN_COMBOBOX_PAGE))throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(cleanupPages.some(page=>page.id===FORBIDDEN_BUTTON_PAGE))throw new Error("CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE");
if(cleanupPages.some(page=>page.id===FORBIDDEN_TABLE_PAGE))throw new Error("CALENDAR-MUST-NOT-WRITE-TABLE-PAGE");
const cleanupAllCollections=await figma.variables.getLocalVariableCollectionsAsync();
const cleanupOwnedCollections=cleanupAllCollections.filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY);
const cleanupUnexpectedCollections=cleanupOwnedCollections.filter(collection=>!CLEANUP_ADAPTERS.has(cleanupGet(collection,"adapterIdentity"))||!CLEANUP_COLLECTION_NAMES.has(collection.name));
if(cleanupUnexpectedCollections.length>0)throw new Error("CALENDAR-V5-CLEANUP-OWNED-COLLECTION-UNEXPECTED:"+cleanupUnexpectedCollections.map(collection=>collection.id).join(","));
const cleanupCollections=cleanupOwnedCollections;
if(cleanupPages.length>1)throw new Error("CALENDAR-V5-CLEANUP-PAGE-DENOMINATOR:"+cleanupPages.map(page=>page.id).join(","));
if(cleanupPages.some(page=>page.name!==CLEANUP_PAGE_NAME))throw new Error("CALENDAR-V5-CLEANUP-OWNED-PAGE-UNEXPECTED:"+cleanupPages.map(page=>page.id).join(","));
if(new Set(cleanupCollections.map(collection=>cleanupGet(collection,"adapterIdentity"))).size!==cleanupCollections.length)throw new Error("CALENDAR-V5-CLEANUP-COLLECTION-DENOMINATOR");
const requestedNodeIds=cleanupPages.map(page=>page.id),requestedCollectionIds=cleanupCollections.map(collection=>collection.id);
if(cleanupPages.includes(figma.currentPage)){
  const safePage=figma.root.children.find(page=>!cleanupPages.includes(page)&&page.id!==FORBIDDEN_INPUT_PAGE&&page.id!==FORBIDDEN_COMBOBOX_PAGE&&page.id!==FORBIDDEN_BUTTON_PAGE&&page.id!==FORBIDDEN_TABLE_PAGE)||figma.root.children.find(page=>!cleanupPages.includes(page));
  if(!safePage)throw new Error("CALENDAR-V5-CLEANUP-SAFE-PAGE-ABSENT");
  if(typeof figma.setCurrentPageAsync!=="function")throw new Error("CALENDAR-V5-CLEANUP-PAGE-SWITCH-API-ABSENT");
  await figma.setCurrentPageAsync(safePage);
  if(figma.currentPage!==safePage)throw new Error("CALENDAR-V5-CLEANUP-PAGE-SWITCH-FAILED");
}
const removedNodeIds=[],removedCollectionIds=[];
for(const page of cleanupPages){
  if(page.id===FORBIDDEN_INPUT_PAGE)throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
  if(page.id===FORBIDDEN_COMBOBOX_PAGE)throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
  if(page.id===FORBIDDEN_BUTTON_PAGE)throw new Error("CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE");
  if(page.id===FORBIDDEN_TABLE_PAGE)throw new Error("CALENDAR-MUST-NOT-WRITE-TABLE-PAGE");
  try{page.remove();}catch(error){if(figma.root.children.some(candidate=>candidate.id===page.id))throw error;}
  if(!figma.root.children.some(candidate=>candidate.id===page.id))removedNodeIds.push(page.id);
}
for(const collection of cleanupCollections){
  try{collection.remove();}catch(error){if((await figma.variables.getLocalVariableCollectionsAsync()).some(candidate=>candidate.id===collection.id))throw error;}
  if(!(await figma.variables.getLocalVariableCollectionsAsync()).some(candidate=>candidate.id===collection.id))removedCollectionIds.push(collection.id);
}
const remainingOwnedNodes=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
const remainingOwnedCollections=(await figma.variables.getLocalVariableCollectionsAsync()).filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
if(remainingOwnedNodes!==0||remainingOwnedCollections!==0)throw new Error("CALENDAR-V5-CLEANUP-OWNED-LEFTOVERS:"+remainingOwnedNodes+":"+remainingOwnedCollections);
if(!figma.root.children.some(page=>page.id===FORBIDDEN_INPUT_PAGE))throw new Error("CALENDAR-V5-CLEANUP-INPUT-PAGE-MISSING");
if(!figma.root.children.some(page=>page.id===FORBIDDEN_COMBOBOX_PAGE))throw new Error("CALENDAR-V5-CLEANUP-COMBOBOX-PAGE-MISSING");
if(!figma.root.children.some(page=>page.id===FORBIDDEN_BUTTON_PAGE))throw new Error("CALENDAR-V5-CLEANUP-BUTTON-PAGE-MISSING");
if(!figma.root.children.some(page=>page.id===FORBIDDEN_TABLE_PAGE))throw new Error("CALENDAR-V5-CLEANUP-TABLE-PAGE-MISSING");
if(JSON.stringify(requestedNodeIds)!==JSON.stringify([expectedPageId])||JSON.stringify([...requestedCollectionIds].sort())!==JSON.stringify([...expectedCollectionIds].sort()))throw new Error("CALENDAR-V5-CLEANUP-EXACT-OWNERSHIP");return{requestedNodeIds,removedNodeIds,requestedCollectionIds,removedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:true};
