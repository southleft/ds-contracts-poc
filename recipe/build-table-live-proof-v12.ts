import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { adaptReviewedTable } from "./adapters/table.js";
import {
  TABLE_LIVE_V12_CAPTURE_COUNT,
  TABLE_LIVE_V12_HOST_PHASES,
  TABLE_LIVE_V12_REMOTE_REQUESTS,
  TABLE_LIVE_V12_SOURCE_ROOTS,
  TABLE_LIVE_V12_VARIANT_COUNT,
  buildTableLiveV12CaptureProgram,
  buildTableLiveV12CleanupProgram,
  buildTableLiveV12ExtractProgram,
  buildTableLiveV12ProbeProgram,
  buildTableLiveV12RestoreProgram,
  tableLiveV2CaptureManifestSha256,
  type TableLiveV12CaptureCell,
  type TableLiveV12SourceIdentity,
  type TableLiveV12WriterOwnership,
} from "./table-live-v12-contract.js";
import {
  TABLE_LIVE_V12_DYNAMIC_TOOL,
  TABLE_LIVE_V12_TARGET,
  tableLiveV2RequestSequence,
} from "./table-live-v12-broker.js";
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
  TABLE_FIGMA_NAMESPACE,
  emitTableFigmaWriter,
} from "./table-figma-writer.js";
import {
  firstPartyTableAdapterConfig,
  firstPartyTableSource,
  muiTableAdapterConfig,
  muiTableSource,
} from "./fixtures/library-tables.js";
import type { IRNode } from "./figma-ir.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  TABLE_CELL_KINDS,
  TABLE_DENSITIES,
  TABLE_ROW_STATES,
  compileTableRecipe,
  tableRecipe,
} from "./recipes/table.js";
import {
  compileExpectedScenePlan,
  type ExpectedScenePlan,
} from "./scene-readback-table-v1.js";

export const TABLE_LIVE_V12_EVIDENCE_ROOT = "recipe/evidence/table-live-pivot-v12";
export const TABLE_LIVE_V12_PROTOCOL_PATH = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/protocol.json`;
export const TABLE_LIVE_V12_PLAN_PATH = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/proof-plan.json`;
export const TABLE_LIVE_V12_CAPTURE_MANIFEST_PATH = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/capture-manifest.json`;
export const TABLE_LIVE_V12_REQUEST_MANIFEST_PATH = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/request-manifest.json`;
export const TABLE_LIVE_V12_INDEX_PATH = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/antecedent-index.json`;
export const TABLE_LIVE_V12_AUTHORIZATION_TEMPLATE_PATH = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/authorization-template.json`;
export const TABLE_LIVE_V12_AUTHORIZATION_PATH = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/capture-authorization.json`;

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const jsonBytes = (value: unknown): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export interface TableLiveV12ProofPlan {
  artifactVersion: "table-live-v12-proof-plan-v1";
  status: "draft antecedent; pending separate authorization; live execution forbidden";
  target: typeof TABLE_LIVE_V12_TARGET;
  namespace: typeof TABLE_FIGMA_NAMESPACE;
  writer: {
    programPath: string;
    programBytes: number;
    programSha256: string;
    runIdentity: string;
    pageName: string;
  };
  sources: Array<{
    source: "first-party" | "mui";
    adapterIdentity: string;
    recipeHash: string;
    envelopeHash: string;
    tableExpectedScenePlan: {
      path: string;
      bytes: number;
      sha256: string;
      uncompressedBytes: number;
      uncompressedSha256: string;
      facts: number;
    };
    rowExpectedScenePlan: {
      path: string;
      bytes: number;
      sha256: string;
      uncompressedBytes: number;
      uncompressedSha256: string;
      facts: number;
    };
    cellExpectedScenePlan: {
      path: string;
      bytes: number;
      sha256: string;
      uncompressedBytes: number;
      uncompressedSha256: string;
      facts: number;
    };
  }>;
  captureManifest: {
    path: string;
    cells: 20;
    requests: 20;
    cellsPerRequest: 1;
    sha256: string;
  };
  requests: {
    remote: 25;
    mainLane: 24;
    recoveryCleanup: 1;
    hostPhases: 3;
  };
  attempts: {
    executed: 0;
    next: 1;
    maximum: 3;
    cleanPublishedDescendantsOnly: true;
  };
  humanSignoff: "pending";
  overallTableSuccess: false;
}

const requireSet = (root: IRNode, role: string) => {
  if (root.kind !== "frame")
    throw new TypeError("table expected-plan requires library frame");
  const found = root.children.find((child) => child.role === role);
  if (!found || found.kind !== "component-set")
    throw new TypeError(`table expected-plan missing ${role}`);
  return found;
};

const applyOccupancyTeachings = (
  plan: ExpectedScenePlan,
  root: IRNode,
  rootKey: string,
): ExpectedScenePlan => {
  const occupancyKeys = new Set<string>();
  const visit = (node: IRNode, key: string): void => {
    if (
      node.kind === "text" &&
      node.visible === false &&
      node.width.mode === "fill"
    )
      occupancyKeys.add(key);
    if (
      node.kind === "frame" ||
      node.kind === "component" ||
      node.kind === "component-set"
    ) {
      for (const [index, child] of node.children.entries())
        visit(child, `${key}/children/${index}`);
    }
  };
  visit(root, rootKey);
  if (occupancyKeys.size === 0) return plan;
  return {
    ...plan,
    facts: plan.facts.map((fact) => {
      if (!occupancyKeys.has(fact.nodeOwnershipKey)) return fact;
      if (fact.channel === "visible") return { ...fact, value: true };
      if (fact.channel === "opacity") return { ...fact, value: 0 };
      return fact;
    }),
  };
};

const sourceDescriptors = () =>
  [
    {
      source: "first-party" as const,
      adapterIdentity: "first-party-table-reviewed-v1",
      displayName: "First-party Table",
      reviewed: firstPartyTableSource,
      config: firstPartyTableAdapterConfig,
    },
    {
      source: "mui" as const,
      adapterIdentity: "material-table-reviewed-v1",
      displayName: "Reviewed Table",
      reviewed: muiTableSource,
      config: muiTableAdapterConfig,
    },
  ].map((descriptor) => {
    const instance = adaptReviewedTable(descriptor.reviewed, descriptor.config);
    const envelope = compileTableRecipe(instance);
    const tableSet = requireSet(envelope.ir, "table/set");
    const rowSet = requireSet(envelope.ir, "table/row-set");
    const cellSet = requireSet(envelope.ir, "table/cell-set");
    const tablePlan = applyOccupancyTeachings(
      compileExpectedScenePlan(tableSet, { rootOwnershipKey: "table" }),
      tableSet,
      "table",
    );
    const rowPlan = applyOccupancyTeachings(
      compileExpectedScenePlan(rowSet, { rootOwnershipKey: "row" }),
      rowSet,
      "row",
    );
    const cellPlan = applyOccupancyTeachings(
      compileExpectedScenePlan(cellSet, { rootOwnershipKey: "cell" }),
      cellSet,
      "cell",
    );
    return {
      ...descriptor,
      instance,
      envelope,
      recipeHash: hashRecipeInstance(tableRecipe, instance),
      tablePlan,
      rowPlan,
      cellPlan,
    };
  });

const frameFor = (
  instance: ReturnType<typeof adaptReviewedTable>,
  density: (typeof TABLE_DENSITIES)[number],
  kind: "table" | "row" | "cell",
) => {
  const tokens = instance.tokens.densities[density];
  const padX = tokens.paddingX.fallback;
  const padY = tokens.paddingY.fallback;
  const minW = tokens.minWidth.fallback;
  const font = tokens.fontSize.fallback;
  const cellWidth = minW + padX * 2 + 80;
  const rowWidth = minW * 3 + padX * 2 + 80;
  const rowHeight = font + padY * 2 + 48;
  if (kind === "cell") return { width: cellWidth, height: rowHeight };
  if (kind === "row") return { width: rowWidth, height: rowHeight };
  return { width: rowWidth, height: rowHeight * 3 + 80 };
};

const captureCells = (
  sources: ReturnType<typeof sourceDescriptors>,
): TableLiveV12CaptureCell[] => {
  const cells: TableLiveV12CaptureCell[] = [];
  for (const source of sources) {
    for (const density of TABLE_DENSITIES) {
      cells.push({
        index: cells.length,
        cellKey: [source.source, "table", density].join("/"),
        source: source.source,
        adapterIdentity: source.adapterIdentity,
        kind: "table",
        axes: { Density: density },
        strata: { source: source.source, kind: "table", density },
        frame: frameFor(source.instance, density, "table"),
      });
    }
    for (const density of TABLE_DENSITIES)
      for (const state of TABLE_ROW_STATES) {
        cells.push({
          index: cells.length,
          cellKey: [source.source, "row", density, state].join("/"),
          source: source.source,
          adapterIdentity: source.adapterIdentity,
          kind: "row",
          axes: { Density: density, State: state },
          strata: { source: source.source, kind: "row", density },
          frame: frameFor(source.instance, density, "row"),
        });
      }
    for (const density of TABLE_DENSITIES)
      for (const kind of TABLE_CELL_KINDS) {
        cells.push({
          index: cells.length,
          cellKey: [source.source, "cell", density, kind].join("/"),
          source: source.source,
          adapterIdentity: source.adapterIdentity,
          kind: "cell",
          axes: { Density: density, Kind: kind },
          strata: { source: source.source, kind: "cell", density },
          frame: frameFor(source.instance, density, "cell"),
        });
      }
  }
  if (cells.length !== TABLE_LIVE_V12_CAPTURE_COUNT)
    throw new Error(
      `Table live v12 capture cells ${cells.length}, expected ${TABLE_LIVE_V12_CAPTURE_COUNT}`,
    );
  tableLiveV2CaptureManifestSha256(cells);
  return cells;
};

const protocol = (expectedFacts: number) => ({
  artifactVersion: "table-live-v12-external-operator-protocol-v1",
  protocolId: "table-live-v12",
  status:
    "draft antecedent; pending separate authorization; live execution forbidden",
  lifecycle: {
    executionAntecedentImmutable: true,
    authorizationAddedOnlyAfterAntecedentCommit: true,
    authorizationExcludedFromAntecedentFreshness: true,
    laterAuthorizationDoesNotRecomputeAntecedent: true,
    inputV85AuthorizationReusable: false,
    comboboxLiveV41AuthorizationReusable: false,
    comboboxLiveV1AuthorizationReusable: false,
    tableLiveV1AuthorizationReusable: false,
    tableLiveV2AuthorizationReusable: false,
    tableLiveV3AuthorizationReusable: false,
    tableLiveV4AuthorizationReusable: false,
    tableLiveV5AuthorizationReusable: false,
    tableLiveV6AuthorizationReusable: false,
    tableLiveV7AuthorizationReusable: false,
    tableLiveV8AuthorizationReusable: false,
    tableLiveV9AuthorizationReusable: false,
    inputRunIdentityForbidden: true,
    inputPage115295378Forbidden: true,
    comboboxRunIdentityForbidden: true,
    comboboxPage16335981Forbidden: true,
    tableV1RunIdentityForbidden: true,
    tableV2RunIdentityForbidden: true,
    tableV3RunIdentityForbidden: true,
    tableV4RunIdentityForbidden: true,
    tableV5RunIdentityForbidden: true,
    tableV6RunIdentityForbidden: true,
    tableV7RunIdentityForbidden: true,
    tableV8RunIdentityForbidden: true,
    tableV9RunIdentityForbidden: true,
  },
  teaching: {
    restoreHugLabelsOnlyFromCellSet: true,
    ownedHugTexts: 8,
    nestedInstanceLabelsAreNotOwned: true,
    extractSetRootOmitsEnvelopeHash: true,
    ignoreCopiedOwnershipKeyInsideOwnedInstance: true,
    hostOmitsEmptyInstancePayload: true,
    observeSceneFactsProjectsLiveRootOwnershipKey: true,
    hostRecoversRecipeComponentRef: true,
    hostRecoversComponentPropertyNameBeforeHash: true,
    hostOrdersBindingsToCompileFieldOrder: true,
    hostAliasesWidthHeightToLayoutWidthHeight: true,
    hostOmitsTextExtrasUnlessSourceHasThem: true,
    hostObserveOmitsInstancePayloadOnTableRowCellInstances: true,
    hostProbeKeepsExactSceneRestorationAfterDensityWalk: true,
    hostProbeExcludesOpacityZeroOccupancyOverlap: true,
    hostProbeRequiresContentHugNotFill: true,
    firstPartyHeaderFontNamedHostListedInterSemiBold: true,
    rowCellNBindsNestedCellLabelTextCharacters: true,
    rowOwnedTextCharactersOnOriginalRow: true,
    hostMinWidthZeroUnsetsNull: true,
    extractSkipsUntaggedRowOwnedCellLabelBindHost: true,
    hostFoldsUniformPerSideStrokeWeightBinds: true,
    hostOmitsCopiedCellInstanceBindings: true,
    hostOmitsHeaderBodyClipsContent: true,
    hostOmitsHeaderBodyCornerRadius: true,
  },
  inheritedCapability: {
    roleFirstSegment: true,
    hiddenFillOccupancyVisibleTrueOpacity0: true,
    compileOmitsVisibleFalseOnOccupancyPlaceholders: true,
    expectedPlanOccupancyOpacity0: true,
    collapseMustNotInventDefaultOpacity1: true,
    probeExcludesOpacityZeroOccupancyOverlap: true,
    omitTextExtrasUnlessSourceHasThem: true,
    setLayoutCompileCarryAfterFirstMeasure: true,
    cleanupOnFailureOnly: true,
    inventPolar9300Forbidden: true,
    inventPolarContentRowForbidden: true,
    inventOverlapZeroForbidden: true,
  },
  identity: {
    namespace: TABLE_FIGMA_NAMESPACE,
    writerPath: "recipe/table-figma-writer.ts",
    forbiddenInputNamespace: FORBIDDEN_INPUT_NAMESPACE,
    forbiddenInputRunIdentity: FORBIDDEN_INPUT_RUN_IDENTITY,
    forbiddenInputPageId: FORBIDDEN_INPUT_PAGE_ID,
    forbiddenComboboxNamespace: FORBIDDEN_COMBOBOX_NAMESPACE,
    forbiddenComboboxRunIdentity: FORBIDDEN_COMBOBOX_RUN_IDENTITY,
    forbiddenComboboxPageId: FORBIDDEN_COMBOBOX_PAGE_ID,
    forbiddenTableV1RunIdentity: FORBIDDEN_TABLE_V1_RUN_IDENTITY,
    forbiddenTableV2RunIdentity: FORBIDDEN_TABLE_V2_RUN_IDENTITY,
    forbiddenTableV3RunIdentity: FORBIDDEN_TABLE_V3_RUN_IDENTITY,
    forbiddenTableV4RunIdentity: FORBIDDEN_TABLE_V4_RUN_IDENTITY,
    forbiddenTableV5RunIdentity: FORBIDDEN_TABLE_V5_RUN_IDENTITY,
    forbiddenTableV6RunIdentity: FORBIDDEN_TABLE_V6_RUN_IDENTITY,
    forbiddenTableV7RunIdentity: FORBIDDEN_TABLE_V7_RUN_IDENTITY,
    forbiddenTableV8RunIdentity: FORBIDDEN_TABLE_V8_RUN_IDENTITY,
    forbiddenTableV9RunIdentity: FORBIDDEN_TABLE_V9_RUN_IDENTITY,
    forbiddenTableV10RunIdentity: FORBIDDEN_TABLE_V10_RUN_IDENTITY,
    forbiddenTableV11RunIdentity: FORBIDDEN_TABLE_V11_RUN_IDENTITY,
  },
  target: TABLE_LIVE_V12_TARGET,
  expectedDynamicTool: TABLE_LIVE_V12_DYNAMIC_TOOL,
  denominator: {
    sourceRoots: TABLE_LIVE_V12_SOURCE_ROOTS,
    sets: 6,
    variants: TABLE_LIVE_V12_VARIANT_COUNT,
    captureCells: TABLE_LIVE_V12_CAPTURE_COUNT,
    remoteRequests: TABLE_LIVE_V12_REMOTE_REQUESTS,
    hostPhases: TABLE_LIVE_V12_HOST_PHASES,
    expectedSceneFacts: expectedFacts,
    restoreHugTexts: 8,
  },
  execution: {
    requestOrder: [
      "writer",
      "persist signed cleanup recovery request",
      "restore",
      "extract",
      "host-normalize-account",
      "probe",
      "captures",
    ],
    cleanupOnFailureOnly: true,
    cleanupMustNotExecuteOnMainComplete: true,
    maximumAttempts: 3,
  },
  proof: {
    cleanupOnFailureOnly: true,
    independentRootAccounting: true,
    compileCarryLiveSetFactsAfterFirstMeasure: true,
  },
});

export async function buildTableLiveV12Proof(
  check = process.argv.includes("--check"),
): Promise<TableLiveV12ProofPlan> {
  const sources = sourceDescriptors();
  const writer = emitTableFigmaWriter(
    sources.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      recipeHash: source.recipeHash,
      envelope: source.envelope,
    })),
  );
  if (
    writer.namespace !== TABLE_FIGMA_NAMESPACE ||
    writer.namespace === FORBIDDEN_INPUT_NAMESPACE ||
    writer.namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    writer.runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_COMBOBOX_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V1_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V2_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V3_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V4_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V5_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V6_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V7_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V8_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V9_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V10_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V11_RUN_IDENTITY ||
    writer.pageName.includes(FORBIDDEN_INPUT_PAGE_ID) ||
    writer.pageName.includes(FORBIDDEN_COMBOBOX_PAGE_ID)
  )
    throw new Error("Table live v12 writer reused Input, Combobox, or Table v1–v11 identity");
  const captures = captureCells(sources);
  const writerProgram = Buffer.from(writer.code);
  const writerOwnershipBlueprint: TableLiveV12WriterOwnership = {
    pageId: "__WRITER_PAGE_ID__",
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    namespace: writer.namespace,
    setIds: [
      "__FP_TABLE_SET_ID__",
      "__FP_ROW_SET_ID__",
      "__FP_CELL_SET_ID__",
      "__MUI_TABLE_SET_ID__",
      "__MUI_ROW_SET_ID__",
      "__MUI_CELL_SET_ID__",
    ],
    sectionIds: ["__FP_SECTION_ID__", "__MUI_SECTION_ID__"],
    collectionIds: ["__FP_COLLECTION_ID__", "__MUI_COLLECTION_ID__"],
    createdNodeIds: ["__WRITER_CREATED_NODE_IDS__"],
    sources: sources.map((source, index) => ({
      adapterIdentity: source.adapterIdentity,
      tableSetId: index === 0 ? "__FP_TABLE_SET_ID__" : "__MUI_TABLE_SET_ID__",
      rowSetId: index === 0 ? "__FP_ROW_SET_ID__" : "__MUI_ROW_SET_ID__",
      cellSetId: index === 0 ? "__FP_CELL_SET_ID__" : "__MUI_CELL_SET_ID__",
      sectionId: index === 0 ? "__FP_SECTION_ID__" : "__MUI_SECTION_ID__",
      collectionId:
        index === 0 ? "__FP_COLLECTION_ID__" : "__MUI_COLLECTION_ID__",
      variableCount: source.tablePlan.facts.filter(
        (fact) => fact.channel === "binding",
      ).length,
      variantCount: 10 as const,
      tableCells: 2 as const,
      rowCells: 4 as const,
      cellCells: 4 as const,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelope.integrity.canonicalHash,
    })),
    counts: { sources: 2, variants: 20, collections: 2, sets: 6, nodes: 1 },
  };
  const identities: TableLiveV12SourceIdentity[] = sources.map((source) => ({
    source: source.source,
    adapterIdentity: source.adapterIdentity,
    recipeHash: source.recipeHash,
    envelopeHash: source.envelope.integrity.canonicalHash,
    tableExpectedScenePlan: source.tablePlan,
    rowExpectedScenePlan: source.rowPlan,
    cellExpectedScenePlan: source.cellPlan,
  }));
  const restoreBlueprint = Buffer.from(
    buildTableLiveV12RestoreProgram(writerOwnershipBlueprint),
  );
  const extractBlueprint = Buffer.from(
    buildTableLiveV12ExtractProgram(writerOwnershipBlueprint, identities),
  );
  const probeBlueprint = Buffer.from(
    buildTableLiveV12ProbeProgram(writerOwnershipBlueprint, identities),
  );
  const captureBlueprint = Buffer.from(
    buildTableLiveV12CaptureProgram(writerOwnershipBlueprint, captures[0]!),
  );
  const cleanupBlueprint = Buffer.from(
    buildTableLiveV12CleanupProgram(writerOwnershipBlueprint),
  );

  const antecedentOutputs = new Map<string, Buffer>();
  const sourceMetadata = sources.map((source) => {
    const tableBytes = Buffer.from(`${JSON.stringify(source.tablePlan)}\n`);
    const rowBytes = Buffer.from(`${JSON.stringify(source.rowPlan)}\n`);
    const cellBytes = Buffer.from(`${JSON.stringify(source.cellPlan)}\n`);
    const tableCompressed = gzipSync(tableBytes);
    const rowCompressed = gzipSync(rowBytes);
    const cellCompressed = gzipSync(cellBytes);
    const tablePath = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/expected-scene-plan-${source.source}-table.json.gz`;
    const rowPath = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/expected-scene-plan-${source.source}-row.json.gz`;
    const cellPath = `${TABLE_LIVE_V12_EVIDENCE_ROOT}/expected-scene-plan-${source.source}-cell.json.gz`;
    antecedentOutputs.set(tablePath, tableCompressed);
    antecedentOutputs.set(rowPath, rowCompressed);
    antecedentOutputs.set(cellPath, cellCompressed);
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelope.integrity.canonicalHash,
      tableExpectedScenePlan: {
        path: tablePath,
        bytes: tableCompressed.byteLength,
        sha256: sha256(tableCompressed),
        uncompressedBytes: tableBytes.byteLength,
        uncompressedSha256: sha256(tableBytes),
        facts: source.tablePlan.facts.length,
      },
      rowExpectedScenePlan: {
        path: rowPath,
        bytes: rowCompressed.byteLength,
        sha256: sha256(rowCompressed),
        uncompressedBytes: rowBytes.byteLength,
        uncompressedSha256: sha256(rowBytes),
        facts: source.rowPlan.facts.length,
      },
      cellExpectedScenePlan: {
        path: cellPath,
        bytes: cellCompressed.byteLength,
        sha256: sha256(cellCompressed),
        uncompressedBytes: cellBytes.byteLength,
        uncompressedSha256: sha256(cellBytes),
        facts: source.cellPlan.facts.length,
      },
    };
  });
  const expectedFacts = sourceMetadata.reduce(
    (sum, source) =>
      sum +
      source.tableExpectedScenePlan.facts +
      source.rowExpectedScenePlan.facts +
      source.cellExpectedScenePlan.facts,
    0,
  );

  antecedentOutputs.set(
    TABLE_LIVE_V12_PROTOCOL_PATH,
    jsonBytes(protocol(expectedFacts)),
  );
  antecedentOutputs.set(
    `${TABLE_LIVE_V12_EVIDENCE_ROOT}/programs/writer.txt`,
    writerProgram,
  );
  antecedentOutputs.set(
    `${TABLE_LIVE_V12_EVIDENCE_ROOT}/programs/restore-blueprint.js`,
    restoreBlueprint,
  );
  antecedentOutputs.set(
    `${TABLE_LIVE_V12_EVIDENCE_ROOT}/programs/extract-blueprint.js`,
    extractBlueprint,
  );
  antecedentOutputs.set(
    `${TABLE_LIVE_V12_EVIDENCE_ROOT}/programs/probe-blueprint.js`,
    probeBlueprint,
  );
  antecedentOutputs.set(
    `${TABLE_LIVE_V12_EVIDENCE_ROOT}/programs/capture-blueprint.js`,
    captureBlueprint,
  );
  antecedentOutputs.set(
    `${TABLE_LIVE_V12_EVIDENCE_ROOT}/programs/cleanup-blueprint.js`,
    cleanupBlueprint,
  );

  const captureManifest = {
    artifactVersion: "table-live-v12-capture-manifest-v1",
    status: "planned only; authorization and capture pending",
    transport: {
      encoding: "one PNG base64 payload per signed response",
      cellsPerRequest: 1,
      requests: 20,
      rejectTruncationDuplicatesMissing: true,
      sampleReduction: false,
      legacyVisualComparison: false,
    },
    cells: captures,
    cellsSha256: tableLiveV2CaptureManifestSha256(captures),
  };
  const captureManifestBytes = jsonBytes(captureManifest);
  antecedentOutputs.set(
    TABLE_LIVE_V12_CAPTURE_MANIFEST_PATH,
    captureManifestBytes,
  );

  const proofPlan: TableLiveV12ProofPlan = {
    artifactVersion: "table-live-v12-proof-plan-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    target: TABLE_LIVE_V12_TARGET,
    namespace: TABLE_FIGMA_NAMESPACE,
    writer: {
      programPath: `${TABLE_LIVE_V12_EVIDENCE_ROOT}/programs/writer.txt`,
      programBytes: writerProgram.byteLength,
      programSha256: sha256(writerProgram),
      runIdentity: writer.runIdentity,
      pageName: writer.pageName,
    },
    sources: sourceMetadata,
    captureManifest: {
      path: TABLE_LIVE_V12_CAPTURE_MANIFEST_PATH,
      cells: 20,
      requests: 20,
      cellsPerRequest: 1,
      sha256: sha256(captureManifestBytes),
    },
    requests: {
      remote: 25,
      mainLane: 24,
      recoveryCleanup: 1,
      hostPhases: 3,
    },
    attempts: {
      executed: 0,
      next: 1,
      maximum: 3,
      cleanPublishedDescendantsOnly: true,
    },
    humanSignoff: "pending",
    overallTableSuccess: false,
  };
  antecedentOutputs.set(TABLE_LIVE_V12_PLAN_PATH, jsonBytes(proofPlan));

  const requests = {
    artifactVersion: "table-live-v12-request-manifest-v1",
    expectedDynamicTool: TABLE_LIVE_V12_DYNAMIC_TOOL,
    target: TABLE_LIVE_V12_TARGET,
    signedAtRuntime: true,
    requestCount: 25,
    requests: [
      {
        requestId: "writer",
        sequence: tableLiveV2RequestSequence("writer"),
        phase: "writer",
      },
      {
        requestId: "cleanup",
        sequence: tableLiveV2RequestSequence("cleanup"),
        phase: "cleanup",
        availability: "persisted immediately after writer acceptance",
      },
      {
        requestId: "restore",
        sequence: tableLiveV2RequestSequence("restore"),
        phase: "restore",
      },
      {
        requestId: "extract",
        sequence: tableLiveV2RequestSequence("extract"),
        phase: "extract",
      },
      {
        requestId: "probe",
        sequence: tableLiveV2RequestSequence("probe"),
        phase: "probe",
      },
      ...captures.map((cell) => ({
        requestId: `capture-${String(cell.index).padStart(3, "0")}`,
        sequence: tableLiveV2RequestSequence("capture", cell.index),
        phase: "capture",
        captureIndex: cell.index,
        cellKey: cell.cellKey,
      })),
    ],
  };
  if (requests.requestCount !== TABLE_LIVE_V12_REMOTE_REQUESTS)
    throw new Error("Table live v12 remote request denominator drifted");
  antecedentOutputs.set(
    TABLE_LIVE_V12_REQUEST_MANIFEST_PATH,
    jsonBytes(requests),
  );

  const lifecycleExcludedPaths = [
    TABLE_LIVE_V12_AUTHORIZATION_TEMPLATE_PATH,
    TABLE_LIVE_V12_AUTHORIZATION_PATH,
    "recipe/table-live-v12-authorization.ts",
    "recipe/table-live-v12-authorization.test.ts",
    "recipe/table-live-v12-preflight.ts",
    "recipe/table-live-v12-authorized.ts",
    "recipe/write-table-live-v12-authorization.ts",
    "recipe/create-table-live-v12-security-attestation.ts",
    "recipe/evidence/table-live-pivot-v12/operator-security-attestation-template.json",
    "recipe/evidence/table-live-pivot-v12-status.json",
    "recipe/evidence/status-index.json",
  ];
  const indexedPaths = [
    ...antecedentOutputs.keys(),
    "recipe/table-live-v12-broker.ts",
    "recipe/table-live-v12-contract.ts",
    "recipe/table-live-v12-restore.ts",
    "recipe/table-live-v12-cleanup.ts",
    "recipe/table-live-v12-verifier.ts",
    "recipe/table-live-v12-fixed-point.ts",
    "recipe/run-table-live-v12.ts",
    "recipe/build-table-live-proof-v12.ts",
    "recipe/table-live-v12-lifecycle-simulation.ts",
    "recipe/scene-readback-table-v1.ts",
    "recipe/scene-readback-runtime-table-v12.ts",
    "recipe/table-figma-writer.ts",
    "recipe/figma-property-normalizer-v8.ts",
    "recipe/figma-runtime-portability.ts",
    "recipe/normalize.ts",
  ].filter((artifactPath) => artifactPath !== TABLE_LIVE_V12_INDEX_PATH);
  const indexedArtifacts = Object.fromEntries(
    indexedPaths.map((artifactPath) => {
      const value =
        antecedentOutputs.get(artifactPath) ?? readFileSync(artifactPath);
      return [artifactPath, { bytes: value.byteLength, sha256: sha256(value) }];
    }),
  );
  const hashSetSha256 = sha256(
    JSON.stringify(
      Object.entries(indexedArtifacts).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
  const index = {
    artifactVersion: "table-live-v12-antecedent-index-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    artifacts: indexedArtifacts,
    hashSetSha256,
    counts: {
      sources: 2,
      variants: TABLE_LIVE_V12_VARIANT_COUNT,
      expectedSceneFacts: expectedFacts,
      captureCells: TABLE_LIVE_V12_CAPTURE_COUNT,
      remoteRequests: TABLE_LIVE_V12_REMOTE_REQUESTS,
      hostPhases: TABLE_LIVE_V12_HOST_PHASES,
    },
    generatedDeterministically: true,
    authorizationLifecycleExcluded: lifecycleExcludedPaths,
    authorizationCanBeAddedWithoutAntecedentRebuild: true,
    attemptsExecuted: 0,
    maximumFutureAttempts: 3,
    liveExecutionOccurred: false,
    figmaWrites: 0,
    figmaCaptures: 0,
    humanSignoff: "pending",
    overallTableSuccess: false,
  };
  antecedentOutputs.set(TABLE_LIVE_V12_INDEX_PATH, jsonBytes(index));

  const authorizationTemplate = {
    artifactVersion: "table-live-v12-authorization-template-v1",
    authorizationId: "table-live-v12",
    status: "template only; no authorization",
    authorizationIntent: false,
    antecedent: {
      commit: null,
      indexPath: TABLE_LIVE_V12_INDEX_PATH,
      indexSha256: null,
      hashSetSha256,
    },
    signingPublicKey: {
      algorithm: "Ed25519",
      encoding: "SPKI-PEM",
      publicKeyPem: null,
      spkiSha256: null,
      privateKeyStoredInRepository: false,
    },
    operatorBoundary: {
      target: TABLE_LIVE_V12_TARGET,
      expectedDynamicTool: TABLE_LIVE_V12_DYNAMIC_TOOL,
      externalOperatorOnly: true,
      oneMcpCallPerSignedRequest: true,
    },
    denominator: {
      remoteRequests: TABLE_LIVE_V12_REMOTE_REQUESTS,
      hostPhases: TABLE_LIVE_V12_HOST_PHASES,
      captures: TABLE_LIVE_V12_CAPTURE_COUNT,
      sourceRoots: TABLE_LIVE_V12_SOURCE_ROOTS,
      expectedFacts,
    },
    execution: {
      maximumAttempts: 3,
      attemptsExecuted: 0,
      captureBeforeHashBoundTechnicalGates: false,
      durableCleanupRequestPersistedImmediatelyAfterWriterAcceptance: true,
      cleanupMustRemainExecutableAfterHostFailure: true,
      cleanupMustNotExecuteOnMainComplete: true,
      taughtCleanupOnFailureOnly: true,
      inputV85AuthorizationReusable: false,
      comboboxLiveV41AuthorizationReusable: false,
      comboboxLiveV1AuthorizationReusable: false,
      tableLiveV1AuthorizationReusable: false,
      tableLiveV2AuthorizationReusable: false,
      tableLiveV3AuthorizationReusable: false,
      tableLiveV4AuthorizationReusable: false,
      tableLiveV5AuthorizationReusable: false,
      tableLiveV6AuthorizationReusable: false,
      tableLiveV7AuthorizationReusable: false,
      tableLiveV8AuthorizationReusable: false,
      tableLiveV9AuthorizationReusable: false,
      tableLiveV10AuthorizationReusable: false,
    },
    securityPrerequisite: {
      figmaPatRevokedOrReplacedRequired: true,
      mcpRestartAfterRotationRequired: true,
      ownerOnlyEnvironmentFileMode0600Required: true,
      repositorySecretScanZeroRequired: true,
      exactScratchReadOnlyProbeRequired: true,
      tokenValuesForbidden: true,
    },
    humanSignoff: { mandatory: true, status: "pending" },
  };
  const templateBytes = jsonBytes(authorizationTemplate);
  const attestationTemplate = jsonBytes({
    artifactVersion: "table-live-v12-operator-security-attestation-template-v1",
    status: "template only; complete privately after PREPARE+AUTHORIZE",
    tokenValuesForbidden: true,
    privateDirectory: "private/table-live-v12-security-attestation.json",
  });

  if (check) {
    const drift = [...antecedentOutputs].flatMap(([outputPath, expected]) =>
      !existsSync(outputPath) || !readFileSync(outputPath).equals(expected)
        ? [outputPath]
        : [],
    );
    if (drift.length)
      throw new Error(
        `Table live v12 antecedent generated artifact drift:\n${drift.join("\n")}`,
      );
  } else {
    for (const [outputPath, value] of antecedentOutputs) {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, value);
    }
    mkdirSync(path.dirname(TABLE_LIVE_V12_AUTHORIZATION_TEMPLATE_PATH), {
      recursive: true,
    });
    writeFileSync(TABLE_LIVE_V12_AUTHORIZATION_TEMPLATE_PATH, templateBytes);
    writeFileSync(
      `${TABLE_LIVE_V12_EVIDENCE_ROOT}/operator-security-attestation-template.json`,
      attestationTemplate,
    );
  }
  if (process.argv.includes("--check-authorization-template")) {
    if (
      !existsSync(TABLE_LIVE_V12_AUTHORIZATION_TEMPLATE_PATH) ||
      !readFileSync(TABLE_LIVE_V12_AUTHORIZATION_TEMPLATE_PATH).equals(
        templateBytes,
      )
    )
      throw new Error("Table live v12 authorization template drift");
  }
  if (
    writer.namespace !== TABLE_FIGMA_NAMESPACE ||
    writer.namespace === FORBIDDEN_INPUT_NAMESPACE ||
    writer.runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V1_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V2_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V3_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V4_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V5_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V6_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V7_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V8_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V9_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V10_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_TABLE_V11_RUN_IDENTITY ||
    !writerProgram.toString("utf8").includes("TABLE-INPUT-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-COMBOBOX-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V1-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V2-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V3-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V4-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V5-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V6-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V7-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V8-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V9-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V10-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-V11-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("TABLE-WRITER-ROW-OWNED-TEXT-CHARACTERS") ||
    !writerProgram.toString("utf8").includes("TABLE-WRITER-MIN-WIDTH-ZERO-UNSET") ||
    protocol(expectedFacts).execution.cleanupOnFailureOnly !== true
  )
    throw new Error("Table live v12 identity or cleanup invariant failed");
  return proofPlan;
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  process.stdout.write(
    `${JSON.stringify(await buildTableLiveV12Proof(), null, 2)}\n`,
  );
