if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.radio.recipe.v1";
const runIdentity = "98044e9d-4c17efd5-3dd31d13-radio-v1";
const pageName = "Recipe Pivot / Radio / 98044e9d-4c17efd5-3dd31d13-radio-v1";
const adapterIdentity = "antd-radio-reviewed-v1";
const recipeHash = "3dd31d135507a8c847d3d0c35221d46cbfe466d0a38c8f215fe3e5d111b20db5";
const envelopeHash = "b6e371f2799768c1657f50147d72fd9fb148ea99595397ea0b1a9c69e837ba59";
await figma.loadAllPagesAsync();
const page = figma.root.children.find((p) => p.name === pageName);
if (!page) throw new Error("RADIO-PAGE-MISSING");
if (["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742"].includes(page.id))
  throw new Error("RADIO-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("RADIO-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742"].includes(figma.currentPage.id))
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
const fontSpec = {"requestedFamily":"-apple-system","requestedStyle":"Regular","resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica Neue","style":"Regular"},{"family":"Arial","style":"Regular"}],"degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular"};
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
const prefix = "antd.radio";
const planned = [
  ["COLOR", prefix + ".states-selected-enabled-circleFill", "#1677ffff"],
  ["COLOR", prefix + ".states-selected-enabled-circleBorder", "#1677ffff"],
  ["COLOR", prefix + ".states-selected-enabled-label", "#000000e0"],
  ["COLOR", prefix + ".states-selected-enabled-dotFill", "#ffffffff"],
  ["COLOR", prefix + ".states-selected-disabled-circleFill", "#0000000a"],
  ["COLOR", prefix + ".states-selected-disabled-circleBorder", "#d9d9d9ff"],
  ["COLOR", prefix + ".states-selected-disabled-label", "#00000040"],
  ["COLOR", prefix + ".states-selected-disabled-dotFill", "#00000040"],
  ["COLOR", prefix + ".states-unselected-enabled-circleFill", "#ffffffff"],
  ["COLOR", prefix + ".states-unselected-enabled-circleBorder", "#d9d9d9ff"],
  ["COLOR", prefix + ".states-unselected-enabled-label", "#000000e0"],
  ["COLOR", prefix + ".states-unselected-enabled-dotFill", "#00000000"],
  ["COLOR", prefix + ".states-unselected-disabled-circleFill", "#0000000a"],
  ["COLOR", prefix + ".states-unselected-disabled-circleBorder", "#d9d9d9ff"],
  ["COLOR", prefix + ".states-unselected-disabled-label", "#00000040"],
  ["COLOR", prefix + ".states-unselected-disabled-dotFill", "#00000000"],
  ["FLOAT", prefix + ".wrapper-size", 16],
  ["FLOAT", prefix + ".circle-size", 16],
  ["FLOAT", prefix + ".circle-radius", 8],
  ["FLOAT", prefix + ".circle-borderWidth", 1],
  ["FLOAT", prefix + ".circle-padding", 0],
  ["FLOAT", prefix + ".list-gap", 8],
  ["FLOAT", prefix + ".item-gap", 8],
  ["FLOAT", prefix + ".dot-size", 6],
  ["FLOAT", prefix + ".dot-radius", 3],
  ["FLOAT", prefix + ".labelFontSize", 14],
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
  "selected/false": { ...{"fill":"#1677ffff","border":"#1677ffff","label":"#000000e0","dot":"#ffffffff","opacity":1}, fillId: prefix + ".states-selected-enabled-circleFill", borderId: prefix + ".states-selected-enabled-circleBorder", labelId: prefix + ".states-selected-enabled-label", dotId: prefix + ".states-selected-enabled-dotFill" },
  "selected/true": { ...{"fill":"#0000000a","border":"#d9d9d9ff","label":"#00000040","dot":"#00000040","opacity":1}, fillId: prefix + ".states-selected-disabled-circleFill", borderId: prefix + ".states-selected-disabled-circleBorder", labelId: prefix + ".states-selected-disabled-label", dotId: prefix + ".states-selected-disabled-dotFill" },
  "unselected/false": { ...{"fill":"#ffffffff","border":"#d9d9d9ff","label":"#000000e0","dot":"#00000000","opacity":1}, fillId: prefix + ".states-unselected-enabled-circleFill", borderId: prefix + ".states-unselected-enabled-circleBorder", labelId: prefix + ".states-unselected-enabled-label", dotId: prefix + ".states-unselected-enabled-dotFill" },
  "unselected/true": { ...{"fill":"#0000000a","border":"#d9d9d9ff","label":"#00000040","dot":"#00000000","opacity":1}, fillId: prefix + ".states-unselected-disabled-circleFill", borderId: prefix + ".states-unselected-disabled-circleBorder", labelId: prefix + ".states-unselected-disabled-label", dotId: prefix + ".states-unselected-disabled-dotFill" },
};
const items = [{ id: "a", label: "Email" }, { id: "b", label: "Phone" }];
let paintedFont = found.fontName;
const paintLabel = async (characters) => {
  const label = figma.createText();
  label.fontName = paintedFont;
  label.characters = characters;
  label.fontSize = 14;
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
section.name = "Recipe Pivot / Ant Design / " + recipeHash.slice(0, 8);
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
    component.layoutMode = "HORIZONTAL";
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = "MIN";
    component.itemSpacing = 8;
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
      row.counterAxisAlignItems = "BASELINE";
      row.itemSpacing = 8;
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
      hit.paddingTop = 0;
      hit.paddingRight = 0;
      hit.paddingBottom = 0;
      hit.paddingLeft = 0;
      hit.resizeWithoutConstraints(16, 16);
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
      circle.resizeWithoutConstraints(16, 16);
      circle.layoutSizingHorizontal = "FIXED";
      circle.layoutSizingVertical = "FIXED";
      circle.fills = [bindColor(paint(cell.fill), cell.fillId)];
      circle.strokes = [bindColor(paint(cell.border), cell.borderId)];
      circle.strokeWeight = 1;
      circle.strokeAlign = "INSIDE";
      circle.topLeftRadius = 8;
      circle.topRightRadius = 8;
      circle.bottomRightRadius = 8;
      circle.bottomLeftRadius = 8;
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
      dot.resizeWithoutConstraints(6, 6);
      dot.layoutSizingHorizontal = "FIXED";
      dot.layoutSizingVertical = "FIXED";
      dot.fills = [bindColor(paint(cell.dot), cell.dotId)];
      dot.topLeftRadius = 3;
      dot.topRightRadius = 3;
      dot.bottomRightRadius = 3;
      dot.bottomLeftRadius = 3;
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
    if (component.layoutMode !== "HORIZONTAL")
      throw new Error("RADIO-FAKE-LAYOUT:" + component.name);
    components.push(component);
  }
}
const set = figma.combineAsVariants(components, section);
set.name = "radio/set :: Ant Design Radio.Group";
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
