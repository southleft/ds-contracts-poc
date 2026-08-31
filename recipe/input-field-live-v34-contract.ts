import { createHash } from "node:crypto";

import type { RecipeEnvelope } from "./envelope.js";
import type { LocalVariableRecord } from "./figma-property-normalizer-v8.js";
import { FIGMA_PORTABLE_RUNTIME } from "./figma-runtime-portability.js";
import { buildInputLiveV3CleanupRuntime } from "./input-field-live-v3-cleanup.js";
import {
  verifyInputLiveV3SceneFixedPoint,
  type InputLiveV3FixedPoint,
} from "./input-field-live-v3-verifier-v34.js";
import {
  buildInputLiveV34RawPropertyRuntime,
  normalizeInputLiveV34Scene,
  type InputLiveV34RawNode,
} from "./input-field-live-v34-verifier.js";
import { measureVisualPair } from "./input-field-objective-comparison-v1.js";
import { canonicalJson } from "./normalize.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-v34.js";
import {
  compareSceneToExpectedPlan,
  type ExpectedScenePlan,
  type SceneComparison,
} from "./scene-readback-v34.js";

export {
  buildInputLiveV34RestoreProgram,
  validateInputLiveV34RestorePayload,
  type InputLiveV34RestorePayload,
} from "./input-field-live-v34-restore.js";

export const INPUT_LIVE_V34_NAMESPACE = "ds.contracts.input.recipe.v5";
export const INPUT_LIVE_V34_SOURCE_IDS = ["mui", "polaris"] as const;
export const INPUT_LIVE_V34_ADAPTERS = [
  "material-text-field-reviewed-v1",
  "commerce-text-field-reviewed-v1",
] as const;
export const INPUT_LIVE_V34_CAPTURE_COUNT = 128;
export const INPUT_LIVE_V34_VARIANT_COUNT = 256;
export const INPUT_LIVE_V34_CAPTURE_MAX_PNG_BYTES = 1_500_000;
export const INPUT_LIVE_V34_CAPTURE_MAX_RAW_RESPONSE_BYTES = 2_100_000;

export type InputLiveV34SourceId = (typeof INPUT_LIVE_V34_SOURCE_IDS)[number];

export interface InputLiveV34SourceIdentity {
  source: InputLiveV34SourceId;
  adapterIdentity: string;
  recipeHash: string;
  envelopeHash: string;
  expectedScenePlan: ExpectedScenePlan;
}

export interface InputLiveV34WriterOwnership {
  pageId: string;
  pageName: string;
  runIdentity: string;
  setIds: [string, string];
  sectionIds: [string, string];
  collectionIds: [string, string];
  createdNodeIds: string[];
  sources: Array<{
    adapterIdentity: string;
    setId: string;
    sectionId: string;
    collectionId: string;
    variableCount: number;
    variantCount: 128;
    cellCount: 128;
    recipeHash: string;
    envelopeHash: string;
  }>;
  counts: {
    sources: 2;
    variants: 256;
    collections: 2;
    nodes: number;
  };
}

export interface InputLiveV34ExtractPayload {
  pageId: string;
  roots: Array<{
    source: InputLiveV34SourceId;
    adapterIdentity: string;
    setId: string;
    scene: InputLiveV34RawNode;
    lineage: Array<{
      nodeId: string;
      parentNodeId: string | null;
      type: string;
      explicitOwnershipKey: string | null;
      mainComponentId: string | null;
      mainComponentRef: string | null;
    }>;
  }>;
  variableTable: LocalVariableRecord[];
}

export interface InputLiveV34RootProof {
  source: InputLiveV34SourceId;
  adapterIdentity: string;
  accounting: SceneComparison;
  fixedPoint: InputLiveV3FixedPoint;
}

export interface InputLiveV34ProbePayload {
  pageId: string;
  sources: Array<{
    source: InputLiveV34SourceId;
    adapterIdentity: string;
    variants: 128;
    visitedVariants: 128;
    reflowPassed: boolean;
    contentFillPassed: boolean;
    bindingCompatibilityPassed: boolean;
    noFakeLayoutPassed: boolean;
    adornmentPayloadPassed: boolean;
    stateSemanticsPassed: boolean;
    switchingRestored: boolean;
    textPropertiesRestored: boolean;
    exactSceneRestoration: boolean;
  }>;
  cells: Array<{
    source: InputLiveV34SourceId;
    adapterIdentity: string;
    cellKey: string;
    rolesExact: boolean;
    stateSemanticsExact: boolean;
    adornmentPayloadExact: boolean;
    noFakeLayout: boolean;
    visibleAreaLoss: number;
    overlapPixels: number;
  }>;
}

export interface InputLiveV34CaptureCell {
  index: number;
  cellKey: string;
  source: InputLiveV34SourceId;
  adapterIdentity: string;
  axes: {
    size: string;
    state: string;
    content: string;
    required: string;
    adornments: string;
  };
  strata: {
    source: InputLiveV34SourceId;
    state: string;
    adornment: string;
  };
  reference: {
    path: string;
    sha256: string;
    width: number;
    height: number;
    contentBox: { width: number; height: number };
  };
  legacy: { geometry: number; perceptual: number; pixelInk: number };
}

export interface InputLiveV34CapturePayload {
  index: number;
  cellKey: string;
  source: InputLiveV34SourceId;
  strata: InputLiveV34CaptureCell["strata"];
  referenceSha256: string;
  frameWidth: number;
  frameHeight: number;
  componentWidth: number;
  componentHeight: number;
  pngBytes: number;
  pngSha256: string;
  pngBase64: string;
  temporaryNodesRemaining: 0;
}

export interface InputLiveV34CleanupPayload {
  requestedNodeIds: string[];
  removedNodeIds: string[];
  requestedCollectionIds: string[];
  removedCollectionIds: string[];
  remainingOwnedNodes: number;
  remainingOwnedCollections: number;
  complete: boolean;
}

const SHA256 = /^[a-f0-9]{64}$/;
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const record = (value: unknown, label: string): Record<string, any> => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`Input live v12 ${label} must be an object`);
  return value as Record<string, any>;
};
const exactUniqueStrings = (
  value: unknown,
  count: number,
  label: string,
): string[] => {
  if (
    !Array.isArray(value) ||
    value.length !== count ||
    value.some((entry) => typeof entry !== "string" || entry.length === 0) ||
    new Set(value).size !== count
  )
    throw new TypeError(
      `Input live v12 ${label} cardinality/identity mismatch`,
    );
  return value;
};
const finiteNonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export function validateInputLiveV34WriterPayload(
  value: unknown,
): InputLiveV34WriterOwnership {
  const envelope = record(value, "writer payload");
  const result = record(envelope.result ?? envelope, "writer result");
  const sources = result.sources;
  if (
    typeof result.pageId !== "string" ||
    !result.pageId ||
    typeof result.pageName !== "string" ||
    !result.pageName ||
    typeof result.runIdentity !== "string" ||
    !result.runIdentity ||
    !Array.isArray(sources) ||
    sources.length !== 2 ||
    new Set(sources.map((source: any) => source.adapterIdentity)).size !== 2 ||
    sources.some(
      (source: any) =>
        typeof source.setId !== "string" ||
        typeof source.sectionId !== "string" ||
        typeof source.collectionId !== "string" ||
        source.variantCount !== 128 ||
        source.cellCount !== 128 ||
        !Number.isInteger(source.variableCount) ||
        source.variableCount <= 0 ||
        !SHA256.test(source.recipeHash) ||
        !SHA256.test(source.envelopeHash),
    )
  )
    throw new TypeError("Input live v12 writer schema/cardinality mismatch");
  const createdNodeIds = result.createdNodeIds;
  if (
    !Array.isArray(createdNodeIds) ||
    createdNodeIds.length === 0 ||
    createdNodeIds.some((id: unknown) => typeof id !== "string" || !id) ||
    new Set(createdNodeIds).size !== createdNodeIds.length
  )
    throw new TypeError(
      "Input live v12 writer created-node denominator invalid",
    );
  return {
    pageId: result.pageId,
    pageName: result.pageName,
    runIdentity: result.runIdentity,
    setIds: sources.map((source: any) => source.setId) as [string, string],
    sectionIds: sources.map((source: any) => source.sectionId) as [
      string,
      string,
    ],
    collectionIds: sources.map((source: any) => source.collectionId) as [
      string,
      string,
    ],
    createdNodeIds,
    sources,
    counts: {
      sources: 2,
      variants: 256,
      collections: 2,
      nodes: createdNodeIds.length,
    },
  };
}

const identityPlan = (source: InputLiveV34SourceIdentity) => ({
  directOwnershipKeys: [
    ...new Set(
      source.expectedScenePlan.facts.map((fact) => fact.nodeOwnershipKey),
    ),
  ],
  generatedDescendants: source.expectedScenePlan.generatedDescendants,
  runIdentity: "",
  adapterIdentity: source.adapterIdentity,
  recipeHash: source.recipeHash,
  envelopeHash: source.envelopeHash,
});

export function buildInputLiveV34ExtractProgram(
  writer: InputLiveV34WriterOwnership,
  sources: readonly InputLiveV34SourceIdentity[],
): string {
  if (sources.length !== 2)
    throw new TypeError(
      "Input live v12 extract requires two source identities",
    );
  const identities = Object.fromEntries(
    sources.map((source) => [
      source.adapterIdentity,
      { ...identityPlan(source), runIdentity: writer.runIdentity },
    ]),
  );
  return String.raw`
await figma.loadAllPagesAsync();
const V7_NS=${JSON.stringify(INPUT_LIVE_V34_NAMESPACE)};
const V7_PAGE_ID=${JSON.stringify(writer.pageId)};
const V7_SET_IDS=new Set(${JSON.stringify(writer.setIds)});
const V7_SOURCE_BY_ADAPTER=${JSON.stringify(
    Object.fromEntries(
      sources.map((source) => [source.adapterIdentity, source.source]),
    ),
  )};
const V7_IDENTITIES=${JSON.stringify(identities)};
${buildFigmaSceneReadbackRuntime(INPUT_LIVE_V34_NAMESPACE)}
${buildInputLiveV34RawPropertyRuntime()}
const page=await figma.getNodeByIdAsync(V7_PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("INPUT-V9-EXTRACT-PAGE");
const get=(node,key)=>node.getSharedPluginData(V7_NS,key);
if(get(page,"pageOwner")!=="recipe/input-field/"+${JSON.stringify(writer.runIdentity)})throw new Error("INPUT-V9-EXTRACT-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>V7_SET_IDS.has(node.id));
if(sets.length!==2)throw new Error("INPUT-V9-EXTRACT-ROOTS:"+sets.length);
const lineageFor=async root=>{
  const rows=[];
  const visit=async(node,parentNodeId)=>{
    const main=node.type==="INSTANCE"?await node.getMainComponentAsync():null;
    const marker=" / ",name=main?main.name:"",at=name.lastIndexOf(marker);
    rows.push({nodeId:node.id,parentNodeId,type:node.type,explicitOwnershipKey:get(node,"ownershipKey")||null,mainComponentId:main?main.id:null,mainComponentRef:main?(at<0?name:name.slice(at+marker.length)):null});
    if("children" in node)for(const child of node.children)await visit(child,node.id);
  };
  await visit(root,null);
  return rows;
};
const roots=[];
for(const set of sets){
  const adapterIdentity=get(set,"adapterIdentity"),expected=V7_IDENTITIES[adapterIdentity];
  if(!expected)throw new Error("INPUT-V9-EXTRACT-ADAPTER:"+adapterIdentity);
  const scene=await readSceneDerivedTree(set,expected,expected);
  const decorate=async(node,snapshot)=>{
    Object.assign(snapshot,inputV4RawNodeProperties(node));
    if("children" in node)for(let index=0;index<node.children.length;index++)await decorate(node.children[index],snapshot.children[index]);
  };
  await decorate(set,scene);
  roots.push({source:V7_SOURCE_BY_ADAPTER[adapterIdentity],adapterIdentity,setId:set.id,scene,lineage:await lineageFor(set)});
}
roots.sort((a,b)=>a.source.localeCompare(b.source));
return{pageId:page.id,roots,variableTable:await inputV4CaptureVariableTable()};`;
}

const forbiddenExtractKeys = (value: unknown, path = "$"): string[] => {
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      forbiddenExtractKeys(child, `${path}[${index}]`),
    );
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => [
      ...(/^(?:ir|sourceIr|expected|expectedPlan|facts|typedReceipts)$/i.test(
        key,
      )
        ? [`${path}.${key}`]
        : []),
      ...forbiddenExtractKeys(child, `${path}.${key}`),
    ],
  );
};

export function validateInputLiveV34ExtractPayload(
  value: unknown,
  writer: InputLiveV34WriterOwnership,
): InputLiveV34ExtractPayload {
  const payload = record(value, "extract payload");
  const leaks = forbiddenExtractKeys(payload);
  if (leaks.length)
    throw new TypeError(
      `Input live v12 extract contains source IR facts: ${leaks.join(",")}`,
    );
  if (
    payload.pageId !== writer.pageId ||
    !Array.isArray(payload.roots) ||
    payload.roots.length !== 2 ||
    new Set(payload.roots.map((root: any) => root.source)).size !== 2 ||
    new Set(payload.roots.map((root: any) => root.adapterIdentity)).size !==
      2 ||
    new Set(payload.roots.map((root: any) => root.setId)).size !== 2 ||
    payload.roots.some(
      (root: any) =>
        !INPUT_LIVE_V34_SOURCE_IDS.includes(root.source) ||
        !writer.setIds.includes(root.setId) ||
        !root.scene ||
        root.scene.ownershipKey !== "root" ||
        !Array.isArray(root.lineage) ||
        root.lineage.length === 0 ||
        new Set(root.lineage.map((entry: any) => entry.nodeId)).size !==
          root.lineage.length,
    ) ||
    !Array.isArray(payload.variableTable) ||
    payload.variableTable.length === 0 ||
    payload.variableTable.some(
      (variable: any) =>
        typeof variable.id !== "string" ||
        typeof variable.name !== "string" ||
        typeof variable.collectionId !== "string" ||
        variable.remote !== false,
    )
  )
    throw new TypeError("Input live v12 extract schema/two-root mismatch");
  return payload as InputLiveV34ExtractPayload;
}

export function proveInputLiveV34Roots<Instance>(
  extract: InputLiveV34ExtractPayload,
  sources: readonly (InputLiveV34SourceIdentity & {
    envelope: RecipeEnvelope;
    selection: unknown;
  })[],
  collapse: (envelope: unknown, selection: unknown) => Instance,
  compile: (instance: unknown) => RecipeEnvelope,
): InputLiveV34RootProof[] {
  if (extract.roots.length !== 2 || sources.length !== 2)
    throw new TypeError("Input live v12 proof requires two independent roots");
  return sources.map((source) => {
    const root = extract.roots.find(
      (candidate) =>
        candidate.source === source.source &&
        candidate.adapterIdentity === source.adapterIdentity,
    );
    if (!root)
      throw new TypeError(`Input live v12 omitted ${source.source} root`);
    const normalized = normalizeInputLiveV34Scene(
      root.scene,
      extract.variableTable,
    );
    const accounting = compareSceneToExpectedPlan(
      source.expectedScenePlan,
      normalized.scene,
    );
    const fixedPoint = verifyInputLiveV3SceneFixedPoint(
      normalized.scene,
      source.envelope,
      source.selection,
      collapse,
      compile,
    );
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      accounting,
      fixedPoint,
    };
  });
}

export function assertInputLiveV34RootProofs(
  proofs: readonly InputLiveV34RootProof[],
): void {
  if (
    proofs.length !== 2 ||
    new Set(proofs.map((proof) => proof.source)).size !== 2
  )
    throw new TypeError("Input live v12 two-root proof denominator invalid");
  const failures = proofs.flatMap((proof) => {
    const accounting = proof.accounting;
    return !accounting.ok ||
      accounting.denominator <= 0 ||
      accounting.missing.length ||
      accounting.extra.length ||
      accounting.mismatched.length ||
      accounting.duplicateCollapsed.length ||
      accounting.unobserved.length ||
      accounting.silent !== 0
      ? [
          `${proof.source}:missing=${accounting.missing.length},extra=${accounting.extra.length},mismatch=${accounting.mismatched.length},duplicate=${accounting.duplicateCollapsed.length},unobserved=${accounting.unobserved.length},silent=${accounting.silent}`,
        ]
      : !proof.fixedPoint.stable ||
          proof.fixedPoint.sourceIrRead !== false ||
          proof.fixedPoint.cycle1SceneIrSha256 !==
            proof.fixedPoint.cycle2SceneIrSha256 ||
          proof.fixedPoint.cycle1CompiledIrSha256 !==
            proof.fixedPoint.cycle2CompiledIrSha256
        ? [`${proof.source}:fixed-point`]
        : [];
  });
  if (failures.length)
    throw new TypeError(
      `Input live v12 independent root accounting failed: ${failures.join(";")}`,
    );
}

export function buildInputLiveV34ProbeProgram(
  writer: InputLiveV34WriterOwnership,
  sources: readonly InputLiveV34SourceIdentity[],
): string {
  const sourceByAdapter = Object.fromEntries(
    sources.map((source) => [source.adapterIdentity, source.source]),
  );
  return String.raw`
await figma.loadAllPagesAsync();
const V7_NS=${JSON.stringify(INPUT_LIVE_V34_NAMESPACE)},V7_PAGE_ID=${JSON.stringify(writer.pageId)},V7_SET_IDS=new Set(${JSON.stringify(writer.setIds)}),V7_SOURCE_BY_ADAPTER=${JSON.stringify(sourceByAdapter)};
const page=await figma.getNodeByIdAsync(V7_PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("INPUT-V9-PROBE-PAGE");
const get=(node,key)=>node.getSharedPluginData(V7_NS,key),sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>V7_SET_IDS.has(node.id));
if(sets.length!==2)throw new Error("INPUT-V9-PROBE-ROOTS:"+sets.length);
const role=node=>{const description=typeof node.description==="string"?node.description:"",match=description.match(/(?:^|\n)recipe-role:([^\n]+)/);return match?match[1]:(node.name.includes("/")&&!node.name.includes("=")?node.name.split(" :: ",1)[0]:undefined);};
const nodes=root=>[root,...root.findAll()],box=node=>node.absoluteBoundingBox?{x:node.absoluteBoundingBox.x,y:node.absoluteBoundingBox.y,width:node.absoluteBoundingBox.width,height:node.absoluteBoundingBox.height}:null;
const area=value=>value?Math.max(0,value.width)*Math.max(0,value.height):0,intersection=(a,b)=>{if(!a||!b)return null;const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.width,b.x+b.width),d=Math.min(a.y+a.height,b.y+b.height);return r>x&&d>y?{x,y,width:r-x,height:d-y}:null;};
const visibleLoss=(child,parent)=>{const childArea=area(child);return childArea===0?1:1-area(intersection(child,parent))/childArea;},overlap=(a,b)=>{const hit=intersection(a,b);return hit?Math.min(hit.width,hit.height):0;};
const axes=node=>Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
const propertyKey=(instance,name)=>Object.keys(instance.componentProperties).find(key=>key.split("#")[0]===name),plain=instance=>Object.fromEntries(Object.entries(instance.componentProperties).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
const snapshot=instance=>JSON.stringify({width:instance.width,height:instance.height,properties:plain(instance),nodes:nodes(instance).map(node=>({type:node.type,name:node.name,width:node.width,height:node.height,visible:node.visible!==false,characters:node.type==="TEXT"?node.characters:undefined})).sort((a,b)=>(a.name+a.type).localeCompare(b.name+b.type))});
const sources=[],cells=[];
for(const set of sets){
 const adapterIdentity=get(set,"adapterIdentity"),source=V7_SOURCE_BY_ADAPTER[adapterIdentity],components=[...set.children];
 if(!source||components.length!==128)throw new Error("INPUT-V9-PROBE-VARIANTS:"+adapterIdentity+":"+components.length);
 for(const component of components){
  const axis=axes(component),all=nodes(component),byRole=name=>all.filter(node=>role(node)===name),semantic=all.filter(node=>role(node)&&(node.type==="TEXT"||node.type==="INSTANCE")&&node.visible!==false),componentBox=box(component);
  let maximumOverlap=0;for(let i=0;i<semantic.length;i++)for(let j=i+1;j<semantic.length;j++)maximumOverlap=Math.max(maximumOverlap,overlap(box(semantic[i]),box(semantic[j])));
  const required=byRole("input-field/required-indicator").length===(axis.Required==="true"?1:0),leading=byRole("input-field/slot/leading").length===((axis.Adornments==="leading"||axis.Adornments==="both")?1:0),trailing=byRole("input-field/slot/trailing").length===((axis.Adornments==="trailing"||axis.Adornments==="both")?1:0);
  const adornments=[...byRole("input-field/slot/leading"),...byRole("input-field/slot/trailing")];let adornmentPayloadExact=true;
  for(const node of adornments){if(node.type!=="INSTANCE"){adornmentPayloadExact=false;continue;}const main=await node.getMainComponentAsync(),description=main&&typeof main.description==="string"?main.description:"",accessibility=description.match(/(?:^|\n)adornment-accessibility:([^\n]+)/),sourceMarker=description.match(/(?:^|\n)adornment-source:([^\n]+)/),texts=node.findAllWithCriteria({types:["TEXT"]}).filter(text=>text.visible!==false).map(text=>text.characters),expectedText=role(node)==="input-field/slot/leading"?"$":"USD";let parsedAccessibility;try{parsedAccessibility=accessibility?JSON.parse(accessibility[1]):null;}catch{parsedAccessibility=null;}if(texts.length!==1||texts[0]!==expectedText||!sourceMarker||!parsedAccessibility||typeof parsedAccessibility.decorative!=="boolean"||!parsedAccessibility.relation)adornmentPayloadExact=false;}
  const expected=["input-field/label","input-field/surface",axis.Content==="placeholder"?"input-field/content/placeholder":"input-field/content/value",axis.State==="error"?"input-field/message/error":"input-field/message/helper"];
  const stateSemanticsExact=axis.State==="error"?byRole("input-field/message/error").length===1&&byRole("input-field/message/helper").length===0:byRole("input-field/message/helper").length===1&&byRole("input-field/message/error").length===0;
  const noFakeLayout=all.filter(node=>"children" in node).every(node=>node.layoutMode!=="NONE"&&node.children.every(child=>child.layoutPositioning!=="ABSOLUTE"||!!child.constraints));
  cells.push({source,adapterIdentity,cellKey:[source,axis.Size,axis.State,axis.Content,axis.Required,axis.Adornments].join("/"),rolesExact:expected.every(name=>byRole(name).length===1)&&required&&leading&&trailing,stateSemanticsExact,adornmentPayloadExact,noFakeLayout,visibleAreaLoss:Math.max(0,...semantic.map(node=>visibleLoss(box(node),componentBox))),overlapPixels:maximumOverlap});
 }
 const instance=set.defaultVariant.createInstance();page.appendChild(instance);const before=snapshot(instance),beforeWidth=instance.width,original=plain(instance),allBefore=nodes(instance),surface=allBefore.find(node=>role(node)==="input-field/surface"),content=allBefore.find(node=>role(node)==="input-field/content-row"),surfaceWidth=surface&&surface.width,contentWidth=content&&content.width;
 instance.resizeWithoutConstraints(beforeWidth+64,instance.height);const reflowPassed=instance.width===beforeWidth+64&&surface&&surface.width>surfaceWidth&&content&&content.width>contentWidth;instance.resizeWithoutConstraints(beforeWidth,instance.height);
 const visited=new Set(),axisNames=["Size","State","Content","Required","Adornments"];
 for(const component of components){const target=axes(component),updates={};for(const name of axisNames){const key=propertyKey(instance,name);if(!key)throw new Error("INPUT-V9-PROBE-AXIS:"+name);updates[key]=target[name];}instance.setProperties(updates);const main=await instance.getMainComponentAsync();if(main)visited.add(main.id);}
 instance.setProperties(original);const labelKey=propertyKey(instance,"Label"),labelBefore=labelKey&&instance.componentProperties[labelKey].value;let textPropertiesRestored=false;if(labelKey){instance.setProperties({[labelKey]:"Input v7 deterministic probe"});const changed=nodes(instance).some(node=>node.type==="TEXT"&&role(node)==="input-field/label"&&node.characters==="Input v7 deterministic probe");instance.setProperties({[labelKey]:labelBefore});textPropertiesRestored=changed&&JSON.stringify(original)===JSON.stringify(plain(instance));}
 const sourceCells=cells.filter(cell=>cell.source===source),bindingCompatibilityPassed=nodes(set).every(node=>Object.values(node.boundVariables||{}).flat().every(alias=>alias&&typeof alias.id==="string"));
 const switchingRestored=JSON.stringify(original)===JSON.stringify(plain(instance)),after=snapshot(instance);instance.remove();
 sources.push({source,adapterIdentity,variants:128,visitedVariants:visited.size,reflowPassed:!!reflowPassed,contentFillPassed:!!reflowPassed,bindingCompatibilityPassed,noFakeLayoutPassed:sourceCells.every(cell=>cell.noFakeLayout),adornmentPayloadPassed:sourceCells.every(cell=>cell.adornmentPayloadExact),stateSemanticsPassed:sourceCells.every(cell=>cell.stateSemanticsExact),switchingRestored,textPropertiesRestored,exactSceneRestoration:before===after});
}
sources.sort((a,b)=>a.source.localeCompare(b.source));cells.sort((a,b)=>a.cellKey.localeCompare(b.cellKey));
return{pageId:page.id,sources,cells};`;
}

export function validateInputLiveV34ProbePayload(
  value: unknown,
  writer: InputLiveV34WriterOwnership,
): InputLiveV34ProbePayload {
  const payload = record(value, "probe payload") as InputLiveV34ProbePayload;
  const requiredSourceBooleans = [
    "reflowPassed",
    "contentFillPassed",
    "bindingCompatibilityPassed",
    "noFakeLayoutPassed",
    "adornmentPayloadPassed",
    "stateSemanticsPassed",
    "switchingRestored",
    "textPropertiesRestored",
    "exactSceneRestoration",
  ] as const;
  if (
    payload.pageId !== writer.pageId ||
    !Array.isArray(payload.sources) ||
    payload.sources.length !== 2 ||
    new Set(payload.sources.map((source) => source.source)).size !== 2 ||
    payload.sources.some(
      (source) =>
        source.variants !== 128 ||
        source.visitedVariants !== 128 ||
        requiredSourceBooleans.some((field) => source[field] !== true),
    ) ||
    !Array.isArray(payload.cells) ||
    payload.cells.length !== INPUT_LIVE_V34_VARIANT_COUNT ||
    new Set(payload.cells.map((cell) => cell.cellKey)).size !==
      INPUT_LIVE_V34_VARIANT_COUNT ||
    payload.cells.some(
      (cell) =>
        cell.rolesExact !== true ||
        cell.stateSemanticsExact !== true ||
        cell.adornmentPayloadExact !== true ||
        cell.noFakeLayout !== true ||
        !finiteNonnegative(cell.visibleAreaLoss) ||
        cell.visibleAreaLoss > 0.05 ||
        !finiteNonnegative(cell.overlapPixels) ||
        cell.overlapPixels > 2,
    )
  )
    throw new TypeError("Input live v12 probe/usability/restoration failed");
  return payload;
}

export function validateInputLiveV34CaptureManifest(
  cells: readonly InputLiveV34CaptureCell[],
): void {
  const order = cells.map((cell) => cell.index);
  if (
    cells.length !== INPUT_LIVE_V34_CAPTURE_COUNT ||
    new Set(cells.map((cell) => cell.cellKey)).size !==
      INPUT_LIVE_V34_CAPTURE_COUNT ||
    new Set(order).size !== INPUT_LIVE_V34_CAPTURE_COUNT ||
    order.some((index, expected) => index !== expected) ||
    cells.some(
      (cell) =>
        !INPUT_LIVE_V34_SOURCE_IDS.includes(cell.source) ||
        cell.strata.source !== cell.source ||
        cell.strata.state !== cell.axes.state ||
        cell.strata.adornment !== cell.axes.adornments ||
        !SHA256.test(cell.reference.sha256) ||
        !Number.isFinite(cell.reference.width) ||
        cell.reference.width <= 0 ||
        !Number.isFinite(cell.reference.height) ||
        cell.reference.height <= 0 ||
        !Number.isFinite(cell.reference.contentBox.width) ||
        cell.reference.contentBox.width <= 0 ||
        !Number.isFinite(cell.reference.contentBox.height) ||
        cell.reference.contentBox.height <= 0 ||
        Object.values(cell.legacy).some(
          (value) => !Number.isFinite(value) || value < 0 || value > 1,
        ) ||
        !cell.reference.path.includes("/source-reference/"),
    ) ||
    INPUT_LIVE_V34_SOURCE_IDS.some(
      (source) => cells.filter((cell) => cell.source === source).length !== 64,
    )
  )
    throw new TypeError(
      "Input live v12 capture manifest must be exact 128 cells",
    );
}

export const inputLiveV34CaptureManifestSha256 = (
  cells: readonly InputLiveV34CaptureCell[],
): string => {
  validateInputLiveV34CaptureManifest(cells);
  return sha256(canonicalJson(cells));
};

export function buildInputLiveV34CaptureProgram(
  writer: InputLiveV34WriterOwnership,
  cell: InputLiveV34CaptureCell,
): string {
  if (
    !Number.isInteger(cell.index) ||
    cell.index < 0 ||
    cell.index >= INPUT_LIVE_V34_CAPTURE_COUNT ||
    !cell.cellKey ||
    !INPUT_LIVE_V34_SOURCE_IDS.includes(cell.source) ||
    cell.strata.source !== cell.source ||
    cell.strata.state !== cell.axes.state ||
    cell.strata.adornment !== cell.axes.adornments ||
    !SHA256.test(cell.reference.sha256)
  )
    throw new TypeError("Input live v12 capture cell is malformed");
  const expectedSet = writer.sources.find(
    (source) => source.adapterIdentity === cell.adapterIdentity,
  )?.setId;
  if (!expectedSet)
    throw new TypeError(
      `Input live v12 capture adapter absent: ${cell.cellKey}`,
    );
  return String.raw`
${FIGMA_PORTABLE_RUNTIME}
await figma.loadAllPagesAsync();
const page=await figma.getNodeByIdAsync(${JSON.stringify(writer.pageId)}),set=await figma.getNodeByIdAsync(${JSON.stringify(expectedSet)}),cell=${JSON.stringify(cell)};
if(!page||page.type!=="PAGE"||!set||set.type!=="COMPONENT_SET")throw new Error("INPUT-V9-CAPTURE-TARGET");
const axes=node=>Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
const component=set.children.find(node=>{const value=axes(node),wanted=cell.axes;return value.Size===wanted.size&&value.State===wanted.state&&value.Content===wanted.content&&value.Required===wanted.required&&value.Adornments===wanted.adornments;});
if(!component)throw new Error("INPUT-V9-CAPTURE-CELL:"+cell.cellKey);
const frame=figma.createFrame();frame.name="Input v7 ephemeral / "+cell.cellKey;page.appendChild(frame);
try{
 frame.resizeWithoutConstraints(cell.reference.width/2,cell.reference.height/2);frame.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];frame.clipsContent=true;
 const instance=component.createInstance();frame.appendChild(instance);instance.x=(frame.width-instance.width)/2;instance.y=(frame.height-instance.height)/2;
 const bytes=await frame.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
 if(bytes.byteLength>${INPUT_LIVE_V34_CAPTURE_MAX_PNG_BYTES})throw new Error("INPUT-V9-CAPTURE-SIZE:"+bytes.byteLength);
 const pngSha256=runtimeSha256(bytes),pngBase64=figma.base64Encode(bytes);
 return{index:cell.index,cellKey:cell.cellKey,source:cell.source,strata:cell.strata,referenceSha256:cell.reference.sha256,frameWidth:frame.width,frameHeight:frame.height,componentWidth:instance.width,componentHeight:instance.height,pngBytes:bytes.byteLength,pngSha256,pngBase64,temporaryNodesRemaining:0};
}finally{frame.remove();}`;
}

export function validateInputLiveV34CapturePayload(
  value: unknown,
  cell: InputLiveV34CaptureCell,
  rawResponseBytes: number,
): InputLiveV34CapturePayload {
  const payload = record(
    value,
    "capture payload",
  ) as InputLiveV34CapturePayload;
  if (
    rawResponseBytes > INPUT_LIVE_V34_CAPTURE_MAX_RAW_RESPONSE_BYTES ||
    payload.index !== cell.index ||
    payload.cellKey !== cell.cellKey ||
    payload.source !== cell.source ||
    canonicalJson(payload.strata) !== canonicalJson(cell.strata) ||
    payload.referenceSha256 !== cell.reference.sha256 ||
    !Number.isFinite(payload.componentWidth) ||
    payload.componentWidth <= 0 ||
    !Number.isFinite(payload.componentHeight) ||
    payload.componentHeight <= 0 ||
    !Number.isInteger(payload.pngBytes) ||
    payload.pngBytes <= 0 ||
    payload.pngBytes > INPUT_LIVE_V34_CAPTURE_MAX_PNG_BYTES ||
    !SHA256.test(payload.pngSha256) ||
    typeof payload.pngBase64 !== "string" ||
    payload.pngBase64.length === 0 ||
    Buffer.byteLength(payload.pngBase64, "base64") !== payload.pngBytes ||
    sha256(Buffer.from(payload.pngBase64, "base64")) !== payload.pngSha256 ||
    payload.temporaryNodesRemaining !== 0
  )
    throw new TypeError(
      `Input live v12 capture truncated/mismatched: ${cell.cellKey}`,
    );
  return payload;
}

export function assertInputLiveV34CaptureResponses(
  manifest: readonly InputLiveV34CaptureCell[],
  responses: readonly InputLiveV34CapturePayload[],
): void {
  validateInputLiveV34CaptureManifest(manifest);
  if (
    responses.length !== manifest.length ||
    new Set(responses.map((response) => response.cellKey)).size !==
      manifest.length ||
    responses.some(
      (response, index) =>
        response.index !== index ||
        response.cellKey !== manifest[index]!.cellKey,
    )
  )
    throw new TypeError(
      "Input live v12 capture responses contain truncation/duplicate/missing cells",
    );
}

export interface InputLiveV34ObjectiveReport {
  artifactVersion: "input-live-v34-objective-report-v1";
  denominator: 128;
  technicalPassed: boolean;
  rows: Array<{
    index: number;
    cellKey: string;
    source: InputLiveV34SourceId;
    strata: InputLiveV34CaptureCell["strata"];
    referenceSha256: string;
    liveSha256: string;
    geometry: { legacy: number; recipe: number };
    perceptual: { legacy: number; recipe: number };
    pixelInk: { legacy: number; recipe: number };
  }>;
  wins: Record<"geometry" | "perceptual" | "pixelInk", number>;
  losses: Record<"geometry" | "perceptual" | "pixelInk", number>;
  means: Record<
    "geometry" | "perceptual" | "pixelInk",
    { legacy: number; recipe: number }
  >;
  stratumRegressions: string[];
  catastrophicCells: string[];
  failures: string[];
}

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

export function evaluateInputLiveV34Objective(
  manifest: readonly InputLiveV34CaptureCell[],
  responses: readonly InputLiveV34CapturePayload[],
  readReference: (cell: InputLiveV34CaptureCell) => Buffer,
  readCapture: (cell: InputLiveV34CaptureCell) => Buffer,
): InputLiveV34ObjectiveReport {
  assertInputLiveV34CaptureResponses(manifest, responses);
  const rows = manifest.map((cell, index) => {
    const response = responses[index]!;
    const reference = readReference(cell);
    const capture = readCapture(cell);
    if (
      sha256(reference) !== cell.reference.sha256 ||
      sha256(capture) !== response.pngSha256
    )
      throw new TypeError(
        `Input live v12 objective byte drift: ${cell.cellKey}`,
      );
    const measured = measureVisualPair(
      reference,
      capture,
      cell.reference.contentBox,
      {
        width: response.componentWidth,
        height: response.componentHeight,
      },
    );
    if (
      !measured.valid ||
      measured.pixelInkCompositeError === null ||
      measured.normalizedPixelDifference.perceptual === null
    )
      throw new TypeError(
        `Input live v12 objective measurement refused: ${cell.cellKey}`,
      );
    return {
      index: cell.index,
      cellKey: cell.cellKey,
      source: cell.source,
      strata: cell.strata,
      referenceSha256: cell.reference.sha256,
      liveSha256: response.pngSha256,
      geometry: {
        legacy: cell.legacy.geometry,
        recipe: measured.geometryError,
      },
      perceptual: {
        legacy: cell.legacy.perceptual,
        recipe: measured.normalizedPixelDifference.perceptual,
      },
      pixelInk: {
        legacy: cell.legacy.pixelInk,
        recipe: measured.pixelInkCompositeError,
      },
    };
  });
  const metrics = ["geometry", "perceptual", "pixelInk"] as const;
  const wins = { geometry: 0, perceptual: 0, pixelInk: 0 };
  const losses = { geometry: 0, perceptual: 0, pixelInk: 0 };
  const means = {
    geometry: { legacy: 0, recipe: 0 },
    perceptual: { legacy: 0, recipe: 0 },
    pixelInk: { legacy: 0, recipe: 0 },
  };
  const failures: string[] = [];
  for (const metric of metrics) {
    wins[metric] = rows.filter(
      (row) => row[metric].recipe < row[metric].legacy,
    ).length;
    losses[metric] = rows.filter(
      (row) => row[metric].recipe > row[metric].legacy,
    ).length;
    means[metric] = {
      legacy: mean(rows.map((row) => row[metric].legacy)),
      recipe: mean(rows.map((row) => row[metric].recipe)),
    };
    if (wins[metric] <= losses[metric])
      failures.push(`${metric}: recipe wins do not exceed legacy losses`);
    if (!(means[metric].recipe < means[metric].legacy))
      failures.push(`${metric}: aggregate recipe error did not improve`);
  }
  const strata = new Map<string, typeof rows>();
  for (const row of rows)
    for (const [kind, value] of Object.entries(row.strata)) {
      const key = `${kind}:${value}`;
      strata.set(key, [...(strata.get(key) ?? []), row]);
    }
  const stratumRegressions = [...strata].flatMap(([stratum, values]) =>
    metrics.flatMap((metric) =>
      mean(values.map((row) => row[metric].recipe)) >
      mean(values.map((row) => row[metric].legacy)) * 1.1
        ? [`${stratum}:${metric}`]
        : [],
    ),
  );
  const catastrophicCells = rows.flatMap((row) =>
    metrics.some(
      (metric) => row[metric].recipe > row[metric].legacy * 1.5 + 0.02,
    )
      ? [row.cellKey]
      : [],
  );
  if (stratumRegressions.length)
    failures.push(
      `material stratum regression: ${stratumRegressions.join(",")}`,
    );
  if (catastrophicCells.length)
    failures.push(`catastrophic visual cells: ${catastrophicCells.join(",")}`);
  return {
    artifactVersion: "input-live-v34-objective-report-v1",
    denominator: 128,
    technicalPassed: failures.length === 0,
    rows,
    wins,
    losses,
    means,
    stratumRegressions,
    catastrophicCells,
    failures,
  };
}

export function buildInputLiveV34CleanupProgram(
  writer: InputLiveV34WriterOwnership,
): string {
  const baseProgram = buildInputLiveV3CleanupRuntime({
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    fileName: "Scratch Project",
    editorType: "figma",
    namespace: INPUT_LIVE_V34_NAMESPACE,
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    adapterIdentities: writer.sources.map((source) => source.adapterIdentity),
  });
  const resultStatement =
    "return{requestedNodeIds,removedNodeIds,requestedCollectionIds,removedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:true};";
  const guardedResult = `if(JSON.stringify(requestedNodeIds)!==JSON.stringify([expectedPageId])||JSON.stringify([...requestedCollectionIds].sort())!==JSON.stringify([...expectedCollectionIds].sort()))throw new Error("INPUT-V9-CLEANUP-EXACT-OWNERSHIP");${resultStatement}`;
  const program = baseProgram.replace(resultStatement, guardedResult);
  if (program === baseProgram)
    throw new Error("Input live v12 cleanup runtime result hook absent");
  return String.raw`
const expectedPageId=${JSON.stringify(writer.pageId)},expectedCollectionIds=${JSON.stringify(writer.collectionIds)};
${program}
`;
}

export function validateInputLiveV34CleanupPayload(
  value: unknown,
  writer: InputLiveV34WriterOwnership,
): InputLiveV34CleanupPayload {
  const payload = record(
    value,
    "cleanup payload",
  ) as InputLiveV34CleanupPayload;
  exactUniqueStrings(payload.requestedNodeIds, 1, "cleanup requested nodes");
  exactUniqueStrings(payload.removedNodeIds, 1, "cleanup removed nodes");
  exactUniqueStrings(
    payload.requestedCollectionIds,
    2,
    "cleanup requested collections",
  );
  exactUniqueStrings(
    payload.removedCollectionIds,
    2,
    "cleanup removed collections",
  );
  if (
    payload.complete !== true ||
    payload.remainingOwnedNodes !== 0 ||
    payload.remainingOwnedCollections !== 0 ||
    canonicalJson(payload.requestedNodeIds) !==
      canonicalJson([writer.pageId]) ||
    canonicalJson(payload.removedNodeIds) !== canonicalJson([writer.pageId]) ||
    canonicalJson([...payload.requestedCollectionIds].sort()) !==
      canonicalJson([...writer.collectionIds].sort()) ||
    canonicalJson([...payload.removedCollectionIds].sort()) !==
      canonicalJson([...writer.collectionIds].sort())
  )
    throw new TypeError("Input live v12 cleanup is incomplete or overbroad");
  return payload;
}

export const INPUT_LIVE_V34_RESPONSE_CONTRACTS = Object.freeze({
  writer: {
    schema: "InputLiveV34WriterPayload",
    cardinality: {
      pages: 1,
      sections: 2,
      sets: 2,
      sourceRoots: 2,
      variants: 256,
      collections: 2,
    },
  },
  restore: {
    schema: "InputLiveV34RestorePayload",
    cardinality: { pages: 1, sets: 2, contentTexts: 256 },
  },
  extract: {
    schema: "InputLiveV34ExtractPayload",
    cardinality: { pages: 1, sourceRoots: 2, localVariableTables: 1 },
  },
  probe: {
    schema: "InputLiveV34ProbePayload",
    cardinality: { sourceRoots: 2, sourceProbes: 2, variantCells: 256 },
  },
  capture: {
    schema: "InputLiveV34CapturePayload",
    cardinality: { captureCellsPerRequest: 1, captureRequests: 128 },
  },
  cleanup: {
    schema: "InputLiveV34CleanupPayload",
    cardinality: { ownedPages: 1, ownedCollections: 2 },
  },
});
