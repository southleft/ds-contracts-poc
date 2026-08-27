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
const CLEANUP_COLLECTION_NAMES=new Set(${JSON.stringify(collectionNames)});
const cleanupGet=(target,key)=>{try{return target.getSharedPluginData(CLEANUP_NS,key);}catch{return"";}};
const cleanupPages=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY&&page.name===CLEANUP_PAGE_NAME);
const cleanupCollections=(await figma.variables.getLocalVariableCollectionsAsync()).filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY&&CLEANUP_COLLECTION_NAMES.has(collection.name));
const cleanupNameCollisions=(await figma.variables.getLocalVariableCollectionsAsync()).filter(collection=>CLEANUP_COLLECTION_NAMES.has(collection.name)&&!cleanupCollections.includes(collection));
if(cleanupNameCollisions.length>0)throw new Error("INPUT-V3-CLEANUP-OWNERSHIP-COLLISION:"+cleanupNameCollisions.map(collection=>collection.id).join(","));
if(cleanupPages.length>1)throw new Error("INPUT-V3-CLEANUP-PAGE-DENOMINATOR:"+cleanupPages.map(page=>page.id).join(","));
const requestedNodeIds=cleanupPages.map(page=>page.id),requestedCollectionIds=cleanupCollections.map(collection=>collection.id);
if(cleanupPages.includes(figma.currentPage)){
  const safePage=figma.root.children.find(page=>!cleanupPages.includes(page));
  if(!safePage)throw new Error("INPUT-V3-CLEANUP-SAFE-PAGE-ABSENT");
  await figma.setCurrentPageAsync(safePage);
}
for(const page of cleanupPages)page.remove();
for(const collection of cleanupCollections)collection.remove();
const remainingOwnedNodes=figma.root.children.filter(page=>cleanupGet(page,"pageOwner")===CLEANUP_PAGE_OWNER&&cleanupGet(page,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
const remainingOwnedCollections=(await figma.variables.getLocalVariableCollectionsAsync()).filter(collection=>cleanupGet(collection,"collectionOwner")===CLEANUP_COLLECTION_OWNER&&cleanupGet(collection,"runIdentity")===CLEANUP_RUN_IDENTITY).length;
return{requestedNodeIds,removedNodeIds:requestedNodeIds,requestedCollectionIds,removedCollectionIds:requestedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:remainingOwnedNodes===0&&remainingOwnedCollections===0};`;
}
