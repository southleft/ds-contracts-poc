if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.badge.recipe.v1";
const runIdentity = "cd44cf69-5db99b22-badge-v1";
const pageName = "Recipe Pivot / Badge / cd44cf69-5db99b22-badge-v1";
const adapterIdentity = "mui-badge-reviewed-v1";
const recipeHash = "cd44cf693b98f6206d5c66eaadbf7bed576ff35d6d84989b7aca70afd4ba0366";
const envelopeHash = "4eb410032c3621485ca6f294f5d35271de0147423517c31795e6b47fada1e119";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302","183:75495","183:75801","183:75976"];
await figma.loadAllPagesAsync();
const page = figma.root.children.find((candidate) => candidate.name === pageName);
if (!page) throw new Error("BADGE-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("BADGE-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("BADGE-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (signed.includes(figma.currentPage.id)) throw new Error("BADGE-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
if (page.children.some((node) => node.type === "SECTION" && node.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("BADGE-SECTION-EXISTS:" + adapterIdentity);

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
  if (!found) throw new Error("BADGE-FONT-UNAVAILABLE:" + spec.requestedFamily + ":" + spec.requestedStyle);
  if (found.fontName.family !== spec.resolvedFamily || found.fontName.style !== spec.resolvedStyle)
    throw new Error("BADGE-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
  await figma.loadFontAsync(found.fontName);
  return { spec, found: found.fontName, painted: found.fontName };
};
const labelResolved = await resolvePainted({"requestedFamily":"Roboto","requestedStyle":"Medium","resolvedFamily":"Roboto","resolvedStyle":"Medium","resolution":"requested","fallbackChain":[{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}]});

const collectionName = "Recipe Badge / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((collection) => collection.name === collectionName)) throw new Error("BADGE-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = "mui.badge";
const planned = [["FLOAT","mui.badge.host-size",40],["FLOAT","mui.badge.host-radius",20],["COLOR","mui.badge.host-fill","#bdbdbdff"],["FLOAT","mui.badge.indicator-height",20],["FLOAT","mui.badge.indicator-minWidth",20],["FLOAT","mui.badge.indicator-paddingX",6],["FLOAT","mui.badge.indicator-radius",10],["FLOAT","mui.badge.indicator-borderWidth",0],["COLOR","mui.badge.indicator-fill","#00000000"],["COLOR","mui.badge.indicator-border","#00000000"],["FLOAT","mui.badge.labelFontSize",12],["FLOAT","mui.badge.labelLineHeight",12],["COLOR","mui.badge.label","#000000de"]];
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
const geom = {"host":{"size":40,"radius":20,"fill":"#bdbdbdff"},"indicator":{"height":20,"minWidth":20,"paddingX":6,"radius":10,"borderWidth":0,"translateX":10,"translateY":-10,"fill":"#00000000","border":"#00000000"},"labelFontSize":12,"labelLineHeight":12,"strokeAlign":"INSIDE","count":"5","label":"#000000de","componentLabel":"MUI Badge"};

const paintText = async (resolved, characters, fontSize, lineHeight) => {
  const node = figma.createText();
  node.fontName = resolved.painted;
  node.characters = characters;
  node.fontSize = fontSize;
  node.lineHeight = { unit: "PIXELS", value: lineHeight };
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
      throw new Error("BADGE-FONT-ZERO-INTRINSIC");
  }
  if (node.width <= 0 || node.height <= 0) throw new Error("BADGE-TEXT-GEOMETRY");
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

const component = figma.createComponent();
component.clipsContent = false;
component.name = "badge/variant/default :: " + geom.componentLabel;
component.description = "Experimental badge@1 overlay mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
component.layoutMode = "HORIZONTAL";
component.primaryAxisAlignItems = "MIN";
component.counterAxisAlignItems = "MIN";
component.itemSpacing = 0;
component.paddingTop = 0;
component.paddingRight = 0;
component.paddingBottom = 0;
component.paddingLeft = 0;
component.fills = [];
section.appendChild(component);

const host = figma.createFrame();
host.name = "badge/host";
host.layoutMode = "HORIZONTAL";
host.primaryAxisAlignItems = "CENTER";
host.counterAxisAlignItems = "CENTER";
host.itemSpacing = 0;
host.resizeWithoutConstraints(geom.host.size, geom.host.size);
host.layoutSizingHorizontal = "FIXED";
host.layoutSizingVertical = "FIXED";
host.fills = [bindColor(paint(geom.host.fill), prefix + ".host-fill")];
host.topLeftRadius = geom.host.radius;
host.topRightRadius = geom.host.radius;
host.bottomRightRadius = geom.host.radius;
host.bottomLeftRadius = geom.host.radius;
bindFloat(host, "width", prefix + ".host-size");
bindFloat(host, "height", prefix + ".host-size");
bindFloat(host, "topLeftRadius", prefix + ".host-radius");
bindFloat(host, "topRightRadius", prefix + ".host-radius");
bindFloat(host, "bottomRightRadius", prefix + ".host-radius");
bindFloat(host, "bottomLeftRadius", prefix + ".host-radius");
component.appendChild(host);

const indicator = figma.createFrame();
indicator.name = "badge/indicator";
indicator.layoutMode = "HORIZONTAL";
indicator.primaryAxisAlignItems = "CENTER";
indicator.counterAxisAlignItems = "CENTER";
indicator.itemSpacing = 0;
indicator.paddingTop = 0;
indicator.paddingRight = geom.indicator.paddingX;
indicator.paddingBottom = 0;
indicator.paddingLeft = geom.indicator.paddingX;
indicator.minWidth = geom.indicator.minWidth;
indicator.resizeWithoutConstraints(Math.max(geom.indicator.minWidth, 1), geom.indicator.height);
indicator.fills = [bindColor(paint(geom.indicator.fill), prefix + ".indicator-fill")];
indicator.strokes = [bindColor(paint(geom.indicator.border), prefix + ".indicator-border")];
indicator.strokeWeight = geom.indicator.borderWidth;
indicator.strokeAlign = "INSIDE";
indicator.topLeftRadius = geom.indicator.radius;
indicator.topRightRadius = geom.indicator.radius;
indicator.bottomRightRadius = geom.indicator.radius;
indicator.bottomLeftRadius = geom.indicator.radius;
bindFloat(indicator, "height", prefix + ".indicator-height");
bindFloat(indicator, "paddingRight", prefix + ".indicator-paddingX");
bindFloat(indicator, "paddingLeft", prefix + ".indicator-paddingX");
bindFloat(indicator, "strokeWeight", prefix + ".indicator-borderWidth");
bindFloat(indicator, "topLeftRadius", prefix + ".indicator-radius");
bindFloat(indicator, "topRightRadius", prefix + ".indicator-radius");
bindFloat(indicator, "bottomRightRadius", prefix + ".indicator-radius");
bindFloat(indicator, "bottomLeftRadius", prefix + ".indicator-radius");
component.appendChild(indicator);

const label = await paintText(labelResolved, geom.count, geom.labelFontSize, geom.labelLineHeight);
label.name = "badge/label :: font-provenance=" + encodeURIComponent(JSON.stringify(labelResolved.spec));
label.fills = [bindColor(paint(geom.label), prefix + ".label")];
bindFloat(label, "fontSize", prefix + ".labelFontSize");
bindFloat(label, "lineHeight", prefix + ".labelLineHeight");
indicator.appendChild(label);
indicator.layoutSizingHorizontal = "HUG";
indicator.layoutSizingVertical = "FIXED";
indicator.layoutPositioning = "ABSOLUTE";
indicator.constraints = { horizontal: "MAX", vertical: "MIN" };
indicator.x = host.width - indicator.width + geom.indicator.translateX;
indicator.y = geom.indicator.translateY;

component.layoutSizingHorizontal = "HUG";
component.layoutSizingVertical = "HUG";
if (component.layoutMode !== "HORIZONTAL") throw new Error("BADGE-FAKE-LAYOUT:" + component.name);

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
container.setSharedPluginData(NS, "ownershipKey", "badge/container");
component.setSharedPluginData(NS, "runIdentity", runIdentity);
component.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
component.setSharedPluginData(NS, "recipeHash", recipeHash);
component.setSharedPluginData(NS, "envelopeHash", envelopeHash);
component.setSharedPluginData(NS, "ownershipKey", "badge");
section.resizeWithoutConstraints(Math.max(container.width, host.width + 40) + 160, container.y + Math.max(container.height, host.height + 40) + 80);
return {
  pageId: page.id,
  pageName: page.name,
  sectionId: section.id,
  componentId: component.id,
  containerId: container.id,
  hostId: host.id,
  indicatorId: indicator.id,
  collectionId: collection.id,
  variantCount: 1,
  adapterIdentity,
  recipeHash,
  paintedLabelFont: labelResolved.painted,
};
