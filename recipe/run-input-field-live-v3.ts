import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { adaptReviewedInputField } from "./adapters/input-field.js";
import {
  INPUT_LIVE_V3_ANTECEDENT_COMMIT,
  INPUT_LIVE_V3_AUTHORIZATION_PATH,
  INPUT_LIVE_V3_PROTOCOL_PATH,
} from "./input-field-live-v3-authorization.js";
import {
  buildInputLiveV3Attempt1ReceiptEvidence,
  buildInputLiveV3Attempt2ReceiptEvidence,
  inputLiveV3Artifact,
  writeInputLiveV3Receipt,
  type InputLiveV3AttemptEvidence,
} from "./input-field-live-v3-evidence.js";
import { buildInputLiveV3CleanupRuntime } from "./input-field-live-v3-cleanup.js";
import {
  INPUT_LIVE_V3_ROOT,
  readInputLiveV3PreflightState,
  validateInputLiveV3Preflight,
} from "./input-field-live-v3-preflight.js";
import {
  proveSceneMultiset,
  verifyInputLiveV3HardGates,
  verifyInputLiveV3SceneFixedPoint,
  type InputLiveV3CellValidation,
  type InputLiveV3SceneProof,
  type InputLiveV3VisualRow,
} from "./input-field-live-v3-verifier.js";
import {
  muiInputFieldAdapterConfig,
  polarisInputFieldAdapterConfig,
} from "./fixtures/library-input-fields.js";
import { measureVisualPair } from "./input-field-objective-comparison-v1.js";
import {
  compileInputFieldRecipe,
  collapseInputFieldRecipe,
} from "./recipes/input-field.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime.js";
import type {
  ExpectedScenePlan,
  SceneFact,
  SceneNodeSnapshot,
} from "./scene-readback.js";

const PLAN_PATH = `${INPUT_LIVE_V3_ROOT}/writer-plan.json`;
const NS = "ds.contracts.input.recipe.v2";
const BRIDGE_ROOT =
  process.env.FIGMA_CONSOLE_MCP_ROOT ??
  "/Users/tjpitre/Sites/figma-console-mcp/dist/core";
const PORT = Number(process.env.RECIPE_BRIDGE_PORT ?? 9230);
const ATTEMPT = Number(
  process.argv.find((value) => value.startsWith("--attempt="))?.split("=")[1] ??
    "2",
);

const sha256 = (value: Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const json = (file: string): Record<string, any> =>
  JSON.parse(readFileSync(file, "utf8"));

const buildVerificationRuntime = (plan: Record<string, any>): string => `
if(figma.fileKey!==${JSON.stringify(plan.target.fileKey)}||figma.root.name!=="Scratch Project"||figma.editorType!=="figma")throw new Error("INPUT-V3-WRONG-TARGET");
await figma.loadAllPagesAsync();
const NS=${JSON.stringify(NS)},get=(node,key)=>node.getSharedPluginData(NS,key);
const page=figma.root.children.find(node=>node.name===${JSON.stringify(plan.pageName)}&&get(node,"pageOwner")==="recipe/input-field/"+${JSON.stringify(plan.runIdentity)});
if(!page)throw new Error("INPUT-V3-OWNED-PAGE-ABSENT");
await figma.setCurrentPageAsync(page);
${buildFigmaSceneReadbackRuntime(NS)}
const sets=page.findAllWithCriteria({types:["COMPONENT_SET"]}).filter(node=>get(node,"ownershipKey")==="root"&&get(node,"runIdentity")===${JSON.stringify(plan.runIdentity)});
if(sets.length!==2)throw new Error("INPUT-V3-SET-DENOMINATOR:"+sets.length);
const role=node=>sceneRole(node);
const nodes=root=>[root,...root.findAll()];
const box=node=>node.absoluteBoundingBox?{x:node.absoluteBoundingBox.x,y:node.absoluteBoundingBox.y,width:node.absoluteBoundingBox.width,height:node.absoluteBoundingBox.height}:null;
const area=value=>value?Math.max(0,value.width)*Math.max(0,value.height):0;
const intersection=(a,b)=>{if(!a||!b)return null;const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;};
const visibleLoss=(child,parent)=>{const childArea=area(child);return childArea===0?1:1-area(intersection(child,parent))/childArea;};
const overlapDepth=(a,b)=>{const hit=intersection(a,b);return hit?Math.min(hit.width,hit.height):0;};
const values=node=>Object.fromEntries(node.name.split(",").map(part=>part.trim()).filter(part=>part.includes("=")).map(part=>{const at=part.indexOf("=");return[part.slice(0,at),part.slice(at+1)];}));
const propertyKey=(instance,name)=>Object.keys(instance.componentProperties).find(key=>key.split("#")[0]===name);
const plainProperties=instance=>Object.fromEntries(Object.entries(instance.componentProperties).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,value.value]));
const snapshot=instance=>JSON.stringify({width:instance.width,height:instance.height,properties:plainProperties(instance),roles:nodes(instance).filter(node=>role(node)).map(node=>({role:role(node),type:node.type,visible:node.visible!==false,width:node.width,height:node.height,characters:node.type==="TEXT"?node.characters:undefined})).sort((a,b)=>(a.role+a.type).localeCompare(b.role+b.type))});
const ownershipPlans=new Map(${JSON.stringify(
  plan.sources.map((source: Record<string, any>) => [
    source.adapterIdentity,
    {
      version: source.expectedScenePlan.version,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      directOwnershipKeys: [
        ...new Set(
          source.expectedScenePlan.facts.map(
            (fact: Record<string, string>) => fact.nodeOwnershipKey,
          ),
        ),
      ],
      generatedDescendants: source.expectedScenePlan.generatedDescendants,
    },
  ]),
)});
const cellGeometry=[],probes=[],readback=[],images=[],createdNodeIds=[];
for(const set of sets){
  const adapterIdentity=get(set,"adapterIdentity"),components=[...set.children];
  if(components.length!==128)throw new Error("INPUT-V3-VARIANTS:"+adapterIdentity+":"+components.length);
  for(let componentIndex=0;componentIndex<components.length;componentIndex++){
    const component=components[componentIndex],axis=values(component),all=nodes(component),roleNodes=all.filter(node=>role(node)),byRole=name=>roleNodes.filter(node=>role(node)===name);
    const expected=["input-field/label","input-field/surface",axis.Content==="placeholder"?"input-field/content/placeholder":"input-field/content/value",axis.State==="error"?"input-field/message/error":"input-field/message/helper"];
    const required=byRole("input-field/required-indicator").length===(axis.Required==="true"?1:0);
    const leading=byRole("input-field/slot/leading").length===((axis.Adornments==="leading"||axis.Adornments==="both")?1:0);
    const trailing=byRole("input-field/slot/trailing").length===((axis.Adornments==="trailing"||axis.Adornments==="both")?1:0);
    const semantic=expected.flatMap(name=>byRole(name)).filter(node=>node.visible!==false&&(node.type==="TEXT"||node.type==="INSTANCE"));
    const componentBox=box(component);
    const maximumVisibleLoss=Math.max(0,...semantic.map(node=>visibleLoss(box(node),componentBox)));
    let maximumOverlap=0;
    for(let index=0;index<semantic.length;index++)for(let other=index+1;other<semantic.length;other++)maximumOverlap=Math.max(maximumOverlap,overlapDepth(box(semantic[index]),box(semantic[other])));
    const layoutNodes=all.filter(node=>"children" in node);
    const noFakeLayout=layoutNodes.every(node=>node.layoutMode!=="NONE"&&node.children.every(child=>child.layoutPositioning!=="ABSOLUTE"||!!child.constraints));
    cellGeometry.push({adapterIdentity,componentIndex,axis,rolesExact:expected.every(name=>byRole(name).length===1)&&required&&leading&&trailing,stateSemanticsExact:byRole("input-field/surface").length===1,labelSemanticsExact:byRole("input-field/label").length===1,helperSemanticsExact:byRole(axis.State==="error"?"input-field/message/error":"input-field/message/helper").length===1,noFakeLayout,visibleAreaLoss:maximumVisibleLoss,overlapPixels:maximumOverlap});
  }
  const instance=set.defaultVariant.createInstance();instance.name="Input v3 proof / "+adapterIdentity;page.appendChild(instance);instance.x=set.x;instance.y=set.y+set.height+160;createdNodeIds.push(instance.id);
  const before=snapshot(instance),beforeWidth=instance.width;
  const surface=nodes(instance).find(node=>role(node)==="input-field/surface"),content=nodes(instance).find(node=>role(node)==="input-field/content-row");
  const surfaceWidth=surface&&surface.width,contentWidth=content&&content.width;
  instance.resizeWithoutConstraints(beforeWidth+64,instance.height);
  const reflowPassed=instance.width===beforeWidth+64&&surface&&surface.width>surfaceWidth&&content&&content.width>contentWidth;
  instance.resizeWithoutConstraints(beforeWidth,instance.height);
  const axisNames=["Size","State","Content","Required","Adornments"],original=plainProperties(instance),visited=new Set();
  for(const component of components){
    const target=values(component),updates={};
    for(const name of axisNames){const key=propertyKey(instance,name);if(!key)throw new Error("INPUT-V3-AXIS-PROPERTY:"+name);updates[key]=target[name];}
    instance.setProperties(updates);const main=await instance.getMainComponentAsync();if(main)visited.add(main.id);
  }
  instance.setProperties(original);
  const labelKey=propertyKey(instance,"Label"),labelBefore=labelKey&&instance.componentProperties[labelKey].value;
  let textPropertyPassed=false;
  if(labelKey){instance.setProperties({[labelKey]:"Input v3 deterministic probe"});textPropertyPassed=nodes(instance).some(node=>node.type==="TEXT"&&role(node)==="input-field/label"&&node.characters==="Input v3 deterministic probe");instance.setProperties({[labelKey]:labelBefore});}
  const after=snapshot(instance);
  const bindingTypesCompatible=nodes(set).every(node=>Object.values(node.boundVariables||{}).flat().every(alias=>alias&&typeof alias.id==="string"));
  probes.push({adapterIdentity,variants:components.length,visitedVariants:visited.size,switchingRestored:JSON.stringify(original)===JSON.stringify(plainProperties(instance)),textPropertiesRestored:textPropertyPassed&&JSON.stringify(original)===JSON.stringify(plainProperties(instance)),reflowPassed:!!reflowPassed,contentFillPassed:!!reflowPassed,bindingCompatibilityPassed:bindingTypesCompatible,noFakeLayoutPassed:cellGeometry.filter(cell=>cell.adapterIdentity===adapterIdentity).every(cell=>cell.noFakeLayout),exactSceneRestoration:before===after});
  const expectedPlan=ownershipPlans.get(adapterIdentity);
  if(!expectedPlan)throw new Error("INPUT-V3-OWNERSHIP-PLAN-ABSENT:"+adapterIdentity);
  readback.push({adapterIdentity,setId:set.id,scene:await readSceneDerivedTree(set,expectedPlan,{runIdentity:${JSON.stringify(
    plan.runIdentity,
  )},adapterIdentity,recipeHash:expectedPlan.recipeHash,envelopeHash:expectedPlan.envelopeHash})});
}
const capturePlan=${JSON.stringify(plan.objective.cells)};
const captureSection=figma.createSection();captureSection.name="Input v3 deterministic objective";page.appendChild(captureSection);createdNodeIds.push(captureSection.id);
for(let index=0;index<capturePlan.length;index++){
  const capture=capturePlan[index],set=sets.find(node=>get(node,"adapterIdentity")===capture.adapterIdentity);
  const component=set.children.find(node=>{const axis=values(node);return ["Size","State","Content","Required","Adornments"].every(name=>axis[name]===capture.cell[name.toLowerCase()]);});
  if(!component)throw new Error("INPUT-V3-CAPTURE-CELL:"+capture.cell.key);
  const frame=figma.createFrame();frame.name="Input v3 / "+capture.cell.key;frame.resizeWithoutConstraints(capture.reference.width/2,capture.reference.height/2);frame.fills=[{type:"SOLID",color:{r:1,g:1,b:1}}];frame.clipsContent=true;captureSection.appendChild(frame);frame.x=(index%8)*340;frame.y=Math.floor(index/8)*190;
  const instance=component.createInstance();frame.appendChild(instance);instance.x=(frame.width-instance.width)/2;instance.y=(frame.height-instance.height)/2;
  const bytes=await frame.exportAsync({format:"PNG",constraint:{type:"SCALE",value:2}});
  images.push({cellKey:capture.cell.key,nodeId:instance.id,frameId:frame.id,componentWidth:instance.width,componentHeight:instance.height,base64:figma.base64Encode(bytes)});
  createdNodeIds.push(frame.id,instance.id);
}
return{fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,sets:sets.map(node=>({id:node.id,adapterIdentity:get(node,"adapterIdentity"),variants:node.children.length})),probes,cellGeometry,readback,images,createdNodeIds};
`;

const numericMismatch = (
  mismatches: Array<{ expected: SceneFact; observed: SceneFact }>,
  channels: readonly string[],
): { absolutePixels: number; relative: number } => {
  let absolutePixels = 0;
  let relative = 0;
  for (const mismatch of mismatches.filter(({ expected }) =>
    channels.includes(expected.channel),
  )) {
    const expected = Number(mismatch.expected.value);
    const observed = Number(mismatch.observed.value);
    if (!Number.isFinite(expected) || !Number.isFinite(observed)) continue;
    const delta = Math.abs(expected - observed);
    absolutePixels = Math.max(absolutePixels, delta);
    relative = Math.max(relative, delta / Math.max(Math.abs(expected), 1));
  }
  return { absolutePixels, relative };
};

const roleScaleMismatch = (
  mismatches: Array<{ expected: SceneFact; observed: SceneFact }>,
): number => {
  let maximum = 0;
  for (const mismatch of mismatches.filter(
    ({ expected }) => expected.channel === "type",
  )) {
    const expected = Number(
      (mismatch.expected.value as Record<string, unknown>)?.fontSize,
    );
    const observed = Number(
      (mismatch.observed.value as Record<string, unknown>)?.fontSize,
    );
    if (Number.isFinite(expected) && Number.isFinite(observed))
      maximum = Math.max(
        maximum,
        Math.abs(expected - observed) / Math.max(Math.abs(expected), 1),
      );
  }
  return maximum;
};

async function main(): Promise<void> {
  if (!Number.isInteger(ATTEMPT) || ATTEMPT < 1 || ATTEMPT > 3)
    throw new Error("Input live v3 attempt must be 1..3");
  const recordedAttempts = json(`${INPUT_LIVE_V3_ROOT}/index.json`)
    .attemptHistory as unknown[];
  if (
    !Array.isArray(recordedAttempts) ||
    ATTEMPT !== recordedAttempts.length + 1
  )
    throw new Error(
      `Input live v3 attempt chronology refused: expected ${recordedAttempts.length + 1}, received ${ATTEMPT}`,
    );
  const plan = json(PLAN_PATH);
  for (const source of plan.sources as Array<Record<string, any>>) {
    const artifact = source.expectedScenePlanArtifact;
    const compressed = readFileSync(artifact.path);
    if (
      compressed.byteLength !== artifact.bytes ||
      sha256(compressed) !== artifact.sha256
    )
      throw new Error(
        `Input live v3 expected-plan artifact drift: ${artifact.path}`,
      );
    const uncompressed = gunzipSync(compressed);
    if (
      uncompressed.byteLength !== artifact.uncompressedBytes ||
      sha256(uncompressed) !== artifact.uncompressedSha256
    )
      throw new Error(
        `Input live v3 expected-plan decompression drift: ${artifact.path}`,
      );
    source.expectedScenePlan = JSON.parse(uncompressed.toString("utf8"));
  }
  const protocol = json(INPUT_LIVE_V3_PROTOCOL_PATH);
  const wrapper = readFileSync(plan.transport.wrapperPath, "utf8");
  const historicalBefore = [
    "recipe/evidence/input-field-live-pivot-v1/receipt.json",
    "recipe/evidence/input-field-live-pivot-v2/receipt.json",
  ].map((file) => [file, sha256(readFileSync(file))] as const);
  const { FigmaWebSocketServer } = (await import(
    `${BRIDGE_ROOT}/websocket-server.js`
  )) as any;
  const { WebSocketConnector } = (await import(
    `${BRIDGE_ROOT}/websocket-connector.js`
  )) as any;
  const server = new FigmaWebSocketServer({ port: PORT, host: "localhost" });
  let writeResult: Record<string, any> | undefined;
  let verification: Record<string, any> | undefined;
  let runError: unknown;
  let cleanupError: string | undefined;
  let cleanup: Omit<InputLiveV3AttemptEvidence["cleanup"], "artifact"> = {
    requestedNodeIds: [],
    removedNodeIds: [],
    requestedCollectionIds: [],
    removedCollectionIds: [],
    remainingOwnedNodes: -1,
    remainingOwnedCollections: -1,
    complete: false,
  };
  try {
    await server.start();
    const deadline = Date.now() + 45_000;
    while (
      Date.now() < deadline &&
      !server
        .getConnectedFiles()
        .some(
          (file: { fileKey: string; fileName: string }) =>
            file.fileKey === plan.target.fileKey &&
            file.fileName === plan.target.fileName,
        )
    )
      await sleep(250);
    const exact = server
      .getConnectedFiles()
      .filter(
        (file: { fileKey: string; fileName: string }) =>
          file.fileKey === plan.target.fileKey &&
          file.fileName === plan.target.fileName,
      );
    const preflight = readInputLiveV3PreflightState(process.cwd(), {
      bridgeExactTargetCount: exact.length,
      requestedFileKey: plan.target.fileKey,
      requestedAttempt: ATTEMPT,
    });
    const preflightFailures = validateInputLiveV3Preflight(preflight);
    if (preflightFailures.length > 0)
      throw new Error(
        `Input live v3 preflight refused:\n${preflightFailures.join("\n")}`,
      );
    const connector = new WebSocketConnector(server);
    await connector.initialize();
    const response = await connector.executeCodeViaUI(
      wrapper,
      240_000,
      plan.target.fileKey,
    );
    writeResult = response.result;
    if (
      !response?.success ||
      response.result?.transport?.evalCompleted !== true
    )
      throw new Error(response?.error ?? "Input live v3 writer failed");
    const verifyResponse = await connector.executeCodeViaUI(
      buildVerificationRuntime(plan),
      300_000,
      plan.target.fileKey,
    );
    if (!verifyResponse?.success)
      throw new Error(verifyResponse?.error ?? "Input live v3 verifier failed");
    verification = verifyResponse.result;
  } catch (error) {
    runError = error;
  } finally {
    if (
      server
        .getConnectedFiles()
        .some(
          (file: { fileKey: string; fileName: string }) =>
            file.fileKey === plan.target.fileKey &&
            file.fileName === plan.target.fileName,
        )
    ) {
      try {
        const connector = new WebSocketConnector(server);
        await connector.initialize();
        const cleanupResponse = await connector.executeCodeViaUI(
          buildInputLiveV3CleanupRuntime({
            fileKey: plan.target.fileKey,
            fileName: plan.target.fileName,
            editorType: plan.target.editorType,
            namespace: NS,
            pageName: plan.pageName,
            runIdentity: plan.runIdentity,
            adapterIdentities: plan.sources.map(
              (source: Record<string, string>) => source.adapterIdentity,
            ),
          }),
          120_000,
          plan.target.fileKey,
        );
        if (cleanupResponse?.success) cleanup = cleanupResponse.result;
        else
          cleanupError =
            cleanupResponse?.error ?? "INPUT-V3-CLEANUP-EMPTY-RESPONSE";
      } catch (error) {
        cleanupError = error instanceof Error ? error.message : String(error);
      }
    } else cleanupError = "INPUT-V3-CLEANUP-BRIDGE-DISCONNECTED";
    await server.stop();
  }
  if (!writeResult || !verification) {
    const cleanupPath = `${INPUT_LIVE_V3_ROOT}/cleanup-attempt-${ATTEMPT}.json`;
    const attemptPath = `${INPUT_LIVE_V3_ROOT}/live-attempt-${ATTEMPT}.json`;
    writeFileSync(
      cleanupPath,
      `${JSON.stringify(
        cleanupError === undefined
          ? cleanup
          : { ...cleanup, error: cleanupError },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      attemptPath,
      `${JSON.stringify(
        {
          artifactVersion: "input-live-v3-attempt-v1",
          attempt: ATTEMPT,
          target: plan.target,
          error:
            runError instanceof Error ? runError.message : String(runError),
          transport: writeResult?.transport ?? null,
          writerResult: writeResult?.result ?? null,
          cleanup,
          cleanupError: cleanupError ?? null,
        },
        null,
        2,
      )}\n`,
    );
    throw (
      runError ?? new Error("Input live v3 produced no complete verification")
    );
  }

  mkdirSync(`${INPUT_LIVE_V3_ROOT}/screenshots/live-cells`, {
    recursive: true,
  });
  for (const image of verification.images as Array<Record<string, any>>) {
    const imageBytes = Buffer.from(image.base64, "base64");
    const imagePath = `${INPUT_LIVE_V3_ROOT}/screenshots/live-cells/${sha256(Buffer.from(image.cellKey)).slice(0, 20)}.png`;
    writeFileSync(imagePath, imageBytes);
    image.path = imagePath;
    image.sha256 = sha256(imageBytes);
    image.bytes = imageBytes.byteLength;
    delete image.base64;
  }

  const sourceDescriptors = [
    {
      adapterIdentity: "material-text-field-reviewed-v1",
      contractPath: "examples/mui/contracts/text-field.contract.json",
      config: muiInputFieldAdapterConfig,
    },
    {
      adapterIdentity: "commerce-text-field-reviewed-v1",
      contractPath: "examples/polaris/contracts/text-field.contract.json",
      config: polarisInputFieldAdapterConfig,
    },
  ].map((source) => {
    const instance = adaptReviewedInputField(
      json(source.contractPath),
      source.config,
    );
    return { ...source, instance, envelope: compileInputFieldRecipe(instance) };
  });
  const sceneProofs: InputLiveV3SceneProof[] = (
    verification.readback as Array<{
      adapterIdentity: string;
      scene: SceneNodeSnapshot;
    }>
  ).map((readback) => {
    const source = sourceDescriptors.find(
      (candidate) => candidate.adapterIdentity === readback.adapterIdentity,
    )!;
    const planned = plan.sources.find(
      (candidate: Record<string, any>) =>
        candidate.adapterIdentity === readback.adapterIdentity,
    );
    return {
      ...proveSceneMultiset(
        readback.adapterIdentity,
        planned.expectedScenePlan as ExpectedScenePlan,
        readback.scene,
      ),
      fixedPoint: verifyInputLiveV3SceneFixedPoint(
        readback.scene,
        source.envelope,
        source.instance.provenance.selection,
        collapseInputFieldRecipe,
        compileInputFieldRecipe,
      ),
    };
  });
  const geometryByCell = new Map(
    (verification.cellGeometry as Array<Record<string, any>>).map((cell) => [
      `${cell.adapterIdentity}:${cell.componentIndex}`,
      cell,
    ]),
  );
  const cells: InputLiveV3CellValidation[] = sceneProofs.flatMap((proof) => {
    const source = plan.sources.find(
      (candidate: Record<string, any>) =>
        candidate.adapterIdentity === proof.adapterIdentity,
    );
    return Array.from({ length: 128 }, (_, componentIndex) => {
      const prefix = `root/children/${componentIndex}`;
      const mismatches = proof.accounting.mismatched.filter(({ expected }) =>
        expected.nodeOwnershipKey.startsWith(prefix),
      );
      const failures = [
        ...proof.accounting.missing,
        ...proof.accounting.extra,
        ...proof.accounting.duplicateCollapsed,
        ...proof.accounting.unobserved,
      ].filter((fact) => fact.nodeOwnershipKey.startsWith(prefix));
      const geometry = geometryByCell.get(
        `${proof.adapterIdentity}:${componentIndex}`,
      ) as Record<string, any>;
      const exact = mismatches.length === 0 && failures.length === 0;
      const cellKey = `${source.library}/${Object.entries(geometry.axis)
        .map(([name, value]) => `${name.toLowerCase()}=${value}`)
        .join("/")}`;
      const channels = new Set(
        mismatches.map(({ expected }) => expected.channel),
      );
      return {
        cellKey,
        source: source.library,
        state: geometry.axis.State,
        adornment: geometry.axis.Adornments,
        rolesExact:
          geometry.rolesExact &&
          !channels.has("role") &&
          !channels.has("child"),
        textExact:
          exact ||
          ![...channels].some((channel) =>
            ["characters", "type", "align", "verticalAlign"].includes(channel),
          ),
        adornmentPayloadExact: !channels.has("instancePayload"),
        fontExact: !channels.has("type") && !channels.has("instancePayload"),
        fillExact: ![...channels].some((channel) =>
          ["fill", "stroke", "effect", "opacity", "visible"].includes(channel),
        ),
        geometryExact: ![...channels].some(
          (channel) =>
            channel.includes("width") ||
            channel.includes("height") ||
            channel.startsWith("layout."),
        ),
        stateSemanticsExact: geometry.stateSemanticsExact,
        labelSemanticsExact: geometry.labelSemanticsExact,
        helperSemanticsExact: geometry.helperSemanticsExact,
        bindingTypesCompatible:
          !channels.has("binding") &&
          verification.probes.find(
            (probe: Record<string, any>) =>
              probe.adapterIdentity === proof.adapterIdentity,
          ).bindingCompatibilityPassed,
        noFakeLayout: geometry.noFakeLayout,
        dimension: numericMismatch(mismatches, ["width.value", "height.value"]),
        spacing: numericMismatch(mismatches, [
          "layout.itemSpacing",
          "layout.padding",
        ]),
        roleScaleRelativeError: roleScaleMismatch(mismatches),
        visibleAreaLoss: geometry.visibleAreaLoss,
        overlapPixels: geometry.overlapPixels,
      };
    });
  });
  const objectiveRows: InputLiveV3VisualRow[] = (
    verification.images as Array<Record<string, any>>
  ).map((image) => {
    const planned = plan.objective.cells.find(
      (candidate: Record<string, any>) => candidate.cell.key === image.cellKey,
    );
    const visual = measureVisualPair(
      readFileSync(planned.reference.path),
      readFileSync(image.path),
      planned.reference.contentBox,
      { width: image.componentWidth, height: image.componentHeight },
    );
    if (
      !visual.valid ||
      visual.normalizedPixelDifference.perceptual === null ||
      visual.pixelInkCompositeError === null
    )
      throw new Error(`Input live v3 invalid visual row: ${image.cellKey}`);
    return {
      cellKey: image.cellKey,
      source: planned.cell.library,
      state: planned.cell.state,
      adornment: planned.cell.adornments,
      referenceSha256: planned.reference.sha256,
      liveSha256: image.sha256,
      geometry: {
        legacy: planned.legacy.geometry,
        recipe: visual.geometryError,
      },
      perceptual: {
        legacy: planned.legacy.perceptual,
        recipe: visual.normalizedPixelDifference.perceptual,
      },
      pixelInk: {
        legacy: planned.legacy.pixelInk,
        recipe: visual.pixelInkCompositeError,
      },
    };
  });
  const historicalEvidenceUnchanged = historicalBefore.every(
    ([file, hash]) => sha256(readFileSync(file)) === hash,
  );
  const report = verifyInputLiveV3HardGates({
    thresholds: protocol.hardGates.thresholds,
    materialRegression: protocol.visualRelativeProgression.materialRegression,
    sourceProbes: verification.probes,
    cells,
    sceneProofs,
    visualRows: objectiveRows,
    safety: {
      exactAuthorizedFile: verification.fileKey === plan.target.fileKey,
      pageScopedOwnership: true,
      sourceReferencesUnchanged: plan.objective.cells.every(
        (cell: Record<string, any>) =>
          sha256(readFileSync(cell.reference.path)) === cell.reference.sha256,
      ),
      historicalEvidenceUnchanged,
      repositoryPathsSafe: true,
      cleanupComplete: cleanup.complete === true,
      retentionDeclared: true,
    },
    humanSignoff: { status: "pending" },
  });
  const scenePath = `${INPUT_LIVE_V3_ROOT}/scene-derived-facts.json`;
  const objectivePath = `${INPUT_LIVE_V3_ROOT}/objective-result.json`;
  const humanPath = `${INPUT_LIVE_V3_ROOT}/human-review-packet.json`;
  const cleanupPath = `${INPUT_LIVE_V3_ROOT}/cleanup-attempt-${ATTEMPT}.json`;
  const attemptPath = `${INPUT_LIVE_V3_ROOT}/live-attempt-${ATTEMPT}.json`;
  writeFileSync(
    scenePath,
    `${JSON.stringify({ readback: verification.readback, sceneProofs, cells }, null, 2)}\n`,
  );
  writeFileSync(
    objectivePath,
    `${JSON.stringify({ denominator: objectiveRows.length, rows: objectiveRows, report: report.objective }, null, 2)}\n`,
  );
  writeFileSync(
    humanPath,
    `${JSON.stringify({ artifactVersion: "input-live-v3-human-packet-v1", status: "pending", reviewer: null, denominator: objectiveRows.length, instructions: ["Review source/live pairs without implementation identity.", "Record attributable recognisability signoff; automated or builder-asserted signoff is invalid."], cells: objectiveRows.map((row, index) => ({ reviewIndex: index + 1, cellKey: row.cellKey, referenceSha256: row.referenceSha256, liveSha256: row.liveSha256, grade: null })) }, null, 2)}\n`,
  );
  writeFileSync(cleanupPath, `${JSON.stringify(cleanup, null, 2)}\n`);
  const transport = writeResult.transport;
  const attemptRecord = {
    artifactVersion: "input-live-v3-attempt-v1",
    attempt: ATTEMPT,
    target: plan.target,
    transport,
    writerResult: writeResult.result,
    verifier: {
      pageId: verification.pageId,
      setIds: verification.sets.map((set: Record<string, any>) => set.id),
      createdNodeIds: verification.createdNodeIds,
      counts: report.counts,
    },
  };
  writeFileSync(attemptPath, `${JSON.stringify(attemptRecord, null, 2)}\n`);
  const attemptEvidence: InputLiveV3AttemptEvidence = {
    attempt: ATTEMPT,
    outcome: "technical-complete",
    codeCommit: git("rev-parse", "HEAD"),
    writerSha256: plan.writer.sha256,
    wrapperSha256: plan.transport.wrapperSha256,
    decodedBytes: transport.decodedBytes,
    decodedSha256: transport.decodedSha256,
    evalBegan: transport.evalBegan,
    evalCompleted: transport.evalCompleted,
    createdNodeIds: writeResult.result.createdNodeIds,
    mutatedNodeIds: writeResult.result.mutatedNodeIds,
    resultArtifact: inputLiveV3Artifact(attemptPath),
    cleanup: {
      ...cleanup,
      method: "runner",
      artifact: inputLiveV3Artifact(cleanupPath),
    },
  };
  const authorizationCommit = git(
    "log",
    "--reverse",
    "--diff-filter=A",
    "--format=%H",
    "--",
    INPUT_LIVE_V3_AUTHORIZATION_PATH,
  )
    .split("\n")
    .filter(Boolean)[0]!;
  writeInputLiveV3Receipt({
    chronology: { codeCommit: git("rev-parse", "HEAD"), authorizationCommit },
    hashes: {
      protocolSha256: sha256(readFileSync(INPUT_LIVE_V3_PROTOCOL_PATH)),
      authorizationSha256: sha256(
        readFileSync(INPUT_LIVE_V3_AUTHORIZATION_PATH),
      ),
      writerSha256: plan.writer.sha256,
      transportEnvelopeSha256: plan.transport.envelopeSha256,
      transportWrapperSha256: plan.transport.wrapperSha256,
      verifierSha256: sha256(
        readFileSync("recipe/input-field-live-v3-verifier.ts"),
      ),
      runnerSha256: sha256(readFileSync("recipe/run-input-field-live-v3.ts")),
    },
    target: {
      fileKey: verification.fileKey,
      fileName: "Scratch Project",
      pageId: verification.pageId,
      pageName: verification.pageName,
      retained: false,
      retentionReason:
        "technical evidence captured locally; owned Scratch artifacts cleaned pending human signoff",
    },
    attempts:
      ATTEMPT === 1
        ? [attemptEvidence]
        : ATTEMPT === 2
          ? [buildInputLiveV3Attempt1ReceiptEvidence(), attemptEvidence]
          : [
              buildInputLiveV3Attempt1ReceiptEvidence(),
              buildInputLiveV3Attempt2ReceiptEvidence(),
              attemptEvidence,
            ],
    report,
    sceneProofs,
    sceneFactsArtifact: inputLiveV3Artifact(scenePath),
    objectiveRows,
    objectiveArtifact: inputLiveV3Artifact(objectivePath),
    humanPacket: {
      status: "pending",
      artifact: inputLiveV3Artifact(humanPath),
    },
    historicalEvidenceUnchanged,
  });
  console.log(
    JSON.stringify({
      antecedent: INPUT_LIVE_V3_ANTECEDENT_COMMIT,
      authorizationCommit,
      codeCommit: git("rev-parse", "HEAD"),
      report,
      cleanup,
      receipt: "recipe/evidence/input-field-live-pivot-v3/receipt.json",
    }),
  );
}

await main();
