if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.textarea.recipe.v1";
const runIdentity = "830c90b5-e9c10699-09726acb-textarea-v1";
const pageName = "Recipe Pivot / Textarea / 830c90b5-e9c10699-09726acb-textarea-v1";
const adapterIdentity = "antd-textarea-reviewed-v1";
const recipeHash = "09726acba383e0192d51866cb3e0d2a8f0a95254990139e25edd915c79e4010e";
const envelopeHash = "01927db3f4fccea94bcf1c60edfa33812614123b97faedf78770d401023acb22";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302"];
await figma.loadAllPagesAsync();
const page = figma.root.children.find((p) => p.name === pageName);
if (!page) throw new Error("TEXTAREA-PAGE-MISSING");
if (signed.includes(page.id)) throw new Error("TEXTAREA-MUST-NOT-WRITE-SIGNED-PAGE:" + page.id);
if (page.getSharedPluginData(NS, "runIdentity") !== runIdentity)
  throw new Error("TEXTAREA-PAGE-IDENTITY-MISMATCH:" + page.id);
await figma.setCurrentPageAsync(page);
if (signed.includes(figma.currentPage.id)) throw new Error("TEXTAREA-MUST-NOT-WRITE-SIGNED-PAGE:" + figma.currentPage.id);
if (page.children.some((n) => n.type === "SECTION" && n.getSharedPluginData(NS, "adapterIdentity") === adapterIdentity))
  throw new Error("TEXTAREA-SECTION-EXISTS:" + adapterIdentity);

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
    .map((c) => allFonts.find((f) => f.fontName.family === c.family && f.fontName.style === c.style))
    .find(Boolean);
  if (!found) throw new Error("TEXTAREA-FONT-UNAVAILABLE:" + spec.requestedFamily + ":" + spec.requestedStyle);
  if (found.fontName.family !== spec.resolvedFamily || found.fontName.style !== spec.resolvedStyle)
    throw new Error("TEXTAREA-FONT-PROVENANCE-TAMPER:" + found.fontName.family + ":" + found.fontName.style);
  await figma.loadFontAsync(found.fontName);
  return { spec, found: found.fontName, painted: found.fontName };
};
const labelResolved = await resolvePainted({"requestedFamily":"-apple-system","requestedStyle":"Regular","resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica Neue","style":"Regular"},{"family":"Arial","style":"Regular"}],"degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular"});
const valueResolved = await resolvePainted({"requestedFamily":"-apple-system","requestedStyle":"Regular","resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica Neue","style":"Regular"},{"family":"Arial","style":"Regular"}],"degradation":"antd --font-family is a CSS stack; Figma cannot load it; first named host font is SF Pro Regular"});

const collectionName = "Recipe Textarea / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((c) => c.name === collectionName)) throw new Error("TEXTAREA-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = "antd.textarea";
const planned = [["FLOAT","antd.textarea.box-height",54],["FLOAT","antd.textarea.box-paddingX",11],["FLOAT","antd.textarea.box-paddingY",4],["FLOAT","antd.textarea.box-radius",6],["FLOAT","antd.textarea.box-borderWidth",1],["FLOAT","antd.textarea.box-lineHeight",22],["FLOAT","antd.textarea.labelGap",8],["FLOAT","antd.textarea.labelFontSize",14],["FLOAT","antd.textarea.valueFontSize",14],["COLOR","antd.textarea.states-empty-enabled-boxFill","#ffffffff"],["COLOR","antd.textarea.states-empty-enabled-boxBorder","#d9d9d9ff"],["COLOR","antd.textarea.states-empty-enabled-label","#000000e0"],["COLOR","antd.textarea.states-empty-enabled-value","#00000040"],["COLOR","antd.textarea.states-value-enabled-boxFill","#ffffffff"],["COLOR","antd.textarea.states-value-enabled-boxBorder","#d9d9d9ff"],["COLOR","antd.textarea.states-value-enabled-label","#000000e0"],["COLOR","antd.textarea.states-value-enabled-value","#000000e0"],["COLOR","antd.textarea.states-empty-disabled-boxFill","#0000000a"],["COLOR","antd.textarea.states-empty-disabled-boxBorder","#d9d9d9ff"],["COLOR","antd.textarea.states-empty-disabled-label","#00000040"],["COLOR","antd.textarea.states-empty-disabled-value","#00000040"],["COLOR","antd.textarea.states-value-disabled-boxFill","#0000000a"],["COLOR","antd.textarea.states-value-disabled-boxBorder","#d9d9d9ff"],["COLOR","antd.textarea.states-value-disabled-label","#00000040"],["COLOR","antd.textarea.states-value-disabled-value","#00000040"]];
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
const geom = {"box":{"height":54,"paddingX":11,"paddingY":4,"radius":6,"borderWidth":1,"lineHeight":22},"labelGap":8,"strokeAlign":"INSIDE","labelFontSize":14,"valueFontSize":14,"cells":{"false/empty":{"boxFill":"#ffffffff","boxBorder":"#d9d9d9ff","opacity":1,"label":"#000000e0","value":"#00000040","characters":"Add a note"},"false/value":{"boxFill":"#ffffffff","boxBorder":"#d9d9d9ff","opacity":1,"label":"#000000e0","value":"#000000e0","characters":"Meeting notes for Tuesday."},"true/empty":{"boxFill":"#0000000a","boxBorder":"#d9d9d9ff","opacity":1,"label":"#00000040","value":"#00000040","characters":"Add a note"},"true/value":{"boxFill":"#0000000a","boxBorder":"#d9d9d9ff","opacity":1,"label":"#00000040","value":"#00000040","characters":"Meeting notes for Tuesday."}}};

const paintText = async (resolved, characters, fontSize, lineHeight, alignV) => {
  const node = figma.createText();
  node.fontName = resolved.painted;
  node.characters = characters;
  node.fontSize = fontSize;
  node.lineHeight = lineHeight == null ? { unit: "AUTO" } : { unit: "PIXELS", value: lineHeight };
  node.textAlignHorizontal = "LEFT";
  node.textAlignVertical = alignV;
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
      throw new Error("TEXTAREA-FONT-ZERO-INTRINSIC");
  }
  if (node.width <= 0 || node.height <= 0) throw new Error("TEXTAREA-TEXT-GEOMETRY");
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

const components = [];
for (const disabled of ["false", "true"]) {
  for (const content of ["empty", "value"]) {
    const arm = disabled === "true" ? "disabled" : "enabled";
    const cell = geom.cells[disabled + "/" + content];
    const component = figma.createComponent();
    component.clipsContent = false;
    component.name = "Disabled=" + disabled + ", Content=" + content;
    component.layoutMode = "VERTICAL";
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = "MIN";
    component.itemSpacing = geom.labelGap;
    component.fills = [];
    bindFloat(component, "itemSpacing", prefix + ".labelGap");
    section.appendChild(component);

    const label = await paintText(labelResolved, "Notes", geom.labelFontSize, null, "CENTER");
    label.name = "textarea/label :: font-provenance=" + encodeURIComponent(JSON.stringify(labelResolved.spec));
    label.fills = [bindColor(paint(cell.label), prefix + ".states-" + content + "-" + arm + "-label")];
    bindFloat(label, "fontSize", prefix + ".labelFontSize");
    component.appendChild(label);

    const box = figma.createFrame();
    box.name = "textarea/box";
    box.layoutMode = "VERTICAL";
    box.primaryAxisAlignItems = "MIN";
    box.counterAxisAlignItems = "MIN";
    box.itemSpacing = 0;
    box.clipsContent = true;
    box.opacity = cell.opacity;
    box.paddingTop = geom.box.paddingY;
    box.paddingRight = geom.box.paddingX;
    box.paddingBottom = geom.box.paddingY;
    box.paddingLeft = geom.box.paddingX;
    box.resizeWithoutConstraints(Math.max(box.width, 1), geom.box.height);
    box.layoutSizingHorizontal = "HUG";
    box.layoutSizingVertical = "FIXED";
    box.fills = [bindColor(paint(cell.boxFill), prefix + ".states-" + content + "-" + arm + "-boxFill")];
    box.strokes = [bindColor(paint(cell.boxBorder), prefix + ".states-" + content + "-" + arm + "-boxBorder")];
    box.strokeWeight = geom.box.borderWidth;
    box.strokeAlign = "INSIDE";
    box.topLeftRadius = geom.box.radius;
    box.topRightRadius = geom.box.radius;
    box.bottomRightRadius = geom.box.radius;
    box.bottomLeftRadius = geom.box.radius;
    bindFloat(box, "height", prefix + ".box-height");
    bindFloat(box, "paddingTop", prefix + ".box-paddingY");
    bindFloat(box, "paddingRight", prefix + ".box-paddingX");
    bindFloat(box, "paddingBottom", prefix + ".box-paddingY");
    bindFloat(box, "paddingLeft", prefix + ".box-paddingX");
    bindFloat(box, "strokeWeight", prefix + ".box-borderWidth");
    bindFloat(box, "topLeftRadius", prefix + ".box-radius");
    bindFloat(box, "topRightRadius", prefix + ".box-radius");
    bindFloat(box, "bottomRightRadius", prefix + ".box-radius");
    bindFloat(box, "bottomLeftRadius", prefix + ".box-radius");
    component.appendChild(box);

    const value = await paintText(valueResolved, cell.characters, geom.valueFontSize, geom.box.lineHeight, "TOP");
    value.name = "textarea/value :: font-provenance=" + encodeURIComponent(JSON.stringify(valueResolved.spec));
    value.fills = [bindColor(paint(cell.value), prefix + ".states-" + content + "-" + arm + "-value")];
    bindFloat(value, "fontSize", prefix + ".valueFontSize");
    bindFloat(value, "lineHeight", prefix + ".box-lineHeight");
    box.appendChild(value);

    component.layoutSizingHorizontal = "HUG";
    component.layoutSizingVertical = "HUG";
    if (component.layoutMode !== "VERTICAL") throw new Error("TEXTAREA-FAKE-LAYOUT:" + component.name);
    components.push(component);
  }
}
const set = figma.combineAsVariants(components, section);
set.name = "textarea/set :: Ant Design TextArea";
set.description = "Experimental textarea@1 primitive-IR mint. Recipe " + recipeHash + "; source adapter " + adapterIdentity + ".";
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
  paintedLabelFont: labelResolved.painted,
  paintedValueFont: valueResolved.painted,
};
