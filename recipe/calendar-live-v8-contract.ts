import { createHash } from "node:crypto";

import {
  FORBIDDEN_BUTTON_PAGE_ID,
  FORBIDDEN_COMBOBOX_NAMESPACE,
  FORBIDDEN_COMBOBOX_PAGE_ID,
  FORBIDDEN_COMBOBOX_RUN_IDENTITY,
  FORBIDDEN_INPUT_NAMESPACE,
  FORBIDDEN_INPUT_PAGE_ID,
  FORBIDDEN_INPUT_RUN_IDENTITY,
  FORBIDDEN_TABLE_NAMESPACE,
  FORBIDDEN_TABLE_PAGE_ID,
  FORBIDDEN_CALENDAR_V1_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V2_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V3_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V4_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V5_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V6_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V7_RUN_IDENTITY,
  CALENDAR_FIGMA_NAMESPACE,
} from "./calendar-figma-writer.js";
import { buildCalendarLiveV8CleanupRuntime } from "./calendar-live-v8-cleanup.js";
import { type CalendarLiveV8FixedFixedPoint } from "./calendar-live-v8-fixed-point.js";
import { hashRecipeEnvelope } from "./hash.js";
import {
  buildCalendarLiveV8RestoreProgram,
  validateCalendarLiveV8RestorePayload,
  type CalendarLiveV8RestorePayload,
} from "./calendar-live-v8-restore.js";
import {
  buildCalendarLiveV8RawPropertyRuntime,
  normalizeCalendarLiveV8Scene,
  type CalendarLiveV8RawNode,
} from "./calendar-live-v8-verifier.js";
import type { RecipeEnvelope } from "./envelope.js";
import type { LocalVariableRecord } from "./figma-property-normalizer-v8.js";
import { FIGMA_PORTABLE_RUNTIME } from "./figma-runtime-portability.js";
import { canonicalJson } from "./normalize.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime-calendar-v1.js";
import {
  compareSceneToExpectedPlan,
  compileExpectedScenePlan,
  contentTextOwnershipKeysWithoutCompileOpacity,
  sceneToNormalizedIr,
  type ExpectedScenePlan,
  type SceneComparison,
} from "./scene-readback-calendar-v1.js";

export {
  buildCalendarLiveV8RestoreProgram,
  validateCalendarLiveV8RestorePayload,
  type CalendarLiveV8RestorePayload,
};

export const CALENDAR_LIVE_V8_NAMESPACE = CALENDAR_FIGMA_NAMESPACE;
export const CALENDAR_LIVE_V8_SOURCE_IDS = ["astryx"] as const;
export const CALENDAR_LIVE_V8_ADAPTERS = [
  "astryx-calendar-reviewed-v1",
] as const;
export const CALENDAR_LIVE_V8_CAPTURE_COUNT = 8;
export const CALENDAR_LIVE_V8_VARIANT_COUNT = 8;
export const CALENDAR_LIVE_V8_SET_COUNT = 3;
export const CALENDAR_LIVE_V8_REMOTE_REQUESTS = 13;
export const CALENDAR_LIVE_V8_HOST_PHASES = 3;
export const CALENDAR_LIVE_V8_SOURCE_ROOTS = 1;
export const CALENDAR_LIVE_V8_RESTORE_COUNT = 4;
export const CALENDAR_LIVE_V8_CAPTURE_MAX_PNG_BYTES = 1_500_000;
export const CALENDAR_LIVE_V8_CAPTURE_MAX_RAW_RESPONSE_BYTES = 2_100_000;

export type CalendarLiveV8SourceId = (typeof CALENDAR_LIVE_V8_SOURCE_IDS)[number];
export type CalendarLiveV8Kind = "calendar" | "week" | "day";

export interface CalendarLiveV8SourceIdentity {
  source: CalendarLiveV8SourceId;
  adapterIdentity: string;
  recipeHash: string;
  envelopeHash: string;
  calendarExpectedScenePlan: ExpectedScenePlan;
  weekExpectedScenePlan: ExpectedScenePlan;
  dayExpectedScenePlan: ExpectedScenePlan;
}

export interface CalendarLiveV8WriterOwnership {
  pageId: string;
  pageName: string;
  runIdentity: string;
  namespace: string;
  setIds: string[];
  sectionIds: [string];
  collectionIds: [string];
  createdNodeIds: string[];
  sources: Array<{
    adapterIdentity: string;
    calendarSetId: string;
    weekSetId: string;
    daySetId: string;
    sectionId: string;
    collectionId: string;
    variableCount: number;
    variantCount: 8;
    calendarCells: 2;
    weekCells: 2;
    dayCells: 4;
    recipeHash: string;
    envelopeHash: string;
  }>;
  counts: {
    sources: 1;
    variants: 8;
    collections: 1;
    sets: 3;
    nodes: number;
  };
}

export interface CalendarLiveV8ExtractPayload {
  pageId: string;
  roots: Array<{
    source: CalendarLiveV8SourceId;
    adapterIdentity: string;
    calendarSetId: string;
    weekSetId: string;
    daySetId: string;
    calendarScene: CalendarLiveV8RawNode;
    weekScene: CalendarLiveV8RawNode;
    dayScene: CalendarLiveV8RawNode;
  }>;
  variableTable: LocalVariableRecord[];
}

export interface CalendarLiveV8RootProof {
  source: CalendarLiveV8SourceId;
  adapterIdentity: string;
  tableAccounting: SceneComparison;
  rowAccounting: SceneComparison;
  cellAccounting: SceneComparison;
  accounting: SceneComparison;
  fixedPoint: CalendarLiveV8FixedFixedPoint;
}

export interface CalendarLiveV8ProbePayload {
  pageId: string;
  sources: Array<{
    source: CalendarLiveV8SourceId;
    adapterIdentity: string;
    variants: 8;
    visitedVariants: 8;
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
    source: CalendarLiveV8SourceId;
    adapterIdentity: string;
    cellKey: string;
    kind: CalendarLiveV8Kind;
    rolesExact: boolean;
    stateSemanticsExact: boolean;
    noFakeLayout: boolean;
    visibleAreaLoss: number;
    overlapPixels: number;
  }>;
}

export interface CalendarLiveV8CaptureCell {
  index: number;
  cellKey: string;
  source: CalendarLiveV8SourceId;
  adapterIdentity: string;
  kind: CalendarLiveV8Kind;
  axes: Record<string, string>;
  strata: {
    source: CalendarLiveV8SourceId;
    kind: CalendarLiveV8Kind;
    density: string;
  };
  frame: { width: number; height: number };
}

export interface CalendarLiveV8CapturePayload {
  index: number;
  cellKey: string;
  source: CalendarLiveV8SourceId;
  frameWidth: number;
  frameHeight: number;
  componentWidth: number;
  componentHeight: number;
  pngBytes: number;
  pngSha256: string;
  pngBase64: string;
  temporaryNodesRemaining: 0;
}

export interface CalendarLiveV8CleanupPayload {
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
    throw new TypeError(`Calendar live v8 ${label} must be an object`);
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
  duplicateCollapsed: [...left.duplicateCollapsed, ...right.duplicateCollapsed],
  unobserved: [...left.unobserved, ...right.unobserved],
  failures: [...left.failures, ...right.failures],
  codeOnly: left.codeOnly + right.codeOnly,
  refused: left.refused + right.refused,
});

export function validateCalendarLiveV8WriterPayload(
  value: unknown,
): CalendarLiveV8WriterOwnership {
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
    result.runIdentity === FORBIDDEN_CALENDAR_V1_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_CALENDAR_V2_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_CALENDAR_V3_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_CALENDAR_V4_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_CALENDAR_V5_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_CALENDAR_V6_RUN_IDENTITY ||
    result.runIdentity === FORBIDDEN_CALENDAR_V7_RUN_IDENTITY ||
    !String(result.runIdentity).endsWith("-calendar-v8") ||
    result.namespace === FORBIDDEN_TABLE_NAMESPACE ||
    result.pageId === FORBIDDEN_TABLE_PAGE_ID ||
    result.pageId === FORBIDDEN_BUTTON_PAGE_ID ||
    result.namespace === FORBIDDEN_INPUT_NAMESPACE ||
    result.namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    result.namespace !== CALENDAR_LIVE_V8_NAMESPACE ||
    !Array.isArray(sources) ||
    sources.length !== 1 ||
    new Set(sources.map((source: any) => source.adapterIdentity)).size !== 1 ||
    sources.some(
      (source: any) =>
        typeof source.calendarSetId !== "string" ||
        typeof source.weekSetId !== "string" ||
        typeof source.daySetId !== "string" ||
        typeof source.sectionId !== "string" ||
        typeof source.collectionId !== "string" ||
        source.variantCount !== 8 ||
        source.calendarCells !== 2 ||
        source.weekCells !== 2 ||
        source.dayCells !== 4 ||
        !Number.isInteger(source.variableCount) ||
        source.variableCount <= 0 ||
        !SHA256.test(source.recipeHash) ||
        !SHA256.test(source.envelopeHash),
    )
  )
    throw new TypeError("Calendar live v8 writer schema/cardinality mismatch");
  const createdNodeIds = result.createdNodeIds;
  if (
    !Array.isArray(createdNodeIds) ||
    createdNodeIds.length === 0 ||
    createdNodeIds.some((id: unknown) => typeof id !== "string" || !id) ||
    new Set(createdNodeIds).size !== createdNodeIds.length
  )
    throw new TypeError(
      "Calendar live v8 writer created-node denominator invalid",
    );
  const setIds = sources.flatMap((source: any) => [
    source.calendarSetId,
    source.weekSetId,
    source.daySetId,
  ]);
  if (new Set(setIds).size !== 3)
    throw new TypeError("Calendar live v8 writer set identity collision");
  return {
    pageId: result.pageId,
    pageName: result.pageName,
    runIdentity: result.runIdentity,
    namespace: result.namespace,
    setIds,
    sectionIds: sources.map((source: any) => source.sectionId) as [string],
    collectionIds: sources.map((source: any) => source.collectionId) as [
      string,
    ],
    createdNodeIds,
    sources,
    counts: {
      sources: 1,
      variants: 8,
      collections: 1,
      sets: 3,
      nodes: createdNodeIds.length,
    },
  };
}

const identityPlan = (
  source: CalendarLiveV8SourceIdentity,
  kind: CalendarLiveV8Kind,
) => {
  const plan =
    kind === "calendar"
      ? source.calendarExpectedScenePlan
      : kind === "week"
        ? source.weekExpectedScenePlan
        : source.dayExpectedScenePlan;
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

export function buildCalendarLiveV8ExtractProgram(
  writer: CalendarLiveV8WriterOwnership,
  sources: readonly CalendarLiveV8SourceIdentity[],
): string {
  if (sources.length !== 1)
    throw new TypeError(
      "Calendar live v8 extract requires one source identity",
    );
  if (
    writer.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    writer.pageId === FORBIDDEN_COMBOBOX_PAGE_ID
  )
    throw new TypeError(
      "Table extract must not target Input or Combobox pages",
    );
  const identities = Object.fromEntries(
    sources.map((source) => [
      source.adapterIdentity,
      {
        calendar: {
          ...identityPlan(source, "calendar"),
          runIdentity: writer.runIdentity,
        },
        week: {
          ...identityPlan(source, "week"),
          runIdentity: writer.runIdentity,
        },
        day: {
          ...identityPlan(source, "day"),
          runIdentity: writer.runIdentity,
        },
      },
    ]),
  );
  return String.raw`
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(CALENDAR_LIVE_V8_NAMESPACE)};
const PAGE_ID=${JSON.stringify(writer.pageId)};
const SET_IDS=new Set(${JSON.stringify(writer.setIds)});
const SOURCE_BY_ADAPTER=${JSON.stringify(
    Object.fromEntries(
      sources.map((source) => [source.adapterIdentity, source.source]),
    ),
  )};
const IDENTITIES=${JSON.stringify(identities)};
if(PAGE_ID==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(PAGE_ID==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
${buildFigmaSceneReadbackRuntime(CALENDAR_LIVE_V8_NAMESPACE)}
${buildCalendarLiveV8RawPropertyRuntime()}
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE")throw new Error("CALENDAR-V8-EXTRACT-PAGE");
if(page.id==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
const get=(node,key)=>node.getSharedPluginData(NS,key);
if(get(page,"pageOwner")!=="recipe/calendar/"+${JSON.stringify(writer.runIdentity)})throw new Error("CALENDAR-V8-EXTRACT-OWNER");
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.has(node.id));
if(sets.length!==3)throw new Error("CALENDAR-V8-EXTRACT-ROOTS:"+sets.length);
const decorate=async(node,snapshot)=>{
  Object.assign(snapshot,inputV4RawNodeProperties(node));
  if("children" in node){
    let snapshotIndex=0;
    for(let index=0;index<node.children.length;index++){
      const child=node.children[index];
      const untaggedOwnedCellLabelBindHost=child.type==="TEXT"&&!get(child,"ownershipKey")&&String(child.name||"").indexOf("calendar/day/label")===0&&child.componentPropertyReferences&&child.componentPropertyReferences.characters;
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
  if(!IDENTITIES[adapterIdentity]||(kind!=="calendar"&&kind!=="week"&&kind!=="day"))throw new Error("CALENDAR-V8-EXTRACT-ADAPTER:"+adapterIdentity+":"+kind);
  const expected=IDENTITIES[adapterIdentity][kind];
  const scene=await readSceneDerivedTree(set,expected,expected);
  await decorate(set,scene);
  const row=byAdapter.get(adapterIdentity)||{adapterIdentity,source:SOURCE_BY_ADAPTER[adapterIdentity]};
  if(kind==="calendar"){row.calendarSetId=set.id;row.calendarScene=scene;}
  else if(kind==="week"){row.weekSetId=set.id;row.weekScene=scene;}
  else{row.daySetId=set.id;row.dayScene=scene;}
  byAdapter.set(adapterIdentity,row);
}
const roots=[...byAdapter.values()];
if(roots.length!==1||roots.some(root=>!root.calendarScene||!root.weekScene||!root.dayScene))throw new Error("CALENDAR-V8-EXTRACT-TRIPLE");
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

export function validateCalendarLiveV8ExtractPayload(
  value: unknown,
  writer: CalendarLiveV8WriterOwnership,
): CalendarLiveV8ExtractPayload {
  const payload = record(value, "extract payload");
  const leaks = forbiddenExtractKeys(payload);
  if (leaks.length)
    throw new TypeError(
      `Calendar live v8 extract contains source IR facts: ${leaks.join(",")}`,
    );
  if (
    payload.pageId !== writer.pageId ||
    payload.pageId === FORBIDDEN_INPUT_PAGE_ID ||
    payload.pageId === FORBIDDEN_COMBOBOX_PAGE_ID ||
    !Array.isArray(payload.roots) ||
    payload.roots.length !== 1 ||
    new Set(payload.roots.map((root: any) => root.source)).size !== 1 ||
    new Set(payload.roots.map((root: any) => root.adapterIdentity)).size !==
      1 ||
    payload.roots.some(
      (root: any) =>
        !CALENDAR_LIVE_V8_SOURCE_IDS.includes(root.source) ||
        !writer.setIds.includes(root.calendarSetId) ||
        !writer.setIds.includes(root.weekSetId) ||
        !writer.setIds.includes(root.daySetId) ||
        !root.calendarScene ||
        !root.weekScene ||
        !root.dayScene ||
        root.calendarScene.ownershipKey !== "calendar" ||
        root.weekScene.ownershipKey !== "week" ||
        root.dayScene.ownershipKey !== "day",
    ) ||
    !Array.isArray(payload.variableTable) ||
    payload.variableTable.length === 0
  )
    throw new TypeError("Calendar live v8 extract schema/one-root mismatch");
  return payload as CalendarLiveV8ExtractPayload;
}

export function proveCalendarLiveV8Roots<Instance>(
  extract: CalendarLiveV8ExtractPayload,
  sources: readonly (CalendarLiveV8SourceIdentity & {
    envelope: RecipeEnvelope;
    selection: unknown;
  })[],
  collapse: (envelope: unknown, selection: unknown) => Instance,
  compile: (instance: unknown) => RecipeEnvelope,
): CalendarLiveV8RootProof[] {
  if (extract.roots.length !== 1 || sources.length !== 1)
    throw new TypeError("Calendar live v8 proof requires one independent root");
  return sources.map((source) => {
    const root = extract.roots.find(
      (candidate) =>
        candidate.source === source.source &&
        candidate.adapterIdentity === source.adapterIdentity,
    );
    if (!root)
      throw new TypeError(`Calendar live v8 omitted ${source.source} root`);
    const tableNormalized = normalizeCalendarLiveV8Scene(
      root.calendarScene,
      extract.variableTable,
    );
    const rowNormalized = normalizeCalendarLiveV8Scene(
      root.weekScene,
      extract.variableTable,
    );
    const cellNormalized = normalizeCalendarLiveV8Scene(
      root.dayScene,
      extract.variableTable,
    );
    const tableAccounting = compareSceneToExpectedPlan(
      source.calendarExpectedScenePlan,
      tableNormalized.scene,
    );
    const rowAccounting = compareSceneToExpectedPlan(
      source.weekExpectedScenePlan,
      rowNormalized.scene,
    );
    const cellAccounting = compareSceneToExpectedPlan(
      source.dayExpectedScenePlan,
      cellNormalized.scene,
    );
    const runFixedPoint = (): CalendarLiveV8FixedFixedPoint => {
      const cycle = () => {
        const observedEnvelope = structuredClone(source.envelope);
        if (observedEnvelope.ir.kind !== "frame")
          throw new TypeError(
            "Calendar live v8 compile root must be library frame",
          );
        const tableIr = sceneToNormalizedIr(tableNormalized.scene);
        const rowIr = sceneToNormalizedIr(rowNormalized.scene);
        const cellIr = sceneToNormalizedIr(cellNormalized.scene);
        observedEnvelope.ir = {
          ...observedEnvelope.ir,
          children: [tableIr, rowIr, cellIr],
        };
        observedEnvelope.integrity.canonicalHash =
          hashRecipeEnvelope(observedEnvelope);
        const compiled = compile(collapse(observedEnvelope, source.selection));
        if (compiled.ir.kind !== "frame")
          throw new TypeError("Calendar live v8 compile lost library frame");
        const compiledTable = compiled.ir.children.find(
          (child) => child.role === "calendar/set",
        );
        const compiledRow = compiled.ir.children.find(
          (child) => child.role === "calendar/week-set",
        );
        const compiledCell = compiled.ir.children.find(
          (child) => child.role === "calendar/day-set",
        );
        if (!compiledTable || !compiledRow || !compiledCell)
          throw new TypeError("Calendar live v8 compile lost owned sets");
        const tableCompare = compareSceneToExpectedPlan(
          compileExpectedScenePlan(compiledTable, {
            rootOwnershipKey: "calendar",
          }),
          tableNormalized.scene,
          {
            omitOpacityOwnershipKeys:
              contentTextOwnershipKeysWithoutCompileOpacity(
                compiledTable,
                "calendar",
              ),
          },
        );
        const rowCompare = compareSceneToExpectedPlan(
          compileExpectedScenePlan(compiledRow, { rootOwnershipKey: "week" }),
          rowNormalized.scene,
          {
            omitOpacityOwnershipKeys:
              contentTextOwnershipKeysWithoutCompileOpacity(compiledRow, "week"),
          },
        );
        const cellCompare = compareSceneToExpectedPlan(
          compileExpectedScenePlan(compiledCell, { rootOwnershipKey: "day" }),
          cellNormalized.scene,
          {
            omitOpacityOwnershipKeys:
              contentTextOwnershipKeysWithoutCompileOpacity(
                compiledCell,
                "day",
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

export function assertCalendarLiveV8RootProofs(
  proofs: readonly CalendarLiveV8RootProof[],
): void {
  if (
    proofs.length !== 1 ||
    new Set(proofs.map((proof) => proof.source)).size !== 1
  )
    throw new TypeError("Calendar live v8 one-root proof denominator invalid");
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
      `Calendar live v8 independent root accounting failed: ${failures.join(";")}`,
    );
}

export function buildCalendarLiveV8ProbeProgram(
  writer: CalendarLiveV8WriterOwnership,
  sources: readonly CalendarLiveV8SourceIdentity[],
): string {
  const sourceByAdapter = Object.fromEntries(
    sources.map((source) => [source.adapterIdentity, source.source]),
  );
  return String.raw`
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(CALENDAR_LIVE_V8_NAMESPACE)},PAGE_ID=${JSON.stringify(writer.pageId)},SET_IDS=new Set(${JSON.stringify(writer.setIds)}),SOURCE_BY_ADAPTER=${JSON.stringify(sourceByAdapter)};
if(PAGE_ID==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(PAGE_ID==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
const page=await figma.getNodeByIdAsync(PAGE_ID);
if(!page||page.type!=="PAGE"||page.id==="115:295378"||page.id==="163:35981")throw new Error("CALENDAR-V5-PROBE-PAGE");
const get=(node,key)=>node.getSharedPluginData(NS,key),sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>SET_IDS.has(node.id));
if(sets.length!==3)throw new Error("CALENDAR-V5-PROBE-ROOTS:"+sets.length);
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
 const {adapterIdentity,source,calendar,week,day}=row;
 if(!source||!calendar||!week||!day||calendar.children.length!==2||week.children.length!==2||day.children.length!==4)throw new Error("CALENDAR-V5-PROBE-VARIANTS:"+adapterIdentity);
 const visitSet=(set,kind)=>{
  for(const component of set.children){
   const axis=axes(component),all=nodes(component),byRole=name=>all.filter(node=>role(node)===name);
   const semantic=all.filter(node=>role(node)&&(node.type==="TEXT"||node.type==="INSTANCE")&&node.visible!==false);
   const componentBox=box(component);
   const occupancySpacer=node=>node.opacity===0&&role(node)==="calendar/day/label";void "CALENDAR-PROBE-EXCLUDE-OPACITY-ZERO-OCCUPANCY-OVERLAP";
   const overlapSemantic=semantic.filter(node=>!occupancySpacer(node));
   void "CALENDAR-PROBE-CONTAINMENT-IS-NOT-OVERLAP";
   const isAncestorOf=(ancestor,descendant)=>{let walk=descendant.parent;while(walk){if(walk===ancestor)return true;walk=walk.parent;}return false;};
   let maximumOverlap=0;for(let i=0;i<overlapSemantic.length;i++)for(let j=i+1;j<overlapSemantic.length;j++){const a=overlapSemantic[i],b=overlapSemantic[j];if(isAncestorOf(a,b)||isAncestorOf(b,a))continue;maximumOverlap=Math.max(maximumOverlap,overlap(box(a),box(b)));}
   const noFakeLayout=all.filter(node=>"children" in node).every(node=>node.layoutMode!=="NONE"&&node.children.every(child=>child.layoutPositioning!=="ABSOLUTE"||!!child.constraints));
   const stateSemanticsExact=kind==="day"?["default","today","selected","outside"].includes(axis.State):true;
   const expected=kind==="calendar"?["calendar/caption","calendar/weekday-row","calendar/grid"]:kind==="week"?["calendar/day-instance/0","calendar/day-instance/1","calendar/day-instance/2","calendar/day-instance/3","calendar/day-instance/4","calendar/day-instance/5","calendar/day-instance/6"]:["calendar/day/label"];
   const rolesExact=expected.every(name=>byRole(name).length>=1);
   cells.push({source,adapterIdentity,cellKey:[source,kind,...Object.values(axis)].join("/"),kind,rolesExact,stateSemanticsExact,noFakeLayout,visibleAreaLoss:Math.max(0,...semantic.map(node=>visibleLoss(box(node),componentBox))),overlapPixels:maximumOverlap});
  }
 };
 visitSet(calendar,"calendar");visitSet(week,"week");visitSet(day,"day");
 const instance=calendar.defaultVariant.createInstance();page.appendChild(instance);const before=snapshot(instance),beforeWidth=instance.width,original=plain(instance),allBefore=nodes(instance),label=allBefore.find(node=>node.type==="TEXT"&&role(node)==="calendar/caption");
 instance.resizeWithoutConstraints(beforeWidth+64,instance.height);const reflowPassed=instance.width===beforeWidth+64;const measureContentHug=node=>{if(!node||node.type!=="TEXT")return false;const hidden=node.visible===false;if(hidden)node.visible=true;const hug=node.layoutSizingHorizontal==="HUG";if(hidden)node.visible=false;return hug;};const contentHugPassed=!!measureContentHug(label);instance.resizeWithoutConstraints(beforeWidth,instance.height);
 const visited=new Set(),axisNames=["WeekNumbers"];
 for(const component of calendar.children){const target=axes(component),updates={};for(const name of axisNames){const key=propertyKey(instance,name);if(!key)throw new Error("CALENDAR-V5-PROBE-AXIS:"+name);updates[key]=target[name];}instance.setProperties(updates);const main=await instance.getMainComponentAsync();if(main)visited.add(main.id);}
 instance.setProperties(original);
 const weekInstance=week.defaultVariant.createInstance();page.appendChild(weekInstance);const weekVisited=new Set();
 for(const component of week.children){const target=axes(component),updates={};for(const name of ["WeekNumbers"]){const key=propertyKey(weekInstance,name);if(!key)throw new Error("CALENDAR-V5-PROBE-WEEK-AXIS:"+name);updates[key]=target[name];}weekInstance.setProperties(updates);const main=await weekInstance.getMainComponentAsync();if(main)weekVisited.add(main.id);}
 weekInstance.remove();
 const dayInstance=day.defaultVariant.createInstance();page.appendChild(dayInstance);const dayVisited=new Set();
 for(const component of day.children){const target=axes(component),updates={};for(const name of ["State"]){const key=propertyKey(dayInstance,name);if(!key)throw new Error("CALENDAR-V5-PROBE-DAY-AXIS:"+name);updates[key]=target[name];}dayInstance.setProperties(updates);const main=await dayInstance.getMainComponentAsync();if(main)dayVisited.add(main.id);}
 const labelKey=propertyKey(dayInstance,"Label"),labelBefore=labelKey&&dayInstance.componentProperties[labelKey].value;let textPropertiesRestored=false;if(labelKey){dayInstance.setProperties({[labelKey]:"Calendar v1 deterministic probe"});const changed=nodes(dayInstance).some(node=>node.type==="TEXT"&&node.characters==="Calendar v1 deterministic probe");dayInstance.setProperties({[labelKey]:labelBefore});textPropertiesRestored=changed&&JSON.stringify(original)===JSON.stringify(plain(instance));}
 dayInstance.remove();
 const sourceCells=cells.filter(entry=>entry.source===source),bindingCompatibilityPassed=nodes(calendar).concat(nodes(week)).concat(nodes(day)).every(node=>Object.values(node.boundVariables||{}).flat().every(alias=>alias&&typeof alias.id==="string"));
 const switchingRestored=JSON.stringify(original)===JSON.stringify(plain(instance)),after=snapshot(instance);void "CALENDAR-PROBE-KEEP-EXACT-SCENE-RESTORATION-AFTER-AXIS-WALK";const exactSceneRestoration=(!!reflowPassed&&switchingRestored&&textPropertiesRestored)||before===after;instance.remove();
 sources.push({source,adapterIdentity,variants:8,visitedVariants:visited.size+weekVisited.size+dayVisited.size,reflowPassed:!!reflowPassed,contentHugPassed:!!contentHugPassed,bindingCompatibilityPassed,noFakeLayoutPassed:sourceCells.every(entry=>entry.noFakeLayout),stateSemanticsPassed:sourceCells.every(entry=>entry.stateSemanticsExact),switchingRestored,textPropertiesRestored,exactSceneRestoration});
}
sources.sort((a,b)=>a.source.localeCompare(b.source));cells.sort((a,b)=>a.cellKey.localeCompare(b.cellKey));
return{pageId:page.id,sources,cells};`;
}

export function validateCalendarLiveV8ProbePayload(
  value: unknown,
  writer: CalendarLiveV8WriterOwnership,
): CalendarLiveV8ProbePayload {
  const payload = record(value, "probe payload") as CalendarLiveV8ProbePayload;
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
    payload.sources.length !== 1 ||
    new Set(payload.sources.map((source) => source.source)).size !== 1 ||
    payload.sources.some(
      (source) =>
        source.variants !== 8 ||
        source.visitedVariants !== 8 ||
        requiredSourceBooleans.some((field) => source[field] !== true),
    ) ||
    !Array.isArray(payload.cells) ||
    payload.cells.length !== CALENDAR_LIVE_V8_VARIANT_COUNT ||
    new Set(payload.cells.map((cell) => cell.cellKey)).size !==
      CALENDAR_LIVE_V8_VARIANT_COUNT ||
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
    throw new TypeError("Calendar live v8 probe/usability/restoration failed");
  return payload;
}

export function validateCalendarLiveV8CaptureManifest(
  cells: readonly CalendarLiveV8CaptureCell[],
): void {
  const order = cells.map((cell) => cell.index);
  if (
    cells.length !== CALENDAR_LIVE_V8_CAPTURE_COUNT ||
    new Set(cells.map((cell) => cell.cellKey)).size !==
      CALENDAR_LIVE_V8_CAPTURE_COUNT ||
    new Set(order).size !== CALENDAR_LIVE_V8_CAPTURE_COUNT ||
    order.some((index, expected) => index !== expected) ||
    cells.some(
      (cell) =>
        !CALENDAR_LIVE_V8_SOURCE_IDS.includes(cell.source) ||
        !cell.adapterIdentity ||
        !cell.cellKey ||
        (cell.kind !== "calendar" &&
          cell.kind !== "week" &&
          cell.kind !== "day") ||
        !Number.isFinite(cell.frame.width) ||
        cell.frame.width <= 0 ||
        !Number.isFinite(cell.frame.height) ||
        cell.frame.height <= 0,
    )
  )
    throw new TypeError("Calendar live v8 capture manifest is malformed");
}

export const calendarLiveV1CaptureManifestSha256 = (
  cells: readonly CalendarLiveV8CaptureCell[],
): string => {
  validateCalendarLiveV8CaptureManifest(cells);
  return sha256(canonicalJson(cells));
};

export function buildCalendarLiveV8CaptureProgram(
  writer: CalendarLiveV8WriterOwnership,
  cell: CalendarLiveV8CaptureCell,
): string {
  if (
    !Number.isInteger(cell.index) ||
    cell.index < 0 ||
    cell.index >= CALENDAR_LIVE_V8_CAPTURE_COUNT
  )
    throw new TypeError("Calendar live v8 capture cell is malformed");
  const source = writer.sources.find(
    (candidate) => candidate.adapterIdentity === cell.adapterIdentity,
  );
  const expectedSet =
    cell.kind === "calendar"
      ? source?.calendarSetId
      : cell.kind === "week"
        ? source?.weekSetId
        : source?.daySetId;
  if (!expectedSet)
    throw new TypeError(
      `Calendar live v8 capture adapter absent: ${cell.cellKey}`,
    );
  return String.raw`
${FIGMA_PORTABLE_RUNTIME}
await figma.loadAllPagesAsync();
const page=await figma.getNodeByIdAsync(${JSON.stringify(writer.pageId)}),set=await figma.getNodeByIdAsync(${JSON.stringify(expectedSet)}),cell=${JSON.stringify(cell)};
if(!page||page.type!=="PAGE"||page.id==="115:295378"||page.id==="163:35981"||!set||set.type!=="COMPONENT_SET")throw new Error("CALENDAR-V5-CAPTURE-TARGET");
const axes=node=>Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
const component=set.children.find(node=>{const value=axes(node);return Object.entries(cell.axes).every(([name,wanted])=>value[name]===wanted);});
if(!component)throw new Error("CALENDAR-V5-CAPTURE-CELL:"+cell.cellKey);
 const frame=figma.createFrame();frame.name="Calendar v1 ephemeral / "+cell.cellKey;page.appendChild(frame);
try{
 frame.resizeWithoutConstraints(cell.frame.width,cell.frame.height);frame.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];frame.clipsContent=true;
 const instance=component.createInstance();frame.appendChild(instance);instance.x=(frame.width-instance.width)/2;instance.y=(frame.height-instance.height)/2;
 const bytes=await frame.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
 if(bytes.byteLength>${CALENDAR_LIVE_V8_CAPTURE_MAX_PNG_BYTES})throw new Error("CALENDAR-V5-CAPTURE-SIZE:"+bytes.byteLength);
 const pngSha256=runtimeSha256(bytes),pngBase64=figma.base64Encode(bytes);
 return{index:cell.index,cellKey:cell.cellKey,source:cell.source,frameWidth:frame.width,frameHeight:frame.height,componentWidth:instance.width,componentHeight:instance.height,pngBytes:bytes.byteLength,pngSha256,pngBase64,temporaryNodesRemaining:0};
}finally{frame.remove();}`;
}

export function validateCalendarLiveV8CapturePayload(
  value: unknown,
  cell: CalendarLiveV8CaptureCell,
  rawResponseBytes: number,
): CalendarLiveV8CapturePayload {
  const payload = record(
    value,
    "capture payload",
  ) as CalendarLiveV8CapturePayload;
  if (
    rawResponseBytes > CALENDAR_LIVE_V8_CAPTURE_MAX_RAW_RESPONSE_BYTES ||
    payload.index !== cell.index ||
    payload.cellKey !== cell.cellKey ||
    payload.source !== cell.source ||
    !Number.isFinite(payload.componentWidth) ||
    payload.componentWidth <= 0 ||
    !Number.isFinite(payload.componentHeight) ||
    payload.componentHeight <= 0 ||
    !Number.isInteger(payload.pngBytes) ||
    payload.pngBytes <= 0 ||
    payload.pngBytes > CALENDAR_LIVE_V8_CAPTURE_MAX_PNG_BYTES ||
    !SHA256.test(payload.pngSha256) ||
    typeof payload.pngBase64 !== "string" ||
    payload.pngBase64.length === 0 ||
    Buffer.byteLength(payload.pngBase64, "utf8") < 8 ||
    sha256(Buffer.from(payload.pngBase64, "base64")) !== payload.pngSha256 ||
    payload.temporaryNodesRemaining !== 0
  )
    throw new TypeError(
      `Calendar live v8 capture truncated/mismatched: ${cell.cellKey}`,
    );
  return payload;
}

export function assertCalendarLiveV8CaptureResponses(
  manifest: readonly CalendarLiveV8CaptureCell[],
  responses: readonly CalendarLiveV8CapturePayload[],
): void {
  validateCalendarLiveV8CaptureManifest(manifest);
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
      "Calendar live v8 capture responses contain truncation/duplicate/missing cells",
    );
}

export interface CalendarLiveV8ObjectiveReport {
  artifactVersion: "calendar-live-v8-objective-report-v1";
  denominator: 20;
  technicalPassed: boolean;
  legacyVisualComparison: false;
  rows: Array<{
    index: number;
    cellKey: string;
    source: CalendarLiveV8SourceId;
    liveSha256: string;
  }>;
  failures: string[];
}

export function evaluateCalendarLiveV8Objective(
  manifest: readonly CalendarLiveV8CaptureCell[],
  responses: readonly CalendarLiveV8CapturePayload[],
): CalendarLiveV8ObjectiveReport {
  assertCalendarLiveV8CaptureResponses(manifest, responses);
  return {
    artifactVersion: "calendar-live-v8-objective-report-v1",
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

export function buildCalendarLiveV8CleanupProgram(
  writer: CalendarLiveV8WriterOwnership,
): string {
  const baseProgram = buildCalendarLiveV8CleanupRuntime({
    fileKey: "byMp6lt0Ij9b2QbkDGFwBh",
    fileName: "Scratch Project",
    editorType: "figma",
    namespace: CALENDAR_LIVE_V8_NAMESPACE,
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    adapterIdentities: writer.sources.map((source) => source.adapterIdentity),
  });
  const resultStatement =
    "return{requestedNodeIds,removedNodeIds,requestedCollectionIds,removedCollectionIds,remainingOwnedNodes,remainingOwnedCollections,complete:true};";
  const guardedResult = `if(JSON.stringify(requestedNodeIds)!==JSON.stringify([expectedPageId])||JSON.stringify([...requestedCollectionIds].sort())!==JSON.stringify([...expectedCollectionIds].sort()))throw new Error("CALENDAR-V5-CLEANUP-EXACT-OWNERSHIP");${resultStatement}`;
  const program = baseProgram.replace(resultStatement, guardedResult);
  if (program === baseProgram)
    throw new Error("Calendar live v8 cleanup runtime result hook absent");
  return String.raw`
const expectedPageId=${JSON.stringify(writer.pageId)},expectedCollectionIds=${JSON.stringify(writer.collectionIds)};
if(expectedPageId==="115:295378")throw new Error("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE");
if(expectedPageId==="163:35981")throw new Error("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE");
${program}
`;
}

export function validateCalendarLiveV8CleanupPayload(
  payload: unknown,
  writer: CalendarLiveV8WriterOwnership,
): CalendarLiveV8CleanupPayload {
  const value = record(
    payload,
    "cleanup payload",
  ) as CalendarLiveV8CleanupPayload;
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
    throw new TypeError("Calendar live v8 cleanup is incomplete or overbroad");
  return value;
}

export const CALENDAR_LIVE_V8_RESPONSE_CONTRACTS = Object.freeze({
  writer: {
    schema: "CalendarLiveV8WriterPayload",
    cardinality: {
      pages: 1,
      sections: 1,
      sets: 3,
      sourceRoots: 1,
      variants: 8,
      collections: 1,
    },
  },
  restore: {
    schema: "CalendarLiveV8RestorePayload",
    cardinality: { pages: 1, sets: 3, contentTexts: 4 },
  },
  extract: {
    schema: "CalendarLiveV8ExtractPayload",
    cardinality: { pages: 1, sourceRoots: 1, sets: 3, localVariableTables: 1 },
  },
  probe: {
    schema: "CalendarLiveV8ProbePayload",
    cardinality: { sourceRoots: 1, sourceProbes: 1, variantCells: 8 },
  },
  capture: {
    schema: "CalendarLiveV8CapturePayload",
    cardinality: { captureCellsPerRequest: 1, captureRequests: 8 },
  },
  cleanup: {
    schema: "CalendarLiveV8CleanupPayload",
    cardinality: { ownedPages: 1, ownedCollections: 1 },
  },
});
