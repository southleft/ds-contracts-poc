if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.badge.recipe.v1";
const runIdentity = "65cbfe82-5db99b22-badge-v2";
const pageName = "Recipe Pivot / Badge / 65cbfe82-5db99b22-badge-v2";
const adapterIdentity = "antd-badge-reviewed-v1";
const recipeHash = "5db99b22905d0296a757db8cd6fe04f51bbeeb6f6d586854cf4b35ee1ef8839d";
const envelopeHash = "0a223fe7dc9223f870622ac7037f31757dc9667b43d01968694a863f85f35c1d";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302","183:75495","183:75801","183:75976","183:76022","196:76370","197:76679","197:76903","198:77048"];
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
const labelResolved = await resolvePainted({"requestedFamily":"-apple-system","requestedStyle":"Regular","resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica Neue","style":"Regular"},{"family":"Arial","style":"Regular"}],"degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular"});

const collectionName = "Recipe Badge / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((collection) => collection.name === collectionName)) throw new Error("BADGE-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = "antd.badge";
const planned = [["FLOAT","antd.badge.host-size",32],["FLOAT","antd.badge.host-radius",16],["COLOR","antd.badge.host-fill","#00000040"],["FLOAT","antd.badge.indicator-height",20],["FLOAT","antd.badge.indicator-minWidth",20],["FLOAT","antd.badge.indicator-paddingX",0],["FLOAT","antd.badge.indicator-radius",10],["FLOAT","antd.badge.indicator-borderWidth",1],["COLOR","antd.badge.indicator-fill","#ff4d4fff"],["COLOR","antd.badge.indicator-border","#ffffffff"],["FLOAT","antd.badge.labelFontSize",12],["FLOAT","antd.badge.labelLineHeight",20],["COLOR","antd.badge.label","#ffffffff"]];
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
const geom = {"host":{"size":32,"radius":16,"fill":"#00000040"},"indicator":{"height":20,"minWidth":20,"paddingX":0,"radius":10,"borderWidth":1,"translateX":10,"translateY":-10,"fill":"#ff4d4fff","border":"#ffffffff"},"labelFontSize":12,"labelLineHeight":20,"strokeAlign":"OUTSIDE","count":"5","label":"#ffffffff","componentLabel":"Ant Design Badge"};

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
section.name = "Recipe Pivot / Ant Design / " + recipeHash.slice(0, 8);
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
indicator.strokeAlign = "OUTSIDE";
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
container.name = "Arrange / Badge / Ant Design / " + runIdentity;
container.layoutMode = "VERTICAL";
container.paddingTop = 40;
container.paddingRight = 40;
container.paddingBottom = 40;
container.paddingLeft = 40;
container.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
container.topLeftRadius = 8;
container.topRightRadius = 8;
container.bottomRightRadius = 8;
container.bottomLeftRadius = 8;
container.clipsContent = false;
container.x = 40;
container.y = 40;
section.appendChild(container);
container.appendChild(component);
container.layoutSizingHorizontal = "HUG";
container.layoutSizingVertical = "HUG";
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
