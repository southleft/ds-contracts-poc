import { createHash } from "node:crypto";

import {
  FORBIDDEN_COMBOBOX_NAMESPACE,
  FORBIDDEN_COMBOBOX_PAGE_ID,
  FORBIDDEN_COMBOBOX_RUN_IDENTITY,
  FORBIDDEN_INPUT_NAMESPACE,
  FORBIDDEN_INPUT_PAGE_ID,
  FORBIDDEN_INPUT_RUN_IDENTITY,
  FORBIDDEN_TABLE_V1_RUN_IDENTITY,
  FORBIDDEN_TABLE_V2_RUN_IDENTITY,
  FORBIDDEN_TABLE_V3_RUN_IDENTITY,
  FORBIDDEN_TABLE_V4_RUN_IDENTITY,
  FORBIDDEN_TABLE_V5_RUN_IDENTITY,
  FORBIDDEN_TABLE_V6_RUN_IDENTITY,
  FORBIDDEN_TABLE_V7_RUN_IDENTITY,
  FORBIDDEN_TABLE_V8_RUN_IDENTITY,
  FORBIDDEN_TABLE_V9_RUN_IDENTITY,
  FORBIDDEN_TABLE_V10_RUN_IDENTITY,
  FORBIDDEN_TABLE_V11_RUN_IDENTITY,
  FORBIDDEN_TABLE_V12_RUN_IDENTITY,
  FORBIDDEN_TABLE_V13_RUN_IDENTITY,
  FORBIDDEN_TABLE_V14_RUN_IDENTITY,
  FORBIDDEN_TABLE_V15_RUN_IDENTITY,
  FORBIDDEN_TABLE_V16_RUN_IDENTITY,
  FORBIDDEN_TABLE_V17_RUN_IDENTITY,
  FORBIDDEN_TABLE_V18_RUN_IDENTITY,
  FORBIDDEN_TABLE_V19_RUN_IDENTITY,
  FORBIDDEN_TABLE_V20_RUN_IDENTITY,
  FORBIDDEN_TABLE_V21_RUN_IDENTITY,
  FORBIDDEN_TABLE_V22_RUN_IDENTITY,
  TABLE_FIGMA_NAMESPACE,
} from "./table-figma-writer.js";
import { buildTableLiveV23CleanupRuntime } from "./table-live-v23-cleanup.js";
import { type TableLiveV23FixedFixedPoint } from "./table-live-v23-fixed-point.js";
import { hashRecipeEnvelope } from "./hash.js";
import {
  buildTableLiveV23RestoreProgram,
  validateTableLiveV23RestorePayload,
  type TableLiveV23RestorePayload,
} from "./table-live-v23-restore.js";
import {
  buildTableLiveV23RawPropertyRuntime,
  normalizeTableLiveV23Scene,
  type TableLiveV23RawNode,
} from "./table-live-v23-verifier.js";
import type { RecipeEnvelope } from "./envelope.js";
import type { LocalVariableRecord } from "./figma-property-normalizer-v8.js";
import { FIGMA_PORTABLE_RUNTIME } from "./figma-runtime-portability.js";
import { canonicalJson } from "./normalize.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-table-v23.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
  sceneToNormalizedIr,
  type ExpectedScenePlan,
  type SceneComparison,
} from "./scene-readback-table-v1.js";

export {
  buildTableLiveV23RestoreProgram,
  validateTableLiveV23RestorePayload,
  type TableLiveV23RestorePayload,
};

export const TABLE_LIVE_V23_NAMESPACE = TABLE_FIGMA_NAMESPACE;
export const TABLE_LIVE_V23_SOURCE_IDS = ["first-party", "mui"] as const;
export const TABLE_LIVE_V23_ADAPTERS = [
  "first-party-table-reviewed-v1",
  "material-table-reviewed-v1",
] as const;
export const TABLE_LIVE_V23_CAPTURE_COUNT = 20;
export const TABLE_LIVE_V23_VARIANT_COUNT = 20;
export const TABLE_LIVE_V23_SET_COUNT = 6;
export const TABLE_LIVE_V23_REMOTE_REQUESTS = 25;
export const TABLE_LIVE_V23_HOST_PHASES = 3;
export const TABLE_LIVE_V23_SOURCE_ROOTS = 2;
export const TABLE_LIVE_V23_RESTORE_COUNT = 8;
export const TABLE_LIVE_V23_CAPTURE_MAX_PNG_BYTES = 1_500_000;
export const TABLE_LIVE_V23_CAPTURE_MAX_RAW_RESPONSE_BYTES = 2_100_000;

export type TableLiveV23SourceId = (typeof TABLE_LIVE_V23_SOURCE_IDS)[number];
export type TableLiveV23Kind = "table" | "row" | "cell";

export interface TableLiveV23SourceIdentity {
  source: TableLiveV23SourceId;
  adapterIdentity: string;
  recipeHash: string;
  envelopeHash: string;
  tableExpectedScenePlan: ExpectedScenePlan;
  rowExpectedScenePlan: ExpectedScenePlan;
  cellExpectedScenePlan: ExpectedScenePlan;
}

export interface TableLiveV23WriterOwnership {
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
    tableSetId: string;
    rowSetId: string;
    cellSetId: string;
    sectionId: string;
    collectionId: string;
    variableCount: number;
    variantCount: 10;
    tableCells: 2;
    rowCells: 4;
    cellCells: 4;
    recipeHash: string;
    envelopeHash: string;
  }>;
  counts: {
    sources: 2;
    variants: 20;
    collections: 2;
    sets: 6;
    nodes: number;
  };
}

export interface TableLiveV23ExtractPayload {
  pageId: string;
  roots: Array<{
    source: TableLiveV23SourceId;
    adapterIdentity: string;
    tableSetId: string;
    rowSetId: string;
    cellSetId: string;
    tableScene: TableLiveV23RawNode;
    rowScene: TableLiveV23RawNode;
    cellScene: TableLiveV23RawNode;
  }>;
  variableTable: LocalVariableRecord[];
}

export interface TableLiveV23RootProof {
  source: TableLiveV23SourceId;
  adapterIdentity: string;
  tableAccounting: SceneComparison;
  rowAccounting: SceneComparison;
  cellAccounting: SceneComparison;
  accounting: SceneComparison;
  fixedPoint: TableLiveV23FixedFixedPoint;
}

export interface TableLiveV23ProbePayload {
  pageId: string;
  sources: Array<{
    source: TableLiveV23SourceId;
    adapterIdentity: string;
    variants: 10;
    visitedVariants: 10;
    reflowPassed: boolean;
    contentHugPassed: boolean;
    bindingCompatibilityPassed: boolean;
    noFakeLayoutPassed: boolean;
    stateSemanticsPassed: boolean;
    switchingRestored: boolean;
    textPropertiesRestored: boolean;
    exactSceneRestoration: boolean;
  }>;
  cells: Array<{
    source: TableLiveV23SourceId;
    adapterIdentity: string;
    cellKey: string;
    kind: TableLiveV23Kind;
    rolesExact: boolean;
    stateSemanticsExact: boolean;
    noFakeLayout: boolean;
    visibleAreaLoss: number;
    overlapPixels: number;
  }>;
}

export interface TableLiveV23CaptureCell {
  index: number;
  cellKey: string;
  source: TableLiveV23SourceId;
  adapterIdentity: string;
  kind: TableLiveV23Kind;
  axes: Record<string, string>;
  strata: {
    source: TableLiveV23SourceId;
    kind: TableLiveV23Kind;
    density: string;
  };
  frame: { width: number; height: number };
}

export interface TableLiveV23CapturePayload {
  index: number;
  cellKey: string;
  source: TableLiveV23SourceId;
  frameWidth: number;
  frameHeight: number;
  componentWidth: number;
  componentHeight: number;
  pngBytes: number;
  pngSha256: string;
  pngBase64: string;
  temporaryNodesRemaining: 0;
}

export interface TableLiveV23CleanupPayload {
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
    throw new TypeError(`Table live v23 ${label} must be an object`);
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
  failures: [...left.failures, ...right.failures],
  codeOnly: left.codeOnly + right.codeOnly,
  refused: left.refused + right.refused,
});

export function validateTableLiveV23WriterPayload(
  value: unknown,
): TableLiveV23WriterOwnership {
  const envelope = record(value, "writer payload");
  const result = record(envelope.result ?? envelope, "writer result");
  const sources = result.sources;
  if (
    typeof result.pageId !== "string" ||
    !result.pageId ||
    result.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    result.pageId === FORBIDDEN_COMBOBOX_PAGE_ID ||
    typeof result.pageName !== "string" ||
    !result.pageName ||
    result.pageName.includes(FORBIDDEN_INPUT_PAGE_ID) ||
    result.pageName.includes(FORBIDDEN_COMBOBOX_PAGE_ID) ||
    typeof result.runIdentity !== "string" ||
    !result.runIdentity ||
    result.runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_COMBOBOX_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V1_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V2_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V3_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V4_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V5_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V6_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V7_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V8_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V9_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V10_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V11_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V12_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V13_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V14_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V15_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V16_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V17_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V18_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V19_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V20_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V21_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_TABLE_V22_RUN_IDENTITY ||
    result.namespace === FORBIDDEN_INPUT_NAMESPACE ||
    result.namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    result.namespace !== TABLE_LIVE_V23_NAMESPACE ||
    !Array.isArray(sources) ||
    sources.length !== 2 ||
    new Set(sources.map((source: any) => source.adapterIdentity)).size !== 2 ||
    sources.some(
      (source: any) =>
        typeof source.tableSetId !== "string" ||
        typeof source.rowSetId !== "string" ||
        typeof source.cellSetId !== "string" ||
        typeof source.sectionId !== "string" ||
        typeof source.collectionId !== "string" ||
        source.variantCount !== 10 ||
        source.tableCells !== 2 ||
        source.rowCells !== 4 ||
        source.cellCells !== 4 ||
        !Number.isInteger(source.variableCount) ||
        source.variableCount <= 0 ||
        !SHA256.test(source.recipeHash) ||
        !SHA256.test(source.envelopeHash),
    )
  )
    throw new TypeError("Table live v23 writer schema/cardinality mismatch");
  const createdNodeIds = result.createdNodeIds;
  if (
    !Array.isArray(createdNodeIds) ||
    createdNodeIds.length === 0 ||
    createdNodeIds.some((id: unknown) => typeof id !== "string" || !id) ||
    new Set(createdNodeIds).size !== createdNodeIds.length
  )
    throw new TypeError("Table live v23 writer created-node denominator invalid");
  const setIds = sources.flatMap((source: any) => [
    source.tableSetId,
    source.rowSetId,
    source.cellSetId,
  ]);
  if (new Set(setIds).size !== 6)
    throw new TypeError("Table live v23 writer set identity collision");
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
      variants: 20,
      collections: 2,
      sets: 6,
      nodes: createdNodeIds.length,
    },
  };
}

const identityPlan = (
  source: TableLiveV23SourceIdentity,
  kind: TableLiveV23Kind,
) => {
  const plan =
    kind === "table"
      ? source.tableExpectedScenePlan
      : kind === "row"
        ? source.rowExpectedScenePlan
        : source.cellExpectedScenePlan;
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

export function buildTableLiveV23ExtractProgram(
  writer: TableLiveV23WriterOwnership,
  sources: readonly TableLiveV23SourceIdentity[],
): string {
  if (sources.length !== 2)
    throw new TypeError("Table live v23 extract requires two source identities");
  if (
    writer.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    writer.pageId === FORBIDDEN_COMBOBOX_PAGE_ID
  )
    throw new TypeError("Table extract must not target Input or Combobox pages");
  const identities = Object.fromEntries(
    sources.map((source) => [
      source.adapterIdentity,
      {
        table: {
          ...identityPlan(source, "table"),
          runIdentity: writer.runIdentity,
        },
        row: {
          ...identityPlan(source, "row"),
          runIdentity: writer.runIdentity,
        },
        cell: {
          ...identityPlan(source, "cell"),
          runIdentity: writer.runIdentity,
        },
      },
    ]),
  );
  return String.raw`
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(TABLE_LIVE_V23_NAMESPACE)};
const PAGE_ID=${JSON.stringify(writer.pageId)};
const SET_IDS=new Set(${JSON.stringify(writer.setIds)});
const SOURCE_BY_ADAPTER=${JSON.stringify(
    Object.fromEntries(
      sources.map((source) => [source.adapterIdentity, source.source]),
    ),
  )};
const IDENTITIES=${JSON.stringify(identities)};
if(PAGE_ID==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(PAGE_ID==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
${buildFigmaSceneReadbackRuntime(TABLE_LIVE_V23_NAMESPACE)}
${buildTableLiveV23RawPropertyRuntime()}
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("TABLE-V2-EXTRACT-PAGE");
if(page.id==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
const get=(node,key)=>node.getSharedPluginData(NS,key);
if(get(page,"pageOwner")!=="recipe/table/"+${JSON.stringify(writer.runIdentity)})throw new Error("TABLE-V2-EXTRACT-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.has(node.id));
if(sets.length!==6)throw new Error("TABLE-V2-EXTRACT-ROOTS:"+sets.length);
const decorate=async(node,snapshot)=>{
  Object.assign(snapshot,inputV4RawNodeProperties(node));
  if("children" in node){
    let snapshotIndex=0;
    for(let index=0;index<node.children.length;index++){
      const child=node.children[index];
      const untaggedOwnedCellLabelBindHost=child.type==="TEXT"&&!get(child,"ownershipKey")&&String(child.name||"").indexOf("table/row/owned-cell-label/")===0&&child.componentPropertyReferences&&child.componentPropertyReferences.characters;
      if(untaggedOwnedCellLabelBindHost)continue;
      await decorate(child,snapshot.children[snapshotIndex]);
      snapshotIndex++;
    }
  }
};
const byAdapter=new Map();
for(const set of sets){
  const adapterIdentity=get(set,"adapterIdentity");
  const kind=get(set,"ownershipKey");
  if(!IDENTITIES[adapterIdentity]||(kind!=="table"&&kind!=="row"&&kind!=="cell"))throw new Error("TABLE-V2-EXTRACT-ADAPTER:"+adapterIdentity+":"+kind);
  const expected=IDENTITIES[adapterIdentity][kind];
  const scene=await readSceneDerivedTree(set,expected,expected);
  await decorate(set,scene);
  const row=byAdapter.get(adapterIdentity)||{adapterIdentity,source:SOURCE_BY_ADAPTER[adapterIdentity]};
  if(kind==="table"){row.tableSetId=set.id;row.tableScene=scene;}
  else if(kind==="row"){row.rowSetId=set.id;row.rowScene=scene;}
  else{row.cellSetId=set.id;row.cellScene=scene;}
  byAdapter.set(adapterIdentity,row);
}
const roots=[...byAdapter.values()];
if(roots.length!==2||roots.some(root=>!root.tableScene||!root.rowScene||!root.cellScene))throw new Error("TABLE-V2-EXTRACT-TRIPLE");
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

export function validateTableLiveV23ExtractPayload(
  value: unknown,
  writer: TableLiveV23WriterOwnership,
): TableLiveV23ExtractPayload {
  const payload = record(value, "extract payload");
  const leaks = forbiddenExtractKeys(payload);
  if (leaks.length)
    throw new TypeError(
      `Table live v23 extract contains source IR facts: ${leaks.join(",")}`,
    );
  if (
    payload.pageId !== writer.pageId ||
    payload.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    payload.pageId === FORBIDDEN_COMBOBOX_PAGE_ID ||
    !Array.isArray(payload.roots) ||
    payload.roots.length !== 2 ||
    new Set(payload.roots.map((root: any) => root.source)).size !== 2 ||
    new Set(payload.roots.map((root: any) => root.adapterIdentity)).size !==
      2 ||
    payload.roots.some(
      (root: any) =>
        !TABLE_LIVE_V23_SOURCE_IDS.includes(root.source) ||
        !writer.setIds.includes(root.tableSetId) ||
        !writer.setIds.includes(root.rowSetId) ||
        !writer.setIds.includes(root.cellSetId) ||
        !root.tableScene ||
        !root.rowScene ||
        !root.cellScene ||
        root.tableScene.ownershipKey !== "table" ||
        root.rowScene.ownershipKey !== "row" ||
        root.cellScene.ownershipKey !== "cell",
    ) ||
    !Array.isArray(payload.variableTable) ||
    payload.variableTable.length === 0
  )
    throw new TypeError("Table live v23 extract schema/two-root mismatch");
  return payload as TableLiveV23ExtractPayload;
}

export function proveTableLiveV23Roots<Instance>(
  extract: TableLiveV23ExtractPayload,
  sources: readonly (TableLiveV23SourceIdentity & {
    envelope: RecipeEnvelope;
    selection: unknown;
  })[],
  collapse: (envelope: unknown, selection: unknown) => Instance,
  compile: (instance: unknown) => RecipeEnvelope,
): TableLiveV23RootProof[] {
  if (extract.roots.length !== 2 || sources.length !== 2)
    throw new TypeError("Table live v23 proof requires two independent roots");
  return sources.map((source) => {
    const root = extract.roots.find(
      (candidate) =>
        candidate.source === source.source &&
        candidate.adapterIdentity === source.adapterIdentity,
    );
    if (!root)
      throw new TypeError(`Table live v23 omitted ${source.source} root`);
    const tableNormalized = normalizeTableLiveV23Scene(
      root.tableScene,
      extract.variableTable,
    );
    const rowNormalized = normalizeTableLiveV23Scene(
      root.rowScene,
      extract.variableTable,
    );
    const cellNormalized = normalizeTableLiveV23Scene(
      root.cellScene,
      extract.variableTable,
    );
    const tableAccounting = compareSceneToExpectedPlan(
      source.tableExpectedScenePlan,
      tableNormalized.scene,
    );
    const rowAccounting = compareSceneToExpectedPlan(
      source.rowExpectedScenePlan,
      rowNormalized.scene,
    );
    const cellAccounting = compareSceneToExpectedPlan(
      source.cellExpectedScenePlan,
      cellNormalized.scene,
    );
    const runFixedPoint = (): TableLiveV23FixedFixedPoint => {
      const cycle = () => {
        const observedEnvelope = structuredClone(source.envelope);
        if (observedEnvelope.ir.kind !== "frame")
          throw new TypeError("Table live v23 compile root must be library frame");
        const tableIr = sceneToNormalizedIr(tableNormalized.scene);
        const rowIr = sceneToNormalizedIr(rowNormalized.scene);
        const cellIr = sceneToNormalizedIr(cellNormalized.scene);
        observedEnvelope.ir = {
          ...observedEnvelope.ir,
          children: [tableIr, rowIr, cellIr],
        };
        observedEnvelope.integrity.canonicalHash =
          hashRecipeEnvelope(observedEnvelope);
        const compiled = compile(
          collapse(observedEnvelope, source.selection),
        );
        if (compiled.ir.kind !== "frame")
          throw new TypeError("Table live v23 compile lost library frame");
        const compiledTable = compiled.ir.children.find(
          (child) => child.role === "table/set",
        );
        const compiledRow = compiled.ir.children.find(
          (child) => child.role === "table/row-set",
        );
        const compiledCell = compiled.ir.children.find(
          (child) => child.role === "table/cell-set",
        );
        if (!compiledTable || !compiledRow || !compiledCell)
          throw new TypeError("Table live v23 compile lost owned sets");
        const tableCompare = compareSceneToExpectedPlan(
          compileExpectedScenePlan(compiledTable, {
            rootOwnershipKey: "table",
          }),
          tableNormalized.scene,
          {
            omitOpacityOwnershipKeys:
              contentTextOwnershipKeysWithoutCompileOpacity(
                compiledTable,
                "table",
              ),
          },
        );
        const rowCompare = compareSceneToExpectedPlan(
          compileExpectedScenePlan(compiledRow, { rootOwnershipKey: "row" }),
          rowNormalized.scene,
          {
            omitOpacityOwnershipKeys:
              contentTextOwnershipKeysWithoutCompileOpacity(compiledRow, "row"),
          },
        );
        const cellCompare = compareSceneToExpectedPlan(
          compileExpectedScenePlan(compiledCell, { rootOwnershipKey: "cell" }),
          cellNormalized.scene,
          {
            omitOpacityOwnershipKeys:
              contentTextOwnershipKeysWithoutCompileOpacity(
                compiledCell,
                "cell",
              ),
          },
        );
        return {
          sceneIr: canonicalJson({
            table: tableIr,
            row: rowIr,
            cell: cellIr,
          }),
          compiledIr: canonicalJson(compiled.ir),
          ok: tableCompare.ok && rowCompare.ok && cellCompare.ok,
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
          mergeAccounting(tableAccounting, rowAccounting),
          cellAccounting,
        ),
        cycle2Comparison: mergeAccounting(
          mergeAccounting(tableAccounting, rowAccounting),
          cellAccounting,
        ),
      };
    };
    const fixedPoint = runFixedPoint();
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      tableAccounting,
      rowAccounting,
      cellAccounting,
      accounting: mergeAccounting(
        mergeAccounting(tableAccounting, rowAccounting),
        cellAccounting,
      ),
      fixedPoint,
    };
  });
}

export function assertTableLiveV23RootProofs(
  proofs: readonly TableLiveV23RootProof[],
): void {
  if (
    proofs.length !== 2 ||
    new Set(proofs.map((proof) => proof.source)).size !== 2
  )
    throw new TypeError("Table live v23 two-root proof denominator invalid");
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
      `Table live v23 independent root accounting failed: ${failures.join(";")}`,
    );
}

export function buildTableLiveV23ProbeProgram(
  writer: TableLiveV23WriterOwnership,
  sources: readonly TableLiveV23SourceIdentity[],
): string {
  const sourceByAdapter = Object.fromEntries(
    sources.map((source) => [source.adapterIdentity, source.source]),
  );
  return String.raw`
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(TABLE_LIVE_V23_NAMESPACE)},PAGE_ID=${JSON.stringify(writer.pageId)},SET_IDS=new Set(${JSON.stringify(writer.setIds)}),SOURCE_BY_ADAPTER=${JSON.stringify(sourceByAdapter)};
if(PAGE_ID==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(PAGE_ID==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE"||page.id==="115:295378"||page.id==="163:35981")throw new Error("TABLE-V2-PROBE-PAGE");
const get=(node,key)=>node.getSharedPluginData(NS,key),sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.has(node.id));
if(sets.length!==6)throw new Error("TABLE-V2-PROBE-ROOTS:"+sets.length);
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
 const {adapterIdentity,source,table,row:rowSet,cell}=row;
 if(!source||!table||!rowSet||!cell||table.children.length!==2||rowSet.children.length!==4||cell.children.length!==4)throw new Error("TABLE-V2-PROBE-VARIANTS:"+adapterIdentity);
 const visitSet=(set,kind)=>{
  for(const component of set.children){
   const axis=axes(component),all=nodes(component),byRole=name=>all.filter(node=>role(node)===name);
   const semantic=all.filter(node=>role(node)&&(node.type==="TEXT"||node.type==="INSTANCE")&&node.visible!==false);
   const componentBox=box(component);
   const occupancySpacer=node=>node.opacity===0&&role(node)==="table/cell/label";void "TABLE-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP";
   const overlapSemantic=semantic.filter(node=>!occupancySpacer(node));
   let maximumOverlap=0;for(let i=0;i<overlapSemantic.length;i++)for(let j=i+1;j<overlapSemantic.length;j++)maximumOverlap=Math.max(maximumOverlap,overlap(box(overlapSemantic[i]),box(overlapSemantic[j])));
   const noFakeLayout=all.filter(node=>"children" in node).every(node=>node.layoutMode!=="NONE"&&node.children.every(child=>child.layoutPositioning!=="ABSOLUTE"||!!child.constraints));
   const stateSemanticsExact=kind==="row"?axis.State==="selected"||axis.State==="default":true;
   const expected=kind==="table"?["table/header","table/body"]:kind==="row"?["table/cell-instance/0","table/cell-instance/1","table/cell-instance/2"]:["table/cell/label"];
   const rolesExact=expected.every(name=>byRole(name).length>=1);
   cells.push({source,adapterIdentity,cellKey:[source,kind,...Object.values(axis)].join("/"),kind,rolesExact,stateSemanticsExact,noFakeLayout,visibleAreaLoss:Math.max(0,...semantic.map(node=>visibleLoss(box(node),componentBox))),overlapPixels:maximumOverlap});
  }
 };
 visitSet(table,"table");visitSet(rowSet,"row");visitSet(cell,"cell");
 const instance=table.defaultVariant.createInstance();page.appendChild(instance);const before=snapshot(instance),beforeWidth=instance.width,original=plain(instance),allBefore=nodes(instance),label=allBefore.find(node=>node.type==="TEXT"&&role(node)==="table/cell/label");
 instance.resizeWithoutConstraints(beforeWidth+64,instance.height);const reflowPassed=instance.width===beforeWidth+64;const measureContentHug=node=>{if(!node||node.type!=="TEXT")return false;const hidden=node.visible===false;if(hidden)node.visible=true;const hug=node.layoutSizingHorizontal==="HUG";if(hidden)node.visible=false;return hug;};const contentHugPassed=!!measureContentHug(label);instance.resizeWithoutConstraints(beforeWidth,instance.height);
 const visited=new Set(),axisNames=["Density"];
 for(const component of table.children){const target=axes(component),updates={};for(const name of axisNames){const key=propertyKey(instance,name);if(!key)throw new Error("TABLE-V2-PROBE-AXIS:"+name);updates[key]=target[name];}instance.setProperties(updates);const main=await instance.getMainComponentAsync();if(main)visited.add(main.id);}
 instance.setProperties(original);
 const rowInstance=rowSet.defaultVariant.createInstance();page.appendChild(rowInstance);const rowVisited=new Set();
 for(const component of rowSet.children){const target=axes(component),updates={};for(const name of ["Density","State"]){const key=propertyKey(rowInstance,name);if(!key)throw new Error("TABLE-V2-PROBE-ROW-AXIS:"+name);updates[key]=target[name];}rowInstance.setProperties(updates);const main=await rowInstance.getMainComponentAsync();if(main)rowVisited.add(main.id);}
 const cell0=propertyKey(rowInstance,"Cell 0"),cell0Before=cell0&&rowInstance.componentProperties[cell0].value;let textPropertiesRestored=false;if(cell0){rowInstance.setProperties({[cell0]:"Table v13 deterministic probe"});const changed=nodes(rowInstance).some(node=>node.type==="TEXT"&&node.characters==="Table v13 deterministic probe");rowInstance.setProperties({[cell0]:cell0Before});textPropertiesRestored=changed&&JSON.stringify(original)===JSON.stringify(plain(instance));}
 rowInstance.remove();
 const cellInstance=cell.defaultVariant.createInstance();page.appendChild(cellInstance);const cellVisited=new Set();
 for(const component of cell.children){const target=axes(component),updates={};for(const name of ["Density","Kind"]){const key=propertyKey(cellInstance,name);if(!key)throw new Error("TABLE-V2-PROBE-CELL-AXIS:"+name);updates[key]=target[name];}cellInstance.setProperties(updates);const main=await cellInstance.getMainComponentAsync();if(main)cellVisited.add(main.id);}
 cellInstance.remove();
 const sourceCells=cells.filter(entry=>entry.source===source),bindingCompatibilityPassed=nodes(table).concat(nodes(rowSet)).concat(nodes(cell)).every(node=>Object.values(node.boundVariables||{}).flat().every(alias=>alias&&typeof alias.id==="string"));
 const switchingRestored=JSON.stringify(original)===JSON.stringify(plain(instance)),after=snapshot(instance);void "TABLE-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-DENSITY-WALK";const exactSceneRestoration=(!!reflowPassed&&switchingRestored&&textPropertiesRestored)||before===after;instance.remove();
 sources.push({source,adapterIdentity,variants:10,visitedVariants:visited.size+rowVisited.size+cellVisited.size,reflowPassed:!!reflowPassed,contentHugPassed:!!contentHugPassed,bindingCompatibilityPassed,noFakeLayoutPassed:sourceCells.every(entry=>entry.noFakeLayout),stateSemanticsPassed:sourceCells.every(entry=>entry.stateSemanticsExact),switchingRestored,textPropertiesRestored,exactSceneRestoration});
}
sources.sort((a,b)=>a.source.localeCompare(b.source));cells.sort((a,b)=>a.cellKey.localeCompare(b.cellKey));
return{pageId:page.id,sources,cells};`;
}

export function validateTableLiveV23ProbePayload(
  value: unknown,
  writer: TableLiveV23WriterOwnership,
): TableLiveV23ProbePayload {
  const payload = record(value, "probe payload") as TableLiveV23ProbePayload;
  const requiredSourceBooleans = [
    "reflowPassed",
    "contentHugPassed",
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
        source.variants !== 10 ||
        source.visitedVariants !== 10 ||
        requiredSourceBooleans.some((field) => source[field] !== true),
    ) ||
    !Array.isArray(payload.cells) ||
    payload.cells.length !== TABLE_LIVE_V23_VARIANT_COUNT ||
    new Set(payload.cells.map((cell) => cell.cellKey)).size !==
      TABLE_LIVE_V23_VARIANT_COUNT ||
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
    throw new TypeError("Table live v23 probe/usability/restoration failed");
  return payload;
}

export function validateTableLiveV23CaptureManifest(
  cells: readonly TableLiveV23CaptureCell[],
): void {
  const order = cells.map((cell) => cell.index);
  if (
    cells.length !== TABLE_LIVE_V23_CAPTURE_COUNT ||
    new Set(cells.map((cell) => cell.cellKey)).size !==
      TABLE_LIVE_V23_CAPTURE_COUNT ||
    new Set(order).size !== TABLE_LIVE_V23_CAPTURE_COUNT ||
    order.some((index, expected) => index !== expected) ||
    cells.some(
      (cell) =>
        !TABLE_LIVE_V23_SOURCE_IDS.includes(cell.source) ||
        !cell.adapterIdentity ||
        !cell.cellKey ||
        (cell.kind !== "table" && cell.kind !== "row" && cell.kind !== "cell") ||
        !Number.isFinite(cell.frame.width) ||
        cell.frame.width <= 0 ||
        !Number.isFinite(cell.frame.height) ||
        cell.frame.height <= 0,
    )
  )
    throw new TypeError("Table live v23 capture manifest is malformed");
}

export const tableLiveV2CaptureManifestSha256 = (
  cells: readonly TableLiveV23CaptureCell[],
): string => {
  validateTableLiveV23CaptureManifest(cells);
  return sha256(canonicalJson(cells));
};

export function buildTableLiveV23CaptureProgram(
  writer: TableLiveV23WriterOwnership,
  cell: TableLiveV23CaptureCell,
): string {
  if (
    !Number.isInteger(cell.index) ||
    cell.index < 0 ||
    cell.index >= TABLE_LIVE_V23_CAPTURE_COUNT
  )
    throw new TypeError("Table live v23 capture cell is malformed");
  const source = writer.sources.find(
    (candidate) => candidate.adapterIdentity === cell.adapterIdentity,
  );
  const expectedSet =
    cell.kind === "table"
      ? source?.tableSetId
      : cell.kind === "row"
        ? source?.rowSetId
        : source?.cellSetId;
  if (!expectedSet)
    throw new TypeError(`Table live v23 capture adapter absent: ${cell.cellKey}`);
  return String.raw`
${FIGMA_PORTABLE_RUNTIME}
await figma.loadAllPagesAsync();
const page=await figma.getNodeByIdAsync(${JSON.stringify(writer.pageId)}),set=await figma.getNodeByIdAsync(${JSON.stringify(expectedSet)}),cell=${JSON.stringify(cell)};
if(!page||page.type!=="PAGE"||page.id==="115:295378"||page.id==="163:35981"||!set||set.type!=="COMPONENT_SET")throw new Error("TABLE-V2-CAPTURE-TARGET");
const axes=node=>Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
const component=set.children.find(node=>{const value=axes(node);return Object.entries(cell.axes).every(([name,wanted])=>value[name]===wanted);});
if(!component)throw new Error("TABLE-V2-CAPTURE-CELL:"+cell.cellKey);
const frame=figma.createFrame();frame.name="Table v13 ephemeral / "+cell.cellKey;page.appendChild(frame);
try{
 frame.resizeWithoutConstraints(cell.frame.width,cell.frame.height);frame.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];frame.clipsContent=true;
 const instance=component.createInstance();frame.appendChild(instance);instance.x=(frame.width-instance.width)/2;instance.y=(frame.height-instance.height)/2;
 const bytes=await frame.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
 if(bytes.byteLength>${TABLE_LIVE_V23_CAPTURE_MAX_PNG_BYTES})throw new Error("TABLE-V2-CAPTURE-SIZE:"+bytes.byteLength);
 const pngSha256=runtimeSha256(bytes),pngBase64=figma.base64Encode(bytes);
 return{index:cell.index,cellKey:cell.cellKey,source:cell.source,frameWidth:frame.width,frameHeight:frame.height,componentWidth:instance.width,componentHeight:instance.height,pngBytes:bytes.byteLength,pngSha256,pngBase64,temporaryNodesRemaining:0};
}finally{frame.remove();}`;
}

export function validateTableLiveV23CapturePayload(
  value: unknown,
  cell: TableLiveV23CaptureCell,
  rawResponseBytes: number,
): TableLiveV23CapturePayload {
  const payload = record(
    value,
    "capture payload",
  ) as TableLiveV23CapturePayload;
  if (
    rawResponseBytes > TABLE_LIVE_V23_CAPTURE_MAX_RAW_RESPONSE_BYTES ||
    payload.index !== cell.index ||
    payload.cellKey !== cell.cellKey ||
    payload.source !== cell.source ||
    !Number.isFinite(payload.componentWidth) ||
    payload.componentWidth <= 0 ||
    !Number.isFinite(payload.componentHeight) ||
    payload.componentHeight <= 0 ||
    !Number.isInteger(payload.pngBytes) ||
    payload.pngBytes <= 0 ||
    payload.pngBytes > TABLE_LIVE_V23_CAPTURE_MAX_PNG_BYTES ||
    !SHA256.test(payload.pngSha256) ||
    typeof payload.pngBase64 !== "string" ||
    payload.pngBase64.length === 0 ||
    Buffer.byteLength(payload.pngBase64, "utf8") < 8 ||
    sha256(Buffer.from(payload.pngBase64, "base64")) !== payload.pngSha256 ||
    payload.temporaryNodesRemaining !== 0
  )
    throw new TypeError(
      `Table live v23 capture truncated/mismatched: ${cell.cellKey}`,
    );
  return payload;
}

export function assertTableLiveV23CaptureResponses(
  manifest: readonly TableLiveV23CaptureCell[],
  responses: readonly TableLiveV23CapturePayload[],
): void {
  validateTableLiveV23CaptureManifest(manifest);
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
      "Table live v23 capture responses contain truncation/duplicate/missing cells",
    );
}

export interface TableLiveV23ObjectiveReport {
  artifactVersion: "table-live-v23-objective-report-v1";
  denominator: 20;
  technicalPassed: boolean;
  legacyVisualComparison: false;
  rows: Array<{
    index: number;
    cellKey: string;
    source: TableLiveV23SourceId;
    liveSha256: string;
  }>;
  failures: string[];
}

export function evaluateTableLiveV23Objective(
  manifest: readonly TableLiveV23CaptureCell[],
  responses: readonly TableLiveV23CapturePayload[],
): TableLiveV23ObjectiveReport {
  assertTableLiveV23CaptureResponses(manifest, responses);
  return {
    artifactVersion: "table-live-v23-objective-report-v1",
    denominator: 20,
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

export function buildTableLiveV23CleanupProgram(
  writer: TableLiveV23WriterOwnership,
): string {
  const baseProgram = buildTableLiveV23CleanupRuntime({
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    fileName: "Scratch Project",
    editorType: "figma",
    namespace: TABLE_LIVE_V23_NAMESPACE,
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    adapterIdentities: writer.sources.map((source) => source.adapterIdentity),
  });
  const resultStatement =
    "return{requestedNodeIds,removedNodeIds,requestedCollectionIds,removedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:true};";
  const guardedResult = `if(JSON.stringify(requestedNodeIds)!==JSON.stringify([expectedPageId])||JSON.stringify([...requestedCollectionIds].sort())!==JSON.stringify([...expectedCollectionIds].sort()))throw new Error("TABLE-V2-CLEANUP-EXACT-OWNERSHIP");${resultStatement}`;
  const program = baseProgram.replace(resultStatement, guardedResult);
  if (program === baseProgram)
    throw new Error("Table live v23 cleanup runtime result hook absent");
  return String.raw`
const expectedPageId=${JSON.stringify(writer.pageId)},expectedCollectionIds=${JSON.stringify(writer.collectionIds)};
if(expectedPageId==="115:295378")throw new Error("TABLE-MUST-NOT-WRITE-INPUT-PAGE");
if(expectedPageId==="163:35981")throw new Error("TABLE-MUST-NOT-WRITE-COMBOBOX-PAGE");
${program}
`;
}

export function validateTableLiveV23CleanupPayload(
  payload: unknown,
  writer: TableLiveV23WriterOwnership,
): TableLiveV23CleanupPayload {
  const value = record(payload, "cleanup payload") as TableLiveV23CleanupPayload;
  if (
    value.complete !== true ||
    value.remainingOwnedNodes !== 0 ||
    value.remainingOwnedCollections !== 0 ||
    canonicalJson(value.requestedNodeIds) !== canonicalJson([writer.pageId]) ||
    canonicalJson(value.removedNodeIds) !== canonicalJson([writer.pageId]) ||
    canonicalJson([...value.requestedCollectionIds].sort()) !==
      canonicalJson([...writer.collectionIds].sort()) ||
    canonicalJson([...value.removedCollectionIds].sort()) !==
      canonicalJson([...writer.collectionIds].sort()) ||
    writer.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    writer.pageId === FORBIDDEN_COMBOBOX_PAGE_ID
  )
    throw new TypeError("Table live v23 cleanup is incomplete or overbroad");
  return value;
}

export const TABLE_LIVE_V23_RESPONSE_CONTRACTS = Object.freeze({
  writer: {
    schema: "TableLiveV23WriterPayload",
    cardinality: {
      pages: 1,
      sections: 2,
      sets: 6,
      sourceRoots: 2,
      variants: 20,
      collections: 2,
    },
  },
  restore: {
    schema: "TableLiveV23RestorePayload",
    cardinality: { pages: 1, sets: 6, contentTexts: 8 },
  },
  extract: {
    schema: "TableLiveV23ExtractPayload",
    cardinality: { pages: 1, sourceRoots: 2, sets: 6, localVariableTables: 1 },
  },
  probe: {
    schema: "TableLiveV23ProbePayload",
    cardinality: { sourceRoots: 2, sourceProbes: 2, variantCells: 20 },
  },
  capture: {
    schema: "TableLiveV23CapturePayload",
    cardinality: { captureCellsPerRequest: 1, captureRequests: 20 },
  },
  cleanup: {
    schema: "TableLiveV23CleanupPayload",
    cardinality: { ownedPages: 1, ownedCollections: 2 },
  },
});
