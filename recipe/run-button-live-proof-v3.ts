import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
const EVIDENCE_DIR = "recipe/evidence/button-live-pivot-v3";
const WRAPPER_PATH = `${EVIDENCE_DIR}/writer-wrapper-attempt-2.txt`;
const PLAN_PATH = `${EVIDENCE_DIR}/writer-plan.json`;
const ATTEMPT_PATH = `${EVIDENCE_DIR}/live-attempt-2.json`;
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const { FigmaWebSocketServer } = (await import(
  `${BRIDGE_ROOT}/websocket-server.js`
)) as any;
const { WebSocketConnector } = (await import(
  `${BRIDGE_ROOT}/websocket-connector.js`
)) as any;
const server = new FigmaWebSocketServer({ port: PORT, host: "localhost" });

let attempt: Record<string, unknown> = {
  version: 3,
  attempt: 2,
  fileKey: FILE_KEY,
  transport: "local-generated-file-to-dedicated-websocket-bridge",
  evalBegan: false,
};

try {
  await server.start();
  const deadline = Date.now() + 45_000;
  let connected = false;
  while (Date.now() < deadline) {
    connected = server
      .getConnectedFiles()
      .some((file: { fileKey: string }) => file.fileKey === FILE_KEY);
    if (connected) break;
    await sleep(250);
  }
  if (!connected) {
    throw new Error("Scratch did not connect to the dedicated bridge");
  }

  const wrapper = readFileSync(WRAPPER_PATH, "utf8");
  const plan = JSON.parse(readFileSync(PLAN_PATH, "utf8")) as {
    transport: { wrapperBytes: number; wrapperSha256: string };
  };
  const wrapperBytes = Buffer.byteLength(wrapper);
  const wrapperSha256 = sha256(wrapper);
  if (
    wrapperBytes !== plan.transport.wrapperBytes ||
    wrapperSha256 !== plan.transport.wrapperSha256
  ) {
    throw new Error("generated wrapper fingerprint changed before bridge send");
  }

  const connector = new WebSocketConnector(server);
  await connector.initialize();
  const result = await connector.executeCodeViaUI(wrapper, 30_000, FILE_KEY);
  attempt = {
    ...attempt,
    wrapperPath: WRAPPER_PATH,
    wrapperBytes,
    wrapperSha256,
    bridgePort: PORT,
    bridgeResult: result,
    evalBegan: result?.result?.transport?.evalBegan ?? false,
    decodedBytes: result?.result?.transport?.decodedBytes ?? null,
    decodedSha256: result?.result?.transport?.decodedSha256 ?? null,
    hashImplementation:
      result?.result?.transport?.hashImplementation ?? null,
  };
} catch (error) {
  attempt = {
    ...attempt,
    error: error instanceof Error ? error.message : String(error),
  };
} finally {
  writeFileSync(ATTEMPT_PATH, `${JSON.stringify(attempt, null, 2)}\n`);
  await server.stop();
}

console.log(JSON.stringify(attempt));
if ("error" in attempt || (attempt.bridgeResult as any)?.success !== true) {
  process.exitCode = 1;
}
