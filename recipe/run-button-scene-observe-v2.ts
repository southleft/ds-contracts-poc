import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

import {
  BUTTON_INVERSION_SOURCES,
  BUTTON_SCENE_INVERSION_ROOT,
  BUTTON_V4_FILE_KEY,
  BUTTON_V4_PAGE_ID,
  BUTTON_V4_PAGE_NAME,
  buildButtonSceneObserveProgram,
} from "./button-scene-inversion.js";
import { canonicalJson } from "./normalize.js";

const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9229);
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
const CHUNK_SIZE = 8_000;

const runStaged = async (
  connector: any,
  program: string,
  timeoutMs: number,
): Promise<any> => {
  const reset = await connector.executeCodeViaUI(
    `globalThis.__v2ObserveProgram="";return {ok:true};`,
    15_000,
    BUTTON_V4_FILE_KEY,
  );
  if (!reset?.success) throw new Error(reset?.error ?? "observe stage reset");
  for (let offset = 0; offset < program.length; offset += CHUNK_SIZE) {
    const chunk = program.slice(offset, offset + CHUNK_SIZE);
    const staged = await connector.executeCodeViaUI(
      `globalThis.__v2ObserveProgram+=${JSON.stringify(chunk)};return {staged:globalThis.__v2ObserveProgram.length};`,
      15_000,
      BUTTON_V4_FILE_KEY,
    );
    if (!staged?.success)
      throw new Error(staged?.error ?? `observe stage @${offset}`);
  }
  const response = await connector.executeCodeViaUI(
    `if(globalThis.__v2ObserveProgram.length!==${program.length})throw new Error("OBSERVE-PROGRAM-LENGTH");return await eval("(async()=>{"+globalThis.__v2ObserveProgram+"\\n})()");`,
    timeoutMs,
    BUTTON_V4_FILE_KEY,
  );
  if (!response?.success) throw new Error(response?.error ?? "observe failed");
  return response.result;
};

mkdirSync(BUTTON_SCENE_INVERSION_ROOT, { recursive: true });
try {
  await server.start();
  const deadline = Date.now() + 120_000;
  while (
    Date.now() < deadline &&
    !server
      .getConnectedFiles()
      .some((file: { fileKey: string }) => file.fileKey === BUTTON_V4_FILE_KEY)
  ) {
    await sleep(250);
  }
  const connector = new WebSocketConnector(server);
  await connector.initialize();
  const census: Record<string, any> = {
    writes: 0,
    fileKey: BUTTON_V4_FILE_KEY,
    fileName: "Scratch Project",
    buttonPage: null,
    sets: [],
    pluginDataNote:
      "Sets carry adapterIdentity, runIdentity, and ownershipKey=root (the v5 writer stamps ownership). Stamped ir*/cells keys were not read as observe values.",
  };
  for (const source of BUTTON_INVERSION_SOURCES) {
    const program = buildButtonSceneObserveProgram(source.setId);
    const result = await runStaged(connector, program, 300_000);
    census.currentPageUnchanged = result.currentPageUnchanged;
    census.inputPagePresent = result.inputPagePresent;
    census.buttonPage = {
      id: result.pageId,
      name: BUTTON_V4_PAGE_NAME,
    };
    census.sets.push({
      id: result.setId,
      adapterIdentity: result.adapterIdentity,
      runIdentity: result.runIdentity,
      variants: result.variants,
      ownershipKey: "root",
    });
    const bytes = Buffer.from(`${canonicalJson(result.scene)}\n`, "utf8");
    const path = `${BUTTON_SCENE_INVERSION_ROOT}/observe-${source.source}.json.gz`;
    writeFileSync(path, gzipSync(bytes));
    console.log(
      JSON.stringify({
        source: source.source,
        setId: result.setId,
        variants: result.variants,
        observePath: path,
        uncompressedSha256: sha256(bytes),
      }),
    );
  }
  census.currentPageId = BUTTON_V4_PAGE_ID;
  writeFileSync(
    `${BUTTON_SCENE_INVERSION_ROOT}/census.json`,
    `${JSON.stringify(census, null, 2)}\n`,
  );
} finally {
  await server.stop();
}
