import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import {
  createStagedWriterTransportWrapper,
  type WriterTransportEnvelope,
} from "./writer-transport.js";

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const EVIDENCE_DIR = "recipe/evidence/button-live-pivot-v5";
const ENVELOPE_PATH = `${EVIDENCE_DIR}/transport-envelope.json`;
const PLAN_PATH = `${EVIDENCE_DIR}/writer-plan.json`;
const STAGED_WRAPPER_PATH = `${EVIDENCE_DIR}/writer-staged-wrapper.txt`;
const ATTEMPT_PATH = `${EVIDENCE_DIR}/live-attempt-6.json`;
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
// 9229 is inside the plugin's 9223-9232 scan range and free while the
// interactive MCP instance holds 9230. Attempts 2-3 measured that LARGE
// (57KB) evals through this channel crawl while small evals stay fast, so
// attempt 4 stages the payload in small exact-byte chunks and triggers the
// STAGED wrapper (v3 precedent: recipe/build-button-live-proof-v3.ts) whose
// own message stays small. Byte integrity is enforced end-to-end by the
// wrapper's length + SHA-256 + strict-UTF-8 checks, which fail closed.
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9229);
const CHUNK_SIZE = 8_000;
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const plan = JSON.parse(readFileSync(PLAN_PATH, "utf8")) as Record<string, any>;
const envelope = JSON.parse(
  readFileSync(ENVELOPE_PATH, "utf8"),
) as WriterTransportEnvelope;
if (
  envelope.payloadBytes !== plan.transport.payloadBytes ||
  envelope.payloadSha256 !== plan.transport.payloadSha256
) {
  throw new Error("v5 envelope differs from the generated plan");
}
const stagedWrapper = createStagedWriterTransportWrapper(envelope);
writeFileSync(STAGED_WRAPPER_PATH, stagedWrapper);

const { FigmaWebSocketServer } = (await import(
  `${BRIDGE_ROOT}/websocket-server.js`
)) as any;
const { WebSocketConnector } = (await import(
  `${BRIDGE_ROOT}/websocket-connector.js`
)) as any;
const server = new FigmaWebSocketServer({ port: PORT, host: "localhost" });
let attempt: Record<string, any> = {
  version: 5,
  attempt: 6,
  target: {
    fileKey: FILE_KEY,
    fileName: "Scratch Project",
    editorType: "figma",
  },
  transportChannel:
    "staged-chunks (exact bytes from disk) + staged wrapper; v3 precedent",
  payloadBytes: envelope.payloadBytes,
  payloadSha256: envelope.payloadSha256,
  stagedWrapperPath: STAGED_WRAPPER_PATH,
  stagedWrapperBytes: Buffer.byteLength(stagedWrapper),
  stagedWrapperSha256: sha256(stagedWrapper),
  chunks: Math.ceil(envelope.payload.length / CHUNK_SIZE),
  evalBegan: false,
};
try {
  await server.start();
  const deadline = Date.now() + 120_000;
  while (
    Date.now() < deadline &&
    !server
      .getConnectedFiles()
      .some((file: { fileKey: string }) => file.fileKey === FILE_KEY)
  ) {
    await sleep(250);
  }
  if (
    !server
      .getConnectedFiles()
      .some(
        (file: { fileKey: string; fileName: string }) =>
          file.fileKey === FILE_KEY && file.fileName === "Scratch Project",
      )
  ) {
    throw new Error("Scratch Project bridge did not connect");
  }
  const connector = new WebSocketConnector(server);
  await connector.initialize();
  const censusCode = `
if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("WRONG-TARGET");
await figma.loadAllPagesAsync();
const collections=await figma.variables.getLocalVariableCollectionsAsync();
const variables=await figma.variables.getLocalVariablesAsync();
return {fileKey:figma.fileKey,fileName:figma.root.name,editorType:figma.editorType,pageCount:figma.root.children.length,totalTopLevelNodes:figma.root.children.reduce((sum,page)=>sum+page.children.length,0),proofPageMatches:figma.root.children.filter(page=>page.name==="${plan.pageName}").length,collectionCount:collections.length,totalLocalVariables:variables.length,matchingCollections:collections.filter(collection=>collection.name.includes("${plan.runIdentity}")).length};
`;
  const preflight = await connector.executeCodeViaUI(
    censusCode,
    20_000,
    FILE_KEY,
  );
  if (!preflight?.success) {
    throw new Error(preflight?.error ?? "v5 census failed");
  }
  attempt.before = preflight.result;
  if (
    preflight.result.proofPageMatches !== 0 ||
    preflight.result.matchingCollections !== 0
  ) {
    throw new Error("v5 proof artifacts already exist");
  }
  const reset = await connector.executeCodeViaUI(
    `globalThis.__recipeTransportV3Payload="";return {staged:0};`,
    15_000,
    FILE_KEY,
  );
  if (!reset?.success) throw new Error(reset?.error ?? "v5 stage reset failed");
  let staged = 0;
  for (let offset = 0; offset < envelope.payload.length; offset += CHUNK_SIZE) {
    const chunk = envelope.payload.slice(offset, offset + CHUNK_SIZE);
    const response = await connector.executeCodeViaUI(
      `globalThis.__recipeTransportV3Payload+=${JSON.stringify(chunk)};return {staged:globalThis.__recipeTransportV3Payload.length};`,
      15_000,
      FILE_KEY,
    );
    if (!response?.success) {
      throw new Error(response?.error ?? `v5 stage chunk @${offset} failed`);
    }
    staged = response.result.staged;
  }
  attempt.stagedLength = staged;
  if (staged !== envelope.payload.length) {
    throw new Error(
      `v5 staged payload length ${staged} !== ${envelope.payload.length}`,
    );
  }
  const response = await connector.executeCodeViaUI(
    stagedWrapper,
    300_000,
    FILE_KEY,
  );
  attempt.bridgeResult = response;
  const transport = response?.result?.transport;
  attempt.evalBegan = transport?.evalBegan === true;
  attempt.evalCompleted = transport?.evalCompleted === true;
  attempt.decodedBytes = transport?.decodedBytes;
  attempt.decodedSha256 = transport?.decodedSha256;
  attempt.hashImplementation = transport?.hashImplementation;
  attempt.utf8Implementation = transport?.utf8Implementation;
  if (!response?.success || !attempt.evalCompleted) {
    throw new Error(response?.error ?? "v5 writer did not complete");
  }
} catch (error) {
  attempt.error = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  writeFileSync(ATTEMPT_PATH, `${JSON.stringify(attempt, null, 2)}\n`);
  await server.stop();
}
console.log(
  JSON.stringify({
    before: attempt.before,
    stagedLength: attempt.stagedLength,
    evalBegan: attempt.evalBegan,
    evalCompleted: attempt.evalCompleted,
    decodedBytes: attempt.decodedBytes,
    decodedSha256: attempt.decodedSha256,
    result: attempt.bridgeResult.result.result,
  }),
);
