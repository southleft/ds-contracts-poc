if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.tabs.recipe.v1";
const runIdentity = "34d1e257-b5d949f6-20e72946-tabs-v1";
const pageName = "Recipe Pivot / Tabs / 34d1e257-b5d949f6-20e72946-tabs-v1";
const adapterIdentity = "astryx-tabs-reviewed-v1";
const recipeHash = "34d1e257dc51c92d9f31c7198f029bf975f78f8b55df19b100e91e64cdd6f19d";
const envelopeHash = "b75718880587bcd2decbb1d8ac38d89cd49435d4888250b52ce360bb40e7e6a1";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302","183:75495","183:75801","183:75976","183:76022","183:76063","183:76109","183:76151"];
await figma.loadAllPagesAsync();
const page = figma.root.children.find((candidate) => candidate.name === pageName);
if (!page) throw new Error("TABS-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("TABS-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("TABS-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (signed.includes(figma.currentPage.id)) throw new Error("TABS-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
if (page.children.some((node) => node.type === "SECTION" && node.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("TABS-SECTION-EXISTS:" + adapterIdentity);

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
  if (!found) throw new Error("TABS-FONT-UNAVAILABLE:" + spec.requestedFamily + ":" + spec.requestedStyle);
  if (found.fontName.family !== spec.resolvedFamily || found.fontName.style !== spec.resolvedStyle)
    throw new Error("TABS-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
  await figma.loadFontAsync(found.fontName);
  return { spec, found: found.fontName, painted: found.fontName };
};
const restResolved = await resolvePainted({"requestedFamily":"-apple-system","requestedStyle":"Regular","resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}],"degradation":"source -apple-system Regular; Figma cannot load a CSS stack; first named host font is SF Pro Regular"});
const selectedResolved = await resolvePainted({"requestedFamily":"-apple-system","requestedStyle":"Semibold","resolvedFamily":"SF Pro","resolvedStyle":"Semibold","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Semibold"},{"family":"SF Pro","style":"Semibold"},{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"degradation":"source -apple-system Semibold; Figma cannot load a CSS stack; first named host font is SF Pro Semibold"});

const collectionName = "Recipe Tabs / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((collection) => collection.name === collectionName)) throw new Error("TABS-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = "astryx.tabs";
const planned = [["FLOAT","astryx.tabs.list-itemSpacing",2],["FLOAT","astryx.tabs.tab-paddingX",12],["FLOAT","astryx.tabs.tab-paddingY",0],["FLOAT","astryx.tabs.tab-radius",8],["COLOR","astryx.tabs.tab-fill","#00000000"],["FLOAT","astryx.tabs.indicator-height",2],["FLOAT","astryx.tabs.indicator-radius",9999],["COLOR","astryx.tabs.indicator-fill","#0064e0ff"],["FLOAT","astryx.tabs.labelFontSize",14],["FLOAT","astryx.tabs.labelLineHeight",20],["COLOR","astryx.tabs.rest-label","#4e606fff"],["COLOR","astryx.tabs.selected-label","#0a1317ff"]];
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
const geom = {"labelFontSize":14,"labelLineHeight":20,"lineHeightUnit":"PIXELS","textCase":"ORIGINAL","selected":"Item One","rest":"Item Two","list":{"itemSpacing":2},"tab":{"paddingX":12,"paddingY":0,"radius":8,"minWidth":0,"minHeight":0,"fill":"#00000000"},"indicator":{"height":2,"radius":9999,"opacity":1,"fill":"#0064e0ff"},"colors":{"rest":"#4e606fff","selected":"#0a1317ff"},"componentLabel":"Astryx TabList"};

const paintText = async (resolved, characters, colorIdentity) => {
  const node = figma.createText();
  node.fontName = resolved.painted;
  node.characters = characters;
  node.fontSize = geom.labelFontSize;
  node.lineHeight = geom.lineHeightUnit === "AUTO" ? { unit: "AUTO" } : geom.lineHeightUnit === "PERCENT" ? { unit: "PERCENT", value: geom.labelLineHeight } : { unit: "PIXELS", value: geom.labelLineHeight };
  node.textCase = geom.textCase;
  node.textAlignHorizontal = "CENTER";
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
      throw new Error("TABS-FONT-ZERO-INTRINSIC");
  }
  if (node.width <= 0 || node.height <= 0) throw new Error("TABS-TEXT-GEOMETRY");
  node.fills = [bindColor(paint(colorIdentity === "selected" ? geom.colors.selected : geom.colors.rest), prefix + "." + colorIdentity + "-label")];
  bindFloat(node, "fontSize", prefix + ".labelFontSize");
  if (geom.lineHeightUnit !== "AUTO") bindFloat(node, "lineHeight", prefix + ".labelLineHeight");
  return node;
};

const applyTabChrome = (item) => {
  item.clipsContent = false;
  item.layoutMode = "VERTICAL";
  item.primaryAxisAlignItems = "MIN";
  item.counterAxisAlignItems = "MIN";
  item.itemSpacing = 0;
  item.paddingTop = geom.tab.paddingY;
  item.paddingRight = geom.tab.paddingX;
  item.paddingBottom = geom.tab.paddingY;
  item.paddingLeft = geom.tab.paddingX;
  item.fills = [bindColor(paint(geom.tab.fill), prefix + ".tab-fill")];
  item.topLeftRadius = geom.tab.radius;
  item.topRightRadius = geom.tab.radius;
  item.bottomRightRadius = geom.tab.radius;
  item.bottomLeftRadius = geom.tab.radius;
  bindFloat(item, "paddingTop", prefix + ".tab-paddingY");
  bindFloat(item, "paddingRight", prefix + ".tab-paddingX");
  bindFloat(item, "paddingBottom", prefix + ".tab-paddingY");
  bindFloat(item, "paddingLeft", prefix + ".tab-paddingX");
  bindFloat(item, "topLeftRadius", prefix + ".tab-radius");
  bindFloat(item, "topRightRadius", prefix + ".tab-radius");
  bindFloat(item, "bottomRightRadius", prefix + ".tab-radius");
  bindFloat(item, "bottomLeftRadius", prefix + ".tab-radius");
  if (geom.tab.minWidth > 0) {
    item.minWidth = geom.tab.minWidth;
    bindFloat(item, "minWidth", prefix + ".tab-minWidth");
  }
  if (geom.tab.minHeight > 0) {
    item.minHeight = geom.tab.minHeight;
    bindFloat(item, "minHeight", prefix + ".tab-minHeight");
  }
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

const component = figma.createComponent();
component.clipsContent = false;
component.name = "tabs/variant/default :: " + geom.componentLabel;
component.description = "Experimental tabs@1 rail mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
component.layoutMode = "HORIZONTAL";
component.primaryAxisAlignItems = "MIN";
component.counterAxisAlignItems = "MAX";
component.itemSpacing = geom.list.itemSpacing;
component.paddingTop = 0;
component.paddingRight = 0;
component.paddingBottom = 0;
component.paddingLeft = 0;
component.fills = [];
bindFloat(component, "itemSpacing", prefix + ".list-itemSpacing");
section.appendChild(component);

const selectedItem = figma.createFrame();
selectedItem.name = "tabs/item/selected";
applyTabChrome(selectedItem);
component.appendChild(selectedItem);
const selectedLabel = await paintText(selectedResolved, geom.selected, "selected");
selectedLabel.name = "tabs/label :: font-provenance=" + encodeURIComponent(JSON.stringify(selectedResolved.spec));
selectedItem.appendChild(selectedLabel);
selectedItem.layoutSizingHorizontal = "HUG";
selectedItem.layoutSizingVertical = "HUG";
const indicator = figma.createFrame();
indicator.name = "tabs/indicator";
indicator.opacity = geom.indicator.opacity;
indicator.layoutMode = "HORIZONTAL";
indicator.primaryAxisAlignItems = "MIN";
indicator.counterAxisAlignItems = "MIN";
indicator.itemSpacing = 0;
indicator.paddingTop = 0;
indicator.paddingRight = 0;
indicator.paddingBottom = 0;
indicator.paddingLeft = 0;
indicator.resizeWithoutConstraints(Math.max(selectedItem.width, 1), geom.indicator.height);
indicator.fills = [bindColor(paint(geom.indicator.fill), prefix + ".indicator-fill")];
indicator.topLeftRadius = geom.indicator.radius;
indicator.topRightRadius = geom.indicator.radius;
indicator.bottomRightRadius = geom.indicator.radius;
indicator.bottomLeftRadius = geom.indicator.radius;
bindFloat(indicator, "height", prefix + ".indicator-height");
bindFloat(indicator, "topLeftRadius", prefix + ".indicator-radius");
bindFloat(indicator, "topRightRadius", prefix + ".indicator-radius");
bindFloat(indicator, "bottomRightRadius", prefix + ".indicator-radius");
bindFloat(indicator, "bottomLeftRadius", prefix + ".indicator-radius");
selectedItem.appendChild(indicator);
indicator.layoutSizingHorizontal = "FILL";
indicator.layoutSizingVertical = "FIXED";

const restItem = figma.createFrame();
restItem.name = "tabs/item/rest";
applyTabChrome(restItem);
component.appendChild(restItem);
const restLabel = await paintText(restResolved, geom.rest, "rest");
restLabel.name = "tabs/label :: font-provenance=" + encodeURIComponent(JSON.stringify(restResolved.spec));
restItem.appendChild(restLabel);
restItem.layoutSizingHorizontal = "HUG";
restItem.layoutSizingVertical = "HUG";

component.layoutSizingHorizontal = "HUG";
component.layoutSizingVertical = "HUG";
if (component.layoutMode !== "HORIZONTAL") throw new Error("TABS-FAKE-LAYOUT:" + component.name);

const container = figma.createFrame();
container.name = "Component Container";
container.layoutMode = "NONE";
container.fills = [];
container.x = 80;
container.y = 96;
section.appendChild(container);
container.appendChild(component);
container.setSharedPluginData(NS, "runIdentity", runIdentity);
container.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
container.setSharedPluginData(NS, "recipeHash", recipeHash);
container.setSharedPluginData(NS, "ownershipKey", "tabs/container");
component.setSharedPluginData(NS, "runIdentity", runIdentity);
component.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
component.setSharedPluginData(NS, "recipeHash", recipeHash);
component.setSharedPluginData(NS, "envelopeHash", envelopeHash);
component.setSharedPluginData(NS, "ownershipKey", "tabs");
section.resizeWithoutConstraints(container.width + 160, container.y + container.height + 80);
return {
  pageId: page.id,
  pageName: page.name,
  sectionId: section.id,
  componentId: component.id,
  containerId: container.id,
  collectionId: collection.id,
  variantCount: 1,
  adapterIdentity,
  recipeHash,
  paintedSelectedFont: selectedResolved.painted,
  paintedRestFont: restResolved.painted,
};
