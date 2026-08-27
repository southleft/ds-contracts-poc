const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
export {};
const PAGE_NAME = "Recipe Pivot / Button / ae57b16a-5c52de74-v2";
const COLLECTION_IDS = [
  "VariableCollectionId:85:4815",
  "VariableCollectionId:85:5440",
];
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
const EVIDENCE_PATH = "recipe/evidence/button-live-pivot-v3/cleanup.json";
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const { writeFileSync } = await import("node:fs");
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
const fallbackPage=figma.root.children.find(page=>page.name!=="${PAGE_NAME}");
if(fallbackPage&&figma.currentPage.name==="${PAGE_NAME}")await figma.setCurrentPageAsync(fallbackPage);
for(const page of [...figma.root.children]){
  if(page.name==="${PAGE_NAME}"){removed.pages.push({id:page.id,name:page.name,topLevelNodes:page.children.length});page.remove();}
}
for(const id of ${JSON.stringify(COLLECTION_IDS)}){
  const collection=await figma.variables.getVariableCollectionByIdAsync(id);
  if(collection){removed.collections.push({id:collection.id,name:collection.name,variableIds:collection.variableIds.length});collection.remove();}
}
const collections=await figma.variables.getLocalVariableCollectionsAsync();
const variables=await figma.variables.getLocalVariablesAsync();
return {fileKey:figma.fileKey,fileName:figma.root.name,removed,after:{pageCount:figma.root.children.length,totalTopLevelNodes:figma.root.children.reduce((sum,page)=>sum+page.children.length,0),proofPageMatches:figma.root.children.filter(page=>page.name==="${PAGE_NAME}").length,collectionCount:collections.length,totalLocalVariables:variables.length,matchingCollections:collections.filter(collection=>${JSON.stringify(COLLECTION_IDS)}.includes(collection.id)).length}};
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
  const response = await connector.executeCodeViaUI(code, 30_000, FILE_KEY);
  if (!response?.success) throw new Error(response?.error ?? "cleanup failed");
  result = response.result;
} finally {
  await server.stop();
}
writeFileSync(EVIDENCE_PATH, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
