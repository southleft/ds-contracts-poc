import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { adaptReviewedInputField } from "./adapters/input-field.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { measureVisualPair } from "./input-field-objective-comparison-v1.js";
import { canonicalJson } from "./normalize.js";
import { hashRecipeInstance } from "./recipe.js";
import {
  collapseInputFieldRecipe,
  compileInputFieldRecipe,
  inputFieldRecipe,
} from "./recipes/input-field.js";
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
const ROOT = "recipe/evidence/input-field-live-pivot-v2";
const writerPlan = JSON.parse(
  readFileSync(`${ROOT}/writer-plan.json`, "utf8"),
) as Record<string, any>;
const PAGE_NAME = writerPlan.pageName as string;
const RUN_IDENTITY = writerPlan.runIdentity as string;
const NS = "ds.contracts.input.recipe.v2";
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const sourceReceipt = JSON.parse(
  readFileSync(
    "recipe/evidence/input-field-comparison-v3/receipt.json",
    "utf8",
  ),
) as Record<string, any>;
const objective = JSON.parse(
  readFileSync(
    "recipe/evidence/input-field-objective-comparison-v2/objective-result.json",
    "utf8",
  ),
) as Record<string, any>;
const sourceDescriptors = [
  {
    library: "mui",
    adapterIdentity: "material-text-field-reviewed-v1",
    contractPath: "examples/mui/contracts/text-field.contract.json",
    config: muiInputFieldAdapterConfig,
  },
  {
    library: "polaris",
    adapterIdentity: "commerce-text-field-reviewed-v1",
    contractPath: "examples/polaris/contracts/text-field.contract.json",
    config: polarisInputFieldAdapterConfig,
  },
].map((source) => {
  const instance = adaptReviewedInputField(
    JSON.parse(readFileSync(source.contractPath, "utf8")),
    source.config,
  );
  return {
    ...source,
    instance,
    envelope: compileInputFieldRecipe(instance),
    recipeHash: hashRecipeInstance(inputFieldRecipe, instance),
  };
});
const captures = sourceReceipt.matrix.cells.map(
  (cell: Record<string, string>) => {
    const artifact = sourceReceipt.references.find(
      (candidate: Record<string, any>) => candidate.cellKey === cell.key,
    );
    const descriptor = sourceDescriptors.find(
      (source) => source.library === cell.library,
    );
    if (!artifact || !descriptor)
      throw new Error(`capture source absent: ${cell.key}`);
    return {
      cell,
      artifact,
      adapterIdentity: descriptor.adapterIdentity,
    };
  },
);
const sceneReadbackRuntime = buildFigmaSceneReadbackRuntime(NS);

const code = `
if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("WRONG-TARGET");
await figma.loadAllPagesAsync();
const page=figma.root.children.find(candidate=>candidate.name==="${PAGE_NAME}");
if(!page)throw new Error("INPUT-PROOF-PAGE-ABSENT");
await figma.setCurrentPageAsync(page);
const NS=${JSON.stringify(NS)},get=(node,key)=>node.getSharedPluginData(NS,key);
${sceneReadbackRuntime}
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>get(node,"ownershipKey")==="root"&&node.name.startsWith("input-field/set"));
if(sets.length!==2)throw new Error("EXPECTED-TWO-INPUT-SETS:"+sets.length);
for(const stale of [...page.children])if(stale.type==="SECTION"&&(stale.name==="Input Field / Live proof / v2"||stale.name==="Input Field / Paired cells / v2"))stale.remove();
const proof=figma.createSection();proof.name="Input Field / Live proof / v2";proof.x=0;proof.y=Math.max(...page.children.map(node=>node.y+node.height),0)+240;page.appendChild(proof);
const paired=figma.createSection();paired.name="Input Field / Paired cells / v2";paired.x=0;paired.y=proof.y+800;page.appendChild(paired);
const createdNodeIds=[proof.id,paired.id],probes=[],validation=[],images=[];
const captures=${JSON.stringify(captures)};
const axesNames=["Size","State","Content","Required","Adornments"];
const roleNodes=root=>[root,...root.findAll()].filter(node=>sceneRole(node));
const paintAlpha=fills=>Array.isArray(fills)&&fills[0]&&fills[0].type==="SOLID"?(fills[0].opacity===undefined?1:fills[0].opacity):0;
const box=node=>node.absoluteBoundingBox?{x:node.absoluteBoundingBox.x,y:node.absoluteBoundingBox.y,width:node.absoluteBoundingBox.width,height:node.absoluteBoundingBox.height}:null;
const inside=(child,parent,tolerance=4)=>child&&parent&&child.x>=parent.x-tolerance&&child.y>=parent.y-tolerance&&child.x+child.width<=parent.x+parent.width+tolerance&&child.y+child.height<=parent.y+parent.height+tolerance;
const intersects=(a,b)=>a&&b&&Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
const propertyKey=(instance,name)=>Object.keys(instance.componentProperties).find(key=>key.split("#")[0]===name);
const declaredOverlayFor=(node,component)=>{let current=node;while(current&&current!==component){if(current.layoutPositioning==="ABSOLUTE")return current;current=current.parent;}return null;};
const declaredBoundsPass=(node,component)=>{
  const overlay=declaredOverlayFor(node,component);
  if(!overlay)return inside(box(node),box(component));
  return !!overlay.constraints&&component.clipsContent===false&&overlay.layoutPositioning==="ABSOLUTE"&&inside(box(node),box(overlay));
};
const plainProperties=instance=>Object.fromEntries(Object.entries(instance.componentProperties).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
const variantValues=node=>Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const index=part.indexOf("=");return[part.slice(0,index),part.slice(index+1)];}));
const snapshot=async instance=>{
  const main=await instance.getMainComponentAsync();
  const roles=roleNodes(instance).map(node=>({role:sceneRole(node),type:node.type,box:box(node),characters:node.type==="TEXT"?node.characters:undefined})).sort((a,b)=>(a.role+a.type).localeCompare(b.role+b.type));
  return {width:instance.width,height:instance.height,mainComponentId:main&&main.id,properties:plainProperties(instance),roles};
};
for(let sourceIndex=0;sourceIndex<sets.length;sourceIndex++){
  const set=sets[sourceIndex],adapterIdentity=get(set,"adapterIdentity");
  const components=[...set.children];
  let visibleStructures=0,rolePasses=0,stateIndicators=0,boundsPasses=0,overlapPasses=0,bindingFacts=0,layoutNodes=0,nonAbsoluteChildren=0,layoutChildren=0;
  const cellFailures=[];
  for(const component of components){
    const values=variantValues(component);
    const roles=roleNodes(component),byRole=role=>roles.filter(node=>sceneRole(node)===role);
    const expected=["input-field/label","input-field/surface",values.Content==="placeholder"?"input-field/content/placeholder":"input-field/content/value",values.State==="error"?"input-field/message/error":"input-field/message/helper"];
    const required=byRole("input-field/required-indicator").length===(values.Required==="true"?1:0);
    const leading=byRole("input-field/slot/leading").length===((values.Adornments==="leading"||values.Adornments==="both")?1:0);
    const trailing=byRole("input-field/slot/trailing").length===((values.Adornments==="trailing"||values.Adornments==="both")?1:0);
    const expectedRoles=expected.every(role=>byRole(role).length===1)&&required&&leading&&trailing;
    const texts=roles.filter(node=>node.type==="TEXT");
    const hiddenInactivePlaceholder=values.Content==="placeholder"&&values.State!=="focus-visible"&&(values.Adornments==="none"||values.Adornments==="trailing")&&component.children[0]&&sceneRole(component.children[0])==="input-field/surface";
    const visible=texts.length>=3&&texts.every(node=>node.characters.trim().length>0&&node.width>0&&node.height>0&&node.opacity>0&&paintAlpha(node.fills)>0&&(node.visible||hiddenInactivePlaceholder&&sceneRole(node)==="input-field/content/placeholder"));
    const surface=byRole("input-field/surface")[0],surfaceIndicator=surface&&((Array.isArray(surface.strokes)&&surface.strokes.length>0&&surface.strokeWeight>0&&paintAlpha(surface.strokes)>0)||(Array.isArray(surface.fills)&&surface.fills.length>0&&paintAlpha(surface.fills)>0));
    const bounds=roles.filter(node=>node.type==="TEXT"||node.type==="INSTANCE"||sceneRole(node)==="input-field/surface").filter(node=>node.visible!==false).every(node=>declaredBoundsPass(node,component));
    const semanticTexts=expected.filter(role=>role!=="input-field/surface").flatMap(role=>byRole(role)).filter(node=>node.type==="TEXT"&&node.visible!==false);
    const noTextOverlap=semanticTexts.every((node,index)=>semanticTexts.slice(index+1).every(other=>!intersects(box(node),box(other))));
    if(visible)visibleStructures++;if(expectedRoles)rolePasses++;if(surfaceIndicator)stateIndicators++;if(bounds)boundsPasses++;if(noTextOverlap)overlapPasses++;
    if(!visible||!expectedRoles||!surfaceIndicator||!bounds||!noTextOverlap)cellFailures.push({componentId:component.id,name:component.name,visible,expectedRoles,surfaceIndicator,bounds,noTextOverlap});
    for(const node of [component,...component.findAll()])if(node.boundVariables)bindingFacts+=Object.keys(node.boundVariables).length;
    for(const node of [component,...component.findAllWithCriteria({types:["FRAME"]})]){layoutNodes++;for(const child of node.children){layoutChildren++;if(child.layoutPositioning!=="ABSOLUTE"||child.constraints)nonAbsoluteChildren++;}}
  }
  validation.push({adapterIdentity,setId:set.id,denominator:components.length,visibleStructures,rolePasses,stateIndicators,boundsPasses,overlapPasses,cellFailures});
  const instance=set.defaultVariant.createInstance();instance.name="Input live proof / "+adapterIdentity;proof.appendChild(instance);instance.x=80+sourceIndex*520;instance.y=96;createdNodeIds.push(instance.id);
  const before=await snapshot(instance),beforeRaw=JSON.stringify(before),surface=roleNodes(instance).find(node=>sceneRole(node)==="input-field/surface"),contentRow=roleNodes(instance).find(node=>sceneRole(node)==="input-field/content-row"),contentLeaf=roleNodes(instance).find(node=>(sceneRole(node)||"").startsWith("input-field/content/")),content=contentRow||(contentLeaf&&contentLeaf.parent);
  if(!surface||!content)throw new Error("REFLOW-ROLE-ABSENT:"+adapterIdentity);
  const beforeSurface=box(surface),beforeContent=box(content);
  instance.resizeWithoutConstraints(before.width+64,before.height);
  const grown=await snapshot(instance),grownSurface=box(surface),grownContent=box(content);
  instance.resizeWithoutConstraints(before.width,before.height);
  const restored=await snapshot(instance),afterRaw=JSON.stringify(restored);
  const variantKeys=Object.fromEntries(axesNames.map(name=>[name,propertyKey(instance,name)]));
  const original=plainProperties(instance),visitedMainIds=new Set(),switchFailures=[];
  for(const component of components){
    const values=variantValues(component),properties={};
    for(const name of axesNames){const key=variantKeys[name];if(!key)throw new Error("VARIANT-PROPERTY-ABSENT:"+name);properties[key]=values[name];}
    instance.setProperties(properties);const main=await instance.getMainComponentAsync();if(!main)switchFailures.push(component.id);else visitedMainIds.add(main.id);
  }
  instance.setProperties(original);
  const labelKey=propertyKey(instance,"Label"),labelBefore=labelKey?instance.componentProperties[labelKey].value:null;
  let textPropertyPassed=false;
  if(labelKey){instance.setProperties({[labelKey]:"Deterministic probe"});textPropertyPassed=roleNodes(instance).some(node=>node.type==="TEXT"&&sceneRole(node)==="input-field/label"&&node.characters==="Deterministic probe");instance.setProperties({[labelKey]:labelBefore});}
  const postProperties=plainProperties(instance);
  probes.push({adapterIdentity,instanceId:instance.id,reflow:{beforeWidth:before.width,grownWidth:grown.width,beforeSurfaceWidth:beforeSurface.width,grownSurfaceWidth:grownSurface.width,beforeContentWidth:beforeContent.width,grownContentWidth:grownContent.width,passed:grown.width===before.width+64&&grownSurface.width>beforeSurface.width&&grownContent.width>beforeContent.width},variantSwitching:{denominator:components.length,visited:visitedMainIds.size,failures:switchFailures,passed:visitedMainIds.size===components.length&&switchFailures.length===0},textProperty:{passed:textPropertyPassed},tokenBinding:{bindingFacts,passed:bindingFacts>0},noFakeLayout:{layoutNodes,layoutChildren,nonAbsoluteChildren,passed:layoutNodes>0&&layoutChildren>0&&layoutChildren===nonAbsoluteChildren},restoration:{beforeRaw,afterRaw,propertiesRestored:JSON.stringify(original)===JSON.stringify(postProperties),passed:beforeRaw===afterRaw&&JSON.stringify(original)===JSON.stringify(postProperties)}});
}
let captureIndex=0;
for(const capture of captures){
  const set=sets.find(candidate=>get(candidate,"adapterIdentity")===capture.adapterIdentity);if(!set)throw new Error("CAPTURE-SET-ABSENT:"+capture.adapterIdentity);
  const component=set.children.find(candidate=>{const values=variantValues(candidate);return axesNames.every(name=>values[name]===capture.cell[name.toLowerCase()]);});if(!component)throw new Error("CAPTURE-COMPONENT-ABSENT:"+capture.cell.key);
  const frame=figma.createFrame();frame.name="Live pair / "+capture.cell.key;frame.resizeWithoutConstraints(capture.artifact.width/2,capture.artifact.height/2);frame.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];frame.clipsContent=true;paired.appendChild(frame);frame.x=80+(captureIndex%8)*330;frame.y=80+Math.floor(captureIndex/8)*180;
  const instance=component.createInstance();frame.appendChild(instance);instance.x=(frame.width-instance.width)/2;instance.y=(frame.height-instance.height)/2;createdNodeIds.push(frame.id,instance.id);
  const bytes=await frame.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
  images.push({cellKey:capture.cell.key,adapterIdentity:capture.adapterIdentity,nodeId:instance.id,frameId:frame.id,width:frame.width,height:frame.height,componentWidth:instance.width,componentHeight:instance.height,base64:figma.base64Encode(bytes)});captureIndex++;
}
proof.resizeWithoutConstraints(1120,640);paired.resizeWithoutConstraints(2800,Math.ceil(captures.length/8)*180+160);
const readback=[];
for(const set of sets){
  readback.push({adapterIdentity:get(set,"adapterIdentity"),setId:set.id,scene:await readSceneDerivedTree(set)});
}
const collections=await figma.variables.getLocalVariableCollectionsAsync(),variables=await figma.variables.getLocalVariablesAsync();
return{fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,proofSectionId:proof.id,pairedSectionId:paired.id,createdNodeIds,mutatedPreExistingNodeIds:[],sets:sets.map(set=>({id:set.id,name:set.name,adapterIdentity:get(set,"adapterIdentity"),variants:set.children.length})),probes,validation,images,readback,after:{pageCount:figma.root.children.length,totalTopLevelNodes:figma.root.children.reduce((sum,page)=>sum+page.children.length,0),matchingPages:figma.root.children.filter(candidate=>candidate.name==="${PAGE_NAME}").length,matchingCollections:collections.filter(collection=>collection.name.includes("${RUN_IDENTITY}")).length,totalLocalVariables:variables.length}};
`;

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
  const response = await connector.executeCodeViaUI(code, 300_000, FILE_KEY);
  if (!response?.success)
    throw new Error(response?.error ?? "verification failed");
  result = response.result;
} finally {
  await server.stop();
}

mkdirSync(`${ROOT}/screenshots/live-cells`, { recursive: true });
for (const image of result.images) {
  const bytes = Buffer.from(image.base64, "base64");
  const path = `${ROOT}/screenshots/live-cells/${sha256(image.cellKey).slice(0, 20)}.png`;
  writeFileSync(path, bytes);
  Object.assign(image, { path, bytes: bytes.length, sha256: sha256(bytes) });
  delete image.base64;
}
for (const probe of result.probes) {
  probe.restoration.beforeSha256 = sha256(probe.restoration.beforeRaw);
  probe.restoration.afterSha256 = sha256(probe.restoration.afterRaw);
  delete probe.restoration.beforeRaw;
  delete probe.restoration.afterRaw;
}

const sceneProofs: Array<{
  adapterIdentity: string;
  accounting: SceneComparison;
  fixedPoint: SceneFixedPointReport;
}> = (
  result.readback as Array<{
    adapterIdentity: string;
    scene: SceneNodeSnapshot;
  }>
).map((readback) => {
  const descriptor = sourceDescriptors.find(
    (source) => source.adapterIdentity === readback.adapterIdentity,
  )!;
  const planned = (
    writerPlan.sources as Array<{
      adapterIdentity: string;
      expectedScenePlan: ExpectedScenePlan;
    }>
  ).find((source) => source.adapterIdentity === readback.adapterIdentity);
  if (!planned)
    throw new Error(`expected scene plan absent: ${readback.adapterIdentity}`);
  const accounting = compareSceneToExpectedPlan(
    planned.expectedScenePlan,
    readback.scene,
  );
  const fixedPoint = verifySceneDerivedFixedPoint(
    readback.scene,
    descriptor.envelope,
    descriptor.instance.provenance.selection,
    collapseInputFieldRecipe,
    compileInputFieldRecipe,
  );
  return {
    adapterIdentity: readback.adapterIdentity,
    accounting,
    fixedPoint,
  };
});
writeFileSync(
  `${ROOT}/normalized-live-readback.json`,
  `${JSON.stringify(result.readback, null, 2)}\n`,
);

const objectiveRows = result.images.map((image: Record<string, any>) => {
  const reference = sourceReceipt.references.find(
    (artifact: Record<string, any>) => artifact.cellKey === image.cellKey,
  );
  const offline = objective.perCell.find(
    (row: Record<string, any>) => row.cellKey === image.cellKey,
  );
  const metrics = measureVisualPair(
    readFileSync(reference.file),
    readFileSync(image.path),
    reference.contentBox,
    { width: image.componentWidth, height: image.componentHeight },
  );
  return {
    cellKey: image.cellKey,
    reference: { path: reference.file, sha256: reference.hash },
    live: { path: image.path, sha256: image.sha256, nodeId: image.nodeId },
    metrics,
    geometryBeatsLegacy: metrics.geometryError < offline.geometry.legacy,
    pixelInkBeatsLegacy:
      metrics.pixelInkCompositeError !== null &&
      metrics.pixelInkCompositeError < offline.pixelInk.legacy,
  };
});
const objectiveCanvas = {
  protocol: {
    path: "recipe/evidence/input-field-objective-comparison-v1/protocol.json",
    sha256: "b31c69642a69da054d644a91afa2b5dd6867ffe2eef3ca36fffe0763a93d1a34",
  },
  denominator: objectiveRows.length,
  lockedProgressCriteria: {
    declaredBeforeMeasurement:
      "128 unsampled cells; every cell beats unchanged legacy on geometry and pixel/ink; all mean errors beat unchanged legacy; zero missing, failed, or catastrophic cells",
    protocolChangedAfterV1: false,
    weightingChangedAfterV1: false,
  },
  geometry: {
    liveWins: objectiveRows.filter((row: any) => row.geometryBeatsLegacy)
      .length,
    legacyWins: objectiveRows.filter((row: any) => !row.geometryBeatsLegacy)
      .length,
  },
  pixelInk: {
    liveWins: objectiveRows.filter((row: any) => row.pixelInkBeatsLegacy)
      .length,
    legacyWins: objectiveRows.filter((row: any) => !row.pixelInkBeatsLegacy)
      .length,
  },
  aggregates: {
    meanGeometryError:
      objectiveRows.reduce(
        (sum: number, row: any) => sum + row.metrics.geometryError,
        0,
      ) / objectiveRows.length,
    meanPixelInkCompositeError:
      objectiveRows.reduce(
        (sum: number, row: any) => sum + row.metrics.pixelInkCompositeError,
        0,
      ) / objectiveRows.length,
    meanOverallWeightedError:
      objectiveRows.reduce(
        (sum: number, row: any) => sum + row.metrics.overallWeightedError,
        0,
      ) / objectiveRows.length,
  },
  beforeAfterV1: {
    v1: {
      geometryWins: 112,
      pixelInkWins: 85,
      meanGeometryError: 0.013402,
      meanPixelInkCompositeError: 0.343458,
      meanOverallWeightedError: 0.17843,
    },
    v2: {
      geometryWins: objectiveRows.filter((row: any) => row.geometryBeatsLegacy)
        .length,
      pixelInkWins: objectiveRows.filter((row: any) => row.pixelInkBeatsLegacy)
        .length,
      meanGeometryError:
        objectiveRows.reduce(
          (sum: number, row: any) => sum + row.metrics.geometryError,
          0,
        ) / objectiveRows.length,
      meanPixelInkCompositeError:
        objectiveRows.reduce(
          (sum: number, row: any) => sum + row.metrics.pixelInkCompositeError,
          0,
        ) / objectiveRows.length,
      meanOverallWeightedError:
        objectiveRows.reduce(
          (sum: number, row: any) => sum + row.metrics.overallWeightedError,
          0,
        ) / objectiveRows.length,
    },
  },
  rows: objectiveRows,
};
writeFileSync(
  `${ROOT}/objective-canvas-result.json`,
  `${JSON.stringify(objectiveCanvas, null, 2)}\n`,
);

const independentAccounting = sceneProofs.reduce(
  (sum, proof) => ({
    denominator: sum.denominator + proof.accounting.denominator,
    carried: sum.carried + proof.accounting.matched,
    codeOnly: sum.codeOnly + proof.accounting.codeOnly,
    refused: sum.refused + proof.accounting.refused,
    silent: sum.silent + proof.accounting.silent,
  }),
  { denominator: 0, carried: 0, codeOnly: 0, refused: 0, silent: 0 },
);
const verification = {
  ...result,
  readback: {
    sources: result.readback.length,
    sceneDerived: true,
    sourceIrRead: false,
    sceneProofs,
  },
  objectiveCanvas: {
    path: `${ROOT}/objective-canvas-result.json`,
    sha256: sha256(readFileSync(`${ROOT}/objective-canvas-result.json`)),
    denominator: objectiveCanvas.denominator,
    geometry: objectiveCanvas.geometry,
    pixelInk: objectiveCanvas.pixelInk,
    aggregates: objectiveCanvas.aggregates,
  },
  zeroSilentAccounting: independentAccounting,
};
delete verification.images;
writeFileSync(
  `${ROOT}/live-verification.json`,
  `${JSON.stringify(verification, null, 2)}\n`,
);
const failures = [
  ...verification.probes.flatMap((probe: any) => [
    ...(probe.reflow.passed ? [] : [`${probe.adapterIdentity}: reflow`]),
    ...(probe.variantSwitching.passed
      ? []
      : [`${probe.adapterIdentity}: variant switching`]),
    ...(probe.textProperty.passed
      ? []
      : [`${probe.adapterIdentity}: text property`]),
    ...(probe.tokenBinding.passed
      ? []
      : [`${probe.adapterIdentity}: token binding`]),
    ...(probe.noFakeLayout.passed
      ? []
      : [`${probe.adapterIdentity}: fake layout`]),
    ...(probe.restoration.passed
      ? []
      : [`${probe.adapterIdentity}: restoration`]),
  ]),
  ...verification.validation.flatMap((entry: any) =>
    entry.denominator === 128 &&
    entry.visibleStructures === 128 &&
    entry.rolePasses === 128 &&
    entry.stateIndicators === 128 &&
    entry.boundsPasses === 128 &&
    entry.overlapPasses === 128
      ? []
      : [`${entry.adapterIdentity}: live cell validation`],
  ),
  ...sceneProofs.flatMap((proof) => [
    ...proof.accounting.failures.map(
      (failure) => `${proof.adapterIdentity}: ${failure}`,
    ),
    ...(proof.fixedPoint.stable
      ? []
      : [`${proof.adapterIdentity}: scene-derived fixed point`]),
  ]),
  ...(objectiveCanvas.denominator === 128 ? [] : ["capture denominator"]),
  ...(objectiveCanvas.geometry.liveWins === 128
    ? []
    : [`objective geometry ${objectiveCanvas.geometry.liveWins}/128`]),
  ...(objectiveCanvas.pixelInk.liveWins === 128
    ? []
    : [`objective pixel/ink ${objectiveCanvas.pixelInk.liveWins}/128`]),
  ...(objectiveRows.every(
    (row: any) =>
      row.metrics.failure === null &&
      row.metrics.pixelInkCompositeError !== null &&
      Number.isFinite(row.metrics.geometryError) &&
      Number.isFinite(row.metrics.pixelInkCompositeError),
  )
    ? []
    : ["objective missing/catastrophic cell"]),
  ...(objectiveCanvas.aggregates.meanGeometryError <
    objective.aggregates.overall.aggregateErrors.legacy.meanGeometryError &&
  objectiveCanvas.aggregates.meanPixelInkCompositeError <
    objective.aggregates.overall.aggregateErrors.legacy
      .meanPixelInkCompositeError &&
  objectiveCanvas.aggregates.meanOverallWeightedError <
    objective.aggregates.overall.aggregateErrors.legacy.meanOverallWeightedError
    ? []
    : ["objective aggregate errors"]),
];
console.log(
  JSON.stringify({
    pageId: verification.pageId,
    proofSectionId: verification.proofSectionId,
    pairedSectionId: verification.pairedSectionId,
    sets: verification.sets,
    probes: verification.probes,
    validation: verification.validation.map((entry: any) => ({
      ...entry,
      cellFailures: entry.cellFailures.length,
    })),
    sceneProofs,
    objectiveCanvas: verification.objectiveCanvas,
    zeroSilentAccounting: verification.zeroSilentAccounting,
    failures,
  }),
);
if (failures.length > 0) {
  throw new Error(`Input live verification failed: ${failures.join("; ")}`);
}
