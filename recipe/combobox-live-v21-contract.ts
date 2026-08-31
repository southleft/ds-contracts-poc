import { createHash } from "node:crypto";

import {
  COMBOBOX_FIGMA_NAMESPACE,
  FORBIDDEN_INPUT_NAMESPACE,
  FORBIDDEN_INPUT_PAGE_ID,
  FORBIDDEN_INPUT_RUN_IDENTITY,
} from "./combobox-figma-writer.js";
import { buildComboboxLiveV21CleanupRuntime } from "./combobox-live-v21-cleanup.js";
import {
  type ComboboxLiveV21FixedFixedPoint,
} from "./combobox-live-v21-fixed-point.js";
import { hashRecipeEnvelope } from "./hash.js";
import {
  buildComboboxLiveV21RestoreProgram,
  validateComboboxLiveV21RestorePayload,
  type ComboboxLiveV21RestorePayload,
} from "./combobox-live-v21-restore.js";
import {
  buildComboboxLiveV21RawPropertyRuntime,
  normalizeComboboxLiveV21Scene,
  type ComboboxLiveV21RawNode,
} from "./combobox-live-v21-verifier.js";
import type { RecipeEnvelope } from "./envelope.js";
import type { LocalVariableRecord } from "./figma-property-normalizer-v8.js";
import { FIGMA_PORTABLE_RUNTIME } from "./figma-runtime-portability.js";
import { canonicalJson } from "./normalize.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-combobox-v21.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
  sceneToNormalizedIr,
  type ExpectedScenePlan,
  type SceneComparison,
} from "./scene-readback-combobox-v21.js";

export {
  buildComboboxLiveV21RestoreProgram,
  validateComboboxLiveV21RestorePayload,
  type ComboboxLiveV21RestorePayload,
};

export const COMBOBOX_LIVE_V21_NAMESPACE = COMBOBOX_FIGMA_NAMESPACE;
export const COMBOBOX_LIVE_V21_SOURCE_IDS = ["mui", "antd"] as const;
export const COMBOBOX_LIVE_V21_ADAPTERS = [
  "material-combobox-reviewed-v1",
  "commerce-combobox-reviewed-v1",
] as const;
export const COMBOBOX_LIVE_V21_CAPTURE_COUNT = 72;
export const COMBOBOX_LIVE_V21_VARIANT_COUNT = 144;
export const COMBOBOX_LIVE_V21_SET_COUNT = 4;
export const COMBOBOX_LIVE_V21_REMOTE_REQUESTS = 77;
export const COMBOBOX_LIVE_V21_HOST_PHASES = 3;
export const COMBOBOX_LIVE_V21_SOURCE_ROOTS = 2;
export const COMBOBOX_LIVE_V21_CAPTURE_MAX_PNG_BYTES = 1_500_000;
export const COMBOBOX_LIVE_V21_CAPTURE_MAX_RAW_RESPONSE_BYTES = 2_100_000;

export type ComboboxLiveV21SourceId = (typeof COMBOBOX_LIVE_V21_SOURCE_IDS)[number];

export interface ComboboxLiveV21SourceIdentity {
  source: ComboboxLiveV21SourceId;
  adapterIdentity: string;
  recipeHash: string;
  envelopeHash: string;
  comboboxExpectedScenePlan: ExpectedScenePlan;
  optionExpectedScenePlan: ExpectedScenePlan;
}

export interface ComboboxLiveV21WriterOwnership {
  pageId: string;
  pageName: string;
  runIdentity: string;
  namespace: string;
  setIds: string[];
  sectionIds: [string, string];
  collectionIds: [string, string];
  createdNodeIds: string[];
  sources: Array<{
    adapterIdentity: string;
    comboboxSetId: string;
    optionSetId: string;
    sectionId: string;
    collectionId: string;
    variableCount: number;
    variantCount: 72;
    comboboxCells: 64;
    optionCells: 8;
    recipeHash: string;
    envelopeHash: string;
  }>;
  counts: {
    sources: 2;
    variants: 144;
    collections: 2;
    sets: 4;
    nodes: number;
  };
}

export interface ComboboxLiveV21ExtractPayload {
  pageId: string;
  roots: Array<{
    source: ComboboxLiveV21SourceId;
    adapterIdentity: string;
    comboboxSetId: string;
    optionSetId: string;
    comboboxScene: ComboboxLiveV21RawNode;
    optionScene: ComboboxLiveV21RawNode;
  }>;
  variableTable: LocalVariableRecord[];
}

export interface ComboboxLiveV21RootProof {
  source: ComboboxLiveV21SourceId;
  adapterIdentity: string;
  comboboxAccounting: SceneComparison;
  optionAccounting: SceneComparison;
  accounting: SceneComparison;
  fixedPoint: ComboboxLiveV21FixedFixedPoint;
}

export interface ComboboxLiveV21ProbePayload {
  pageId: string;
  sources: Array<{
    source: ComboboxLiveV21SourceId;
    adapterIdentity: string;
    variants: 72;
    visitedVariants: 72;
    reflowPassed: boolean;
    contentFillPassed: boolean;
    bindingCompatibilityPassed: boolean;
    noFakeLayoutPassed: boolean;
    stateSemanticsPassed: boolean;
    switchingRestored: boolean;
    textPropertiesRestored: boolean;
    exactSceneRestoration: boolean;
  }>;
  cells: Array<{
    source: ComboboxLiveV21SourceId;
    adapterIdentity: string;
    cellKey: string;
    kind: "combobox" | "option";
    rolesExact: boolean;
    stateSemanticsExact: boolean;
    noFakeLayout: boolean;
    visibleAreaLoss: number;
    overlapPixels: number;
  }>;
}

export interface ComboboxLiveV21CaptureCell {
  index: number;
  cellKey: string;
  source: ComboboxLiveV21SourceId;
  adapterIdentity: string;
  kind: "combobox" | "option";
  axes: Record<string, string>;
  strata: {
    source: ComboboxLiveV21SourceId;
    kind: "combobox" | "option";
    size: string;
  };
  frame: { width: number; height: number };
}

export interface ComboboxLiveV21CapturePayload {
  index: number;
  cellKey: string;
  source: ComboboxLiveV21SourceId;
  frameWidth: number;
  frameHeight: number;
  componentWidth: number;
  componentHeight: number;
  pngBytes: number;
  pngSha256: string;
  pngBase64: string;
  temporaryNodesRemaining: 0;
}

export interface ComboboxLiveV21CleanupPayload {
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
    throw new TypeError(`Combobox live v21 ${label} must be an object`);
  return value as Record<string, any>;
};
const finiteNonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const mergeAccounting = (
  left: SceneComparison,
  right: SceneComparison,
): SceneComparison => ({
  ok: left.ok && right.ok,
  denominator: left.denominator + right.denominator,
  matched: left.matched + right.matched,
  silent: left.silent + right.silent,
  missing: [...left.missing, ...right.missing],
  extra: [...left.extra, ...right.extra],
  mismatched: [...left.mismatched, ...right.mismatched],
  duplicateCollapsed: [
    ...left.duplicateCollapsed,
    ...right.duplicateCollapsed,
  ],
  unobserved: [...left.unobserved, ...right.unobserved],
});

export function validateComboboxLiveV21WriterPayload(
  value: unknown,
): ComboboxLiveV21WriterOwnership {
  const envelope = record(value, "writer payload");
  const result = record(envelope.result ?? envelope, "writer result");
  const sources = result.sources;
  if (
    typeof result.pageId !== "string" ||
    !result.pageId ||
    result.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    typeof result.pageName !== "string" ||
    !result.pageName ||
    result.pageName.includes(FORBIDDEN_INPUT_PAGE_ID) ||
    typeof result.runIdentity !== "string" ||
    !result.runIdentity ||
    result.runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    result.namespace === FORBIDDEN_INPUT_NAMESPACE ||
    result.namespace !== COMBOBOX_LIVE_V21_NAMESPACE ||
    !Array.isArray(sources) ||
    sources.length !== 2 ||
    new Set(sources.map((source: any) => source.adapterIdentity)).size !== 2 ||
    sources.some(
      (source: any) =>
        typeof source.comboboxSetId !== "string" ||
        typeof source.optionSetId !== "string" ||
        typeof source.sectionId !== "string" ||
        typeof source.collectionId !== "string" ||
        source.variantCount !== 72 ||
        source.comboboxCells !== 64 ||
        source.optionCells !== 8 ||
        !Number.isInteger(source.variableCount) ||
        source.variableCount <= 0 ||
        !SHA256.test(source.recipeHash) ||
        !SHA256.test(source.envelopeHash),
    )
  )
    throw new TypeError("Combobox live v21 writer schema/cardinality mismatch");
  const createdNodeIds = result.createdNodeIds;
  if (
    !Array.isArray(createdNodeIds) ||
    createdNodeIds.length === 0 ||
    createdNodeIds.some((id: unknown) => typeof id !== "string" || !id) ||
    new Set(createdNodeIds).size !== createdNodeIds.length
  )
    throw new TypeError(
      "Combobox live v21 writer created-node denominator invalid",
    );
  const setIds = sources.flatMap((source: any) => [
    source.comboboxSetId,
    source.optionSetId,
  ]);
  if (new Set(setIds).size !== 4)
    throw new TypeError("Combobox live v21 writer set identity collision");
  return {
    pageId: result.pageId,
    pageName: result.pageName,
    runIdentity: result.runIdentity,
    namespace: result.namespace,
    setIds,
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
      variants: 144,
      collections: 2,
      sets: 4,
      nodes: createdNodeIds.length,
    },
  };
}

const identityPlan = (
  source: ComboboxLiveV21SourceIdentity,
  kind: "combobox" | "option",
) => {
  const plan =
    kind === "combobox"
      ? source.comboboxExpectedScenePlan
      : source.optionExpectedScenePlan;
  return {
    kind,
    adapterIdentity: source.adapterIdentity,
    recipeHash: source.recipeHash,
    envelopeHash: source.envelopeHash,
    facts: plan.facts,
    directOwnershipKeys: [
      ...new Set(plan.facts.map((fact) => fact.nodeOwnershipKey)),
    ],
    generatedDescendants: plan.generatedDescendants,
  };
};

export function buildComboboxLiveV21ExtractProgram(
  writer: ComboboxLiveV21WriterOwnership,
  sources: readonly ComboboxLiveV21SourceIdentity[],
): string {
  if (sources.length !== 2)
    throw new TypeError("Combobox live v21 extract requires two source identities");
  if (writer.pageId === FORBIDDEN_INPUT_PAGE_ID)
    throw new TypeError("Combobox extract must not target Input page");
  const identities = Object.fromEntries(
    sources.map((source) => [
      source.adapterIdentity,
      {
        combobox: {
          ...identityPlan(source, "combobox"),
          runIdentity: writer.runIdentity,
        },
        option: {
          ...identityPlan(source, "option"),
          runIdentity: writer.runIdentity,
        },
      },
    ]),
  );
  return String.raw`
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(COMBOBOX_LIVE_V21_NAMESPACE)};
const PAGE_ID=${JSON.stringify(writer.pageId)};
const SET_IDS=new Set(${JSON.stringify(writer.setIds)});
const SOURCE_BY_ADAPTER=${JSON.stringify(
    Object.fromEntries(
      sources.map((source) => [source.adapterIdentity, source.source]),
    ),
  )};
const IDENTITIES=${JSON.stringify(identities)};
if(PAGE_ID==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
${buildFigmaSceneReadbackRuntime(COMBOBOX_LIVE_V21_NAMESPACE)}
${buildComboboxLiveV21RawPropertyRuntime()}
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("COMBOBOX-V8-EXTRACT-PAGE");
if(page.id==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
const get=(node,key)=>node.getSharedPluginData(NS,key);
if(get(page,"pageOwner")!=="recipe/combobox/"+${JSON.stringify(writer.runIdentity)})throw new Error("COMBOBOX-V8-EXTRACT-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.has(node.id));
if(sets.length!==4)throw new Error("COMBOBOX-V8-EXTRACT-ROOTS:"+sets.length);
const decorate=async(node,snapshot)=>{
  Object.assign(snapshot,inputV4RawNodeProperties(node));
  if("children" in node)for(let index=0;index<node.children.length;index++)await decorate(node.children[index],snapshot.children[index]);
};
const byAdapter=new Map();
for(const set of sets){
  const adapterIdentity=get(set,"adapterIdentity");
  const kind=get(set,"ownershipKey");
  if(!IDENTITIES[adapterIdentity]||(kind!=="combobox"&&kind!=="option"))throw new Error("COMBOBOX-V8-EXTRACT-ADAPTER:"+adapterIdentity+":"+kind);
  const expected=IDENTITIES[adapterIdentity][kind];
  const scene=await readSceneDerivedTree(set,expected,expected);
  await decorate(set,scene);
  const row=byAdapter.get(adapterIdentity)||{adapterIdentity,source:SOURCE_BY_ADAPTER[adapterIdentity]};
  if(kind==="combobox"){row.comboboxSetId=set.id;row.comboboxScene=scene;}
  else{row.optionSetId=set.id;row.optionScene=scene;}
  byAdapter.set(adapterIdentity,row);
}
const roots=[...byAdapter.values()];
if(roots.length!==2||roots.some(root=>!root.comboboxScene||!root.optionScene))throw new Error("COMBOBOX-V8-EXTRACT-PAIR");
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

export function validateComboboxLiveV21ExtractPayload(
  value: unknown,
  writer: ComboboxLiveV21WriterOwnership,
): ComboboxLiveV21ExtractPayload {
  const payload = record(value, "extract payload");
  const leaks = forbiddenExtractKeys(payload);
  if (leaks.length)
    throw new TypeError(
      `Combobox live v21 extract contains source IR facts: ${leaks.join(",")}`,
    );
  if (
    payload.pageId !== writer.pageId ||
    payload.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    !Array.isArray(payload.roots) ||
    payload.roots.length !== 2 ||
    new Set(payload.roots.map((root: any) => root.source)).size !== 2 ||
    new Set(payload.roots.map((root: any) => root.adapterIdentity)).size !==
      2 ||
    payload.roots.some(
      (root: any) =>
        !COMBOBOX_LIVE_V21_SOURCE_IDS.includes(root.source) ||
        !writer.setIds.includes(root.comboboxSetId) ||
        !writer.setIds.includes(root.optionSetId) ||
        !root.comboboxScene ||
        !root.optionScene ||
        root.comboboxScene.ownershipKey !== "combobox" ||
        root.optionScene.ownershipKey !== "option",
    ) ||
    !Array.isArray(payload.variableTable) ||
    payload.variableTable.length === 0
  )
    throw new TypeError("Combobox live v21 extract schema/two-root mismatch");
  return payload as ComboboxLiveV21ExtractPayload;
}

export function proveComboboxLiveV21Roots<Instance>(
  extract: ComboboxLiveV21ExtractPayload,
  sources: readonly (ComboboxLiveV21SourceIdentity & {
    envelope: RecipeEnvelope;
    selection: unknown;
  })[],
  collapse: (envelope: unknown, selection: unknown) => Instance,
  compile: (instance: unknown) => RecipeEnvelope,
): ComboboxLiveV21RootProof[] {
  if (extract.roots.length !== 2 || sources.length !== 2)
    throw new TypeError("Combobox live v21 proof requires two independent roots");
  return sources.map((source) => {
    const root = extract.roots.find(
      (candidate) =>
        candidate.source === source.source &&
        candidate.adapterIdentity === source.adapterIdentity,
    );
    if (!root)
      throw new TypeError(`Combobox live v21 omitted ${source.source} root`);
    const comboboxNormalized = normalizeComboboxLiveV21Scene(
      root.comboboxScene,
      extract.variableTable,
    );
    const optionNormalized = normalizeComboboxLiveV21Scene(
      root.optionScene,
      extract.variableTable,
    );
    const comboboxAccounting = compareSceneToExpectedPlan(
      source.comboboxExpectedScenePlan,
      comboboxNormalized.scene,
    );
    const optionAccounting = compareSceneToExpectedPlan(
      source.optionExpectedScenePlan,
      optionNormalized.scene,
    );
    const runFixedPoint = (): ComboboxLiveV21FixedFixedPoint => {
      const cycle = () => {
        const observedEnvelope = structuredClone(source.envelope);
        if (observedEnvelope.ir.kind !== "frame")
          throw new TypeError(
            "Combobox live v21 compile root must be library frame",
          );
        const comboboxIr = sceneToNormalizedIr(comboboxNormalized.scene);
        const optionIr = sceneToNormalizedIr(optionNormalized.scene);
        observedEnvelope.ir = {
          ...observedEnvelope.ir,
          children: [comboboxIr, optionIr],
        };
        observedEnvelope.integrity.canonicalHash =
          hashRecipeEnvelope(observedEnvelope);
        const compiled = compile(
          collapse(observedEnvelope, source.selection),
        );
        if (compiled.ir.kind !== "frame")
          throw new TypeError("Combobox live v21 compile lost library frame");
        const compiledCombobox = compiled.ir.children.find(
          (child) => child.role === "combobox/set",
        );
        const compiledOption = compiled.ir.children.find(
          (child) => child.role === "combobox/option-set",
        );
        if (!compiledCombobox || !compiledOption)
          throw new TypeError("Combobox live v21 compile lost owned sets");
        const comboboxCompare = compareSceneToExpectedPlan(
          compileExpectedScenePlan(compiledCombobox, {
            rootOwnershipKey: "combobox",
          }),
          comboboxNormalized.scene,
          {
            omitOpacityOwnershipKeys:
              contentTextOwnershipKeysWithoutCompileOpacity(
                compiledCombobox,
                "combobox",
              ),
          },
        );
        const optionCompare = compareSceneToExpectedPlan(
          compileExpectedScenePlan(compiledOption, {
            rootOwnershipKey: "option",
          }),
          optionNormalized.scene,
          {
            omitOpacityOwnershipKeys:
              contentTextOwnershipKeysWithoutCompileOpacity(
                compiledOption,
                "option",
              ),
          },
        );
        return {
          sceneIr: canonicalJson({ combobox: comboboxIr, option: optionIr }),
          compiledIr: canonicalJson(compiled.ir),
          ok: comboboxCompare.ok && optionCompare.ok,
        };
      };
      const cycle1 = cycle();
      const cycle2 = cycle();
      return {
        stable:
          cycle1.ok &&
          cycle2.ok &&
          cycle1.sceneIr === cycle2.sceneIr &&
          cycle1.compiledIr === cycle2.compiledIr,
        sourceIrRead: false,
        cycle1SceneIrSha256: sha256(cycle1.sceneIr),
        cycle2SceneIrSha256: sha256(cycle2.sceneIr),
        cycle1CompiledIrSha256: sha256(cycle1.compiledIr),
        cycle2CompiledIrSha256: sha256(cycle2.compiledIr),
        cycle1Comparison: mergeAccounting(
          comboboxAccounting,
          optionAccounting,
        ),
        cycle2Comparison: mergeAccounting(
          comboboxAccounting,
          optionAccounting,
        ),
      };
    };
    const fixedPoint = runFixedPoint();
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      comboboxAccounting,
      optionAccounting,
      accounting: mergeAccounting(comboboxAccounting, optionAccounting),
      fixedPoint,
    };
  });
}

export function assertComboboxLiveV21RootProofs(
  proofs: readonly ComboboxLiveV21RootProof[],
): void {
  if (
    proofs.length !== 2 ||
    new Set(proofs.map((proof) => proof.source)).size !== 2
  )
    throw new TypeError("Combobox live v21 two-root proof denominator invalid");
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
      `Combobox live v21 independent root accounting failed: ${failures.join(";")}`,
    );
}

export function buildComboboxLiveV21ProbeProgram(
  writer: ComboboxLiveV21WriterOwnership,
  sources: readonly ComboboxLiveV21SourceIdentity[],
): string {
  const sourceByAdapter = Object.fromEntries(
    sources.map((source) => [source.adapterIdentity, source.source]),
  );
  return String.raw`
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(COMBOBOX_LIVE_V21_NAMESPACE)},PAGE_ID=${JSON.stringify(writer.pageId)},SET_IDS=new Set(${JSON.stringify(writer.setIds)}),SOURCE_BY_ADAPTER=${JSON.stringify(sourceByAdapter)};
if(PAGE_ID==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE"||page.id==="115:295378")throw new Error("COMBOBOX-V8-PROBE-PAGE");
const get=(node,key)=>node.getSharedPluginData(NS,key),sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.has(node.id));
if(sets.length!==4)throw new Error("COMBOBOX-V8-PROBE-ROOTS:"+sets.length);
const role=node=>{const description=typeof node.description==="string"?node.description:"",match=description.match(/(?:^|\n)recipe-role:([^\n]+)/);if(match)return match[1];const head=node.name.split(" :: ",1)[0]??"";return head.includes("/")&&!head.includes("=")?head:undefined;};
const nodes=root=>[root,...root.findAll()],box=node=>node.absoluteBoundingBox?{x:node.absoluteBoundingBox.x,y:node.absoluteBoundingBox.y,width:node.absoluteBoundingBox.width,height:node.absoluteBoundingBox.height}:null;
const area=value=>value?Math.max(0,value.width)*Math.max(0,value.height):0,intersection=(a,b)=>{if(!a||!b)return null;const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),r=Math.min(a.x+a.width,b.x+b.width),d=Math.min(a.y+a.height,b.y+b.height);return r>x&&d>y?{x,y,width:r-x,height:d-y}:null;};
const visibleLoss=(child,parent)=>{const childArea=area(child);return childArea===0?1:1-area(intersection(child,parent))/childArea;},overlap=(a,b)=>{const hit=intersection(a,b);return hit?Math.min(hit.width,hit.height):0;};
const axes=node=>Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
const propertyKey=(instance,name)=>Object.keys(instance.componentProperties).find(key=>key.split("#")[0]===name),plain=instance=>Object.fromEntries(Object.entries(instance.componentProperties).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
const snapshot=instance=>JSON.stringify({width:instance.width,height:instance.height,properties:plain(instance),nodes:nodes(instance).map(node=>({type:node.type,name:node.name,width:node.width,height:node.height,visible:node.visible!==false,characters:node.type==="TEXT"?node.characters:undefined})).sort((a,b)=>(a.name+a.type).localeCompare(b.name+b.type))});
const sources=[],cells=[];
const byAdapter=new Map();
for(const set of sets){
  const adapterIdentity=get(set,"adapterIdentity"),kind=get(set,"ownershipKey");
  const row=byAdapter.get(adapterIdentity)||{adapterIdentity,source:SOURCE_BY_ADAPTER[adapterIdentity]};
  row[kind]=set;byAdapter.set(adapterIdentity,row);
}
for(const row of byAdapter.values()){
 const {adapterIdentity,source,combobox,option}=row;
 if(!source||!combobox||!option||combobox.children.length!==64||option.children.length!==8)throw new Error("COMBOBOX-V8-PROBE-VARIANTS:"+adapterIdentity);
 const visitSet=(set,kind)=>{
  for(const component of set.children){
   const axis=axes(component),all=nodes(component),byRole=name=>all.filter(node=>role(node)===name);
   const semantic=all.filter(node=>role(node)&&(node.type==="TEXT"||node.type==="INSTANCE")&&node.visible!==false);
   const componentBox=box(component);
   const overlay=all.find(node=>role(node)==="combobox/overlay");void "COMBOBOX-PROBE-EXCLUDE-OVERLAY-AABB";
   const clipSemantic=semantic.filter(node=>!(overlay&&(node===overlay||overlay.findAll&&overlay.findAll().includes(node)||role(node)==="combobox/listbox"||role(node)==="combobox/listbox/empty"||role(node)==="combobox/listbox/loading"||(role(node)||"").startsWith("combobox/option-instance/")||role(node)==="combobox/option/label"&&overlay)));
   const occupancySpacer=node=>node.opacity===0&&(role(node)==="combobox/input"||role(node)==="combobox/option/label"||role(node)==="combobox/listbox/empty"||role(node)==="combobox/listbox/loading");void "COMBOBOX-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP";
   const overlapSemantic=semantic.filter(node=>!occupancySpacer(node)&&!(overlay&&(node===overlay||(role(node)||"").startsWith("combobox/listbox")||(role(node)||"").startsWith("combobox/option-instance/"))));
   let maximumOverlap=0;for(let i=0;i<overlapSemantic.length;i++)for(let j=i+1;j<overlapSemantic.length;j++)maximumOverlap=Math.max(maximumOverlap,overlap(box(overlapSemantic[i]),box(overlapSemantic[j])));
   const noFakeLayout=all.filter(node=>"children" in node).every(node=>node.layoutMode!=="NONE"&&node.children.every(child=>child.layoutPositioning!=="ABSOLUTE"||!!child.constraints));
   const stateSemanticsExact=kind==="option"?true:(axis["Field state"]==="error"?byRole("combobox/message/error").length===1&&byRole("combobox/message/helper").length===0:byRole("combobox/message/helper").length===1&&byRole("combobox/message/error").length===0);
   const expected=kind==="combobox"?["combobox/label","combobox/trigger","combobox/input"]:[ "combobox/option/label"];
   const rolesExact=expected.every(name=>byRole(name).length>=1);
   cells.push({source,adapterIdentity,cellKey:[source,kind,...Object.values(axis)].join("/"),kind,rolesExact,stateSemanticsExact,noFakeLayout,visibleAreaLoss:Math.max(0,...clipSemantic.map(node=>visibleLoss(box(node),componentBox))),overlapPixels:maximumOverlap});
  }
 };
 visitSet(combobox,"combobox");visitSet(option,"option");
 const instance=combobox.defaultVariant.createInstance();page.appendChild(instance);const before=snapshot(instance),beforeWidth=instance.width,original=plain(instance),allBefore=nodes(instance),trigger=allBefore.find(node=>role(node)==="combobox/trigger"),contentText=allBefore.find(node=>node.type==="TEXT"&&role(node)==="combobox/input"),reflowTarget=contentText,triggerWidth=trigger&&trigger.width,reflowTargetWidth=reflowTarget&&reflowTarget.width;
 instance.resizeWithoutConstraints(beforeWidth+64,instance.height);const reflowPassed=instance.width===beforeWidth+64&&trigger&&trigger.width>triggerWidth&&reflowTarget&&reflowTarget.width>reflowTargetWidth;const measureContentFill=node=>{if(!node||node.type!=="TEXT")return false;const hidden=node.visible===false;if(hidden){void "COMBOBOX-PROBE-MEASURE-HIDDEN-CONTENT-FILL";node.visible=true;}const fill=node.layoutSizingHorizontal==="FILL";if(hidden)node.visible=false;return fill;};const contentFillPassed=!!measureContentFill(contentText);instance.resizeWithoutConstraints(beforeWidth,instance.height);
 const visited=new Set(),axisNames=["Size","Appearance","Open","Field state","Content"];
 for(const component of combobox.children){const target=axes(component),updates={};for(const name of axisNames){const key=propertyKey(instance,name);if(!key)throw new Error("COMBOBOX-V8-PROBE-AXIS:"+name);updates[key]=target[name];}instance.setProperties(updates);const main=await instance.getMainComponentAsync();if(main)visited.add(main.id);}
 instance.setProperties(original);const labelKey=propertyKey(instance,"Label"),labelBefore=labelKey&&instance.componentProperties[labelKey].value;let textPropertiesRestored=false;if(labelKey){instance.setProperties({[labelKey]:"Combobox v1 deterministic probe"});const changed=nodes(instance).some(node=>node.type==="TEXT"&&role(node)==="combobox/label"&&node.characters==="Combobox v1 deterministic probe");instance.setProperties({[labelKey]:labelBefore});textPropertiesRestored=changed&&JSON.stringify(original)===JSON.stringify(plain(instance));}
 const optionInstance=option.defaultVariant.createInstance();page.appendChild(optionInstance);const optionVisited=new Set();
 for(const component of option.children){const target=axes(component),updates={};for(const name of ["Size","Option state"]){const key=propertyKey(optionInstance,name);if(!key)throw new Error("COMBOBOX-V8-PROBE-OPTION-AXIS:"+name);updates[key]=target[name];}optionInstance.setProperties(updates);const main=await optionInstance.getMainComponentAsync();if(main)optionVisited.add(main.id);}
 optionInstance.remove();
 const sourceCells=cells.filter(cell=>cell.source===source),bindingCompatibilityPassed=nodes(combobox).concat(nodes(option)).every(node=>Object.values(node.boundVariables||{}).flat().every(alias=>alias&&typeof alias.id==="string"));
 const switchingRestored=JSON.stringify(original)===JSON.stringify(plain(instance)),after=snapshot(instance);instance.remove();
 sources.push({source,adapterIdentity,variants:72,visitedVariants:visited.size+optionVisited.size,reflowPassed:!!reflowPassed,contentFillPassed:!!contentFillPassed,bindingCompatibilityPassed,noFakeLayoutPassed:sourceCells.every(cell=>cell.noFakeLayout),stateSemanticsPassed:sourceCells.every(cell=>cell.stateSemanticsExact),switchingRestored,textPropertiesRestored,exactSceneRestoration:before===after});
}
sources.sort((a,b)=>a.source.localeCompare(b.source));cells.sort((a,b)=>a.cellKey.localeCompare(b.cellKey));
return{pageId:page.id,sources,cells};`;
}

export function validateComboboxLiveV21ProbePayload(
  value: unknown,
  writer: ComboboxLiveV21WriterOwnership,
): ComboboxLiveV21ProbePayload {
  const payload = record(value, "probe payload") as ComboboxLiveV21ProbePayload;
  const requiredSourceBooleans = [
    "reflowPassed",
    "contentFillPassed",
    "bindingCompatibilityPassed",
    "noFakeLayoutPassed",
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
        source.variants !== 72 ||
        source.visitedVariants !== 72 ||
        requiredSourceBooleans.some((field) => source[field] !== true),
    ) ||
    !Array.isArray(payload.cells) ||
    payload.cells.length !== COMBOBOX_LIVE_V21_VARIANT_COUNT ||
    new Set(payload.cells.map((cell) => cell.cellKey)).size !==
      COMBOBOX_LIVE_V21_VARIANT_COUNT ||
    payload.cells.some(
      (cell) =>
        cell.rolesExact !== true ||
        cell.stateSemanticsExact !== true ||
        cell.noFakeLayout !== true ||
        !finiteNonnegative(cell.visibleAreaLoss) ||
        cell.visibleAreaLoss > 0.05 ||
        !finiteNonnegative(cell.overlapPixels) ||
        cell.overlapPixels > 2,
    )
  )
    throw new TypeError("Combobox live v21 probe/usability/restoration failed");
  return payload;
}

export function validateComboboxLiveV21CaptureManifest(
  cells: readonly ComboboxLiveV21CaptureCell[],
): void {
  const order = cells.map((cell) => cell.index);
  if (
    cells.length !== COMBOBOX_LIVE_V21_CAPTURE_COUNT ||
    new Set(cells.map((cell) => cell.cellKey)).size !==
      COMBOBOX_LIVE_V21_CAPTURE_COUNT ||
    new Set(order).size !== COMBOBOX_LIVE_V21_CAPTURE_COUNT ||
    order.some((index, expected) => index !== expected) ||
    cells.some(
      (cell) =>
        !COMBOBOX_LIVE_V21_SOURCE_IDS.includes(cell.source) ||
        !cell.adapterIdentity ||
        !cell.cellKey ||
        (cell.kind !== "combobox" && cell.kind !== "option") ||
        !Number.isFinite(cell.frame.width) ||
        cell.frame.width <= 0 ||
        !Number.isFinite(cell.frame.height) ||
        cell.frame.height <= 0,
    )
  )
    throw new TypeError("Combobox live v21 capture manifest is malformed");
}

export const comboboxLiveV5CaptureManifestSha256 = (
  cells: readonly ComboboxLiveV21CaptureCell[],
): string => {
  validateComboboxLiveV21CaptureManifest(cells);
  return sha256(canonicalJson(cells));
};

export function buildComboboxLiveV21CaptureProgram(
  writer: ComboboxLiveV21WriterOwnership,
  cell: ComboboxLiveV21CaptureCell,
): string {
  if (
    !Number.isInteger(cell.index) ||
    cell.index < 0 ||
    cell.index >= COMBOBOX_LIVE_V21_CAPTURE_COUNT
  )
    throw new TypeError("Combobox live v21 capture cell is malformed");
  const source = writer.sources.find(
    (candidate) => candidate.adapterIdentity === cell.adapterIdentity,
  );
  const expectedSet =
    cell.kind === "combobox" ? source?.comboboxSetId : source?.optionSetId;
  if (!expectedSet)
    throw new TypeError(
      `Combobox live v21 capture adapter absent: ${cell.cellKey}`,
    );
  return String.raw`
${FIGMA_PORTABLE_RUNTIME}
await figma.loadAllPagesAsync();
const page=await figma.getNodeByIdAsync(${JSON.stringify(writer.pageId)}),set=await figma.getNodeByIdAsync(${JSON.stringify(expectedSet)}),cell=${JSON.stringify(cell)};
if(!page||page.type!=="PAGE"||page.id==="115:295378"||!set||set.type!=="COMPONENT_SET")throw new Error("COMBOBOX-V8-CAPTURE-TARGET");
const axes=node=>Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
const component=set.children.find(node=>{const value=axes(node);return Object.entries(cell.axes).every(([name,wanted])=>value[name]===wanted);});
if(!component)throw new Error("COMBOBOX-V8-CAPTURE-CELL:"+cell.cellKey);
const frame=figma.createFrame();frame.name="Combobox v1 ephemeral / "+cell.cellKey;page.appendChild(frame);
try{
 frame.resizeWithoutConstraints(cell.frame.width,cell.frame.height);frame.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];frame.clipsContent=true;
 const instance=component.createInstance();frame.appendChild(instance);instance.x=(frame.width-instance.width)/2;instance.y=(frame.height-instance.height)/2;
 const bytes=await frame.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
 if(bytes.byteLength>${COMBOBOX_LIVE_V21_CAPTURE_MAX_PNG_BYTES})throw new Error("COMBOBOX-V8-CAPTURE-SIZE:"+bytes.byteLength);
 const pngSha256=runtimeSha256(bytes),pngBase64=figma.base64Encode(bytes);
 return{index:cell.index,cellKey:cell.cellKey,source:cell.source,frameWidth:frame.width,frameHeight:frame.height,componentWidth:instance.width,componentHeight:instance.height,pngBytes:bytes.byteLength,pngSha256,pngBase64,temporaryNodesRemaining:0};
}finally{frame.remove();}`;
}

export function validateComboboxLiveV21CapturePayload(
  value: unknown,
  cell: ComboboxLiveV21CaptureCell,
  rawResponseBytes: number,
): ComboboxLiveV21CapturePayload {
  const payload = record(
    value,
    "capture payload",
  ) as ComboboxLiveV21CapturePayload;
  if (
    rawResponseBytes > COMBOBOX_LIVE_V21_CAPTURE_MAX_RAW_RESPONSE_BYTES ||
    payload.index !== cell.index ||
    payload.cellKey !== cell.cellKey ||
    payload.source !== cell.source ||
    !Number.isFinite(payload.componentWidth) ||
    payload.componentWidth <= 0 ||
    !Number.isFinite(payload.componentHeight) ||
    payload.componentHeight <= 0 ||
    !Number.isInteger(payload.pngBytes) ||
    payload.pngBytes <= 0 ||
    payload.pngBytes > COMBOBOX_LIVE_V21_CAPTURE_MAX_PNG_BYTES ||
    !SHA256.test(payload.pngSha256) ||
    typeof payload.pngBase64 !== "string" ||
    payload.pngBase64.length === 0 ||
    Buffer.byteLength(payload.pngBase64, "utf8") < 8 ||
    sha256(Buffer.from(payload.pngBase64, "base64")) !== payload.pngSha256 ||
    payload.temporaryNodesRemaining !== 0
  )
    throw new TypeError(
      `Combobox live v21 capture truncated/mismatched: ${cell.cellKey}`,
    );
  return payload;
}

export function assertComboboxLiveV21CaptureResponses(
  manifest: readonly ComboboxLiveV21CaptureCell[],
  responses: readonly ComboboxLiveV21CapturePayload[],
): void {
  validateComboboxLiveV21CaptureManifest(manifest);
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
      "Combobox live v21 capture responses contain truncation/duplicate/missing cells",
    );
}

export interface ComboboxLiveV21ObjectiveReport {
  artifactVersion: "combobox-live-v21-objective-report-v1";
  denominator: 72;
  technicalPassed: boolean;
  legacyVisualComparison: false;
  rows: Array<{
    index: number;
    cellKey: string;
    source: ComboboxLiveV21SourceId;
    liveSha256: string;
  }>;
  failures: string[];
}

export function evaluateComboboxLiveV21Objective(
  manifest: readonly ComboboxLiveV21CaptureCell[],
  responses: readonly ComboboxLiveV21CapturePayload[],
): ComboboxLiveV21ObjectiveReport {
  assertComboboxLiveV21CaptureResponses(manifest, responses);
  return {
    artifactVersion: "combobox-live-v21-objective-report-v1",
    denominator: 72,
    technicalPassed: true,
    legacyVisualComparison: false,
    rows: manifest.map((cell, index) => ({
      index: cell.index,
      cellKey: cell.cellKey,
      source: cell.source,
      liveSha256: responses[index]!.pngSha256,
    })),
    failures: [],
  };
}

export function buildComboboxLiveV21CleanupProgram(
  writer: ComboboxLiveV21WriterOwnership,
): string {
  const baseProgram = buildComboboxLiveV21CleanupRuntime({
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    fileName: "Scratch Project",
    editorType: "figma",
    namespace: COMBOBOX_LIVE_V21_NAMESPACE,
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    adapterIdentities: writer.sources.map((source) => source.adapterIdentity),
  });
  const resultStatement =
    "return{requestedNodeIds,removedNodeIds,requestedCollectionIds,removedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:true};";
  const guardedResult = `if(JSON.stringify(requestedNodeIds)!==JSON.stringify([expectedPageId])||JSON.stringify([...requestedCollectionIds].sort())!==JSON.stringify([...expectedCollectionIds].sort()))throw new Error("COMBOBOX-V8-CLEANUP-EXACT-OWNERSHIP");${resultStatement}`;
  const program = baseProgram.replace(resultStatement, guardedResult);
  if (program === baseProgram)
    throw new Error("Combobox live v21 cleanup runtime result hook absent");
  return String.raw`
const expectedPageId=${JSON.stringify(writer.pageId)},expectedCollectionIds=${JSON.stringify(writer.collectionIds)};
if(expectedPageId==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
${program}
`;
}

export function validateComboboxLiveV21CleanupPayload(
  payload: unknown,
  writer: ComboboxLiveV21WriterOwnership,
): ComboboxLiveV21CleanupPayload {
  const value = record(payload, "cleanup payload") as ComboboxLiveV21CleanupPayload;
  if (
    value.complete !== true ||
    value.remainingOwnedNodes !== 0 ||
    value.remainingOwnedCollections !== 0 ||
    canonicalJson(value.requestedNodeIds) !==
      canonicalJson([writer.pageId]) ||
    canonicalJson(value.removedNodeIds) !== canonicalJson([writer.pageId]) ||
    canonicalJson([...value.requestedCollectionIds].sort()) !==
      canonicalJson([...writer.collectionIds].sort()) ||
    canonicalJson([...value.removedCollectionIds].sort()) !==
      canonicalJson([...writer.collectionIds].sort()) ||
    writer.pageId === FORBIDDEN_INPUT_PAGE_ID
  )
    throw new TypeError("Combobox live v21 cleanup is incomplete or overbroad");
  return value;
}

export const COMBOBOX_LIVE_V21_RESPONSE_CONTRACTS = Object.freeze({
  writer: {
    schema: "ComboboxLiveV21WriterPayload",
    cardinality: {
      pages: 1,
      sections: 2,
      sets: 4,
      sourceRoots: 2,
      variants: 144,
      collections: 2,
    },
  },
  restore: {
    schema: "ComboboxLiveV21RestorePayload",
    cardinality: { pages: 1, sets: 4, contentTexts: 144 },
  },
  extract: {
    schema: "ComboboxLiveV21ExtractPayload",
    cardinality: { pages: 1, sourceRoots: 2, sets: 4, localVariableTables: 1 },
  },
  probe: {
    schema: "ComboboxLiveV21ProbePayload",
    cardinality: { sourceRoots: 2, sourceProbes: 2, variantCells: 144 },
  },
  capture: {
    schema: "ComboboxLiveV21CapturePayload",
    cardinality: { captureCellsPerRequest: 1, captureRequests: 72 },
  },
  cleanup: {
    schema: "ComboboxLiveV21CleanupPayload",
    cardinality: { ownedPages: 1, ownedCollections: 2 },
  },
});
