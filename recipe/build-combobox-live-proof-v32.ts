import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { adaptReviewedCombobox } from "./adapters/combobox.js";
import {
  COMBOBOX_LIVE_V32_CAPTURE_COUNT,
  COMBOBOX_LIVE_V32_HOST_PHASES,
  COMBOBOX_LIVE_V32_REMOTE_REQUESTS,
  COMBOBOX_LIVE_V32_SOURCE_ROOTS,
  COMBOBOX_LIVE_V32_VARIANT_COUNT,
  buildComboboxLiveV32CaptureProgram,
  buildComboboxLiveV32CleanupProgram,
  buildComboboxLiveV32ExtractProgram,
  buildComboboxLiveV32ProbeProgram,
  buildComboboxLiveV32RestoreProgram,
  comboboxLiveV5CaptureManifestSha256,
  type ComboboxLiveV32CaptureCell,
  type ComboboxLiveV32SourceIdentity,
  type ComboboxLiveV32WriterOwnership,
} from "./combobox-live-v32-contract.js";
import {
  COMBOBOX_LIVE_V32_DYNAMIC_TOOL,
  COMBOBOX_LIVE_V32_TARGET,
  comboboxLiveV5RequestSequence,
} from "./combobox-live-v32-broker.js";
import {
  COMBOBOX_FIGMA_NAMESPACE,
  emitComboboxFigmaWriter,
  FORBIDDEN_INPUT_NAMESPACE,
  FORBIDDEN_INPUT_PAGE_ID,
  FORBIDDEN_INPUT_RUN_IDENTITY,
} from "./combobox-figma-writer.js";
import {
  antdComboboxAdapterConfig,
  antdComboboxSource,
  muiComboboxAdapterConfig,
  muiComboboxSource,
} from "./fixtures/library-comboboxes.js";
import type { IRNode } from "./figma-ir.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  COMBOBOX_APPEARANCES,
  COMBOBOX_CONTENT,
  COMBOBOX_FIELD_STATES,
  COMBOBOX_OPTION_STATES,
  COMBOBOX_SIZES,
  comboboxRecipe,
  compileComboboxRecipe,
} from "./recipes/combobox.js";
import {
  compileExpectedScenePlan,
  type ExpectedScenePlan,
} from "./scene-readback-combobox-v32.js";

export const COMBOBOX_LIVE_V32_EVIDENCE_ROOT =
  "recipe/evidence/combobox-live-pivot-v32";
export const COMBOBOX_LIVE_V32_PROTOCOL_PATH = `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/protocol.json`;
export const COMBOBOX_LIVE_V32_PLAN_PATH = `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/proof-plan.json`;
export const COMBOBOX_LIVE_V32_CAPTURE_MANIFEST_PATH = `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/capture-manifest.json`;
export const COMBOBOX_LIVE_V32_REQUEST_MANIFEST_PATH = `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/request-manifest.json`;
export const COMBOBOX_LIVE_V32_INDEX_PATH = `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/antecedent-index.json`;
export const COMBOBOX_LIVE_V32_AUTHORIZATION_TEMPLATE_PATH = `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/authorization-template.json`;
export const COMBOBOX_LIVE_V32_AUTHORIZATION_PATH = `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/capture-authorization.json`;

const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");
const jsonBytes = (value: unknown): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export interface ComboboxLiveV32ProofPlan {
  artifactVersion: "combobox-live-v32-proof-plan-v1";
  status: "draft antecedent; pending separate authorization; live execution forbidden";
  target: typeof COMBOBOX_LIVE_V32_TARGET;
  namespace: typeof COMBOBOX_FIGMA_NAMESPACE;
  writer: {
    programPath: string;
    programBytes: number;
    programSha256: string;
    runIdentity: string;
    pageName: string;
  };
  sources: Array<{
    source: "mui" | "antd";
    adapterIdentity: string;
    recipeHash: string;
    envelopeHash: string;
    comboboxExpectedScenePlan: {
      path: string;
      bytes: number;
      sha256: string;
      uncompressedBytes: number;
      uncompressedSha256: string;
      facts: number;
    };
    optionExpectedScenePlan: {
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
    cells: 72;
    requests: 72;
    cellsPerRequest: 1;
    sha256: string;
  };
  requests: {
    remote: 77;
    mainLane: 76;
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
  overallComboboxSuccess: false;
}

const requireSet = (root: IRNode, role: string) => {
  if (root.kind !== "frame")
    throw new TypeError("combobox expected-plan requires library frame");
  const found = root.children.find((child) => child.role === role);
  if (!found || found.kind !== "component-set")
    throw new TypeError(`combobox expected-plan missing ${role}`);
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
      source: "mui" as const,
      adapterIdentity: "material-combobox-reviewed-v1",
      displayName: "Material Autocomplete",
      reviewed: muiComboboxSource,
      config: muiComboboxAdapterConfig,
    },
    {
      source: "antd" as const,
      adapterIdentity: "commerce-combobox-reviewed-v1",
      displayName: "Commerce Select",
      reviewed: antdComboboxSource,
      config: antdComboboxAdapterConfig,
    },
  ].map((descriptor) => {
    const instance = adaptReviewedCombobox(descriptor.reviewed, descriptor.config);
    const envelope = compileComboboxRecipe(instance);
    const comboboxSet = requireSet(envelope.ir, "combobox/set");
    const optionSet = requireSet(envelope.ir, "combobox/option-set");
    const comboboxPlan = applyOccupancyTeachings(
      compileExpectedScenePlan(comboboxSet, { rootOwnershipKey: "combobox" }),
      comboboxSet,
      "combobox",
    );
    const optionPlan = applyOccupancyTeachings(
      compileExpectedScenePlan(optionSet, { rootOwnershipKey: "option" }),
      optionSet,
      "option",
    );
    return {
      ...descriptor,
      instance,
      envelope,
      recipeHash: hashRecipeInstance(comboboxRecipe, instance),
      comboboxPlan,
      optionPlan,
    };
  });

const captureCells = (
  sources: ReturnType<typeof sourceDescriptors>,
): ComboboxLiveV32CaptureCell[] => {
  const cells: ComboboxLiveV32CaptureCell[] = [];
  for (const source of sources) {
    const small = source.instance.tokens.sizes.small;
    const medium = source.instance.tokens.sizes.medium;
    const heightFor = (size: "small" | "medium") => {
      const tokens = size === "small" ? small : medium;
      return (
        tokens.labelLineHeight.fallback +
        tokens.stackGap.fallback +
        tokens.triggerHeight.fallback +
        tokens.stackGap.fallback +
        tokens.helperLineHeight.fallback +
        48
      );
    };
    for (const size of COMBOBOX_SIZES)
      for (const appearance of COMBOBOX_APPEARANCES)
        for (const state of COMBOBOX_FIELD_STATES)
          for (const content of COMBOBOX_CONTENT) {
            cells.push({
              index: cells.length,
              cellKey: [
                source.source,
                "combobox",
                size,
                appearance,
                "false",
                state,
                content,
              ].join("/"),
              source: source.source,
              adapterIdentity: source.adapterIdentity,
              kind: "combobox",
              axes: {
                Size: size,
                Appearance: appearance,
                Open: "false",
                "Field state": state,
                Content: content,
              },
              strata: { source: source.source, kind: "combobox", size },
              frame: {
                width: source.instance.tokens.sizes[size].width.fallback + 80,
                height: heightFor(size),
              },
            });
          }
    for (const size of COMBOBOX_SIZES)
      for (const state of ["default", "selected"] as const) {
        if (!COMBOBOX_OPTION_STATES.includes(state))
          throw new TypeError("capture option state is not named from source");
        cells.push({
          index: cells.length,
          cellKey: [source.source, "option", size, state].join("/"),
          source: source.source,
          adapterIdentity: source.adapterIdentity,
          kind: "option",
          axes: { Size: size, "Option state": state },
          strata: { source: source.source, kind: "option", size },
          frame: {
            width: source.instance.tokens.sizes[size].width.fallback + 80,
            height: source.instance.tokens.sizes[size].optionHeight.fallback + 48,
          },
        });
      }
  }
  if (cells.length !== COMBOBOX_LIVE_V32_CAPTURE_COUNT)
    throw new Error(
      `Combobox live v32 capture cells ${cells.length}, expected ${COMBOBOX_LIVE_V32_CAPTURE_COUNT}`,
    );
  comboboxLiveV5CaptureManifestSha256(cells);
  return cells;
};

const protocol = (expectedFacts: number) => ({
  artifactVersion: "combobox-live-v32-external-operator-protocol-v1",
  protocolId: "combobox-live-v32",
  status:
    "draft antecedent; pending separate authorization; live execution forbidden",
  lifecycle: {
    executionAntecedentImmutable: true,
    authorizationAddedOnlyAfterAntecedentCommit: true,
    authorizationExcludedFromAntecedentFreshness: true,
    laterAuthorizationDoesNotRecomputeAntecedent: true,
    inputV85AuthorizationReusable: false,
    comboboxLiveV1AuthorizationReusable: false,
    comboboxLiveV2AuthorizationReusable: false,
    comboboxLiveV3AuthorizationReusable: false,
    comboboxLiveV4AuthorizationReusable: false,
    comboboxLiveV5AuthorizationReusable: false,
    comboboxLiveV6AuthorizationReusable: false,
    comboboxLiveV7AuthorizationReusable: false,
    comboboxLiveV8AuthorizationReusable: false,
    comboboxLiveV9AuthorizationReusable: false,
    comboboxLiveV10AuthorizationReusable: false,
    comboboxLiveV11AuthorizationReusable: false,
    comboboxLiveV12AuthorizationReusable: false,
    comboboxLiveV13AuthorizationReusable: false,
    comboboxLiveV14AuthorizationReusable: false,
    comboboxLiveV15AuthorizationReusable: false,
    comboboxLiveV16AuthorizationReusable: false,
    comboboxLiveV17AuthorizationReusable: false,
    comboboxLiveV18AuthorizationReusable: false,
    comboboxLiveV19AuthorizationReusable: false,
    comboboxLiveV26AuthorizationReusable: false,
    comboboxLiveV27AuthorizationReusable: false,
    comboboxLiveV28AuthorizationReusable: false,
    comboboxLiveV29AuthorizationReusable: false,
    comboboxLiveV30AuthorizationReusable: false,
    comboboxLiveV31AuthorizationReusable: false,
    inputRunIdentityForbidden: true,
    inputPage115295378Forbidden: true,
  },
  teaching: {
    restoreInputOnlyFromComboboxSet: true,
    restoreOptionLabelOnlyFromOptionSet: true,
    ownedFillTexts: 144,
    nestedOpenListboxOptionLabelsAreNotOwned: true,
    extractSetRootOmitsEnvelopeHash: true,
    ignoreCopiedOwnershipKeyInsideOwnedInstance: true,
    hostOmitsEmptyInstancePayload: true,
    observeSceneFactsProjectsLiveRootOwnershipKey: true,
    hostRecoversRecipeComponentRef: true,
    writerStampsOptionInstanceAriaProperties: true,
    hostRecoversComponentPropertyNameBeforeHash: true,
    hostOrdersTriggerBindingsToCompileFieldOrder: true,
    hostOrdersLeadingSlotBindingsToCompileFieldOrder: true,
    hostEmitsCompileCarriedLeadingSlotVisibleTrue: true,
    hostOrdersTrailingSlotBindingsToCompileFieldOrder: true,
    hostEmitsCompileCarriedTrailingSlotVisibleTrue: true,
    hostOmitsEmptyTriggerEffects: true,
    hostOrdersOverlayBindingsToCompileFieldOrder: true,
    hostAliasesOverlayWidthValueToLayoutWidthValue: true,
    hostOrdersListboxBindingsToCompileFieldOrder: true,
    hostDropsExtraOptionInstanceBindings: true,
    hostOmitsInheritedOptionInstanceFills: true,
    hostOmitsEmptyListboxStrokes: true,
    hostOmitsEmptyOverlayStrokeDashPattern: true,
    hostOmitsSetRootClipsContent: true,
    hostOrdersOptionBindingsToCompileFieldOrder: true,
    hostAliasesOptionHeightValueToLayoutHeightValue: true,
    hostOmitsOptionClipsContent: true,
    hostOrdersSelectedIndicatorBindingsToCompileFieldOrder: true,
    hostEmitsCompileCarriedSelectedIndicatorVisibleTrue: true,
  },
  inheritedFromInput: {
    roleFirstSegment: true,
    uniformPerSideStrokeWeight: true,
    slotSolidFills0Color: true,
    hiddenFillOccupancyVisibleTrueOpacity0: true,
    compileOmitsVisibleFalseOnOccupancyPlaceholders: true,
    expectedPlanOccupancyOpacity0: true,
    collapseMustNotInventDefaultOpacity1: true,
    probeExcludesOpacityZeroOccupancyOverlap: true,
    overlayExcludedFromVariantAabb: true,
    omitTextExtrasUnlessSourceHasThem: true,
    setLayoutCompileCarryAfterFirstMeasure: true,
    inventSetHugFixedPadding0Forbidden: true,
    surfaceDashPatternOmit: true,
    variantEffectsStrokesOmitAsTaught: true,
    cleanupOnFailureOnly: true,
    inventPolar9300Forbidden: true,
    inventPolarContentRowForbidden: true,
    inventOverlapZeroForbidden: true,
  },
  identity: {
    namespace: COMBOBOX_FIGMA_NAMESPACE,
    writerPath: "recipe/combobox-figma-writer.ts",
    forbiddenNamespace: FORBIDDEN_INPUT_NAMESPACE,
    forbiddenRunIdentity: FORBIDDEN_INPUT_RUN_IDENTITY,
    forbiddenPageId: FORBIDDEN_INPUT_PAGE_ID,
  },
  target: COMBOBOX_LIVE_V32_TARGET,
  expectedDynamicTool: COMBOBOX_LIVE_V32_DYNAMIC_TOOL,
  denominator: {
    sourceRoots: COMBOBOX_LIVE_V32_SOURCE_ROOTS,
    sets: 4,
    variants: COMBOBOX_LIVE_V32_VARIANT_COUNT,
    captureCells: COMBOBOX_LIVE_V32_CAPTURE_COUNT,
    remoteRequests: COMBOBOX_LIVE_V32_REMOTE_REQUESTS,
    hostPhases: COMBOBOX_LIVE_V32_HOST_PHASES,
    expectedSceneFacts: expectedFacts,
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

export async function buildComboboxLiveV32Proof(
  check = process.argv.includes("--check"),
): Promise<ComboboxLiveV32ProofPlan> {
  const sources = sourceDescriptors();
  const writer = emitComboboxFigmaWriter(
    sources.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      recipeHash: source.recipeHash,
      envelope: source.envelope,
    })),
  );
  if (
    writer.namespace !== COMBOBOX_FIGMA_NAMESPACE ||
    writer.namespace === FORBIDDEN_INPUT_NAMESPACE ||
    writer.runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    writer.pageName.includes(FORBIDDEN_INPUT_PAGE_ID)
  )
    throw new Error("Combobox live v32 writer reused Input identity");
  const captures = captureCells(sources);
  const writerProgram = Buffer.from(writer.code);
  const writerOwnershipBlueprint: ComboboxLiveV32WriterOwnership = {
    pageId: "__WRITER_PAGE_ID__",
    pageName: writer.pageName,
    runIdentity: writer.runIdentity,
    namespace: writer.namespace,
    setIds: [
      "__MUI_COMBOBOX_SET_ID__",
      "__MUI_OPTION_SET_ID__",
      "__ANTD_COMBOBOX_SET_ID__",
      "__ANTD_OPTION_SET_ID__",
    ],
    sectionIds: ["__MUI_SECTION_ID__", "__ANTD_SECTION_ID__"],
    collectionIds: ["__MUI_COLLECTION_ID__", "__ANTD_COLLECTION_ID__"],
    createdNodeIds: ["__WRITER_CREATED_NODE_IDS__"],
    sources: sources.map((source, index) => ({
      adapterIdentity: source.adapterIdentity,
      comboboxSetId:
        index === 0 ? "__MUI_COMBOBOX_SET_ID__" : "__ANTD_COMBOBOX_SET_ID__",
      optionSetId:
        index === 0 ? "__MUI_OPTION_SET_ID__" : "__ANTD_OPTION_SET_ID__",
      sectionId: index === 0 ? "__MUI_SECTION_ID__" : "__ANTD_SECTION_ID__",
      collectionId:
        index === 0 ? "__MUI_COLLECTION_ID__" : "__ANTD_COLLECTION_ID__",
      variableCount: source.comboboxPlan.facts.filter(
        (fact) => fact.channel === "binding",
      ).length,
      variantCount: 72,
      comboboxCells: 64,
      optionCells: 8,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelope.integrity.canonicalHash,
    })),
    counts: { sources: 2, variants: 144, collections: 2, sets: 4, nodes: 1 },
  };
  const identities: ComboboxLiveV32SourceIdentity[] = sources.map((source) => ({
    source: source.source,
    adapterIdentity: source.adapterIdentity,
    recipeHash: source.recipeHash,
    envelopeHash: source.envelope.integrity.canonicalHash,
    comboboxExpectedScenePlan: source.comboboxPlan,
    optionExpectedScenePlan: source.optionPlan,
  }));
  const restoreBlueprint = Buffer.from(
    buildComboboxLiveV32RestoreProgram(writerOwnershipBlueprint),
  );
  const extractBlueprint = Buffer.from(
    buildComboboxLiveV32ExtractProgram(writerOwnershipBlueprint, identities),
  );
  const probeBlueprint = Buffer.from(
    buildComboboxLiveV32ProbeProgram(writerOwnershipBlueprint, identities),
  );
  const captureBlueprint = Buffer.from(
    buildComboboxLiveV32CaptureProgram(writerOwnershipBlueprint, captures[0]!),
  );
  const cleanupBlueprint = Buffer.from(
    buildComboboxLiveV32CleanupProgram(writerOwnershipBlueprint),
  );

  const antecedentOutputs = new Map<string, Buffer>();
  const sourceMetadata = sources.map((source) => {
    const comboboxBytes = Buffer.from(`${JSON.stringify(source.comboboxPlan)}\n`);
    const optionBytes = Buffer.from(`${JSON.stringify(source.optionPlan)}\n`);
    const comboboxCompressed = gzipSync(comboboxBytes);
    const optionCompressed = gzipSync(optionBytes);
    const comboboxPath = `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/expected-scene-plan-${source.source}-combobox.json.gz`;
    const optionPath = `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/expected-scene-plan-${source.source}-option.json.gz`;
    antecedentOutputs.set(comboboxPath, comboboxCompressed);
    antecedentOutputs.set(optionPath, optionCompressed);
    return {
      source: source.source,
      adapterIdentity: source.adapterIdentity,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelope.integrity.canonicalHash,
      comboboxExpectedScenePlan: {
        path: comboboxPath,
        bytes: comboboxCompressed.byteLength,
        sha256: sha256(comboboxCompressed),
        uncompressedBytes: comboboxBytes.byteLength,
        uncompressedSha256: sha256(comboboxBytes),
        facts: source.comboboxPlan.facts.length,
      },
      optionExpectedScenePlan: {
        path: optionPath,
        bytes: optionCompressed.byteLength,
        sha256: sha256(optionCompressed),
        uncompressedBytes: optionBytes.byteLength,
        uncompressedSha256: sha256(optionBytes),
        facts: source.optionPlan.facts.length,
      },
    };
  });
  const expectedFacts = sourceMetadata.reduce(
    (sum, source) =>
      sum +
      source.comboboxExpectedScenePlan.facts +
      source.optionExpectedScenePlan.facts,
    0,
  );

  antecedentOutputs.set(
    COMBOBOX_LIVE_V32_PROTOCOL_PATH,
    jsonBytes(protocol(expectedFacts)),
  );
  antecedentOutputs.set(
    `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/programs/writer.txt`,
    writerProgram,
  );
  antecedentOutputs.set(
    `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/programs/restore-blueprint.js`,
    restoreBlueprint,
  );
  antecedentOutputs.set(
    `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/programs/extract-blueprint.js`,
    extractBlueprint,
  );
  antecedentOutputs.set(
    `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/programs/probe-blueprint.js`,
    probeBlueprint,
  );
  antecedentOutputs.set(
    `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/programs/capture-blueprint.js`,
    captureBlueprint,
  );
  antecedentOutputs.set(
    `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/programs/cleanup-blueprint.js`,
    cleanupBlueprint,
  );

  const captureManifest = {
    artifactVersion: "combobox-live-v32-capture-manifest-v1",
    status: "planned only; authorization and capture pending",
    transport: {
      encoding: "one PNG base64 payload per signed response",
      cellsPerRequest: 1,
      requests: 72,
      rejectTruncationDuplicatesMissing: true,
      sampleReduction: false,
      legacyVisualComparison: false,
    },
    cells: captures,
    cellsSha256: comboboxLiveV5CaptureManifestSha256(captures),
  };
  const captureManifestBytes = jsonBytes(captureManifest);
  antecedentOutputs.set(
    COMBOBOX_LIVE_V32_CAPTURE_MANIFEST_PATH,
    captureManifestBytes,
  );

  const proofPlan: ComboboxLiveV32ProofPlan = {
    artifactVersion: "combobox-live-v32-proof-plan-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    target: COMBOBOX_LIVE_V32_TARGET,
    namespace: COMBOBOX_FIGMA_NAMESPACE,
    writer: {
      programPath: `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/programs/writer.txt`,
      programBytes: writerProgram.byteLength,
      programSha256: sha256(writerProgram),
      runIdentity: writer.runIdentity,
      pageName: writer.pageName,
    },
    sources: sourceMetadata,
    captureManifest: {
      path: COMBOBOX_LIVE_V32_CAPTURE_MANIFEST_PATH,
      cells: 72,
      requests: 72,
      cellsPerRequest: 1,
      sha256: sha256(captureManifestBytes),
    },
    requests: {
      remote: 77,
      mainLane: 76,
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
    overallComboboxSuccess: false,
  };
  antecedentOutputs.set(COMBOBOX_LIVE_V32_PLAN_PATH, jsonBytes(proofPlan));

  const requests = {
    artifactVersion: "combobox-live-v32-request-manifest-v1",
    expectedDynamicTool: COMBOBOX_LIVE_V32_DYNAMIC_TOOL,
    target: COMBOBOX_LIVE_V32_TARGET,
    signedAtRuntime: true,
    requestCount: 77,
    requests: [
      {
        requestId: "writer",
        sequence: comboboxLiveV5RequestSequence("writer"),
        phase: "writer",
      },
      {
        requestId: "cleanup",
        sequence: comboboxLiveV5RequestSequence("cleanup"),
        phase: "cleanup",
        availability: "persisted immediately after writer acceptance",
      },
      {
        requestId: "restore",
        sequence: comboboxLiveV5RequestSequence("restore"),
        phase: "restore",
      },
      {
        requestId: "extract",
        sequence: comboboxLiveV5RequestSequence("extract"),
        phase: "extract",
      },
      {
        requestId: "probe",
        sequence: comboboxLiveV5RequestSequence("probe"),
        phase: "probe",
      },
      ...captures.map((cell) => ({
        requestId: `capture-${String(cell.index).padStart(3, "0")}`,
        sequence: comboboxLiveV5RequestSequence("capture", cell.index),
        phase: "capture",
        captureIndex: cell.index,
        cellKey: cell.cellKey,
      })),
    ],
  };
  if (requests.requestCount !== COMBOBOX_LIVE_V32_REMOTE_REQUESTS)
    throw new Error("Combobox live v32 remote request denominator drifted");
  antecedentOutputs.set(
    COMBOBOX_LIVE_V32_REQUEST_MANIFEST_PATH,
    jsonBytes(requests),
  );

  const lifecycleExcludedPaths = [
    COMBOBOX_LIVE_V32_AUTHORIZATION_TEMPLATE_PATH,
    COMBOBOX_LIVE_V32_AUTHORIZATION_PATH,
    "recipe/combobox-live-v32-authorization.ts",
    "recipe/combobox-live-v32-authorization.test.ts",
    "recipe/combobox-live-v32-preflight.ts",
    "recipe/combobox-live-v32-authorized.ts",
    "recipe/write-combobox-live-v32-authorization.ts",
    "recipe/create-combobox-live-v32-security-attestation.ts",
    "recipe/evidence/combobox-live-pivot-v32/operator-security-attestation-template.json",
    "recipe/evidence/combobox-live-pivot-v32-status.json",
    "recipe/evidence/status-index.json",
  ];
  const indexedPaths = [
    ...antecedentOutputs.keys(),
    "recipe/combobox-live-v32-broker.ts",
    "recipe/combobox-live-v32-contract.ts",
    "recipe/combobox-live-v32-restore.ts",
    "recipe/combobox-live-v32-cleanup.ts",
    "recipe/combobox-live-v32-verifier.ts",
    "recipe/combobox-live-v32-fixed-point.ts",
    "recipe/run-combobox-live-v32.ts",
    "recipe/build-combobox-live-proof-v32.ts",
    "recipe/combobox-live-v32-lifecycle-simulation.ts",
    "recipe/scene-readback-combobox-v32.ts",
    "recipe/scene-readback-runtime-combobox-v32.ts",
    "recipe/combobox-figma-writer.ts",
    "recipe/figma-property-normalizer-v8.ts",
    "recipe/figma-runtime-portability.ts",
    "recipe/normalize.ts",
  ].filter((artifactPath) => artifactPath !== COMBOBOX_LIVE_V32_INDEX_PATH);
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
    artifactVersion: "combobox-live-v32-antecedent-index-v1",
    status:
      "draft antecedent; pending separate authorization; live execution forbidden",
    artifacts: indexedArtifacts,
    hashSetSha256,
    counts: {
      sources: 2,
      variants: COMBOBOX_LIVE_V32_VARIANT_COUNT,
      expectedSceneFacts: expectedFacts,
      captureCells: COMBOBOX_LIVE_V32_CAPTURE_COUNT,
      remoteRequests: COMBOBOX_LIVE_V32_REMOTE_REQUESTS,
      hostPhases: COMBOBOX_LIVE_V32_HOST_PHASES,
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
    overallComboboxSuccess: false,
  };
  antecedentOutputs.set(COMBOBOX_LIVE_V32_INDEX_PATH, jsonBytes(index));

  const authorizationTemplate = {
    artifactVersion: "combobox-live-v32-authorization-template-v1",
    authorizationId: "combobox-live-v32",
    status: "template only; no authorization",
    authorizationIntent: false,
    antecedent: {
      commit: null,
      indexPath: COMBOBOX_LIVE_V32_INDEX_PATH,
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
      target: COMBOBOX_LIVE_V32_TARGET,
      expectedDynamicTool: COMBOBOX_LIVE_V32_DYNAMIC_TOOL,
      externalOperatorOnly: true,
      oneMcpCallPerSignedRequest: true,
    },
    denominator: {
      remoteRequests: COMBOBOX_LIVE_V32_REMOTE_REQUESTS,
      hostPhases: COMBOBOX_LIVE_V32_HOST_PHASES,
      captures: COMBOBOX_LIVE_V32_CAPTURE_COUNT,
      sourceRoots: COMBOBOX_LIVE_V32_SOURCE_ROOTS,
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
      comboboxLiveV1AuthorizationReusable: false,
      comboboxLiveV2AuthorizationReusable: false,
      comboboxLiveV3AuthorizationReusable: false,
    comboboxLiveV4AuthorizationReusable: false,
      comboboxLiveV5AuthorizationReusable: false,
      comboboxLiveV6AuthorizationReusable: false,
      comboboxLiveV7AuthorizationReusable: false,
      comboboxLiveV8AuthorizationReusable: false,
      comboboxLiveV9AuthorizationReusable: false,
      comboboxLiveV10AuthorizationReusable: false,
      comboboxLiveV11AuthorizationReusable: false,
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
    artifactVersion: "combobox-live-v32-operator-security-attestation-template-v1",
    status: "template only; complete privately after PREPARE+AUTHORIZE",
    tokenValuesForbidden: true,
    privateDirectory: "private/combobox-live-v32-security-attestation.json",
  });

  if (check) {
    const drift = [...antecedentOutputs].flatMap(([outputPath, expected]) =>
      !existsSync(outputPath) || !readFileSync(outputPath).equals(expected)
        ? [outputPath]
        : [],
    );
    if (drift.length)
      throw new Error(
        `Combobox live v32 antecedent generated artifact drift:\n${drift.join("\n")}`,
      );
  } else {
    for (const [outputPath, value] of antecedentOutputs) {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, value);
    }
    mkdirSync(path.dirname(COMBOBOX_LIVE_V32_AUTHORIZATION_TEMPLATE_PATH), {
      recursive: true,
    });
    writeFileSync(COMBOBOX_LIVE_V32_AUTHORIZATION_TEMPLATE_PATH, templateBytes);
    writeFileSync(
      `${COMBOBOX_LIVE_V32_EVIDENCE_ROOT}/operator-security-attestation-template.json`,
      attestationTemplate,
    );
  }
  if (process.argv.includes("--check-authorization-template")) {
    if (
      !existsSync(COMBOBOX_LIVE_V32_AUTHORIZATION_TEMPLATE_PATH) ||
      !readFileSync(COMBOBOX_LIVE_V32_AUTHORIZATION_TEMPLATE_PATH).equals(
        templateBytes,
      )
    )
      throw new Error("Combobox live v32 authorization template drift");
  }
  if (
    writer.namespace !== COMBOBOX_FIGMA_NAMESPACE ||
    writer.namespace === FORBIDDEN_INPUT_NAMESPACE ||
    writer.runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY ||
    !writerProgram.toString("utf8").includes("COMBOBOX-INPUT-IDENTITY-REUSE") ||
    protocol(expectedFacts).execution.cleanupOnFailureOnly !== true
  )
    throw new Error("Combobox live v32 identity or cleanup invariant failed");
  return proofPlan;
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? "")}`)
  process.stdout.write(
    `${JSON.stringify(await buildComboboxLiveV32Proof(), null, 2)}\n`,
  );
