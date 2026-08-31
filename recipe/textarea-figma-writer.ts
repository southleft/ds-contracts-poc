/**
 * textarea@1 Figma writer.
 *
 * Inherits the hardened calendar/table writer shape: exact file identity,
 * signed-page refuse, owned variable collections, font provenance + named
 * fallback walk (no Inter), set name carries the compile label, hug text
 * records intrinsic size before a 0-width parent can collapse it, layout
 * then children then sizing.
 *
 * Textarea is a vertical label + multi-line box. One component set per
 * source: Disabled × Content (4 variants). Do not remint Input.
 *
 * No live write happens here. Executing the program requires a separate
 * PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentSetNode, IRNode, VariableBinding } from "./figma-ir.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import { TEXTAREA_DISABLED, TEXTAREA_CONTENT } from "./recipes/textarea.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const TEXTAREA_FIGMA_NAMESPACE = "ds.contracts.textarea.recipe.v1";
export const TEXTAREA_FIGMA_WRITER_VERSION = 1;
export const TEXTAREA_FIGMA_RUN_SUFFIX = "textarea-v1";

export const FORBIDDEN_INPUT_NAMESPACE = "ds.contracts.input.recipe.v5";
export const FORBIDDEN_INPUT_RUN_IDENTITY = "4a074b24-e8503dd5-input-v5";
export const FORBIDDEN_INPUT_PAGE_ID = "115:295378";
export const FORBIDDEN_COMBOBOX_NAMESPACE = "ds.contracts.combobox.recipe.v1";
export const FORBIDDEN_COMBOBOX_V41_PAGE_ID = "163:35981";
export const FORBIDDEN_COMBOBOX_V42_PAGE_ID = "183:70641";
export const FORBIDDEN_BUTTON_PAGE_ID = "183:69150";
export const FORBIDDEN_PRESERVED_BUTTON_PAGE_ID = "85:6781";
export const FORBIDDEN_TABLE_NAMESPACE = "ds.contracts.table.recipe.v1";
export const FORBIDDEN_TABLE_PAGE_ID = "173:48924";
export const FORBIDDEN_CALENDAR_PAGE_ID = "181:64873";
export const FORBIDDEN_CHECKBOX_NAMESPACE = "ds.contracts.checkbox.recipe.v1";
export const FORBIDDEN_CHECKBOX_PAGE_ID = "183:74742";
export const FORBIDDEN_RADIO_NAMESPACE = "ds.contracts.radio.recipe.v1";
export const FORBIDDEN_RADIO_PAGE_ID = "183:75031";
export const FORBIDDEN_SWITCH_NAMESPACE = "ds.contracts.switch.recipe.v1";
export const FORBIDDEN_SWITCH_PAGE_ID = "183:75302";

export const TEXTAREA_FIGMA_VARIANTS_PER_SOURCE =
  TEXTAREA_DISABLED.length * TEXTAREA_CONTENT.length;

export interface TextareaVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface TextareaFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface TextareaFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  textareaAxes: Record<string, string[]>;
  textareaSet: ComponentSetNode;
  variables: TextareaVariablePlan[];
  comparedIrFacts: number;
}

export interface TextareaFigmaWriter {
  pageName: string;
  runIdentity: string;
  namespace: string;
  sourcePlans: TextareaFigmaSourcePlan[];
  code: string;
}

const walk = (node: IRNode, visit: (candidate: IRNode) => void): void => {
  visit(node);
  if (
    node.kind === "frame" ||
    node.kind === "component" ||
    node.kind === "component-set"
  )
    for (const child of node.children) walk(child, visit);
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
  if (binding.type === "COLOR") {
    if (typeof value !== "string")
      throw new TypeError(
        `textarea live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `textarea live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `textarea live writer: unsupported binding type ${binding.type}`,
  );
};

const requireSet = (root: IRNode, role: string): ComponentSetNode => {
  if (root.kind === "component-set" && root.role === role) return root;
  throw new TypeError(`textarea live writer: required ${role} set`);
};

const axisValues = (set: ComponentSetNode, name: string): string[] => {
  const axis = set.variantAxes.find((candidate) => candidate.name === name);
  if (!axis) throw new TypeError(`textarea live writer: missing ${name} axis`);
  return [...axis.values];
};

const countComparedFacts = (node: IRNode): number => {
  let total = 0;
  walk(node, (candidate) => {
    total += 1;
    total += (candidate.bindings ?? []).length;
  });
  return total;
};

const planSource = (
  input: TextareaFigmaWriterInput,
): TextareaFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "textarea" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("textarea live writer requires textarea@1");
  if (input.envelope.archetype !== "input / field")
    throw new TypeError("textarea live writer requires the input / field archetype");

  const textareaSet = requireSet(input.envelope.ir, "textarea/set");
  const textareaAxes = {
    Disabled: axisValues(textareaSet, "Disabled"),
    Content: axisValues(textareaSet, "Content"),
  };
  if (canonicalJson(textareaAxes.Disabled) !== canonicalJson([...TEXTAREA_DISABLED]))
    throw new TypeError("textarea live writer: incomplete Disabled axis");
  if (
    canonicalJson(textareaAxes.Content) !== canonicalJson([...TEXTAREA_CONTENT])
  )
    throw new TypeError("textarea live writer: incomplete Content axis");
  if (textareaSet.children.length !== TEXTAREA_FIGMA_VARIANTS_PER_SOURCE)
    throw new TypeError("textarea live writer: incomplete variant matrix");

  const registry = new Map<string, TextareaVariablePlan>();
  walk(textareaSet, (node) => {
    if (node.kind === "instance")
      throw new TypeError(
        `textarea live writer: unexpected instance ${node.componentRef}`,
      );
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value))
        throw new TypeError(
          `textarea live writer: conflicting fallback for ${binding.variable}`,
        );
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
  if (registry.size === 0)
    throw new TypeError("textarea live writer: zero planned variables");

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    textareaAxes,
    textareaSet,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateTextareaFigmaSourcePlans(
  plans: readonly TextareaFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("textarea live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("textarea live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (plan.textareaSet.children.length !== TEXTAREA_FIGMA_VARIANTS_PER_SOURCE)
      failures.push(
        `${plan.adapterIdentity}: expected ${TEXTAREA_FIGMA_VARIANTS_PER_SOURCE} variants`,
      );
  }
  return failures;
}

const writerRuntime = (namespace: string, version: number): string =>
  String.raw`
const EXPECTED_FILE_KEY="byMp6lt0Ij9b2QbkDGFwBh";
const EXPECTED_FILE_NAME="Scratch Project";
const NS = ${JSON.stringify(namespace)};
const WRITER_VERSION=${JSON.stringify(String(version))};
const PAGE_OWNER="recipe/textarea/"+PLAN.runIdentity;
if(NS==="ds.contracts.input.recipe.v5"||PLAN.runIdentity==="4a074b24-e8503dd5-input-v5")throw new Error("TEXTAREA-INPUT-IDENTITY-REUSE");
if(NS==="ds.contracts.combobox.recipe.v1"||PLAN.runIdentity==="70c24cbd-d27f2e85-combobox-v1")throw new Error("TEXTAREA-COMBOBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.table.recipe.v1")throw new Error("TEXTAREA-TABLE-IDENTITY-REUSE");
if(NS==="ds.contracts.calendar.recipe.v1")throw new Error("TEXTAREA-CALENDAR-IDENTITY-REUSE");
if(NS==="ds.contracts.checkbox.recipe.v1")throw new Error("TEXTAREA-CHECKBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.radio.recipe.v1")throw new Error("TEXTAREA-RADIO-IDENTITY-REUSE");
if(NS==="ds.contracts.switch.recipe.v1")throw new Error("TEXTAREA-SWITCH-IDENTITY-REUSE");
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
void "TEXTAREA-MUST-NOT-WRITE-INPUT-PAGE";
void "TEXTAREA-MUST-NOT-WRITE-COMBOBOX-PAGE";
void "TEXTAREA-MUST-NOT-WRITE-COMBOBOX-V42-PAGE";
void "TEXTAREA-MUST-NOT-WRITE-BUTTON-PAGE";
void "TEXTAREA-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE";
void "TEXTAREA-MUST-NOT-WRITE-TABLE-PAGE";
void "TEXTAREA-MUST-NOT-WRITE-CALENDAR-PAGE";
void "TEXTAREA-MUST-NOT-WRITE-CHECKBOX-PAGE";
void "TEXTAREA-MUST-NOT-WRITE-RADIO-PAGE";
void "TEXTAREA-MUST-NOT-WRITE-SWITCH-PAGE";
if(figma.currentPage&&figma.currentPage.id==="115:295378")throw new Error("TEXTAREA-MUST-NOT-WRITE-INPUT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="163:35981")throw new Error("TEXTAREA-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:70641")throw new Error("TEXTAREA-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:69150")throw new Error("TEXTAREA-MUST-NOT-WRITE-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="85:6781")throw new Error("TEXTAREA-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="173:48924")throw new Error("TEXTAREA-MUST-NOT-WRITE-TABLE-PAGE");
if(figma.currentPage&&figma.currentPage.id==="181:64873")throw new Error("TEXTAREA-MUST-NOT-WRITE-CALENDAR-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:74742")throw new Error("TEXTAREA-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75031")throw new Error("TEXTAREA-MUST-NOT-WRITE-RADIO-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75302")throw new Error("TEXTAREA-MUST-NOT-WRITE-SWITCH-PAGE");
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(page){
  if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("TEXTAREA-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(getSharedData(page,"runIdentity")!==PLAN.runIdentity)throw new Error("TEXTAREA-PAGE-IDENTITY-MISMATCH:"+page.id);
}else{
  page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);
}
if(page.id==="115:295378")throw new Error("TEXTAREA-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("TEXTAREA-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(page.id==="183:70641")throw new Error("TEXTAREA-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(page.id==="183:69150")throw new Error("TEXTAREA-MUST-NOT-WRITE-BUTTON-PAGE");
if(page.id==="85:6781")throw new Error("TEXTAREA-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(page.id==="173:48924")throw new Error("TEXTAREA-MUST-NOT-WRITE-TABLE-PAGE");
if(page.id==="181:64873")throw new Error("TEXTAREA-MUST-NOT-WRITE-CALENDAR-PAGE");
if(page.id==="183:74742")throw new Error("TEXTAREA-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(page.id==="183:75031")throw new Error("TEXTAREA-MUST-NOT-WRITE-RADIO-PAGE");
if(page.id==="183:75302")throw new Error("TEXTAREA-MUST-NOT-WRITE-SWITCH-PAGE");
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
  if(!found)throw new Error("TEXTAREA-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("TEXTAREA-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("TEXTAREA-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const child of page.children){
  if(child.type==="SECTION")nextSectionX=Math.max(nextSectionX,child.x+child.width+240);
}
for(const source of PLAN.sources){
  const existingSection=page.children.find(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  if(existingSection)throw new Error("TEXTAREA-SECTION-EXISTS:"+source.adapterIdentity+":"+existingSection.id);
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Textarea / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("TEXTAREA-VARIABLE-COLLECTION-COLLISION:"+collectionName);
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
  };
  const align={min:"MIN",center:"CENTER",max:"MAX","space-between":"SPACE_BETWEEN",baseline:"BASELINE"};
  const applyLayout=(node,ir)=>{
    const layout=ir.layout;
    node.layoutMode=layout.mode.toUpperCase();
    node.primaryAxisAlignItems=align[layout.primaryAxisAlign];
    node.counterAxisAlignItems=align[layout.counterAxisAlign];
    node.itemSpacing=layout.itemSpacing;
    node.paddingTop=Math.max(0,layout.padding.top);node.paddingRight=Math.max(0,layout.padding.right);node.paddingBottom=Math.max(0,layout.padding.bottom);node.paddingLeft=Math.max(0,layout.padding.left);
    if(ir.clipsContent!==undefined)node.clipsContent=ir.clipsContent;
    bindFloat(node,"itemSpacing",bindingFor(ir,"layout.itemSpacing"));
    for(const [key,field] of [["paddingTop","top"],["paddingRight","right"],["paddingBottom","bottom"],["paddingLeft","left"]])bindFloat(node,key,bindingFor(ir,"layout.padding."+field));
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
  const applySetLayout=(set,ir)=>{applyLayout(set,ir);applyPaints(set,ir);applySizing(set,ir);};
  const firstSegment=name=>name.split(" :: ",1)[0];
  void "TEXTAREA-WRITER-FIRST-SEGMENT-BIND";
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("TEXTAREA-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:{unit:"AUTO"};
      label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();
      label.textAutoResize="WIDTH_AND_HEIGHT";label.blendMode="NORMAL";
      void "TEXTAREA-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC";
      void "TEXTAREA-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH";
      if(label.characters.trim().length>0&&(label.width<=0||label.absoluteRenderBounds===null)){
        const chain=ir.type.fontProvenance.fallbackChain||[];
        const resolvedFamily=ir.type.fontProvenance.resolvedFamily;
        const resolvedStyle=ir.type.fontProvenance.resolvedStyle;
        let painted=false;
        for(const candidate of chain){
          if(candidate.family===resolvedFamily&&candidate.style===resolvedStyle)continue;
          const found=allFonts.find(entry=>entry.fontName.family===candidate.family&&entry.fontName.style===candidate.style);
          if(!found)continue;
          await figma.loadFontAsync(found.fontName);
          label.fontName=found.fontName;
          label.characters=ir.characters;
          if(label.width>0&&label.absoluteRenderBounds){painted=true;break;}
        }
        if(!painted&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("TEXTAREA-FONT-ZERO-INTRINSIC:"+ir.role);
      }
      node=label;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    let hugTextIntrinsic=null;
    if(ir.kind==="text"){
      void "TEXTAREA-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE";
      void "TEXTAREA-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC";
      if(node.width<=0||node.height<=0)throw new Error("TEXTAREA-TEXT-GEOMETRY:"+ir.role);
      hugTextIntrinsic={width:node.width,height:node.height};
    }
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
    if(ir.kind==="frame"){applyLayout(node,ir);for(const [childIndex,child] of ir.children.entries())await render(child,node,ownershipKey+"/children/"+childIndex);applySizing(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("TEXTAREA-TEXT-GEOMETRY:"+ir.role);
    }
    createdNodeIds.push(node.id);return node;
  };
  const mintSet=async(setIr)=>{
    const components=[];
    for(const [componentIndex,ir] of setIr.children.entries()){
      const component=figma.createComponent();component.clipsContent=false;
      component.name=Object.entries(ir.variantProperties).map(([key,value])=>key+"="+value).join(", ");
      component.description="recipe-role:"+(ir.role||"");
      tag(component,ir,"textarea/children/"+componentIndex);applyLayout(component,ir);applyPaints(component,ir);
      section.appendChild(component);
      for(const [childIndex,child] of ir.children.entries())await render(child,component,"textarea/children/"+componentIndex+"/children/"+childIndex);
      applySizing(component,ir);
      if(component.layoutMode!=="HORIZONTAL"&&component.layoutMode!=="VERTICAL")throw new Error("TEXTAREA-FAKE-LAYOUT:"+component.name);
      components.push(component);createdNodeIds.push(component.id);
    }
    const set=figma.combineAsVariants(components,section);
    void "TEXTAREA-WRITER-SET-NAME-CARRIES-COMPILE-LABEL";
    set.name=setIr.role+" :: "+(setIr.label||source.sourceName);
    set.description="Experimental textarea@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    applySetLayout(set,setIr);
    setSharedData(set,"runIdentity",PLAN.runIdentity);setSharedData(set,"adapterIdentity",source.adapterIdentity);setSharedData(set,"recipeHash",source.recipeHash);setSharedData(set,"ownershipKey","textarea");
    return set;
  };
  const textareaSet=await mintSet(source.textareaSet);
  textareaSet.x=80;textareaSet.y=96;
  section.resizeWithoutConstraints(textareaSet.width+160,textareaSet.y+textareaSet.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,setId:textareaSet.id,collectionId:collection.id,variableCount:variables.size,variantCount:textareaSet.children.length,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
`;

export function emitTextareaFigmaWriter(
  inputs: readonly TextareaFigmaWriterInput[],
  options?: { runIdentity?: string },
): TextareaFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateTextareaFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    options?.runIdentity ??
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
      `-${TEXTAREA_FIGMA_RUN_SUFFIX}`;
  const namespace: string = TEXTAREA_FIGMA_NAMESPACE;
  const identity: string = runIdentity;
  if (
    namespace === FORBIDDEN_INPUT_NAMESPACE ||
    namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    namespace === FORBIDDEN_TABLE_NAMESPACE ||
    namespace === FORBIDDEN_CHECKBOX_NAMESPACE ||
    namespace === FORBIDDEN_RADIO_NAMESPACE ||
    namespace === FORBIDDEN_SWITCH_NAMESPACE ||
    identity === FORBIDDEN_INPUT_RUN_IDENTITY
  )
    throw new TypeError(
      "textarea writer must not reuse Input, Combobox, Table, Checkbox, Radio, or Switch identity",
    );

  const pageName = `Recipe Pivot / Textarea / ${runIdentity}`;
  const plan = {
    pageName,
    runIdentity,
    sources: sourcePlans.map((source) => ({
      adapterIdentity: source.adapterIdentity,
      displayName: source.displayName,
      sourceName: source.sourceName,
      recipeHash: source.recipeHash,
      envelopeHash: source.envelopeHash,
      variables: source.variables,
      comparedIrFacts: source.comparedIrFacts,
      textareaSet: source.textareaSet,
    })),
  };

  const runtime = writerRuntime(
    TEXTAREA_FIGMA_NAMESPACE,
    TEXTAREA_FIGMA_WRITER_VERSION,
  );

  if (
    runtime.includes("TEXTAREA-WRITER-SET-NAME-CARRIES-COMPILE-LABEL") === false
  )
    throw new TypeError(
      "textarea writer must carry the compile label into the set name (Table live v25 class)",
    );
  if (
    runtime.includes(
      'set.name=setIr.role+" :: "+(setIr.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "textarea writer set name must prefer the compile label",
    );
  if (
    runtime.includes(
      "TEXTAREA-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "textarea writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("TEXTAREA-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "textarea writer must refuse font provenance tampering",
    );
  if (
    runtime.includes("TEXTAREA-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("TEXTAREA-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("TEXTAREA-MUST-NOT-WRITE-COMBOBOX-V42-PAGE") === false ||
    runtime.includes("TEXTAREA-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("TEXTAREA-MUST-NOT-WRITE-TABLE-PAGE") === false ||
    runtime.includes("TEXTAREA-MUST-NOT-WRITE-CALENDAR-PAGE") === false ||
    runtime.includes("TEXTAREA-MUST-NOT-WRITE-CHECKBOX-PAGE") === false ||
    runtime.includes("TEXTAREA-MUST-NOT-WRITE-RADIO-PAGE") === false ||
    runtime.includes("TEXTAREA-MUST-NOT-WRITE-SWITCH-PAGE") === false
  )
    throw new TypeError(
      "textarea writer must refuse signed Input, Combobox, Button, Table, Calendar, Checkbox, Radio, and Switch pages",
    );

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    namespace: TEXTAREA_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
