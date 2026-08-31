import { readFileSync, writeFileSync } from "node:fs";

const plan = JSON.parse(readFileSync(new URL("./plan.json", import.meta.url), "utf8"));
const RUN = plan.runIdentity;
const PAGE = plan.pageName;
const NS = plan.namespace;
const SIGNED = [
  "115:295378",
  "163:35981",
  "183:70641",
  "183:69150",
  "85:6781",
  "173:48924",
  "181:64873",
  "183:74742",
  "183:75031",
  "196:76370",
];
const byAdapter = Object.fromEntries(
  plan.sources.map((source) => [source.adapterIdentity, source]),
);

const astryxFont = {
  requestedFamily: "-apple-system",
  requestedStyle: "Medium",
  resolvedFamily: "SF Pro",
  resolvedStyle: "Medium",
  resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Medium" },
    { family: "SF Pro", style: "Medium" },
    { family: "Segoe UI", style: "Semibold" },
    { family: "Roboto", style: "Medium" },
    { family: "Helvetica", style: "Bold" },
    { family: "Arial", style: "Bold" },
  ],
  degradation:
    "source -apple-system stack; Figma cannot load a CSS stack; first named host font is SF Pro Medium",
};
const muiFont = {
  requestedFamily: "Roboto",
  requestedStyle: "Regular",
  resolvedFamily: "Roboto",
  resolvedStyle: "Regular",
  resolution: "requested",
  fallbackChain: [
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
};
const antdFont = {
  requestedFamily: "-apple-system",
  requestedStyle: "Regular",
  resolvedFamily: "SF Pro",
  resolvedStyle: "Regular",
  resolution: "fallback",
  fallbackChain: [
    { family: "-apple-system", style: "Regular" },
    { family: "SF Pro", style: "Regular" },
    { family: "Segoe UI", style: "Regular" },
    { family: "Roboto", style: "Regular" },
    { family: "Helvetica Neue", style: "Regular" },
    { family: "Arial", style: "Regular" },
  ],
  degradation:
    "antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular",
};

const libraries = {
  astryx: {
    adapterIdentity: "astryx-radio-reviewed-v1",
    displayName: "Astryx",
    setLabel: "Astryx RadioList",
    recipeHash: byAdapter["astryx-radio-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["astryx-radio-reviewed-v1"].envelopeHash,
    prefix: "astryx.radio",
    fontSpec: astryxFont,
    listMode: "VERTICAL",
    itemAlign: "CENTER",
    lineHeightUnit: "AUTO",
    lineHeight: 0,
    fontSize: 14,
    wrapper: 24,
    circle: 22,
    radius: 11,
    border: 1,
    padding: 1,
    listGap: 8,
    itemGap: 8,
    dot: 10,
    dotRadius: 5,
    cells: {
      "selected/false": { fill: "#0064e0ff", border: "#0064e0ff", label: "#4e606fff", dot: "#ffffffff", opacity: 1 },
      "selected/true": { fill: "#0064e0ff", border: "#05365919", label: "#a4b0bcff", dot: "#ffffffff", opacity: 0.5 },
      "unselected/false": { fill: "#ffffffff", border: "#ccd3dbff", label: "#4e606fff", dot: "#00000000", opacity: 1 },
      "unselected/true": { fill: "#0536590c", border: "#05365919", label: "#a4b0bcff", dot: "#00000000", opacity: 0.5 },
    },
  },
  mui: {
    adapterIdentity: "mui-radio-reviewed-v1",
    displayName: "MUI",
    setLabel: "MUI RadioGroup",
    recipeHash: byAdapter["mui-radio-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["mui-radio-reviewed-v1"].envelopeHash,
    prefix: "mui.radio",
    fontSpec: muiFont,
    listMode: "VERTICAL",
    itemAlign: "CENTER",
    lineHeightUnit: "AUTO",
    lineHeight: 0,
    fontSize: 16,
    wrapper: 42,
    circle: 24,
    radius: 12,
    border: 2,
    padding: 9,
    listGap: 0,
    itemGap: 0,
    dot: 10,
    dotRadius: 5,
    cells: {
      "selected/false": { fill: "#00000000", border: "#1976d2ff", label: "#000000de", dot: "#1976d2ff", opacity: 1 },
      "selected/true": { fill: "#00000000", border: "#00000042", label: "#00000061", dot: "#00000042", opacity: 1 },
      "unselected/false": { fill: "#00000000", border: "#00000099", label: "#000000de", dot: "#00000000", opacity: 1 },
      "unselected/true": { fill: "#00000000", border: "#00000042", label: "#00000061", dot: "#00000000", opacity: 1 },
    },
  },
  antd: {
    adapterIdentity: "antd-radio-reviewed-v1",
    displayName: "Ant Design",
    setLabel: "Ant Design Radio.Group",
    recipeHash: byAdapter["antd-radio-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["antd-radio-reviewed-v1"].envelopeHash,
    prefix: "antd.radio",
    fontSpec: antdFont,
    listMode: "HORIZONTAL",
    itemAlign: "CENTER",
    lineHeightUnit: "PIXELS",
    lineHeight: 22,
    fontSize: 14,
    wrapper: 16,
    circle: 16,
    radius: 8,
    border: 1,
    padding: 0,
    listGap: 8,
    itemGap: 8,
    dot: 6,
    dotRadius: 3,
    cells: {
      "selected/false": { fill: "#1677ffff", border: "#1677ffff", label: "#000000e0", dot: "#ffffffff", opacity: 1 },
      "selected/true": { fill: "#0000000a", border: "#d9d9d9ff", label: "#00000040", dot: "#00000040", opacity: 1 },
      "unselected/false": { fill: "#ffffffff", border: "#d9d9d9ff", label: "#000000e0", dot: "#00000000", opacity: 1 },
      "unselected/true": { fill: "#0000000a", border: "#d9d9d9ff", label: "#00000040", dot: "#00000000", opacity: 1 },
    },
  },
};

const emit = (lib) => {
  const planned = [];
  for (const [key, cell] of Object.entries(lib.cells)) {
    const [sel, dis] = key.split("/");
    const arm = dis === "true" ? "disabled" : "enabled";
    planned.push(["COLOR", `${lib.prefix}.states-${sel}-${arm}-circleFill`, cell.fill]);
    planned.push(["COLOR", `${lib.prefix}.states-${sel}-${arm}-circleBorder`, cell.border]);
    planned.push(["COLOR", `${lib.prefix}.states-${sel}-${arm}-label`, cell.label]);
    planned.push(["COLOR", `${lib.prefix}.states-${sel}-${arm}-dotFill`, cell.dot]);
  }
  planned.push(["FLOAT", `${lib.prefix}.wrapper-size`, lib.wrapper]);
  planned.push(["FLOAT", `${lib.prefix}.circle-size`, lib.circle]);
  planned.push(["FLOAT", `${lib.prefix}.circle-radius`, lib.radius]);
  planned.push(["FLOAT", `${lib.prefix}.circle-borderWidth`, lib.border]);
  planned.push(["FLOAT", `${lib.prefix}.circle-padding`, lib.padding]);
  planned.push(["FLOAT", `${lib.prefix}.list-gap`, lib.listGap]);
  planned.push(["FLOAT", `${lib.prefix}.item-gap`, lib.itemGap]);
  planned.push(["FLOAT", `${lib.prefix}.dot-size`, lib.dot]);
  planned.push(["FLOAT", `${lib.prefix}.dot-radius`, lib.dotRadius]);
  planned.push(["FLOAT", `${lib.prefix}.labelFontSize`, lib.fontSize]);
  if (lib.lineHeightUnit === "PIXELS")
    planned.push(["FLOAT", `${lib.prefix}.labelLineHeight`, lib.lineHeight]);

  return `if(figma.fileKey!=="byMp6lt0Ij9b2QbkDGFwBh")throw new Error("WRONG-FILE:"+figma.fileKey);
if(figma.root.name!=="Scratch Project")throw new Error("WRONG-FILE-NAME:"+figma.root.name);
const NS=${JSON.stringify(NS)};
const runIdentity=${JSON.stringify(RUN)};
const pageName=${JSON.stringify(PAGE)};
const adapterIdentity=${JSON.stringify(lib.adapterIdentity)};
const recipeHash=${JSON.stringify(lib.recipeHash)};
const envelopeHash=${JSON.stringify(lib.envelopeHash)};
const signed=${JSON.stringify(SIGNED)};
await figma.loadAllPagesAsync();
const page=figma.root.children.find(p=>p.name===pageName);
if(!page)throw new Error("RADIO-PAGE-MISSING");
if(signed.includes(page.id))throw new Error("RADIO-MUST-NOT-WRITE-SIGNED-PAGE:"+page.id);
if(page.getSharedPluginData(NS,"runIdentity")!==runIdentity)throw new Error("RADIO-PAGE-IDENTITY-MISMATCH:"+page.id);
await figma.setCurrentPageAsync(page);
if(signed.includes(figma.currentPage.id))throw new Error("RADIO-MUST-NOT-WRITE-SIGNED-PAGE:"+figma.currentPage.id);
if(page.children.some(n=>n.type==="SECTION"&&n.getSharedPluginData(NS,"adapterIdentity")===adapterIdentity))throw new Error("RADIO-SECTION-EXISTS:"+adapterIdentity);
const hex=v=>({r:parseInt(v.slice(1,3),16)/255,g:parseInt(v.slice(3,5),16)/255,b:parseInt(v.slice(5,7),16)/255,a:parseInt(v.slice(7,9),16)/255});
const paint=v=>{const c=hex(v);return{type:"SOLID",color:{r:c.r,g:c.g,b:c.b},opacity:c.a};};
const allFonts=await figma.listAvailableFontsAsync();
const fontSpec=${JSON.stringify(lib.fontSpec)};
const found=fontSpec.fallbackChain.map(c=>allFonts.find(f=>f.fontName.family===c.family&&f.fontName.style===c.style)).find(Boolean);
if(!found)throw new Error("RADIO-FONT-UNAVAILABLE:"+fontSpec.requestedFamily);
if(found.fontName.family!==fontSpec.resolvedFamily||found.fontName.style!==fontSpec.resolvedStyle)throw new Error("RADIO-FONT-PROVENANCE-TAMPER:"+found.fontName.family);
await figma.loadFontAsync(found.fontName);
const collectionName="Recipe Radio / "+runIdentity+" / "+adapterIdentity;
const locals=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
if(locals.some(c=>c.name===collectionName))throw new Error("RADIO-VARIABLE-COLLECTION-COLLISION:"+collectionName);
const collection=figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId,"Default");
collection.hiddenFromPublishing=true;
const modeId=collection.modes[0].modeId;
const prefix=${JSON.stringify(lib.prefix)};
const planned=${JSON.stringify(planned)};
const vars=new Map();
for(const [type,identity,value] of planned){
  const name="token/"+(type==="COLOR"?"color":"float")+"/id-"+Array.from(identity).map(ch=>ch.charCodeAt(0).toString(16).padStart(2,"0")).join("");
  const variable=figma.variables.createVariable(name,collection,type);
  variable.scopes=["ALL_SCOPES"];
  variable.setValueForMode(modeId,type==="COLOR"?hex(value):value);
  vars.set(type+":"+identity,variable);
}
const bindColor=(base,identity)=>figma.variables.setBoundVariableForPaint(base,"color",vars.get("COLOR:"+identity));
const bindFloat=(node,field,identity)=>node.setBoundVariable(field,vars.get("FLOAT:"+identity));
const geom=${JSON.stringify({
    listMode: lib.listMode,
    itemAlign: lib.itemAlign,
    lineHeightUnit: lib.lineHeightUnit,
    lineHeight: lib.lineHeight,
    fontSize: lib.fontSize,
    wrapper: lib.wrapper,
    circle: lib.circle,
    radius: lib.radius,
    border: lib.border,
    padding: lib.padding,
    listGap: lib.listGap,
    itemGap: lib.itemGap,
    dot: lib.dot,
    dotRadius: lib.dotRadius,
    cells: lib.cells,
  })};
const items=[{id:"a",label:"Email"},{id:"b",label:"Phone"}];
let paintedFont=found.fontName;
const paintLabel=async(characters)=>{
  const label=figma.createText();
  label.fontName=paintedFont;
  label.characters=characters;
  label.fontSize=geom.fontSize;
  label.lineHeight=geom.lineHeightUnit==="PIXELS"?{unit:"PIXELS",value:geom.lineHeight}:{unit:"AUTO"};
  label.textAlignHorizontal="LEFT";
  label.textAlignVertical="CENTER";
  label.textAutoResize="WIDTH_AND_HEIGHT";
  if(label.characters.trim().length>0&&(label.width<=0||label.absoluteRenderBounds===null)){
    let ok=false;
    for(const candidate of fontSpec.fallbackChain){
      if(candidate.family===fontSpec.resolvedFamily&&candidate.style===fontSpec.resolvedStyle)continue;
      const next=allFonts.find(e=>e.fontName.family===candidate.family&&e.fontName.style===candidate.style);
      if(!next)continue;
      await figma.loadFontAsync(next.fontName);
      label.fontName=next.fontName;
      label.characters=characters;
      if(label.width>0&&label.absoluteRenderBounds){paintedFont=next.fontName;ok=true;break;}
    }
    if(!ok&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("RADIO-FONT-ZERO-INTRINSIC");
  }
  if(label.width<=0||label.height<=0)throw new Error("RADIO-TEXT-GEOMETRY");
  return label;
};
let nextX=0;
for(const child of page.children){if(child.type==="SECTION")nextX=Math.max(nextX,child.x+child.width+240);}
const section=figma.createSection();
section.name="Recipe Pivot / "+${JSON.stringify(lib.displayName)}+" / "+recipeHash.slice(0,8);
section.x=nextX;section.y=0;page.appendChild(section);
section.setSharedPluginData(NS,"adapterIdentity",adapterIdentity);
section.setSharedPluginData(NS,"recipeHash",recipeHash);
section.setSharedPluginData(NS,"variableCollectionId",collection.id);
const components=[];
for(const selected of ["a","b"]){
  for(const disabled of ["false","true"]){
    const component=figma.createComponent();
    component.clipsContent=false;
    component.name="Selected="+selected+", Disabled="+disabled;
    component.layoutMode=geom.listMode;
    component.primaryAxisAlignItems="MIN";
    component.counterAxisAlignItems="MIN";
    component.itemSpacing=geom.listGap;
    component.fills=[];
    bindFloat(component,"itemSpacing",prefix+".list-gap");
    section.appendChild(component);
    for(const item of items){
      const selectedHere=item.id===selected;
      const arm=disabled==="true"?"disabled":"enabled";
      const sel=selectedHere?"selected":"unselected";
      const cell=geom.cells[sel+"/"+disabled];
      const row=figma.createFrame();
      row.name="radio/item/"+item.id;
      row.layoutMode="HORIZONTAL";
      row.primaryAxisAlignItems="MIN";
      row.counterAxisAlignItems=geom.itemAlign;
      row.itemSpacing=geom.itemGap;
      row.fills=[];
      bindFloat(row,"itemSpacing",prefix+".item-gap");
      component.appendChild(row);
      const hit=figma.createFrame();
      hit.name="radio/hit";
      hit.layoutMode="HORIZONTAL";
      hit.primaryAxisAlignItems="CENTER";
      hit.counterAxisAlignItems="CENTER";
      hit.itemSpacing=0;
      hit.fills=[];
      hit.paddingTop=geom.padding;hit.paddingRight=geom.padding;hit.paddingBottom=geom.padding;hit.paddingLeft=geom.padding;
      hit.resizeWithoutConstraints(geom.wrapper,geom.wrapper);
      hit.layoutSizingHorizontal="FIXED";hit.layoutSizingVertical="FIXED";
      bindFloat(hit,"width",prefix+".wrapper-size");
      bindFloat(hit,"height",prefix+".wrapper-size");
      bindFloat(hit,"paddingTop",prefix+".circle-padding");
      bindFloat(hit,"paddingRight",prefix+".circle-padding");
      bindFloat(hit,"paddingBottom",prefix+".circle-padding");
      bindFloat(hit,"paddingLeft",prefix+".circle-padding");
      row.appendChild(hit);
      const circle=figma.createFrame();
      circle.name="radio/circle";
      circle.layoutMode="HORIZONTAL";
      circle.primaryAxisAlignItems="CENTER";
      circle.counterAxisAlignItems="CENTER";
      circle.itemSpacing=0;
      circle.opacity=cell.opacity;
      circle.resizeWithoutConstraints(geom.circle,geom.circle);
      circle.layoutSizingHorizontal="FIXED";circle.layoutSizingVertical="FIXED";
      circle.fills=[bindColor(paint(cell.fill),prefix+".states-"+sel+"-"+arm+"-circleFill")];
      circle.strokes=[bindColor(paint(cell.border),prefix+".states-"+sel+"-"+arm+"-circleBorder")];
      circle.strokeWeight=geom.border;circle.strokeAlign="INSIDE";
      circle.topLeftRadius=geom.radius;circle.topRightRadius=geom.radius;circle.bottomRightRadius=geom.radius;circle.bottomLeftRadius=geom.radius;
      bindFloat(circle,"width",prefix+".circle-size");
      bindFloat(circle,"height",prefix+".circle-size");
      bindFloat(circle,"strokeWeight",prefix+".circle-borderWidth");
      bindFloat(circle,"topLeftRadius",prefix+".circle-radius");
      bindFloat(circle,"topRightRadius",prefix+".circle-radius");
      bindFloat(circle,"bottomRightRadius",prefix+".circle-radius");
      bindFloat(circle,"bottomLeftRadius",prefix+".circle-radius");
      hit.appendChild(circle);
      const dot=figma.createFrame();
      dot.name="radio/glyph/dot";
      dot.visible=selectedHere;
      dot.layoutMode="HORIZONTAL";
      dot.resizeWithoutConstraints(geom.dot,geom.dot);
      dot.layoutSizingHorizontal="FIXED";dot.layoutSizingVertical="FIXED";
      dot.fills=[bindColor(paint(cell.dot),prefix+".states-"+sel+"-"+arm+"-dotFill")];
      dot.topLeftRadius=geom.dotRadius;dot.topRightRadius=geom.dotRadius;dot.bottomRightRadius=geom.dotRadius;dot.bottomLeftRadius=geom.dotRadius;
      bindFloat(dot,"width",prefix+".dot-size");
      bindFloat(dot,"height",prefix+".dot-size");
      bindFloat(dot,"topLeftRadius",prefix+".dot-radius");
      bindFloat(dot,"topRightRadius",prefix+".dot-radius");
      bindFloat(dot,"bottomRightRadius",prefix+".dot-radius");
      bindFloat(dot,"bottomLeftRadius",prefix+".dot-radius");
      circle.appendChild(dot);
      const label=await paintLabel(item.label);
      label.name="radio/label :: font-provenance="+encodeURIComponent(JSON.stringify(fontSpec));
      label.fills=[bindColor(paint(cell.label),prefix+".states-"+sel+"-"+arm+"-label")];
      bindFloat(label,"fontSize",prefix+".labelFontSize");
      if(geom.lineHeightUnit==="PIXELS")bindFloat(label,"lineHeight",prefix+".labelLineHeight");
      row.appendChild(label);
      row.layoutSizingHorizontal="HUG";
      row.layoutSizingVertical="HUG";
    }
    component.layoutSizingHorizontal="HUG";
    component.layoutSizingVertical="HUG";
    if(component.layoutMode!==geom.listMode)throw new Error("RADIO-FAKE-LAYOUT:"+component.name);
    components.push(component);
  }
}
const set=figma.combineAsVariants(components,section);
void "RADIO-WRITER-SET-NAME-CARRIES-COMPILE-LABEL";
set.name="radio/set :: "+${JSON.stringify(lib.setLabel)};
set.description="Experimental radio@1 primitive-IR mint. Recipe "+recipeHash+"; source adapter "+adapterIdentity+".";
set.layoutMode="VERTICAL";
set.primaryAxisAlignItems="MIN";
set.counterAxisAlignItems="MIN";
set.itemSpacing=16;
set.paddingTop=16;set.paddingRight=16;set.paddingBottom=16;set.paddingLeft=16;
set.fills=[];
set.layoutSizingHorizontal="HUG";
set.layoutSizingVertical="HUG";
set.setSharedPluginData(NS,"runIdentity",runIdentity);
set.setSharedPluginData(NS,"adapterIdentity",adapterIdentity);
set.setSharedPluginData(NS,"recipeHash",recipeHash);
set.setSharedPluginData(NS,"envelopeHash",envelopeHash);
set.x=80;set.y=96;
section.resizeWithoutConstraints(set.width+160,set.y+set.height+80);
return{pageId:page.id,pageName:page.name,sectionId:section.id,setId:set.id,collectionId:collection.id,variantCount:set.children.length,adapterIdentity,recipeHash,paintedFont};
`;
};

for (const [key, lib] of Object.entries(libraries)) {
  writeFileSync(new URL(`./compact-${key}.js`, import.meta.url), emit(lib));
}
console.log("wrote radio compact hosts");
