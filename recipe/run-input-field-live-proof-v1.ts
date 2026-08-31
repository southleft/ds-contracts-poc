import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const ROOT = "recipe/evidence/input-field-live-pivot-v1";
const ATTEMPT = Number(
  process.argv.find((value) => value.startsWith("--attempt="))?.split("=")[1] ??
    "1",
);
const PLAN_PATH = `${ROOT}/writer-plan.json`;
const WRAPPER_PATH = `${ROOT}/writer-wrapper-attempt-${ATTEMPT}.txt`;
const ATTEMPT_PATH = `${ROOT}/live-attempt-${ATTEMPT}.json`;
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
  throw new Error("Input wrapper differs from generated plan");
}
if (
  plan.target.fileKey !== FILE_KEY ||
  plan.target.fileName !== "Scratch Project" ||
  plan.attempts.maximum !== 3
) {
  throw new Error("Input plan target or attempt cap is invalid");
}

const { FigmaWebSocketServer } = (await import(
  `${BRIDGE_ROOT}/websocket-server.js`
)) as any;
const { WebSocketConnector } = (await import(
  `${BRIDGE_ROOT}/websocket-connector.js`
)) as any;
const server = new FigmaWebSocketServer({ port: PORT, host: "localhost" });
const attempt: Record<string, any> = {
  version: 1,
  attempt: ATTEMPT,
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
  const exact = server
    .getConnectedFiles()
    .filter(
      (file: { fileKey: string; fileName: string }) =>
        file.fileKey === FILE_KEY && file.fileName === "Scratch Project",
    );
  if (exact.length !== 1) {
    throw new Error(`Scratch Project bridge exact match count ${exact.length}`);
  }
  const connector = new WebSocketConnector(server);
  await connector.initialize();
  const preflight = await connector.executeCodeViaUI(
    `if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("WRONG-TARGET");await figma.loadAllPagesAsync();const collections=await figma.variables.getLocalVariableCollectionsAsync();const variables=await figma.variables.getLocalVariablesAsync();return {fileKey:figma.fileKey,fileName:figma.root.name,editorType:figma.editorType,pageCount:figma.root.children.length,totalTopLevelNodes:figma.root.children.reduce((sum,page)=>sum+page.children.length,0),proofPageMatches:figma.root.children.filter(page=>page.name==="${plan.pageName}").length,matchingCollections:collections.filter(collection=>collection.name.includes("${plan.runIdentity}")).length,totalLocalVariables:variables.length};`,
    20_000,
    FILE_KEY,
  );
  if (!preflight?.success) {
    throw new Error(preflight?.error ?? "Input census failed");
  }
  attempt.before = preflight.result;
  if (
    attempt.before.proofPageMatches !== 0 ||
    attempt.before.matchingCollections !== 0
  ) {
    throw new Error("Input proof artifacts already exist");
  }
  const response = await connector.executeCodeViaUI(wrapper, 180_000, FILE_KEY);
  attempt.bridgeResult = response;
  const transport = response?.result?.transport;
  attempt.evalBegan = transport?.evalBegan === true;
  attempt.evalCompleted = transport?.evalCompleted === true;
  attempt.decodedBytes = transport?.decodedBytes;
  attempt.decodedSha256 = transport?.decodedSha256;
  attempt.hashImplementation = transport?.hashImplementation;
  attempt.utf8Implementation = transport?.utf8Implementation;
  if (!response?.success || !attempt.evalCompleted) {
    throw new Error(response?.error ?? "Input writer did not complete");
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
    transport: {
      evalBegan: attempt.evalBegan,
      evalCompleted: attempt.evalCompleted,
      decodedBytes: attempt.decodedBytes,
      decodedSha256: attempt.decodedSha256,
    },
    result: attempt.bridgeResult.result.result,
  }),
);
