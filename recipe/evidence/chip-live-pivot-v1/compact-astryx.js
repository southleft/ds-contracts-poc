if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.chip.recipe.v1";
const runIdentity = "932f13fe-d960c0d4-908fd120-chip-v1";
const pageName = "Recipe Pivot / Chip / 932f13fe-d960c0d4-908fd120-chip-v1";
const adapterIdentity = "astryx-chip-reviewed-v1";
const recipeHash = "932f13fefdd27eb4dd2b5fb64e01bcb803ee1f4f6418109114faf414894738b6";
const envelopeHash = "84e48b7a837f3e910f24cc528cdab62308d7b05ecec478fb2c97511ce5830cb9";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302","183:75495","183:75801"];
await figma.loadAllPagesAsync();
const page = figma.root.children.find((candidate) => candidate.name === pageName);
if (!page) throw new Error("CHIP-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("CHIP-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("CHIP-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (signed.includes(figma.currentPage.id)) throw new Error("CHIP-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
if (page.children.some((node) => node.type === "SECTION" && node.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("CHIP-SECTION-EXISTS:" + adapterIdentity);

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
  if (!found) throw new Error("CHIP-FONT-UNAVAILABLE:" + spec.requestedFamily + ":" + spec.requestedStyle);
  if (found.fontName.family !== spec.resolvedFamily || found.fontName.style !== spec.resolvedStyle)
    throw new Error("CHIP-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
  await figma.loadFontAsync(found.fontName);
  return { spec, found: found.fontName, painted: found.fontName };
};
const labelResolved = await resolvePainted({"requestedFamily":"-apple-system","requestedStyle":"Medium","resolvedFamily":"SF Pro","resolvedStyle":"Medium","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Medium"},{"family":"SF Pro","style":"Medium"},{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"degradation":"source -apple-system Medium; Figma cannot load a CSS stack; first named host font is SF Pro Medium (zero-glyph; painted Roboto Medium)"});

const collectionName = "Recipe Chip / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((collection) => collection.name === collectionName)) throw new Error("CHIP-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = "astryx.chip";
const planned = [["FLOAT","astryx.chip.box-height",24],["FLOAT","astryx.chip.box-paddingX",8],["FLOAT","astryx.chip.box-paddingY",0],["FLOAT","astryx.chip.box-radius",4],["FLOAT","astryx.chip.box-borderWidth",0],["FLOAT","astryx.chip.labelFontSize",12],["FLOAT","astryx.chip.labelLineHeight",20],["COLOR","astryx.chip.rest-boxFill","#0536591a"],["COLOR","astryx.chip.rest-boxBorder","#00000000"],["COLOR","astryx.chip.rest-label","#0a1317ff"]];
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
const geom = {"box":{"height":24,"paddingX":8,"paddingY":0,"radius":4,"borderWidth":0},"labelFontSize":12,"labelLineHeight":20,"strokeAlign":"INSIDE","label":"Tag","rest":{"boxFill":"#0536591a","boxBorder":"#00000000","boxOpacity":1,"label":"#0a1317ff"},"componentLabel":"Astryx Token"};

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
      throw new Error("CHIP-FONT-ZERO-INTRINSIC");
  }
  if (node.width <= 0 || node.height <= 0) throw new Error("CHIP-TEXT-GEOMETRY");
  return node;
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
component.name = "chip/variant/default :: " + geom.componentLabel;
component.description = "Experimental chip@1 primitive-IR mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
component.opacity = geom.rest.boxOpacity;
component.layoutMode = "HORIZONTAL";
component.primaryAxisAlignItems = "MIN";
component.counterAxisAlignItems = "CENTER";
component.itemSpacing = 0;
component.paddingTop = geom.box.paddingY;
component.paddingRight = geom.box.paddingX;
component.paddingBottom = geom.box.paddingY;
component.paddingLeft = geom.box.paddingX;
component.fills = [bindColor(paint(geom.rest.boxFill), prefix + ".rest-boxFill")];
component.strokes = [bindColor(paint(geom.rest.boxBorder), prefix + ".rest-boxBorder")];
component.strokeWeight = geom.box.borderWidth;
component.strokeAlign = "INSIDE";
component.topLeftRadius = geom.box.radius;
component.topRightRadius = geom.box.radius;
component.bottomRightRadius = geom.box.radius;
component.bottomLeftRadius = geom.box.radius;
component.resizeWithoutConstraints(Math.max(component.width, 1), geom.box.height);
bindFloat(component, "height", prefix + ".box-height");
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

const label = await paintText(labelResolved, geom.label, geom.labelFontSize, geom.labelLineHeight);
label.name = "chip/label :: font-provenance=" + encodeURIComponent(JSON.stringify(labelResolved.spec));
label.fills = [bindColor(paint(geom.rest.label), prefix + ".rest-label")];
bindFloat(label, "fontSize", prefix + ".labelFontSize");
bindFloat(label, "lineHeight", prefix + ".labelLineHeight");
component.appendChild(label);

component.layoutSizingHorizontal = "HUG";
component.layoutSizingVertical = "FIXED";
if (component.layoutMode !== "HORIZONTAL") throw new Error("CHIP-FAKE-LAYOUT:" + component.name);

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
container.setSharedPluginData(NS, "ownershipKey", "chip/container");
component.setSharedPluginData(NS, "runIdentity", runIdentity);
component.setSharedPluginData(NS, "adapterIdentity", adapterIdentity);
component.setSharedPluginData(NS, "recipeHash", recipeHash);
component.setSharedPluginData(NS, "envelopeHash", envelopeHash);
component.setSharedPluginData(NS, "ownershipKey", "chip");
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
