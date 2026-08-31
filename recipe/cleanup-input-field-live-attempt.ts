import { writeFileSync } from "node:fs";

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const PAGE_NAME = "Recipe Pivot / Input Field / e4ac8bb8-f30a3672-input-v1";
const RUN_IDENTITY = "e4ac8bb8-f30a3672-input-v1";
const ROOT = "recipe/evidence/input-field-live-pivot-v1";
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const attempt = Number(
  process.argv.find((value) => value.startsWith("--attempt="))?.split("=")[1] ??
    "1",
);
const { FigmaWebSocketServer } = (await import(
  `${BRIDGE_ROOT}/websocket-server.js`
)) as any;
const { WebSocketConnector } = (await import(
  `${BRIDGE_ROOT}/websocket-connector.js`
)) as any;
const server = new FigmaWebSocketServer({ port: PORT, host: "localhost" });
let result: any;
try {
  await server.start();
  const deadline = Date.now() + 45_000;
  while (
    Date.now() < deadline &&
    !server
      .getConnectedFiles()
      .some((file: { fileKey: string }) => file.fileKey === FILE_KEY)
  )
    await sleep(250);
  const connector = new WebSocketConnector(server);
  await connector.initialize();
  const response = await connector.executeCodeViaUI(
    `if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("WRONG-TARGET");await figma.loadAllPagesAsync();const pages=figma.root.children.filter(page=>page.name==="${PAGE_NAME}");const pageIds=pages.map(page=>page.id);const safe=figma.root.children.find(page=>page.name!=="${PAGE_NAME}");if(pages.length&&!safe)throw new Error("NO-SAFE-PAGE");if(safe)await figma.setCurrentPageAsync(safe);for(const page of pages)page.remove();const collections=await figma.variables.getLocalVariableCollectionsAsync();const matching=collections.filter(collection=>collection.name.includes("${RUN_IDENTITY}"));const collectionIds=matching.map(collection=>collection.id);for(const collection of matching)collection.remove();const remainingPages=figma.root.children.filter(page=>page.name==="${PAGE_NAME}").length;const remainingCollections=(await figma.variables.getLocalVariableCollectionsAsync()).filter(collection=>collection.name.includes("${RUN_IDENTITY}")).length;return {fileKey:figma.fileKey,fileName:figma.root.name,removedPageIds:pageIds,removedCollectionIds:collectionIds,remainingPages,remainingCollections};`,
    30_000,
    FILE_KEY,
  );
  if (!response?.success) throw new Error(response?.error ?? "cleanup failed");
  result = response.result;
} finally {
  await server.stop();
}
writeFileSync(
  `${ROOT}/cleanup-attempt-${attempt}.json`,
  `${JSON.stringify(result, null, 2)}\n`,
);
if (result.remainingPages !== 0 || result.remainingCollections !== 0) {
  throw new Error("Input cleanup incomplete");
}
console.log(JSON.stringify(result));
