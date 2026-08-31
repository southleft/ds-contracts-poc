import { canonicalJson } from "./normalize.js";
import type { RecipeEnvelope } from "./envelope.js";
import type { ComponentSetNode, IRNode, VariableBinding } from "./figma-ir.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";
import {
  COMBOBOX_APPEARANCES,
  COMBOBOX_CONTENT,
  COMBOBOX_FIELD_STATES,
  COMBOBOX_OPEN,
  COMBOBOX_OPTION_STATES,
  COMBOBOX_SIZES,
} from "./recipes/combobox.js";

export const COMBOBOX_FIGMA_NAMESPACE = "ds.contracts.combobox.recipe.v1";
export const COMBOBOX_FIGMA_WRITER_VERSION = 1;
export const COMBOBOX_FIGMA_RUN_SUFFIX = "combobox-v1";
export const FORBIDDEN_INPUT_NAMESPACE = "ds.contracts.input.recipe.v5";
export const FORBIDDEN_INPUT_RUN_IDENTITY = "4a074b24-e8503dd5-input-v5";
export const FORBIDDEN_INPUT_PAGE_ID = "115:295378";

type ComboboxAxisName =
  | "Size"
  | "Appearance"
  | "Open"
  | "Field state"
  | "Content";
type ComboboxCell = [number, number, number, number, number];
type OptionAxisName = "Size" | "Option state";
type OptionCell = [number, number];

interface VariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface ComboboxFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface ComboboxFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  comboboxAxes: Record<ComboboxAxisName, string[]>;
  optionAxes: Record<OptionAxisName, string[]>;
  comboboxCells: ComboboxCell[];
  optionCells: OptionCell[];
  comboboxSet: ComponentSetNode;
  optionSet: ComponentSetNode;
  variables: VariablePlan[];
  contentDefaults: Record<string, string>;
  optionAriaDefaults: {
    Label: string;
    Value: string;
    Disabled: boolean;
  };
  comparedIrFacts: number;
}

export interface ComboboxFigmaWriter {
  pageName: string;
  runIdentity: string;
  namespace: string;
  sourcePlans: ComboboxFigmaSourcePlan[];
  code: string;
}

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

const atPath = (value: unknown, field: string): unknown =>
  field.split(".").reduce<unknown>((current, part) => {
    if (current === null || typeof current !== "object") return undefined;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    return (current as Record<string | number, unknown>)[key];
  }, value);

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
    `combobox live writer: unsupported binding ${binding.field}=${JSON.stringify(value)}`,
  );
};

const countComparedFacts = (root: IRNode): number => {
  let count = 0;
  walk(root, (node) => {
    count += Object.keys(node).filter((key) => key !== "label").length;
  });
  return count;
};

const optionAriaFromInstance = (
  node: IRNode,
): ComboboxFigmaSourcePlan["optionAriaDefaults"] | undefined => {
  if (node.kind !== "instance" || node.componentRef !== "combobox@1/option")
    return undefined;
  const label = node.properties.Label;
  const value = node.properties.Value;
  const disabled = node.properties.Disabled;
  if (
    typeof label !== "string" ||
    typeof value !== "string" ||
    typeof disabled !== "boolean"
  ) {
    throw new TypeError(
      "combobox live writer: option instance missing source Label/Value/Disabled",
    );
  }
  return { Label: label, Value: value, Disabled: disabled };
};

const requireSet = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind !== "frame") {
    throw new TypeError("combobox live writer requires combobox/library frame");
  }
  const found = root.children.filter((child) => child.role === role);
  if (found.length !== 1 || found[0]!.kind !== "component-set") {
    throw new TypeError(`combobox live writer: required ${role} set`);
  }
  return found[0];
};

const planSource = (
  input: ComboboxFigmaWriterInput,
): ComboboxFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "combobox" ||
    input.envelope.recipe.version !== 1
  ) {
    throw new TypeError("combobox live writer requires combobox@1");
  }
  const comboboxSet = requireSet(input.envelope.ir, "combobox/set");
  const optionSet = requireSet(input.envelope.ir, "combobox/option-set");
  const comboboxAxes = Object.fromEntries(
    comboboxSet.variantAxes.map((axis) => [axis.name, [...axis.values]]),
  ) as Partial<Record<ComboboxAxisName, string[]>>;
  const optionAxes = Object.fromEntries(
    optionSet.variantAxes.map((axis) => [axis.name, [...axis.values]]),
  ) as Partial<Record<OptionAxisName, string[]>>;
  for (const [name, expected] of [
    ["Size", COMBOBOX_SIZES],
    ["Appearance", COMBOBOX_APPEARANCES],
    ["Open", COMBOBOX_OPEN],
    ["Field state", COMBOBOX_FIELD_STATES],
    ["Content", COMBOBOX_CONTENT],
  ] as const) {
    if (canonicalJson(comboboxAxes[name]) !== canonicalJson(expected)) {
      throw new TypeError(`combobox live writer: incomplete ${name} axis`);
    }
  }
  if (
    canonicalJson(optionAxes.Size) !== canonicalJson(COMBOBOX_SIZES) ||
    canonicalJson(optionAxes["Option state"]) !==
      canonicalJson(COMBOBOX_OPTION_STATES)
  ) {
    throw new TypeError("combobox live writer: incomplete option axes");
  }
  const completeCombobox = comboboxAxes as Record<ComboboxAxisName, string[]>;
  const completeOption = optionAxes as Record<OptionAxisName, string[]>;
  const comboboxAxisNames: ComboboxAxisName[] = [
    "Size",
    "Appearance",
    "Open",
    "Field state",
    "Content",
  ];
  const optionAxisNames: OptionAxisName[] = ["Size", "Option state"];
  const comboboxCells = comboboxSet.children.map(
    (component) =>
      comboboxAxisNames.map((name) =>
        completeCombobox[name].indexOf(component.variantProperties[name]!),
      ) as ComboboxCell,
  );
  const optionCells = optionSet.children.map(
    (component) =>
      optionAxisNames.map((name) =>
        completeOption[name].indexOf(component.variantProperties[name]!),
      ) as OptionCell,
  );
  if (
    comboboxCells.length !== 64 ||
    optionCells.length !== 8 ||
    comboboxCells.some((cell) => cell.some((index) => index < 0)) ||
    optionCells.some((cell) => cell.some((index) => index < 0))
  ) {
    throw new TypeError(
      `combobox live writer requires 64+8 cells; found ${comboboxCells.length}+${optionCells.length}`,
    );
  }
  const registry = new Map<string, VariablePlan>();
  const contentDefaults: Record<string, string> = {};
  walk(input.envelope.ir, (node) => {
    if (
      node.kind === "text" &&
      node.role &&
      contentDefaults[node.role] === undefined
    ) {
      contentDefaults[node.role] = node.characters;
    }
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value)) {
        throw new TypeError(
          `combobox live writer: conflicting fallback for ${binding.variable}`,
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
  if (registry.size === 0) {
    throw new TypeError("combobox live writer: zero planned variables");
  }
  const optionAriaOccurrences: ComboboxFigmaSourcePlan["optionAriaDefaults"][] =
    [];
  walk(comboboxSet, (node) => {
    const aria = optionAriaFromInstance(node);
    if (aria) optionAriaOccurrences.push(aria);
  });
  if (optionAriaOccurrences.length === 0) {
    throw new TypeError(
      "combobox live writer: no option instances carrying source Label/Value/Disabled",
    );
  }
  const optionAriaDefaults = optionAriaOccurrences[0]!;
  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    comboboxAxes: completeCombobox,
    optionAxes: completeOption,
    comboboxCells,
    optionCells,
    comboboxSet,
    optionSet,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    contentDefaults,
    optionAriaDefaults,
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateComboboxFigmaSourcePlans(
  plans: readonly ComboboxFigmaSourcePlan[],
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
    if (source.comboboxCells.length !== 64) {
      failures.push(`${source.adapterIdentity}: expected 64 combobox cells`);
    }
    if (source.optionCells.length !== 8) {
      failures.push(`${source.adapterIdentity}: expected 8 option cells`);
    }
    if (source.variables.length === 0) {
      failures.push(`${source.adapterIdentity}: variables denominator is zero`);
    }
    if (source.comparedIrFacts <= 0) {
      failures.push(
        `${source.adapterIdentity}: compared facts denominator is zero`,
      );
    }
    if (
      typeof source.optionAriaDefaults.Label !== "string" ||
      typeof source.optionAriaDefaults.Value !== "string" ||
      typeof source.optionAriaDefaults.Disabled !== "boolean" ||
      source.optionAriaDefaults.Value.length === 0
    ) {
      failures.push(
        `${source.adapterIdentity}: option ARIA defaults missing source Label/Value/Disabled`,
      );
    }
    const roles = new Set<string>();
    walk(source.comboboxSet, (node) => {
      if (node.role) roles.add(node.role);
    });
    walk(source.optionSet, (node) => {
      if (node.role) roles.add(node.role);
    });
    for (const role of [
      "combobox/trigger",
      "combobox/input",
      "combobox/overlay",
      "combobox/listbox",
      "combobox/label",
      "combobox/control/leading",
      "combobox/option/label",
    ]) {
      if (!roles.has(role)) {
        failures.push(`${source.adapterIdentity}: missing ${role}`);
      }
    }
  }
  return failures;
}

const writerRuntime = (namespace: string, version: number): string =>
  String.raw`
const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh";
const EXPECTED_FILE_NAME="Scratch Project";
const NS = ${JSON.stringify(namespace)};
const WRITER_VERSION=${JSON.stringify(String(version))};
const PAGE_OWNER="recipe/combobox/"+PLAN.runIdentity;
if(NS==="ds.contracts.input.recipe.v5"||PLAN.runIdentity==="4a074b24-e8503dd5-input-v5")throw new Error("COMBOBOX-INPUT-IDENTITY-REUSE");
if(PLAN.runIdentity==="70c24cbd-d27f2e85-combobox-v1")throw new Error("COMBOBOX-V41-IDENTITY-REUSE");
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
if(figma.currentPage&&figma.currentPage.id==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
if(figma.currentPage&&(figma.currentPage.id==="163:35981"||figma.currentPage.id==="173:48924"||figma.currentPage.id==="181:64873"||figma.currentPage.id==="183:69150"||figma.currentPage.id==="85:6781"))throw new Error("COMBOBOX-MUST-NOT-WRITE-SIGNED-PAGE:"+figma.currentPage.id);
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(!page){page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);}
else if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("COMBOBOX-PAGE-OWNERSHIP-COLLISION:"+page.id);
if(page.id==="115:295378")throw new Error("COMBOBOX-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981"||page.id==="173:48924"||page.id==="181:64873"||page.id==="183:69150"||page.id==="85:6781")throw new Error("COMBOBOX-MUST-NOT-WRITE-SIGNED-PAGE:"+page.id);
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
  if(!found)throw new Error("COMBOBOX-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("COMBOBOX-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("COMBOBOX-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const source of PLAN.sources){
  const oldSections=page.children.filter(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  for(const old of oldSections){
    const collectionId=getSharedData(old,"variableCollectionId");
    if(collectionId){const collection=await figma.variables.getVariableCollectionByIdAsync(collectionId);if(collection&&!collection.remote){if(getSharedData(collection,"collectionOwner")!==PAGE_OWNER+"/variable-collection"||getSharedData(collection,"runIdentity")!==PLAN.runIdentity)throw new Error("COMBOBOX-VARIABLE-COLLECTION-OWNERSHIP-COLLISION:"+collection.id);collection.remove();}}
    old.remove();
  }
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Combobox / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("COMBOBOX-VARIABLE-COLLECTION-COLLISION:"+collectionName);
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
    variable.scopes=["ALL_SCOPES"];
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
  helpers.name="__Combobox helpers / "+source.displayName;
  helpers.layoutMode="HORIZONTAL";helpers.primaryAxisSizingMode="AUTO";helpers.counterAxisSizingMode="AUTO";helpers.itemSpacing=24;helpers.fills=[];
  section.appendChild(helpers);helpers.x=48;helpers.y=48;createdNodeIds.push(helpers.id);
  const helperByRef=new Map();
  const makeHelper=async(ref,sample)=>{
    if(helperByRef.has(ref))return helperByRef.get(ref);
    const helper=figma.createComponent();
    helper.name="__Combobox control / "+ref;
    helper.layoutMode="HORIZONTAL";helper.primaryAxisSizingMode="FIXED";helper.counterAxisSizingMode="FIXED";helper.fills=sample.fills&&sample.fills[0]?[paint(sample.fills[0].color)]:[];
    helpers.appendChild(helper);
    const size=sample.width&&sample.width.mode==="fixed"?sample.width.value:16;
    helper.resizeWithoutConstraints(size,size);
    helperByRef.set(ref,helper);createdNodeIds.push(helper.id);return helper;
  };
  const gather=ir=>{
    if(ir.kind==="instance"&&ir.componentRef&&ir.componentRef!=="combobox@1/option")helperByRef.set(ir.componentRef,ir);
    if(ir.children)for(const child of ir.children)gather(child);
  };
  gather(source.optionSet);gather(source.comboboxSet);
  const controlSamples=new Map(helperByRef);helperByRef.clear();
  for(const [ref,sample] of controlSamples)await makeHelper(ref,sample);
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
    if(width.mode==="fill")node.layoutSizingHorizontal="FILL";
    else if(width.mode==="hug")node.layoutSizingHorizontal="HUG";
    else node.layoutSizingHorizontal="FIXED";
    if(height.mode==="fill")node.layoutSizingVertical="FILL";
    else if(height.mode==="hug")node.layoutSizingVertical="HUG";
    else node.layoutSizingVertical="FIXED";
    if(ir.layout){
      node.primaryAxisSizingMode=(ir.layout.mode==="horizontal"?width:height).mode==="hug"?"AUTO":"FIXED";
      node.counterAxisSizingMode=(ir.layout.mode==="horizontal"?height:width).mode==="hug"?"AUTO":"FIXED";
    }
    bindFloat(node,"width",bindingFor(ir,"width.value")||bindingFor(ir,"layout.width.value"));
    bindFloat(node,"height",bindingFor(ir,"height.value")||bindingFor(ir,"layout.height.value"));
  };
  const applySetLayout=(set,ir)=>{
    applyLayout(set,ir);applyPaints(set,ir);applySizing(set,ir);
  };
  const firstSegment=name=>name.split(" :: ",1)[0];
  const sceneRole=name=>{const role=firstSegment(name);return role.includes("=")?"":role;};
  const propertyKey=(instance,name)=>Object.keys(instance.componentProperties||{}).find(key=>key.split("#")[0]===name);
  void "COMBOBOX-WRITER-FIRST-SEGMENT-BIND";
  const optionByKey=new Map();
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("COMBOBOX-FONT-PROVENANCE-ABSENT:"+ir.role);const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:{unit:"AUTO"};label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();label.textAutoResize=ir.width.mode==="fill"?"HEIGHT":"WIDTH_AND_HEIGHT";label.blendMode="NORMAL";node=label;
    }else if(ir.kind==="instance"){
      if(ir.componentRef==="combobox@1/option"){
        const key=(ir.properties.Size||"")+"|"+(ir.properties["Option state"]||"");
        const main=optionByKey.get(key);if(!main)throw new Error("COMBOBOX-OPTION-MAIN-ABSENT:"+key);
        node=main.createInstance();
        const updates={};
        for(const name of ["Label","Value","Disabled"]){
          const property=propertyKey(node,name);if(!property)throw new Error("COMBOBOX-OPTION-ARIA-PROPERTY-ABSENT:"+name);
          const value=ir.properties[name];
          if(name==="Disabled"?typeof value!=="boolean":typeof value!=="string")throw new Error("COMBOBOX-OPTION-ARIA-SOURCE-ABSENT:"+name);
          updates[property]=value;
        }
        node.setProperties(updates);
      }else{
        const helper=helperByRef.get(ir.componentRef);if(!helper)throw new Error("COMBOBOX-HELPER-ABSENT:"+ir.componentRef);
        node=helper.createInstance();
      }
      node.name=ir.label||ir.role;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    const hiddenFillContent=(ir.kind==="text"&&ir.width&&ir.width.mode==="fill"&&ir.visible===false);void "COMBOBOX-WRITER-HIDDEN-FILL-OCCUPANCY";
    node.visible=hiddenFillContent||ir.visible!==false;node.opacity=hiddenFillContent?0:(ir.opacity===undefined?1:ir.opacity);
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(ir.layout&&ir.layout.positioning==="absolute"){if(!ir.layout.offset||!ir.layout.constraints)throw new Error("COMBOBOX-OVERLAY-DECLARATION-INCOMPLETE:"+ir.role);node.layoutPositioning="ABSOLUTE";node.x=ir.layout.offset.x;node.y=ir.layout.offset.y;const constraintValue=value=>({left:"MIN",right:"MAX",top:"MIN",bottom:"MAX",center:"CENTER",scale:"SCALE",stretch:"STRETCH"})[value];node.constraints={horizontal:constraintValue(ir.layout.constraints.horizontal),vertical:constraintValue(ir.layout.constraints.vertical)};}
    if(ir.kind==="frame"){applyLayout(node,ir);for(const [childIndex,child] of ir.children.entries())await render(child,node,ownershipKey+"/children/"+childIndex);applySizing(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("COMBOBOX-TEXT-GEOMETRY:"+ir.role);
    }
    if(ir.kind==="instance"&&ir.componentRef!=="combobox@1/option"&&ir.fills&&ir.fills[0]){
      node.fills=[boundPaint(ir.fills[0].color,bindingFor(ir,"fills.0.color"))];
    }
    createdNodeIds.push(node.id);return node;
  };
  const mintSet=async(setIr,kind)=>{
    const components=[];
    for(const [componentIndex,ir] of setIr.children.entries()){
      const component=figma.createComponent();component.clipsContent=false;component.name=Object.entries(ir.variantProperties).map(([key,value])=>key+"="+value).join(", ");component.description="recipe-role:"+(ir.role||"");tag(component,ir,kind+"/children/"+componentIndex);applyLayout(component,ir);applyPaints(component,ir);
      section.appendChild(component);
      for(const [childIndex,child] of ir.children.entries())await render(child,component,kind+"/children/"+componentIndex+"/children/"+childIndex);
      applySizing(component,ir);
      if(kind==="combobox"&&component.layoutMode!=="VERTICAL")throw new Error("COMBOBOX-FAKE-LAYOUT:"+component.name);
      components.push(component);createdNodeIds.push(component.id);
    }
    const set=figma.combineAsVariants(components,section);
    set.name=setIr.role+" :: "+source.sourceName;
    set.description="Experimental combobox@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    applySetLayout(set,setIr);
    setSharedData(set,"runIdentity",PLAN.runIdentity);setSharedData(set,"adapterIdentity",source.adapterIdentity);setSharedData(set,"recipeHash",source.recipeHash);setSharedData(set,"ownershipKey",kind);
    return set;
  };
  const optionSet=await mintSet(source.optionSet,"option");
  void "COMBOBOX-WRITER-OPTION-ARIA-PROPERTIES";
  const optionLabelProperty=optionSet.addComponentProperty("Label","TEXT",source.optionAriaDefaults.Label);
  optionSet.addComponentProperty("Value","TEXT",source.optionAriaDefaults.Value);
  optionSet.addComponentProperty("Disabled","BOOLEAN",source.optionAriaDefaults.Disabled);
  for(const component of optionSet.children){
    for(const descendant of component.findAllWithCriteria({types:["TEXT"]})){
      if(sceneRole(descendant.name)==="combobox/option/label")descendant.componentPropertyReferences={characters:optionLabelProperty};
    }
    const props=Object.fromEntries(component.name.split(", ").map(part=>{const index=part.indexOf("=");return [part.slice(0,index),part.slice(index+1)];}));
    optionByKey.set((props.Size||"")+"|"+(props["Option state"]||""),component);
  }
  const comboboxSet=await mintSet(source.comboboxSet,"combobox");
  const textProperties={
    "combobox/label":comboboxSet.addComponentProperty("Label","TEXT",source.contentDefaults["combobox/label"]||""),
    "combobox/input":comboboxSet.addComponentProperty("Placeholder","TEXT",source.contentDefaults["combobox/input"]||""),
    "combobox/message/helper":comboboxSet.addComponentProperty("Helper text","TEXT",source.contentDefaults["combobox/message/helper"]||""),
    "combobox/message/error":comboboxSet.addComponentProperty("Error text","TEXT",source.contentDefaults["combobox/message/error"]||""),
    "combobox/listbox/empty":comboboxSet.addComponentProperty("Empty text","TEXT",source.contentDefaults["combobox/listbox/empty"]||""),
    "combobox/listbox/loading":comboboxSet.addComponentProperty("Loading text","TEXT",source.contentDefaults["combobox/listbox/loading"]||""),
  };
  const helperValues=[...helperByRef.values()];
  const leadingProperty=helperValues[0]?comboboxSet.addComponentProperty("Leading control","INSTANCE_SWAP",helperValues[0].id):null;
  const clearProperty=helperValues[1]?comboboxSet.addComponentProperty("Clear indicator","INSTANCE_SWAP",helperValues[1].id):null;
  const popupProperty=helperValues[2]?comboboxSet.addComponentProperty("Popup indicator","INSTANCE_SWAP",helperValues[2].id):null;
  for(const component of comboboxSet.children){
    for(const descendant of component.findAllWithCriteria({types:["FRAME","TEXT","INSTANCE"]})){
      const role=sceneRole(descendant.name);
      if(descendant.type==="TEXT"&&textProperties[role]){descendant.componentPropertyReferences={characters:textProperties[role]};if(role==="combobox/input"&&descendant.layoutSizingHorizontal)descendant.layoutSizingHorizontal="FILL";}
      if(descendant.type==="INSTANCE"&&role==="combobox/control/leading"&&leadingProperty)descendant.componentPropertyReferences={mainComponent:leadingProperty};
      if(descendant.type==="INSTANCE"&&role==="combobox/control/clear"&&clearProperty)descendant.componentPropertyReferences={mainComponent:clearProperty};
      if(descendant.type==="INSTANCE"&&role==="combobox/control/popup"&&popupProperty)descendant.componentPropertyReferences={mainComponent:popupProperty};
    }
  }
  optionSet.x=80;optionSet.y=96;comboboxSet.x=80;comboboxSet.y=optionSet.y+optionSet.height+96;
  section.resizeWithoutConstraints(Math.max(optionSet.width,comboboxSet.width)+160,comboboxSet.y+comboboxSet.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,comboboxSetId:comboboxSet.id,optionSetId:optionSet.id,collectionId:collection.id,variableCount:variables.size,variantCount:comboboxSet.children.length+optionSet.children.length,comboboxCells:source.comboboxCells.length,optionCells:source.optionCells.length,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
`;

export function emitComboboxFigmaWriter(
  inputs: readonly ComboboxFigmaWriterInput[],
): ComboboxFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateComboboxFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));
  const runIdentity =
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
    `-${COMBOBOX_FIGMA_RUN_SUFFIX}`;
  if (
    COMBOBOX_FIGMA_NAMESPACE === FORBIDDEN_INPUT_NAMESPACE ||
    runIdentity === FORBIDDEN_INPUT_RUN_IDENTITY
  ) {
    throw new TypeError("combobox writer must not reuse Input identity");
  }
  if (runIdentity === "70c24cbd-d27f2e85-combobox-v1") {
    throw new TypeError("combobox writer must not reuse V41 identity");
  }
  const pageName = `Recipe Pivot / Combobox / ${runIdentity}`;
  const plan = {
    pageName,
    runIdentity,
    sources: sourcePlans.map(
      ({ comboboxSet, optionSet, ...source }) => ({
        ...source,
        comboboxSet,
        optionSet,
      }),
    ),
  };
  const runtime = writerRuntime(
    COMBOBOX_FIGMA_NAMESPACE,
    COMBOBOX_FIGMA_WRITER_VERSION,
  );
  if (
    runtime.includes("node.letterSpacing") ||
    runtime.includes("node.textCase") ||
    runtime.includes("node.textDecoration")
  ) {
    throw new TypeError(
      "combobox writer invented TEXT extras compile omits",
    );
  }
  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    namespace: COMBOBOX_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
