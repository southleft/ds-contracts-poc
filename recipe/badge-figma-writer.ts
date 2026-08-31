/**
 * badge@1 Figma writer.
 *
 * Inherits the hardened calendar/table writer shape: exact file identity,
 * signed-page refuse, owned variable collections, font provenance + named
 * fallback walk (no Inter), set name carries the compile label, hug text
 * records intrinsic size before a 0-width parent can collapse it, layout
 * then children then sizing.
 *
 * Badge is an anchored overlay. MUI+AntD only. Astryx overlay is a named
 * refusal. Color, dot, status, and Ribbon are not axes. Do not invent
 * an Astryx pip.
 *
 * No live write happens here. Executing the program requires a separate
 * PREPARE / AUTHORIZE / attempt lineage.
 */
import type { ComponentNode, IRNode, VariableBinding } from "./figma-ir.js";
import type { RecipeEnvelope } from "./envelope.js";
import { canonicalJson } from "./normalize.js";
import { BADGE_DEFAULT } from "./recipes/badge.js";
import {
  buildFigmaVariableNameMap,
  sanitizeFigmaVariableName,
} from "./interpret.js";

export const BADGE_FIGMA_NAMESPACE = "ds.contracts.badge.recipe.v1";
export const BADGE_FIGMA_WRITER_VERSION = 1;
export const BADGE_FIGMA_RUN_SUFFIX = "badge-v1";

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
export const FORBIDDEN_TEXTAREA_NAMESPACE = "ds.contracts.textarea.recipe.v1";
export const FORBIDDEN_TEXTAREA_PAGE_ID = "183:75495";
export const FORBIDDEN_ALERT_NAMESPACE = "ds.contracts.alert.recipe.v1";
export const FORBIDDEN_ALERT_PAGE_ID = "183:75801";
export const FORBIDDEN_CHIP_NAMESPACE = "ds.contracts.chip.recipe.v1";
export const FORBIDDEN_CHIP_PAGE_ID = "183:75976";

export const BADGE_FIGMA_VARIANTS_PER_SOURCE = BADGE_DEFAULT.length;

export interface ChipVariablePlan {
  identity: string;
  name: string;
  type: "COLOR" | "FLOAT";
  value: string | number;
}

export interface BadgeFigmaWriterInput {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelope: RecipeEnvelope;
}

export interface BadgeFigmaSourcePlan {
  adapterIdentity: string;
  displayName: string;
  recipeHash: string;
  envelopeHash: string;
  sourceId: string;
  sourceName: string;
  badgeAxes: Record<string, string[]>;
  badge: ComponentNode;
  variables: ChipVariablePlan[];
  comparedIrFacts: number;
}

export interface BadgeFigmaWriter {
  pageName: string;
  runIdentity: string;
  namespace: string;
  sourcePlans: BadgeFigmaSourcePlan[];
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
        `badge live writer: ${binding.field} is not a colour fallback`,
      );
    return "COLOR";
  }
  if (binding.type === "FLOAT") {
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(
        `badge live writer: ${binding.field} is not a numeric fallback`,
      );
    return "FLOAT";
  }
  throw new TypeError(
    `badge live writer: unsupported binding type ${binding.type}`,
  );
};

const requireDefault = (root: IRNode): ComponentNode => {
  if (root.kind === "component" && root.role === "badge/variant/default")
    return root;
  throw new TypeError(
    "badge live writer: required one named default component, not a Color/Size/Closable set",
  );
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
  input: BadgeFigmaWriterInput,
): BadgeFigmaSourcePlan => {
  if (
    input.envelope.recipe.id !== "badge" ||
    input.envelope.recipe.version !== 1
  )
    throw new TypeError("badge live writer requires badge@1");
  if (input.envelope.archetype !== "badge / tag / chip")
    throw new TypeError("badge live writer requires the badge / tag / chip archetype");

  const chip = requireDefault(input.envelope.ir);
  const badgeAxes = {
    Default: [...BADGE_DEFAULT],
  };
  if (chip.variantProperties.Default !== "true")
    throw new TypeError("badge live writer: default cell must be Default=true");

  const registry = new Map<string, ChipVariablePlan>();
  walk(chip, (node) => {
    if (node.kind === "instance")
      throw new TypeError(
        `badge live writer: unexpected instance ${node.componentRef}`,
      );
    for (const binding of node.bindings ?? []) {
      const value = atPath(node, binding.field);
      const type = variableType(binding, value);
      const key = `${type}:${binding.variable}`;
      const previous = registry.get(key);
      if (previous && canonicalJson(previous.value) !== canonicalJson(value))
        throw new TypeError(
          `badge live writer: conflicting fallback for ${binding.variable}`,
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
    throw new TypeError("badge live writer: zero planned variables");

  return {
    adapterIdentity: input.adapterIdentity,
    displayName: input.displayName,
    recipeHash: input.recipeHash,
    envelopeHash: input.envelope.integrity.canonicalHash,
    sourceId: input.envelope.id,
    sourceName: input.envelope.name,
    badgeAxes,
    badge: chip,
    variables: [...registry.values()].sort((left, right) =>
      `${left.type}:${left.identity}`.localeCompare(
        `${right.type}:${right.identity}`,
        "en",
      ),
    ),
    comparedIrFacts: countComparedFacts(input.envelope.ir),
  };
};

export function validateBadgeFigmaSourcePlans(
  plans: readonly BadgeFigmaSourcePlan[],
): string[] {
  const failures: string[] = [];
  if (plans.length === 0) failures.push("badge live writer: no sources");
  const identities = new Set(plans.map((plan) => plan.adapterIdentity));
  if (identities.size !== plans.length)
    failures.push("badge live writer: duplicate adapter identity");
  for (const plan of plans) {
    if (plan.variables.length === 0)
      failures.push(`${plan.adapterIdentity}: variables denominator is zero`);
    if (plan.comparedIrFacts <= 0)
      failures.push(
        `${plan.adapterIdentity}: compared facts denominator is zero`,
      );
    if (plan.badge.kind !== "component" || plan.badge.role !== "badge/variant/default")
      failures.push(
        `${plan.adapterIdentity}: expected one named default chip component`,
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
const PAGE_OWNER="recipe/badge/"+PLAN.runIdentity;
if(NS==="ds.contracts.input.recipe.v5"||PLAN.runIdentity==="4a074b24-e8503dd5-input-v5")throw new Error("BADGE-INPUT-IDENTITY-REUSE");
if(NS==="ds.contracts.combobox.recipe.v1"||PLAN.runIdentity==="70c24cbd-d27f2e85-combobox-v1")throw new Error("BADGE-COMBOBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.table.recipe.v1")throw new Error("BADGE-TABLE-IDENTITY-REUSE");
if(NS==="ds.contracts.calendar.recipe.v1")throw new Error("BADGE-CALENDAR-IDENTITY-REUSE");
if(NS==="ds.contracts.checkbox.recipe.v1")throw new Error("BADGE-CHECKBOX-IDENTITY-REUSE");
if(NS==="ds.contracts.radio.recipe.v1")throw new Error("BADGE-RADIO-IDENTITY-REUSE");
if(NS==="ds.contracts.switch.recipe.v1")throw new Error("BADGE-SWITCH-IDENTITY-REUSE");
if(NS==="ds.contracts.textarea.recipe.v1")throw new Error("BADGE-TEXTAREA-IDENTITY-REUSE");
if(NS==="ds.contracts.alert.recipe.v1")throw new Error("BADGE-ALERT-IDENTITY-REUSE");
if(NS==="ds.contracts.chip.recipe.v1")throw new Error("BADGE-CHIP-IDENTITY-REUSE");
if(figma.fileKey!==EXPECTED_FILE_KEY)throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!==EXPECTED_FILE_NAME)throw new Error("WRONG-FILE-NAME:"+figma.root.name);
if(figma.editorType!=="figma")throw new Error("WRONG-EDITOR:"+figma.editorType);
void "BADGE-MUST-NOT-WRITE-INPUT-PAGE";
void "BADGE-MUST-NOT-WRITE-COMBOBOX-PAGE";
void "BADGE-MUST-NOT-WRITE-COMBOBOX-V42-PAGE";
void "BADGE-MUST-NOT-WRITE-BUTTON-PAGE";
void "BADGE-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE";
void "BADGE-MUST-NOT-WRITE-TABLE-PAGE";
void "BADGE-MUST-NOT-WRITE-CALENDAR-PAGE";
void "BADGE-MUST-NOT-WRITE-CHECKBOX-PAGE";
void "BADGE-MUST-NOT-WRITE-RADIO-PAGE";
void "BADGE-MUST-NOT-WRITE-SWITCH-PAGE";
void "BADGE-MUST-NOT-WRITE-TEXTAREA-PAGE";
void "BADGE-MUST-NOT-WRITE-ALERT-PAGE";
void "BADGE-MUST-NOT-WRITE-CHIP-PAGE";
if(figma.currentPage&&figma.currentPage.id==="115:295378")throw new Error("BADGE-MUST-NOT-WRITE-INPUT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="163:35981")throw new Error("BADGE-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:70641")throw new Error("BADGE-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:69150")throw new Error("BADGE-MUST-NOT-WRITE-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="85:6781")throw new Error("BADGE-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(figma.currentPage&&figma.currentPage.id==="173:48924")throw new Error("BADGE-MUST-NOT-WRITE-TABLE-PAGE");
if(figma.currentPage&&figma.currentPage.id==="181:64873")throw new Error("BADGE-MUST-NOT-WRITE-CALENDAR-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:74742")throw new Error("BADGE-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75031")throw new Error("BADGE-MUST-NOT-WRITE-RADIO-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75302")throw new Error("BADGE-MUST-NOT-WRITE-SWITCH-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75495")throw new Error("BADGE-MUST-NOT-WRITE-TEXTAREA-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75801")throw new Error("BADGE-MUST-NOT-WRITE-ALERT-PAGE");
if(figma.currentPage&&figma.currentPage.id==="183:75976")throw new Error("BADGE-MUST-NOT-WRITE-CHIP-PAGE");
await figma.loadAllPagesAsync();
const setSharedData=(target,key,value)=>target.setSharedPluginData(NS,key,String(value));
const getSharedData=(target,key)=>target.getSharedPluginData(NS,key);
let page=figma.root.children.find(candidate=>candidate.name===PLAN.pageName);
const createdNodeIds=[],mutatedNodeIds=[];
if(page){
  if(getSharedData(page,"pageOwner")!==PAGE_OWNER)throw new Error("BADGE-PAGE-OWNERSHIP-COLLISION:"+page.id);
  if(getSharedData(page,"runIdentity")!==PLAN.runIdentity)throw new Error("BADGE-PAGE-IDENTITY-MISMATCH:"+page.id);
}else{
  page=figma.createPage();page.name=PLAN.pageName;createdNodeIds.push(page.id);
}
if(page.id==="115:295378")throw new Error("BADGE-MUST-NOT-WRITE-INPUT-PAGE");
if(page.id==="163:35981")throw new Error("BADGE-MUST-NOT-WRITE-COMBOBOX-PAGE");
if(page.id==="183:70641")throw new Error("BADGE-MUST-NOT-WRITE-COMBOBOX-V42-PAGE");
if(page.id==="183:69150")throw new Error("BADGE-MUST-NOT-WRITE-BUTTON-PAGE");
if(page.id==="85:6781")throw new Error("BADGE-MUST-NOT-WRITE-PRESERVED-BUTTON-PAGE");
if(page.id==="173:48924")throw new Error("BADGE-MUST-NOT-WRITE-TABLE-PAGE");
if(page.id==="181:64873")throw new Error("BADGE-MUST-NOT-WRITE-CALENDAR-PAGE");
if(page.id==="183:74742")throw new Error("BADGE-MUST-NOT-WRITE-CHECKBOX-PAGE");
if(page.id==="183:75031")throw new Error("BADGE-MUST-NOT-WRITE-RADIO-PAGE");
if(page.id==="183:75302")throw new Error("BADGE-MUST-NOT-WRITE-SWITCH-PAGE");
if(page.id==="183:75495")throw new Error("BADGE-MUST-NOT-WRITE-TEXTAREA-PAGE");
if(page.id==="183:75801")throw new Error("BADGE-MUST-NOT-WRITE-ALERT-PAGE");
if(page.id==="183:75976")throw new Error("BADGE-MUST-NOT-WRITE-CHIP-PAGE");
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
  if(!found)throw new Error("BADGE-FONT-UNAVAILABLE:"+spec.requestedFamily+":"+spec.requestedStyle);
  const resolution=found.fontName.family===spec.requestedFamily&&found.fontName.style===spec.requestedStyle?"requested":"fallback";
  if(found.fontName.family!==spec.resolvedFamily||found.fontName.style!==spec.resolvedStyle||resolution!==spec.resolution)throw new Error("BADGE-FONT-PROVENANCE-TAMPER:"+found.fontName.family+":"+found.fontName.style);
  if(resolution==="fallback"&&!spec.degradation)throw new Error("BADGE-FONT-FALLBACK-WITHOUT-DEGRADATION");
  return found.fontName;
};
const summaries=[];
let nextSectionX=0;
for(const child of page.children){
  if(child.type==="SECTION")nextSectionX=Math.max(nextSectionX,child.x+child.width+240);
}
for(const source of PLAN.sources){
  const existingSection=page.children.find(node=>node.type==="SECTION"&&getSharedData(node,"adapterIdentity")===source.adapterIdentity&&getSharedData(node,"recipeHash")===source.recipeHash);
  if(existingSection)throw new Error("BADGE-SECTION-EXISTS:"+source.adapterIdentity+":"+existingSection.id);
  const section=figma.createSection();
  section.name="Recipe Pivot / "+source.displayName+" / "+source.recipeHash.slice(0,8);
  section.x=nextSectionX;section.y=0;page.appendChild(section);
  setSharedData(section,"adapterIdentity",source.adapterIdentity);
  setSharedData(section,"recipeHash",source.recipeHash);
  createdNodeIds.push(section.id);
  const collectionName="Recipe Badge / "+PLAN.runIdentity+" / "+source.adapterIdentity;
  const localCollections=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
  if(localCollections.some(candidate=>candidate.name===collectionName))throw new Error("BADGE-VARIABLE-COLLECTION-COLLISION:"+collectionName);
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
    if(layout.positioning==="absolute"){
      node.layoutPositioning="ABSOLUTE";
      const c=layout.constraints||{};
      const horiz={left:"MIN",right:"MAX",center:"CENTER",scale:"SCALE",stretch:"STRETCH"};
      const vert={top:"MIN",bottom:"MAX",center:"CENTER",scale:"SCALE",stretch:"STRETCH"};
      node.constraints={horizontal:horiz[c.horizontal||"right"],vertical:vert[c.vertical||"top"]};
    }
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
  const applyComponentLayout=(node,ir)=>{applyLayout(node,ir);applyPaints(node,ir);applySizing(node,ir);};
  const firstSegment=name=>name.split(" :: ",1)[0];
  void "BADGE-WRITER-FIRST-SEGMENT-BIND";
  const render=async(ir,parent,ownershipKey)=>{
    let node;
    if(ir.kind==="frame")node=figma.createFrame();
    else if(ir.kind==="text"){
      if(!ir.type.fontProvenance)throw new Error("BADGE-FONT-PROVENANCE-ABSENT:"+ir.role);
      const label=figma.createText();const font=resolveFont(ir.type.fontProvenance);await figma.loadFontAsync(font);
      label.fontName=font;label.characters=ir.characters;label.fontSize=ir.type.fontSize;
      label.lineHeight=ir.type.lineHeight.unit==="px"?{unit:"PIXELS",value:ir.type.lineHeight.value}:{unit:"AUTO"};
      label.textAlignHorizontal=ir.align.toUpperCase();label.textAlignVertical=ir.verticalAlign.toUpperCase();
      label.textAutoResize="WIDTH_AND_HEIGHT";label.blendMode="NORMAL";
      void "BADGE-WRITER-HUG-TEXT-POST-CHARACTER-INTRINSIC";
      void "BADGE-WRITER-NAMED-FALLBACK-AFTER-ZERO-GLYPH";
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
        if(!painted&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("BADGE-FONT-ZERO-INTRINSIC:"+ir.role);
      }
      node=label;
    }else throw new Error("UNSUPPORTED-CHILD-KIND:"+ir.kind);
    node.visible=ir.visible!==false;node.opacity=ir.opacity===undefined?1:ir.opacity;
    node.name=ir.role&&ir.label&&ir.role!==ir.label?ir.role+" :: "+ir.label:(ir.label||ir.role||ir.kind);
    if(ir.kind==="text"&&ir.type.fontProvenance)node.name+=" :: font-provenance="+encodeURIComponent(JSON.stringify(ir.type.fontProvenance));
    let hugTextIntrinsic=null;
    if(ir.kind==="text"){
      void "BADGE-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE";
      void "BADGE-WRITER-HUG-FROM-POST-CHARACTER-INTRINSIC";
      if(node.width<=0||node.height<=0)throw new Error("BADGE-TEXT-GEOMETRY:"+ir.role);
      hugTextIntrinsic={width:node.width,height:node.height};
    }
    tag(node,ir,ownershipKey);if(ir.kind!=="instance")applyPaints(node,ir);parent.appendChild(node);
    if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
    if(ir.kind==="frame"){applyLayout(node,ir);for(const [childIndex,child] of ir.children.entries())await render(child,node,ownershipKey+"/children/"+childIndex);applySizing(node,ir);}
    else applySizing(node,ir);
    if(ir.kind==="text"){
      bindFloat(node,"fontSize",bindingFor(ir,"type.fontSize"));bindFloat(node,"lineHeight",bindingFor(ir,"type.lineHeight.value"));
      if(hugTextIntrinsic&&(node.width<=0||node.height<=0))node.resizeWithoutConstraints(hugTextIntrinsic.width,hugTextIntrinsic.height);
      if(node.characters.trim().length===0||node.width<=0||node.height<=0)throw new Error("BADGE-TEXT-GEOMETRY:"+ir.role);
    }
    createdNodeIds.push(node.id);return node;
  };
  const mintComponent=async(ir)=>{
    const component=figma.createComponent();component.clipsContent=false;
    void "BADGE-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL";
    component.name=ir.role+" :: "+(ir.label||source.sourceName);
    component.description="Experimental badge@1 primitive-IR mint. Recipe "+source.recipeHash+"; source adapter "+source.adapterIdentity+".";
    if(ir.opacity!==undefined)component.opacity=ir.opacity;
    tag(component,ir,"badge");applyLayout(component,ir);applyPaints(component,ir);
    section.appendChild(component);
    for(const [childIndex,child] of ir.children.entries())await render(child,component,"badge/children/"+childIndex);
    applySizing(component,ir);
    if(component.layoutMode!=="HORIZONTAL"&&component.layoutMode!=="VERTICAL")throw new Error("BADGE-FAKE-LAYOUT:"+component.name);
    createdNodeIds.push(component.id);
    const container=figma.createFrame();
    container.name="Component Container";
    container.layoutMode="NONE";
    container.fills=[];
    container.x=80;container.y=96;
    section.appendChild(container);
    container.appendChild(component);
    createdNodeIds.push(container.id);
    setSharedData(container,"runIdentity",PLAN.runIdentity);setSharedData(container,"adapterIdentity",source.adapterIdentity);setSharedData(container,"recipeHash",source.recipeHash);setSharedData(container,"ownershipKey","badge/container");
    return {component,container};
  };
  const minted=await mintComponent(source.badge);
  section.resizeWithoutConstraints(minted.container.width+160,minted.container.y+minted.container.height+80);
  nextSectionX+=section.width+240;
  summaries.push({adapterIdentity:source.adapterIdentity,sectionId:section.id,componentId:minted.component.id,containerId:minted.container.id,collectionId:collection.id,variableCount:variables.size,variantCount:1,recipeHash:source.recipeHash,envelopeHash:source.envelopeHash,comparedIrFacts:source.comparedIrFacts});
}
return{writerVersion:Number(WRITER_VERSION),fileKey:figma.fileKey,fileName:figma.root.name,pageId:page.id,pageName:page.name,runIdentity:PLAN.runIdentity,namespace:NS,createdNodeIds:[...new Set(createdNodeIds)],mutatedNodeIds:[...new Set(mutatedNodeIds)],sources:summaries};
`;

export function emitBadgeFigmaWriter(
  inputs: readonly BadgeFigmaWriterInput[],
  options?: { runIdentity?: string },
): BadgeFigmaWriter {
  const sourcePlans = inputs.map(planSource);
  const failures = validateBadgeFigmaSourcePlans(sourcePlans);
  if (failures.length > 0) throw new TypeError(failures.join("; "));

  const runIdentity =
    options?.runIdentity ??
    sourcePlans.map((source) => source.recipeHash.slice(0, 8)).join("-") +
      `-${BADGE_FIGMA_RUN_SUFFIX}`;
  const namespace: string = BADGE_FIGMA_NAMESPACE;
  const identity: string = runIdentity;
  if (
    namespace === FORBIDDEN_INPUT_NAMESPACE ||
    namespace === FORBIDDEN_COMBOBOX_NAMESPACE ||
    namespace === FORBIDDEN_TABLE_NAMESPACE ||
    namespace === FORBIDDEN_CHECKBOX_NAMESPACE ||
    namespace === FORBIDDEN_RADIO_NAMESPACE ||
    namespace === FORBIDDEN_SWITCH_NAMESPACE ||
    namespace === FORBIDDEN_TEXTAREA_NAMESPACE ||
    namespace === FORBIDDEN_ALERT_NAMESPACE ||
    namespace === FORBIDDEN_CHIP_NAMESPACE ||
    identity === FORBIDDEN_INPUT_RUN_IDENTITY
  )
    throw new TypeError(
      "chip writer must not reuse Input, Combobox, Table, Checkbox, Radio, Switch, Textarea, or Alert identity",
    );

  const pageName = `Recipe Pivot / Badge / ${runIdentity}`;
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
      badge: source.badge,
    })),
  };

  const runtime = writerRuntime(
    BADGE_FIGMA_NAMESPACE,
    BADGE_FIGMA_WRITER_VERSION,
  );

  if (
    runtime.includes("BADGE-WRITER-COMPONENT-NAME-CARRIES-COMPILE-LABEL") ===
    false
  )
    throw new TypeError(
      "chip writer must carry the compile label into the component name",
    );
  if (
    runtime.includes(
      'component.name=ir.role+" :: "+(ir.label||source.sourceName)',
    ) === false
  )
    throw new TypeError(
      "chip writer component name must prefer the compile label",
    );
  if (
    runtime.includes(
      "BADGE-WRITER-HUG-TEXT-INTRINSIC-BEFORE-PARENT-COLLAPSE",
    ) === false
  )
    throw new TypeError(
      "chip writer must keep hug-text intrinsic size before a 0-width parent can collapse it",
    );
  if (runtime.includes("BADGE-FONT-PROVENANCE-TAMPER") === false)
    throw new TypeError(
      "chip writer must refuse font provenance tampering",
    );
  if (
    runtime.includes("BADGE-MUST-NOT-WRITE-INPUT-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-COMBOBOX-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-COMBOBOX-V42-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-BUTTON-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-TABLE-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-CALENDAR-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-CHECKBOX-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-RADIO-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-SWITCH-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-TEXTAREA-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-ALERT-PAGE") === false ||
    runtime.includes("BADGE-MUST-NOT-WRITE-CHIP-PAGE") === false
  )
    throw new TypeError(
      "chip writer must refuse signed Input, Combobox, Button, Table, Calendar, Checkbox, Radio, Switch, Textarea, Alert, and Chip pages",
    );

  const code = `const PLAN=${JSON.stringify(plan)};\n${runtime}`;
  return {
    pageName,
    runIdentity,
    namespace: BADGE_FIGMA_NAMESPACE,
    sourcePlans,
    code,
  };
}
