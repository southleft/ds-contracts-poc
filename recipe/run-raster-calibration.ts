import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { PNG } from "pngjs";

import { canonicalJson } from "./normalize.js";
import {
  RECIPE_RASTER_CALIBRATION_CORPUS,
  RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
  RECIPE_RASTER_CALIBRATION_VERSION,
  RECIPE_RASTER_METRIC,
  RECIPE_RASTER_METRIC_HASH,
  assertCalibrationFontsAvailable,
  calibrationArtifactHash,
  deriveRasterCalibration,
  evaluateHeldOutCalibration,
  measureCalibrationPair,
  type CalibrationRender,
} from "./raster-calibration.js";
import { renderCalibrationCorpusInBrowser } from "./raster-calibration-browser.js";
import {
  RECIPE_RASTER_CALIBRATION_PAGE,
  emitCalibrationFigmaWriter,
} from "./raster-calibration-figma-writer.js";
import { createWriterTransportArtifact } from "./writer-transport.js";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const ROOT = "recipe/evidence/raster-calibration-v1";
const ABSOLUTE_ROOT = path.join(REPO, ROOT);
const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const FILE_NAME = "Scratch Project";
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const stableJson = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

interface BridgeExecution {
  label: string;
  writerPath: string;
  wrapperPath: string;
  envelopePath: string;
  writerBytes: number;
  writerSha256: string;
  wrapperBytes: number;
  wrapperSha256: string;
  decodedBytes: number;
  decodedSha256: string;
  result: Record<string, any>;
}

const stateCode = `
if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="${FILE_NAME}"||figma.editorType!=="figma")throw new Error("CALIBRATION-WRONG-TARGET");
await figma.loadAllPagesAsync();
const pages=figma.root.children.map(page=>({id:page.id,name:page.name,topLevelNodeIds:page.children.map(node=>node.id)}));
const collections=(await figma.variables.getLocalVariableCollectionsAsync()).map(collection=>({id:collection.id,name:collection.name,variableIds:[...collection.variableIds]})).sort((a,b)=>a.id.localeCompare(b.id));
return{fileKey:figma.fileKey,fileName:figma.root.name,editorType:figma.editorType,pages,collections,matchingCalibrationPages:pages.filter(page=>page.name===${JSON.stringify(RECIPE_RASTER_CALIBRATION_PAGE)}).length};
`;

const cleanupCode = `
if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="${FILE_NAME}"||figma.editorType!=="figma")throw new Error("CALIBRATION-WRONG-TARGET");
await figma.loadAllPagesAsync();
const matches=figma.root.children.filter(page=>page.name===${JSON.stringify(RECIPE_RASTER_CALIBRATION_PAGE)});
if(matches.length>1)throw new Error("CALIBRATION-CLEANUP-AMBIGUOUS:"+matches.length);
if(matches.includes(figma.currentPage)){const safe=figma.root.children.find(page=>!matches.includes(page));if(!safe)throw new Error("CALIBRATION-CLEANUP-NO-SAFE-PAGE");await figma.setCurrentPageAsync(safe);}
const removedPageIds=[];
for(const page of matches){removedPageIds.push(page.id);page.remove();}
return{removedPageIds,removedCollectionIds:[]};
`;

const treeSnapshot = (root: string) => {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) files.push(target);
    }
  };
  visit(path.join(REPO, root));
  files.sort();
  const aggregate = createHash("sha256");
  let bytes = 0;
  for (const file of files) {
    const contents = readFileSync(file);
    aggregate.update(path.relative(path.join(REPO, root), file));
    aggregate.update("\0");
    aggregate.update(sha256(contents));
    aggregate.update("\0");
    bytes += statSync(file).size;
  }
  return {
    root,
    files: files.length,
    bytes,
    aggregateSha256: aggregate.digest("hex"),
  };
};

const structuralProjectionHash = (value: unknown): string =>
  sha256(canonicalJson(value));

const saveRenders = (
  kind: "browser" | "figma-baseline" | "figma-calibrated",
  renders: readonly CalibrationRender[],
): Array<{
  specimenId: string;
  split: string;
  path: string;
  bytes: number;
  sha256: string;
  root: CalibrationRender["root"];
  structureHash: string;
}> =>
  renders.map((render) => {
    const relative = `${ROOT}/captures/${kind}/${render.specimenId}.png`;
    const full = path.join(REPO, relative);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, render.png);
    return {
      specimenId: render.specimenId,
      split: render.split,
      path: relative,
      bytes: render.png.length,
      sha256: sha256(render.png),
      root: render.root,
      structureHash: render.structureHash,
    };
  });

const decodeFigmaRenders = (
  result: Record<string, any>,
): {
  renders: CalibrationRender[];
  deterministicRerun: boolean;
  frameIds: string[];
} => {
  let deterministicRerun = true;
  const frameIds: string[] = [];
  const renders = result.captures.map((capture: Record<string, any>) => {
    const png = Buffer.from(capture.base64, "base64");
    const rerun = Buffer.from(capture.rerunBase64, "base64");
    deterministicRerun &&= png.equals(rerun);
    frameIds.push(capture.frameId);
    assert.ok(PNG.sync.read(png).data.some((value) => value < 250));
    return {
      specimenId: capture.specimenId,
      split: capture.split,
      png,
      root: capture.root,
      roles: capture.roles,
      text: capture.text,
      structureHash: structuralProjectionHash(capture.structureProjection),
    } satisfies CalibrationRender;
  });
  return { renders, deterministicRerun, frameIds };
};

const subset = (
  renders: readonly CalibrationRender[],
  split: "training" | "validation",
) => renders.filter((entry) => entry.split === split);

const aggregate = (
  browser: readonly CalibrationRender[],
  figma: readonly CalibrationRender[],
  capture: { rgbLevels: number } = { rgbLevels: 256 },
) => {
  const figmaById = new Map(figma.map((entry) => [entry.specimenId, entry]));
  const rows = browser.map((entry) => ({
    specimenId: entry.specimenId,
    metrics: measureCalibrationPair(
      entry,
      figmaById.get(entry.specimenId)!,
      capture,
    ),
  }));
  return {
    count: rows.length,
    geometry:
      rows.reduce((sum, row) => sum + row.metrics.geometryError, 0) /
      rows.length,
    pixelInk:
      rows.reduce((sum, row) => sum + row.metrics.pixelInkError, 0) /
      rows.length,
    valid: rows.every((row) => row.metrics.valid),
    rows,
  };
};

const writeBridgeArtifacts = (
  label: string,
  writer: string,
): {
  writerPath: string;
  wrapperPath: string;
  envelopePath: string;
  transport: ReturnType<typeof createWriterTransportArtifact>;
} => {
  const transport = createWriterTransportArtifact(Buffer.from(writer, "utf8"));
  const writerPath = `${ROOT}/bridge/${label}.writer.js`;
  const wrapperPath = `${ROOT}/bridge/${label}.wrapper.txt`;
  const envelopePath = `${ROOT}/bridge/${label}.envelope.json`;
  mkdirSync(path.join(ABSOLUTE_ROOT, "bridge"), { recursive: true });
  writeFileSync(path.join(REPO, writerPath), writer);
  writeFileSync(path.join(REPO, wrapperPath), transport.wrapper);
  writeFileSync(path.join(REPO, envelopePath), stableJson(transport.envelope));
  return { writerPath, wrapperPath, envelopePath, transport };
};

async function run(): Promise<void> {
  const archivedFiles = [1, 2, 3].flatMap((attempt) => {
    const directory = path.join(
      ABSOLUTE_ROOT,
      `bridge/failed-attempt-${attempt}`,
    );
    return existsSync(directory)
      ? readdirSync(directory)
          .sort()
          .map((name) => ({
            relative: `bridge/failed-attempt-${attempt}/${name}`,
            bytes: readFileSync(path.join(directory, name)),
          }))
      : [];
  });
  const currentFailureFiles = [
    "bridge/00-preflight.writer.js",
    "bridge/00-preflight.wrapper.txt",
    "bridge/00-preflight.envelope.json",
    "bridge/00-stale-recovery.writer.js",
    "bridge/00-stale-recovery.wrapper.txt",
    "bridge/00-stale-recovery.envelope.json",
    "bridge/00-preflight-recovered.writer.js",
    "bridge/00-preflight-recovered.wrapper.txt",
    "bridge/00-preflight-recovered.envelope.json",
    "bridge/01-baseline.writer.js",
    "bridge/01-baseline.wrapper.txt",
    "bridge/01-baseline.envelope.json",
    "bridge/03-cleanup.writer.js",
    "bridge/03-cleanup.wrapper.txt",
    "bridge/03-cleanup.envelope.json",
    "bridge/04-postflight.writer.js",
    "bridge/04-postflight.wrapper.txt",
    "bridge/04-postflight.envelope.json",
  ]
    .map((relative) => ({
      relative,
      full: path.join(ABSOLUTE_ROOT, relative),
    }))
    .filter(({ full }) => existsSync(full))
    .map(({ relative, full }) => ({
      relative,
      bytes: readFileSync(full),
    }));
  const noPriorResult = !existsSync(path.join(ABSOLUTE_ROOT, "results.json"));
  const filesForAttempt = (attempt: number) =>
    archivedFiles.filter((file) =>
      file.relative.startsWith(`bridge/failed-attempt-${attempt}/`),
    );
  const priorAttempts = [
    ...(filesForAttempt(1).length > 0
      ? [
          {
            attempt: 1,
            result: "atomic-refusal-before-page-creation",
            error:
              "setSharedPluginData namespace contained a disallowed hyphen",
            targetPreflightPassed: true,
            pageOrNodeCreated: true,
            files: filesForAttempt(1).map(({ relative, bytes }) => ({
              path: `${ROOT}/${relative}`,
              bytes: bytes.length,
              sha256: sha256(bytes),
            })),
          },
        ]
      : []),
    ...(filesForAttempt(2).length > 0
      ? [
          {
            attempt: 2,
            result: "preflight-refusal-on-stale-calibration-page",
            error:
              "preflight found one calibration page; no new writer executed",
            targetPreflightPassed: true,
            pageOrNodeCreated: false,
            files: filesForAttempt(2).map(({ relative, bytes }) => ({
              path: `${ROOT}/${relative}`,
              bytes: bytes.length,
              sha256: sha256(bytes),
            })),
          },
        ]
      : []),
    ...(filesForAttempt(3).length > 0
      ? [
          {
            attempt: 3,
            result: "baseline-measured-then-structural-receipt-mismatch",
            error:
              "live projection omitted frame children because proxy membership was not portable",
            targetPreflightPassed: true,
            pageOrNodeCreated: true,
            files: filesForAttempt(3).map(({ relative, bytes }) => ({
              path: `${ROOT}/${relative}`,
              bytes: bytes.length,
              sha256: sha256(bytes),
            })),
          },
        ]
      : []),
    ...(currentFailureFiles.length > 0 && noPriorResult
      ? [
          {
            attempt: 4,
            result: "incomplete-calibration-execution",
            error:
              "previous run ended before deterministic results were written",
            targetPreflightPassed: true,
            pageOrNodeCreated: true,
            files: currentFailureFiles.map(({ relative, bytes }) => ({
              path: `${ROOT}/bridge/failed-attempt-4/${path.basename(relative)}`,
              bytes: bytes.length,
              sha256: sha256(bytes),
            })),
          },
        ]
      : []),
  ];
  rmSync(ABSOLUTE_ROOT, { recursive: true, force: true });
  mkdirSync(ABSOLUTE_ROOT, { recursive: true });
  for (const { relative, bytes } of archivedFiles) {
    const target = path.join(ABSOLUTE_ROOT, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  if (noPriorResult) {
    for (const { relative, bytes } of currentFailureFiles) {
      const target = path.join(
        ABSOLUTE_ROOT,
        "bridge/failed-attempt-4",
        path.basename(relative),
      );
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
  }
  const preservedBefore = [
    treeSnapshot("recipe/evidence/input-field-live-pivot-v1"),
    treeSnapshot("recipe/evidence/input-field-live-pivot-v2"),
  ];
  const browser = await renderCalibrationCorpusInBrowser();
  assert.equal(browser.renders.length, RECIPE_RASTER_CALIBRATION_CORPUS.length);
  assert.equal(browser.deterministicRerun, true);
  const browserArtifacts = saveRenders("browser", browser.renders);

  const { FigmaWebSocketServer } = (await import(
    `${BRIDGE_ROOT}/websocket-server.js`
  )) as any;
  const { WebSocketConnector } = (await import(
    `${BRIDGE_ROOT}/websocket-connector.js`
  )) as any;
  const server = new FigmaWebSocketServer({ port: PORT, host: "localhost" });
  const executions: BridgeExecution[] = [];
  let preState: Record<string, any> | undefined;
  let postState: Record<string, any> | undefined;
  let cleanup: Record<string, any> | undefined;
  let primaryError: unknown;
  const executeExact = async (
    label: string,
    code: string,
    timeout = 300_000,
  ): Promise<Record<string, any>> => {
    const artifact = writeBridgeArtifacts(label, code);
    const connector = new WebSocketConnector(server);
    await connector.initialize();
    const response = await connector.executeCodeViaUI(
      artifact.transport.wrapper,
      timeout,
      FILE_KEY,
    );
    if (!response?.success) {
      throw new Error(response?.error ?? `${label}: bridge execution failed`);
    }
    const outer = response.result as Record<string, any>;
    assert.equal(outer.transport.evalBegan, true);
    assert.equal(outer.transport.evalCompleted, true);
    assert.equal(
      outer.transport.decodedSha256,
      artifact.transport.envelope.payloadSha256,
    );
    executions.push({
      label,
      writerPath: artifact.writerPath,
      wrapperPath: artifact.wrapperPath,
      envelopePath: artifact.envelopePath,
      writerBytes: artifact.transport.envelope.payloadBytes,
      writerSha256: artifact.transport.envelope.payloadSha256,
      wrapperBytes: artifact.transport.wrapperBytes,
      wrapperSha256: artifact.transport.wrapperSha256,
      decodedBytes: outer.transport.decodedBytes,
      decodedSha256: outer.transport.decodedSha256,
      result: outer.result,
    });
    return outer.result;
  };

  try {
    await server.start();
    const deadline = Date.now() + 45_000;
    while (
      Date.now() < deadline &&
      !server
        .getConnectedFiles()
        .some((file: { fileKey: string }) => file.fileKey === FILE_KEY)
    ) {
      await sleep(250);
    }
    assert.ok(
      server
        .getConnectedFiles()
        .some((file: { fileKey: string }) => file.fileKey === FILE_KEY),
      "Scratch file did not connect to exact-byte bridge",
    );
    preState = await executeExact("00-preflight", stateCode, 60_000);
    assert.equal(preState.fileKey, FILE_KEY);
    assert.equal(preState.fileName, FILE_NAME);
    if (preState.matchingCalibrationPages === 1) {
      await executeExact("00-stale-recovery", cleanupCode, 60_000);
      preState = await executeExact(
        "00-preflight-recovered",
        stateCode,
        60_000,
      );
    }
    assert.equal(preState.matchingCalibrationPages, 0);

    const baselineWriter = emitCalibrationFigmaWriter("baseline");
    const baselineResult = await executeExact(
      "01-baseline",
      `${baselineWriter.code}\n`,
    );
    assert.equal(baselineResult.pageName, RECIPE_RASTER_CALIBRATION_PAGE);
    assertCalibrationFontsAvailable(baselineResult.availableFonts);
    const baselineDecoded = decodeFigmaRenders(baselineResult);
    assert.equal(baselineDecoded.renders.length, browser.renders.length);
    assert.equal(baselineDecoded.deterministicRerun, true);
    const baselineArtifacts = saveRenders(
      "figma-baseline",
      baselineDecoded.renders,
    );

    const calibration = deriveRasterCalibration(
      subset(browser.renders, "training"),
      subset(baselineDecoded.renders, "training"),
    );
    const calibrationHash = calibrationArtifactHash(calibration);
    writeFileSync(
      path.join(ABSOLUTE_ROOT, "candidate-calibration.json"),
      stableJson({ calibration, calibrationHash }),
    );

    const calibratedWriter = emitCalibrationFigmaWriter(
      "calibrated",
      calibration,
    );
    const calibratedResult = await executeExact(
      "02-calibrated",
      `${calibratedWriter.code}\n`,
    );
    assertCalibrationFontsAvailable(calibratedResult.availableFonts);
    const calibratedDecoded = decodeFigmaRenders(calibratedResult);
    assert.equal(calibratedDecoded.renders.length, browser.renders.length);
    assert.equal(calibratedDecoded.deterministicRerun, true);
    const calibratedArtifacts = saveRenders(
      "figma-calibrated",
      calibratedDecoded.renders,
    );

    const heldOut = evaluateHeldOutCalibration(
      subset(browser.renders, "validation"),
      subset(baselineDecoded.renders, "validation"),
      subset(calibratedDecoded.renders, "validation"),
      calibration,
    );
    const trainingBaseline = aggregate(
      subset(browser.renders, "training"),
      subset(baselineDecoded.renders, "training"),
    );
    const trainingCalibrated = aggregate(
      subset(browser.renders, "training"),
      subset(calibratedDecoded.renders, "training"),
      calibration.capture,
    );
    const results = {
      version: RECIPE_RASTER_CALIBRATION_VERSION,
      corpusHash: RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
      metric: RECIPE_RASTER_METRIC,
      metricHash: RECIPE_RASTER_METRIC_HASH,
      splitLockedBeforeMeasurement: true,
      counts: {
        corpus: RECIPE_RASTER_CALIBRATION_CORPUS.length,
        training: subset(browser.renders, "training").length,
        validation: subset(browser.renders, "validation").length,
      },
      training: {
        baseline: {
          geometry: trainingBaseline.geometry,
          pixelInk: trainingBaseline.pixelInk,
        },
        calibrated: {
          geometry: trainingCalibrated.geometry,
          pixelInk: trainingCalibrated.pixelInk,
        },
      },
      validation: heldOut,
      parameters: calibration,
      parametersHash: calibrationHash,
      decision: {
        accepted: heldOut.accepted,
        reason: heldOut.accepted
          ? "held-out geometry and pixel/ink both improved under every locked gate"
          : "held-out acceptance criteria failed; candidate calibration is rejected",
        inputV3Authorized: heldOut.accepted,
        appliedToInput: false,
      },
      deterministic: {
        browserDuplicateCaptureBytes: browser.deterministicRerun,
        figmaBaselineDuplicateExportBytes: baselineDecoded.deterministicRerun,
        figmaCalibratedDuplicateExportBytes:
          calibratedDecoded.deterministicRerun,
      },
      structuralFactsUnchanged: heldOut.structuralFactsUnchanged,
      captures: {
        browser: browserArtifacts,
        figmaBaseline: baselineArtifacts,
        figmaCalibrated: calibratedArtifacts,
      },
    };
    writeFileSync(
      path.join(ABSOLUTE_ROOT, "results.json"),
      stableJson(results),
    );
  } catch (error) {
    primaryError = error;
  } finally {
    if (preState) {
      try {
        cleanup = await executeExact("03-cleanup", cleanupCode, 60_000);
        postState = await executeExact("04-postflight", stateCode, 60_000);
      } catch (cleanupError) {
        primaryError ??= cleanupError;
      }
    }
    await server.stop();
  }

  const preservedAfter = [
    treeSnapshot("recipe/evidence/input-field-live-pivot-v1"),
    treeSnapshot("recipe/evidence/input-field-live-pivot-v2"),
  ];
  assert.deepEqual(
    preservedAfter,
    preservedBefore,
    "IMMUTABLE-INPUT-LIVE-EVIDENCE-DRIFT",
  );
  if (primaryError) throw primaryError;
  assert.ok(preState && postState && cleanup);
  assert.equal(postState.matchingCalibrationPages, 0);
  assert.deepEqual(postState, preState, "FIGMA-CALIBRATION-CLEANUP-DRIFT");

  const results = JSON.parse(
    readFileSync(path.join(ABSOLUTE_ROOT, "results.json"), "utf8"),
  ) as Record<string, any>;
  const receipt = {
    version: RECIPE_RASTER_CALIBRATION_VERSION,
    target: { fileKey: FILE_KEY, fileName: FILE_NAME, editorType: "figma" },
    sourceNeutrality: {
      originalPrimitiveIrOnly: true,
      targetReferencePixelsReadByAlgorithm: false,
      targetOutputPixelsReadByAlgorithm: false,
      sourceIdentityBranches: 0,
      componentBranches: 0,
      cellBranches: 0,
      sourceStructureAlteredForMetrics: false,
    },
    browser: {
      version: browser.browserVersion,
      executable: browser.browserExecutable,
      executableSha256: browser.browserExecutableSha256,
      viewport: { width: 600, height: 400 },
      deviceScaleFactor: 2,
      colorScheme: "light",
      background: "#ffffff",
      locale: "en-US",
      timezone: "UTC",
      fonts: browser.fontFiles,
    },
    corpus: {
      path: "recipe/raster-calibration.ts",
      hash: RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
      counts: results.counts,
      splitLockedBeforeMeasurement: true,
      families: [
        ...new Set(
          RECIPE_RASTER_CALIBRATION_CORPUS.map((entry) => entry.family),
        ),
      ].sort(),
    },
    algorithm: {
      derivation: [
        "median training-only browser/Figma text width ratio, clamped",
        "median training-only post-scale per-character spacing residual, clamped",
        "median training-only text-height ratio, clamped",
        "training-only symmetric RGB level selection under locked metric",
      ],
      writerCompensation: [
        "font-size scale",
        "line-height scale",
        "letter-spacing offset",
      ],
      captureNormalization: ["symmetric RGB quantization"],
      bounds: results.parameters.bounds,
      metricHash: RECIPE_RASTER_METRIC_HASH,
    },
    attempts: [
      ...priorAttempts,
      ...executions.map((execution) => ({
        label: execution.label,
        exactByteTransport: true,
        writer: {
          path: execution.writerPath,
          bytes: execution.writerBytes,
          sha256: execution.writerSha256,
        },
        wrapper: {
          path: execution.wrapperPath,
          bytes: execution.wrapperBytes,
          sha256: execution.wrapperSha256,
        },
        envelope: {
          path: execution.envelopePath,
          sha256: sha256(readFileSync(path.join(REPO, execution.envelopePath))),
        },
        decodedBytes: execution.decodedBytes,
        decodedSha256: execution.decodedSha256,
        pageId: execution.result.pageId ?? null,
        sectionId: execution.result.sectionId ?? null,
      })),
    ],
    figma: {
      pageName: RECIPE_RASTER_CALIBRATION_PAGE,
      cleanup,
      preState,
      postState,
      exactPrePostState: canonicalJson(preState) === canonicalJson(postState),
      retainedCalibrationPage: false,
      protectedStateUnchanged: true,
    },
    immutableInputEvidence: {
      before: preservedBefore,
      after: preservedAfter,
      exact: canonicalJson(preservedBefore) === canonicalJson(preservedAfter),
    },
    evidence: {
      results: {
        path: `${ROOT}/results.json`,
        sha256: sha256(readFileSync(path.join(ABSOLUTE_ROOT, "results.json"))),
      },
      candidateCalibration: {
        path: `${ROOT}/candidate-calibration.json`,
        sha256: sha256(
          readFileSync(path.join(ABSOLUTE_ROOT, "candidate-calibration.json")),
        ),
      },
    },
    decision: results.decision,
  };
  writeFileSync(path.join(ABSOLUTE_ROOT, "receipt.json"), stableJson(receipt));
  const index = {
    version: RECIPE_RASTER_CALIBRATION_VERSION,
    accepted: results.decision.accepted,
    inputV3Authorized: results.decision.inputV3Authorized,
    calibrationAppliedToInput: false,
    corpus: {
      count: results.counts.corpus,
      training: results.counts.training,
      validation: results.counts.validation,
      hash: RECIPE_RASTER_CALIBRATION_CORPUS_HASH,
    },
    results: {
      path: `${ROOT}/results.json`,
      sha256: sha256(readFileSync(path.join(ABSOLUTE_ROOT, "results.json"))),
    },
    receipt: {
      path: `${ROOT}/receipt.json`,
      sha256: sha256(readFileSync(path.join(ABSOLUTE_ROOT, "receipt.json"))),
    },
  };
  writeFileSync(path.join(ABSOLUTE_ROOT, "index.json"), stableJson(index));
  process.stdout.write(
    `${RECIPE_RASTER_CALIBRATION_VERSION}: ${results.decision.accepted ? "accepted" : "rejected"}; validation geometry ${results.validation.baseline.geometry} -> ${results.validation.calibrated.geometry}; pixel/ink ${results.validation.baseline.pixelInk} -> ${results.validation.calibrated.pixelInk}\n`,
  );
}

await run();
