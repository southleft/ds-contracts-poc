import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { adaptReviewedButton } from "./adapters/button.js";
import { validateButtonResizeProbe } from "./button-usability.js";
import {
  altitudeButtonAdapterConfig,
  fluentButtonAdapterConfig,
} from "./fixtures/library-buttons.js";
import { canonicalJson } from "./normalize.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  collapseButtonRecipe,
  compileButtonRecipe,
  buttonRecipe,
} from "./recipes/button.js";
import {
  compareSceneToExpectedPlan,
  verifySceneDerivedFixedPoint,
  type ExpectedScenePlan,
  type SceneComparison,
  type SceneFixedPointReport,
  type SceneNodeSnapshot,
} from "./scene-readback.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime.js";

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const PAGE_NAME = "Recipe Pivot / Button / e6a61d04-b04f4059-v4";
const NS = "ds.contracts.recipe.v4";
const EVIDENCE_DIR = "recipe/evidence/button-live-pivot-v4";
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
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
const sceneReadbackRuntime = buildFigmaSceneReadbackRuntime(NS);
const sourceDescriptors = [
  {
    adapterIdentity: "altitude-button-reviewed-v2",
    contractPath: "examples/altitude/contracts/button.contract.json",
    config: altitudeButtonAdapterConfig,
  },
  {
    adapterIdentity: "fluent-button-reviewed-v2",
    contractPath: "examples/fluent/contracts/button.contract.json",
    config: fluentButtonAdapterConfig,
  },
].map((source) => {
  const instance = adaptReviewedButton(
    JSON.parse(readFileSync(source.contractPath, "utf8")),
    source.config,
  );
  return {
    ...source,
    instance,
    envelope: compileButtonRecipe(instance),
    recipeHash: hashRecipeInstance(buttonRecipe, instance),
  };
});

const code = `
if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("WRONG-TARGET");
await figma.loadAllPagesAsync();
const page=figma.root.children.find(candidate=>candidate.name==="${PAGE_NAME}");
if(!page)throw new Error("V4-PROOF-PAGE-ABSENT");
await figma.setCurrentPageAsync(page);
const get=(node,key)=>node.getSharedPluginData("${NS}",key);
${sceneReadbackRuntime}
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>get(node,"ownershipKey")==="root"&&node.name.startsWith("button/set"));
if(sets.length!==2)throw new Error("EXPECTED-TWO-V4-SETS:"+sets.length);
for(const stale of [...page.children])if(stale.type==="SECTION"&&(stale.name==="Recipe Pivot / Live proof / v4"||stale.name==="Recipe Pivot / Paired cells / v4"))stale.remove();
const proof=figma.createSection();proof.name="Recipe Pivot / Live proof / v4";proof.x=0;proof.y=Math.max(...page.children.map(node=>node.y+node.height),0)+240;page.appendChild(proof);
const paired=figma.createSection();paired.name="Recipe Pivot / Paired cells / v4";paired.x=0;paired.y=proof.y+560;page.appendChild(paired);
const createdNodeIds=[proof.id,paired.id],instances=[],probes=[],images=[],setImages=[],cellRecords=[];
const paintAlpha=(fills)=>Array.isArray(fills)&&fills[0]&&fills[0].type==="SOLID"?(fills[0].opacity===undefined?1:fills[0].opacity):0;
const labelFor=(root)=>root.findOne(node=>node.type==="TEXT"&&sceneRole(node)==="button/label");
const labelGeometry=(label)=>({characters:label.characters,fontFamily:label.fontName.family,fontStyle:label.fontName.style,fontSize:label.fontSize,fillAlpha:paintAlpha(label.fills)*label.opacity,visible:label.visible,width:label.width,height:label.height,x:label.x,horizontalAlignment:label.textAlignHorizontal});
const snapshot=async(instance)=>{
  const main=await instance.getMainComponentAsync(),label=labelFor(instance);
  if(!main||!label)throw new Error("INSTANCE-LABEL-ABSENT");
  return {width:instance.width,height:instance.height,primaryAxisSizingMode:instance.primaryAxisSizingMode,mainComponentId:main.id,mainComponentName:main.name,properties:Object.fromEntries(Object.entries(instance.componentProperties).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,value])=>[key,value.value])),label:labelGeometry(label)};
};
for(let sourceIndex=0;sourceIndex<sets.length;sourceIndex++){
  const set=sets[sourceIndex],adapterIdentity=get(set,"adapterIdentity");
  for(const text of set.findAllWithCriteria({types:["TEXT"]}))for(const font of text.getRangeAllFontNames(0,text.characters.length))await figma.loadFontAsync(font);
  const labels=set.findAllWithCriteria({types:["TEXT"]}).filter(node=>sceneRole(node)==="button/label");
  const labelValidation={denominator:labels.length,passed:labels.filter(label=>label.characters.trim().length>0&&label.width>0&&label.height>0&&label.visible&&label.opacity>0&&paintAlpha(label.fills)>0&&label.textAlignHorizontal==="CENTER"&&label.textAlignVertical==="CENTER").length};
  const instance=set.defaultVariant.createInstance();instance.name="Live proof / "+adapterIdentity;proof.appendChild(instance);instance.x=80+sourceIndex*520;instance.y=96;
  createdNodeIds.push(instance.id);instances.push({id:instance.id,setId:set.id,adapterIdentity});
  const before=await snapshot(instance),originalMode=instance.primaryAxisSizingMode;
  instance.primaryAxisSizingMode="FIXED";
  instance.resizeWithoutConstraints(before.width+64,before.height);
  const grown=await snapshot(instance);
  instance.primaryAxisSizingMode=originalMode;
  const restored=await snapshot(instance);
  const beforeRestoreShape={width:before.width,label:before.label};
  const restoredShape={width:restored.width,label:restored.label};
  const beforeHash=JSON.stringify(beforeRestoreShape),afterHash=JSON.stringify(restoredShape);
  const resize={sourceIntent:"HUG",before:beforeRestoreShape,grown:{width:grown.width,label:grown.label},restored:restoredShape,restorationBeforeRaw:beforeHash,restorationAfterRaw:afterHash};
  const propertyKeys=Object.keys(instance.componentProperties),variantKey=propertyKeys.find(key=>key.split("#")[0]==="Variant");
  let variantSwitching={passed:false,beforeMain:before.mainComponentId,afterMain:before.mainComponentId};
  if(variantKey){
    const next=before.properties[variantKey]==="primary"?"secondary":"primary";
    instance.setProperties({[variantKey]:next});
    const switched=await instance.getMainComponentAsync();
    variantSwitching={passed:switched.id!==before.mainComponentId,beforeMain:before.mainComponentId,afterMain:switched.id};
    instance.setProperties({[variantKey]:before.properties[variantKey]});
  }
  let bindingFacts=0,layoutChildren=0,nonAbsoluteChildren=0;
  for(const component of set.children){
    for(const node of [component,...component.findAll()])if(node.boundVariables)bindingFacts+=Object.keys(node.boundVariables).length;
    for(const child of component.children){layoutChildren++;if(child.layoutPositioning!=="ABSOLUTE")nonAbsoluteChildren++;}
  }
  probes.push({adapterIdentity,resize,variantSwitching,tokenBinding:{passed:bindingFacts>0,bindingFacts},noFakeLayout:{passed:set.children.every(component=>component.layoutMode==="HORIZONTAL"&&component.primaryAxisAlignItems==="CENTER")&&layoutChildren>0&&layoutChildren===nonAbsoluteChildren,components:set.children.length,layoutChildren,nonAbsoluteChildren},labelValidation,restored:beforeHash===afterHash});
  const png=await instance.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
  images.push({kind:"representative",adapterIdentity,nodeId:instance.id,base64:figma.base64Encode(png)});
  const setPng=await set.exportAsync({format:"PNG",constraint:{type:"WIDTH",value:2400}});
  setImages.push({adapterIdentity,nodeId:set.id,base64:figma.base64Encode(setPng)});
  for(const variant of ["primary","secondary"])for(const state of ["default","hover","focus-visible"]){
    const component=set.children.find(node=>node.name==="Variant="+variant+", Size=medium, State="+state+", Icons=none");
    if(!component)throw new Error("PAIRED-CELL-ABSENT:"+adapterIdentity+":"+variant+":"+state);
    const cell=component.createInstance();cell.name="Paired cell";paired.appendChild(cell);cell.x=80+(variant==="primary"?0:320)+sourceIndex*720;cell.y=80+["default","hover","focus-visible"].indexOf(state)*120;
    createdNodeIds.push(cell.id);
    const cellPng=await cell.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
    images.push({kind:"paired-cell",adapterIdentity,variant,state,nodeId:cell.id,base64:figma.base64Encode(cellPng)});
    cellRecords.push({adapterIdentity,variant,state,nodeId:cell.id,componentId:component.id});
  }
}
proof.resizeWithoutConstraints(1120,Math.max(...proof.children.map(node=>node.y+node.height))+96);
paired.resizeWithoutConstraints(1520,480);
const readback=[];
for(const set of sets){
  readback.push({adapterIdentity:get(set,"adapterIdentity"),setId:set.id,scene:await readSceneDerivedTree(set)});
}
const collections=await figma.variables.getLocalVariableCollectionsAsync(),variables=await figma.variables.getLocalVariablesAsync();
return {fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,createdNodeIds,mutatedPreExistingNodeIds:[],proofSectionId:proof.id,pairedSectionId:paired.id,sets:sets.map(set=>({id:set.id,name:set.name,adapterIdentity:get(set,"adapterIdentity"),variants:set.children.length})),instances,cellRecords,images,setImages,probes,readback,after:{pageCount:figma.root.children.length,totalTopLevelNodes:figma.root.children.reduce((sum,page)=>sum+page.children.length,0),proofPageMatches:figma.root.children.filter(candidate=>candidate.name==="${PAGE_NAME}").length,collectionCount:collections.length,totalLocalVariables:variables.length,matchingCollections:collections.filter(collection=>collection.name.includes("e6a61d04-b04f4059-v4")).length}};
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
  const response = await connector.executeCodeViaUI(code, 60_000, FILE_KEY);
  if (!response?.success)
    throw new Error(response?.error ?? "verification failed");
  result = response.result;
} finally {
  await server.stop();
}

mkdirSync(`${EVIDENCE_DIR}/screenshots/cells`, { recursive: true });
mkdirSync(`${EVIDENCE_DIR}/screenshots/sets`, { recursive: true });
for (const image of result.images) {
  const bytes = Buffer.from(image.base64, "base64");
  const name =
    image.kind === "representative"
      ? `${image.adapterIdentity}.png`
      : `${image.adapterIdentity}__variant-${image.variant}__state-${image.state}.png`;
  const path = `${EVIDENCE_DIR}/screenshots/${image.kind === "representative" ? "" : "cells/"}${name}`;
  writeFileSync(path, bytes);
  Object.assign(image, {
    path,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
  delete image.base64;
}
for (const image of result.setImages) {
  const bytes = Buffer.from(image.base64, "base64");
  const path = `${EVIDENCE_DIR}/screenshots/sets/${image.adapterIdentity}.png`;
  writeFileSync(path, bytes);
  Object.assign(image, {
    path,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  });
  delete image.base64;
}
for (const probe of result.probes) {
  probe.resize.restorationBeforeSha256 = sha256(
    probe.resize.restorationBeforeRaw,
  );
  probe.resize.restorationAfterSha256 = sha256(
    probe.resize.restorationAfterRaw,
  );
  delete probe.resize.restorationBeforeRaw;
  delete probe.resize.restorationAfterRaw;
  probe.resize.failures = validateButtonResizeProbe(probe.resize);
  probe.resize.passed = probe.resize.failures.length === 0;
}
const normalized = JSON.parse(canonicalJson(result.readback));
const writerPlan = JSON.parse(
  readFileSync(`${EVIDENCE_DIR}/writer-plan.json`, "utf8"),
) as {
  sources: Array<{
    adapterIdentity: string;
    expectedScenePlan: ExpectedScenePlan;
  }>;
};
const sceneProofs: Array<{
  adapterIdentity: string;
  accounting: SceneComparison;
  fixedPoint: SceneFixedPointReport;
}> = (
  result.readback as Array<{
    adapterIdentity: string;
    scene: SceneNodeSnapshot;
  }>
).map((readback: { adapterIdentity: string; scene: SceneNodeSnapshot }) => {
  const planned = writerPlan.sources.find(
    (source) => source.adapterIdentity === readback.adapterIdentity,
  );
  const descriptor = sourceDescriptors.find(
    (source) => source.adapterIdentity === readback.adapterIdentity,
  );
  if (!planned || !descriptor)
    throw new Error(`scene plan absent: ${readback.adapterIdentity}`);
  return {
    adapterIdentity: readback.adapterIdentity,
    accounting: compareSceneToExpectedPlan(
      planned.expectedScenePlan,
      readback.scene,
    ),
    fixedPoint: verifySceneDerivedFixedPoint(
      readback.scene,
      descriptor.envelope,
      descriptor.instance.provenance.selection,
      collapseButtonRecipe,
      compileButtonRecipe,
    ),
  };
});
const accounting = sceneProofs.reduce(
  (sum, proof) => ({
    denominator: sum.denominator + proof.accounting.denominator,
    carried: sum.carried + proof.accounting.matched,
    codeOnly: sum.codeOnly + proof.accounting.codeOnly,
    namedRefused: sum.namedRefused + proof.accounting.refused,
    silent: sum.silent + proof.accounting.silent,
  }),
  { denominator: 0, carried: 0, codeOnly: 0, namedRefused: 0, silent: 0 },
);
const verification = {
  ...result,
  readback: {
    sceneDerived: true,
    sourceIrRead: false,
    proofs: sceneProofs,
    twoCompleteCyclesStable: sceneProofs.every(
      (proof) => proof.fixedPoint.stable,
    ),
  },
  zeroSilentAccounting: accounting,
};
delete verification.observedFacts;
writeFileSync(
  `${EVIDENCE_DIR}/normalized-live-readback.json`,
  `${JSON.stringify(normalized, null, 2)}\n`,
);
writeFileSync(
  `${EVIDENCE_DIR}/live-verification.json`,
  `${JSON.stringify(verification, null, 2)}\n`,
);
const failures = verification.probes.flatMap((probe: any) => [
  ...probe.resize.failures,
  ...(probe.variantSwitching.passed ? [] : ["variant switching"]),
  ...(probe.tokenBinding.passed ? [] : ["token binding"]),
  ...(probe.noFakeLayout.passed ? [] : ["fake layout"]),
  ...(probe.labelValidation.passed === probe.labelValidation.denominator
    ? []
    : ["label validation"]),
  ...(probe.restored ? [] : ["restoration"]),
]);
failures.push(
  ...sceneProofs.flatMap((proof) => [
    ...proof.accounting.failures.map(
      (failure) => `${proof.adapterIdentity}: ${failure}`,
    ),
    ...(proof.fixedPoint.stable
      ? []
      : [`${proof.adapterIdentity}: scene-derived fixed point`]),
  ]),
);
if (failures.length > 0) {
  throw new Error(`v4 live verification failed: ${failures.join("; ")}`);
}
console.log(
  JSON.stringify({
    pageId: verification.pageId,
    proofSectionId: verification.proofSectionId,
    pairedSectionId: verification.pairedSectionId,
    sets: verification.sets,
    pairedCells: verification.cellRecords.length,
    probes: verification.probes.map((probe: any) => ({
      adapterIdentity: probe.adapterIdentity,
      resize: probe.resize.passed,
      variantSwitching: probe.variantSwitching.passed,
      tokenBinding: probe.tokenBinding.passed,
      noFakeLayout: probe.noFakeLayout.passed,
      labels: `${probe.labelValidation.passed}/${probe.labelValidation.denominator}`,
      restored: probe.restored,
    })),
    readback: verification.readback,
    zeroSilentAccounting: verification.zeroSilentAccounting,
    after: verification.after,
  }),
);
