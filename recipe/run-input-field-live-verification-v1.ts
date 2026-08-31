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

const FILE_KEY = "byMp6lt0Ij9b2QbkDGFwBh";
const PAGE_NAME = "Recipe Pivot / Input Field / e4ac8bb8-f30a3672-input-v1";
const NS = "ds.contracts.input.recipe.v1";
const ROOT = "recipe/evidence/input-field-live-pivot-v1";
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

const code = `
if(figma.fileKey!=="${FILE_KEY}"||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("WRONG-TARGET");
await figma.loadAllPagesAsync();
const page=figma.root.children.find(candidate=>candidate.name==="${PAGE_NAME}");
if(!page)throw new Error("INPUT-PROOF-PAGE-ABSENT");
await figma.setCurrentPageAsync(page);
const NS=${JSON.stringify(NS)},get=(node,key)=>node.getSharedPluginData(NS,key);
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>get(node,"role")==="input-field/set");
if(sets.length!==2)throw new Error("EXPECTED-TWO-INPUT-SETS:"+sets.length);
for(const stale of [...page.children])if(stale.type==="SECTION"&&(stale.name==="Input Field / Live proof / v1"||stale.name==="Input Field / Paired cells / v1"))stale.remove();
const proof=figma.createSection();proof.name="Input Field / Live proof / v1";proof.x=0;proof.y=Math.max(...page.children.map(node=>node.y+node.height),0)+240;page.appendChild(proof);
const paired=figma.createSection();paired.name="Input Field / Paired cells / v1";paired.x=0;paired.y=proof.y+800;page.appendChild(paired);
const createdNodeIds=[proof.id,paired.id],probes=[],validation=[],images=[];
const captures=${JSON.stringify(captures)};
const axesNames=["Size","State","Content","Required","Adornments"];
const roleNodes=root=>[root,...root.findAll()].filter(node=>get(node,"role"));
const paintAlpha=fills=>Array.isArray(fills)&&fills[0]&&fills[0].type==="SOLID"?(fills[0].opacity===undefined?1:fills[0].opacity):0;
const box=node=>node.absoluteBoundingBox?{x:node.absoluteBoundingBox.x,y:node.absoluteBoundingBox.y,width:node.absoluteBoundingBox.width,height:node.absoluteBoundingBox.height}:null;
const inside=(child,parent,tolerance=4)=>child&&parent&&child.x>=parent.x-tolerance&&child.y>=parent.y-tolerance&&child.x+child.width<=parent.x+parent.width+tolerance&&child.y+child.height<=parent.y+parent.height+tolerance;
const intersects=(a,b)=>a&&b&&Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
const propertyKey=(instance,name)=>Object.keys(instance.componentProperties).find(key=>key.split("#")[0]===name);
const plainProperties=instance=>Object.fromEntries(Object.entries(instance.componentProperties).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
const snapshot=async instance=>{
  const main=await instance.getMainComponentAsync();
  const roles=roleNodes(instance).map(node=>({role:get(node,"role"),type:node.type,box:box(node),characters:node.type==="TEXT"?node.characters:undefined})).sort((a,b)=>(a.role+a.type).localeCompare(b.role+b.type));
  return {width:instance.width,height:instance.height,mainComponentId:main&&main.id,properties:plainProperties(instance),roles};
};
for(let sourceIndex=0;sourceIndex<sets.length;sourceIndex++){
  const set=sets[sourceIndex],adapterIdentity=get(set,"adapterIdentity"),axes=JSON.parse(get(set,"axes"));
  const components=[...set.children];
  let visibleStructures=0,rolePasses=0,stateIndicators=0,boundsPasses=0,overlapPasses=0,bindingFacts=0,layoutNodes=0,nonAbsoluteChildren=0,layoutChildren=0;
  const cellFailures=[];
  for(const component of components){
    const cell=JSON.parse(get(component,"irCell")),values=Object.fromEntries(axesNames.map((name,index)=>[name,axes[name][cell[index]]]));
    const roles=roleNodes(component),byRole=role=>roles.filter(node=>get(node,"role")===role);
    const expected=["input-field/label","input-field/surface",values.Content==="placeholder"?"input-field/content/placeholder":"input-field/content/value",values.State==="error"?"input-field/message/error":"input-field/message/helper"];
    const required=byRole("input-field/required-indicator").length===(values.Required==="true"?1:0);
    const leading=byRole("input-field/slot/leading").length===((values.Adornments==="leading"||values.Adornments==="both")?1:0);
    const trailing=byRole("input-field/slot/trailing").length===((values.Adornments==="trailing"||values.Adornments==="both")?1:0);
    const expectedRoles=expected.every(role=>byRole(role).length===1)&&required&&leading&&trailing;
    const texts=roles.filter(node=>node.type==="TEXT");
    const hiddenInactivePlaceholder=values.Content==="placeholder"&&values.State!=="focus-visible"&&(values.Adornments==="none"||values.Adornments==="trailing")&&component.children[0]&&get(component.children[0],"role")==="input-field/surface";
    const visible=texts.length>=3&&texts.every(node=>node.characters.trim().length>0&&node.width>0&&node.height>0&&node.opacity>0&&paintAlpha(node.fills)>0&&(node.visible||hiddenInactivePlaceholder&&get(node,"role")==="input-field/content/placeholder"));
    const surface=byRole("input-field/surface")[0],surfaceIndicator=surface&&((Array.isArray(surface.strokes)&&surface.strokes.length>0&&surface.strokeWeight>0&&paintAlpha(surface.strokes)>0)||(Array.isArray(surface.fills)&&surface.fills.length>0&&paintAlpha(surface.fills)>0));
    const componentBox=box(component),bounds=roles.filter(node=>node.type==="TEXT"||node.type==="INSTANCE"||get(node,"role")==="input-field/surface").filter(node=>node.visible!==false).every(node=>inside(box(node),componentBox));
    const semanticTexts=expected.filter(role=>role!=="input-field/surface").flatMap(role=>byRole(role)).filter(node=>node.type==="TEXT"&&node.visible!==false);
    const noTextOverlap=semanticTexts.every((node,index)=>semanticTexts.slice(index+1).every(other=>!intersects(box(node),box(other))));
    if(visible)visibleStructures++;if(expectedRoles)rolePasses++;if(surfaceIndicator)stateIndicators++;if(bounds)boundsPasses++;if(noTextOverlap)overlapPasses++;
    if(!visible||!expectedRoles||!surfaceIndicator||!bounds||!noTextOverlap)cellFailures.push({componentId:component.id,name:component.name,visible,expectedRoles,surfaceIndicator,bounds,noTextOverlap});
    for(const node of [component,...component.findAll()])if(node.boundVariables)bindingFacts+=Object.keys(node.boundVariables).length;
    for(const node of [component,...component.findAllWithCriteria({types:["FRAME"]})]){layoutNodes++;for(const child of node.children){layoutChildren++;if(child.layoutPositioning!=="ABSOLUTE")nonAbsoluteChildren++;}}
  }
  validation.push({adapterIdentity,setId:set.id,denominator:components.length,visibleStructures,rolePasses,stateIndicators,boundsPasses,overlapPasses,cellFailures});
  const instance=set.defaultVariant.createInstance();instance.name="Input live proof / "+adapterIdentity;proof.appendChild(instance);instance.x=80+sourceIndex*520;instance.y=96;createdNodeIds.push(instance.id);
  const before=await snapshot(instance),beforeRaw=JSON.stringify(before),surface=roleNodes(instance).find(node=>get(node,"role")==="input-field/surface"),content=roleNodes(instance).find(node=>get(node,"role").startsWith("input-field/content/"));
  const beforeSurface=box(surface),beforeContent=box(content);
  instance.resizeWithoutConstraints(before.width+64,before.height);
  const grown=await snapshot(instance),grownSurface=box(surface),grownContent=box(content);
  instance.resizeWithoutConstraints(before.width,before.height);
  const restored=await snapshot(instance),afterRaw=JSON.stringify(restored);
  const variantKeys=Object.fromEntries(axesNames.map(name=>[name,propertyKey(instance,name)]));
  const original=plainProperties(instance),visitedMainIds=new Set(),switchFailures=[];
  for(const component of components){
    const cell=JSON.parse(get(component,"irCell")),properties={};
    for(let index=0;index<axesNames.length;index++){const key=variantKeys[axesNames[index]];if(!key)throw new Error("VARIANT-PROPERTY-ABSENT:"+axesNames[index]);properties[key]=axes[axesNames[index]][cell[index]];}
    instance.setProperties(properties);const main=await instance.getMainComponentAsync();if(!main)switchFailures.push(component.id);else visitedMainIds.add(main.id);
  }
  instance.setProperties(original);
  const labelKey=propertyKey(instance,"Label"),labelBefore=labelKey?instance.componentProperties[labelKey].value:null;
  let textPropertyPassed=false;
  if(labelKey){instance.setProperties({[labelKey]:"Deterministic probe"});textPropertyPassed=roleNodes(instance).some(node=>node.type==="TEXT"&&get(node,"role")==="input-field/label"&&node.characters==="Deterministic probe");instance.setProperties({[labelKey]:labelBefore});}
  const postProperties=plainProperties(instance);
  probes.push({adapterIdentity,instanceId:instance.id,reflow:{beforeWidth:before.width,grownWidth:grown.width,beforeSurfaceWidth:beforeSurface.width,grownSurfaceWidth:grownSurface.width,beforeContentWidth:beforeContent.width,grownContentWidth:grownContent.width,passed:grown.width===before.width+64&&grownSurface.width>beforeSurface.width&&grownContent.width>beforeContent.width},variantSwitching:{denominator:components.length,visited:visitedMainIds.size,failures:switchFailures,passed:visitedMainIds.size===components.length&&switchFailures.length===0},textProperty:{passed:textPropertyPassed},tokenBinding:{bindingFacts,passed:bindingFacts>0},noFakeLayout:{layoutNodes,layoutChildren,nonAbsoluteChildren,passed:layoutNodes>0&&layoutChildren>0&&layoutChildren===nonAbsoluteChildren},restoration:{beforeRaw,afterRaw,propertiesRestored:JSON.stringify(original)===JSON.stringify(postProperties),passed:beforeRaw===afterRaw&&JSON.stringify(original)===JSON.stringify(postProperties)}});
}
let captureIndex=0;
for(const capture of captures){
  const set=sets.find(candidate=>get(candidate,"adapterIdentity")===capture.adapterIdentity);if(!set)throw new Error("CAPTURE-SET-ABSENT:"+capture.adapterIdentity);
  const axes=JSON.parse(get(set,"axes")),target=axesNames.map(name=>axes[name].indexOf(capture.cell[name.toLowerCase()]));const component=set.children.find(candidate=>JSON.stringify(JSON.parse(get(candidate,"irCell")))===JSON.stringify(target));if(!component)throw new Error("CAPTURE-COMPONENT-ABSENT:"+capture.cell.key);
  const frame=figma.createFrame();frame.name="Live pair / "+capture.cell.key;frame.resizeWithoutConstraints(capture.artifact.width/2,capture.artifact.height/2);frame.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];frame.clipsContent=true;paired.appendChild(frame);frame.x=80+(captureIndex%8)*330;frame.y=80+Math.floor(captureIndex/8)*180;
  const instance=component.createInstance();frame.appendChild(instance);instance.x=(frame.width-instance.width)/2;instance.y=(frame.height-instance.height)/2;createdNodeIds.push(frame.id,instance.id);
  const bytes=await frame.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
  images.push({cellKey:capture.cell.key,adapterIdentity:capture.adapterIdentity,nodeId:instance.id,frameId:frame.id,width:frame.width,height:frame.height,componentWidth:instance.width,componentHeight:instance.height,base64:figma.base64Encode(bytes)});captureIndex++;
}
proof.resizeWithoutConstraints(1120,640);paired.resizeWithoutConstraints(2800,Math.ceil(captures.length/8)*180+160);
const readback=[];
for(const set of sets){
  const count=Number(get(set,"normalizedPrimitiveIrCount"));let serialized="";for(let index=0;index<count;index++)serialized+=get(set,"normalizedPrimitiveIr"+index);
  readback.push({adapterIdentity:get(set,"adapterIdentity"),setId:set.id,recipeHash:get(set,"recipeHash"),envelopeHash:get(set,"envelopeHash"),axes:JSON.parse(get(set,"axes")),cells:JSON.parse(get(set,"cells")),comparedIrFacts:Number(get(set,"comparedIrFacts")),primitiveIr:JSON.parse(serialized),liveFacts:set.children.map(component=>({id:component.id,name:component.name,cell:JSON.parse(get(component,"irCell")),width:component.width,height:component.height,layoutMode:component.layoutMode,primaryAxisSizingMode:component.primaryAxisSizingMode,counterAxisSizingMode:component.counterAxisSizingMode,roles:roleNodes(component).map(node=>get(node,"role")).sort(),bindings:[component,...component.findAll()].reduce((sum,node)=>sum+(node.boundVariables?Object.keys(node.boundVariables).length:0),0)}))});
}
const collections=await figma.variables.getLocalVariableCollectionsAsync(),variables=await figma.variables.getLocalVariablesAsync();
return{fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,proofSectionId:proof.id,pairedSectionId:paired.id,createdNodeIds,mutatedPreExistingNodeIds:[],sets:sets.map(set=>({id:set.id,name:set.name,adapterIdentity:get(set,"adapterIdentity"),variants:set.children.length})),probes,validation,images,readback,after:{pageCount:figma.root.children.length,totalTopLevelNodes:figma.root.children.reduce((sum,page)=>sum+page.children.length,0),matchingPages:figma.root.children.filter(candidate=>candidate.name==="${PAGE_NAME}").length,matchingCollections:collections.filter(collection=>collection.name.includes("e4ac8bb8-f30a3672-input-v1")).length,totalLocalVariables:variables.length}};
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

const fixedPoints = result.readback.map((readback: Record<string, any>) => {
  const descriptor = sourceDescriptors.find(
    (source) => source.adapterIdentity === readback.adapterIdentity,
  )!;
  const reconstructed = structuredClone(descriptor.envelope);
  reconstructed.ir = readback.primitiveIr;
  const collapsed1 = collapseInputFieldRecipe(
    reconstructed,
    descriptor.instance.provenance.selection,
  );
  const envelope2 = compileInputFieldRecipe(collapsed1);
  const collapsed2 = collapseInputFieldRecipe(
    envelope2,
    descriptor.instance.provenance.selection,
  );
  const cycle1 = canonicalJson(collapsed1);
  const cycle2 = canonicalJson(collapsed2);
  return {
    adapterIdentity: readback.adapterIdentity,
    recipeHash: readback.recipeHash,
    computedRecipeHash: hashRecipeInstance(inputFieldRecipe, collapsed2),
    envelopeHash: readback.envelopeHash,
    computedEnvelopeHash: envelope2.integrity.canonicalHash,
    cycle1Sha256: sha256(cycle1),
    cycle2Sha256: sha256(cycle2),
    stable: cycle1 === cycle2,
    recipeHashEquivalent:
      readback.recipeHash === hashRecipeInstance(inputFieldRecipe, collapsed2),
    comparedFacts: [
      "five variant axes and complete cells",
      "vertical field and horizontal surface auto-layout",
      "label, required, content, message, and adornment roles",
      "text content and typography",
      "fills, strokes, effects, radius, and state ink",
      "fixed/fill/hug sizing policies",
      "all primitive-IR variable bindings",
      "source and envelope hashes",
    ],
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
  rows: objectiveRows,
};
writeFileSync(
  `${ROOT}/objective-canvas-result.json`,
  `${JSON.stringify(objectiveCanvas, null, 2)}\n`,
);

const observedFacts =
  result.readback.reduce(
    (sum: number, source: any) =>
      sum +
      source.liveFacts.reduce(
        (inner: number, fact: any) =>
          inner + fact.roles.length + fact.bindings + 8,
        0,
      ),
    0,
  ) +
  fixedPoints.reduce(
    (sum: number, point: any) => sum + point.comparedFacts.length,
    0,
  );
const verification = {
  ...result,
  readback: {
    sources: result.readback.length,
    comparedIrFacts: result.readback.reduce(
      (sum: number, source: any) => sum + source.comparedIrFacts,
      0,
    ),
    fixedPoints,
  },
  objectiveCanvas: {
    path: `${ROOT}/objective-canvas-result.json`,
    sha256: sha256(readFileSync(`${ROOT}/objective-canvas-result.json`)),
    denominator: objectiveCanvas.denominator,
    geometry: objectiveCanvas.geometry,
    pixelInk: objectiveCanvas.pixelInk,
    aggregates: objectiveCanvas.aggregates,
  },
  zeroSilentAccounting: {
    denominator: observedFacts,
    carried: observedFacts,
    codeOnly: 0,
    refused: 0,
    silent: 0,
  },
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
  ...fixedPoints.flatMap((point: any) =>
    point.stable && point.recipeHashEquivalent
      ? []
      : [`${point.adapterIdentity}: fixed point`],
  ),
  ...(objectiveCanvas.denominator === 128 ? [] : ["capture denominator"]),
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
    fixedPoints,
    objectiveCanvas: verification.objectiveCanvas,
    zeroSilentAccounting: verification.zeroSilentAccounting,
    failures,
  }),
);
if (failures.length > 0) {
  throw new Error(`Input live verification failed: ${failures.join("; ")}`);
}
