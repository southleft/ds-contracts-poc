if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.link.recipe.v1";
const runIdentity = "be7109bb-d810f4f2-7a6db373-link-v1";
const pageName = "Recipe Pivot / Link / be7109bb-d810f4f2-7a6db373-link-v1";
const adapterIdentity = "antd-link-reviewed-v1";
const recipeHash = "7a6db373f013e947a24da7657db1cf24fcb23cd293eda633ced5a84532aa2399";
const envelopeHash = "728c97a04ae0875d91833b5a91467a7f98dbd8ffc421a13dd990e7a861d9db04";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302","183:75495","183:75801","183:75976","183:76022","183:76063"];
await figma.loadAllPagesAsync();
const page = figma.root.children.find((candidate) => candidate.name === pageName);
if (!page) throw new Error("LINK-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("LINK-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("LINK-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (signed.includes(figma.currentPage.id)) throw new Error("LINK-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
if (page.children.some((node) => node.type === "SECTION" && node.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("LINK-SECTION-EXISTS:" + adapterIdentity);

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
  if (!found) throw new Error("LINK-FONT-UNAVAILABLE:" + spec.requestedFamily + ":" + spec.requestedStyle);
  if (found.fontName.family !== spec.resolvedFamily || found.fontName.style !== spec.resolvedStyle)
    throw new Error("LINK-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
  await figma.loadFontAsync(found.fontName);
  return { spec, found: found.fontName, painted: found.fontName };
};
const labelResolved = await resolvePainted({"requestedFamily":"-apple-system","requestedStyle":"Regular","resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica Neue","style":"Regular"},{"family":"Arial","style":"Regular"}],"degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular"});

const collectionName = "Recipe Link / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((collection) => collection.name === collectionName)) throw new Error("LINK-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = "antd.link";
const planned = [["FLOAT","antd.link.box-paddingX",0],["FLOAT","antd.link.box-paddingY",0],["FLOAT","antd.link.box-radius",0],["FLOAT","antd.link.box-borderWidth",0],["FLOAT","antd.link.labelFontSize",14],["FLOAT","antd.link.labelLineHeight",22],["COLOR","antd.link.rest-boxFill","#00000000"],["COLOR","antd.link.rest-boxBorder","#00000000"],["COLOR","antd.link.rest-label","#1677ffff"]];
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
const geom = {"labelFontSize":14,"labelLineHeight":22,"lineHeightUnit":"PIXELS","decoration":"NONE","label":"Link","rest":{"boxFill":"#00000000","boxBorder":"#00000000","boxOpacity":1,"label":"#1677ffff"},"componentLabel":"Ant Design Typography.Link"};

const paintText = async (resolved, characters, fontSize, lineHeight, lineHeightUnit, decoration) => {
  const node = figma.createText();
  node.fontName = resolved.painted;
  node.characters = characters;
  node.fontSize = fontSize;
  node.lineHeight = lineHeightUnit === "AUTO" ? { unit: "AUTO" } : { unit: "PIXELS", value: lineHeight };
  node.textDecoration = decoration;
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
      throw new Error("LINK-FONT-ZERO-INTRINSIC");
  }
  if (node.width <= 0 || node.height <= 0) throw new Error("LINK-TEXT-GEOMETRY");
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
component.name = "link/variant/default :: " + geom.componentLabel;
component.description = "Experimental link@1 inline-text mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
component.opacity = geom.rest.boxOpacity;
component.layoutMode = "HORIZONTAL";
component.primaryAxisAlignItems = "MIN";
component.counterAxisAlignItems = "CENTER";
component.itemSpacing = 0;
component.paddingTop = 0;
component.paddingRight = 0;
component.paddingBottom = 0;
component.paddingLeft = 0;
component.fills = [bindColor(paint(geom.rest.boxFill), prefix + ".rest-boxFill")];
component.strokes = [bindColor(paint(geom.rest.boxBorder), prefix + ".rest-boxBorder")];
component.strokeWeight = 0;
component.strokeAlign = "INSIDE";
component.topLeftRadius = 0;
component.topRightRadius = 0;
component.bottomRightRadius = 0;
component.bottomLeftRadius = 0;
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

const label = await paintText(labelResolved, geom.label, geom.labelFontSize, geom.labelLineHeight, geom.lineHeightUnit, geom.decoration);
label.name = "link/label :: font-provenance=" + encodeURIComponent(JSON.stringify(labelResolved.spec));
label.fills = [bindColor(paint(geom.rest.label), prefix + ".rest-label")];
bindFloat(label, "fontSize", prefix + ".labelFontSize");
if (geom.lineHeightUnit === "PIXELS") bindFloat(label, "lineHeight", prefix + ".labelLineHeight");
component.appendChild(label);

component.layoutSizingHorizontal = "HUG";
component.layoutSizingVertical = "HUG";
if (component.layoutMode !== "HORIZONTAL") throw new Error("LINK-FAKE-LAYOUT:" + component.name);

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
container.setSharedPluginData(NS, "ownershipKey", "link/container");
component.setSharedPluginData(NS, "runIdentity", runIdentity);
component.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
component.setSharedPluginData(NS, "recipeHash", recipeHash);
component.setSharedPluginData(NS, "envelopeHash", envelopeHash);
component.setSharedPluginData(NS, "ownershipKey", "link");
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
  paintedLabelFont: labelResolved.painted,
};
