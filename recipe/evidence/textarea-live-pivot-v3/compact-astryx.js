if (figma.fileKey !== "byMp6lt0Ij9b2QbkDGFwBh") throw new Error("WRONG-FILE:" + figma.fileKey);
if (figma.root.name !== "Scratch Project") throw new Error("WRONG-FILE-NAME:" + figma.root.name);
const NS = "ds.contracts.textarea.recipe.v1";
const runIdentity = "71033c6d-82f958a9-142f3598-textarea-v3";
const pageName = "Recipe Pivot / Textarea / 71033c6d-82f958a9-142f3598-textarea-v3";
const adapterIdentity = "astryx-textarea-reviewed-v1";
const recipeHash = "71033c6dbe8ec74e4bf355c9df41fae62e5b36e16af2a5ade1f6a6b0103bb5c9";
const envelopeHash = "ed9d4b169100fe040f95f63891ddf6fb52c203a8f73fedb92b5fd8eeb8229029";
const signed = ["115:295378","163:35981","183:70641","183:69150","85:6781","173:48924","181:64873","183:74742","183:75031","183:75302","183:75495","183:76022","196:76370","197:76679","197:76903","198:77048","198:77177"];
const contents = ["empty","focus","value"];
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
if (page.children.some((n) => n.name === "Component Container"))
  throw new Error("TEXTAREA-PAGE-LEVEL-COMPONENT-CONTAINER");

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
const planned = [["FLOAT","astryx.textarea.box-height",70],["FLOAT","astryx.textarea.box-paddingX",8],["FLOAT","astryx.textarea.box-paddingY",4],["FLOAT","astryx.textarea.box-radius",8],["FLOAT","astryx.textarea.box-borderWidth",1],["FLOAT","astryx.textarea.box-lineHeight",20],["FLOAT","astryx.textarea.labelGap",4],["FLOAT","astryx.textarea.labelFontSize",14],["FLOAT","astryx.textarea.valueFontSize",14],["FLOAT","astryx.textarea.labelInsetX",0],["FLOAT","astryx.textarea.labelInactiveOffsetY",0],["FLOAT","astryx.textarea.labelFloatingOffsetY",0],["FLOAT","astryx.textarea.floatingLabelFontSize",14],["COLOR","astryx.textarea.notchFill","#00000000"],["COLOR","astryx.textarea.states-empty-enabled-boxFill","#ffffffff"],["COLOR","astryx.textarea.states-empty-enabled-boxBorder","#ccd3dbff"],["COLOR","astryx.textarea.states-empty-enabled-label","#4e606fff"],["COLOR","astryx.textarea.states-empty-enabled-value","#4e606fff"],["COLOR","astryx.textarea.states-value-enabled-boxFill","#ffffffff"],["COLOR","astryx.textarea.states-value-enabled-boxBorder","#ccd3dbff"],["COLOR","astryx.textarea.states-value-enabled-label","#4e606fff"],["COLOR","astryx.textarea.states-value-enabled-value","#0a1317ff"],["COLOR","astryx.textarea.states-empty-disabled-boxFill","#ffffffff"],["COLOR","astryx.textarea.states-empty-disabled-boxBorder","#ccd3dbff"],["COLOR","astryx.textarea.states-empty-disabled-label","#a4b0bcff"],["COLOR","astryx.textarea.states-empty-disabled-value","#4e606fff"],["COLOR","astryx.textarea.states-value-disabled-boxFill","#ffffffff"],["COLOR","astryx.textarea.states-value-disabled-boxBorder","#ccd3dbff"],["COLOR","astryx.textarea.states-value-disabled-label","#a4b0bcff"],["COLOR","astryx.textarea.states-value-disabled-value","#0a1317ff"]];
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
const geom = {"box":{"height":70,"paddingX":8,"paddingY":4,"radius":8,"borderWidth":1,"lineHeight":20},"labelGap":4,"strokeAlign":"INSIDE","labelFontSize":14,"valueFontSize":14,"labelPlacement":"stacked","outlineTreatment":"plain","labelInsetX":0,"labelInactiveOffsetY":0,"labelFloatingOffsetY":0,"floatingLabelFontSize":14,"notchFill":"#00000000","cells":{"false/empty":{"boxFill":"#ffffffff","boxBorder":"#ccd3dbff","opacity":1,"label":"#4e606fff","value":"#4e606fff","characters":"Add a note"},"false/value":{"boxFill":"#ffffffff","boxBorder":"#ccd3dbff","opacity":1,"label":"#4e606fff","value":"#0a1317ff","characters":"Meeting notes for Tuesday."},"true/empty":{"boxFill":"#ffffffff","boxBorder":"#ccd3dbff","opacity":0.5,"label":"#a4b0bcff","value":"#4e606fff","characters":"Add a note"},"true/value":{"boxFill":"#ffffffff","boxBorder":"#ccd3dbff","opacity":0.5,"label":"#a4b0bcff","value":"#0a1317ff","characters":"Meeting notes for Tuesday."}}};

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
  for (const content of contents) {
    const arm = disabled === "true" ? "disabled" : "enabled";
    const tokenContent = content === "value" ? "value" : "empty";
    const cell = geom.cells[disabled + "/" + tokenContent];
    const floating = geom.labelPlacement === "floating";
    const shrunk = floating && content !== "empty";
    const hidePlaceholder = floating && content === "empty";
    const component = figma.createComponent();
    if (floating) component.clipsContent = false;
    component.name = "Disabled=" + disabled + ", Content=" + content;
    component.layoutMode = "VERTICAL";
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = "MIN";
    component.itemSpacing = geom.labelGap;
    component.fills = [];
    bindFloat(component, "itemSpacing", prefix + ".labelGap");
    section.appendChild(component);

    const labelSize = shrunk ? geom.floatingLabelFontSize : geom.labelFontSize;
    const label = await paintText(labelResolved, "Notes", labelSize, null, "CENTER");
    label.name = "textarea/label :: font-provenance=" + encodeURIComponent(JSON.stringify(labelResolved.spec));
    label.fills = [bindColor(paint(cell.label), prefix + ".states-" + tokenContent + "-" + arm + "-label")];
    bindFloat(label, "fontSize", shrunk ? prefix + ".floatingLabelFontSize" : prefix + ".labelFontSize");
    if (!floating) component.appendChild(label);

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
    box.fills = [bindColor(paint(cell.boxFill), prefix + ".states-" + tokenContent + "-" + arm + "-boxFill")];
    box.strokes = [bindColor(paint(cell.boxBorder), prefix + ".states-" + tokenContent + "-" + arm + "-boxBorder")];
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
    value.fills = [bindColor(paint(cell.value), prefix + ".states-" + tokenContent + "-" + arm + "-value")];
    bindFloat(value, "fontSize", prefix + ".valueFontSize");
    bindFloat(value, "lineHeight", prefix + ".box-lineHeight");
    value.visible = !hidePlaceholder;
    box.appendChild(value);

    if (floating) {
      const row = figma.createFrame();
      row.name = "textarea/label-row";
      row.layoutMode = "HORIZONTAL";
      row.primaryAxisAlignItems = "MIN";
      row.counterAxisAlignItems = "CENTER";
      row.itemSpacing = 0;
      row.fills = shrunk && geom.outlineTreatment === "notched"
        ? [bindColor(paint(geom.notchFill), prefix + ".notchFill")]
        : [];
      row.appendChild(label);
      component.appendChild(row);
      row.layoutPositioning = "ABSOLUTE";
      row.x = geom.labelInsetX;
      row.y = shrunk ? geom.labelFloatingOffsetY : geom.labelInactiveOffsetY;
      row.constraints = { horizontal: "MIN", vertical: "MIN" };
      row.layoutSizingHorizontal = "HUG";
      row.layoutSizingVertical = "HUG";
    }

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

const arrange = figma.createFrame();
arrange.name = "Arrange / Textarea / Astryx / " + runIdentity;
arrange.layoutMode = "VERTICAL";
arrange.primaryAxisAlignItems = "MIN";
arrange.counterAxisAlignItems = "MIN";
arrange.itemSpacing = 0;
arrange.paddingTop = 40;
arrange.paddingRight = 40;
arrange.paddingBottom = 40;
arrange.paddingLeft = 40;
arrange.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
arrange.topLeftRadius = 8;
arrange.topRightRadius = 8;
arrange.bottomRightRadius = 8;
arrange.bottomLeftRadius = 8;
section.appendChild(arrange);
arrange.appendChild(set);
arrange.layoutSizingHorizontal = "HUG";
arrange.layoutSizingVertical = "HUG";
arrange.x = 40;
arrange.y = 40;

const review = figma.createFrame();
review.name = "Review / Textarea / Astryx / " + runIdentity;
review.layoutMode = "VERTICAL";
review.primaryAxisAlignItems = "MIN";
review.counterAxisAlignItems = "MIN";
review.itemSpacing = 16;
review.paddingTop = 24;
review.paddingRight = 24;
review.paddingBottom = 24;
review.paddingLeft = 24;
review.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
review.topLeftRadius = 8;
review.topRightRadius = 8;
review.bottomRightRadius = 8;
review.bottomLeftRadius = 8;
section.appendChild(review);
for (const variant of set.children) {
  const instance = variant.createInstance();
  instance.name = variant.name;
  review.appendChild(instance);
}
if (review.children.length !== set.children.length)
  throw new Error("TEXTAREA-REVIEW-VARIANT-MISMATCH:" + review.children.length);
review.layoutSizingHorizontal = "HUG";
review.layoutSizingVertical = "HUG";
review.x = arrange.x + arrange.width + 40;
review.y = arrange.y;

if (page.children.some((n) => n.name === "Component Container"))
  throw new Error("TEXTAREA-PAGE-LEVEL-COMPONENT-CONTAINER");
section.resizeWithoutConstraints(
  Math.max(arrange.x + arrange.width, review.x + review.width) + 80,
  Math.max(arrange.y + arrange.height, review.y + review.height) + 80,
);
return {
  pageId: page.id,
  pageName: page.name,
  sectionId: section.id,
  setId: set.id,
  arrangeId: arrange.id,
  reviewId: review.id,
  collectionId: collection.id,
  variantCount: set.children.length,
  reviewCount: review.children.length,
  adapterIdentity,
  recipeHash,
  paintedLabelFont: labelResolved.painted,
  paintedValueFont: valueResolved.painted,
};
