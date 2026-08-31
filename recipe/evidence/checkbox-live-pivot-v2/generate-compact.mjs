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

const ANTD_SIZE = 16;
const ANTD_W = (ANTD_SIZE / 14) * 5;
const ANTD_H = (ANTD_SIZE / 14) * 8;
const ANTD_BOLD = 2;

const libraries = {
  astryx: {
    adapterIdentity: "astryx-checkbox-reviewed-v1",
    displayName: "Astryx",
    setLabel: "Astryx CheckboxInput",
    recipeHash: byAdapter["astryx-checkbox-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["astryx-checkbox-reviewed-v1"].envelopeHash,
    prefix: "astryx.checkbox",
    font: astryxFont,
    fontSize: 14,
    lineHeightUnit: "AUTO",
    lineHeight: 0,
    rowAlign: "CENTER",
    wrapper: 24,
    box: 22,
    radius: 4,
    border: 1,
    padding: 0,
    gap: 8,
    dash: { w: 12, h: 2, r: 1 },
    check: {
      path: "M11.9 3.5 L5.6 10.5 L2.1 7",
      w: 14,
      h: 14,
      stroke: 2.1,
      paint: "stroke",
      cap: "ROUND",
      join: "ROUND",
      rotation: 0,
      placement: "center",
      x: 0,
      y: 0,
    },
    cells: {
      "unchecked/false": { box: "#ffffffff", border: "#ccd3dbff", op: 1, label: "#4e606fff", dash: "#00000000", check: "#ffffffff" },
      "unchecked/true": { box: "#0536590c", border: "#05365919", op: 0.5, label: "#a4b0bcff", dash: "#00000000", check: "#ffffffff" },
      "checked/false": { box: "#0064e0ff", border: "#0064e0ff", op: 1, label: "#4e606fff", dash: "#00000000", check: "#ffffffff" },
      "checked/true": { box: "#0064e0ff", border: "#05365919", op: 0.5, label: "#a4b0bcff", dash: "#00000000", check: "#ffffffff" },
      "indeterminate/false": { box: "#0064e0ff", border: "#0064e0ff", op: 1, label: "#4e606fff", dash: "#ffffffff", check: "#ffffffff" },
      "indeterminate/true": { box: "#0064e0ff", border: "#05365919", op: 0.5, label: "#a4b0bcff", dash: "#ffffffff", check: "#ffffffff" },
    },
  },
  mui: {
    adapterIdentity: "mui-checkbox-reviewed-v1",
    displayName: "MUI",
    setLabel: "MUI Checkbox",
    recipeHash: byAdapter["mui-checkbox-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["mui-checkbox-reviewed-v1"].envelopeHash,
    prefix: "mui.checkbox",
    font: muiFont,
    fontSize: 16,
    lineHeightUnit: "AUTO",
    lineHeight: 0,
    rowAlign: "CENTER",
    wrapper: 42,
    box: 24,
    radius: 2,
    border: 2,
    padding: 9,
    gap: 0,
    dash: { w: 10, h: 2, r: 0 },
    check: {
      path: "M10 17 L5 12 L6.41 10.59 L10 14.17 L17.59 6.58 L19 8 Z",
      w: 24,
      h: 24,
      stroke: 0,
      paint: "fill",
      cap: "NONE",
      join: "MITER",
      rotation: 0,
      placement: "center",
      x: 0,
      y: 0,
    },
    cells: {
      "unchecked/false": { box: "#00000000", border: "#00000099", op: 1, label: "#000000de", dash: "#00000000", check: "#ffffffff" },
      "unchecked/true": { box: "#00000000", border: "#00000042", op: 1, label: "#00000061", dash: "#00000000", check: "#ffffffff" },
      "checked/false": { box: "#1976d2ff", border: "#1976d2ff", op: 1, label: "#000000de", dash: "#00000000", check: "#ffffffff" },
      "checked/true": { box: "#00000042", border: "#00000042", op: 1, label: "#00000061", dash: "#00000000", check: "#ffffffff" },
      "indeterminate/false": { box: "#1976d2ff", border: "#1976d2ff", op: 1, label: "#000000de", dash: "#ffffffff", check: "#ffffffff" },
      "indeterminate/true": { box: "#00000042", border: "#00000042", op: 1, label: "#00000061", dash: "#ffffffff", check: "#ffffffff" },
    },
  },
  antd: {
    adapterIdentity: "antd-checkbox-reviewed-v1",
    displayName: "Ant Design",
    setLabel: "Ant Design Checkbox",
    recipeHash: byAdapter["antd-checkbox-reviewed-v1"].recipeHash,
    envelopeHash: byAdapter["antd-checkbox-reviewed-v1"].envelopeHash,
    prefix: "antd.checkbox",
    font: antdFont,
    fontSize: 14,
    lineHeightUnit: "PIXELS",
    lineHeight: 22,
    rowAlign: "BASELINE",
    wrapper: 16,
    box: 16,
    radius: 4,
    border: 1,
    padding: 0,
    gap: 8,
    dash: { w: 8, h: 8, r: 0 },
    check: {
      path: `M ${ANTD_W - ANTD_BOLD} 0 L ${ANTD_W - ANTD_BOLD} ${ANTD_H - ANTD_BOLD} L 0 ${ANTD_H - ANTD_BOLD}`,
      w: ANTD_W,
      h: ANTD_H,
      stroke: ANTD_BOLD,
      paint: "stroke",
      cap: "NONE",
      join: "MITER",
      rotation: 45,
      placement: "absolute",
      x: ANTD_SIZE * 0.25 - ANTD_W / 2,
      y: ANTD_SIZE * 0.5 - ANTD_H / 2,
    },
    cells: {
      "unchecked/false": { box: "#ffffffff", border: "#d9d9d9ff", op: 1, label: "#000000e0", dash: "#00000000", check: "#ffffffff" },
      "unchecked/true": { box: "#0000000a", border: "#d9d9d9ff", op: 1, label: "#00000040", dash: "#00000000", check: "#00000040" },
      "checked/false": { box: "#1677ffff", border: "#1677ffff", op: 1, label: "#000000e0", dash: "#00000000", check: "#ffffffff" },
      "checked/true": { box: "#0000000a", border: "#d9d9d9ff", op: 1, label: "#00000040", dash: "#00000000", check: "#00000040" },
      "indeterminate/false": { box: "#ffffffff", border: "#d9d9d9ff", op: 1, label: "#000000e0", dash: "#1677ffff", check: "#ffffffff" },
      "indeterminate/true": { box: "#0000000a", border: "#d9d9d9ff", op: 1, label: "#00000040", dash: "#00000040", check: "#00000040" },
    },
  },
};

function emit(lib) {
  const p = lib.prefix;
  const planned = [
    ["FLOAT", `${p}.wrapper-size`, lib.wrapper],
    ["FLOAT", `${p}.box-size`, lib.box],
    ["FLOAT", `${p}.box-radius`, lib.radius],
    ["FLOAT", `${p}.box-borderWidth`, lib.border],
    ["FLOAT", `${p}.box-padding`, lib.padding],
    ["FLOAT", `${p}.row-gap`, lib.gap],
    ["FLOAT", `${p}.dash-width`, lib.dash.w],
    ["FLOAT", `${p}.dash-height`, lib.dash.h],
    ["FLOAT", `${p}.dash-radius`, lib.dash.r],
    ["FLOAT", `${p}.check-width`, lib.check.w],
    ["FLOAT", `${p}.check-height`, lib.check.h],
    ["FLOAT", `${p}.check-strokeWidth`, lib.check.stroke],
    ["FLOAT", `${p}.labelFontSize`, lib.fontSize],
  ];
  if (lib.lineHeightUnit === "PIXELS")
    planned.push(["FLOAT", `${p}.labelLineHeight`, lib.lineHeight]);
  for (const checked of ["unchecked", "checked", "indeterminate"]) {
    for (const disabled of ["false", "true"]) {
      const arm = disabled === "true" ? "disabled" : "enabled";
      const cell = lib.cells[`${checked}/${disabled}`];
      planned.push(["COLOR", `${p}.states-${checked}-${arm}-boxFill`, cell.box]);
      planned.push(["COLOR", `${p}.states-${checked}-${arm}-boxBorder`, cell.border]);
      planned.push(["COLOR", `${p}.states-${checked}-${arm}-label`, cell.label]);
      planned.push(["COLOR", `${p}.states-${checked}-${arm}-dashFill`, cell.dash]);
      planned.push(["COLOR", `${p}.states-${checked}-${arm}-checkFill`, cell.check]);
    }
  }

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
if(!page)throw new Error("CHECKBOX-PAGE-MISSING");
if(signed.includes(page.id))throw new Error("CHECKBOX-MUST-NOT-WRITE-SIGNED-PAGE:"+page.id);
if(page.getSharedPluginData(NS,"runIdentity")!==runIdentity)throw new Error("CHECKBOX-PAGE-IDENTITY-MISMATCH:"+page.id);
await figma.setCurrentPageAsync(page);
if(page.children.some(n=>n.type==="SECTION"&&n.getSharedPluginData(NS,"adapterIdentity")===adapterIdentity))throw new Error("CHECKBOX-SECTION-EXISTS:"+adapterIdentity);
const hex=v=>({r:parseInt(v.slice(1,3),16)/255,g:parseInt(v.slice(3,5),16)/255,b:parseInt(v.slice(5,7),16)/255,a:parseInt(v.slice(7,9),16)/255});
const paint=v=>{const c=hex(v);return{type:"SOLID",color:{r:c.r,g:c.g,b:c.b},opacity:c.a};};
const allFonts=await figma.listAvailableFontsAsync();
const fontSpec=${JSON.stringify(lib.font)};
const found=fontSpec.fallbackChain.map(c=>allFonts.find(f=>f.fontName.family===c.family&&f.fontName.style===c.style)).find(Boolean);
if(!found)throw new Error("CHECKBOX-FONT-UNAVAILABLE:"+fontSpec.requestedFamily);
if(found.fontName.family!==fontSpec.resolvedFamily||found.fontName.style!==fontSpec.resolvedStyle)throw new Error("CHECKBOX-FONT-PROVENANCE-TAMPER:"+found.fontName.family);
await figma.loadFontAsync(found.fontName);
const collectionName="Recipe Checkbox / "+runIdentity+" / "+adapterIdentity;
const locals=figma.variables.getLocalVariableCollectionsAsync?await figma.variables.getLocalVariableCollectionsAsync():[];
if(locals.some(c=>c.name===collectionName))throw new Error("CHECKBOX-VARIABLE-COLLECTION-COLLISION:"+collectionName);
const collection=figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId,"Default");
collection.hiddenFromPublishing=true;
const modeId=collection.modes[0].modeId;
const prefix=${JSON.stringify(p)};
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
    wrapper: lib.wrapper,
    box: lib.box,
    radius: lib.radius,
    border: lib.border,
    padding: lib.padding,
    gap: lib.gap,
    dash: lib.dash,
    check: lib.check,
    fontSize: lib.fontSize,
    lineHeightUnit: lib.lineHeightUnit,
    lineHeight: lib.lineHeight,
    rowAlign: lib.rowAlign,
    cells: lib.cells,
  })};
let paintedFont=found.fontName;
const paintLabel=async()=>{
  const label=figma.createText();
  label.fontName=paintedFont;
  label.characters="Accept terms";
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
      label.characters="Accept terms";
      if(label.width>0&&label.absoluteRenderBounds){paintedFont=next.fontName;ok=true;break;}
    }
    if(!ok&&(label.width<=0||label.absoluteRenderBounds===null))throw new Error("CHECKBOX-FONT-ZERO-INTRINSIC");
  }
  if(label.width<=0||label.height<=0)throw new Error("CHECKBOX-TEXT-GEOMETRY");
  return label;
};
let nextX=0;
for(const child of page.children){if(child.type==="SECTION")nextX=Math.max(nextX,child.x+child.width+240);}
const section=figma.createSection();
section.name="Recipe Pivot / ${lib.displayName} / "+recipeHash.slice(0,8);
section.x=nextX;section.y=0;page.appendChild(section);
section.setSharedPluginData(NS,"adapterIdentity",adapterIdentity);
section.setSharedPluginData(NS,"recipeHash",recipeHash);
section.setSharedPluginData(NS,"variableCollectionId",collection.id);
const components=[];
for(const checked of ["unchecked","checked","indeterminate"]){
  for(const disabled of ["false","true"]){
    const arm=disabled==="true"?"disabled":"enabled";
    const cell=geom.cells[checked+"/"+disabled];
    const component=figma.createComponent();
    component.clipsContent=false;
    component.name="Checked="+checked+", Disabled="+disabled;
    component.layoutMode="HORIZONTAL";
    component.primaryAxisAlignItems="MIN";
    component.counterAxisAlignItems=geom.rowAlign;
    component.itemSpacing=geom.gap;
    component.fills=[];
    bindFloat(component,"itemSpacing",prefix+".row-gap");
    section.appendChild(component);
    const hit=figma.createFrame();
    hit.name="checkbox/hit";
    hit.layoutMode="HORIZONTAL";
    hit.primaryAxisAlignItems="CENTER";
    hit.counterAxisAlignItems="CENTER";
    hit.itemSpacing=0;
    hit.fills=[];
    hit.clipsContent=false;
    hit.paddingTop=geom.padding;hit.paddingRight=geom.padding;hit.paddingBottom=geom.padding;hit.paddingLeft=geom.padding;
    hit.resizeWithoutConstraints(geom.wrapper,geom.wrapper);
    hit.layoutSizingHorizontal="FIXED";hit.layoutSizingVertical="FIXED";
    bindFloat(hit,"width",prefix+".wrapper-size");
    bindFloat(hit,"height",prefix+".wrapper-size");
    component.appendChild(hit);
    const box=figma.createFrame();
    box.name="checkbox/box";
    box.layoutMode="HORIZONTAL";
    box.primaryAxisAlignItems="CENTER";
    box.counterAxisAlignItems="CENTER";
    box.itemSpacing=0;
    box.opacity=cell.op;
    box.clipsContent=geom.check.placement!=="absolute";
    box.resizeWithoutConstraints(geom.box,geom.box);
    box.layoutSizingHorizontal="FIXED";box.layoutSizingVertical="FIXED";
    box.fills=[bindColor(paint(cell.box),prefix+".states-"+checked+"-"+arm+"-boxFill")];
    box.strokes=[bindColor(paint(cell.border),prefix+".states-"+checked+"-"+arm+"-boxBorder")];
    box.strokeWeight=geom.border;box.strokeAlign="INSIDE";
    box.topLeftRadius=geom.radius;box.topRightRadius=geom.radius;box.bottomRightRadius=geom.radius;box.bottomLeftRadius=geom.radius;
    bindFloat(box,"width",prefix+".box-size");
    bindFloat(box,"height",prefix+".box-size");
    bindFloat(box,"strokeWeight",prefix+".box-borderWidth");
    bindFloat(box,"topLeftRadius",prefix+".box-radius");
    bindFloat(box,"topRightRadius",prefix+".box-radius");
    bindFloat(box,"bottomRightRadius",prefix+".box-radius");
    bindFloat(box,"bottomLeftRadius",prefix+".box-radius");
    hit.appendChild(box);
    const dash=figma.createFrame();
    dash.name="checkbox/glyph/dash";
    dash.visible=checked==="indeterminate";
    dash.layoutMode="HORIZONTAL";
    dash.resizeWithoutConstraints(geom.dash.w,geom.dash.h);
    dash.layoutSizingHorizontal="FIXED";dash.layoutSizingVertical="FIXED";
    dash.fills=[bindColor(paint(cell.dash),prefix+".states-"+checked+"-"+arm+"-dashFill")];
    dash.topLeftRadius=geom.dash.r;dash.topRightRadius=geom.dash.r;dash.bottomRightRadius=geom.dash.r;dash.bottomLeftRadius=geom.dash.r;
    bindFloat(dash,"width",prefix+".dash-width");
    bindFloat(dash,"height",prefix+".dash-height");
    box.appendChild(dash);
    const vector=figma.createVector();
    vector.name="checkbox/glyph/check";
    vector.visible=checked==="checked";
    vector.vectorPaths=[{windingRule:"NONZERO",data:geom.check.path}];
    vector.strokeCap=geom.check.cap;
    vector.strokeJoin=geom.check.join;
    if(geom.check.rotation)vector.rotation=geom.check.rotation;
    if(geom.check.paint==="stroke"){
      vector.fills=[];
      vector.strokes=[bindColor(paint(cell.check),prefix+".states-"+checked+"-"+arm+"-checkFill")];
      vector.strokeWeight=geom.check.stroke;
      vector.strokeAlign="CENTER";
      bindFloat(vector,"strokeWeight",prefix+".check-strokeWidth");
    }else{
      vector.fills=[bindColor(paint(cell.check),prefix+".states-"+checked+"-"+arm+"-checkFill")];
      vector.strokes=[];
    }
    vector.resizeWithoutConstraints(geom.check.w,geom.check.h);
    bindFloat(vector,"width",prefix+".check-width");
    bindFloat(vector,"height",prefix+".check-height");
    if(geom.check.placement==="absolute"){
      const host=figma.createFrame();
      host.name="checkbox/glyph/check-host";
      host.layoutMode="HORIZONTAL";
      host.primaryAxisAlignItems="CENTER";
      host.counterAxisAlignItems="CENTER";
      host.fills=[];
      host.clipsContent=false;
      host.appendChild(vector);
      box.appendChild(host);
      host.layoutPositioning="ABSOLUTE";
      host.x=geom.check.x;host.y=geom.check.y;
      host.constraints={horizontal:"MIN",vertical:"MIN"};
      host.resizeWithoutConstraints(geom.check.w,geom.check.h);
      host.layoutSizingHorizontal="FIXED";host.layoutSizingVertical="FIXED";
    }else box.appendChild(vector);
    const label=await paintLabel();
    label.name="checkbox/label :: font-provenance="+encodeURIComponent(JSON.stringify(fontSpec));
    label.fills=[bindColor(paint(cell.label),prefix+".states-"+checked+"-"+arm+"-label")];
    bindFloat(label,"fontSize",prefix+".labelFontSize");
    if(geom.lineHeightUnit==="PIXELS")bindFloat(label,"lineHeight",prefix+".labelLineHeight");
    component.appendChild(label);
    component.layoutSizingHorizontal="HUG";
    component.layoutSizingVertical="HUG";
    if(component.layoutMode!=="HORIZONTAL")throw new Error("CHECKBOX-FAKE-LAYOUT:"+component.name);
    components.push(component);
  }
}
const set=figma.combineAsVariants(components,section);
void "CHECKBOX-WRITER-SET-NAME-CARRIES-COMPILE-LABEL";
void "CHECKBOX-WRITER-VECTOR-PATH";
set.name="checkbox/set :: ${lib.setLabel}";
set.description="Experimental checkbox@1 primitive-IR mint. Recipe "+recipeHash+"; source adapter "+adapterIdentity+".";
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
}

for (const [slug, lib] of Object.entries(libraries)) {
  writeFileSync(new URL(`./compact-${slug}.js`, import.meta.url), emit(lib));
}
console.log("wrote compact hosts");
