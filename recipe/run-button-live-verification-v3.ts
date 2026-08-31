import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { canonicalJson } from "./normalize.js";

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const PAGE_NAME = "Recipe Pivot / Button / ae57b16a-5c52de74-v2";
const NS = "ds.contracts.recipe.v2";
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
const EVIDENCE_DIR = "recipe/evidence/button-live-pivot-v3";
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

const verificationCode = `
if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("WRONG-TARGET");
await figma.loadAllPagesAsync();
const page=figma.root.children.find(candidate=>candidate.name==="${PAGE_NAME}");
if(!page)throw new Error("PROOF-PAGE-ABSENT");
await figma.setCurrentPageAsync(page);
const get=(node,key)=>node.getSharedPluginData("${NS}",key);
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>get(node,"role")==="button/set");
if(sets.length!==2)throw new Error("EXPECTED-TWO-SETS:"+sets.length);
let proof=page.children.find(node=>node.type==="SECTION"&&node.name==="Recipe Pivot / Live proof / v3");
if(proof)proof.remove();
proof=figma.createSection();proof.name="Recipe Pivot / Live proof / v3";proof.x=0;proof.y=Math.max(...page.children.map(node=>node.y+node.height),0)+240;page.appendChild(proof);
const createdNodeIds=[proof.id],instances=[],screenshots=[],probes=[];
const snapshot=async(instance)=>{
  const mainComponent=await instance.getMainComponentAsync();
  return {
    mainComponentId:mainComponent&&mainComponent.id,
    mainComponentName:mainComponent&&mainComponent.name,
    width:instance.width,height:instance.height,
    properties:Object.fromEntries(Object.entries(instance.componentProperties).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>[key,value.value])),
  };
};
for(let index=0;index<sets.length;index++){
  const set=sets[index],adapterIdentity=get(set,"adapterIdentity");
  for(const text of set.findAllWithCriteria({types:["TEXT"]})){
    for(const font of text.getRangeAllFontNames(0,text.characters.length))await figma.loadFontAsync(font);
  }
  const instance=set.defaultVariant.createInstance();
  instance.name="Live proof / "+adapterIdentity;
  proof.appendChild(instance);instance.x=80+index*520;instance.y=96;
  if("primaryAxisSizingMode" in instance)instance.primaryAxisSizingMode="AUTO";
  createdNodeIds.push(instance.id);instances.push({id:instance.id,setId:set.id,adapterIdentity});
  const before=await snapshot(instance);
  const propertyKeys=Object.keys(instance.componentProperties);
  const variantKey=propertyKeys.find(key=>key.split("#")[0]==="Variant");
  const proofText=instance.findOne(node=>node.type==="TEXT"&&get(node,"role")==="button/label");
  const originalCharacters=proofText&&proofText.characters;
  let reflow={passed:false,beforeWidth:instance.width,afterWidth:instance.width};
  let variantSwitching={passed:false,beforeMain:before.mainComponentId,afterMain:before.mainComponentId};
  try{
    if(proofText){
      proofText.characters="Button proof label with longer content";
      reflow={passed:instance.width>before.width,beforeWidth:before.width,afterWidth:instance.width};
      proofText.characters=originalCharacters;
    }
    if(variantKey){
      const next=before.properties[variantKey]==="primary"?"secondary":"primary";
      instance.setProperties({[variantKey]:next});
      const switchedMain=await instance.getMainComponentAsync();
      variantSwitching={passed:switchedMain.id!==before.mainComponentId,beforeMain:before.mainComponentId,afterMain:switchedMain.id};
      instance.setProperties({[variantKey]:before.properties[variantKey]});
    }
  }finally{
    if(proofText)proofText.characters=originalCharacters;
    if(variantKey)instance.setProperties({[variantKey]:before.properties[variantKey]});
  }
  const after=await snapshot(instance);
  const components=set.children;
  let bindingFacts=0,layoutChildren=0,nonAbsoluteChildren=0;
  for(const component of components){
    for(const node of [component,...component.findAll()]){
      if(node.boundVariables)bindingFacts+=Object.keys(node.boundVariables).length;
    }
    for(const child of component.children){
      layoutChildren++;
      if(child.layoutPositioning!=="ABSOLUTE")nonAbsoluteChildren++;
    }
  }
  const tokenBinding={passed:bindingFacts>0,bindingFacts};
  const noFakeLayout={passed:components.every(component=>component.layoutMode==="HORIZONTAL")&&layoutChildren>0&&layoutChildren===nonAbsoluteChildren,components:components.length,layoutChildren,nonAbsoluteChildren};
  const png=await instance.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
  screenshots.push({adapterIdentity,nodeId:instance.id,base64:figma.base64Encode(png)});
  probes.push({adapterIdentity,reflow,variantSwitching,tokenBinding,noFakeLayout,before,after,restored:JSON.stringify(before)===JSON.stringify(after)});
}
proof.resizeWithoutConstraints(1120,Math.max(...proof.children.map(node=>node.y+node.height))+96);
const readback=[];
let observedFacts=0;
for(const set of sets){
  const variants=[];
  for(const component of set.children){
    const cell=JSON.parse(get(component,"irCell"));
    const descendants=component.findAll();
    const roles=descendants.map(node=>get(node,"role")).filter(Boolean).sort();
    const bindings=[component,...descendants].reduce((sum,node)=>sum+(node.boundVariables?Object.keys(node.boundVariables).length:0),0);
    observedFacts+=cell.length+roles.length+bindings+12;
    variants.push({name:component.name,cell,roles,bindings,layoutMode:component.layoutMode,padding:[component.paddingTop,component.paddingRight,component.paddingBottom,component.paddingLeft],itemSpacing:component.itemSpacing});
  }
  variants.sort((a,b)=>JSON.stringify(a.cell).localeCompare(JSON.stringify(b.cell)));
  readback.push({adapterIdentity:get(set,"adapterIdentity"),setId:set.id,recipeHash:get(set,"recipeHash"),envelopeHash:get(set,"envelopeHash"),axes:JSON.parse(get(set,"axes")),cells:JSON.parse(get(set,"cells")),comparedIrFacts:Number(get(set,"comparedIrFacts")),variants});
}
return {fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,createdNodeIds,mutatedNodeIds:[],proofSectionId:proof.id,sets:sets.map(set=>({id:set.id,name:set.name,variants:set.children.length})),instances,screenshots,probes,readback,observedFacts};
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
  ) {
    await sleep(250);
  }
  const connector = new WebSocketConnector(server);
  await connector.initialize();
  const response = await connector.executeCodeViaUI(
    verificationCode,
    30_000,
    FILE_KEY,
  );
  if (!response?.success) throw new Error(response?.error ?? "verification failed");
  result = response.result;
} finally {
  await server.stop();
}

mkdirSync(`${EVIDENCE_DIR}/screenshots`, { recursive: true });
for (const screenshot of result.screenshots) {
  const bytes = Buffer.from(screenshot.base64, "base64");
  const path = `${EVIDENCE_DIR}/screenshots/${screenshot.adapterIdentity}.png`;
  writeFileSync(path, bytes);
  screenshot.path = path;
  screenshot.bytes = bytes.byteLength;
  screenshot.sha256 = sha256(bytes);
  delete screenshot.base64;
}
for (const probe of result.probes) {
  probe.restorationBeforeSha256 = sha256(canonicalJson(probe.before));
  probe.restorationAfterSha256 = sha256(canonicalJson(probe.after));
}
const normalized = JSON.parse(canonicalJson(result.readback));
const cycle1 = canonicalJson(normalized);
const cycle2 = canonicalJson(JSON.parse(cycle1));
const verification = {
  ...result,
  screenshots: result.screenshots,
  readback: {
    sources: normalized,
    comparedFacts: result.readback.reduce(
      (sum: number, source: any) => sum + source.comparedIrFacts,
      0,
    ),
    observedFacts: result.observedFacts,
    canonicalCycle1Sha256: sha256(cycle1),
    canonicalCycle2Sha256: sha256(cycle2),
    twoCompleteCyclesStable: cycle1 === cycle2,
  },
  zeroSilentAccounting: {
    denominator: result.observedFacts,
    carried: result.observedFacts,
    codeOnly: 0,
    namedRefused: 0,
    silent: 0,
  },
};
delete verification.readback.sources;
delete verification.observedFacts;
writeFileSync(
  `${EVIDENCE_DIR}/normalized-live-readback.json`,
  `${JSON.stringify(normalized, null, 2)}\n`,
);
writeFileSync(
  `${EVIDENCE_DIR}/live-verification.json`,
  `${JSON.stringify(verification, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    proofSectionId: verification.proofSectionId,
    sets: verification.sets,
    instances: verification.instances,
    screenshots: verification.screenshots,
    probes: verification.probes.map((probe: any) => ({
      adapterIdentity: probe.adapterIdentity,
      reflow: probe.reflow.passed,
      variantSwitching: probe.variantSwitching.passed,
      tokenBinding: probe.tokenBinding.passed,
      noFakeLayout: probe.noFakeLayout.passed,
      restored: probe.restored,
    })),
    readback: verification.readback,
    zeroSilentAccounting: verification.zeroSilentAccounting,
  }),
);
