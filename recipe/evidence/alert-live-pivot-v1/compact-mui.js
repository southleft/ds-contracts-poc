if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.alert.recipe.v1";
const runIdentity = "dfe6ebb7-72aeb8dc-f5f066f4-alert-v1";
const pageName = "Recipe Pivot / Alert / dfe6ebb7-72aeb8dc-f5f066f4-alert-v1";
const adapterIdentity = "mui-alert-reviewed-v1";
const recipeHash = "72aeb8dc0adc7ba0fa3cc6c11d306fe5b265bf45ea5f936618d859dfbeb68c3a";
const envelopeHash = "93ffe2f7320ffcbe9b775fd2bb4cbc9bb005883ee4b96ef5aba3c6a70c5b552a";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302","183:75495"];
await figma.loadAllPagesAsync();
const page = figma.root.children.find((candidate) => candidate.name === pageName);
if (!page) throw new Error("ALERT-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("ALERT-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("ALERT-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (signed.includes(figma.currentPage.id)) throw new Error("ALERT-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
if (page.children.some((node) => node.type === "SECTION" && node.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("ALERT-SECTION-EXISTS:" + adapterIdentity);

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
const resolvePainted = async (spec) => {
  const found = spec.fallbackChain
    .map((candidate) => allFonts.find((font) => font.fontName.family === candidate.family && font.fontName.style === candidate.style))
    .find(Boolean);
  if (!found) throw new Error("ALERT-FONT-UNAVAILABLE:" + spec.requestedFamily + ":" + spec.requestedStyle);
  if (found.fontName.family !== spec.resolvedFamily || found.fontName.style !== spec.resolvedStyle)
    throw new Error("ALERT-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
  await figma.loadFontAsync(found.fontName);
  return { spec, found: found.fontName, painted: found.fontName };
};
const titleResolved = await resolvePainted({"requestedFamily":"Roboto","requestedStyle":"Regular","resolvedFamily":"Roboto","resolvedStyle":"Regular","resolution":"requested","fallbackChain":[{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}]});

const collectionName = "Recipe Alert / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((collection) => collection.name === collectionName)) throw new Error("ALERT-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = "mui.alert";
const planned = [["FLOAT","mui.alert.box-height",48],["FLOAT","mui.alert.box-paddingX",16],["FLOAT","mui.alert.box-paddingY",6],["FLOAT","mui.alert.box-radius",4],["FLOAT","mui.alert.box-borderWidth",0],["FLOAT","mui.alert.box-gap",12],["FLOAT","mui.alert.icon-size",22],["FLOAT","mui.alert.titleFontSize",14],["FLOAT","mui.alert.titleLineHeight",20],["COLOR","mui.alert.states-info-boxFill","#e5f6fdff"],["COLOR","mui.alert.states-info-boxBorder","#00000000"],["COLOR","mui.alert.states-info-title","#014361ff"],["COLOR","mui.alert.states-info-iconFill","#0288d1ff"],["COLOR","mui.alert.states-success-boxFill","#edf7edff"],["COLOR","mui.alert.states-success-boxBorder","#00000000"],["COLOR","mui.alert.states-success-title","#1e4620ff"],["COLOR","mui.alert.states-success-iconFill","#2e7d32ff"],["COLOR","mui.alert.states-warning-boxFill","#fff4e5ff"],["COLOR","mui.alert.states-warning-boxBorder","#00000000"],["COLOR","mui.alert.states-warning-title","#663c00ff"],["COLOR","mui.alert.states-warning-iconFill","#ed6c02ff"],["COLOR","mui.alert.states-error-boxFill","#fdededff"],["COLOR","mui.alert.states-error-boxBorder","#00000000"],["COLOR","mui.alert.states-error-title","#5f2120ff"],["COLOR","mui.alert.states-error-iconFill","#d32f2fff"]];
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
const geom = {"box":{"height":48,"paddingX":16,"paddingY":6,"radius":4,"borderWidth":0,"gap":12},"iconSize":22,"titleFontSize":14,"titleLineHeight":20,"strokeAlign":"INSIDE","title":"New update available","cells":{"info":{"boxFill":"#e5f6fdff","boxBorder":"#00000000","title":"#014361ff","iconFill":"#0288d1ff","iconOpacity":0.9},"success":{"boxFill":"#edf7edff","boxBorder":"#00000000","title":"#1e4620ff","iconFill":"#2e7d32ff","iconOpacity":0.9},"warning":{"boxFill":"#fff4e5ff","boxBorder":"#00000000","title":"#663c00ff","iconFill":"#ed6c02ff","iconOpacity":0.9},"error":{"boxFill":"#fdededff","boxBorder":"#00000000","title":"#5f2120ff","iconFill":"#d32f2fff","iconOpacity":0.9}}};

const paintText = async (resolved, characters, fontSize, lineHeight) => {
  const node = figma.createText();
  node.fontName = resolved.painted;
  node.characters = characters;
  node.fontSize = fontSize;
  node.lineHeight = { unit: "PIXELS", value: lineHeight };
  node.textAlignHorizontal = "LEFT";
  node.textAlignVertical = "CENTER";
  node.textAutoResize = "WIDTH_AND_HEIGHT";
  if (node.characters.trim().length > 0 && (node.width <= 0 || node.absoluteRenderBounds === null)) {
    let ok = false;
    for (const candidate of resolved.spec.fallbackChain) {
      if (candidate.family === resolved.spec.resolvedFamily && candidate.style === resolved.spec.resolvedStyle) continue;
      const next = allFonts.find((entry) => entry.fontName.family === candidate.family && entry.fontName.style === candidate.style);
      if (!next) continue;
      await figma.loadFontAsync(next.fontName);
      node.fontName = next.fontName;
      node.characters = characters;
      if (node.width > 0 && node.absoluteRenderBounds) {
        resolved.painted = next.fontName;
        ok = true;
        break;
      }
    }
    if (!ok && (node.width <= 0 || node.absoluteRenderBounds === null))
      throw new Error("ALERT-FONT-ZERO-INTRINSIC");
  }
  if (node.width <= 0 || node.height <= 0) throw new Error("ALERT-TEXT-GEOMETRY");
  return node;
};

let nextX = 0;
for (const child of page.children) {
  if (child.type === "SECTION") nextX = Math.max(nextX, child.x + child.width + 240);
}
const section = figma.createSection();
section.name = "Recipe Pivot / MUI / " + recipeHash.slice(0, 8);
section.x = nextX;
section.y = 0;
page.appendChild(section);
section.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
section.setSharedPluginData(NS, "recipeHash", recipeHash);
section.setSharedPluginData(NS, "variableCollectionId", collection.id);

const components = [];
for (const status of ["info", "success", "warning", "error"]) {
  const cell = geom.cells[status];
  const component = figma.createComponent();
  component.clipsContent = false;
  component.name = "Status=" + status;
  component.layoutMode = "HORIZONTAL";
  component.primaryAxisAlignItems = "MIN";
  component.counterAxisAlignItems = "CENTER";
  component.itemSpacing = geom.box.gap;
  component.paddingTop = geom.box.paddingY;
  component.paddingRight = geom.box.paddingX;
  component.paddingBottom = geom.box.paddingY;
  component.paddingLeft = geom.box.paddingX;
  component.fills = [bindColor(paint(cell.boxFill), prefix + ".states-" + status + "-boxFill")];
  component.strokes = [bindColor(paint(cell.boxBorder), prefix + ".states-" + status + "-boxBorder")];
  component.strokeWeight = geom.box.borderWidth;
  component.strokeAlign = "INSIDE";
  component.topLeftRadius = geom.box.radius;
  component.topRightRadius = geom.box.radius;
  component.bottomRightRadius = geom.box.radius;
  component.bottomLeftRadius = geom.box.radius;
  component.resizeWithoutConstraints(Math.max(component.width, 1), geom.box.height);
  bindFloat(component, "height", prefix + ".box-height");
  bindFloat(component, "itemSpacing", prefix + ".box-gap");
  bindFloat(component, "paddingTop", prefix + ".box-paddingY");
  bindFloat(component, "paddingRight", prefix + ".box-paddingX");
  bindFloat(component, "paddingBottom", prefix + ".box-paddingY");
  bindFloat(component, "paddingLeft", prefix + ".box-paddingX");
  bindFloat(component, "strokeWeight", prefix + ".box-borderWidth");
  bindFloat(component, "topLeftRadius", prefix + ".box-radius");
  bindFloat(component, "topRightRadius", prefix + ".box-radius");
  bindFloat(component, "bottomRightRadius", prefix + ".box-radius");
  bindFloat(component, "bottomLeftRadius", prefix + ".box-radius");
  section.appendChild(component);

  const icon = figma.createFrame();
  icon.name = "alert/icon";
  icon.layoutMode = "HORIZONTAL";
  icon.primaryAxisAlignItems = "CENTER";
  icon.counterAxisAlignItems = "CENTER";
  icon.itemSpacing = 0;
  icon.opacity = cell.iconOpacity;
  icon.resizeWithoutConstraints(geom.iconSize, geom.iconSize);
  icon.layoutSizingHorizontal = "FIXED";
  icon.layoutSizingVertical = "FIXED";
  icon.fills = [bindColor(paint(cell.iconFill), prefix + ".states-" + status + "-iconFill")];
  icon.topLeftRadius = geom.iconSize / 2;
  icon.topRightRadius = geom.iconSize / 2;
  icon.bottomRightRadius = geom.iconSize / 2;
  icon.bottomLeftRadius = geom.iconSize / 2;
  bindFloat(icon, "width", prefix + ".icon-size");
  bindFloat(icon, "height", prefix + ".icon-size");
  component.appendChild(icon);

  const title = await paintText(titleResolved, geom.title, geom.titleFontSize, geom.titleLineHeight);
  title.name = "alert/title :: font-provenance=" + encodeURIComponent(JSON.stringify(titleResolved.spec));
  title.fills = [bindColor(paint(cell.title), prefix + ".states-" + status + "-title")];
  bindFloat(title, "fontSize", prefix + ".titleFontSize");
  bindFloat(title, "lineHeight", prefix + ".titleLineHeight");
  component.appendChild(title);

  component.layoutSizingHorizontal = "HUG";
  component.layoutSizingVertical = "FIXED";
  if (component.layoutMode !== "HORIZONTAL") throw new Error("ALERT-FAKE-LAYOUT:" + component.name);
  components.push(component);
}
const set = figma.combineAsVariants(components, section);
set.name = "alert/set :: MUI Alert";
set.description = "Experimental alert@1 primitive-IR mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
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
  paintedTitleFont: titleResolved.painted,
};
