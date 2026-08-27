export interface InputLiveV3CleanupResult {
  requestedNodeIds: string[];
  removedNodeIds: string[];
  requestedCollectionIds: string[];
  removedCollectionIds: string[];
  remainingOwnedNodes: number;
  remainingOwnedCollections: number;
  complete: boolean;
}

export interface InputLiveV3CleanupPlan {
  fileKey: string;
  fileName: string;
  editorType: string;
  namespace: string;
  pageName: string;
  runIdentity: string;
  adapterIdentities: readonly string[];
}

export interface InputLiveV3AttemptPhase<T = unknown> {
  name: "verification" | "extraction" | "evidence";
  run: (previous: unknown) => Promise<T>;
}

export interface InputLiveV3AttemptPhaseResult {
  values: unknown[];
  failure?: unknown;
  failedPhase?: InputLiveV3AttemptPhase["name"];
  cleanup: InputLiveV3CleanupResult;
}

/**
 * Cleanup is outside every attempt phase, so failures before extraction,
 * during extraction, or while collecting evidence take the same finally path.
 */
export async function runInputLiveV3PhasesWithCleanup(
  phases: readonly InputLiveV3AttemptPhase[],
  cleanup: () => Promise<InputLiveV3CleanupResult>,
): Promise<InputLiveV3AttemptPhaseResult> {
  const values: unknown[] = [];
  let failure: unknown;
  let failedPhase: InputLiveV3AttemptPhase["name"] | undefined;
  let cleanupResult: InputLiveV3CleanupResult | undefined;
  try {
    let previous: unknown;
    for (const phase of phases) {
      try {
        previous = await phase.run(previous);
        values.push(previous);
      } catch (error) {
        failure = error;
        failedPhase = phase.name;
        break;
      }
    }
  } finally {
    cleanupResult = await cleanup();
  }
  return { values, failure, failedPhase, cleanup: cleanupResult };
}

export function buildInputLiveV3CleanupRuntime(
  plan: InputLiveV3CleanupPlan,
): string {
  const pageOwner = `recipe/input-field/${plan.runIdentity}`;
  const collectionOwner = `${pageOwner}/variable-collection`;
  const collectionNames = plan.adapterIdentities.map(
    (adapterIdentity) =>
      `Recipe Input / ${plan.runIdentity} / ${adapterIdentity}`,
  );
  return String.raw`
if(figma.fileKey!==${JSON.stringify(plan.fileKey)}||figma.root.name!==${JSON.stringify(plan.fileName)}||figma.editorType!==${JSON.stringify(plan.editorType)})throw new Error("INPUT-V3-CLEANUP-WRONG-TARGET");
await figma.loadAllPagesAsync();
const CLEANUP_NS=${JSON.stringify(plan.namespace)};
const CLEANUP_PAGE_NAME=${JSON.stringify(plan.pageName)};
const CLEANUP_RUN_IDENTITY=${JSON.stringify(plan.runIdentity)};
const CLEANUP_PAGE_OWNER=${JSON.stringify(pageOwner)};
const CLEANUP_COLLECTION_OWNER=${JSON.stringify(collectionOwner)};
const CLEANUP_ADAPTERS=new Set(${JSON.stringify(plan.adapterIdentities)});
const CLEANUP_COLLECTION_NAMES=new Set(${JSON.stringify(collectionNames)});
const cleanupGet=(target,key)=>{try{return target.getSharedPluginData(CLEANUP_NS,key);}catch{return"";}};
const cleanupPages=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY);
const cleanupAllCollections=await figma.variables.getLocalVariableCollectionsAsync();
const cleanupOwnedCollections=cleanupAllCollections.filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY);
const cleanupUnexpectedCollections=cleanupOwnedCollections.filter(collection=>!CLEANUP_ADAPTERS.has(cleanupGet(collection,"adapterIdentity"))||!CLEANUP_COLLECTION_NAMES.has(collection.name));
if(cleanupUnexpectedCollections.length>0)throw new Error("INPUT-V3-CLEANUP-OWNED-COLLECTION-UNEXPECTED:"+cleanupUnexpectedCollections.map(collection=>collection.id).join(","));
const cleanupCollections=cleanupOwnedCollections;
if(cleanupPages.length>1)throw new Error("INPUT-V3-CLEANUP-PAGE-DENOMINATOR:"+cleanupPages.map(page=>page.id).join(","));
if(cleanupPages.some(page=>page.name!==CLEANUP_PAGE_NAME))throw new Error("INPUT-V3-CLEANUP-OWNED-PAGE-UNEXPECTED:"+cleanupPages.map(page=>page.id).join(","));
if(new Set(cleanupCollections.map(collection=>cleanupGet(collection,"adapterIdentity"))).size!==cleanupCollections.length)throw new Error("INPUT-V3-CLEANUP-COLLECTION-DENOMINATOR");
const requestedNodeIds=cleanupPages.map(page=>page.id),requestedCollectionIds=cleanupCollections.map(collection=>collection.id);
if(cleanupPages.includes(figma.currentPage)){
  const safePage=figma.root.children.find(page=>!cleanupPages.includes(page));
  if(!safePage)throw new Error("INPUT-V3-CLEANUP-SAFE-PAGE-ABSENT");
  if(typeof figma.setCurrentPageAsync!=="function")throw new Error("INPUT-V3-CLEANUP-PAGE-SWITCH-API-ABSENT");
  await figma.setCurrentPageAsync(safePage);
  if(figma.currentPage!==safePage)throw new Error("INPUT-V3-CLEANUP-PAGE-SWITCH-FAILED");
}
const removedNodeIds=[],removedCollectionIds=[];
for(const page of cleanupPages){
  try{page.remove();}catch(error){if(figma.root.children.some(candidate=>candidate.id===page.id))throw error;}
  if(!figma.root.children.some(candidate=>candidate.id===page.id))removedNodeIds.push(page.id);
}
for(const collection of cleanupCollections){
  try{collection.remove();}catch(error){if((await figma.variables.getLocalVariableCollectionsAsync()).some(candidate=>candidate.id===collection.id))throw error;}
  if(!(await figma.variables.getLocalVariableCollectionsAsync()).some(candidate=>candidate.id===collection.id))removedCollectionIds.push(collection.id);
}
const remainingOwnedNodes=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
const remainingOwnedCollections=(await figma.variables.getLocalVariableCollectionsAsync()).filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
if(remainingOwnedNodes!==0||remainingOwnedCollections!==0)throw new Error("INPUT-V3-CLEANUP-OWNED-LEFTOVERS:"+remainingOwnedNodes+":"+remainingOwnedCollections);
return{requestedNodeIds,removedNodeIds,requestedCollectionIds,removedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:true};`;
}
