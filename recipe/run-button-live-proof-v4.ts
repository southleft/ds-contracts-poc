import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const EVIDENCE_DIR = "recipe/evidence/button-live-pivot-v4";
const WRAPPER_PATH = `${EVIDENCE_DIR}/writer-wrapper-attempt-2.txt`;
const PLAN_PATH = `${EVIDENCE_DIR}/writer-plan.json`;
const ATTEMPT_PATH = `${EVIDENCE_DIR}/live-attempt-2.json`;
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const plan = JSON.parse(readFileSync(PLAN_PATH, "utf8")) as Record<string, any>;
const wrapper = readFileSync(WRAPPER_PATH, "utf8");
if (
  Buffer.byteLength(wrapper) !== plan.transport.wrapperBytes ||
  sha256(wrapper) !== plan.transport.wrapperSha256
) {
  throw new Error("v4 wrapper differs from the generated plan");
}

const { FigmaWebSocketServer } = (await import(
  `${BRIDGE_ROOT}/websocket-server.js`
)) as any;
const { WebSocketConnector } = (await import(
  `${BRIDGE_ROOT}/websocket-connector.js`
)) as any;
const server = new FigmaWebSocketServer({ port: PORT, host: "localhost" });
let attempt: Record<string, any> = {
  version: 4,
  attempt: 2,
  target: {
    fileKey: FILE_KEY,
    fileName: "Scratch Project",
    editorType: "figma",
  },
  wrapperPath: WRAPPER_PATH,
  wrapperBytes: Buffer.byteLength(wrapper),
  wrapperSha256: sha256(wrapper),
  evalBegan: false,
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
    15_000,
    FILE_KEY,
  );
  if (!preflight?.success) {
    throw new Error(preflight?.error ?? "v4 census failed");
  }
  attempt.before = preflight.result;
  if (
    preflight.result.proofPageMatches !== 0 ||
    preflight.result.matchingCollections !== 0
  ) {
    throw new Error("v4 proof artifacts already exist");
  }
  const response = await connector.executeCodeViaUI(wrapper, 45_000, FILE_KEY);
  attempt.bridgeResult = response;
  const transport = response?.result?.transport;
  attempt.evalBegan = transport?.evalBegan === true;
  attempt.evalCompleted = transport?.evalCompleted === true;
  attempt.decodedBytes = transport?.decodedBytes;
  attempt.decodedSha256 = transport?.decodedSha256;
  attempt.hashImplementation = transport?.hashImplementation;
  attempt.utf8Implementation = transport?.utf8Implementation;
  if (!response?.success || !attempt.evalCompleted) {
    throw new Error(response?.error ?? "v4 writer did not complete");
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
    evalBegan: attempt.evalBegan,
    evalCompleted: attempt.evalCompleted,
    decodedBytes: attempt.decodedBytes,
    decodedSha256: attempt.decodedSha256,
    result: attempt.bridgeResult.result.result,
  }),
);
