if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.checkbox.recipe.v1";
const runIdentity = "e2386e0d-f8e77a54-be0bbae1-checkbox-v1";
const pageName = "Recipe Pivot / Checkbox / " + runIdentity;
const adapterIdentity = "astryx-checkbox-reviewed-v1";
const recipeHash = "e2386e0d23758fbf9fa9ffed93a8d3a712e5e06b620d3404eef907dd5bf7bc73";
const envelopeHash = "51932d9532901bbf0472da81c2ff44dc54a20f415bd66b597dcd0417ee577f56";
if (figma.currentPage && ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873"].includes(figma.currentPage.id))
  throw new Error("CHECKBOX-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
await figma.loadAllPagesAsync();
const page = figma.root.children.find((p) => p.name === pageName);
if (!page) throw new Error("CHECKBOX-PAGE-MISSING");
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("CHECKBOX-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (page.children.some((n) => n.type === "SECTION" && n.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("CHECKBOX-SECTION-EXISTS:" + adapterIdentity);

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
const fontSpec = {
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
};
const found = fontSpec.fallbackChain
  .map((c) => allFonts.find((f) => f.fontName.family === c.family && f.fontName.style === c.style))
  .find(Boolean);
if (!found) throw new Error("CHECKBOX-FONT-UNAVAILABLE:SF Pro:Medium");
if (found.fontName.family !== fontSpec.resolvedFamily || found.fontName.style !== fontSpec.resolvedStyle)
  throw new Error("CHECKBOX-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
await figma.loadFontAsync(found.fontName);

const collectionName = "Recipe Checkbox / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((c) => c.name === collectionName)) throw new Error("CHECKBOX-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const planned = [
  ["COLOR", "astryx.checkbox.states-unchecked-enabled-boxFill", "#ffffffff"],
  ["COLOR", "astryx.checkbox.states-unchecked-enabled-boxBorder", "#ccd3dbff"],
  ["COLOR", "astryx.checkbox.states-unchecked-enabled-label", "#4e606fff"],
  ["COLOR", "astryx.checkbox.states-unchecked-disabled-boxFill", "#0536590c"],
  ["COLOR", "astryx.checkbox.states-unchecked-disabled-boxBorder", "#05365919"],
  ["COLOR", "astryx.checkbox.states-unchecked-disabled-label", "#a4b0bcff"],
  ["COLOR", "astryx.checkbox.states-checked-enabled-boxFill", "#0064e0ff"],
  ["COLOR", "astryx.checkbox.states-checked-enabled-boxBorder", "#0064e0ff"],
  ["COLOR", "astryx.checkbox.states-checked-enabled-label", "#4e606fff"],
  ["COLOR", "astryx.checkbox.states-checked-disabled-boxFill", "#0064e0ff"],
  ["COLOR", "astryx.checkbox.states-checked-disabled-boxBorder", "#05365919"],
  ["COLOR", "astryx.checkbox.states-checked-disabled-label", "#a4b0bcff"],
  ["COLOR", "astryx.checkbox.states-indeterminate-enabled-boxFill", "#0064e0ff"],
  ["COLOR", "astryx.checkbox.states-indeterminate-enabled-boxBorder", "#0064e0ff"],
  ["COLOR", "astryx.checkbox.states-indeterminate-enabled-dashFill", "#ffffffff"],
  ["COLOR", "astryx.checkbox.states-indeterminate-enabled-label", "#4e606fff"],
  ["COLOR", "astryx.checkbox.states-indeterminate-disabled-boxFill", "#0064e0ff"],
  ["COLOR", "astryx.checkbox.states-indeterminate-disabled-boxBorder", "#05365919"],
  ["COLOR", "astryx.checkbox.states-indeterminate-disabled-dashFill", "#ffffffff"],
  ["COLOR", "astryx.checkbox.states-indeterminate-disabled-label", "#a4b0bcff"],
  ["FLOAT", "astryx.checkbox.box-size", 22],
  ["FLOAT", "astryx.checkbox.wrapper-size", 24],
  ["FLOAT", "astryx.checkbox.box-radius", 4],
  ["FLOAT", "astryx.checkbox.box-borderWidth", 1],
  ["FLOAT", "astryx.checkbox.row-gap", 8],
  ["FLOAT", "astryx.checkbox.dash-width", 12],
  ["FLOAT", "astryx.checkbox.dash-height", 2],
  ["FLOAT", "astryx.checkbox.dash-radius", 1],
  ["FLOAT", "astryx.checkbox.labelFontSize", 14],
];
const vars = new Map();
for (const [type, identity, value] of planned) {
  const name =
    "token/" +
    (type === "COLOR" ? "color" : "float") +
    "/id-" +
    Array.from(identity)
      .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("");
  const variable = figma.variables.createVariable(name, collection, type);
  variable.scopes = ["ALL_SCOPES"];
  variable.setValueForMode(modeId, type === "COLOR" ? hex(value) : value);
  vars.set(type + ":" + identity, variable);
}
const bindColor = (base, identity) =>
  figma.variables.setBoundVariableForPaint(base, "color", vars.get("COLOR:" + identity));
const bindFloat = (node, field, identity) => node.setBoundVariable(field, vars.get("FLOAT:" + identity));

const states = {
  "unchecked/false": { fill: "#ffffffff", border: "#ccd3dbff", label: "#4e606fff", dash: "#00000000", opacity: 1, dashOn: false, fillId: "astryx.checkbox.states-unchecked-enabled-boxFill", borderId: "astryx.checkbox.states-unchecked-enabled-boxBorder", labelId: "astryx.checkbox.states-unchecked-enabled-label" },
  "unchecked/true": { fill: "#0536590c", border: "#05365919", label: "#a4b0bcff", dash: "#00000000", opacity: 0.5, dashOn: false, fillId: "astryx.checkbox.states-unchecked-disabled-boxFill", borderId: "astryx.checkbox.states-unchecked-disabled-boxBorder", labelId: "astryx.checkbox.states-unchecked-disabled-label" },
  "checked/false": { fill: "#0064e0ff", border: "#0064e0ff", label: "#4e606fff", dash: "#00000000", opacity: 1, dashOn: false, fillId: "astryx.checkbox.states-checked-enabled-boxFill", borderId: "astryx.checkbox.states-checked-enabled-boxBorder", labelId: "astryx.checkbox.states-checked-enabled-label" },
  "checked/true": { fill: "#0064e0ff", border: "#05365919", label: "#a4b0bcff", dash: "#00000000", opacity: 0.5, dashOn: false, fillId: "astryx.checkbox.states-checked-disabled-boxFill", borderId: "astryx.checkbox.states-checked-disabled-boxBorder", labelId: "astryx.checkbox.states-checked-disabled-label" },
  "indeterminate/false": { fill: "#0064e0ff", border: "#0064e0ff", label: "#4e606fff", dash: "#ffffffff", opacity: 1, dashOn: true, fillId: "astryx.checkbox.states-indeterminate-enabled-boxFill", borderId: "astryx.checkbox.states-indeterminate-enabled-boxBorder", labelId: "astryx.checkbox.states-indeterminate-enabled-label", dashId: "astryx.checkbox.states-indeterminate-enabled-dashFill" },
  "indeterminate/true": { fill: "#0064e0ff", border: "#05365919", label: "#a4b0bcff", dash: "#ffffffff", opacity: 0.5, dashOn: true, fillId: "astryx.checkbox.states-indeterminate-disabled-boxFill", borderId: "astryx.checkbox.states-indeterminate-disabled-boxBorder", labelId: "astryx.checkbox.states-indeterminate-disabled-label", dashId: "astryx.checkbox.states-indeterminate-disabled-dashFill" },
};

let nextX = 0;
for (const child of page.children) {
  if (child.type === "SECTION") nextX = Math.max(nextX, child.x + child.width + 240);
}
const section = figma.createSection();
section.name = "Recipe Pivot / Astryx / e2386e0d";
section.x = nextX;
section.y = 0;
page.appendChild(section);
section.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
section.setSharedPluginData(NS, "recipeHash", recipeHash);
section.setSharedPluginData(NS, "variableCollectionId", collection.id);

const components = [];
for (const checked of ["unchecked", "checked", "indeterminate"]) {
  for (const disabled of ["false", "true"]) {
    const cell = states[checked + "/" + disabled];
    const component = figma.createComponent();
    component.clipsContent = false;
    component.name = "Checked=" + checked + ", Disabled=" + disabled;
    component.layoutMode = "HORIZONTAL";
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = "CENTER";
    component.itemSpacing = 8;
    component.paddingLeft = 0;
    component.paddingRight = 0;
    component.paddingTop = 0;
    component.paddingBottom = 0;
    component.fills = [];
    bindFloat(component, "itemSpacing", "astryx.checkbox.row-gap");
    section.appendChild(component);

    const hit = figma.createFrame();
    hit.name = "checkbox/hit";
    hit.layoutMode = "HORIZONTAL";
    hit.primaryAxisAlignItems = "CENTER";
    hit.counterAxisAlignItems = "CENTER";
    hit.itemSpacing = 0;
    hit.fills = [];
    hit.resizeWithoutConstraints(24, 24);
    hit.layoutSizingHorizontal = "FIXED";
    hit.layoutSizingVertical = "FIXED";
    bindFloat(hit, "width", "astryx.checkbox.wrapper-size");
    bindFloat(hit, "height", "astryx.checkbox.wrapper-size");
    component.appendChild(hit);

    const box = figma.createFrame();
    box.name = "checkbox/box";
    box.layoutMode = "HORIZONTAL";
    box.primaryAxisAlignItems = "CENTER";
    box.counterAxisAlignItems = "CENTER";
    box.itemSpacing = 0;
    box.opacity = cell.opacity;
    box.resizeWithoutConstraints(22, 22);
    box.layoutSizingHorizontal = "FIXED";
    box.layoutSizingVertical = "FIXED";
    box.fills = [bindColor(paint(cell.fill), cell.fillId)];
    box.strokes = [bindColor(paint(cell.border), cell.borderId)];
    box.strokeWeight = 1;
    box.strokeAlign = "INSIDE";
    box.topLeftRadius = 4;
    box.topRightRadius = 4;
    box.bottomRightRadius = 4;
    box.bottomLeftRadius = 4;
    bindFloat(box, "width", "astryx.checkbox.box-size");
    bindFloat(box, "height", "astryx.checkbox.box-size");
    bindFloat(box, "strokeWeight", "astryx.checkbox.box-borderWidth");
    bindFloat(box, "topLeftRadius", "astryx.checkbox.box-radius");
    bindFloat(box, "topRightRadius", "astryx.checkbox.box-radius");
    bindFloat(box, "bottomRightRadius", "astryx.checkbox.box-radius");
    bindFloat(box, "bottomLeftRadius", "astryx.checkbox.box-radius");
    hit.appendChild(box);

    const dash = figma.createFrame();
    dash.name = "checkbox/glyph/dash";
    dash.visible = cell.dashOn;
    dash.layoutMode = "HORIZONTAL";
    dash.resizeWithoutConstraints(12, 2);
    dash.layoutSizingHorizontal = "FIXED";
    dash.layoutSizingVertical = "FIXED";
    dash.fills = cell.dashId ? [bindColor(paint(cell.dash), cell.dashId)] : [paint(cell.dash)];
    dash.topLeftRadius = 1;
    dash.topRightRadius = 1;
    dash.bottomRightRadius = 1;
    dash.bottomLeftRadius = 1;
    bindFloat(dash, "width", "astryx.checkbox.dash-width");
    bindFloat(dash, "height", "astryx.checkbox.dash-height");
    box.appendChild(dash);

    const label = figma.createText();
    label.fontName = found.fontName;
    label.characters = "Accept terms";
    label.fontSize = 14;
    label.lineHeight = { unit: "AUTO" };
    label.textAlignHorizontal = "LEFT";
    label.textAlignVertical = "CENTER";
    label.textAutoResize = "WIDTH_AND_HEIGHT";
    if (label.characters.trim().length > 0 && (label.width <= 0 || label.absoluteRenderBounds === null)) {
      let painted = false;
      for (const candidate of fontSpec.fallbackChain) {
        if (candidate.family === fontSpec.resolvedFamily && candidate.style === fontSpec.resolvedStyle) continue;
        const next = allFonts.find((entry) => entry.fontName.family === candidate.family && entry.fontName.style === candidate.style);
        if (!next) continue;
        await figma.loadFontAsync(next.fontName);
        label.fontName = next.fontName;
        label.characters = "Accept terms";
        if (label.width > 0 && label.absoluteRenderBounds) {
          painted = true;
          break;
        }
      }
      if (!painted && (label.width <= 0 || label.absoluteRenderBounds === null))
        throw new Error("CHECKBOX-FONT-ZERO-INTRINSIC:checkbox/label");
    }
    if (label.width <= 0 || label.height <= 0) throw new Error("CHECKBOX-TEXT-GEOMETRY:checkbox/label");
    label.name =
      "checkbox/label :: font-provenance=" +
      encodeURIComponent(JSON.stringify({ ...fontSpec, degradation: "source -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; Figma cannot load a CSS stack; first named host font is SF Pro Medium" }));
    label.fills = [bindColor(paint(cell.label), cell.labelId)];
    bindFloat(label, "fontSize", "astryx.checkbox.labelFontSize");
    component.appendChild(label);
    component.layoutSizingHorizontal = "HUG";
    component.layoutSizingVertical = "HUG";
    if (component.layoutMode !== "HORIZONTAL") throw new Error("CHECKBOX-FAKE-LAYOUT:" + component.name);
    components.push(component);
  }
}

const set = figma.combineAsVariants(components, section);
set.name = "checkbox/set :: Astryx CheckboxInput";
set.description = "Experimental checkbox@1 primitive-IR mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
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
};
