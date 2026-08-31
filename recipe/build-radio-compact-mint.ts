import { writeFileSync } from "node:fs";

const RUN = "98044e9d-4c17efd5-3dd31d13-radio-v1";
const PAGE = `Recipe Pivot / Radio / ${RUN}`;
const NS = "ds.contracts.radio.recipe.v1";
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

type Source = {
  slug: string;
  adapterIdentity: string;
  displayName: string;
  setLabel: string;
  recipeHash: string;
  envelopeHash: string;
  listMode: "VERTICAL" | "HORIZONTAL";
  itemAlign: "CENTER" | "BASELINE";
  listGap: number;
  itemGap: number;
  wrapper: number;
  circle: number;
  radius: number;
  border: number;
  padding: number;
  dot: number;
  dotRadius: number;
  fontSize: number;
  fontSpec: {
    requestedFamily: string;
    requestedStyle: string;
    resolvedFamily: string;
    resolvedStyle: string;
    resolution: string;
    fallbackChain: Array<{ family: string; style: string }>;
    degradation?: string;
  };
  prefix: string;
  selectedEnabled: {
    fill: string;
    border: string;
    label: string;
    dot: string;
    opacity: number;
  };
  selectedDisabled: {
    fill: string;
    border: string;
    label: string;
    dot: string;
    opacity: number;
  };
  unselectedEnabled: {
    fill: string;
    border: string;
    label: string;
    dot: string;
    opacity: number;
  };
  unselectedDisabled: {
    fill: string;
    border: string;
    label: string;
    dot: string;
    opacity: number;
  };
};

const astryx: Source = {
  slug: "astryx",
  adapterIdentity: "astryx-radio-reviewed-v1",
  displayName: "Astryx",
  setLabel: "Astryx RadioList",
  recipeHash: "98044e9df4fddb9b835af5dc800072386276caa735f246a037d12b7fbea59640",
  envelopeHash: "b325076bbb464fc6842d17b15a7da1e4e834b918e1bc05c634feb5c8c9de10c8",
  listMode: "VERTICAL",
  itemAlign: "CENTER",
  listGap: 8,
  itemGap: 8,
  wrapper: 24,
  circle: 22,
  radius: 11,
  border: 1,
  padding: 1,
  dot: 10,
  dotRadius: 5,
  fontSize: 14,
  fontSpec: {
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
  },
  prefix: "astryx.radio",
  selectedEnabled: {
    fill: "#0064e0ff",
    border: "#0064e0ff",
    label: "#4e606fff",
    dot: "#ffffffff",
    opacity: 1,
  },
  selectedDisabled: {
    fill: "#0064e0ff",
    border: "#05365919",
    label: "#a4b0bcff",
    dot: "#ffffffff",
    opacity: 0.5,
  },
  unselectedEnabled: {
    fill: "#ffffffff",
    border: "#ccd3dbff",
    label: "#4e606fff",
    dot: "#00000000",
    opacity: 1,
  },
  unselectedDisabled: {
    fill: "#0536590c",
    border: "#05365919",
    label: "#a4b0bcff",
    dot: "#00000000",
    opacity: 0.5,
  },
};

const mui: Source = {
  slug: "mui",
  adapterIdentity: "mui-radio-reviewed-v1",
  displayName: "MUI",
  setLabel: "MUI Radio + RadioGroup",
  recipeHash: "4c17efd5ed8881da9e776179f3ffea8d5f73d8a2664dac64c99e24d76b5b5581",
  envelopeHash: "c2393d4fc09f677f219c596e74d7976d516868cf6d8a9ac15ae41ee6b1fa3921",
  listMode: "VERTICAL",
  itemAlign: "CENTER",
  listGap: 0,
  itemGap: 0,
  wrapper: 42,
  circle: 24,
  radius: 12,
  border: 2,
  padding: 9,
  dot: 10,
  dotRadius: 5,
  fontSize: 16,
  fontSpec: {
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
  },
  prefix: "mui.radio",
  selectedEnabled: {
    fill: "#00000000",
    border: "#1976d2ff",
    label: "#000000de",
    dot: "#1976d2ff",
    opacity: 1,
  },
  selectedDisabled: {
    fill: "#00000000",
    border: "#00000042",
    label: "#00000061",
    dot: "#00000042",
    opacity: 1,
  },
  unselectedEnabled: {
    fill: "#00000000",
    border: "#00000099",
    label: "#000000de",
    dot: "#00000000",
    opacity: 1,
  },
  unselectedDisabled: {
    fill: "#00000000",
    border: "#00000042",
    label: "#00000061",
    dot: "#00000000",
    opacity: 1,
  },
};

const antd: Source = {
  slug: "antd",
  adapterIdentity: "antd-radio-reviewed-v1",
  displayName: "Ant Design",
  setLabel: "Ant Design Radio.Group",
  recipeHash: "3dd31d135507a8c847d3d0c35221d46cbfe466d0a38c8f215fe3e5d111b20db5",
  envelopeHash: "b6e371f2799768c1657f50147d72fd9fb148ea99595397ea0b1a9c69e837ba59",
  listMode: "HORIZONTAL",
  itemAlign: "BASELINE",
  listGap: 8,
  itemGap: 8,
  wrapper: 16,
  circle: 16,
  radius: 8,
  border: 1,
  padding: 0,
  dot: 6,
  dotRadius: 3,
  fontSize: 14,
  fontSpec: {
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
  },
  prefix: "antd.radio",
  selectedEnabled: {
    fill: "#1677ffff",
    border: "#1677ffff",
    label: "#000000e0",
    dot: "#ffffffff",
    opacity: 1,
  },
  selectedDisabled: {
    fill: "#0000000a",
    border: "#d9d9d9ff",
    label: "#00000040",
    dot: "#00000040",
    opacity: 1,
  },
  unselectedEnabled: {
    fill: "#ffffffff",
    border: "#d9d9d9ff",
    label: "#000000e0",
    dot: "#00000000",
    opacity: 1,
  },
  unselectedDisabled: {
    fill: "#0000000a",
    border: "#d9d9d9ff",
    label: "#00000040",
    dot: "#00000000",
    opacity: 1,
  },
};

const emit = (source: Source): string => `if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = ${JSON.stringify(NS)};
const runIdentity = ${JSON.stringify(RUN)};
const pageName = ${JSON.stringify(PAGE)};
const adapterIdentity = ${JSON.stringify(source.adapterIdentity)};
const recipeHash = ${JSON.stringify(source.recipeHash)};
const envelopeHash = ${JSON.stringify(source.envelopeHash)};
await figma.loadAllPagesAsync();
const page = figma.root.children.find((p) => p.name === pageName);
if (!page) throw new Error("RADIO-PAGE-MISSING");
if (${JSON.stringify(SIGNED)}.includes(page.id))
  throw new Error("RADIO-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("RADIO-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (${JSON.stringify(SIGNED)}.includes(figma.currentPage.id))
  throw new Error("RADIO-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
if (page.children.some((n) => n.type === "SECTION" && n.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("RADIO-SECTION-EXISTS:" + adapterIdentity);

const hex = (value) => ({
  r: parseInt(value.slice(1, 3), 16) / 255,
  g: parseInt(value.slice(3, 5), 16) / 255,
  b: parseInt(value.slice(5, 7), 16) / 255,
  a: parseInt(value.slice(7, 9), 16) / 255,
});
const paint = (value) => {
  const c = hex(value);
  return { type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
};
const allFonts = await figma.listAvailableFontsAsync();
const fontSpec = ${JSON.stringify(source.fontSpec)};
const found = fontSpec.fallbackChain
  .map((c) => allFonts.find((f) => f.fontName.family === c.family && f.fontName.style === c.style))
  .find(Boolean);
if (!found) throw new Error("RADIO-FONT-UNAVAILABLE:" + fontSpec.requestedFamily + ":" + fontSpec.requestedStyle);
if (found.fontName.family !== fontSpec.resolvedFamily || found.fontName.style !== fontSpec.resolvedStyle)
  throw new Error("RADIO-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
await figma.loadFontAsync(found.fontName);

const collectionName = "Recipe Radio / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((c) => c.name === collectionName)) throw new Error("RADIO-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = ${JSON.stringify(source.prefix)};
const planned = [
  ["COLOR", prefix + ".states-selected-enabled-circleFill", ${JSON.stringify(source.selectedEnabled.fill)}],
  ["COLOR", prefix + ".states-selected-enabled-circleBorder", ${JSON.stringify(source.selectedEnabled.border)}],
  ["COLOR", prefix + ".states-selected-enabled-label", ${JSON.stringify(source.selectedEnabled.label)}],
  ["COLOR", prefix + ".states-selected-enabled-dotFill", ${JSON.stringify(source.selectedEnabled.dot)}],
  ["COLOR", prefix + ".states-selected-disabled-circleFill", ${JSON.stringify(source.selectedDisabled.fill)}],
  ["COLOR", prefix + ".states-selected-disabled-circleBorder", ${JSON.stringify(source.selectedDisabled.border)}],
  ["COLOR", prefix + ".states-selected-disabled-label", ${JSON.stringify(source.selectedDisabled.label)}],
  ["COLOR", prefix + ".states-selected-disabled-dotFill", ${JSON.stringify(source.selectedDisabled.dot)}],
  ["COLOR", prefix + ".states-unselected-enabled-circleFill", ${JSON.stringify(source.unselectedEnabled.fill)}],
  ["COLOR", prefix + ".states-unselected-enabled-circleBorder", ${JSON.stringify(source.unselectedEnabled.border)}],
  ["COLOR", prefix + ".states-unselected-enabled-label", ${JSON.stringify(source.unselectedEnabled.label)}],
  ["COLOR", prefix + ".states-unselected-enabled-dotFill", ${JSON.stringify(source.unselectedEnabled.dot)}],
  ["COLOR", prefix + ".states-unselected-disabled-circleFill", ${JSON.stringify(source.unselectedDisabled.fill)}],
  ["COLOR", prefix + ".states-unselected-disabled-circleBorder", ${JSON.stringify(source.unselectedDisabled.border)}],
  ["COLOR", prefix + ".states-unselected-disabled-label", ${JSON.stringify(source.unselectedDisabled.label)}],
  ["COLOR", prefix + ".states-unselected-disabled-dotFill", ${JSON.stringify(source.unselectedDisabled.dot)}],
  ["FLOAT", prefix + ".wrapper-size", ${source.wrapper}],
  ["FLOAT", prefix + ".circle-size", ${source.circle}],
  ["FLOAT", prefix + ".circle-radius", ${source.radius}],
  ["FLOAT", prefix + ".circle-borderWidth", ${source.border}],
  ["FLOAT", prefix + ".circle-padding", ${source.padding}],
  ["FLOAT", prefix + ".list-gap", ${source.listGap}],
  ["FLOAT", prefix + ".item-gap", ${source.itemGap}],
  ["FLOAT", prefix + ".dot-size", ${source.dot}],
  ["FLOAT", prefix + ".dot-radius", ${source.dotRadius}],
  ["FLOAT", prefix + ".labelFontSize", ${source.fontSize}],
];
const vars = new Map();
for (const [type, identity, value] of planned) {
  const name = "token/" + (type === "COLOR" ? "color" : "float") + "/id-" + Array.from(identity).map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  const variable = figma.variables.createVariable(name, collection, type);
  variable.scopes = ["ALL_SCOPES"];
  variable.setValueForMode(modeId, type === "COLOR" ? hex(value) : value);
  vars.set(type + ":" + identity, variable);
}
const bindColor = (base, identity) => figma.variables.setBoundVariableForPaint(base, "color", vars.get("COLOR:" + identity));
const bindFloat = (node, field, identity) => node.setBoundVariable(field, vars.get("FLOAT:" + identity));
const cells = {
  "selected/false": { ...${JSON.stringify(source.selectedEnabled)}, fillId: prefix + ".states-selected-enabled-circleFill", borderId: prefix + ".states-selected-enabled-circleBorder", labelId: prefix + ".states-selected-enabled-label", dotId: prefix + ".states-selected-enabled-dotFill" },
  "selected/true": { ...${JSON.stringify(source.selectedDisabled)}, fillId: prefix + ".states-selected-disabled-circleFill", borderId: prefix + ".states-selected-disabled-circleBorder", labelId: prefix + ".states-selected-disabled-label", dotId: prefix + ".states-selected-disabled-dotFill" },
  "unselected/false": { ...${JSON.stringify(source.unselectedEnabled)}, fillId: prefix + ".states-unselected-enabled-circleFill", borderId: prefix + ".states-unselected-enabled-circleBorder", labelId: prefix + ".states-unselected-enabled-label", dotId: prefix + ".states-unselected-enabled-dotFill" },
  "unselected/true": { ...${JSON.stringify(source.unselectedDisabled)}, fillId: prefix + ".states-unselected-disabled-circleFill", borderId: prefix + ".states-unselected-disabled-circleBorder", labelId: prefix + ".states-unselected-disabled-label", dotId: prefix + ".states-unselected-disabled-dotFill" },
};
const items = [{ id: "a", label: "Email" }, { id: "b", label: "Phone" }];
let paintedFont = found.fontName;
const paintLabel = async (characters) => {
  const label = figma.createText();
  label.fontName = paintedFont;
  label.characters = characters;
  label.fontSize = ${source.fontSize};
  label.lineHeight = { unit: "AUTO" };
  label.textAlignHorizontal = "LEFT";
  label.textAlignVertical = "CENTER";
  label.textAutoResize = "WIDTH_AND_HEIGHT";
  if (label.characters.trim().length > 0 && (label.width <= 0 || label.absoluteRenderBounds === null)) {
    let ok = false;
    for (const candidate of fontSpec.fallbackChain) {
      if (candidate.family === fontSpec.resolvedFamily && candidate.style === fontSpec.resolvedStyle) continue;
      const next = allFonts.find((entry) => entry.fontName.family === candidate.family && entry.fontName.style === candidate.style);
      if (!next) continue;
      await figma.loadFontAsync(next.fontName);
      label.fontName = next.fontName;
      label.characters = characters;
      if (label.width > 0 && label.absoluteRenderBounds) {
        paintedFont = next.fontName;
        ok = true;
        break;
      }
    }
    if (!ok && (label.width <= 0 || label.absoluteRenderBounds === null))
      throw new Error("RADIO-FONT-ZERO-INTRINSIC:radio/label");
  }
  if (label.width <= 0 || label.height <= 0) throw new Error("RADIO-TEXT-GEOMETRY:radio/label");
  return label;
};

let nextX = 0;
for (const child of page.children) {
  if (child.type === "SECTION") nextX = Math.max(nextX, child.x + child.width + 240);
}
const section = figma.createSection();
section.name = "Recipe Pivot / ${source.displayName} / " + recipeHash.slice(0, 8);
section.x = nextX;
section.y = 0;
page.appendChild(section);
section.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
section.setSharedPluginData(NS, "recipeHash", recipeHash);
section.setSharedPluginData(NS, "variableCollectionId", collection.id);

const components = [];
for (const selected of ["a", "b"]) {
  for (const disabled of ["false", "true"]) {
    const component = figma.createComponent();
    component.clipsContent = false;
    component.name = "Selected=" + selected + ", Disabled=" + disabled;
    component.layoutMode = ${JSON.stringify(source.listMode)};
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = "MIN";
    component.itemSpacing = ${source.listGap};
    component.fills = [];
    bindFloat(component, "itemSpacing", prefix + ".list-gap");
    section.appendChild(component);
    for (const item of items) {
      const selectedHere = item.id === selected;
      const cell = cells[(selectedHere ? "selected" : "unselected") + "/" + disabled];
      const row = figma.createFrame();
      row.name = "radio/item/" + item.id;
      row.layoutMode = "HORIZONTAL";
      row.primaryAxisAlignItems = "MIN";
      row.counterAxisAlignItems = ${JSON.stringify(source.itemAlign)};
      row.itemSpacing = ${source.itemGap};
      row.fills = [];
      bindFloat(row, "itemSpacing", prefix + ".item-gap");
      component.appendChild(row);

      const hit = figma.createFrame();
      hit.name = "radio/hit";
      hit.layoutMode = "HORIZONTAL";
      hit.primaryAxisAlignItems = "CENTER";
      hit.counterAxisAlignItems = "CENTER";
      hit.itemSpacing = 0;
      hit.fills = [];
      hit.paddingTop = ${source.padding};
      hit.paddingRight = ${source.padding};
      hit.paddingBottom = ${source.padding};
      hit.paddingLeft = ${source.padding};
      hit.resizeWithoutConstraints(${source.wrapper}, ${source.wrapper});
      hit.layoutSizingHorizontal = "FIXED";
      hit.layoutSizingVertical = "FIXED";
      bindFloat(hit, "width", prefix + ".wrapper-size");
      bindFloat(hit, "height", prefix + ".wrapper-size");
      bindFloat(hit, "paddingTop", prefix + ".circle-padding");
      bindFloat(hit, "paddingRight", prefix + ".circle-padding");
      bindFloat(hit, "paddingBottom", prefix + ".circle-padding");
      bindFloat(hit, "paddingLeft", prefix + ".circle-padding");
      row.appendChild(hit);

      const circle = figma.createFrame();
      circle.name = "radio/circle";
      circle.layoutMode = "HORIZONTAL";
      circle.primaryAxisAlignItems = "CENTER";
      circle.counterAxisAlignItems = "CENTER";
      circle.itemSpacing = 0;
      circle.opacity = cell.opacity;
      circle.resizeWithoutConstraints(${source.circle}, ${source.circle});
      circle.layoutSizingHorizontal = "FIXED";
      circle.layoutSizingVertical = "FIXED";
      circle.fills = [bindColor(paint(cell.fill), cell.fillId)];
      circle.strokes = [bindColor(paint(cell.border), cell.borderId)];
      circle.strokeWeight = ${source.border};
      circle.strokeAlign = "INSIDE";
      circle.topLeftRadius = ${source.radius};
      circle.topRightRadius = ${source.radius};
      circle.bottomRightRadius = ${source.radius};
      circle.bottomLeftRadius = ${source.radius};
      bindFloat(circle, "width", prefix + ".circle-size");
      bindFloat(circle, "height", prefix + ".circle-size");
      bindFloat(circle, "strokeWeight", prefix + ".circle-borderWidth");
      bindFloat(circle, "topLeftRadius", prefix + ".circle-radius");
      bindFloat(circle, "topRightRadius", prefix + ".circle-radius");
      bindFloat(circle, "bottomRightRadius", prefix + ".circle-radius");
      bindFloat(circle, "bottomLeftRadius", prefix + ".circle-radius");
      hit.appendChild(circle);

      const dot = figma.createFrame();
      dot.name = "radio/glyph/dot";
      dot.visible = selectedHere;
      dot.layoutMode = "HORIZONTAL";
      dot.resizeWithoutConstraints(${source.dot}, ${source.dot});
      dot.layoutSizingHorizontal = "FIXED";
      dot.layoutSizingVertical = "FIXED";
      dot.fills = [bindColor(paint(cell.dot), cell.dotId)];
      dot.topLeftRadius = ${source.dotRadius};
      dot.topRightRadius = ${source.dotRadius};
      dot.bottomRightRadius = ${source.dotRadius};
      dot.bottomLeftRadius = ${source.dotRadius};
      bindFloat(dot, "width", prefix + ".dot-size");
      bindFloat(dot, "height", prefix + ".dot-size");
      bindFloat(dot, "topLeftRadius", prefix + ".dot-radius");
      bindFloat(dot, "topRightRadius", prefix + ".dot-radius");
      bindFloat(dot, "bottomRightRadius", prefix + ".dot-radius");
      bindFloat(dot, "bottomLeftRadius", prefix + ".dot-radius");
      circle.appendChild(dot);

      const label = await paintLabel(item.label);
      label.name = "radio/label :: font-provenance=" + encodeURIComponent(JSON.stringify(fontSpec));
      label.fills = [bindColor(paint(cell.label), cell.labelId)];
      bindFloat(label, "fontSize", prefix + ".labelFontSize");
      row.appendChild(label);
      row.layoutSizingHorizontal = "HUG";
      row.layoutSizingVertical = "HUG";
    }
    component.layoutSizingHorizontal = "HUG";
    component.layoutSizingVertical = "HUG";
    if (component.layoutMode !== ${JSON.stringify(source.listMode)})
      throw new Error("RADIO-FAKE-LAYOUT:" + component.name);
    components.push(component);
  }
}
const set = figma.combineAsVariants(components, section);
set.name = "radio/set :: ${source.setLabel}";
set.description = "Experimental radio@1 primitive-IR mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
set.layoutMode = "VERTICAL";
set.primaryAxisAlignItems = "MIN";
set.counterAxisAlignItems = "MIN";
set.itemSpacing = 16;
set.paddingTop = 16;
set.paddingRight = 16;
set.paddingBottom = 16;
set.paddingLeft = 16;
set.fills = [];
set.layoutSizingHorizontal = "HUG";
set.layoutSizingVertical = "HUG";
set.setSharedPluginData(NS, "runIdentity", runIdentity);
set.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
set.setSharedPluginData(NS, "recipeHash", recipeHash);
set.setSharedPluginData(NS, "envelopeHash", envelopeHash);
set.x = 80;
set.y = 96;
section.resizeWithoutConstraints(set.width + 160, set.y + set.height + 80);
return {
  pageId: page.id,
  pageName: page.name,
  sectionId: section.id,
  setId: set.id,
  collectionId: collection.id,
  variantCount: set.children.length,
  adapterIdentity,
  recipeHash,
  paintedFont,
};
`;

for (const source of [astryx, mui, antd]) {
  const path = `recipe/evidence/radio-live-pivot-v1/compact-${source.slug}.js`;
  writeFileSync(path, emit(source));
  console.log(path);
}
