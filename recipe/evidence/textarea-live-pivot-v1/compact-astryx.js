if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.textarea.recipe.v1";
const runIdentity = "830c90b5-e9c10699-09726acb-textarea-v1";
const pageName = "Recipe Pivot / Textarea / 830c90b5-e9c10699-09726acb-textarea-v1";
const adapterIdentity = "astryx-textarea-reviewed-v1";
const recipeHash = "830c90b5322b162c6852d998b3255fbd61d319d913554ed520c1064f5b075817";
const envelopeHash = "0aff1a96a28b40c65b14205ec53439c84263a31d5b1b33bcba235a59b8793435";
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
const labelResolved = await resolvePainted({"requestedFamily":"-apple-system","requestedStyle":"Medium","resolvedFamily":"SF Pro","resolvedStyle":"Medium","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Medium"},{"family":"SF Pro","style":"Medium"},{"family":"Segoe UI","style":"Semibold"},{"family":"Roboto","style":"Medium"},{"family":"Helvetica","style":"Bold"},{"family":"Arial","style":"Bold"}],"degradation":"source -apple-system stack; Figma cannot load a CSS stack; first named host font is SF Pro Medium"});
const valueResolved = await resolvePainted({"requestedFamily":"-apple-system","requestedStyle":"Regular","resolvedFamily":"SF Pro","resolvedStyle":"Regular","resolution":"fallback","fallbackChain":[{"family":"-apple-system","style":"Regular"},{"family":"SF Pro","style":"Regular"},{"family":"Segoe UI","style":"Regular"},{"family":"Roboto","style":"Regular"},{"family":"Helvetica","style":"Regular"},{"family":"Arial","style":"Regular"}],"degradation":"source -apple-system stack; Figma cannot load a CSS stack; first named host font is SF Pro Regular"});

const collectionName = "Recipe Textarea / " + runIdentity + " / " + adapterIdentity;
const locals = figma.variables.getLocalVariableCollectionsAsync
  ? await figma.variables.getLocalVariableCollectionsAsync()
  : [];
if (locals.some((c) => c.name === collectionName)) throw new Error("TEXTAREA-VARIABLE-COLLECTION-COLLISION:" + collectionName);
const collection = figma.variables.createVariableCollection(collectionName);
collection.renameMode(collection.modes[0].modeId, "Default");
collection.hiddenFromPublishing = true;
const modeId = collection.modes[0].modeId;
const prefix = "astryx.textarea";
const planned = [["FLOAT","astryx.textarea.box-height",70],["FLOAT","astryx.textarea.box-paddingX",8],["FLOAT","astryx.textarea.box-paddingY",4],["FLOAT","astryx.textarea.box-radius",8],["FLOAT","astryx.textarea.box-borderWidth",1],["FLOAT","astryx.textarea.box-lineHeight",20],["FLOAT","astryx.textarea.labelGap",4],["FLOAT","astryx.textarea.labelFontSize",14],["FLOAT","astryx.textarea.valueFontSize",14],["COLOR","astryx.textarea.states-empty-enabled-boxFill","#ffffffff"],["COLOR","astryx.textarea.states-empty-enabled-boxBorder","#ccd3dbff"],["COLOR","astryx.textarea.states-empty-enabled-label","#4e606fff"],["COLOR","astryx.textarea.states-empty-enabled-value","#4e606fff"],["COLOR","astryx.textarea.states-value-enabled-boxFill","#ffffffff"],["COLOR","astryx.textarea.states-value-enabled-boxBorder","#ccd3dbff"],["COLOR","astryx.textarea.states-value-enabled-label","#4e606fff"],["COLOR","astryx.textarea.states-value-enabled-value","#0a1317ff"],["COLOR","astryx.textarea.states-empty-disabled-boxFill","#ffffffff"],["COLOR","astryx.textarea.states-empty-disabled-boxBorder","#ccd3dbff"],["COLOR","astryx.textarea.states-empty-disabled-label","#a4b0bcff"],["COLOR","astryx.textarea.states-empty-disabled-value","#4e606fff"],["COLOR","astryx.textarea.states-value-disabled-boxFill","#ffffffff"],["COLOR","astryx.textarea.states-value-disabled-boxBorder","#ccd3dbff"],["COLOR","astryx.textarea.states-value-disabled-label","#a4b0bcff"],["COLOR","astryx.textarea.states-value-disabled-value","#0a1317ff"]];
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
const geom = {"box":{"height":70,"paddingX":8,"paddingY":4,"radius":8,"borderWidth":1,"lineHeight":20},"labelGap":4,"strokeAlign":"INSIDE","labelFontSize":14,"valueFontSize":14,"cells":{"false/empty":{"boxFill":"#ffffffff","boxBorder":"#ccd3dbff","opacity":1,"label":"#4e606fff","value":"#4e606fff","characters":"Add a note"},"false/value":{"boxFill":"#ffffffff","boxBorder":"#ccd3dbff","opacity":1,"label":"#4e606fff","value":"#0a1317ff","characters":"Meeting notes for Tuesday."},"true/empty":{"boxFill":"#ffffffff","boxBorder":"#ccd3dbff","opacity":0.5,"label":"#a4b0bcff","value":"#4e606fff","characters":"Add a note"},"true/value":{"boxFill":"#ffffffff","boxBorder":"#ccd3dbff","opacity":0.5,"label":"#a4b0bcff","value":"#0a1317ff","characters":"Meeting notes for Tuesday."}}};

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
section.name = "Recipe Pivot / Astryx / " + recipeHash.slice(0, 8);
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
set.name = "textarea/set :: Astryx TextArea";
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
