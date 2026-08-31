if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.radio.recipe.v1";
const runIdentity = "98044e9d-4c17efd5-3dd31d13-radio-v1";
const pageName = "Recipe Pivot / Radio / 98044e9d-4c17efd5-3dd31d13-radio-v1";
const adapterIdentity = "astryx-radio-reviewed-v1";
const recipeHash = "98044e9df4fddb9b835af5dc800072386276caa735f246a037d12b7fbea59640";
const envelopeHash = "b325076bbb464fc6842d17b15a7da1e4e834b918e1bc05c634feb5c8c9de10c8";
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
const fontSpec = {"requestedFamily":"-apple-system","requestedStyle":"Medium","resolvedFamily":"SF Pro","resolvedStyle":"Medium","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Medium"},{"family":"SF Pro","style":"Medium"},{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"degradation":"source -apple-system stack; Figma cannot load a CSS stack; first named host font is SF Pro Medium"};
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
const prefix = "astryx.radio";
const planned = [
  ["COLOR", prefix + ".states-selected-enabled-circleFill", "#0064e0ff"],
  ["COLOR", prefix + ".states-selected-enabled-circleBorder", "#0064e0ff"],
  ["COLOR", prefix + ".states-selected-enabled-label", "#4e606fff"],
  ["COLOR", prefix + ".states-selected-enabled-dotFill", "#ffffffff"],
  ["COLOR", prefix + ".states-selected-disabled-circleFill", "#0064e0ff"],
  ["COLOR", prefix + ".states-selected-disabled-circleBorder", "#05365919"],
  ["COLOR", prefix + ".states-selected-disabled-label", "#a4b0bcff"],
  ["COLOR", prefix + ".states-selected-disabled-dotFill", "#ffffffff"],
  ["COLOR", prefix + ".states-unselected-enabled-circleFill", "#ffffffff"],
  ["COLOR", prefix + ".states-unselected-enabled-circleBorder", "#ccd3dbff"],
  ["COLOR", prefix + ".states-unselected-enabled-label", "#4e606fff"],
  ["COLOR", prefix + ".states-unselected-enabled-dotFill", "#00000000"],
  ["COLOR", prefix + ".states-unselected-disabled-circleFill", "#0536590c"],
  ["COLOR", prefix + ".states-unselected-disabled-circleBorder", "#05365919"],
  ["COLOR", prefix + ".states-unselected-disabled-label", "#a4b0bcff"],
  ["COLOR", prefix + ".states-unselected-disabled-dotFill", "#00000000"],
  ["FLOAT", prefix + ".wrapper-size", 24],
  ["FLOAT", prefix + ".circle-size", 22],
  ["FLOAT", prefix + ".circle-radius", 11],
  ["FLOAT", prefix + ".circle-borderWidth", 1],
  ["FLOAT", prefix + ".circle-padding", 1],
  ["FLOAT", prefix + ".list-gap", 8],
  ["FLOAT", prefix + ".item-gap", 8],
  ["FLOAT", prefix + ".dot-size", 10],
  ["FLOAT", prefix + ".dot-radius", 5],
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
  "selected/false": { ...{"fill":"#0064e0ff","border":"#0064e0ff","label":"#4e606fff","dot":"#ffffffff","opacity":1}, fillId: prefix + ".states-selected-enabled-circleFill", borderId: prefix + ".states-selected-enabled-circleBorder", labelId: prefix + ".states-selected-enabled-label", dotId: prefix + ".states-selected-enabled-dotFill" },
  "selected/true": { ...{"fill":"#0064e0ff","border":"#05365919","label":"#a4b0bcff","dot":"#ffffffff","opacity":0.5}, fillId: prefix + ".states-selected-disabled-circleFill", borderId: prefix + ".states-selected-disabled-circleBorder", labelId: prefix + ".states-selected-disabled-label", dotId: prefix + ".states-selected-disabled-dotFill" },
  "unselected/false": { ...{"fill":"#ffffffff","border":"#ccd3dbff","label":"#4e606fff","dot":"#00000000","opacity":1}, fillId: prefix + ".states-unselected-enabled-circleFill", borderId: prefix + ".states-unselected-enabled-circleBorder", labelId: prefix + ".states-unselected-enabled-label", dotId: prefix + ".states-unselected-enabled-dotFill" },
  "unselected/true": { ...{"fill":"#0536590c","border":"#05365919","label":"#a4b0bcff","dot":"#00000000","opacity":0.5}, fillId: prefix + ".states-unselected-disabled-circleFill", borderId: prefix + ".states-unselected-disabled-circleBorder", labelId: prefix + ".states-unselected-disabled-label", dotId: prefix + ".states-unselected-disabled-dotFill" },
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
section.name = "Recipe Pivot / Astryx / " + recipeHash.slice(0, 8);
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
    component.layoutMode = "VERTICAL";
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
      row.counterAxisAlignItems = "CENTER";
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
      hit.paddingTop = 1;
      hit.paddingRight = 1;
      hit.paddingBottom = 1;
      hit.paddingLeft = 1;
      hit.resizeWithoutConstraints(24, 24);
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
      circle.resizeWithoutConstraints(22, 22);
      circle.layoutSizingHorizontal = "FIXED";
      circle.layoutSizingVertical = "FIXED";
      circle.fills = [bindColor(paint(cell.fill), cell.fillId)];
      circle.strokes = [bindColor(paint(cell.border), cell.borderId)];
      circle.strokeWeight = 1;
      circle.strokeAlign = "INSIDE";
      circle.topLeftRadius = 11;
      circle.topRightRadius = 11;
      circle.bottomRightRadius = 11;
      circle.bottomLeftRadius = 11;
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
      dot.resizeWithoutConstraints(10, 10);
      dot.layoutSizingHorizontal = "FIXED";
      dot.layoutSizingVertical = "FIXED";
      dot.fills = [bindColor(paint(cell.dot), cell.dotId)];
      dot.topLeftRadius = 5;
      dot.topRightRadius = 5;
      dot.bottomRightRadius = 5;
      dot.bottomLeftRadius = 5;
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
    if (component.layoutMode !== "VERTICAL")
      throw new Error("RADIO-FAKE-LAYOUT:" + component.name);
    components.push(component);
  }
}
const set = figma.combineAsVariants(components, section);
set.name = "radio/set :: Astryx RadioList";
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
