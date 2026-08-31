import { canonicalJson } from "./normalize.js";
import { factId, type RecipeEnvelope } from "./envelope.js";
import type { IRNode, VariableBinding } from "./figma-ir.js";
import {
  INPUT_FIELD_ADORNMENTS,
  INPUT_FIELD_CONTENT,
  INPUT_FIELD_REQUIRED,
  INPUT_FIELD_SIZES,
  INPUT_FIELD_STATES,
} from "./recipes/input-field.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";
import {
  compileExpectedScenePlan,
  type ExpectedScenePlan,
} from "./scene-readback.js";
import { buildFigmaSceneReadbackRuntime } from "./scene-readback-runtime.js";

export const INPUT_FIELD_FIGMA_NAMESPACE = "ds.contracts.input.recipe.v1";
export const INPUT_FIELD_FIGMA_WRITER_VERSION = 1;

type AxisName = "Size" | "State" | "Content" | "Required" | "Adornments";
type Cell = [number, number, number, number, number];

interface VariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface InputFieldFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
  slotCharacters: { leading: string; trailing: string };
}

export interface InputFieldFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  axes: Record<AxisName, string[]>;
  cells: Cell[];
  ir: RecipeEnvelope["ir"];
  variables: VariablePlan[];
  slotCharacters: { leading: string; trailing: string };
  adornments: {
    leading: NonNullable<Extract<IRNode, { kind: "instance" }>["payload"]>;
    trailing: NonNullable<Extract<IRNode, { kind: "instance" }>["payload"]>;
  };
  contentDefaults: Record<string, string>;
  comparedIrFacts: number;
  expectedScenePlan: ExpectedScenePlan;
}

export interface InputFieldFigmaWriter {
  pageName: string;
  runIdentity: string;
  sourcePlans: InputFieldFigmaSourcePlan[];
  code: string;
}

export interface InputFieldFigmaWriterProgram {
  version: 1 | 2;
  namespace: string;
  runSuffix: "input-v1" | "input-v2" | "input-v5";
  overlayPositioning: boolean;
  restoreFillAfterComponentProperties: boolean;
  sceneReadbackInstrumentation: boolean;
}

export interface ResolvedInputFieldFont {
  family: string;
  style: string;
  resolution: "requested" | "fallback";
  degradation?: string;
}

export function resolveInputFieldFont(
  specification: NonNullable<
    Extract<IRNode, { kind: "text" }>["type"]["fontProvenance"]
  >,
  available: readonly { family: string; style: string }[],
  measuredWidth = 1,
): ResolvedInputFieldFont {
  if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
    throw new TypeError("INPUT-FONT-ZERO-WIDTH");
  }
  const resolved = specification.fallbackChain.find((candidate) =>
    available.some(
      (font) =>
        font.family === candidate.family && font.style === candidate.style,
    ),
  );
  if (resolved === undefined) {
    throw new TypeError(
      `INPUT-FONT-UNAVAILABLE:${specification.requestedFamily}:${specification.requestedStyle}`,
    );
  }
  const resolution =
    resolved.family === specification.requestedFamily &&
    resolved.style === specification.requestedStyle
      ? "requested"
      : "fallback";
  if (
    resolved.family !== specification.resolvedFamily ||
    resolved.style !== specification.resolvedStyle ||
    resolution !== specification.resolution
  ) {
    throw new TypeError(
      `INPUT-FONT-PROVENANCE-TAMPER:${resolved.family}:${resolved.style}`,
    );
  }
  if (resolution === "fallback" && !specification.degradation) {
    throw new TypeError("INPUT-FONT-FALLBACK-WITHOUT-DEGRADATION");
  }
  return {
    ...resolved,
    resolution,
    ...(specification.degradation === undefined
      ? {}
      : { degradation: specification.degradation }),
  };
}

const atPath = (value: unknown, field: string): unknown =>
  field.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object") return undefined;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    return (current as Record<string | number, unknown>)[key];
  }, value);

const walk = (node: IRNode, visit: (candidate: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  ) {
    for (const child of node.children) walk(child, visit);
  }
};

const codeOnlyPositionReceipts = (
  root: IRNode,
): Array<{ id: string; disposition: "code-only"; reason: string }> => {
  const receipts: Array<{
    id: string;
    disposition: "code-only";
    reason: string;
  }> = [];
  const visit = (node: IRNode, ownershipKey: string): void => {
    if (
      (node.kind === "frame" || node.kind === "component") &&
      node.layout.positioning === "absolute"
    ) {
      for (const axis of ["x", "y"]) {
        receipts.push({
          id: `${ownershipKey}#layout.offset.${axis}`,
          disposition: "code-only",
          reason:
            "Figma exposes x/y as scene geometry but does not accept variable bindings on those properties",
        });
      }
    }
    if (
      node.kind === "frame" ||
      node.kind === "component" ||
      node.kind === "component-set"
    ) {
      for (const [index, child] of node.children.entries()) {
        visit(child, `${ownershipKey}/children/${index}`);
      }
    }
  };
  visit(root, "root");
  return receipts;
};

const countComparedFacts = (root: IRNode): number => {
  let count = 0;
  walk(root, (node) => {
    count += Object.keys(node).filter((key) => key !== "label").length;
  });
  return count;
};

const variableType = (
  binding: VariableBinding,
  value: unknown,
): "COLOR" | "FLOAT" => {
  if (
    typeof value === "string" &&
    /^#[0-9a-f]{8}$/.test(value) &&
    binding.field.endsWith("color")
  ) {
    return "COLOR";
  }
  if (typeof value === "number") return "FLOAT";
  throw new TypeError(
    `input-field live writer: unsupported binding ${binding.field}=${JSON.stringify(value)}`,
  );
};

const planSource = (
  input: InputFieldFigmaWriterInput,
): InputFieldFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "input-field" ||
    input.envelope.recipe.version !== 1 ||
    input.envelope.ir.kind !== "component-set"
  ) {
    throw new TypeError(
      "input-field live writer requires input-field@1 set IR",
    );
  }
  const root = input.envelope.ir;
  const axes = Object.fromEntries(
    root.variantAxes.map((axis) => [axis.name, [...axis.values]]),
  ) as Partial<Record<AxisName, string[]>>;
  for (const [name, expected] of [
    ["Size", INPUT_FIELD_SIZES],
    ["State", INPUT_FIELD_STATES],
    ["Content", INPUT_FIELD_CONTENT],
    ["Required", INPUT_FIELD_REQUIRED],
    ["Adornments", INPUT_FIELD_ADORNMENTS],
  ] as const) {
    if (canonicalJson(axes[name]) !== canonicalJson(expected)) {
      throw new TypeError(`input-field live writer: incomplete ${name} axis`);
    }
  }
  const completeAxes = axes as Record<AxisName, string[]>;
  const axisNames: AxisName[] = [
    "Size",
    "State",
    "Content",
    "Required",
    "Adornments",
  ];
  const cells = root.children.map(
    (component) =>
      axisNames.map((name) =>
        completeAxes[name].indexOf(component.variantProperties[name]!),
      ) as Cell,
  );
  if (
    cells.length !== 128 ||
    cells.some((cell) => cell.some((index) => index < 0)) ||
    new Set(cells.map((cell) => cell.join("/"))).size !== 128
  ) {
    throw new TypeError(
      `input-field live writer requires all 128 cells; found ${cells.length}`,
    );
  }
  const registry = new Map<string, VariablePlan>();
  const contentDefaults: Record<string, string> = {};
  const adornments = new Map<
    "leading" | "trailing",
    NonNullable<Extract<IRNode, { kind: "instance" }>["payload"]>
  >();
  walk(root, (node) => {
    if (
      node.kind === "text" &&
      node.role &&
      contentDefaults[node.role] === undefined
    ) {
      contentDefaults[node.role] = node.characters;
    }
    if (
      node.kind === "instance" &&
      (node.role === "input-field/slot/leading" ||
        node.role === "input-field/slot/trailing")
    ) {
      if (node.payload === undefined) {
        throw new TypeError(
          `input-field live writer: ${node.role} has no typed payload`,
        );
      }
      if (node.payload.content.kind === "instance") {
        throw new TypeError(
          `input-field live writer: INPUT-ADORNMENT-INSTANCE-ASSET-UNAVAILABLE:${node.payload.content.componentRef}`,
        );
      }
      if (node.payload.content.kind === "glyph") {
        throw new TypeError(
          `input-field live writer: INPUT-ADORNMENT-GLYPH-ASSET-UNAVAILABLE:${node.payload.content.assetRef}`,
        );
      }
      const side = node.role.endsWith("/leading") ? "leading" : "trailing";
      const previous = adornments.get(side);
      if (
        previous !== undefined &&
        canonicalJson(previous) !== canonicalJson(node.payload)
      ) {
        throw new TypeError(
          `input-field live writer: conflicting ${side} adornment payload`,
        );
      }
      adornments.set(side, node.payload);
    }
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value)) {
        throw new TypeError(
          `input-field live writer: conflicting fallback for ${binding.variable}`,
        );
      }
      registry.set(key, {
        identity: binding.variable,
        name: sanitizeFigmaVariableName(binding.variable, type),
        type,
        value: value as string | number,
      });
    }
  });
  buildFigmaVariableNameMap(
    [...registry.values()].map(({ identity, type }) => ({
      tokenIdentity: identity,
      type,
    })),
  );
  if (
    registry.size === 0 ||
    input.slotCharacters.leading.length === 0 ||
    input.slotCharacters.trailing.length === 0 ||
    adornments.size !== 2
  ) {
    throw new TypeError(
      "input-field live writer: zero planned variable or slot",
    );
  }
  for (const side of ["leading", "trailing"] as const) {
    const payload = adornments.get(side)!;
    const content = payload.content;
    if (
      (content.kind !== "text" && content.kind !== "glyph") ||
      content.text !== input.slotCharacters[side]
    ) {
      throw new TypeError(
        `input-field live writer: ${side} slotCharacters disagrees with typed payload`,
      );
    }
  }
  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    axes: completeAxes,
    cells,
    ir: root,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    slotCharacters: input.slotCharacters,
    adornments: {
      leading: adornments.get("leading")!,
      trailing: adornments.get("trailing")!,
    },
    contentDefaults,
    comparedIrFacts: countComparedFacts(root),
    expectedScenePlan: compileExpectedScenePlan(root, {
      // The writer's helper component has exactly one text child. Instances
      // materialize that child as a read-only descendant, so its identity is
      // planned separately without copying any text, font, paint, or geometry.
      generatedDescendantLineages: () => [
        [{ type: "TEXT", childIndex: 0, occurrence: 0 }],
      ],
      typedReceipts: [
        ...codeOnlyPositionReceipts(root),
        ...input.envelope.extensions.flatMap((extension) =>
          extension.absorbs.map((fact) => ({
            id: factId(fact),
            disposition: "code-only" as const,
            reason: extension.why,
          })),
        ),
        ...input.envelope.receipts.map((receipt) => ({
          id: factId(receipt.fact),
          disposition: "refused" as const,
          reason: `${receipt.reason}: ${receipt.evidence}`,
        })),
      ],
    }),
  };
};

export function validateInputFieldFigmaSourcePlans(
  plans: readonly InputFieldFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length !== 2)
    failures.push(`expected 2 source plans, found ${plans.length}`);
  if (
    new Set(plans.map((plan) => plan.adapterIdentity)).size !== plans.length
  ) {
    failures.push("adapter identity collision");
  }
  for (const source of plans) {
    if (source.cells.length !== 128) {
      failures.push(`${source.adapterIdentity}: expected 128 cells`);
    }
    if (source.variables.length === 0) {
      failures.push(`${source.adapterIdentity}: variables denominator is zero`);
    }
    if (source.comparedIrFacts <= 0) {
      failures.push(
        `${source.adapterIdentity}: compared facts denominator is zero`,
      );
    }
    if (source.ir.kind !== "component-set") {
      failures.push(`${source.adapterIdentity}: root is not a component set`);
      continue;
    }
    for (const component of source.ir.children) {
      const roles: string[] = [];
      walk(component, (node) => {
        if (node.role) roles.push(node.role);
      });
      for (const role of [
        "input-field/label",
        "input-field/surface",
        component.variantProperties.Content === "placeholder"
          ? "input-field/content/placeholder"
          : "input-field/content/value",
        component.variantProperties.State === "error"
          ? "input-field/message/error"
          : "input-field/message/helper",
      ]) {
        if (!roles.includes(role)) {
          failures.push(`${component.role}: missing ${role}`);
        }
      }
    }
  }
  return failures;
}

const writerRuntime = (
  program: InputFieldFigmaWriterProgram,
): string => String.raw`
const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh";
const EXPECTED_FILE_NAME="Scratch Project";
const NS = ${JSON.stringify(program.namespace)};
const WRITER_VERSION=${JSON.stringify(String(program.version))};
const PAGE_OWNER="recipe/input-field/"+PLAN.runIdentity;
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
const setChunkedData=(target,key,value)=>{const size=64000,count=Math.ceil(value.length/size);target.setSharedPluginData(NS,key+"Count",String(count));for(let index=0;index<count;index++)target.setSharedPluginData(NS,key+index,value.slice(index*size,(index+1)*size));};
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(!page){page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);}
else if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("INPUT-PAGE-OWNERSHIP-COLLISION:"+page.id);
await figma.setCurrentPageAsync(page);
setSharedData(page,"pageOwner",PAGE_OWNER);
setSharedData(page,"runIdentity",PLAN.runIdentity);
setSharedData(page,"writerVersion",WRITER_VERSION);
mutatedNodeIds.push(page.id);
const rgba=hex=>({r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255,a:parseInt(hex.slice(7,9),16)/255});
const paint=hex=>{const value=rgba(hex);return{type:"SOLID",color:{r:value.r,g:value.g,b:value.b},opacity:value.a};};
const allFonts=await figma.listAvailableFontsAsync();
const resolveFont=spec=>{
  const found=spec.fallbackChain.map(candidate=>allFonts.find(font=>font.fontName.family===candidate.family&&font.fontName.style===candidate.style)).find(Boolean);
  if(!found)throw new Error("INPUT-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("INPUT-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("INPUT-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
${program.sceneReadbackInstrumentation ? buildFigmaSceneReadbackRuntime(program.namespace) : ""}
let nextSectionX=0;
for(const source of PLAN.sources){
  const oldSections=page.children.filter(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  for(const old of oldSections){
    const collectionId=getSharedData(old,"variableCollectionId");
    if(collectionId){const collection=await figma.variables.getVariableCollectionByIdAsync(collectionId);if(collection&&!collection.remote){if(getSharedData(collection,"collectionOwner")!==PAGE_OWNER+"/variable-collection"||getSharedData(collection,"runIdentity")!==PLAN.runIdentity)throw new Error("INPUT-VARIABLE-COLLECTION-OWNERSHIP-COLLISION:"+collection.id);collection.remove();}}
    old.remove();
  }
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Input / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("INPUT-VARIABLE-COLLECTION-COLLISION:"+collectionName);
  const collection=figma.variables.createVariableCollection(collectionName);
  setSharedData(collection,"collectionOwner",PAGE_OWNER+"/variable-collection");
  setSharedData(collection,"runIdentity",PLAN.runIdentity);
  setSharedData(collection,"adapterIdentity",source.adapterIdentity);
  collection.renameMode(collection.modes[0].modeId,"Default");
  collection.hiddenFromPublishing=true;
  setSharedData(section,"variableCollectionId",collection.id);
  const modeId=collection.modes[0].modeId,variables=new Map();
  for(const planned of source.variables){
    const variable=figma.variables.createVariable(planned.name,collection,planned.type);
    variable.scopes=planned.type==="COLOR"?["ALL_SCOPES"]:["ALL_SCOPES"];
    variable.setValueForMode(modeId,planned.type==="COLOR"?rgba(planned.value):planned.value);
    variable.setVariableCodeSyntax("WEB","var(--"+planned.identity.replace(/[^a-zA-Z0-9_-]+/g,"-").toLowerCase()+")");
    variables.set(planned.type+":"+planned.identity,variable);
  }
  const boundPaint=(hex,binding)=>{
    const base=paint(hex);
    if(!binding)return base;
    const variable=variables.get("COLOR:"+binding.variable);
    if(!variable)throw new Error("MISSING-COLOR-VARIABLE:"+binding.variable);
    return figma.variables.setBoundVariableForPaint(base,"color",variable);
  };
  const bindFloat=(node,field,binding)=>{
    if(!binding)return;
    const variable=variables.get("FLOAT:"+binding.variable);
    if(!variable)throw new Error("MISSING-FLOAT-VARIABLE:"+binding.variable);
    node.setBoundVariable(field,variable);
  };
  const bindingFor=(ir,field)=>(ir.bindings||[]).find(binding=>binding.field===field);
  const tag=(node,ir,ownershipKey)=>{
    setSharedData(node,"runIdentity",PLAN.runIdentity);
    setSharedData(node,"adapterIdentity",source.adapterIdentity);
    setSharedData(node,"recipeHash",source.recipeHash);
    setSharedData(node,"envelopeHash",source.envelopeHash);
    setSharedData(node,"ownershipKey",ownershipKey);
  };
  const helpers=figma.createFrame();
  helpers.name="__Input helpers / "+source.displayName;
  helpers.layoutMode="HORIZONTAL";helpers.primaryAxisSizingMode="AUTO";helpers.counterAxisSizingMode="AUTO";helpers.itemSpacing=24;helpers.fills=[];
  section.appendChild(helpers);helpers.x=48;helpers.y=48;createdNodeIds.push(helpers.id);
  const helperByRef=new Map();
  const makeHelper=async(ref,payload)=>{
    const key=ref+"\0"+JSON.stringify(payload);
    if(helperByRef.has(key))return helperByRef.get(key);
    if(payload.content.kind==="instance")throw new Error("INPUT-ADORNMENT-INSTANCE-ASSET-UNAVAILABLE:"+payload.content.componentRef);
    if(!payload.typography||!payload.content.text)throw new Error("INPUT-ADORNMENT-CONTENT-ABSENT:"+ref);
    const helper=figma.createComponent();helper.name="__Input adornment / "+ref;helper.description="adornment-source:"+payload.source+"\nadornment-accessibility:"+JSON.stringify(payload.accessibility);helper.layoutMode="HORIZONTAL";helper.primaryAxisAlignItems=payload.alignment.horizontal==="start"?"MIN":payload.alignment.horizontal==="end"?"MAX":"CENTER";helper.counterAxisAlignItems=payload.alignment.vertical==="start"?"MIN":payload.alignment.vertical==="end"?"MAX":"CENTER";helper.primaryAxisSizingMode="AUTO";helper.counterAxisSizingMode="AUTO";helper.paddingTop=payload.padding.top;helper.paddingRight=payload.padding.right;helper.paddingBottom=payload.padding.bottom;helper.paddingLeft=payload.padding.left;helper.opacity=payload.opacity;helper.fills=[];
    const label=figma.createText();const font=resolveFont(payload.typography.fontProvenance);await figma.loadFontAsync(font);label.fontName=font;label.characters=payload.content.text;label.fontSize=payload.typography.fontSize;label.lineHeight={unit:"PIXELS",value:payload.typography.lineHeight.value};label.fills=payload.fills.map(entry=>paint(entry.color));label.opacity=payload.opacity;label.textAutoResize="WIDTH_AND_HEIGHT";label.name="adornment-content :: font-provenance="+encodeURIComponent(JSON.stringify(payload.typography.fontProvenance));helper.appendChild(label);helpers.appendChild(helper);helper.resizeWithoutConstraints(payload.intrinsicSize.width,payload.intrinsicSize.height);helper.primaryAxisSizingMode="FIXED";helper.counterAxisSizingMode="FIXED";helper.clipsContent=false;if(label.width<=0||label.height<=0)throw new Error("INPUT-ADORNMENT-ZERO-WIDTH:"+ref);helperByRef.set(key,helper);createdNodeIds.push(helper.id,label.id);return helper;
  };
  const helperRefs=new Map();
  const gather=ir=>{
    if(ir.kind==="instance"){
      if(!ir.payload)throw new Error("INPUT-ADORNMENT-PAYLOAD-ABSENT:"+ir.componentRef);
      helperRefs.set(ir.componentRef+"\0"+JSON.stringify(ir.payload),{ref:ir.componentRef,payload:ir.payload});
    }
    if(ir.children)for(const child of ir.children)gather(child);
  };
  gather(source.ir);
  for(const [key,value] of helperRefs)helperByRef.set(key,await makeHelper(value.ref,value.payload));
  const applyPaints=(node,ir)=>{
    if(ir.fills)node.fills=ir.fills.map((entry,index)=>boundPaint(entry.color,bindingFor(ir,"fills."+index+".color")));
    if(ir.strokes){
      node.strokes=ir.strokes.map((entry,index)=>boundPaint(entry.paint.color,bindingFor(ir,"strokes."+index+".paint.color")));
      if(ir.strokes[0]){
        node.strokeWeight=ir.strokes[0].weight;node.strokeAlign=ir.strokes[0].align.toUpperCase();
        bindFloat(node,"strokeWeight",bindingFor(ir,"strokes.0.weight"));
      }
    }
    if(ir.cornerRadius){
      for(const [irKey,figmaKey] of [["topLeft","topLeftRadius"],["topRight","topRightRadius"],["bottomRight","bottomRightRadius"],["bottomLeft","bottomLeftRadius"]]){
        node[figmaKey]=ir.cornerRadius[irKey];bindFloat(node,figmaKey,bindingFor(ir,"cornerRadius."+irKey));
      }
    }
    if(ir.effects){
      node.effects=ir.effects.map((effect,index)=>{
        const base=effect.kind==="drop-shadow"||effect.kind==="inner-shadow"?{type:effect.kind==="drop-shadow"?"DROP_SHADOW":"INNER_SHADOW",color:rgba(effect.color),offset:{x:effect.offsetX,y:effect.offsetY},radius:effect.blur,spread:effect.spread,visible:true,blendMode:"NORMAL"}:{type:effect.kind==="layer-blur"?"LAYER_BLUR":"BACKGROUND_BLUR",radius:effect.blur,visible:true};
        const binding=bindingFor(ir,"effects."+index+".color");
        if(!binding||!("color" in base))return base;
        return figma.variables.setBoundVariableForEffect(base,"color",variables.get("COLOR:"+binding.variable));
      });
    }
  };
  const align={min:"MIN",center:"CENTER",max:"MAX","space-between":"SPACE_BETWEEN",baseline:"BASELINE"};
  const applyLayout=(node,ir)=>{
    const layout=ir.layout;
    node.layoutMode=layout.mode.toUpperCase();
    node.primaryAxisAlignItems=align[layout.primaryAxisAlign];
    node.counterAxisAlignItems=align[layout.counterAxisAlign];
    node.itemSpacing=layout.itemSpacing;
    node.paddingTop=Math.max(0,layout.padding.top);node.paddingRight=Math.max(0,layout.padding.right);node.paddingBottom=Math.max(0,layout.padding.bottom);node.paddingLeft=Math.max(0,layout.padding.left);
    if(layout.minWidth!==undefined)node.minWidth=layout.minWidth;
    if(layout.minHeight!==undefined)node.minHeight=layout.minHeight;
    if(ir.clipsContent!==undefined)node.clipsContent=ir.clipsContent;
    bindFloat(node,"itemSpacing",bindingFor(ir,"layout.itemSpacing"));
    for(const [key,field] of [["paddingTop","top"],["paddingRight","right"],["paddingBottom","bottom"],["paddingLeft","left"]])bindFloat(node,key,bindingFor(ir,"layout.padding."+field));
    bindFloat(node,"minWidth",bindingFor(ir,"layout.minWidth"));bindFloat(node,"minHeight",bindingFor(ir,"layout.minHeight"));
  };
  const applySizing=(node,ir)=>{
    const width=ir.layout?ir.layout.width:ir.width,height=ir.layout?ir.layout.height:ir.height;
    const fixedWidth=width.mode==="fixed"?width.value:Math.max(node.width,1),fixedHeight=height.mode==="fixed"?height.value:Math.max(node.height,1);
    if(width.mode==="fixed"||height.mode==="fixed")node.resizeWithoutConstraints(fixedWidth,fixedHeight);
    node.layoutSizingHorizontal=width.mode==="fill"?"FILL":width.mode==="hug"?"HUG":"FIXED";
    node.layoutSizingVertical=height.mode==="fill"?"FILL":height.mode==="hug"?"HUG":"FIXED";
    if(ir.layout){
      node.primaryAxisSizingMode=(ir.layout.mode==="horizontal"?width:height).mode==="hug"?"AUTO":"FIXED";
      node.counterAxisSizingMode=(ir.layout.mode==="horizontal"?height:width).mode==="hug"?"AUTO":"FIXED";
    }
    bindFloat(node,"width",bindingFor(ir,"width.value")||bindingFor(ir,"layout.width.value"));
    bindFloat(node,"height",bindingFor(ir,"height.value")||bindingFor(ir,"layout.height.value"));
  };
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("INPUT-FONT-PROVENANCE-ABSENT:"+ir.role);const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:{unit:"AUTO"};label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();label.textAutoResize=ir.width.mode==="fill"?"HEIGHT":"WIDTH_AND_HEIGHT";label.blendMode="NORMAL";node=label;
    }else if(ir.kind==="instance"){
      if(!ir.payload)throw new Error("INPUT-ADORNMENT-PAYLOAD-ABSENT:"+ir.componentRef);const helper=helperByRef.get(ir.componentRef+"\0"+JSON.stringify(ir.payload));if(!helper)throw new Error("HELPER-ABSENT:"+ir.componentRef);
      const instance=helper.createInstance();instance.name=ir.label||ir.role;node=instance;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    ${program.overlayPositioning ? `if(ir.layout&&ir.layout.positioning==="absolute"){if(!ir.layout.offset||!ir.layout.constraints)throw new Error("INPUT-OVERLAY-DECLARATION-INCOMPLETE:"+ir.role);node.layoutPositioning="ABSOLUTE";node.x=ir.layout.offset.x;node.y=ir.layout.offset.y;const constraintValue=value=>({left:"MIN",right:"MAX",top:"MIN",bottom:"MAX",center:"CENTER",scale:"SCALE",stretch:"STRETCH"})[value];node.constraints={horizontal:constraintValue(ir.layout.constraints.horizontal),vertical:constraintValue(ir.layout.constraints.vertical)};}` : ""}
    if(ir.kind==="frame"){applyLayout(node,ir);for(const [childIndex,child] of ir.children.entries())await render(child,node,ownershipKey+"/children/"+childIndex);applySizing(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("INPUT-TEXT-GEOMETRY:"+ir.role);
    }
    if(ir.kind==="instance"){
      const text=node.findAllWithCriteria({types:["TEXT"]})[0];
      if(text&&ir.payload){text.fills=ir.payload.fills.map((entry,index)=>boundPaint(entry.color,index===0?bindingFor(ir,"fills.0.color"):undefined));if(text.characters!==ir.payload.content.text||text.width<=0||text.height<=0)throw new Error("INPUT-ADORNMENT-CONTENT-MISMATCH:"+ir.role);}
    }
    createdNodeIds.push(node.id);return node;
  };
  const components=[];
  for(const [componentIndex,ir] of source.ir.children.entries()){
    const floating=ir.children[0]&&ir.children[0].role==="input-field/surface"&&ir.children[0].children&&ir.children[0].children.some(child=>child.role==="input-field/label-row");
    const component=figma.createComponent();${program.overlayPositioning ? "component.clipsContent=false;" : ""}component.name=Object.entries(ir.variantProperties).map(([key,value])=>key+"="+value).join(", ");component.description="recipe-role:"+(ir.role||"");tag(component,ir,"root/children/"+componentIndex);applyLayout(component,ir);applyPaints(component,ir);
    section.appendChild(component);
    for(const [childIndex,child] of ir.children.entries())await render(child,component,"root/children/"+componentIndex+"/children/"+childIndex);
    if(floating){const surface=component.children.find(child=>child.name.split(" :: ",1)[0]==="input-field/surface");if(surface)surface.primaryAxisAlignItems="CENTER";}
    applySizing(component,ir);
    if(component.layoutMode!=="VERTICAL")throw new Error("INPUT-FAKE-LAYOUT:"+component.name);
    components.push(component);createdNodeIds.push(component.id);
  }
  const set=figma.combineAsVariants(components,section);set.name="input-field/set :: "+source.sourceName;set.description="Experimental input-field@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";set.layoutMode="HORIZONTAL";set.layoutWrap="WRAP";set.itemSpacing=24;set.counterAxisSpacing=24;set.paddingTop=32;set.paddingRight=32;set.paddingBottom=32;set.paddingLeft=32;set.resizeWithoutConstraints(1800,Math.max(set.height,200));set.primaryAxisSizingMode="FIXED";set.counterAxisSizingMode="AUTO";set.fills=[paint("#f7f7f8ff")];set.clipsContent=false;
  set.description="recipe-role:input-field/set";
  setSharedData(set,"runIdentity",PLAN.runIdentity);setSharedData(set,"adapterIdentity",source.adapterIdentity);setSharedData(set,"recipeHash",source.recipeHash);setSharedData(set,"envelopeHash",source.envelopeHash);setSharedData(set,"ownershipKey","root");setSharedData(set,"sourceId",source.sourceId);
  const properties={
    "input-field/label":set.addComponentProperty("Label","TEXT",source.contentDefaults["input-field/label"]),
    "input-field/content/placeholder":set.addComponentProperty("Placeholder","TEXT",source.contentDefaults["input-field/content/placeholder"]),
    "input-field/content/value":set.addComponentProperty("Value","TEXT",source.contentDefaults["input-field/content/value"]),
    "input-field/message/helper":set.addComponentProperty("Helper text","TEXT",source.contentDefaults["input-field/message/helper"]),
    "input-field/message/error":set.addComponentProperty("Error text","TEXT",source.contentDefaults["input-field/message/error"]),
  };
  const helperValues=[...helperByRef.values()],leadingHelper=helperValues[0],trailingHelper=helperValues[helperValues.length-1];
  const leadingProperty=set.addComponentProperty("Leading adornment","INSTANCE_SWAP",leadingHelper.id);
  const trailingProperty=set.addComponentProperty("Trailing adornment","INSTANCE_SWAP",trailingHelper.id);
  for(const component of set.children){
    for(const descendant of component.findAllWithCriteria({types:["FRAME","TEXT","INSTANCE"]})){
      const role=(descendant.name.includes("/")&&!descendant.name.includes("=")?descendant.name.split(" :: ",1)[0]:"");
      if(descendant.type==="TEXT"&&properties[role]){descendant.componentPropertyReferences={characters:properties[role]};${program.restoreFillAfterComponentProperties ? `if(role==="input-field/content/placeholder"||role==="input-field/content/value")descendant.layoutSizingHorizontal="FILL";if(descendant.width<=0||descendant.height<=0)throw new Error("INPUT-TEXT-ZERO-WIDTH-AFTER-PROPERTY:"+role);if(!descendant.fontName.family)throw new Error("INPUT-FONT-METRICS-DRIFT:"+role);` : ""}}
      ${program.restoreFillAfterComponentProperties ? `if(descendant.type==="FRAME"&&role==="input-field/content-row")descendant.layoutSizingHorizontal="FILL";` : ""}
      if(descendant.type==="INSTANCE"&&role==="input-field/slot/leading")descendant.componentPropertyReferences={mainComponent:leadingProperty};
      if(descendant.type==="INSTANCE"&&role==="input-field/slot/trailing")descendant.componentPropertyReferences={mainComponent:trailingProperty};
    }
  }
  set.x=80;set.y=128;section.resizeWithoutConstraints(set.width+160,set.height+208);nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,setId:set.id,collectionId:collection.id,variableCount:variables.size,variantCount:set.children.length,cellCount:source.cells.length,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
`;

export function lowerInputFieldFigmaWriter(
  inputs: readonly InputFieldFigmaWriterInput[],
  program: InputFieldFigmaWriterProgram,
): InputFieldFigmaWriter {
  const versionedLineage =
    /^ds\.contracts\.input\.recipe\.v[12]$/.test(program.namespace) &&
    program.version === Number(program.runSuffix.at(-1));
  const v5ExecutionLineage =
    program.namespace === "ds.contracts.input.recipe.v5" &&
    program.version === 2 &&
    program.runSuffix === "input-v5";
  if (!versionedLineage && !v5ExecutionLineage) {
    throw new TypeError("input-field writer: invalid typed program identity");
  }
  const sourcePlans = inputs.map(planSource);
  const failures = validateInputFieldFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));
  const runIdentity =
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
    `-${program.runSuffix}`;
  const pageName = `Recipe Pivot / Input Field / ${runIdentity}`;
  const plan = {
    pageName,
    runIdentity,
    sources: sourcePlans.map(
      ({ expectedScenePlan: _expectedScenePlan, ...source }) => source,
    ),
  };
  return {
    pageName,
    runIdentity,
    sourcePlans,
    code: `const PLAN=${JSON.stringify(plan)};\n${writerRuntime(program)}`,
  };
}

export function emitInputFieldFigmaWriter(
  inputs: readonly InputFieldFigmaWriterInput[],
): InputFieldFigmaWriter {
  return lowerInputFieldFigmaWriter(inputs, {
    version: 1,
    namespace: INPUT_FIELD_FIGMA_NAMESPACE,
    runSuffix: "input-v1",
    overlayPositioning: false,
    restoreFillAfterComponentProperties: false,
    sceneReadbackInstrumentation: false,
  });
}
