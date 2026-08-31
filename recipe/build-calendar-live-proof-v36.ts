import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { adaptReviewedCalendar } from "./adapters/calendar.js";
import {
  CALENDAR_LIVE_V36_CAPTURE_COUNT,
  CALENDAR_LIVE_V36_HOST_PHASES,
  CALENDAR_LIVE_V36_REMOTE_REQUESTS,
  CALENDAR_LIVE_V36_SOURCE_ROOTS,
  CALENDAR_LIVE_V36_VARIANT_COUNT,
  buildCalendarLiveV36CaptureProgram,
  buildCalendarLiveV36CleanupProgram,
  buildCalendarLiveV36ExtractProgram,
  buildCalendarLiveV36ProbeProgram,
  buildCalendarLiveV36RestoreProgram,
  calendarLiveV1CaptureManifestSha256,
  type CalendarLiveV36CaptureCell,
  type CalendarLiveV36SourceIdentity,
  type CalendarLiveV36WriterOwnership,
} from "./calendar-live-v36-contract.js";
import {
  CALENDAR_LIVE_V36_DYNAMIC_TOOL,
  CALENDAR_LIVE_V36_TARGET,
  calendarLiveV1RequestSequence,
} from "./calendar-live-v36-broker.js";
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
  FORBIDDEN_CALENDAR_V8_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V9_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V10_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V11_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V12_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V30_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V30_PAGE_ID,
  FORBIDDEN_CALENDAR_V31_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V32_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V33_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V34_RUN_IDENTITY,
  FORBIDDEN_CALENDAR_V35_RUN_IDENTITY,
  CALENDAR_FIGMA_NAMESPACE,
  emitCalendarFigmaWriter,
} from "./calendar-figma-writer.js";
import {
  astryxCalendarAdapterConfig,
  astryxCalendarSource,
} from "./fixtures/library-calendars.js";
import type { IRNode } from "./figma-ir.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  CALENDAR_DAY_STATES,
  CALENDAR_WEEK_NUMBERS,
  compileCalendarRecipe,
  calendarRecipe,
} from "./recipes/calendar.js";
import {
  compileExpectedScenePlan,
  type ExpectedScenePlan,
} from "./scene-readback-calendar-v1.js";

export const CALENDAR_LIVE_V36_EVIDENCE_ROOT =
  "recipe/evidence/calendar-live-pivot-v36";
export const CALENDAR_LIVE_V36_PROTOCOL_PATH = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/protocol.json`;
export const CALENDAR_LIVE_V36_PLAN_PATH = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/proof-plan.json`;
export const CALENDAR_LIVE_V36_CAPTURE_MANIFEST_PATH = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/capture-manifest.json`;
export const CALENDAR_LIVE_V36_REQUEST_MANIFEST_PATH = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/request-manifest.json`;
export const CALENDAR_LIVE_V36_INDEX_PATH = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/antecedent-index.json`;
export const CALENDAR_LIVE_V36_AUTHORIZATION_TEMPLATE_PATH = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/authorization-template.json`;
export const CALENDAR_LIVE_V36_AUTHORIZATION_PATH = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/capture-authorization.json`;

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const jsonBytes = (value: unknown): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export interface CalendarLiveV36ProofPlan {
  artifactVersion: "calendar-live-v36-proof-plan-v1";
  status: "draft antecedent; pending separate authorization; live execution forbidden";
  target: typeof CALENDAR_LIVE_V36_TARGET;
  namespace: typeof CALENDAR_FIGMA_NAMESPACE;
  writer: {
    programPath: string;
    programBytes: number;
    programSha256: string;
    runIdentity: string;
    pageName: string;
  };
  sources: Array<{
    source: "astryx";
    adapterIdentity: string;
    recipeHash: string;
    envelopeHash: string;
    calendarExpectedScenePlan: {
      path: string;
      bytes: number;
      sha256: string;
      uncompressedBytes: number;
      uncompressedSha256: string;
      facts: number;
    };
    weekExpectedScenePlan: {
      path: string;
      bytes: number;
      sha256: string;
      uncompressedBytes: number;
      uncompressedSha256: string;
      facts: number;
    };
    dayExpectedScenePlan: {
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
    cells: 8;
    requests: 8;
    cellsPerRequest: 1;
    sha256: string;
  };
  requests: {
    remote: 13;
    mainLane: 12;
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
  overallCalendarSuccess: false;
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
      source: "astryx" as const,
      adapterIdentity: "astryx-calendar-reviewed-v1",
      displayName: "Astryx Calendar",
      reviewed: astryxCalendarSource,
      config: astryxCalendarAdapterConfig,
    },
  ].map((descriptor) => {
    const instance = adaptReviewedCalendar(
      descriptor.reviewed,
      descriptor.config,
    );
    const envelope = compileCalendarRecipe(instance);
    const calendarSet = requireSet(envelope.ir, "calendar/set");
    const weekSet = requireSet(envelope.ir, "calendar/week-set");
    const daySet = requireSet(envelope.ir, "calendar/day-set");
    const calendarPlan = applyOccupancyTeachings(
      compileExpectedScenePlan(calendarSet, { rootOwnershipKey: "calendar" }),
      calendarSet,
      "calendar",
    );
    const weekPlan = applyOccupancyTeachings(
      compileExpectedScenePlan(weekSet, { rootOwnershipKey: "week" }),
      weekSet,
      "week",
    );
    const dayPlan = applyOccupancyTeachings(
      compileExpectedScenePlan(daySet, { rootOwnershipKey: "day" }),
      daySet,
      "day",
    );
    return {
      ...descriptor,
      instance,
      envelope,
      recipeHash: hashRecipeInstance(calendarRecipe, instance),
      calendarPlan,
      weekPlan,
      dayPlan,
    };
  });

const frameFor = (
  instance: ReturnType<typeof adaptReviewedCalendar>,
  kind: "calendar" | "week" | "day",
) => {
  const size = instance.tokens.dayCell.size.fallback;
  const pad = instance.tokens.rootPadding.fallback;
  const day = size + 80;
  const week = size * 8 + 80;
  const height = size * 6 + pad * 2 + size + 120;
  if (kind === "day") return { width: day, height: day };
  if (kind === "week") return { width: week, height: day };
  return { width: week, height };
};

const captureCells = (
  sources: ReturnType<typeof sourceDescriptors>,
): CalendarLiveV36CaptureCell[] => {
  const cells: CalendarLiveV36CaptureCell[] = [];
  for (const source of sources) {
    for (const weekNumbers of CALENDAR_WEEK_NUMBERS) {
      cells.push({
        index: cells.length,
        cellKey: [source.source, "calendar", weekNumbers].join("/"),
        source: source.source,
        adapterIdentity: source.adapterIdentity,
        kind: "calendar",
        axes: { WeekNumbers: weekNumbers },
        strata: {
          source: source.source,
          kind: "calendar",
          density: weekNumbers,
        },
        frame: frameFor(source.instance, "calendar"),
      });
    }
    for (const weekNumbers of CALENDAR_WEEK_NUMBERS) {
      cells.push({
        index: cells.length,
        cellKey: [source.source, "week", weekNumbers].join("/"),
        source: source.source,
        adapterIdentity: source.adapterIdentity,
        kind: "week",
        axes: { WeekNumbers: weekNumbers },
        strata: { source: source.source, kind: "week", density: weekNumbers },
        frame: frameFor(source.instance, "week"),
      });
    }
    for (const state of CALENDAR_DAY_STATES) {
      cells.push({
        index: cells.length,
        cellKey: [source.source, "day", state].join("/"),
        source: source.source,
        adapterIdentity: source.adapterIdentity,
        kind: "day",
        axes: { State: state },
        strata: { source: source.source, kind: "day", density: state },
        frame: frameFor(source.instance, "day"),
      });
    }
  }
  if (cells.length !== CALENDAR_LIVE_V36_CAPTURE_COUNT)
    throw new Error(
      `Calendar live v36 capture cells ${cells.length}, expected ${CALENDAR_LIVE_V36_CAPTURE_COUNT}`,
    );
  calendarLiveV1CaptureManifestSha256(cells);
  return cells;
};

const protocol = (expectedFacts: number) => ({
  artifactVersion: "calendar-live-v36-external-operator-protocol-v1",
  protocolId: "calendar-live-v36",
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
    calendarLiveV1AuthorizationReusable: false,
    calendarLiveV2AuthorizationReusable: false,
    calendarLiveV3AuthorizationReusable: false,
    calendarLiveV7AuthorizationReusable: false,
    calendarLiveV23AuthorizationReusable: false,
    calendarLiveV24AuthorizationReusable: false,
    calendarLiveV25AuthorizationReusable: false,
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
    hostFoldsDayButtonPerSideStrokeWeight: true,
    hostKeepsVariantMinWidthBinding: true,
    writerBindsLayoutMinWidth: true,
    writerFillTextSkipsPreParentIntrinsic: true,
    compileCarriesSourceNamedSixRowNavCircularDayRootPadding: true,
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
    hostOmitsVariantClipsContent: true,
    hostOmitsVariantEffects: true,
    hostOmitsVariantEmptyStrokeDashPattern: true,
    hostOmitsSetCornerRadius: true,
    hostOmitsSetEffects: true,
    hostOmitsSetStrokes: true,
    hostOmitsRowVariantClipsContent: true,
    hostOmitsRowVariantCornerRadius: true,
    hostOmitsRowVariantEffects: true,
    hostOmitsRowVariantStrokes: true,
    hostEmitsRowSetCompileCarryLabel: true,
    hostEmitsCellLabelCompileCarryLabelNotFontProvenanceSuffix: true,
    hostOmitsCellVariantClipsContent: true,
    hostOmitsCellVariantCornerRadius: true,
    hostOmitsCellVariantEffects: true,
    hostOmitsCellVariantEmptyStrokeDashPattern: true,
    hostEmitsCellSetCompileCarryLabel: true,
    compileCellTemplateLabelDefaultSharedAcrossKinds: true,
    compileOmitsAbsentCellMinWidth: true,
    writerSetNameCarriesCompileLabel: true,
    hostLabelOverridesRemovedInFavourOfWriterSetName: true,
    probeContainmentIsNotOverlap: true,
    compileLowersFullWidthRootAndRowToFill: true,
    compileLeavesCellHugBecauseTheColumnModelIsOpen: true,
    writerDefersFillUntilAutoLayoutParent: true,
    writerHugsFromPostCharacterIntrinsic: true,
    writerWalksNamedFallbackWhenResolvedFaceHasZeroGlyph: true,
    hostEmitsCompileResolvedFontFromProvenanceNotLiveFace: true,
    writerWritesInstanceLabelViaSetPropertiesAfterPaintedFallback: true,
    writerWritesInstanceLabelViaSetPropertiesAfterAppend: true,
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
    namespace: CALENDAR_FIGMA_NAMESPACE,
    writerPath: "recipe/calendar-figma-writer.ts",
    forbiddenInputNamespace: FORBIDDEN_INPUT_NAMESPACE,
    forbiddenInputRunIdentity: FORBIDDEN_INPUT_RUN_IDENTITY,
    forbiddenInputPageId: FORBIDDEN_INPUT_PAGE_ID,
    forbiddenComboboxNamespace: FORBIDDEN_COMBOBOX_NAMESPACE,
    forbiddenComboboxRunIdentity: FORBIDDEN_COMBOBOX_RUN_IDENTITY,
    forbiddenComboboxPageId: FORBIDDEN_COMBOBOX_PAGE_ID,
  },
  target: CALENDAR_LIVE_V36_TARGET,
  expectedDynamicTool: CALENDAR_LIVE_V36_DYNAMIC_TOOL,
  denominator: {
    sourceRoots: CALENDAR_LIVE_V36_SOURCE_ROOTS,
    sets: 3,
    variants: CALENDAR_LIVE_V36_VARIANT_COUNT,
    captureCells: CALENDAR_LIVE_V36_CAPTURE_COUNT,
    remoteRequests: CALENDAR_LIVE_V36_REMOTE_REQUESTS,
    hostPhases: CALENDAR_LIVE_V36_HOST_PHASES,
    expectedSceneFacts: expectedFacts,
    restoreHugTexts: 4,
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

export async function buildCalendarLiveV36Proof(
  check = process.argv.includes("--check"),
): Promise<CalendarLiveV36ProofPlan> {
  const sources = sourceDescriptors();
  const writer = emitCalendarFigmaWriter(
    sources.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      recipeHash: source.recipeHash,
      envelope: source.envelope,
    })),
  );
  if (
    writer.namespace !== CALENDAR_FIGMA_NAMESPACE ||
    writer.namespace === FORBIDDEN_INPUT_NAMESPACE ||
    writer.namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    writer.runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_COMBOBOX_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V1_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V2_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V3_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V4_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V5_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V6_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V7_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V8_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V9_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V10_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V11_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V12_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V30_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V31_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V32_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V33_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V34_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V35_RUN_IDENTITY ||
    !writer.runIdentity.endsWith("-calendar-v36") ||
    writer.namespace === FORBIDDEN_TABLE_NAMESPACE ||
    writer.pageName.includes(FORBIDDEN_INPUT_PAGE_ID) ||
    writer.pageName.includes(FORBIDDEN_COMBOBOX_PAGE_ID) ||
    writer.pageName.includes(FORBIDDEN_CALENDAR_V30_PAGE_ID)
  )
    throw new Error(
      "Calendar live v36 writer reused Input, Combobox, or Table v1–v24 identity",
    );
  const captures = captureCells(sources);
  const writerProgram = Buffer.from(writer.code);
  const writerOwnershipBlueprint: CalendarLiveV36WriterOwnership = {
    pageId: "__WRITER_PAGE_ID__",
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    namespace: writer.namespace,
    setIds: [
      "__ASTRYX_CALENDAR_SET_ID__",
      "__ASTRYX_WEEK_SET_ID__",
      "__ASTRYX_DAY_SET_ID__",
    ],
    sectionIds: ["__ASTRYX_SECTION_ID__"],
    collectionIds: ["__ASTRYX_COLLECTION_ID__"],
    createdNodeIds: ["__WRITER_CREATED_NODE_IDS__"],
    sources: sources.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      calendarSetId: "__ASTRYX_CALENDAR_SET_ID__",
      weekSetId: "__ASTRYX_WEEK_SET_ID__",
      daySetId: "__ASTRYX_DAY_SET_ID__",
      sectionId: "__ASTRYX_SECTION_ID__",
      collectionId: "__ASTRYX_COLLECTION_ID__",
      variableCount: source.calendarPlan.facts.filter(
        (fact) => fact.channel === "binding",
      ).length,
      variantCount: 8 as const,
      calendarCells: 2 as const,
      weekCells: 2 as const,
      dayCells: 4 as const,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelope.integrity.canonicalHash,
    })),
    counts: { sources: 1, variants: 8, collections: 1, sets: 3, nodes: 1 },
  };
  const identities: CalendarLiveV36SourceIdentity[] = sources.map((source) => ({
    source: source.source,
    adapterIdentity: source.adapterIdentity,
    recipeHash: source.recipeHash,
    envelopeHash: source.envelope.integrity.canonicalHash,
    calendarExpectedScenePlan: source.calendarPlan,
    weekExpectedScenePlan: source.weekPlan,
    dayExpectedScenePlan: source.dayPlan,
  }));
  const restoreBlueprint = Buffer.from(
    buildCalendarLiveV36RestoreProgram(writerOwnershipBlueprint),
  );
  const extractBlueprint = Buffer.from(
    buildCalendarLiveV36ExtractProgram(writerOwnershipBlueprint, identities),
  );
  const probeBlueprint = Buffer.from(
    buildCalendarLiveV36ProbeProgram(writerOwnershipBlueprint, identities),
  );
  const captureBlueprint = Buffer.from(
    buildCalendarLiveV36CaptureProgram(writerOwnershipBlueprint, captures[0]!),
  );
  const cleanupBlueprint = Buffer.from(
    buildCalendarLiveV36CleanupProgram(writerOwnershipBlueprint),
  );

  const antecedentOutputs = new Map<string, Buffer>();
  const sourceMetadata = sources.map((source) => {
    const tableBytes = Buffer.from(`${JSON.stringify(source.calendarPlan)}\n`);
    const rowBytes = Buffer.from(`${JSON.stringify(source.weekPlan)}\n`);
    const cellBytes = Buffer.from(`${JSON.stringify(source.dayPlan)}\n`);
    const tableCompressed = gzipSync(tableBytes);
    const rowCompressed = gzipSync(rowBytes);
    const cellCompressed = gzipSync(cellBytes);
    const tablePath = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/expected-scene-plan-${source.source}-calendar.json.gz`;
    const rowPath = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/expected-scene-plan-${source.source}-week.json.gz`;
    const cellPath = `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/expected-scene-plan-${source.source}-day.json.gz`;
    antecedentOutputs.set(tablePath, tableCompressed);
    antecedentOutputs.set(rowPath, rowCompressed);
    antecedentOutputs.set(cellPath, cellCompressed);
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelope.integrity.canonicalHash,
      calendarExpectedScenePlan: {
        path: tablePath,
        bytes: tableCompressed.byteLength,
        sha256: sha256(tableCompressed),
        uncompressedBytes: tableBytes.byteLength,
        uncompressedSha256: sha256(tableBytes),
        facts: source.calendarPlan.facts.length,
      },
      weekExpectedScenePlan: {
        path: rowPath,
        bytes: rowCompressed.byteLength,
        sha256: sha256(rowCompressed),
        uncompressedBytes: rowBytes.byteLength,
        uncompressedSha256: sha256(rowBytes),
        facts: source.weekPlan.facts.length,
      },
      dayExpectedScenePlan: {
        path: cellPath,
        bytes: cellCompressed.byteLength,
        sha256: sha256(cellCompressed),
        uncompressedBytes: cellBytes.byteLength,
        uncompressedSha256: sha256(cellBytes),
        facts: source.dayPlan.facts.length,
      },
    };
  });
  const expectedFacts = sourceMetadata.reduce(
    (sum, source) =>
      sum +
      source.calendarExpectedScenePlan.facts +
      source.weekExpectedScenePlan.facts +
      source.dayExpectedScenePlan.facts,
    0,
  );

  antecedentOutputs.set(
    CALENDAR_LIVE_V36_PROTOCOL_PATH,
    jsonBytes(protocol(expectedFacts)),
  );
  antecedentOutputs.set(
    `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/programs/writer.txt`,
    writerProgram,
  );
  antecedentOutputs.set(
    `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/programs/restore-blueprint.js`,
    restoreBlueprint,
  );
  antecedentOutputs.set(
    `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/programs/extract-blueprint.js`,
    extractBlueprint,
  );
  antecedentOutputs.set(
    `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/programs/probe-blueprint.js`,
    probeBlueprint,
  );
  antecedentOutputs.set(
    `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/programs/capture-blueprint.js`,
    captureBlueprint,
  );
  antecedentOutputs.set(
    `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/programs/cleanup-blueprint.js`,
    cleanupBlueprint,
  );

  const captureManifest = {
    artifactVersion: "calendar-live-v36-capture-manifest-v1",
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
    cellsSha256: calendarLiveV1CaptureManifestSha256(captures),
  };
  const captureManifestBytes = jsonBytes(captureManifest);
  antecedentOutputs.set(
    CALENDAR_LIVE_V36_CAPTURE_MANIFEST_PATH,
    captureManifestBytes,
  );

  const proofPlan: CalendarLiveV36ProofPlan = {
    artifactVersion: "calendar-live-v36-proof-plan-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    target: CALENDAR_LIVE_V36_TARGET,
    namespace: CALENDAR_FIGMA_NAMESPACE,
    writer: {
      programPath: `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/programs/writer.txt`,
      programBytes: writerProgram.byteLength,
      programSha256: sha256(writerProgram),
      runIdentity: writer.runIdentity,
      pageName: writer.pageName,
    },
    sources: sourceMetadata,
    captureManifest: {
      path: CALENDAR_LIVE_V36_CAPTURE_MANIFEST_PATH,
      cells: 8,
      requests: 8,
      cellsPerRequest: 1,
      sha256: sha256(captureManifestBytes),
    },
    requests: {
      remote: 13,
      mainLane: 12,
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
    overallCalendarSuccess: false,
  };
  antecedentOutputs.set(CALENDAR_LIVE_V36_PLAN_PATH, jsonBytes(proofPlan));

  const requests = {
    artifactVersion: "calendar-live-v36-request-manifest-v1",
    expectedDynamicTool: CALENDAR_LIVE_V36_DYNAMIC_TOOL,
    target: CALENDAR_LIVE_V36_TARGET,
    signedAtRuntime: true,
    requestCount: CALENDAR_LIVE_V36_REMOTE_REQUESTS,
    requests: [
      {
        requestId: "writer",
        sequence: calendarLiveV1RequestSequence("writer"),
        phase: "writer",
      },
      {
        requestId: "cleanup",
        sequence: calendarLiveV1RequestSequence("cleanup"),
        phase: "cleanup",
        availability: "persisted immediately after writer acceptance",
      },
      {
        requestId: "restore",
        sequence: calendarLiveV1RequestSequence("restore"),
        phase: "restore",
      },
      {
        requestId: "extract",
        sequence: calendarLiveV1RequestSequence("extract"),
        phase: "extract",
      },
      {
        requestId: "probe",
        sequence: calendarLiveV1RequestSequence("probe"),
        phase: "probe",
      },
      ...captures.map((cell) => ({
        requestId: `capture-${String(cell.index).padStart(3, "0")}`,
        sequence: calendarLiveV1RequestSequence("capture", cell.index),
        phase: "capture",
        captureIndex: cell.index,
        cellKey: cell.cellKey,
      })),
    ],
  };
  if (requests.requestCount !== CALENDAR_LIVE_V36_REMOTE_REQUESTS)
    throw new Error("Calendar live v36 remote request denominator drifted");
  antecedentOutputs.set(
    CALENDAR_LIVE_V36_REQUEST_MANIFEST_PATH,
    jsonBytes(requests),
  );

  const lifecycleExcludedPaths = [
    CALENDAR_LIVE_V36_AUTHORIZATION_TEMPLATE_PATH,
    CALENDAR_LIVE_V36_AUTHORIZATION_PATH,
    "recipe/calendar-live-v36-authorization.ts",
    "recipe/calendar-live-v36-authorization.test.ts",
    "recipe/calendar-live-v36-preflight.ts",
    "recipe/calendar-live-v36-authorized.ts",
    "recipe/write-calendar-live-v36-authorization.ts",
    "recipe/create-calendar-live-v36-security-attestation.ts",
    "recipe/evidence/calendar-live-pivot-v36/operator-security-attestation-template.json",
    "recipe/evidence/calendar-live-pivot-v36-status.json",
    "recipe/evidence/status-index.json",
  ];
  const indexedPaths = [
    ...antecedentOutputs.keys(),
    "recipe/calendar-live-v36-broker.ts",
    "recipe/calendar-live-v36-contract.ts",
    "recipe/calendar-live-v36-restore.ts",
    "recipe/calendar-live-v36-cleanup.ts",
    "recipe/calendar-live-v36-verifier.ts",
    "recipe/calendar-live-v36-fixed-point.ts",
    "recipe/run-calendar-live-v36.ts",
    "recipe/build-calendar-live-proof-v36.ts",
    "recipe/calendar-live-v36-lifecycle-simulation.ts",
    "recipe/scene-readback-calendar-v1.ts",
    "recipe/scene-readback-runtime-calendar-v1.ts",
    "recipe/calendar-figma-writer.ts",
    "recipe/figma-property-normalizer-v8.ts",
    "recipe/figma-runtime-portability.ts",
    "recipe/normalize.ts",
  ].filter((artifactPath) => artifactPath !== CALENDAR_LIVE_V36_INDEX_PATH);
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
    artifactVersion: "calendar-live-v36-antecedent-index-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    artifacts: indexedArtifacts,
    hashSetSha256,
    counts: {
      sources: 1,
      variants: CALENDAR_LIVE_V36_VARIANT_COUNT,
      expectedSceneFacts: expectedFacts,
      captureCells: CALENDAR_LIVE_V36_CAPTURE_COUNT,
      remoteRequests: CALENDAR_LIVE_V36_REMOTE_REQUESTS,
      hostPhases: CALENDAR_LIVE_V36_HOST_PHASES,
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
    overallCalendarSuccess: false,
  };
  antecedentOutputs.set(CALENDAR_LIVE_V36_INDEX_PATH, jsonBytes(index));

  const authorizationTemplate = {
    artifactVersion: "calendar-live-v36-authorization-template-v1",
    authorizationId: "calendar-live-v36",
    status: "template only; no authorization",
    authorizationIntent: false,
    antecedent: {
      commit: null,
      indexPath: CALENDAR_LIVE_V36_INDEX_PATH,
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
      target: CALENDAR_LIVE_V36_TARGET,
      expectedDynamicTool: CALENDAR_LIVE_V36_DYNAMIC_TOOL,
      externalOperatorOnly: true,
      oneMcpCallPerSignedRequest: true,
    },
    denominator: {
      remoteRequests: CALENDAR_LIVE_V36_REMOTE_REQUESTS,
      hostPhases: CALENDAR_LIVE_V36_HOST_PHASES,
      captures: CALENDAR_LIVE_V36_CAPTURE_COUNT,
      sourceRoots: CALENDAR_LIVE_V36_SOURCE_ROOTS,
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
      calendarLiveV1AuthorizationReusable: false,
      calendarLiveV2AuthorizationReusable: false,
      calendarLiveV3AuthorizationReusable: false,
      calendarLiveV7AuthorizationReusable: false,
      calendarLiveV23AuthorizationReusable: false,
    calendarLiveV24AuthorizationReusable: false,
    calendarLiveV25AuthorizationReusable: false,
      tableLiveV3AuthorizationReusable: false,
      tableLiveV4AuthorizationReusable: false,
      tableLiveV5AuthorizationReusable: false,
      tableLiveV6AuthorizationReusable: false,
      tableLiveV7AuthorizationReusable: false,
      tableLiveV8AuthorizationReusable: false,
      tableLiveV9AuthorizationReusable: false,
      tableLiveV10AuthorizationReusable: false,
      tableLiveV11AuthorizationReusable: false,
      tableLiveV12AuthorizationReusable: false,
      tableLiveV13AuthorizationReusable: false,
      tableLiveV14AuthorizationReusable: false,
      tableLiveV15AuthorizationReusable: false,
      tableLiveV16AuthorizationReusable: false,
      tableLiveV17AuthorizationReusable: false,
      tableLiveV18AuthorizationReusable: false,
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
    artifactVersion: "calendar-live-v36-operator-security-attestation-template-v1",
    status: "template only; complete privately after PREPARE+AUTHORIZE",
    tokenValuesForbidden: true,
    privateDirectory: "private/calendar-live-v36-security-attestation.json",
  });

  if (check) {
    const drift = [...antecedentOutputs].flatMap(([outputPath, expected]) =>
      !existsSync(outputPath) || !readFileSync(outputPath).equals(expected)
        ? [outputPath]
        : [],
    );
    if (drift.length)
      throw new Error(
        `Calendar live v36 antecedent generated artifact drift:\n${drift.join("\n")}`,
      );
  } else {
    for (const [outputPath, value] of antecedentOutputs) {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, value);
    }
    mkdirSync(path.dirname(CALENDAR_LIVE_V36_AUTHORIZATION_TEMPLATE_PATH), {
      recursive: true,
    });
    writeFileSync(CALENDAR_LIVE_V36_AUTHORIZATION_TEMPLATE_PATH, templateBytes);
    writeFileSync(
      `${CALENDAR_LIVE_V36_EVIDENCE_ROOT}/operator-security-attestation-template.json`,
      attestationTemplate,
    );
  }
  if (process.argv.includes("--check-authorization-template")) {
    if (
      !existsSync(CALENDAR_LIVE_V36_AUTHORIZATION_TEMPLATE_PATH) ||
      !readFileSync(CALENDAR_LIVE_V36_AUTHORIZATION_TEMPLATE_PATH).equals(
        templateBytes,
      )
    )
      throw new Error("Calendar live v36 authorization template drift");
  }
  if (
    writer.namespace !== CALENDAR_FIGMA_NAMESPACE ||
    writer.namespace === FORBIDDEN_INPUT_NAMESPACE ||
    writer.runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V1_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V2_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V3_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V4_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V5_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V6_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V7_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V8_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V9_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V10_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V11_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V12_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V30_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V31_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V32_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V33_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V34_RUN_IDENTITY ||
    writer.runIdentity === FORBIDDEN_CALENDAR_V35_RUN_IDENTITY ||
    !writer.runIdentity.endsWith("-calendar-v36") ||
    writer.namespace === FORBIDDEN_TABLE_NAMESPACE ||
    !writerProgram.toString("utf8").includes("CALENDAR-INPUT-IDENTITY-REUSE") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-COMBOBOX-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-TABLE-IDENTITY-REUSE") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-MUST-NOT-WRITE-INPUT-PAGE") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-MUST-NOT-WRITE-COMBOBOX-PAGE") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-MUST-NOT-WRITE-BUTTON-PAGE") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-MUST-NOT-WRITE-TABLE-PAGE") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-SET-NAME-CARRIES-COMPILE-LABEL") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-ONLY-DAY-IS-INSTANTIABLE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-WRITER-DAY-CELL-BOX") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-DAY-CELL-BOX-BEFORE-CHILDREN") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-LOAD-INSTANCE-FONT-BEFORE-SET-PROPERTIES") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-INSTANCE-LABEL-VIA-CHARACTERS") ||
    writerProgram
      .toString("utf8")
      .includes("node.setProperties({[property]:ir.properties.Label})") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V1-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V2-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V3-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V4-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V5-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V6-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V7-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V8-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V9-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V10-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V11-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V12-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V19-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V20-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V21-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V22-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V23-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V24-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V25-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V26-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V30-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V31-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V32-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V33-IDENTITY-REUSE") ||
    !writerProgram.toString("utf8").includes("CALENDAR-V34-IDENTITY-REUSE") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-BIND-LAYOUT-MIN-WIDTH") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-FILL-TEXT-SKIPS-PRE-PARENT-INTRINSIC") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-BIND-LABEL-AFTER-INSTANCE-CHARACTERS") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-BIND-LABEL-AFTER-WEEK-AND-MONTH") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC") ||
    writerProgram
      .toString("utf8")
      .includes("hugTextIntrinsic={width:Math.max(node.width,1)") ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-INSTANCE-LABEL-AFTER-APPEND") ||
    !writerProgram.toString("utf8").includes("CALENDAR-DAY-LABEL-MISMATCH") ||
    !writerProgram.toString("utf8").includes("CALENDAR-WRITER-DAY-LABEL-FROM-SET") ||
    writerProgram.toString("utf8").includes('propertyKey(node,"Label")') ||
    !writerProgram
      .toString("utf8")
      .includes("CALENDAR-WRITER-MIN-WIDTH-ZERO-UNSET") ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-SET-EMPTY-BINDINGS",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-CAPTION-BINDING-COMPILE-ORDER",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-WEEKDAY-BINDING-COMPILE-ORDER",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-WEEK-FRAME-ITEM-SPACING",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-WEEK-NUMBER-BINDING-COMPILE-ORDER",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-WEEK-FRAME-CLIPS-CONTENT-OMITTED",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-WEEK-FRAME-CORNER-RADIUS-OMITTED",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-WEEK-FRAME-EFFECTS-OMITTED",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-WEEK-FRAME-STROKES-OMITTED",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-VARIANT-CORNER-RADIUS-OMITTED",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-VARIANT-STROKES-OMITTED",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-WEEK-SET-NUMBER-BINDING-COMPILE-ORDER",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-DAY-VARIANT-CORNER-RADIUS-CARRIED",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-VARIANT-MIN-WIDTH-BINDING-COMPILE-ORDER",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-DAY-BUTTON-FOLD-UNIFORM-PER-SIDE-STROKE-WEIGHT",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-NAV-BINDING-COMPILE-ORDER",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "NAV_COMPILE_BINDING_FIELDS",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      'role === "calendar/day/button"',
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      '"layout.minWidth"',
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-DAY-VARIANT-STROKES-OMITTED",
    ) ||
    !readFileSync("recipe/scene-readback-calendar-v1.ts", "utf8").includes(
      "CALENDAR-HOST-TYPE-FONT-FROM-PROVENANCE-NOT-LIVE-FACE",
    ) ||
    !readFileSync("recipe/calendar-live-v36-contract.ts", "utf8").includes(
      "CALENDAR-PROBE-DAY-LABEL-VIA-CHARACTERS",
    ) ||
    !readFileSync("recipe/calendar-live-v36-contract.ts", "utf8").includes(
      "CALENDAR-PROBE-HUG-ROOT-REFLOW-IS-CONTENT-WIDTH",
    ) ||
    readFileSync("recipe/calendar-live-v36-contract.ts", "utf8").includes(
      "const reflowPassed=instance.width===beforeWidth+64",
    ) ||
    readFileSync("recipe/calendar-live-v36-contract.ts", "utf8").includes(
      "dayInstance.setProperties({[labelKey]",
    ) ||
    protocol(expectedFacts).execution.cleanupOnFailureOnly !== true
  )
    throw new Error("Calendar live v36 identity or cleanup invariant failed");
  return proofPlan;
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  process.stdout.write(
    `${JSON.stringify(await buildCalendarLiveV36Proof(), null, 2)}\n`,
  );
