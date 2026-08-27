import { writeFileSync } from "node:fs";

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const PAGE_NAME = "Recipe Pivot / Button / e6a61d04-b04f4059-v4";
const OUTPUT =
  "recipe/evidence/button-live-pivot-v4/live-attempt-1-diagnostic.json";
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
const page=figma.root.children.find(candidate=>candidate.name==="${PAGE_NAME}");
if(!page)return {page:null};
const ns="ds.contracts.recipe.v4";
const get=(node,key)=>node.getSharedPluginData(ns,key);
const components=page.findAllWithCriteria({types:["COMPONENT"]}).filter(node=>get(node,"adapterIdentity")==="fluent-button-reviewed-v2"&&get(node,"role").startsWith("button/variant/"));
const component=components[0];
if(!component)return {page:{id:page.id,children:page.children.length},component:null};
const label=component.findOne(node=>node.type==="TEXT");
const collections=await figma.variables.getLocalVariableCollectionsAsync();
return {page:{id:page.id,children:page.children.length},component:{id:component.id,name:component.name,width:component.width,height:component.height,minWidth:component.minWidth,layoutMode:component.layoutMode,primaryAxisSizingMode:component.primaryAxisSizingMode,layoutSizingHorizontal:component.layoutSizingHorizontal,clipsContent:component.clipsContent},label:label?{id:label.id,characters:label.characters,width:label.width,height:label.height,x:label.x,y:label.y,visible:label.visible,opacity:label.opacity,fontName:label.fontName,fontSize:label.fontSize,lineHeight:label.lineHeight,textAutoResize:label.textAutoResize,layoutSizingHorizontal:label.layoutSizingHorizontal,layoutSizingVertical:label.layoutSizingVertical,fills:label.fills}:null,matchingCollections:collections.filter(collection=>collection.name.includes("e6a61d04-b04f4059-v4")).map(collection=>({id:collection.id,name:collection.name,variables:collection.variableIds.length}))};
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
  const response = await connector.executeCodeViaUI(code, 15_000, FILE_KEY);
  if (!response?.success)
    throw new Error(response?.error ?? "diagnostic failed");
  result = response.result;
} finally {
  await server.stop();
}
writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
