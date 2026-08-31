import { writeFileSync } from "node:fs";

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const PAGE_NAME = "Recipe Pivot / Button / e6a61d04-b04f4059-v4";
const RUN_IDENTITY = "e6a61d04-b04f4059-v4";
const OUTPUT = "recipe/evidence/button-live-pivot-v4/cleanup-attempt-1.json";
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const { FigmaWebSocketServer } = (await import(
  `${BRIDGE_ROOT}/websocket-server.js`
)) as any;
const { WebSocketConnector } = (await import(
  `${BRIDGE_ROOT}/websocket-connector.js`
)) as any;
const server = new FigmaWebSocketServer({ port: PORT, host: "localhost" });
const code = `
if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="Scratch Project")throw new Error("WRONG-TARGET");
await figma.loadAllPagesAsync();
const removed={pages:[],collections:[]};
const fallback=figma.root.children.find(page=>page.name!=="${PAGE_NAME}");
if(fallback&&figma.currentPage.name==="${PAGE_NAME}")await figma.setCurrentPageAsync(fallback);
for(const page of [...figma.root.children])if(page.name==="${PAGE_NAME}"){removed.pages.push({id:page.id,topLevelNodes:page.children.length});page.remove();}
for(const collection of await figma.variables.getLocalVariableCollectionsAsync())if(collection.name.includes("${RUN_IDENTITY}")){removed.collections.push({id:collection.id,name:collection.name,variables:collection.variableIds.length});collection.remove();}
const collections=await figma.variables.getLocalVariableCollectionsAsync();
const variables=await figma.variables.getLocalVariablesAsync();
return {fileKey:figma.fileKey,fileName:figma.root.name,removed,after:{pageCount:figma.root.children.length,totalTopLevelNodes:figma.root.children.reduce((sum,page)=>sum+page.children.length,0),proofPageMatches:figma.root.children.filter(page=>page.name==="${PAGE_NAME}").length,collectionCount:collections.length,totalLocalVariables:variables.length,matchingCollections:collections.filter(collection=>collection.name.includes("${RUN_IDENTITY}")).length}};
`;
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
  const response = await connector.executeCodeViaUI(code, 20_000, FILE_KEY);
  if (!response?.success) throw new Error(response?.error ?? "cleanup failed");
  result = response.result;
} finally {
  await server.stop();
}
writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
